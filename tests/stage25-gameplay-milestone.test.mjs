/**
 * Stage 25 native Defender integration tests.  These inspect original process
 * records and the source-written framebuffer, not UI-side surrogate entities.
 * Source: DEFA7.SRC LFIRE/COLIDE/GEXEC and DEFB6.SRC AKIL1/P500/TERBLO.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFlightHarness } from '../demo/flight-harness.js';
import { SAMEX_RAM as S } from '../original/samexap7-explosion-start.js';
const a = (h, n) => h.Layout.at(n);
const b = (h, n) => h.ram.read8(a(h, n));
const d = (h, X, n) => h.ram.read16(X + a(h, n));
const run = (h, n) => {
    for (let i = 0; i < n; i++)
        h.STEP();
};
const visibleLander = h => h.ENEMY_STATE().find(o => o.label === 'LNDP1' && o.video && [0xe140, 0xe14a, 0xe154].includes(d(h, o.object, 'OPICT')));
test('original first-wave landers initially appear as source $AF00 APST slots and then actual original pictures', () => {
    const h = createFlightHarness(), first = h.ENEMY_STATE().find(o => o.label === 'LNDP1');
    assert.equal(d(h, first.object, 'OPICT'), 0xff9d, 'new Lander uses source NULOB while appearing');
    assert.ok([...Array(16).keys()].some(i => (h.ram.read16(S.RAMALS + i * S.RAMSIZ + S.RSIZE) & 0x8000) !== 0));
    run(h, 70);
    const landed = visibleLander(h);
    assert.ok(landed, 'source APST resolves to visible original Lander picture');
    assert.ok(h.video.read8(landed.video) !== undefined);
    assert.equal(b(h, 'LNDCNT'), 5);
});
test('source laser shot uses LFIRE process scheduler, acquires and releases LFLG', () => {
    const h = createFlightHarness();
    assert.equal(b(h, 'LFLG'), 0);
    assert.ok(h.FIRE(), 'source MKPROC creates an LFIRE process');
    run(h, 1);
    assert.equal(b(h, 'LFLG'), 1);
    run(h, 80);
    assert.equal(b(h, 'LFLG'), 0, 'the source shot retires itself and decrements LFLG');
    assert.equal(h.STATE().status & 0x40, 0);
});
test('source COLIDE hits a visible original enemy, decrements its count, and awards real packed-BCD points', () => {
    const h = createFlightHarness();
    run(h, 100);
    const l = visibleLander(h);
    assert.ok(l);
    const count = b(h, 'LNDCNT');
    const before = h.STATE().scoreBCD;
    let hit = 0;
    for (let row = 0; row < 8 && !hit; row++)
        hit = h.laser.COLIDE((l.video & 0xff00) | ((l.video + row) & 255));
    assert.equal(hit, l.object, 'COLIDE dispatches the original OCVECT kill vector');
    assert.equal(b(h, 'LNDCNT'), count - 1);
    assert.notDeepEqual(h.STATE().scoreBCD, before, 'DEFB6 KILP credits the original 150 points');
    assert.equal(h.STATE().laserHits, 1);
    run(h, 80);
    assert.ok(h.WAVE_STATE().landerCount >= 0, 'killed Lander does not crash the process scheduler');
});
test('source APST kill disarms the saved source explosion-slot pointer before object reuse', () => {
    const h = createFlightHarness();
    const l = h.ENEMY_STATE().find(o => o.label === 'LNDP1');
    assert.equal(d(h, l.object, 'OPICT'), 0xff9d);
    const slot = [...Array(16).keys()].map(i => S.RAMALS + i * S.RAMSIZ).find(p => h.ram.read16(p + S.OBJPTR) === l.object);
    assert.ok(slot);
    assert.equal(h.KILL_BY_VECTOR(l.object, 0xe228), true);
    assert.equal(h.ram.read16(slot + S.RSIZE), 0x100, 'slot was reallocated as a normal positive-size explosion, not an appearance');
    assert.equal(h.ram.read16(slot + S.OBJPTR), 0);
    run(h, 70);
    assert.ok(h.WAVE_STATE().landerCount >= 0);
});
test('AKIL1 connects player contact with a falling astronaut to AFALL2 and schedules a 500-point award', () => {
    const h = createFlightHarness();
    const X = h.ASTRONAUT_STATE().living.find(v => v.video)?.object;
    assert.ok(X);
    const U = h.procs.MKPROC(0xe298, a(h, 'STYPE'));
    h.ram.write16(U + a(h, 'PD'), X);
    h.ram.write16(X + a(h, 'OBJID'), U);
    h.ram.write16(X + a(h, 'OCVECT'), 0xe234);
    let pickup = false;
    for (let x = 0x20; x < 0x28 && !pickup; x++)
        for (let y = 0x85; y < 0x8b && !pickup; y++) {
            h.ram.write16(X + a(h, 'OBJX'), (x << 8) | y);
            h.collision.COLCHK();
            pickup = d(h, U, 'PADDR') === 0xe29a;
        }
    assert.ok(pickup, 'COLCHK uses same source COLIDE and AKIL1 rescue vector');
    assert.equal(b(h, 'PCFLG'), 0, 'player-collision flag restores after source callback');
    const startScore = h.STATE().scoreBCD;
    run(h, 2);
    assert.notDeepEqual(h.STATE().scoreBCD, startScore, 'P500 credits rescued astronaut');
    assert.equal(h.ASTRONAUT_STATE().count, 10, 'rescuing does not kill astronaut');
});
test('when the last original astronaut dies, TERBLO clears terrain and runs without a translation exception', () => {
    const h = createFlightHarness();
    const humans = h.ASTRONAUT_STATE().living.map(o => o.object);
    assert.equal(humans.length, 10);
    for (const X of humans)
        h.astronaut.ASTK1(X);
    assert.equal(h.ASTRONAUT_STATE().count, 0);
    run(h, 100);
    assert.ok((b(h, 'STATUS') & 2) !== 0, 'source TERBLO sets planet-destroyed status flag');
    run(h, 500);
    assert.ok((b(h, 'STATUS') & 2) !== 0, 'destruction retains game terrain status');
});
test('original GEXEC and BONUS advance to wave two and restore second-wave Tie and Probe counts', () => {
    const h = createFlightHarness();
    for (const k of ['LNDCNT', 'LNDRES', 'TIECNT', 'PRBCNT', 'SWCNT', 'SCZCNT', 'SCZRES'])
        h.ram.write8(a(h, k), 0);
    for (let n = 0; n < 210; n++)
        h.STEP();
    assert.equal(h.WAVE_STATE().wave, 2, 'source BONUS advanced WVTAB pointer');
    assert.equal(h.WAVE_STATE().waveCompleted, 1);
    assert.equal(b(h, 'TIECNT'), 3, 'wave two starts original Tie squad');
    assert.equal(b(h, 'PRBCNT'), 1, 'wave two starts original Probe');
    assert.equal(h.WAVE_STATE().landerCount, 5);
    assert.equal(h.WAVE_STATE().landerReserve, 15);
    assert.ok(h.STATE().scoreBCD.some(Boolean), 'source BONUS credited survivors');
    run(h, 80);
    assert.equal(h.WAVE_STATE().wave, 2);
});
test('wave two Probe destruction seeds real source MMSW Swarmers, not opening-wave fixtures', () => {
    const h = createFlightHarness();
    for (const k of ['LNDCNT', 'LNDRES', 'TIECNT', 'PRBCNT', 'SWCNT', 'SCZCNT', 'SCZRES'])
        h.ram.write8(a(h, k), 0);
    for (let n = 0; n < 210; n++)
        h.STEP();
    let p = h.ram.read16(a(h, 'OPTR')), found = 0;
    const seen = new Set();
    for (const head of ['OPTR', 'IPTR']) {
        p = h.ram.read16(a(h, head));
        while (p && !seen.has(p)) {
            seen.add(p);
            if (d(h, p, 'OCVECT') === 0xe2f4)
                found = p;
            p = d(h, p, 'OLINK');
        }
    }
    assert.ok(found, 'the translated PRBST created original probe object');
    const result = h.KILL_BY_VECTOR(found, 0xe2f4);
    assert.equal(result, true);
    assert.equal(b(h, 'PRBCNT'), 0);
    assert.ok(b(h, 'SWCNT') >= 1, 'PRBKIL -> MMSW creates a swarmer squad');
    run(h, 80);
});
