/** Original player picture data, pinned src/defb6.src L2141-2174.
 * Stored as 8 VIDEO-BYTE columns of 6 rows each. Each byte contains TWO
 * HORIZONTALLY adjacent colour nibbles: sprite is 16 x 6 pixels. Stage 3
 * incorrectly presented it as 8 x 12 pixels; see original ON86 in DEFA7.SRC.
 */
const parse = s => Uint8Array.from(s.trim().split(/\s+/).map(v => parseInt(v, 16)));
export const PLD10 = parse(`00 06 26 06 26 00
66 66 66 88 88 88
00 60 66 66 88 86
00 00 00 66 66 93
00 00 00 6d 66 00
00 00 00 ef 66 00
00 00 00 00 69 00
00 00 00 00 30 00`);
export const PLD11 = parse(`00 00 02 00 02 00
06 66 66 28 68 08
60 66 66 86 88 88
00 00 60 66 86 69
00 00 00 66 66 30
00 00 00 de 66 00
00 00 00 f0 66 00
00 00 00 00 93 00`);
export const PLD20 = parse(`00 00 00 00 39 00
00 00 00 0f 66 00
00 00 00 ed 66 00
00 00 00 66 66 03
00 00 66 66 68 96
06 66 66 68 88 88
60 66 66 83 86 80
00 00 30 00 30 00`);
export const PLD21 = parse(`00 00 00 00 03 00
00 00 00 00 96 00
00 00 00 fe c3 00
00 00 00 d6 66 00
00 00 00 66 66 39
00 06 66 66 88 68
66 66 66 88 88 88
00 60 63 30 63 00`);
export const PLAPIC = Object.freeze({ width: 16, height: 6, byteColumns: 8, bytesPerColumn: 6, phases: [PLD10, PLD11] });
export const PLBPIC = Object.freeze({ width: 16, height: 6, byteColumns: 8, bytesPerColumn: 6, phases: [PLD20, PLD21] });
