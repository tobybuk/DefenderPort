/**
 * Defender sound board, Stage 77: a native JavaScript translation of the
 * 6808 sound ROM VSNDRM1.SRC (Sam Dicker, 10/1980). This is not a CPU
 * emulator.
 *
 * Changes from Stage 47–57:
 *  - The board is one persistent machine. Its 128 bytes of RAM (BG1FLG,
 *    BG2FLG, SP1FLG, B2FLG, ORGFLG, HI/LO random seed, and the shared LOCRAM
 *    parameter block) survive from one command to the next, as on the real
 *    board. The old renderer started every command on a fresh board. That lost
 *    the rising Lander-carry spinner (SP1FLG), the continuing pull-in bonus
 *    sweep (B2FLG -> GEND50) and the BG1 background that follows thrust.
 *  - A command interrupts the running routine at the moment it arrives (IRQ
 *    reloads the stack). An effect then plays to its natural end and the
 *    board falls through IRQ3 into BG1/BG2 or idles. The old adapter cut
 *    every effect off after the game's SNDTMR duration.
 *  - Every routine advances time by the 6800 instruction cycle counts of the
 *    original instructions. Earlier estimates ran FNOISE (thrust, cannon)
 *    about 40% fast, SCREAM about twice as fast, and HYPER, NOISE and LITEN
 *    fast too. ORGAN used 72 + 3×delay cycles per sample instead of
 *    72 + delay, so the high-score tunes played at the wrong pitch with
 *    uneven note lengths.
 *  - The DAC is integrated over each output sample (box filter) rather than
 *    point-sampled, which removes most of the aliasing.
 *
 * Routines run as generators that yield once their time passes the render
 * deadline, so the board can be streamed in real time and interrupted.
 */
import { GWVTAB, GFRTAB, GFRTAB_ORDER, SVTAB, VVECT, RADSND, ORGTAB, NOTTAB } from './VSNDRM1-data.js';
import { SOURCE_SOUND_TABLES } from './defa7-sound.js';
export const CLOCK = 3579545 / 4; // 6808 E clock: 3.579545 MHz crystal / 4
export const TICK_RATE = 60.096154; // main-board video frames (SNDSEQ cadence)
const U8 = n => n & 255, U16 = n => n & 65535;

/** Original FNOIS3 low-byte ADD and high-byte ADD-with-carry. */
export function FNOISE_ADDB_ADCA(A, B, FHI, FLO) {
    const sumLow = U8(B) + U8(FLO);
    const sumHigh = U8(A) + U8(FHI) + (sumLow > 255 ? 1 : 0);
    return { A: U8(sumHigh), B: U8(sumLow), carry: sumHigh > 255 };
}
/** Original FNOIS4 low-byte SUB and high-byte SUB-with-borrow. */
export function FNOISE_SUBB_SBCA(A, B, FHI, FLO) {
    const diffLow = U8(B) - U8(FLO);
    const diffHigh = U8(A) - U8(FHI) - (diffLow < 0 ? 1 : 0);
    return { A: U8(diffHigh), B: U8(diffLow), carry: diffHigh < 0 };
}

// ---- Board RAM (VSNDRM1 globals and the RORG-shared LOCRAM block) ----
const BG1FLG = 4, BG2FLG = 5, SP1FLG = 6, B2FLG = 7, ORGFLG = 8, HI = 9, LO = 10;
const TEMPX = 11, XPLAY = 13, XPTR = 15, TEMPA = 17, TEMPB = 18, LOCRAM = 0x13;
// GWAVE
const GECHO = 0x13, GCCNT = 0x14, GECDEC = 0x15, GDFINC = 0x16, GDCNT = 0x17, GWFRM = 0x18,
    PRDECA = 0x1a, GWFRQ = 0x1b, FRQEND = 0x1d, WVEND = 0x1f, GPER = 0x21, GECNT = 0x22, FOFSET = 0x23, GWTAB = 0x24;
// VARI
const LOPER = 0x13, HIPER = 0x14, LODT = 0x15, HIDT = 0x16, HIEN = 0x17, SWPDT = 0x18, LOMOD = 0x1a, VAMP = 0x1b, LOCNT = 0x1c, HICNT = 0x1d;
// NOISE / LITEN
const DECAY = 0x13, NAMP = 0x14, CYCNT = 0x15, NFRQ1 = 0x16, NFFLG = 0x18, LFREQ = 0x19, DFREQ = 0x1a;
// FNOISE
const FMAX = 0x13, FHI = 0x14, FLO = 0x15, SAMPC = 0x16, FDFLG = 0x18, DSFLG = 0x19;
// SCREAM
const STABLE = 0x13, SRMEND = 0x1b;
// ORGAN
const DUR = 0x13, OSCIL = 0x15, RDELAY = 0x16;
const SP1SND = 0x0e, B2SND = 0x12, BG2MAX = 29, SP1MAX = 32;

