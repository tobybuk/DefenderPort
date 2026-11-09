/**
 * Direct JavaScript transliteration of src/defb6.src 125-138, 194-287.
 * RANDV; MSWM/MSWM2; MSWLP/MSWM3/MSWM4/MSWM5/MSP/MSWMF/MSWL;
 * SWBMB/SWB1/SWBX. Source commit e740063.
 *
 * Original 16-bit arithmetic, damping shifts, velocity caps, signed/unsigned
 * comparisons and process NAP are preserved. Missing original projectile
 * allocation/sound hooks throw instead of spawning a substitute enemy shot.
 */
import { u8, u16, s8, s16 } from '../runtime/integers.js';
import { TranslationBoundaryError } from '../runtime/continuations.js';
export function createDefb6SwarmerRoutines(RAM, Layout, processes, { addresses = {}, RAND, RMAX, SHL, SNDLD, OBINIT } = {}) {
    const at = n => Layout.at(n), o = (X, n) => u16(X + at(n));
    const r = n => RAM.read8(at(n)), r16 = n => RAM.read16(at(n));
    const w = (n, v) => RAM.write8(at(n), v);
    const b = (X, n) => RAM.read8(o(X, n)), d = (X, n) => RAM.read16(o(X, n));
    const wb = (X, n, v) => RAM.write8(o(X, n), v), wd = (X, n, v) => RAM.write16(o(X, n), v);
    const required = (name) => {
        const fn = { RAND, RMAX, SHL, SNDLD, OBINIT }[name];
        if (typeof fn !== 'function')
            throw new TranslationBoundaryError(`Swarmer reached untranslated original ${name}`);
        return fn;
    };
    const symbol = (name) => {
        const v = addresses[name];
        if (!Number.isInteger(v) || v <= 0 || v > 65535)
            throw new TranslationBoundaryError(`Missing source symbol ${name}`);
        return v;
    };
    const current = () => {
        const U = r16('CRPROC');
        if (!U || U === at('ACTIVE'))
            throw new TranslationBoundaryError('MSWM requires current process');
        return U;
    };
    const nap = () => processes.SLEEP(3, symbol('MSWLP'));
    /** RANDV: original JSR RAND, signed SEED*2 -> OYV, LSEED mask -> OXV. */
    function RANDV(X) {
        required('RAND')();
        wd(X, 'OYV', u16(s8(r('SEED')) * 2));
        wd(X, 'OXV', u16(s8(u8((r('LSEED') & 0x3f) - 0x20))));
        return X;
    }
    /** MMSW/MMSLP: start the source-requested number of swarmers around Y.
     * NEWP/MSWM, OBI SWPIC1/MSWKIL, source random velocities and delay.
     * The current process list and free-object list are the original RAM lists.
     * No appearance routine or invented object array is involved.
     */
    function MMSW(A, Y) {
        let count = u8(A);
        let made = 0;
        for (;;) {
            const next = u8(r('SWCNT') + 1);
            if (next > 20)
                break; // MMSWX, BHI: stop before allocating
            w('SWCNT', next);
            const U = processes.MKPROC(symbol('MSWM'), at('STYPE'));
            const X = required('OBINIT')(U, {
                OPICT: symbol('SWPIC1'), OCVECT: symbol('MSWKIL'), OBJCOL: 0x2424
            });
            wd(X, 'OX16', d(Y, 'OX16'));
            wd(X, 'OY16', d(Y, 'OY16'));
            wd(U, 'PD', X);
            wd(X, 'OBJID', U);
            RANDV(X);
            const seed = r16('HSEED');
            wb(U, 'PD2', (seed & 255) & r('SWAC'));
            wb(U, 'PTIME', (seed >>> 8) & 0x1f);
            wb(U, 'PD4', required('RMAX')(r('SWSTIM')));
            RAM.write16(at('OPTR'), X); // source STX OPTR (OBINIT already linked OLINK)
            made++;
            count = u8(count - 1);
            if (count === 0)
                break;
        }
        return made;
    }
    /** MSWM: X speed points towards player; source unsigned CMPY/BHS. */
    function MSWM() {
        const U = current(), X = d(U, 'PD');
        let B = r('SWXV');
        if (r16('PLABX') < d(X, 'OX16'))
            B = u8(-B);
        wd(X, 'OXV', u16(s8(B)));
        return nap();
    }
    /** MSWLP: signed vertical acceleration/clamp/damping, chase/past test, bomb. */
    function MSWLP() {
        const U = current(), X = d(U, 'PD');
        let B = b(U, 'PD2');
        // CMPA OY16,X ; BHI MSWM3 ; NEGB
        if (r('PLAYC') <= b(X, 'OY16'))
            B = u8(-B);
        // SEX; ADDD OYV,X; clamp to +- $0200 using signed comparisons.
        let D = s16(u16(s8(B) + d(X, 'OYV')));
        if (D >= 0x0200)
            D = 0x0200;
        if (D <= -0x0200)
            D = -0x0200;
        wd(X, 'OYV', u16(D));
        // COMA/COMB; ASLB/ROLA twice; TFR A,B; SEX; ADDD OYV,X
        const complement = u16(~u16(D));
        const shifted = u16(complement << 2);
        const correction = s8(shifted >>> 8);
        D = s16(u16(D + correction));
        // LDB SEED; ANDB #$1F; ADDB #-$10; SEX; ADDD OYV,X
        D = s16(u16(D + s8(u8((r('SEED') & 0x1f) - 0x10))));
        wd(X, 'OYV', u16(D));
        // Signed? Source CMPD #300*32 / BHI is unsigned: essential at wrap.
        const distance = u16(r16('PLABX') - d(X, 'OX16') + 150 * 32);
        if (distance > 300 * 32)
            return MSWM();
        // MSWMF: DEC PD4,U; BNE MSWL
        const timer = u8(b(U, 'PD4') - 1);
        wb(U, 'PD4', timer);
        if (timer === 0)
            SWBMB(X, U);
        return nap();
    }
    /** SWBMB: source only fires if moving towards player. SHL = source shell macro. */
    function SWBMB(X, U = current()) {
        // SUBD OX16,X ; EORA OXV,X ; BMI SWBX
        const delta = u16(r16('PLABX') - d(X, 'OX16'));
        const heading = d(X, 'OXV');
        if (!(((delta >>> 8) ^ (heading >>> 8)) & 0x80)) {
            // Original SHL FBOUT,BMBP1,BKIL; source inline literal descriptor.
            const shell = required('SHL')(X, U, {
                OBJCOL: symbol('FBOUT'), OPICT: symbol('BMBP1'), OCVECT: symbol('BKIL')
            });
            if (shell) {
                wd(shell, 'OXV', u16(heading << 3));
                required('SNDLD')(symbol('SWSSND'));
                const difference = u8(r('PLAYC') - b(shell, 'OY16'));
                // CLRB ; LDA difference; ASRA,RORB x5: arithmetic D >>5.
                wd(shell, 'OYV', u16(s16(difference << 8) >> 5));
            }
        }
        wb(U, 'PD4', required('RMAX')(r('SWSTIM')));
    }
    return Object.freeze({ RANDV, MMSW, MSWM, MSWLP, SWBMB });
}
