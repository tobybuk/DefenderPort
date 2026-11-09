import test from 'node:test';
import assert from 'node:assert/strict';
import { createSourceEnemyWorkbench } from '../demo/enemy-harness.js';
import { s16 } from '../runtime/integers.js';
test('Stage12 enemy diagnostic advances only source DISPATCH/SLEEP entries, not invented frame updates', () => {
    const d = createSourceEnemyWorkbench();
    const before = d.STATE();
    assert.equal(before.ufo.vx, 0);
    assert.notEqual(before.swarmer.vx, 0, 'MMSW calls source RANDV at creation');
    d.STEP();
    const after = d.STATE();
    // UFO and swarmer initial process steps are source-named UFOLP/MSWM.
    assert.notEqual(after.swarmer.vx, 0);
    assert.equal(after.ufo.time, 6);
    assert.ok(after.swarmer.time >= 1 && after.swarmer.time <= 31);
    // MOVE is in source VELO/IRQ, not this process-only fixture.
    assert.equal(after.ufo.worldX, before.ufo.worldX);
    assert.equal(after.swarmer.worldX, before.swarmer.worldX);
});
test('Source UFOLP and MSWLP continuations advance over 120 ticks without custom movement', () => {
    const d = createSourceEnemyWorkbench();
    d.RUN(120);
    const s = d.STATE();
    assert.equal(s.ticks, 120);
    assert.ok(s.ufo.time >= 1 && s.ufo.time <= 6);
    assert.ok(s.swarmer.time >= 1 && s.swarmer.time <= 31);
    assert.notEqual(s.ufo.vx, 0);
    assert.notEqual(s.swarmer.vy, 0);
    assert.ok(s.activeShells > 0, 'UFO or swarmer fired through original GETSHL');
    assert.ok(s.soundPriority > 0, 'Source SNDLD selected nonzero original sound command priority');
    d.RESET();
    assert.equal(d.STATE().ticks, 0);
});
