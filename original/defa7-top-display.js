/**
 * Pinned original: mwenge/defender e740063, src/defa7.src BORDER
 * Source heading `BORDER` (immediately after `SBDISP`); compare the
 * original label and the three BORDLP/BORD1/BORD2/BORD3 loops.
 *
 * This is a direct byte-write transliteration of BORDER only. The original
 * TDISP, score, scanner, and `CWRIT` calls are NOT implemented here.
 * Video memory writes are the original (column<<8)|scanline operations.
 */
export const TOP_DISPLAY_EQU = Object.freeze({
    SCANH: 42 - 34, // phr6.src: SCANH EQU YMIN-34
    SCANER: 0x3000 + (42 - 34), // phr6.src: SCANER EQU $3000+SCANH
});
export function createDefa7TopDisplayRoutines(video) {
    const { SCANH, SCANER } = TOP_DISPLAY_EQU;
    const wr8 = (address, value) => video.write8(address & 0xffff, value);
    const wr16 = (address, value) => {
        wr8(address, value >>> 8);
        wr8(address + 1, value);
    };
    /** Exactly the three original BORDER loops, including their original bounds. */
    function BORDER() {
        const D = 0x5555;
        // BORDLP: LDX #SCANH+$20; STD ,X; LEAX $100,X; CMPX #$9C00
        for (let X = SCANH + 0x20; X < 0x9c00; X += 0x100)
            wr16(X, D);
        // BORD1: LDX #SCANER-$100; STD $4100,X; STD ,X++
        for (let X = SCANER - 0x100; X < SCANER - 0x100 + 0x20; X += 2) {
            wr16(X + 0x4100, D);
            wr16(X, D);
        }
        // BORD2: LDX #SCANER-$101; STA ,X; LEAX $100,X
        for (let X = SCANER - 0x101; X < SCANER - 1 + 0x4100; X += 0x100)
            wr8(X, 0x55);
        // BORD3: original centre/view marker, *two* word writes per column
        for (let X = 0x4c00 + SCANH - 1; X < 0x5400 + SCANH - 1; X += 0x100) {
            wr16(X, 0x9999);
            wr16(X + 0x21, 0x9999);
        }
    }
    return Object.freeze({ BORDER });
}
