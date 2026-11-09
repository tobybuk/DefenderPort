/**
 * Stage 60 browser-only hybrid positional-altitude joystick for native Defender.
 * The 6809 game still receives only the original SSCAN switch input bytes.
 *
 * The LEFT thumb may hold two logical actions at once: vertical movement
 * and thrust. A horizontal drag selects the wanted *facing direction*;
 * the browser adapter asks the original REV switch to turn the ship only
 * when its direction is different. No velocity or game physics is invented.
 *
 * Each physical pointer is isolated. A fast tap retains its rising edge
 * through one source input sample even if the finger releases first.
 */
export const TOUCH_ACTIONS = Object.freeze({
    fire: 'KeyF', thrust: 'Space', reverse: 'KeyR',
    smartBomb: 'KeyS', hyperspace: 'KeyH',
    up: 'ArrowUp', down: 'ArrowDown'
});

export function createTouchInputState() {
    const pointers = new Map(); // pointerId -> Set<original logical switch>
    const edges = new Set();
    const currentlyHeld = key => [...pointers.values()].some(keys => keys.has(key));

    return Object.freeze({
        set(pointerId, key) {
            this.setMany(pointerId, key ? [key] : []);
        },
        setMany(pointerId, keys) {
            const next = new Set(keys.filter(Boolean));
            const before = pointers.get(pointerId) ?? new Set();
            for (const key of next) {
                if (!before.has(key) && !currentlyHeld(key)) edges.add(key);
            }
            if (next.size) pointers.set(pointerId, next);
            else pointers.delete(pointerId);
        },
        held: currentlyHeld,
        consume(key) {
            const found = edges.has(key);
            edges.delete(key);
            return found;
        },
        release(pointerId) { pointers.delete(pointerId); },
        clear() { pointers.clear(); edges.clear(); },
        activeCount() { return pointers.size; }
    });
}

/** Legacy vertical slider selector, retained for older source tests. */
export function joystickKey(clientY, top, height) {
    if (!Number.isFinite(height) || height <= 0) return null;
    const position = (clientY - top) / height;
    if (position < 0.45) return TOUCH_ACTIONS.up;
    if (position > 0.55) return TOUCH_ACTIONS.down;
    return null;
}

/**
 * Floating position and independent axis hysteresis; unit is CSS pixels.
 * Activation is deliberately larger than release, avoiding oscillations
 * when a finger is close to its neutral point. This is an input adapter.
 */
export function createFloatingJoystick({ engage = 22, release = 12 } = {}) {
    if (!(engage > release && release >= 0)) throw new RangeError('Invalid joystick dead zone');
    let pointerId = null;
    let originX = 0, originY = 0, x = 0, y = 0;
    let horizontal = 0, vertical = 0;

    const axis = (distance, previous) => {
        if (distance >= engage) return 1;
        if (distance <= -engage) return -1;
        if (previous === 1 && distance > release) return 1;
        if (previous === -1 && distance < -release) return -1;
        return 0;
    };
    const state = () => ({
        active: pointerId !== null, pointerId, originX, originY,
        dx: x - originX, dy: y - originY, clientX: x, clientY: y, horizontal, vertical
    });
    return Object.freeze({
        begin(id, clientX, clientY) {
            if (pointerId !== null || !Number.isFinite(clientX) || !Number.isFinite(clientY)) return false;
            pointerId = id;
            originX = x = clientX;
            originY = y = clientY;
            horizontal = vertical = 0;
            return true;
        },
        move(id, clientX, clientY) {
            if (id !== pointerId || !Number.isFinite(clientX) || !Number.isFinite(clientY)) return false;
            x = clientX; y = clientY;
            horizontal = axis(x - originX, horizontal);
            // Browser Y grows downwards, so UP is -1.
            vertical = axis(y - originY, vertical);
            return true;
        },
        end(id) {
            if (id !== pointerId) return false;
            pointerId = null;
            horizontal = vertical = 0;
            return true;
        },
        cancel() { pointerId = null; horizontal = vertical = 0; },
        state
    });
}

/** The joystick can assert thrust simultaneously with either vertical key. */
export function hybridJoystickKeys({ horizontal = 0, vertical = 0 } = {}, { hallEntry = false, altitudeMode = false } = {}) {
    const keys = [];
    if (!altitudeMode && vertical < 0) keys.push(TOUCH_ACTIONS.up);
    else if (!altitudeMode && vertical > 0) keys.push(TOUCH_ACTIONS.down);
    if (!hallEntry && horizontal !== 0) keys.push(TOUCH_ACTIONS.thrust);
    return keys;
}

/**
 * Convert joystick horizontal intent into the ORIGINAL Reverse switch.
 * A held mismatch is essential: original SSCAN debounces switch edges
 * across two samples, and REV may take several ticks to change PLADIR.
 * Once the displayed direction matches, Reverse must be RELEASED so the
 * original REV2/REVX1 process can finish without another reversal.
 */
