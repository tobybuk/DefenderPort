import test from 'node:test';
import assert from 'node:assert/strict';
import { RAM } from '../runtime/ram.js';
import { VideoMemory } from '../runtime/video-memory.js';
import { TDATA, MTERR } from '../original/blk71-data.js';
import { BLK71_ADDR as m, createBlk71TerrainRoutines } from '../original/blk71-terrain.js';
function setup(bgl = 0x2000, terrainData = TDATA) {
    const game = new RAM(), video = new VideoMemory();
    game.write16(m.BGL, bgl);
    const sys = createBlk71TerrainRoutines(game, video, { terrainData });
    return { game, video, sys, bank: sys.terrainBank };
}
test('exact pinned BLK71 TDATA and MTERR source data have expected lengths and landmark bytes', () => {
    assert.equal(TDATA.length, 0x100);
    assert.equal(MTERR.length, 0x180);
    assert.deepEqual([...TDATA.slice(0, 8)], [0x2a, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xab, 0xa1]);
    assert.deepEqual([...TDATA.slice(-8)], [0xc1, 0x53, 0x54, 0x75, 0x70, 0x03, 0x00, 0x00]);
    assert.deepEqual([...MTERR.slice(0, 6)], [0x25, 0x70, 0x07, 0x26, 0x77, 0x00]);
    assert.deepEqual([...MTERR.slice(-6)], [0x21, 0x70, 0x07, 0x23, 0x70, 0x07]);
});
test('BLK71 source memory bank is separate from PHR6 shared game RAM', () => {
    const { game, bank, sys } = setup();
    assert.notStrictEqual(game, bank);
    game.write8(m.TEMP1A, 0x12);
    bank.write8(m.TEMP1A, 0x34);
    assert.equal(game.read8(m.TEMP1A), 0x12);
    assert.equal(bank.read8(m.TEMP1A), 0x34);
    sys.BGINIT();
    assert.equal(game.read8(m.TEMP1A), 0x12);
});
test('BGALT altitude table matches an independently decoded 2048-bit terrain walk', () => {
    const { sys, bank } = setup();
    const altitude = sys.BGALT();
    assert.equal(altitude.length, 1024);
    let h = 0xe0;
    for (let i = 0; i < 1024; i++) {
        assert.equal(altitude[i], h, 'altitude at index ' + i);
        for (let j = 0; j < 2; j++) {
            const bit = (i * 2 + j) & 2047;
            const rises = (TDATA[bit >>> 3] >> (7 - (bit & 7))) & 1;
            h = (h + (rises ? -1 : 1)) & 255;
        }
    }
    assert.equal(bank.read8(m.ROFF), h);
});
test('RFONR1 cycles current byte through carry and wraps to next source byte', () => {
    const { sys, bank } = setup();
    bank.write16(m.RTPTR, 0);
    bank.write8(m.RTBYTE, 0x80);
    bank.write8(m.RTCNT, 7);
    assert.equal(sys.RFONR1(), 1);
    assert.equal(bank.read8(m.RTCNT), 6);
    for (let i = 0; i < 6; i++)
        sys.RFONR1();
    assert.equal(bank.read8(m.RTCNT), 0);
    assert.equal(sys.RFONR1(), TDATA[1]);
    assert.equal(bank.read16(m.RTPTR), 1);
});
test('LFONL1 and LFONR1 reverse through bit carry and rewind at pointer boundaries', () => {
    const { sys, bank } = setup();
    bank.write16(m.LTPTR, 0);
    bank.write8(m.LTBYTE, 0x01);
    bank.write8(m.LTCNT, 6);
    assert.equal(sys.LFONL1(), 0x80);
    assert.equal(bank.read8(m.LTCNT), 7);
    assert.equal(sys.LFONL1(), ((TDATA[255] >>> 1) | ((TDATA[255] & 1) << 7)) & 255);
    assert.equal(bank.read16(m.LTPTR), 255);
    bank.write16(m.RTPTR, 0);
    bank.write8(m.RTBYTE, 0x80);
    bank.write8(m.RTCNT, 6);
    assert.equal(sys.LFONR1(), 0x40);
});
test('BGINIT creates paired source flavour rings and clears all 152 STBL pointers', () => {
    const { sys, bank } = setup();
    sys.BGINIT();
    assert.equal(bank.read16(m.TTBLP0) >= m.TERTF0, true);
    assert.equal(bank.read16(m.TTBLP0) < m.TERTF0 + 0x1c8, true);
    assert.equal(bank.read16(m.TTBLP1) >= m.TERTF1, true);
    assert.equal(bank.read16(m.TTBLP1) < m.TERTF1 + 0x1c8, true);
    for (let i = 0; i < 0x1c8; i++) {
        assert.equal(bank.read8(m.TERTF0 + i), bank.read8(m.TERTF0 + i + 0x1c8));
        assert.equal(bank.read8(m.TERTF1 + i), bank.read8(m.TERTF1 + i + 0x1c8));
    }
    for (let i = 0; i < 152; i++)
        assert.equal(bank.read16(m.STBL + i * 2), 0);
});
test('BGOUT copies 152 original source table triples into video via STBL', () => {
    const { sys, bank, video } = setup();
    sys.BGINIT();
    const nearest = 0x2000;
    const selected = nearest & 0x20 ? m.TERTF0 : m.TERTF1;
    const start = bank.read16(nearest & 0x20 ? m.TTBLP0 : m.TTBLP1);
    const expected = Array.from({ length: 152 }, (_, i) => [0x98 - i, bank.read8(start + 3 * i), bank.read16(start + 3 * i + 1)]);
    sys.BGOUT();
    for (let i = 0; i < 152; i++) {
        const [x, y, value] = expected[i], pointer = (x << 8) | y;
        assert.equal(bank.read16(m.STBL + 2 * i), pointer);
        assert.equal((video.read8(pointer) << 8) | video.read8(pointer + 1), value);
    }
    assert.equal(bank.read16(m.BGLX), nearest);
});
test('BGOUT updates forward and backward source table pointers on scroll changes', () => {
    const { sys, bank, game, video } = setup();
    sys.BGINIT();
    sys.BGOUT();
    game.write16(m.BGL, 0x20a0);
    sys.BGOUT();
    assert.equal(bank.read16(m.BGLX), 0x20a0);
    game.write16(m.BGL, 0x2000);
    sys.BGOUT();
    assert.equal(bank.read16(m.BGLX), 0x2000);
    assert.ok(video.data.some(v => v !== 0));
});
test('BGERAS erases only STBL-linked word addresses', () => {
    const { sys, bank, video } = setup();
    for (let i = 0; i < 152; i++) {
        const addr = 0x5000 + i * 3;
        bank.write16(m.STBL + i * 2, addr);
        video.write8(addr, 0x77);
        video.write8(addr + 1, 0x70);
    }
    video.write8(0x8000, 0xab);
    sys.BGERAS();
    for (let i = 0; i < 152; i++) {
        const addr = 0x5000 + i * 3;
        assert.equal(video.read8(addr), 0);
        assert.equal(video.read8(addr + 1), 0);
    }
    assert.equal(video.read8(0x8000), 0xab);
});
test('source-referenced original terrain outputs are deterministic for a fixed BGL', () => {
    const a = setup(0x2e60), b = setup(0x2e60);
    for (const t of [a, b]) {
        t.sys.BGINIT();
        t.sys.BGOUT();
        t.sys.BGALT();
    }
    assert.deepEqual([...a.video.data], [...b.video.data]);
    assert.deepEqual([...a.bank.data], [...b.bank.data]);
});
test('rejects missing/synthetic terrain data without pretending that it is source', () => {
    assert.throws(() => setup(0x2000, new Uint8Array(255)), /256-byte/);
});
