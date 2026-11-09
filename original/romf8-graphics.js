/**
 * Source-faithful JS translation of Williams Defender ROMF8.SRC's
 * CWRIT/CWRT00/CWRT0/CWRT1/CWRT2/CWRT3, COFF/COFFA/COFF00/COFF0/
 * COFF1/COFF2/COFF3, BLKCLR and SCRCLR/SCLRLP (pinned commit e740063).
 *
 * The assembly alternates 16-bit and 8-bit stores for even/odd descriptor
 * lengths. A JavaScript byte loop has the IDENTICAL video-write sequence and
 * leaves original 6809 branch/descriptor boundaries documented here. These
 * functions do not draw Canvas graphics or invent glyph bitmap data.
 *
 * Descriptor is 4 bytes: width, height, 16-bit big-endian DATA pointer.
 * The source bytes must be inserted into a JS data-memory image by the
 * translation tooling. No ROM is interpreted or loaded at runtime.
 */
export function createRomf8GraphicsRoutines(video, sourceMemory) {
    const read8 = address => sourceMemory.read8(address & 0xffff);
    const read16 = address => ((read8(address) << 8) | read8(address + 1));
    const write = (address, byte) => video.write8(address & 0xffff, byte);
    function descriptor(Y) {
        const width = read8(Y), height = read8(Y + 1), data = read16(Y + 2);
        if (!width || !height)
            throw new Error('Original CWRIT/COFF descriptor with zero width/height would underflow 6809 loop');
        return { width, height, data };
    }
    /** CWRIT — D=video starting byte address, Y=original object descriptor. */
    function CWRIT(D, Y) {
        const { width, height, data } = descriptor(Y);
        // Equivalent to original even/odd PSHU/STU data loop, one source column
        // per 0x100 video address, with the picture bytes unmodified.
        for (let column = 0; column < width; column++)
            for (let y = 0; y < height; y++)
                write((D + column * 0x100 + y) & 0xffff, read8((data + column * height + y) & 0xffff));
    }
    /** COFF — erase rectangle using width/height in source descriptor Y. */
    function COFF(D, Y) {
        const { width, height } = descriptor(Y);
        return COFFA(D, width, height);
    }
    /** COFFA — original shared entry with width=A, height=B, X=video address. */
    function COFFA(X, A, B) {
        const width = A & 255, height = B & 255;
        if (!width || !height)
            throw new Error('Original COFFA zero-size loop would underflow');
        for (let column = 0; column < width; column++)
            for (let y = 0; y < height; y++)
                write((X + column * 0x100 + y) & 0xffff, 0);
    }
    /** BLKCLR — source JSR into COFFA with X=address, D=(width,height). */
    function BLKCLR(X, A, B) {
        return COFFA(X, A, B);
    }
    /** SCRCLR — ROMF8 clears video bytes $0000 through $9BFF inclusive. */
    function SCRCLR() {
        for (let addr = 0; addr < 0x9c00; addr++)
            write(addr, 0);
    }
    return Object.freeze({ CWRIT, COFF, COFFA, BLKCLR, SCRCLR });
}
