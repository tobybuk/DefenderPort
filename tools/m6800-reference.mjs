/**
 * Independent reference for the sound board: a small two-pass 6800 assembler
 * for source/defender/src/vsndrm1.src and a cycle-counting 6800 CPU.
 *
 * It runs the ORIGINAL assembly (not the hand translation in
 * original/VSNDRM1-synth.js) so that the translation's DAC output can be
 * checked against it, write by write. Only the instructions and directives
 * that VSNDRM1.SRC uses are implemented.
 *
 * Memory map of the Defender sound board: RAM $0000-$007F, PIA $0400-$0403
 * ($0400 port A = DAC, $0402 port B = command lines), ROM $F800-$FFFF.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../source/defender/src/vsndrm1.src', import.meta.url));

// ---------------------------------------------------------------- opcodes
// Inherent: [opcode, cycles]
const INH = {
    NOP: [0x01, 2], TAP: [0x06, 2], TPA: [0x07, 2], INX: [0x08, 4], DEX: [0x09, 4],
    CLV: [0x0a, 2], SEV: [0x0b, 2], CLC: [0x0c, 2], SEC: [0x0d, 2], CLI: [0x0e, 2], SEI: [0x0f, 2],
    SBA: [0x10, 2], CBA: [0x11, 2], TAB: [0x16, 2], TBA: [0x17, 2], DAA: [0x19, 2], ABA: [0x1b, 2],
    TSX: [0x30, 4], INS: [0x31, 4], PULA: [0x32, 4], PULB: [0x33, 4], DES: [0x34, 4], TXS: [0x35, 4],
    PSHA: [0x36, 4], PSHB: [0x37, 4], RTS: [0x39, 5], RTI: [0x3b, 10], WAI: [0x3e, 9], SWI: [0x3f, 12],
};
const UNARY = { NEG: 0, COM: 3, LSR: 4, ROR: 6, ASR: 7, ASL: 8, ROL: 9, DEC: 0xa, INC: 0xc, TST: 0xd, CLR: 0xf };
for (const [n, lo] of Object.entries(UNARY)) { INH[n + 'A'] = [0x40 | lo, 2]; INH[n + 'B'] = [0x50 | lo, 2]; }
const BR = { BRA: 0x20, BHI: 0x22, BLS: 0x23, BCC: 0x24, BCS: 0x25, BNE: 0x26, BEQ: 0x27, BVC: 0x28,
    BVS: 0x29, BPL: 0x2a, BMI: 0x2b, BGE: 0x2c, BLT: 0x2d, BGT: 0x2e, BLE: 0x2f, BSR: 0x8d };
// Accumulator/memory ops: low nibble; A uses $8x/$9x/$Ax/$Bx, B uses $Cx..$Fx.
const ACC = { SUB: 0, CMP: 1, SBC: 2, AND: 4, BIT: 5, LDA: 6, STA: 7, EOR: 8, ADC: 9, ORA: 0xa, ADD: 0xb };
// 16-bit: [imm, dir, idx, ext] opcodes.
const W16 = { CPX: [0x8c, 0x9c, 0xac, 0xbc], LDS: [0x8e, 0x9e, 0xae, 0xbe], STS: [null, 0x9f, 0xaf, 0xbf],
    LDX: [0xce, 0xde, 0xee, 0xfe], STX: [null, 0xdf, 0xef, 0xff] };

// ---------------------------------------------------------------- assembler
function evaluate(expr, sym, pc, strict) {
    const tokens = expr.match(/\$[0-9A-Fa-f]+|%[01]+|\d+|[A-Za-z_.][A-Za-z0-9_.]*|>>|<<|[-+*/&!()]/g) || [];
    let i = 0;
    const atom = () => {
        const t = tokens[i++];
        if (t === undefined) throw Error('bad expression ' + expr);
        if (t === '-') return -atom();
        if (t === '(') { const v = binary(); i++; return v; }
        if (t === '*') return pc;
        if (t[0] === '$') return parseInt(t.slice(1), 16);
        if (t[0] === '%') return parseInt(t.slice(1), 2);
        if (/^\d/.test(t)) return parseInt(t, 10);
        if (t in sym) return sym[t];
        if (strict) throw Error('undefined symbol ' + t);
        return 0x8000; // forward reference in pass 1: assume extended
    };
    // Motorola-era assemblers evaluate left to right without precedence.
    const binary = () => {
        let v = atom();
        while (i < tokens.length && tokens[i] !== ')') {
            const op = tokens[i++], r = atom();
            v = op === '+' ? v + r : op === '-' ? v - r : op === '*' ? v * r : op === '/' ? Math.trunc(v / r)
                : op === '>>' ? v >> r : op === '<<' ? v << r : op === '&' ? v & r : op === '!' ? v | r : NaN;
        }
        return v;
    };
    return binary();
}

