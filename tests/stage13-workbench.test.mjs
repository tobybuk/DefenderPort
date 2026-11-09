import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSourceLanderWorkbench } from '../demo/lander-harness.js';
import { BLK71_ADDR } from '../original/blk71-terrain.js';
import { RAM } from '../runtime/ram.js';
import { createBlk71TerrainRoutines } from '../original/blk71-terrain.js';
test('Stage13 fixture reads source BGALT terrain bytes rather than guessed ground height', () => {
    const lab = createSourceLanderWorkbench(), s = lab.STATE();
    const bank = new RAM();
    const terrain = createBlk71TerrainRoutines(lab.ram, { write8() {
        } }, { terrainBank: bank });
    terrain.BGALT();
    assert.equal(s.altitudeAtLander, bank.read8(BLK71_ADDR.ALTTBL + (s.lander.x >>> 6)));
});
test('Original process and VELO workbench advances linked lander/humanoid RAM, repeatably', () => {
    const lab = createSourceLanderWorkbench();
    const before = lab.STATE();
    const after = lab.RUN(90);
    assert.equal(after.ticks, 90);
    assert.notEqual(after.lander.y, before.lander.y);
    assert.equal(after.astronautCount, 1);
    assert.equal(after.landCount, 1);
    const first = JSON.stringify(after);
    lab.RESET();
    assert.equal(JSON.stringify(lab.RUN(90)), first);
});
test('Workbench initial state uses 1 original target and 2 original process entries', () => {
    const lab = createSourceLanderWorkbench(), s = lab.STATE();
    assert.equal(s.ticks, 0);
    assert.equal(lab.ram.read16(lab.Layout.at('TLIST')), s.astronaut.object);
    assert.equal(lab.ram.read16(s.lander.process + lab.Layout.at('PD2')), s.astronaut.object);
    assert.equal(lab.ram.read16(s.lander.process + lab.Layout.at('PD4')), lab.Layout.at('TLIST'));
});
test('Stage13 production browser controller does not replace source scheduling with timer rules', () => {
    const src = readFileSync(new URL('../browser/flight.js', import.meta.url), 'utf8');
    assert.match(src, /createSourceLanderWorkbench/);
    assert.match(src, /lander120:.*\.RUN\(120\)/);
    assert.doesNotMatch(src, /landerLab.*frame\s*%/);
});
