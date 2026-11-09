/** Original RAND and STINIT transliterations.
 * src/defa7.src L944-961 and L2072-2092 at pinned upstream revision.
 * Source listing may be inserted locally with npm run source:annotate.
 */
import { u8 } from '../runtime/integers.js';
export function createDefa7RandomRoutines(RAM, Layout) {
    const loc = n => Layout.at(n);
    const r = n => RAM.read8(loc(n));
    const w = (n, v) => RAM.write8(loc(n), v);
    /** Source RAND: updates three seed bytes with source order/carry semantics. */
    function RAND() {
        let B = u8(3 * r('SEED') + 17);
        const previousL = r('LSEED'), previousH = r('HSEED');
        let A = previousL >>> 3;
        A ^= previousL;
        const carry = !!(A & 1);
        const newH = (previousH >>> 1) | (carry ? 0x80 : 0);
        const newL = (previousL >>> 1) | ((previousH & 1) ? 0x80 : 0);
        w('HSEED', newH);
        w('LSEED', newL);
        let sum = B + newL;
        B = u8(sum);
        sum = B + newH + (sum > 0xff ? 1 : 0);
        w('SEED', sum);
        return r('SEED');
    }
    /** Source STINIT: initialize 16 entries in SMAP with rejection sampling. */
    function STINIT() {
        const base = loc('SMAP'), end = loc('SMEND'), stride = loc('SLGTH');
        w('STRCNT', 16);
        let B = 0;
        for (let X = base; X < end; X += stride) {
            let A, guard = 0;
            do {
                A = RAND();
                if (++guard > 10000)
                    throw new Error('STINIT x seed stuck');
            } while (A >= 0x9c);
            RAM.write8(X + loc('SX'), A);
            guard = 0;
            do {
                A = RAND();
                if (++guard > 10000)
                    throw new Error('STINIT y seed stuck');
            } while (A > 0xa8 || A <= loc('YMIN'));
            RAM.write8(X + loc('SY'), A);
            RAM.write8(X + loc('SCOL'), B);
            B = u8(B + 0x11) & 0x77;
        }
    }
    return Object.freeze({ RAND, STINIT });
}
