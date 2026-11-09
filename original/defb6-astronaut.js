/**
 * Native JavaScript transliteration of original Defender DEFB6.SRC 289–435,
 * 924–974 at pinned commit e74006344b16d19245510b5e55780f90d7606bb8.
 * Names: ASTRO, ASTR, ASTR1, ASTR2, ASTR3, ASTL1, ASTL2, ASTL3,
 * ASTX, GETALT, ASTKIL, ASTK1, ASTCLR, AFALL, AFALL2, ALAND, ALAND0.
 * Data is the original shared 8-/16-bit RAM and banked altitude table.
 * Missing appearance/sound/terrain-death translations are hard failures.
 */
import { u8, u16 } from '../runtime/integers.js';
import { TranslationBoundaryError } from '../runtime/continuations.js';
export function createDefb6AstronautRoutines(RAM, Layout, processes, { addresses = {}, readAltitude, KILOFF, XSVCT, SNDLD } = {}) {
    const at = n => Layout.at(n), off = (X, n) => u16(X + at(n));
    const r = n => RAM.read8(at(n)), r16 = n => RAM.read16(at(n));
    const w = (n, v) => RAM.write8(at(n), v), ww = (n, v) => RAM.write16(at(n), v);
    const b = (X, n) => RAM.read8(off(X, n)), d = (X, n) => RAM.read16(off(X, n));
    const wb = (X, n, v) => RAM.write8(off(X, n), v), wd = (X, n, v) => RAM.write16(off(X, n), v);
    const sym = (name) => {
        const v = addresses[name];
        if (!Number.isInteger(v) || v <= 0 || v > 65535)
            throw new TranslationBoundaryError(`Astronaut missing original source address ${name}`);
        return v;
    };
    const dep = (name) => {
        const fn = { KILOFF, XSVCT, SNDLD, readAltitude }[name];
        if (typeof fn !== 'function')
            throw new TranslationBoundaryError(`Astronaut requires untranslated ${name}`);
        return fn;
    };
    const cur = () => {
        const U = r16('CRPROC');
        if (!U || U === at('ACTIVE'))
            throw new TranslationBoundaryError('ASTRO/AFALL requires current process U');
        return U;
    };
    const nap = (ticks, label) => processes.SLEEP(ticks, sym(label));
    /** GETALT: original 6 LSRA/RORB pairs; address ALTBL + (OX16 >> 6). */
    function GETALT(X) {
        return u8(dep('readAltitude')(d(X, 'OX16') >>> 6));
    }
    /** ASTRO: circular 16-entry walking scan (different from 32-entry GTARG scan). */
    function ASTRO() {
        const U = cur();
        let X = u16(d(U, 'PD') + 2);
        if (X >= at('TLIST') + 32)
            X = at('TLIST');
        wd(U, 'PD', X);
        X = RAM.read16(X);
        if (!X || !d(X, 'OBJX') || d(X, 'OCVECT') !== sym('ASTKIL'))
            return nap(2, 'ASTRO');
        let pic = d(X, 'OPICT'), left = pic <= sym('ASTP2');
        const seed = r('SEED');
        if (left) {
            if (seed <= 8) {
                pic = sym('ASTP3');
                left = false;
            } // ASTRX1
            else {
                const wanted = Math.min(0xe8, u8(GETALT(X) + 4));
                if (wanted !== b(X, 'OY16'))
                    wb(X, 'OY16', u8(b(X, 'OY16') + (wanted > b(X, 'OY16') ? 1 : -1)));
                pic = u16(pic + at('OBJL'));
                if (pic > sym('ASTP2'))
                    pic = sym('ASTP1');
            }
        }
        else {
            if (seed <= 8) {
                pic = sym('ASTP1');
                left = true;
            } // ASTLX1
            else {
                const wanted = Math.min(0xe8, u8(GETALT(X) + 15));
                if (wanted !== b(X, 'OY16'))
                    wb(X, 'OY16', u8(b(X, 'OY16') + (wanted > b(X, 'OY16') ? 1 : -1)));
                pic = u16(pic + at('OBJL'));
                if (pic > sym('ASTP4'))
                    pic = sym('ASTP3');
            }
        }
        wd(X, 'OPICT', pic);
        wd(X, 'OX16', u16(d(X, 'OX16') + (left ? -0x20 : 0x20)));
        return nap(2, 'ASTRO');
    }
    /** ASTCLR/ASTC0: source linear list clear, 64 word-iterations not silently shortened. */
    function ASTCLR(X) {
        for (let i = 0; i < 64; i++) {
            const Y = u16(at('TLIST') + i * 2);
            if (RAM.read16(Y) !== X)
                continue;
            RAM.write16(Y, 0);
            w('ASTCNT', r('ASTCNT') - 1);
            if (r('ASTCNT') === 0)
                processes.MKPROC(sym('TERBLO'), at('STYPE'));
            return true;
        }
        throw new TranslationBoundaryError('ASTCLR original ERROR: astronaut pointer not in TLIST');
    }
    /** ASTKIL/ASTK1: player kill flag blocks a non-player astronaut death. */
    function ASTKIL(X) {
        if (r('PCFLG'))
            return false;
        return ASTK1(X);
    }
    function ASTK1(X) {
        ASTCLR(X);
        dep('KILOFF')(X);
        wd(X, 'OPICT', sym('ASXP1'));
        wd(X, 'OX16', u16(d(X, 'OX16') - 0x40));
        dep('XSVCT')(X);
        dep('SNDLD')(sym('AHSND'));
        return true;
    }
    /** AKIL1, AKIL2, AKIL10 (DEFB6.SRC 397-416): pickup if PLAYER,
     * or astronaut death and process retirement if killed by a projectile.
     * Called only by source COLCHK/COLIDE via the original OCVECT.
     */
    function AKIL1(X) {
        const U = d(X, 'OBJID');
        if (!U)
            return ASTKIL(X);
        if (!r('PCFLG')) {
            ASTK1(X);
            processes.KILLOP(X);
            return true;
        }
        if (d(U, 'PADDR') !== sym('AFALL2')) {
            dep('SNDLD')(sym('ACSND'));
            const Y = processes.MKPROC(sym('P500'), at('STYPE'));
            wd(Y, 'PD', X);
        }
        wd(U, 'PADDR', sym('AFALL2'));
        return false; // NOKILL: rescue does not kill the player
    }
    /** Source landing tail shared by AFALL / AFALL2. */
    function ALAND(X, points = 'P250') {
        const U = processes.MKPROC(sym(points), at('STYPE'));
        wd(U, 'PD', X);
        wd(X, 'OBJID', 0);
        wd(X, 'OYV', 0);
        wd(X, 'OCVECT', sym('ASTKIL'));
        dep('SNDLD')(sym('ALSND'));
        return processes.SUCIDE();
    }
    /** AFALL/AFALL0/AFALL1: unsigned velocity clamp and fatal-impact threshold. */
    function AFALL() {
        const U = cur(), X = d(U, 'PD');
        const next = u16(d(X, 'OYV') + 8);
        if (next < 0x300)
            wd(X, 'OYV', next);
        if (GETALT(X) > b(X, 'OY16'))
            return nap(4, 'AFALL');
        if (d(X, 'OYV') <= 0xe0)
            return ALAND(X, 'P250');
        ww('CENTMP', u16(d(X, 'OBJX') + 0x0107));
        ASTK1(X);
        return processes.SUCIDE();
    }
    /** AFALL2: original player pickup alignment / 500-point path. */
    function AFALL2() {
        const U = cur(), X = d(U, 'PD');
        wd(X, 'OYV', 0);
        wb(X, 'OY16', u8(r('PLAY16') + 10));
        wd(X, 'OX16', u16(r16('PLABX') + 0x80));
        if (GETALT(X) < b(X, 'OY16'))
            return ALAND(X, 'P500');
        return nap(1, 'AFALL2');
    }
    return Object.freeze({ GETALT, ASTRO, ASTCLR, ASTKIL, ASTK1, AKIL1, AFALL, AFALL2, ALAND });
}
