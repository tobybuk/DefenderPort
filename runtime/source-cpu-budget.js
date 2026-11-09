/**
 * Source-timer/CPU-time coordination for the native-JavaScript Defender port.
 *
 * DEFA7.SRC: IRQ/I0 increments the 8-bit TIMER on the low-raster transition.
 * EXEC0 reads A=TIMER then CLR TIMER. An EXEC pass invokes XUVCT and DISP
 * exactly ONCE, even if A was 2, 3 ... 255 because an earlier pass overran
 * several 16,640-cycle video periods. In particular, TIMER is a LATCHED
 * COUNT, not a backlog of pending EXEC calls.
 *
 * We account virtual 6809 E-clock cycles for source-named JS routines. The
 * host callback executes a whole source-routine pass and reports its cycle
 * cost; it never interprets 6809 opcodes or runs a 6809 CPU emulator.
 *
 * Accuracy boundary: a callback's framebuffer writes currently occur as a
 * batch at the start of its charged interval, not at their individual
 * instruction offsets. IRQ work, preemption, and all non-XUVCT cycles are
 * not yet fully costed; irqCycles=0 is deliberately explicit rather than a
 * guessed fixed penalty. This is an improvement in EXEC/TIMER semantics,
 * NOT cycle-exact hardware emulation or an arcade-speed certification.
 */
import { DEFENDER_VIDEO_CYCLES } from '../original/samexap7-cycle-ledger.js';

export function createSourceCpuBudget({
    videoCycles = DEFENDER_VIDEO_CYCLES,
    irqCycles = 0,
    traceSize = 256
} = {}) {
    if (!Number.isSafeInteger(videoCycles) || videoCycles < 1)
        throw new RangeError('videoCycles must be a positive integer');
    if (!Number.isSafeInteger(irqCycles) || irqCycles < 0 || irqCycles >= videoCycles)
        throw new RangeError('irqCycles must be 0..videoCycles-1');
    if (!Number.isSafeInteger(traceSize) || traceSize < 1 || traceSize > 65536)
        throw new RangeError('traceSize must be 1..65536');

    let displayFrames, executivePasses, timer, absoluteCycles, busyUntil;
    let consumedCycles, estimatedWorkCycles, irqChargedCycles, overrunFrames;
    let clearedTimerTicks, timerOverflows, lastTimerRead, lastCost;
    const events = [];

    function reset() {
        displayFrames = executivePasses = timer = absoluteCycles = busyUntil = 0;
        consumedCycles = estimatedWorkCycles = irqChargedCycles = overrunFrames = 0;
        clearedTimerTicks = timerOverflows = lastTimerRead = lastCost = 0;
        events.length = 0;
    }
    function record(event) {
        events.push(Object.freeze(event));
        if (events.length > traceSize)
            events.shift();
    }
    /**
     * One nominal hardware video period. `onTimerIncrement` mirrors IRQ's
     * INC TIMER into source RAM; `onTimerClear` mirrors EXEC0's CLR TIMER.
     * The original host's callback is the translated EXEC pass and returns
     * its path-dependent cycle count. There is no fake one-pass-per-frame
     * queue: if TIMER accumulated several IRQs, EXEC consumes all of them
     * in one pass, exactly as the assembly does.
     */
    function advance(execute, { onTimerIncrement, onTimerClear } = {}) {
        if (typeof execute !== 'function')
            throw new TypeError('execute must be a source EXEC callback');
        const frameStart = absoluteCycles;
        const frameEnd = frameStart + videoCycles;
        displayFrames++;
        if (timer === 255)
            timerOverflows++;
        timer = (timer + 1) & 255;
        onTimerIncrement?.(timer);

        // The separate raster IRQ also uses the 6809's single CPU. We only
        // charge a known measured cost; the default is 0 (untranslated).
        irqChargedCycles += irqCycles;
        const startCycle = Math.max(frameStart + irqCycles, busyUntil);
        let passes = 0;
        if (timer !== 0 && startCycle < frameEnd) {
            const ticks = timer;      // LDA TIMER
            timer = 0;                // CLR TIMER
            onTimerClear?.(ticks);
            const rawCycles = execute({ timerTicks: ticks, startCycle, displayFrame: displayFrames });
            if (!Number.isFinite(rawCycles) || rawCycles < 0)
                throw new RangeError('EXEC returned invalid 6809 cycle count');
            const charged = Math.max(1, Math.ceil(rawCycles));
            lastCost = charged;
            lastTimerRead = ticks;
            busyUntil = startCycle + charged;
            consumedCycles += charged;
            estimatedWorkCycles += rawCycles;
            clearedTimerTicks += ticks;
            executivePasses++;
            passes = 1;
            record({ frame: displayFrames, startCycle, endCycle: busyUntil,
                timerTicks: ticks, cycles: charged });
        }
        if (passes === 0 && busyUntil > frameStart)
            overrunFrames++;
        absoluteCycles = frameEnd;
        return Object.freeze({ ...state(), passes });
    }
    function state() {
        return Object.freeze({
            displayFrames, executivePasses,
            // Kept as a diagnostics alias, never a queue of EXEC passes.
            pendingTimer: timer,
            timer, timerOverflows, clearedTimerTicks, lastTimerRead,
            absoluteCycles, busyUntilCycle: busyUntil,
            busyCyclesRemaining: Math.max(0, busyUntil - absoluteCycles),
            consumedCycles, estimatedWorkCycles, irqChargedCycles,
            overrunFrames, lastCost, unmeteredIRQ: irqCycles === 0
        });
    }
    function trace() {
        return events.slice();
    }
    reset();
    return Object.freeze({ advance, reset, state, trace });
}
