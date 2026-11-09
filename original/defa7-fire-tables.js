/**
 * DEFA7.SRC FISS/FISS0/F1/F2 and FBINIT/FBI0/FBI1/FBI2/FBIL,
 * source lines 2887–2900, 2720–2736 at pinned e740063.
 * Native translation of the 6809 random-bit selection and literal table
 * writes into PHR6 FISTAB/FBTAB. No sample-generation or made-up patterns.
 */
export function createDefa7FireTableRoutines(RAM, Layout, { RAND } = {}) {
    const a = n => Layout.at(n);
    function rand() {
        if (typeof RAND !== 'function')
            throw new Error('FISS/FBINIT require original RAND');
        return RAND() & 255;
    }
    function FISS() {
        let X = a('FISTAB');
        RAM.write16(a('FISX'), X);
        while (X < a('FISEND')) {
            let A = rand(), B = 0;
            // LSRA/BCC F1, LSRA/BCC F2: bit0->bit0, bit1->bit4.
            if (A & 1)
                B = (B + 1) & 255;
            A >>>= 1;
            if (A & 1)
                B = (B + 0x10) & 255;
            RAM.write8(X++, B);
        }
    }
    function FBINIT() {
        let X = a('FBTAB');
        RAM.write16(a('FBX'), X);
        while (X < a('FBTEND')) {
            const A = rand();
            // BMI FBI1: original A sign selects initial B $0A or $09.
            let B = (A & 0x80) ? 0x0a : 0x09;
            // LSRA / BCS FBI2: bit0 of original A selects $90 or $A0.
            B = (B + ((A & 1) ? 0x90 : 0xa0)) & 255;
            RAM.write8(X++, B);
        }
    }
    return Object.freeze({ FISS, FBINIT });
}
