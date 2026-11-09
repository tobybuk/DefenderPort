/**
 * Direct native-JavaScript translation of Williams Defender Red Label
 * DEFA7.SRC L3171–3207: SBOMB, SBMB00, SBMB0, SBMB2, SBMBX,
 * SBMBX0, SBMBX1, SBX10, SBX1A, SBX2A, SBMBX2.
 *
 * The smart bomb acts upon SOURCE objects in OPTR, never a browser-side
 * enemy array. On-screen objects with OTYP < 2 are passed through their
 * original collision vector; OTYP >= 2 (including $10 humanoids and
 * $02 appearance objects) and offscreen objects are ignored. Restarting
 * at OPTR after every kill is necessary because the callback can unlink X.
 * Source SLEEP continuations implement flashes and button debounce.
 */
export function createDefa7SmartBombRoutines(RAM, Layout, processes, { addresses = {}, kill, SBDISP, SNDLD, infiniteAmmo = false } = {}) {
    const a = n => Layout.at(n), r8 = n => RAM.read8(a(n)), w8 = (n, v) => RAM.write8(a(n), v);
    const r16 = n => RAM.read16(a(n)), p = () => r16('CRPROC');
    const nap = (ticks, label) => {
        const continuation = addresses[label];
        if (!Number.isInteger(continuation) || continuation <= 0 || continuation > 65535)
            throw new Error('SBOMB: missing original continuation ' + label);
        return processes.SLEEP(ticks, continuation);
    };
    // Host-only bookkeeping: distinguish the source's eight-tick palette flash
    // from its later switch-release debounce. No source RAM/register semantics
    // are changed; the wave-executive adapter uses this to avoid presenting
    // BONUS while an earlier bomb is still altering the hardware colour RAM.
    let flashing = false;
    const FLASHING = () => flashing;
    const RESET = () => {
        flashing = false;
    };
    const dispose = () => processes.SUCIDE();
    function SBOMB() {
        if (r8('SBFLG'))
            return dispose(); // SBMBX2
        const Y = r16('PLRX'), countAddr = Y + a('PSBC');
        const count = RAM.read8(countAddr);
        if (!count && !infiniteAmmo)
            return dispose();
        w8('SBFLG', r8('SBFLG') + 1);
        // Stage 27 temporary user option: keep the original PSBC byte unchanged.
        // All other source SBOMB/SBMBX/SBX timings and collision rules are preserved.
        if (!infiniteAmmo)
            RAM.write8(countAddr, count - 1);
        if (typeof SBDISP !== 'function' || typeof SNDLD !== 'function' || typeof kill !== 'function')
            throw new Error('SBOMB: missing original SBDISP/SNDLD/collision-vector dependency');
        SBDISP();
        SNDLD(addresses.SBSND);
        return SBMB00();
    }
    function SBMB00() {
        // The original jumps back to OPTR after each destructive callback.
        // Guard against a broken, non-destructive callback looping forever.
        const seen = new Set();
        let X = r16('OPTR');
        for (let n = 0; X !== 0 && n < 96;) {
            if (seen.has(X))
                throw new Error('SBOMB: original object list contains a cycle');
            seen.add(X);
            n++;
            if (RAM.read16(X + a('OBJX')) !== 0 && RAM.read8(X + a('OTYP')) < 2) {
                const vector = RAM.read16(X + a('OCVECT'));
                const removed = kill(X, vector);
                if (removed) {
                    X = r16('OPTR');
                    seen.clear();
                    n = 0;
                    continue;
                }
                // A no-op collision vector does not remove X; advance safely.
            }
            X = RAM.read16(X + a('OLINK'));
        }
        if (X !== 0)
            throw new Error('SBOMB: OPTR exceeds 95 original object slots');
        return SBMBX();
    }
    function SBMBX() {
        flashing = true;
        RAM.write8(p() + a('PD'), 4);
        return SBMBX0();
    }
    function SBMBX0() {
        w8('PCRAM', (~r8('PCRAM')) & 255);
        return nap(2, 'SBMBX1');
    }
    function SBMBX1() {
        const U = p(), next = (RAM.read8(U + a('PD')) - 1) & 255;
        RAM.write8(U + a('PD'), next);
        return next ? SBMBX0() : SBX10();
    }
    function SBX10() {
        flashing = false;
        return nap(10, 'SBX1A');
    }
    function SBX1A() {
        return (r8('PIA21') & 0x04) ? SBX10() : nap(10, 'SBX2A');
    }
    function SBX2A() {
        flashing = false;
        w8('SBFLG', 0);
        return dispose();
    }
    return Object.freeze({ SBOMB, SBMB00, SBMBX, SBMBX0, SBMBX1, SBX10, SBX1A, SBX2A, FLASHING, RESET });
}
