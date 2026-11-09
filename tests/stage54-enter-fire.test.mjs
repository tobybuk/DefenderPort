/**
 * Stage 54: The physical Enter key may be assigned to FIRE in the browser,
 * without replacing the source SSCAN/SWP logical switch name 'KeyF'.
 * Enter must still START on the attract screen and confirm HOF initials.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, Script } from 'node:vm';
import {
    DEFAULT_CONTROL_BINDINGS, CONTROL_STORAGE_KEY, assignControl,
    validateBindings, logicalKeyForCode, loadControlBindings, saveControlBindings,
    displayKeyName, isBindableCode
} from '../browser/control-bindings.js';

const html = readFileSync(new URL('../play.html', import.meta.url), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script, 'standalone build must contain the entire JavaScript');

function createBrowser() {
    const nodes = new Map();
    const winEvents = new Map();
    const store = new Map();
    const graphics = {
        fillRect() {}, fill() {}, beginPath() {}, moveTo() {}, lineTo() {},
        stroke() {}, arc() {}, fillText() {}, putImageData() {},
        createImageData(w, h) { return { data: new Uint8ClampedArray(w * h * 4) }; }
    };
    const node = id => {
        if (!nodes.has(id)) {
            const element = {
                id, hidden: false, onclick: null, textContent: '', className: '',
                dataset: {}, children: [], listeners: new Map(),
                classList: { add() {}, remove() {}, toggle() {} },
                getContext() { return graphics; },
                addEventListener(type, callback, options) { this.listeners.set(type, { callback, options }); },
                getAttribute() { return null; }, setAttribute() {}, focus() {},
                append(...args) { this.children.push(...args); },
                replaceChildren() { this.children.length = 0; },
                querySelector(selector) { return this.children.find(x => x.children?.some(y => y.dataset?.action === selector.match(/"([^"]+)"/)?.[1]))?.children?.[1] || null; }
            };
            nodes.set(id, element);
        }
        return nodes.get(id);
    };
    const document = {
        body: { classList: { toggle() {} } },
        getElementById: node,
        createElement: id => ({ ...node('_new_' + id + Math.random()), dataset: {}, children: [], append(...args) { this.children.push(...args); }, setAttribute() {}, focus() {} }),
        querySelectorAll() { return []; },
        addEventListener() {}
    };
    const window = {
        localStorage: {
            getItem(key) { return store.get(key) ?? null; },
            setItem(key, value) { store.set(key, value); }
        },
        addEventListener(type, cb) { winEvents.set(type, cb); }
    };
    const sandbox = createContext({ document, window, requestAnimationFrame() {} });
    new Script(script, { filename: 'Stage54-standalone.js' }).runInContext(sandbox, { timeout: 3500 });
    const event = (code, repeat=false) => ({
        code, repeat, prevented: false, preventDefault() { this.prevented = true; }
    });
    const keydown = (code, repeat=false) => {
        const e = event(code, repeat);
        winEvents.get('keydown')(e);
        return e;
    };
    const keyup = code => {
        const e = event(code);
        winEvents.get('keyup')(e);
        return e;
    };
    return { sandbox, node, keydown, keyup, store };
}

test('Enter and keypad Enter can be assigned to Fire, with source logical KeyF', () => {
    assert.equal(isBindableCode('Enter'), true);
    assert.equal(isBindableCode('NumpadEnter'), true);
    assert.equal(displayKeyName('Enter'), 'ENTER');
    assert.equal(displayKeyName('NumpadEnter'), 'NUMPAD ENTER');
    for (const code of ['Enter', 'NumpadEnter']) {
        const bindings = assignControl(DEFAULT_CONTROL_BINDINGS, 'fire', code);
        assert.equal(bindings.fire, code);
        assert.equal(validateBindings(bindings), true);
        assert.equal(logicalKeyForCode(code, bindings), 'KeyF');
        const saved = new Map();
        const storage = {getItem:k=>saved.get(k), setItem:(k,v)=>saved.set(k,v)};
        assert.equal(saveControlBindings(storage, bindings), true);
        assert.deepEqual(loadControlBindings(storage), bindings);
    }
});

test('Enter cannot steal UP/THRUST or be duplicated; Escape still cancels', () => {
    for (const code of ['Enter', 'NumpadEnter']) {
        assert.throws(() => assignControl(DEFAULT_CONTROL_BINDINGS, 'up', code), /only be assigned to Fire/);
        assert.equal(validateBindings({ ...DEFAULT_CONTROL_BINDINGS, up:code }), false);
    }
    assert.throws(() => assignControl(DEFAULT_CONTROL_BINDINGS, 'fire', 'Escape'), /reserved/);
    assert.throws(() => assignControl(DEFAULT_CONTROL_BINDINGS, 'fire', 'ShiftRight'), /already assigned to Thrust/i);
});

test('standalone: title Enter starts, bound Enter fires while held and stops on keyup', () => {
    const b = createBrowser();
    const s = b.sandbox;
    // Restore the user's preference as if set using KEYBOARD CONTROLS.
    new Script("controlBindings = assignControl(controlBindings, 'fire', 'Enter');").runInContext(s);
    assert.equal(new Script('mode').runInContext(s), 'power-off');
    new Script("mode='attract'; cabinet.COIN('left'); attract.SET_CREDITS(cabinet.credits);").runInContext(s);
    assert.equal(b.keydown('Enter').prevented, true);
    assert.equal(new Script('mode').runInContext(s), 'playing');
    assert.equal(new Script("keys.has('KeyF')").runInContext(s), false, 'Starting does not fire accidentally');
    b.keyup('Enter');
    const initialShots = new Script('lab.STATE().laserShots').runInContext(s);
    assert.equal(b.keydown('Enter').prevented, true);
    assert.equal(new Script("keys.has('KeyF')").runInContext(s), true);
    new Script('step()').runInContext(s);
    assert.ok(new Script('lab.STATE().laserShots').runInContext(s) > initialShots, 'real LASR fire request must execute');
    assert.equal(b.keydown('Enter', true).prevented, true, 'held Enter cannot activate the focused button');
    assert.equal(new Script('mode').runInContext(s), 'playing', 'no spurious restart');
    b.keyup('Enter');
    assert.equal(new Script("keys.has('KeyF')").runInContext(s), false, 'release stops firing');
});

test('standalone: Hall of Fame Enter confirmation preserved even if FIRE is another key', () => {
    const b = createBrowser();
    const s = b.sandbox;
    // Both the source's hall-entry and the browser's mapped-fire path use
    // KeyF internally, and Enter still confirms initials independently.
    new Script("mode='hall-entry'; controlBindings = assignControl(controlBindings,'fire','KeyQ')").runInContext(s);
    assert.equal(b.keydown('Enter').prevented, true);
    assert.equal(new Script("keys.has('KeyF')").runInContext(s), true);
    assert.equal(b.keyup('Enter').prevented, true);
    assert.equal(new Script("keys.has('KeyF')").runInContext(s), false);
});

test('standalone: configured Enter confirms initials without restarting from Hall entry', () => {
    const b = createBrowser();
    const s = b.sandbox;
    new Script(`
        controlBindings = assignControl(controlBindings, 'fire', 'Enter');
        hall.HALLOF(31000, 0);
        mode = 'hall-entry';
    `).runInContext(s);
    assert.equal(b.keydown('Enter').prevented, true);
    assert.equal(new Script('mode').runInContext(s), 'hall-entry');
    assert.equal(new Script("keys.has('KeyF')").runInContext(s), true);
    new Script('step()').runInContext(s);
    b.keyup('Enter');
    assert.equal(new Script("keys.has('KeyF')").runInContext(s), false);
    assert.equal(new Script('hall.STATE().phase').runInContext(s), 'entering');
    assert.equal(new Script('mode').runInContext(s), 'hall-entry');
});
