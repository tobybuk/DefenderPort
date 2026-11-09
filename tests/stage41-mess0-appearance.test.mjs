/**
 * Source-locked Stage 41 regression tests for the two Stage 40 departures.
 * Reference: e74006344b16d19245510b5e55780f90d7606bb8:
 * MESS0.SRC 283-286 ELEC, 740-816 WTEXTB/TEXT7B, 855-860 RLF1;
 * AMODE1.SRC 475-503 LEDRET, 606-650 AMOD12/AMOD11/BMODE2,
 * 1116-1130 TEXTAB, SAMEXAP7.SRC 18-63 APST and 121-202 EXPU.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createAmode1Attract } from '../original/amode1-attract.js';
import { SAMEX_RAM as S } from '../original/samexap7-explosion-start.js';
function until(a, pred, limit = 5000) {
    for (let n = 0; n < limit; n++) {
        const s = a.STEP();
        if (pred(s))
            return s;
    }
    throw Error('source process continuation not reached after ' + limit + ' ticks');
}
function nonzero(a, x, y, w, h) {
    let n = 0;
    for (let c = 0; c < w; c++)
        for (let row = 0; row < h; row++)
            if (a.video.read8((((x + c) & 255) << 8) | ((y + row) & 255)))
                n++;
    return n;
}
function active(a, filter) {
    const ans = [];
    for (let Y = S.RAMALS; Y < S.RAMEND; Y += S.RAMSIZ) {
        const z = a.ram.read16(Y + S.RSIZE);
        if (z && (!filter || filter(z, Y)))
            ans.push({ Y, size: z, desc: a.ram.read16(Y + S.OBDESC), object: a.ram.read16(Y + S.OBJPTR) });
    }
    return ans;
}
test('MESS0 ELECV uses original $3258, two RLF (2×$0A), and HMC 12 => $3E6C', () => {
    const a = createAmode1Attract();
    until(a, s => s.page === 'presentation' && s.presTicks === 1);
    assert.ok(nonzero(a, 0x32, 0x58, 60, 8) > 100, 'source ELECTRONICS INC. present');
    assert.ok(nonzero(a, 0x3e, 0x6c, 38, 8) > 60, 'source PRESENTS at calculated message cursor');
    assert.equal(nonzero(a, 0x35, 0x6c, 9, 8), 0, 'no stray PRESENTS pixels left of original $3E');
    // Deliberately check the actual source cursor construction, not a browser
    // screenshot offset or the previously invented $456C location.
    const start = 0x3258, cur = (start & 0xff00) | ((start + 0x0a + 0x0a) & 255);
    assert.equal(((cur + 0x0c00) & 0xffff), 0x3e6c);
});
test('LEDRET starts Lander with original APST negative RSIZE and converges to complete picture', () => {
    const a = createAmode1Attract();
    const st = until(a, s => s.page === 'instructions' && s.tick === 1);
    assert.equal(st.objects.find(o => o.picture === 'LNDP1')?.appearing, true);
    assert.deepEqual(active(a, z => !!(z & 0x8000)).map(e => e.size), [0xae00]);
    assert.equal(active(a, z => !!(z & 0x8000))[0].desc, 0xe804);
    const eighth = until(a, s => s.page === 'instructions' && s.tick === 8);
    assert.equal(eighth.objects.find(o => o.picture === 'LNDP1')?.appearing, true);
    assert.equal(active(a, z => !!(z & 0x8000))[0].size, 0xa700);
    const end = until(a, s => s.page === 'instructions' && s.tick === 48);
    assert.equal(end.objects.find(o => o.picture === 'LNDP1')?.appearing, false);
    assert.equal(active(a, z => !!(z & 0x8000)).length, 0, 'original EXPU6 terminates appearance at source zero crossing');
    assert.ok(nonzero(a, 0x76, 0x5d, 5, 8) > 5, 'whole Lander appears after source APST terminates');
});
test('AMOD12 creates six source APVCT appearances, not six instantly fully drawn sprites', () => {
    const a = createAmode1Attract(), seen = [];
    for (let n = 0; n < 4500; n++) {
        const s = a.STEP();
        if (s.page === 'instructions' && s.step === 'AMOD12' && s.remaining === 0x5f) {
            const obj = s.objects.find(o => o.appearing && o.picture !== 'LNDP1' || o.appearing && s.objectIndex === 0 && o.picture === 'LNDP1');
            assert.ok(obj, 'source AMOD12 immediately starts APVCT for enemy ' + s.objectIndex);
            assert.ok(active(a, z => !!(z & 0x8000)).some(z => z.desc >= 0xe804 && z.desc <= 0xe818));
            seen.push(s.objectIndex);
        }
        if (seen.length === 6)
            break;
    }
    assert.deepEqual(seen, [0, 1, 2, 3, 4, 5]);
});
test('AMOD11 creates source EXST explosion PLUS subsequent APST implosion at caption position', () => {
    const a = createAmode1Attract();
    const s = until(a, s => s.page === 'instructions' && s.step === 'BMODE2' && s.remaining === 0x20);
    assert.equal(s.objectIndex, 0);
    const enemy = s.objects.find(o => o.picture === 'LNDP1' && o.appearing);
    assert.ok(enemy, 'source reappearing Lander picture must remain NULOB while APST expands');
    assert.equal(enemy.x16, 0x0900);
    assert.equal(enemy.y16, 0x6000);
    assert.ok(active(a, z => !(z & 0x8000)).some(z => z.size === 0x0100 && z.desc === 0xe804), 'source explosion exists');
    assert.ok(active(a, z => !!(z & 0x8000)).some(z => z.size === 0xaf00 && z.desc === 0xe804), 'source appearance simultaneously exists');
    // BMODE2 waits $20 before advancing TEXPTR; LANDER score still absent.
    assert.equal(s.textLimit, 1);
    until(a, s => s.page === 'instructions' && s.step === 'BMODE3' && s.remaining === 0x20);
    assert.equal(a.STATE().textLimit, 2);
    until(a, s => s.page === 'instructions' && s.step === 'BMODE3' && s.remaining === 0x18);
    assert.ok(nonzero(a, 0x1c, 0x70, 20, 8) > 0, 'TEXTP emits source LANDER label, not an early preprint');
    assert.ok(nonzero(a, 0x22, 0x7a, 15, 8) > 0, 'MESS0 LAND second line is source 150 score after RLF + HMC 6');
});
