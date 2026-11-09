/** TIEST/TIEST1/TIEST2/TIE/TIE0-TIEX/TIEKIL (DEFB6.SRC 976-1131).
 * Superprocess PD,PD2,PD4,PD6 hold object pointers; PD8 count of members.
 * The spawn coordinates, picture cycling and vertical steering are copied
 * from the original assembly; no browser-created enemies.
 */
import { u8, u16, s8, s16 } from '../runtime/integers.js';
export function createDefb6TieRoutines(RAM, L, procs, { addresses, RMAX, KILOFF, EXST, SCORE, SNDLD, SHL } = {}) {
    const a = n => L.at(n), r = n => RAM.read8(a(n)), rw = n => RAM.read16(a(n));
    const w = (n, v) => RAM.write8(a(n), v), w16 = (n, v) => RAM.write16(a(n), v);
    const b = (X, n) => RAM.read8(u16(X + a(n))), d = (X, n) => RAM.read16(u16(X + a(n)));
    const wb = (X, n, v) => RAM.write8(u16(X + a(n)), v), wd = (X, n, v) => RAM.write16(u16(X + a(n)), v);
    const U = () => rw('CRPROC');
    function TIEST(count) {
        if (count < 1 || count > 4)
            throw RangeError('TIEST squad size must be 1-4');
        w('XTEMP', count);
        w('TFLG', r('TFLG') ^ 0xff); // COM TFLG
        const xvelocity = (r('TFLG') & 128) ? r('TIEXV') : u8(-r('TIEXV'));
        const P = procs.MSPROC(addresses.TIE, a('STYPE'));
        RAM.write8(P + a('PD') + 8, count);
        for (let i = 0; i < 4; i++)
            RAM.write16(P + a('PD') + i * 2, 0);
        const members = [];
        for (let n = count; n > 0; n--) {
            const X = procs.OBINIT(P, { OPICT: addresses.TIEP1, OCVECT: addresses.TIEKIL, OBJCOL: 0x8888 });
            wd(X, 'OXV', u16(s8(xvelocity)));
            wd(X, 'OYV', 0);
            // Source TIEST2: LDA XTEMP; LSRA; RORB; ADDA XTEMP,
            // ADDD PLABX; ADDA #$80. RORB rotates bit0 of A into B bit7.
            const spaced = u16(((n >>> 1) << 8) | ((n & 1) ? 0x80 : 0));
            const initial = u16(rw('PLABX') + u16(spaced + (n << 8)) + 0x8000);
            wd(X, 'OX16', initial);
            wb(X, 'OY16', 0x50);
            RAM.write8(P + a('PD') + 9, 0x50);
            wd(X, 'OBJID', P);
            w16('OPTR', X);
            RAM.write16(P + a('PD') + (n - 1) * 2, X);
            members.push({ process: P, object: X });
        }
        return members;
    }
    function TIE() {
        const P = U(), index = (r('SEED') & 6) >>> 1, X = RAM.read16(P + a('PD') + index * 2);
        if (!X)
            return procs.SLEEP(1, addresses.TIE);
        let sprite = d(X, 'OPICT'), delta = (r('SEED') & 0x3f) - 0x20;
        sprite = u16(sprite + (delta < 0 ? a('OBJL') : -a('OBJL')));
        sprite = Math.max(addresses.TIEP1, Math.min(addresses.TIEP4, sprite));
        wd(X, 'OPICT', sprite);
        // SEX; ADDD OYV,X; STD; ASLB/ROLA x3; TFR A,B; NEGB; SEX; ADDD OYV,X.
        // Stage 76: NEGB (two's complement of the high byte), not COM as in
        // the Swarmer's MSWLP damping; the old form added an extra -1 each tick.
        let velocity = u16(d(X, 'OYV') + s8(delta));
        const high = u16(velocity << 3) >>> 8;
        velocity = u16(velocity + s8(u8(-high)));
        wd(X, 'OYV', velocity);
        // LDA OBJY,X; BNE TIE09: the on-screen test and comparison use OBJY.
        const screenY = b(X, 'OBJY');
        if (!screenY) {
            if (r('SEED') <= 0x40) {
                const adjusted = u8(RAM.read8(P + a('PD') + 9) + ((r('SEED') & 3) - 2));
                RAM.write8(P + a('PD') + 9, Math.max(0x40, Math.min(0x68, adjusted)));
            }
            const gap = u8(RAM.read8(P + a('PD') + 9) - b(X, 'OY16') + 0x10);
            if (gap > 0x20) {
                // SUBA #$10; BMI TIE07 tests gap-$10, not gap (Stage 76 fix).
                const force = (u8(gap - 0x10) & 128) ? 0x10 : 0xfff0;
                wd(X, 'OYV', u16(d(X, 'OYV') + force));
            }
        }
        else {
            const diff = s8(u8(screenY - r('PLAYC')));
            let impulse = 0;
            if (diff >= 0) {
                if (diff >= 0x20)
                    impulse = -0x10;
                else if (diff <= 0x10)
                    impulse = 0x10;
            }
            else {
                if (diff <= -0x20)
                    impulse = 0x10;
                else if (diff >= -0x10)
                    impulse = -0x10;
            }
            if (impulse)
                wd(X, 'OYV', u16(d(X, 'OYV') + impulse));
            if (!(r('LSEED') & 7))
                BOMBST(X);
        }
        return procs.SLEEP(1, addresses.TIE);
    }
    /** DEFB6 BOMBST: lay a mine. At most 10 shells; SHL BMBOUT,BMBP1,BKIL makes a
     * stationary shell at the Bomber; lifetime ODATA = (SEED&$1F)+1. The source
     * also forms HSEED*2 in D and discards it (no state effect). Stage 76: the
     * harness never supplied BOMBST, so Bombers laid no mines at all. */
    function BOMBST(X) {
        if (r('BMBCNT') >= 10)
            return null;
        if (typeof SHL !== 'function')
            throw Error('BOMBST requires original SHL (GETSHL)');
        const mine = SHL(X, U(), { OBJCOL: addresses.BMBOUT, OPICT: addresses.BMBP1, OCVECT: addresses.BKIL });
        if (!mine)
            return null;
        wb(mine, 'ODATA', u8((r('SEED') & 0x1f) + 1));
        return mine;
    }
    function TIEKIL(X) {
        const P = d(X, 'OBJID');
        KILOFF(X);
        SCORE(1, 0x25);
        EXST(X);
        if (typeof SNDLD === 'function' && addresses.TIHSND)
            SNDLD(addresses.TIHSND);
        w('TIECNT', u8(r('TIECNT') - 1));
        let found = false;
        for (let i = 0; i < 4; i++)
            if (RAM.read16(P + a('PD') + 2 * i) === X) {
                RAM.write16(P + a('PD') + 2 * i, 0);
                found = true;
                break;
            }
        if (!found)
            throw Error('TIEKIL pointer not in source squad');
        const rest = u8(RAM.read8(P + a('PD') + 8) - 1);
        RAM.write8(P + a('PD') + 8, rest);
        if (!rest)
            procs.KILL(P);
        return true;
    }
    return Object.freeze({ TIEST, TIE, TIEKIL, BOMBST });
}
