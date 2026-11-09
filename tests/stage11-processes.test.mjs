import test from 'node:test';
import assert from 'node:assert/strict';
import { RAM, Layout } from '../runtime/ram.js';
import { PHR6_SYMBOLS } from '../runtime/phr6-layout.js';
import { createDefa7Routines } from '../original/defa7.js';
import { createDefa7WaveExecutive } from '../original/defa7-wave-exec.js';
import { createDefa7ProcessTasks, COLTAB } from '../original/defa7-process-tasks.js';
import { createDefa7ReverseRoutines } from '../original/defa7-rev.js';
import { createDefa7ThrustRoutines } from '../original/defa7-thrust.js';
import { Continuations, TranslationBoundaryError } from '../runtime/continuations.js';
// Synthetic addresses deliberately used ONLY in tests: original names and
// memory offsets remain exact; these are NOT claims about ROM entry addresses.
const entry = { GEXEC: 0xe100, GEX0: 0xe102, COLR: 0xe200, COLRLP: 0xe202,
    SCPROC: 0xe300, SCP1: 0xe302, SCP2: 0xe304,
    REV: 0xe400, REV2: 0xe402, REVX1: 0xe404, THPROC: 0xe500 };
function setup({ RAND = () => 0, deps = {} } = {}) {
    const RAMx = new RAM(), L = new Layout({ ...PHR6_SYMBOLS, ...entry });
    const P = createDefa7Routines(RAMx, L);
    P.PINIT();
    P.OINIT();
    const waves = createDefa7WaveExecutive(RAMx, L, P, { addresses: entry, RAND, ...deps });
    const tasks = createDefa7ProcessTasks(RAMx, L, P, { addresses: entry, ...deps });
    const R = n => RAMx.read8(L.at(n)), W = (n, v) => RAMx.write8(L.at(n), v);
    const c = new Continuations({ RAM: RAMx, Layout: L, scheduler: P });
    const link = (label, fn) => c.register(label, () => fn());
    const select = (ptr) => RAMx.write16(L.at('CRPROC'), ptr);
    return { RAMx, L, P, waves, tasks, R, W, c, link, select };
}
test('WVCHK sums exactly seven original enemy counts, excluding UFO and baiters', () => {
    const t = setup();
    for (const [name, v] of Object.entries({ LNDCNT: 3, LNDRES: 2, TIECNT: 1, PRBCNT: 5, SWCNT: 7, SCZCNT: 9, SCZRES: 4, UFOCNT: 250 }))
        t.W(name, v);
    assert.equal(t.waves.WVCHK(), 31);
    t.W('LNDRES', 254);
    assert.equal(t.waves.WVCHK(), 27); // 8-bit overflow
});
test('BCDHEX and HEXBCD preserve original BCD conversion for valid digits', () => {
    const { waves: w } = setup();
    for (let n = 0; n < 100; n++) {
        const bcd = ((Math.floor(n / 10)) << 4) | (n % 10);
        assert.equal(w.BCDHEX(bcd), n);
        assert.equal(w.HEXBCD(n), bcd);
    }
    assert.equal(w.HEXBCD(100), 0);
    assert.equal(w.HEXBCD(255), 0x55);
    assert.equal(w.BCDHEX(0x9a), 100); // assembly does not validate invalid LSD
});
test('RMAX follows source repeated right shifts and mandatory +1', () => {
    for (const [rnd, bound, expected] of [[255, 32, 32], [0, 12, 1], [7, 8, 8], [255, 1, 2], [120, 16, 16]]) {
        const t = setup({ RAND: () => rnd });
        assert.equal(t.waves.RMAX(bound), expected);
    }
});
test('GEXEC dead-player branch starts wave process, increments timers and sleeps 15', () => {
    const t = setup();
    t.W('STATUS', 8);
    t.W('STRCNT', 15);
    t.W('GTIME', 37);
    const p = t.P.MKPROC(entry.GEXEC, 0);
    t.select(p);
    t.link('GEXEC', t.waves.GEXEC);
    t.link('GEX0', t.waves.GEX0);
    const result = t.c.resume(t.P.DISP());
    assert.equal(result.kind, 'end-of-dispatch');
    assert.equal(t.R('GTIME'), 38);
    assert.equal(t.R('STRCNT'), 16);
    assert.equal(t.RAMx.read8(p + t.L.at('PD')), 39);
    assert.equal(t.RAMx.read8(p + t.L.at('PTIME')), 15);
    assert.equal(t.RAMx.read16(p + t.L.at('PADDR')), entry.GEX0);
    for (let i = 0; i < 14; i++)
        assert.equal(t.c.resume(t.P.DISP()).kind, 'end-of-dispatch');
    assert.equal(t.R('GTIME'), 38);
    t.c.resume(t.P.DISP());
    assert.equal(t.R('GTIME'), 39);
});
test('GEXEC source wave-completion branch calls only original callbacks in original order', () => {
    const calls = [];
    const t = setup({ deps: { GNCIDE: () => calls.push('GNCIDE'), PLSAV: () => calls.push('PLSAV'), BONUS: () => calls.push('BONUS'), PLSTR0: () => calls.push('PLSTR0') } });
    t.select(t.P.MKPROC(entry.GEXEC, 0));
    t.RAMx.write16(t.L.at('PLRX'), t.L.at('P1SCR'));
    assert.deepEqual(t.waves.GEXEC(), 4); // propagated test callback result; original JMP PLSTR0
    assert.deepEqual(calls, ['GNCIDE', 'PLSAV', 'BONUS', 'PLSTR0']);
    assert.equal(t.RAMx.read8(t.L.at('P1SCR') + t.L.at('PLAS')), 1);
    assert.equal(t.R('STATUS'), 0x77);
});
test('GEXEC stages WAVSIZ limited by LNDRES and LNDCNT <8, then NAP', () => {
    const calls = [];
    const t = setup({ deps: { LANDST: n => calls.push(n) } });
    t.select(t.P.MKPROC(entry.GEXEC, 0));
    t.W('STATUS', 0);
    t.W('LNDRES', 5);
    t.W('LNDCNT', 2);
    t.W('UFOTMR', 9);
    t.W('WAVTIM', 12);
    t.W('WAVSIZ', 3);
    const out = t.waves.GEXEC();
    assert.equal(out.kind, 'end-of-dispatch');
    assert.deepEqual(calls, [3]);
    assert.equal(t.R('LNDRES'), 2);
    assert.equal(t.R('WAVTMR'), 12);
    assert.equal(t.R('STRCNT'), 1);
});
test('GEXEC skips landing reinforcements at source eight-lander cap', () => {
    const t = setup();
    t.select(t.P.MKPROC(entry.GEXEC, 0));
    t.W('LNDRES', 12);
    t.W('LNDCNT', 8);
    t.W('WAVTIM', 2);
    t.W('UFOTMR', 4);
    t.waves.GEXEC();
    assert.equal(t.R('LNDRES'), 12);
});
test('GEXEC accelerated UFO timer and source max 12 cap', () => {
    let spawns = 0;
    const t = setup({ deps: { UFOST: () => {
                spawns++;
            }, LANDST: () => {
            } } });
    t.select(t.P.MKPROC(entry.GEXEC, 0));
    t.W('LNDRES', 1);
    t.W('LNDCNT', 1);
    t.W('WAVTIM', 3);
    t.W('UFOTIM', 40);
    t.W('UFOTMR', 1);
    t.W('UFOCNT', 11);
    t.waves.GEXEC(); // GEXEC resets UFOTMR to UFOTIM; skip spawn this call
    assert.equal(spawns, 0);
    t.W('UFOTMR', 1);
    t.waves.GEX0();
    assert.equal(spawns, 1);
    assert.equal(t.R('UFOCNT'), 12);
    t.W('UFOTMR', 1);
    t.waves.GEX0();
    assert.equal(spawns, 1);
});
test('GEXEC WDELT source cadence: 40 executions reset PD and send B=2, ELIST pointer', () => {
    const calls = [];
    const t = setup({ deps: { WDELT: (B, Y) => calls.push([B, Y]) } });
    t.select(t.P.MKPROC(entry.GEXEC, 0));
    t.W('STATUS', 8);
    t.waves.GEXEC();
    for (let i = 1; i < 40; i++)
        t.waves.GEX0();
    assert.deepEqual(calls, [[2, t.L.at('ELIST')]]);
    assert.equal(t.R('GTIME'), 40);
});
test('GEXEC throws at missing original LANDST rather than manufacturing landers', () => {
    const t = setup();
    t.select(t.P.MKPROC(entry.GEXEC, 0));
    t.W('LNDRES', 5);
    t.W('WAVSIZ', 3);
    t.W('WAVTIM', 10);
    assert.throws(() => t.waves.GEXEC(), TranslationBoundaryError);
});
test('COLR writes source table byte, sleeps two ticks, wraps at table terminator', () => {
    const t = setup();
    const p = t.P.MKPROC(entry.COLR, 0);
    t.link('COLR', t.tasks.COLR);
    t.link('COLRLP', t.tasks.COLRLP);
    t.c.resume(t.P.DISP());
    assert.equal(t.R('LCOLRX'), 1);
    assert.equal(t.RAMx.read8(t.L.at('PCRAM') + 1), COLTAB[0]);
    assert.equal(t.RAMx.read8(p + t.L.at('PTIME')), 2);
    t.c.resume(t.P.DISP());
    assert.equal(t.R('LCOLRX'), 1);
    t.c.resume(t.P.DISP());
    assert.equal(t.R('LCOLRX'), 2);
    t.W('LCOLRX', COLTAB.length - 1);
    t.c.resume(t.P.DISP());
    t.c.resume(t.P.DISP());
    assert.equal(t.R('LCOLRX'), 1);
    assert.equal(t.RAMx.read8(t.L.at('PCRAM') + 1), COLTAB[0]);
});
test('SCPROC dispatches original callbacks in exact source order with 2/2/4 sleep ticks', () => {
    const calls = [];
    const deps = { ISCAN: () => calls.push('ISCAN'), OSCAN: () => calls.push('OSCAN'), SHSCAN: () => calls.push('SHSCAN'), MAPCH1: () => calls.push('MAPCH1'), SCNRV: () => calls.push('SCNRV') };
    const t = setup({ deps });
    const p = t.P.MKPROC(entry.SCPROC, 0);
    t.link('SCPROC', t.tasks.SCPROC);
    t.link('SCP1', t.tasks.SCP1);
    t.link('SCP2', t.tasks.SCP2);
    t.c.resume(t.P.DISP());
    assert.deepEqual(calls, ['ISCAN']);
    assert.equal(t.RAMx.read8(p + t.L.at('PTIME')), 2);
    t.c.resume(t.P.DISP());
    t.c.resume(t.P.DISP());
    assert.deepEqual(calls, ['ISCAN', 'OSCAN', 'SHSCAN']);
    t.c.resume(t.P.DISP());
    t.c.resume(t.P.DISP());
    assert.deepEqual(calls, ['ISCAN', 'OSCAN', 'SHSCAN', 'MAPCH1', 'SCNRV']);
    assert.equal(t.RAMx.read8(p + t.L.at('PTIME')), 4);
});
test('SCPROC requires real original scanner callbacks, never silent placeholder', () => {
    const t = setup();
    t.P.MKPROC(entry.SCPROC, 0);
    assert.throws(() => t.tasks.SCPROC(), TranslationBoundaryError);
});
test('two translated original processes share DISP, each with independent sleep', () => {
    const t = setup();
    t.W('STATUS', 8);
    const waveP = t.P.MKPROC(entry.GEXEC, 0);
    const colourP = t.P.MKPROC(entry.COLR, 0);
    for (const [name, fn] of Object.entries({ GEXEC: t.waves.GEXEC, GEX0: t.waves.GEX0, COLR: t.tasks.COLR, COLRLP: t.tasks.COLRLP }))
        t.link(name, fn);
    for (let tick = 0; tick < 40; tick++)
        t.c.resume(t.P.DISP());
    assert.equal(t.R('GTIME'), 3);
    assert.equal(t.R('LCOLRX'), 20); // twice per 2 ticks, independent of 15-tick wave
    assert.equal(t.RAMx.read16(waveP + t.L.at('PADDR')), entry.GEX0);
    assert.equal(t.RAMx.read16(colourP + t.L.at('PADDR')), entry.COLRLP);
});
