/**
 * Source-instruction CPU time accounting for the Defender appearance path.
 * Source: SAMEXAP7.SRC EXPU, EERASE, EWRITE and Motorola M6809PM appendix F.
 *
 * This is a conservative path-dependent cycle BUDGET, not an emulator.
 * We count the hot indexed-indirect loops exactly for the encountered
 * memory blocks, and estimate the surrounding fixed-path control flow.
 * We do NOT pretend that it includes unrelated IRQ/LOGO/MESS0 work or
 * all indexed branch variants. The incomplete quantities are exposed in
 * STAGE50 audit rather than disguised as a timing multiplier.
 */
export const DEFENDER_6809_HZ = 1000000;
export const DEFENDER_VIDEO_CYCLES = 16640;
// EERAS1: STD [,X++] (5+6), CMPX DP (6), BNE (3).
export const EERASE_BLOCK_CYCLES = 20;
// STRTxx: STD ,--U (5+3), LDY ,X++ (6+3), STY [,U]
// (6+3), ADDB direct (4), BCS (3).
export const EWRITE_BLOCK_CYCLES = 33;
// EWRITE's EXPN9 entry/next-column branch, excluding the above blocks.
export const EWRITE_COLUMN_CYCLES = 42;
// Includes the EWRITE setup (`PSHS ...`, descriptor, SIZE, MUL, offsets,
// STARTS) and the DONE epilogue, counted from the normal even-height path.
// Paths with negative/start-offscreen clipping differ and remain a bound.
export const EWRITE_FIXED_CYCLES = 218;
// EERASE prologue, no-block test, pointer reset and return.
export const EERASE_FIXED_CYCLES = 48;
// EXPU4, EXPU7 arithmetic including its two MULs, plus slot selection and
// subsequent EXPU9; excludes EERASE/EWRITE which are itemised separately.
export const EXPU_APPEAR_CYCLES = 126;
// EXPU1/EXPU2/EXPU9 for inactive RAM allocations.
export const EXPU_IDLE_CYCLES = 29;
export function eraseCost(blocks) {
    return EERASE_FIXED_CYCLES + blocks * EERASE_BLOCK_CYCLES;
}
export function writeCost({ blocks, columns = 0, clippedColumns = 0, clippedRows = 0 }) {
    return EWRITE_FIXED_CYCLES + blocks * EWRITE_BLOCK_CYCLES +
        columns * EWRITE_COLUMN_CYCLES + clippedColumns * 23 + clippedRows * 18;
}
export function appearCost({ blocks, eraseBlocks, columns = 0, clippedColumns = 0, clippedRows = 0 }) {
    return EXPU_APPEAR_CYCLES + eraseCost(eraseBlocks) + writeCost({ blocks, columns, clippedColumns, clippedRows });
}
