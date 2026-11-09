/** Stage 49: tests derived independently from Williams Red Label source.
 * AMODE1.SRC 781-834 PRES->DEFEND/$30->DEFENS->DEF2/$2E->DEF33
 *   NEWP DEF50 -> DEF51/SLEEP1; DEF44 after $28; WILLIR after completion.
 * DEFA7.SRC 7-14 SLEEP; 77-85 MKPROC/PTIME=1; 3042-3126 EXEC/DISP.
 * SAMEXAP7.SRC 13-16 XUVCT/EXPU, 55-57 RSIZE=$AF00.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createAttractProcessDispatcher } from '../runtime/source-attract-processes.js';
import { createAmode1Attract } from '../original/amode1-attract.js';
import { SAMEX_RAM as R } from '../original/samexap7-explosion-start.js';
import { createSourceFrameClock, VIDEO_FRAME_MS } from '../browser/source-clock.js';
function until(a, what) {
    for (let i = 0; i < 450; i++) {
        const s = a.STEP();
        if (what(s))
            return s;
    }
    throw Error('source wait did not complete');
}
function age(a, n) {
    return until(a, s => s.defenderAge === n);
}
test('DEFA7 PTIME=1, linked NEWP and SLEEP continuation execute in the original order', () => {
    const events = [];
    const handlers = {
        P: ({ spawn, sleep, tick }) => {
            events.push(['P', tick]);
            spawn('Q');
            sleep(3, 'P2');
        },
        Q: ({ sleep, tick }) => {
            events.push(['Q', tick]);
            sleep(2, 'Q2');
        },
        Q2: ({ suicide, tick }) => {
            events.push(['Q2', tick]);
            suicide();
        },
        P2: ({ suicide, tick }) => {
            events.push(['P2', tick]);
            suicide();
        }
    };
    const d = createAttractProcessDispatcher(handlers);
    d.spawn('P');
    for (let i = 0; i < 4; i++)
        d.dispatch();
    assert.deepEqual(events, [['P', 1], ['Q', 1], ['Q2', 3], ['P2', 4]]);
    assert.equal(d.state().tasks.length, 0);
});
test('DEFEND uses $30 separate wake-up, not the old off-by-one synthetic presTicks gate', () => {
    const a = createAmode1Attract();
    let s = until(a, s => s.step === 'PRES' && s.presTicks === 1);
    assert.deepEqual(s.titleProcessState.tasks, [{ entry: 'DEFENS', ptime: 0x30 }]);
    while (s.presTicks < 0x30) {
        s = a.STEP();
        assert.equal(s.defenderAge, -1);
    }
    s = a.STEP();
    assert.equal(s.presTicks, 0x31);
    assert.equal(s.defenderAge, 0);
    assert.equal(s.defenderSlices, 15);
    assert.deepEqual(s.titleProcessState.tasks, [{ entry: 'DEF33', ptime: 0x2e }]);
    assert.equal(a.ram.read16(R.RAMALS + R.RSIZE), 0xaf00, 'APST initial state persists until NEXT EXEC1 XUVCT');
    s = a.STEP();
    assert.equal(s.defenderAge, 1);
    assert.equal(a.ram.read16(R.RAMALS + R.RSIZE), 0xae00);
});
test('DEF33 creates DEF50 separately with PTIME=1 and $28 wait to DEF44', () => {
    const a = createAmode1Attract();
    let s = age(a, 45);
    assert.equal(s.defenderPhase, 'appearing');
    assert.equal(s.defender50Draws, 0);
    s = a.STEP();
    assert.equal(s.defenderAge, 46);
    assert.equal(s.defenderPhase, 'restoring');
    assert.equal(s.defender50Draws, 1, 'MKPROC inserts DEF50 after DEF33, executes same DISP pass');
    assert.equal(s.titleProcessState.tasks[0].entry, 'DEF44');
    assert.equal(s.titleProcessState.tasks[0].ptime, 0x28);
    assert.equal(s.titleProcessState.tasks[1].entry, 'DEF50');
    assert.equal(s.titleProcessState.tasks[1].ptime, 1);
    s = until(a, s => s.defenderCBomb);
    assert.equal(s.defenderAge, 86, 'DEF44 runs 40 source process ticks after DEF33');
    assert.equal(s.defenderPhase, 'complete');
});
test('DEF50 finishes only after source RSIZE slots clear, then runs WILLIR for two ticks', () => {
    const a = createAmode1Attract();
    let s = age(a, 47);
    assert.equal(s.defender50Draws, 2);
    s = a.STEP();
    assert.equal(s.defenderAge, 48);
    assert.equal(s.willIRUsed, true);
    assert.equal(s.logoRate, 255);
    assert.equal(s.titleProcessState.tasks.at(-1).entry, 'WILR1');
    assert.equal(s.titleProcessState.tasks.at(-1).ptime, 2);
    s = a.STEP();
    assert.equal(s.logoRate, 255);
    s = a.STEP();
    assert.equal(s.logoRate, 10);
});
test('presentation and gameplay clocks follow elapsed hardware time, not browser paint frequency', () => {
    const attract = createSourceFrameClock({ maxCatchUp: 6 });
    const gameplay = createSourceFrameClock();
    assert.equal(attract.consume(1000), 0);
    assert.equal(gameplay.consume(1000), 0);
    assert.equal(attract.consume(1000 + VIDEO_FRAME_MS * 4), 4);
    assert.equal(gameplay.consume(1000 + VIDEO_FRAME_MS * 4), 4);
    assert.equal(attract.state().droppedMs, 0);
    assert.equal(attract.consume(1000 + VIDEO_FRAME_MS * 5), 1);
});
