/**
 * Source-grounded tests for DEFA7 IRQ/I0/EXEC0/DISP (pinned e740063).
 * These tests check physical IRQ time independently of native-JS EXEC calls.
 * They deliberately do NOT claim the whole 6809 is cycle-accurate.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSourceCpuBudget } from '../runtime/source-cpu-budget.js';
import { createSourceFrameClock, VIDEO_FRAME_MS } from '../browser/source-clock.js';
import { createAttractProcessDispatcher } from '../runtime/source-attract-processes.js';
import { createAmode1Attract } from '../original/amode1-attract.js';

const PERIOD = 16640;

test('IRQ increments TIMER every physical video frame even when EXEC is busy', () => {
    const c = createSourceCpuBudget();
    const executed = [];
    let ramTimer = 0;
    const io = {
        onTimerIncrement: n => { ramTimer = n; },
        onTimerClear: () => { ramTimer = 0; }
    };
    const pass = ({ timerTicks }) => {
        executed.push(timerTicks);
        return executed.length === 1 ? PERIOD * 4 + 100 : 500;
    };
    c.advance(pass, io);          // first EXEC spans four raster periods
    c.advance(pass, io);
    c.advance(pass, io);
    c.advance(pass, io);
    assert.deepEqual(executed, [1]);
    assert.equal(ramTimer, 3, 'ISR writes the original TIMER byte');
    c.advance(pass, io);
    assert.deepEqual(executed, [1, 4], 'EXEC0 reads and clears all four elapsed IRQ ticks in ONE pass');
    assert.equal(ramTimer, 0);
    assert.equal(c.state().clearedTimerTicks, 5);
    assert.equal(c.state().executivePasses, 2);
});

test('DISP decrements PTIME once, not once per accumulated IRQ timer tick', () => {
    const tasks = createAttractProcessDispatcher({
        FIRST: ({ sleep }) => sleep(3, 'DONE'),
        DONE: ({ suicide }) => { awakened++; suicide(); }
    });
    let awakened = 0;
    tasks.spawn('FIRST');
    const c = createSourceCpuBudget();
    const run = () => {
        tasks.dispatch();
        return c.state().executivePasses === 0 ? PERIOD * 4 + 100 : 50;
    };
    c.advance(run);
    c.advance(run);
    c.advance(run);
    c.advance(run);
    c.advance(run); // first post-overrun pass, TIMER read = 4
    assert.equal(awakened, 0);
    assert.equal(tasks.state().tasks[0].ptime, 2);
    c.advance(run);
    assert.equal(tasks.state().tasks[0].ptime, 1);
    c.advance(run);
    assert.equal(awakened, 1);
});

test('TIMER uses original unsigned eight-bit increment and rolls over', () => {
    const c = createSourceCpuBudget();
    let val = 0;
    const writes = [];
    for (let i = 0; i < 257; i++) {
        c.advance(() => PERIOD * 300, {
            onTimerIncrement: n => { val = n; if (i >= 254) writes.push(n); },
            onTimerClear: () => { val = 0; }
        });
    }
    assert.deepEqual(writes, [254, 255, 0]);
    assert.equal(val, 0);
    assert.equal(c.state().timerOverflows, 1);
});

test('source timing trace reports pass start and end in CPU cycles', () => {
    const c = createSourceCpuBudget();
    c.advance(() => PERIOD * 2 + 100);
    c.advance(() => 200);
    assert.equal(c.trace().length, 1);
    c.advance(() => 200);
    const trace = c.trace();
    assert.equal(trace[0].endCycle - trace[0].startCycle, PERIOD * 2 + 100);
    assert.equal(trace[1].timerTicks, 2);
    assert.ok(trace[1].startCycle >= PERIOD * 2 + 100);
    assert.equal(c.state().irqChargedCycles, 0, 'unmeasured IRQ work must not be fabricated');
    assert.equal(c.state().unmeteredIRQ, true);
});

test('attract clock depends on wall time, not number of requestAnimationFrame paints', () => {
    const slow = createSourceFrameClock({ maxCatchUp: 6 });
    const fast = createSourceFrameClock({ maxCatchUp: 6 });
    let ns = slow.consume(0), nf = fast.consume(0);
    for (let i = 1; i <= 60; i++) {
        ns += slow.consume(i * 2 * VIDEO_FRAME_MS);
    }
    for (let i = 1; i <= 120; i++) {
        nf += fast.consume(i * VIDEO_FRAME_MS);
    }
    assert.equal(ns, 120);
    assert.equal(nf, 120);
    assert.equal(ns, nf);
});

test('attract instance exposes source timer trace, alongside independent frame count', () => {
    const a = createAmode1Attract();
    let s;
    for (let i = 0; i < 350; i++) s = a.DISPLAY_STEP();
    assert.equal(s.cpuBudget.displayFrames, 350);
    assert.ok(s.cpuBudget.executivePasses <= 350);
    assert.equal(s.cpuBudget.executivePasses, a.TIMING_TRACE().length < 256 ? a.TIMING_TRACE().length : s.cpuBudget.executivePasses);
    
    assert.ok(a.TIMING_TRACE().every(e => e.timerTicks >= 1));
    assert.ok(a.TIMING_TRACE().some(e => e.timerTicks > 1));
});
