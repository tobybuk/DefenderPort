/**
 * Stage 30 source audit / gameplay integration regression.
 * Pinned Williams Red Label e740063, DEFA7.SRC 3209–3276 (HYPER–HYP2)
 * and DEFB6.SRC 1436–1458 (SCLR1).  Addresses E3D0/F970.. are labelled
 * relocation handles in this JavaScript project, not asserted ROM addresses.
 * These tests deliberately inspect actual source RAM and video bytes.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFlightHarness } from '../demo/flight-harness.js';
import { createDefb6ActiveScreenClearRoutines } from '../original/defb6-active-screen-clear.js';
import { PHR6_LAYOUT as L } from '../runtime/phr6-layout.js';
import { VideoMemory } from '../runtime/video-memory.js';
const game = () => createFlightHarness({ infiniteSmartBombs: true, playerCollisions: false });
const rd = (h, k) => h.ram.read16(L.at(k));
const rb = (h, k) => h.ram.read8(L.at(k));
const wr = (h, k, v) => h.ram.write16(L.at(k), v);
const byte = (x, y) => ((x & 255) << 8) | (y & 255);
test('original SCLR1 clears playfield, not scanner/HUD or unaddressed bytes', () => {
    const v = new VideoMemory();
    for (const [x, y] of [[0, 0], [44, 18], [44, 41], [44, 42], [0, 255], [155, 255], [156, 42]])
        v.write8(byte(x, y), 0xae);
    createDefb6ActiveScreenClearRoutines(v, L).SCLR1();
    for (const [x, y] of [[0, 0], [44, 18], [44, 41], [156, 42]])
        assert.equal(v.read8(byte(x, y)), 0xae, `preserve ${x},${y}`);
    for (const [x, y] of [[44, 42], [0, 255], [155, 255]])
        assert.equal(v.read8(byte(x, y)), 0, `clear ${x},${y}`);
});
test('hyperspace start obeys source STATUS mask and delays teleport by 15 NAP ticks', () => {
    const h = game();
    const oldX = rd(h, 'PLAX16');
    assert.equal(h.HYPERSPACE(), true);
    h.STEP();
    assert.equal(rb(h, 'STATUS'), 0x77);
    assert.equal(rd(h, 'PLAX16'), oldX, 'no teleport while the ship is invisible for first 15 ticks');
    assert.equal(h.HYPERSPACE(), false, 'no nested hyperspace during the animation');
    for (let i = 0; i < 17; i++)
        h.STEP();
    assert.equal(rd(h, 'PLAX16') !== oldX, true, '15-tick continuation teleports');
    assert.ok([0x50, 0x52].includes(rb(h, 'STATUS')));
});
test('HYP0 branches use original SEED low bit and HSEED high byte; no velocity survives', () => {
    for (const [seed, x, direction] of [[0xaaa4, 0x7000, 0xfd00], [0xaaa5, 0x2000, 0x0300]]) {
        const h = game();
        assert.equal(h.HYPERSPACE(), true);
        h.STEP(); // establish the original current HYPER process pointer
        // Fix the source seed at the exact HYP02 entry. Other runnable source
        // processes legitimately update SEED during the 15-tick NAP interval.
        wr(h, 'SEED', seed); // SEED and HSEED are adjacent source BYTES, not separate words
        h.hyperspace.HYP02();
        assert.equal(rd(h, 'BGL'), seed);
        assert.equal(rd(h, 'BGLX'), seed);
        assert.equal(rd(h, 'PLAX16'), x);
        assert.equal(rd(h, 'NPLAD'), direction);
        assert.equal(rb(h, 'PLAY16'), ((seed & 255) >>> 1) + L.at('YMIN'));
        assert.equal(rd(h, 'PLAYV'), 0);
        assert.equal(rd(h, 'PLAXV'), 0);
        assert.equal(h.ram.read8(L.at('PLAXV') + 2), 0);
        assert.equal(rd(h, 'NPLAXC') >>> 8, x >>> 8);
        // Appearance is managed in original source object RAM; no canvas sprite.
        let found = false, p = rd(h, 'OPTR');
        for (let n = 0; p && n < 95; n++, p = h.ram.read16(p + L.at('OLINK')))
            if ([0xe3d0, 0xe3d4, 0xff9d].includes(h.ram.read16(p + L.at('OPICT'))) && h.ram.read16(p + L.at('OCVECT')) === 0xe31c)
                found = true;
        assert.ok(found, 'phony original player appearance object registered');
        assert.equal(h.STATE().playerDeaths, 0);
    }
});
test('HYP02 removes actual linked source projectiles and restores BMBCNT', () => {
    const h = game();
    assert.equal(h.HYPERSPACE(), true);
    h.STEP();
    // A source GETSHL allocation uses the real OFREE and SPTR lists. Create
    // a shooter in the visible world solely to exercise the shell allocation.
    const shooter = h.procs.GETOB();
    h.ram.write16(shooter + L.at('OX16'), (rd(h, 'BGL') + 0x800) & 65535);
    h.ram.write8(shooter + L.at('OY16'), 110);
    const shell = h.sourceShells.GETSHL(shooter, 0, {
        OBJCOL: 0xf801, OPICT: 0xf802, OCVECT: 0xf803
    });
    assert.ok(shell, 'test shell allocated using original source GETSHL');
    assert.equal(rd(h, 'SPTR'), shell);
    assert.equal(rb(h, 'BMBCNT'), 1);
    h.hyperspace.HYP02();
    assert.equal(rd(h, 'SPTR'), 0, 'all hostile shots cleared on teleport');
    assert.equal(rb(h, 'BMBCNT'), 0, 'source projectile count reset');
});
test('source SEED/HSEED share contiguous byte storage, not independent 16-bit registers', () => {
    const h = game();
    wr(h, 'SEED', 0x1235);
    assert.equal(rb(h, 'SEED'), 0x12);
    assert.equal(rb(h, 'HSEED'), 0x35);
    assert.equal(rd(h, 'SEED'), 0x1235);
});
test('failed hyperspace LSEED > 192 enters source PLEND death (not a silent no-op)', () => {
    const h = game();
    h.ram.write8(L.at('LSEED'), 193);
    assert.ok(h.HYPERSPACE());
    for (let i = 0; i < 66; i++)
        h.STEP();
    assert.equal(h.STATE().playerDeathActive, true, 'PLEND colour-cycle scheduled on same process');
    assert.equal(h.STATE().status & 0x58, 0x58);
});
test('unlimited bombs still work after non-fatal hyperspace; scanner and wave counts retained', () => {
    const h = game(), before = h.STATE(), humans = h.ASTRONAUT_STATE().count;
    h.ram.write8(L.at('LSEED'), 0);
    h.HYPERSPACE();
    for (let i = 0; i < 72; i++)
        h.STEP();
    assert.equal(h.STATE().hyperspaceActive, false);
    assert.equal(h.ASTRONAUT_STATE().count, humans);
    assert.equal(h.STATE().wave.wave, before.wave.wave);
    assert.equal(h.STATE().infiniteSmartBombs, true);
    assert.equal(h.SMART_BOMB(), true);
});
// The host repeat adapter is explicitly not the original SSCAN SWTAB,
// but every actual laser is still made by the original LFIRE/LASR/LASL.
test('hold-fire browser wiring and hyperspace controls are included in exact standalone build', async () => {
    const { readFileSync } = await import('node:fs');
    const html = readFileSync(new URL('../play.html', import.meta.url), 'utf8');
    assert.match(html, /data-key="KeyH" id="hyperspaceButton"/);
    assert.match(html, /data-key="KeyF" id="laserSound"/);
    assert.match(html, /next\.address\s*===\s*WAVE_ADDR\.HYPER/);
    assert.match(html, /const FIRE_REPEAT_TICKS\s*=\s*7/);
    // The runnable heading advances across release stages; this tests presence, not a version whitelist.
    assert.match(html, /Stage \d+/);
});
