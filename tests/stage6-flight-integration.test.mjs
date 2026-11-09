import test from 'node:test';
import assert from 'node:assert/strict';
import { createFlightHarness } from '../demo/flight-harness.js';
import { RAM } from '../runtime/ram.js';
test('Stage 6 flight diagnostic keeps Stage 5 ship, stars, BORDER and sound behaviour', () => {
    const h = createFlightHarness();
    assert.equal(h.STATE().x, 0x20);
    assert.equal(h.video.read8(0x4c07), 0x99);
    h.INPUT({ thrust: true });
    h.STEP();
    assert.ok(h.STATE().vx !== 0 || h.STATE().vxFraction !== 0);
    assert.equal(h.TRIGGER_SOUND('LASSND'), false, 'source APST already owns sound priority');
    h.ram.write8(h.Layout.at('SNDPRI'), 0);
    assert.equal(h.TRIGGER_SOUND('LASSND'), true);
    h.STEP(); // The original sound sequencer also emits the thrust command (0x29),
    // so assert the requested LASER command is the terminal command pair.
    assert.deepEqual(h.STATE().soundBus.slice(-2), [0x3f, 0x2b]);
});
test('Stage 29 SCORE uses original bitmap numerals and leaves arithmetic unchanged', () => {
    const h = createFlightHarness();
    assert.deepEqual(h.STATE().scoreBCD, [0, 0, 0, 0]);
    h.TEST_SCORE();
    h.TEST_SCORE();
    assert.deepEqual(h.STATE().scoreBCD, [0, 0, 0, 0x20]);
    assert.match(h.STATE().scoreRequests.at(-1), /rendered in source framebuffer/);
    h.RESET();
    assert.deepEqual(h.STATE().scoreBCD, [0, 0, 0, 0]);
    assert.deepEqual(h.STATE().scoreRequests, []);
});
test('Stage 6 original low-level ROMF8 graphics routines are exposed to JS diagnostics', () => {
    const h = createFlightHarness();
    assert.equal(typeof h.romf8.CWRIT, 'function');
    assert.equal(typeof h.romf8.COFFA, 'function');
    assert.equal(typeof h.hud.TDISP, 'function');
    assert.equal(typeof h.scoring.RCHK, 'function');
    assert.equal(typeof h.switches.SSCAN, 'function');
    // The original glyph pointers are now available as relocated ROM data.
    assert.doesNotThrow(() => h.hud.TDISP());
});
