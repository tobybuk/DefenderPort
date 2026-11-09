/**
 * Regression tests for three independently reported attract-mode faults.
 *
 * Pinned reference: Williams Red Label AMODE1.SRC (e740063):
 * LOGO/LOGO0/LOGO10  lines 716-777
 * LEDRET/STILOB      lines 468-505
 * AMOD12/AMOD11      lines 607-640
 * LASRS/LAS0-4       lines 652-685
 *
 * These tests assert source register relationships and actual video bytes.
 * They deliberately do not assert a guessed browser/6809 instruction rate.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createAmode1Attract } from '../original/amode1-attract.js';
import { AMODE_ENEMIES } from '../original/amode1-attract-data.js';
function reach(a, predicate, max = 5000) {
    for (let n = 0; n < max; n++) {
        const state = a.STEP();
        if (predicate(state))
            return { state, ticks: n + 1 };
    }
    throw new Error('Attract process did not reach expected source continuation in ' + max + ' steps');
}
function sourceAddr(x16, y16) {
    // Original OPON: SUBD BGL (attract BGL=0), ASLB/ROLA twice, then X video byte.
    return (((x16 << 2) & 0xff00) | (y16 >>> 8)) & 0xffff;
}
function countSprite(video, xByte, y, columns, rows) {
    let n = 0;
    for (let x = 0; x < columns; x++)
        for (let k = 0; k < rows; k++)
            if (video.read8(((((xByte + x) & 255) << 8) | ((y + k) & 255)) & 0xffff))
                n++;
    return n;
}
test('LOGO0 never increases the source drawing rate halfway through its first LGOTAB pass', () => {
    const a = createAmode1Attract();
    let previous = 0;
    for (let i = 0; i < 400; i++) {
        const s = a.STEP();
        if (s.logoPasses === 0) {
            assert.equal(s.logoRate, 3, 'LGOFLG=3 must survive the ENTIRE first traversal');
            assert.ok(s.logoIndex >= previous, 'LGOPTR cannot jump backwards during first traversal');
            previous = s.logoIndex;
        }
        else {
            assert.equal(s.logoPasses, 1);
            assert.equal(s.logoRate, 10, 'LOGO10 switches to 10 only AFTER the QUIT control byte');
            assert.equal(s.step, 'PRES', 'source spawns PRES at its first complete Williams tracing');
            assert.ok(i + 1 > 180, 'never speed up at an arbitrary early elapsed-tick threshold');
            break;
        }
        if (i === 399)
            assert.fail('first Williams logo tracing never ended');
    }
});
test('LEDRET draws original ship and lander at the OPON fourfold world-to-video positions', () => {
    const a = createAmode1Attract();
    reach(a, s => s.page === 'instructions' && s.tick >= 8);
    // World X=$0800 => 32 video byte-columns, not 8; world $1DA0 => 118, not 29.
    assert.equal(sourceAddr(0x0800, 0x5000), 0x2050);
    assert.equal(sourceAddr(0x1da0, 0x4000), 0x7640);
    assert.ok(countSprite(a.video, 0x20, 0x50, 8, 6) > 6, 'source player bitmaps land at projected position');
    const lander = a.STATE().objects.find(o => o.picture === 'LNDP1');
    assert.equal(lander.appearing, true, 'LEDRET invokes source APVCT for Lander before whole sprite appears');
    assert.equal(a.ram.read16(0x9c00), 0xa700, 'the original SAMEX negative appearance RSIZE counts down from $AF00');
    assert.equal(countSprite(a.video, 0x1d, 0x45, 5, 8), 0, 'no leftover unscaled Lander at left edge');
});
test('AMOD11 original six-enemy positions align with their source TEXTAB caption columns', () => {
    const a = createAmode1Attract();
    reach(a, s => s.page === 'instructions' && s.step === 'AMOD13');
    assert.equal(a.STATE().objectIndex, 6);
    const expectedX = [0x24, 0x44, 0x66, 0x25, 0x45, 0x67];
    for (let i = 0; i < AMODE_ENEMIES.length; i++) {
        const e = AMODE_ENEMIES[i];
        const display = sourceAddr(e.x, e.y);
        assert.equal(display >>> 8, expectedX[i], e.name + ' uses original 2x shift, not OX16>>>8');
        const h = e.picture === 'SWPIC1' ? 4 : 8, w = e.picture === 'SWPIC1' ? 3 : e.picture === 'UFOP1' ? 6 : e.picture === 'TIEP1' || e.picture === 'PRBP1' ? 4 : 5;
        assert.ok(countSprite(a.video, display >>> 8, display & 255, w, h) > 0, e.name + ' must be visible in game VIDEO RAM above its title, not bunched at the left');
    }
});
test('LASRS advances source PD head by four byte-columns per update, not a growing static bar', () => {
    const a = createAmode1Attract();
    const { state } = reach(a, s => s.step === 'AMODE2' && s.laser?.frames === 1);
    const first = state.laser;
    const ship = state.objects.find(o => o.picture === 'PLAPIC');
    const start = (sourceAddr(ship.x16, ship.y16) + 0x704) & 0xffff;
    assert.equal(first.head, (start + 0x400) & 0xffff, 'four $11 bytes plus $99 head at source PD');
    assert.equal(first.tail, (start + 0x300) & 0xffff, 'three FISTAB bytes update source PD+2');
    assert.equal(first.clear, (start + 0x100) & 0xffff, 'one column clears from LSTATE per frame');
    assert.equal(a.video.read8(first.head), 0x99, 'source $99 tip is actually in VIDEO RAM');
    a.STEP();
    const next = a.STATE().laser;
    assert.equal(next.head, (first.head + 0x400) & 0xffff);
    assert.equal(next.tail, (first.tail + 0x300) & 0xffff);
    assert.equal(next.clear, (first.clear + 0x100) & 0xffff);
    assert.equal(a.video.read8(next.head), 0x99, 'tip advances, not a synthetic random-length ray');
});
test('KLASUB clears source laser video bytes at the end of the scripted enemy shot', () => {
    const a = createAmode1Attract();
    reach(a, s => s.step === 'AMOD10' && s.laser?.frames === 6);
    const head = a.STATE().laser.head, y = head & 255;
    reach(a, s => s.step === 'BMODE2');
    assert.equal(a.STATE().laser, null, 'source beam process has been stopped');
    // This particular portion is well away from the enemy caption and terrain.
    assert.equal(a.video.read8(head), 0, 'final laser tip must be removed after KLASUB');
});
