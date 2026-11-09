import test from 'node:test';
import assert from 'node:assert/strict';
import { RAM } from '../runtime/ram.js';
import { VideoMemory } from '../runtime/video-memory.js';
import { PHR6_LAYOUT as L } from '../runtime/phr6-layout.js';
import { createAmode1ScannerRoutines } from '../original/amode1-scanner.js';
import { extractMTERR } from '../tools/extract-mterr.mjs';
const f = (table) => {
    const ram = new RAM(), video = new VideoMemory();
    const scanner = createAmode1ScannerRoutines(ram, L, video, { MTERR: table });
    return { ram, video, scanner };
};
const r8 = (ram, n) => ram.read8(L.at(n)), w8 = (ram, n, v) => ram.write8(L.at(n), v);
test('MTERR scanner terrain source data must be 384 exact original bytes', () => {
    const x = f();
    x.ram.write16(L.at('BGL'), 0x6d40);
    assert.throws(() => x.scanner.MT1(), /original 384-byte MTERR/);
    assert.throws(() => f(new Uint8Array(380)).scanner.MT1(), /original 384-byte MTERR/);
});
test('MT1 uses (BGL-$6D40) high-byte LSRA twice then 3 bytes per column', () => {
    const table = new Uint8Array(384);
    for (let i = 0; i < 128; i++) {
        table[i * 3] = 8;
        table[i * 3 + 1] = (i + 1) & 255;
        table[i * 3 + 2] = 0x77;
    }
    const x = f(table);
    x.ram.write16(L.at('BGL'), 0x7140); // difference 0x0400 -> 1*3 offset
    x.scanner.MT1();
    assert.equal(x.ram.read16(L.at('XTEMP')), 0x0400);
    assert.equal(x.video.read8(0x3008), 2);
    assert.equal(x.video.read8(0x3009), 0x77);
    assert.equal(x.ram.read16(L.at('STETAB')), 0x3008);
    assert.equal(x.ram.read16(L.at('STETAB') + 2), 0x3108);
    assert.equal(x.video.read8(0x6f08), 65); // last scanner column
});
test('MT1 erases previously remembered terrain addresses rather than drawing an HTML line', () => {
    const x = f(new Uint8Array(384));
    x.ram.write16(L.at('BGL'), 0x6d40);
    x.ram.write16(L.at('STETAB'), 0x2808);
    x.video.write8(0x2808, 0xaa);
    x.video.write8(0x2809, 0xbb);
    x.scanner.MT1();
    assert.equal(x.video.read8(0x2808), 0);
    assert.equal(x.video.read8(0x2809), 0);
});
test('SCNR2 positions blip with bytewise X shift, bytewise Y shift and source centre', () => {
    const x = f();
    const U = L.at('SETAB');
    const next = x.scanner.SCNR2(0x1400, 0x80, 0x4433, U);
    assert.equal(next, U + 2);
    const target = ((0x05 << 8) | 0x10) + 0x3007;
    assert.equal(x.ram.read16(U), target);
    assert.equal(x.video.read8(target), 0x44);
    assert.equal(x.video.read8(target + 1), 0x33);
});
test('SCNR10 reads original object OX16/OY16/OBJCOL from its RAM record', () => {
    const x = f();
    const object = L.at('OLIST'), U = L.at('SETAB');
    x.ram.write16(object + L.at('OX16'), 0x7170);
    x.ram.write8(object + L.at('OY16'), 0x90);
    x.ram.write16(object + L.at('OBJCOL'), 0xcc33);
    const next = x.scanner.SCNR10(object, U, 0x6d40);
    const target = ((1 << 8) | (0x90 >>> 3)) + 0x3007;
    assert.equal(next, U + 2);
    assert.equal(x.ram.read16(U), target);
    assert.equal(x.video.read8(target), 0xcc);
});
test('SCNR draws original object and player blips, stores pointers in SETAB / SETEND', () => {
    const x = f(new Uint8Array(384));
    x.ram.write16(L.at('BGL'), 0x6d40);
    const object = L.at('OLIST');
    x.ram.write16(L.at('OPTR'), object);
    x.ram.write16(object, 0);
    x.ram.write16(object + L.at('OX16'), 0x6e40);
    x.ram.write8(object + L.at('OY16'), 0x80);
    x.ram.write16(object + L.at('OBJCOL'), 0x4433);
    w8(x.ram, 'PLAXC', 0x20);
    w8(x.ram, 'PLAYC', 0x80);
    const out = x.scanner.SCNR();
    assert.equal(out.objects, 1);
    assert.equal(x.ram.read16(L.at('SETEND')), L.at('SETAB') + 2);
    const blip = x.ram.read16(L.at('SETAB'));
    assert.equal(x.video.read8(blip), 0x44);
    assert.equal(x.video.read8(blip + 1), 0x33);
    assert.equal(out.playerPointer, 0x4d17);
    assert.equal(x.ram.read16(L.at('SETAB') + 2), 0x4d17);
    assert.equal(x.video.read8(0x4d17), 0x90);
    assert.equal(x.video.read8(0x4d18), 0x99);
    assert.equal(x.video.read8(0x4d19), 0x90);
    assert.equal(x.video.read8(0x4c18), 0x09);
});
test('SCNR old object blip is erased before repainting at updated position', () => {
    const x = f(new Uint8Array(384));
    x.ram.write16(L.at('BGL'), 0x6d40);
    const object = L.at('OLIST');
    x.ram.write16(L.at('OPTR'), object);
    x.ram.write16(object, 0);
    x.ram.write16(object + L.at('OX16'), 0x6e40);
    x.ram.write8(object + L.at('OY16'), 0x80);
    x.ram.write16(object + L.at('OBJCOL'), 0x4433);
    x.scanner.SCNR();
    const old = x.ram.read16(L.at('SETAB'));
    x.ram.write16(object + L.at('OX16'), 0x7240);
    x.scanner.SCNR();
    const newer = x.ram.read16(L.at('SETAB'));
    assert.notEqual(old, newer);
    assert.equal(x.video.read8(old), 0);
    assert.equal(x.video.read8(newer), 0x44);
});
test('MTX scanner bezel uses four source 16-bit writes at original addresses', () => {
    const x = f();
    x.scanner.MTX();
    for (const a of [0x4c09, 0x4c26])
        assert.equal(x.video.read8(a), 0x90);
    for (const a of [0x5309, 0x5326])
        assert.equal(x.video.read8(a), 0x09);
});
test('MTERR parser reads only literal source FCB records and demands exactly 384 bytes', () => {
    const rows = Array.from({ length: 32 }, (_, n) => `${n === 0 ? 'MTERR   ' : '        '}FCB    ${Array.from({ length: 12 }, (_, i) => '$' + ((n * 12 + i) & 255).toString(16).padStart(2, '0')).join(',')}`);
    const out = extractMTERR(['* header', ...rows, '        ORG $CF00'].join('\n'));
    assert.equal(out.length, 384);
    assert.equal(out[0], 0);
    assert.equal(out[383], 127);
    assert.throws(() => extractMTERR('MTERR FCB $01\nEND'), /384 source bytes/);
    assert.throws(() => extractMTERR('OTHER FCB $01'), /MTERR not found/);
});
