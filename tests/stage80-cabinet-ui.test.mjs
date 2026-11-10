/** Stage 80: cabinet controls and demo comfort.
 *  - START needs a credit (tested in stage55-operator-boot).
 *  - One always-visible sound control; volume defaults to 100% and is saved.
 *  - Escape ends the current game or demo and returns to the attract mode.
 *  - The diagnostics panel is gone; developer tools live in the menu.
 *  - "DEMO" flashes above the spare ships for the whole AI demo, at 20%.
 *  - The AI demo limits how soon the ship may turn round again.
 *  - The sound board translation matches the original VSNDRM1 code run on an
 *    independent 6800 emulator, DAC write for DAC write.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { Script, createContext } from 'node:vm';
import { createSourceTextBanner } from '../browser/cabinet-boot.js';
import { createFlightHarness } from '../demo/flight-harness.js';
import { SoundBoard } from '../original/VSNDRM1-synth.js';
import { assemble, runCommand } from '../tools/m6800-reference.mjs';

const html = readFileSync(new URL('../play.html', import.meta.url), 'utf8');
const code = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
const flightSrc = readFileSync(new URL('../browser/flight.js', import.meta.url), 'utf8');
// The upstream assembly is fetched by `npm run source:fetch` (git-ignored).
const ROM_SOURCE = new URL('../source/defender/src/vsndrm1.src', import.meta.url);
const needsSource = existsSync(ROM_SOURCE) ? {} : { skip: 'upstream source not fetched (npm run source:fetch)' };

function createBrowser(saved = new Map()) {
    const nodes = new Map(), events = new Map();
    const context2d = { fillRect() {}, fillText() {}, fill() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, arc() {}, putImageData() {},
        createImageData(w, h) { return { data: new Uint8ClampedArray(w * h * 4) }; } };
    const node = id => {
        if (!nodes.has(id)) nodes.set(id, { id, textContent: '', disabled: false, hidden: false, open: false, onclick: null, onchange: null, oninput: null,
            style: {}, children: [], listeners: [], dataset: {}, value: '',
            addEventListener(type, cb) { this.listeners.push({ type, cb }); }, getContext() { return context2d; }, getAttribute() { return null; },
            setAttribute() {}, focus() {}, append(...kids) { this.children.push(...kids); }, replaceChildren() { this.children = []; },
            classList: { toggle() {}, add() {}, remove() {} } });
        return nodes.get(id);
    };
    const document = { body: { classList: { toggle() {}, add() {}, remove() {} } }, getElementById: node, querySelectorAll() { return []; },
        createElement: tag => ({ ...node('created-' + Math.random()), tagName: tag, children: [], append(...kids) { this.children.push(...kids); }, setAttribute() {} }),
        addEventListener() {} };
    const window = { localStorage: { getItem: k => saved.get(k) ?? null, setItem: (k, v) => saved.set(k, v) }, addEventListener: (type, cb) => events.set(type, cb) };
    const sandbox = createContext({ window, document, requestAnimationFrame() {} });
    new Script(code).runInContext(sandbox, { timeout: 5000 });
    const evalJS = source => new Script(source).runInContext(sandbox, { timeout: 12000 });
    const key = code => events.get('keydown')({ code, repeat: false, target: {}, preventDefault() {} });
    return { node, evalJS, events, saved, key };
}
async function toAttract(b) {
    await b.node('powerOnCabinet').onclick();
    b.evalJS('for(let i=0;i<1500 && mode==="boot";i++)step();');
    assert.equal(b.evalJS('mode'), 'attract');
}

test('page: sound control on the toolbar, developer tools in the menu, no diagnostics panel', () => {
    const toolbar = html.slice(html.indexOf('class="cabinet-toolbar"'), html.indexOf('id="cabinetMenu"'));
    assert.match(toolbar, /id="soundQuick"/);
    assert.match(toolbar, /id="audioVolume"[^>]*value="100"/);
    const menu = html.slice(html.indexOf('id="cabinetMenu"'), html.indexOf('id="cabinetStatus"'));
    for (const id of ['startGame', 'watchDemo', 'hallTest', 'scoreTest', 'pause', 'step', 'reset', 'scannerTest'])
        assert.match(menu, new RegExp(`id="${id}"`), id + ' is in the menu');
    assert.doesNotMatch(html, /class="advanced-tools"|class="advanced-notes"|Project notes/);
    assert.doesNotMatch(html, /id="audioToggle"|id="audioLabel"/);
});

test('volume defaults to 100% and the setting is saved in browser storage', async () => {
    const b = createBrowser();
    assert.equal(b.evalJS('audio.state().volume'), 1);
    assert.equal(b.evalJS('audio.state().muted'), false);
    b.node('audioVolume').value = '40';
    b.node('audioVolume').oninput();
    b.node('soundQuick').onclick(); // mute
    assert.equal(b.evalJS('audio.state().muted'), true);
    assert.equal(b.node('soundQuick').textContent, '🔇');
    const again = createBrowser(new Map(b.saved));
    assert.equal(again.evalJS('audio.state().volume'), 0.4);
    assert.equal(again.evalJS('audio.state().muted'), true);
    assert.equal(again.node('audioVolume').value, '40');
});

test('Escape ends a game, or the AI demo, and returns to the attract mode', async () => {
    const b = createBrowser();
    await toAttract(b);
    b.node('coinInsert').onclick();
    b.node('startGameTop').onclick();
    assert.equal(b.evalJS('mode'), 'playing');
    b.evalJS('for(let i=0;i<30;i++)step();');
    b.key('Escape');
    assert.equal(b.evalJS('mode'), 'attract');
    b.node('watchAI').onclick();
    assert.equal(b.evalJS('mode'), 'demo-ai');
    b.key('Escape');
    assert.equal(b.evalJS('mode'), 'attract');
    b.key('Escape'); // nothing to end
    assert.equal(b.evalJS('mode'), 'attract');
});

test('starting a game from the AI demo clears the sound gate at once, so no later reset cuts ST1SND', async () => {
    const b = createBrowser();
    await toAttract(b);
    b.node('coinInsert').onclick();
    b.node('watchAI').onclick();
    b.evalJS('for(let i=0;i<5;i++)step();refreshCabinetUI();');
    assert.equal(b.evalJS('demoSoundGated'), true);
    b.node('startGameTop').onclick();
    assert.equal(b.evalJS('mode'), 'playing');
    assert.equal(b.evalJS('demoSoundGated'), false, 'cleared inside START, before SNDSEQ sends ST1SND');
    assert.match(flightSrc, /mode = 'playing';\n[^]*?gateDemoSound\(\{ reset: false \}\);/);
});

test('"DEMO" sits above the spare ships, left of the scanner, and flashes at 20% for the whole demo', () => {
    const banner = createSourceTextBanner('DEMO', 10, { left: 6, span: 41 });
    const xs = banner.lit.map(p => p[0] - 12), ys = banner.lit.map(p => p[1] - 7); // canvas coordinates
    assert.ok(Math.min(...xs) >= 0 && Math.max(...xs) <= 81, 'inside the panel left of the scanner (x 0..81)');
    assert.ok(Math.min(...ys) >= 2 && Math.max(...ys) <= 11, 'above the spare-ship icons (from y 13)');
    const centre = (Math.min(...xs) + Math.max(...xs)) / 2;
    assert.ok(Math.abs(centre - 41) <= 3, `centred over the panel (${centre})`);
    assert.match(flightSrc, /createSourceTextBanner\('DEMO', 10, \{ left: 6, span: 41 \}\)/);
    assert.match(flightSrc, /DEMO_BANNER_ALPHA=0\.2/);
    assert.doesNotMatch(flightSrc, /DEMO_BANNER_MS/, 'no longer limited to the first seconds');
});

test('AI demo: ordinary turns wait 45 ticks; only duels (30) and collision dodges (24) turn sooner', () => {
    const a = flightSrc.indexOf('function createAttractPilot()'), b = flightSrc.indexOf('const attractPilot=createAttractPilot();', a);
    const create = new Script(flightSrc.slice(a, b) + ';createAttractPilot').runInContext(createContext({}));
    const h = createFlightHarness({ infiniteSmartBombs: false, playerCollisions: true, sourceCabinetInput: true });
    h.RESET();
    const p = create();
    let last = -1e9, turns = 0;
    for (let t = 0; t < 4000 && !h.STATE().gameOver; t++) {
        const c = p.sample(h.STATE(), h.ENEMY_STATE(), h.ASTRONAUT_STATE(), h.ram, h.Layout);
        if (c.reverse) {
            const gap = t - last, why = p.state().reason;
            const min = /SHIELD/.test(why) ? 24 : /MUTANT/.test(why) ? 30 : 45;
            assert.ok(gap >= min, `turn after ${gap} ticks (${why}), minimum ${min}`);
            last = t; turns++;
        }
        h.INPUT(c); h.STEP();
    }
    assert.ok(turns > 10, 'still hunts in both directions');
});

test('sound board translation = original VSNDRM1 code on an independent 6800, for every command', needsSource, () => {
    const image = assemble();
    const cycles = 400000; // ~0.45 s of board time per command
    for (let command = 1; command < 32; command++) {
        const pia = (~command) & 0x3f;
        const ref = runCommand(pia, cycles, { image }).writes;
        const board = new SoundBoard({ sampleRate: 48000 });
        board.sound = 0; // 6821 reset: the DAC latch starts at zero
        const got = [];
        const dac = board.dac.bind(board);
        board.dac = v => { got.push([board.c, v & 255]); dac(v); };
        board.irq(pia);
        board.render(new Float32Array(Math.ceil(cycles / board.cps)));
        const trans = got.filter(([t]) => t <= cycles);
        const n = Math.min(ref.length, trans.length);
        assert.ok(Math.abs(ref.length - trans.length) <= 1, `command ${command}: ${ref.length} vs ${trans.length} writes`);
        for (let i = 0; i < n; i++) {
            assert.equal(trans[i][1], ref[i][1], `command ${command} write ${i} value`);
            assert.ok(Math.abs(trans[i][0] - ref[i][0]) <= 6, `command ${command} write ${i} at cycle ${trans[i][0]} vs ${ref[i][0]}`);
        }
    }
});

test('the start sound (ST1SND, command $0A) is the original 256-echo SV3 GWAVE, exactly', needsSource, () => {
    const { writes } = runCommand((~0x0a) & 0x3f, 3_000_000);
    assert.equal(writes.length, 256 * 72, '256 echoes of the 72-sample GS72 wave');
    assert.equal(writes.at(-1)[0], 2_800_809, 'ends after 2.80 million E cycles (3.13 s)');
});
