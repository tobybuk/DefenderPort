/**
 * BLK71.SRC (pinned e74006344b16d19245510b5e55780f90d7606bb8)
 * Native JavaScript translations of original terrain routines.
 * Original names: BGINIT, BGOUT, BGALT, BGERAS, ADDL01, ADDR01,
 * RFONL1, RFONR1, LFONL1, LFONR1. Branch labels TGEN*, TTER*,
 * ADDLxx and ADDRxx, ALTTxx remain as comments where they are not entry points.
 *
 * Original source: https://github.com/mwenge/defender/blob/e74006344b16d19245510b5e55780f90d7606bb8/src/blk71.src
 * - original lines 94-148: BGINIT
 * - original lines 153-231: BGOUT (fast output loop expanded)
 * - original lines 235-368: ADDL01 and ADDR01
 * - original lines 373-408: BGALT/BGERAS
 * - original lines 412-504: directional bit readers
 *
 * TRANSLATION BOUNDARIES:
 * (1) BLK71's bank-local $A000/$B300 RAM is distinct from PHR6 shared RAM;
 *     the explicit terrainBank parameter retains this hardware bank separation.
 * (2) TDATA pointer stored in bank RAM is SOURCE-RELATIVE (0..255) because the
 *     absolute assembled address depends on ROM layout; wrapping and the
 *     original bit-reader arithmetic are preserved. Not a 6809 emulator.
 * (3) Source's first TTER03 instruction was patched from STX [,Y] to COMF
 *     for the released build. We model the *documented* STX [,Y] intended
 *     framebuffer erase. This is NOT yet original-ROM execution equivalence.
 * (4) BGOUT's video is a separate column-oriented framebuffer. Every write
 *     follows the original STBL and terrain flavour table order; there is
 *     no invented terrain drawing algorithm.
 */
