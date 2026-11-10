/**
 * Stage 77 browser OUTPUT ADAPTER — no gameplay sound decisions are made here.
 * The game's original DEFA7 SNDLD/SNDSEQ/SNDOUT decide what to play and when.
 * Every PIA command byte goes to one persistent translated VSNDRM1 sound
 * board (original/VSNDRM1-synth.js), which is streamed to the speaker in real
 * time. Web Audio acts only as the DAC's loudspeaker.
 *
 * As on the arcade board:
 *  - a new command interrupts the running effect at once;
 *  - an effect plays to its natural end, then the board returns to its
 *    background (BG1 after thrust) or holds silence;
 *  - board RAM (spinner, bonus and background flags, random seed) carries
 *    from one command to the next.
 *
 * Commands that arrive between two audio callbacks are spread across the next
 * callback with their original spacing, at the cost of one buffer of latency.
 */
import { SoundBoard, IRQSoundCommand, HALL_PIA } from '../original/VSNDRM1-synth.js';
const BUFFER = 1024;
export function createSourceSoundOutput({ makeContext = () => {
    const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Audio)
        throw new Error('Web Audio is unavailable in this browser');
    return new Audio({ latencyHint: 'interactive' });
}, now = () => (globalThis.performance?.now?.() ?? Date.now()), makeBoard = rate => new SoundBoard({ sampleRate: rate }) } = {}) {
    let context = null, gain = null, node = null, board = null, enabled = false, muted = false, gated = false;
    let volume = 1, lastCommand = null, lastPIA = null, lastTicks = 0;
    let streaming = false, startWaiters = [];
    let lastCallback = 0, period = 0;
    const pending = []; // { pia, at } awaiting the next audio callback
    const log = [];
    function applyGain() {
        if (gain) gain.gain.value = (muted || gated) ? 0 : volume;
    }
    function process(out) {
        if (!streaming) { streaming = true; for (const w of startWaiters.splice(0)) w(); }
        const t = now();
        const span = lastCallback ? Math.max(1, t - lastCallback) : period;
        const start = lastCallback || t - span;
        lastCallback = t;
        let pos = 0;
        while (pending.length) {
            const cmd = pending.shift();
            const offset = Math.min(out.length, Math.max(pos, Math.round((cmd.at - start) / span * out.length)));
            if (offset > pos) { board.render(out, pos, offset - pos); pos = offset; }
            board.irq(cmd.pia);
        }
        if (pos < out.length) board.render(out, pos, out.length - pos);
    }
    function record(command, pia, ticks) {
        lastCommand = command;
        lastPIA = pia;
        lastTicks = ticks;
        log.push(Object.freeze({ command, ticks, pia }));
        if (log.length > 128)
            log.shift();
    }
    function send(pia) {
        if (!board) return;
        pending.push({ pia, at: now() });
        if (pending.length > 64) pending.shift();
    }
    /** DEFA7.SNDOUT writes $3F (lines idle) and then the complemented command. */
    function writePIA(byte, ticks = 0) {
        byte &= 63;
        if (byte === 0x3f)
            return null;
        const command = IRQSoundCommand(byte);
        record(command, byte, ticks & 255);
        send(byte);
        return command;
    }
    /**
     * AMODE1.HALL2: PIA $3F, $24 (ORGANT), $3F, then $3D TOCCATA for a new
     * all-time high score or $3E PHANTOM for today's. The board's ORGFLG
     * decodes the second write as a tune number.
     */
    function playHallOfFameTune(command) {
        if (command !== HALL_PIA.TOCCATA && command !== HALL_PIA.PHANTOM) throw new RangeError('HALL2 requires $3D or $3E');
        record(command, command, 0);
        send(HALL_PIA.select);
        send(command);
        return command;
    }
    // Only a real pointer/key interaction may call this: browsers require a
    // gesture before audio may run.
    function enable() {
        if (!context) {
            try {
                context = makeContext();
            }
            catch (err) {
                return Promise.resolve(false);
            }
            board = makeBoard(context.sampleRate);
            period = BUFFER / context.sampleRate * 1000;
            gain = context.createGain();
            applyGain();
            gain.connect(context.destination);
            node = context.createScriptProcessor(BUFFER, 0, 1);
            node.onaudioprocess = e => process(e.outputBuffer.getChannelData(0));
            node.connect(gain);
        }
        enabled = true;
        return context.resume();
    }
    function disable() {
        enabled = false;
        if (context)
            void context.suspend();
    }
    function suspend() {
        if (context)
            void context.suspend();
    }
    function resume() {
        if (enabled && context)
            void context.resume();
    }
    /** Power-cycle the board: clears its flags and silences it. */
    function reset() {
        pending.length = 0;
        if (context) board = makeBoard(context.sampleRate);
        lastCommand = null;
        lastPIA = null;
        lastTicks = 0;
    }
    /**
     * Resolves once the speaker has asked for its first buffer, so a command
     * sent now is heard from its start (Stage 80: the power-on QUASAR).
     * Gives up after `timeoutMs` rather than hold the cabinet off.
     */
    function started(timeoutMs = 400) {
        if (streaming || !context) return Promise.resolve(streaming);
        return new Promise(resolve => {
            const done = () => resolve(streaming);
            startWaiters.push(done);
            setTimeout(done, timeoutMs);
        });
    }
    function setVolume(v) {
        volume = Math.min(1, Math.max(0, Number(v) || 0));
        applyGain();
    }
    function setMuted(v) {
        muted = Boolean(v);
        applyGain();
    }
    /** Silence output without touching the player's mute setting (used for the AI demo). */
    function setGated(v) {
        gated = Boolean(v);
        applyGain();
    }
    /** The deferred power-on cue: PIA $C0 decodes as command $1F (QUASAR). */
    function powerOn() {
        record(0x1f, 0xc0, 0);
        send(0xc0);
        return 0x1f;
    }
    function state() {
        return Object.freeze({ enabled, muted, gated, volume, lastCommand, lastPIA, lastTicks, commands: log.slice(),
            routine: board ? board.routine : null, pending: pending.length });
    }
    /** Test hook: run one audio callback. */
    function pump(samples = BUFFER) {
        const out = new Float32Array(samples);
        if (board) process(out);
        return out;
    }
    return Object.freeze({ writePIA, playHallOfFameTune, enable, disable, reset, suspend, resume, started, setVolume, setMuted, setGated, powerOn, state, pump });
}
