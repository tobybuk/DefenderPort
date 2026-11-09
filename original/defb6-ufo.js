/**
 * Native transliteration of the original Defender UFO (baiter) process.
 * UPSTREAM: mwenge/defender @ e74006344b16d19245510b5e55780f90d7606bb8
 * src/defb6.src 1-82: UFOST, UFOLP, UFO1, UFO2, UFO3, UFONV,
 * UFONV0, UFONV1, UFONV3, UFONV4, UFONVX.
 *
 * Names for callable routines are retained; names of conditional branch
 * labels are written in-line at their corresponding branches.
 * No JavaScript-designed steering or timers. All positions/velocities reside
 * in the original fixed-width RAM fields. Untranslated APVCT/SHOOT/SNDLD
 * are explicit, mandatory original-routine callbacks.
 */
import { u8, u16, s8, s16 } from '../runtime/integers.js';
import { TranslationBoundaryError } from '../runtime/continuations.js';
export function createDefb6UfoRoutines(RAM, Layout, processes, { addresses = {}, OBINIT, APVCT, SHOOT, RMAX, SNDLD } = {}) {
    const at = n => Layout.at(n), o = (X, n) => u16(X + at(n));
    const r = n => RAM.read8(at(n)), rw = n => RAM.read16(at(n));
    const w = (n, v) => RAM.write8(at(n), v), ww = (n, v) => RAM.write16(at(n), v);
    const r8 = (X, n) => RAM.read8(o(X, n)), r16 = (X, n) => RAM.read16(o(X, n));
    const w8 = (X, n, v) => RAM.write8(o(X, n), v), w16 = (X, n, v) => RAM.write16(o(X, n), v);
    function requireRoutine(name) {
        const f = { OBINIT, APVCT, SHOOT, RMAX, SNDLD }[name];
        if (typeof f !== 'function')
            throw new TranslationBoundaryError(`UFOST/UFOLP requires untranslated ${name}`);
        return f;
    }
    function requireSymbol(name) {
        if (!Number.isInteger(addresses[name]) || addresses[name] <= 0 || addresses[name] > 65535)
            throw new TranslationBoundaryError(`UFO original source address for ${name} not supplied`);
        return addresses[name];
    }
    const cur = () => {
        const U = rw('CRPROC');
        if (!U || U === at('ACTIVE'))
            throw new TranslationBoundaryError('UFOLP needs current original process');
        return U;
    };
    /** UFONV0: bypass SEED/UFOSK gate, calculate horizontal then vertical velocities. */
    function UFONV0(X) {
        // LDD #$4001 ; STD XTEMP
        ww('XTEMP', 0x4001);
        // SUBD PLABX ; BMI UFONV1 ; NEG XTEMP
        let D = u16(r16(X, 'OX16') - rw('PLABX'));
        if (!(D & 0x8000))
            w('XTEMP', u8(-r('XTEMP')));
        // UFONV1: ADDD #20*32 ; CMPD #40*32 ; BLS UFONV3
        D = u16(D + 20 * 32);
        if (D > 40 * 32) {
            // LDB XTEMP ; SEX ; ADDD PLAXV ; STD OXV,X
            w16(X, 'OXV', u16(s8(r('XTEMP')) + rw('PLAXV')));
        }
        // UFONV3: LDA OY16,X ; SUBA PLAYC ; BMI UFONV4
        let A = u8(r8(X, 'OY16') - r('PLAYC'));
        // Original NEG XTEMP+1 only if signed subtraction >= 0.
        if (!(A & 0x80))
            RAM.write8(at('XTEMP') + 1, u8(-RAM.read8(at('XTEMP') + 1)));
        // UFONV4: ADDA #10 ; CMPA #20 ; BLS UFONVX
        A = u8(A + 10);
        if (A > 20) {
            // CLRB ; LDA XTEMP+1 ; ADDD PLAYV ; ASRA ; RORB
            const signed = s16(u16((RAM.read8(at('XTEMP') + 1) << 8) + rw('PLAYV')));
            w16(X, 'OYV', u16(signed >> 1));
        }
        return X;
    }
    /** UFONV: original SEED <= UFOSK skip; no RAND called here. */
    function UFONV(X) {
        return r('SEED') <= r('UFOSK') ? X : UFONV0(X);
    }
    /** UFOST: original NEWP + OBI, initialise state, then APVCT. */
    function UFOST() {
        const U = processes.MKPROC(requireSymbol('UFOLP'), at('STYPE'));
        const X = requireRoutine('OBINIT')(U, {
            OPICT: requireSymbol('UFOP1'), OCVECT: requireSymbol('UFOKIL'), OBJCOL: 0x3333
        });
        w16(U, 'PD', X);
        w16(X, 'OBJID', U);
        // Source SEED word starts at SEED and its high byte is masked with $1F.
        const D = u16(((rw('SEED') & 0x1fff) + rw('BGL')));
        w16(X, 'OX16', D);
        w8(X, 'OY16', u8((D & 255) >>> 1) + at('YMIN'));
        w16(X, 'OYV', 0);
        w16(X, 'OXV', 0);
        w8(U, 'PD2', 8);
        UFONV0(X);
        requireRoutine('APVCT')(X);
        // OBI callers rely on the original appearance routine for list insertion.
        return { process: U, object: X };
    }
    /** UFOLP: one process dispatch; NAP 6 to original UFOLP entry. */
    function UFOLP() {
        const U = cur(), X = r16(U, 'PD');
        if (r16(X, 'OPICT') !== requireSymbol('NULOB')) {
            const timer = u8(r8(U, 'PD2') - 1);
            w8(U, 'PD2', timer);
            if (timer === 0) {
                w8(U, 'PD2', requireRoutine('RMAX')(r('UFSTIM')));
                if (requireRoutine('SHOOT')(X))
                    requireRoutine('SNDLD')(requireSymbol('USHSND'));
            }
            // UFO1: LEAU OBJL,U ; CMPU UFOP3 ; BLS UFO2
            let picture = u16(r16(X, 'OPICT') + at('OBJL'));
            if (picture > requireSymbol('UFOP3')) {
                picture = requireSymbol('UFOP1');
                UFONV(X);
            }
            w16(X, 'OPICT', picture);
        }
        // UFO3: NAP 6,UFOLP
        return processes.SLEEP(6, requireSymbol('UFOLP'));
    }
    return Object.freeze({ UFOST, UFOLP, UFONV, UFONV0 });
}
