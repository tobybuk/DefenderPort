/**
 * Stage 23 end-to-end source integration. These tests assert LIVE RAM and
 * objects in OPTR/IPTR, not a synthetic Canvas display or test-position array.
 * The deterministic seed belongs solely to the documented flight fixture.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFlightHarness } from '../demo/flight-harness.js';
import { RAM } from '../runtime/ram.js';
import { PHR6_LAYOUT as L } from '../runtime/phr6-layout.js';
import { VideoMemory } from '../runtime/video-memory.js';
import { createSamexap7ExplosionStartRoutines, SAMEX_RAM } from '../original/samexap7-explosion-start.js';
const addr = n => L.at(n);
function objects(h, head) {
    const found = [], seen = new Set();
    let X = h.ram.read16(addr(head));
    while (X) {
        assert.ok(!seen.has(X), head + ' list cycle');
        seen.add(X);
        found.push(X);
        X = h.ram.read16(X + addr('OLINK'));
        assert.ok(found.length <= 95, 'original list limit');
    }
    return found;
}
function run(h, count) {
    for (let i = 0; i < count; i++)
        h.STEP();
}
test('SCPROC runs source scanner lists and retires actual Lander projectiles', () => {
    const h = createFlightHarness();
    assert.equal(h.ram.read8(addr('BMBCNT')), 0);
    run(h, 1000);
    const live = [...objects(h, 'OPTR'), ...objects(h, 'IPTR')];
    assert.ok(live.length >= 10 && live.length <= 20, 'source capture/mutation changes live object-list length after arrival animation');
    assert.ok(objects(h, 'IPTR').length > 0, 'source OSCAN moves world-distant records into IPTR');
    const shells = objects(h, 'SPTR');
    assert.ok(shells.length > 0, 'source LSHOT -> SHOOT -> GETSHL must create shells');
    assert.equal(shells.length, h.ram.read8(addr('BMBCNT')), 'source SHSCAN controls count');
    assert.ok(shells.length <= 20, 'source GETSHL limit');
    assert.ok(h.scanTasks.SCPROC && h.scanTasks.SCP1 && h.scanTasks.SCP2);
    assert.equal(h.STATE().scannerObjects, live.length, 'scanner derives blips from both original lists');
});
test('abduction completes through source ASTK1 and SCZ00, not a fabricated mutation', () => {
    const h = createFlightHarness();
    for (let i = 0; i < 3000 && h.ASTRONAUT_STATE().count === 10; i++)
        h.STEP();
    assert.equal(h.WAVE_STATE().astronautCount, 9);
    assert.equal(h.ASTRONAUT_STATE().count, 9);
    assert.equal(h.ASTRONAUT_STATE().living.length, 9);
    assert.equal(h.ram.read8(addr('SCZCNT')), 1);
    assert.equal(h.ram.read8(addr('LNDCNT')), 9);
    const active = [...objects(h, 'OPTR'), ...objects(h, 'IPTR')];
    assert.equal(active.length, 19, 'astronaut was unlinked by KILOFF, lander became mutant');
    assert.ok(active.some(X => h.ram.read16(X + addr('OPICT')) === 0xe280), 'source SCZ00 changes enemy picture to SCZP1');
    const slot = h.ram.read16(addr('LSEXPL'));
    assert.ok(slot >= SAMEX_RAM.RAMALS && slot < SAMEX_RAM.RAMEND, 'EXST allocates original explosion memory');
    assert.ok(h.ram.read16(slot + SAMEX_RAM.RSIZE) >= 0x100, 'source EXST allocated positive-size explosion');
    assert.equal(h.ram.read16(slot + SAMEX_RAM.OBDESC), 0xe2a4, 'source ASXP1 descriptor kept');
});
test('source shell fire and nine astronaut captures do not stop the runtime for 3000 frames', () => {
    const h = createFlightHarness();
    run(h, 3000);
    assert.ok(h.WAVE_STATE().astronautCount < 10, 'real Lander captures happened through source processing');
    assert.equal(h.ram.read8(addr('SCZCNT')), 10 - h.WAVE_STATE().astronautCount);
    assert.equal(h.ASTRONAUT_STATE().living.length, h.WAVE_STATE().astronautCount);
    assert.equal(h.WAVE_STATE().ufoCount, 0, 'baiter delay still governed by original timer');
    assert.ok(h.ram.read8(addr('BMBCNT')) <= 20);
    assert.equal(objects(h, 'SPTR').length, h.ram.read8(addr('BMBCNT')));
    h.RESET();
    assert.equal(h.WAVE_STATE().astronautCount, 10);
    assert.equal(h.ram.read8(addr('SCZCNT')), 0);
    assert.equal(h.ram.read16(addr('LSEXPL')), 0);
    assert.equal(h.ram.read8(addr('BMBCNT')), 0);
    assert.equal(h.WAVE_STATE().landerCount, 5);
});
test('source SCZST creates distant mutants with native source process records', () => {
    const h = createFlightHarness();
    const before = h.ram.read8(addr('SCZCNT'));
    const created = h.mutantStart.SCZST(2);
    assert.equal(created.length, 2);
    assert.equal(h.ram.read8(addr('SCZCNT')), before + 2);
    for (const { process: U, object: X } of created) {
        assert.equal(h.ram.read16(U + addr('PD')), X);
        assert.equal(h.ram.read16(X + addr('OBJID')), U);
        assert.equal(h.ram.read16(X + addr('OPICT')), 0xe280);
        assert.equal(h.ram.read16(X + addr('OBJCOL')), 0xcc33);
        assert.equal(h.ram.read16(X + addr('OCVECT')), 0xe282);
        assert.ok(objects(h, 'OPTR').includes(X), 'original APVCT head insertion');
    }
});
test('SAMEX EXST respects out-of-view objects, source slot metadata and center fallback', () => {
    const ram = new RAM(), video = new VideoMemory();
    const source = createSamexap7ExplosionStartRoutines(ram, L, video, { resolvePicture: () => ({ width: 4, height: 8 }) });
    const X = 0xb200;
    ram.write16(X + addr('OX16'), 0x5000);
    assert.equal(source.EXST(X), null, 'relative x beyond $2600 is not allocated');
    ram.write16(X + addr('OX16'), 0x1800);
    ram.write8(X + addr('OY16'), 0x82);
    ram.write16(X + addr('OPICT'), 0xe2a4);
    const Y = source.EXST(X);
    assert.equal(Y, 0x9c00);
    assert.equal(ram.read16(addr('LSEXPL')), Y);
    assert.equal(ram.read16(Y + SAMEX_RAM.RSIZE), 0x100);
    assert.equal(ram.read16(Y + SAMEX_RAM.OBDESC), 0xe2a4);
    assert.equal(ram.read16(Y + SAMEX_RAM.ERASES), Y + 0x40);
    assert.equal(ram.read16(Y + SAMEX_RAM.TOPLFT), 0x6082);
    assert.equal(ram.read16(Y + SAMEX_RAM.CENTER), 0x6286);
    assert.equal(source.EXST(X), 0x9c40, 'subsequent source slot selected');
});
test('SAMEX EERASE consumes original reverse erase-pointer table and clears two video bytes per entry', () => {
    const ram = new RAM(), video = new VideoMemory();
    const source = createSamexap7ExplosionStartRoutines(ram, L, video, { resolvePicture: () => ({ width: 4, height: 8 }) });
    const X = 0xb200;
    ram.write16(X + addr('OX16'), 0x0800);
    ram.write8(X + addr('OY16'), 0x90);
    ram.write16(X + addr('OPICT'), 0xe2a4);
    const Y = source.EXST(X);
    const t1 = 0x5080, t2 = 0x5190;
    video.write8(t1, 11);
    video.write8(t1 + 1, 12);
    video.write8(t2, 13);
    video.write8(t2 + 1, 14);
    ram.write16(Y + SAMEX_RAM.ERASES, Y + 0x3c);
    ram.write16(Y + 0x3c, t1);
    ram.write16(Y + 0x3e, t2);
    source.EERASE(Y);
    assert.deepEqual([video.read8(t1), video.read8(t1 + 1), video.read8(t2), video.read8(t2 + 1)], [0, 0, 0, 0]);
    assert.equal(ram.read16(Y + SAMEX_RAM.ERASES), Y + 0x40);
});
test('last-astronaut loss now runs translated TERBLO without hitting the old boundary', () => {
    const h = createFlightHarness();
    for (const item of h.ASTRONAUT_STATE().living)
        h.astronaut.ASTK1(item.object);
    assert.equal(h.ASTRONAUT_STATE().count, 0);
    run(h, 500);
    assert.ok(h.ram.read8(addr('STATUS')) & 2, 'source terrain-destroyed flag must be set');
});
