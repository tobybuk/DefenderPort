/**
 * Williams Defender Red Label DEFA7.SRC L1325-1431:
 * PLEND, PDEATH, PDTHL, PDTH2, PDTH4, PDTH5, PLE01/PLE02/PLE2.
 *
 * Source process timing, STATUS bits, monochrome pixel conversion (MONO),
 * PXCTB palette changes and original player bitmap are retained. The source's
 * BLK71 PXVCT/PLEX ship fragments are delegated to a separate source
 * translation. The hardware DAC and final PLSTRT / PLE2 startup bridge
 * remain explicit host boundaries.
 *
 * This is NOT a CPU interpreter or a substitute physics/death game loop.
 */
import { PLAPIC, PLBPIC } from './defb6-player-data.js';
const PXCTB = Object.freeze([7, 7, 7, 0x0f, 0x3f, 0x7f, 0xff, 0xff, 0]);
const mono = picture => Object.freeze({ ...picture, phases: picture.phases.map(bytes => Uint8Array.from(bytes, v => (v & 0xf0 ? 0xb0 : 0) | (v & 0x0f ? 0x0b : 0))) });
const MONOPIC = Object.freeze({ left: mono(PLAPIC), right: mono(PLBPIC) });
export function createDefa7PlayerDeathRoutines(RAM, L, processes, { addresses = {}, playerVideo, PLSAV, SNDLD, beginExplosion, updateExplosion, finishDeath } = {}) {
    const a = n => L.at(n), r = n => RAM.read8(a(n)), rd = n => RAM.read16(a(n)), w = (n, v) => RAM.write8(a(n), v), wd = (n, v) => RAM.write16(a(n), v);
    const p = () => rd('CRPROC');
    const nap = (time, label) => {
        const x = addresses[label];
        if (!Number.isInteger(x) || !x)
            throw Error('PLEND missing original continuation ' + label);
        return processes.SLEEP(time, x);
    };
    const video = () => {
        if (!playerVideo || typeof playerVideo.ON86 !== 'function' || typeof playerVideo.OFF86 !== 'function')
            throw Error('PLEND requires original ON86/OFF86');
        return playerVideo;
    };
    function PLEND() {
        // STCHK0 with B=$58; retain bit 1 when the planet is already destroyed.
        w('STATUS', 0x58 | (r('ASTCNT') ? 0 : 2));
        wd('BGLX', rd('BGL'));
        video().OFF86(rd('PLAXC'));
        if (typeof PLSAV !== 'function' || typeof SNDLD !== 'function')
            throw Error('PLEND missing PLSAV/PDSND dependency');
        PLSAV();
        SNDLD();
        RAM.write8(p() + a('PD'), 0); // PXCTB index (diagnostic symbol address remains in process record)
        return PDTHL();
    }
    function PDTHL() {
        video().OFF86(rd('NPLAXC'));
        return nap(2, 'PDTH2');
    }
    function PDTH2() {
        const pic = (rd('NPLAD') & 0x8000) ? MONOPIC.right : MONOPIC.left;
        video().ON86(rd('NPLAXC'), pic, (RAM.read8(a('PLAX16') + 1) & 0x80) !== 0);
        const U = p(), index = RAM.read8(U + a('PD'));
        if (index >= PXCTB.length)
            throw Error('PDTH2 PXCTB index outside source data');
        const color = PXCTB[index];
        if (!color) {
            w('STATUS', 0x7f);
            RAM.write8(a('PCRAM'), 0xff);
            return nap(2, 'PDTH5');
        }
        RAM.write8(a('PCRAM') + 0x0b, color);
        RAM.write8(a('PCRAM'), 0);
        RAM.write8(U + a('PD'), index + 1);
        return nap(2, 'PDTHL');
    }
    function PDTH5() {
        RAM.write8(a('PCRAM'), 0);
        video().OFF86(rd('NPLAXC'));
        processes.GNCIDE();
        if (typeof beginExplosion !== 'function' || typeof updateExplosion !== 'function')
            throw Error('PDTH5 missing original BLK71 PLEX/PX1A dependency');
        // DEFA7 PDTH5: LEAX $0403,X, JSR PXVCT. PLEX's continuation is
        // resumed by its own NAP 1 process until the final PXCOL zero byte.
        beginExplosion((rd('NPLAXC') + 0x0403) & 0xffff);
        return nap(1, 'PX1A');
    }
    function PX1A() {
        if (!updateExplosion())
            return nap(1, 'PX1A');
        if (typeof finishDeath !== 'function')
            throw Error('PX8 missing PLE01/PLE2 transition dependency');
        finishDeath();
        return processes.SUCIDE();
    }
    return Object.freeze({ PLEND, PDEATH: PLEND, PDTHL, PDTH2, PDTH5, PX1A, PXCTB, MONOPIC });
}