// ---- Board ROM: the source tables laid out contiguously, as assembled ----
const ROM = new Uint8Array(0x10000);
const ROMAT = {};
{
    let at = 0xf000;
    const put = (label, bytes) => { ROMAT[label] = at; for (const b of bytes) ROM[at++] = U8(b); };
    put('VVECT', VVECT.flatMap(v => v.bytes));
    put('GWVTAB', GWVTAB.flatMap(w => [w.samples.length, ...w.samples]));
    put('SVTAB', []);
    for (const v of SVTAB) ROM[at++] = 0; // placeholder, filled below once GFRTAB offsets are known
    at = 0xf400;
    ROMAT.GFRTAB = at;
    const offsets = {};
    for (const key of GFRTAB_ORDER) { offsets[key] = at - ROMAT.GFRTAB; for (const b of GFRTAB[key]) ROM[at++] = b; }
    for (let i = 0; i < 3; i++) ROM[at++] = 0; // ED13FP "MATCH THE PROMS" padding
    at = ROMAT.SVTAB;
    for (const [, control, wave, pre, inc, count, length, pattern] of SVTAB)
        for (const b of [control, wave, pre, inc, count, length, offsets[pattern]]) ROM[at++] = U8(b);
    at = 0xf500; // RADSND must not cross a page: RADIO adds (A&15) to the low byte only
    put('RADSND', RADSND);
    at = 0xf600;
    const tune = notes => [notes.length * 4, ...notes.flatMap(([osc, delay, dur]) => [osc, delay, dur >> 8, dur & 255])];
    put('ORGTAB', [...tune(ORGTAB.PHANTOM), ...tune(ORGTAB.TOCCATA), 0]);
    put('NOTTAB', NOTTAB);
}
const SVTAB_TRBV = SVTAB.findIndex(v => v[0] === 'TRBV');
const SVTAB_BONV = SVTAB.findIndex(v => v[0] === 'BONV');
const VVECT_CABSHK = VVECT.findIndex(v => v.label === 'CABSHK');
const JMPTBL = ['SP1', 'BG1', 'BG2INC', 'LITE', 'BON2', 'BGEND', 'TURBO', 'APPEAR', 'THRUST', 'CANNON', 'RADIO', 'HYPER', 'SCREAM', 'ORGANT', 'ORGANN'];

/**
 * The persistent sound board. Feed it PIA writes with irq(), and pull
 * samples with render(). Time is counted in 6808 E-clock cycles.
 */
