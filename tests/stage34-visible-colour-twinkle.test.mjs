/**
 * Stage 34 display-level regressions for bugs that 417 Stage 33 tests missed.
 *
 * These tests must inspect the final DISPLAYED RGB channels at the actual star
 * and Bomber sprite positions, not merely SCOL/PCRAM counters. They also keep
 * separate claims about the pinned 6809 source and the provisional host-only
 * SBLNK cadence (no normal-play call site appears in pinned DEFA7.SRC).
 *
 * References: DEFA7.SRC 1936-79, 2096-98, 2158-65 and DEFB6.SRC 1192-1208;
 * MAME williams_v.cpp palette_init 316-336, BBGGGRRR and resistor values.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFlightHarness } from '../demo/flight-harness.js';
import { PHR6_LAYOUT as L } from '../runtime/phr6-layout.js';
import { defenderDacRGB, defenderHardwarePalette } from '../browser/defender-palette.js';
import { getPixel, presentFrame, framePixels, DEFENDER_VISIBLE, DIAGNOSTIC_RGB } from '../browser/video-presenter.js';
import { TCTAB } from '../original/defb6-colour-processes.js';
const a = name => L.at(name);
const rgbAt = (h, x, y) => defenderHardwarePalette(h.ram)[getPixel(h.video, x, y, { left: 0, top: 0 })];
test('Williams original BBGGGRRR resistor-weighted DAC has canonical channel extremes', () => {
    assert.deepEqual(defenderDacRGB(0), [0, 0, 0]);
    assert.deepEqual(defenderDacRGB(0x07), [255, 0, 0]);
    assert.deepEqual(defenderDacRGB(0x38), [0, 255, 0]);
    assert.deepEqual(defenderDacRGB(0xc0), [0, 0, 255]);
    assert.deepEqual(defenderDacRGB(0xff), [255, 255, 255]);
    // Original 1200/560/330 and 560/330-ohm paths are NOT ideal linear steps.
    const redLSB = 255 / (1 + 1200 / 560 + 1200 / 330);
    const blueMSB = 255 * (1 / 330) / ((1 / 560) + (1 / 330));
    assert.deepEqual(defenderDacRGB(0x81), [Math.round(redLSB), 0, Math.round(blueMSB)]);
    assert.notDeepEqual(defenderDacRGB(0x81), [Math.round(255 / 7), 0, 170], 'regression: Stage 33 assumed an ideal linear DAC');
});
test('STOUT source stars now visibly brighten/dim in the real RGB game framebuffer', () => {
    const h = createFlightHarness({ sourceCabinetInput: true, infiniteSmartBombs: true, playerCollisions: false });
    const prev = Array(16).fill(null), first = Array(16).fill(null);
    const switched = new Set(), starTransitions = Array(16).fill(0);
    let brightnessToggles = 0, colourToggles = 0;
    for (let tick = 0; tick < 240; tick++) {
        h.STEP();
        for (let i = 0; i < 16; i++) {
            const R = a('SMAP') + i * a('SLGTH');
            const xb = h.ram.read8(R + a('SX')), y = h.ram.read8(R + a('SY'));
            // STOUT writes either the high or low nibble depending on BGL phase.
            const phase = (h.ram.read8(a('BGL') + 1) & 0x40) ? 0 : 1;
            const x = xb * 2 + phase;
            if (x < 12 || x >= 304 || y < 7 || y >= 247)
                continue;
            const display = rgbAt(h, x, y), key = display.join(',');
            const bright = Math.max(...display) >= 150;
            if (prev[i]) {
                if (prev[i].key !== key) {
                    colourToggles++;
                    starTransitions[i]++;
                    switched.add(i);
                }
                if (prev[i].bright !== bright)
                    brightnessToggles++;
            }
            prev[i] = { key, bright };
            first[i] ??= key;
        }
    }
    // Stage 33's quarter-speed odd-only call produces ~3 brightness transitions
    // across 240 updates; visibly dead stars despite SCOL memory tests passing.
    assert.ok(brightnessToggles >= 15, `not enough visible bright/dim star twinkles: ${brightnessToggles}`);
    assert.ok(switched.size >= 10, `too few visible independently changing stars: ${switched.size}`);
    assert.ok(starTransitions.filter(n => n >= 2).length >= 9);
    assert.equal(h.STATE().smartBombs, Infinity);
});
test('original Bomber pixels D/E/F show all three colour phases in the shared video framebuffer', () => {
    const h = createFlightHarness({ sourceCabinetInput: true, infiniteSmartBombs: true, playerCollisions: false });
    const { object: X } = h.tie.TIEST(1)[0];
    // Move this SOURCE-created Bomber into a controlled on-screen viewport for
    // optical inspection. This is a TEST FIXTURE, not a gameplay spawn override.
    h.ram.write16(X + a('OX16'), 0x1800);
    h.ram.write8(X + a('OY16'), 0x70);
    h.ram.write16(X + a('OXV'), 0);
    h.ram.write8(a('TIECNT'), 1);
    const phases = new Set(), sampled = new Map();
    for (let tick = 0; tick < 110; tick++) {
        h.STEP();
        const addr = h.ram.read16(X + a('OBJX'));
        if (!addr)
            continue;
        const pens = new Map();
        for (let dx = 0; dx < 4; dx++)
            for (let dy = 0; dy < 8; dy++)
                for (let nib = 0; nib < 2; nib++) {
                    const x = ((addr >>> 8) + dx) * 2 + nib, y = (addr & 255) + dy;
                    const idx = getPixel(h.video, x, y, { left: 0, top: 0 });
                    if (idx >= 13 && idx <= 15 && !pens.has(idx))
                        pens.set(idx, { x, y });
                }
        if (pens.size !== 3)
            continue;
        const pal = Array.from({ length: 3 }, (_, i) => h.ram.read8(0xc000 + 13 + i));
        const phase = Array.from({ length: 3 }, (_, i) => TCTAB.slice(i * 3, i * 3 + 3).every((v, j) => v === pal[j]) ? i : -1).find(i => i !== -1);
        if (phase === undefined)
            continue;
        phases.add(phase);
        const colours = [13, 14, 15].map(idx => rgbAt(h, pens.get(idx).x, pens.get(idx).y));
        assert.deepEqual(colours, pal.map(defenderDacRGB));
        sampled.set(phase, colours);
    }
    assert.deepEqual([...phases].sort(), [0, 1, 2], `missing displayed Bomber phases: ${[...phases]}`);
    assert.notDeepEqual(sampled.get(0), sampled.get(1));
    assert.notDeepEqual(sampled.get(1), sampled.get(2));
});
test('presentFrame MUST pass latched hardware palette as THIRD framePixels argument', () => {
    const h = createFlightHarness({ sourceCabinetInput: true, infiniteSmartBombs: true, playerCollisions: false });
    // Locate an existing nonblack video pixel, then give its colour register a
    // deliberately distinct DAC colour. This detects the Stage 29–33 regression
    // in which framePixels silently fell back to DIAGNOSTIC_RGB regardless of RAM.
    const sample = [];
    for (let tick = 0; tick < 12 && !sample.length; tick++) {
        h.STEP();
        for (let y = 7; y < 247 && !sample.length; y++)
            for (let x = 12; x < 304; x++) {
                const pen = getPixel(h.video, x, y, { left: 0, top: 0 });
                if (pen !== 0) {
                    sample.push({ x, y, pen });
                    break;
                }
            }
    }
    assert.ok(sample.length, 'expected source-drawn visible game pixels');
    const { x, y, pen } = sample[0];
    h.ram.write8(0xc000 + pen, 0xc0); // DAC full blue; distinct from diagnostic palette
    const result = { data: null };
    const fakeCtx = {
        createImageData: (width, height) => ({ data: new Uint8ClampedArray(width * height * 4) }),
        putImageData: image => {
            result.data = image.data;
        }
    };
    presentFrame(fakeCtx, h.video, h.ram);
    const idx = ((y - 7) * 292 + (x - 12)) * 4;
    const displayed = Array.from(result.data.slice(idx, idx + 3));
    assert.deepEqual(displayed, [0, 0, 255], 'presentFrame must use *actual* latched CRAM RGB');
    assert.notDeepEqual(displayed, DIAGNOSTIC_RGB[pen], 'must not fall back to diagnostic RGB');
    const direct = framePixels(h.video, DEFENDER_VISIBLE, defenderHardwarePalette(h.ram));
    assert.deepEqual(Array.from(direct.slice(idx, idx + 3)), displayed);
});
