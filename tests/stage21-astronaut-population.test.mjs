/**
 * Stage 21 regression for the actual user-visible failure: Stage 20 created
 * only one 4x8 astronaut fixture. These checks must fail if we regress back
 * to one source object, an empty TLIST, or a sprite that never reaches the
 * normal visible playfield framebuffer.
 *
 * Grounded in DEFA7.SRC ASTST/ASTS1A/ASTS1B/ASTS1C and PLRES lines
 * 1513-1576. No alternate drawing or game engine is used in these tests.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFlightHarness } from '../demo/flight-harness.js';
import { getPixel } from '../browser/video-presenter.js';
import { ENEMY_PICTURES } from '../original/defb6-enemy-pictures.js';
const addr = (h, name) => h.Layout.at(name);
const field = (h, X, name) => h.ram.read16(X + addr(h, name));
const sourceHumans = h => h.ENEMY_STATE().filter(x => x.label === 'ASTP1');
const sourceImage = (h, X) => {
    const pict = field(h, X, 'OPICT');
    const names = new Map([[0xe240, 'ASTP1'], [0xe24a, 'ASTP2'], [0xe254, 'ASTP3'], [0xe25e, 'ASTP4']]);
    const name = names.get(pict);
    assert.ok(name, 'unknown original astronaut picture ' + pict.toString(16));
    return ENEMY_PICTURES[name];
};
function matchesVisibleSourceSprite(h, object) {
    const addr = object.video;
    if (!addr)
        return false;
    const xbyte = addr >>> 8, y = addr & 255;
    if ((xbyte + 2) * 2 <= 12 || xbyte * 2 >= 304 || y + 8 <= 7 || y >= 247)
        return false;
    const picture = sourceImage(h, object.object);
    const phase = ((object.worldX - h.STATE().bgl) & 0x20) ? 1 : 0;
    const bytes = picture.phases[phase];
    let matches = 0, lit = 0;
    for (let col = 0; col < 2; col++)
        for (let row = 0; row < 8; row++) {
            const b = h.video.read8(((xbyte + col) << 8) | (y + row));
            if (b === bytes[col * 8 + row])
                matches++;
            if (b)
                lit++;
        }
    return matches >= 8 && lit >= 5;
}
test('ASTST: level-one source population creates ten linked, noncolliding astronauts, spread across four quadrants', () => {
    const h = createFlightHarness(), humans = sourceHumans(h), ram = h.ram;
    assert.equal(h.WAVE_STATE().astronautCount, 10);
    assert.equal(humans.length, 10, 'not a single diagnostic human');
    const targetPointers = [];
    for (let i = 0; i < 10; i++)
        targetPointers.push(ram.read16(addr(h, 'TLIST') + 2 * i));
    assert.deepEqual(targetPointers, humans.map(o => o.object));
    assert.equal(new Set(targetPointers).size, 10);
    for (const { object: X, worldX, y } of humans) {
        assert.equal(field(h, X, 'OCVECT'), 0xe232);
        assert.equal(field(h, X, 'OBJCOL'), 0x6666, 'ASTST original colour');
        assert.equal(ram.read8(X + addr(h, 'OTYP')), 0x10, 'ASTST original non-colliding object type');
        assert.equal(field(h, X, 'OXV'), 0);
        assert.equal(field(h, X, 'OYV'), 0);
        assert.equal(field(h, X, 'OBJID'), 0);
        assert.equal(y, 0xe0);
        assert.ok(worldX >= 0 && worldX <= 0xffff);
        assert.ok([0xe240, 0xe254].includes(field(h, X, 'OPICT')), 'ASTST original direction selection');
    }
    const quadrants = new Set(humans.slice(0, 8).map(o => o.worldX >>> 14));
    assert.deepEqual([...quadrants].sort(), [0, 1, 2, 3], 'ASTS1A distributes first eight into all four world quadrants');
    assert.equal(h.STATE().scannerObjects, 15, '10 original humans + first source squad of 5 landers');
});
test('ASTST -> OPROC -> VIDEO -> presenter: multiple actual astronaut pictures are visible at reset', () => {
    const h = createFlightHarness(), humans = sourceHumans(h);
    const visible = humans.filter(o => matchesVisibleSourceSprite(h, o));
    assert.ok(visible.length >= 2, `only ${visible.length} source astronauts actually visible in main playfield`);
    // A sampled presentFrame pixel in the exact sprite position must originate
    // from the source VIDEO buffer. The browser never draws a surrogate shape.
    for (const o of visible) {
        const x = (o.video >>> 8) * 2 - 12, y = (o.video & 255) - 7;
        assert.ok(x >= 0 && x < 292 && y >= 0 && y < 240);
        let lit = 0;
        for (let dx = 0; dx < 4; dx++)
            for (let dy = 0; dy < 8; dy++) {
                if (x + dx >= 0 && x + dx < 292 && y + dy >= 0 && y + dy < 240)
                    lit += getPixel(h.video, x + dx, y + dy) !== 0 ? 1 : 0;
            }
        assert.ok(lit >= 5, `original human bitmap has too few surviving pixels (${lit}) at (${x},${y})`);
    }
});
test('source astronaut population survives source animation, scanner tracking and deterministic reset', () => {
    const h = createFlightHarness(), initial = sourceHumans(h);
    for (let i = 0; i < 600; i++)
        h.STEP();
    const after = sourceHumans(h);
    assert.equal(after.length, 10);
    assert.equal(h.WAVE_STATE().astronautCount, 10);
    assert.ok(after.some((obj, i) => obj.worldX !== initial[i].worldX), 'source ASTRO must actually walk astronauts');
    assert.ok(after.filter(o => matchesVisibleSourceSprite(h, o)).length >= 1, 'source humans remain visible after animation');
    assert.equal(h.STATE().scannerObjects, h.ENEMY_STATE().length);
    h.RESET();
    assert.deepEqual(sourceHumans(h), initial, 'source RAND seed and ASTST order must reset reproducibly');
    assert.equal(sourceHumans(h).filter(o => matchesVisibleSourceSprite(h, o)).length >= 2, true);
});
test('GTARG source lander pointer is a live, target-listed member of the ten astronauts', () => {
    const h = createFlightHarness(), land = h.ENEMY_STATE().find(o => o.label === 'LNDP1');
    const U = field(h, land.object, 'OBJID'), target = field(h, U, 'PD2'), slot = field(h, U, 'PD4');
    assert.equal(h.ram.read16(slot), target);
    assert.ok(sourceHumans(h).some(o => o.object === target));
    assert.equal(slot, addr(h, 'TLIST') + 2, 'original GTARG pre-increment from source TPTR');
});