export class SoundBoard {
    constructor({ sampleRate = 44100, clock = CLOCK, highPass = true, gain = 0.58 } = {}) {
        this.sampleRate = sampleRate;
        this.clock = clock;
        this.cps = clock / sampleRate; // cycles per output sample
        this.mem = new Uint8Array(0x10000);
        this.mem.set(ROM.subarray(0xf000), 0xf000);
        this.highPass = highPass;
        this.gain = gain;
        this.c = 0; this.lim = 0;
        this.sIdx = 0; this.sEnd = this.cps; this.it = 0; this.acc = 0;
        this.level = 0; this.sound = 0;
        this.hpX = 0; this.hpY = 0;
        this.ring = new Float32Array(1 << 16); this.head = 0; this.tail = 0;
        this.B = 0; this.X = 0; // registers carried between routines (BG1/THRUST use the live X)
        this.commands = [];
        this.routine = '';
        this.stats = { dacWrites: 0, highCarries: 0, highBorrows: 0 };
        // SETUP: LDAA #$3C ... STAA HI; CLRA; STAA B2FLG/BG1FLG/BG2FLG/SP1FLG/ORGFLG; CLI; BRA *
        this.mem[HI] = 0x3c;
        this.gen = this.idle();
        this.dac(0x80);
    }
    // ---------- time, DAC and output ----------
    dac(v) {
        v = U8(v);
        this.integrate(this.c);
        this.sound = v;
        this.level = (v - 127.5) / 127.5;
        this.stats.dacWrites++;
    }
    integrate(t) {
        const lv = this.level;
        while (t >= this.sEnd) {
            this.acc += lv * (this.sEnd - this.it);
            this.push(this.acc / this.cps);
            this.it = this.sEnd; this.acc = 0;
            this.sIdx++;
            this.sEnd = (this.sIdx + 1) * this.cps;
        }
        this.acc += lv * (t - this.it);
        this.it = t;
    }
    push(x) {
        if (this.highPass) { // DC blocker standing in for the output coupling capacitor
            const y = x - this.hpX + 0.998 * this.hpY;
            this.hpX = x; this.hpY = y; x = y;
        }
        x *= this.gain;
        this.ring[this.tail] = x < -1 ? -1 : x > 1 ? 1 : x;
        this.tail = (this.tail + 1) & 0xffff;
        if (this.tail === this.head) this.head = (this.head + 1) & 0xffff; // overflow: drop oldest
    }
    available() { return (this.tail - this.head) & 0xffff; }
    /** Run the board until `count` samples exist, then copy them into out[offset..]. */
    render(out, offset = 0, count = out.length - offset) {
        while (count > 8192) { // keep within the sample ring
            this.render(out, offset, 8192);
            offset += 8192; count -= 8192;
        }
        const target = this.sIdx + count - this.available();
        if (target > this.sIdx) {
            const endCycle = (target + 1) * this.cps;
            this.lim = endCycle;
            let guard = 0;
            while (this.c < endCycle && guard++ < 1e6) {
                const r = this.gen.next();
                if (r.done) this.gen = this.idle();
            }
            this.integrate(this.c);
        }
        for (let i = 0; i < count; i++) {
            if (this.head === this.tail) { out[offset + i] = 0; continue; }
            out[offset + i] = this.ring[this.head];
            this.head = (this.head + 1) & 0xffff;
        }
        return out;
    }
    /** Main-board PIA write (port B value). The board decodes it in IRQ. */
    irq(pia) {
        this.commands.push(U8(pia));
        if (this.commands.length > 64) this.commands.shift();
        // The IRQ runs at once: execute it up to its first DAC write, so a
        // command with no sound of its own (ORGANT, BGEND) takes effect before
        // the next PIA write arrives.
        this.gen = this.IRQ(U8(pia));
        this.lim = this.c;
        if (this.gen.next().done) this.gen = this.idle();
    }
    /** Convenience: send board command number n (0-31), as SNDOUT would. */
    command(n) { this.irq(U8(~n) & 0x3f); }
    // ---------- helpers ----------
    r16(a) { return (this.mem[a] << 8) | this.mem[a + 1]; }
    w16(a, v) { this.mem[a] = (v >> 8) & 255; this.mem[a + 1] = v & 255; }
    /** LDAA LO / LSRA×3 / EORA LO / LSRA / ROR HI / ROR LO — source of v is LO or A (FNOISE uses TAB). Returns final carry. */
    rnd(v) {
        const m = this.mem;
        const c1 = ((v >> 3) ^ m[LO]) & 1;
        const hiLow = m[HI] & 1, loLow = m[LO] & 1;
        m[HI] = (m[HI] >> 1) | (c1 << 7);
        m[LO] = (m[LO] >> 1) | (hiLow << 7);
        return loLow;
    }
    /** ADDX: X += A (STX XPLAY, ADDA XPLAY+1, STAA, BCC, [INC XPLAY], LDX XPLAY, RTS) plus JSR. */
    ADDX(X, A) {
        this.w16(XPLAY, X);
        const s = this.mem[XPLAY + 1] + U8(A);
        this.mem[XPLAY + 1] = U8(s);
        if (s > 255) this.mem[XPLAY] = U8(this.mem[XPLAY] + 1);
        this.c += 9 + 5 + 3 + 4 + 4 + (s > 255 ? 6 : 0) + 4 + 5;
        return this.r16(XPLAY);
    }
    /** TRANS: copy B bytes from X to [XPTR] (TEMPX-style pointer juggling as source). */
    TRANS(X, B) {
        const m = this.mem;
        this.c += 4; // PSHA
        do {
            const v = m[X];
            this.w16(XPLAY, X);
            let P = this.r16(XPTR);
            m[P] = v; P = U16(P + 1);
            this.w16(XPTR, P);
            X = U16(this.r16(XPLAY) + 1);
            B = U8(B - 1);
            this.c += 5 + 5 + 4 + 6 + 4 + 5 + 4 + 4 + 2 + 4;
        } while (B);
        this.c += 4 + 5; // PULA, RTS
        return X;
    }
    *idle() { // BRA * : the DAC holds its last value until the next IRQ
        for (;;) { if (this.c < this.lim) this.c = this.lim; yield; }
    }
    // ---------- IRQ ----------
    *IRQ(pia) {
        const m = this.mem;
        this.c += 12 + 3; // interrupt entry, LDS #ENDRAM
        let A = U8(~pia) & 0x1f; // LDAA SOUND+2, CLI, COMA, ANDA #$1F
        this.c += 4 + 2 + 2 + 2;
        let B = m[ORGFLG]; this.c += 3 + 4; // LDAB ORGFLG / BEQ
        if (B) {
            this.c += 4; // BPL
            if (B & 0x80) { this.c += 9; yield* this.ORGNT1(A); return; } // JMP IRQ3 at ORGNT5
            A = U8(A - 1); this.c += 2 + 9; // IRQ0 DECA, JSR ORGNN1
            yield* this.ORGNN1(A);
            return;
        }
        B = 0; this.c += 2 + 2 + 4; // IRQ00 CLRB, CMPA, BEQ
        if (A !== SP1SND) { m[SP1FLG] = 0; this.c += 4; }
        this.c += 2 + 4; // IRQ00A CMPA, BEQ
        if (A !== B2SND) { m[B2FLG] = 0; this.c += 4; }
        this.c += 4 + 2 + 4; // LDAB TALK / CMPB #$7E / BNE: Defender has no speech ROM
        this.B = B;
        this.c += 2 + 4; // IRQ1 TSTA / BEQ
        if (A) {
            A = U8(A - 1); this.c += 2 + 2 + 4; // DECA, CMPA #$C, BHI
            if (A <= 0x0c) {
                this.c += 9; this.GWLD(A);
                this.c += 9; yield* this.GW('GWAVE');
                this.c += 4;
            } else {
                this.c += 2 + 4; // CMPA #$1B, BHI
                if (A <= 0x1b) {
                    this.c += 2 + 2 + 3 + 8 + 25 + 6 + 8; // SUBA, ASLA, LDX, BSR ADDX, LDX 0,X, JSR 0,X
                    this.routine = JMPTBL[A - 0x0d];
                    yield* this[this.routine]();
                    this.c += 4;
                } else {
                    this.c += 2 + 9; this.VARILD(A - 0x1c);
                    this.c += 9; this.routine = 'VARI:' + VVECT[A - 0x1c].label;
                    yield* this.VARI();
                }
            }
        }
        yield* this.IRQ3();
    }
    *IRQ3() {
        const m = this.mem;
        this.c += 3 + 3 + 4; // LDAA BG1FLG / ORAA BG2FLG / BEQ
        if (!(m[BG1FLG] | m[BG2FLG])) { this.routine = 'idle'; yield* this.idle(); return; }
        m[B2FLG] = 0; this.c += 2 + 4 + 3 + 4; // CLRA, STAA B2FLG, LDAA BG1FLG, BEQ
        if (m[BG1FLG]) { this.c += 3; this.routine = 'BG1'; yield* this.BG1(); return; }
        this.c += 3; this.routine = 'BG2'; yield* this.BG2();
    }
    // ---------- VARI ----------
    VARILD(A) {
        this.c += 2 + 6 + 2 + 3 + 5 + 3; // TAB, ASLA×3, ABA, LDX #LOCRAM, STX XPTR, LDX #VVECT
        this.w16(XPTR, LOCRAM);
        const X = this.ADDX(0xf000, U8(A * 9));
        this.c += 2 + 3; // LDAB #9, JMP TRANS
        this.TRANS(X, 9);
    }
    *VARI() {
        const m = this.mem;
        this.c += 3 + 5; this.dac(m[VAMP]);
        VAR0: for (;;) {
            m[LOCNT] = m[LOPER]; m[HICNT] = m[HIPER]; this.c += 3 + 4 + 3 + 4;
            for (;;) { // V0
                let X = this.r16(SWPDT); this.c += 4;
                let sweep = false;
                while (!sweep) { // V0LP
                    for (let half = 0; half < 2 && !sweep; half++) {
                        // V0LP: LDAA LOCNT, COM SOUND; after V1: COM SOUND, LDAA HICNT
                        this.c += half ? 6 : 3 + 6;
                        this.dac(~this.sound);
                        if (half) this.c += 3;
                        // V1/V2: DEX, BEQ VSWEEP, DECA, BNE
                        const A = m[half ? HICNT : LOCNT] || 256;
                        const X0 = X || 65536;
                        if (X0 <= A) { this.c += X0 * 8 + (X0 - 1) * 6; X = 0; sweep = true; }
                        else { this.c += A * 14; X = X0 - A; }
                        if (this.c >= this.lim) yield;
                    }
                    if (!sweep) this.c += 4; // BRA V0LP
                }
                // VSWEEP: LDAA SOUND, BMI, [COMA], ADDA #0, STAA SOUND
                const neg = this.sound & 0x80;
                this.c += 4 + 4 + (neg ? 0 : 2) + 2 + 5;
                this.dac(neg ? this.sound : ~this.sound);
                m[LOCNT] = U8(m[LOCNT] + m[LODT]);
                m[HICNT] = U8(m[HICNT] + m[HIDT]);
                this.c += 3 + 3 + 4 + 3 + 3 + 4 + 3 + 4;
                if (this.c >= this.lim) yield;
                if (m[HICNT] !== m[HIEN]) continue; // BNE V0
                this.c += 3 + 4; // LDAA LOMOD, BEQ
                if (!m[LOMOD]) { this.c += 5; return; }
                m[LOPER] = U8(m[LOPER] + m[LOMOD]); this.c += 3 + 4 + 4;
                if (m[LOPER]) continue VAR0;
                this.c += 5; return;
            }
        }
    }
    // ---------- LITE / APPEAR / LITEN ----------
    *LITE() { this.mem[DFREQ] = 1; this.c += 2 + 4 + 2 + 4; yield* this.LITEN(1, 3); }
    *APPEAR() { this.mem[DFREQ] = 0xfe; this.c += 2 + 4 + 2 + 2 + 4; yield* this.LITEN(0xc0, 0x10); }
    *LITEN(A, B) {
        const m = this.mem;
        m[LFREQ] = A; this.c += 4 + 2 + 5; this.dac(0xff);
        m[CYCNT] = B; this.c += 4;
        do { // LITE0
            let b = m[CYCNT]; this.c += 3;
            do { // LITE1
                this.c += 3 + 6 + 3 + 2 + 6 + 6 + 4;
                if (this.rnd(m[LO])) { this.c += 6; this.dac(~this.sound); }
                this.c += 3 + (m[LFREQ] || 256) * 6 + 2 + 4; // LITE2/LITE3, DECB, BNE
                b = U8(b - 1);
                if (this.c >= this.lim) yield;
            } while (b);
            m[LFREQ] = U8(m[LFREQ] + m[DFREQ]); this.c += 3 + 3 + 4 + 4;
        } while (m[LFREQ]);
        this.c += 5;
    }
    // ---------- TURBO / NOISE ----------
    *TURBO() {
        const m = this.mem;
        m[CYCNT] = 0x20; m[NFFLG] = 0x20; this.c += 2 + 4 + 4 + 2 + 3 + 2 + 4;
        yield* this.NOISE(1, 1, 0xff);
    }
    *NOISE(A, X, B) {
        const m = this.mem;
        m[DECAY] = A; this.c += 4;
        let label = 'NOISE0';
        for (;;) {
            if (label === 'NOISE0') { this.w16(NFRQ1, X); this.c += 5; }
            m[NAMP] = B; this.c += 4; // NOIS00
            let b = m[CYCNT]; this.c += 3;
            do { // NOISE1
                this.c += 3 + 6 + 3 + 2 + 6 + 6 + 2 + 4;
                let a = 0;
                if (this.rnd(m[LO])) { a = m[NAMP]; this.c += 3; }
                this.c += 5; this.dac(a); // NOISE2 STAA SOUND
                const x = this.r16(NFRQ1) || 65536;
                this.c += 4 + x * 8 + 2 + 4; // LDX NFRQ1, NOISE3 DEX/BNE, DECB, BNE
                b = U8(b - 1);
                if (this.c >= this.lim) yield;
            } while (b);
            B = U8(m[NAMP] - m[DECAY]); this.c += 3 + 3 + 4;
            if (!B) { this.c += 5; return; }
            X = U16(this.r16(NFRQ1) + 1); this.c += 4 + 4 + 3 + 4;
            if (!m[NFFLG]) { label = 'NOIS00'; continue; }
            this.c += 4; label = 'NOISE0';
        }
    }
    // ---------- BG1 / THRUST / CANNON / FNOISE ----------
    *BG1() {
        const m = this.mem;
        m[BG1FLG] = 1; m[DSFLG] = 0; this.c += 2 + 4 + 2 + 4 + 4;
        yield* this.FNOISE(0, 1, this.X);
    }
    *THRUST() { this.mem[DSFLG] = 0; this.c += 2 + 4 + 2 + 4; yield* this.FNOISE(0, 3, this.X); }
    *CANNON() { this.mem[DSFLG] = 1; this.c += 2 + 4 + 3 + 2 + 2 + 4; yield* this.FNOISE(1, 0xff, 1000); }
    *FNOISE(A, B, X) {
        const m = this.mem;
        m[FDFLG] = A; m[FMAX] = B; this.w16(SAMPC, X); m[FLO] = 0; this.c += 4 + 4 + 5 + 6;
        let label = 'FNOIS0';
        for (;;) {
            if (label === 'FNOIS0') { X = this.r16(SAMPC); A = this.sound; this.c += 4 + 4; }
            // FNOIS1
            this.rnd(A); this.c += 2 + 6 + 3 + 2 + 6 + 6;
            B = m[FMAX]; this.c += 3 + 6 + 4;
            if (m[DSFLG]) { B &= m[HI]; this.c += 3; }
            m[FHI] = B; B = m[FLO]; this.c += 4 + 3 + 3 + 4; // STAB FHI, LDAB FLO, CMPA LO, BHI
            let end = false;
            if (A <= m[LO]) {
                for (;;) { // FNOIS3 slope up
                    X = U16(X - 1); this.c += 4 + 4;
                    if (!X) { end = true; break; }
                    this.c += 5; this.dac(A);
                    const s = FNOISE_ADDB_ADCA(A, B, m[FHI], m[FLO]); A = s.A; B = s.B;
                    this.c += 3 + 3 + 4;
                    if (this.c >= this.lim) yield;
                    if (s.carry) { this.stats.highCarries++; break; }
                    this.c += 3 + 4;
                    if (A > m[LO]) { this.c += 4; break; }
                }
            } else {
                for (;;) { // FNOIS4 slope down
                    X = U16(X - 1); this.c += 4 + 4;
                    if (!X) { end = true; break; }
                    this.c += 5; this.dac(A);
                    const s = FNOISE_SUBB_SBCA(A, B, m[FHI], m[FLO]); A = s.A; B = s.B;
                    this.c += 3 + 3 + 4;
                    if (this.c >= this.lim) yield;
                    if (s.carry) { this.stats.highBorrows++; break; }
                    this.c += 3 + 4;
                    if (A <= m[LO]) break;
                }
            }
            this.X = X;
            if (!end) { // FNOIS5
                A = m[LO]; this.c += 3 + 5; this.dac(A); this.c += 4;
                label = 'FNOIS1'; continue;
            }
            // FNOIS6
            this.c += 3 + 4;
            if (!m[FDFLG]) { label = 'FNOIS1'; continue; } // X is now 0: the next DEX wraps to $FFFF
            const total = (m[FMAX] << 8) | m[FLO];
            const next = U16(total - (total >>> 3));
            m[FLO] = next & 255; m[FMAX] = next >> 8;
            this.c += 3 + 3 + 12 + 2 + 2 + 2 + 3 + 3 + 4 + 4 + 4;
            if (m[FMAX]) { label = 'FNOIS0'; continue; }
            this.c += 2 + 4;
            if (m[FLO] !== 7) { label = 'FNOIS0'; continue; }
            this.c += 5; return;
        }
    }
    // ---------- RADIO / HYPER / SCREAM ----------
    *RADIO() {
        const m = this.mem;
        m[XPTR] = ROMAT.RADSND >> 8; this.w16(TEMPX, 100); this.c += 2 + 4 + 3 + 5;
        let B = this.B;
        for (;;) {
            const lo = B + m[TEMPX + 1]; B = U8(lo);
            const hi = m[TEMPA] + m[TEMPX] + (lo > 255 ? 1 : 0);
            let A = U8(hi); m[TEMPA] = A;
            let X = this.r16(TEMPX);
            this.c += 3 + 3 + 3 + 4 + 4 + 4;
            if (hi > 255) { X = U16(X + 1); this.c += 4 + 4; if (!X) { this.c += 5; return; } }
            else this.c += 4 + 4;
            this.w16(TEMPX, X);
            m[XPTR + 1] = U8((A & 15) + (ROMAT.RADSND & 255));
            this.c += 5 + 2 + 2 + 4 + 4 + 5 + 5;
            this.dac(m[this.r16(XPTR)]);
            this.c += 4;
            if (this.c >= this.lim) yield;
        }
    }
    *HYPER() {
        const m = this.mem;
        this.c += 2 + 5; this.dac(0); m[TEMPA] = 0; this.c += 4;
        do { // HYPER1
            let A = 0; this.c += 2;
            do { // HYPER2
                this.c += 3 + 4;
                if (A === m[TEMPA]) { this.c += 6; this.dac(~this.sound); }
                this.c += 2 + 18 * 6 + 2 + 4;
                A = U8(A + 1);
                if (this.c >= this.lim) yield;
            } while (!(A & 0x80));
            this.c += 6; this.dac(~this.sound);
            m[TEMPA] = U8(m[TEMPA] + 1); this.c += 6 + 4;
        } while (!(m[TEMPA] & 0x80));
        this.c += 5;
    }
    *SCREAM() {
        const m = this.mem;
        for (let X = STABLE; X < SRMEND; X++) { m[X] = 0; this.c += 7 + 4 + 3 + 4; }
        m[STABLE] = 0x40; this.c += 3 + 2 + 4;
        for (;;) {
            do { // SCREM2
                let tempa = 0x80, B = 0; this.c += 3 + 2 + 4 + 2;
                for (let X = STABLE; X < SRMEND; X += 2) { // SCREM3
                    m[X + 1] = U8(m[X + 1] + m[X]); this.c += 5 + 5 + 6 + 4;
                    if (m[X + 1] & 0x80) { B = U8(B + tempa); this.c += 3; }
                    tempa >>= 1; this.c += 6 + 4 + 4 + 3 + 4;
                }
                m[TEMPA] = tempa;
                this.c += 5; this.dac(B);
                m[TEMPB] = U8(m[TEMPB] + 1); this.c += 6 + 4;
                if (this.c >= this.lim) yield;
            } while (m[TEMPB]);
            let B = 0; this.c += 3 + 2;
            for (let X = STABLE; X < SRMEND; X += 2) { // SCREM5
                this.c += 5 + 4;
                if (m[X]) {
                    this.c += 2 + 4;
                    if (m[X] === 0x37) { B = 0x41; m[X + 2] = 0x41; this.c += 2 + 6; }
                    m[X] = U8(m[X] - 1); B = U8(B + 1); this.c += 7 + 2;
                }
                this.c += 4 + 4 + 3 + 4;
            }
            this.c += 2 + 4;
            if (!B) { this.c += 5; return; }
        }
    }
    // ---------- ORGAN ----------
    *ORGANT() { this.mem[ORGFLG] = U8(this.mem[ORGFLG] - 1); this.c += 6 + 5; }
    *ORGANN() { this.mem[ORGFLG] = 3; this.c += 2 + 4 + 5; }
    *ORGNT1(A) {
        const m = this.mem;
        m[ORGFLG] = 0; m[TEMPA] = A; this.c += 6 + 4 + 3;
        let X = ROMAT.ORGTAB;
        for (;;) { // ORGNT2
            const len = m[X]; this.c += 5 + 4;
            if (!len) { this.c += 3; yield* this.IRQ3(); return; } // ORGNT5
            m[TEMPA] = U8(m[TEMPA] - 1); this.c += 6 + 4;
            if (!m[TEMPA]) break;
            this.c += 2; X = this.ADDX(X, U8(len + 1)); this.c += 4;
        }
        X = U16(X + 1); this.w16(XPTR, X); this.c += 4 + 5;
        const end = this.ADDX(X, m[X - 1]); this.w16(XPLAY, end); this.c += 5 + 4;
        X = this.r16(XPTR);
        this.routine = 'ORGAN:' + (X - 1 === ROMAT.ORGTAB ? 'PHANTOM' : 'TOCCATA');
        do { // ORGNT4
            m[OSCIL] = m[X]; const delay = m[X + 1]; this.w16(DUR, (m[X + 2] << 8) | m[X + 3]);
            this.c += 5 + 4 + 5 + 6 + 5 + 8;
            const tuneEnd = this.r16(XPLAY);
            yield* this.ORGANL(delay);
            this.w16(XPLAY, tuneEnd);
            X = U16(this.r16(XPTR) + 4); this.w16(XPTR, X); this.c += 4 + 16 + 5 + 4 + 4;
        } while (X !== this.r16(XPLAY));
        this.c += 3;
        yield* this.IRQ3();
    }
    *ORGNN1(A) {
        const m = this.mem;
        m[ORGFLG] = U8(m[ORGFLG] - 1); this.c += 6 + 4;
        if (m[ORGFLG]) { // collect oscillator mask nibbles, then wait for the next code
            m[OSCIL] = U8(A + U8(m[OSCIL] << 4)); this.c += 3 + 8 + 2 + 4 + 2;
            yield* this.idle(); return;
        }
        A = U8(A - 1); this.c += 2 + 2 + 4;
        if (A > 11) { A = 0; this.c += 2; }
        const delay = m[ROMAT.NOTTAB + A]; this.c += 3 + 9 + 25 + 5;
        this.w16(DUR, 0xffff); this.c += 3 + 5 + 8;
        yield* this.ORGANL(delay);
        for (;;) { this.c += 8; yield* this.ORGAN(); this.c += 4; }
    }
    /** ORGANL builds NOP/CMPA delay code in RDELAY; the delay costs exactly A cycles. */
    *ORGANL(A) {
        const m = this.mem;
        let X = RDELAY, delay = 0; this.c += 3;
        for (;;) {
            this.c += 2 + 4;
            if (A === 0) break;
            this.c += 2 + 4;
            if (A === 3) { m[X] = 0x91; m[X + 1] = 0; X += 2; delay += 3; this.c += 2 + 6 + 7 + 8; break; }
            m[X++] = 0x01; delay += 2; A = U8(A - 2); this.c += 2 + 6 + 4 + 2 + 4;
            if (X > RDELAY + 60) break;
        }
        this.c += 2 + 6 + 2 + 6 + 2 + 6;
        this.rdelay = delay;
        yield* this.ORGAN();
    }
    *ORGAN() {
        const m = this.mem;
        let X = this.r16(DUR) || 65536; this.c += 4;
        for (;;) { // ORGAN1
            let A = 0, B = U8(m[TEMPB] + 1); m[TEMPB] = B;
            B &= m[OSCIL];
            for (let i = 0; i < 7; i++) { A += B & 1; B >>= 1; }
            A = U8((A + B) << 4);
            this.c += 2 + 4 + 2 + 4 + 3 + 28 + 2 + 8 + 5;
            this.dac(A);
            X--; this.c += 4 + 4;
            if (!X) { this.c += 5; return; }
            this.c += 3 + this.rdelay + 3;
            if (this.c >= this.lim) yield;
        }
    }
    // ---------- BGEND / BG2 / SP1 / BON2 ----------
    *BGEND() { this.mem[BG1FLG] = 0; this.mem[BG2FLG] = 0; this.c += 2 + 4 + 4 + 5; }
    *BG2INC() {
        const m = this.mem;
        m[BG1FLG] = 0;
        let A = m[BG2FLG] & 0x7f; this.c += 6 + 3 + 2 + 2 + 4;
        if (A === BG2MAX) { A = 0; this.c += 2; }
        m[BG2FLG] = U8(A + 1); this.c += 2 + 4 + 5;
    }
    *BG2() {
        const m = this.mem;
        this.c += 2 + 9; this.GWLD(SVTAB_TRBV);
        const A = U8(~(m[BG2FLG] << 2)); this.c += 3 + 2 + 2 + 2 + 9;
        m[FOFSET] = A;
        yield* this.GW('GEND61');
        for (;;) { m[GDCNT] = U8(m[GDCNT] + 1); this.c += 6 + 9; yield* this.GW('GEND61'); this.c += 4; }
    }
    *SP1() {
        const m = this.mem;
        this.c += 2 + 9; this.VARILD(VVECT_CABSHK);
        let B = m[SP1FLG]; this.c += 3 + 2 + 4;
        if (B === SP1MAX - 1) { B = 0; this.c += 2; }
        B = U8(B + 1); m[SP1FLG] = B; this.c += 2 + 4;
        let A = U8(SP1MAX - B); B = 0; this.c += 2 + 2 + 2;
        while (A > 20) { B = U8(B + 14); A = U8(A - 1); this.c += 2 + 4 + 2 + 2 + 4; }
        this.c += 2 + 4;
        do { B = U8(B + 5); A = U8(A - 1); this.c += 2 + 2 + 4; } while (A);
        m[LOPER] = B; this.c += 4;
        this.routine = 'SP1';
        for (;;) { this.c += 9; yield* this.VARI(); this.c += 4; } // SP1LP
    }
    *BON2() {
        const m = this.mem;
        this.c += 3 + 4;
        if (m[B2FLG]) { this.c += 3; yield* this.GW('GEND50'); return; } // BON21: continue the sweep
        m[B2FLG] = U8(m[B2FLG] + 1); this.c += 6 + 2 + 8;
        this.GWLD(SVTAB_BONV);
        this.c += 4; yield* this.GW('GWAVE');
    }
    // ---------- GWAVE ----------
    GWLD(A) {
        const m = this.mem;
        this.c += 2 + 2 + 2 + 2 + 2 + 3; // TAB, ASLB, ABA×3, LDX #SVTAB
        let X = this.ADDX(ROMAT.SVTAB, U8(A * 7));
        let v = m[X]; m[GCCNT] = v & 15; m[GECHO] = v >> 4;
        v = m[X + 1]; m[GECDEC] = v >> 4; m[TEMPA] = v & 15;
        this.c += 5 + 2 + 2 + 4 + 8 + 4 + 5 + 2 + 8 + 4 + 2 + 4;
        this.w16(TEMPX, X); this.c += 5 + 3;
        let W = ROMAT.GWVTAB;
        for (;;) { // GWLD2
            m[TEMPA] = U8(m[TEMPA] - 1); this.c += 6 + 4;
            if (m[TEMPA] & 0x80) break;
            this.c += 5 + 2; W = this.ADDX(W, U8(m[W] + 1)); this.c += 4;
        }
        this.w16(GWFRM, W); this.c += 5 + 9;
        this.WVTRAN();
        X = this.r16(TEMPX);
        m[PRDECA] = m[X + 2]; this.c += 4 + 5 + 4 + 9;
        this.WVDECA(m[PRDECA]);
        X = this.r16(TEMPX);
        m[GDFINC] = m[X + 3]; m[GDCNT] = m[X + 4];
        const len = m[X + 5], off = m[X + 6];
        this.c += 4 + 5 + 4 + 5 + 4 + 5 + 2 + 5 + 3;
        X = this.ADDX(ROMAT.GFRTAB, off);
        this.w16(GWFRQ, X); m[FOFSET] = 0; this.c += 2 + 5 + 6;
        X = this.ADDX(X, len);
        this.w16(FRQEND, X); this.c += 5 + 5;
    }
    WVTRAN() {
        const m = this.mem;
        this.w16(XPTR, GWTAB); this.c += 3 + 5;
        let X = this.r16(GWFRM); const B = m[X]; X++; this.c += 4 + 5 + 4 + 9;
        this.TRANS(X, B);
        this.w16(WVEND, this.r16(XPTR)); this.c += 4 + 5 + 5;
    }
    WVDECA(A) {
        const m = this.mem;
        this.c += 2 + 4;
        if (!A) { this.c += 5; return; }
        this.w16(XPLAY, this.r16(GWFRM)); m[TEMPB] = A; this.c += 4 + 5 + 3 + 4;
        let X = GWTAB;
        const end = this.r16(WVEND);
        do { // WVDLP
            this.w16(XPTR, X);
            let P = this.r16(XPLAY);
            const tempa = m[TEMPB];
            const B = m[P + 1] >> 4; P++; this.w16(XPLAY, P);
            let a = m[X];
            for (let i = 0; i < (tempa || 256); i++) a = U8(a - B);
            m[X] = a; X++;
            this.c += 5 + 4 + 3 + 4 + 5 + 8 + 4 + 5 + 4 + 5 + (tempa || 256) * (2 + 6 + 4) + 6 + 4 + 4 + 4;
        } while (X !== end);
        this.c += 5;
    }
    /** GWAVE … GEND1, entered at GWAVE, GEND50 (BON21) or GEND61 (BG2). Returns at GEND1 / GW2B RTS. */
    *GW(entry) {
        const m = this.mem;
        let label = entry;
        for (;;) {
            if (label === 'GWAVE') {
                m[GECNT] = m[GECHO]; this.c += 3 + 4;
                label = 'GWT4';
            }
            if (label === 'GWT4') {
                for (;;) { // echo loop
                    this.w16(XPLAY, this.r16(GWFRQ)); this.c += 4 + 5;
                    for (;;) { // GPLAY
                        let X = this.r16(XPLAY);
                        const per = U8(m[X] + m[FOFSET]); m[GPER] = per;
                        this.c += 4 + 5 + 3 + 4 + 4 + 4;
                        if (X === this.r16(FRQEND)) break; // BEQ GEND
                        let B = m[GCCNT]; X++; this.w16(XPLAY, X); this.c += 3 + 4 + 5;
                        const wend = this.r16(WVEND);
                        for (;;) { // GOUT
                            this.c += 3;
                            for (let W = GWTAB; W !== wend; W = U16(W + 1)) { // GOUTLP
                                this.c += 3 + 6 * (per || 256) + 5 + 5;
                                this.dac(m[W]);
                                this.c += 4 + 4 + 4;
                                if (this.c >= this.lim) yield;
                            }
                            B = U8(B - 1); this.c += 2 + 4;
                            if (!B) break;
                            this.c += 4 * 8 + 2 + 2 + 4; // INX/DEX×4, NOP×2, BRA GOUT (SYNC 36)
                        }
                    }
                    // GEND
                    this.c += 3 + 8; this.WVDECA(m[GECDEC]);
                    m[GECNT] = U8(m[GECNT] - 1); this.c += 6 + 4;
                    if (!m[GECNT]) break;
                }
                this.c += 3 + 4;
                if (m[B2FLG]) { this.c += 5; return; } // STOP BONUS
                label = 'GEND50';
            }
            if (label === 'GEND50') {
                const inc = m[GDFINC]; this.c += 3 + 4;
                if (!inc) { this.c += 5; return; }
                m[GDCNT] = U8(m[GDCNT] - 1); this.c += 6 + 4;
                if (!m[GDCNT]) { this.c += 5; return; }
                m[FOFSET] = U8(inc + m[FOFSET]); this.c += 3 + 4;
                label = 'GEND61';
            }
            if (label === 'GEND61') {
                let X = this.r16(GWFRQ), B = 0; this.c += 4 + 2;
                const end = this.r16(FRQEND);
                let found = false;
                for (;;) { // GW0
                    const s = m[FOFSET] + m[X];
                    let selected;
                    this.c += 3 + 6 + 4 + 5;
                    if (!(m[GDFINC] & 0x80)) { selected = s <= 255; this.c += 4 + (selected ? 4 : 0); }
                    else { selected = U8(s) !== 0 && s > 255; this.c += 4 + (U8(s) ? 4 : 0); }
                    if (selected) { // GW2A
                        this.c += 2 + 4;
                        if (!B) { this.w16(GWFRQ, X); B = 1; this.c += 5 + 2; }
                    } else { // GW2
                        this.c += 2 + 4;
                        if (B) { this.c += 4; found = true; break; }
                    }
                    X = U16(X + 1); this.c += 4 + 4 + 4; // GW2B INX, CPX, BNE
                    if (X === end) break;
                }
                if (!found) {
                    this.c += 2 + 4;
                    if (!B) { this.c += 5; return; } // ALL OVER
                }
                this.w16(FRQEND, X); this.c += 5 + 3 + 4; // GW3
                if (m[GECDEC]) { this.c += 8; this.WVTRAN(); this.c += 3 + 8; this.WVDECA(m[PRDECA]); }
                this.c += 3;
                label = 'GWAVE';
            }
        }
    }
}

