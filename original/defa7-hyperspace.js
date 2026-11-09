/**
 * Native-JS translation of DEFA7.SRC HYPER/HYP02/KB2/HYP0/HYP00/
 * HYP1/HYP2/HYPX (pinned Red Label source lines 3209-3276).
 *
 * A source process sleeps 15 ticks, changes the original RAM registers,
 * starts an original APVCT appearance object, and sleeps 0x28 ticks before
 * checking the source LSEED > 192 failure condition. No random teleport
 * algorithm or projectile list is invented outside these source operations.
 *
 * Original SCLR1, BGI and APVCT are mandatory injected routines. The
 * standalone runtime uses a named *relocated* sprite descriptor so that the
 * original PLAPIC/PLBPIC artwork can be dispatched without a CPU ROM map.
 */
import { u16 } from '../runtime/integers.js';
export function createDefa7HyperspaceRoutines(RAM, Layout, procs, { addresses = {}, SCLR1, BGI, APVCT, KILOFF, OFSHIT, CANCEL, onFatal } = {}) {
    const a = n => Layout.at(n), r = n => RAM.read8(a(n)), rd = n => RAM.read16(a(n));
    const w = (n, v) => RAM.write8(a(n), v), wd = (n, v) => RAM.write16(a(n), v);
    const U = () => rd('CRPROC');
    const nap = (delay, name) => {
        if (!addresses[name])
            throw Error('Hyperspace missing original continuation ' + name);
        return procs.SLEEP(delay, addresses[name]);
    };
    const call = (f, name, ...args) => {
        if (typeof f !== 'function')
            throw Error('Hyperspace missing original ' + name);
        return f(...args);
    };
    function HYPER() {
        // BITA #$FD: only STATUS=0 or 2 (no-terrain) permits hyperspace.
        if (r('STATUS') & 0xfd)
            return procs.SUCIDE();
        w('STATUS', 0x77);
        call(SCLR1, 'SCLR1');
        return nap(15, 'HYP02');
    }
    function HYP02() {
        // KILSHL loop: original SPTR link list, not the OPTR sprite list.
        let n = 0;
        while (rd('SPTR')) {
            if (++n > 95)
                throw Error('Hyperspace: corrupt shell list');
            procs.KILSHL(rd('SPTR'));
        }
        w('BMBCNT', 0);
        const seed = rd('SEED');
        wd('BGL', seed);
        wd('BGLX', seed);
        const right = (seed & 1) !== 0; // LSRB / BCC HYP0
        const x = right ? 0x2000 : 0x7000;
        wd('PLAX16', x);
        wd('NPLAD', right ? 0x0300 : 0xfd00);
        // LDB HSEED reads the first source byte (the high byte of the word).
        const altitude = ((r('HSEED') >>> 1) + a('YMIN')) & 255;
        RAM.write8(a('PLAY16'), altitude);
        wd('NPLAXC', (x & 0xff00) | altitude);
        wd('PLAXV', 0);
        RAM.write8(a('PLAXV') + 2, 0);
        wd('PLAYV', 0);
        call(BGI, 'BGI');
        // STCHK0: B=$50, original terrain bit depends on living astronauts.
        w('STATUS', 0x50 | (r('ASTCNT') ? 0 : 2));
        // OBI: original phony player sprite, no owner and NOKILL collision vector.
        const X = procs.GETOB();
        RAM.write16(X + a('OPICT'), right ? addresses.HYPAPL : addresses.HYPBPL);
        RAM.write16(X + a('OCVECT'), addresses.NOKILL);
        RAM.write16(X + a('OBJCOL'), 0);
        RAM.write16(X + a('OBJID'), U());
        RAM.write16(X + a('OXV'), 0);
        RAM.write16(X + a('OYV'), 0);
        RAM.write16(X + a('OY16'), rd('PLAY16'));
        RAM.write16(X + a('OX16'), u16((x >>> 2) + rd('BGL')));
        RAM.write16(U() + a('PD'), X);
        call(APVCT, 'APVCT', X);
        return nap(0x28, 'HYP2');
    }
    function HYP2() {
        const X = RAM.read16(U() + a('PD'));
        if (X) {
            // With the current one-EXPU-per-host-tick diagnostic cadence, an
            // appearance can still hold a pointer to X here. Disarm it before
            // KILOFF recycles the source object cell (memory-safety adapter).
            if (typeof CANCEL === 'function')
                CANCEL(X);
            if (RAM.read16(X + a('OBJX')) && typeof OFSHIT === 'function')
                OFSHIT(X);
            call(KILOFF, 'KILOFF', X);
        }
        // Original STCHK, clearing the temporary HYPER/appearance STATUS bits.
        w('STATUS', r('ASTCNT') ? 0 : 2);
        if (r('LSEED') > 192) {
            // LBHI PLEND is a branch into the player-death continuation, not a
            // detached notification. Propagate its process scheduler result.
            return call(onFatal, 'PLEND after failed hyperspace');
        }
        return procs.SUCIDE();
    }
    return Object.freeze({ HYPER, HYP02, HYP2 });
}
