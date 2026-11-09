/**
 * 6809 arithmetic/branch oracle for pinned DEFB6.SRC SCZ0 lines 843-900.
 * Reference logic is independent of the translated SCZ0 implementation;
 * conditions below compute CPU carry, zero, negative and overflow at the
 * branch points, including wrapping 8/16-bit subtraction.
 * https://github.com/mwenge/defender/blob/e74006344b16d19245510b5e55780f90d7606bb8/src/defb6.src#L843-L900
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { RAM } from '../runtime/ram.js';
import { PHR6_LAYOUT as L } from '../runtime/phr6-layout.js';
import { createDefb6LanderRoutines } from '../original/defb6-lander.js';
import { createFlightHarness } from '../demo/flight-harness.js';
const a = n => L.at(n);
const byte = n => n & 0xff, word = n => n & 0xffff;
const nz16 = n => (n & 0x8000) !== 0;
const signedBGE = (a, b) => {
    const v = word(a - b), N = nz16(v), V = !!(((a ^ b) & (a ^ v)) & 0x8000);
    return N === V;
};
const signedBGT8 = (x, y) => {
    const delta = byte(x - y), N = !!(delta & 0x80), V = !!(((x ^ y) & (x ^ delta)) & 0x80);
    return delta !== 0 && N === V;
};
function assemblyOracle({ worldX, playerX, playerY, enemyY, seed, szxv, szyv, szry, objx, timer }) {
    let B = szxv;
    if (!signedBGE(playerX, worldX))
        B = byte(-B); // CMPY OX16 / BGE / NEGB
    const xv = B & 0x80 ? 0xff00 | B : B;
    const delta = word(playerX - worldX + 380);
    let yv, nowY = enemyY, nowTimer = timer, fired = false, hop = false;
    if (delta <= 0x700) {
        yv = playerY >= enemyY ? szyv : word(~szyv); // SCZ6/SCZ7
        if (!objx)
            return { xv, yv, y: nowY, timer: nowTimer, fired, hop }; // SCZ12
    }
    else {
        const diff = byte(playerY - enemyY), borrow = playerY < enemyY, zero = diff === 0;
        if (!(borrow || zero))
            yv = diff > 8 ? 0 : word(~szyv); // SCZ3 or SCZ5
        else
            yv = signedBGT8(diff, 0xf8) ? szyv : 0; // SCZ2 CMPA #-8 / BGT
    }
    // SCZ10: if SEED has N set skip NEGB; otherwise negate hop.
    const hopByte = seed & 0x80 ? szry : byte(-szry);
    nowY = byte(enemyY + hopByte);
    if (nowY < L.at('YMIN'))
        nowY = L.at('YMAX');
    hop = true;
    nowTimer = byte(timer - 1);
    fired = nowTimer === 0;
    if (fired)
        nowTimer = 29; // deterministic fake RMAX response in test harness
    return { xv, yv, y: nowY, timer: nowTimer, fired, hop };
}
function fixture() {
    const ram = new RAM(), U = 0xb300, X = 0xb500, events = [];
    const procs = { SLEEP: (n, to) => ({ ticks: n, address: to }) };
    ram.write16(a('CRPROC'), U);
    ram.write16(U + a('PD'), X);
    const lander = createDefb6LanderRoutines(ram, L, procs, {
        addresses: { SCZ0: 0xe284, SSHSND: 0xe286 },
        RMAX: () => 29, SHOOT: () => {
            events.push('shot');
            return true;
        }, SNDLD: () => events.push('sound')
    });
    return { ram, U, X, lander, events };
}
function xorshift(seed) {
    let x = seed >>> 0;
    return () => {
        x ^= x << 13;
        x ^= x >>> 17;
        x ^= x << 5;
        return x >>> 0;
    };
}
function set(h, p) {
    const { ram, U, X } = h;
    ram.write16(a('PLABX'), p.playerX);
    ram.write8(a('PLAYC'), p.playerY);
    ram.write8(a('SEED'), p.seed);
    ram.write8(a('SZXV'), p.szxv);
    ram.write16(a('SZYV'), p.szyv);
    ram.write8(a('SZRY'), p.szry);
    ram.write16(X + a('OX16'), p.worldX);
    ram.write8(X + a('OY16'), p.enemyY);
    ram.write16(X + a('OBJX'), p.objx);
    ram.write8(U + a('PD2'), p.timer);
}
function state(h) {
    const { ram, U, X } = h;
    return {
        xv: ram.read16(X + a('OXV')), yv: ram.read16(X + a('OYV')),
        y: ram.read8(X + a('OY16')), timer: ram.read8(U + a('PD2'))
    };
}
test('SCZ0 exact CPU carry/overflow branch arithmetic: 3500 varied register states', () => {
    const rnd = xorshift(0x19810815), h = fixture();
    for (let i = 0; i < 3500; i++) {
        const p = { playerX: word(rnd()), worldX: word(rnd()), playerY: byte(rnd()), enemyY: byte(rnd()),
            seed: byte(rnd()), szxv: byte(rnd()), szyv: word(rnd()), szry: byte(rnd()),
            objx: i % 5 === 0 ? 0 : word(rnd()) || 1, timer: i % 8 === 0 ? 1 : byte(rnd()) || 2 };
        // Add targeted near-X cases, signed-world boundary and Y edge cases.
        if (i % 3 === 0)
            p.worldX = word(p.playerX + ((i % 5) - 2) * 256);
        if (i % 7 === 0)
            p.enemyY = p.playerY;
        if (i % 11 === 0)
            p.enemyY = byte(p.playerY + 7);
        if (i % 13 === 0)
            p.enemyY = byte(p.playerY - 8);
        h.events.length = 0;
        set(h, p);
        const expect = assemblyOracle(p), result = h.lander.SCZ0();
        assert.deepEqual(state(h), { xv: expect.xv, yv: expect.yv, y: expect.y, timer: expect.timer }, `SCZ0 case ${i}: ${JSON.stringify(p)}`);
        assert.equal(result.ticks, 3, 'original NAP 3,SCZ0');
        assert.equal(result.address, 0xe284, 'source continuation SCZ0');
        assert.deepEqual(h.events, expect.fired ? ['shot', 'sound'] : [], 'source shot/sound branch must agree');
    }
});
test('SCZ0 live source process moves a captured lander as a mutant across updates', () => {
    const h = createFlightHarness();
    for (let t = 0; t < 2500 && !h.ram.read8(a('SCZCNT')); t++)
        h.STEP();
    const all = () => {
        let X = h.ram.read16(a('OPTR'));
        const seen = new Set();
        while (X && !seen.has(X)) {
            seen.add(X);
            if (h.ram.read16(X + a('OPICT')) === 0xe280)
                return X;
            X = h.ram.read16(X + a('OLINK'));
        }
        X = h.ram.read16(a('IPTR'));
        while (X && !seen.has(X)) {
            seen.add(X);
            if (h.ram.read16(X + a('OPICT')) === 0xe280)
                return X;
            X = h.ram.read16(X + a('OLINK'));
        }
        return 0;
    };
    const X = all();
    assert.ok(X, 'lander becomes a mutant');
    const before = h.ram.read16(X + a('OX16'));
    for (let t = 0; t < 120; t++)
        h.STEP();
    const after = h.ram.read16(X + a('OX16'));
    assert.notEqual(after, before, 'source velocity integration changes horizontal world position');
    assert.ok(h.ram.read8(a('SCZCNT')) >= 1, 'source may create further mutants during 120 updates');
    assert.ok(h.STATE().scannerObjects > 0, 'mutant remains in source scanner lists');
});
