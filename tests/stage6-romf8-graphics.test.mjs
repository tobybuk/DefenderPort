import test from 'node:test';
import assert from 'node:assert/strict';
import { RAM } from '../runtime/ram.js';
import { VideoMemory } from '../runtime/video-memory.js';
import { createRomf8GraphicsRoutines } from '../original/romf8-graphics.js';
const fixture = () => {
    const memory = new RAM(), video = new VideoMemory();
    const gfx = createRomf8GraphicsRoutines(video, memory);
    const desc = (addr, width, height, ptr) => {
        memory.write8(addr, width);
        memory.write8(addr + 1, height);
        memory.write16(addr + 2, ptr);
    };
    return { memory, video, gfx, desc };
};
test('ROMF8 CWRIT 2×4 bytes are copied column-major, not Canvas rows', () => {
    const { memory, video, gfx, desc } = fixture();
    desc(0xc000, 2, 4, 0xd000);
    for (let i = 0; i < 8; i++)
        memory.write8(0xd000 + i, 0x11 + i);
    gfx.CWRIT(0x1230, 0xc000);
    assert.deepEqual(Array.from({ length: 4 }, (_, i) => video.read8(0x1230 + i)), [0x11, 0x12, 0x13, 0x14]);
    assert.deepEqual(Array.from({ length: 4 }, (_, i) => video.read8(0x1330 + i)), [0x15, 0x16, 0x17, 0x18]);
    assert.equal(video.read8(0x1430), 0);
});
test('ROMF8 CWRIT odd-height descriptors copy all bytes including final odd byte', () => {
    const { memory, video, gfx, desc } = fixture();
    desc(0xc000, 3, 3, 0xd100);
    for (let i = 0; i < 9; i++)
        memory.write8(0xd100 + i, i + 1);
    gfx.CWRIT(0x8df1, 0xc000);
    assert.equal(video.read8(0x8df1), 1);
    assert.equal(video.read8(0x8ff3), 9);
});
test('COFF and COFFA source rectangle erasures preserve pixels outside area', () => {
    const { video, gfx, desc } = fixture();
    desc(0xc200, 2, 3, 0xd000);
    for (let col = 0; col < 3; col++)
        for (let row = 0; row < 4; row++)
            video.write8(0x1a20 + col * 0x100 + row, 0x44);
    gfx.COFF(0x1a20, 0xc200);
    for (let col = 0; col < 2; col++)
        for (let row = 0; row < 3; row++)
            assert.equal(video.read8(0x1a20 + col * 0x100 + row), 0);
    assert.equal(video.read8(0x1a23), 0x44);
    assert.equal(video.read8(0x1c20), 0x44);
    gfx.COFFA(0x1c20, 1, 2);
    assert.equal(video.read8(0x1c20), 0);
    assert.equal(video.read8(0x1c22), 0x44);
});
test('BLKCLR routes to original COFFA with independent width and height', () => {
    const { video, gfx } = fixture();
    video.write8(0x2934, 0x12);
    video.write8(0x2a34, 0x12);
    gfx.BLKCLR(0x2934, 2, 1);
    assert.equal(video.read8(0x2934), 0);
    assert.equal(video.read8(0x2a34), 0);
});
test('SCRCLR exactly clears $0000..$9BFF and retains other video bytes', () => {
    const { video, gfx } = fixture();
    video.write8(0, 15);
    video.write8(0x9bff, 15);
    video.write8(0x9c00, 15);
    gfx.SCRCLR();
    assert.equal(video.read8(0), 0);
    assert.equal(video.read8(0x9bff), 0);
    assert.equal(video.read8(0x9c00), 15);
});
test('Original CWRIT descriptors must be populated with source data; do not guess missing zero length', () => {
    const { gfx } = fixture();
    assert.throws(() => gfx.CWRIT(0x1000, 0xc000), /zero width\/height/);
});
