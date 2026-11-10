/**
 * Source-faithful native JavaScript transliteration of the original star code.
 * Upstream: mwenge/defender e74006344b16d19245510b5e55780f90d7606bb8
 * src/defa7.src lines 2094-2198: STOUT, STOUT0, STOUT1, STOUT2, STOUT3,
 * SBLNK, SBLNK0, SBL00, SBLNK1.
 *
 * STOUT has no RTS: after the STOUT1 loop it falls straight into SBLNK, so
 * every star output (once per frame, from the IRQ) also re-colours one
 * random star and, on an even SEED, "hypers" it to a new X (and a new Y once
 * the planet has gone). Stage 79 restores that fall-through; before it, the
 * port only called SBLNK from a host adapter on odd SEEDs, so stars changed
 * colour but never jumped.
 *
 * No star physics, random movement, colours or speed are invented here.
 * Every change to SMAP is derived from the original byte-level operations.
 * The video store interface represents the original indirect writes to the
 * *graphics* address space and is intentionally kept outside the game logic.
 * See docs/STAGE3_SOURCE_AUDIT.md for unusual SBLNK side effects.
 * The original assembly can be attached by the user's local source checkout
 * with npm run source:annotate (copyright is not assumed to be licensed).
 */
import { u8, u16 } from '../runtime/integers.js';
import { TranslationBoundaryError } from '../runtime/continuations.js';
export function createDefa7StarRoutines(RAM, Layout, video) {
    const a = n => Layout.at(n);
    const r8 = n => RAM.read8(a(n));
    const r16 = n => RAM.read16(a(n));
    const w8 = (n, v) => RAM.write8(a(n), v);
    const starAddress = X => RAM.read16(X); // [SX,X] reads the star's (SX,SY) coordinate pair
    const requireVideo = () => {
        if (!video || typeof video.write8 !== 'function')
            throw new TranslationBoundaryError('STOUT/SBLNK require a translated video-bank write interface');
    };
    /** STOUT / STOUT0 / STOUT1 / STOUT2 / STOUT3, source L2096-L2154. */
    function STOUT() {
        if (r8('STATUS') & 0x20)
            return; // STX
        requireVideo();
        // LDD BGL / ANDB #$80; LDD BGLX / ANDB #$80; SUBD;
        // ASLB / ROLA, then STA ITEMP. This is *not* pixel-distance rounding.
        const previous = u16(r16('BGL') & 0xff80);
        const current = u16(r16('BGLX') & 0xff80);
        const movement = u8(u16(u16(current - previous) << 1) >>> 8);
        w8('ITEMP', movement);
        const phaseMask = (RAM.read8(a('BGL') + 1) & 0x40) ? 0xf0 : 0x0f;
        w8('ITEMP2', phaseMask);
        const begin = a('SMAP'), stride = a('SLGTH');
        // STA [0,X] ... STA [60,X]: erase all 16 prior locations first.
        for (let X = begin; X < begin + 16 * stride; X += stride)
            video.write8(starAddress(X), 0);
        let count = r8('STRCNT');
        if (!count)
            return; // guard for diagnostic corrupted state, not gameplay
        if (count > 16)
            throw new TranslationBoundaryError('STOUT: STRCNT outside 16-record SMAP');
        let X = begin;
        // STOUT1; the original applies 8-bit overflow before the two clamps.
        do {
            let A = u8(RAM.read8(X + a('SX')) + movement);
            if (A >= 0x9c)
                A = A <= 0xc0 ? 0 : 0x9b;
            RAM.write8(X + a('SX'), A);
            A = RAM.read8(X + a('SCOL')) & phaseMask;
            video.write8(starAddress(X), A); // STA [SX,X]
            X += stride;
        } while (--count !== 0);
        SBLNK(); // fall through: no RTS between STOUT1's DECB/BNE and SBLNK
    }
    /** SBLNK / SBLNK0 / SBL00 / SBLNK1, source L2158-L2198. */
    function SBLNK() {
        requireVideo();
        const seed = r8('SEED');
        const X = a('SMAP') + (seed & 0x3c);
        RAM.write8(X + a('SCOL'), u8(RAM.read8(X + a('SCOL')) + 0x11) & 0x77);
        if (seed & 1)
            return; // SBLNK1
        let A = seed, star = X;
        if (A >= 0x98) {
            // Anti-tamper "attract bomb": only when WCURS does not hold the
            // $6245 that COPYRT stores after a genuine Williams logo, outside
            // attract (STATUS bit 7 clear) and with SEED exactly $A0. The
            // source then reuses X (= $A0:LSEED) for the rest of SBLNK, so the
            // "star" it moves is that RAM byte, not a SMAP entry.
            const U = r16('WCURS');
            if (U !== 0x6245 && !(r8('STATUS') & 0x80) && A === 0xa0) {
                star = (A << 8) | r8('LSEED');
                RAM.write8(star, r8('HSEED'));
            }
            A = u8(A - 0x84);
        }
        // SBLNK0: CLR [SX,X] before changing the star position.
        video.write8(starAddress(star), 0);
        RAM.write8(star + a('SX'), A);
        if (!(r8('STATUS') & 2))
            return;
        // Original MUL (#3) and ADDB #YMIN: use the 8-bit product low half.
        const y = u8(u8((r8('LSEED') & 0x3f) * 3) + a('YMIN'));
        RAM.write8(star + a('SY'), y);
    }
    return Object.freeze({ STOUT, SBLNK });
}
