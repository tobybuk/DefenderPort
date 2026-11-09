/**
 * DEFA7.SRC OPROC / OPLP0 / OPON / OPLP / OPRX (pinned e740063,
 * source lines 2500–2545). Direct, native-JavaScript transliteration.
 *
 * D is the original interrupt-provided scanline clip pair (A=upper, B=lower).
 * The object record is the actual PHR6 memory record, not a JavaScript game
 * object. Picture descriptor callbacks MUST be installed from original picture
 * data; unknown descriptors throw instead of using substitute artwork.
 *
 * The original uses JMP [OBJDEL,Y] / JMP [OBJWRT,Y] with 6809 registers.
 * `resolvePicture(Y)` is the browser-independent equivalent of reading the
 * picture descriptor. It must return {OBJW,OBJDEL,OBJWRT}; callbacks receive
 * source video address D, original descriptor pointer Y, object pointer X,
 * and carry for the sub-byte picture phase. No CPU opcodes are interpreted.
 */
import { u16 } from '../runtime/integers.js';
export function createDefa7ObjectProcessRoutines(RAM, Layout, { resolvePicture } = {}) {
    const a = n => Layout.at(n);
    const off = (X, field) => u16(X + a(field));
    const r8 = (X, field) => RAM.read8(off(X, field));
    const r16 = (X, field) => RAM.read16(off(X, field));
    const w16 = (X, field, value) => RAM.write16(off(X, field), value);
    function picture(Y) {
        const item = typeof resolvePicture === 'function' ? resolvePicture(Y) : null;
        if (!item || !Number.isInteger(item.OBJW) || item.OBJW < 0 || item.OBJW > 255 ||
            typeof item.OBJDEL !== 'function' || typeof item.OBJWRT !== 'function')
            throw new Error(`OPROC reached unresolved original picture descriptor $${Y.toString(16).padStart(4, '0')}`);
        return item;
    }
    /** OPROC — preserve source erasure-then-output ordering and unsigned tests. */
    function OPROC(D) {
        D = u16(D);
        if (RAM.read8(a('STATUS')) & 0x20)
            return;
        const upper = D >>> 8, lower = D & 255;
        let X = RAM.read16(a('OPTR'));
        const visited = new Set();
        while (X !== 0) {
            if (visited.has(X) || visited.size >= 95)
                throw new Error('OPROC invalid original object list (cycle or excessive records)');
            visited.add(X);
            // OPLP0: old draw position can be erased only inside this IRQ raster interval.
            const old = r16(X, 'OBJX');
            if (old) {
                const oldY = old & 255;
                if (oldY > upper || oldY <= lower) {
                    X = r16(X, 'OLINK');
                    continue;
                }
                {
                    const Y = r16(X, 'OPICT');
                    const descriptor = picture(Y);
                    descriptor.OBJDEL(old, Y, X);
                    w16(X, 'OBJX', 0);
                }
            }
            // OPON: new position is independent of the previous erased address.
            const newY = r8(X, 'OY16');
            if (newY <= upper && newY > lower) {
                const delta = u16(r16(X, 'OX16') - RAM.read16(a('BGL')));
                if (delta < 150 * 64) {
                    const Y = r16(X, 'OPICT');
                    const descriptor = picture(Y);
                    // Original ASLB/ROLA, ASLB/ROLA: 16-bit shift by two.
                    const shifted = u16(delta << 2);
                    const A = shifted >>> 8, B = shifted & 255;
                    // ADDA OBJW,Y / CMPA #$9C: byte arithmetic, unsigned comparison.
                    const widthLimit = (A + descriptor.OBJW) & 255;
                    if (widthLimit <= 0x9c) {
                        // SUBA OBJW,Y restores the original high byte modulo 256.
                        const displayA = (widthLimit - descriptor.OBJW) & 255;
                        // ASLB shifts B left and sends its bit7 to 6809 carry.
                        const carry = Boolean(B & 0x80);
                        const videoAddress = (displayA << 8) | newY;
                        w16(X, 'OBJX', videoAddress);
                        descriptor.OBJWRT(videoAddress, Y, X, carry);
                    }
                }
            }
            X = r16(X, 'OLINK');
        }
    }
    return Object.freeze({ OPROC });
}
