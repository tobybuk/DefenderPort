/**
 * AMODE1.SRC, pinned Red Label e740063, LGOTAB 996–1045.
 * Source byte stream for the WILLIAMS line drawing. $FE is HYPERC,
 * $FD is QUIT, and the cursor-motion bytes are otherwise literal.
 * No Canvas/font/substitute graphics are used for the logo.
 */
const hex = s => Uint8Array.from(s.trim().split(/\s+/).map(s => parseInt(s, 16)));
export const LGOTAB = hex(`
FE 74 40
11 11 85 81 81 81 88 82
82 22 24 22 42 24 24 24
44 24 44 49 44 94 41 88
14 41 88 14 41 88 94 41
88 94 49 88 14 98 58 94
98 18 94 46 66 62 42 42
42 42 25 24 24 68 24 24
24 26 11 18 18 58 18 58
81 44 98 81 44 98 81 44
98 14 94 94 16 22 24 24
A4 24 A4 24 24 24 24 24
FE 81 4A
42 42 42 42 44 99 99 41
88 14 41 88 14 46 24 24
24 24 24 24 A4 24 24 A4
22 42 4A 42 42 44 99 19
91 19 91 91 81 81 41 81
49 46 42 42 42 42 42 42
24 22 42 62 62 42 24 49
19 91 91 91 91 91 85 88
14 94 14 24 24 24 24 24
24 A4 24 24 41 81 81 18
18 94 41 88 14 14 24 42
24 24 24 24 24 24 24 44
98 18 18 18 58 89 44 18
85 14 24 14 24 A4 24 24
24 A4 24 28 24 44 18 19
19 81 41 81 14 24 24 24
24 22 42 42 64 41 85 81
81 18 19 41 89 44 42 22
42 24 24 24 24 24 44 18
14 98 11 81 81 41 89 44
42 22 42 24 24 24 24 24
44 18 94 41 88 89 44 49
88 14 41 88 14 14 24 24
24 26 62 66 26 24 18 91
91 19 18 14 18 14 14 24
14 2A 45 24 68 88 24 44
42 18 A8 82 44 A8 22 20
FE 87 40
44 11 88 24
FE 9A 3F
44 11 88 24
FE C1 3F
44 44 44 11 11 11 11 88
88 88 22 22 22 20
FE C3 45
22 22 44 11 81 50
FD`);
export const AMODE_ENEMIES = Object.freeze([
    { name: 'LANDER', picture: 'LNDP1', y: 0x6000, x: 0x0900, blip: 0x4433 },
    { name: 'MUTANT', picture: 'SCZP1', y: 0x6000, x: 0x1100, blip: 0xcc33 },
    { name: 'BAITER', picture: 'UFOP1', y: 0x6200, x: 0x1980, blip: 0x3333 },
    { name: 'BOMBER', picture: 'TIEP1', y: 0x9800, x: 0x0960, blip: 0x8888 },
    { name: 'POD', picture: 'PRBP1', y: 0x9800, x: 0x1160, blip: 0xcccc },
    { name: 'SWARMER', picture: 'SWPIC1', y: 0x9a00, x: 0x19e0, blip: 0x2424 }
]);
/** DEFDAT, AMODE1.SRC 1049–1094: source RLE for the large 60×24 logo. */
export const DEFDAT = hex(`
10 D1 BD 29 C2 9C 29 CB
EA C2 8C 29 C2 81 0D 10
C2 8D 29 C2 9C 29 CB EA
42 94 29 42 81 0C 3F 29
C2 94 C2 9C 29 C1 8D A4
29 42 94 29 3F 3E 29 42
A4 29 4C 29 C1 8D A4 2A
42 94 29 3E 3D B6 B4 A2
4A 17 CA 16 C1 9C B4 A7
A4 B1 7A 7A 3D 3C B6 B4
B1 71 81 6B 16 C1 AC A4
B6 B4 A2 4A 6B 3C 2F B6
B4 29 62 85 C2 85 C1 AC
A4 B6 B4 28 62 A2 F2 EB
61 84 29 62 8E 28 E2 A4
B7 B4 28 62 A2 E2 DB 7B
42 96 28 4E 28 E2 B4 B6
B4 29 62 92 E2 CB 7B 52
96 28 4E 28 EB 41 A4 B7
B4 28 62 92 E1 FB 7B 5B
24 B1 6D 18 14 EB 51 94
B7 B4 18 17 29 2D 1E B1
4B 4B 25 B1 6D B1 5E B5
1A 4B 61 84 B2 4B 41 82
C1 DB 14 B5 18 17 18 16
D1 81 4E B6 19 4B 61 84
18 24 B4 18 1F 1C 38 53
84 B1 6E 2B CB 61 94 38
42 B4 18 41 81 EF 39 43
85 B1 6E 2B CB 71 84 38
43 84 B6 18 1C E3 95 38
41 81 6D 38 CB C6 19 42
B5 38 4B 61 8F D3 95 38
5B 51 F3 8C BD 61 84 2A
63 85 B6 18 ED 38 53 94
18 51 F3 8C BD 7B 42 91
42 B5 18 7B DC 21 51 F3
4C 7E 30 6C C2 14 2C 34
C7 E1 07 C1 35 CC 21 42
C3 4C 7F 10 6C 13 5C C1
35 C1 52 C3 4C 7F 15 C2
7D 34 C1 5C 17 CC 36 C3
5C 14 2D 34 C7 1C 14 C2
6E 34 D1 4E 15 CC 36 C3
5C 14 2D 34 C7 1C 14 C2
51 C2 7D 14 F1 4C`);
/**
 * DEFNNN / DEFX1–8: exact byte run-length/pixel-phase transform.
 * Returns the original 60-by-24 column-major colour-index bytes.
 */
export function DEFNNN() {
    const bytes = new Uint8Array(24 * 60 + 24); // guard for source's next-column write before wrap
    let x = 0, pix = 0, len = 0;
    for (const src of DEFDAT)
        for (const nibble of [src >>> 4, src & 15]) {
            if (!(nibble & 12)) {
                len = ((nibble + len) << 2) & 255;
                continue;
            }
            len = (len + (nibble & 3)) & 255;
            const color = [0x22, 0xcc, 0][(nibble >>> 2) - 1];
            if (x >= 24 * 60)
                x += 1 - 24 * 60;
            if (pix) {
                bytes[x] = (bytes[x] & 0xf0) | (color & 15);
                x += 24;
                len = (len - 1) & 255;
                if (len >= 0x80) {
                    pix = 0;
                    len = 0;
                    continue;
                }
            }
            else
                pix = 0xff;
            while (true) {
                bytes[x] = color;
                len = (len - 1) & 255;
                if (len >= 0x80)
                    break;
                x += 24;
                len = (len - 1) & 255;
                if (len < 0x80)
                    continue;
                pix = 0;
                break;
            }
            len = 0;
        }
    return bytes.subarray(0, 24 * 60);
}
