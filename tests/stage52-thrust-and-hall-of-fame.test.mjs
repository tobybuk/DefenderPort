import test from 'node:test';
import assert from 'node:assert/strict';
import { createAmode1Attract } from '../original/amode1-attract.js';
import { createAmode1HallOfFame, decodePackedScore, hallInsert } from '../original/amode1-hall-of-fame.js';
import { DEFAULT_HALL_OF_FAME } from '../original/amode1-presentation-data.js';
import { SoundBoard, FNOISE_ADDB_ADCA, FNOISE_SUBB_SBCA } from '../original/VSNDRM1-synth.js';
import { PHR6_LAYOUT } from '../runtime/phr6-layout.js';

function hallHarness(onQualify = () => {}, onFinish = () => {}) {
    const a = createAmode1Attract();
    const h = createAmode1HallOfFame({
        writeText: a.WTEXTB, video: a.video, ram: a.ram,
        paletteAddr: PHR6_LAYOUT.at('PCRAM'),
        onQualify, onFinish
    });
    return { a, h };
}

test('approved FNOISE high-byte ADCA carry and SBCA borrow match 6808 flag semantics', () => {
    assert.deepEqual(FNOISE_ADDB_ADCA(0xfe, 0xfe, 1, 2), { A: 0, B: 0, carry: true });
    assert.deepEqual(FNOISE_ADDB_ADCA(0xfe, 0, 1, 0), { A: 0xff, B: 0, carry: false });
    assert.deepEqual(FNOISE_SUBB_SBCA(0, 0, 1, 1), { A: 0xfe, B: 0xff, carry: true });
    assert.deepEqual(FNOISE_SUBB_SBCA(2, 1, 1, 1), { A: 1, B: 0, carry: false });
});

test('approved THRUST FNOISE does not collapse into repeated ramp after 1.2 seconds', () => {
    const board = new SoundBoard({ sampleRate: 44100 });
    board.command(0x16);
    const samples = board.render(new Float32Array(Math.round(3.2 * 44100)));
    assert.ok(board.stats.highCarries > 0, 'up-ramp overflow terminates as source BCS');
    assert.ok(board.stats.highBorrows > 0, 'down-ramp underflow terminates as source BCS');
    const sample = (start) => [...samples.slice(Math.floor(start*44100), Math.floor((start+0.15)*44100))];
    // Both later windows should contain plenty of distinct values, not a constant or a repeating ramp.
    for (const start of [1.5, 2.6]) {
        const reduced = new Set(sample(start).filter((_,i) => i%50 === 0).map(n => n.toFixed(3)));
        assert.ok(reduced.size > 8, `filtered noise must retain variation at ${start}s`);
    }
});

test('packed-BCD P1SCR high-score extraction respects original three-byte CPXCY offset', () => {
    assert.equal(decodePackedScore([0, 0x02, 0x12, 0x70]), 21270);
    assert.equal(decodePackedScore([0, 0, 0, 0x10]), 10);
    assert.throws(() => decodePackedScore([0, 0, 0, 0x1a]));
});

test('HALL1 qualifies above eighth place but not equal, and chooses PHANTOM or TOCCATA', () => {
    const cues = [];
    const { h } = hallHarness(command => cues.push(command));
    assert.equal(h.HALLOF(6010), false, 'tie does not qualify');
    assert.equal(h.STATE().phase, 'no-entry');
    assert.equal(h.HALLOF(6011), true);
    assert.equal(cues.at(-1), 0x3e, 'regular qualifying score plays PHANTOM');
    assert.equal(h.HALLOF(30000), true);
    assert.equal(cues.at(-1), 0x3d, 'new first place plays TOCCATA');
});

test('HOFUD source space/A..Z wrapping and active underline, HOFBL palette blink', () => {
    const { a, h } = hallHarness();
    h.HALLOF(7000);
    const before = a.ram.read8(0xc00d);
    for (let i=0;i<4;i++) h.STEP({up:false,down:true,fire:false});
    assert.equal(h.STATE().initials, '   ', 'down from original A reaches the source $40 blank');
    h.STEP({});
    for (let i=0;i<4;i++) h.STEP({down:true});
    assert.equal(h.STATE().initials, 'Z  ', 'down from source blank wraps to Z through $3F');
    for (let i=0;i<15;i++) h.STEP({up:false,down:false,fire:false});
    assert.notEqual(a.ram.read8(0xc00d), before, 'HOFBL toggles palette entry $D every 15 ticks');
    assert.equal(a.video.read8(0x45b7) !== 0, true, 'HOFUL writes source underline address');
});

test('HALL4 requires five FIRE-open ticks; three confirms insert score into both rankings', () => {
    let stored;
    const { h } = hallHarness(() => {}, tables => { stored=tables; });
    h.HALLOF(22000);
    h.STEP({fire:true});
    assert.equal(h.STATE().active, 0, 'press before debounce must not enter an initial');
    for (let i=0;i<5;i++) h.STEP({fire:false});
    h.STEP({fire:true});
    assert.equal(h.STATE().active, 1);
    for (let col=1;col<3;col++) {
        for(let i=0;i<5;i++) h.STEP({fire:false});
        h.STEP({fire:true});
    }
    assert.equal(h.STATE().phase, 'finished');
    assert.equal(stored.today[0].score, 22000);
    assert.equal(stored.today[0].initials, 'A  ', 'initials are one A plus two original $40 spaces');
    assert.deepEqual(stored.allTime[0], stored.today[0]);
    assert.equal(stored.today.length, 8);
});

test('HOFST first initial 40 seconds, subsequent initial 20 seconds', () => {
    const { h } = hallHarness();
    h.HALLOF(7000);
    for(let i=0;i<60;i++) h.STEP({fire:false});
    assert.equal(h.STATE().stall, 39);
    for(let i=0;i<5;i++) h.STEP({fire:false});
    h.STEP({fire:true});
    assert.equal(h.STATE().stall, 20);
    for(let i=0;i<60;i++) h.STEP({fire:false});
    assert.equal(h.STATE().stall, 19);
});

test('HOFAS moves all eight original CMOS records without modifying source default factory data', () => {
    const inserted = hallInsert(DEFAULT_HALL_OF_FAME, {score:15000,initials:'ABC'});
    assert.equal(inserted.length, 8);
    assert.equal(inserted[3].score, 15000);
    assert.deepEqual(inserted[3], {score:15000,initials:'ABC'});
    assert.equal(inserted.at(-1).score, 8265);
    assert.equal(DEFAULT_HALL_OF_FAME.at(-1).score, 6010);
});

test('HALLOF timeout enters current initials and commits source tables', () => {
    let saved;
    const { h } = hallHarness(() => {}, tables => { saved=tables; });
    h.HALLOF(7000);
    for (let i=0; i<40*60;i++) h.STEP({});
    assert.equal(h.STATE().phase, 'finished');
    assert.equal(saved.today.findIndex(x => x.score===7000) >= 0,true);
});
