/**
 * Stage 50 source-cycle work: Motorola 6809PM appendix F; SAMEXAP7.SRC
 * 121-202, 207-218, 222-376; AMODE1.SRC 791-890; ROMF8.SRC 405-439.
 * These do not falsely assert pixel-perfect MAME identity. They verify
 * cycle-budget accounting and show the original PTIME sleeps are UNCHANGED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createAmode1Attract } from '../original/amode1-attract.js';
import { createSourceCpuBudget } from '../runtime/source-cpu-budget.js';
import { EERASE_BLOCK_CYCLES, EWRITE_BLOCK_CYCLES, DEFENDER_VIDEO_CYCLES } from '../original/samexap7-cycle-ledger.js';
function advanceUntil(a, step, condition, limit = 1000) {
    let s;
    for (let i = 0; i < limit; i++) {
        s = a[step]();
        if (condition(s))
            return s;
    }
    throw Error('title process stalled');
}
test('source indexed/indirect EERASE/EWRITE inner block cycle counts are retained', () => {
    assert.equal(EERASE_BLOCK_CYCLES, 20);
    assert.equal(EWRITE_BLOCK_CYCLES, 33);
    assert.equal(DEFENDER_VIDEO_CYCLES, 16640);
});
test('CPU workload host carries negative credit into later display frames without altering source ticks', () => {
    const c = createSourceCpuBudget();
    let invoked = 0;
    c.advance(() => {
        invoked++;
        return DEFENDER_VIDEO_CYCLES * 2;
    });
    assert.equal(invoked, 1);
    assert.equal(c.state().executivePasses, 1);
    c.advance(() => {
        invoked++;
        return DEFENDER_VIDEO_CYCLES * 2;
    });
    assert.equal(invoked, 1, 'no EXEC while first pass still consumes CPU');
    c.advance(() => {
        invoked++;
        return DEFENDER_VIDEO_CYCLES * 2;
    });
    assert.equal(invoked, 2);
    assert.equal(c.state().displayFrames, 3);
});
test('source PTIME/RSIZE sequence is identical under display-cycle pacing', () => {
    const a = createAmode1Attract();
    let s = advanceUntil(a, 'DISPLAY_STEP', s => s.step === 'PRES' && s.presTicks === 1);
    assert.equal(s.titleProcessState.tasks[0].ptime, 0x30);
    s = advanceUntil(a, 'DISPLAY_STEP', s => s.defenderAge === 0);
    assert.equal(s.defenderSlices, 15);
    assert.equal(s.titleProcessState.tasks[0].ptime, 0x2e);
    const start = s.cpuBudget.displayFrames;
    s = advanceUntil(a, 'DISPLAY_STEP', s => s.defenderAge === 45);
    assert.equal(s.defenderPhase, 'appearing');
    assert.ok(s.cpuBudget.displayFrames - start > 45, '6809 cannot complete 45 source frames of 15 fragment EWRITEs in 45 video frames');
    const beforeRestore = s.cpuBudget.displayFrames;
    s = advanceUntil(a, 'DISPLAY_STEP', s => s.defenderAge === 46);
    assert.equal(s.defenderPhase, 'restoring');
    assert.equal(s.defender50Draws, 1);
    assert.ok(s.cpuBudget.displayFrames >= beforeRestore);
    assert.equal(s.titleProcessState.tasks[0].ptime, 0x28);
});
test('new model produces repeatable source workload and does not use a fixed slowdown factor', () => {
    const a = createAmode1Attract();
    let s = advanceUntil(a, 'DISPLAY_STEP', s => s.defenderAge === 1);
    const first = s.sourceExecCycles;
    s = advanceUntil(a, 'DISPLAY_STEP', s => s.defenderAge === 30);
    assert.ok(s.sourceExecCycles > first, 'later effect steps draw more framebuffer blocks');
    assert.ok(s.cpuBudget.overrunFrames > 0);
    assert.ok(s.cpuBudget.estimatedWorkCycles > 500000);
});
test('legacy source executive STEP retains one-tick-per-call semantics for tests and game code', () => {
    const a = createAmode1Attract();
    let s = advanceUntil(a, 'STEP', s => s.defenderAge === 0);
    assert.equal(a.STEP().defenderAge, 1);
    assert.equal(a.STEP().defenderAge, 2);
    assert.equal(s.cpuBudget.displayFrames, 0);
});
