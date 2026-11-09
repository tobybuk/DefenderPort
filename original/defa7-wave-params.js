/**
 * Exact source-level WDELT and GETWV from pinned DEFA7.SRC lines 1846–1926.
 * The original WVTAB byte data is in blk71-wave-data.js. ROM bank 7 selection
 * remains a required translated original MAPCH7 callback.
 *
 * CMOS (RCMOSA/RCMOSD) is external nonvolatile *data access*, supplied by
 * a hardware adapter; its original stored values are not guessed here.
 */
import { WVTAB, WVTAB_ROWS } from './blk71-wave-data.js';
import { TranslationBoundaryError } from '../runtime/continuations.js';
import { u8 } from '../runtime/integers.js';
export function createDefa7WaveParameterRoutines(RAM, Layout, { MAPCH7, RCMOSA, RCMOSD } = {}) {
    const at = n => Layout.at(n), read = n => RAM.read8(at(n)), write = (n, v) => RAM.write8(at(n), v);
    const dependency = (name, ...args) => {
        const fn = { MAPCH7, RCMOSA, RCMOSD }[name];
        if (typeof fn !== 'function')
            throw new TranslationBoundaryError(`${name}: missing source translation/hardware adapter`);
        return fn(...args);
    };
    const BCDHEX = A => {
        let out = 0, n = u8(A);
        while (n >= 16) {
            n -= 16;
            out = u8(out + 10);
        }
        return u8(out + n);
    };
    /** WDELT: source B=2 intra-wave, 3 inter-wave; Y=RAM byte table address. */
    function WDELT(B, Y) {
        if (B !== 2 && B !== 3)
            throw new RangeError('WDELT source delta column B must be 2 or 3');
        dependency('MAPCH7');
        for (let row = 0; row < WVTAB_ROWS; row++) {
            const X = row * 8, delta = WVTAB[X + B], before = RAM.read8(Y + row);
            const sum = before + delta, carry = sum > 255, A = u8(sum);
            if ((delta & 128) === 0) {
                if (carry || A > WVTAB[X])
                    continue; // WDL: overflow or maximum
            }
            else {
                if (!carry || A < WVTAB[X + 1])
                    continue; // WDL: underflow or minimum
            }
            RAM.write8(Y + row, A); // WD2
        }
    }
    /** GETWV: source player record X, wave-index table copy and CMOS-adjusted delta. */
    function GETWV(X) {
        const pwav = (X + at('PWAV')) & 65535, ptarg = (X + at('PTARG')) & 65535;
        const wave = u8(RAM.read8(pwav) + 1);
        RAM.write8(pwav, wave);
        const nth = u8(dependency('RCMOSA', 'GA1+6'));
        if (nth !== 0) {
            let A = wave;
            while (A >= nth) {
                A -= nth;
                if (A === 0) {
                    RAM.write8(ptarg, 10);
                    break;
                }
            }
        }
        dependency('MAPCH7');
        const col = Math.min(wave, 4) + 3;
        // Source GETWV2: each 8-byte wave row, one byte to PENEMY+row.
        const base = (X + at('PENEMY')) & 65535;
        for (let row = 0; row < WVTAB_ROWS; row++)
            RAM.write8(base + row, WVTAB[row * 8 + col]);
        let extra = wave > 4 ? wave - 4 : 0;
        const D = dependency('RCMOSD', 'GA1');
        if (!Number.isInteger(D) || D < 0 || D > 65535)
            throw new TypeError('RCMOSD must return original 16-bit D');
        extra = u8(extra + BCDHEX(D >>> 8));
        if (extra === 0)
            return;
        extra = Math.min(extra, BCDHEX(D & 255));
        // Original GETWV4 calls PLINDX, not the originally supplied X; follow CURPLR.
        const playerX = read('CURPLR') === 1 ? at('P1SCR') : at('P2SCR');
        const target = (playerX + at('PENEMY')) & 65535;
        while (extra-- > 0)
            WDELT(3, target);
    }
    return Object.freeze({ WDELT, GETWV });
}
