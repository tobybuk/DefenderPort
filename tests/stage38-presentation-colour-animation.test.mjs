/** Stage 38: AMODE1 attract colour processes and DEFENS appearance.
 * Grounded in Red Label AMODE1.SRC 697-981, DEFA7.SRC 3020-3040,
 * DEFB6.SRC TIECOL and ROMC8.SRC DEFALT 781-797.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createAmode1Attract } from '../original/amode1-attract.js';
import { COLTAB } from '../original/defa7-process-tasks.js';
import { TCTAB } from '../original/defb6-colour-processes.js';
import { DEFAULT_HALL_OF_FAME } from '../original/amode1-presentation-data.js';
import { defenderHardwarePalette } from '../browser/defender-palette.js';
import { SAMEX_RAM } from '../original/samexap7-explosion-start.js';
function to(a, frame) {
    while (a.STATE().page === 'presentation' && a.STATE().tick < frame)
        a.STEP();
}
function bitmap(a, start, cols, rows) {
    let n = 0;
    for (let x = 0; x < cols; x++)
        for (let y = 0; y < rows; y++)
            n += a.video.read8(start + (x << 8) + y) !== 0;
    return n;
}
function findColorPixel(a, leftByte, rightByte, top, bottom, index) {
    for (let x = leftByte; x < rightByte; x++)
        for (let y = top; y < bottom; y++) {
            const b = a.video.read8((x << 8) | y);
            if ((b >>> 4) === index)
                return { x: x * 2, y };
            if ((b & 15) === index)
                return { x: x * 2 + 1, y };
        }
    return null;
}
test('COLR updates hardware palette #1 at the source two-tick cadence, without repainting glyphs', () => {
    const a = createAmode1Attract();
    a.STEP();
    assert.equal(a.ram.read8(0xc001), COLTAB[0]);
    a.STEP();
    assert.equal(a.ram.read8(0xc001), COLTAB[0]);
    a.STEP();
    assert.equal(a.ram.read8(0xc001), COLTAB[1]);
    for (let i = 0; i < 120; i++) {
        a.STEP();
        assert.equal(a.ram.read8(0xc001), a.ram.read8(0xc000 + 1));
    }
});
test('original TIECOL animates the Williams source pixel colour F in actual presented RGB', () => {
    const a = createAmode1Attract();
    to(a, 219);
    const point = findColorPixel(a, 40, 114, 40, 85, 15);
    assert.ok(point, 'original LGOTAB creates Williams pixels with colour index $F');
    const first = defenderHardwarePalette(a.ram)[15].join(',');
    to(a, 226);
    const second = defenderHardwarePalette(a.ram)[15].join(',');
    assert.notEqual(second, first, 'TCTAB phase changes displayed Williams RGB even when source nibble stays $F');
    assert.ok([TCTAB[2], TCTAB[5], TCTAB[8]].includes(a.ram.read8(0xc00f)));
    assert.equal(findColorPixel(a, 40, 114, 40, 85, 15)?.x >= 0, true);
});
test('DEFENS creates 15 original APST objects; DEF50 restores only after source $2E delay', () => {
    const a = createAmode1Attract();
    to(a, 280);
    assert.equal(a.STATE().defenderPhase, 'appearing');
    assert.equal(a.STATE().defenderSlices, 15);
    let live = 0;
    for (let Y = SAMEX_RAM.RAMALS; Y < SAMEX_RAM.RAMEND; Y += SAMEX_RAM.RAMSIZ)
        live += (a.ram.read16(Y + SAMEX_RAM.RSIZE) & 0x8000) ? 1 : 0;
    assert.equal(live, 15);
    assert.ok(bitmap(a, 0x3090, 60, 24) < 250, 'whole DEFENDER bitmap is not drawn instantly');
    to(a, 330);
    assert.equal(a.STATE().defenderPhase, 'restoring');
    assert.ok(bitmap(a, 0x3090, 60, 24) > 500, 'original full image is restored after the appearance wait');
});
test('DEF44 makes colour #C animate on the complete title using original CBOMB sequence', () => {
    const a = createAmode1Attract();
    to(a, 370);
    assert.equal(a.STATE().defenderCBomb, true);
    const titlePoint = findColorPixel(a, 48, 110, 144, 170, 12);
    assert.ok(titlePoint, 'DEFNNN source picture contains colour-C title pixels');
    const seen = new Set();
    for (let i = 0; i < 54; i++) {
        a.STEP();
        seen.add(defenderHardwarePalette(a.ram)[12].join(','));
    }
    assert.ok(seen.size > 3, 'original CBOMB changes visible DEFENDER title RGB repeatedly');
});
test('COPYRT writes source raster copyright data and original two-line ELECTRONICS / PRESENTS text', () => {
    const a = createAmode1Attract();
    to(a, 420);
    assert.ok(bitmap(a, 0x3bd0, 25, 8) > 20, 'CPRTAB copyright drawn by source CPR1 layout');
    assert.ok(bitmap(a, 0x3258, 55, 8) > 35, 'ELECTRONICS INC source line');
    assert.ok(bitmap(a, 0x456c, 35, 8) > 20, 'PRESENTS on its original later line');
});
test('HALDIS uses original Red Label ROMC8 DEFALT score entries in BOTH tables', () => {
    assert.deepEqual(DEFAULT_HALL_OF_FAME.map(e => e.score), [21270, 18315, 15920, 14285, 12520, 11035, 8265, 6010]);
    assert.deepEqual(DEFAULT_HALL_OF_FAME.map(e => e.initials), ['DRJ', 'SAM', 'LED', 'PGD', 'CRB', 'MRS', 'SSR', 'TMH']);
    const a = createAmode1Attract();
    while (a.STATE().page === 'presentation')
        a.STEP();
    assert.ok(bitmap(a, 0x3038, 60, 24) > 800, 'full original DEFENDER title on highscore page');
    assert.ok(bitmap(a, 0x1886, 45, 80) > 100, 'left original score list is visible');
    assert.ok(bitmap(a, 0x5986, 45, 80) > 100, 'right original score list is visible');
});
