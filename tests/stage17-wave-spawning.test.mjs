/** Stage 22 corrects tests from Stage 17 which mistakenly enforced immediate
 * Baiter spawning. These tests now enforce the exact original source timeline.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFlightHarness } from '../demo/flight-harness.js';
import { ENEMY_PICTURES } from '../original/defb6-enemy-pictures.js';
const field = (h, n) => h.ram.read8(h.Layout.at(n));
function list(h, head = 'OPTR') {
    let X = h.ram.read16(h.Layout.at(head)), out = [], seen = new Set();
    while (X) {
        assert.ok(!seen.has(X), 'source object list must not cycle');
        seen.add(X);
        out.push(X);
        X = h.ram.read16(X + h.Layout.at('OLINK'));
    }
    return out;
}
test('wave one: GEXEC starts five LANDST ships, not a baiter, and scanner has those plus ten humans', () => {
    const h = createFlightHarness(), w = h.WAVE_STATE();
    assert.equal(w.wave, 1);
    assert.equal(w.ufoSpawned, 0);
    assert.equal(w.ufoCount, 0);
    assert.equal(w.landerSpawned, 5);
    assert.equal(w.landerCount, 5);
    assert.equal(w.landerReserve, 10);
    assert.deepEqual([...new Set(h.ENEMY_STATE().map(o => o.label))].sort(), ['ASTP1', 'LNDP1']);
    assert.equal(list(h).length, 15);
    assert.equal(h.STATE().scannerObjects, 15);
    assert.ok(ENEMY_PICTURES.LNDP1.phases[0].some(Boolean));
});
test('source wave values delay baiters through 600 frames while stage two landers start', () => {
    const h = createFlightHarness();
    for (let i = 0; i < 600; i++)
        h.STEP();
    assert.equal(h.WAVE_STATE().ufoSpawned, 0);
    assert.equal(h.WAVE_STATE().landerSpawned, 10);
    assert.equal(h.STATE().scannerObjects, h.ENEMY_STATE().length);
    assert.equal(h.STATE().scannerObjects, list(h).length + list(h, 'IPTR').length);
});
test('source first-wave baiter countdown is WVTAB (0xD4) not fixture (1)', () => {
    const h = createFlightHarness();
    assert.equal(field(h, 'UFOTIM'), 0xd4);
    assert.equal(h.WAVE_STATE().ufoTimer, 0xd3, 'GEXEC performs first source decrement synchronously');
    for (let i = 0; i < 100; i++)
        h.STEP();
    assert.equal(h.WAVE_STATE().ufoSpawned, 0);
    assert.ok(h.WAVE_STATE().ufoTimer < 0xd3 && h.WAVE_STATE().ufoTimer > 0);
});
test('source reset restores correct opening wave, object list and countdown', () => {
    const h = createFlightHarness(), before = h.ENEMY_STATE();
    for (let i = 0; i < 500; i++)
        h.STEP();
    assert.equal(h.ENEMY_STATE().length, 20);
    h.RESET();
    assert.deepEqual(h.ENEMY_STATE(), before);
    assert.equal(h.WAVE_STATE().ufoSpawned, 0);
    assert.equal(h.WAVE_STATE().landerSpawned, 5);
    assert.equal(h.WAVE_STATE().landerReserve, 10);
    assert.equal(list(h).length, 15);
});
