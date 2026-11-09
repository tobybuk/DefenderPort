/**
 * Original DEFA7.SRC, pinned e740063: LDISP/LDSP, TDISP/TD1,
 * SBDISP/SBDSP, with the source's routine ordering and byte arithmetic.
 * Drawing dependencies must be supplied as source ROMF8 CWRIT/BLKCLR
 * translations. Stage 29 installs original ROM font/icon bytes at explicitly
 * relocated JavaScript RAM addresses, so source HUD writes reach video RAM.
 * No substitute Canvas sprites, text or icons are used.
 */
export function createDefa7HudRoutines(RAM, Layout, { displayEquates = {}, BLKCLR, CWRIT, BORDER, SCRTR0 } = {}) {
    const at = n => Layout.at(n), r8 = n => RAM.read8(at(n));
    function requireCall(fn, name) {
        if (typeof fn !== 'function')
            throw new Error(`Original ${name} required; no substitute HUD rendering permitted`);
        return fn;
    }
    const equate = name => {
        const v = displayEquates[name];
        if (!Number.isInteger(v) || v < 0 || v > 65535)
            throw new Error(`Missing original source display equate ${name}`);
        return v;
    };
    /** LDSP = CMPA #5 / BLS / capped mini-ship rendering. */
    function LDSP(X, A) {
        const block = requireCall(BLKCLR, 'BLKCLR');
        const write = requireCall(CWRIT, 'CWRIT');
        const count = Math.min(A & 255, 5);
        block(X, 0x20, 0x06); // LDD #$2006; JSR BLKCLR, after LDX #P1LAT/P2LAT
        if (!count)
            return;
        const Y = equate('PLAMIN');
        let D = X;
        for (let i = 0; i < count; i++) {
            write(D, Y);
            D = (((D >>> 8) + 6) & 255) * 256 + (D & 255); // ADDA #$06
        }
    }
    /** LDISP — one or two source player records (not browser HUD state). */
    function LDISP() {
        LDSP(equate('P1LAT'), r8('P1LAS'));
        if (((r8('PLRCNT') - 1) & 255) !== 0)
            LDSP(equate('P2LAT'), r8('P2LAS'));
    }
    /** SBDSP = capped 3 smart bombs; byte-level Y shifts. */
    function SBDSP(X, A) {
        const block = requireCall(BLKCLR, 'BLKCLR');
        const write = requireCall(CWRIT, 'CWRIT');
        const count = Math.min(A & 255, 3);
        block(X, 0x03, 0x0b); // LDD #$030B
        if (!count)
            return;
        const Y = equate('SBPIC');
        let D = X;
        for (let i = 0; i < count; i++) {
            write(D, Y);
            D = (D & 0xff00) | ((D + 4) & 255); // ADDB #4
        }
    }
    /** SBDISP mirrors the original 1-player/2-player branch and caps. */
    function SBDISP() {
        SBDSP(equate('P1SBD'), r8('P1SBC'));
        if (((r8('PLRCNT') - 1) & 255) !== 0)
            SBDSP(equate('P2SBD'), r8('P2SBC'));
    }
    /** TDISP: source order clear, bezel, laser icons, bombs, score transfer. */
    function TDISP() {
        requireCall(BLKCLR, 'BLKCLR')(0x3008, 0x40, 0x20); // X=SCANER; D=$4020
        requireCall(BORDER, 'BORDER')();
        LDISP();
        SBDISP();
        let A = r8('PLRCNT');
        const transfer = requireCall(SCRTR0, 'SCRTR0');
        // TD1 JSR SCRTR0; DECA; BNE TD1 (zero would wrap to 256 calls).
        do {
            transfer(A);
            A = (A - 1) & 255;
        } while (A !== 0);
    }
    return Object.freeze({ TDISP, LDISP, LDSP, SBDISP, SBDSP });
}
