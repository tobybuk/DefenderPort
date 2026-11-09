/**
 * Source transliteration: pinned e740063, src/defa7.src,
 * SCORE/SCR1/SCR2/SCRX/SCRXX and RCHK/RCHX, roughly source lines 3097–3242.
 *
 * A and B are the source's 6809 input *bytes*: B is packed decimal, not a
 * JavaScript numeric score. The 6809's DAA and carry are reproduced explicitly.
 * Every original RAM field remains in the source PHR6 layout. These functions
 * do not implement HUD drawing, replay audio or a browser scoreboard.
 *
 * Score rendering and reward side effects have required source-routine hooks;
 * missing hooks throw rather than silently replacing game logic.
 */
import { createDefa7PlayerIndexRoutines } from './defa7-player-index.js';
// 6809 DAA consumes the low-nibble half-carry and carry from the *previous ADD*.
// It returns C, which the next original ADCA instruction consumes.
export function DAA8(rawByte, { halfCarry = false, carry = false } = {}) {
    const A = rawByte & 0xff;
    let correction = 0;
    if ((A & 15) > 9 || halfCarry)
        correction |= 0x06;
    if (A > 0x99 || carry)
        correction |= 0x60;
    const adjusted = A + correction;
    return { value: adjusted & 255, carry: !!(carry || adjusted > 255) };
}
export function ADD_BCD(A, B, carryIn = 0) {
    const input = (A & 255) + (B & 255) + (carryIn ? 1 : 0);
    const halfCarry = (((A & 15) + (B & 15) + (carryIn ? 1 : 0)) > 15);
    return DAA8(input & 255, { halfCarry, carry: input > 255 });
}
export function createDefa7ScoreRoutines(RAM, Layout, original = {}) {
    const at = n => Layout.at(n), r8 = n => RAM.read8(at(n)), r16 = n => RAM.read16(at(n));
    const w8 = (n, v) => RAM.write8(at(n), v);
    const read8 = addr => RAM.read8(addr & 65535), write8 = (addr, v) => RAM.write8(addr & 65535, v);
    const { PLINDX } = createDefa7PlayerIndexRoutines(RAM, Layout);
    function requireRoutine(label) {
        const fn = original[label];
        if (typeof fn !== 'function')
            throw new Error(`SCORE reached untranslated ${label} (original source routine required)`);
        return fn;
    }
    /** RCHK: compare source's 3-byte packed-decimal scores as unsigned bytes. */
    function RCHK(X, Y) {
        const D0 = RAM.read16(X), D1 = RAM.read16(Y);
        return D0 !== D1 ? Math.sign(D0 - D1) : Math.sign(read8(X + 2) - read8(Y + 2));
    }
    /** SCORE: A=decimal exponent (0..7), B=source BCD mantissa (0..99). */
    function SCORE(A, B) {
        if (!Number.isInteger(A) || A < 0 || A > 7 || !Number.isInteger(B) || B < 0 || B > 0x99 || (B & 15) > 9 || B >>> 4 > 9)
            throw new RangeError('SCORE requires original A=0..7 and B=packed BCD 00..99');
        const exponent = A;
        const bcd = B;
        // ORCC #1; ROL SCRFLG (uses inserted carry=1).
        w8('SCRFLG', ((r8('SCRFLG') << 1) | 1) & 255);
        const digitShift = exponent >>> 1;
        // LSRA leaves exponent bit0 in C; if set, ASLB/ROLA four times.
        // Equivalent to the original 16-bit D shifted four times, modulo 65536.
        let D = exponent & 1 ? (bcd << 4) & 0xffff : bcd;
        w8('XTEMP', D >>> 8);
        write8(at('XTEMP') + 1, D);
        const X = PLINDX();
        let offset = 3 - digitShift;
        let result = ADD_BCD(read8(X + offset), D & 255);
        write8(X + offset, result.value);
        offset--;
        while (offset >= 0) {
            result = ADD_BCD(read8(X + offset), r8('XTEMP'), result.carry ? 1 : 0);
            write8(X + offset, result.value);
            w8('XTEMP', 0);
            offset--;
        }
        // Original SCRX: only check a replay when REPLA contains a nonzero word.
        let replay = false;
        if (r16('REPLA') !== 0) {
            const score = X + 1, threshold = X + 4;
            if (RCHK(score, threshold) >= 0) {
                let carry = 0;
                let result = ADD_BCD(read8(threshold + 1), read8(at('REPLA') + 1));
                write8(threshold + 1, result.value);
                carry = result.carry ? 1 : 0;
                result = ADD_BCD(read8(threshold), r8('REPLA'), carry);
                write8(threshold, result.value);
                // INC PLAS-1,X / INC PSBC-1,X in source (X has advanced 1).
                const lasers = at('P1LAS') - at('P1SCR');
                const bombs = at('P1SBC') - at('P1SCR');
                write8(X + lasers, (read8(X + lasers) + 1) & 255);
                write8(X + bombs, (read8(X + bombs) + 1) & 255);
                requireRoutine('LDISP')();
                requireRoutine('SBDISP')();
                requireRoutine('SNDLD')('RPSND');
                requireRoutine('AUDIT')(5);
                replay = true;
            }
        }
        requireRoutine('SCRTRN')();
        return { replay, score: Array.from({ length: 4 }, (_, i) => read8(X + i)) };
    }
    return Object.freeze({ SCORE, RCHK });
}
