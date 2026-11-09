/**
 * Source-first transliteration of PLAYER and VELO.
 * Pinned source: mwenge/defender e740063, src/defa7.src L2338-L2498.
 * Each source label is preserved in the control flow comments or function names.
 * The original assembly can be inserted from a local checkout with the
 * source:annotate command; none is reconstructed or embedded here.
 *
 * NO floating-point game-state coordinates. This is native JS arithmetic on
 * the game's fixed-width RAM, not a 6809 CPU or opcode interpreter.
 */
import { s16, u8, u16, asr8, ror8 } from '../runtime/integers.js';
export function createDefa7PlayerRoutines(RAM, Layout) {
    const addr = name => Layout.at(name);
    const R8 = name => RAM.read8(addr(name));
    const R16 = name => RAM.read16(addr(name));
    const W8 = (name, v) => RAM.write8(addr(name), v);
    const W16 = (name, v) => RAM.write16(addr(name), v);
    /** PLAYER: source L2338–2475, including PLAY1, PV1..PV12 and PYV1. */
    function PLAYER() {
        if (R8('STATUS') & 0x40)
            return; // PLAYX: attract/controls-disabled
        // X damping: the source forms -[PLAXV:PLAXV+1], sign extends it,
        // shifts by two, and accumulates the low 16 bits into PLAXV+1.
        // The high-byte adjustment is an 8-bit add-with-carry. Unlike a
        // simplified velocity -= velocity/64, this preserves byte roundoff.
        let neg16 = u16(-R16('PLAXV'));
        let extend = (neg16 & 0x8000) ? 0xff : 0x00;
        let add = (u16(neg16 << 2) + RAM.read16(addr('PLAXV') + 1));
        RAM.write16(addr('PLAXV') + 1, add);
        RAM.write8(addr('PLAXV'), u8(R8('PLAXV') + extend + (add > 0xffff ? 1 : 0)));
        W8('ITEMP', extend);
        if (R8('PIA21') & 0x02) {
            extend = s16(R16('PLADIR')) < 0 ? 0xff : 0;
            add = R16('PLADIR') + RAM.read16(addr('PLAXV') + 1);
            RAM.write16(addr('PLAXV') + 1, add);
            RAM.write8(addr('PLAXV'), u8(R8('PLAXV') + extend + (add > 0xffff ? 1 : 0)));
            W8('ITEMP', extend);
        }
        // PLAY1: derive horizontal presentation movement through the
        // source's signed shifts (ASRA/RORB twice, then ASRB/RORA).
        const shifted = u16(s16(R16('PLAXV')) >> 2);
        const sb = asr8(shifted & 0xff);
        const a = ror8(0, sb.C).result;
        W8('PCX', sb.result);
        RAM.write8(addr('PCX') + 1, a);
        let base = (R16('PLADIR') & 0x8000) ? 0x70 : 0x20;
        const bIsNegative = !!(sb.result & 0x80);
        // PV1/PV1A: velocity opposing facing direction removes pan assist.
        if ((base === 0x20 && bIsNegative) || (base === 0x70 && !bIsNegative))
            W16('PCX', 0);
        let A = u8(base + R8('PCX'));
        W8('PCX', A);
        let D = (A << 8) | RAM.read8(addr('PCX') + 1);
        const current = R16('PLAX16');
        const difference = u16(D - current);
        if (difference !== 0) {
            if (D >= current) {
                if (difference > 0x100) {
                    W16('BGDELT', 0x0040);
                    D = u16(current + 0x0100);
                }
                else
                    W16('BGDELT', 0);
            }
            else {
                if (s16(difference) <= -0x0100) {
                    W16('BGDELT', 0xffc0);
                    D = u16(current - 0x0100);
                }
                else
                    W16('BGDELT', 0);
            }
        }
        else
            W16('BGDELT', 0);
        // PV9/PV10: camera, player visual x and horizontal world position.
        W16('PLAX16', D);
        W8('NPLAXC', D >>> 8);
        W16('BGLX', R16('BGL'));
        let v = s16(R16('PLAXV'));
        if (v >= 0x100)
            v = 0x100;
        if (v <= -0x100)
            v = -0x100;
        W16('PLAXV', v);
        W16('BGL', u16(R16('BGL') + v - s16(R16('BGDELT'))));
        W16('PLABX', u16(((D >> 2) & 0xffe0) + R16('BGL')));
        // Vertical motion: no inertia when released, integer acceleration
        // to +/- $0200 with source-defined YMIN/238 soft boundaries.
        const y = R8('PLAY16');
        const up = !!(R8('PIA31') & 0x01);
        const down = !!(R8('PIA21') & 0x80);
        let vy = 0;
        if (up) {
            if (y <= Layout.at('YMIN') + 1)
                return; // PLAYX (source does not update Y)
            vy = s16(R16('PLAYV'));
            vy = vy < 0 ? Math.max(-0x200, vy - 8) : -0x100;
        }
        else if (down) {
            if (y >= 238)
                return; // PLAYX
            vy = s16(R16('PLAYV'));
            vy = vy > 0 ? Math.min(0x200, vy + 8) : 0x100;
        }
        // PYV1
        W16('PLAYV', vy);
        const next = u16(vy + R16('PLAY16'));
        W16('PLAY16', next);
        W8('NPLAYC', next >>> 8);
    }
    /**
     * VELO/VELOLP/VELO2/VELO3/VELO4/VELLP, source L2479–2498.
     * Walks the original OPTR linked object list, not a JS entity array.
     */
    function VELO() {
        if (R8('STATUS') & 0x20)
            return;
        let X = R16('OPTR');
        for (let count = 0; X !== 0 && count < 95; count++) {
            RAM.write16(X + Layout.at('OX16'), u16(RAM.read16(X + Layout.at('OX16')) + RAM.read16(X + Layout.at('OXV'))));
            const oldY = RAM.read16(X + Layout.at('OY16'));
            let nextY = u16(oldY + RAM.read16(X + Layout.at('OYV')));
            let hi = nextY >>> 8;
            if (hi < Layout.at('YMIN'))
                hi = Layout.at('YMAX');
            if (hi > Layout.at('YMAX'))
                hi = Layout.at('YMIN');
            nextY = (hi << 8) | (nextY & 255);
            RAM.write16(X + Layout.at('OY16'), nextY);
            X = RAM.read16(X);
        }
        if (X !== 0)
            throw new Error('VELO: original OPTR object list exceeds 95 slots or contains a cycle');
    }
    return Object.freeze({ PLAYER, VELO });
}
