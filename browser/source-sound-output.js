/**
 * Stage 48 browser OUTPUT ADAPTER — no new gameplay sound decisions here.
 * Original event dispatch remains in DEFA7 SNDLD/SNDSEQ/SNDOUT.
 * Receive SNDOUT's actual PIA pair ($3F strobe, then one's-complement of
 * the command). Decode via VSNDRM1 IRQ; synthesize the original board's DAC
 * samples via native JS. WebAudio is a DAC loudspeaker, not a synthesizer.
 *
 * Boundaries: the sound-lab renderer starts each command with fixed seed
 * rather than retaining partially executed 6808 state across interrupts;
 * background $0F/$16 loops a finite PCM trace. Analogue cabinet filtering,
 * sample-accurate 6808 IRQ preemption and ROM initialisation are not yet proven.
 */
import { renderSound, IRQSoundCommand, TICK_RATE } from '../original/VSNDRM1-synth.js';
export function createSourceSoundOutput({ makeContext = () => {
    const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Audio)
        throw new Error('Web Audio is unavailable in this browser');
    return new Audio();
}, synth = renderSound } = {}) {
    let context = null, gain = null, source = null, awaitingData = false, enabled = false, muted = false;
    let volume = 0.45, lastCommand = null, lastPIA = null, lastTicks = 0;
    const log = [];
    const cache = new Map();
    const CONTINUOUS = new Set([0x0f, 0x16]); // VSNDRM1 BG1 and THRUST
    const silent = new Set([0, 0x13, 0x1b, 0x1c]); // no wave: BGEND/organ flag controls
    function stop() {
        if (source) {
            try {
                source.stop();
            }
            catch {
            }
            try {
                source.disconnect();
            }
            catch {
            }
            source = null;
        }
    }
    function reset() {
        stop();
        awaitingData = false;
        lastCommand = null;
        lastPIA = null;
        lastTicks = 0;
    }
    function setVolume(v) {
        volume = Math.min(1, Math.max(0, Number(v) || 0));
        if (gain)
            gain.gain.value = muted ? 0 : volume;
    }
    function setMuted(v) {
        muted = Boolean(v);
        if (gain)
            gain.gain.value = muted ? 0 : volume;
    }
    // Only a real pointer/key interaction may call this: Chrome on Android
    // requires an explicit gesture before it will allow audio to run.
    function enable() {
        if (!context) {
            try {
                context = makeContext();
            }
            catch (err) {
                return Promise.resolve(false);
            }
            gain = context.createGain();
            gain.gain.value = muted ? 0 : volume;
            gain.connect(context.destination);
        }
        enabled = true;
        const promise = context.resume();
        return promise;
    }
    function disable() {
        enabled = false;
        stop();
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
    function bufferFor(command, ticks) {
        const continuous = CONTINUOUS.has(command) && !ticks;
        const seconds = ticks ? Math.max(0.1, ticks / TICK_RATE) : (continuous ? 3.0 : 4.0);
        const rate = context.sampleRate;
        const key = `${command}:${ticks}:${rate}`;
        if (cache.has(key))
            return { buffer: cache.get(key), continuous };
        const rendered = synth({ command, seconds, sampleRate: rate, highPass: true });
        const buffer = context.createBuffer(1, rendered.values.length, rate);
        buffer.copyToChannel(rendered.values, 0);
        // Limit stored samples; lazy source-accurate recomputation is inexpensive.
        if (cache.size >= 48)
            cache.delete(cache.keys().next().value);
        cache.set(key, buffer);
        return { buffer, continuous };
    }
    function performCommand(command, ticks = 0, { pia = null } = {}) {
        command &= 31;
        ticks &= 255;
        lastCommand = command;
        lastPIA = pia;
        lastTicks = ticks;
        log.push(Object.freeze({ command, ticks, pia }));
        if (log.length > 128)
            log.shift();
        if (!enabled || !context)
            return command;
        stop();
        if (silent.has(command))
            return command;
        const { buffer, continuous } = bufferFor(command, ticks);
        const next = context.createBufferSource();
        next.buffer = buffer;
        next.loop = continuous;
        next.connect(gain);
        next.start();
        source = next;
        next.addEventListener?.('ended', () => {
            if (source === next)
                source = null;
        });
        return command;
    }
    /** DEFA7.SNDOUT: port $3F reset precedes complemented data byte. */
    function writePIA(byte, ticks = 0) {
        byte &= 63;
        if (byte === 0x3f) {
            awaitingData = true;
            return null;
        }
        if (!awaitingData)
            return null; // cannot infer a command from an arbitrary PIA write
        awaitingData = false;
        return performCommand(IRQSoundCommand(byte), ticks, { pia: byte });
    }
    /**
     * AMODE1.HALLOF: sound PIA sequence $3F, $24 (select ORGAN),
     * $3F, then $3D TOCCATA for today's highest / $3E PHANTOM.
     * These are high-score organ selectors, NOT the main 5-bit IRQ effects.
     * Do not mask $3D/$3E through IRQSoundCommand's &31 decoder.
     */
    function playHallOfFameTune(command) {
        if (command !== 0x3d && command !== 0x3e) throw new RangeError('HALL2 requires $3D or $3E');
        lastCommand = command;
        lastTicks = 0;
        log.push(Object.freeze({ command, ticks: 0, pia: command, organSelect: 0x24 }));
        if (log.length > 128) log.shift();
        if (!enabled || !context) return command;
        stop();
        const rate = context.sampleRate;
        const key = `hall:${command}:${rate}`;
        let buffer = cache.get(key);
        if (!buffer) {
            const result = synth({ command, seconds: 8, sampleRate: rate, highPass: true });
            buffer = context.createBuffer(1, result.values.length, rate);
            buffer.copyToChannel(result.values, 0);
            cache.set(key, buffer);
        }
        const next = context.createBufferSource();
        next.buffer = buffer;
        next.connect(gain);
        next.start();
        source = next;
        next.addEventListener?.('ended', () => { if (source === next) source = null; });
        return command;
    }
    /** Only call as an explicit, user-unlocked deferred power-on cue. */
    function powerOn() {
        return performCommand(0x1f, 0, { pia: 0xc0 });
    }
    function state() {
        return Object.freeze({ enabled, muted, volume, lastCommand, lastPIA, lastTicks, commands: log.slice(), cacheSize: cache.size });
    }
    return Object.freeze({ writePIA, playHallOfFameTune, enable, disable, reset, suspend, resume, setVolume, setMuted, powerOn, state });
}
