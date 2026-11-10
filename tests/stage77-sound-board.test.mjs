/** Stage 77: persistent VSNDRM1 sound board, exact 6800 routine timings,
 * the ACSND catch sound, the silent AI demo and the START button in demo mode.
 * Checked against VSNDRM1.SRC, DEFA7.SRC and DEFB6.SRC (pinned e740063).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SoundBoard, renderSound, CLOCK } from '../original/VSNDRM1-synth.js';
import { ORGTAB } from '../original/VSNDRM1-data.js';
import { createFlightHarness } from '../demo/flight-harness.js';
import { IRQSoundCommand } from '../original/VSNDRM1-synth.js';

/** Record the 6808 cycle time of every DAC write. */
function traced(board) {
    const writes = [];
    const dac = board.dac.bind(board);
    board.dac = v => { writes.push([board.c, v & 255, board.routine]); dac(v); };
    return writes;
}
const gaps = (w, from = 1, to = w.length) => w.slice(from, to).map((x, i) => x[0] - w[from + i - 1][0]);

test('ORGAN plays one DAC sample every 72 + delay cycles, so every note lasts the same musical time', () => {
    const board = new SoundBoard({ sampleRate: 22050 });
    const w = traced(board);
    board.irq(0x24); // ORGANT
    board.irq(0x3e); // PHANTOM
    board.render(new Float32Array(22050 * 3));
    const organ = w.filter(x => x[2].startsWith('ORGAN'));
    // Inside a note the period is constant: 72 + $1D for the first Phantom note (D).
    const inner = gaps(organ, 2, 200);
    assert.ok(inner.every(g => g === 72 + 0x1d), `D note sample period ${[...new Set(inner)]}`);
    // NOTTAB times are scaled so that duration × cycles per sample is the same for every pitch.
    const beat = ([, delay, dur]) => dur * (72 + delay);
    const [d, cs] = ORGTAB.PHANTOM;
    assert.ok(Math.abs(beat(d) / beat(cs) - 1) < 0.01, 'quarter notes D and C# last the same time');
    // Phantom's first quarter note is about 0.46 s at the 894,886 Hz E clock.
    assert.ok(Math.abs(beat(d) / CLOCK - 0.46) < 0.02);
});

test('FNOISE (thrust) ramps at 30 cycles per DAC step, as DEX/BEQ/STAA/ADDB/ADCA/BCS/CMPA/BLS', () => {
    const board = new SoundBoard({ sampleRate: 22050 });
    const w = traced(board);
    board.command(0x16);
    board.render(new Float32Array(2205));
    const g = gaps(w, 5, 2000);
    const counts = new Map();
    for (const x of g) counts.set(x, (counts.get(x) || 0) + 1);
    const commonest = [...counts].sort((a, b) => b[1] - a[1])[0][0];
    assert.equal(commonest, 30, 'slope step');
});

test('SCREAM outputs one sample per full four-echo pass (about 190 cycles), not 95', () => {
    const board = new SoundBoard({ sampleRate: 22050 });
    const w = traced(board);
    board.command(0x1a);
    board.render(new Float32Array(2205));
    const g = gaps(w, 3, 200);
    assert.ok(g.every(x => x >= 180 && x <= 200), `SCREAM sample periods ${Math.min(...g)}–${Math.max(...g)}`);
});

test('the board keeps its RAM between commands: repeated SP1 raises the spinner (LSKSND)', () => {
    const board = new SoundBoard({ sampleRate: 22050 });
    const lopers = [];
    for (let i = 0; i < 4; i++) {
        board.command(0x0e);
        board.render(new Float32Array(368)); // one 60 Hz frame
        lopers.push(board.mem[0x13]); // LOPER
    }
    assert.deepEqual([...board.mem.slice(6, 7)], [4], 'SP1FLG counts the repeats');
    assert.equal(new Set(lopers).size, 4, `LOPER changes each repeat: ${lopers}`);
    board.command(0x0a); // any other command clears SP1FLG (IRQ00)
    assert.equal(board.mem[6], 0);
});

test('repeated BON2 ($12, the Lander pull-in) continues the sweep instead of restarting it', () => {
    const board = new SoundBoard({ sampleRate: 22050 });
    board.command(0x12);
    board.render(new Float32Array(2000));
    const first = board.mem[0x23]; // FOFSET
    board.command(0x12);
    board.render(new Float32Array(2000));
    assert.equal(board.mem[7], 1, 'B2FLG stays set');
    assert.equal(board.mem[0x23], (first + 0xff) & 255, 'GEND50 moves FOFSET by GDFINC');
});

test('after thrust is released (BG1, $0F) every effect returns to the background, until BGEND ($13)', () => {
    const board = new SoundBoard({ sampleRate: 22050 });
    board.command(0x16);
    board.render(new Float32Array(2205));
    board.command(0x0f);
    board.render(new Float32Array(2205));
    assert.equal(board.routine, 'BG1');
    board.command(0x15); // APPEAR
    board.render(new Float32Array(22050 * 2));
    assert.equal(board.routine, 'BG1', 'IRQ3 falls back into BG1');
    board.command(0x13);
    board.render(new Float32Array(2205));
    assert.equal(board.routine, 'idle');
});

test('an effect plays to its natural end instead of being cut at the SNDTMR duration', () => {
    // UFHSND: one 8-tick ($07) command. The GWAVE sound lasts far longer than 8 frames.
    const r = renderSound({ event: 'UFHSND', seconds: 2, sampleRate: 22050 });
    let last = 0;
    for (let i = 0; i < r.values.length; i++) if (Math.abs(r.values[i]) > 0.02) last = i;
    assert.ok(last / 22050 > 8 / 60 * 3, `sound continues to ${(last / 22050).toFixed(2)} s`);
});

test('catching a falling human plays ACSND (DEFB6 AKIL1), not the Lander scream', () => {
    const h = createFlightHarness({ sourceCabinetInput: true, playerCollisions: false });
    h.RESET(); h.INPUT({}); h.STEP();
    const out = [];
    h.SET_SOUND_PIA_SINK((byte, ticks) => { if (byte !== 0x3f) out.push([IRQSoundCommand(byte), ticks]); });
    const src = readFileSync(new URL('../original/defb6-astronaut.js', import.meta.url), 'utf8');
    assert.match(src, /sym\('ACSND'\)/);
    h.ram.write8(h.Layout.at('SNDPRI'), 0);
    assert.equal(h.TRIGGER_SOUND('ACSND'), true);
    h.INPUT({}); h.STEP();
    assert.deepEqual(out[0], [0x08, 0x0a], 'ACSND: three repeats of command $08 for $0A frames');
});

test('START stays available during the AI demo, and the demo is silent', () => {
    const src = readFileSync(new URL('../browser/flight.js', import.meta.url), 'utf8');
    assert.match(src, /const START_MODES = \['attract', 'hall-table', 'demo-ai', 'demo-ai-over'\]/);
    // Stage 80: START is enabled in those modes once there is a credit.
    assert.match(src, /const canStart = inStartMode && cabinet\.CAN_START\(1\)/);
    assert.match(src, /setUI\('startGameTop', 'disabled', !canStart\)/);
    assert.match(src, /audio\.setGated\(gate\)/);
    assert.match(src, /const gate = DEMO_MODES\.includes\(mode\)/);
});
