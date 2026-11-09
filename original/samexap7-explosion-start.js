/**
 * Native JavaScript transliteration of SAMEXAP7.SRC, pinned Williams source
 * e74006344b16d19245510b5e55780f90d7606bb8, EXST/EXST1–EXST8
 * (lines 68–116) and EERASE/EERAS1/EERAS2 (lines 207–218).
 *
 * This covers the original explosion RAM allocation and centre selection,
 * NOT EWRITE, EXPU, or the visual expansion raster. Register arithmetic is
 * represented as unsigned 8-/16-bit memory semantics; no 6809 emulation.
 *
 * Memory layout: RAMALS=$9c00; RAMSIZ=$40; RAMEND=$a000, 16 source slots.
 * For a slot Y: RSIZE=0, OBDESC=2, ERASES=4, CENTER=6, TOPLFT=8, OBJPTR=10.
 * Sources: https://github.com/mwenge/defender/blob/e74006344b16d19245510b5e55780f90d7606bb8/src/samexap7.src
 */
import { u8, u16 } from '../runtime/integers.js';
import { TranslationBoundaryError } from '../runtime/continuations.js';
export const SAMEX_RAM = Object.freeze({ RAMALS: 0x9c00, RAMSIZ: 0x40, RAMEND: 0xa000,
    RSIZE: 0, OBDESC: 2, ERASES: 4, CENTER: 6, TOPLFT: 8, OBJPTR: 10 });
export function createSamexap7ExplosionStartRoutines(RAM, Layout, video, { resolvePicture } = {}) {
    const at = n => Layout.at(n), s = SAMEX_RAM;
    const r = (Y, d) => RAM.read8(u16(Y + d)), d = (Y, k) => RAM.read16(u16(Y + k));
    const wb = (Y, k, v) => RAM.write8(u16(Y + k), v), wd = (Y, k, v) => RAM.write16(u16(Y + k), v);
    const next = Y => Y + s.RAMSIZ >= s.RAMEND ? s.RAMALS : Y + s.RAMSIZ;
    function EERASE(Y) {
        const end = Y + s.RAMSIZ;
        let ptr = d(Y, s.ERASES);
        if (ptr < Y + s.OBJPTR + 2 || ptr > end || ((end - ptr) & 1) !== 0)
            throw new TranslationBoundaryError(`EERASE corrupt source ERASES table $${ptr.toString(16)}`);
        const blocks = (end - ptr) / 2;
        for (; ptr < end; ptr += 2) {
            const target = RAM.read16(ptr);
            video.write8(target, 0);
            video.write8(u16(target + 1), 0);
        }
        wd(Y, s.ERASES, end);
        return blocks;
    }
    /** EXST: save source explosion bookkeeping; EWRITE/EXPU still untranslated. */
    function EXST(X) {
        const rel = u16(d(X, at('OX16')) - RAM.read16(at('BGL')));
        if ((rel >>> 8) > 0x26)
            return null; // EXST8: off screen
        RAM.write16(at('XSTART'), rel);
        const old = RAM.read16(at('LSEXPL'));
        let Y = old ? next(old) : s.RAMALS, tries = 0;
        // The exact source zero-LSEXPL branch scans RAMALS; the saved allocation
        // acts as both head sentinel and one-slot reserved position on later calls.
        while (tries++ < 16) {
            if (old && Y === old)
                return null; // EXST3/EXST8: all slots exhausted
            if (r(Y, s.RSIZE) & 0x80) {
                Y = next(Y);
                continue;
            } // appearance slot
            break;
        }
        if (tries > 16)
            return null;
        if (r(Y, s.RSIZE) !== 0)
            EERASE(Y);
        RAM.write16(at('LSEXPL'), Y);
        wd(Y, s.RSIZE, 0x0100);
        const desc = d(X, at('OPICT'));
        wd(Y, s.OBDESC, desc);
        wd(Y, s.ERASES, Y + s.RAMSIZ);
        const left = u16(rel << 2);
        const top = ((left >>> 8) << 8) | r(X, at('OY16'));
        wd(Y, s.TOPLFT, top);
        if (typeof resolvePicture !== 'function')
            throw new TranslationBoundaryError('EXST missing original OBDESC picture resolver');
        const pict = resolvePicture(desc);
        if (!pict || !Number.isInteger(pict.width) || !Number.isInteger(pict.height))
            throw new TranslationBoundaryError(`EXST unknown original picture descriptor $${desc.toString(16)}`);
        // SUBD CENTMP, ADDA width / ADDB height; BHS is C=0 after ADDA/ADDB.
        const centre = RAM.read16(at('CENTMP'));
        const offset = u16(top - centre);
        const withinX = ((offset >>> 8) + pict.width) > 255;
        const withinY = ((offset & 0xff) + pict.height) > 255;
        const selected = (withinX && withinY) ? centre :
            u16(top + (((pict.width >>> 1) & 0xff) << 8) + (pict.height >>> 1));
        wd(Y, s.CENTER, selected);
        return Y;
    }
    return Object.freeze({ EXST, EERASE });
}
