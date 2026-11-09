/**
 * Source-level translation of original DEFA7.SRC SINIT/INIT1/INIT10,
 * INIT11/INIT12, INIT20, CRINIT/INITC, P1SW/P1SW0, P2SW, PSW1.
 * Original module locations ~969–1063 and ~1176–1203 (commit e740063).
 *
 * All original JSRs require separately translated dependencies. Calling
 * SINIT with missing modules throws; no replacement arcade startup is run.
 * RAM is the original address-map store, never a Motorola 6809 CPU interpreter.
 */
export function createDefa7InitRoutines(RAM, Layout, deps = {}) {
    const at = n => Layout.at(n), r = n => RAM.read8(at(n)), w = (n, v) => RAM.write8(at(n), v), w16 = (n, v) => RAM.write16(at(n), v);
    const read = a => RAM.read8(a), write = (a, b) => RAM.write8(a, b);
    const run = (name, ...args) => {
        if (typeof deps[name] !== 'function')
            throw new Error(`SINIT/INIT20 reached untranslated ${name}; source-first boundary`);
        return deps[name](...args);
    };
    const PIA0 = 0xcc00, PIA1 = 0xcc02, PIA3 = 0xcc06, MAPC = at('MAPC'), WDOG = 0xc3fc;
    const PIATAB = Object.freeze([0xc0, 0xff, 0, 0, 0x14, 0x05, 0x34, 0x3e]);
    // CRINIT/INITC: exactly sixteen source CRTAB bytes copied to PCRAM.
    // CRTAB must be sourced from upstream; no guessed colour palette.
    function CRINIT() {
        const table = deps.CRTAB;
        if (!(table instanceof Uint8Array) || table.length !== 16)
            throw new Error('CRINIT requires exactly 16 original CRTAB bytes');
        for (let i = 0; i < 16; i++)
            write(at('PCRAM') + i, table[i]);
    }
    // INIT20 calls source dependencies in the exact assembly sequence.
    function INIT20() {
        CRINIT();
        run('FISS');
        run('STINIT');
        run('OINIT');
        run('FBINIT');
        return run('THINIT');
    }
    function PSW1(irqVector, watchdog, control) {
        if (!Number.isInteger(irqVector) || irqVector <= 0 || irqVector > 0xffff)
            throw new Error('PSW1 needs the real assembled IRQ/IRQB source address; no invented JMP vector');
        RAM.write16(at('IRQHK') + 1, irqVector);
        w('MAPCR', 0);
        write(MAPC, 0);
        write(PIA3 + 1, control);
        write(WDOG, watchdog);
        write(at('IRQHK'), 0x7e);
    }
    function P1SW() {
        const saved = r('MAPCR');
        try {
            PSW1(deps.IRQ_ADDRESS, 0x38, 0x3c);
        }
        finally {
            w('MAPCR', saved);
            write(MAPC, saved);
        }
    }
    function P2SW() {
        const saved = r('MAPCR');
        try {
            run('MAPCHG', 0);
            if (!(read(PIA3) & 0x80))
                PSW1(deps.IRQ_ADDRESS, 0x38, 0x3c);
            else
                PSW1(deps.IRQB_ADDRESS, 0x39, 0x34);
        }
        finally {
            w('MAPCR', saved);
            write(MAPC, saved);
        }
    }
    function SINIT() {
        // The original ORCC #$FF and LDS/DP setup are hardware-stack operations.
        // Disable browser-driven IRQ scheduling before modifying shared state.
        run('DISABLE_IRQ');
        write(MAPC, 0);
        for (let i = 0; i < 4; i++) {
            const U = PIA0 + i * 2;
            write(U + 1, 0);
            write(U, PIATAB[i]);
            write(U + 1, PIATAB[i + 4]);
        }
        run('SCRCLR');
        for (let X = 0x9c00; X <= 0xbfff; X++) {
            write(X, 0);
            write(WDOG, 0x38);
        }
        write(PIA0, 0);
        write(PIA1, 0);
        if (!Number.isInteger(deps.CREDST_ADDRESS) || deps.CREDST_ADDRESS < 0 || deps.CREDST_ADDRESS > 0xffff)
            throw new Error('SINIT requires real source CMOS CREDST address');
        let B = run('RCMOSB', deps.CREDST_ADDRESS);
        if (!Number.isInteger(B) || B < 0 || B > 255)
            throw new Error('RCMOSB must return original byte B');
        if (B > 0x20 || (B & 15) > 9)
            B = 0;
        w('CREDIT', B);
        w16('HSEED', 0xa55a);
        w16('XXX1', 0xff70);
        w('XXX3', 0);
        w16('PIA01', 0xffff);
        P1SW();
        run('MAPCH3');
        run('RHSTDS');
        run('PINIT');
        INIT20();
        run('INIT');
        if (!Number.isInteger(deps.ATTR_ADDRESS) || deps.ATTR_ADDRESS <= 0 || deps.ATTR_ADDRESS > 0xffff)
            throw new Error('SINIT requires real ATTR assembler address');
        run('MKPROC', deps.ATTR_ADDRESS, at('ATYPE'));
        w('STATUS', (~r('STATUS')) & 255);
        run('ENABLE_IRQ');
        return run('EXEC');
    }
    return Object.freeze({ PIATAB, CRINIT, INIT20, PSW1, P1SW, P2SW, SINIT });
}