export function assemble(text = readFileSync(SRC, 'utf8')) {
    const lines = text.split(/\r?\n/);
    const sym = {};
    const forward = new Set();
    let mem;
    for (let pass = 1; pass <= 2; pass++) {
        mem = new Uint8Array(0x10000);
        let pc = 0;
        const stack = [];
        const emit = b => { mem[pc & 0xffff] = b & 255; pc++; };
        for (const raw of lines) {
            if (!raw.trim() || raw[0] === '*') continue;
            const line = raw.replace(/;.*/, '');
            const f = line.trim().split(/\s+/);
            let label = null;
            if (!/^\s/.test(line)) label = f.shift();
            const op = (f[0] || '').toUpperCase();
            const arg = f[1] || '';
            if (label && op !== 'EQU') {
                if (pass === 1) { if (label in sym && sym[label] !== pc) throw Error('redefined ' + label); sym[label] = pc; }
            }
            const ev = e => evaluate(e, sym, pc, pass === 2);
            if (!op) continue;
            if (op === 'EQU') { sym[label] = ev(arg); continue; }
            if (op === 'ORG') { pc = ev(arg); continue; }
            if (op === 'RORG') { stack.push(pc); pc = ev(arg); continue; }
            if (op === 'REND') { pc = stack.pop(); continue; }
            if (op === 'RMB') { pc += ev(arg); continue; }
            if (op === 'END' || op === 'NAM' || op === 'NOGEN') continue;
            if (op === 'FCB') { for (const e of splitArgs(arg)) emit(ev(e)); continue; }
            if (op === 'FDB') { for (const e of splitArgs(arg)) { const v = ev(e); emit(v >> 8); emit(v); } continue; }
            if (op in INH) { emit(INH[op][0]); continue; }
            if (op in BR) {
                const target = ev(arg);
                emit(BR[op]);
                const d = target - (pc + 1);
                if (pass === 2 && (d < -128 || d > 127)) throw Error('branch range ' + raw);
                emit(d);
                continue;
            }
            // Memory operand: immediate, indexed or direct/extended.
            const mode = arg.startsWith('#') ? 'imm' : /,X$/i.test(arg) ? 'idx' : 'mem';
            const operand = mode === 'imm' ? arg.slice(1) : mode === 'idx' ? (arg.replace(/,X$/i, '') || '0') : arg;
            let v = ev(operand);
            // A symbol not yet known in pass 1 is a forward reference: keep it extended in both passes.
            const key = pass + ':' + raw;
            if (pass === 1 && mode === 'mem' && v === 0x8000 && !/^[\d$%]/.test(operand)) forward.add(raw);
            const direct = mode === 'mem' && !forward.has(raw) && v >= 0 && v < 256;
            let m = op.match(/^(SUB|CMP|SBC|AND|BIT|LDA|STA|EOR|ADC|ORA|ADD)([AB])$/);
            if (m) {
                const base = (m[2] === 'A' ? 0x80 : 0xc0) | ACC[m[1]];
                const col = mode === 'imm' ? 0 : mode === 'idx' ? 0x20 : direct ? 0x10 : 0x30;
                emit(base | col);
                if (col === 0x30) { emit(v >> 8); emit(v); } else emit(v);
                continue;
            }
            if (op in W16) {
                const [imm, dir, idx, ext] = W16[op];
                if (mode === 'imm') { emit(imm); emit(v >> 8); emit(v); }
                else if (mode === 'idx') { emit(idx); emit(v); }
                else if (direct) { emit(dir); emit(v); }
                else { emit(ext); emit(v >> 8); emit(v); }
                continue;
            }
            if (op === 'JSR' || op === 'JMP') {
                const [idx, ext] = op === 'JSR' ? [0xad, 0xbd] : [0x6e, 0x7e];
                if (mode === 'idx') { emit(idx); emit(v); } else { emit(ext); emit(v >> 8); emit(v); }
                continue;
            }
            if (op in UNARY) {
                if (mode === 'idx') { emit(0x60 | UNARY[op]); emit(v); } else { emit(0x70 | UNARY[op]); emit(v >> 8); emit(v); }
                continue;
            }
            throw Error('unknown op ' + op + ' in: ' + raw);
        }
    }
    return { mem, sym };
}
const splitArgs = s => s.split(',').filter(x => x.length);

