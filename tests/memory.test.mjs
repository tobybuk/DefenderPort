import test from 'node:test';
import assert from 'node:assert/strict';
import { RAM, Layout } from '../runtime/ram.js';
import { u8, u16, s8, s16, add8, sub8, add16, sub16, asr8, ror8, rol8, asl8 } from '../runtime/integers.js';
test('memory stores exactly one byte and wraps native 16-bit pointers', () => {
    const m = new RAM();
    m.write16(0xffff, 0xabcd);
    assert.equal(m.read8(0xffff), 0xab);
    assert.equal(m.read8(0), 0xcd);
    assert.equal(m.read16(0xffff), 0xabcd);
    m.write8(0x12000, 0x1ff);
    assert.equal(m.read8(0x2000), 255);
});
test('symbols are not guessed', () => {
    const l = new Layout({ RAM: 0xa000 });
    assert.equal(l.at('RAM'), 0xa000);
    assert.throws(() => l.at('FAKE'), /Missing or invalid upstream symbol/);
});
test('byte/word casting keeps signed 6809 semantics', () => {
    assert.equal(u8(256), 0);
    assert.equal(u16(-1), 65535);
    assert.equal(s8(255), -1);
    assert.equal(s16(0x8000), -32768);
});
test('8-bit carry and zero arithmetic', () => {
    assert.deepEqual([add8(255, 1).result, add8(255, 1).C, add8(255, 1).Z], [0, true, true]);
    assert.equal(sub8(0, 1).result, 255);
    assert.equal(sub8(0, 1).C, true);
});
test('two-byte arithmetic wraps without JS float coordinates', () => {
    assert.equal(add16(65535, 1).result, 0);
    assert.equal(sub16(0, 1).result, 0xffff);
    assert.equal(add16(0x7fff, 1).V, true);
});
test('ASR and rotations propagate source flags explicitly', () => {
    assert.equal(asr8(0x81).result, 0xc0);
    assert.equal(asr8(0x81).C, true);
    assert.deepEqual([ror8(0x01, true).result, ror8(0x01, true).C], [0x80, true]);
    assert.equal(rol8(0x80, true).result, 1);
    assert.equal(asl8(0x80).C, true);
});
test('8-bit add/sub arithmetic agrees with mathematical modular result for every operand', () => {
    for (let a = 0; a < 256; a++)
        for (let b = 0; b < 256; b++) {
            assert.equal(add8(a, b).result, (a + b) & 255);
            assert.equal(sub8(a, b).result, (a - b) & 255);
        }
});
