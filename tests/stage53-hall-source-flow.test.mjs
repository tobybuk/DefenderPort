import test from 'node:test';
import assert from 'node:assert/strict';
import { createAmode1Attract } from '../original/amode1-attract.js';
import { createAmode1HallOfFame } from '../original/amode1-hall-of-fame.js';
import { PHR6_LAYOUT } from '../runtime/phr6-layout.js';
import { readFileSync } from 'node:fs';

function setup() {
    const attract = createAmode1Attract();
    const events = [];
    const hall = createAmode1HallOfFame({
        writeText: attract.WTEXTB, video: attract.video, ram: attract.ram,
        paletteAddr: PHR6_LAYOUT.at('PCRAM'),
        onQualify: cmd => events.push(['music', cmd]),
        onFinish: tables => events.push(['completed', tables])
    });
    return { hall, attract, events };
}
function completeThree(hall) {
    for (let initial = 0; initial < 3; initial++) {
        for (let tick = 0; tick < 5; tick++) hall.STEP({ fire: false });
        hall.STEP({ fire: true });
    }
}
test('HALL6 -> HALL12 -> HALL13: single-player score enters initials once only', () => {
    const { hall, events } = setup();
    assert.equal(hall.HALLOF(31000, 0), true);
    assert.equal(hall.STATE().player, 1);
    completeThree(hall);
    assert.equal(hall.STATE().phase, 'finished');
    assert.equal(hall.STATE().player, 2, 'the original checks cleared P2SCR, without displaying its entry screen');
    assert.equal(hall.STATE().entryMade, true);
    assert.equal(events.filter(e => e[0] === 'music').length, 1);
    assert.equal(events.filter(e => e[0] === 'completed').length, 1);
    assert.equal(hall.STATE().today.filter(r => r.score === 31000).length, 1);
    for (let tick = 0; tick < 100; tick++) hall.STEP({ fire: true });
    assert.equal(events.length, 2, 'holding FIRE cannot initiate a second entry or call HALLOF');
});
test('HALL12 checks second player independently; P2 entry only when it actually qualifies', () => {
    const { hall, events } = setup();
    assert.equal(hall.HALLOF(31000, 25000), true);
    completeThree(hall);
    assert.equal(hall.STATE().phase, 'entering');
    assert.equal(hall.STATE().player, 2);
    assert.equal(hall.STATE().score, 25000);
    completeThree(hall);
    assert.equal(hall.STATE().phase, 'finished');
    assert.deepEqual(events.filter(e => e[0] === 'music').map(e => e[1]), [0x3d, 0x3e]);
    assert.equal(events.filter(e => e[0] === 'completed').length, 1);
    assert.deepEqual(hall.STATE().today.slice(0,2).map(r => r.score), [31000,25000]);
});
test('P1 not qualifying never gets entry; qualified P2 may still enter once', () => {
    const { hall, events } = setup();
    assert.equal(hall.HALLOF(100, 15000), true);
    assert.equal(hall.STATE().player, 2);
    completeThree(hall);
    assert.equal(hall.STATE().phase, 'finished');
    assert.equal(events.filter(e => e[0] === 'completed').length, 1);
});
test('HALL12 no-entry waits $FF source ticks only if neither player qualified', () => {
    const { hall, events } = setup();
    assert.equal(hall.HALLOF(100, 0), false);
    assert.equal(hall.STATE().phase, 'no-entry');
    for (let n=0;n<254;n++) hall.STEP({});
    assert.equal(hall.STATE().phase, 'no-entry');
    hall.STEP({});
    assert.equal(hall.STATE().phase, 'finished');
    assert.equal(events.filter(e => e[0] === 'completed').length, 1);
});
test('HALL12 allows equal-score Player 2 if above eighth place (original qualification rule)', () => {
    const { hall } = setup();
    hall.HALLOF(31000, 31000);
    completeThree(hall);
    assert.equal(hall.STATE().phase, 'entering', 'P2 also qualifies against eighth place, despite tying P1');
    assert.equal(hall.STATE().player, 2);
    completeThree(hall);
    assert.equal(hall.STATE().phase, 'finished');
    assert.equal(hall.STATE().today.filter(r => r.score === 31000).length, 2);
});
test('browser HALL13 reaches HALDIS once then LEDRET after original 60 x 10 ticks', () => {
    const source = readFileSync(new URL('../browser/flight.js', import.meta.url), 'utf8');
    assert.match(source, /const HALL_DISPLAY_TICKS = 60 \* 10/);
    assert.match(source, /attract\.HALDIS\(\);[^]*?hallDisplayTicks = HALL_DISPLAY_TICKS/);
    assert.match(source, /if \(--hallDisplayTicks <= 0\) \{\s*attract\.LEDRET\(\)/);
    assert.match(source, /!e\.repeat && startEnterReleased/,
        'a repeating FIRE/Enter press must not be mistaken for another game start');
});
