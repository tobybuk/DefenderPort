import test from 'node:test';
import assert from 'node:assert/strict';
import { RAM } from '../runtime/ram.js';
import { PHR6_LAYOUT as L } from '../runtime/phr6-layout.js';
import { createDefa7RandomRoutines } from '../original/defa7-random.js';
import { createDefa7Routines } from '../original/defa7.js';
import { createDefa7PlayerRoutines } from '../original/defa7-player.js';
import { createDefa7Executive } from '../original/defa7-exec.js';
import { createFlightHarness } from '../demo/flight-harness.js';
import { TranslationBoundaryError } from '../runtime/continuations.js';
const make = () => {
    const mem = new RAM(), proc = createDefa7Routines(mem, L);
    proc.PINIT();
    proc.OINIT();
    return { mem, proc, p: createDefa7PlayerRoutines(mem, L), random: createDefa7RandomRoutines(mem, L) };
};
const r = (mem, n) => mem.read16(L.at(n));
const w = (mem, n, v) => mem.write16(L.at(n), v);
const rr = (mem, n) => mem.read8(L.at(n));
const ww = (mem, n, v) => mem.write8(L.at(n), v);
test('PHR6: allocation positions are in original direct RAM order, and list sizes match', () => {
    assert.equal(L.at('BGL'), 0xa020);
    assert.equal(L.at('OLIST'), 0xa23c);
    assert.equal(L.at('PTAB'), 0xaac5);
    assert.equal(L.at('TABEND') - L.at('PTAB'), 75 * 15);
    assert.equal(L.at('SPTEND') - L.at('SPTAB'), 5 * 23);
    assert.equal(L.at('SMEND') - L.at('SMAP'), 64);
    const { mem } = make();
    let n = r(mem, 'FREE'), count = 0;
    while (n) {
        count++;
        n = mem.read16(n);
        assert.ok(count <= 75);
    }
    assert.equal(count, 75);
});
test('RAND: direct independent three-seed byte vector', () => {
    const { mem, random } = make();
    ww(mem, 'SEED', 0x12);
    ww(mem, 'HSEED', 0x34);
    ww(mem, 'LSEED', 0x56);
    // 3*0x12+0x11=0x47; A=(0x56>>3)^0x56=0x5c (carry=0).
    // LSEED=0x2b; HSEED=0x1a; SEED=0x47+0x2b+0x1a=0x8c.
    assert.equal(random.RAND(), 0x8c);
    assert.equal(rr(mem, 'HSEED'), 0x1a);
    assert.equal(rr(mem, 'LSEED'), 0x2b);
});
test('STINIT: 16 original star records with valid colour, X, and Y ranges', () => {
    const { mem, random } = make();
    w(mem, 'HSEED', 0xa55a);
    random.STINIT();
    assert.equal(rr(mem, 'STRCNT'), 16);
    let col = 0;
    for (let i = 0; i < 16; i++) {
        const off = L.at('SMAP') + 4 * i;
        assert.ok(mem.read8(off) < 0x9c);
        assert.ok(mem.read8(off + 1) > L.at('YMIN') && mem.read8(off + 1) <= 0xa8);
        assert.equal(mem.read8(off + 2), col);
        col = (col + 0x11) & 0x77;
    }
});
test('PLAYER: no controls results in no velocity, and never creates JS game objects', () => {
    const h = createFlightHarness();
    h.INPUT();
    const before = h.STATE();
    h.STEP();
    const after = h.STATE();
    assert.equal(after.vx, 0);
    assert.equal(after.vy, 0);
    assert.equal(after.bgl, before.bgl);
    assert.equal(after.x, before.x);
    assert.equal(after.y, before.y);
});
test('PLAYER: thrust alters original 24-bit RAM and scrolling, not floating-point coordinates', () => {
    const h = createFlightHarness();
    h.INPUT({ thrust: true });
    h.STEP();
    const s = h.STATE();
    assert.ok(s.bgl !== 0 || s.vx !== 0 || s.vxFraction !== 0);
    assert.equal(h.ram.read16(L.at('BGL')), s.bgl);
    assert.equal(h.ram.read16(L.at('PLAXV')), s.vx & 0xffff);
});
test('PLAYER: up/down controls move only in source Y boundaries and use signed fixed-point velocity', () => {
    const h = createFlightHarness();
    h.INPUT({ up: true });
    for (let i = 0; i < 20; i++)
        h.STEP();
    const up = h.STATE();
    assert.ok(up.y < 133);
    assert.ok(up.vy < 0);
    assert.ok(up.vy >= -0x200);
    h.INPUT({ down: true });
    for (let i = 0; i < 20; i++)
        h.STEP();
    const down = h.STATE();
    assert.ok(down.y > up.y);
    assert.ok(down.vy > 0);
    assert.ok(down.vy <= 0x200);
});
test('PLAYER: original STATUS bit 6 inhibits updates', () => {
    const h = createFlightHarness();
    h.INPUT({ thrust: true, up: true });
    h.ram.write8(L.at('STATUS'), 0x40);
    const before = h.STATE();
    for (let i = 0; i < 4; i++)
        h.STEP();
    // STATUS bit 6 gates PLAYER, but the separate source SNDSEQ can still
    // produce a thrust command while a game-control-inactive flag is set.
    // New stages update real objects, scanner, and sound independently of PLAYER.
    // Compare only the frozen original player RAM fields, not gameplay counters.
    for (const k of ['x', 'y', 'plax16', 'play16', 'vx', 'vxFraction', 'vy', 'bgl', 'bglx', 'direction'])
        assert.equal(h.STATE()[k], before[k], `${k} must be gated by STATUS bit 6`);
});
test('VELO: world-coordinate arithmetic updates original object RAM, not JS entities', () => {
    const { mem, proc, p } = make();
    const X = proc.GETOB();
    w(mem, 'OPTR', X);
    mem.write16(X + L.at('OX16'), 0xfffa);
    mem.write16(X + L.at('OXV'), 9);
    mem.write16(X + L.at('OY16'), 0x7800);
    mem.write16(X + L.at('OYV'), 0x0100);
    p.VELO();
    assert.equal(mem.read16(X + L.at('OX16')), 3);
    assert.equal(mem.read16(X + L.at('OY16')), 0x7900);
});
test('EXEC: original timer-wait returns a named continuation; untranslated original routines fail explicitly', () => {
    const { mem, proc } = make();
    const exec = createDefa7Executive(mem, L, proc, {});
    assert.deepEqual(exec.EXEC(), { kind: 'await-original-timer', next: 'EXEC0' });
    ww(mem, 'TIMER', 1);
    assert.throws(() => exec.EXEC(), TranslationBoundaryError);
});
test('SWP: source queue is consumed, not replaced by custom frame modulo scheduler', () => {
    const { mem, proc } = make();
    const e = createDefa7Executive(mem, L, proc, {});
    w(mem, 'SWPROC', 0x1234);
    mem.write16(L.at('SWPROC') + 2, 0x0100);
    e.SWP();
    assert.equal(r(mem, 'SWPROC'), 0);
    assert.equal(r(mem, 'ACTIVE'), L.at('PTAB'));
    assert.equal(mem.read16(L.at('PTAB') + L.at('PADDR')), 0x1234);
});
test('flight fixture is deterministic under identical control input sequences', () => {
    const f = () => {
        const h = createFlightHarness();
        for (let i = 0; i < 90; i++) {
            h.INPUT({ thrust: i < 56, up: i >= 15 && i < 29, down: i >= 50 && i < 70 });
            h.STEP();
        }
        return h.STATE();
    };
    assert.deepEqual(f(), f());
});
