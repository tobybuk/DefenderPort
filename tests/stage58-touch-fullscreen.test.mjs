import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createTouchInputState, TOUCH_ACTIONS, joystickKey } from '../browser/touch-controls.js';

const root = new URL('../', import.meta.url);
const source = f => readFileSync(new URL(f, root), 'utf8');

test('all seven arcade actions map onto the existing original switch codes', () => {
    assert.deepEqual(TOUCH_ACTIONS, {
        fire: 'KeyF', thrust: 'Space', reverse: 'KeyR', smartBomb: 'KeyS',
        hyperspace: 'KeyH', up: 'ArrowUp', down: 'ArrowDown'
    });
});

test('two fingers hold fire and thrust simultaneously without dropping either', () => {
    const input = createTouchInputState();
    input.set(101, 'KeyF'); input.set(202, 'Space');
    assert.equal(input.held('KeyF'), true);
    assert.equal(input.held('Space'), true);
    input.release(101);
    assert.equal(input.held('KeyF'), false);
    assert.equal(input.held('Space'), true);
    input.release(202);
    assert.equal(input.held('Space'), false);
});

test('two fingers holding the same action release independently', () => {
    const input = createTouchInputState();
    input.set(1, 'KeyF'); input.set(2, 'KeyF');
    input.release(1);
    assert.equal(input.held('KeyF'), true);
    input.release(2);
    assert.equal(input.held('KeyF'), false);
});

test('short taps cannot be lost between two 60Hz source updates', () => {
    const input = createTouchInputState();
    input.set(42, 'KeyS'); input.release(42);
    assert.equal(input.held('KeyS'), false);
    assert.equal(input.consume('KeyS'), true);
    assert.equal(input.consume('KeyS'), false);
    input.set(55, 'KeyH'); input.release(55);
    input.clear();
    assert.equal(input.consume('KeyH'), false);
});

test('joystick slides smoothly UP -> neutral -> DOWN without a new touch', () => {
    const input = createTouchInputState();
    input.set(5, joystickKey(10, 0, 200));
    assert.equal(input.held('ArrowUp'), true);
    input.set(5, joystickKey(99, 0, 200));
    assert.equal(input.held('ArrowUp'), false);
    assert.equal(input.held('ArrowDown'), false);
    input.set(5, joystickKey(181, 0, 200));
    assert.equal(input.held('ArrowDown'), true);
    input.release(5);
    assert.equal(input.held('ArrowDown'), false);
    assert.equal(joystickKey(1, 0, 0), null);
});

test('standalone keeps original 292x240 framebuffer, a separate touch overlay and a fullscreen shell', () => {
    const html = source('play.html');
    const css = source('style.css');
    assert.match(html, /id="flight" width="292" height="240"/);
    assert.match(html, /id="arcadeShell"/);
    assert.match(html, /id="fullscreenToggle"/);
    assert.match(html, /id="touchJoystick"/);
    for (const action of ['fire','thrust','hyperspace','smartBomb']) {
        assert.ok(html.includes(`data-touch-action="${action}"`), action);
    }
    assert.ok(html.includes('id="floatingRing"'), 'floating joystick ring follows thumb-down point');
    assert.match(css, /object-fit:contain/);
    assert.match(css, /arcade-shell:fullscreen/);
    assert.match(css, /touch-action:none/);
    assert.match(css, /orientation:portrait/);
    assert.match(source('browser/flight.js'), /touchInput\.consume\('KeyS'\)|inputEdge\('KeyS'\)/);
});
