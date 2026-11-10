import test from 'node:test';
import assert from 'node:assert/strict';
import { RAM } from '../runtime/ram.js';
import { VideoMemory } from '../runtime/video-memory.js';
import { PHR6_LAYOUT as L } from '../runtime/phr6-layout.js';
import { createDefa7StarRoutines } from '../original/defa7-stars.js';
import { createDefa7ThrustRoutines } from '../original/defa7-thrust.js';
import { createDefa7ScanningRoutines } from '../original/defa7-scanning.js';
import { createDefa7Routines } from '../original/defa7.js';
import { createFlightHarness } from '../demo/flight-harness.js';
import { TranslationBoundaryError } from '../runtime/continuations.js';
const make = () => {
    const ram = new RAM(), video = new VideoMemory(), proc = createDefa7Routines(ram, L);
    proc.PINIT();
    proc.OINIT();
    const stars = createDefa7StarRoutines(ram, L, video), scan = createDefa7ScanningRoutines(ram, L);
    const r = n => ram.read8(L.at(n)), w = (n, v) => ram.write8(L.at(n), v);
    const rd = n => ram.read16(L.at(n)), wd = (n, v) => ram.write16(L.at(n), v);
    return { ram, video, proc, stars, scan, r, w, rd, wd };
};
const mk = (e, x, y = 0x8000, vx = 0, vy = 0) => {
    const p = e.proc.GETOB();
    e.ram.write16(p + L.at('OX16'), x);
    e.ram.write16(p + L.at('OY16'), y);
    e.ram.write16(p + L.at('OXV'), vx);
    e.ram.write16(p + L.at('OYV'), vy);
    return p;
};
test('STOUT implements source BGL/BGLX half-byte delta (not generic parallax)', () => {
    const e = make(), base = L.at('SMAP');
    e.w('STRCNT', 1);
    e.w('SEED', 0x05); // odd: the fall-through SBLNK only re-colours star 1
    e.ram.write8(base, 10);
    e.ram.write8(base + 1, 120);
    e.ram.write8(base + 2, 0x77);
    e.wd('BGL', 0);
    e.wd('BGLX', 0x0100);
    e.video.write8((10 << 8) | 120, 0xff);
    e.stars.STOUT();
    assert.equal(e.r('ITEMP'), 2);
    assert.equal(e.ram.read8(base), 12);
    assert.equal(e.video.read8((10 << 8) | 120), 0);
    assert.equal(e.video.read8((12 << 8) | 120), 0x07);
});
test('STOUT selects the original high colour nibble when BGL bit $40 is set', () => {
    const e = make(), base = L.at('SMAP');
    e.w('STRCNT', 1);
    e.w('SEED', 0x05);
    e.ram.write8(base, 15);
    e.ram.write8(base + 1, 100);
    e.ram.write8(base + 2, 0x73);
    e.wd('BGL', 0x0040);
    e.wd('BGLX', 0x0040);
    e.stars.STOUT();
    assert.equal(e.video.read8((15 << 8) | 100), 0x70);
});
test('STOUT original overflow bounds use $9C and $C0 (both branches)', () => {
    const e = make(), base = L.at('SMAP');
    e.w('STRCNT', 2);
    e.ram.write8(base, 0x9c);
    e.ram.write8(base + 1, 70);
    e.ram.write8(base + 4, 0xc1);
    e.ram.write8(base + 5, 75);
    e.stars.STOUT();
    assert.equal(e.ram.read8(base), 0);
    assert.equal(e.ram.read8(base + 4), 0x9b);
});
test('STOUT retains previous star bytes while STATUS bit $20 blocks output', () => {
    const e = make(), base = L.at('SMAP');
    e.w('STRCNT', 1);
    e.w('STATUS', 0x20);
    e.ram.write8(base, 21);
    e.ram.write8(base + 1, 60);
    e.video.write8((21 << 8) | 60, 0x44);
    e.wd('BGLX', 0x1234);
    e.stars.STOUT();
    assert.equal(e.ram.read8(base), 21);
    assert.equal(e.video.read8((21 << 8) | 60), 0x44);
});
test('STOUT refuses missing video translation, rather than silently skipping writes', () => {
    const e = make();
    e.w('STRCNT', 1);
    assert.throws(() => createDefa7StarRoutines(e.ram, L, {}).STOUT(), TranslationBoundaryError);
});
test('SBLNK increments exactly one star colour and follows odd-seed early return', () => {
    const e = make(), base = L.at('SMAP');
    e.w('SEED', 0x05);
    const X = base + 4;
    e.ram.write8(X + 2, 0x66);
    e.ram.write8(X, 55);
    e.ram.write8(X + 1, 70);
    e.stars.SBLNK();
    assert.equal(e.ram.read8(X + 2), 0x77);
    assert.equal(e.ram.read8(X), 55);
});
test('SBLNK erases previous video byte, assigns source seed X and terrain-mode Y', () => {
    const e = make(), base = L.at('SMAP');
    e.w('SEED', 0x20);
    e.w('STATUS', 2);
    e.w('LSEED', 0x07);
    const X = base + 0x20;
    e.ram.write8(X, 55);
    e.ram.write8(X + 1, 70);
    e.ram.write8(X + 2, 0x17);
    e.video.write8((55 << 8) | 70, 0x77);
    e.stars.SBLNK();
    assert.equal(e.video.read8((55 << 8) | 70), 0);
    assert.equal(e.ram.read8(X), 0x20);
    assert.equal(e.ram.read8(X + 1), 42 + 21);
    assert.equal(e.ram.read8(X + 2), 0x20);
});
test('SBLNK preserves the unusual upstream $A0 RAM write, then reuses X=$A0:LSEED', () => {
    const e = make(), star0 = L.at('SMAP');
    e.w('SEED', 0xa0);
    e.w('LSEED', 0x22);
    e.w('HSEED', 0x7c);
    e.wd('WCURS', 0);
    e.w('STATUS', 0);
    e.ram.write8(star0 + 0x20, 0x33);
    const rec = [];
    const write8 = e.ram.write8.bind(e.ram);
    e.ram.write8 = (a, v) => { if (a === 0xa022) rec.push(v); return write8(a, v); };
    e.stars.SBLNK();
    // STB ,X writes HSEED; SBL00/SBLNK0 then STA SX,X with the same X.
    assert.deepEqual(rec, [0x7c, 0xa0 - 0x84]);
    assert.equal(e.ram.read8(star0 + 0x20), 0x33, 'the SMAP star is not the one moved');
});
test('SBLNK $A0 path is dormant with the genuine WCURS ($6245) from COPYRT', () => {
    const e = make(), X = L.at('SMAP') + 0x20;
    e.w('SEED', 0xa0);
    e.w('LSEED', 0x22);
    e.w('HSEED', 0x7c);
    e.wd('WCURS', 0x6245);
    e.w('STATUS', 0);
    e.ram.write8(0xa022, 0x11);
    e.stars.SBLNK();
    assert.equal(e.ram.read8(0xa022), 0x11);
    assert.equal(e.ram.read8(X), 0x1c, 'SMAP star hypered to SEED-$84');
});
test('STOUT falls through into SBLNK (no RTS): an even SEED hypers one star each call', () => {
    const e = make(), base = L.at('SMAP');
    e.w('STRCNT', 16);
    for (let i = 0; i < 16; i++) { e.ram.write8(base + i * 4, 0x40); e.ram.write8(base + i * 4 + 1, 0x60); }
    e.w('SEED', 0x2c); // star 11, even, < $98
    e.stars.STOUT();
    assert.equal(e.ram.read8(base + 0x2c), 0x2c, 'star 11 X = SEED');
    assert.equal(e.ram.read8(base + 0x2c + 2), 0x11, 'and its colour stepped by $11');
    assert.equal(e.ram.read8(base), 0x40, 'other stars untouched');
});
test('THINIT: 33 source iterations populate original THTAB and adjacent byte', () => {
    const mem = new RAM();
    let calls = 0;
    const seq = () => ++calls;
    const t = createDefa7ThrustRoutines(mem, L, { RAND: seq });
    t.THINIT();
    assert.equal(calls, 33);
    assert.equal(mem.read16(L.at('THX')), L.at('THTAB'));
    assert.equal(mem.read8(L.at('THTAB')), 1);
    assert.equal(mem.read8(L.at('THTAB') + 32), 33); // overlapping write from iteration 33
    assert.equal(mem.read8(L.at('THTAB') + 64), 33); // original final +32 write
});
test('THPROC/THPR1/THPR2 preserve source pointer wrapping and original NAP(4) continuation', () => {
    const mem = new RAM(), calls = [];
    const p = createDefa7ThrustRoutines(mem, L, { RAND: () => 0 }, { SLEEP: (ticks, address) => {
            calls.push([ticks, address]);
            return { kind: 'scheduled' };
        } }, { THPROC: 0xe7a0 });
    mem.write16(L.at('THX'), L.at('THTAB') + 32);
    mem.write16(L.at('FBX'), L.at('FBTAB') + 24);
    assert.deepEqual(p.THPROC(), { kind: 'scheduled' });
    assert.equal(mem.read16(L.at('THX')), L.at('THTAB'));
    assert.equal(mem.read16(L.at('FBX')), L.at('FBTAB'));
    assert.deepEqual(calls, [[4, 0xe7a0]]);
});
test('THPROC refuses fabricated continuation addresses', () => {
    const mem = new RAM();
    const p = createDefa7ThrustRoutines(mem, L, { RAND: () => 0 });
    assert.throws(() => p.THPROC(), TranslationBoundaryError);
});
test('OSCAN: original 500*32 test moves out-of-range head to IPTR', () => {
    const e = make(), off = mk(e, 16000), inRange = mk(e, 1000);
    // GETOB only prepares links; caller links completed object at OPTR.
    e.ram.write16(off, 0);
    e.ram.write16(inRange, off);
    e.wd('OPTR', inRange);
    e.wd('BGL', 3200);
    e.scan.OSCAN();
    assert.equal(e.rd('OPTR'), inRange);
    assert.equal(e.rd('IPTR'), off);
    assert.equal(e.ram.read16(inRange), 0);
    assert.equal(e.rd('XTEMP'), 0);
});
test('ISCAN: source 8x velocity updates inactive object even if still invisible', () => {
    const e = make(), obj = mk(e, 26000, 0x7000, 0xff00, 0x0100);
    e.wd('IPTR', obj);
    e.wd('BGL', 3200);
    e.scan.ISCAN();
    assert.equal(e.ram.read16(obj + L.at('OX16')), u16Local(26000 - 2048));
    assert.equal(e.ram.read16(obj + L.at('OY16')), 0x7800);
    assert.equal(e.rd('IPTR'), obj);
    assert.equal(e.rd('OPTR'), 0);
});
const u16Local = n => n & 0xffff;
test('ISCAN: activate a returning object and preserve predecessor link', () => {
    const e = make(), hidden = mk(e, 27000), returns = mk(e, 15000, 0x7000, 0, 0);
    e.ram.write16(hidden, returns);
    e.ram.write16(returns, 0);
    e.wd('IPTR', hidden);
    e.wd('BGL', 3200);
    e.scan.ISCAN();
    assert.equal(e.rd('IPTR'), hidden);
    assert.equal(e.ram.read16(hidden), 0);
    assert.equal(e.rd('OPTR'), returns);
    assert.equal(e.ram.read16(returns), 0);
});
test('flight diagnostic executes PLAYER followed by original STOUT', () => {
    const h = createFlightHarness();
    h.INPUT({ thrust: true });
    for (let i = 0; i < 50; i++)
        h.STEP();
    let plotted = 0;
    for (let i = 0; i < 16; i++) {
        const X = L.at('SMAP') + i * 4;
        const byte = h.video.read8((h.ram.read8(X) << 8) | h.ram.read8(X + 1));
        if (byte)
            plotted++;
    }
    assert.ok(plotted > 0);
    assert.ok(plotted <= 16);
});
