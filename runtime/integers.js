/** Integer and condition-code semantics used by the translated game routines.
 * These are pure arithmetic helpers, NOT a 6809 CPU emulator.
 * 6809 values are stored in JavaScript integers, never as floating game coordinates.
 */
export const u8 = x => x & 0xff;
export const u16 = x => x & 0xffff;
export const s8 = x => (x << 24) >> 24;
export const s16 = x => (x << 16) >> 16;
export function add8(a, b, carry = 0) {
    const sum = (a & 255) + (b & 255) + (carry & 1), r = sum & 255;
    return { result: r, C: sum > 255, Z: r === 0, N: !!(r & 128), V: !!((~(a ^ b) & (a ^ r)) & 128), H: !!(((a & 15) + (b & 15) + (carry & 1)) & 16) };
}
export function sub8(a, b, borrow = 0) {
    const diff = (a & 255) - (b & 255) - (borrow & 1), r = diff & 255;
    return { result: r, C: diff < 0, Z: r === 0, N: !!(r & 128), V: !!(((a ^ b) & (a ^ r)) & 128) };
}
export function add16(a, b) {
    const sum = (a & 65535) + (b & 65535), r = sum & 65535;
    return { result: r, C: sum > 65535, Z: r === 0, N: !!(r & 32768), V: !!((~(a ^ b) & (a ^ r)) & 32768) };
}
export function sub16(a, b) {
    const diff = (a & 65535) - (b & 65535), r = diff & 65535;
    return { result: r, C: diff < 0, Z: r === 0, N: !!(r & 32768), V: !!(((a ^ b) & (a ^ r)) & 32768) };
}
export function asl8(value, carry = false) {
    const v = value & 255, r = (v << 1) & 255, c = !!(v & 128);
    return { result: r, C: c, Z: r === 0, N: !!(r & 128), V: !!((r & 128) !== (c ? 128 : 0)) };
}
export function asr8(value) {
    const v = value & 255, r = ((v >> 1) | (v & 128)) & 255;
    return { result: r, C: !!(v & 1), Z: r === 0, N: !!(r & 128) };
}
export function ror8(value, carry = false) {
    const v = value & 255, r = ((v >>> 1) | (carry ? 128 : 0)) & 255;
    return { result: r, C: !!(v & 1), Z: r === 0, N: !!(r & 128) };
}
export function rol8(value, carry = false) {
    const v = value & 255, r = ((v << 1) | (carry ? 1 : 0)) & 255;
    return { result: r, C: !!(v & 128), Z: r === 0, N: !!(r & 128) };
}
export function twosComplement16(value) {
    return (-value) & 65535;
}
export function twosComplement8(value) {
    return (-value) & 255;
}
