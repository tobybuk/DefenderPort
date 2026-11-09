/**
 * Minimal byte-addressed Williams graphics memory backing store for the
 * original STA [SX,X] / CLR [SX,X] star operations.
 * This is NOT a rasterizer or CPU emulator; it only records source writes.
 * Browser presentation reads these bytes separately from game logic.
 */
export class VideoMemory {
    constructor() {
        this.data = new Uint8Array(65536);
    }
    write8(address, value) {
        this.data[address & 0xffff] = value & 255;
    }
    read8(address) {
        return this.data[address & 0xffff];
    }
    clear() {
        this.data.fill(0);
    }
}
