/**
 * Partial direct EXEC, SWP, and source EXEC0..EXEC03 branch translation.
 * Pinned src/defa7.src L3042-3126.
 * The original's COLCHK, XUVCT, OFSHIT and display-bank writes are explicit
 * translation boundaries, never silently replaced with gameplay substitutes.
 * An IRQ increments TIMER externally. This file does not simulate that IRQ.
 */
import { s8, u8, u16 } from '../runtime/integers.js';
import { TranslationBoundaryError } from '../runtime/continuations.js';
export function createDefa7Executive(RAM, Layout, processes, original = {}) {
    const loc = n => Layout.at(n), R8 = n => RAM.read8(loc(n)), R16 = n => RAM.read16(loc(n));
    const W8 = (n, v) => RAM.write8(loc(n), v), W16 = (n, v) => RAM.write16(loc(n), v);
    const call = (name, ...args) => {
        if (typeof original[name] !== 'function')
            throw new TranslationBoundaryError(`EXEC reached untranslated ${name}. No substitute behaviour is permitted.`);
        return original[name](...args);
    };
    /** SWP, SWP1, SWP3, SWPX: switch events are already queued by original IRQ. */
    function SWP() {
        for (let iterations = 0; iterations < 32; iterations++) {
            let X = R16('SWPROC'), D;
            if (X) {
                D = RAM.read16(loc('SWPROC') + 2);
                W16('SWPROC', 0);
            }
            else {
                X = RAM.read16(loc('SWPROC') + 4);
                if (!X)
                    return;
                D = RAM.read16(loc('SWPROC') + 6);
                RAM.write16(loc('SWPROC') + 4, 0);
            }
            // SWTAB's four bytes are [address hi,lo, PTYPE, STATUS mask].
            // SWP3 performs ANDB STATUS: the low mask byte only, not the 16-bit D.
            if (((D & 255) & R8('STATUS')) !== 0)
                continue;
            if (!X)
                continue; // source SWTAB has zero entries for continuous inputs.
            processes.MKPROC(X, D >>> 8);
        }
        throw new Error('SWP: switch queue unexpectedly re-populates indefinitely');
    }
    /** EXEC and EXEC0..EXEC03. Yields at the original timer-wait or DISP boundary. */
    function EXEC() {
        W16('CRPROC', loc('ACTIVE'));
        let A = R8('TIMER');
        if (A === 0)
            return { kind: 'await-original-timer', next: 'EXEC0' };
        W8('TIMER', 0);
        if (R8('STATUS') & 0x7d)
            W8('OVCNT', 0);
        else {
            A = u8((A << 1) + R8('OVCNT') - 4);
            if (s8(A) < 0)
                A = 0;
            W8('OVCNT', A);
            if (A >= 2) {
                W8('STRCNT', 3);
                if (A > 2) {
                    W8('OVCNT', 2);
                    let link = loc('OPTR'), X = R16('OPTR');
                    for (let n = 0; X !== 0 && n < 95; n++) {
                        if (RAM.read8(X + loc('OTYP')) === 0)
                            break;
                        link = X;
                        X = RAM.read16(X);
                    }
                    if (X) {
                        RAM.write16(link, RAM.read16(X));
                        const d = RAM.read16(loc('SEED'));
                        RAM.write16(X + loc('OX16'), u16(RAM.read16(X + loc('OX16')) +
                            (((d >>> 8) & 0x3f) + 0x60) * 256 + (d & 255)));
                        // The actual OFSHIT erasure and inactive-list transition has
                        // hardware/video side effects; don't pretend to implement them.
                        call('OFSHIT', X);
                        RAM.write16(X + loc('OBJX'), 0);
                        RAM.write16(X, R16('IPTR'));
                        W16('IPTR', X);
                    }
                }
            }
        }
        W8('MAPCR', 2);
        if (typeof original.MAPC !== 'function')
            throw new TranslationBoundaryError('EXEC MAPC bank-control operation not connected');
        original.MAPC(2);
        call('COLCHK');
        call('XUVCT');
        call('RAND');
        SWP();
        return processes.DISP();
    }
    return Object.freeze({ EXEC, SWP });
}
