/**
 * DIRECT TRANSLATION — mwenge/defender, pinned commit e74006344b16d19245510b5e55780f90d7606bb8
 * Source: src/defa7.src, lines 7–165, 1032–1054, 1067–1080, 3115–3126.
 * Actual assembly can be prepended locally by `npm run source:annotate`.
 *
 * These are original *named routines*, not a frame-loop approximation.
 * Hardware-specific JSR/RTS and return-address control transfers are represented
 * as explicit JavaScript return values. Integer/record semantics match RAM bytes.
 * No 6809 opcodes are fetched or interpreted.
 */
import { u8 } from '../runtime/integers.js';
export function createDefa7Routines(RAM, Layout) {
    const sym = n => Layout.at(n), off = (ptr, n) => (ptr + sym(n)) & 0xffff;
    const r8 = (p, n) => RAM.read8(off(p, n));
    const w8 = (p, n, v) => RAM.write8(off(p, n), v);
    const r16 = (p, n) => RAM.read16(off(p, n));
    const w16 = (p, n, v) => RAM.write16(off(p, n), v);
    const G = n => RAM.read16(sym(n));
    const S = (n, v) => RAM.write16(sym(n), v);
    const error = (msg) => {
        throw new Error(`Defender original ERROR/SINIT trap: ${msg}`);
    };
    const guard = (ptr, label) => {
        if (!ptr)
            error(`${label}: null process pointer`);
    };
    /** PINIT: reset both linked free lists and the active sentinel. */
    function PINIT() {
        const ptab = sym('PTAB'), psize = sym('PSIZE'), pend = sym('TABEND');
        const sptab = sym('SPTAB'), spsize = sym('SPSIZE'), spend = sym('SPTEND');
        if (!(psize > 0 && spsize > psize && pend > ptab && spend > sptab &&
            (pend - ptab) % psize === 0 && (spend - sptab) % spsize === 0))
            error('PINIT: inconsistent source layout');
        S('FREE', ptab);
        for (let X = ptab; X < pend; X += psize)
            RAM.write16(X, X + psize < pend ? X + psize : 0);
        S('ACTIVE', 0);
        S('SPFREE', sptab);
        for (let X = sptab; X < spend; X += spsize)
            RAM.write16(X, X + spsize < spend ? X + spsize : 0);
        S('CRPROC', sym('ACTIVE'));
    }
    /** MKP1: common tail shared by MKPROC and MSPROC in original assembly. */
    function MKP1(U, X, A) {
        w16(U, 'PADDR', X);
        w8(U, 'PTYPE', A);
        w8(U, 'PTIME', 1);
        const C = G('CRPROC');
        guard(C, 'MKP1');
        // source: LDX [CRPROC]; STU [CRPROC]; STX ,U
        const follower = RAM.read16(C);
        RAM.write16(C, U);
        RAM.write16(U, follower);
        return U; // LEAX ,U — caller receives data-block pointer
    }
    /** MKPROC: take the head of FREE, link after current process, wake after 1 tick. */
    function MKPROC(X, A) {
        const U = G('FREE');
        guard(U, 'MKPROC out of normal process slots');
        S('FREE', RAM.read16(U));
        w8(U, 'PCOD', 0);
        return MKP1(U, X, A);
    }
    /** MSPROC: like MKPROC but allocate from SPFREE and set PCOD=1. */
    function MSPROC(X, A) {
        const U = G('SPFREE');
        guard(U, 'MSPROC out of super process slots');
        S('SPFREE', RAM.read16(U));
        w8(U, 'PCOD', 1);
        return MKP1(U, X, A);
    }
    /** KILL: unlink X from ACTIVE; return X=predecessor link address (LEAX ,U). */
    function KILL(X) {
        let U = sym('ACTIVE');
        // Fails explicitly on corrupt lists instead of looping forever.
        for (let i = 0; i < 1000; i++) {
            const follower = RAM.read16(U);
            if (follower === X) {
                RAM.write16(U, RAM.read16(X));
                const list = r8(X, 'PCOD') === 0 ? 'FREE' : 'SPFREE';
                RAM.write16(X, G(list));
                S(list, X);
                return U;
            }
            if (follower === 0)
                error(`KILL: ${X.toString(16)} not in ACTIVE`);
            U = follower;
        }
        error('KILL: ACTIVE list has a cycle');
    }
    /** KILLOP: derive process pointer from an object's OBJID and call KILL. */
    function KILLOP(X) {
        return KILL(r16(X, 'OBJID'));
    }
    /** GNCIDE: remove active processes except CRPROC and coin tasks (CTYPE). */
    function GNCIDE() {
        let X = sym('ACTIVE');
        for (let i = 0; i < 1000; i++) {
            X = RAM.read16(X);
            if (X === 0)
                return;
            if (X === G('CRPROC') || r8(X, 'PTYPE') === sym('CTYPE'))
                continue;
            X = KILL(X);
        }
        error('GNCIDE: cyclic process list');
    }
    /** DISP1: DEC PTIME,U; jump to saved PADDR when the byte reaches zero. */
    function DISP1(U) {
        const PTIME = u8(r8(U, 'PTIME') - 1);
        w8(U, 'PTIME', PTIME);
        if (PTIME !== 0)
            return DISP2(U);
        S('CRPROC', U);
        return { kind: 'resume', process: U, address: r16(U, 'PADDR') };
    }
    /** DISP2: advance through linked list; original end jumps back to EXEC. */
    function DISP2(U) {
        let current = U;
        for (let i = 0; i < 1000; i++) {
            current = RAM.read16(current);
            if (current === 0)
                return { kind: 'end-of-dispatch', next: 'EXEC' };
            const PTIME = u8(r8(current, 'PTIME') - 1);
            w8(current, 'PTIME', PTIME);
            if (PTIME === 0) {
                S('CRPROC', current);
                return { kind: 'resume', process: current, address: r16(current, 'PADDR') };
            }
        }
        error('DISP2: cyclic process list');
    }
    /** DISP: set U to ACTIVE list sentinel, enter DISP2. */
    function DISP() {
        return DISP2(sym('ACTIVE'));
    }
    /** SLEEP: A=delay in 16ms units, X=next original routine address. */
    function SLEEP(A, X) {
        const U = G('CRPROC');
        guard(U, 'SLEEP');
        w8(U, 'PTIME', A);
        w16(U, 'PADDR', X);
        return DISP2(U);
    }
    /** SUCIDE: unlink current process, then continue from its predecessor. */
    function SUCIDE() {
        const X = G('CRPROC');
        guard(X, 'SUCIDE');
        return DISP2(KILL(X));
    }
    /** OINIT: build exactly 95 object cells linked in the original FREE list. */
    function OINIT() {
        const start = sym('OLIST'), stride = sym('OSIZE'), end = sym('OLEND');
        if (stride <= 0 || end <= start || (end - start) % stride !== 0)
            error('OINIT: source object table malformed');
        S('OFREE', start);
        for (let X = start; X < end; X += stride)
            RAM.write16(X, (X + stride < end) ? X + stride : 0);
        S('IPTR', 0);
        S('OPTR', 0);
        S('SPTR', 0);
    }
    /** OBINIT: original DEFA7.SRC lines 103-121, OBI inline descriptor macro.
     * X is allocated with GETOB; U is the owner process supplied by the caller.
     * The three original FDB operands are represented as data, not 6809 code.
     * Like the assembly, OBINIT does NOT insert X into OPTR; the caller does.
     */
    function OBINIT(U, { OPICT, OCVECT, OBJCOL }) {
        if (![U, OPICT, OCVECT, OBJCOL].every(Number.isInteger))
            throw new TypeError('OBINIT needs original process pointer and three descriptor words');
        const X = GETOB();
        w16(X, 'OBJID', U);
        w16(X, 'OPICT', OPICT);
        w16(X, 'OCVECT', OCVECT);
        w16(X, 'OBJCOL', OBJCOL);
        return X;
    }
    /** GETOB: remove first object cell from OFREE; caller then inserts into OPTR. */
    function GETOB() {
        const X = G('OFREE');
        guard(X, 'GETOB out of object cells');
        S('OFREE', RAM.read16(X));
        w16(X, 'OLINK', G('OPTR'));
        w16(X, 'OBJX', 0);
        w8(X, 'OTYP', 0);
        return X;
    }
    /** KILO2: common original unlink/free tail of KILLOB and KILSHL. */
    function KILO2(X, U) {
        RAM.write16(U, RAM.read16(X));
        RAM.write16(X, G('OFREE'));
        S('OFREE', X);
        return X;
    }
    function unlinkFrom(X, head) {
        let U = sym(head);
        for (let i = 0; i < 1000; i++) {
            const node = RAM.read16(U);
            if (node === X)
                return KILO2(X, U);
            if (node === 0)
                return null;
            U = node;
        }
        error(`${head} list has a cycle`);
    }
    /** KILLOB: search OPTR, then IPTR; source KILO1/KILOLP/KILO3 sequence. */
    function KILLOB(X) {
        const r = unlinkFrom(X, 'OPTR');
        if (r !== null)
            return r;
        const inactive = unlinkFrom(X, 'IPTR');
        if (inactive !== null)
            return inactive;
        error('KILLOB: object absent from active and inactive lists');
    }
    /** KILSHL: share original KILO3 tail but search only SPTR. */
    function KILSHL(X) {
        const removed = unlinkFrom(X, 'SPTR');
        if (removed !== null)
            return removed;
        error('KILSHL: shell absent from shell list');
    }
    return Object.freeze({ PINIT, MKPROC, MSPROC, MKP1, KILL, KILLOP, GNCIDE, DISP, DISP1, DISP2, SLEEP, SUCIDE,
        OINIT, GETOB, OBINIT, KILO2, KILLOB, KILSHL });
}
// Named compatibility export for tests; the original per-routine names remain 1:1.
export const createDefa7ProcessRoutines = createDefa7Routines;
