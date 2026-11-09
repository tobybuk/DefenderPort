/**
 * Original DEFA7.SRC: OSCAN/OSC1/OSCLP and ISCAN/ISC1/SCYV3/SCYV4/ISCLP.
 * Pinned source lines 3307-3372, e74006344b16d19245510b5e55780f90d7606bb8.
 * Exact linked object record semantics with 16-bit unsigned comparisons,
 * including eightfold velocity integration for offscreen objects.
 */
import { u16 } from '../runtime/integers.js';
export function createDefa7ScanningRoutines(RAM, Layout) {
    const a = n => Layout.at(n), rd = n => RAM.read16(a(n)), wr = (n, v) => RAM.write16(a(n), v);
    const i = (X, field) => u16(X + a(field));
    const LIMIT = 500 * 32, BUFFER = 100 * 32;
    /** OSCAN, OSC1, OSCLP: move objects outside the 500-pixel band to IPTR. */
    function OSCAN() {
        const origin = u16(rd('BGL') - BUFFER);
        wr('XTEMP', origin);
        let Y = a('OPTR'), X = RAM.read16(Y);
        for (let count = 0; X; count++) {
            if (count >= 95)
                throw new Error('OSCAN: cyclic or oversized object list');
            const delta = u16(RAM.read16(i(X, 'OX16')) - origin);
            if (delta < LIMIT) {
                Y = X;
                X = RAM.read16(X);
                continue;
            }
            const next = RAM.read16(i(X, 'OLINK'));
            RAM.write16(Y, next);
            RAM.write16(i(X, 'OLINK'), rd('IPTR'));
            wr('IPTR', X);
            X = RAM.read16(Y);
        }
    }
    /** ISCAN, ISC1, SCYV3, SCYV4, ISCLP: integrate 8 ticks and re-activate. */
    function ISCAN() {
        const origin = u16(rd('BGL') - BUFFER);
        wr('XTEMP', origin);
        let Y = a('IPTR'), X = RAM.read16(Y);
        for (let count = 0; X; count++) {
            if (count >= 95)
                throw new Error('ISCAN: cyclic or oversized object list');
            let D = u16((RAM.read16(i(X, 'OYV')) << 3) + RAM.read16(i(X, 'OY16')));
            let A = D >>> 8;
            if (A < a('YMIN'))
                A = a('YMAX');
            if (A > a('YMAX'))
                A = a('YMIN');
            RAM.write16(i(X, 'OY16'), (A << 8) | (D & 255));
            D = u16((RAM.read16(i(X, 'OXV')) << 3) + RAM.read16(i(X, 'OX16')));
            RAM.write16(i(X, 'OX16'), D);
            const delta = u16(D - origin);
            if (delta >= LIMIT) {
                Y = X;
                X = RAM.read16(X);
                continue;
            }
            const next = RAM.read16(i(X, 'OLINK'));
            RAM.write16(Y, next);
            RAM.write16(i(X, 'OLINK'), rd('OPTR'));
            wr('OPTR', X);
            X = RAM.read16(Y);
        }
    }
    return Object.freeze({ OSCAN, ISCAN });
}
