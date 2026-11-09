/** Stage 20: the legacy seeded SWPIC1 object now executes source MSWM/MSWLP.
 * Its starting position is still a fixture. Probe-death spawning is NOT
 * implemented and must not be inferred from these tests.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFlightHarness } from '../demo/flight-harness.js';
const at = (h, n) => h.Layout.at(n);
const word = (h, X, n) => h.ram.read16(X + at(h, n));
test('swarmer starts in source MSWM process, not the inert Stage 15 loop', () => {
    const h = createFlightHarness({ diagnosticSwarmer: true });
    const sw = h.ENEMY_STATE().find(x => x.label === 'SWPIC1');
    const U = word(h, sw.object, 'OBJID');
    assert.ok(U);
    assert.equal(word(h, U, 'PD'), sw.object);
    assert.equal(word(h, U, 'PADDR'), 0xe2ec);
    assert.equal(h.ram.read8(at(h, 'SWCNT')), 1);
    assert.equal(h.ram.read8(U + at(h, 'PD2')), 0x18);
    assert.equal(h.ram.read8(U + at(h, 'PD4')), 60);
});
test('source swarmer wakes, chases using velocity and advances in real video/scanner memory', () => {
    const h = createFlightHarness({ diagnosticSwarmer: true });
    const start = h.ENEMY_STATE().find(x => x.label === 'SWPIC1');
    const U = word(h, start.object, 'OBJID');
    for (let i = 0; i < 7; i++)
        h.STEP();
    const after = h.ENEMY_STATE().find(x => x.label === 'SWPIC1');
    assert.equal(word(h, U, 'PADDR'), 0xe2ee, 'MSWM schedules MSWLP continuation');
    assert.notEqual(after.worldX, start.worldX);
    assert.ok(after.video !== 0);
    assert.equal(h.STATE().scannerObjects, h.ENEMY_STATE().length);
});
test('long-running original MSWLP updates signed velocities without allocating fake objects', () => {
    const h = createFlightHarness({ diagnosticSwarmer: true }), sw = h.ENEMY_STATE().find(x => x.label === 'SWPIC1');
    const U = word(h, sw.object, 'OBJID');
    for (let i = 0; i < 240; i++)
        h.STEP();
    assert.equal(h.ram.read8(at(h, 'SWCNT')), 1);
    assert.equal(word(h, U, 'PADDR'), 0xe2ee);
    assert.equal(h.ENEMY_STATE().filter(x => x.label === 'SWPIC1').length, 1);
    assert.equal(h.STATE().scannerObjects, h.ENEMY_STATE().length);
});
test('swarmer/astronaut process records reset without duplicate scheduling or stale scanner entries', () => {
    const h = createFlightHarness({ diagnosticSwarmer: true });
    for (let i = 0; i < 550; i++)
        h.STEP();
    h.RESET();
    const sw = h.ENEMY_STATE().find(x => x.label === 'SWPIC1');
    const U = word(h, sw.object, 'OBJID');
    assert.equal(word(h, U, 'PADDR'), 0xe2ec);
    assert.equal(h.WAVE_STATE().astronautCount, 10);
    assert.equal(h.ram.read8(at(h, 'SWCNT')), 1);
    assert.equal(h.STATE().scannerObjects, 16);
});
