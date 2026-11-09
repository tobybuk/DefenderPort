/**
 * Source-faithful native JavaScript for the astronaut-start portion of
 * DEFA7.SRC, pinned e74006344b16d19245510b5e55780f90d7606bb8:
 *   ASTST / ASTST1 / ASTS2         source lines 1513-1540
 *   PLRES / ASTS1 / ASTS1A/B/C     source lines 1547-1576 ONLY
 *
 * The startup translation covers ASTSX/ELS1/ELS2 for copying original wave
 * values and clearing active counters. The nonzero SWMRES/SCZRES/PRBRES/
 * TIERES branches that call MMSW/SCZST/PRBST/TIEST remain untranslated.
 * No 6809 instruction emulator
 * and no artificial Canvas drawing/visibility changes are involved.
 *
 * World positions and sprite directions come from the source RAND/HSEED
 * sequence; population count is read from PTARG in the selected original
 * player-data record (the initial player-data setup is still an input fixture).
 */
export function createDefa7AstronautStartRoutines(RAM, Layout, processes, { RAND, addresses, onAstronaut, PRBST, TIEST, SCZST, MMSW, GETOB, KILLOB } = {}) {
    const at = n => Layout.at(n);
    const rd = n => RAM.read8(at(n)), wr = (n, v) => RAM.write8(at(n), v);
    const read16 = n => RAM.read16(at(n)), write16 = (n, v) => RAM.write16(at(n), v);
    const put8 = (X, n, v) => RAM.write8(X + at(n), v);
    const put16 = (X, n, v) => RAM.write16(X + at(n), v);
    const sym = name => {
        const v = addresses?.[name];
        if (!Number.isInteger(v) || v <= 0 || v > 0xffff)
            throw new Error('ASTST missing symbol ' + name);
        return v;
    };
    if (typeof RAND !== 'function')
        throw new Error('ASTST requires original RAND');
    let Y = 0;
    /** ASTST: A = number to start, B = high-byte quadrant bits 6-7. */
    function ASTST(A, B) {
        if (!Number.isInteger(A) || A < 1 || A > 32)
            throw new RangeError('ASTST requires 1..32 source astronauts');
        if (!Number.isInteger(B) || B < 0 || B > 255)
            throw new RangeError('ASTST B must be an 8-bit byte');
        RAM.write8(at('XTEMP') + 1, A);
        const made = [];
        for (let remaining = A; remaining > 0; remaining--) { // ASTST1
            // OBI ASTP1, ASTKIL, $6666 = original GETOB plus three descriptor words.
            const X = processes.GETOB();
            put16(X, 'OPICT', sym('ASTP1'));
            put16(X, 'OCVECT', sym('ASTKIL'));
            put16(X, 'OBJCOL', 0x6666);
            RAND();
            const seed = read16('HSEED');
            const high = (((seed >>> 8) & 0x1f) + B) & 255;
            put16(X, 'OX16', (high << 8) | (seed & 255));
            if (seed & 1)
                put16(X, 'OPICT', sym('ASTP3')); // LSRB / BCC / opposite direction
            put8(X, 'OY16', 0xe0);
            put8(X, 'OTYP', 0x10); // non-collide
            put16(X, 'OYV', 0);
            put16(X, 'OXV', 0);
            put16(X, 'OBJID', 0);
            write16('OPTR', X); // GETOB already captured previous OPTR in OLINK
            RAM.write16(Y, X);
            Y += 2;
            made.push(X);
            if (typeof onAstronaut === 'function')
                onAstronaut(X);
            RAM.write8(at('XTEMP') + 1, remaining - 1);
        }
        return made;
    }
    /** PLRES astronaut portion ONLY; caller supplies original PTARG player count.
     * It deliberately doesn't interpret/fabricate the trailing ASTSX enemy logic.
     */
    function PLRES_ASTROS(count) {
        if (!Number.isInteger(count) || count < 0 || count > 20)
            throw new RangeError('PLRES_ASTROS: original TLIST has twenty pointer slots');
        const U = processes.MKPROC(sym('ASTRO'), at('STYPE'));
        const start = at('TLIST');
        Y = start;
        put16(U, 'PD', start);
        for (let p = start; p < at('TLEND'); p++)
            RAM.write8(p, 0); // ASTS1
        wr('ASTCNT', count);
        const made = [];
        if (count > 7) {
            // Original `LSRA; LSRA; CLRB` divides count by four, then starts
            // equal populations in each $4000 world quadrant (ASTS1A).
            const perQuadrant = count >>> 2;
            for (let B = 0; B !== 0x100; B += 0x40)
                made.push(...ASTST(perQuadrant, B));
            const remainder = count - (perQuadrant << 2);
            for (let i = 0; i < remainder; i++)
                made.push(...ASTST(1, rd('HSEED')));
        }
        else {
            // ASTS1B/C: one original RAND-seeded human per remaining slot.
            for (let i = 0; i < count; i++)
                made.push(...ASTST(1, rd('HSEED')));
        }
        return { astronautProcess: U, objects: made };
    }
    /** Source ASTSX / ELS1 / ELS2: restore player wave table and clear counts.
     * Returns at RSW0 when other enemy reserves require untranslated sources.
     */
    function PLRES_ENEMIES() {
        const player = read16('PLRX');
        if (player !== at('P1SCR') && player !== at('P2SCR'))
            throw new Error('ASTSX requires original PLRX');
        const src = (player + at('PENEMY')) & 65535;
        for (let X = at('ELIST'); X < at('ELEND'); X++)
            RAM.write8(X, RAM.read8(src + X - at('ELIST')));
        for (let X = at('ECNTS'); X < at('ECEND'); X++)
            RAM.write8(X, 0);
        // RSW0/RSWX/RSCZX/TIER: source population restoration, including the
        // original shared super-process Tie squads and initially passive Probes.
        while (rd('SWMRES')) {
            const X = processes.GETOB();
            put8(X, 'OY16', ((rd('SEED') >>> 1) + 42) & 255);
            RAND();
            const Y = read16('HSEED');
            put16(X, 'OX16', (((((Y >>> 8) & 0x3f) + 0x80) << 8) | (Y & 255)) + read16('BGL'));
            const count = Math.min(6, rd('SWMRES'));
            if (typeof MMSW !== 'function')
                throw Error('PLRES requires MMSW for wave swarmers');
            MMSW(count, X);
            // GETOB phony object was never inserted; return it to original OFREE.
            RAM.write16(X, read16('OFREE'));
            write16('OFREE', X);
            wr('SWMRES', rd('SWMRES') - count);
        }
        if (rd('SCZRES')) {
            if (typeof SCZST !== 'function')
                throw Error('PLRES requires original SCZST');
            SCZST(rd('SCZRES'));
            wr('SCZRES', 0);
        }
        if (rd('PRBRES')) {
            if (typeof PRBST !== 'function')
                throw Error('PLRES requires original PRBST');
            const count = rd('PRBRES');
            wr('PRBCNT', count);
            wr('PRBRES', 0);
            PRBST(count);
        }
        if (rd('TIERES')) {
            if (typeof TIEST !== 'function')
                throw Error('PLRES requires original TIEST');
            wr('TIECNT', rd('TIERES'));
            while (rd('TIERES')) {
                const count = Math.min(3, rd('TIERES'));
                TIEST(count);
                wr('TIERES', rd('TIERES') - count);
            }
        }
        return { landerReserve: rd('LNDRES'), waveSize: rd('WAVSIZ'), baiterInterval: rd('UFOTIM') };
    }
    return Object.freeze({ ASTST, PLRES_ASTROS, PLRES_ENEMIES });
}