export function hybridReverseHeld(horizontal, sourceDirection) {
    if (!horizontal) return false;
    const facing = (sourceDirection & 0x8000) ? -1 : 1;
    return horizontal !== facing;
}

/**
 * Original SSCAN accepts only one newly asserted PIA2 switch per sample.
 * A finger moved horizontally asserts auto-thrust and requests Reverse at
 * essentially the same time. If the browser asserts both on the same sample,
 * the low-bit thrust input masks the Reverse rising edge permanently.
 *
 * This host-only sequencer first lets source SSCAN sample the continuous
 * controls, then presents Reverse as a separate switch edge. It drops the
 * signal as soon as REVFLG appears (or facing matches), allowing the original
 * REV2 release and cooldown to run. If another switch masks the attempt,
 * it releases and retries rather than fabricating a direction flip.
 */
export function createHybridReverseSequencer() {
    let intent = 0;
    let phase = 'idle';
    let ticks = 0;
    const reset = () => { intent = 0; phase = 'idle'; ticks = 0; };
    return Object.freeze({
        sample(horizontal, sourceDirection, reverseActive = false, competingEdge = false) {
            const mismatch = hybridReverseHeld(horizontal, sourceDirection);
            if (!mismatch) { reset(); return false; }
            if (reverseActive) {
                intent = horizontal;
                phase = 'arm'; ticks = 2;
                return false;
            }
            if (intent !== horizontal) {
                intent = horizontal;
                phase = 'arm'; ticks = 2;
                return false;
            }
            if (phase === 'idle') { phase = 'arm'; ticks = 2; }
            if (phase === 'arm' || phase === 'rearm') {
                if (ticks > 0) { ticks--; return false; }
                if (competingEdge) return false;
                phase = 'assert'; ticks = 0;
            }
            if (phase === 'assert') {
                if (ticks++ < 3) return true;
                // If the game has not started REV yet, release for at least
                // two SSCAN samples then send a new edge, preserving source
                // input-debounce semantics even under simultaneous FIRE.
                phase = 'rearm'; ticks = 2;
                return false;
            }
            return false;
        },
        reset,
        state: () => ({ intent, phase, ticks })
    });
}


/**
 * Stage 60: left thumb chooses a destination Y, not a held vertical direction.
 * The playable ship's source limits are DEFA7.PLAYER: YMIN+1 ... 238.
 * Mapping uses the ENTIRE touch pad, not displacement from touch-down.
 * This stays in the browser adapter: only original PIA Up/Down switches are
 * sent to the original PLAYER routine; PLAY16 and PLAYV are never modified.
 */
export function targetAltitudeFromTouch(clientY, top, height, minY = 43, maxY = 238) {
    if (!Number.isFinite(clientY) || !Number.isFinite(top) ||
        !Number.isFinite(height) || height <= 0 ||
        !(Number.isFinite(minY) && Number.isFinite(maxY) && maxY > minY)) return null;
    const fraction = Math.max(0, Math.min(1, (clientY - top) / height));
    return minY + (maxY - minY) * fraction;
}

/**
 * Predict ONE original DEFA7.PLAYER movement update in 8.8 fixed-point.
 * The first pressed update moves 1 pixel, accelerating by 8/256 pixel/tick
 * to a maximum of 2. Releasing the switch sets PLAYV = 0 immediately.
 * Choose the next switch only if that source movement reduces target error.
 * This prevents runaway drift, rapid overshoot and chasing a point forever.
 */
export function altitudeSourceSwitches(targetY, play16, vy) {
    const neutral = { up: false, down: false };
    if (targetY === null || !Number.isFinite(targetY) ||
        !Number.isFinite(play16) || !Number.isFinite(vy)) return neutral;
    const currentY = (play16 & 0xffff) / 256;
    const error = targetY - currentY;
    if (Math.abs(error) <= 0.5) return neutral;
    const signedVy = (vy << 16) >> 16;
    const newVy = error < 0
        ? (signedVy < 0 ? Math.max(-512, signedVy - 8) : -256)
        : (signedVy > 0 ? Math.min(512, signedVy + 8) : 256);
    const deltaY = newVy / 256;
    // At nearly two pixels/tick, let go for one tick to reset the original
    // PLAYV acceleration; a later one-pixel update can finish the approach.
    if (Math.abs(error - deltaY) >= Math.abs(error) - 1e-8) return neutral;
    return error < 0 ? { up: true, down: false } : { up: false, down: true };
}

export function createAltitudeController({ minY = 43, maxY = 238 } = {}) {
    let targetY = null;
    return Object.freeze({
        touch(clientY, padTop, padHeight) {
            targetY = targetAltitudeFromTouch(clientY, padTop, padHeight, minY, maxY);
            return targetY;
        },
        sample(play16, vy) { return altitudeSourceSwitches(targetY, play16, vy); },
        clear() { targetY = null; },
        state() { return Object.freeze({ targetY, minY, maxY, active: targetY !== null }); }
    });
}
