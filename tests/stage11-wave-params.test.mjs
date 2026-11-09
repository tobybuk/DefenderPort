import test from 'node:test';
import assert from 'node:assert/strict';
import { RAM } from '../runtime/ram.js';
import { PHR6_LAYOUT as L } from '../runtime/phr6-layout.js';
import { WVTAB, WVTAB_ROWS } from '../original/blk71-wave-data.js';
import { createDefb6BankingObjectRoutines } from '../original/defb6-banking-object.js';
import { createDefa7WaveParameterRoutines } from '../original/defa7-wave-params.js';
import { createSourceProcessWorkbench } from '../demo/process-harness.js';
function setup({ nth = 0, extra = 0, MAPCH7 } = {}) {
    const m = new RAM(), b = createDefb6BankingObjectRoutines(m, L), callMap = MAPCH7 || b.MAPCH7;
    const p = createDefa7WaveParameterRoutines(m, L, { MAPCH7: callMap, RCMOSA: () => nth, RCMOSD: () => extra });
    const r = n => m.read8(L.at(n)), w = (n, v) => m.write8(L.at(n), v);
    return { m, p, r, w };
}
test('BLK71 WVTAB is exactly 23 source rows of eight original bytes', () => {
    assert.equal(WVTAB_ROWS, 23);
    assert.equal(WVTAB.length, 184);
    assert.deepEqual(Array.from(WVTAB.slice(0, 8)), [20, 0, 0, 0, 15, 20, 20, 20]);
    assert.deepEqual(Array.from(WVTAB.slice(-8)), [200, 40, 0xf4, 0xf8, 240, 220, 200, 200]);
    assert.equal(L.at('ELEND') - L.at('ELIST'), WVTAB_ROWS);
});
test('WDELT positive intra-wave increment, source maximum and bank selection', () => {
    const { m, p } = setup();
    const Y = L.at('ELIST');
    m.write8(Y + 7, 0x5f); // LNDXV max $60, delta +3
    p.WDELT(2, Y);
    assert.equal(m.read8(Y + 7), 0x5f); // rejected because $62 exceeds $60
    m.write8(Y + 7, 0x5d);
    p.WDELT(2, Y);
    assert.equal(m.read8(Y + 7), 0x60);
    assert.equal(m.read8(L.at('MAPCR')), 7);
});
test('WDELT negative signed delta obeys borrow and minimum, not JS signed math', () => {
    const { m, p } = setup();
    const Y = L.at('ELIST'), row = 18;
    m.write8(Y + row, 11);
    p.WDELT(2, Y);
    assert.equal(m.read8(Y + row), 11); // negative -2, min 10
    m.write8(Y + row, 12);
    p.WDELT(2, Y);
    assert.equal(m.read8(Y + row), 10);
    m.write8(Y + row, 10);
    p.WDELT(2, Y);
    assert.equal(m.read8(Y + row), 10);
});
test('WDELT leaves high value alone when unsigned positive addition overflows', () => {
    const { m, p } = setup();
    const Y = L.at('ELIST');
    m.write8(Y + 7, 255);
    p.WDELT(2, Y);
    assert.equal(m.read8(Y + 7), 255);
});
test('GETWV writes original wave-one WVTAB values into current player block', () => {
    const { m, p, w } = setup();
    w('CURPLR', 1);
    const X = L.at('P1SCR');
    p.GETWV(X);
    assert.equal(m.read8(X + L.at('PWAV')), 1);
    const expected = Array.from({ length: 23 }, (_, i) => WVTAB[i * 8 + 4]);
    assert.deepEqual(Array.from(m.snapshot(X + L.at('PENEMY'), X + L.at('PENEMY') + 23)), expected);
});
test('GETWV clamps source column to wave 4 for wave 5 and higher', () => {
    const { m, p, w } = setup();
    w('CURPLR', 1);
    const X = L.at('P1SCR');
    m.write8(X + L.at('PWAV'), 5);
    p.GETWV(X);
    assert.equal(m.read8(X + L.at('PWAV')), 6);
    assert.deepEqual(Array.from(m.snapshot(X + L.at('PENEMY'), X + L.at('PENEMY') + 23)), Array.from({ length: 23 }, (_, i) => WVTAB[i * 8 + 7]));
});
test('GETWV periodic astronaut restoration uses source exact wave divisibility', () => {
    const { m, p, w } = setup({ nth: 3 });
    w('CURPLR', 1);
    const X = L.at('P1SCR');
    m.write8(X + L.at('PWAV'), 2);
    p.GETWV(X);
    assert.equal(m.read8(X + L.at('PTARG')), 10);
});
test('GETWV inter-wave delta is capped by CMOS ceiling and uses current-player source record', () => {
    const { m, p, w } = setup({ extra: 0x0120 });
    w('CURPLR', 2);
    // Request GETWV on player one but source PLINDX chooses CURPLR for delta.
    const X = L.at('P1SCR');
    m.write8(X + L.at('PWAV'), 3);
    p.GETWV(X);
    assert.equal(m.read8(X + L.at('PWAV')), 4);
    assert.equal(m.read8(L.at('P2SCR') + L.at('PENEMY') + 7), 2);
    assert.equal(m.read8(X + L.at('PENEMY') + 7), 0x2e); // W4 LNDXV
});
test('WDELT requires real MAPCH7; incomplete bank dependency is not emulated', () => {
    const m = new RAM(), p = createDefa7WaveParameterRoutines(m, L);
    assert.throws(() => p.WDELT(2, L.at('ELIST')), /missing source translation/);
});
test('original process workbench starts GEXEC, COLR, THPROC and runs 120 linked-list ticks', () => {
    const w = createSourceProcessWorkbench();
    assert.equal(w.STATE().fireballIndex, 0);
    const state = w.RUN(120);
    assert.equal(state.ticks, 120);
    assert.equal(state.gt, 8);
    assert.equal(state.active.length, 3);
    assert.ok(state.thrustIndex >= 0 && state.thrustIndex <= 32);
    assert.ok(state.fireballIndex >= 0 && state.fireballIndex <= 24);
});
test('original GEXEC process reaches 40-update WDELT via its real 15-tick sleeps', () => {
    const w = createSourceProcessWorkbench();
    w.RUN(240);
    w.RUN(240);
    w.RUN(120);
    assert.equal(w.STATE().gt, 40);
    assert.equal(w.STATE().landerXVelocity, 3);
});
test('original REV process is spawned, debounced through NAP and self-terminates', () => {
    const w = createSourceProcessWorkbench();
    w.REV();
    w.STEP();
    assert.equal(w.STATE().revFlag, 1);
    assert.equal(w.STATE().direction, 0xfd00);
    w.RUN(8);
    assert.equal(w.STATE().revFlag, 0);
    assert.equal(w.STATE().active.length, 3);
});
