/**
 * AMODE1.SRC SCNR/SCNR0/MT1/MTLP/MTX/SCNR10/SCNR2/SCNR3
 * Source e740063 lines ~1159-1255. This is original scanner framebuffer
 * logic, not a CSS/Canvas miniature-map recreation.
 *
 * MTERR is supplied as the ORIGINAL 384 source data bytes from BLK71.SRC.
 * Stage 9 bundles the source table in blk71-data.js and independently
 * checks its bytes using tools/verify-blk71.mjs with the pinned checkout.
 *
 * WARNING: original scanner is not yet verified against the arcade framebuffer.
 * Routine names and shared RAM are retained; the MTERR data is now present.
 */
export function createAmode1ScannerRoutines(RAM, Layout, video, { MTERR } = {}) {
    const at = n => Layout.at(n), R = n => RAM.read8(at(n)), W = (n, v) => RAM.write8(at(n), v);
    const r16 = a => RAM.read16(a & 65535), w16 = (a, v) => RAM.write16(a & 65535, v);
    const vr = a => video.read8(a & 65535), vw = (a, v) => video.write8(a & 65535, v);
    const video16 = (a, v) => {
        vw(a, v >>> 8);
        vw(a + 1, v);
    };
    const BASE = 0x3008, SCANH = 8, SETAB = at('SETAB'), STETAB = at('STETAB');
    const MAX_PTS = Math.floor((at('STETAB') - SETAB - 2) / 2);
    // SCNR2 uses the same shift on A and B as two separate 6809 registers,
    // not a 16-bit arithmetic shift. It discards the low X-world byte.
    function SCNR2(offsetX, OY16, colour, U) {
        const A = ((offsetX >>> 8) & 255) >>> 2;
        const B = (OY16 & 255) >>> 3;
        const screen = (((A << 8) | B) + (BASE - 1)) & 65535;
        w16(U, screen);
        video16(screen, colour);
        return (U + 2) & 65535;
    }
    function SCNR10(object, U, left) {
        const diff = (r16(object + at('OX16')) - left) & 65535;
        const y = RAM.read8(object + at('OY16'));
        const colour = r16(object + at('OBJCOL'));
        return SCNR2(diff, y, colour, U);
    }
    function SCNR3(listHead, U, left) {
        let X = r16(listHead), count = 0;
        while (X !== 0) {
            if (++count > 95)
                throw new Error('SCNR object list exceeds original 95-entry bound');
            if (U >= SETAB + (MAX_PTS * 2))
                throw new Error('SCNR SETAB capacity reached');
            U = SCNR10(X, U, left);
            X = r16(X); // SCNR3: LDX ,X; BNE SCNR10
        }
        return U;
    }
    function MT1() {
        const left = (r16(at('BGL')) - (0x8000 - 150 * 32)) & 65535;
        W('XTEMP', left >>> 8);
        RAM.write8(at('XTEMP') + 1, left & 255);
        // LSRA twice (source shifts only the high byte), then MUL by three.
        const start = (((left >>> 8) & 255) >>> 2) * 3;
        if (R('STATUS') & 2)
            return left;
        if (!(MTERR instanceof Uint8Array) || MTERR.length !== 384)
            throw new Error('MT1 requires original 384-byte MTERR from pinned BLK71.SRC; no invented terrain');
        if (start + 192 > MTERR.length)
            throw new Error('MTERR offset outside original table');
        let A = 0x30;
        for (let i = 0; i < 64; i++) {
            const old = r16(STETAB + i * 2);
            video16(old, 0); // source STX [,Y], including original zero-pointer writes
            const B = MTERR[start + i * 3], X = (MTERR[start + i * 3 + 1] << 8) | MTERR[start + i * 3 + 2];
            const target = ((A << 8) | B) & 65535;
            w16(STETAB + i * 2, target);
            video16(target, X);
            A = (A + 1) & 255;
        }
        return left;
    }
    function MTX() {
        video16(SCANH + 0x4c01, 0x9090);
        video16(SCANH + 0x4c01 + 0x1d, 0x9090);
        video16(SCANH + 0x5301, 0x0909);
        video16(SCANH + 0x5301 + 0x1d, 0x0909);
    }
    function SCNR() {
        // Erase old object blips, four 2-byte pointers per eight-byte group.
        // SCNR0 is a do/while in the original; it erases at least one group.
        const end = r16(at('SETEND'));
        if (end && (end < SETAB || end > SETAB + MAX_PTS * 2 || ((end - SETAB) & 1) !== 0))
            throw new Error('Uninitialised/corrupt SETEND from original scanner state');
        let Y = SETAB;
        do {
            for (let i = 0; i < 4; i++)
                video16(r16(Y + i * 2), 0);
            Y += 8;
        } while (Y < end);
        // Erase old player marker from its saved video pointer.
        const previous = r16(end || SETAB);
        if (previous) {
            video16(previous, 0);
            vw(previous + 2, 0);
            video16(previous - 0x100, 0);
        }
        const left = MT1();
        MTX();
        let U = SETAB;
        U = SCNR3(at('OPTR'), U, left);
        U = SCNR3(at('IPTR'), U, left);
        w16(at('SETEND'), U);
        // Source reads PLAXC/PLAYC as adjacent bytes (D) and shifts independently.
        const A = (R('PLAXC') >>> 4) & 255, B = R('PLAYC') >>> 3;
        const screen = (((A << 8) | B) + (0x4b00 + SCANH - 1)) & 65535;
        w16(U, screen);
        video16(screen, 0x9099);
        vw(screen + 2, 0x90);
        vw(screen - 0xff, 0x09);
        return { left, objects: (U - SETAB) / 2, playerPointer: screen };
    }
    return Object.freeze({ SCNR, SCNR2, SCNR10, SCNR3, MT1, MTX });
}