// ---------------------------------------------------------------- CPU
const CYC = new Uint8Array(256);
{
    for (const [, [o, c]] of Object.entries(INH)) CYC[o] = c;
    for (const o of Object.values(BR)) CYC[o] = 4;
    CYC[0x8d] = 8;
    for (const lo of Object.values(UNARY)) { CYC[0x60 | lo] = 7; CYC[0x70 | lo] = 6; }
    CYC[0x6d] = 7; CYC[0x7d] = 6; // TST
    CYC[0x6e] = 4; CYC[0x7e] = 3; CYC[0xad] = 8; CYC[0xbd] = 9;
    for (const hi of [0x80, 0xc0]) for (const lo of Object.values(ACC)) {
        CYC[hi | lo] = 2; CYC[hi | 0x10 | lo] = 3; CYC[hi | 0x20 | lo] = 5; CYC[hi | 0x30 | lo] = 4;
    }
    for (const hi of [0x80, 0xc0]) { CYC[hi | 0x17] = 4; CYC[hi | 0x27] = 6; CYC[hi | 0x37] = 5; } // STA
    for (const [imm, dir, idx, ext] of Object.values(W16)) { if (imm !== null) CYC[imm] = 3; CYC[dir] = 4; CYC[idx] = 6; CYC[ext] = 5; }
    for (const o of [0x9f, 0xdf]) CYC[o] = 5; for (const o of [0xaf, 0xef]) CYC[o] = 7; for (const o of [0xbf, 0xff]) CYC[o] = 6; // STS/STX
}