import { s16, u16 } from '../runtime/integers.js';
import { RAM } from '../runtime/ram.js';
import { TDATA, MTERR } from './blk71-data.js';
export const BLK71_ADDR = Object.freeze({
    TEMP1A: 0xa000, TEMP1B: 0xa001, TEMP1C: 0xa002, TEMP2A: 0xa003,
    TTBLP0: 0xa005, TTBLP1: 0xa007, LTPTR: 0xa009, RTPTR: 0xa00b,
    LTBYTE: 0xa00d, RTBYTE: 0xa00e, LTCNT: 0xa00f, RTCNT: 0xa010,
    LOFF: 0xa011, ROFF: 0xa012, SSTACK: 0xa013, BGLX: 0xa015,
    TEMP2B: 0xa017,
    BGL: 0xa020, ALTTBL: 0xb300, TERTF0: 0xb700, TERTF1: 0xba90,
    STBL: 0xbe20, TLEN: 0x100, FLAVOUR_LENGTH: 0x1c8,
});
export function createBlk71TerrainRoutines(gameRAM, video, { terrainBank = new RAM(), terrainData = TDATA } = {}) {
    if (!(terrainData instanceof Uint8Array) || terrainData.length !== 256)
        throw new Error('BLK71 requires source-derived 256-byte TDATA');
    const m = BLK71_ADDR, b = terrainBank;
    const r8 = n => b.read8(m[n]), w8 = (n, v) => b.write8(m[n], v);
    const r16 = n => b.read16(m[n]), w16 = (n, v) => b.write16(m[n], v);
    const wVideo16 = (address, value) => {
        video.write8(address, value >>> 8);
        video.write8(address + 1, value);
    };
    const readTD = ptr => terrainData[ptr & 255];
    const currentBGL = () => gameRAM.read16(m.BGL);
    const sgn = v => (v & 0x80) !== 0;
    const rotateLeft = v => ((v << 1) | (v >>> 7)) & 255;
    const rotateRight = v => ((v >>> 1) | ((v & 1) << 7)) & 255;
    // RFONL1: right-shift WORLD bitstream access on the LEFT side, source 412–430.
    function RFONL1() {
        if (r8('LTCNT')) {
            w8('LTCNT', (r8('LTCNT') - 1) & 255);
            const A = rotateLeft(r8('LTBYTE'));
            w8('LTBYTE', A);
            return A;
        }
        const U = (r16('LTPTR') + 1) & 255;
        w16('LTPTR', U);
        w8('LTCNT', 7);
        const A = readTD(U);
        w8('LTBYTE', A);
        return A;
    }
    // RFONR1: right terrain stream, source 433–452.
    function RFONR1() {
        if (r8('RTCNT')) {
            w8('RTCNT', (r8('RTCNT') - 1) & 255);
            const A = rotateLeft(r8('RTBYTE'));
            w8('RTBYTE', A);
            return A;
        }
        const U = (r16('RTPTR') + 1) & 255;
        w16('RTPTR', U);
        w8('RTCNT', 7);
        const A = readTD(U);
        w8('RTBYTE', A);
        return A;
    }
    // LFONL1: left terrain bitstream access on LEFT side, source 455–478.
    function LFONL1() {
        if (r8('LTCNT') !== 7) {
            w8('LTCNT', r8('LTCNT') + 1);
            const A = rotateRight(r8('LTBYTE'));
            w8('LTBYTE', A);
            return A;
        }
        const U = (r16('LTPTR') - 1) & 255;
        w16('LTPTR', U);
        w8('LTCNT', 0);
        const A = rotateRight(readTD(U));
        w8('LTBYTE', A);
        return A;
    }
    // LFONR1: left terrain bitstream access on RIGHT side, source 480–504.
    function LFONR1() {
        if (r8('RTCNT') !== 7) {
            w8('RTCNT', r8('RTCNT') + 1);
            const A = rotateRight(r8('RTBYTE'));
            w8('RTBYTE', A);
            return A;
        }
        const U = (r16('RTPTR') - 1) & 255;
        w16('RTPTR', U);
        w8('RTCNT', 0);
        const A = rotateRight(readTD(U));
        w8('RTBYTE', A);
        return A;
    }
    // BGALT / ALTT1: altitude values follow TDATA's 2048 original bits, two
    // source steps per output byte, with the 6809's wrapping byte arithmetic.
    function BGALT() {
        w16('RTPTR', 0);
        w8('RTBYTE', readTD(0));
        w8('RTCNT', 7);
        w8('ROFF', 0xe0);
        for (let X = m.ALTTBL; X < m.ALTTBL + 4 * m.TLEN; X++) {
            b.write8(X, r8('ROFF'));
            for (let j = 0; j < 2; j++) {
                w8('ROFF', r8('ROFF') + (sgn(r8('RTBYTE')) ? -1 : 1));
                RFONR1();
            }
        }
        return b.snapshot(m.ALTTBL, m.ALTTBL + 4 * m.TLEN);
    }
    // BGERAS / ERAS1: erase via source STBL's pointer table, no redraw.
    function BGERAS() {
        for (let Y = m.STBL; Y < m.STBL + 0x130; Y += 2)
            wVideo16(b.read16(Y), 0);
    }
    // ADDL01 source lines 235–302: select flavour using BGLX bit 5,
    // advance source bit readers, write both circular table halves.
    function ADDL01() {
        const newRight = LFONR1();
        w8('ROFF', r8('ROFF') + (sgn(newRight) ? 1 : -1));
        const flavor = (r16('BGLX') & 0x20) ? 0 : 1;
        const base = flavor ? m.TERTF1 : m.TERTF0;
        const pName = flavor ? 'TTBLP1' : 'TTBLP0';
        const X = r16(pName);
        const left = LFONL1();
        let pattern;
        if (sgn(left)) {
            const A = r8('LOFF');
            b.write8(X, A);
            b.write8(X + 0x1c8, A);
            w8('LOFF', A + 1);
            pattern = 0x0770;
        }
        else {
            w8('LOFF', r8('LOFF') - 1);
            const A = r8('LOFF');
            b.write8(X, A);
            b.write8(X + 0x1c8, A);
            pattern = 0x7007;
        }
        b.write16(X + 1, pattern);
        b.write16(X + 0x1c9, pattern);
        const next = X + 3 === base + 0x1c8 ? base : X + 3;
        w16(pName, next);
    }
    // ADDR01 source lines 306–368: reverse direction + opposite flavour.
    function ADDR01() {
        w8('LOFF', r8('LOFF') + (sgn(r8('LTBYTE')) ? -1 : 1));
        RFONL1();
        const flavor = (r16('BGLX') & 0x20) ? 1 : 0;
        const base = flavor ? m.TERTF1 : m.TERTF0;
        const pName = flavor ? 'TTBLP1' : 'TTBLP0';
        const X = r16(pName) === base ? base + 0x1c5 : r16(pName) - 3;
        w16(pName, X);
        const A = r8('ROFF');
        let pattern;
        if (sgn(r8('RTBYTE'))) {
            w8('ROFF', A - 1);
            const v = r8('ROFF');
            b.write8(X, v);
            b.write8(X + 0x1c8, v);
            pattern = 0x0770;
        }
        else {
            b.write8(X, A);
            b.write8(X + 0x1c8, A);
            w8('ROFF', A + 1);
            pattern = 0x7007;
        }
        b.write16(X + 1, pattern);
        b.write16(X + 0x1c9, pattern);
        RFONR1();
    }
    // BGINIT / TGEN1..TGEN10, source lines 94–148. All iteration state
    // is explicit in terrainBank. The browser has no involvement.
    function BGINIT() {
        const nearest = currentBGL() & 0xffe0;
        w16('TEMP2B', nearest);
        w16('BGLX', u16(nearest + 0x2610));
        w8('LTCNT', 0);
        w16('LTPTR', 0xffff);
        w8('LOFF', 0xe0);
        RFONL1();
        // TGEN1 rotates across the original planet from X=$0010 to BGLX.
        let X = 0x10;
        for (let safety = 0; X !== r16('BGLX'); safety++) {
            if (safety > 2048)
                throw new Error('BGINIT TGEN1 original address loop did not converge');
            w8('LOFF', r8('LOFF') + (sgn(r8('LTBYTE')) ? -1 : 1));
            RFONL1();
            X = u16(X + 0x20);
        }
        w16('TEMP2A', r16('LTPTR'));
        w8('TEMP1A', r8('LTCNT'));
        w8('TEMP1B', r8('LTBYTE'));
        w8('TEMP1C', r8('LOFF'));
        w16('TTBLP0', m.TERTF0);
        w16('TTBLP1', m.TERTF1);
        for (let safety = 0;; safety++) {
            if (safety > 2048)
                throw new Error('BGINIT TGEN5 source table update did not converge');
            const D = u16(r16('BGLX') - 0x20);
            w16('BGLX', D);
            if (s16(u16(D - nearest)) < 0)
                break; // CMPD TEMP2B / BMI TGEN6
            ADDL01();
        }
        w16('RTPTR', r16('TEMP2A'));
        w8('RTCNT', r8('TEMP1A'));
        w8('RTBYTE', r8('TEMP1B'));
        w8('ROFF', r8('TEMP1C'));
        for (let Y = m.STBL; Y < m.STBL + 0x130; Y += 2)
            b.write16(Y, 0);
    }
    // BGOUT / TTER08..TTER04: reproduce read/erase/write table ordering.
    // See note (3) above about original source patch: unverified against ROM.
    function BGOUT() {
        const nearest = currentBGL() & 0xffe0;
        const raw = ((u16(nearest - r16('BGLX')) << 3) & 0xffff) >>> 8;
        let n = raw & 0x80 ? raw - 256 : raw;
        for (let safety = 0; n !== 0; safety++) {
            if (safety > 127)
                throw new Error('BGOUT original scroll window exceeded');
            if (n > 0) {
                w16('BGLX', u16(r16('BGLX') + 0x20));
                ADDR01();
                n--;
            }
            else {
                w16('BGLX', u16(r16('BGLX') - 0x20));
                ADDL01();
                n++;
            }
        }
        w16('BGLX', nearest);
        const flavor = (nearest & 0x20) ? 0 : 1;
        const S = r16(flavor ? 'TTBLP1' : 'TTBLP0');
        if (S < (flavor ? m.TERTF1 : m.TERTF0) || S + 456 > (flavor ? m.TERTF1 : m.TERTF0) + 0x390)
            throw new Error('BGOUT original flavour table pointer invalid');
        for (let i = 0; i < 152; i++) {
            const Y = m.STBL + i * 2;
            wVideo16(b.read16(Y), 0); // source STX [,Y]
            const B = b.read8(S + i * 3);
            const U = b.read16(S + i * 3 + 1);
            const A = (0x98 - i) & 255;
            const target = (A << 8) | B;
            b.write16(Y, target);
            wVideo16(target, U); // source STU [,Y++]
        }
    }
    return Object.freeze({ BGINIT, BGOUT, BGALT, BGERAS, ADDL01, ADDR01,
        RFONL1, RFONR1, LFONL1, LFONR1, terrainBank: b, terrainData, miniTerrain: MTERR });
}
