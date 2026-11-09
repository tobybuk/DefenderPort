/** Stage 19 regression: original DEFB6 astronaut + additional enemy picture
 * descriptors and live ASTRO source linked process. This tests actual
 * source RAM/video operations, never a separate Canvas drawing surrogate.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ENEMY_PICTURES } from '../original/defb6-enemy-pictures.js';
import { createFlightHarness } from '../demo/flight-harness.js';
import { createDefa7ObjectVideoRoutines } from '../original/defa7-object-video.js';
import { VideoMemory } from '../runtime/video-memory.js';
const at = (h, n) => h.Layout.at(n);
const field = (h, X, n) => h.ram.read16(X + at(h, n));
test('source astronaut four animation descriptors contain the exact original 2x8 video bytes', () => {
    const p = ENEMY_PICTURES;
    assert.deepEqual(Array.from(p.ASTP1.phases[0]), [0x33, 0x43, 0x43, 0x87, 0x87, 0x07, 0x07, 0x07, 0, 0, 0x80, 0x80, 0x80, 0, 0, 0]);
    assert.deepEqual(Array.from(p.ASTP4.phases[1]), [0, 0, 0x08, 0x08, 0x08, 0, 0, 0, 0x33, 0x34, 0x34, 0x78, 0x78, 0x77, 0x77, 0x77]);
    for (const name of ['ASTP1', 'ASTP2', 'ASTP3', 'ASTP4']) {
        assert.equal(p[name].width, 2);
        assert.equal(p[name].height, 8);
        for (const phase of p[name].phases)
            assert.equal(phase.length, 16);
    }
});
test('other original source graphic descriptors use correct ON/OFF dimensions and video bytes', () => {
    const expected = { SCZP1: [5, 8], ASXP1: [4, 8], SWXP1: [4, 8], PRBP1: [4, 8], BMBP1: [2, 3], BMBP2: [2, 3] };
    const v = new VideoMemory(), g = createDefa7ObjectVideoRoutines(v);
    const fn = { '5x8': 'ON58', '4x8': 'ON48', '2x3': 'ON23' };
    for (const [name, [width, height]] of Object.entries(expected)) {
        const p = ENEMY_PICTURES[name];
        assert.equal(p.width, width);
        assert.equal(p.height, height);
        const n = fn[`${width}x${height}`];
        g[n](0x5070, p, false);
        for (let col = 0; col < width; col++)
            for (let row = 0; row < height; row++)
                assert.equal(v.read8(((0x50 + col) << 8) | (0x70 + row)), p.phases[0][col * height + row], `${name} ${col},${row}`);
        // Ensure independent sprite check (same framebuffer may be reused).
        v.clear();
    }
});
test('source astronaut belongs to real OPTR/SCNR list and is drawn by OPROC ON28', () => {
    const h = createFlightHarness(), human = h.ENEMY_STATE().find(x => x.label === 'ASTP1');
    assert.ok(human?.object);
    assert.ok([0xe240, 0xe254].includes(field(h, human.object, 'OPICT')), 'source ASTST selects walking direction via RAND');
    assert.equal(field(h, human.object, 'OCVECT'), 0xe232);
    assert.equal(h.ram.read16(at(h, 'TLIST')), human.object);
    assert.ok(human.video, 'test human is visible via source OPROC');
    assert.ok(h.WAVE_STATE().astronautProcess);
    assert.equal(h.STATE().scannerObjects, h.ASTRONAUT_STATE().count + h.WAVE_STATE().landerCount + h.ram.read8(h.Layout.at('SCZCNT')), 'scanner counts live source records rather than the historical object-creation log');
    const picture = ENEMY_PICTURES[field(h, human.object, 'OPICT') === 0xe254 ? 'ASTP3' : 'ASTP1'];
    const x = human.video >>> 8, y = human.video & 255;
    const phase = Boolean((human.worldX - h.STATE().bgl) & 0x20) ? 1 : 0;
    let present = 0;
    for (let c = 0; c < 2; c++)
        for (let r = 0; r < 8; r++)
            present += h.video.read8(((x + c) << 8) | (y + r)) === picture.phases[phase][c * 8 + r] ? 1 : 0;
    assert.ok(present >= 8, 'original astronaut sprite bytes reach video RAM');
});
test('source ASTRO process scans target list, walks and animates visible human', () => {
    const h = createFlightHarness(), human = h.ENEMY_STATE().find(x => x.label === 'ASTP1');
    const initialX = human.worldX, initialPicture = field(h, human.object, 'OPICT');
    for (let i = 0; i < 80; i++)
        h.STEP();
    const current = field(h, human.object, 'OX16');
    assert.notEqual(current, initialX, 'ASTRO should move the human after its original 16-entry cyclic scan');
    const picture = field(h, human.object, 'OPICT');
    assert.ok([0xe240, 0xe24a, 0xe254, 0xe25e].includes(picture));
    assert.ok(h.STATE().scannerObjects === h.ENEMY_STATE().length);
    assert.ok(initialPicture !== 0);
});
test('source lander remains targeted to the same rendered astronaut after 120 ticks', () => {
    const h = createFlightHarness(), human = h.ENEMY_STATE().find(x => x.label === 'ASTP1');
    const land = h.ENEMY_STATE().find(x => x.label === 'LNDP1');
    assert.equal(field(h, field(h, land.object, 'OBJID'), 'PD2'), h.ram.read16(h.Layout.at('TLIST') + 2));
    for (let i = 0; i < 120; i++)
        h.STEP();
    assert.equal(field(h, field(h, land.object, 'OBJID'), 'PD2'), h.ram.read16(h.Layout.at('TLIST') + 2));
    assert.equal(h.WAVE_STATE().astronautCount, 10);
    h.RESET();
    assert.equal(h.ENEMY_STATE().filter(x => x.label === 'ASTP1').length, 10);
});
test('stress: no source scheduler or descriptor errors during long wave/astronaut updates', () => {
    const h = createFlightHarness();
    for (let i = 0; i < 1200; i++)
        h.STEP();
    assert.equal(h.WAVE_STATE().ufoCount, 0, 'baiters must be delayed on wave one');
    assert.ok(h.ENEMY_STATE().some(x => x.label === 'ASTP1'));
    assert.equal(h.STATE().scannerObjects, h.ASTRONAUT_STATE().count + h.WAVE_STATE().landerCount + h.ram.read8(h.Layout.at('SCZCNT')), 'scanner counts live source records rather than the historical object-creation log');
});
