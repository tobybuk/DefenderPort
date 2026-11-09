/**
 * Stage 26 source regression checks.
 * Assembly references: DEFA7.SRC 3153–3207 REV/SBOMB, 1316–1323 STCHK,
 * 1846–1863 GETWV, 1141–1147 START; DEFB6 TERBLO.
 * All combat tests inspect real OPTR/OTYP/OBJX/OCVECT and PSBC bytes.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script, createContext } from 'node:vm';
import { createFlightHarness } from '../demo/flight-harness.js';
const addr = (h, n) => h.Layout.at(n);
const byte = (h, n) => h.ram.read8(addr(h, n));
const set = (h, n, value) => h.ram.write8(addr(h, n), value);
const steps = (h, n) => {
    for (let t = 0; t < n; t++)
        h.STEP();
};
const waveClear = h => {
    for (const n of ['LNDCNT', 'LNDRES', 'TIECNT', 'PRBCNT', 'SWCNT', 'SCZCNT', 'SCZRES'])
        set(h, n, 0);
};
test('original START grants three Smart Bombs; source R/Space/S keyboard state is correctly encoded in PIA21', () => {
    const h = createFlightHarness();
    assert.equal(h.STATE().smartBombs, 3);
    h.INPUT({ thrust: true, reverse: true, smartBomb: true, down: true, up: true });
    assert.equal(byte(h, 'PIA21'), 0xc6, 'PIA21 bits 7/6/2/1 are source DOWN/REV/SBOMB/THRUST');
    assert.equal(byte(h, 'PIA31'), 1);
    h.INPUT({});
    assert.equal(byte(h, 'PIA21'), 0);
});
test('REV changes facing through original NPLAD and PRDISP, waits for release and never repeats while held', () => {
    const h = createFlightHarness();
    assert.equal(h.STATE().direction, 0x0300);
    h.INPUT({ reverse: true });
    assert.equal(h.REVERSE(), true);
    steps(h, 8);
    assert.equal(h.STATE().direction, 0xfd00);
    steps(h, 50);
    assert.equal(h.STATE().direction, 0xfd00, 'held REV is edge-triggered');
    assert.equal(byte(h, 'REVFLG'), 1, 'original source waits for switch release');
    assert.equal(h.REVERSE(), false, 'cannot start another REV while REVFLG set');
    h.INPUT({ reverse: false });
    steps(h, 24);
    assert.equal(byte(h, 'REVFLG'), 0);
    h.INPUT({ reverse: true });
    assert.equal(h.REVERSE(), true);
    steps(h, 6);
    assert.equal(h.STATE().direction, 0x0300, 'second distinct press flips back');
});
test('SBOMB targets only eligible visible OPTR records, awards normal score and spares humans', () => {
    const h = createFlightHarness();
    steps(h, 100);
    const humans = h.ASTRONAUT_STATE().living.map(o => o.object);
    const count = byte(h, 'LNDCNT'), before = h.STATE().scoreBCD.join();
    assert.equal(h.SMART_BOMB(), true);
    h.INPUT({ smartBomb: true });
    steps(h, 1);
    assert.equal(h.STATE().smartBombs, 2);
    assert.equal(byte(h, 'SBFLG'), 1);
    assert.ok(byte(h, 'LNDCNT') < count, 'an on-screen Lander is killed by its source vector');
    assert.notEqual(h.STATE().scoreBCD.join(), before, 'score uses original kill/BCD path');
    assert.equal(byte(h, 'ASTCNT'), 10, 'ASTCNT not affected');
    assert.deepEqual(h.ASTRONAUT_STATE().living.map(o => o.object), humans);
    steps(h, 35);
    assert.equal(h.STATE().smartBombs, 2, 'holding button does not spend multiple bombs');
    assert.equal(byte(h, 'SBFLG'), 1, 'debounce waits for release');
    h.INPUT({ smartBomb: false });
    steps(h, 26);
    assert.equal(byte(h, 'SBFLG'), 0);
});
test('SBOMB leaves appearance-stage enemies alone and blocks further activation when out of ammunition', () => {
    const h = createFlightHarness();
    const first = h.ENEMY_STATE().find(o => o.label === 'LNDP1');
    const landingCount = byte(h, 'LNDCNT');
    assert.equal(h.ram.read8(first.object + addr(h, 'OTYP')), 2, 'original appearance objects are type 2');
    assert.equal(h.SMART_BOMB(), true);
    steps(h, 1);
    assert.equal(byte(h, 'LNDCNT'), landingCount, 'cannot kill appearance-stage enemy');
    assert.equal(byte(h, 'ASTCNT'), 10);
    h.INPUT({ smartBomb: false });
    steps(h, 42);
    for (let i = 0; i < 2; i++) {
        assert.equal(h.SMART_BOMB(), true);
        steps(h, 1);
        steps(h, 42);
    }
    assert.equal(h.STATE().smartBombs, 0);
    assert.equal(h.SMART_BOMB(), false);
    steps(h, 3);
    assert.equal(byte(h, 'SBFLG'), 0);
});
test('destroyed planet stays gone in wave 2 through 4, and returns on original fifth-wave astronaut restoration', () => {
    const h = createFlightHarness();
    for (const X of h.ASTRONAUT_STATE().living.map(o => o.object))
        h.astronaut.ASTK1(X);
    steps(h, 40);
    assert.equal(h.ASTRONAUT_STATE().count, 0);
    for (let w = 2; w <= 5; w++) {
        waveClear(h);
        steps(h, 190);
        assert.equal(h.WAVE_STATE().wave, w);
        if (w < 5) {
            assert.equal(h.ASTRONAUT_STATE().count, 0, `wave ${w} retains zero humans`);
            assert.equal(h.STATE().status & 2, 2, `wave ${w} retains no-terrain status`);
            let terrainPixels = 0;
            for (let x = 8; x < 0x98; x++)
                for (let y = 0xd8; y < 0xf0; y++)
                    terrainPixels += h.video.read8((x << 8) | y) ? 1 : 0;
            assert.equal(terrainPixels, 0, `wave ${w} must not redraw bottom terrain`);
        }
        else {
            assert.equal(h.ASTRONAUT_STATE().count, 10, 'original GA4=5 restores ten humans');
            assert.equal(h.STATE().status & 2, 0, 'status re-enables terrain after restoration');
        }
    }
});
test('second wave after planet destruction preserves original Tie/Probe population and no initial Baiters', () => {
    const h = createFlightHarness();
    for (const X of h.ASTRONAUT_STATE().living.map(o => o.object))
        h.astronaut.ASTK1(X);
    steps(h, 35);
    waveClear(h);
    steps(h, 180);
    assert.equal(h.WAVE_STATE().wave, 2);
    assert.equal(byte(h, 'TIECNT'), 3);
    assert.equal(byte(h, 'PRBCNT'), 1);
    assert.equal(byte(h, 'UFOCNT'), 0);
    assert.equal(h.ASTRONAUT_STATE().count, 0);
    assert.equal(byte(h, 'LNDCNT'), 0, 'without targets all newly spawned Landers become Mutants');
    assert.ok(byte(h, 'SCZCNT') >= 5, 'source SCZS0 generated Mutants from targetless Landers');
});
test('standalone release includes smart-bomb and reverse handlers and remains parseable/bootable', () => {
    const html = readFileSync(new URL('../play.html', import.meta.url), 'utf8');
    const code = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
    assert.ok(code);
    assert.match(html, /data-key="KeyR" id="reverseButton"/);
    assert.match(html, /data-key="KeyS" id="smartBombButton"/);
    assert.match(html, /touch-action:none/);
    assert.match(html, /-webkit-touch-callout:none/);
    assert.match(code, /function createDefa7SmartBombRoutines/);
    assert.match(code, /function createDefa7ReverseRoutines/);
    assert.doesNotThrow(() => new Script(code));
    const nodes = new Map(), buttonListeners = {}, controlButtons = ['KeyR', 'KeyS'].map(k => ({
        getAttribute(name) {
            return name === 'data-key' ? k : null;
        },
        addEventListener(type, fn) {
            buttonListeners[k] ??= {};
            buttonListeners[k][type] = fn;
        }
    })), canvas = { fillRect() {
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
    const vm = createContext({ document: { getElementById: get, querySelectorAll(sel) {
                return sel === 'button' || sel === '[data-key]' ? controlButtons : [];
            } }, window: { addEventListener() {
            } }, requestAnimationFrame() {
        } });
    new Script(code, { filename: 'Stage26_Run.html' }).runInContext(vm, { timeout: 4000 });
    new Script("mode='attract'; cabinet.COIN('left'); attract.SET_CREDITS(cabinet.credits); refreshCabinetUI();").runInContext(vm);
    get('startGame').onclick(); // Stage 36 first displays Williams attract sequence.
    const state = new Script('({bombs:lab.STATE().smartBombs,direction:lab.STATE().direction})').runInContext(vm);
    assert.equal(state.bombs, 3, 'original three initial smart bombs');
    assert.equal(state.direction, 768);
    const fake = { pointerId: 17, preventDefault() {
            this.prevented = true;
        } };
    buttonListeners.KeyR.pointerdown(fake);
    new Script('for(let i=0;i<8;i++){lab.INPUT({reverse:keys.has("KeyR")});lab.STEP()}').runInContext(vm, { timeout: 2000 });
    assert.equal(new Script('lab.STATE().direction').runInContext(vm), 0xfd00);
    assert.equal(new Script('keys.has("KeyR")').runInContext(vm), true);
    buttonListeners.KeyR.pointerup(fake);
    assert.equal(new Script('keys.has("KeyR")').runInContext(vm), false);
    new Script('for(let i=0;i<22;i++){lab.INPUT({reverse:keys.has("KeyR")});lab.STEP()}').runInContext(vm, { timeout: 2000 });
    buttonListeners.KeyS.pointerdown(fake);
    new Script('lab.INPUT({smartBomb:keys.has("KeyS")});lab.STEP()').runInContext(vm, { timeout: 2000 });
    assert.equal(new Script('lab.STATE().smartBombs').runInContext(vm), 2);
    assert.equal(new Script('lab.STATE().storedSmartBombs').runInContext(vm), 2, 'source ammunition state reflects one spent bomb');
    buttonListeners.KeyS.pointerup(fake);
    assert.equal(new Script('keys.has("KeyS")').runInContext(vm), false);
    assert.equal(fake.prevented, true, 'mobile pointer controls prevent browser default interactions');
    for (const k of ['KeyR', 'KeyS']) {
        assert.equal(typeof buttonListeners[k].contextmenu, 'function');
        assert.equal(typeof buttonListeners[k].selectstart, 'function');
    }
});
