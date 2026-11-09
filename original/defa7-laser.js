/**
 * Source-first LFIRE/LASR/LASL/LASD/LCOL/COLIDE from DEFA7.SRC 2759-3018.
 * Screen is Williams' column-major byte framebuffer; LASP1 = 8 by 1,
 * LASD10 = FFFF FFFF FFFF FFFF (DEFB6.SRC 1938-1941).
 * The source collision scan compares nonzero overlapping source picture BYTES,
 * not HTML/Canvas rectangles.  Only the source kill vectors are callbacks.
 */
import { u8, u16 } from '../runtime/integers.js';
export const LASP1 = Object.freeze({ width: 8, height: 1, phases: [Uint8Array.from([255, 255, 255, 255, 255, 255, 255, 255])] });
export function createDefa7LaserRoutines(RAM, Layout, procs, video, { pictures, kill, SNDLD } = {}) {
    const a = n => Layout.at(n), r = n => RAM.read8(a(n)), rw = n => RAM.read16(a(n));
    const w = (n, v) => RAM.write8(a(n), v), ww = (n, v) => RAM.write16(a(n), v);
    const rb = (X, n) => RAM.read8(u16(X + a(n))), rd = (X, n) => RAM.read16(u16(X + a(n)));
    const wd = (X, n, v) => RAM.write16(u16(X + a(n)), v);
    const render = (x, y, byte) => {
        if (x >= 0 && x < 0x9c && y > 41 && y < 241)
            video.write8((x << 8) | y, byte);
    };
    /** COL0 shares the same byte-intersection loop with COLIDE, but starts
     * from a caller-supplied head (SPTR for the player-versus-shell check). */
    function COLIDE(D, picture = LASP1, listName = 'OPTR') {
        const x = D >>> 8, y = D & 255;
        if (listName !== 'OPTR' && listName !== 'SPTR')
            throw Error('COL0 requires OPTR or SPTR');
        let X = rw(listName), visited = 0;
        while (X) {
            if (++visited > 95)
                throw Error('COLIDE original linked list cycle');
            const displayed = rd(X, 'OBJX'), pic = pictures(rd(X, 'OPICT'));
            if (displayed && pic?.phases?.[0]) {
                const ox = displayed >>> 8, oy = displayed & 255;
                const ix = Math.max(x, ox), iy = Math.max(y, oy), ex = Math.min(x + picture.width, ox + pic.width), ey = Math.min(y + picture.height, oy + pic.height);
                for (let col = ix; col < ex; col++)
                    for (let row = iy; row < ey; row++) {
                        const left = picture.phases[0][(col - x) * picture.height + row - y];
                        // Original IC50: check both source bytes separately for nonzero,
                        // not an AND of colour nibbles or an AABB-only hit.
                        const right = pic.phases[0][(col - ox) * pic.height + row - oy];
                        if (!left || !right)
                            continue;
                        ww('CENTMP', (col << 8) | row);
                        // Original NOKILL may decline the hit (astronaut pickup, nonfatal
                        // player contact). In that case keep searching other object records.
                        if (kill(X, rd(X, 'OCVECT')) !== false)
                            return X;
                        break;
                    }
            }
            X = rd(X, 'OLINK');
        }
        return 0;
    }
    // Source B=4 samples of $11 then $99 tip; 3 FISTAB bytes fill the tail.
    function drawStep(U, dir) {
        const head = rd(U, 'PD'), trailing = rd(U, 'PD2'), clear = rd(U, 'PD4'), x = head >>> 8, y = head & 255;
        if ((dir > 0 && head >= 0x9800) || (dir < 0 && head <= 0x0500))
            return LASD(U, dir);
        for (let i = 0; i < 4; i++)
            render(x + i * dir, y, 0x11);
        render(x + 4 * dir, y, 0x99);
        wd(U, 'PD', u16(head + (dir > 0 ? 0x400 : -0x400)));
        let tab = rw('FISX');
        if (tab >= a('FISEND') - 3)
            tab = a('FISTAB');
        const tail = trailing >>> 8;
        for (let i = 0; i < 3; i++)
            render(tail + i * dir, y, RAM.read8(tab + i));
        ww('FISX', tab + 3);
        wd(U, 'PD2', u16(trailing + dir * 0x300));
        render(clear >>> 8, clear & 255, 0);
        wd(U, 'PD4', u16(clear + dir * 0x100));
        // Source LASR subtracts six screen columns from current head; LASL
        // uses the current leading address.  Both use original LASP1 bytes.
        const collisionAddress = dir > 0 ? u16(rd(U, 'PD') - 0x600) : rd(U, 'PD');
        if (COLIDE(collisionAddress))
            return LASD(U, dir);
        return procs.SLEEP(1, dir > 0 ? 0xf931 : 0xf932);
    }
    function LASD(U, dir) {
        const tail = rd(U, 'PD4'), head = rd(U, 'PD'), y = tail & 255;
        let from = tail >>> 8, to = head >>> 8;
        for (let col = Math.min(from, to); col <= Math.max(from, to); col++)
            render(col, y, 0);
        w('LFLG', u8(r('LFLG') - 1));
        return procs.SUCIDE();
    }
    function LFIRE() {
        const U = rw('CRPROC');
        if (r('LFLG') >= 4)
            return procs.SUCIDE();
        w('LFLG', u8(r('LFLG') + 1));
        if (typeof SNDLD === 'function')
            SNDLD();
        const direction = (r('NPLAD') & 0x80) ? -1 : 1;
        const initial = u16(rw('NPLAXC') + (direction > 0 ? 0x704 : 4));
        wd(U, 'PD', initial);
        wd(U, 'PD2', initial);
        wd(U, 'PD4', initial);
        return drawStep(U, direction);
    }
    function LASR0() {
        return drawStep(rw('CRPROC'), 1);
    }
    function LASL0() {
        return drawStep(rw('CRPROC'), -1);
    }
    /** FISS/FISS0: exact FISTAB initialization from source RAND/LSRA/BCS. */
    function FISS(RAND) {
        if (typeof RAND !== 'function')
            throw new Error('FISS requires source RAND');
        w('LFLG', 0);
        ww('FISX', a('FISTAB'));
        for (let p = a('FISTAB'); p < a('FISEND'); p++) {
            const D = RAND() & 255;
            RAM.write8(p, ((D & 2) ? 0x10 : 0) | ((D & 1) ? 1 : 0));
        }
    }
    function FIRE() {
        if (r('STATUS') & 0x40)
            return null;
        return procs.MKPROC(0xf930, a('STYPE'));
    }
    return Object.freeze({ LASP1, LFIRE, LASR0, LASL0, COLIDE, FIRE, FISS });
}
