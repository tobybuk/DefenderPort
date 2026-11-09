/**
 * Source-faithful PRBST/PRBS1/PRBS2/PRBS3/PRBS4/PRBSTX.
 * src/defb6.src lines 84–113, pinned revision e740063.
 * Probes are allocated by OBI through the original GETOB list. No process
 * timers or motion rules are introduced. APVCT is required for appearance
 * and active-list insertion, and must be translated before full gameplay.
 */
import { u8, u16, s8 } from '../runtime/integers.js';
import { TranslationBoundaryError } from '../runtime/continuations.js';
export function createDefb6ProbeRoutines(RAM, Layout, { addresses = {}, OBINIT, RAND, APVCT } = {}) {
    const at = n => Layout.at(n), off = (X, n) => u16(X + at(n));
    const read = n => RAM.read8(at(n)), word = n => RAM.read16(at(n));
    function req(name) {
        const f = { OBINIT, RAND, APVCT }[name];
        if (typeof f !== 'function')
            throw new TranslationBoundaryError(`PRBST reached missing original ${name}`);
        return f;
    }
    function symbol(name) {
        const addr = addresses[name];
        if (!Number.isInteger(addr) || addr <= 0 || addr > 65535)
            throw new TranslationBoundaryError(`PRBST missing original symbol ${name}`);
        return addr;
    }
    /** PRBST: A=count; original caller owns U process register. */
    function PRBST(A, U = word('CRPROC')) {
        let remaining = u8(A);
        if (!U || U === at('ACTIVE'))
            throw new TranslationBoundaryError('PRBST requires current process U');
        RAM.write8(at('XTEMP'), remaining);
        const created = [];
        for (;;) {
            const X = req('OBINIT')(U, {
                OPICT: symbol('PRBP1'), OCVECT: symbol('PRBKIL'), OBJCOL: 0xcccc
            });
            req('RAND')();
            // Source LDD HSEED; ANDA #$3F; ADDA #$10.
            const D = word('HSEED');
            const pos = u16(((u8((D >>> 8) & 0x3f) + 0x10) << 8) | (D & 255));
            RAM.write16(off(X, 'OX16'), pos);
            RAM.write8(off(X, 'OY16'), u8(((pos & 255) >>> 1) + at('YMIN')));
            // LDB SEED; ANDB #$3F; ADDB #-$20; SEX
            RAM.write16(off(X, 'OXV'), u16(s8(u8((read('SEED') & 0x3f) - 0x20))));
            // LDB LSEED; ANDB #$7F; SUBB #$40; SEX; BMI / ORB #$20 / ANDB #$DF.
            let B = u8((read('LSEED') & 0x7f) - 0x40);
            const negative = !!(B & 0x80);
            B = negative ? (B & 0xdf) : (B | 0x20);
            RAM.write16(off(X, 'OYV'), (negative ? 0xff00 : 0) | B);
            req('APVCT')(X);
            created.push(X);
            remaining = u8(remaining - 1);
            RAM.write8(at('XTEMP'), remaining);
            if (remaining === 0)
                break;
        }
        return created;
    }
    return Object.freeze({ PRBST });
}
