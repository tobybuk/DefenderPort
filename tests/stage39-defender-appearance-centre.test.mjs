/**
 * Stage 39: verify the DEFENDER title animation against the original
 * SAMEXAP7.SRC EXPU7 6809 register arithmetic, not against the previous
 * JavaScript rendering (which was already incorrect).
 *
 * Red Label pinned source:
 * AMODE1.SRC DEFENS/DEF1–DEF2 at lines 791–826;
 * SAMEXAP7.SRC EXPU4–EXPU9 at lines 160–202.
 * See docs/STAGE39_DEFENDER_ANIMATION_FIX.md for the register trace.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createAmode1Attract } from '../original/amode1-attract.js';
import { SAMEX_RAM as S } from '../original/samexap7-explosion-start.js';
function firstAppearanceFrame() {
    const attract = createAmode1Attract();
    while (attract.STATE().defenderAge < 1)
        attract.STEP();
    return attract;
}
// The original 6809 EXPU7 LDB replaces the low product byte AFTER MUL.
// This reference function deliberately describes the instructions in order.
function originalEXPU7Center(top, width, height) {
    let A = top >>> 8;
    let B = 0xda;
    let D = A * B; // MUL: D (A high, B low)
    A = (D >>> 8) << 1; // ASLA modifies A, not full D
    A &= 0xff;
    B = width;
    D = A * B; // second MUL: D (16-bit product)
    B = height >>> 1; // LDB 1,U ; LSRB: discard the *low* product byte
    D = (D & 0xff00) | B;
    return (D + top) & 0xffff; // ADDD TOPLFT,Y
}
test('DEFENS retains 15 exact source descriptors, 4x12 bytes separated by 4x24 in DEFBLK', () => {
    const a = firstAppearanceFrame();
    const DEFDSC = 0xb300, DEFRAM = DEFDSC + 4, DEFPIC = DEFRAM + 15 * 14, DEFBLK = DEFPIC + 15 * 4;
    assert.equal(a.STATE().defenderSlices, 15);
    for (let i = 0; i < 15; i++) {
        const descriptor = DEFPIC + i * 4;
        assert.equal(a.ram.read8(descriptor), 4);
        assert.equal(a.ram.read8(descriptor + 1), 12);
        // Source BLKLEN is only 14 bytes, although APST writes OTYP at +20.
        // The LAST object's OTYP therefore aliases the second descriptor's
        // data pointer high byte. Preserve this source RAM write rather than
        // silently "repairing" it in the underlying memory representation.
        if (i === 1) {
            assert.equal(a.ram.read16(descriptor + 2), 0x0272);
        }
        else {
            assert.equal(a.ram.read16(descriptor + 2), DEFBLK + i * 4 * 24);
        }
    }
});
test('EXPU7 computes the original high-byte centre for all fifteen title fragments', () => {
    const a = firstAppearanceFrame();
    assert.equal(a.STATE().defenderAge, 1);
    const spots = [];
    for (let i = 0; i < 15; i++) {
        const Y = S.RAMALS + i * S.RAMSIZ;
        assert.equal(a.ram.read16(Y + S.RSIZE), 0xae00, 'appearance starts at $AF00, then decrements one $100');
        const top = a.ram.read16(Y + S.TOPLFT);
        assert.equal(top, ((0x30 + i * 4) << 8) | 0x98);
        const center = a.ram.read16(Y + S.CENTER);
        assert.equal(center, originalEXPU7Center(top, 4, 12), `fragment ${i} must preserve the 6809 MUL/ASLA/LDB high byte`);
        spots.push(center);
    }
    assert.equal(spots[0], 0x319e, 'first fragment is centred near its actual x=48 column');
    assert.equal(spots[7], 0x4e9e);
    assert.equal(spots[14], 0x6a9e, 'last fragment is centred near its actual x=104 column');
});
test('DEFENDER fragments appear in the correct screen area on the first appearance frame', () => {
    const a = firstAppearanceFrame();
    let visible = 0, left = 255, right = 0;
    // Source EWRITE writes near y=$9E on the initial large-size step.
    for (let x = 0; x <= 0x98; x++) {
        const v = a.video.read8((x << 8) | 0x9e);
        if (v === 0x22 || v === 0xcc) {
            visible++;
            left = Math.min(left, x);
            right = Math.max(right, x);
        }
    }
    assert.ok(visible >= 10, `source title fragments should already be visible on first frame (${visible})`);
    assert.ok(left < 24 && right > 120, `early fragments should be spread over the display (${left}..${right})`);
    // Original DEFENS sleeps $2E *from its process wake-up*, not from the
    // following XUVCT. The next 44 steps bring age 45 (no full restore).
    for (let i = 0; i < 44; i++)
        a.STEP();
    assert.equal(a.STATE().defenderPhase, 'appearing');
    a.STEP();
    assert.equal(a.STATE().defenderPhase, 'restoring');
});
