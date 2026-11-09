import test from 'node:test';
import assert from 'node:assert/strict';
import { VideoMemory } from '../runtime/video-memory.js';
import { RAM } from '../runtime/ram.js';
import { PHR6_LAYOUT as L } from '../runtime/phr6-layout.js';
import { createDefa7TopDisplayRoutines, TOP_DISPLAY_EQU } from '../original/defa7-top-display.js';
import { createDefa7SoundRoutines, soundTableFixture, SOURCE_SOUND_TABLES } from '../original/defa7-sound.js';
import { createFlightHarness } from '../demo/flight-harness.js';
import { createDefa7PlayerIndexRoutines } from '../original/defa7-player-index.js';
const fixture = () => {
    const RAM0 = new RAM(), src = soundTableFixture(), bus = [];
    const S = createDefa7SoundRoutines(RAM0, L, { readSourceByte: src.read8, onBusWrite: b => bus.push(b) });
    const get8 = n => RAM0.read8(L.at(n)), get16 = n => RAM0.read16(L.at(n));
    const set8 = (n, v) => RAM0.write8(L.at(n), v);
    return { RAM0, src, bus, S, get8, get16, set8 };
};
test('PHR6 original SCANH and SCANER equates, not UI-derived dimensions', () => {
    assert.equal(TOP_DISPLAY_EQU.SCANH, 8);
    assert.equal(TOP_DISPLAY_EQU.SCANER, 0x3008);
});
test('BORDER BORDLP copies $5555 across source bottom border, with exact exclusive end', () => {
    const v = new VideoMemory();
    createDefa7TopDisplayRoutines(v).BORDER();
    for (let x = 0x28; x < 0x9c00; x += 0x100) {
        const finalColour = x >= 0x4c28 && x < 0x5428 ? 0x99 : 0x55; // BORD3 overwrites BORDLP
        assert.equal(v.read8(x), finalColour);
        assert.equal(v.read8(x + 1), finalColour);
    }
    assert.equal(v.read8(0x9c28), 0);
    assert.equal(v.read8(0x27), 0);
});
test('BORDER BORD1, BORD2, BORD3 write original bezel and centre-marker addresses', () => {
    const v = new VideoMemory();
    createDefa7TopDisplayRoutines(v).BORDER();
    for (let x = 0x2f08; x < 0x2f28; x += 2) {
        for (const loc of [x, x + 0x4100]) {
            assert.equal(v.read8(loc), 0x55);
            assert.equal(v.read8(loc + 1), 0x55);
        }
    }
    for (let x = 0x2f07; x < 0x7107; x += 0x100)
        assert.equal(v.read8(x), x >= 0x4c07 && x < 0x5407 ? 0x99 : 0x55);
    for (let x = 0x4c07; x < 0x5407; x += 0x100)
        assert.deepEqual([v.read8(x), v.read8(x + 1), v.read8(x + 0x21), v.read8(x + 0x22)], [0x99, 0x99, 0x99, 0x99]);
    assert.equal(v.read8(0x5407), 0x55);
});
test('Every copied sound table follows the original priority/repeat/timer/command groups', () => {
    assert.equal(Object.keys(SOURCE_SOUND_TABLES).length, 26);
    for (const [name, bytes] of Object.entries(SOURCE_SOUND_TABLES)) {
        assert.equal(bytes[bytes.length - 1], 0, `${name} terminator`);
        assert.equal((bytes.length - 2) % 3, 0, `${name} triple alignment`);
        assert.ok(bytes[0] >= 0xc0, `${name} priority`);
        for (let i = 1; i < bytes.length - 1; i += 3) {
            assert.ok(bytes[i] >= 1, `${name} repeat`);
            assert.ok(bytes[i + 1] > 0, `${name} delay`);
        }
    }
    assert.deepEqual(SOURCE_SOUND_TABLES.LASSND, [0xc0, 1, 0x30, 0x14, 0]);
    assert.deepEqual(SOURCE_SOUND_TABLES.PDSND, [0xf0, 2, 8, 0x11, 1, 0x20, 0x17, 0]);
});
test('SNDOUT produces original two Williams PIA writes: 3F then complement masked to 3F', () => {
    const { S, bus, RAM0 } = fixture();
    RAM0.write8(L.at('MAPC'), 7);
    assert.equal(S.SNDOUT(0x14), 0x2b);
    assert.equal(RAM0.read8(L.at('MAPC')), 0);
    assert.equal(RAM0.read8(0xcc02), 0x2b);
    assert.deepEqual(bus, [0x3f, 0x2b]);
    assert.equal(S.SNDOUT(0xff), 0);
    assert.deepEqual(bus.slice(-2), [0x3f, 0]);
});
test('SNDLD stores source pointer minus 2, priority and 01:01 timer/rep in PHR6 RAM', () => {
    const e = fixture();
    e.set8('THFLG', 0x16);
    assert.equal(e.S.SNDLD(e.src.labels.LASSND), true);
    assert.equal(e.get8('THFLG'), 0);
    assert.equal(e.get16('SNDX'), e.src.labels.LASSND - 2);
    assert.equal(e.get8('SNDPRI'), 0xc0);
    assert.equal(e.get16('SNDTMR'), 0x0101);
    assert.deepEqual(e.bus, []);
});
test('Sound priority: lower ignored, equality interrupts, and rejected SNDLD still clears THFLG', () => {
    const e = fixture();
    e.S.SNDLD(e.src.labels.PDSND);
    e.set8('THFLG', 0x16);
    assert.equal(e.S.SNDLD(e.src.labels.LASSND), false);
    assert.equal(e.get8('THFLG'), 0);
    assert.equal(e.get8('SNDPRI'), 0xf0);
    assert.equal(e.get16('SNDX'), e.src.labels.PDSND - 2);
    assert.equal(e.S.SNDLD(e.src.labels.ST1SND), true);
    assert.equal(e.get16('SNDX'), e.src.labels.ST1SND - 2);
});
test('SNDSEQ plays original laser command, holds for exactly source delay, terminates and clears priority', () => {
    const e = fixture();
    e.S.SNDLD(e.src.labels.LASSND);
    e.S.SNDSEQ();
    assert.equal(e.get8('SNDTMR'), 0x30);
    assert.equal(e.get8('SNDREP'), 1);
    assert.deepEqual(e.bus, [0x3f, 0x2b]); // 0x14 complemented, low 6 bits
    for (let i = 0; i < 0x30 - 1; i++)
        e.S.SNDSEQ();
    assert.equal(e.bus.length, 2);
    e.S.SNDSEQ();
    assert.equal(e.get8('SNDPRI'), 0);
    assert.equal(e.get8('SNDTMR'), 0);
    assert.deepEqual(e.bus, [0x3f, 0x2b]);
});
test('SNDSEQ repeated sound consumes original repeat counter before next triple', () => {
    const e = fixture();
    e.S.SNDLD(e.src.labels.SBSND);
    e.S.SNDSEQ();
    assert.equal(e.get8('SNDREP'), 6);
    assert.equal(e.get8('SNDTMR'), 4);
    assert.deepEqual(e.bus.slice(-2), [0x3f, (~0x11) & 63]);
    for (let i = 0; i < 4 * 6; i++)
        e.S.SNDSEQ();
    assert.equal(e.get8('SNDREP'), 1);
    assert.equal(e.get8('SNDTMR'), 0x10);
    assert.deepEqual(e.bus.slice(-2), [0x3f, (~0x17) & 63]);
    assert.equal(e.bus.length, 14);
});
test('SNDSEQ original thrust sound starts and stops from PIA21/STATUS, only when no table is active', () => {
    const e = fixture();
    e.set8('PIA21', 2);
    e.S.SNDSEQ();
    assert.equal(e.get8('THFLG'), 0x16);
    assert.deepEqual(e.bus, [0x3f, (~0x16) & 63]);
    e.S.SNDSEQ();
    assert.equal(e.bus.length, 2);
    e.set8('PIA21', 0);
    e.S.SNDSEQ();
    assert.equal(e.get8('THFLG'), 0);
    assert.deepEqual(e.bus.slice(-2), [0x3f, (~0x0f) & 63]);
    e.set8('STATUS', 0x08);
    e.set8('PIA21', 2);
    e.S.SNDSEQ();
    assert.equal(e.bus.length, 4);
});
test('Real Stage 5 runnable diagnostic contains original BORDER writes and records source sound commands', () => {
    const h = createFlightHarness();
    assert.equal(h.video.read8(0x4c07), 0x99);
    assert.equal(h.video.read8(0x3028), 0x55);
    // Stage 25 source appearance sound has higher priority than LASER at boot.
    assert.equal(h.TRIGGER_SOUND('LASSND'), false, 'source sound priority blocks lower-priority laser');
    h.ram.write8(L.at('SNDPRI'), 0);
    assert.equal(h.TRIGGER_SOUND('LASSND'), true);
    h.INPUT();
    h.STEP();
    assert.deepEqual(h.STATE().soundBus, [0x3f, 0x2b]);
    assert.equal(h.STATE().sndtmr, 48);
    assert.throws(() => h.TRIGGER_SOUND('made-up'), /Unknown original sound/);
});
test('PLINDX and PLDX faithfully select source player data record by CURPLR byte', () => {
    const ram = new RAM(), r = createDefa7PlayerIndexRoutines(ram, L);
    assert.equal(r.PLINDX.name, 'PLINDX');
    assert.equal(r.PLDX.name, 'PLDX');
    ram.write8(L.at('CURPLR'), 1);
    assert.equal(r.PLINDX(), L.at('PLDATA'));
    assert.equal(r.PLDX(), L.at('P1SCR'));
    for (const value of [0, 2, 3, 255]) {
        ram.write8(L.at('CURPLR'), value);
        assert.equal(r.PLINDX(), L.at('P2SCR'));
        assert.equal(r.PLDX(), L.at('P2SCR'));
    }
});
