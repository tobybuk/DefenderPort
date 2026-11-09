/**
 * DEFB6.SRC SCLR1 / SC0LP / SC1LP, pinned Red Label source at
 * e74006344b16d19245510b5e55780f90d7606bb8 lines 1436-1458.
 *
 * Clear only the playfield (YMIN..255, byte columns 0..0x9b), preserving
 * the scanner and score artwork above YMIN. This translates the byte-write
 * effect of the PSHU zero-register bursts, NOT a separate Canvas clear.
 */
export function createDefb6ActiveScreenClearRoutines(video, Layout) {
    const ymin = Layout.at('YMIN');
    function SCLR1() {
        for (let col = 0; col < 0x9c; col++)
            for (let y = ymin; y < 256; y++)
                video.write8((col << 8) | y, 0);
    }
    return Object.freeze({ SCLR1 });
}
