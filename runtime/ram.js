/** Shared 64KB address space: native JS representation of original RAM variables.
 * This is DATA storage, not CPU instruction emulation or ROM execution.
 */
export class RAM {
    constructor() {
        this.data = new Uint8Array(0x10000);
    }
    read8(address) {
        return this.data[address & 0xffff];
    }
    write8(address, value) {
        this.data[address & 0xffff] = value & 255;
    }
    read16(address) {
        return (this.read8(address) << 8) | this.read8(address + 1);
    }
    write16(address, value) {
        this.write8(address, value >>> 8);
        this.write8(address + 1, value);
    }
    clear(from, toExclusive) {
        this.data.fill(0, from, toExclusive);
    }
    snapshot(from, toExclusive) {
        return this.data.slice(from, toExclusive);
    }
}
/** Look up a symbol from a generated assembly EQU/ORG/RMB map. No invented addresses. */
export class Layout {
    constructor(symbols) {
        this.s = Object.freeze({ ...symbols });
    }
    at(name) {
        const value = this.s[name];
        if (!Number.isInteger(value) || value < 0 || value > 65535)
            throw new Error(`Missing or invalid upstream symbol ${name}; run npm run source:symbols`);
        return value;
    }
    offset(base, field) {
        return (this.at(base) + this.at(field)) & 65535;
    }
}
