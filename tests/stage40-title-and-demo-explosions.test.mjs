/**
 * Stage 40 regression tests: Williams Red Label AMODE1.SRC presentation text
 * and original source explosion vectors, not browser/Canvas substitutes.
 *
 * Source e74006344b16d19245510b5e55780f90d7606bb8:
 *   PRES/PRES1  779–787: original ELECV message redraw every 5 ticks
 *   AMODE3     537–540: KILLOB -> XSVCT (Lander)
 *   AMOD11     627–640: KILLOB -> GETOB -> XSVCT (six enemy demos)
 *   SAMEXAP7  68–116: EXST, and 121–376: EXPU/EWRITE source expansion
 *   MESS0.SRC  PERIOD: 1x8 FDB original period glyph
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createAmode1Attract } from '../original/amode1-attract.js';
import { createFlightHarness } from '../demo/flight-harness.js';
import { SAMEX_RAM as S } from '../original/samexap7-explosion-start.js';
const until = (a, fn, limit = 4300) => {
    for (let n = 0; n < limit; n++) {
        const s = a.STEP();
        if (fn(s))
            return s;
    }
    throw new Error('source process did not reach expected continuation within ' + limit + ' updates');
};
const region = (a, x, y, w, h) => Uint8Array.from({ length: w * h }, (_, i) => a.video.read8(((x + Math.floor(i / h)) << 8) | (y + (i % h))));
const slots = a => {
    const records = [];
    for (let Y = S.RAMALS; Y < S.RAMEND; Y += S.RAMSIZ) {
        const size = a.ram.read16(Y + S.RSIZE);
        if (size !== 0 && !(size & 0x8000))
            records.push({ Y, size, picture: a.ram.read16(Y + S.OBDESC) });
    }
    return records;
};
const liveBlastBytes = (a, Y) => {
    const from = a.ram.read16(Y + S.ERASES), end = Y + S.RAMSIZ;
    let seen = 0;
    for (let p = from; p < end; p += 2) {
        const addr = a.ram.read16(p);
        if (a.video.read8(addr) || a.video.read8((addr + 1) & 0xffff))
            seen++;
    }
    return seen;
};
test('PRES1 restores exact source-letter pixels after all fifteen DEFENDER fragment explosions', () => {
    const a = createAmode1Attract();
    until(a, s => s.page === 'presentation' && s.presTicks === 1);
    const baseline1 = region(a, 0x32, 0x58, 75, 8);
    const baseline2 = region(a, 0x3e, 0x6c, 50, 8);
    assert.ok([...baseline1].filter(Boolean).length > 150, 'ELECTRONICS INC. is populated from MESS0 FDB bytes');
    assert.ok([...baseline2].filter(Boolean).length > 90, 'PRESENTS is populated from MESS0 FDB bytes');
    for (const tick of [48, 85, 128, 160, 200, 280, 340]) {
        until(a, s => s.page === 'presentation' && s.presTicks === tick);
        const actual1 = region(a, 0x32, 0x58, 75, 8), actual2 = region(a, 0x3e, 0x6c, 50, 8);
        for (let n = 0; n < baseline1.length; n++)
            if (baseline1[n])
                assert.equal(actual1[n], baseline1[n], `ELECTRONICS glyph pixel ${n} lost during source appearance at pres tick ${tick}`);
        for (let n = 0; n < baseline2.length; n++)
            if (baseline2[n])
                assert.equal(actual2[n], baseline2[n], `PRESENTS glyph pixel ${n} lost during source appearance at pres tick ${tick}`);
    }
});
test('PRES1 retains source MESS0 period, not an invented font or broken INC line', () => {
    const a = createAmode1Attract();
    assert.equal(typeof a.PRES1, 'function');
    assert.equal(a.ram.read8(a.ram.read16(0xda00 + 26 * 4) + 0), 0, 'original period begins with $0000 FDB');
    // Repainting the line must be repeatable and use the same exact ROMF8 data.
    until(a, s => s.page === 'presentation' && s.presTicks === 1);
    const before = region(a, 0x32, 0x58, 75, 8);
    a.PRES1();
    assert.deepEqual(region(a, 0x32, 0x58, 75, 8), before);
});
test('AMODE3 Lander laser hit initiates source EXST and progressively writes actual video bytes', () => {
    const a = createAmode1Attract();
    until(a, s => s.page === 'instructions' && s.step === 'AMODE4' && s.remaining === 0x5a);
    const first = slots(a).find(e => e.size === 0x100);
    assert.ok(first, 'XSVCT has created a normal positive-size SAMEX explosion slot');
    assert.equal(first.picture, 0xe804, 'source LNDP1 picture handle is retained by EXST');
    for (let frame = 0; frame < 4; frame++) {
        a.STEP();
        const active = slots(a).find(e => e.Y === first.Y);
        assert.ok(active && active.size > 0x100, 'EXPU grows the source $100 explosion');
        assert.ok(liveBlastBytes(a, first.Y) > 0, 'EWRITE produces visible original Lander pixels in video RAM');
    }
});
test('AMOD11 enemy laser shots produce six distinct original picture EXPLOSIONS in the scripted demo', () => {
    const a = createAmode1Attract(), found = [];
    let previous = 0;
    for (let step = 0; step < 3200; step++) {
        const state = a.STEP();
        if (state.page === 'instructions' && state.step === 'BMODE2' && state.remaining === 0x20) {
            const all = slots(a).filter(s => s.size === 0x100), record = all.at(-1);
            assert.ok(record, 'AMOD11 must invoke XSVCT rather than only move/remove the sprite');
            found.push(record.picture);
            a.STEP();
            assert.ok(liveBlastBytes(a, record.Y) > 0, 'first EXPU draws real pixels for shot enemy ' + found.length);
        }
        if (found.length === 6)
            break;
        previous = state.objectIndex;
    }
    assert.deepEqual(found, [0xe804, 0xe808, 0xe80c, 0xe810, 0xe814, 0xe818], 'Lander, Mutant, Baiter, Bomber, Probe, Swarmer all get original explosion descriptors');
});
test('playable laser COLIDE leaves a progressively rendered source explosion, not a disappearing enemy', () => {
    const h = createFlightHarness({ sourceCabinetInput: true });
    for (let i = 0; i < 100; i++)
        h.STEP();
    const target = h.ENEMY_STATE().find(o => o.label === 'LNDP1' && o.video);
    assert.ok(target, 'visible live original Lander is on screen');
    assert.equal(h.laser.COLIDE(target.video), target.object, 'laser invokes the source kill callback');
    const first = slots(h).find(e => e.size === 0x100);
    assert.ok(first, 'EXST is reachable from normal gameplay');
    h.STEP();
    assert.ok(slots(h).find(e => e.Y === first.Y).size > 0x100);
    assert.ok(liveBlastBytes(h, first.Y) > 0, 'original source-coloured explosion pixels survive game STEP');
});