export class M6800 {
    constructor(mem, { onWrite = () => {}, readPort = () => 0xff } = {}) {
        this.m = mem; this.onWrite = onWrite; this.readPort = readPort;
        this.a = 0; this.b = 0; this.x = 0; this.sp = 0; this.pc = this.r16(0xfffe);
        this.h = 0; this.i = 1; this.n = 0; this.z = 0; this.v = 0; this.c = 0;
        this.cycles = 0; this.pia = 0xff; this.dac = 0; this.cra = 0; // 6821 reset clears every register
    }
    // Port A is all outputs, so reading it returns the DAC latch (COM SOUND relies on this).
    r8(a) { a &= 0xffff; if (a === 0x402) return this.pia; if (a === 0x400) return this.dac; if (a > 0x400 && a < 0x404) return 0; return this.m[a]; }
    // CRA bit 2 selects the output register; with it clear, $0400 is the data-direction register.
    w8(a, v) {
        a &= 0xffff; v &= 255;
        if (a >= 0x400 && a < 0x404) {
            if (a === 0x401) this.cra = v;
            else if (a === 0x400 && this.cra & 4) { this.dac = v; this.onWrite(this.cycles, v); }
            return;
        }
        this.m[a] = v;
    }
    r16(a) { return (this.r8(a) << 8) | this.r8(a + 1); }
    w16(a, v) { this.w8(a, v >> 8); this.w8(a + 1, v); }
    push(v) { this.w8(this.sp, v); this.sp = (this.sp - 1) & 0xffff; }
    pull() { this.sp = (this.sp + 1) & 0xffff; return this.r8(this.sp); }
    get ccr() { return 0xc0 | this.h << 5 | this.i << 4 | this.n << 3 | this.z << 2 | this.v << 1 | this.c; }
    set ccr(f) { this.h = f >> 5 & 1; this.i = f >> 4 & 1; this.n = f >> 3 & 1; this.z = f >> 2 & 1; this.v = f >> 1 & 1; this.c = f & 1; }
    nz(r) { this.n = r >> 7 & 1; this.z = (r & 255) === 0 ? 1 : 0; return r & 255; }
    add(a, b, cin) {
        const r = a + b + cin;
        this.h = ((a & 15) + (b & 15) + cin) > 15 ? 1 : 0;
        this.v = (~(a ^ b) & (a ^ r) & 0x80) ? 1 : 0;
        this.c = r > 255 ? 1 : 0;
        return this.nz(r);
    }
    sub(a, b, cin) {
        const r = a - b - cin;
        this.v = ((a ^ b) & (a ^ r) & 0x80) ? 1 : 0;
        this.c = r < 0 ? 1 : 0;
        return this.nz(r);
    }
    irq() {
        if (this.i) return false;
        this.push(this.pc); this.push(this.pc >> 8); this.push(this.x); this.push(this.x >> 8);
        this.push(this.a); this.push(this.b); this.push(this.ccr);
        this.i = 1; this.pc = this.r16(0xfff8); this.cycles += 12;
        return true;
    }
    step() {
        const op = this.r8(this.pc++);
        this.cycles += CYC[op] || 2;
        const imm8 = () => this.r8(this.pc++);
        const imm16 = () => { const v = this.r16(this.pc); this.pc += 2; return v; };
        const ea = () => {
            const mode = op >> 4 & 3; // for $8x-$Fx
            if (mode === 1) return imm8();
            if (mode === 2) return (this.x + imm8()) & 0xffff;
            return imm16();
        };
        // ---- inherent ----
        switch (op) {
        case 0x01: return;
        case 0x06: this.ccr = this.a; return;
        case 0x07: this.a = this.ccr; return;
        case 0x08: this.x = (this.x + 1) & 0xffff; this.z = this.x ? 0 : 1; return;
        case 0x09: this.x = (this.x - 1) & 0xffff; this.z = this.x ? 0 : 1; return;
        case 0x0a: this.v = 0; return; case 0x0b: this.v = 1; return;
        case 0x0c: this.c = 0; return; case 0x0d: this.c = 1; return;
        case 0x0e: this.i = 0; return; case 0x0f: this.i = 1; return;
        case 0x10: this.a = this.sub(this.a, this.b, 0); return;
        case 0x11: this.sub(this.a, this.b, 0); return;
        case 0x16: this.b = this.nz(this.a); this.v = 0; return;
        case 0x17: this.a = this.nz(this.b); this.v = 0; return;
        case 0x1b: this.a = this.add(this.a, this.b, 0); return;
        case 0x30: this.x = (this.sp + 1) & 0xffff; return;
        case 0x31: this.sp = (this.sp + 1) & 0xffff; return;
        case 0x32: this.a = this.pull(); return;
        case 0x33: this.b = this.pull(); return;
        case 0x34: this.sp = (this.sp - 1) & 0xffff; return;
        case 0x35: this.sp = (this.x - 1) & 0xffff; return;
        case 0x36: this.push(this.a); return;
        case 0x37: this.push(this.b); return;
        case 0x39: this.pc = (this.pull() << 8) | this.pull(); return;
        case 0x3b: this.ccr = this.pull(); this.b = this.pull(); this.a = this.pull();
            this.x = (this.pull() << 8) | this.pull(); this.pc = (this.pull() << 8) | this.pull(); return;
        case 0x3e: this.waiting = true; return;
        }
        // ---- branches ----
        if ((op & 0xf0) === 0x20 || op === 0x8d) {
            const d = imm8(), off = d & 0x80 ? d - 256 : d;
            let take;
            switch (op) {
            case 0x20: take = 1; break; case 0x22: take = !(this.c | this.z); break; case 0x23: take = this.c | this.z; break;
            case 0x24: take = !this.c; break; case 0x25: take = this.c; break; case 0x26: take = !this.z; break;
            case 0x27: take = this.z; break; case 0x28: take = !this.v; break; case 0x29: take = this.v; break;
            case 0x2a: take = !this.n; break; case 0x2b: take = this.n; break;
            case 0x2c: take = !(this.n ^ this.v); break; case 0x2d: take = this.n ^ this.v; break;
            case 0x2e: take = !(this.z | (this.n ^ this.v)); break; case 0x2f: take = this.z | (this.n ^ this.v); break;
            case 0x8d: this.push(this.pc); this.push(this.pc >> 8); take = 1; break;
            default: throw Error('bad branch ' + op.toString(16));
            }
            if (take) this.pc = (this.pc + off) & 0xffff;
            return;
        }
        // ---- unary (acc A/B, indexed, extended) ----
        if (op >= 0x40 && op < 0x80) {
            const lo = op & 15, grp = op >> 4;
            if (lo === 0xe) { this.pc = grp === 6 ? (this.x + imm8()) & 0xffff : imm16(); return; } // JMP
            let addr = -1, v;
            if (grp === 4) v = this.a; else if (grp === 5) v = this.b;
            else { addr = grp === 6 ? (this.x + imm8()) & 0xffff : imm16(); v = this.r8(addr); }
            let r;
            switch (lo) {
            case 0x0: r = this.sub(0, v, 0); break;
            case 0x3: r = this.nz(~v); this.v = 0; this.c = 1; break;
            case 0x4: this.c = v & 1; r = this.nz(v >> 1); this.v = this.n ^ this.c; break;
            case 0x6: { const c = this.c; this.c = v & 1; r = this.nz(v >> 1 | c << 7); this.v = this.n ^ this.c; break; }
            case 0x7: this.c = v & 1; r = this.nz(v >> 1 | v & 0x80); this.v = this.n ^ this.c; break;
            case 0x8: this.c = v >> 7 & 1; r = this.nz(v << 1); this.v = this.n ^ this.c; break;
            case 0x9: { const c = this.c; this.c = v >> 7 & 1; r = this.nz(v << 1 | c); this.v = this.n ^ this.c; break; }
            case 0xa: this.v = v === 0x80 ? 1 : 0; r = this.nz(v - 1); break;
            case 0xc: this.v = v === 0x7f ? 1 : 0; r = this.nz(v + 1); break;
            case 0xd: this.nz(v); this.v = 0; this.c = 0; return;
            case 0xf: r = 0; this.n = 0; this.z = 1; this.v = 0; this.c = 0; break;
            default: throw Error('bad unary ' + op.toString(16));
            }
            if (grp === 4) this.a = r; else if (grp === 5) this.b = r; else this.w8(addr, r);
            return;
        }
        // ---- 16-bit X/SP ----
        const lo = op & 15;
        if (lo === 0xc && op < 0xc0) { // CPX
            const v = (op & 0x30) === 0 ? imm16() : this.r16(ea());
            const r = this.x - v, hi = (this.x >> 8) - (v >> 8) - 0;
            this.z = (r & 0xffff) === 0 ? 1 : 0; this.n = r >> 15 & 1;
            this.v = (((this.x ^ v) & (this.x ^ r)) & 0x8000) ? 1 : 0;
            void hi;
            return;
        }
        if (op === 0xad || op === 0xbd) { // JSR
            const t = op === 0xad ? (this.x + imm8()) & 0xffff : imm16();
            this.push(this.pc); this.push(this.pc >> 8); this.pc = t; return;
        }
        if (lo === 0xe || lo === 0xf) {
            const isX = op >= 0xc0;
            if (lo === 0xe) { // LD
                const v = (op & 0x30) === 0 ? imm16() : this.r16(ea());
                if (isX) this.x = v; else this.sp = v;
                this.n = v >> 15 & 1; this.z = v ? 0 : 1; this.v = 0;
            } else { // ST
                const a = ea(), v = isX ? this.x : this.sp;
                this.w16(a, v); this.n = v >> 15 & 1; this.z = v ? 0 : 1; this.v = 0;
            }
            return;
        }
        // ---- 8-bit accumulator ops ----
        if (op >= 0x80) {
            const isB = op >= 0xc0;
            const acc = isB ? this.b : this.a;
            const imm = (op & 0x30) === 0;
            let addr = -1, v;
            if (lo === 7) addr = ea(); else if (imm) v = imm8(); else { addr = ea(); v = this.r8(addr); }
            let r = acc, store = true;
            switch (lo) {
            case 0x0: r = this.sub(acc, v, 0); break;
            case 0x1: this.sub(acc, v, 0); store = false; break;
            case 0x2: r = this.sub(acc, v, this.c); break;
            case 0x4: r = this.nz(acc & v); this.v = 0; break;
            case 0x5: this.nz(acc & v); this.v = 0; store = false; break;
            case 0x6: r = this.nz(v); this.v = 0; break;
            case 0x7: this.w8(addr, acc); this.nz(acc); this.v = 0; store = false; break;
            case 0x8: r = this.nz(acc ^ v); this.v = 0; break;
            case 0x9: r = this.add(acc, v, this.c); break;
            case 0xa: r = this.nz(acc | v); this.v = 0; break;
            case 0xb: r = this.add(acc, v, 0); break;
            default: throw Error('bad op ' + op.toString(16));
            }
            if (store) { if (isB) this.b = r; else this.a = r; }
            return;
        }
        throw Error('unimplemented opcode $' + op.toString(16) + ' at $' + (this.pc - 1).toString(16));
    }
}

/**
 * Boot the original board, let SETUP reach its idle loop, then deliver one
 * PIA command and record DAC writes for `cycles` E-clock cycles.
 */
export function runCommand(piaValue, cycles, { image = assemble() } = {}) {
    const writes = [];
    const cpu = new M6800(image.mem.slice(), { onWrite: (t, v) => writes.push([t, v]) });
    for (let k = 0; k < 2000 && !(cpu.i === 0 && cpu.r8(cpu.pc) === 0x20 && cpu.r8(cpu.pc + 1) === 0xfe); k++) cpu.step();
    writes.length = 0;
    const start = cpu.cycles;
    cpu.pia = piaValue & 0xff;
    cpu.irq();
    while (cpu.cycles - start < cycles) cpu.step();
    return { writes: writes.map(([t, v]) => [t - start, v]), cpu, image };
}
