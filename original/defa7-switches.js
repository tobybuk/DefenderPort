/**
 * Pinned DEFA7.SRC SSCAN/SSC00/SSC0A/SSC0B/SSC0C/SSC0,
 * SWITCH/SW0/SWTCH2/SWTCHX and CSCAN/CSC1/CSCX, lines ~3657–3796.
 * Source debouncers, two-deep SWPROC records, edge history and bit-scan
 * preserved byte for byte. Hardware PIA accesses are an explicit input
 * adapter, not a JavaScript reinterpretation of the game controls.
 *
 * If a source SWTAB or SWTAB1 has not been supplied, the routine throws on
 * an event rather than inventing mappings. The original busy-wait coin
 * debounce is likewise provided by a hardware timing adapter.
 */
export function createDefa7SwitchRoutines(RAM, Layout, { readPIA, gameSwitchTable, coinSwitchTable, coinDebounce1ms } = {}) {
    const at = n => Layout.at(n), r8 = n => RAM.read8(at(n)), w8 = (n, v) => RAM.write8(at(n), v);
    const r16 = n => RAM.read16(at(n)), w16 = (n, v) => RAM.write16(at(n), v);
    const IO = index => {
        if (typeof readPIA !== 'function')
            throw new Error('Original PIA hardware read adapter missing');
        const b = readPIA(index);
        if (!Number.isInteger(b) || b < 0 || b > 255)
            throw new TypeError(`PIA${index} returned non-byte value`);
        return b;
    };
    /** SWITCH: least-significant asserted bit selects 4-byte source table entry. */
    function SWITCH(A, table) {
        if ((A & 255) === 0)
            throw new Error('Original SWITCH requires nonzero switch mask');
        if (!(table instanceof Uint8Array))
            throw new Error('Original SWTAB/SWTAB1 bytes required; cannot invent switch process');
        let bit = 0, working = A & 255;
        while (!(working & 1)) {
            working >>>= 1;
            bit++;
        }
        const offset = bit * 4;
        if (offset + 4 > table.length)
            throw new Error(`Original switch table entry ${bit} missing`);
        const D = (table[offset] << 8) | table[offset + 1];
        const X = (table[offset + 2] << 8) | table[offset + 3];
        const slot = r16('SWPROC') !== 0 ? 4 : 0;
        RAM.write16(at('SWPROC') + slot, D);
        RAM.write16(at('SWPROC') + slot + 2, X);
        return { bit, slot, processTypeWord: D, processAddress: X };
    }
    /** CSCAN: source coin history then stable double check before queueing. */
    function CSCAN() {
        const A = ~(r8('PIA01') | r8('PIA02')) & 255;
        w8('PIA02', r8('PIA01'));
        const port = IO(0) & 0x3f;
        w8('PIA01', port);
        if (!(A & port))
            return null;
        if (typeof coinDebounce1ms !== 'function')
            throw new Error('Original CSCAN stable-confirmation delay missing');
        coinDebounce1ms();
        const confirmed = IO(0) & r8('PIA01');
        w8('PIA01', confirmed);
        if (!(A & confirmed))
            return null;
        return SWITCH(A & confirmed, coinSwitchTable);
    }
    /** SSCAN: original slam/coin counter order and two-sample game-switch trigger. */
    function SSCAN() {
        if (IO('0-control') & 0x40)
            w8('SLMCNT', 60);
        for (const name of ['SLMCNT', 'LCCNT', 'CCCNT', 'RCCNT']) {
            const old = r8(name);
            if (old)
                w8(name, (old - 1) & 255);
        }
        let A = ~(r8('PIA21') | r8('PIA22')) & 255;
        w8('PIA22', r8('PIA21'));
        w8('PIA21', IO(2));
        w8('PIA31', IO(3));
        A &= r8('PIA21');
        if (A !== 0)
            return SWITCH(A, gameSwitchTable);
        return CSCAN();
    }
    return Object.freeze({ SSCAN, CSCAN, SWITCH });
}
