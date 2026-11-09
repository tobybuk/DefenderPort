import test from 'node:test';
import assert from 'node:assert/strict';
import { TDATA, MTERR } from '../original/blk71-data.js';
import { verifyBlk71Tables } from '../tools/verify-blk71.mjs';
function assemblerLines(name, arr, length) {
    return Array.from({ length: Math.ceil(arr.length / length) }, (_, i) => `${i === 0 ? name + ' ' : '      '}FCB ` +
        Array.from(arr.slice(i * length, i * length + length)).map(x => '$' + x.toString(16).padStart(2, '0')).join(','))
        .join('\n');
}
function fixture(t = TDATA, m = MTERR) {
    return assemblerLines('TDATA', t, 16) + '\n' + assemblerLines('MTERR', m, 12) + '\nPLEX RTS';
}
test('data verifier compares actual FCB byte streams rather than just table lengths', () => {
    assert.deepEqual(verifyBlk71Tables(fixture()), { TDATA: 256, MTERR: 384 });
    const bad = TDATA.slice();
    bad[111] ^= 1;
    assert.throws(() => verifyBlk71Tables(fixture(bad)), /TDATA differs.*111/);
});
test('data verifier rejects altered scanner terrain bytes', () => {
    const bad = MTERR.slice();
    bad[330] ^= 1;
    assert.throws(() => verifyBlk71Tables(fixture(TDATA, bad)), /MTERR differs.*330/);
});
