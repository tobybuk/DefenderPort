/**
 * Stage 32: original DEFA7.SRC BONUS/BCLP/BC1/BC2/BC3, 1785-1844.
 * MESS0.SRC original ATWV/COMPV/BONSX text and source FDB glyphs.
 * Tests inspect RAM/ROMF8-rendered video, never a generated Canvas overlay.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFlightHarness } from '../demo/flight-harness.js';
import { BONUS_GLYPH_RELOC } from '../original/defender-bonus-font.js';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
const game = () => createFlightHarness({ infiniteSmartBombs: true, sourceCabinetInput: true, playerCollisions: false });
const at = (h, n) => h.Layout.at(n);
const counts = ['LNDCNT', 'LNDRES', 'TIECNT', 'PRBCNT', 'SWCNT', 'SCZCNT', 'SCZRES'];
const clearEnemies = h => {
    for (const name of counts)
        h.ram.write8(at(h, name), 0);
};
const run = (h, n) => {
    for (let i = 0; i < n; i++)
        h.STEP();
};
const until = (h, predicate, maximum = 280) => {
    for (let i = 0; i < maximum && !predicate(); i++)
        h.STEP();
    assert.ok(predicate(), 'expected source state within ' + maximum + ' IRQ updates');
};
const decimalScore = h => h.STATE().scoreBCD.reduce((sum, byte) => sum * 100 + ((byte >>> 4) * 10 + (byte & 15)), 0);
test('source BONUS glyph descriptors contain original MESS0 FDB bytes and survive RESET', () => {
    const h = game(), R = h.ram;
    const A = BONUS_GLYPH_RELOC.DESCRIPTORS;
    assert.equal(R.read8(A), 3, 'original A letter is 3 byte-columns wide');
    assert.equal(R.read8(A + 1), 8, 'MESS0 glyphs are eight rows high');
    assert.equal(R.read16(R.read16(A + 2)), 0x0101, 'original LETTRA first FDB');
    const ash = BONUS_GLYPH_RELOC.ASTP3;
    assert.equal(R.read8(ash), 2);
    assert.equal(R.read8(ash + 1), 8);
    assert.equal(R.read16(R.read16(ash + 2)), 0x0303, 'original ASTP3 first FDB');
    h.RESET();
    assert.equal(R.read16(R.read16(A + 2)), 0x0101);
});
test('wave-one BONUS is visibly drawn in original video RAM and awards 100 per surviving astronaut every 4 ticks', () => {
    const h = game();
    clearEnemies(h);
    until(h, () => h.STATE().bonus !== null);
    const first = h.STATE().bonus;
    assert.equal(first.wave, 1);
    assert.equal(first.multiplier, 1);
    assert.equal(first.survivors, 10);
    assert.equal(first.awards, 1);
    assert.equal(decimalScore(h), 100, 'first survivor is counted when BONUS begins');
    assert.equal((h.video.read8(0x3850) << 8) | h.video.read8(0x3851), 0x0101, 'source MESS0 A written at $3850');
    assert.equal(h.video.read8(0x3ca0), 0x03, 'ASTP3 bitmap source column at bonus first slot');
    run(h, 3);
    assert.equal(decimalScore(h), 100, 'BC1 has not run before the 4th frame');
    run(h, 1);
    assert.equal(decimalScore(h), 200, 'BC1 adds second 100-point award after four ticks');
    assert.equal(h.video.read8(0x40a0), 0x03, 'the next source astronaut bitmap appears at X+$400');
    until(h, () => h.STATE().bonus?.phase === 'hold');
    assert.equal(h.STATE().bonus.awards, 10);
    assert.equal(decimalScore(h), 1000, 'ten source 100-point awards');
    assert.equal(h.STATE().bonus.remainingTicks, 128, 'exact original NAP $80,BC3 wait');
    assert.equal(h.WAVE_STATE().wave, 2, 'original GETWV occurs after last bonus, before wait');
    run(h, 127);
    assert.equal(h.STATE().bonus?.phase, 'hold', 'next wave must not begin a tick too soon');
    run(h, 1);
    assert.equal(h.STATE().bonus, null);
    assert.equal(h.WAVE_STATE().wave, 2);
    assert.equal(h.WAVE_STATE().landerCount, 5);
    assert.equal(h.ram.read8(at(h, 'TIECNT')), 3);
    assert.equal(h.ram.read8(at(h, 'PRBCNT')), 1);
    assert.equal(decimalScore(h), 1000, 'reset to wave two preserves source packed BCD');
    assert.equal(h.STATE().smartBombs, Infinity);
});
test('zero survivors gives no bonus awards or bogus astronaut artwork; source hold remains 128 ticks', () => {
    const h = game();
    h.ram.write8(at(h, 'ASTCNT'), 0);
    clearEnemies(h);
    until(h, () => h.STATE().bonus !== null);
    const tally = h.STATE().bonus;
    assert.equal(tally.survivors, 0);
    assert.equal(tally.awards, 0);
    assert.equal(tally.phase, 'hold');
    assert.equal(tally.remainingTicks, 128);
    assert.equal(decimalScore(h), 0);
    assert.equal(h.video.read8(0x3ca0), 0);
    run(h, 128);
    assert.equal(h.STATE().bonus, null);
    assert.equal(decimalScore(h), 0);
});
test('source BONUS multiplication caps at x5 after wave five', () => {
    const h = game();
    h.ram.write8(at(h, 'P1WAV'), 6);
    clearEnemies(h);
    until(h, () => h.STATE().bonus !== null);
    assert.equal(h.STATE().bonus.multiplier, 5);
    assert.equal(decimalScore(h), 500);
    until(h, () => h.STATE().bonus?.phase === 'hold');
    assert.equal(decimalScore(h), 5000, '10 survivors times original capped wave-six 500-point reward');
});
test('real source gameplay after bonus preserves original player movement, laser collision, and scanner scheduler', () => {
    const h = game();
    clearEnemies(h);
    until(h, () => h.WAVE_STATE().wave === 2 && h.STATE().bonus === null, 300);
    const x = h.STATE().plax16;
    h.INPUT({ thrust: true, up: true });
    run(h, 16);
    h.INPUT({});
    assert.notEqual(h.STATE().plax16, x, 'source PLAYER fixed-point thruster continues after bonus transition');
    assert.equal(h.FIRE(), true);
    run(h, 2);
    assert.ok(h.STATE().laserShots >= 1);
    assert.equal(h.STATE().infiniteSmartBombs, true);
    assert.ok(h.STATE().scannerRedraws > 0, 'source scanner restarted with next wave');
});
test('standalone contains source bonus process, native MESS0 glyphs and remains syntactically valid', () => {
    const html = readFileSync(new URL('../play.html', import.meta.url), 'utf8');
    const source = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
    assert.ok(source);
    for (const label of ['function createDefa7BonusRoutines', 'function installBonusSourceFont', 'function BC1', 'function BC2', 'function BC3'])
        assert.ok(source.includes(label), label);
    assert.doesNotThrow(() => new Script(source));
});
test('five successive source wave-tallies accumulate 1000, 2000, 3000, 4000 and 5000 in the real BCD score', () => {
    const h = game();
    let total = 0;
    for (let finished = 1; finished <= 5; finished++) {
        clearEnemies(h);
        until(h, () => h.STATE().bonus !== null);
        assert.equal(h.STATE().bonus.wave, finished);
        assert.equal(h.STATE().bonus.multiplier, finished);
        const scoreBefore = total;
        assert.equal(decimalScore(h), scoreBefore + 100 * finished, 'first live award arrives with BONUS');
        until(h, () => h.STATE().bonus === null, 290);
        total += 1000 * finished;
        assert.equal(decimalScore(h), total, `wave ${finished} correctly totalled in packed BCD`);
        assert.equal(h.WAVE_STATE().wave, finished + 1);
        assert.equal(h.STATE().infiniteSmartBombs, true);
    }
    assert.equal(total, 15000);
});
test('no-survivor bonuses do not resurrect the planet until the original wave-five renewal', () => {
    const h = game();
    h.ram.write8(at(h, 'ASTCNT'), 0);
    for (let finished = 1; finished <= 4; finished++) {
        clearEnemies(h);
        until(h, () => h.STATE().bonus !== null);
        assert.equal(h.STATE().bonus.survivors, 0);
        until(h, () => h.STATE().bonus === null, 160);
        assert.equal(decimalScore(h), 0, 'destroyed planet must never award astronaut bonuses');
        assert.equal(h.WAVE_STATE().wave, finished + 1);
        if (finished < 4) {
            assert.equal(h.ASTRONAUT_STATE().count, 0);
            assert.equal(h.STATE().status & 2, 2, 'destroyed world must remain absent');
        }
        else {
            assert.equal(h.ASTRONAUT_STATE().count, 10, 'every fifth wave restores population');
            assert.equal(h.STATE().status & 2, 0, 'fifth-wave restoration is the only exception');
        }
    }
});
