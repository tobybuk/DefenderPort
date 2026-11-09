/**
 * Fixed-rate browser host for the original Defender two-half IRQ translator.
 * Williams' 1 MHz video counter has a 16,640-count frame (16.64 ms).
 * Thus the nominal rate is 1,000,000/16,640 ~= 60.0961538 Hz.
 * This supplies nominal elapsed *physical* video periods independently of
 * the browser paint refresh rate. On a 30Hz screen two video ticks can occur
 * per browser paint. The last resulting image is then sampled by that paint;
 * the correct hardware clock must not be slowed merely to avoid a skipped
 * displayed image. It does not reproduce 6809 IRQ raster offsets or cycles.
 * Frozen/background tabs intentionally drop elapsed wall time, rather than
 * fast-forwarding the game by tens of seconds when they resume.
 */
export const VIDEO_CLOCK_HZ = 1000000 / 16640;
export const VIDEO_FRAME_MS = 1000 / VIDEO_CLOCK_HZ;
export function createSourceFrameClock({ maxCatchUp = 6 } = {}) {
    let last = null, credit = 0, total = 0, dropped = 0;
    function consume(timestamp) {
        if (!Number.isFinite(timestamp))
            throw new TypeError('frame timestamp must be finite');
        if (last === null) {
            last = timestamp;
            return 0;
        }
        const dt = Math.max(0, timestamp - last);
        last = timestamp;
        if (dt > VIDEO_FRAME_MS * maxCatchUp) {
            dropped += dt - VIDEO_FRAME_MS * maxCatchUp;
        }
        credit += Math.min(dt, VIDEO_FRAME_MS * maxCatchUp);
        const steps = Math.min(maxCatchUp, Math.floor((credit + 1e-9) / VIDEO_FRAME_MS));
        credit -= steps * VIDEO_FRAME_MS;
        total += steps;
        return steps;
    }
    function reset() {
        last = null;
        credit = 0;
        total = 0;
        dropped = 0;
    }
    function pause() {
        last = null;
        credit = 0;
    }
    function state() {
        return Object.freeze({ total, droppedMs: dropped, creditMs: credit, hz: VIDEO_CLOCK_HZ });
    }
    return Object.freeze({ consume, reset, pause, state });
}
