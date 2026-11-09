/**
 * Native JavaScript translation of the Williams Defender Red Label player
 * drawing entry points, from pinned DEFA7.SRC.
 *
 * Source / entry points:
 *   ON86, ON860       DEFA7.SRC 373–404
 *   OFF86            DEFA7.SRC 408–429
 *   THOUT, THOUTX    DEFA7.SRC 2213–2238
 *   THOUT1, THT1X    DEFA7.SRC 2242–2259
 *   THOFF1           DEFA7.SRC 2263–2274
 *   THOFF            DEFA7.SRC 2278–2289
 *   PRDISP, PRDSP1, PRDSP2, PRDSP3, PRDX  DEFA7.SRC 2293–2316
 *   POUT, POUT1, POUT2, POFF, POFF1       DEFA7.SRC 2320–2333
 *
 * Geometry is NOT guessed: PLAPIC/PLBPIC contain 8 VIDEO BYTES (columns)
 * by 6 raster rows, with TWO 4-bit colours per byte, horizontally adjacent.
 * The previous Stage 3 diagnostic incorrectly decoded nibbles VERTICALLY
 * and produced an 8x12 portrait instead of a 16x6 horizontal spaceship.
 *
 * The browser is forbidden from redrawing ships directly from data. These
 * functions write to the original column-major graphics address space;
 * browser/presenter.js only copies those bytes to a pixel buffer.
 *
 * Numeric source instructions are translated to typed array operations.
 * This is NOT a 6809 CPU emulator. The full IRQ scanline scheduler and
 * original hardware palette remain untranslated and unverified.
 */
