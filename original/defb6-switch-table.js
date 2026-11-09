/**
 * DEFB6.SRC 1844–1859, SWTAB (pinned Williams Red Label source e740063).
 * Eight 4-byte entries: FDB process address, FCB process type, FCB STATUS mask.
 * Process addresses are relocation handles in the native-JS runtime, not ROM addresses.
 * Unimplemented START1/START2 cabinet credit commands are intentionally zero
 * in this one-player, already-started browser host; no invented coin accounting.
 */
export function defenderGameSwitchTable(addresses, { STYPE = 0 } = {}) {
    const entries = [
        [addresses.LFIRE, STYPE, 0xe8], [0, 0, 0],
        [addresses.SBOMB, STYPE, 0xf8], [addresses.HYPER, STYPE, 0xf8],
        [0, STYPE, 0], [0, STYPE, 0],
        [addresses.REV, STYPE, 0xe8], [0, 0, 0]
    ];
    const bytes = new Uint8Array(32);
    for (let n = 0; n < 8; n++) {
        const [address, type, mask] = entries[n];
        if (address === undefined || !Number.isInteger(address))
            throw new TypeError('Missing source action handle for SWTAB entry ' + n);
        bytes.set([(address >>> 8) & 255, address & 255, type & 255, mask & 255], n * 4);
    }
    return bytes;
}
