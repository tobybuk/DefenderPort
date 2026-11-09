/**
 * Original BLK71.SRC WVTAB..WVTEND, source lines 672–721, pinned e740063.
 * Each source row is MAX,MIN,INTRA_DELTA,INTER_DELTA,W1,W2,W3,W4.
 * This is DATA, not a wave-design approximation.
 */
const rows = [
    [20, 0, 0, 0, 15, 20, 20, 20], // Landers
    [3, 0, 0, 0, 0, 3, 4, 5], // Ties
    [6, 0, 0, 0, 0, 1, 3, 4], // Probes
    [10, 0, 0, 0, 0, 0, 0, 0], // Schitzos
    [10, 0, 0, 0, 0, 0, 0, 0], // Swarmers
    [30, 0, 0, 0, 30, 25, 20, 16], // Wave time
    [5, 0, 0, 0, 5, 5, 5, 5], // Wave size
    [0x60, 0, 3, 2, 0x16, 0x1e, 0x26, 0x2e], // LNDXV
    [1, 0, 0, 0, 0, 0, 1, 1], // LNDYV high
    [0xff, 0, 0x10, 0, 0x70, 0xb0, 0, 0], // LNDYV low
    [0x80, 0x10, 0xfc, 0xfe, 0x4a, 0x3a, 0x2a, 0x2a], // LDSTIM
    [0x30, 0, 0, 0, 0x20, 0x28, 0x2c, 0x30], // TIEXV
    [2, 0, 0, 0, 1, 1, 2, 2], // SZRY
    [1, 0, 0, 0, 0, 0, 1, 1], // SZYV high
    [0xff, 0, 8, 6, 0x62, 0xe0, 2, 0x12], // SZYV low
    [0x60, 0, 8, 4, 0x0c, 0x1c, 0x24, 0x28], // SZXV
    [0xff, 8, 0xfe, 0xfe, 0x2a, 0x22, 0x1e, 0x1c], // SZSTIM
    [0x60, 0, 8, 2, 0x16, 0x1e, 0x20, 0x22], // SWXV
    [40, 10, -2, -1, 25, 25, 25, 25], // SWSTIM
    [0x3f, 0, 0, 0, 0x1f, 0x1f, 0x1f, 0x3f], // SWAC
    [0xc0, 0x18, 0xf4, 0xfc, 0xd4, 0xc4, 0xa4, 0x94], // UFOTIM
    [10, 3, 0xff, 0xff, 15, 13, 12, 10], // UFSTIM
    [200, 40, 0xf4, 0xf8, 240, 220, 200, 200], // UFOSK
];
export const WVTAB = Uint8Array.from(rows.flat().map(n => n & 255));
export const WVTAB_ROWS = 23;
