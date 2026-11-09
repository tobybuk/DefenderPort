/**
 * Source-faithful translations from DEFA7.SRC lines 2603–2696 and 2738–2757:
 *   SHELL, SHELL1, SHELLP, SHELLX, SHBD,
 *   GETSHL, STSHX, BMBOUT, SHB1, FBOUT, SHFB1, SHSCAN, SHSC1, SHSCK, SHSCLP.
 *
 * No invented shell physics. OXV/OYV/OX16/OY16 and OLINK are 16-bit
 * source RAM fields. Output dispatch uses source OPICT/OBJCOL pointers;
 * unsupported original output routines throw. No processor is emulated.
 */
import { u16 } from '../runtime/integers.js';
export function createDefa7ShellRoutines(RAM, Layout, video, { resolveOutput, OFSHIT } = {}) {
    const a = n => Layout.at(n), off = (X, n) => u16(X + a(n));
    const r8 = (X, n) => RAM.read8(off(X, n)), r16 = (X, n) => RAM.read16(off(X, n));
    const w8 = (X, n, v) => RAM.write8(off(X, n), v), w16 = (X, n, v) => RAM.write16(off(X, n), v);
    const wr = (p, v) => video.write8(u16(p), v), rd = p => RAM.read8(u16(p));
    function clear23(Y) {
        // SHBD and BMBOUT/FBOUT erase 2 columns of three raster bytes.
        for (const column of [0, 0x100])
            for (let row = 0; row < 3; row++)
                wr(Y + column + row, 0);
    }
    function BMBOUT(X, Y) {
        let U = RAM.read16(a('BAX'));
        if (RAM.read8(off(X, 'OX16') + 1) & 0x80)
            U = u16(U + 6);
        clear23(Y);
        const target = r16(X, 'OBJX');
        wr(target, rd(U));
        wr(target + 1, rd(U + 1));
        wr(target + 2, rd(U + 2));
        wr(target + 0x100, rd(U + 3));
        wr(target + 0x101, rd(U + 4));
        wr(target + 0x102, rd(U + 5));
    }
    function FBOUT(X, Y) {
        const U = RAM.read16(a('FBX'));
        const odd = (RAM.read8(off(X, 'OX16') + 1) & 0x80) !== 0;
        clear23(Y);
        const dest = r16(X, 'OBJX');
        if (!odd) {
            wr(dest, rd(U) & 0x0f);
            wr(dest + 1, rd(U + 1));
            wr(dest + 2, rd(U + 2) & 0x0f);
            wr(dest + 0x101, rd(U + 3) & 0xf0);
        }
        else {
            wr(dest + 1, rd(U + 1) & 0x0f);
            wr(dest + 0x102, rd(U) & 0xf0);
            wr(dest + 0x100, rd(U + 2) & 0xf0);
            wr(dest + 0x101, rd(U + 3));
        }
    }
    function SHBD(X, Y) {
        RAM.write8(off(X, 'ODATA') + 1, 0);
        clear23(Y);
    }
    function dispatch(X, Y) {
        const addr = r16(X, 'OBJCOL');
        const out = typeof resolveOutput === 'function' ? resolveOutput(addr) : null;
        if (typeof out !== 'function')
            throw new Error(`SHELL reached unresolved original OBJCOL output pointer $${addr.toString(16)}`);
        out(X, Y);
    }
    /** GETSHL — inline three-word source descriptor is supplied by caller.
     * X=original shooter object, U=original owner process. Success returns
     * allocated shell pointer; null stands for source zero-result failure.
     * The 6809 return-address skip over those six literal bytes is represented
     * by passing {OBJCOL,OPICT,OCVECT}; it is not executable JS source data.
     */
    function GETSHL(shooterX, ownerU, descriptor) {
        if (!descriptor || ![descriptor.OBJCOL, descriptor.OPICT, descriptor.OCVECT].every(Number.isInteger))
            throw new Error('GETSHL requires original three-word inline call descriptor');
        if (RAM.read8(a('BMBCNT')) >= 20)
            return null;
        const dx = u16(r16(shooterX, 'OX16') - RAM.read16(a('BGL')));
        if (dx >= 150 * 64)
            return null;
        const visualX = u16(dx << 2) >>> 8, visualY = r8(shooterX, 'OY16');
        if (visualY <= a('YMIN'))
            return null;
        const X = RAM.read16(a('OFREE'));
        if (X === 0)
            return null;
        const screenAddress = (visualX << 8) | visualY;
        w16(X, 'OBJX', screenAddress);
        w16(X, 'OX16', screenAddress);
        // EXG A,B; STD OY16,X: original Y is high byte, X screen byte low.
        w16(X, 'OY16', (visualY << 8) | visualX);
        w16(X, 'OBJID', ownerU);
        w16(X, 'OXV', 0);
        w16(X, 'OYV', 0);
        w16(X, 'OBJCOL', descriptor.OBJCOL);
        w16(X, 'OPICT', descriptor.OPICT);
        w16(X, 'OCVECT', descriptor.OCVECT);
        w8(X, 'ODATA', 20);
        RAM.write8(off(X, 'ODATA') + 1, 20);
        RAM.write16(a('OFREE'), r16(X, 'OLINK'));
        w16(X, 'OLINK', RAM.read16(a('SPTR')));
        RAM.write16(a('SPTR'), X);
        RAM.write8(a('BMBCNT'), (RAM.read8(a('BMBCNT')) + 1) & 255);
        return X;
    }
    function SHELL() {
        if (RAM.read8(a('STATUS')) & 0x20)
            return;
        // Source BGL low five bits are masked before scroll-delta calculation.
        const SHTEMP = u16(((RAM.read16(a('BGLX')) & 0xffe0) - (RAM.read16(a('BGL')) & 0xffe0)) << 2);
        RAM.write16(a('SHTEMP'), SHTEMP);
        let X = RAM.read16(a('SPTR'));
        const seen = new Set();
        while (X) {
            if (seen.has(X) || seen.size >= 95)
                throw Error('SHELL invalid source shell list');
            seen.add(X);
            const oldAddress = r16(X, 'OBJX');
            const newY = u16(r16(X, 'OYV') + r16(X, 'OY16'));
            if ((newY >>> 8) <= a('YMIN')) {
                SHBD(X, oldAddress);
                X = r16(X, 'OLINK');
                continue;
            }
            w16(X, 'OY16', newY);
            const newX = u16(r16(X, 'OXV') + SHTEMP + r16(X, 'OX16'));
            if ((newX >>> 8) >= 0x98) {
                SHBD(X, oldAddress);
                X = r16(X, 'OLINK');
                continue;
            }
            w16(X, 'OX16', newX);
            const display = ((newX >>> 8) << 8) | (newY >>> 8);
            w16(X, 'OBJX', display);
            dispatch(X, oldAddress);
            X = r16(X, 'OLINK');
        }
    }
    function SHSCAN() {
        let prev = a('SPTR'), X = RAM.read16(prev);
        const seen = new Set();
        while (X) {
            if (seen.has(X) || seen.size >= 95)
                throw Error('SHSCAN invalid source shell list');
            seen.add(X);
            if (RAM.read8(off(X, 'ODATA') + 1) !== 0) {
                const life = (r8(X, 'ODATA') - 1) & 255;
                w8(X, 'ODATA', life);
                if (life !== 0) {
                    prev = X;
                    X = r16(X, 'OLINK');
                    continue;
                }
            }
            // Source SHSCK unlinks into OFREE before erasing and decrementing BMBCNT.
            RAM.write16(prev, r16(X, 'OLINK'));
            w16(X, 'OLINK', RAM.read16(a('OFREE')));
            RAM.write16(a('OFREE'), X);
            if (typeof OFSHIT !== 'function')
                throw Error('SHSCAN reached untranslated OFSHIT');
            OFSHIT(X);
            RAM.write8(a('BMBCNT'), (RAM.read8(a('BMBCNT')) - 1) & 255);
            X = RAM.read16(prev);
        }
    }
    return Object.freeze({ GETSHL, SHELL, SHBD, BMBOUT, FBOUT, SHSCAN });
}
