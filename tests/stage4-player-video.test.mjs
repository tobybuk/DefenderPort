import test from 'node:test';
import assert from 'node:assert/strict';
import { RAM } from '../runtime/ram.js';
import { VideoMemory } from '../runtime/video-memory.js';
import { PHR6_LAYOUT as L } from '../runtime/phr6-layout.js';
import { PLAPIC, PLBPIC, PLD10, PLD11, PLD20, PLD21 } from '../original/defb6-player-data.js';
import { createDefa7PlayerVideoRoutines } from '../original/defa7-player-video.js';
import { createDefa7ObjectVideoRoutines } from '../original/defa7-object-video.js';
import { getPixel, framePixels, DEFENDER_VISIBLE } from '../browser/video-presenter.js';
import { createFlightHarness } from '../demo/flight-harness.js';
const fixture = () => {
    const ram = new RAM(), video = new VideoMemory(), p = createDefa7PlayerVideoRoutines(ram, L, video);
    const r8 = n => ram.read8(L.at(n)), r16 = n => ram.read16(L.at(n)), w8 = (n, v) => ram.write8(L.at(n), v), w16 = (n, v) => ram.write16(L.at(n), v);
    return { ram, video, p, r8, r16, w8, w16 };
};
const memoryFrame = (video, byteX, y, columns = 8, height = 6) => {
    const result = [];
    for (let c = 0; c < columns; c++)
        for (let r = 0; r < height; r++)
            result.push(video.read8((((byteX + c) & 255) << 8) | ((y + r) & 255)));
    return result;
};
test('Original ship pictures are exactly 8 byte columns x 6 rows: physical 16 x 6 pixels', () => {
    for (const pict of [PLAPIC, PLBPIC]) {
        assert.equal(pict.width, 16);
        assert.equal(pict.height, 6);
        assert.equal(pict.byteColumns, 8);
        assert.equal(pict.bytesPerColumn, 6);
        for (const data of pict.phases)
            assert.equal(data.length, 48);
    }
    assert.deepEqual(Array.from(PLD10.slice(0, 6)), [0, 6, 0x26, 6, 0x26, 0]);
    assert.deepEqual(Array.from(PLD20.slice(-6)), [0, 0, 0x30, 0, 0x30, 0]);
});
test('ON86 writes exact original 48 source bytes to source COLUMN-major graphics addresses', () => {
    const e = fixture();
    e.p.ON86(0x2085, PLAPIC, false);
    assert.deepEqual(memoryFrame(e.video, 0x20, 0x85), Array.from(PLD10));
    assert.equal(e.video.read8(0x2084), 0);
    assert.equal(e.video.read8(0x278b), 0);
});
test('ON86 original C flag selects alternate source data, and supports reversed direction', () => {
    const e = fixture();
    e.p.ON86(0x3070, PLAPIC, true);
    assert.deepEqual(memoryFrame(e.video, 0x30, 0x70), Array.from(PLD11));
    e.p.ON86(0x3070, PLBPIC, false);
    assert.deepEqual(memoryFrame(e.video, 0x30, 0x70), Array.from(PLD20));
    e.p.ON86(0x3070, PLBPIC, true);
    assert.deepEqual(memoryFrame(e.video, 0x30, 0x70), Array.from(PLD21));
});
test('OFF86 clears exactly the same 8 x 6 source-byte rectangle', () => {
    const e = fixture();
    e.p.ON86(0x2085, PLAPIC);
    e.video.write8(0x2885, 0xab);
    e.p.OFF86(0x2085);
    assert.deepEqual(memoryFrame(e.video, 0x20, 0x85), Array(48).fill(0));
    assert.equal(e.video.read8(0x2885), 0xab);
});
test('Source pair of horizontal colour nibbles maps to adjacent SCREEN X pixels, not vertical pixels', () => {
    const e = fixture();
    e.video.write8(0x1450, 0xa5);
    const x = 0x14 * 2 - 12, y = 0x50 - 7;
    assert.equal(getPixel(e.video, x, y), 10);
    assert.equal(getPixel(e.video, x + 1, y), 5);
    assert.equal(getPixel(e.video, x, y + 1), 0);
    const pixels = framePixels(e.video);
    const i = (y * DEFENDER_VISIBLE.width + x) * 4;
    assert.deepEqual([...pixels.slice(i, i + 4)], [168, 221, 250, 255]);
});
test('POUT + phase carry is determined by bit 7 of PLAX16+1, not world X', () => {
    const e = fixture();
    e.w16('NPLAXC', 0x3680);
    e.w16('PLAX16', 0x1200);
    e.p.POUT();
    assert.equal(e.r16('PLAXC'), 0x3680);
    assert.deepEqual(memoryFrame(e.video, 0x36, 0x80), Array.from(PLD10));
    e.w16('PLAX16', 0x1280);
    e.p.POUT();
    assert.deepEqual(memoryFrame(e.video, 0x36, 0x80), Array.from(PLD11));
});
test('POUT1 uses actual reverse ship data, not a geometrically flipped forward sprite', () => {
    const e = fixture();
    e.w16('NPLAXC', 0x3670);
    e.p.POUT1();
    assert.deepEqual(memoryFrame(e.video, 0x36, 0x70), Array.from(PLD20));
    assert.notDeepEqual(Array.from(PLD20), Array.from(PLD10).reverse());
});
test('PRDISP guard STATUS bit $10 prevents changing graphics and direction', () => {
    const e = fixture();
    e.w16('NPLAXC', 0x3285);
    e.p.POUT();
    e.w8('STATUS', 0x10);
    e.w16('PLADIR', 0x0300);
    e.w16('NPLAD', 0xfd00);
    e.w16('NPLAXC', 0x3785);
    e.p.PRDISP(255, 0);
    assert.equal(e.r16('PLADIR'), 0x0300);
    assert.equal(e.r16('PLAXC'), 0x3285);
    assert.deepEqual(memoryFrame(e.video, 0x32, 0x85), Array.from(PLD10));
});
test('PRDISP preserves original scanline gate: no state change outside current player Y', () => {
    const e = fixture();
    e.w16('PLADIR', 0x0300);
    e.w16('NPLAD', 0xfd00);
    e.w8('PLAYC', 133);
    e.w16('NPLAXC', 0x3785);
    e.p.PRDISP(133, 0);
    assert.equal(e.r16('PLADIR'), 0x0300);
    e.p.PRDISP(255, 134);
    assert.equal(e.r16('PLADIR'), 0x0300);
});
test('PRDISP original sequence clears old ship, sets PLADIR=NPLAD then draws reversed data', () => {
    const e = fixture();
    e.w16('NPLAXC', 0x2085);
    e.p.POUT();
    e.w16('PLADIR', 0x0300);
    e.w16('NPLAD', 0xfd00);
    e.w8('PLAYC', 133);
    e.w16('NPLAXC', 0x3085);
    e.p.PRDISP(255, 0);
    assert.equal(e.r16('PLADIR'), 0xfd00);
    assert.deepEqual(memoryFrame(e.video, 0x20, 0x85), Array(48).fill(0));
    assert.deepEqual(memoryFrame(e.video, 0x30, 0x85), Array.from(PLD20));
});
test('THOUT writes source five-byte idle pattern and additional thrust pixels at exact offsets', () => {
    const e = fixture();
    e.w16('PLAXC', 0x4085);
    e.w16('THX', L.at('THTAB'));
    for (let i = 0; i < 16; i++)
        e.ram.write8(L.at('THTAB') + i, i + 1);
    e.w8('PIA21', 2);
    e.p.THOUT();
    const U = 0x3f86;
    assert.deepEqual(Array.from({ length: 5 }, (_, i) => e.video.read8(U + i)), [1, 2, 6, 10, 13]);
    assert.deepEqual([e.video.read8(U - 0x100 + 1), e.video.read8(U - 0x100 + 2), e.video.read8(U - 0x100 + 3)], [4, 7, 11]);
    assert.deepEqual([e.video.read8(U - 0x200 + 1), e.video.read8(U - 0x200 + 2), e.video.read8(U - 0x200 + 3)], [5, 8, 12]);
    assert.equal(e.video.read8(U - 0x300 + 2), 9);
    e.p.THOFF();
    assert.deepEqual(Array.from({ length: 5 }, (_, i) => e.video.read8(U + i)), [0, 0, 0, 0, 0]);
    assert.equal(e.video.read8(U - 0x300 + 2), 0);
});
test('THOUT1 uses original reverse-side source offsets and THOFF1 removes them', () => {
    const e = fixture();
    e.w16('PLAXC', 0x4085);
    e.w16('THX', L.at('THTAB'));
    for (let i = 0; i < 16; i++)
        e.ram.write8(L.at('THTAB') + i, i + 1);
    e.w8('PIA21', 2);
    e.p.THOUT1();
    const X = 0x4886;
    assert.deepEqual(Array.from({ length: 5 }, (_, i) => e.video.read8(X + i)), [1, 2, 3, 4, 5]);
    assert.deepEqual([e.video.read8(X + 0x101), e.video.read8(X + 0x102), e.video.read8(X + 0x103)], [6, 7, 8]);
    assert.deepEqual([e.video.read8(X + 0x201), e.video.read8(X + 0x202), e.video.read8(X + 0x203), e.video.read8(X + 0x302)], [11, 12, 9, 10]);
    e.p.THOFF1();
    assert.deepEqual(Array.from({ length: 5 }, (_, i) => e.video.read8(X + i)), [0, 0, 0, 0, 0]);
    assert.equal(e.video.read8(X + 0x302), 0);
});
test('ON23, ON34, ON48, ON58, ON64, ON56, ON66 and ON28 retain precise byte column geometry', () => {
    const video = new VideoMemory(), o = createDefa7ObjectVideoRoutines(video);
    const shapes = [[2, 3], [3, 4], [4, 8], [5, 8], [6, 4], [5, 6], [6, 6], [2, 8]];
    for (const [cols, rows] of shapes) {
        const suffix = `${cols}${rows}`, on = o[`ON${suffix}`], off = o[`OFF${suffix}`];
        assert.equal(typeof on, 'function');
        assert.equal(typeof off, 'function');
        const n = cols * rows;
        const data = Uint8Array.from({ length: n }, (_, i) => i + 1);
        on(0x4080, data);
        assert.deepEqual(memoryFrame(video, 0x40, 0x80, cols, rows), Array.from(data));
        assert.equal(video.read8(0x4080 + rows), 0);
        off(0x4080);
        assert.deepEqual(memoryFrame(video, 0x40, 0x80, cols, rows), Array(n).fill(0));
    }
});
test('General source byte-column routine obeys original odd/even phase choice', () => {
    const video = new VideoMemory(), o = createDefa7ObjectVideoRoutines(video);
    o.ON34(0x1080, { phases: [new Uint8Array(12).fill(0xaa), new Uint8Array(12).fill(0xbb)] }, true);
    assert.deepEqual(memoryFrame(video, 0x10, 0x80, 3, 4), Array(12).fill(0xbb));
    assert.throws(() => o.ON34(0x1080, new Uint8Array(9)), /expected 12/);
});
test('Flight fixture now writes ship to the SAME VIDEO BUFFER as STOUT, no Canvas gameplay substitute', () => {
    const h = createFlightHarness();
    let count = 0;
    const s = h.STATE();
    for (let x = s.x; x < s.x + 8; x++)
        for (let y = s.y; y < s.y + 6; y++) {
            if (h.video.read8((x << 8) | y))
                count++;
        }
    assert.ok(count > 0);
    h.INPUT({ thrust: true, up: true });
    for (let i = 0; i < 25; i++)
        h.STEP();
    assert.notEqual(h.STATE().y, s.y);
    const z = h.STATE();
    let drawn = 0;
    for (let x = z.x; x < z.x + 8; x++)
        for (let y = z.y; y < z.y + 6; y++)
            if (h.video.read8((x << 8) | y))
                drawn++;
    assert.ok(drawn > 0);
});
test('Every new original Stage 4 callable routine has a 1:1 source inventory record', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const manifest = JSON.parse(readFileSync(resolve(import.meta.dirname, '../docs/PORT_STATUS.json'), 'utf8'));
    const listed = new Map(manifest.entries.map(e => [e.label, e]));
    const { ON86, OFF86, THOUT, THOUT1, THOFF, THOFF1, PRDISP, POUT, POUT1, POFF, POFF1 } = fixture().p;
    const functions = { ON86, OFF86, THOUT, THOUT1, THOFF, THOFF1, PRDISP, POUT, POUT1, POFF, POFF1 };
    for (const [name, fn] of Object.entries(functions)) {
        assert.equal(fn.name, name);
        const entry = listed.get(name);
        assert.ok(entry, `missing source record ${name}`);
        assert.equal(entry.asm_start, name);
        assert.equal(entry.status, 'translated-unverified');
        assert.ok(entry.asm_end_exclusive);
    }
    const objs = createDefa7ObjectVideoRoutines(new VideoMemory());
    for (const [name, fn] of Object.entries(objs)) {
        assert.equal(fn.name, name);
        const entry = listed.get(name);
        assert.ok(entry, `missing source record ${name}`);
        assert.equal(entry.asm_start, name);
        assert.equal(entry.status, 'translated-unverified');
    }
});