// Gameplay SNDSEQ sequences (the DEFA7 tables, decoded).
export const SOUND_EVENTS = Object.freeze(Object.entries(SOURCE_SOUND_TABLES).map(([name, source], index) => {
    const segments = [];
    let i = 1;
    while (source[i] !== 0 && i < source.length) {
        const [repeats, ticks, command] = source.slice(i, i + 3);
        if (!Number.isInteger(command))
            throw Error('Invalid SNDSEQ ' + name);
        segments.push({ repeats, ticks, command });
        i += 3;
    }
    return { name, index, priority: source[0], segments };
}));
/**
 * IRQ: LDAA SOUND+2 / COMA / ANDA #$1F (VSNDRM1.SRC 914–918).
 * The sound-select PIA receives $C0 at the original Defender power-on cue,
 * which the board decodes as command $1F (VARI vector 2, QUASAR).
 */
export function IRQSoundCommand(piaValue) {
    return (~U8(piaValue)) & 0x1f;
}
export const DIRECT_COMMANDS = Object.freeze([
    { name: 'POWER_ON', command: 0x1f, piaInput: 0xc0, caption: 'POWER ON / STARTUP · QUASAR (PIA input $C0 → board command $1F)' },
    { name: 'THRUST', command: 0x16, caption: 'THRUST · sustained filtered noise' },
    { name: 'BG1', command: 0x0f, caption: 'BG1 · background sound #1' },
    { name: 'BG2INC', command: 0x10, caption: 'BG2INC · background engine increment' },
    { name: 'BGEND', command: 0x13, caption: 'BGEND · silence / background off' },
    { name: 'APPEAR', command: 0x15, caption: 'APPEAR · object materialisation' },
    { name: 'CANNON', command: 0x17, caption: 'CANNON · filtered noise' },
    { name: 'HYPER', command: 0x19, caption: 'HYPER · sound board direct effect' },
    { name: 'SCREAM', command: 0x1a, caption: 'SCREAM · four-echo routine' },
    { name: 'PHANTOM', command: 0x3e, caption: 'ORGTAB · Phantom high-score cue' },
    { name: 'TOCCATA', command: 0x3d, caption: 'ORGTAB · Toccata high-score cue' },
]);
/** AMODE1 HALL2 PIA bytes for a high-score tune: $3F, $24 (ORGANT), $3F, tune. */
export const HALL_PIA = Object.freeze({ select: 0x24, TOCCATA: 0x3d, PHANTOM: 0x3e });
/**
 * Offline render for tests and tools. `command` sends one board command
 * (or a Hall of Fame tune, $3D/$3E); `event` replays a DEFA7 table through
 * SNDSEQ timing, with each repeat sent at its frame.
 */
