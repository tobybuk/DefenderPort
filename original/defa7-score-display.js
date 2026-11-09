/**
 * Pinned original e740063, DEFA7.SRC SCRTRN/SCRTR0/SCT1/SCT2/SCTLP,
 * SCT3/SCT3A/SCT40/SCT4 (roughly lines 3249–3342).
 * Keeps original packed decimal score nibble extraction, leading-zero blanking,
 * MAPCR switching and nibble-addressed display strides. It cannot silently
 * generate a browser font: caller must supply source glyph/vector addresses
 * and independently translated CWRIT/COFF.
 */
export function createDefa7ScoreDisplayRoutines(RAM, Layout, { displayEquates = {}, CWRIT, COFF } = {}) {
    const at = n => Layout.at(n), r8 = n => RAM.read8(at(n)), w8 = (n, v) => RAM.write8(at(n), v);
    const equate = name => {
        const v = displayEquates[name];
        if (!Number.isInteger(v) || v < 0 || v > 65535)
            throw new Error(`Missing source display address ${name}`);
        return v;
    };
    function requireDraw(fn, label) {
        if (typeof fn !== 'function')
            throw new Error(`${label} is untranslated; score display must not invent glyphs`);
        return fn;
    }
    function SCRTRN() {
        return SCRTR0(r8('CURPLR'));
    }
    function SCRTR0(playerByte) {
        const draw = requireDraw(CWRIT, 'CWRIT'), off = requireDraw(COFF, 'COFF');
        const Xstart = equate((playerByte & 255) === 1 ? 'P1DISP' : 'P2DISP');
        const Y = equate('N0V');
        const stride = equate('DIGLTH');
        let U = at((playerByte & 255) === 1 ? 'P1SCR' : 'P2SCR') + 1;
        const oldMap = r8('MAPCR');
        let X = Xstart, B = 6;
        w8('XTEMP', 0);
        w8('MAPCR', 2);
        RAM.write8(at('MAPC'), 2);
        try {
            do {
                let A = RAM.read8(U++);
                if ((B & 1) === 0) {
                    U--;
                    A >>>= 4;
                } // original SCT3 even-phase high nibble
                A &= 15;
                if (A === 0 && B > 2 && r8('XTEMP') === 0) {
                    off(X, Y);
                }
                else {
                    w8('XTEMP', (r8('XTEMP') + 1) & 255);
                    draw(X, (Y + (A << 2)) & 65535);
                }
                X = (X + stride) & 65535;
                B = (B - 1) & 255;
            } while (B !== 0);
        }
        finally {
            w8('MAPCR', oldMap);
            RAM.write8(at('MAPC'), oldMap);
        }
    }
    return Object.freeze({ SCRTRN, SCRTR0 });
}
