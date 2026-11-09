/**
 * Stage 25: verify the exact standalone HTML, not just ESM modules.
 * A fake DOM proves the single-file bundle boots and its UI callbacks call
 * native source routines. This is not a substitute for a physical browser.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script, createContext } from 'node:vm';
const html = readFileSync(new URL('../play.html', import.meta.url), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
function boot() {
    const nodes = new Map();
    const canvas = { fillRect() {
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
    const get = id => {
        if (!nodes.has(id))
            nodes.set(id, { textContent: '', onclick: null, getAttribute() {
                    return null;
                }, addEventListener() {
                }, getContext() {
                    return canvas;
                } });
        return nodes.get(id);
    };
    const sandbox = createContext({ document: { getElementById: get, querySelectorAll() {
                return [];
            } }, window: { addEventListener() {
            } }, requestAnimationFrame() {
        } });
    new Script(script, { filename: 'Defender_Source_Stage25_Run.html' }).runInContext(sandbox, { timeout: 4000 });
    return { sandbox, get };
}
test('release contains all five translated gameplay areas and is valid standalone JavaScript', () => {
    assert.ok(script);
    for (const symbol of ['createDefa7LaserRoutines', 'createDefb6RescuePointsRoutines', 'createSamexap7AppearanceRoutines', 'createDefb6TerrainBlowRoutines', 'createDefa7WaveExecutive'])
        assert.ok(script.includes(`function ${symbol}(`), `${symbol} omitted from standalone`);
    assert.doesNotThrow(() => new Script(script, { filename: 'Defender_Source_Stage25_Run.html' }));
});
test('FIRE button and keyboard dispatch actually create original source laser processes', () => {
    const { sandbox, get } = boot();
    new Script("mode='attract'; cabinet.COIN('left'); attract.SET_CREDITS(cabinet.credits); refreshCabinetUI();").runInContext(sandbox);
    get('startGame').onclick(); // Stage 36 starts in original attract mode.
    assert.equal(typeof get('laserSound').onclick, 'function');
    get('laserSound').onclick();
    const result = new Script('lab.STEP();lab.ram.read8(lab.Layout.at("LFLG"))').runInContext(sandbox, { timeout: 2000 });
    assert.equal(result, 1);
    const command = new Script('lab.WAVE_STATE().landerCount').runInContext(sandbox, { timeout: 2000 });
    assert.equal(command, 5, 'firing does not replace source first wave');
});
test('released HTML can play original wave transition and has native rescue/terrain executors', () => {
    const { sandbox, get } = boot();
    new Script("mode='attract'; cabinet.COIN('left'); attract.SET_CREDITS(cabinet.credits); refreshCabinetUI();").runInContext(sandbox);
    get('startGame').onclick(); // Source wave is started explicitly in Stage 36.
    const state = new Script(`
 for(const key of ['LNDCNT','LNDRES','TIECNT','PRBCNT','SWCNT','SCZCNT','SCZRES'])
   lab.ram.write8(lab.Layout.at(key),0);
 for(let n=0;n<210;n++)lab.STEP();
 draw();
 ({wave:lab.WAVE_STATE().wave,ties:lab.ram.read8(lab.Layout.at('TIECNT')),probes:lab.ram.read8(lab.Layout.at('PRBCNT')),score:lab.STATE().scoreBCD.join(','),land:lab.WAVE_STATE().landerCount})
 `).runInContext(sandbox, { timeout: 9000 });
    assert.equal(state.wave, 2);
    assert.equal(state.ties, 3);
    assert.equal(state.probes, 1);
    assert.equal(state.land, 5);
    assert.equal(state.score, '0,0,16,0');
    assert.match(get('waveReadout').textContent, /WAVE 2/);
});