import { u16 } from '../runtime/integers.js';
import { PLAPIC, PLBPIC } from './defb6-player-data.js';
export function createDefa7PlayerVideoRoutines(RAM, Layout, video) {
    const a = n => Layout.at(n), r8 = n => RAM.read8(a(n)), r16 = n => RAM.read16(a(n));
    const w16 = (n, value) => RAM.write16(a(n), value);
    const wr = (address, value) => video.write8(u16(address), value);
    const rd = address => RAM.read8(u16(address));
    const set16 = (address, value) => {
        wr(address, value >>> 8);
        wr(address + 1, value);
    };
    const blank = (address, length) => {
        for (let i = 0; i < length; i++)
            wr(address + i, 0);
    };
    /** ON86 / ON860: D=video address; Y=original picture descriptor; C=odd pixel phase.
     * A PSHS/PULS six-byte transfer is transliterated as a six-byte COPY,
     * NOT as six vertical colour-pair pixels. Each byte holds TWO horizontal pixels.
     */
    function ON86(D, Y, carry = false) {
        const pict = Y.phases[carry ? 1 : 0];
        if (pict.length !== 48)
            throw new RangeError('ON86 requires original 8-column × 6-byte picture');
        const xbyte = D >>> 8, y = D & 255;
        // LDB (+6); TFR D,U; PSHU(6); LEAU 262,U. The resulting destination
        // of each column is (xbyte+col)<<8|(y+row), no vertical nibble splitting.
        for (let col = 0; col < 8; col++)
            for (let row = 0; row < 6; row++) {
                wr((((xbyte + col) & 255) << 8) | ((y + row) & 255), pict[col * 6 + row]);
            }
    }
    /** OFF86: same eight 6-byte video columns, filled with zero. */
    function OFF86(D) {
        const xbyte = D >>> 8, y = D & 255;
        for (let col = 0; col < 8; col++)
            for (let row = 0; row < 6; row++) {
                wr((((xbyte + col) & 255) << 8) | ((y + row) & 255), 0);
            }
    }
    /** THOUT / THOUTX: draw the source's left-side thrust bits from THTAB.
     * Offsets are exactly the 6809 U-relative graphics byte addresses.
     */
    function THOUT() {
        const X = r16('THX'), U = u16(r16('PLAXC') - 0x100 + 1);
        set16(U, RAM.read16(X));
        wr(U + 2, rd(X + 5));
        wr(U + 3, rd(X + 9));
        wr(U + 4, rd(X + 12));
        if (!(r8('PIA21') & 2))
            return;
        wr(U - 0x100 + 1, rd(X + 3));
        wr(U - 0x100 + 2, rd(X + 6));
        wr(U - 0x100 + 3, rd(X + 10));
        wr(U - 0x200 + 1, rd(X + 4));
        wr(U - 0x200 + 2, rd(X + 7));
        wr(U - 0x200 + 3, rd(X + 11));
        wr(U - 0x300 + 2, rd(X + 8));
    }
    /** THOUT1 / THT1X: the corresponding original right-side thrust pattern. */
    function THOUT1() {
        let U = r16('THX');
        const X = u16(r16('PLAXC') + 0x801);
        // PULU D,Y loads 4 bytes, then PULU D,Y another 4; the source
        // writes five bytes in the first column even when not thrusting.
        for (let i = 0; i < 5; i++)
            wr(X + i, rd(U + i));
        if (!(r8('PIA21') & 2))
            return;
        wr(X + 0x101, rd(U + 5));
        wr(X + 0x102, rd(U + 6));
        wr(X + 0x103, rd(U + 7));
        U = u16(U + 8);
        wr(X + 0x201, rd(U + 2));
        wr(X + 0x202, rd(U + 3));
        wr(X + 0x203, rd(U));
        wr(X + 0x302, rd(U + 1));
    }
    /** THOFF1: remove old right-facing thrust bitmap. */
    function THOFF1() {
        const U = u16(r16('PLAXC') + 0x801);
        blank(U, 5);
        blank(U + 0x101, 3);
        blank(U + 0x201, 3);
        wr(U + 0x302, 0);
    }
    /** THOFF: remove old left-facing thrust bitmap. */
    function THOFF() {
        const U = u16(r16('PLAXC') - 0x100 + 1);
        blank(U, 5);
        blank(U - 0x100 + 1, 3);
        blank(U - 0x200 + 1, 3);
        wr(U - 0x300 + 2, 0);
    }
    /** POUT / POUT2: same data and phases as the original player output. */
    function POUT() {
        const D = r16('NPLAXC');
        w16('PLAXC', D);
        ON86(D, PLAPIC, (RAM.read8(a('PLAX16') + 1) & 0x80) !== 0);
    }
    /** POUT1: alternate original PLBPIC data. */
    function POUT1() {
        const D = r16('NPLAXC');
        w16('PLAXC', D);
        ON86(D, PLBPIC, (RAM.read8(a('PLAX16') + 1) & 0x80) !== 0);
    }
    /** POFF / POFF1: both call OFF86 in the original code. */
    function POFF() {
        OFF86(r16('PLAXC'));
    }
    function POFF1() {
        OFF86(r16('PLAXC'));
    }
    /** PRDISP / PRDSP1–3, PRDX. A and B are scanline limits supplied by
     * the IRQ in the original program. A full IRQ port is still outstanding.
     */
    function PRDISP(A, B) {
        RAM.write8(a('TEMP48'), A);
        if (r8('STATUS') & 0x10)
            return;
        const y = r8('PLAYC');
        if ((A & 255) <= y || (B & 255) > y)
            return;
        if (r8('PLADIR') & 0x80) {
            POFF1();
            THOFF1();
        } // PRDSP1
        else {
            POFF();
            THOFF();
        }
        w16('PLADIR', r16('NPLAD')); // PRDSP2
        if (r8('PLADIR') & 0x80) {
            POUT1();
            THOUT1();
        } // PRDSP3
        else {
            POUT();
            THOUT();
        }
    }
    return Object.freeze({ ON86, OFF86, THOUT, THOUT1, THOFF, THOFF1, PRDISP, POUT, POUT1, POFF, POFF1 });
}
