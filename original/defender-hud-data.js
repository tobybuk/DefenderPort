/**
 * Original Williams Defender Red Label data, pinned e740063 (mwenge/defender).
 * DEFB6.SRC: CRTAB, 1875-1890; WCTAB is in DEFA7.SRC 1435.
 * MESS0.SRC: N0 numeral descriptors and NUMBR0..NUMBR9 (447-456, 499-538).
 * DEFB6.SRC: PLAM0 and SBD10 (2175-2184).
 *
 * Memory addresses here are *standalone JS data relocations*, NOT guessed
 * ROM addresses, and are separate from actual 6809 execution. CWRIT reads
 * their descriptor bytes from RAM as the source assembly did from mapped ROM.
 */
export const CRTAB = Uint8Array.from([0x00, 0x00, 0x07, 0x28, 0x2f, 0x81, 0xa4, 0x15, 0xc7, 0xff, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
export const WCTAB = Uint8Array.from([0x81, 0x28, 0x07, 0x16, 0x2f, 0x84, 0x15, 0x00]);
export const HUD_SOURCE_RELOC = Object.freeze({ N0V: 0xd700, PLAMIN: 0xd740, SBPIC: 0xd744, DATA: 0xd800 });
// Each row below is precisely 3 columns x 8 rows = 12 original FDB words.
const NUMBERS = Object.freeze([
    ['0101', '0101', '0101', '0100', '1100', '0000', '0000', '1100', '1111', '1111', '1111', '1100'],
    ['0000', '0100', '0000', '0000', '0111', '1000', '0000', '0000', '1111', '1111', '1111', '1100'],
    ['0101', '0000', '0001', '0100', '1100', '0001', '1000', '1100', '1111', '1110', '0000', '1100'],
    ['0100', '0000', '0000', '0100', '1100', '0011', '0000', '1100', '1111', '1111', '1111', '1100'],
    ['0000', '0101', '0000', '0000', '0110', '0011', '0000', '0000', '1111', '1111', '1111', '1100'],
    ['0101', '0101', '0000', '0100', '1110', '1011', '0000', '1100', '1100', '0011', '0101', '1100'],
    ['0101', '0101', '0101', '0100', '1110', '1011', '1010', '1100', '1100', '0011', '0101', '1100'],
    ['0100', '0000', '0001', '0100', '1100', '0001', '1110', '1000', '1111', '1110', '0000', '0000'],
    ['0101', '0100', '0101', '0100', '1110', '1011', '1010', '1100', '1101', '0110', '0101', '1100'],
    ['0101', '0101', '0000', '0100', '1110', '1011', '0000', '1100', '1101', '0111', '0101', '1100'],
]);
const PLAM0 = ['0626', '6828', '6066', '6686', '0000', '6666', '0000', 'ed66', '0000', '0063'];
const SBD10 = [0x90, 0x09, 0x90, 0x99, 0x99, 0x99, 0x90, 0xcc, 0x90];
function wordsToBytes(words) {
    const bytes = [];
    for (const word of words) {
        const d = parseInt(word, 16);
        bytes.push(d >>> 8, d & 255);
    }
    return bytes;
}
/** Install source bitmap bytes + four-byte ROMF8 descriptor records. */
export function installHudSourceData(RAM) {
    const a = HUD_SOURCE_RELOC;
    let next = a.DATA;
    const write = (addr, val) => RAM.write8(addr, val);
    function bitmap(bytes) {
        const at = next;
        for (const b of bytes)
            write(next++, b);
        return at;
    }
    function descriptor(at, width, height, data) {
        write(at, width);
        write(at + 1, height);
        RAM.write16(at + 2, data);
    }
    NUMBERS.forEach((words, digit) => descriptor(a.N0V + digit * 4, 3, 8, bitmap(wordsToBytes(words))));
    descriptor(a.PLAMIN, 5, 4, bitmap(wordsToBytes(PLAM0)));
    descriptor(a.SBPIC, 3, 3, bitmap(SBD10));
    return Object.freeze({ ...a, byteEnd: next });
}
