/**
 * Original Williams Defender DEFA7.SRC packed-object drawing entry points.
 * Source range: ON28 through OFF66, pinned e74006344b16d19245510b5e55780f90d7606bb8.
 *
 * These names are not reinvented renderer functions. Each is the source's
 * PSHU/PSHS block copy or clear, translated to byte-addressed video writes.
 * D is original video address (byte-column in high byte, raster Y in low byte).
 * Y is an original data descriptor/phase pair (not a Canvas bitmap).
 * C selects the source's original 2-byte-shifted odd-phase pointer.
 *
 * Original source internal branches ON281, ON481, OFF281, OFF481, ON341,
 * OFF341, ON641, OFF641, ON561, OFF561, ON661, OFF661, ON230, ON340 etc.
 * share the same byte-copy tail; ordinary JavaScript loops have the same
 * output bytes and memory boundaries and do not emulate processor cycles.
 *
 * Bitmap contents, initial object coordinates and frame/IRQ scheduling are
 * deliberately NOT fabricated in this module.
 */
export function createDefa7ObjectVideoRoutines(video) {
    const write = (address, byte) => video.write8(address & 65535, byte);
    function dataFor(Y, carry, expected) {
        const data = Y instanceof Uint8Array ? Y : Y?.phases?.[carry ? 1 : 0];
        if (!(data instanceof Uint8Array) || data.length !== expected)
            throw new TypeError(`Source sprite has incorrect data byte length, expected ${expected}`);
        return data;
    }
    function copy(D, Y, carry, columns, rows) {
        const data = dataFor(Y, carry, columns * rows);
        const x = D >>> 8, y = D & 255;
        for (let col = 0; col < columns; col++)
            for (let row = 0; row < rows; row++)
                write((((x + col) & 255) << 8) | ((y + row) & 255), data[col * rows + row]);
    }
    function erase(D, columns, rows) {
        const x = D >>> 8, y = D & 255;
        for (let col = 0; col < columns; col++)
            for (let row = 0; row < rows; row++)
                write((((x + col) & 255) << 8) | ((y + row) & 255), 0);
    }
    /** ON28/ON280/ON281, OFF28/OFF281: 2×8 byte columns. */
    function ON28(D, Y, carry = false) {
        copy(D, Y, carry, 2, 8);
    }
    function OFF28(D) {
        erase(D, 2, 8);
    }
    /** ON48/ON480/ON481: four 8-byte source columns; OFF48/OFF481. */
    function ON48(D, Y, carry = false) {
        copy(D, Y, carry, 4, 8);
    }
    function OFF48(D) {
        erase(D, 4, 8);
    }
    /** ON58/ON580: five 8-byte columns; OFF58/ON481 shared source tail. */
    function ON58(D, Y, carry = false) {
        copy(D, Y, carry, 5, 8);
    }
    function OFF58(D) {
        erase(D, 5, 8);
    }
    /** ON34/ON340/ON341 and OFF34/OFF341: three 4-byte columns. */
    function ON34(D, Y, carry = false) {
        copy(D, Y, carry, 3, 4);
    }
    function OFF34(D) {
        erase(D, 3, 4);
    }
    /** ON23/ON230, OFF23: two 3-byte columns. */
    function ON23(D, Y, carry = false) {
        copy(D, Y, carry, 2, 3);
    }
    function OFF23(D) {
        erase(D, 2, 3);
    }
    /** ON64/ON640/ON641, OFF64/OFF641: six 4-byte columns. */
    function ON64(D, Y, carry = false) {
        copy(D, Y, carry, 6, 4);
    }
    function OFF64(D) {
        erase(D, 6, 4);
    }
    /** ON56/ON560/ON561, OFF56/OFF561: five 6-byte columns. */
    function ON56(D, Y, carry = false) {
        copy(D, Y, carry, 5, 6);
    }
    function OFF56(D) {
        erase(D, 5, 6);
    }
    /** ON66/ON660/ON661, OFF66/OFF661: six 6-byte columns. */
    function ON66(D, Y, carry = false) {
        copy(D, Y, carry, 6, 6);
    }
    function OFF66(D) {
        erase(D, 6, 6);
    }
    return Object.freeze({ ON28, OFF28, ON48, OFF48, ON58, OFF58, ON34, OFF34,
        ON23, OFF23, ON64, OFF64, ON56, OFF56, ON66, OFF66 });
}
