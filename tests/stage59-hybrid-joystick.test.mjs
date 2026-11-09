import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
    createFloatingJoystick, createTouchInputState,
    hybridJoystickKeys, hybridReverseHeld, createHybridReverseSequencer
} from '../browser/touch-controls.js';

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('floating pad begins at the thumb touch point and tracks two axes continuously', () => {
    const stick = createFloatingJoystick();
    assert.equal(stick.begin(7, 120, 200), true);
    assert.equal(stick.begin(8, 130, 210), false, 'only one left thumb owns the stick');
    assert.deepEqual([stick.state().horizontal, stick.state().vertical], [0,0]);
    stick.move(7, 155, 160);
    assert.deepEqual([stick.state().horizontal, stick.state().vertical], [1,-1]);
    assert.equal(stick.state().originX, 120);
    stick.move(7, 75, 245);
    assert.deepEqual([stick.state().horizontal, stick.state().vertical], [-1,1]);
    assert.equal(stick.move(8, 50, 300), false);
    assert.equal(stick.end(8), false);
    assert.equal(stick.end(7), true);
    assert.equal(stick.state().active, false);
});

test('hysteresis means small finger jitter does not chatter the directional switches', () => {
    const stick = createFloatingJoystick({engage:22,release:12});
    stick.begin(1, 50, 50);
    stick.move(1, 71, 50); // below activation
    assert.equal(stick.state().horizontal, 0);
    stick.move(1, 73, 50);
    assert.equal(stick.state().horizontal, 1);
    stick.move(1, 64, 50);
    assert.equal(stick.state().horizontal, 1, 'remains held above release threshold');
    stick.move(1, 59, 50);
    assert.equal(stick.state().horizontal, 0);
    stick.move(1, 27, 50);
    assert.equal(stick.state().horizontal, -1);
    stick.cancel();
    assert.equal(stick.state().active,false);
});

test('one left thumb holds UP+THRUST and continues through an uninterrupted diagonal reversal', () => {
    const stick = createFloatingJoystick();
    const inputs = createTouchInputState();
    stick.begin(11, 120, 120);
    stick.move(11, 160, 80); // up/right
    inputs.setMany(11, hybridJoystickKeys(stick.state()));
    assert.equal(inputs.held('ArrowUp'),true);
    assert.equal(inputs.held('Space'),true);
    assert.equal(inputs.held('ArrowDown'),false);
    stick.move(11, 80, 170); // down/left WITHOUT lifting
    inputs.setMany(11, hybridJoystickKeys(stick.state()));
    assert.equal(inputs.held('ArrowUp'),false);
    assert.equal(inputs.held('ArrowDown'),true);
    assert.equal(inputs.held('Space'),true);
    stick.move(11, 120, 120); // centre
    inputs.setMany(11, hybridJoystickKeys(stick.state()));
    assert.equal(inputs.held('ArrowDown'),false);
    assert.equal(inputs.held('Space'),false);
    inputs.release(11);
});

test('horizontal intent holds original REVERSE only until source PLADIR matches', () => {
    assert.equal(hybridReverseHeld(-1,0x0300),true, 'want left, facing right');
    assert.equal(hybridReverseHeld(-1,0xfd00),false, 'release after source turns left');
    assert.equal(hybridReverseHeld(1,0xfd00),true, 'want right, facing left');
    assert.equal(hybridReverseHeld(1,0x0300),false, 'release after source turns right');
    assert.equal(hybridReverseHeld(0,0xfd00),false, 'return to centre never reverses');
});

test('a Reverse request is delayed until SSCAN samples continuous thrust', () => {
    const gate=createHybridReverseSequencer();
    const trace=Array.from({length:5}, (_,i)=>gate.sample(-1,0x0300,false,i===0));
    assert.deepEqual(trace,[false,false,false,true,true]);
    assert.equal(gate.sample(-1,0x0300,true),false,'original REVFLG owns turn');
    assert.equal(gate.sample(-1,0xfd00,false),false,'facing now matches');
});

test('retry after masked switch edge uses release then new press', () => {
    const gate=createHybridReverseSequencer();
    const sample=()=>gate.sample(-1,0x0300,false);
    const values=Array.from({length:12},sample);
    assert.deepEqual(values.slice(0,7),[false,false,false,true,true,true,false]);
    assert.equal(values.includes(false),true);
    assert.equal(gate.state().intent,-1);
    gate.reset();
    assert.equal(gate.state().phase,'idle');
});

test('right-hand FIRE, THRUST, BOMB and HS pointers stay independent of joystick', () => {
    const inputs = createTouchInputState();
    inputs.setMany(1, ['ArrowUp','Space']); // left thumb
    inputs.set(2,'KeyF'); // fire, held
    inputs.set(3,'KeyS'); // bomb, brief tap
    inputs.set(4,'KeyH'); // hyperspace, brief tap
    assert.equal(inputs.activeCount(),4);
    inputs.release(3); inputs.release(4);
    assert.equal(inputs.consume('KeyS'),true);
    assert.equal(inputs.consume('KeyH'),true);
    assert.equal(inputs.consume('KeyS'),false);
    assert.equal(inputs.held('KeyF'),true);
    assert.equal(inputs.held('ArrowUp'),true);
    inputs.release(2);
    assert.equal(inputs.held('Space'),true);
    inputs.release(1);
    assert.equal(inputs.activeCount(),0);
});

test('a finger lifting when another is holding the same key does not release that key', () => {
    const input = createTouchInputState();
    input.setMany(1,['ArrowUp','Space']);
    input.set(2,'Space');
    input.release(1);
    assert.equal(input.held('ArrowUp'),false);
    assert.equal(input.held('Space'),true);
    input.release(2);
    assert.equal(input.held('Space'),false);
});

test('hall initials use only up/down, with no thrust or reverse', () => {
    assert.deepEqual(hybridJoystickKeys({horizontal:-1,vertical:-1},{hallEntry:true}), ['ArrowUp']);
    assert.deepEqual(hybridJoystickKeys({horizontal:1,vertical:0},{hallEntry:true}), []);
});

test('browser-only joystick never bypasses original input path or mutates source modules', () => {
    const flight=source('browser/flight.js');
    assert.match(flight,/hybridReverse\.sample\(/);
    assert.match(flight,/lab\.INPUT\(/);
    assert.match(flight,/touchInput\.setMany\(/);
    assert.match(flight,/setPointerCapture/);
    assert.match(flight,/pointercancel/);
    assert.match(source('style.css'),/touch-action:none/);
    const html=source('play.html');
    assert.match(html,/id="flight" width="292" height="240"/);
    assert.match(html,/id="floatingKnob"/);
});
