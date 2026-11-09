/** Stage 28: pinned BLK71.SRC 562–670, native PLEX/PINIT/PX1A translation.
 * Covers source velocity construction, original 128 10-byte records, exact
 * palette cadence, original packed-byte video output, and process/lives handoff.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { VideoMemory } from '../runtime/video-memory.js';
import { createBlk71PlayerExplosionRoutines, pxSeedNext, PXCOL } from '../original/blk71-player-explosion.js';
import { createFlightHarness } from '../demo/flight-harness.js';
const tick = (h, n) => {
    for (let i = 0; i < n; i++)
        h.STEP();
};
const until = (h, fn, max = 500) => {
    for (let i = 0; i < max; i++) {
        if (fn())
            return i;
        h.STEP();
    }
    assert.fail('source player explosion did not reach state within ' + max + ' ticks');
};
test('PINIT2 exact 6809 LSRA/EORA/LSRA/LSRA/ROR/ROR reference seed sequence', () => {
    let seed = 0x0808;
    for (let i = 0; i < 300; i++) {
        const hi = seed >>> 8, lo = seed & 255;
        const xor = lo ^ (lo >>> 1);
        // The carry after two successive LSRA steps, independent bit-level oracle.
        const nextCarry = (xor >>> 1) & 1;
        const expected = ((nextCarry << 15) | (hi << 7) | (lo >>> 1)) & 65535;
        assert.equal(pxSeedNext(seed), expected, 'LFSR after source shift ' + i);
        seed = expected;
    }
});
test('PLEX allocates 128 original 10-byte TABLE pieces at the exact player centre', () => {
    const p = createBlk71PlayerExplosionRoutines(new VideoMemory());
    assert.equal(p.PLEX(0x2488).pieces, 128);
    assert.equal(p.table.length, 1280);
    assert.equal(p.STATE().accepted, 128);
    assert.equal(p.STATE().retries, 171, 'same PINIT2 corner rejects for pinned seeds');
    for (let o = 0; o < 1280; o += 10) {
        assert.deepEqual(Array.from(p.table.slice(o, o + 6)), [0, 0, 0x24, 0, 0x88, 0]);
    }
    assert.deepEqual(Array.from(p.table.slice(6, 10)), [0xff, 2, 0xff, 0xcc]);
});
test('PX1A uses exact 56 + 13×4 = 108 source frames and then PXCOL zero terminator', () => {
    const video = new VideoMemory(), colours = [];
    const p = createBlk71PlayerExplosionRoutines(video, { onColour: c => colours.push(c) });
    p.PLEX(0x2488);
    for (let i = 0; i < 56; i++)
        assert.equal(p.PX1A(), false);
    assert.equal(p.STATE().colour, 0x7f);
    for (let i = 56; i < 108; i++)
        assert.equal(p.PX1A(), false);
    assert.equal(p.STATE().colour, 0);
    assert.equal(p.STATE().frames, 108);
    assert.equal(p.PX1A(), true);
    assert.equal(p.STATE().active, false);
    assert.equal(p.STATE().finished, true);
    assert.deepEqual([...new Set(colours)], PXCOL.slice(0, -1).concat(0));
    assert.ok(video.data.some(x => x !== 0), 'source PX8 leaves video data; black DAC slot hides the fragments');
    p.FINISH_DISPLAY();
    assert.equal(video.data.reduce((s, x) => s + (x !== 0), 0), 0, 'diagnostic host can clear the residual bytes after PX8');
});
test('PLEX renders original two-column B-nibble patterns in shared video RAM, not synthetic particles', () => {
    const video = new VideoMemory(), p = createBlk71PlayerExplosionRoutines(video);
    p.PLEX(0x2488);
    p.PX1A();
    const nonzero = video.data.filter(x => x !== 0);
    assert.ok(nonzero.length > 10, 'many source fragments initially overlap at the same player-centre coordinates');
    assert.ok(nonzero.every(x => [0xbb, 0xb0, 0x0b].includes(x)), 'only source hard-coded packed pixels can be written');
    assert.ok(nonzero.includes(0xbb));
    assert.ok(nonzero.includes(0xb0));
    assert.ok(p.STATE().writes > 250);
    p.RESET();
    assert.equal(video.data.reduce((s, x) => s + (x !== 0), 0), 0, 'reset erases the explosion remnants');
});
test('PLEX same initial state deterministically generates the same fragment velocities across runs', () => {
    const one = createBlk71PlayerExplosionRoutines(new VideoMemory()), two = createBlk71PlayerExplosionRoutines(new VideoMemory());
    one.PLEX(0x2488);
    two.PLEX(0x2488);
    assert.deepEqual(one.table, two.table);
    one.PX1A();
    two.PX1A();
    assert.deepEqual(one.table, two.table);
});
test('PDTH5 now schedules the source PX1A process and does not prematurely respawn', () => {
    const h = createFlightHarness({ infiniteSmartBombs: true });
    h.schedulePlayerDeath();
    until(h, () => h.STATE().playerExplosion.active);
    const before = h.STATE();
    assert.equal(before.playerDeaths, 0);
    assert.equal(before.shipsInReserve, 2);
    tick(h, 65);
    assert.equal(h.STATE().playerExplosion.active, true);
    assert.equal(h.STATE().playerDeaths, 0);
    assert.equal(h.STATE().playerExplosion.colorIndex > 0, true);
    until(h, () => h.STATE().playerDeaths === 1);
    assert.equal(h.STATE().playerExplosion.finished, true);
    assert.deepEqual(h.STATE().soundBus.slice(-2), [0x3f, 0x2c], 'PDTH5 sends original stop-sound command $13');
    assert.ok(h.STATE().levelTransition > 0);
    until(h, () => h.STATE().levelTransition === 0);
    assert.equal(h.STATE().shipsInReserve, 1);
    assert.equal(h.STATE().playerExplosion.active, false);
});
test('source PX1A transition preserves infinite Smart Bomb developer option and normal wave', () => {
    const h = createFlightHarness({ infiniteSmartBombs: true });
    h.schedulePlayerDeath();
    until(h, () => h.STATE().playerDeaths === 1);
    until(h, () => h.STATE().levelTransition === 0);
    assert.equal(h.STATE().smartBombs, Infinity);
    assert.equal(h.STATE().wave.wave, 1);
    assert.equal(h.STATE().playerExplosion.active, false);
    assert.equal(h.STATE().playerDeaths, 1);
});
