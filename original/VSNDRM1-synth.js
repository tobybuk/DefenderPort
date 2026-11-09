/**
 * Defender sound board: source-first, NATIVE JavaScript translation of 6800
 * sound-effect R O U T I N E S (not a CPU emulator).
 * Original VSNDRM1.SRC, 10/1980, by Sam Dicker.
 * https://github.com/historicalsource/williams-soundroms/blob/main/VSNDRM1.SRC
 * Source routines retained: GWLD, GWAVE, WVTRAN, WVDECA, VARILD, VARI,
 * LITEN, NOISE, FNOISE, RADIO, HYPER, SCREAM, ORGAN, BG1, BG2INC, etc.
 * The cycle weights below are provisional, explicit estimates pending
 * assembly-level timestamp comparison to authentic ROM/hardware.
 * NO browser oscillators, drum kits, MP3s, pitched samples or synthetic
 * replacement graphics; every timbre is computed from source bytes.
 */
import { GWVTAB, GFRTAB, GFRTAB_ORDER, FLAT_FRQ, FLAT_INDEX, SVTAB, VVECT, RADSND, ORGTAB } from './VSNDRM1-data.js';
import { SOURCE_SOUND_TABLES } from './defa7-sound.js';
export const CLOCK = 3579545 / 4; // 6808 E clock; 3.579545MHz resonator /4
export const TICK_RATE = 60.096154; // video ticks for preliminary SNDSEQ playback
const U8 = n => n & 255, U16 = n => n & 65535;
const signed = n => n & 128 ? n - 256 : n;
const sourceMod8 = n => n & 255;
const maxClipSec = 12;
const popcount = n => {
    let c = 0;
    while (n) {
        c += n & 1;
        n >>= 1;
    }
    return c;
};
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
export class DACTrace {
    constructor({ sampleRate = 44100, maxSeconds = 4, clock = CLOCK } = {}) {
        this.sampleRate = sampleRate;
        this.clock = clock;
        this.length = Math.min(Math.max(1, Math.ceil(maxSeconds * sampleRate)), Math.ceil(maxClipSec * sampleRate));
        this.values = new Float32Array(this.length);
        this.sample = 0;
        this.cycles = 0;
        this.byte = 0x80;
        this.writes = 0;
        this.done = false;
    }
    // Emulated 6808 time advances; DAC byte stays latched until next write.
    advance(cycles) {
        if (this.done)
            return false;
        this.cycles += Math.max(0, cycles);
        let end = Math.min(this.length, Math.floor(this.cycles * this.sampleRate / this.clock));
        if (end > this.sample) {
            this.values.fill((this.byte - 127.5) / 127.5, this.sample, end);
            this.sample = end;
        }
        if (this.sample >= this.length) {
            this.done = true;
            return false;
        }
        return true;
    }
    out(byte, cycles) {
        if (!this.advance(cycles))
            return false;
        this.byte = U8(byte);
        this.writes++;
        return true;
    }
    seekSeconds(s) {
        return this.advance(Math.max(0, s - this.cycles / this.clock) * this.clock);
    }
    finish({ highPass = true } = {}) {
        this.values.fill((this.byte - 127.5) / 127.5, this.sample);
        this.sample = this.length;
        if (highPass) { // An explicitly optional analogue-output DC blocker; not firmware.
            let oldX = 0, oldY = 0;
            for (let i = 0; i < this.values.length; i++) {
                const x = this.values[i], y = x - oldX + 0.998 * oldY;
                this.values[i] = Math.max(-1, Math.min(1, y * 0.58));
                oldX = x;
                oldY = y;
            }
        }
        else
            for (let i = 0; i < this.values.length; i++)
                this.values[i] *= 0.58;
        return this.values;
    }
}
export class Defender6808Sound {
    constructor(trace, { seedHi = 0x3c, seedLo = 0 } = {}) {
        this.trace = trace;
        this.hi = U8(seedHi);
        this.lo = U8(seedLo);
        this.bg1 = 0;
        this.bg2 = 0;
        this.spinner = 0;
        this.bonus = 0;
        this.last = '';
        this.commands = [];
        this.sound = 0x80;
    }
    out(v, cycles = 40) {
        this.sound = U8(v);
        return this.trace.out(this.sound, cycles);
    }
    delay(cycles) {
        return this.trace.advance(cycles);
    }
    // LITE1/NOISE1: LSRA x3, EORA LO, LSRA; ROR HI; ROR LO.
    randomBit() {
        const feedback = ((this.lo >> 3) ^ this.lo) & 1;
        const previousHiLow = this.hi & 1, previousLoLow = this.lo & 1;
        this.hi = (this.hi >> 1) | (feedback << 7);
        this.lo = (this.lo >> 1) | (previousHiLow << 7);
        return previousLoLow;
    }
    randomFromSound(A = this.sound) {
        const feedback = ((U8(A) >> 3) ^ this.lo) & 1;
        const previousHiLow = this.hi & 1, previousLoLow = this.lo & 1;
        this.hi = (this.hi >> 1) | (feedback << 7);
        this.lo = (this.lo >> 1) | (previousHiLow << 7);
        return previousLoLow;
    }
    /**
     * VSNDRM1.SRC 864-874. WVTRAN copies ROM samples to working GWTAB.
     * Cycle accounting follows TRANS/TRANS1 as executed by 6808, not an emulator.
     * All intermediate time elapses while the DAC holds its preceding byte.
     */
    WVTRAN(v) {
        const samples = v.samples.slice();
        // WVTRAN LDX #GWTAB; STX XPTR; LDX GWFRM; LDAB ,X; INX;
        // JSR TRANS; TRANS PSHA; ... PULA, RTS; LDX XPTR; STX WVEND; RTS.
        const common = 3 + 5 + 4 + 5 + 4 + 9 + 3 + 4 + 5 + 4 + 5;
        // TRANS1: LDAA 0,X / STX XPLAY / LDX XPTR / STAA 0,X /
        // INX / STX XPTR / LDX XPLAY / INX / DECB / BNE.
        const each = 5 + 5 + 4 + 6 + 4 + 5 + 4 + 4 + 2 + 4;
        this.delay(common + each * samples.length);
        return samples;
    }
    /**
     * VSNDRM1.SRC 876-904, WVDECA/WVDLP/WVDLP1.
     * Every decay step subtracts the ORIGINAL ROM byte >> 4, with byte wrap.
     * Critically: this routine consumes thousands of E cycles for GS72 and
     * remains audible as a held DAC value between echoes. Stage 45 omitted it.
     */
    WVDECA(wave, original, decay) {
        this.delay(2 + 4); // TSTA / BEQ WVDCX
        if (!decay)
            return wave;
        // LDX GWFRM, STX XPLAY, LDX #GWTAB, STAA TEMPB.
        this.delay(4 + 5 + 3 + 4);
        for (let i = 0; i < wave.length && !this.trace.done; i++) {
            // WVDLP: STX XPTR, LDX XPLAY, LDAB TEMPB, STAB TEMPA,
            // LDAB 1,X, LSRB x4, INX, STX XPLAY, LDX XPTR, LDAA ,X.
            this.delay(5 + 4 + 3 + 4 + 5 + 8 + 4 + 5 + 4 + 5);
            const decrement = original[i] >> 4;
            for (let j = 0; j < decay; j++)
                wave[i] = U8(wave[i] - decrement);
            // WVDLP1: SBA, DEC TEMPA, BNE WVDLP1.
            this.delay(decay * (2 + 6 + 4));
            // STAA ,X / INX / CPX WVEND / BNE WVDLP.
            this.delay(6 + 4 + 4 + 4);
        }
        this.delay(5); // WVDCX RTS
        return wave;
    }
    GWLD(index) {
        const v = SVTAB[index];
        if (!v)
            throw new RangeError('GWLD vector ' + index);
        const [name, control, waveControl, preDecay, frequencyInc, count, length, pattern] = v;
        const sourceWave = GWVTAB[waveControl & 15];
        if (!sourceWave)
            throw Error('Untranslated GWVTAB index ' + (waveControl & 15) + ' in ' + name);
        const start = FLAT_INDEX[pattern];
        if (start === undefined)
            throw Error('Untranslated GFRTAB pattern ' + pattern);
        const end = start + length;
        if (end > FLAT_FRQ.length)
            throw Error('Invalid source frequency range ' + name);
        const wave = this.WVTRAN(sourceWave);
        this.WVDECA(wave, sourceWave.samples, preDecay);
        return { name, control, GECHO: control >> 4, GCCNT: control & 15, GECDEC: waveControl >> 4,
            wave, original: sourceWave.samples, preDecay, GDFINC: signed(frequencyInc), GDCNT: count,
            offset: 0, first: start, end: end, origStart: start, origEnd: end };
    }
    // GW0–GW3 source window boundaries using original unsigned-add branches.
    _shiftWindow(g) {
        if (!g.GDFINC)
            return false;
        g.GDCNT = U8(g.GDCNT - 1);
        if (g.GDCNT === 0)
            return false;
        g.offset = U8(g.offset + g.GDFINC);
        let first = -1, last = -1, inside = false;
        for (let i = g.first; i < g.end; i++) {
            const val = FLAT_FRQ[i] ?? 0, sum = g.offset + val;
            // Exact GW0/GW1 unsigned ADDA/BEQ/BCS branch conditions:
            // positive delta accepts NO CARRY; negative accepts CARRY but NOT ZERO.
            const selected = g.GDFINC < 0 ? sum > 255 && U8(sum) !== 0 : sum <= 255;
            if (selected) {
                if (first < 0)
                    first = i;
                inside = true;
            }
            else if (inside) {
                last = i;
                break;
            }
        }
        if (first < 0)
            return false;
        g.first = first;
        g.end = last >= 0 ? last : g.end;
        // GW3, GEND0: waveform restored from ROM when GECHDEC != 0,
        // then original PRDECA is applied, exactly once (not echo decay).
        if (g.GECDEC) {
            g.wave = this.WVTRAN({ samples: g.original });
            this.WVDECA(g.wave, g.original, g.preDecay);
        }
        return g.first < g.end;
    }
    /**
     * GWAVE / GWT4 / GPLAY / GOUT / GOUTLP / GPRLP / GPR1 / GEND.
     * Source: VSNDRM1.SRC 781-862, M6800/6808 instruction-cycle counts.
     * No CPU emulator: each original instruction group advances a DAC latch
     * by a fixed E-cycle count, and the original 8-bit arithmetic is preserved.
     */
    GWAVE(index) {
        const g = this.GWLD(index);
        this.last = 'GWAVE:' + g.name;
        const waveCount = g.GCCNT || 256, echoCount = g.GECHO || 256;
        this.gwaveStats = { vector: g.name, command: index + 1, cyclesPerGPRLP: 6,
            waveSamples: g.wave.length, echoCount, echoesStarted: 0, echoesCompleted: 0,
            dacWrites: 0, firstWave: [], secondWave: [], initialPreDecay: g.preDecay,
            perEchoDecay: g.GECDEC };
        this.delay(3 + 4); // GWAVE LDAA GECHO; STAA GECNT.
        let mod = 0;
        while (!this.trace.done && mod++ < 256) {
            for (let echo = 0; echo < echoCount && !this.trace.done; echo++) {
                this.gwaveStats.echoesStarted++;
                this.delay(4 + 5); // GWT4 LDX GWFRQ; STX XPLAY.
                // GPLAY reads frequency entries, and the terminator at FRQEND.
                for (let ip = g.first; ip <= g.end && !this.trace.done; ip++) {
                    const period = U8((FLAT_FRQ[ip] || 0) + g.offset);
                    this.delay(4 + 5 + 3 + 4 + 4 + 4); // LDX XPLAY, LDAA ,X, ADDA FOFSET, STAA GPER, CPX, BEQ.
                    if (ip === g.end)
                        break;
                    this.delay(3 + 4 + 5); // LDAB GCCNT; INX; STX XPLAY.
                    for (let cycle = 0; cycle < waveCount && !this.trace.done; cycle++) {
                        this.delay(3); // GOUT: LDX #GWTAB.
                        for (let j = 0; j < g.wave.length && !this.trace.done; j++) {
                            const value = g.wave[j];
                            // GOUTLP LDAA GPER; GPRLP DECA/BNE * GPER;
                            // LDAA ,X; STAA SOUND (DAC write happens at end of STAA).
                            this.delay(3 + 6 * (period || 256) + 5);
                            if (!this.out(value, 5))
                                break;
                            this.gwaveStats.dacWrites++;
                            if (echo === 0 && cycle === 0 && this.gwaveStats.firstWave.length < 72)
                                this.gwaveStats.firstWave.push(value);
                            if (echo === 1 && cycle === 0 && this.gwaveStats.secondWave.length < 72)
                                this.gwaveStats.secondWave.push(value);
                            this.delay(4 + 4 + 4); // GPR1 INX, CPX WVEND, BNE GOUTLP.
                        }
                        this.delay(2 + 4); // DECB; BEQ GPLAY.
                        if (cycle + 1 < waveCount) {
                            // Four INX/DEX pairs, two NOPs, BRA GOUT (SYNC 36).
                            this.delay(4 * (4 + 4) + 2 + 2 + 4);
                        }
                    }
                }
                if (this.trace.done)
                    break;
                this.delay(3 + 8); // GEND LDAA GECDEC, BSR WVDECA.
                this.WVDECA(g.wave, g.original, g.GECDEC);
                this.gwaveStats.echoesCompleted++;
                this.delay(6 + 4); // GEND40 DEC GECNT; BNE GWT4.
            }
            if (this.trace.done)
                break;
            this.delay(3 + 4 + 3 + 4); // LDAA B2FLG; BNE; LDAA GDFINC; BEQ.
            if (!g.GDFINC)
                break;
            this.delay(6 + 4); // GEND50 DEC GDCNT; BEQ.
            if (!this._shiftWindow(g))
                break;
        }
    }
    VARILD(index) {
        const data = VVECT[index]?.bytes;
        if (!data)
            throw new RangeError('VARILD vector ' + index);
        return { label: VVECT[index].label, LOPER: data[0], HIPER: data[1], LODT: data[2], HIDT: data[3], HIEN: data[4],
            SWPDT: (data[5] << 8) | data[6], LOMOD: data[7], VAMP: data[8] };
    }
    /**
     * VARI / VAR0 / V0 / V0LP / V1 / V2 / VSWEEP / VS1 / VARX.
     * Literal, SOURCE-ORDER translation of VSNDRM1.SRC 205-245.
     *
     * Stage 44 defect: compressed each DEX/BEQ/DECA/BNE timer iteration to
     * 6 (!) cycles and switched the DAC at the END of the pulse, rather than
     * when COM SOUND / STAA SOUND executes. A 6800 timer iteration is precisely
     * 4+4+2+4=14 E-clock cycles (except its final DEX/BEQ = 8 cycles).
     * That made $1E/FOSHIT (extra ship) more than twice too fast.
     *
     * These are explicit 6800 instruction timings, NOT a 6800 emulator.
     * Every DAC write occurs at the named original instruction, and all
     * variable periods / 16-bit X counter / 8-bit wraps remain source-derived.
     */
    VARI(index, { LOPER = null } = {}) {
        const v = this.VARILD(index);
        this.last = 'VARI:' + v.label;
        if (LOPER !== null)
            v.LOPER = U8(LOPER); // SP1 source's STAB LOPER
        const C = Object.freeze({
            LDA_DIR: 3, LDA_EXT: 4, LDX_DIR: 4, STA_DIR: 4, STA_EXT: 5,
            COM_EXT: 6, COM_A: 2, ADDA_DIR: 3, ADDA_IMM: 2,
            CMPA_DIR: 3, DEX: 4, BEQ: 4, DECA: 2, BNE: 4, BRA: 4, BMI: 4, RTS: 5,
        });
        const advance = n => this.trace.advance(n);
        let X = 0; // Original 16-bit sweep counter (LDX SWPDT / DEX).
        // Timer X counts DOWN on *every* DEX, including the final BEQ-taken
        // iteration, which must NOT execute the DECA/BNE pair.
        const timer = n => {
            const count = Math.min(n, X);
            X -= count;
            advance(count * (C.DEX + C.BEQ) + (count - (X === 0 ? 1 : 0)) * (C.DECA + C.BNE));
        };
        let loper = v.LOPER, locnt = loper, hicnt = v.HIPER, sweepCount = 0, baseCount = 0;
        this.variStats = { vector: v.label, commandIndex: index, sweeps: 0, baseChanges: 0,
            sourceTimerCycles: C.DEX + C.BEQ + C.DECA + C.BNE, complete: false };
        // VARI: LDAA VAMP / STAA SOUND
        advance(C.LDA_DIR);
        this.out(v.VAMP, C.STA_EXT);
        while (!this.trace.done && baseCount++ < 256) {
            // VAR0: (re)load the starting periods from the vector/RAM fields.
            advance(C.LDA_DIR + C.STA_DIR + C.LDA_DIR + C.STA_DIR);
            locnt = loper;
            hicnt = v.HIPER;
            while (!this.trace.done && sweepCount++ < 65536) {
                // V0: LDX SWPDT. Source SWPDT is big-endian 16-bit (zero=>65536).
                advance(C.LDX_DIR);
                X = v.SWPDT || 65536;
                while (X > 0 && !this.trace.done) {
                    // V0LP: LDAA LOCNT; COM SOUND -> LOW part of the period starts now.
                    advance(C.LDA_DIR);
                    this.out(U8(~this.sound), C.COM_EXT);
                    timer(locnt || 256); // V1
                    if (X === 0 || this.trace.done)
                        break;
                    // COM SOUND; LDAA HICNT -> HIGH part starts now.
                    this.out(U8(~this.sound), C.COM_EXT);
                    advance(C.LDA_DIR);
                    timer(hicnt || 256); // V2
                    if (X === 0 || this.trace.done)
                        break;
                    advance(C.BRA); // BRA V0LP
                }
                if (this.trace.done)
                    break;
                // VSWEEP / VS1: preserve SOUND's sign logic, then write DAC.
                const isNegative = Boolean(this.sound & 0x80);
                advance(C.LDA_EXT + C.BMI + (isNegative ? 0 : C.COM_A) + C.ADDA_IMM);
                this.out(isNegative ? this.sound : U8(~this.sound), C.STA_EXT);
                // Advance the two 8-bit timer periods, then compare to HIEN.
                advance(C.LDA_DIR + C.ADDA_DIR + C.STA_DIR + C.LDA_DIR + C.ADDA_DIR + C.STA_DIR + C.CMPA_DIR + C.BNE);
                locnt = U8(locnt + v.LODT);
                hicnt = U8(hicnt + v.HIDT);
                this.variStats.sweeps++;
                if (hicnt !== v.HIEN)
                    continue; // BNE V0
                // LDAA LOMOD, BEQ VARX; ADDA LOPER, STAA LOPER, BNE VAR0.
                advance(C.LDA_DIR + C.BEQ);
                if (!v.LOMOD) {
                    advance(C.RTS);
                    this.variStats.complete = true;
                    return;
                }
                advance(C.ADDA_DIR + C.STA_DIR + C.BNE);
                loper = U8(loper + v.LOMOD);
                this.variStats.baseChanges++;
                if (!loper) {
                    advance(C.RTS);
                    this.variStats.complete = true;
                    return;
                }
                break; // BNE VAR0
            }
        }
    }
    LITEN(initial, delta, cycnt) {
        let LFREQ = initial, output = 255;
        this.out(output, 24);
        do {
            for (let i = 0; i < cycnt && !this.trace.done; i++) {
                const toggle = this.randomBit();
                if (toggle)
                    output = U8(~output);
                if (!this.out(output, 24 + (LFREQ || 256) * 6))
                    break;
            }
            LFREQ = U8(LFREQ + delta);
        } while (LFREQ !== 0 && !this.trace.done);
    }
    APPEAR() {
        this.last = 'APPEAR';
        this.LITEN(0xc0, 0xfe, 0x10);
    }
    LITE() {
        this.last = 'LITE';
        this.LITEN(1, 1, 3);
    }
    NOISE({ period = 1, amp = 255, decay = 1, cycleCount = 32, freqDecay = true } = {}) {
        this.last = 'NOISE';
        let freq = period;
        while (!this.trace.done && amp) {
            for (let i = 0; i < (cycleCount || 256) && !this.trace.done; i++) {
                const bit = this.randomBit();
                this.out(bit ? amp : 0, 30 + (freq || 65536) * 6);
            }
            amp = U8(amp - decay);
            if (!amp)
                break;
            if (freqDecay)
                freq = U16(freq + 1);
        }
    }
    /**
     * FNOIS0–FNOIS6: preserve the flags of the HIGH-byte ADCA/SBCA.
     * In the original version the 6808 BCS exits a ramp on carry/borrow.
     * Stage 51 previously omitted that high carry, leaving an artificial
     * repetitive sawtooth after approximately 1.2 seconds of THRUST.
     */
    FNOISE({ sampleCount = 32000, maxFreq = 3, frequencyDecay = 0, distortion = 0 } = {}) {
        this.last = 'FNOISE';
        let x = sampleCount;
        let hi = U8(maxFreq), low = 0;
        let A = this.sound, B = 0;
        let iterations = 0;
        const stats = { upSlopes: 0, downSlopes: 0, highCarries: 0, highBorrows: 0, randomSteps: 0 };
        this.fnoiseStats = stats;
        while (!this.trace.done && iterations++ < 300000) {
            // FNOIS1 uses the CPU accumulator A, not the last latched DAC byte.
            this.randomFromSound(A);
            stats.randomSteps++;
            const freq = distortion ? (hi & this.hi) : hi;
            B = low;
            if (A <= this.lo) {
                stats.upSlopes++;
                for (;;) {
                    if (--x <= 0) break;
                    if (!this.out(A, 21)) break;
                    const next = FNOISE_ADDB_ADCA(A, B, freq, low);
                    A = next.A; B = next.B;
                    if (next.carry) { stats.highCarries++; break; }
                    if (A > this.lo || this.trace.done) break;
                }
            } else {
                stats.downSlopes++;
                for (;;) {
                    if (--x <= 0) break;
                    if (!this.out(A, 21)) break;
                    const next = FNOISE_SUBB_SBCA(A, B, freq, low);
                    A = next.A; B = next.B;
                    if (next.carry) { stats.highBorrows++; break; }
                    if (A <= this.lo || this.trace.done) break;
                }
            }
            if (this.trace.done) break;
            if (x <= 0) {
                if (!frequencyDecay) { x = sampleCount; continue; }
                const total = (hi << 8) | low;
                const next = U16(total - (total >>> 3));
                hi = next >>> 8;
                low = next & 255;
                x = sampleCount;
                if (hi === 0 && low === 7) break;
            }
            // FNOIS5: the source resets the accumulator to LO before DAC write.
            A = this.lo;
            this.out(A, 20);
        }
    }
    BG1() {
        this.bg1 = 1;
        this.bg2 = 0;
        this.FNOISE({ sampleCount: 65535, maxFreq: 1, frequencyDecay: 0 });
    }
    THRUST() {
        this.FNOISE({ sampleCount: 65535, maxFreq: 3, frequencyDecay: 0 });
    }
    CANNON() {
        this.FNOISE({ sampleCount: 1000, maxFreq: 255, frequencyDecay: 1, distortion: 1 });
    }
    TURBO() {
        this.NOISE({ period: 1, amp: 255, decay: 1, cycleCount: 32, freqDecay: true });
    }
    RADIO() {
        this.last = 'RADIO';
        let phase = 0, period = 100;
        while (!this.trace.done && period < 65536) {
            const carry = phase + period >= 65536;
            phase = U16(phase + period);
            if (carry)
                period++;
            if (!this.out(RADSND[(phase >> 8) & 15], 62))
                break;
        }
    }
    HYPER() {
        this.last = 'HYPER';
        let sound = 0;
        for (let phase = 0; phase < 128 && !this.trace.done; phase++) {
            for (let t = 0; t < 128 && !this.trace.done; t++) {
                if (t === phase)
                    sound = U8(~sound);
                this.out(sound, 105);
            }
            sound = U8(~sound);
        }
    }
    SCREAM() {
        this.last = 'SCREAM';
        const freq = [0x40, 0, 0, 0], timers = [0, 0, 0, 0];
        let tempB = 0;
        for (let round = 0; round < 256 && !this.trace.done; round++) {
            for (let iteration = 0; iteration < 256 && !this.trace.done; iteration++) {
                let amp = 128, B = 0;
                for (let i = 0; i < 4; i++) {
                    timers[i] = U8(timers[i] + freq[i]);
                    if (timers[i] & 128)
                        B = U8(B + amp);
                    amp >>= 1;
                }
                this.out(B, 95);
                tempB = U8(tempB + 1);
            }
            let active = 0;
            for (let i = 0; i < 4; i++) {
                if (!freq[i])
                    continue;
                if (freq[i] === 0x37 && i < 3)
                    freq[i + 1] = 0x41;
                freq[i] = U8(freq[i] - 1);
                active++;
            }
            if (!active)
                break;
        }
    }
    ORGAN(key) {
        this.last = 'ORGAN:' + key;
        const tune = ORGTAB[key];
        if (!tune)
            throw new Error('Missing ORGTAB ' + key);
        let phase = 0;
        for (const [oscillator, delay, duration] of tune) {
            for (let i = 0; i < duration && !this.trace.done; i++) {
                phase = U8(phase + 1);
                const v = U8(popcount(phase & oscillator) << 4);
                if (!this.out(v, 72 + delay * 3))
                    break; // source ORGANL delay NOP budget
            }
        }
    }
    // IRQ special jump table VSNDRM1.SRC 995–1000, command byte 0x0E..0x1C.
    SP1() {
        let B = this.spinner === 31 ? 0 : this.spinner;
        B = U8(B + 1);
        this.spinner = B;
        let A = U8(32 - B);
        while (A > 20) {
            B = U8(B + 14);
            A = U8(A - 1);
        }
        while (A > 0) {
            B = U8(B + 5);
            A = U8(A - 1);
        }
        this.VARI(3, { LOPER: B });
    }
    BG2INC() {
        this.bg1 = 0;
        this.bg2 = (this.bg2 % 29) + 1;
        this.GWAVE(14);
    }
    BON2() {
        this.bonus++;
        this.GWAVE(13);
    }
    BGEND() {
        this.bg1 = 0;
        this.bg2 = 0;
        this.out(0x80, 32);
    }
    ORGANT() {
        this.orgFlag = -1;
        this.out(0x80, 32);
    }
    ORGANN() {
        this.orgFlag = 3;
        this.out(0x80, 32);
    }
    COMMAND(command) {
        command = U8(command) & 31;
        this.commands.push(command);
        if (command === 0)
            return;
        if (command <= 13) {
            this.GWAVE(command - 1);
            return;
        }
        const names = ['SP1', 'BG1', 'BG2INC', 'LITE', 'BON2', 'BGEND', 'TURBO', 'APPEAR', 'THRUST', 'CANNON', 'RADIO', 'HYPER', 'SCREAM', 'ORGANT', 'ORGANN'];
        if (command <= 28) {
            const name = names[command - 14];
            if (!name)
                throw Error('Missing IRQ handler ' + command);
            this[name]();
            return;
        }
        this.VARI(command - 29);
    }
}
// Gameplay SNDSEQ sequences (NOT individual fixed WAV recordings).
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
 * IRQ: LDAA SOUND+2 / COMA / ANDA #$1F (VSNDRM1.SRC 908–912).
 * The sound-select PIA receives $C0 at the original Defender power-on cue.
 * The sound-board converts it to $1F, selecting VARI vector 2 / QUASAR.
 * This decoding helper does not emulate the 6808 CPU.
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
export function renderSound({ event, command, sampleRate = 44100, seconds = 4, clock = CLOCK, tickRate = TICK_RATE, highPass = true, seedHi = 0x3c, seedLo = 0 } = {}) {
    const limit = Math.min(maxClipSec, Math.max(.1, seconds));
    const trace = new DACTrace({ sampleRate, maxSeconds: limit, clock });
    const board = new Defender6808Sound(trace, { seedHi, seedLo });
    const timeline = [];
    if (event) {
        const data = typeof event === 'string' ? SOUND_EVENTS.find(e => e.name === event) : event;
        if (!data)
            throw Error('Unknown game sound ' + event);
        for (const segment of data.segments) {
            for (let r = 0; r < segment.repeats && !trace.done; r++) {
                const time = trace.cycles / clock;
                timeline.push({ at: time, command: segment.command, sourceTicks: segment.ticks });
                const end = time + segment.ticks / tickRate;
                // Reuse board state and random registers across interrupts; synthesise
                // only until next SNDOUT (which interrupts any active firmware loop).
                // Constrain original trace duration by temporarily passing a deadline.
                const outerLength = trace.length;
                trace.length = Math.min(outerLength, Math.ceil(end * sampleRate));
                trace.done = false;
                board.COMMAND(segment.command);
                if (!trace.done)
                    trace.seekSeconds(end);
                trace.length = outerLength;
                trace.done = trace.sample >= outerLength;
            }
        }
    }
    else {
        timeline.push({ at: 0, command });
        const originalCommand = command;
        if (originalCommand === 0x3d)
            board.ORGAN('TOCCATA');
        else if (originalCommand === 0x3e)
            board.ORGAN('PHANTOM');
        else
            board.COMMAND(originalCommand);
    }
    const duration = Math.min(limit, trace.cycles / clock);
    const values = trace.finish({ highPass });
    return { sampleRate, values, duration, writes: trace.writes, timeline,
        source: board.last, clock, tickRate, traceCycles: trace.cycles };
}
