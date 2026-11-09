/**
 * Source-first Stage 43 demonstration regression.
 * Pinned Red Label assembly e74006344b16d19245510b5e55780f90d7606bb8:
 * AMODE1.SRC LEDRET lines 475-503 (NEWP CBOMB), AMOD12/AMOD11 lines
 * 606-650 (two APVCT calls), LOGO0 and WILLIR lines 697-786/1290-1306;
 * DEFB6.SRC SCZP1 artwork and CBOMB/CBMB1 palette; SAMEXAP7.SRC
 * EXPU/EERASE; BLK71.SRC BGOUT.
 *
 * The original EXEC process/IRQ interleaving is NOT fully translated. The
 * source-derived foreground restoration belongs solely to the attract
 * presentation scheduler; do not assert that it is cycle-accurate ROM output.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createAmode1Attract } from '../original/amode1-attract.js';
import { PHR6_LAYOUT as L } from '../runtime/phr6-layout.js';
import { SAMEX_RAM as S } from '../original/samexap7-explosion-start.js';
function stepUntil(game, predicate, limit = 3000) {
    for (let i = 0; i < limit; i++) {
        const s = game.STEP();
        if (predicate(s))
            return s;
    }
    throw Error('Attract source condition not reached');
}
function originalTerrainBytes(a) {
    const bytes = new Map();
    for (let x = 0; x <= 0x98; x++)
        for (let y = 0xc0; y <= 0xeb; y++) {
            const address = (x << 8) | y, value = a.video.read8(address);
            if (value)
                bytes.set(address, value);
        }
    return bytes;
}
function regionBytes(a, x0, x1, y0, y1) {
    const m = new Map();
    for (let x = x0; x <= x1; x++)
        for (let y = y0; y <= y1; y++) {
            const address = (x << 8) | y, value = a.video.read8(address);
            if (value)
                m.set(address, value);
        }
    return m;
}
test('LEDRET starts original CBOMB and cycles mutant colour $C through black and random colours', () => {
    const a = createAmode1Attract();
    a.LEDRET();
    const at = L.at('PCRAM') + 12;
    let phases = new Set();
    for (let i = 0; i < 72; i++) {
        a.STEP();
        phases.add(a.ram.read8(at));
    }
    assert.ok(phases.has(0), 'source CBOMB sets colour C to black');
    assert.ok([...phases].some(v => v !== 0), 'source CBMB1 later restores a non-black colour');
    assert.ok(phases.size >= 3, `source C palette animated rather than frozen: ${[...phases]}`);
});
test('MUTANT uses both source APVCT invocations and the animated palette on its source-colour pixels', () => {
    const a = createAmode1Attract();
    a.LEDRET();
    const first = stepUntil(a, s => s.step === 'AMOD12' && s.objectIndex === 1 && s.remaining === 0x5f);
    assert.equal(first.objects.find(o => o.picture === 'SCZP1')?.appearing, true, 'AMOD12 original APVCT');
    const firstSlots = [];
    for (let y = S.RAMALS; y < S.RAMEND; y += S.RAMSIZ)
        if (a.ram.read16(y) & 0x8000)
            firstSlots.push(a.ram.read16(y + S.OBDESC));
    assert.ok(firstSlots.includes(0xe808), 'mutant appearance uses SCZP1 picture descriptor');
    const second = stepUntil(a, s => s.step === 'BMODE2' && s.objectIndex === 1 && s.remaining === 0x20);
    const mutant = second.objects.find(o => o.picture === 'SCZP1');
    assert.equal(mutant?.appearing, true, 'AMOD11 second APVCT must be an effect, not instant sprite');
    assert.equal(mutant.x16, 0x1100);
    assert.equal(mutant.y16, 0x6000);
    stepUntil(a, s => s.step === 'BMODE3' && s.objectIndex === 1 && s.remaining === 4);
    // Original SCZP1 has $C in left nibble of column 2,row 0 at source $4660
    assert.equal(a.video.read8(0x4660), 0xc0);
    let values = new Set();
    for (let i = 0; i < 18; i++) {
        a.STEP();
        values.add(a.ram.read8(L.at('PCRAM') + 12));
    }
    assert.ok(values.size > 1, 'mutant source colour changes while the complete bitmap is stationary');
});
test('original BLK71 BGOUT reconstructs all original foreground terrain bytes after repeated XSVCT/EXPU erases', () => {
    const a = createAmode1Attract();
    a.LEDRET();
    const baseline = originalTerrainBytes(a);
    assert.ok(baseline.size > 300, 'nonempty Red Label terrain reference');
    for (let i = 1; i <= 1750; i++) {
        const s = a.STEP();
        if (![411, 600, 795, 850, 977, 1000, 1160, 1300, 1500, 1740].includes(i))
            continue;
        const missing = [];
        for (const [p, value] of baseline) {
            if (a.video.read8(p) === 0)
                missing.push(p.toString(16));
        }
        assert.deepEqual(missing, [], `terrain holes after ${s.step} at tick ${i}`);
    }
});
test('source LGOTAB logo nibbles remain intact during 15-piece DEFENDER APVCT animation', () => {
    const a = createAmode1Attract();
    stepUntil(a, s => s.page === 'presentation' && s.step === 'PRES' && s.presTicks === 1);
    // Before DEFENS, these pixels were drawn by the original LOGO0 and PRES1,
    // not a reconstructed font or image overlay.
    const reference = regionBytes(a, 0x24, 0x78, 0x35, 0x5f);
    assert.ok(reference.size > 500);
    for (let i = 0; i < 140; i++) {
        const s = a.STEP();
        if (s.page !== 'presentation')
            throw Error('unexpected title reset');
        if (s.defenderAge < 0)
            continue;
        const missing = [...reference].filter(([p, v]) => (a.video.read8(p) & v) !== v);
        assert.equal(missing.length, 0, `source logo/text lost pixels during DEFENS at age ${s.defenderAge}`);
    }
});
