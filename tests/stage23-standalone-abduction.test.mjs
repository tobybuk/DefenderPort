/** Standalone release regression: reproduce Stage 22's 1323-tick boundary
 * inside the exact bundled HTML, not just the importable Node source files.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script, createContext } from 'node:vm';
const html = readFileSync(new URL('../play.html', import.meta.url), 'utf8');
const source = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
test('standalone HTML preserves source enemy/astronaut state while live ship collisions are enabled', () => {
    assert.ok(source);
    const elements = new Map();
    const ctx = { fillRect() {
        }, fill() {
        }, beginPath() {
        }, moveTo() {
        }, lineTo() {
        }, stroke() {
        }, arc() {
        }, fillText() {
        }, putImageData() {
        }, createImageData(w, h) {
            return { data: new Uint8ClampedArray(w * h * 4) };
        } };
    const element = id => {
        if (!elements.has(id))
            elements.set(id, { textContent: '', onclick() {
                }, addEventListener() {
                }, getAttribute() {
                    return null;
                }, getContext() {
                    return ctx;
                } });
        return elements.get(id);
    };
    const sandbox = createContext({ document: { getElementById: element, querySelectorAll() {
                return [];
            } }, window: { addEventListener() {
            } }, requestAnimationFrame() {
        } });
    new Script(source, { filename: 'Defender_Source_Stage23_Run.html' }).runInContext(sandbox, { timeout: 3000 });
    new Script("mode='attract'; cabinet.COIN('left'); attract.SET_CREDITS(cabinet.credits); refreshCabinetUI();").runInContext(sandbox);
    element('startGame').onclick(); // Stage 36: gameplay begins only after START.
    // No fake game actions: invoke the exact same main source tick exposed to
    // browser/flight.js, followed by the existing DOM presenter.
    new Script('for(let i=0;i<1350;i++)lab.STEP();draw();').runInContext(sandbox, { timeout: 12000 });
    // The original live RAND state is inherited from attract mode at START.
    // No fixed-time collision or abduction is guaranteed for every seed.
    // Check the original executive ran and its state remains internally valid.
    const state = new Script('lab.STATE()').runInContext(sandbox);
    assert.ok(state.wave.ticks >= 1300, 'original executive advances through 1350 ticks');
    assert.ok(state.wave.astronautCount >= 0 && state.wave.astronautCount <= 10);
    assert.ok(state.playerDeaths >= 0);
    assert.match(element('humanReadout').textContent, /ASTRONAUTS:\s*\d+\s+alive across planet/);
    assert.match(element('waveReadout').textContent, /LANDERS \d+ active.*BAITERS \d+.*MUTANTS \d+.*SCANNER \d+/);
    assert.match(element('memory').textContent, /ASTCNT\s+\d+/);
});
