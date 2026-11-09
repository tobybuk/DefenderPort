/** Original DEFB6.SRC GTARG/GT1/GT2/GT3/GTX, lines 627-646.
 * The 32-entry target list is a circular array of *16-bit object pointers*.
 * TPTR points to its last examined entry. Process fields PD2 / PD4 retain
 * the original target and list-entry pointers. No nearest-target algorithm.
 */
import { u16 } from '../runtime/integers.js';
import { TranslationBoundaryError } from '../runtime/continuations.js';
export function createDefb6TargetRoutines(RAM, Layout) {
    const a = n => Layout.at(n);
    function GTARG(U = RAM.read16(a('CRPROC'))) {
        if (!U || U === a('ACTIVE'))
            throw new TranslationBoundaryError('GTARG needs original process record');
        if (RAM.read8(a('ASTCNT')) === 0)
            return 0;
        const start = RAM.read16(a('TPTR'));
        if (start < a('TLIST') || start >= a('TLIST') + 64 || ((start - a('TLIST')) & 1))
            throw new TranslationBoundaryError('GTARG TPTR not initialised from source TLIST');
        let X = start;
        for (let i = 0; i < 32; i++) {
            X = u16(X + 2);
            if (X >= a('TLIST') + 64)
                X = a('TLIST');
            const D = RAM.read16(X);
            if (D) {
                RAM.write16(a('TPTR'), X);
                RAM.write16(U + a('PD2'), D);
                RAM.write16(U + a('PD4'), X);
                return D;
            }
            if (X === start)
                break;
        }
        return 0;
    }
    return Object.freeze({ GTARG });
}
