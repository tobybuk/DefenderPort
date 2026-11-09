/** Stage 78: attract-AI endgame behaviour.
 * 1. Enemies parked on the inactive list (IPTR) by OSCAN are still hunted,
 *    by the shortest way round, instead of the pilot patrolling at random.
 * 2. With the wave's last enemy left, a Baiter does not draw the AI away.
 * 3. With one human left, the Lander nearest HIM is hunted first.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script, createContext } from 'node:vm';
import { createFlightHarness } from '../demo/flight-harness.js';

const src = readFileSync(new URL('../browser/flight.js', import.meta.url), 'utf8');
const a = src.indexOf('function createAttractPilot()'), b = src.indexOf('const attractPilot=createAttractPilot();', a);
const createPilot = new Script(src.slice(a, b) + ';createAttractPilot').runInContext(createContext({}));
const LANDER = 0xe140, BAITER = 0xe100;

/** A started game, with every object list emptied, and N spare object records. */
function scene(n) {
    const h = createFlightHarness({ infiniteSmartBombs: false, playerCollisions: false, sourceCabinetInput: true });
    h.RESET();
    for (let i = 0; i < 40; i++) { h.INPUT({}); h.STEP(); }
    const at = k => h.Layout.at(k), ram = h.ram;
    const records = [];
    for (const list of ['OPTR', 'IPTR'])
        for (let q = ram.read16(at(list)); q && records.length < 40; q = ram.read16(q + at('OLINK'))) records.push(q);
    assert.ok(records.length >= n, 'enough source object records');
    ram.write16(at('OPTR'), 0); ram.write16(at('IPTR'), 0);
    ram.write8(at('LNDRES'), 0);
    const ship = h.STATE().worldX;
    /** Put record i on `list` as picture `pic`, `cols` columns from the ship, at height y. */
    const place = (i, list, pic, cols, y) => {
        const X = records[i];
        ram.write16(X + at('OPICT'), pic);
        ram.write16(X + at('OX16'), (ship + cols * 64) & 0xffff);
        ram.write8(X + at('OY16'), y);
        ram.write16(X + at('OBJX'), 0);
        ram.write16(X + at('OXV'), 0); ram.write16(X + at('OYV'), 0);
        ram.write16(X + at('OCVECT'), 0);
        ram.write16(X + at('OLINK'), ram.read16(at(list)));
        ram.write16(at(list), X);
        return X;
    };
    return { h, ram, at, place, ship };
}
const run = (s, pilot, astro, ticks = 6, game = null) => {
    let cmd;
    for (let t = 0; t < ticks; t++)
        cmd = pilot.sample(game ?? s.h.STATE(), [], astro ?? s.h.ASTRONAUT_STATE(), s.ram, s.h.Layout, { altitude: s.h.ALTITUDE });
    return cmd;
};

test('an enemy parked on IPTR (outside the OSCAN band) is hunted by the shortest way round', () => {
    for (const cols of [-300, 300]) {
        const s = scene(1);
        const X = s.place(0, 'IPTR', LANDER, cols, 120);
        const pilot = createPilot();
        run(s, pilot);
        assert.equal(pilot.state().targetId, X, `targets the inactive Lander at ${cols} columns`);
        assert.doesNotMatch(pilot.state().reason, /PATROL/);
        assert.equal(Math.sign(pilot.state().heading), Math.sign(cols), 'heads the short way');
    }
});

test('with the last wave enemy left and no reserve, a Baiter does not draw the AI away', () => {
    const s = scene(2);
    const lander = s.place(0, 'IPTR', LANDER, 260, 120);
    s.place(1, 'OPTR', BAITER, -60, 120);
    const pilot = createPilot();
    run(s, pilot, null, 8);
    assert.equal(pilot.state().targetId, lander, 'hunts the last Lander');
    assert.equal(Math.sign(pilot.state().heading), 1);
});

test('with one human left, the Lander nearest him is hunted before a Lander near the ship', () => {
    const s = scene(3);
    const human = s.h.ASTRONAUT_STATE().living.find(x => x.object);
    assert.ok(human, 'a source astronaut');
    const humanCols = Math.round((((human.worldX - s.ship + 32768) & 65535) - 32768) / 64);
    const nearShip = s.place(0, 'OPTR', LANDER, humanCols > 0 ? -40 : 40, 110);
    const nearHuman = s.place(1, 'IPTR', LANDER, humanCols + 20, 150);
    const astro = { count: 1, living: [human] };
    const game = { ...s.h.STATE(), wave: { ...s.h.STATE().wave, astronautCount: 1, landerReserve: 0 } };
    const pilot = createPilot();
    run(s, pilot, astro, 8, game);
    assert.equal(pilot.state().targetId, nearHuman, `guards the human ${humanCols} columns away`);
    assert.notEqual(pilot.state().targetId, nearShip);
});

test('with one human left and nothing to hunt, the AI holds station over him', () => {
    const s = scene(1);
    const human = s.h.ASTRONAUT_STATE().living.find(x => x.object);
    const astro = { count: 1, living: [human] };
    const game = { ...s.h.STATE(), wave: { ...s.h.STATE().wave, astronautCount: 1, landerReserve: 0 } };
    const pilot = createPilot();
    run(s, pilot, astro, 4, game);
    assert.match(pilot.state().reason, /GUARD LAST HUMAN/);
});
