/** Stage 57: source-driven cabinet startup and random state continuity.
 * ROMF8.SRC RESET->RAM2->RAM7 (7 full RAM passes);
 * DEFA7.SRC SINIT seeds HSEED only at system initialization, EXEC1 calls RAND;
 * DEFA7.SRC START/PLSTRT does not call SINIT.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCabinetBoot, BOOT_SOURCE } from '../browser/cabinet-boot.js';
import { createFlightHarness } from '../demo/flight-harness.js';
import { createAmode1Attract } from '../original/amode1-attract.js';
import { PHR6_LAYOUT } from '../runtime/phr6-layout.js';

const at = name => PHR6_LAYOUT.at(name);
function attractRandom(a) {
    return {
        seed: a.ram.read8(at('SEED')),
        hseed: a.ram.read8(at('HSEED')),
        lseed: a.ram.read8(at('LSEED')),
        starMap: a.ram.snapshot(at('SMAP'), at('SMEND'))
    };
}
const positions = game => game.ASTRONAUT_STATE().living.map(item => item.worldX);

test('ROMF8.RAM2 has SEVEN write-and-verify passes, not two test passes', () => {
    assert.equal(BOOT_SOURCE.passes, 7);
    const boot = createCabinetBoot();
    let countWrites = 0, countVerifies = 0, previous = '';
    for (let i = 0; i < 1400 && !boot.STATE().finished; i++) {
        const s = boot.STATE();
        const current = `${s.phase}:${s.pass}`;
        if (current !== previous) {
            if (s.phase === 'write') countWrites++;
            if (s.phase === 'verify') countVerifies++;
            previous = current;
        }
        boot.STEP();
    }
    assert.equal(countWrites, 7);
    assert.equal(countVerifies, 7);
    assert.equal(boot.STATE().ramAccessible, true);
    assert.equal(boot.STATE().finished, true);
});

test('SINIT random seed advances throughout attract and is inherited when START begins', () => {
    const attract = createAmode1Attract({ initialCredits: 0 });
    const game = createFlightHarness({ infiniteSmartBombs: false, sourceCabinetInput: true });
    const zero = attractRandom(attract);
    for (let i = 0; i < 80; i++) attract.STEP();
    const later = attractRandom(attract);
    assert.notDeepEqual([zero.seed, zero.hseed, zero.lseed], [later.seed, later.hseed, later.lseed]);
    game.RESET(null, zero);
    const first = positions(game);
    game.RESET(null, later);
    const second = positions(game);
    assert.equal(first.length, 10);
    assert.equal(second.length, 10);
    assert.notDeepEqual(first, second, 'first-wave source-generated positions must vary with attract time');

    // Lander positions must also differ, not just the 10 humanoids. LANDST
    // draws its source RNG values after the first GEXEC wave startup.
    game.RESET(null, zero);
    for (let i = 0; i < 35; i++) game.STEP();
    const firstLanders = game.ENEMY_STATE().filter(o => o.label === 'LNDP1').map(o => o.worldX);
    game.RESET(null, later);
    for (let i = 0; i < 35; i++) game.STEP();
    const secondLanders = game.ENEMY_STATE().filter(o => o.label === 'LNDP1').map(o => o.worldX);
    assert.equal(firstLanders.length, 5);
    assert.equal(secondLanders.length, 5);
    assert.notDeepEqual(firstLanders, secondLanders, 'original LANDST positions respond to inherited RAND state');
});

test('wave continuation preserves the current source RNG, never re-initialises at $A55A', () => {
    const game = createFlightHarness();
    game.RESET();
    const state = game.RANDOM_STATE();
    const savedPlayer = game.ram.snapshot(at('P1SCR'), at('P2SCR'));
    game.RESET(savedPlayer, state);
    const after = game.RANDOM_STATE();
    // The initial THINIT/FISS/GEXEC execute source RAND; they may advance it,
    // but the new wave must not restart with the same deterministic sequence.
    assert.notDeepEqual(positions(game).slice(0, 3), [], 'wave continues with objects');
    assert.notDeepEqual([after.seed, after.hseed, after.lseed], [0, 0xa5, 0x5a]);
});

test('after gameplay, attract mode inherits the last live source RNG, not SINIT', () => {
    const game = createFlightHarness({ sourceCabinetInput: true });
    const attract = createAmode1Attract({ initialCredits: 0 });
    for (let i = 0; i < 75; i++) game.STEP();
    const live = game.RANDOM_STATE();
    attract.RESET(live);
    const transferred = attractRandom(attract);
    // FISS() in the source consumes random numbers immediately after reset,
    // so the exact current seed is allowed to advance, but the resulting
    // stream must differ from a newly seeded SINIT attract.
    const fresh = createAmode1Attract({ initialCredits: 0 });
    assert.notDeepEqual(
        [transferred.seed, transferred.hseed, transferred.lseed],
        [fresh.ram.read8(at('SEED')), fresh.ram.read8(at('HSEED')), fresh.ram.read8(at('LSEED'))]
    );
});

test('the source random-state handoff rejects malformed snapshots', () => {
    const game = createFlightHarness();
    assert.throws(() => game.RESET(null, { seed: 256, hseed: 1, lseed: 2, starMap: new Uint8Array(at('SMEND')-at('SMAP')) }), /source SEED/);
    assert.throws(() => game.RESET(null, { seed: 1, hseed: 2, lseed: 3, starMap: new Uint8Array(2) }), /source SEED/);
});

test('power-on QUASAR happens before browser RAM-test initialization', () => {
    const src = readFileSync(new URL('../browser/flight.js', import.meta.url), 'utf8');
    const start = src.indexOf('async function powerOnCabinet()');
    const body = src.slice(start, src.indexOf("document.getElementById('powerOnCabinet').onclick", start));
    assert.ok(body.indexOf('audio.powerOn();') >= 0);
    assert.ok(body.indexOf('audio.powerOn();') < body.indexOf('boot.RESET();'));
    assert.match(src, /lab\.RESET\(null, sourceRandomFromAttract\(\)\)/);
});
