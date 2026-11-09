/**
 * DEFB6.SRC SCZST/SCZS0/SCZS1 (lines 589-621) native source transliteration.
 * Williams Defender pinned assembly e74006344b16d19245510b5e55780f90d7606bb8.
 *
 * Process/object records, source RAND and RMAX, and source APVCT insertion are
 * dependencies. Nothing is painted directly in Canvas. The source writes
 * STA PD,U for a timer then overwrites PD,U with STX PD,U: both writes are
 * retained literally, rather than silently 'fixing' this assembly quirk.
 */
import { u8, u16 } from '../runtime/integers.js';
export function createDefb6MutantStartRoutines(RAM, Layout, procs, { addresses = {}, OBINIT, RAND, RMAX, APVCT, onMutant } = {}) {
    const at = n => Layout.at(n), read = n => RAM.read8(at(n)), r16 = n => RAM.read16(at(n));
    const write = (n, v) => RAM.write8(at(n), v);
    const sym = n => {
        const v = addresses[n];
        if (!Number.isInteger(v) || v <= 0 || v > 65535)
            throw Error('SCZST unresolved source ' + n);
        return v;
    };
    function SCZS0(A) {
        const count = u8(A);
        if (count === 0)
            return [];
        write('XTEMP', count);
        const produced = [];
        for (let remaining = count; remaining > 0; remaining--) {
            const U = procs.MKPROC(sym('SCZ0'), at('STYPE'));
            const X = OBINIT(U, { OPICT: sym('SCZP1'), OCVECT: sym('SCZKIL'), OBJCOL: 0xcc33 });
            RAND();
            const origin = u16(r16('BGL') - 300 * 32);
            RAM.write16(at('XTEMP2'), origin);
            let delta = u16(r16('HSEED') - origin);
            if (delta < 600 * 32)
                delta = u16(delta + 0x8000);
            RAM.write16(X + at('OX16'), u16(origin + delta));
            RAM.write8(X + at('OY16'), u8((read('SEED') >>> 1) + at('YMIN')));
            RAM.write16(X + at('OYV'), 0);
            RAM.write16(X + at('OXV'), 0);
            const shotTimer = u8(RMAX(read('SZSTIM')));
            RAM.write8(U + at('PD'), shotTimer); // literal STA PD,U from source
            APVCT(X);
            RAM.write16(X + at('OBJID'), U);
            RAM.write16(U + at('PD'), X); // literal STX PD,U (overwrites previous timer)
            write('SCZCNT', read('SCZCNT') + 1);
            write('XTEMP', remaining - 1);
            produced.push({ process: U, object: X });
            if (typeof onMutant === 'function')
                onMutant(X, U);
        }
        return produced;
    }
    function SCZST(A) {
        return SCZS0(A);
    }
    return Object.freeze({ SCZST, SCZS0 });
}
