/**
 * Stage 31 source-cabinet timing verification.
 * Source references: Red Label e740063, DEFB6.SRC SWTAB 1844–1859,
 * DEFA7.SRC SSCAN 758–805, EXEC/SWP/DISP 3042–3126,
 * SCPROC/SCP1/SCP2 3294–3305.
 * Sound synthesis is deliberately omitted; unlimited bombs remain a host option.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFlightHarness } from '../demo/flight-harness.js';
import { defenderGameSwitchTable } from '../original/defb6-switch-table.js';
import { createDefa7Executive } from '../original/defa7-exec.js';
import { createDefa7Routines } from '../original/defa7.js';
import { PHR6_LAYOUT as L } from '../runtime/phr6-layout.js';
import { RAM } from '../runtime/ram.js';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
const game = () => createFlightHarness({ sourceCabinetInput: true, infiniteSmartBombs: true, playerCollisions: false });
const byte = (h, n) => h.ram.read8(L.at(n));
const steps = (h, n) => {
    for (let i = 0; i < n; i++)
        h.STEP();
};
const clearWave = h => {
    for (const n of ['LNDCNT', 'LNDRES', 'TIECNT', 'PRBCNT', 'SWCNT', 'SCZCNT', 'SCZRES'])
        h.ram.write8(L.at(n), 0);
};
test('source DEFB6 SWTAB has exactly eight ordered FDB/FCB entries and original masks', () => {
    const A = { LFIRE: 0xf930, SBOMB: 0xf950, HYPER: 0xf970, REV: 0xf940 };
    const b = defenderGameSwitchTable(A);
    assert.deepEqual(Array.from(b), [
        0xf9, 0x30, 0, 0xe8, 0, 0, 0, 0,
        0xf9, 0x50, 0, 0xf8, 0xf9, 0x70, 0, 0xf8,
        0, 0, 0, 0, 0, 0, 0, 0,
        0xf9, 0x40, 0, 0xe8, 0, 0, 0, 0
    ]);
    assert.throws(() => defenderGameSwitchTable({ ...A, LFIRE: undefined }), /Missing source action/);
});
test('source-cabinet INPUT updates hardware PIA first, not stale RAM snapshots', () => {
    const h = game();
    const original = byte(h, 'PIA21');
    h.INPUT({ thrust: true, up: true, down: true, fire: true, reverse: true, smartBomb: true, hyperspace: true });
    assert.equal(h.ram.read8(0xcc04), 0xcf);
    assert.equal(h.ram.read8(0xcc06), 1);
    assert.equal(byte(h, 'PIA21'), original, 'hardware sample has not yet passed SSCAN');
    h.STEP();
    assert.equal(byte(h, 'PIA21'), 0xcf);
    assert.equal(byte(h, 'PIA31'), 1);
    assert.equal(h.ram.read16(L.at('SWPROC')), 0, 'original SWP consumed the queued switch');
});
test('original SSCAN triggers only once for a held FIRE key; a two-zero release rearms it', () => {
    const h = game();
    h.INPUT({ fire: true });
    steps(h, 35);
    assert.equal(h.STATE().laserShots, 1, 'source SSCAN is edge-triggered, not auto-fire');
    h.INPUT({ fire: false });
    steps(h, 2);
    h.INPUT({ fire: true });
    steps(h, 2);
    assert.equal(h.STATE().laserShots, 2);
});
test('original SWITCH takes the lowest asserted bit when simultaneous controls start', () => {
    const h = game();
    h.INPUT({ fire: true, reverse: true });
    steps(h, 3);
    assert.equal(h.STATE().laserShots, 1);
    assert.equal(h.STATE().direction, 0x300, 'higher switch bit cannot create an independent event that frame');
    h.INPUT({});
    steps(h, 8);
    h.INPUT({ reverse: true });
    steps(h, 4);
    assert.equal(h.STATE().direction, 0xfd00, 'rearmed reverse uses original REV process');
});
test('the original REV release/cooldown is controlled by PIA sampled hold, not key autorepeat', () => {
    const h = game();
    h.INPUT({ reverse: true });
    steps(h, 20);
    assert.equal(h.STATE().direction, 0xfd00);
    assert.equal(byte(h, 'REVFLG'), 1, 'held switch prevents original REV2 from ending');
    h.INPUT({ reverse: false });
    steps(h, 12);
    assert.equal(byte(h, 'REVFLG'), 0);
    h.INPUT({ reverse: true });
    steps(h, 3);
    assert.equal(h.STATE().direction, 0x300);
});
test('source Smart Bomb input still respects release debounce and unlimited-ammo option', () => {
    const h = game();
    h.INPUT({ smartBomb: true });
    steps(h, 2);
    assert.equal(h.STATE().smartBombs, Infinity);
    assert.equal(h.STATE().storedSmartBombs, 3);
    assert.equal(byte(h, 'SBFLG'), 1);
    steps(h, 35);
    assert.equal(byte(h, 'SBFLG'), 1, 'source SBX1A must see release');
    h.INPUT({ smartBomb: false });
    steps(h, 35);
    assert.equal(byte(h, 'SBFLG'), 0);
    h.INPUT({ smartBomb: true });
    steps(h, 2);
    assert.equal(byte(h, 'SBFLG'), 1);
    assert.equal(h.STATE().storedSmartBombs, 3);
});
test('source hyperspace switch enters HYPER and completes via its continuations', () => {
    const h = game();
    h.ram.write8(L.at('LSEED'), 0);
    h.INPUT({ hyperspace: true });
    h.STEP();
    assert.equal(h.STATE().hyperspaces, 1);
    assert.equal(byte(h, 'STATUS'), 0x77);
    h.INPUT({ hyperspace: false });
    steps(h, 77);
    assert.equal(h.STATE().hyperspaces, 1);
    assert.equal(h.STATE().hyperspaceActive, false);
    assert.equal(h.STATE().gameOver, false);
});
test('scanner first redraw occurs on original SCP2 wakeup at tick 4, then every 8 ticks', () => {
    const h = game();
    assert.equal(h.STATE().scannerObjects, 15, 'RESET drew initial scanner once');
    assert.equal(h.STATE().scannerRedraws, 0, 'initial presentation is not SCP2');
    steps(h, 3);
    assert.equal(h.STATE().scannerRedraws, 0);
    steps(h, 1);
    assert.equal(h.STATE().scannerRedraws, 1);
    steps(h, 7);
    assert.equal(h.STATE().scannerRedraws, 1);
    steps(h, 1);
    assert.equal(h.STATE().scannerRedraws, 2);
    steps(h, 16);
    assert.equal(h.STATE().scannerRedraws, 4);
    assert.equal(h.STATE().scannerObjects, 15);
});
test('the original EXEC consumes TIMER, orders COLCHK/XUVCT/RAND before DISP and leaves no queued switch', () => {
    const ram = new RAM(), procs = createDefa7Routines(ram, L);
    procs.PINIT();
    const calls = [];
    const e = createDefa7Executive(ram, L, { ...procs, DISP() {
            calls.push('DISP');
            return { kind: 'end-of-dispatch' };
        } }, {
        MAPC: v => calls.push('MAPC:' + v), COLCHK: () => calls.push('COLCHK'),
        XUVCT: () => calls.push('XUVCT'), RAND: () => calls.push('RAND'), OFSHIT: () => calls.push('OFSHIT')
    });
    ram.write8(L.at('TIMER'), 1);
    assert.deepEqual(e.EXEC(), { kind: 'end-of-dispatch' });
    assert.deepEqual(calls, ['MAPC:2', 'COLCHK', 'XUVCT', 'RAND', 'DISP']);
    assert.equal(ram.read8(L.at('TIMER')), 0);
});
test('SWP filters source STATUS with only low mask byte, not process-type high byte', () => {
    const ram = new RAM(), procs = createDefa7Routines(ram, L);
    procs.PINIT();
    const e = createDefa7Executive(ram, L, procs);
    ram.write16(L.at('SWPROC'), 0x1234);
    ram.write16(L.at('SWPROC') + 2, 0x0100); // PTYPE=1, mask=0
    ram.write8(L.at('STATUS'), 1);
    e.SWP();
    assert.equal(ram.read16(L.at('SWPROC')), 0);
    assert.equal(ram.read16(L.at('ACTIVE')), L.at('PTAB'), 'the source mask=0 allows even a PTYPE=1 process');
});
test('source EXEC drive advances the original RNG, empties the timer each tick, keeps initial wave', () => {
    const a = game(), b = game();
    assert.equal(a.WAVE_STATE().landerCount, 5);
    assert.equal(a.WAVE_STATE().ufoCount, 0);
    for (let i = 0; i < 120; i++) {
        a.INPUT({ thrust: i < 40, up: i > 60 && i < 90 });
        a.STEP();
        b.INPUT({ thrust: i < 40, up: i > 60 && i < 90 });
        b.STEP();
    }
    assert.equal(byte(a, 'TIMER'), 0, 'EXEC0 resets the original timer after IRQ');
    assert.deepEqual(a.STATE(), b.STATE(), 'same pinned source input yields identical deterministic state');
    assert.equal(a.STATE().scannerRedraws, 15);
    assert.equal(a.STATE().infiniteSmartBombs, true);
});
test('later wave transitions retain original source population with source EXEC enabled', () => {
    const h = game();
    clearWave(h);
    steps(h, 185);
    assert.equal(h.WAVE_STATE().wave, 2);
    assert.equal(byte(h, 'TIECNT'), 3);
    assert.equal(byte(h, 'PRBCNT'), 1);
    assert.equal(h.STATE().infiniteSmartBombs, true);
});
test('standalone bundles original cabinet table, SWP/EXEC and source scanner cadence', () => {
    const html = readFileSync(new URL('../play.html', import.meta.url), 'utf8');
    const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
    assert.ok(script);
    for (const fn of ['function defenderGameSwitchTable', 'function createDefa7Executive', 'function createDefa7SwitchRoutines', 'function fireSample']) {
        assert.ok(script.includes(fn), `missing ${fn}`);
    }
    assert.match(script, /sourceCabinetInput:\s*true/);
    assert.match(script, /executive\.EXEC\(\)/);
    assert.match(script, /pendingTaps\.clear\(\)/);
    assert.doesNotThrow(() => new Script(script));
});
