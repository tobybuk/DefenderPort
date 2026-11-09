/**
 * Source-level transliteration: pinned mwenge/defender e740063, src/defa7.src
 *   GEXEC/GEX0/GEX00/GEX001/GEX002/GEX003/GEX11/GEX2/GEX20/GEX3/GEX5/GEX50/GEX6
 *   RMAX/RMAX1, WVCHK, BCDHEX/BCH1/BCH2, HEXBCD/HBC1/HBC2
 * Source lines 1641–1783.
 *
 * Source routines are retained rather than rewritten as a new game loop.
 * 6809 NAP is SLEEP with the real continuation address supplied by caller;
 * callbacks are only JSRs into *other original routines*. Missing JSRs fail.
 * This module has not yet been compared to an original machine execution trace.
 */
import { u8 } from '../runtime/integers.js';
import { TranslationBoundaryError } from '../runtime/continuations.js';
export function createDefa7WaveExecutive(RAM, Layout, processes, { addresses = {}, RAND, ...dependencies } = {}) {
    const at = n => Layout.at(n), read = n => RAM.read8(at(n)), write = (n, v) => RAM.write8(at(n), v);
    const required = (name, ...args) => {
        const fn = name === 'RAND' ? RAND : dependencies[name];
        if (typeof fn !== 'function')
            throw new TranslationBoundaryError(`GEXEC reached untranslated original ${name}`);
        return fn(...args);
    };
    const current = () => {
        const U = RAM.read16(at('CRPROC'));
        if (!U || U === at('ACTIVE'))
            throw new TranslationBoundaryError('GEXEC requires current original process record');
        return U;
    };
    const PD = () => at('PD') + current();
    const nap = (ticks, label) => {
        const addr = addresses[label];
        if (!Number.isInteger(addr) || addr <= 0 || addr > 0xffff)
            throw new TranslationBoundaryError(`NAP needs original saved continuation ${label}`);
        return processes.SLEEP(ticks, addr);
    };
    /** Source WVCHK, no baiters, UFOs or other extra counts inserted. */
    function WVCHK() {
        let A = 0;
        for (const name of ['LNDCNT', 'LNDRES', 'TIECNT', 'PRBCNT', 'SWCNT', 'SCZCNT', 'SCZRES'])
            A = u8(A + read(name));
        return A;
    }
    /** Source RMAX: byte RAND, repeat LSRA until <= source A bound, INCA. */
    function RMAX(A) {
        const bound = u8(A);
        let value = u8(required('RAND'));
        while (value > bound)
            value >>= 1;
        return u8(value + 1);
    }
    /** Source BCDHEX: repeatedly subtract $10 and add 10 to B. */
    function BCDHEX(A) {
        let value = u8(A), B = 0;
        while (value >= 0x10) {
            B = u8(B + 10);
            value = u8(value - 0x10);
        }
        return u8(value + B);
    }
    /** Source HEXBCD: DAA-adjusted tens and units, for byte input 0..255. */
    function HEXBCD(A) {
        let B = u8(A), packed = 0;
        while (B >= 10) {
            const sum = packed + 0x10;
            // Source HBC1: ADDA #$10, DAA. Every ten tens digits
            // DAA discards the hundreds carry from the 8-bit A register.
            packed = u8(sum > 0x99 ? sum + 0x60 : sum);
            B -= 10;
        }
        const sum = packed + B;
        // Source HBC2: ADDA units, DAA (units 0..9).
        return u8(((sum & 0x0f) > 9 ? sum + 6 : sum));
    }
    function GEXEC() {
        RAM.write8(PD(), 40);
        write('UFOTMR', read('UFOTIM'));
        write('WAVTMR', 1);
        return GEX0();
    }
    function GEX0() {
        // STATUS bit 3: player dead, bypass WVCHK and enemy staging.
        if (read('STATUS') & 8)
            return GEX3();
        const A = WVCHK();
        if (A === 0) {
            write('STATUS', 0x77);
            required('GNCIDE');
            required('PLSAV');
            required('BONUS');
            const X = RAM.read16(at('PLRX'));
            RAM.write8(X + at('PLAS'), u8(RAM.read8(X + at('PLAS')) + 1));
            return required('PLSTR0');
        }
        return GEX00(A);
    }
    function GEX00(A) {
        // Exact GEX00-GEX001/GEX002 branch order; no guessed baiter cadence.
        if (A <= 8) {
            let B = read('UFOTIM') >>> 1;
            if (A <= 3)
                B >>>= 1;
            B = u8(B + 1);
            if (B < read('UFOTMR'))
                write('UFOTMR', B);
        }
        return GEX002(A);
    }
    function GEX002(A) {
        const elapsed = u8(read('UFOTMR') - 1);
        write('UFOTMR', elapsed);
        if (elapsed === 0) {
            let next = read('UFOTIM');
            if (A < 4)
                next = RMAX(next >>> 2);
            write('UFOTMR', next);
            if (read('UFOCNT') < 12) {
                required('UFOST');
                write('UFOCNT', u8(read('UFOCNT') + 1));
            }
        }
        return GEX11();
    }
    function GEX11() {
        const remaining = u8(read('WAVTMR') - 1);
        write('WAVTMR', remaining);
        if (remaining !== 0 && read('LNDCNT') !== 0)
            return GEX3();
        return GEX2();
    }
    function GEX2() {
        write('WAVTMR', read('WAVTIM'));
        const reserve = read('LNDRES');
        if (reserve !== 0 && read('LNDCNT') < 8) {
            const A = Math.min(read('WAVSIZ'), reserve);
            required('LANDST', A);
            write('LNDRES', u8(reserve - A));
        }
        return GEX3();
    }
    function GEX3() {
        if (read('STRCNT') < 16)
            write('STRCNT', u8(read('STRCNT') + 1));
        let A = u8(read('GTIME') + 1);
        if (A > 240) {
            required('AUDIT', 6);
            A = 0;
        }
        write('GTIME', A);
        const U = current(), delay = u8(RAM.read8(U + at('PD')) - 1);
        RAM.write8(U + at('PD'), delay);
        if (delay === 0) {
            required('WDELT', 2, at('ELIST'));
            RAM.write8(U + at('PD'), 40);
        }
        return GEX6();
    }
    function GEX6() {
        return nap(15, 'GEX0');
    }
    return Object.freeze({ GEXEC, GEX0, GEX00, GEX002, GEX11, GEX2, GEX3, GEX6, RMAX, WVCHK, BCDHEX, HEXBCD });
}
