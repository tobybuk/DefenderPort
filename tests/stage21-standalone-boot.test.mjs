/** Stage 21: actual single-file play.html must parse and boot with fake DOM.
 * This catches the exact class of regression users reported in Stage 17:
 * valid source modules or tests are NOT enough if the bundled HTML has a
 * syntax error, missing module, or crashes before the first frame.
 * The stub does not assert real Chromium graphics correctness; source-video
 * pixel verification is performed by stage21-astronaut-population tests.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script, createContext } from 'node:vm';
const html = new URL('../play.html', import.meta.url);
const source = readFileSync(html, 'utf8');
const match = source.match(/<script>([\s\S]*?)<\/script>/);
test('the released single-file HTML contains exactly one fully self-contained runnable script', () => {
    assert.ok(match?.[1], 'standalone script is present');
    assert.ok(!source.includes('src="browser/flight.js"'), 'must run offline, not external modules');
    assert.ok(match[1].includes('function createDefa7AstronautStartRoutines('), 'ASTST module really included in standalone');
    assert.doesNotThrow(() => new Script(match[1], { filename: 'Defender_Source_Stage22_Run.html' }));
});
test('released standalone actually starts, creates video/frame data and displays astronaut count', () => {
    assert.ok(match?.[1]);
    const elements = new Map();
    const ctx = { fillRect() {
        }, fill() {
        }, beginPath() {
        }, moveTo() {
        }, lineTo() {
        }, stroke() {
        }, arc() {
        }, fillText() {
        },
        putImageData() {
        }, createImageData(w, h) {
            return { data: new Uint8ClampedArray(w * h * 4) };
        } };
    const element = (id) => {
        if (!elements.has(id))
            elements.set(id, { textContent: '', onclick: null, addEventListener() {
                },
                getAttribute() {
                    return null;
                }, getContext() {
                    return ctx;
                } });
        return elements.get(id);
    };
    const document = { getElementById: element, querySelectorAll() {
            return [];
        } };
    const window = { addEventListener() {
        } };
    const context = createContext({ document, window, requestAnimationFrame() {
        } });
    assert.doesNotThrow(() => new Script(match[1]).runInContext(context, { timeout: 3000 }));
    assert.equal(new Script('mode').runInContext(context), 'power-off', 'power must be activated before ROMF8 RESET');
    new Script("mode='attract'; cabinet.COIN('left'); attract.SET_CREDITS(cabinet.credits); refreshCabinetUI();").runInContext(context);
    element('startGame').onclick(); // Stage 36: visitor must start the game explicitly
    assert.match(element('humanReadout').textContent, /ASTRONAUTS:\s*10\s+alive across planet.*\d+\s+visible in playfield/);
    // Source START inherits the live attract-mode SEED, so the camera-visible
    // astronaut count can legitimately vary between paid games.
    assert.match(element('waveReadout').textContent, /WAVE 1.*LANDERS 5 active, 10 in reserve.*BAITERS 0.*MUTANTS 0.*SCANNER 15/);
    assert.match(element('memory').textContent, /ASTCNT\s+10/);
    assert.equal(typeof element('reset').onclick, 'function');
    assert.doesNotThrow(() => element('reset').onclick());
    assert.match(element('humanReadout').textContent, /ASTRONAUTS:\s*10/);
    assert.match(element('waveReadout').textContent, /LANDERS 5 active, 10 in reserve.*BAITERS 0/);
});
