/**
 * DEFA7.SRC COLCHK/COLCK1.  Player collision shares the exact source
 * collision scan (COLIDE) and original RAM OCVECT callbacks with LASR/LASL.
 * The source POUT/POUT1 phase is inferred from NPLAD, and OBJX remains the
 * screen-memory address written by source PRDISP.
 *
 * No JavaScript rectangular sprite collision is added: COLIDE examines both
 * picture byte streams for overlapping non-zero screen bytes, respecting the
 * original packed horizontal video format.
 */
import { u16 } from '../runtime/integers.js';
export function createDefa7CollisionRoutines(RAM, L, { COLIDE, PLAPIC, PLBPIC } = {}) {
    const at = n => L.at(n);
    const rd = n => RAM.read16(at(n)), r = n => RAM.read8(at(n)), w = (n, v) => RAM.write8(at(n), v);
    function COLCHK() {
        if ((r('STATUS') & 0x10) !== 0)
            return 0;
        const direction = rd('PLADIR');
        const pic = (direction & 0x8000) ? PLBPIC : PLAPIC;
        // Original picture descriptor OBJW is 8 packed bytes; the source graphic
        // PLAPIC/PLBPIC exports have pixel width=16 and byteColumns=8.
        const picture = { width: pic.byteColumns, height: pic.height, phases: pic.phases };
        const D = u16((r('PLAXC') << 8) | r('PLAYC'));
        w('PCFLG', 1);
        try {
            // DEFA7.SRC COLC1/COLC2: if the object scan misses, call COL0
            // with SPTR. Both scans must use the original picture byte test.
            const objectHit = COLIDE(D, picture);
            return objectHit || COLIDE(D, picture, 'SPTR');
        }
        finally {
            w('PCFLG', 0);
        }
    }
    return Object.freeze({ COLCHK });
}