export function renderSound({ event, command, sampleRate = 44100, seconds = 4, clock = CLOCK, tickRate = TICK_RATE, highPass = true } = {}) {
    const board = new SoundBoard({ sampleRate, clock, highPass });
    const total = Math.max(1, Math.round(Math.min(30, seconds) * sampleRate));
    const values = new Float32Array(total);
    const timeline = [];
    const at = []; // [sampleIndex, pia]
    if (event) {
        const data = typeof event === 'string' ? SOUND_EVENTS.find(e => e.name === event) : event;
        if (!data)
            throw Error('Unknown game sound ' + event);
        let frame = 0;
        for (const s of data.segments)
            for (let r = 0; r < s.repeats; r++) {
                timeline.push({ at: frame / tickRate, command: s.command, sourceTicks: s.ticks });
                at.push([Math.round(frame / tickRate * sampleRate), U8(~s.command) & 0x3f]);
                frame += s.ticks;
            }
    }
    else if (command === 0x3d || command === 0x3e) {
        timeline.push({ at: 0, command });
        at.push([0, HALL_PIA.select], [0, command]);
    }
    else {
        timeline.push({ at: 0, command });
        at.push([0, U8(~command) & 0x3f]);
    }
    let pos = 0;
    for (const [sample, pia] of at) {
        const upto = Math.min(total, sample);
        if (upto > pos) { board.render(values, pos, upto - pos); pos = upto; }
        board.irq(pia);
    }
    if (pos < total) board.render(values, pos, total - pos);
    return { sampleRate, values, duration: total / sampleRate, writes: board.stats.dacWrites, timeline,
        source: board.routine, clock, tickRate, traceCycles: board.c, board };
}
