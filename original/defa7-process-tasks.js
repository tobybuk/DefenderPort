/**
 * Original DEFA7.SRC, source e740063, lines 3020–3040, 3278–3305:
 *   COLR/COLRLP/COLR0/COLR1 (laser colour process),
 *   SCPROC/SCP1/SCP2 (object scanner process).
 *
 * A process continuation is a saved source routine address, NEVER a frame
 * modulo or browser timer. Callbacks correspond to named source JSRs only.
 */
import { TranslationBoundaryError } from '../runtime/continuations.js';
export const COLTAB = Object.freeze([
    0x38, 0x39, 0x3a, 0x3b, 0x3c, 0x3d, 0x3e, 0x3f, 0x37, 0x2f, 0x27, 0x1f, 0x17,
    0x47, 0x47, 0x87, 0x87, 0xc7, 0xc7, 0xc6, 0xc5, 0xcc, 0xcb, 0xca, 0xda, 0xe8, 0xf8,
    0xf9, 0xfa, 0xfb, 0xfd, 0xff, 0xbf, 0x3f, 0x3e, 0x3c, 0x00
]);
export function createDefa7ProcessTasks(RAM, Layout, scheduler, { addresses = {}, ISCAN, OSCAN, SHSCAN, MAPCH1, SCNRV } = {}) {
    const at = n => Layout.at(n), read = n => RAM.read8(at(n)), write = (n, v) => RAM.write8(at(n), v);
    const nap = (ticks, label) => {
        if (!Number.isInteger(addresses[label]) || addresses[label] <= 0)
            throw new TranslationBoundaryError(`NAP requires source continuation ${label}`);
        return scheduler.SLEEP(ticks, addresses[label]);
    };
    const call = (name) => {
        const fn = { ISCAN, OSCAN, SHSCAN, MAPCH1, SCNRV }[name];
        if (typeof fn !== 'function')
            throw new TranslationBoundaryError(`SCPROC missing original ${name}`);
        return fn();
    };
    /** COLR: reset source table index and fall through to COLRLP. */
    function COLR() {
        write('LCOLRX', 0);
        return COLRLP();
    }
    /** COLRLP/COLR0/COLR1: source byte table, 2-tick NAP. */
    function COLRLP() {
        const idx = read('LCOLRX');
        if (idx >= COLTAB.length)
            throw new Error('COLR source colour index outside COLTAB');
        const B = COLTAB[idx];
        if (!B)
            return COLR();
        write('LCOLRX', idx + 1);
        RAM.write8(at('PCRAM') + 1, B);
        return nap(2, 'COLRLP');
    }
    /** SCPROC: ISCAN; NAP 2,SCP1. */
    function SCPROC() {
        call('ISCAN');
        return nap(2, 'SCP1');
    }
    /** SCP1: OSCAN, SHSCAN; NAP 2,SCP2. */
    function SCP1() {
        call('OSCAN');
        call('SHSCAN');
        return nap(2, 'SCP2');
    }
    /** SCP2: MAPCH1, SCNRV; NAP 4,SCPROC. */
    function SCP2() {
        call('MAPCH1');
        call('SCNRV');
        return nap(4, 'SCPROC');
    }
    return Object.freeze({ COLR, COLRLP, SCPROC, SCP1, SCP2 });
}
