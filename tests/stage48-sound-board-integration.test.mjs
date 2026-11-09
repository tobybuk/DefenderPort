import test from 'node:test';
import assert from 'node:assert/strict';
import { createFlightHarness } from '../demo/flight-harness.js';
import { SOURCE_SOUND_TABLES } from '../original/defa7-sound.js';
import { GWVTAB, VVECT } from '../original/VSNDRM1-data.js';
import { renderSound, IRQSoundCommand, TICK_RATE } from '../original/VSNDRM1-synth.js';
import { createSourceSoundOutput } from '../browser/source-sound-output.js';
function fakeContext() {
    const ctx = { sampleRate: 44100, destination: {}, nodes: [],
        resume: () => Promise.resolve(), suspend: () => Promise.resolve(),
        createGain: () => ({ gain: { value: 1 }, connect() {} }),
        createScriptProcessor(size) { const n = { size, connect() {}, onaudioprocess: null }; this.nodes.push(n); return n; } };
    return ctx;
}
test('source sound-board waveform and VARI vectors are the approved Stage 47 data, not replacement oscillators', () => {
    assert.equal(GWVTAB.find(x => x.label === 'GS72').samples.length, 72);
    assert.deepEqual(VVECT.find(x => x.label === 'QUASAR').bytes, [0x28, 0x81, 0, 0xfc, 1, 2, 0, 0xfc, 255]);
    assert.equal(IRQSoundCommand(0x35), 0x0a);
    assert.equal(IRQSoundCommand(0x21), 0x1e);
    assert.equal(IRQSoundCommand(0xc0), 0x1f);
    const start = renderSound({ event: 'ST1SND', seconds: 1.065, sampleRate: 22050 });
    const ship = renderSound({ event: 'RPSND', seconds: 0.533, sampleRate: 22050 });
    assert.equal(start.timeline[0].command, 0x0a);
    assert.equal(ship.timeline[0].command, 0x1e);
    assert.ok(start.writes > 1000);
    assert.ok(ship.writes > 500);
});
test('PIA writes reach one persistent board; $3F strobes are not commands', async () => {
    const ctx = fakeContext(), sent = [];
    let clock = 0;
    const audio = createSourceSoundOutput({ makeContext: () => ctx, now: () => clock,
        makeBoard: () => ({ routine: 'idle', irq: pia => sent.push(pia), render(out, o, n) { out.fill(0, o, o + n); } }) });
    await audio.enable();
    assert.equal(ctx.nodes.length, 1, 'one streaming node');
    assert.equal(audio.writePIA(0x3f, 0), null);
    audio.writePIA(0x35, 0x40);
    assert.equal(audio.state().lastCommand, 0x0a);
    assert.equal(audio.state().lastTicks, 0x40);
    audio.writePIA(0x3f); clock = 5;
    audio.writePIA(0x29, 0); // command $16 THRUST
    assert.equal(audio.state().lastCommand, 0x16);
    audio.pump();
    assert.deepEqual(sent, [0x35, 0x29], 'each command interrupts the board in arrival order');
    audio.playHallOfFameTune(0x3d);
    audio.pump();
    assert.deepEqual(sent.slice(2), [0x24, 0x3d], 'HALL2: ORGANT select, then the tune number');
    audio.reset();
    assert.equal(audio.state().lastCommand, null);
});
test('each of the 26 source tables produces its original first SNDSEQ command, duration and PIA value', () => {
    const h = createFlightHarness({ sourceCabinetInput: true, infiniteSmartBombs: true });
    const events = [];
    h.SET_SOUND_PIA_SINK((byte, ticks) => {
        if (byte !== 0x3f)
            events.push({ command: IRQSoundCommand(byte), ticks });
    });
    for (const [label, data] of Object.entries(SOURCE_SOUND_TABLES)) {
        h.RESET();
        events.length = 0;
        // The first-wave startup may have loaded APSND ($D0), which correctly
        // blocks lower-priority sounds. Isolate each fixture by resetting SNDPRI.
        h.ram.write8(h.Layout.at('SNDPRI'), 0);
        assert.equal(h.TRIGGER_SOUND(label), true, label + ' priority/load');
        h.INPUT({ thrust: false, fire: false, up: false, down: false });
        h.STEP();
        assert.deepEqual(events[0], { command: data[3] & 31, ticks: data[2] }, label + ' first source SNDSEQ output');
    }
});
test('gameplay uses original startup, thrust, laser and replay paths rather than host sound guesses', () => {
    const h = createFlightHarness({ sourceCabinetInput: true, infiniteSmartBombs: true });
    const events = [];
    h.SET_SOUND_PIA_SINK((byte, ticks) => {
        if (byte !== 0x3f)
            events.push([IRQSoundCommand(byte), ticks]);
    });
    const step = (input = {}) => {
        h.INPUT(input);
        h.STEP();
    };
    h.RESET();
    h.TRIGGER_SOUND('ST1SND');
    step();
    assert.deepEqual(events.shift(), [0x0a, 64]);
    for (let i = 0; i < 66; i++)
        step();
    step({ thrust: true });
    step({ thrust: true });
    assert.deepEqual(events.shift(), [0x16, 0]);
    step({ thrust: true });
    assert.equal(events.length, 0, 'thrust must not restart each frame');
    step({ thrust: false });
    step({ thrust: false });
    assert.deepEqual(events.shift(), [0x0f, 0]);
    h.TRIGGER_SOUND('LASSND');
    step();
    assert.deepEqual(events.shift(), [0x14, 48]);
    h.TRIGGER_SOUND('RPSND');
    step();
    assert.deepEqual(events.shift(), [0x1e, 32]);
});
test('sound priority, repeated smart-bomb commands and background stop stay owned by source sequencer', () => {
    const h = createFlightHarness({ sourceCabinetInput: true });
    const out = [];
    h.SET_SOUND_PIA_SINK((byte, ticks) => {
        if (byte !== 0x3f)
            out.push([IRQSoundCommand(byte), ticks]);
    });
    h.RESET();
    h.TRIGGER_SOUND('SBSND');
    for (let i = 0; i < 26; i++) {
        h.INPUT({});
        h.STEP();
    }
    assert.deepEqual(out, [...Array(6)].map(() => [0x11, 4]).concat([[0x17, 16]]));
    assert.equal(h.TRIGGER_SOUND('LASSND'), false, 'lower priority ignored while smart bomb active');
});
test('ROMC8 default replay awards an extra ship and dispatches RPSND at 10,000 BCD score', () => {
    const h = createFlightHarness({ sourceCabinetInput: true });
    const out = [];
    h.SET_SOUND_PIA_SINK((byte, ticks) => {
        if (byte !== 0x3f)
            out.push([IRQSoundCommand(byte), ticks]);
    });
    h.RESET();
    assert.equal(h.ram.read16(h.Layout.at('REPLA')), 0x0100, 'default CMOS REPLAY is $0100');
    assert.equal(h.ram.read16(h.Layout.at('P1RP')), 0x0100);
    // Source P1SCR has one leading state byte and three packed BCD score bytes.
    // 009990 + 000010 = 010000 (10,000), exactly the default threshold.
    const ptr = h.Layout.at('P1SCR');
    h.ram.write8(ptr + 1, 0);
    h.ram.write8(ptr + 2, 0x99);
    h.ram.write8(ptr + 3, 0x90);
    const lives = h.ram.read8(h.Layout.at('P1LAS'));
    const result = h.scoring.SCORE(0, 0x10);
    assert.equal(result.replay, true);
    assert.equal(h.ram.read8(h.Layout.at('P1LAS')), lives + 1);
    h.INPUT({});
    h.STEP();
    assert.deepEqual(out.at(-1), [0x1e, 32]);
});
