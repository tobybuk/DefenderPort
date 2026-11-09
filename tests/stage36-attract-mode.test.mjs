/** Stage 36: original AMODE1 source-derived startup/attract integration.
 * Preserve original source drawing, continuous demo and explicit start boundary;
 * a passing in-memory test alone is not proof of browser pixels (Chromium is
 * additionally checked for the standalone artefact before release).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script, createContext } from 'node:vm';
import { LGOTAB, DEFDAT, DEFNNN, AMODE_ENEMIES } from '../original/amode1-attract-data.js';
import { createAmode1Attract } from '../original/amode1-attract.js';
function advance(a, n) {
    let s;
    for (let i = 0; i < n; i++)
        s = a.STEP();
    return s;
}
function countNonzero(video, start, width, height) {
    let n = 0;
    for (let c = 0; c < width; c++)
        for (let row = 0; row < height; row++)
            n += video.read8(start + c * 256 + row) !== 0;
    return n;
}
test('original AMODE1 LGOTAB and compressed DEFDAT are source data, not browser-drawn substitute text', () => {
    assert.equal(LGOTAB[0], 0xfe, 'source HYPERC cursor control');
    assert.equal(LGOTAB.at(-1), 0xfd, 'source QUIT sentinel');
    assert.ok(LGOTAB.length > 300);
    assert.ok(DEFDAT.length > 250);
    const picture = DEFNNN();
    assert.equal(picture.length, 60 * 24, 'DEFNNN source 60×24 column-major packed bytes');
    assert.ok(picture.filter(c => c !== 0).length > 200, 'source bitmap contains large source-derived DEFENDER logo');
    assert.ok(picture.includes(0xcc) && picture.includes(0x22), 'all original logo colour groups decoded');
});
test('AMODES first presents the animated Williams line art and source-compressed Defender lettering', () => {
    const a = createAmode1Attract();
    assert.equal(a.STATE().page, 'presentation');
    assert.equal(a.STATE().step, 'LOGO0');
    advance(a, 330);
    assert.equal(a.STATE().step, 'PRES', 'original LGOTAB byte stream eventually completes');
    assert.ok(countNonzero(a.video, 0x3090, 60, 24) > 200, 'DEFNNN writes large original logo to framebuffer');
    assert.ok(countNonzero(a.video, 0x3a3f, 25, 12) > 15, 'Williams cursive strokes appear in original framebuffer');
    assert.equal(a.STATE().objects.length, 0, 'attract presentation must not allocate live game enemies');
});
test('HALDIS shows original factory-default ROMC8 score tables, not invented entries', () => {
    const a = createAmode1Attract();
    advance(a, 1040);
    assert.equal(a.STATE().page, 'highscores');
    assert.equal(a.STATE().step, 'HALD3');
    assert.equal(a.STATE().objects.length, 0);
    assert.ok(countNonzero(a.video, 0x3854, 42, 8) > 25, 'HALL OF FAME drawn in source video memory');
    assert.ok(countNonzero(a.video, 0x1886, 45, 80) > 40, 'original ROMC8 scores drawn into the left table');
});
test('LEDRET scripted rescue scene includes original astronaut, ship, lander and an actual original scanner', () => {
    const a = createAmode1Attract();
    advance(a, 1360);
    assert.equal(a.STATE().page, 'instructions');
    const types = a.STATE().objects.map(x => x.picture);
    assert.ok(types.includes('ASTP1'));
    assert.ok(types.includes('PLAPIC'));
    assert.ok(types.includes('LNDP1'));
    assert.ok(countNonzero(a.video, 0x4330, 20, 8) > 0, 'TEXTP initially writes only original SCANNER heading');
    assert.equal(countNonzero(a.video, 0x1c70, 20, 8), 0, 'source TEXPTR does not permit LANDER until first AMOD11/BMODE2');
});
test('the scripted AMOD12/AMOD10/AMOD11 enemy sequence introduces all six original enemy types', () => {
    const a = createAmode1Attract();
    const seen = new Set();
    let demos = 0;
    for (let i = 0; i < 3700; i++) {
        const st = a.STEP();
        if (st.page === 'instructions') {
            demos++;
            for (const object of st.objects)
                seen.add(object.picture);
        }
    }
    for (const record of AMODE_ENEMIES)
        assert.ok(seen.has(record.picture), 'AMODE1 attract must display ' + record.name + ' from source');
    assert.ok(seen.has('ASTP1') && seen.has('PLAPIC'));
    assert.ok(demos > 1500, 'demo does not instantly jump to a fake end screen');
});
test('AMODES attract demonstration completes and loops back to original logo', () => {
    const a = createAmode1Attract();
    let returns = 0, seenDemo = false, last = 'presentation';
    for (let i = 0; i < 4800; i++) {
        const st = a.STEP();
        if (st.page === 'instructions')
            seenDemo = true;
        if (st.page === 'presentation' && last === 'instructions')
            returns++;
        last = st.page;
    }
    assert.equal(seenDemo, true);
    assert.ok(returns >= 1, 'completed source demonstration returns to logo');
    assert.equal(a.STATE().objects.length === 0 || a.STATE().page === 'instructions', true);
});
test('standalone boots into attract and START/Enter transfer control to live source wave; WATCH DEMO resets it', () => {
    const html = readFileSync(new URL('../play.html', import.meta.url), 'utf8');
    const body = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
    assert.ok(body && body.includes('createAmode1Attract'));
    const events = new Map(), elements = new Map();
    const draw = { putImageData() {
        }, createImageData(w, h) {
            return { data: new Uint8ClampedArray(w * h * 4) };
        }, fillRect() {
        }, beginPath() {
        }, fill() {
        }, moveTo() {
        }, lineTo() {
        }, stroke() {
        }, arc() {
        }, fillText() {
        } };
    const get = id => {
        if (!elements.has(id))
            elements.set(id, { textContent: '', onclick: null, addEventListener() {
                }, getAttribute() {
                    return null;
                }, getContext() {
                    return draw;
                } });
        return elements.get(id);
    };
    const sandbox = createContext({ document: { getElementById: get, querySelectorAll() {
                return [];
            } }, window: { addEventListener(type, fn) {
                events.set(type, fn);
            } }, requestAnimationFrame() {
        } });
    new Script(body).runInContext(sandbox, { timeout: 5000 });
    assert.equal(new Script('mode').runInContext(sandbox), 'power-off');
    // This legacy test focuses on attract and start controls; the ROMF8/RORAOK
    // power-on sequence has its own source-based tests. Begin it explicitly.
    new Script("boot.RESET();mode='boot';running=true; for(let n=0;n<1500 && mode==='boot';n++)step();draw();").runInContext(sandbox, { timeout: 12000 });
    assert.match(get('humanReadout').textContent, /AMODE1.SRC/);
    new Script('for(let i=0;i<300;i++)step(); draw();').runInContext(sandbox, { timeout: 8000 });
    assert.equal(new Script('mode').runInContext(sandbox), 'attract');
    assert.equal(new Script('lab.WAVE_STATE().ufoCount').runInContext(sandbox), 0);
    new Script("mode='attract'; cabinet.COIN('left'); attract.SET_CREDITS(cabinet.credits); refreshCabinetUI();").runInContext(sandbox);
    get('startGame').onclick();
    assert.equal(new Script('mode').runInContext(sandbox), 'playing');
    assert.match(get('waveReadout').textContent, /WAVE 1.*LANDERS 5 active.*BAITERS 0/);
    assert.match(get('humanReadout').textContent, /ASTRONAUTS:\s*10/);
    assert.equal(new Script('lab.STATE().infiniteSmartBombs').runInContext(sandbox), false);
    get('watchDemo').onclick();
    assert.equal(new Script('mode').runInContext(sandbox), 'attract');
    new Script("cabinet.COIN('left');attract.SET_CREDITS(cabinet.credits);").runInContext(sandbox);
    events.get('keydown')({ code: 'Enter', preventDefault() {
        } });
    assert.equal(new Script('mode').runInContext(sandbox), 'playing');
    assert.match(get('waveReadout').textContent, /WAVE 1.*BAITERS 0/);
});
