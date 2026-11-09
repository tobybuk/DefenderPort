/**
 * Stage 35: regressions reproduced from actual Stage 34 play reports.
 * A final-enemy Smart Bomb must complete its hardware-palette flash before
 * DEFA7 GEXEC/BONUS draws the inter-wave message. TIEKIL needs the bitmap
 * erasure that the standalone IRQ/renderer no longer gets to perform once
 * the killed Bomber is unlinked from OPTR.
 *
 * The source-native routines are unchanged: the wave/bomb scheduling and
 * death-vector erasure are explicit host integration boundaries.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFlightHarness } from '../demo/flight-harness.js';
const a = (h, n) => h.Layout.at(n);
const run = (h, n) => {
    for (let i = 0; i < n; i++)
        h.STEP();
};
const clearWaveCounters = h => {
    for (const name of ['LNDCNT', 'LNDRES', 'TIECNT', 'PRBCNT', 'SWCNT', 'SCZCNT', 'SCZRES'])
        h.ram.write8(a(h, name), 0);
};
test('final-enemy Smart Bomb waits for its four source palette inversions before drawing BONUS', () => {
    const h = createFlightHarness({ sourceCabinetInput: false, infiniteSmartBombs: true, playerCollisions: false });
    run(h, 100);
    assert.equal(h.SMART_BOMB(), true);
    h.INPUT({ smartBomb: true });
    run(h, 1);
    assert.equal(h.smartBomb.FLASHING(), true);
    assert.equal(h.ram.read8(a(h, 'SBFLG')), 1);
    clearWaveCounters(h);
    let flashingUpdates = 0, bonusStarted = false;
    for (let i = 0; i < 50; i++) {
        const flashing = h.smartBomb.FLASHING();
        h.STEP();
        if (flashing)
            flashingUpdates++;
        if (h.STATE().bonus) {
            bonusStarted = true;
            assert.equal(h.smartBomb.FLASHING(), false, 'wave-complete text must never be drawn during the bomb palette flash');
            assert.equal(h.ram.read8(a(h, 'PCRAM')), 0, 'BONUS restores the original background colour');
            break;
        }
    }
    assert.ok(flashingUpdates >= 6, 'reproduces the multiple-tick flash overlapping the wave boundary');
    assert.equal(bonusStarted, true, 'wave still completes after flashing');
    assert.equal(h.ram.read8(a(h, 'SBFLG')), 1, 'bonus presentation need not wait for the held Smart Bomb button to be released');
});
test('a Bomber killed through its collision vector erases every byte of its last sprite', () => {
    const h = createFlightHarness({ playerCollisions: false });
    run(h, 80);
    const X = h.tie.TIEST(1)[0].object;
    h.ram.write16(X + a(h, 'OX16'), (h.ram.read16(a(h, 'BGL')) + 0x1800) & 65535);
    h.ram.write8(X + a(h, 'OY16'), 0x70);
    h.ram.write8(a(h, 'TIECNT'), 1);
    h.objectVideo.OPROC(0xef2a);
    const D = h.ram.read16(X + a(h, 'OBJX'));
    assert.ok(D, 'test fixture must be drawn in the source framebuffer');
    const bytes = () => Array.from({ length: 4 * 8 }, (_, i) => {
        const col = (D >>> 8) + (i >>> 3), row = (D & 255) + (i & 7);
        return h.video.read8(((col & 255) << 8) | (row & 255));
    });
    assert.ok(bytes().some(Boolean), 'original TIEP1 bitmap contains coloured pixels');
    assert.equal(h.KILL_BY_VECTOR(X, 0xe422), true);
    assert.ok(bytes().every(b => b === 0), 'the killed object is no longer in OPTR so no later OPROC call can erase it');
    assert.equal(h.ram.read8(a(h, 'TIECNT')), 0);
});
test('the normal Smart Bomb dispatch, not just direct kill, erases its Bomber victim', () => {
    const h = createFlightHarness({ playerCollisions: false, infiniteSmartBombs: true, sourceCabinetInput: false });
    run(h, 80);
    const X = h.tie.TIEST(1)[0].object;
    h.ram.write16(X + a(h, 'OX16'), (h.ram.read16(a(h, 'BGL')) + 0x1800) & 65535);
    h.ram.write8(X + a(h, 'OY16'), 0x70);
    h.ram.write16(X + a(h, 'OXV'), 0);
    h.ram.write16(X + a(h, 'OYV'), 0);
    h.ram.write8(a(h, 'TIECNT'), 1);
    h.objectVideo.OPROC(0xef2a);
    assert.equal(h.SMART_BOMB(), true);
    h.STEP();
    assert.equal(h.ram.read8(a(h, 'TIECNT')), 0, 'SBOMB traverses the original OPTR and calls TIEKIL');
    assert.equal(h.ram.read8(a(h, 'SBFLG')), 1);
    assert.equal(h.smartBomb.FLASHING(), true);
});
