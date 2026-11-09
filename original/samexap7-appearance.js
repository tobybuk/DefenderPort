/**
 * Direct native translation of SAMEXAP7.SRC APST/APST2-APST8, lines 18-63.
 * The source's $AF00 negative RSIZE and saved OBDESC/OBJPTR are retained;
 * APST does not invent a visible replacement sprite.  The browser resolves
 * symbolic descriptor handles at the boundary, without executing ROM opcodes.
 */
import { u16 } from '../runtime/integers.js';
import { SAMEX_RAM } from './samexap7-explosion-start.js';
export function createSamexap7AppearanceRoutines(RAM, Layout, { NULOB, SNDLD, EERASE, APSND = 0 } = {}) {
    const S = SAMEX_RAM;
    const a = n => Layout.at(n), rb = (X, n) => RAM.read8(u16(X + a(n)));
    const rw = (X, n) => RAM.read16(u16(X + a(n)));
    const wb = (X, n, v) => RAM.write8(u16(X + a(n)), v), ww = (X, n, v) => RAM.write16(u16(X + a(n)), v);
    const next = Y => Y + S.RAMSIZ === S.RAMEND ? S.RAMALS : Y + S.RAMSIZ;
    function APST(X) {
        const picture = rw(X, 'OPICT');
        ww(X, 'OPICT', NULOB);
        RAM.write16(a('OPTR'), X); // GETOB already saved preceding head in OLINK
        const offset = u16(rw(X, 'OX16') - RAM.read16(a('BGL')));
        if (offset > 0x2600) {
            ww(X, 'OPICT', picture);
            return null;
        }
        const old = RAM.read16(a('LSEXPL'));
        let Y = old ? next(old) : S.RAMALS, attempts = 0;
        while (attempts++ < 16 && (!old || Y !== old)) {
            if (RAM.read8(Y + S.RSIZE) & 0x80) {
                Y = next(Y);
                continue;
            }
            if (RAM.read8(Y + S.RSIZE))
                EERASE(Y);
            if (!(RAM.read8(a('STATUS')) & 0x80) && typeof SNDLD === 'function' && APSND)
                SNDLD(APSND);
            wb(X, 'OTYP', rb(X, 'OTYP') | 2);
            RAM.write16(Y + S.RSIZE, 0xaf00);
            RAM.write16(Y + S.OBDESC, picture);
            RAM.write16(Y + S.ERASES, Y + S.RAMSIZ);
            RAM.write16(Y + S.OBJPTR, X);
            return Y;
        }
        ww(X, 'OPICT', picture);
        return null;
    }
    /** Cancel an arriving object's in-flight bitmap before its original kill
     * vector recycles the object record. Without clearing OBJPTR, a later EXPU4
     * would restore a descriptor into unrelated, newly allocated game memory. */
    function CANCEL(X) {
        for (let Y = S.RAMALS; Y < S.RAMEND; Y += S.RAMSIZ) {
            if (RAM.read16(Y + S.OBJPTR) !== X || !(RAM.read16(Y + S.RSIZE) & 0x8000))
                continue;
            const original = RAM.read16(Y + S.OBDESC);
            EERASE(Y);
            RAM.write16(Y + S.RSIZE, 0);
            RAM.write16(Y + S.OBJPTR, 0);
            ww(X, 'OPICT', original);
            wb(X, 'OTYP', rb(X, 'OTYP') & 0xfd);
            return original;
        }
        return rw(X, 'OPICT');
    }
    return Object.freeze({ APST, CANCEL });
}
