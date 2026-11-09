/**
 * Data-only native transcription of the Williams Defender sound board
 * VSNDRM1.SRC (Sam Dicker, 10/1980).
 * https://github.com/historicalsource/williams-soundroms/blob/main/VSNDRM1.SRC
 * Source labels retained verbatim. No replacement instrument samples.
 * Waves VSNDRM1.SRC 1070–1088; vectors 1100–1115; patterns 1120–1151;
 * VARI 1004–1008; organ 1019–1065.
 */
const $ = x => parseInt(x, 16);
export const GWVTAB = Object.freeze([
    { label: 'GS2', samples: [127, 217, 255, 217, 127, 36, 0, 36] },
    { label: 'GSSQ2', samples: [0, 64, 128, 0, 255, 0, 128, 64] },
    { label: 'GS1', samples: [127, 176, 217, 245, 255, 245, 217, 176, 127, 78, 36, 9, 0, 9, 36, 78] },
    { label: 'GS12', samples: [127, 197, 236, 231, 191, 141, 109, 106, 127, 148, 146, 113, 64, 23, 18, 57] },
    { label: 'GSQ22', samples: [255, 255, 255, 255, 0, 0, 0, 0, 255, 255, 255, 255, 0, 0, 0, 0] },
    { label: 'GS72', samples: [138, 149, 160, 171, 181, 191, 200, 209, 218, 225, 232, 238, 243, 247, 251, 253, 254, 255, 254, 253, 251, 247, 243, 238, 232, 225, 218, 209, 200, 191, 181, 171, 160, 149, 138, 127, 117, 106, 95, 84, 74, 64, 55, 46, 37, 30, 23, 17, 12, 8, 4, 2, 1, 0, 1, 2, 4, 8, 12, 17, 23, 30, 37, 46, 55, 64, 74, 84, 95, 106, 117, 127] },
    { label: 'GS1.7', samples: [89, 123, 152, 172, 179, 172, 152, 123, 89, 55, 25, 6, 0, 6, 25, 55] },
]);
export const VVECT = Object.freeze([
    { label: 'SAW', bytes: [$('40'), 1, 0, $('10'), $('e1'), 0, $('80'), 255, 255] },
    { label: 'FOSHIT', bytes: [$('28'), 1, 0, 8, $('81'), 2, 0, 255, 255] },
    { label: 'QUASAR', bytes: [$('28'), $('81'), 0, $('fc'), 1, 2, 0, $('fc'), 255] },
    { label: 'CABSHK', bytes: [255, 1, 0, $('18'), $('41'), 4, $('80'), 0, 255] }
]);
export const RADSND = Object.freeze([0x8c, 0x5b, 0xb6, 0x40, 0xbf, 0x49, 0xa4, 0x73, 0x73, 0xa4, 0x49, 0xbf, 0x40, 0xb6, 0x5b, 0x8c]);
export const GFRTAB = Object.freeze({
    BONSND: [0xa0, 0x98, 0x90, 0x88, 0x80, 0x78, 0x70, 0x68, 0x60, 0x58, 0x50, 0x44, 0x40],
    HBTSND: [1, 1, 2, 2, 4, 4, 8, 8, 0x10, 0x10, 0x30, 0x60, 0xc0, 0xe0],
    SPNSND: [1, 1, 2, 2, 3, 4, 5, 6, 7, 8, 9, 0xa, 0xc],
    TRBPAT: [0x80, 0x7c, 0x78, 0x74, 0x70, 0x74, 0x78, 0x7c, 0x80],
    HBDSND: [1, 1, 2, 2, 4, 4, 8, 8, 0x10, 0x20, 0x28, 0x30, 0x38, 0x40, 0x48, 0x50, 0x60, 0x70, 0x80, 0xa0, 0xb0, 0xc0],
    BBSND: [8, 64, 8, 64, 8, 64, 8, 64, 8, 64, 8, 64, 8, 64, 8, 64, 8, 64, 8, 64],
    HBESND: [1, 2, 4, 8, 9, 0xa, 0xb, 0xc, 0xe, 0xf, 0x10, 0x12, 0x14, 0x16],
    SPNR: [0x40],
    COOLDN: [0x10, 8, 1],
    STDSND: [1, 1, 1, 1, 2, 2, 3, 3, 4, 4, 5, 6, 8, 0xa, 0xc, 0x10, 0x14, 0x18, 0x20, 0x30, 0x40, 0x50, 0x40, 0x30, 0x20, 0x10, 0xc, 0xa, 8, 7, 6, 5, 4, 3, 2, 2, 1, 1, 1],
    ED10FP: [7, 8, 9, 0xa, 0xc, 8],
    ED13FP: [0x17, 0x18, 0x19, 0x1a, 0x1b, 0x1c],
});
/** Source SVTAB: [GECHO/GCCNT, GECDEC/WAVE#, PREDECAY, GDFINC, GDCNT, length, pattern] */
export const SVTAB = Object.freeze([
    ['HBDV', 0x81, 0x24, 0, 0, 0, 22, 'HBDSND'],
    ['STDV', 0x12, 0x05, 0x1a, 0xff, 0, 39, 'STDSND'],
    ['DP1V', 0x11, 0x05, 0x11, 1, 15, 1, 'BBSND'], // SWPAT EQU * immediately before BBSND
    ['XBV', 0x11, 0x31, 0, 1, 0, 13, 'SPNSND'],
    ['BBSV', 0xf4, 0x12, 0, 0, 0, 20, 'BBSND'],
    ['HBEV', 0x41, 0x45, 0, 0, 0, 15, 'HBESND'],
    ['PROTV', 0x21, 0x35, 0x11, 0xff, 0, 13, 'SPNSND'],
    ['SPNRV', 0x15, 0, 0, 0xfd, 0, 1, 'SPNR'],
    ['CLDWNV', 0x31, 0x11, 0, 1, 0, 3, 'COOLDN'],
    ['SV3', 1, 0x15, 1, 1, 1, 1, 'BBSND'],
    ['ED10', 0xf6, 0x53, 3, 0, 2, 6, 'ED10FP'],
    ['ED12', 0x6a, 0x10, 2, 0, 2, 6, 'ED13FP'],
    ['ED17', 0x1f, 0x12, 0, 0xff, 0x10, 4, 'SPNR'],
    ['BONV', 0x31, 0x11, 0, 0xff, 0, 13, 'BONSND'],
    ['TRBV', 0x12, 0x06, 0, 0xff, 1, 9, 'TRBPAT'],
]);
// DP1V uses SWPAT, the alias at the start of BBSND; no fabricated frequency data.
// SV3 has BBSND + 1 bytes of original neighbouring frequency data; callers receive a source-ordered byte view.
export const GFRTAB_ORDER = ['BONSND', 'HBTSND', 'SPNSND', 'TRBPAT', 'HBDSND', 'BBSND', 'HBESND', 'SPNR', 'COOLDN', 'STDSND', 'ED10FP', 'ED13FP'];
export const FLAT_FRQ = Object.freeze(GFRTAB_ORDER.flatMap(k => GFRTAB[k]));
export const FLAT_INDEX = Object.freeze(Object.fromEntries(GFRTAB_ORDER.map(k => [k, GFRTAB_ORDER.slice(0, GFRTAB_ORDER.indexOf(k)).reduce((n, key) => n + GFRTAB[key].length, 0)])));
// Source NOTTAB indexed 0..11: AF,A,BF,B,C,CS,D,EF,E,F,FS,G.
export const NOTTAB = Object.freeze([0x47, 0x3f, 0x37, 0x30, 0x29, 0x23, 0x1d, 0x17, 0x12, 0x0d, 0x08, 0x04]);
const T = { AF: 34715 >> 1, A: 36780 >> 1, BF: 38967 >> 1, B: 41284 >> 1, C: 43739 >> 1, CS: 46340 >> 1, D: 49096 >> 1, EF: 52015 >> 1, E: 55108 >> 1, F: 58385 >> 1, FS: 61857 >> 1, G: 65535 >> 1 };
const trunc = n => Math.floor(n);
// [oscillator mask, note delay, duration] transcribed from each FDB entry in ORGTAB.
export const ORGTAB = Object.freeze({
    PHANTOM: [[0x7f, 0x1d, trunc(T.D / 3 / 2)], [0x7f, 0x23, trunc(T.CS / 3 / 2)], [0xfe, 0x08, trunc(T.FS / 3) * 2]],
    TOCCATA: [
        [0x3e, 0x3f, trunc(T.A / 4 / 8)], [0x7c, 4, trunc(T.G / 4 / 8)], [0x3e, 0x3f, trunc(T.A / 4 / 2) * 5],
        [0x7c, 0x12, trunc(T.E / 4 / 2)], [0x7c, 0x0d, trunc(T.F / 4 / 2)], [0x7c, 0x23, trunc(T.CS / 4 / 2)], [0x7c, 0x1d, trunc(T.D / 4 / 4) * 7],
        [0x7c, 0x3f, trunc(T.A / 4 / 8)], [0xf8, 4, trunc(T.G / 4 / 8)], [0x7c, 0x3f, trunc(T.A / 4 / 2) * 5],
        [0xf8, 0x12, trunc(T.E / 4 / 2)], [0xf8, 0x0d, trunc(T.F / 4 / 2)], [0xf8, 0x23, trunc(T.CS / 4 / 2)], [0xf8, 0x1d, trunc(T.D / 4) * 2],
        [0xf8, 0x23, trunc(T.CS / 4 / 4)], [0xf8, 0x12, trunc(T.E / 4 / 4)], [0xf8, 4, trunc(T.G / 4 / 4)],
        [0x7c, 0x37, trunc(T.BF / 4 / 4)], [0x7c, 0x23, trunc(T.CS / 4 / 4)], [0x7c, 0x12, trunc(T.E / 4 / 4)],
        [0x3e, 4, trunc(T.G / 4 / 4)], [0x3e, 0x37, trunc(T.BF / 4 / 4)], [0x3e, 0x23, trunc(T.CS / 4 / 4)],
        [0x1f, 0x12, trunc(T.E / 4 / 4)], [0x1f, 4, trunc(T.G / 4 / 4)], [0x1f, 0x37, trunc(T.BF / 4 / 4)],
        [0x1f, 0x23, trunc(T.CS / 4)], [0xfe, 0x1d, trunc(T.D / 4)],
        [0x7f, 0x37, trunc(T.BF / 4)], [0x7f, 0x3f, trunc(T.A / 4 / 2)],
        [0xfe, 4, trunc(T.G / 4 / 2)], [0xfe, 0x0d, trunc(T.F / 4 / 2)], [0xfe, 0x23, trunc(T.CS / 4 / 2)],
        [0xfe, 0x1d, trunc(T.D / 4 / 2) * 2]
    ]
});
