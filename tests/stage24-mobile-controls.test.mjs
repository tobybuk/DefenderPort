/** Regression: Android/iOS long presses must not select button text. The DOM
 * test uses exact standalone bytes, not standalone source snippets only.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, Script } from 'node:vm';
const html = readFileSync(new URL('../play.html', import.meta.url), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
const stylesheet = html.match(/<style>([\s\S]*?)<\/style>/)?.[1];
function browser() {
    const elements = new Map(), windowEvents = new Map();
    const graphics = { fillRect() {
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
        if (!elements.has(id)) {
            const listeners = new Map();
            elements.set(id, { id, textContent: '', onclick: null, listeners, addEventListener(name, fn, options) {
                    listeners.set(name, { fn, options });
                },
                getAttribute(name) {
                    return name === 'data-key' ? ({ 'holdThrust': 'Space', 'holdUp': 'ArrowUp', 'holdDown': 'ArrowDown' }[id] ?? null) : null;
                }, getContext() {
                    return graphics;
                } });
        }
        return elements.get(id);
    };
    const buttons = ['holdThrust', 'holdUp', 'holdDown', 'pause', 'step', 'reset', 'laserSound', 'scannerTest', 'terrainTest', 'scoreTest', 'eraseTest', 'objectTest', 'fireballTest', 'processStep', 'enemyStep', 'landerStep'];
    const holdButtons = buttons.slice(0, 3);
    const document = { getElementById: element, querySelectorAll(selector) {
            return (selector === '[data-key]' ? holdButtons : selector === 'button' ? buttons : []).map(element);
        } };
    const window = { addEventListener(type, handler) {
            windowEvents.set(type, handler);
        } };
    const sandbox = createContext({ document, window, requestAnimationFrame() {
        } });
    new Script(script, { filename: 'Stage24-full-HTML' }).runInContext(sandbox, { timeout: 2500 });
    return { element, sandbox };
}
function event(pointerId = 1) {
    return { pointerId, prevented: false, preventDefault() {
            this.prevented = true;
        } };
}
test('all buttons explicitly disable native selection and edit-callout gestures', () => {
    assert.match(stylesheet, /button\s*\{[^}]*-webkit-user-select\s*:\s*none/);
    assert.match(stylesheet, /button\s*\{[^}]*-webkit-touch-callout\s*:\s*none/);
    const { element } = browser();
    for (const id of ['holdThrust', 'holdUp', 'holdDown', 'pause', 'step', 'reset', 'laserSound', 'enemyStep']) {
        const listeners = element(id).listeners;
        for (const type of ['contextmenu', 'selectstart', 'dragstart']) {
            const e = event();
            assert.ok(listeners.has(type), `${id} blocks ${type}`);
            listeners.get(type).fn(e);
            assert.ok(e.prevented, `${id} prevents ${type}`);
        }
    }
    assert.equal(typeof element('reset').onclick, 'function', 'tap still operates normal buttons');
    assert.equal(typeof element('pause').onclick, 'function');
});
test('held thrust/up/down use pointerdown/up and non-passive touchstart suppression', () => {
    const { element, sandbox } = browser();
    new Script("mode='attract'; cabinet.COIN('left'); attract.SET_CREDITS(cabinet.credits); refreshCabinetUI();").runInContext(sandbox);
    element('startGame').onclick(); // Stage 36 attract mode; then verify gameplay controls.
    for (const [id, key] of [['holdThrust', 'Space'], ['holdUp', 'ArrowUp'], ['holdDown', 'ArrowDown']]) {
        const el = element(id), events = el.listeners;
        assert.equal(events.get('touchstart').options.passive, false, `${id} can cancel mobile long press`);
        const touch = event();
        events.get('touchstart').fn(touch);
        assert.ok(touch.prevented);
        const start = event(5);
        events.get('pointerdown').fn(start);
        assert.ok(start.prevented);
        assert.ok(new Script(`keys.has('${key}')`).runInContext(sandbox));
        // Two fingers on a single button must keep the button held until both end.
        events.get('pointerdown').fn(event(6));
        events.get('pointerup').fn(event(5));
        assert.ok(new Script(`keys.has('${key}')`).runInContext(sandbox));
        events.get('pointercancel').fn(event(6));
        assert.equal(new Script(`keys.has('${key}')`).runInContext(sandbox), false);
    }
});
