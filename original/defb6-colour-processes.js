/**
 * Williams Defender Red Label DEFB6.SRC 1192-1227.
 * TIECOL/TIECL/TIECL1 and CBOMB/CBMB1/CBMB2 colour tasks.
 * Original TCTAB, BMBD10/11 and BMBD20/21 data transcribed from source.
 * The Dxxx/E800 addresses below are relocations for byte tables in a native
 * JavaScript executable, not asserted original 6809 ROM addresses.
 */
import { COLTAB } from './defa7-process-tasks.js';
export const TCTAB = Uint8Array.from([0x81, 0x81, 0x2f, 0x81, 0x2f, 0x07, 0x2f, 0x81, 0x07]);
export const BOMB_RELOC = Object.freeze({ BMBD10: 0xe800, BMBD20: 0xe80c, TCTAB: 0xe820 });
export const BOMB_SOURCE_BYTES = Object.freeze({
    BMBD10: Uint8Array.from([0xa0, 0x0a, 0xa0, 0xa0, 0x00, 0xa0, 0x0a, 0x00, 0x0a, 0x0a, 0xa0, 0x0a]),
    BMBD20: Uint8Array.from([0x0a, 0xaa, 0x0a, 0x00, 0xa0, 0x00, 0x00, 0x0a, 0x00, 0xa0, 0xaa, 0xa0])
});
export function installBombColourSourceData(RAM) {
    for (const [name, bytes] of Object.entries(BOMB_SOURCE_BYTES))
        for (let i = 0; i < bytes.length; i++)
            RAM.write8(BOMB_RELOC[name] + i, bytes[i]);
    for (let i = 0; i < TCTAB.length; i++)
        RAM.write8(BOMB_RELOC.TCTAB + i, TCTAB[i]);
}
export function createDefb6ColourProcesses(RAM, Layout, processes, addresses) {
    const at = name => Layout.at(name);
    const r = name => RAM.read8(at(name));
    const palette = (index, value) => RAM.write8(at('PCRAM') + index, value);
    const nap = (ticks, label) => processes.SLEEP(ticks, addresses[label]);
    const U = () => RAM.read16(at('CRPROC'));
    /** Source TIECOL: initialise PD with the first TCTAB pointer, sleep six. */
    function TIECOL() {
        RAM.write16(U() + at('PD'), BOMB_RELOC.TCTAB);
        return nap(6, 'TIECL');
    }
    /** Source TIECL: write three palette registers D/E/F, advance by three. */
    function TIECL() {
        const current = RAM.read16(U() + at('PD'));
        if (current < BOMB_RELOC.TCTAB || current > BOMB_RELOC.TCTAB + 6 || ((current - BOMB_RELOC.TCTAB) % 3))
            throw Error('TIECL invalid source TCTAB pointer');
        for (let k = 0; k < 3; k++)
            palette(13 + k, RAM.read8(current + k));
        const next = current + 3;
        if (next < BOMB_RELOC.TCTAB + TCTAB.length) {
            RAM.write16(U() + at('PD'), next);
            return nap(6, 'TIECL');
        }
        // Source BRA TIECOL sets PD back to TCTAB, with a fresh six-tick NAP.
        return TIECOL();
    }
    /** Source CBOMB: palette A = white, C = black for three ticks. */
    function CBOMB() {
        palette(10, 0xff);
        palette(12, 0);
        return nap(3, 'CBMB1');
    }
    /** Source CBMB1: seed-indexed colours plus alternating original mine bitmap. */
    function CBMB1() {
        const colour = COLTAB[r('SEED') & 0x1f];
        palette(10, colour);
        palette(12, colour);
        const old = RAM.read16(at('BAX'));
        RAM.write16(at('BAX'), old === BOMB_RELOC.BMBD10 ? BOMB_RELOC.BMBD20 : BOMB_RELOC.BMBD10);
        return nap(6, 'CBOMB');
    }
    return Object.freeze({ TIECOL, TIECL, CBOMB, CBMB1 });
}
