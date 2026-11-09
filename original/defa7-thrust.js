/** Original DEFA7.SRC THINIT/THI1 and THPROC/THPR1/THPR2,
 * lines 2202-2209 and 3280-3292, pinned e740063.
 * Retains the source's inclusive stop position THTEND-31: 33 writes, not 32.
 * This routine updates original RAM; there is no invented particle system.
 */
import { TranslationBoundaryError } from '../runtime/continuations.js';
export function createDefa7ThrustRoutines(RAM, Layout, random, processes = null, addresses = null) {
    const a = n => Layout.at(n);
    /** THINIT, THI1 */
    function THINIT() {
        const base = a('THTAB');
        RAM.write16(a('THX'), base);
        for (let X = base; X !== a('THTEND') - 31; X++) {
            const A = random.RAND();
            RAM.write8(X + 32, A);
            RAM.write8(X, A);
            if (X > base + 64)
                throw new Error('THINIT source-range boundary exceeded');
        }
    }
    /** THPROC: original task, including THPR1 and THPR2 fall-through sections. */
    function THPROC() {
        let X = RAM.read16(a('THX')) + 1;
        if (X > a('THTAB') + 32)
            X = a('THTAB');
        return THPR1(X);
    }
    /** THPR1: update thrust pointer, advance fireball pointer. */
    function THPR1(X) {
        RAM.write16(a('THX'), X);
        let next = RAM.read16(a('FBX')) + 1;
        if (next > a('FBTAB') + 24)
            next = a('FBTAB');
        return THPR2(next);
    }
    /** THPR2: save fireball pointer; original NAP 4,THPROC. */
    function THPR2(X) {
        RAM.write16(a('FBX'), X);
        if (!processes || typeof processes.SLEEP !== 'function' ||
            !addresses || !Number.isInteger(addresses.THPROC))
            throw new TranslationBoundaryError('THPROC requires original THPROC continuation address and linked-list scheduler');
        return processes.SLEEP(4, addresses.THPROC);
    }
    return Object.freeze({ THINIT, THPROC, THPR1, THPR2 });
}
