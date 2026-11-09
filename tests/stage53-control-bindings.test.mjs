import test from 'node:test';
import assert from 'node:assert/strict';
import {
    CONTROL_ACTIONS, CONTROL_STORAGE_KEY, DEFAULT_CONTROL_BINDINGS,
    loadControlBindings, saveControlBindings, validateBindings, assignControl,
    logicalKeyForCode, displayKeyName, isBindableCode
} from '../browser/control-bindings.js';

test('source cabinet signals retain requested keyboard defaults and Fire Enter', () => {
    assert.deepEqual(DEFAULT_CONTROL_BINDINGS, {
        up: 'KeyA', down: 'KeyZ', thrust: 'ShiftRight', reverse: 'Space',
        smartBomb: 'Tab', hyperspace: 'KeyH', fire: 'Enter'
    });
    assert.equal(CONTROL_ACTIONS.length, 7);
    assert.equal(validateBindings(DEFAULT_CONTROL_BINDINGS), true);
});
test('right shift is distinguished and converted to source thrust input', () => {
    assert.equal(logicalKeyForCode('ShiftRight', DEFAULT_CONTROL_BINDINGS), 'Space');
    assert.equal(logicalKeyForCode('ShiftLeft', DEFAULT_CONTROL_BINDINGS), null);
    assert.equal(logicalKeyForCode('Space', DEFAULT_CONTROL_BINDINGS), 'KeyR');
    assert.equal(logicalKeyForCode('Tab', DEFAULT_CONTROL_BINDINGS), 'KeyS');
    assert.equal(logicalKeyForCode('KeyA', DEFAULT_CONTROL_BINDINGS), 'ArrowUp');
    assert.equal(logicalKeyForCode('KeyZ', DEFAULT_CONTROL_BINDINGS), 'ArrowDown');
});
test('customisation checks duplicate keys, reserves Escape, and allows Enter only for Fire', () => {
    assert.throws(() => assignControl(DEFAULT_CONTROL_BINDINGS, 'thrust', 'KeyA'), /Already assigned to Up/);
    assert.throws(() => assignControl(DEFAULT_CONTROL_BINDINGS, 'thrust', 'Enter'), /only be assigned to Fire/);
    assert.throws(() => assignControl(DEFAULT_CONTROL_BINDINGS, 'up', 'Escape'), /reserved/);
    assert.equal(isBindableCode('ShiftRight'), true);
    const updated = assignControl(DEFAULT_CONTROL_BINDINGS, 'fire', 'KeyQ');
    assert.equal(updated.fire, 'KeyQ');
    assert.equal(DEFAULT_CONTROL_BINDINGS.fire, 'Enter');
});
test('custom controls survive reload; unavailable storage is handled', () => {
    const map = new Map();
    const storage = {getItem:k => map.get(k) ?? null, setItem:(k,v) => map.set(k,v)};
    const custom = assignControl(DEFAULT_CONTROL_BINDINGS, 'fire', 'KeyQ');
    assert.equal(saveControlBindings(storage, custom), true);
    assert.equal(map.has(CONTROL_STORAGE_KEY), true);
    assert.deepEqual(loadControlBindings(storage), custom);
    assert.deepEqual(loadControlBindings({getItem:() => '{corrupt'}), DEFAULT_CONTROL_BINDINGS);
    assert.deepEqual(loadControlBindings({getItem:() => {throw Error('blocked')}}), DEFAULT_CONTROL_BINDINGS);
    assert.equal(saveControlBindings({setItem:()=>{throw Error('blocked')}}, custom), false);
});
test('keyboard labels are human-readable and data remains valid', () => {
    assert.equal(displayKeyName('ShiftRight'), 'RIGHT SHIFT');
    assert.equal(displayKeyName('Tab'), 'TAB');
    assert.equal(displayKeyName('KeyA'), 'A');
    assert.equal(validateBindings({...DEFAULT_CONTROL_BINDINGS, down:'KeyA'}), false);
});
