import test from 'node:test';
import assert from 'node:assert/strict';
import { createFlightHarness } from '../demo/flight-harness.js';
const field = (h, X, name) => h.ram.read16(X + h.Layout.at(name));
test('Stage 18: GEXEC calls original LANDST and consumes the lander reserve', () => {
    const h = createFlightHarness(), wave = h.WAVE_STATE();
    assert.equal(wave.landerSpawned, 5);
    assert.equal(wave.landerCount, 5);
    assert.equal(wave.landerReserve, 10);
    assert.equal(wave.astronautCount, 10);
    const { object: X } = h.ENEMY_STATE().find(x => x.label === 'LNDP1');
    const U = field(h, X, 'OBJID');
    assert.ok(U > 0 && X > 0);
    assert.equal(field(h, X, 'OBJID'), U);
    assert.equal(field(h, U, 'PD'), X);
    assert.equal(field(h, X, 'OCVECT'), 0xe228);
    assert.equal(field(h, X, 'OPICT'), 0xff9d, 'the new Lander starts original APST/NULOB appearance');
    assert.equal(h.ram.read8(X + h.Layout.at('OY16')), h.Layout.at('YMIN') + 2);
    assert.ok(field(h, X, 'OX16') !== 0, 'RAND/HSEED supplies world position');
});
test('Stage 18: source GTARG registers the astronaut through TLIST and PD2/PD4', () => {
    const h = createFlightHarness(), land = h.ENEMY_STATE().find(x => x.label === 'LNDP1');
    const U = field(h, land.object, 'OBJID');
    const targetEntry = field(h, U, 'PD4');
    const astronaut = field(h, U, 'PD2');
    assert.ok(targetEntry >= h.Layout.at('TLIST') && targetEntry < h.Layout.at('TLEND')); // Each of five source landers advances TPTR
    assert.equal(h.ram.read16(targetEntry), astronaut);
    assert.equal(field(h, astronaut, 'OCVECT'), 0xe232);
    assert.ok(h.ENEMY_STATE().filter(x => x.label === 'LNDP1').some(x => field(h, field(h, x.object, 'OBJID'), 'PD4') === h.ram.read16(h.Layout.at('TPTR'))), 'TPTR follows the last targeted astronaut slot among the five LANDST calls');
    // Original ASTP1 artwork is now registered and drawn in the shared framebuffer.
    assert.equal(h.ENEMY_STATE().some(x => x.object === astronaut), true);
});
test('Stage 18: lander AI wakes through original LANDS0 and changes source picture', () => {
    const h = createFlightHarness(), land = h.ENEMY_STATE().find(x => x.label === 'LNDP1');
    const before = field(h, land.object, 'OPICT');
    for (let i = 0; i < 8; i++)
        h.STEP();
    const after = field(h, land.object, 'OPICT');
    assert.equal(after, 0xff9d, 'the lander has not prematurely skipped the original appearance interval');
    for (let i = 0; i < 80; i++)
        h.STEP();
    assert.ok([0xe140, 0xe14a, 0xe154].includes(field(h, land.object, 'OPICT')), 'original sprite restored after APST');
    assert.equal(field(h, field(h, land.object, 'OBJID'), 'PD2'), h.ram.read16(h.Layout.at('TLIST') + 2));
    assert.equal(h.STATE().scannerObjects, h.ENEMY_STATE().length);
});
test('Stage 18: source lander is allowed to spawn off-screen but scanner tracks it', () => {
    const h = createFlightHarness(), land = h.ENEMY_STATE().find(x => x.label === 'LNDP1');
    assert.ok(land.worldX >= 0 && land.worldX <= 0xffff, 'source seed determines lander position without fixture relocation');
    assert.equal(h.STATE().scannerObjects, 15);
    for (let i = 0; i < 120; i++)
        h.STEP();
    assert.notEqual(h.ENEMY_STATE().find(x => x.label === 'LNDP1').worldX, land.worldX);
    assert.equal(h.STATE().scannerObjects, h.ENEMY_STATE().length);
});
test('Stage 18: original target and lander process survive extended dispatch and reset', () => {
    const h = createFlightHarness();
    for (let i = 0; i < 500; i++)
        h.STEP();
    assert.equal(h.WAVE_STATE().landerSpawned, 10);
    assert.equal(h.WAVE_STATE().landerCount, 10);
    assert.equal(h.WAVE_STATE().astronautCount, 10);
    h.RESET();
    assert.equal(h.WAVE_STATE().landerSpawned, 5);
    assert.equal(h.WAVE_STATE().landerReserve, 10);
    assert.equal(h.STATE().scannerObjects, 15);
});
