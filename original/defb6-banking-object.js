/**
 * Native source-level translation: pinned src/defb6.src, lines 1149–1159,
 * 1284–1300. This code translates KILOFF, OFSHIT, BGI, MAPCH7, MAPCH2,
 * MAPCH3, MAPCH1 and MAPCHG. Names and call ordering are preserved.
 *
 * Code-to-source correspondence:
 * KILOFF -> source KILOFF; OFSHIT -> source OFSHIT;
 * BGI -> source BGI; MAPCH1/2/3/7 and MAPCHG -> identically named
 * assembly entry points. The original register-save instructions are
 * represented by JavaScript argument/local lifetime, not CPU emulation.
 *
 * The board bank-select register is a data write, not an emulated CPU.
 * The original indirect object callback is supplied as a descriptor
 * resolved from OPICT; no invented bitmap or collision rules.
 */
import { u16 } from '../runtime/integers.js';
export function createDefb6BankingObjectRoutines(RAM, Layout, { resolvePicture, KILLOB, BGINIT } = {}) {
    const a = n => Layout.at(n);
    const read16 = (X, field) => RAM.read16(u16(X + a(field)));
    function MAPCHG(A) {
        RAM.write8(a('MAPCR'), A);
        RAM.write8(a('MAPC'), A);
    }
    function MAPCH7() {
        MAPCHG(7);
    }
    function MAPCH2() {
        MAPCHG(2);
    }
    function MAPCH3() {
        MAPCHG(3);
    }
    function MAPCH1() {
        MAPCHG(1);
    }
    function BGI() {
        MAPCH7();
        if (typeof BGINIT !== 'function')
            throw new Error('BGI reached untranslated BGINIT');
        return BGINIT();
    }
    function OFSHIT(X) {
        if (!Number.isInteger(X) || X < 0 || X > 0xffff)
            throw new RangeError('OFSHIT requires original object pointer X');
        MAPCH2();
        const D = read16(X, 'OBJX');
        const Y = read16(X, 'OPICT');
        const descriptor = typeof resolvePicture === 'function' ? resolvePicture(Y) : null;
        if (!descriptor || typeof descriptor.OBJDEL !== 'function')
            throw new Error(`OFSHIT reached unresolved original OBJDEL descriptor $${Y.toString(16).padStart(4, '0')}`);
        descriptor.OBJDEL(D, Y, X);
    }
    /** DEFB6.SRC 1150: `KILOFF JSR KILLOB` has no RTS and falls through into
     * OFSHIT, erasing the object's last image. Stage 75 restores that fall-
     * through; without it P503 left the 250/500 rescue score bitmaps on screen.
     * An object with no screen address (OBJX=0) has nothing to erase. */
    function KILOFF(X) {
        if (typeof KILLOB !== 'function')
            throw new Error('KILOFF reached untranslated KILLOB');
        const result = KILLOB(X);
        if (read16(X, 'OBJX'))
            OFSHIT(X);
        return result;
    }
    return Object.freeze({ MAPCHG, MAPCH7, MAPCH2, MAPCH3, MAPCH1, BGI, OFSHIT, KILOFF });
}
