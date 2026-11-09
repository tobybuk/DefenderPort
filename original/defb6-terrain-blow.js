/** Source-native TERBLO/TBLP0/TBL3/TBL4, DEFB6.SRC 437-493.
 * The original 16-iteration destruction process uses BGERAS and STETAB
 * clearing, two source TEREX expansions per iteration, and delayed IRQ ticks.
 * Sound and colour hardware are boundary callbacks; no replacement Canvas effect.
 */
import { u8, u16 } from '../runtime/integers.js';
export function createDefb6TerrainBlowRoutines(RAM, L, procs, { addresses, RAND, RMAX, GETALT, EXST, BGERAS, SNDLD, terrainBank } = {}) {
    // DEFA7.SRC COLTAB FCB source data. TERBLO indexes only bytes 0..31.
    const COLTAB = Uint8Array.from([
        0x38, 0x39, 0x3a, 0x3b, 0x3c, 0x3d, 0x3e, 0x3f, 0x37, 0x2f, 0x27, 0x1f, 0x17,
        0x47, 0x47, 0x87, 0x87, 0xc7, 0xc7, 0xc6, 0xc5, 0xcc, 0xcb, 0xca, 0xda, 0xe8, 0xf8,
        0xf9, 0xfa, 0xfb, 0xfd, 0xff
    ]);
    const a = n => L.at(n), r = n => RAM.read8(a(n)), rw = n => RAM.read16(a(n));
    const w = (n, v) => RAM.write8(a(n), v), ww = (n, v) => RAM.write16(a(n), v);
    const U = () => rw('CRPROC');
    function TERBLO() {
        w('STATUS', r('STATUS') | 2);
        RAM.write8(U() + a('PD'), 0);
        BGERAS();
        // STETAB is the original scanner terrain pointer array; clear the
        // pointed-to bytes, not the 16-bit pointer table itself.
        for (let X = a('STETAB'); X < a('STETAB') + 128; X += 2) {
            const p = RAM.read16(X);
            if (p)
                RAM.write16(p, 0);
        }
        return TBLP0();
    }
    function TBLP0() {
        const X = rw('OFREE');
        if (!X)
            throw Error('TERBLO source OFREE exhausted');
        RAM.write16(u16(X + a('OPICT')), addresses.TEREX);
        for (let n = 0; n < 2; n++) {
            RAND();
            const origin = rw('HSEED'), position = u16((((origin >>> 8) & 0x3f) << 8) | (origin & 255));
            RAM.write16(u16(X + a('OX16')), u16(position + rw('BGL')));
            const y = GETALT(X);
            RAM.write8(u16(X + a('OY16')), y);
            ww('CENTMP', u16(((position << 2) & 0xff00) | u8(y - 10)));
            EXST(X);
        }
        w('PCRAM', COLTAB[r('SEED') & 0x1f]);
        if (typeof SNDLD === 'function')
            SNDLD(addresses.AHSND);
        w('OVCNT', 8);
        return procs.SLEEP(2, addresses.TBL3);
    }
    function TBL3() {
        w('PCRAM', 0);
        const elapsed = RAM.read8(U() + a('PD'));
        const ticks = RMAX((elapsed >>> 3) + 1);
        w('OVCNT', 8);
        return procs.SLEEP(ticks, addresses.TBL4);
    }
    function TBL4() {
        const P = U(), next = u8(RAM.read8(P + a('PD')) + 1);
        RAM.write8(P + a('PD'), next);
        if (next < 16)
            return TBLP0();
        if (typeof SNDLD === 'function' && Number.isInteger(addresses.TBSND))
            SNDLD(addresses.TBSND);
        return procs.SUCIDE();
    }
    return Object.freeze({ TERBLO, TBLP0, TBL3, TBL4 });
}
