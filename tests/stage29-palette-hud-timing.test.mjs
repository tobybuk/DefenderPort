/**
 * Stage 29: source graphics palette / original glyph HUD / host frame pacing.
 * DEF B6 CRTAB, DEF A7 WCTAB, MESS0 NUMBR0..NUMBR9 and PHR6 HUD offsets.
 * These tests examine actual video bytes and source RAM, not Canvas text.
 * The 60.096 Hz clock is browser pacing, not a simulated 6809 CPU clock.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script, createContext } from 'node:vm';
import { CRTAB, WCTAB, HUD_SOURCE_RELOC, installHudSourceData } from '../original/defender-hud-data.js';
import { defenderDacRGB, defenderHardwarePalette } from '../browser/defender-palette.js';
import { VIDEO_FRAME_MS, VIDEO_CLOCK_HZ, createSourceFrameClock } from '../browser/source-clock.js';
import { framePixels } from '../browser/video-presenter.js';
import { createFlightHarness } from '../demo/flight-harness.js';
const a = (h, n) => h.Layout.at(n);
const b = (h, n) => h.ram.read8(a(h, n));
const advance = (h, n) => {
    for (let i = 0; i < n; i++)
        h.STEP();
};
test('CRTAB and WCTAB bytes are source values, not a diagnostic default palette', () => {
    assert.deepEqual([...CRTAB], [0, 0, 7, 0x28, 0x2f, 0x81, 0xa4, 0x15, 0xc7, 0xff, 0, 0, 0, 0, 0, 0]);
    assert.deepEqual([...WCTAB], [0x81, 0x28, 0x07, 0x16, 0x2f, 0x84, 0x15, 0]);
    const h = createFlightHarness();
    assert.equal(h.ram.read8(a(h, 'PCRAM') + 5), WCTAB[0], 'first-wave original terrain colour');
    assert.deepEqual([...h.ram.snapshot(a(h, 'PCRAM') + 2, a(h, 'PCRAM') + 5)], [7, 0x28, 0x2f]);
});
test('hardware 3:3:2 DAC expands each colour register to RGB, with no fabricated sprite colours', () => {
    assert.deepEqual(defenderDacRGB(0), [0, 0, 0]);
    assert.deepEqual(defenderDacRGB(0x07), [255, 0, 0]);
    assert.deepEqual(defenderDacRGB(0x38), [0, 255, 0]);
    assert.deepEqual(defenderDacRGB(0xc0), [0, 0, 255]);
    assert.deepEqual(defenderDacRGB(0xff), [255, 255, 255]);
    const h = createFlightHarness();
    assert.deepEqual(defenderHardwarePalette(h.ram)[2], [255, 0, 0]);
    assert.deepEqual(defenderHardwarePalette(h.ram)[9], [255, 255, 255]);
});
test('source PCRAM changes only become visible after original IRQ copies into hardware CRAM', () => {
    const h = createFlightHarness();
    const src = a(h, 'PCRAM') + 7, latch = 0xc007;
    const old = h.ram.read8(latch);
    h.ram.write8(src, 0xd5);
    assert.equal(h.ram.read8(latch), old, 'hardware colour latch is not a pointer to source PCRAM');
    assert.notDeepEqual(defenderHardwarePalette(h.ram)[7], defenderDacRGB(0xd5));
    h.IRQ_PAIR();
    assert.equal(h.ram.read8(latch), 0xd5);
    assert.deepEqual(defenderHardwarePalette(h.ram)[7], defenderDacRGB(0xd5));
});
test('actual framebuffer colours use hardware-latched palette, not the old diagnostic RGB set', () => {
    const h = createFlightHarness();
    const colour = defenderHardwarePalette(h.ram);
    const rgba = framePixels(h.video, undefined, colour);
    assert.equal(rgba.length, 292 * 240 * 4);
    const sampled = new Set();
    for (let k = 0; k < rgba.length; k += 4)
        sampled.add(`${rgba[k]},${rgba[k + 1]},${rgba[k + 2]}`);
    for (const str of sampled) {
        assert.ok(colour.some(rgb => rgb.join(',') === str), `unmapped colour ${str}`);
    }
});
test('ten source ROM numeral descriptors and mini-ship/smart-bomb glyphs are installed as bytes', () => {
    const h = createFlightHarness();
    const R = h.ram, A = HUD_SOURCE_RELOC;
    const check = (at, w, ht) => {
        assert.equal(R.read8(at), w);
        assert.equal(R.read8(at + 1), ht);
    };
    for (let k = 0; k < 10; k++)
        check(A.N0V + k * 4, 3, 8);
    check(A.PLAMIN, 5, 4);
    check(A.SBPIC, 3, 3);
    const firstData = R.read16(A.N0V + 2);
    assert.equal(R.read16(firstData), 0x0101, 'NUMBR0 first source FDB');
    assert.equal(R.read16(firstData + 2), 0x0101);
    const bom = R.read16(A.SBPIC + 2);
    assert.deepEqual([...R.snapshot(bom, bom + 9)], [0x90, 0x09, 0x90, 0x99, 0x99, 0x99, 0x90, 0xcc, 0x90]);
    // RESET must reinstall synthetic relocated ROM bytes because RAM.clear removes them.
    h.RESET();
    assert.equal(R.read8(A.N0V), 3);
    assert.equal(R.read16(R.read16(A.N0V + 2)), 0x0101);
});
test('TDISP renders source 5x4 spare-ship and 3x3 Smart Bomb icons into video RAM', () => {
    const h = createFlightHarness();
    const V = h.video;
    assert.deepEqual([...Array.from({ length: 4 }, (_, i) => V.read8(0x0f14 + i))], [0x06, 0x26, 0x68, 0x28]);
    assert.deepEqual([...Array.from({ length: 3 }, (_, i) => V.read8(0x291b + i))], [0x90, 0x09, 0x90]);
    assert.deepEqual([...Array.from({ length: 3 }, (_, i) => V.read8(0x291f + i))], [0x90, 0x09, 0x90]);
    assert.deepEqual([...Array.from({ length: 3 }, (_, i) => V.read8(0x2923 + i))], [0x90, 0x09, 0x90]);
    assert.equal(h.STATE().smartBombs, 3);
    assert.equal(createFlightHarness({ infiniteSmartBombs: true }).STATE().smartBombs, Infinity, 'unlimited bombs are a temporary host setting; ROM HUD still shows three source icons');
});
test('source SCRTRN draws original score glyphs and blanks leading zeros in real video memory', () => {
    const h = createFlightHarness(), V = h.video;
    const addr0 = 0x1f1c, addr1 = 0x231c;
    assert.equal(V.read8(addr0), 1, 'leading visible zero 5th digit');
    assert.equal(V.read8(addr1), 1, 'last zero digit');
    const before = Array.from({ length: 8 }, (_, i) => V.read8(addr0 + i));
    h.TEST_SCORE();
    assert.equal(h.STATE().scoreBCD[3], 0x10, 'source packed-BCD score updated');
    assert.notDeepEqual(Array.from({ length: 8 }, (_, i) => V.read8(addr0 + i)), before, 'tens glyph now 1');
    assert.equal(V.read8(addr1), 1, 'ones glyph remains zero');
    assert.equal(V.read8(0x0f1c), 0, 'upper unused scores do not fabricate leading zeroes');
});
test('COLR process cycles laser colour through source process NAP while IRQ copies palette', () => {
    const h = createFlightHarness();
    const start = h.ram.read8(a(h, 'PCRAM') + 1);
    advance(h, 40);
    const next = h.ram.read8(a(h, 'PCRAM') + 1);
    assert.notEqual(next, start, 'source COLR process advances the colour index');
    assert.ok(h.ram.read8(0xc001) !== 0, 'source IRQ has copied at least one palette entry');
    assert.equal(b(h, 'TIMER'), 40, 'once per paired IRQ half-frames');
});
test('nominal board frame clock is 1 MHz / 16,640 counters, no drift across irregular intervals', () => {
    assert.ok(Math.abs(VIDEO_CLOCK_HZ - (1000000 / 16640)) < 1e-10);
    assert.ok(Math.abs(VIDEO_FRAME_MS - 16.64) < 1e-10);
    const clock = createSourceFrameClock();
    assert.equal(clock.consume(0), 0);
    assert.equal(clock.consume(10), 0);
    assert.equal(clock.consume(16.64), 1);
    assert.equal(clock.consume(33.28), 1);
    assert.equal(clock.consume(49.92), 1);
    assert.equal(clock.state().total, 3);
    clock.pause();
    assert.equal(clock.consume(10000), 0, 'background time is not simulated after pause');
    assert.equal(clock.consume(10016.64), 1);
    assert.equal(clock.state().total, 4);
    clock.reset();
    assert.equal(clock.state().total, 0);
});
test('host clock limits catch-up after suspended tabs and never treats elapsed hours as game ticks', () => {
    const clock = createSourceFrameClock({ maxCatchUp: 6 });
    clock.consume(0);
    const n = clock.consume(60000);
    assert.equal(n, 6);
    assert.ok(clock.state().droppedMs > 59000);
    assert.equal(clock.consume(60001), 0);
    assert.throws(() => clock.consume(Infinity), TypeError);
});
test('bundled standalone includes HUD glyph data, hardware colour-RAM palette, clock, and parses as JS', () => {
    const html = readFileSync(new URL('../play.html', import.meta.url), 'utf8');
    const body = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
    assert.ok(body, 'built HTML should contain a standalone script');
    for (const needle of ['function defenderHardwarePalette', 'function installHudSourceData',
        'function createSourceFrameClock', 'function createDefa7HudRoutines', 'function createDefa7ScoreDisplayRoutines'])
        assert.ok(body.includes(needle), `missing bundled source function ${needle}`);
    assert.match(body, /presentFrame\(ctx,\s*lab\.video,\s*lab\.ram\)/);
    assert.doesNotThrow(() => new Script(body));
    const nodes = new Map();
    const ctx = { putImageData() {
        }, fillRect() {
        }, beginPath() {
        }, moveTo() {
        }, lineTo() {
        }, stroke() {
        }, arc() {
        }, fill() {
        }, fillText() {
        }, createImageData(w, h) {
            return { data: new Uint8ClampedArray(w * h * 4) };
        } };
    const node = id => {
        if (!nodes.has(id))
            nodes.set(id, { textContent: '', onclick: null, addEventListener() {
                }, getAttribute() {
                    return null;
                }, getContext() {
                    return ctx;
                } });
        return nodes.get(id);
    };
    const vm = createContext({ document: { getElementById: node, querySelectorAll() {
                return [];
            } }, window: { addEventListener() {
            } }, requestAnimationFrame() {
        } });
    assert.doesNotThrow(() => new Script(body).runInContext(vm, { timeout: 5000 }));
    assert.equal(new Script('lab.STATE().smartBombs').runInContext(vm), 3);
    assert.equal(new Script('lab.ram.read8(0xc009)').runInContext(vm), 0xff);
});
test('source wave transitions install the next WCTAB terrain shade into the real hardware latch', () => {
    const h = createFlightHarness();
    const clearWave = () => {
        for (const n of ['LNDCNT', 'LNDRES', 'TIECNT', 'PRBCNT', 'SWCNT', 'SCZCNT', 'SCZRES'])
            h.ram.write8(a(h, n), 0);
    };
    for (let w = 2; w <= 5; w++) {
        clearWave();
        advance(h, 190);
        assert.equal(h.WAVE_STATE().wave, w);
        assert.equal(h.ram.read8(a(h, 'PCRAM') + 5), WCTAB[(w - 1) & 7]);
        assert.equal(h.ram.read8(0xc005), WCTAB[(w - 1) & 7]);
    }
});
test('Smart Bomb source PCRAM inversion is now visible in browser DAC after original IRQ latch', () => {
    const h = createFlightHarness({ infiniteSmartBombs: true });
    advance(h, 75);
    assert.equal(h.ram.read8(0xc000), 0);
    assert.equal(h.SMART_BOMB(), true);
    h.INPUT({ smartBomb: true });
    h.STEP();
    assert.equal(h.ram.read8(a(h, 'PCRAM')), 0xff, 'source SBMBX0 changed staged colour');
    assert.equal(h.ram.read8(0xc000), 0, 'latch not updated mid IRQ');
    h.STEP();
    assert.equal(h.ram.read8(0xc000), 0xff, 'next original IRQ copied the flash colour');
    assert.deepEqual(defenderHardwarePalette(h.ram)[0], [255, 255, 255]);
    h.STEP();
    h.STEP();
    assert.equal(h.ram.read8(0xc000), 0, 'second palette flash inversion returned to black');
    assert.equal(h.STATE().smartBombs, Infinity);
});
test('finite Smart Bomb option erases third original HUD icon when charge count falls from 3 to 2', () => {
    const h = createFlightHarness({ infiniteSmartBombs: false });
    advance(h, 100);
    assert.deepEqual([h.video.read8(0x2923), h.video.read8(0x2924), h.video.read8(0x2925)], [0x90, 0x09, 0x90]);
    assert.equal(h.SMART_BOMB(), true);
    h.INPUT({ smartBomb: true });
    h.STEP();
    assert.equal(h.STATE().smartBombs, 2);
    assert.deepEqual([h.video.read8(0x2923), h.video.read8(0x2924), h.video.read8(0x2925)], [0, 0, 0]);
    assert.deepEqual([h.video.read8(0x291b), h.video.read8(0x291c), h.video.read8(0x291d)], [0x90, 0x09, 0x90]);
});
