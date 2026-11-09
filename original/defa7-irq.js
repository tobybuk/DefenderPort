/**
 * Source-level transliteration of DEFA7.SRC IRQ/I0/I01/IRQ1/IRQ2/IRQX,
 * IRQB/IRQB2/IB0/IB01 (pinned e740063, approx lines 1928–2068).
 *
 * NO 6809 emulator and NO replacement game loop. The 6809 register and
 * hardware-context prologue/epilogue is represented by explicit memory-mapped
 * reads/writes. Original JSR dependencies are named, mandatory functions.
 *
 * The two IRQ variants handle the two halves of a raster cycle in DIFFERENT
 * orders. When a downstream source routine is not translated the code throws,
 * rather than choosing a different order or inventing its side effects.
 */
export function createDefa7IrqRoutines(RAM, Layout, deps = {}) {
    const at = n => Layout.at(n);
    const R = n => RAM.read8(at(n)), W = (n, v) => RAM.write8(at(n), v);
    const read = a => RAM.read8(a), write = (a, v) => RAM.write8(a, v);
    const call = (name, ...args) => {
        const f = deps[name];
        if (typeof f !== 'function')
            throw new Error(`IRQ reached untranslated ${name}; no invented gameplay allowed`);
        return f(...args);
    };
    const PIA1 = 0xcc02, MAPC = at('MAPC'), VERTCT = 0xc800, CRAM = 0xc000, WDOG = 0xc3fc;
    // The source uses PSHU D,X,Y then D,X,Y then D,X to copy PCRAM to CRAM.
    // The final 16 byte order is identical to a sequential copy. Retain the
    // PSHU grouping as a comment to make the original register usage auditable.
    function copyPalette() {
        for (let k = 0; k < 16; k++)
            write(CRAM + k, read(at('PCRAM') + k));
    }
    function IRQX() {
        write(MAPC, 0);
        write(PIA1 + 1, 5);
        write(MAPC, R('MAPCR'));
        // RTI's saved status-mask manipulation is hardware-only and remains at the
        // browser/host boundary; no JS game-visible state is changed by it.
    }
    // Normal Williams upright raster path: source IRQ through IRQX.
    function IRQ() {
        write(MAPC, 0);
        write(PIA1 + 1, 4);
        read(PIA1);
        let A = read(VERTCT);
        try {
            if (A >= 128) {
                if (R('IFLG'))
                    return;
                W('IFLG', (R('IFLG') + 1) & 255);
                call('SNDSEQ');
                call('PLAYER');
                call('STOUT');
                A = (read(VERTCT) - 8) & 255;
                if (A > 0xa8)
                    A = 0xa8;
                W('XXX2', A);
                write(MAPC, 2);
                const D = RAM.read16(at('XXX2'));
                call('OPROC', D);
                call('PRDISP', D);
                call('SHELL');
            }
            else {
                if (!R('IFLG'))
                    return;
                W('IFLG', 0);
                W('TIMER', (R('TIMER') + 1) & 255);
                write(WDOG, 0x38);
                if (A <= 8)
                    copyPalette();
                call('CSCAN');
                write(MAPC, 7);
                if (!(R('STATUS') & 2))
                    call('BGOUT');
                write(MAPC, 2);
                const D = RAM.read16(at('XXX1'));
                call('PRDISP', D);
                call('OPROC', D);
                call('VELO');
            }
        }
        finally {
            IRQX();
        }
    }
    // Original inverted/cocktail-screen IRQB has different execution ordering.
    function IRQB() {
        write(MAPC, 0);
        write(PIA1 + 1, 4);
        read(PIA1);
        let A = read(VERTCT);
        try {
            if (A >= 0x58) {
                if (R('IFLG'))
                    return;
                W('IFLG', (R('IFLG') + 1) & 255);
                W('XXX2', (~A) & 255); // COMA: explicitly modulo 8 bits
                call('CSCAN');
                write(MAPC, 7);
                if (!(R('STATUS') & 2))
                    call('BGOUT');
                write(MAPC, 2);
                const D = RAM.read16(at('XXX1'));
                call('PRDISP', D);
                call('OPROC', D);
            }
            else {
                if (!R('IFLG'))
                    return;
                W('IFLG', 0);
                W('TIMER', (R('TIMER') + 1) & 255);
                write(WDOG, 0x39);
                if (A <= 4)
                    copyPalette();
                call('SNDSEQ');
                call('PLAYER');
                call('STOUT');
                write(MAPC, 2);
                let D = RAM.read16(at('XXX2'));
                call('PRDISP', D);
                call('OPROC', D);
                call('SHELL');
                call('VELO');
            }
        }
        finally {
            IRQX();
        }
    }
    return Object.freeze({ IRQ, IRQB, IRQX });
}
