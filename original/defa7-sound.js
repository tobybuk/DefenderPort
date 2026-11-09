/**
 * Native JavaScript transliteration of `SNDOUT`, `SNDLD`, `SNDSEQ`
 * and source-named original game sound command tables in DEFA7.SRC.
 * Upstream: mwenge/defender e740063, src/defa7.src (sound table and
 * sequencer, near the end of source).
 *
 * Does NOT synthesize arbitrary arcade sound. `onBusWrite` receives the
 * original Williams PIA port bytes; translated sound BOARD firmware and
 * DAC sample timing must come later. No CPU emulator is used.
 *
 * The original ROM's assembled addresses are not asserted here. The caller
 * supplies readSourceByte(address); SNDX remains a *byte address* in the
 * exact source-defined RAM location, rather than a JS object pointer.
 */
import { u8, u16 } from '../runtime/integers.js';
// Original source tables: priority, (repeat, duration, command)*, zero terminator.
// Byte values are game data, not inferred audio parameters.
export const SOURCE_SOUND_TABLES = Object.freeze({
    CNSND: [0xff, 1, 0x18, 0x19, 0],
    RPSND: [0xff, 1, 0x20, 0x1e, 0],
    PDSND: [0xf0, 2, 0x08, 0x11, 1, 0x20, 0x17, 0],
    ST1SND: [0xf0, 1, 0x40, 0x0a, 0],
    ST2SND: [0xf0, 1, 0x10, 0x0b, 0],
    TBSND: [0xe8, 1, 4, 0x14, 2, 6, 0x11, 2, 0x0a, 0x17, 0],
    SBSND: [0xe8, 6, 4, 0x11, 1, 0x10, 0x17, 0],
    ACSND: [0xe0, 3, 0x0a, 0x08, 0],
    ALSND: [0xe0, 1, 0x18, 0x1f, 0],
    AHSND: [0xe0, 1, 0x18, 0x11, 0],
    ASCSND: [0xd8, 1, 0x10, 0x1a, 0],
    APSND: [0xd0, 1, 0x30, 0x15, 0],
    PRHSND: [0xd0, 1, 0x10, 0x05, 0],
    SCHSND: [0xd0, 1, 8, 0x17, 0],
    UFHSND: [0xd0, 1, 8, 7, 0],
    TIHSND: [0xd0, 1, 0x0a, 1, 0],
    LHSND: [0xd0, 1, 0x0a, 6, 0],
    LPKSND: [0xd0, 1, 0x10, 0x0b, 0],
    LSKSND: [0xc8, 0x0a, 1, 0x0e, 0],
    SWHSND: [0xc0, 1, 8, 7, 0],
    LASSND: [0xc0, 1, 0x30, 0x14, 0],
    LGSND: [0xc0, 1, 0x20, 0x18, 0],
    LSHSND: [0xc0, 1, 8, 3, 0],
    SSHSND: [0xc0, 1, 0x30, 9, 0],
    USHSND: [0xc0, 1, 8, 3, 0],
    SWSSND: [0xc0, 1, 0x18, 0x0c, 0],
});
/**
 * TEST-HARNESS-ONLY byte-address allocator. These addresses are explicitly
 * NOT claimed to be the assembled source ROM's original addresses.
 * This is *data storage*, not an emulator. The translated sound routines
 * operate on the same relative memory layout and RAM pointer arithmetic.
 */
export function soundTableFixture({ base = 0x4000 } = {}) {
    const memory = new Uint8Array(65536), labels = {};
    let at = base;
    for (const [name, values] of Object.entries(SOURCE_SOUND_TABLES)) {
        labels[name] = at;
        for (const v of values)
            memory[(at++) & 65535] = v;
    }
    return Object.freeze({ labels: Object.freeze(labels), read8(address) {
            return memory[u16(address)];
        } });
}
export function createDefa7SoundRoutines(RAM, Layout, { readSourceByte, onBusWrite = () => {
} }) {
    if (typeof readSourceByte !== 'function')
        throw new TypeError('SNDSEQ requires source table bytes');
    const addr = name => Layout.at(name);
    const read = name => RAM.read8(addr(name));
    const write = (name, value) => RAM.write8(addr(name), u8(value));
    const tableByte = address => u8(readSourceByte(u16(address)));
    /** SNDOUT: reset sound bus, complement command, mask LEDs, output to PIA1. */
    function SNDOUT(B) {
        // Original CLR MAPC, then STA SOUND with $3F and STB SOUND with ~B & $3F.
        const command = (~B) & 0x3f;
        RAM.write8(Layout.at('MAPC'), 0);
        RAM.write8(0xcc02, 0x3f);
        onBusWrite(0x3f);
        RAM.write8(0xcc02, command);
        onBusWrite(command);
        return command;
    }
    /** SNDLD: preserve source priority comparison and SNDX=table address-2. */
    function SNDLD(D) {
        write('THFLG', 0);
        const priority = tableByte(D);
        if (priority < read('SNDPRI'))
            return false;
        write('SNDPRI', priority);
        RAM.write16(addr('SNDX'), u16(D - 2));
        RAM.write16(addr('SNDTMR'), 0x0101);
        return true;
    }
    /** Sound source SNDS00/SNDS01: thrust on/off event when table is inactive. */
    function SNDS00() {
        if (!(read('PIA21') & 2)) {
            if (!read('THFLG'))
                return;
            write('THFLG', 0);
            SNDOUT(0x0f);
            return;
        }
        if (read('THFLG') || (read('STATUS') & 0x98))
            return;
        write('THFLG', 0x16);
        SNDOUT(0x16);
    }
    /** SNDSEQ, SNDS0, SNDS1 and SNDSX are exact original table progression. */
    function SNDSEQ() {
        let A = read('SNDTMR');
        if (A === 0) {
            SNDS00();
            return;
        }
        A = u8(A - 1);
        write('SNDTMR', A);
        if (A !== 0)
            return;
        let X = RAM.read16(addr('SNDX'));
        const rep = u8(read('SNDREP') - 1);
        write('SNDREP', rep);
        if (rep === 0) {
            X = u16(X + 3);
            RAM.write16(addr('SNDX'), X);
            A = tableByte(X);
            if (A === 0) {
                write('SNDPRI', 0);
                SNDS00();
                return;
            }
            write('SNDREP', A);
        }
        // Source LDD 1,X : A=duration, B=command
        write('SNDTMR', tableByte(X + 1));
        SNDOUT(tableByte(X + 2));
    }
    return Object.freeze({ SNDOUT, SNDLD, SNDSEQ });
}
