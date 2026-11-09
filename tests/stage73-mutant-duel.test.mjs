/** Stage 73: symmetric Mutant duel and collision shield for the attract pilot.
 * Every encounter runs the unmodified translated engine; only the starting
 * scene is arranged (tools/stage73-mutant-arena.mjs). The pilot acts through
 * ordinary cabinet inputs only.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createFlightHarness } from '../demo/flight-harness.js';
import { loadPilot, encounter, SPEEDS } from '../tools/stage73-mutant-arena.mjs';

const make = loadPilot(fileURLToPath(new URL('../browser/flight.js', import.meta.url)));
const LATE = SPEEDS['late wave 2-3'], FASTEST = SPEEDS['later waves'];

function tally(cases, speed) {
    const out = { kill: 0, death: 0, none: 0, bombs: 0 };
    cases.forEach(([dx, dy], seed) => {
        const r = encounter(make, { dx, dy, speed, seed });
        out[r.result]++;
        out.bombs += r.bombs;
    });
    return out;
}

test('source SCZ0 homes on the ship height only from 22 columns left to 5 columns right', () => {
    // The duel's geometry depends on this source behaviour; fail loudly if it changes.
    const homes = dx => {
        const h = createFlightHarness({ infiniteSmartBombs: false, playerCollisions: false, sourceCabinetInput: true });
        h.RESET(); h.INPUT({}); h.STEP();
        const ram = h.ram, at = n => h.Layout.at(n), s = h.STATE();
        ram.write8(at('SZXV'), 0); ram.write16(at('SZYV'), 0x0110); ram.write8(at('SZRY'), 0);
        for (const e of h.ENEMY_STATE()) if (e.object) ram.write16(e.object + at('OX16'), (s.worldX + 25000) & 65535);
        const x = h.mutantStart.SCZST(1)[0].object;
        ram.write16(x + at('OX16'), (s.worldX + dx * 64) & 65535);
        ram.write16(x + at('OY16'), (s.y - 40) << 8);
        for (let t = 0; t < 30; t++) { h.INPUT({}); h.STEP(); }
        return ram.read8(x + at('OY16')) - h.STATE().y > -40;
    };
    for (const dx of [-20, -10, 0, 5]) assert.equal(homes(dx), true, `homes at ${dx} columns`);
    for (const dx of [-24, 6, 12]) assert.equal(homes(dx), false, `no homing at ${dx} columns`);
});

test('late-wave Mutants rising from BELOW are survived and killed', () => {
    const r = tally([[-22, 25], [-8, 50], [2, 25], [16, 50], [-14, 80], [8, 80]], LATE);
    assert.equal(r.death, 0, JSON.stringify(r));
    assert.ok(r.kill >= 5, JSON.stringify(r));
});

test('late-wave Mutants diving from ABOVE are survived and killed', () => {
    const r = tally([[-22, -25], [-8, -50], [2, -25], [16, -50], [-14, -80], [8, -80]], LATE);
    assert.equal(r.death, 0, JSON.stringify(r));
    assert.ok(r.kill >= 5, JSON.stringify(r));
});

test('Mutants at the fastest wave-table speeds do not kill the ship from either side', () => {
    const r = tally([[-8, 25], [2, 25], [16, 50], [-8, -25], [2, -25], [16, -50]], FASTEST);
    assert.equal(r.death, 0, JSON.stringify(r));
});

test('ordinary late-wave encounters are won without spending a smart bomb', () => {
    const r = tally([[-22, 50], [16, 50], [-22, -50], [16, -50]], LATE);
    assert.equal(r.bombs, 0, JSON.stringify(r));
    assert.equal(r.death, 0, JSON.stringify(r));
});

test('the ship never climbs or dives towards a Mutant directly above or below it', () => {
    for (const dy of [22, -22]) {
        const h = createFlightHarness({ infiniteSmartBombs: false, playerCollisions: true, sourceCabinetInput: true });
        h.RESET(); h.INPUT({}); h.STEP();
        const ram = h.ram, at = n => h.Layout.at(n), s = h.STATE();
        ram.write8(at('SZXV'), LATE.x); ram.write16(at('SZYV'), LATE.y); ram.write8(at('SZRY'), LATE.hop);
        for (const e of h.ENEMY_STATE()) if (e.object) ram.write16(e.object + at('OX16'), (s.worldX + 25000) & 65535);
        const x = h.mutantStart.SCZST(1)[0].object;
        ram.write16(x + at('OX16'), (s.worldX + 2 * 64) & 65535);
        ram.write16(x + at('OY16'), (s.y + dy) << 8);
        const p = make();
        for (let t = 0; t < 20; t++) {
            const st = h.STATE(), c = p.sample(st, h.ENEMY_STATE(), h.ASTRONAUT_STATE(), ram, h.Layout);
            const my = ram.read8(x + at('OY16')), mx = ((ram.read16(x + at('OX16')) - st.worldX + 32768) & 65535) - 32768;
            const overlapping = mx > -5 * 64 && mx < 8 * 64;
            if (overlapping && my > st.y) assert.equal(c.down, false, `tick ${t}: dived towards a Mutant below`);
            if (overlapping && my < st.y) assert.equal(c.up, false, `tick ${t}: climbed towards a Mutant above`);
            h.INPUT(c); h.STEP();
        }
        assert.equal(h.STATE().playerDeaths, 0, `survived Mutant starting ${dy}px away`);
    }
});

test('pinned against the top limit with a Mutant rising beneath, the ship survives', () => {
    const h = createFlightHarness({ infiniteSmartBombs: false, playerCollisions: true, sourceCabinetInput: true });
    h.RESET(); h.INPUT({}); h.STEP();
    const ram = h.ram, at = n => h.Layout.at(n);
    ram.write16(at('PLAY16'), 44 << 8);
    h.INPUT({}); h.STEP();
    const s = h.STATE();
    ram.write8(at('SZXV'), LATE.x); ram.write16(at('SZYV'), LATE.y); ram.write8(at('SZRY'), LATE.hop);
    for (const e of h.ENEMY_STATE()) if (e.object) ram.write16(e.object + at('OX16'), (s.worldX + 25000) & 65535);
    const x = h.mutantStart.SCZST(1)[0].object;
    ram.write16(x + at('OX16'), (s.worldX + 1 * 64) & 65535);
    ram.write16(x + at('OY16'), (s.y + 30) << 8);
    const p = make();
    for (let t = 0; t < 90; t++) {
        const c = p.sample(h.STATE(), h.ENEMY_STATE(), h.ASTRONAUT_STATE(), ram, h.Layout);
        h.INPUT(c); h.STEP();
    }
    assert.equal(h.STATE().playerDeaths, 0);
});

test('pilot state reports the duel and shield through ordinary observers', () => {
    const p = make();
    const st = p.state();
    for (const key of ['duelPhase', 'duelId', 'duelShots', 'shieldTriggers', 'emergencyBombs', 'mutPhase', 'mutId'])
        assert.ok(key in st, key);
});
