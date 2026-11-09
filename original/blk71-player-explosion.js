/**
 * Williams Defender Red Label, pinned BLK71.SRC lines 562–670.
 * Native translation of PLEX/PINIT1/PINIT2/PINIT3/PINIT4/PX1/PX1A/PX2–PX8.
 *
 * TABLE in the banked ROM consists of 128 records, each ten bytes:
 *   oldVideoAddress, PXPOST, PYPOST, PXVELT, PYVELT (16 bit each).
 * This implementation keeps that exact 10-byte structure in a typed array,
 * with the source's two 16-bit LFSR seed pairs. Video writes are the original
 * $BBBB/$0B0B/$B0B0 packed colour bytes, not Canvas particles.
 * A process continuation in the host invokes PX1A once for each source NAP 1.
 * No 6809 instruction interpreter or host-generated random velocities.
 */
export const PXCOL = Object.freeze([0xff, 0x7f, 0x3f, 0x37, 0x2f, 0x27, 0x1f, 0x17, 7, 6, 5, 4, 3, 2, 0]);
const PIECES = 0x80, STRIDE = 10;
const read16 = (buf, o) => (buf[o] << 8) | buf[o + 1];
const write16 = (buf, o, v) => {
    buf[o] = (v >>> 8) & 255;
    buf[o + 1] = v & 255;
};
const complementAbs = v => v & 0x8000 ? (~v) & 65535 : v;
/** PINIT2/PINIT4: LSRA,EORA,LSRA,LSRA,ROR PSED,ROR LPSED. */
export function pxSeedNext(seed) {
    const high = seed >>> 8, low = seed & 255;
    let a = low >>> 1;
    a ^= low;
    a >>>= 1;
    const carry = a & 1;
    const nextHigh = (carry << 7) | (high >>> 1);
    const nextLow = ((high & 1) << 7) | (low >>> 1);
    return ((nextHigh << 8) | nextLow) & 65535;
}
export function createBlk71PlayerExplosionRoutines(video, { onColour = () => {
} } = {}) {
    if (!video || typeof video.write8 !== 'function')
        throw TypeError('PLEX requires source video RAM');
    const table = new Uint8Array(PIECES * STRIDE);
    let active = false, finished = false, colorIndex = 0, colorFrames = 0, frames = 0, writes = 0, accepted = 0, retries = 0;
    let seedX = 0x0808, seedY = 0x1732;
    const clearOld = () => {
        for (let i = 0; i < PIECES; i++) {
            const off = i * STRIDE, screen = read16(table, off);
            if (screen) {
                video.write8(screen, 0);
                video.write8((screen + 1) & 65535, 0);
                video.write8((screen + 0x100) & 65535, 0);
                video.write8((screen + 0x101) & 65535, 0);
            }
            write16(table, off, 0);
        }
    };
    function PLEX(center) {
        if (active)
            clearOld();
        table.fill(0);
        seedX = 0x0808;
        seedY = 0x1732;
        const x = (center >>> 8) & 255, y = center & 255;
        retries = 0;
        accepted = 0;
        writes = 0;
        frames = 0;
        for (let i = 0; i < PIECES; i++) {
            const o = i * STRIDE;
            write16(table, o + 2, x << 8);
            write16(table, o + 4, y << 8);
            let xVel = 0, yVel = 0;
            do {
                seedX = pxSeedNext(seedX);
                xVel = ((((seedX >>> 8) & 1) - 1) << 8 | (seedX & 255)) & 65535;
                seedY = pxSeedNext(seedY);
                yVel = ((((seedY >>> 8) & 3) - 2) << 8 | (seedY & 255)) & 65535;
                retries++;
                if (complementAbs(xVel) + (complementAbs(yVel) >>> 1) < 0x016a)
                    break;
                if (retries > 100000)
                    throw Error('BLK71 PINIT2: no accepted seed velocity');
            } while (true);
            write16(table, o + 6, xVel);
            write16(table, o + 8, yVel);
            accepted++;
        }
        colorIndex = 0;
        colorFrames = 56;
        active = true;
        finished = false;
        return { kind: 'player-explosion-start', pieces: PIECES };
    }
    /** PX1A/PX2…PX8. Returns true at the source's terminating zero colour. */
    function PX1A() {
        if (!active)
            return finished;
        const colour = PXCOL[colorIndex];
        onColour(colour);
        if (colour === 0) {
            active = false;
            finished = true;
            return true;
        }
        for (let i = 0; i < PIECES; i++) {
            const o = i * STRIDE, old = read16(table, o);
            if (old) {
                // PX2: STD ,U and STD $100,U (two bytes at each of two columns).
                video.write8(old, 0);
                video.write8((old + 1) & 65535, 0);
                video.write8((old + 0x100) & 65535, 0);
                video.write8((old + 0x101) & 65535, 0);
            }
            const y = (read16(table, o + 4) + read16(table, o + 8)) & 65535;
            if ((y >>> 8) < 0x2a)
                continue;
            write16(table, o + 4, y);
            table[o + 1] = y >>> 8;
            const x = (read16(table, o + 2) + read16(table, o + 6)) & 65535;
            if ((x >>> 8) > 0x98)
                continue;
            write16(table, o + 2, x);
            table[o] = x >>> 8;
            const addr = read16(table, o);
            if ((x & 255) & 0x80) {
                // PX6 right-flavour: $0B0B at ,U and $B0B0 at $100,U.
                video.write8(addr, 0x0b);
                video.write8((addr + 1) & 65535, 0x0b);
                video.write8((addr + 0x100) & 65535, 0xb0);
                video.write8((addr + 0x101) & 65535, 0xb0);
                writes += 4;
            }
            else {
                // PX2 left-flavour: $BBBB at ,U.
                video.write8(addr, 0xbb);
                video.write8((addr + 1) & 65535, 0xbb);
                writes += 2;
            }
        }
        frames++;
        colorFrames--;
        if (colorFrames === 0) {
            colorIndex++;
            colorFrames = 4;
        }
        return false;
    }
    // The original PX8 leaves B-colour video bytes in RAM and blanks the
    // programmable colour slot. Our diagnostic browser does not yet decode the
    // hardware DAC, so the host calls FINISH_DISPLAY to erase those residual
    // bytes after the translated PX8 has returned. It is NOT part of PX1A.
    function FINISH_DISPLAY() {
        if (finished)
            clearOld();
    }
    function RESET() {
        if (active || finished)
            clearOld();
        active = false;
        finished = false;
        frames = 0;
        colorIndex = 0;
        colorFrames = 0;
        writes = 0;
    }
    return Object.freeze({ PLEX, PX1A, FINISH_DISPLAY, RESET, PXCOL, table,
        STATE: () => Object.freeze({ active, finished, frames, writes, colour: PXCOL[colorIndex], colorIndex, colorFrames, accepted, retries, seedX, seedY })
    });
}
