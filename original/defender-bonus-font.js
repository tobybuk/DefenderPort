/**
 * MESS0.SRC source character bitmaps, original Red Label snapshot e740063.
 * The characters used by DEFA7's BONUS and AMODE1 ELECV strings are installed; this is
 * not an invented browser font. Words are original FDB bytes, column-major.
 * The renderer uses ROMF8 CWRIT, and no Canvas text is used in the game.
 * These 0xDA00/0xDB00 addresses are JavaScript-only ROM-data relocations.
 */
export const BONUS_GLYPH_RELOC = Object.freeze({ DESCRIPTORS: 0xda00, DATA: 0xdb00, ASTP3: 0xda80 });
const SOURCE_WORDS = Object.freeze({
    A: '0101 0101 0101 0100 1100 0011 0000 0000 1111 1111 1111 1100',
    B: '0101 0101 0101 0100 1100 0011 0000 1100 1111 1111 1111 1100',
    C: '0101 0101 0101 0100 1110 1010 1010 1100 1100 0000 0000 1100',
    D: '0101 0101 0101 0100 1100 0000 0000 1100 1011 1111 1111 1000',
    E: '0101 0101 0101 0100 1110 1011 1010 1100 1100 0010 0000 1100',
    F: '0101 0101 0101 0100 1110 1011 1010 1000 1100 0010 0000 0000',
    G: '0101 0101 0101 0100 1110 1010 1010 1100 1100 0011 0101 1100',
    H: '0101 0101 0101 0100 1010 1011 1010 1000 0101 0111 0101 0100',
    I: '0101 0101 0101 0100 1010 1010 1010 1000',
    J: '0000 0000 0001 0100 0000 0000 0000 1100 1111 1111 1111 1100',
    K: '0101 0101 0101 0100 0000 0111 0100 0000 0110 0000 0010 0100',
    L: '0101 0101 0101 0100 1010 1010 1010 1100 0000 0000 0000 1100',
    M: '0101 0101 0101 0100 1110 1010 1010 1000 1110 1010 0000 0000 1111 1111 1111 1100',
    N: '0101 0101 0101 0100 1110 1010 1010 1000 1101 0101 0101 0100',
    O: '0101 0101 0101 0100 1110 1010 1010 1100 1101 0101 0101 1100',
    P: '0101 0101 0101 0100 1110 1011 1010 1000 1101 0111 0000 0000',
    Q: '0101 0101 0101 0100 1110 1010 1010 1100 1101 0101 0111 1110',
    R: '0101 0101 0101 0100 1110 1011 1010 1000 1101 0111 1001 0100',
    S: '0101 0101 0000 0100 1110 1011 0000 1100 1100 0011 1111 1100',
    T: '1100 0000 0000 0000 1111 1111 1111 1100 1100 0000 0000 0000',
    U: '0101 0101 0101 0100 1010 1010 1010 1100 0101 0101 0101 1100',
    V: '0101 0101 0100 0000 0000 0000 0010 0100 0101 0101 0110 0000',
    W: '0101 0101 0101 0000 1010 1010 1010 0100 1010 1010 1010 0100 1010 1010 1010 0000',
    X: '0101 0000 0001 0100 0000 1001 1000 0000 0101 1000 1001 0100',
    Y: '0101 0000 0000 0000 0000 1001 0101 0100 0101 1000 0000 0000',
    Z: '0100 0000 0101 0100 1100 0110 0000 1100 1110 0000 0000 1100',
    // MESS0.SRC PERIOD: original one-column, eight-row FDB descriptor.
    '.': '0000 0000 0000 0100',
    // MESS0.SRC 539-540 COLON FDB $0000,$0100,$0001,$0000.
    ':': '0000 0100 0001 0000'
});
export function installBonusSourceFont(RAM, astronautPicture) {
    let next = BONUS_GLYPH_RELOC.DATA;
    const descriptors = {};
    const put = (address, value) => RAM.write8(address, value);
    const putDescriptor = (address, width, height, data) => {
        put(address, width);
        put(address + 1, height);
        RAM.write16(address + 2, data);
    };
    for (const [letter, words] of Object.entries(SOURCE_WORDS)) {
        const fields = words.split(' '), width = fields.length / 4;
        if (!Number.isInteger(width) || width < 1 || width > 4)
            throw Error('Invalid source MESS0 glyph ' + letter);
        const addr = BONUS_GLYPH_RELOC.DESCRIPTORS + Object.keys(descriptors).length * 4;
        const data = next;
        for (const word of fields) {
            const w = parseInt(word, 16);
            put(next++, w >>> 8);
            put(next++, w & 255);
        }
        putDescriptor(addr, width, 8, data);
        descriptors[letter] = addr;
    }
    if (next >= 0xe000)
        throw Error('Bonus glyph relocations exceed reserved RAM window');
    if (astronautPicture?.phases?.[0]) {
        const { width, height, phases } = astronautPicture, bytes = phases[0], address = next;
        if (bytes.length !== width * height)
            throw Error('Astronaut picture must be original column-major data');
        for (const b of bytes)
            put(next++, b);
        putDescriptor(BONUS_GLYPH_RELOC.ASTP3, width, height, address);
    }
    return Object.freeze({ descriptors, ASTP3: BONUS_GLYPH_RELOC.ASTP3, byteEnd: next });
}
