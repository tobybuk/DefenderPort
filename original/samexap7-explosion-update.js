/**
 * Source-derived SAMEXAP7.SRC EXPU, EXPU1-EXPU9, EWRITE/EXPN4-EXPN17,
 * NEXCOL/DONE (pinned Red Label source e740063, lines 121-202, 222-376).
 *
 * The 6809's EWRITE loop emits packed *original* picture data at expanded
 * column/row intervals; it does not interpolate, invent particles, or use
 * canvas drawing. Only its side effects on source video and SAMEX erase
 * tables are expressed here. The game harness supplies update cadence while
 * the untranslated original main EXEC timing remains an accuracy boundary.
 *
 * Picture bytes are the exact DEFB6 FDB word pairs (phase zero). The optional
 * appearance path is not wired until APST/NULOBV and its sound dependencies
 * are available: EXPU refuses to silently turn an appearance into a blast.
 */
import { u8, u16 } from '../runtime/integers.js';
import { TranslationBoundaryError } from '../runtime/continuations.js';
import { SAMEX_RAM } from './samexap7-explosion-start.js';
import { EXPU_IDLE_CYCLES, EXPU_APPEAR_CYCLES, eraseCost, writeCost } from './samexap7-cycle-ledger.js';
export function createSamexap7ExplosionUpdateRoutines(RAM, Layout, video, { resolvePicture, EERASE } = {}) {
    const S = SAMEX_RAM, a = n => Layout.at(n);
    const rb = (Y, k) => RAM.read8(u16(Y + k));
    const rw = (Y, k) => RAM.read16(u16(Y + k));
    const wb = (Y, k, v) => RAM.write8(u16(Y + k), v);
    const ww = (Y, k, v) => RAM.write16(u16(Y + k), v);
    const requirePicture = Y => {
        const desc = rw(Y, S.OBDESC);
        const picture = typeof resolvePicture === 'function' ? resolvePicture(desc) : null;
        const data = picture?.phases?.[0];
        if (!picture || !(data instanceof Uint8Array) || data.length !== picture.width * picture.height)
            throw new TranslationBoundaryError(`SAMEX EWRITE unresolved source picture $${desc.toString(16)}`);
        return picture;
    };
    const erase = Y => {
        if (typeof EERASE !== 'function')
            throw new TranslationBoundaryError('SAMEX EXPU requires original EERASE');
        return EERASE(Y);
    };
    /**
     * EWRITE: project the FDB data bytes into source column-major video space.
     * The source writes pairs of bytes per row group via STY [,U] (an odd final
     * byte via STB), recording each destination in the backwards erase table.
     * Each new RSIZE step adds EMPTY space between original source columns/rows.
     * This is not graphical upscaling: the pixels are only sparse source bytes.
     */
    function EWRITE(Y) {
        const pic = requirePicture(Y), size = rb(Y, S.RSIZE) & 0x7f;
        // EXPU4 may reach negative $8000: EWRITE sees SIZE=0 after masking
        // off the appearance flag. Original source permits this final centred pass.
        const top = rw(Y, S.TOPLFT), centre = rw(Y, S.CENTER);
        const xoff = u8((centre >>> 8) - (top >>> 8));
        const dy = u8((centre & 255) - (top & 255));
        const yoff = dy >>> 1, flavor = dy & 1;
        const firstX = (centre >>> 8) - xoff * size;
        const firstY = (centre & 255) - yoff * size * 2 - flavor;
        const intervalY = u8(size * 2);
        const end = Y + S.RAMSIZ, lowest = Y + S.OBJPTR + 2;
        let U = end, blocks = 0, columns = 0, clippedColumns = 0, clippedRows = 0;
        for (let col = 0; col < pic.width; col++) {
            const x = firstX + col * size;
            // EXPN4 and EXPN5: skip negative columns and finish right of $98.
            if (x < 0) {
                clippedColumns++;
                continue;
            }
            if (x > 0x98)
                break;
            columns++;
            const start = col * pic.height;
            for (let row = 0; row < pic.height; row += 2) {
                const y = firstY + (row >>> 1) * intervalY;
                // EXPN6 / EXPN10-EXPN17: skip above scanner and stop at wrap.
                if (y < 0x2a) {
                    clippedRows++;
                    continue;
                }
                if (y > 255)
                    break;
                if (U - 2 < lowest)
                    throw new TranslationBoundaryError('SAMEX EWRITE erase-table capacity exceeded');
                const videoAddress = ((x & 255) << 8) | (y & 255);
                U -= 2;
                RAM.write16(U, videoAddress);
                video.write8(videoAddress, pic.phases[0][start + row]);
                if (row + 1 < pic.height)
                    video.write8(u16(videoAddress + 1), pic.phases[0][start + row + 1]);
                blocks++;
            }
        }
        ww(Y, S.ERASES, U);
        // DONE: erase the two bytes at the blast centre, same as source STD D,X.
        const cx = centre >>> 8;
        if (cx <= 0x98) {
            const centreAddress = (cx << 8) | u8((centre & 255) - flavor);
            video.write8(centreAddress, 0);
            video.write8(u16(centreAddress + 1), 0);
        }
        return { blocks, size, columns, clippedColumns, clippedRows };
    }
    /** EXPU: advance all 16 source RAM slots, with original +$00AA size growth. */
    function EXPU() {
        let updated = 0, expired = 0, cycles = 0, writerBlocks = 0, eraserBlocks = 0;
        for (let Y = S.RAMALS; Y < S.RAMEND; Y += S.RAMSIZ) {
            let size = rw(Y, S.RSIZE);
            if (RAM.read8(a('STATUS')) & 4) {
                if (size & 0x8000) {
                    const X = rw(Y, S.OBJPTR);
                    ww(Y, S.RSIZE, 0);
                    if (X) {
                        ww(X, a('OPICT'), rw(Y, S.OBDESC));
                        wb(X, a('OTYP'), rb(X, a('OTYP')) & 0xfd);
                    }
                    const n = erase(Y) || 0;
                    eraserBlocks += n;
                    cycles += EXPU_APPEAR_CYCLES + eraseCost(n);
                    expired++;
                    continue;
                }
                ww(Y, S.RSIZE, 0);
                cycles += EXPU_IDLE_CYCLES;
                continue;
            }
            if (!size) {
                cycles += EXPU_IDLE_CYCLES;
                continue;
            }
            if (size & 0x8000) {
                // EXPU4: negative size counts towards zero by $0100.
                size = u16(size - 0x100);
                ww(Y, S.RSIZE, size);
                const X = rw(Y, S.OBJPTR);
                if (!(size & 0x8000) || !X) {
                    ww(Y, S.RSIZE, 0);
                    if (X) {
                        ww(X, a('OPICT'), rw(Y, S.OBDESC));
                        wb(X, a('OTYP'), rb(X, a('OTYP')) & 0xfd);
                    }
                    const n = erase(Y) || 0;
                    eraserBlocks += n;
                    cycles += EXPU_APPEAR_CYCLES + eraseCost(n);
                    expired++;
                    continue;
                }
                const diff = u16(RAM.read16(u16(X + a('OX16'))) - RAM.read16(a('BGL')));
                const within = u8((diff >>> 8) + 12);
                if (within & 0xc0) {
                    ww(Y, S.RSIZE, 0);
                    ww(X, a('OPICT'), rw(Y, S.OBDESC));
                    wb(X, a('OTYP'), rb(X, a('OTYP')) & 0xfd);
                    const n = erase(Y) || 0;
                    eraserBlocks += n;
                    cycles += EXPU_APPEAR_CYCLES + eraseCost(n);
                    expired++;
                    continue;
                }
                const top = (((diff << 2) >>> 8) << 8) | RAM.read8(u16(X + a('OY16')));
                ww(Y, S.TOPLFT, top);
                const picture = requirePicture(Y);
                // SAMEXAP7.SRC EXPU7, original 6809 arithmetic (not a geometric
                // approximation):
                //   LDB #$DA ; MUL ; ASLA ; LDU OBDESC,Y ; LDB ,U ; MUL
                //   LDB 1,U ; LSRB ; ADDD TOPLFT,Y ; STD CENTER,Y
                // The FIRST MUL leaves its high byte in A. ASLA shifts only A.
                // The SECOND MUL returns a 16-bit D, but the following LDB *replaces*
                // D's LOW byte with half the descriptor height. It is D's HIGH byte,
                // not its low byte, that contributes to the final X coordinate.
                // The previous JS accidentally used the low byte of the product,
                // causing the 15 DEFENDER appearances to originate far off-screen.
                const firstD = u16(0xda * (top >>> 8));
                const aAfterAsla = u8((firstD >>> 8) << 1);
                const secondD = u16(aAfterAsla * picture.width);
                const finalD = (secondD & 0xff00) | (picture.height >>> 1);
                ww(Y, S.CENTER, u16(top + finalD));
                const n = erase(Y) || 0;
                const written = EWRITE(Y);
                eraserBlocks += n;
                writerBlocks += written.blocks;
                cycles += EXPU_APPEAR_CYCLES + eraseCost(n) + writeCost(written);
                updated++;
                continue;
            }
            size = u16(size + 0xaa);
            ww(Y, S.RSIZE, size);
            if ((size >>> 8) > 0x30) {
                const n = erase(Y) || 0;
                eraserBlocks += n;
                cycles += EXPU_APPEAR_CYCLES + eraseCost(n);
                ww(Y, S.RSIZE, 0);
                expired++;
                continue;
            }
            // EXPU3: BGLX/BGL scroll offset quantised to the original $40 grid;
            // doubled twice before high-byte adjustment to TOPLFT and CENTER.
            const delta = u16(((RAM.read16(a('BGLX')) & 0xffc0) - (RAM.read16(a('BGL')) & 0xffc0)) << 2);
            const dx = delta >>> 8;
            wb(Y, S.CENTER, u8(rb(Y, S.CENTER) + dx));
            wb(Y, S.TOPLFT, u8(rb(Y, S.TOPLFT) + dx));
            const n = erase(Y) || 0;
            const written = EWRITE(Y);
            eraserBlocks += n;
            writerBlocks += written.blocks;
            cycles += EXPU_APPEAR_CYCLES + eraseCost(n) + writeCost(written);
            updated++;
        }
        return { updated, expired, cycles, writerBlocks, eraserBlocks };
    }
    return Object.freeze({ EWRITE, EXPU });
}
