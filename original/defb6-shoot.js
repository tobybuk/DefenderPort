/**
 * Exact source-level routines SHOOT/SHOOT0/SHOOTX/LSHOT/LSHTX.
 * src/defb6.src lines 530-582, upstream e740063.
 *
 * All projectile allocation goes through source GETSHL (SHL macro). It may
 * fail because of the original shell cap/range; SHOOT then returns false (Z).
 * No browser objects, projectiles or float-vector aiming are created here.
 */
import { u8, u16, s8 } from '../runtime/integers.js';
import { TranslationBoundaryError } from '../runtime/continuations.js';
export function createDefb6ShootRoutines(RAM, Layout, { addresses = {}, GETSHL, RMAX, SNDLD } = {}) {
    const a = n => Layout.at(n), off = (X, n) => u16(X + a(n));
    const r = n => RAM.read8(a(n)), read16 = n => RAM.read16(a(n));
    const b = (X, n) => RAM.read8(off(X, n)), d = (X, n) => RAM.read16(off(X, n));
    const wb = (X, n, v) => RAM.write8(off(X, n), v), wd = (X, n, v) => RAM.write16(off(X, n), v);
    const current = () => {
        const U = read16('CRPROC');
        if (!U || U === a('ACTIVE'))
            throw new TranslationBoundaryError('SHOOT/LSHOT require original process U');
        return U;
    };
    const required = name => {
        const f = { GETSHL, RMAX, SNDLD }[name];
        if (typeof f !== 'function')
            throw new TranslationBoundaryError(`SHOOT/LSHOT requires original ${name}`);
        return f;
    };
    const symbol = name => {
        const v = addresses[name];
        if (!Number.isInteger(v) || v <= 0 || v > 65535)
            throw new TranslationBoundaryError(`SHOOT missing source address ${name}`);
        return v;
    };
    /** SHOOT: source SHL then randomised player-relative signed byte aim. */
    function SHOOT(X, U = current()) {
        const bullet = required('GETSHL')(X, U, {
            OBJCOL: symbol('FBOUT'), OPICT: symbol('BMBP1'), OCVECT: symbol('BKIL')
        });
        if (!bullet)
            return false;
        // LDB SEED; ANDB #$1F; ADDB #-$10; ADDB PLAXC; SUBB OBJX,X; SEX; *4
        const dx = s8(u8((r('SEED') & 0x1f) - 0x10 + r('PLAXC') - b(bullet, 'OBJX')));
        let xv = u16(dx * 4);
        // LDB SEED; CMPB #120; BLS SHOOT0; PLAXV *4 added when seed >120
        if (r('SEED') > 120)
            xv = u16(xv + (read16('PLAXV') << 2));
        wd(bullet, 'OXV', xv);
        // SHOOT0: LDB LSEED; ANDB #$1F; ADDB #-$10; ADDB PLAYC;
        // SUBB OBJY,X; SEX; ASLB/ROLA twice.
        const dy = s8(u8((r('LSEED') & 0x1f) - 0x10 + r('PLAYC') - b(bullet, 'OBJY')));
        wd(bullet, 'OYV', u16(dy * 4));
        return true; // Source LDA #1, return NE.
    }
    /** LSHOT: DEC PD6,U, RMAX original LDSTIM, SHOOT, then sound if fired. */
    function LSHOT(X, U = current()) {
        const timer = u8(b(U, 'PD6') - 1);
        wb(U, 'PD6', timer);
        if (timer !== 0)
            return false;
        wb(U, 'PD6', required('RMAX')(r('LDSTIM')));
        if (!SHOOT(X, U))
            return false;
        required('SNDLD')(symbol('LSHSND'));
        return true;
    }
    return Object.freeze({ SHOOT, LSHOT });
}
