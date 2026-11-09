/**
 * Stage 27 end-to-end checks (source: DEF A7.SRC 1141-46, 1207-1314,
 * 1325-1431 PLEND/PDEATH/PDTH/PLE2, 3128-3151 COLCHK and 3171-3207 SBOMB).
 *
 * No independent game-life state or Canvas enemy model is used. The temporary
 * unlimited ammunition setting bypasses only PSBC consumption; the finite
 * source transliteration is also tested in Stage 26 regression tests.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script, createContext } from 'node:vm';
import { createFlightHarness } from '../demo/flight-harness.js';
const at = (h, n) => h.Layout.at(n);
const tick = (h, n) => {
    for (let i = 0; i < n; i++)
        h.STEP();
};
const tickUntil = (h, predicate, max = 650) => {
    for (let i = 0; i < max; i++) {
        if (predicate())
            return i;
        h.STEP();
    }
    assert.fail('Expected source state was not reached within ' + max + ' ticks');
};
test('temporary infinite Smart Bombs: every distinct press still runs SBOMB; original three-charge RAM never decrements', () => {
    const h = createFlightHarness({ infiniteSmartBombs: true });
    assert.equal(h.STATE().smartBombs, Infinity);
    assert.equal(h.STATE().storedSmartBombs, 3);
    tick(h, 100);
    const scoreBefore = h.STATE().scoreHits;
    for (let i = 0; i < 9; i++) {
        assert.equal(h.SMART_BOMB(), true, `press ${i + 1} not blocked at zero ammo`);
        h.INPUT({ smartBomb: true });
        tick(h, 1);
        if (i === 0)
            assert.ok(h.STATE().scoreHits > scoreBefore, 'the first Smart Bomb runs original enemy-kill vectors');
        assert.equal(h.ram.read8(at(h, 'SBFLG')), 1, 'source debounce active');
        assert.equal(h.STATE().storedSmartBombs, 3, 'source counter preserved');
        h.INPUT({ smartBomb: false });
        tick(h, 48);
        assert.equal(h.ram.read8(at(h, 'SBFLG')), 0, 'distinct press re-arms after release');
    }
    assert.equal(h.STATE().smartBombs, Infinity);
    h.RESET();
    assert.equal(h.STATE().smartBombs, Infinity);
    assert.equal(h.STATE().storedSmartBombs, 3);
});
test('PLEND has original STATUS/colour cycle, saves wave state, and loses no ship until respawn', () => {
    const h = createFlightHarness({ infiniteSmartBombs: true });
    const starting = h.STATE();
    assert.equal(starting.shipsInReserve, 2, 'source PLSTRT consumes first of 3 ships');
    assert.equal(h.schedulePlayerDeath(), true);
    assert.equal(h.schedulePlayerDeath(), false, 'source STATUS bit 3 prevents duplicate PLEND');
    tick(h, 1);
    assert.equal(h.STATE().status & 0x58, 0x58, 'PLEND sets source death bits');
    assert.equal(h.STATE().shipsInReserve, 2, 'no premature life debit');
    tick(h, 18);
    assert.ok(h.playerDeath.PXCTB.includes(h.ram.read8(at(h, 'PCRAM') + 11)));
    tickUntil(h, () => h.STATE().playerExplosion.active);
    assert.equal(h.STATE().playerDeaths, 0, 'PLEX must finish before taking a life');
    tickUntil(h, () => h.STATE().playerDeaths === 1);
    assert.equal(h.STATE().playerExplosion.finished, true, 'BLK71 PLEX finishes before PLE01');
    assert.ok(h.STATE().levelTransition > 0, 'original PLSTRT restart is scheduled');
    tickUntil(h, () => h.STATE().levelTransition === 0);
    assert.equal(h.STATE().shipsInReserve, 1);
    assert.equal(h.STATE().playerDeaths, 1);
    assert.equal(h.WAVE_STATE().wave, 1, 'death is not mistaken for a cleared wave');
    assert.equal(h.STATE().smartBombs, Infinity);
});
test('source life accounting: three ship deaths, two respawns, then game over; reset starts fresh game', () => {
    const h = createFlightHarness({ infiniteSmartBombs: true });
    for (let death = 1; death <= 3; death++) {
        assert.equal(h.schedulePlayerDeath(), true);
        tickUntil(h, () => h.STATE().playerDeaths === death);
        if (death < 3)
            tickUntil(h, () => h.STATE().levelTransition === 0);
        assert.equal(h.STATE().playerDeaths, death);
        if (death < 3) {
            assert.equal(h.STATE().shipsInReserve, 2 - death);
            assert.equal(h.STATE().gameOver, false);
        }
        else {
            assert.equal(h.STATE().gameOver, true);
            assert.equal(h.STATE().status, 255, 'source PLE2 sets $FF');
            assert.equal(h.FIRE(), false);
            assert.equal(h.REVERSE(), false);
            assert.equal(h.SMART_BOMB(), false);
        }
    }
    tick(h, 120);
    assert.equal(h.STATE().playerDeaths, 3, 'game over is stationary');
    h.RESET();
    assert.equal(h.STATE().gameOver, false);
    assert.equal(h.STATE().playerDeaths, 0);
    assert.equal(h.STATE().shipsInReserve, 2);
});
test('source wave completion restores the unspent ship consumed by the following PLSTR3', () => {
    const h = createFlightHarness();
    const first = h.STATE().shipsInReserve;
    for (const key of ['LNDCNT', 'LNDRES', 'TIECNT', 'PRBCNT', 'SWCNT', 'SCZCNT', 'SCZRES'])
        h.ram.write8(at(h, key), 0);
    tick(h, 210);
    assert.equal(h.WAVE_STATE().wave, 2);
    assert.equal(h.STATE().shipsInReserve, first, 'wave transition must not consume a life');
    h.schedulePlayerDeath();
    tickUntil(h, () => h.STATE().playerDeaths === 1);
    tickUntil(h, () => h.STATE().levelTransition === 0);
    assert.equal(h.WAVE_STATE().wave, 2, 'respawn continues current wave');
    assert.equal(h.STATE().shipsInReserve, first - 1);
});
test('automatic player-to-enemy collisions can start the native PLEND process without an exception', () => {
    const h = createFlightHarness({ playerCollisions: true, infiniteSmartBombs: true });
    let hit = false;
    for (let i = 0; i < 2600; i++) {
        h.STEP();
        if (h.STATE().playerDeaths > 0) {
            hit = true;
            break;
        }
    }
    assert.equal(hit, true, 'original enemy/player sprite intersection occurs in a source-driven wave');
    assert.equal(h.STATE().gameOver, false);
});
test('actual standalone HTML boots Stage 27 with unlimited ammo and source PLEND present', () => {
    const html = readFileSync(new URL('../play.html', import.meta.url), 'utf8');
    const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
    assert.ok(script);
    assert.match(script, /createFlightHarness\(\{\s*infiniteSmartBombs:\s*false,\s*playerCollisions:\s*true/);
    assert.match(script, /function createDefa7PlayerDeathRoutines\(/);
    const canvas = { fillRect() {
        }, fill() {
        }, beginPath() {
        }, moveTo() {
        }, lineTo() {
        }, stroke() {
        }, arc() {
        }, fillText() {
        }, putImageData() {
        }, createImageData(w, h) {
            return { data: new Uint8ClampedArray(w * h * 4) };
        } };
    const nodes = new Map();
    const get = id => {
        if (!nodes.has(id))
            nodes.set(id, { textContent: '', onclick: null, getAttribute() {
                    return null;
                }, addEventListener() {
                }, getContext() {
                    return canvas;
                } });
        return nodes.get(id);
    };
    const sandbox = createContext({ document: { getElementById: get, querySelectorAll() {
                return [];
            } }, window: { addEventListener() {
            } }, requestAnimationFrame() {
        } });
    new Script(script, { filename: 'Defender_Source_Stage27_Run.html' }).runInContext(sandbox, { timeout: 4000 });
    const info = new Script('({bombs:lab.STATE().smartBombs,ships:lab.STATE().shipsInReserve,land:lab.WAVE_STATE().landerCount})').runInContext(sandbox);
    assert.equal(info.bombs, 3);
    assert.equal(info.ships, 2);
    assert.equal(info.land, 5);
});
