/**
 * Stage 22 first-wave correction, checked against original DEFA7.SRC
 * GETWV -> PLRES (ASTSX, ELS1, ELS2) -> GEXEC -> LANDST.
 * These fail if Stage 17/21 Baiter/Swarmer test fixtures leak back into
 * the actual opening wave, or if enemy RAM exists but no sprite is visible.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFlightHarness } from '../demo/flight-harness.js';
import { WVTAB } from '../original/blk71-wave-data.js';
import { getPixel } from '../browser/video-presenter.js';
import { ENEMY_PICTURES } from '../original/defb6-enemy-pictures.js';
const byte = (h, name) => h.ram.read8(h.Layout.at(name));
const objects = (h, label) => h.ENEMY_STATE().filter(o => o.label === label);
const names = h => new Set(h.ENEMY_STATE().map(o => o.label));
function sourceLanderPixelsInVisiblePlayfield(h, lander) {
    const p = lander.video;
    if (!p)
        return 0;
    const x = (p >>> 8) * 2 - 12, y = (p & 255) - 7;
    let count = 0;
    for (let dx = 0; dx < 10; dx++)
        for (let dy = 0; dy < 8; dy++) {
            if (x + dx >= 0 && x + dx < 292 && y + dy >= 0 && y + dy < 240 && getPixel(h.video, x + dx, y + dy) !== 0)
                count++;
        }
    return count;
}
test('the exact original WVTAB wave-one column sets lander squad and delayed Baiters', () => {
    const h = createFlightHarness();
    const cases = { WAVTIM: 5, WAVSIZ: 6, UFOTIM: 20 };
    for (const [field, row] of Object.entries(cases)) {
        assert.equal(byte(h, field), WVTAB[row * 8 + 4], `${field} was not copied from source WVTAB W1`);
    }
    assert.equal(byte(h, 'WAVTIM'), 30);
    assert.equal(byte(h, 'WAVSIZ'), 5);
    assert.equal(byte(h, 'UFOTIM'), 212);
    assert.equal(byte(h, 'LNDRES'), 10, 'five of original fifteen Landers were spawned synchronously by GEXEC');
    for (const f of ['TIERES', 'PRBRES', 'SCZRES', 'SWMRES'])
        assert.equal(byte(h, f), 0, `wave-one ${f} starts empty`);
});
test('opening object list contains exactly ten original astronauts and five LANDST Landers, never Baiter fixture', () => {
    const h = createFlightHarness(), s = h.WAVE_STATE();
    assert.equal(s.wave, 1);
    assert.equal(s.ufoSpawned, 0);
    assert.equal(s.ufoCount, 0);
    assert.equal(s.landerSpawned, 5);
    assert.equal(s.landerCount, 5);
    assert.equal(s.astronautCount, 10);
    assert.deepEqual([...names(h)].sort(), ['ASTP1', 'LNDP1']);
    assert.equal(objects(h, 'LNDP1').length, 5);
    assert.equal(objects(h, 'ASTP1').length, 10);
    assert.equal(h.STATE().scannerObjects, 15, 'SCNR must see 5 Landers and 10 astronauts');
    assert.equal(byte(h, 'UFOCNT'), 0);
});
test('source wave one finishes original Lander appearance before rendering visible sprites', () => {
    const h = createFlightHarness();
    for (let i = 0; i < 80; i++)
        h.STEP();
    assert.ok(ENEMY_PICTURES.LNDP1.phases[0].some(Boolean), 'use the real DEFB6 LNDP1 sprite');
    const landers = objects(h, 'LNDP1');
    const visible = landers.filter(o => sourceLanderPixelsInVisiblePlayfield(h, o) >= 8);
    assert.ok(visible.length >= 1, `only ${visible.length} of five source LANDST landers are visibly rasterised after APST`);
    for (const l of visible) {
        assert.ok(l.video !== 0, 'OPROC has assigned real screen video address');
        assert.equal(h.ram.read16(l.object + h.Layout.at('OBJID')) !== 0, true, 'LANDST process is linked');
    }
});
test('second lander group arrives on WAVTMR schedule, without prematurely spawning Baiters', () => {
    const h = createFlightHarness();
    for (let i = 0; i < 425; i++)
        h.STEP();
    assert.equal(h.WAVE_STATE().landerSpawned, 5);
    assert.equal(h.WAVE_STATE().ufoSpawned, 0);
    for (let i = 0; i < 75; i++)
        h.STEP();
    assert.equal(h.WAVE_STATE().landerSpawned, 10);
    assert.equal(h.WAVE_STATE().landerReserve, 5);
    assert.equal(h.WAVE_STATE().ufoSpawned, 0);
    assert.equal(objects(h, 'LNDP1').length, 10);
    assert.equal(h.STATE().scannerObjects, h.ENEMY_STATE().length);
});
test('reset reproduces exact original startup without retaining Baiters or fixture Swarmers', () => {
    const h = createFlightHarness();
    const before = h.ENEMY_STATE(), w0 = h.WAVE_STATE();
    for (let i = 0; i < 720; i++)
        h.STEP();
    h.RESET();
    assert.deepEqual(h.ENEMY_STATE(), before);
    assert.deepEqual(h.WAVE_STATE(), w0);
    assert.equal(byte(h, 'UFOTIM'), 0xd4);
    assert.equal(h.STATE().scannerObjects, 15);
    assert.deepEqual([...names(h)].sort(), ['ASTP1', 'LNDP1']);
});
