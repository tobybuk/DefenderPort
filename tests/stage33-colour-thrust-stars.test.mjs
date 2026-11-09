/**
 * Stage 33 regression tests: unstarted original background colour tasks,
 * animated thrust pointer, bomb-pattern switch, and source star blink.
 * References: DEFA7.SRC 2158-2198, 2202-2259, 3278-3292 and
 * DEFB6.SRC 1192-1227, 2073-2076 (pinned e740063).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { RAM } from '../runtime/ram.js';
import { PHR6_LAYOUT as L } from '../runtime/phr6-layout.js';
import { createFlightHarness } from '../demo/flight-harness.js';
import { createDefb6ColourProcesses, installBombColourSourceData, TCTAB, BOMB_RELOC, BOMB_SOURCE_BYTES } from '../original/defb6-colour-processes.js';
import { COLTAB } from '../original/defa7-process-tasks.js';
import { createDefa7ShellRoutines } from '../original/defa7-shells.js';
import { VideoMemory } from '../runtime/video-memory.js';
import { defenderDacRGB } from '../browser/defender-palette.js';
const a = n => L.at(n);
const step = (h, n) => {
    for (let i = 0; i < n; i++)
        h.STEP();
};
function f() {
    const R = new RAM(), calls = [], proc = 0x5000;
    R.write16(a('CRPROC'), proc);
    installBombColourSourceData(R);
    const addresses = { TIECL: 0xf020, CBMB1: 0xf022, CBOMB: 0xf024 };
    const scheduler = { SLEEP: (ticks, address) => {
            calls.push({ ticks, address });
            return { kind: 'sleep', ticks, address };
        } };
    const source = createDefb6ColourProcesses(R, L, scheduler, addresses);
    return { R, calls, proc, source, addresses };
}
test('source TCTAB matches original Tie/Bomber triple colour cycle', () => {
    assert.deepEqual([...TCTAB], [0x81, 0x81, 0x2f, 0x81, 0x2f, 0x07, 0x2f, 0x81, 0x07]);
    const { R, proc, source, calls } = f();
    source.TIECOL();
    assert.equal(R.read16(proc + a('PD')), BOMB_RELOC.TCTAB);
    for (let n = 0; n < 3; n++) {
        source.TIECL();
        assert.deepEqual([...R.snapshot(a('PCRAM') + 13, a('PCRAM') + 16)], [...TCTAB.slice(n * 3, n * 3 + 3)]);
    }
    assert.equal(R.read16(proc + a('PD')), BOMB_RELOC.TCTAB, 'source final BRA TIECOL resets the table');
    assert.deepEqual(calls.map(x => x.ticks), [6, 6, 6, 6]);
});
test('original CBOMB colour flashes and picture pointers alternate on 3+6 tick source sleeps', () => {
    const { R, source, calls, addresses } = f();
    source.CBOMB();
    assert.equal(R.read8(a('PCRAM') + 10), 0xff);
    assert.equal(R.read8(a('PCRAM') + 12), 0);
    R.write8(a('SEED'), 0x1c);
    source.CBMB1();
    assert.equal(R.read8(a('PCRAM') + 10), COLTAB[0x1c]);
    assert.equal(R.read8(a('PCRAM') + 12), COLTAB[0x1c]);
    assert.equal(R.read16(a('BAX')), BOMB_RELOC.BMBD10);
    source.CBOMB();
    source.CBMB1();
    assert.equal(R.read16(a('BAX')), BOMB_RELOC.BMBD20);
    source.CBOMB();
    source.CBMB1();
    assert.equal(R.read16(a('BAX')), BOMB_RELOC.BMBD10);
    assert.deepEqual(calls.map(x => [x.ticks, x.address]), [[3, addresses.CBMB1], [6, addresses.CBOMB], [3, addresses.CBMB1], [6, addresses.CBOMB], [3, addresses.CBMB1], [6, addresses.CBOMB]]);
});
test('original bomb graphic phase bytes are installed for BMBOUT', () => {
    const { R } = f(), V = new VideoMemory();
    assert.deepEqual([...R.snapshot(BOMB_RELOC.BMBD10, BOMB_RELOC.BMBD10 + 12)], [...BOMB_SOURCE_BYTES.BMBD10]);
    assert.deepEqual([...R.snapshot(BOMB_RELOC.BMBD20, BOMB_RELOC.BMBD20 + 12)], [...BOMB_SOURCE_BYTES.BMBD20]);
    const source = createDefa7ShellRoutines(R, L, V);
    const X = 0x5000, dest = 0x550c;
    R.write16(X + a('OBJX'), dest);
    R.write16(a('BAX'), BOMB_RELOC.BMBD10);
    R.write16(X + a('OX16'), 0x0000);
    source.BMBOUT(X, 0x440c);
    assert.deepEqual([V.read8(dest), V.read8(dest + 1), V.read8(dest + 2), V.read8(dest + 0x100), V.read8(dest + 0x101), V.read8(dest + 0x102)], [...BOMB_SOURCE_BYTES.BMBD10.slice(0, 6)]);
    R.write16(a('BAX'), BOMB_RELOC.BMBD20);
    R.write16(X + a('OX16'), 0x0080);
    source.BMBOUT(X, 0x440c);
    assert.deepEqual([V.read8(dest), V.read8(dest + 1), V.read8(dest + 2), V.read8(dest + 0x100), V.read8(dest + 0x101), V.read8(dest + 0x102)], [...BOMB_SOURCE_BYTES.BMBD20.slice(6, 12)]);
});
test('Stage33 main runtime has live THPROC and source Bomber and mine colour processes', () => {
    const h = createFlightHarness({ sourceCabinetInput: true, infiniteSmartBombs: true });
    const initial = h.ram.read16(a('THX'));
    const phases = new Set(), mine = new Set(), positions = new Set([initial]);
    for (let t = 0; t < 85; t++) {
        h.STEP();
        positions.add(h.ram.read16(a('THX')));
        phases.add([...h.ram.snapshot(a('PCRAM') + 13, a('PCRAM') + 16)].join(','));
        mine.add(h.ram.read16(a('BAX')));
    }
    assert.ok(positions.size >= 6, 'thrust pointer must advance through source THPROC 4-tick NAP');
    for (const triple of [[0x81, 0x81, 0x2f], [0x81, 0x2f, 0x07], [0x2f, 0x81, 0x07]])
        assert.ok(phases.has(triple.join(',')), `missing original Bomber colour phase ${triple}`);
    assert.ok(mine.has(BOMB_RELOC.BMBD10) && mine.has(BOMB_RELOC.BMBD20));
    assert.equal(h.STATE().smartBombs, Infinity);
});
test('new source palette writes are copied into colour hardware on IRQ', () => {
    const h = createFlightHarness({ sourceCabinetInput: true });
    step(h, 35);
    const current = [13, 14, 15].map(i => h.ram.read8(a('PCRAM') + i));
    h.IRQ_PAIR();
    assert.deepEqual([13, 14, 15].map(i => h.ram.read8(0xc000 + i)), current);
    assert.deepEqual([13, 14, 15].map(i => defenderDacRGB(h.ram.read8(0xc000 + i))), current.map(defenderDacRGB));
});
test('original stars change SCOL colours during active gameplay, not by Canvas-generated particles', () => {
    const h = createFlightHarness({ sourceCabinetInput: true, infiniteSmartBombs: true });
    const initial = Array.from({ length: 16 }, (_, n) => h.ram.read8(a('SMAP') + n * a('SLGTH') + a('SCOL')));
    step(h, 550);
    const updated = Array.from({ length: 16 }, (_, n) => h.ram.read8(a('SMAP') + n * a('SLGTH') + a('SCOL')));
    assert.notDeepEqual(updated, initial, 'SMAP colour values must twinkle through SBLNK');
    assert.ok(updated.every(v => (v & 0x88) === 0), 'all colours must stay within SBLNK $77 nibble mask');
});
test('extended integrated animation run preserves original process free list and moving thrust', () => {
    const h = createFlightHarness({ sourceCabinetInput: true, infiniteSmartBombs: true, playerCollisions: true });
    const seen = new Set();
    for (let t = 0; t < 12000; t++) {
        if (t % 197 === 0)
            h.INPUT({ fire: true, thrust: true });
        else if (t % 197 === 19)
            h.INPUT({ fire: false, thrust: false });
        if (t % 400 === 0)
            h.INPUT({ smartBomb: true });
        else if (t % 400 === 5)
            h.INPUT({ smartBomb: false });
        h.STEP();
        if (t % 400 === 0)
            seen.add(h.ram.read16(a('THX')));
        if (h.STATE().gameOver)
            h.RESET();
    }
    const head = h.ram.read16(a('FREE'));
    assert.ok(!head || (head >= a('PTAB') && head < a('TABEND')), 'normal process FREE must not be corrupted by star blinking');
    assert.ok(seen.size >= 2);
});
test('animated thrust actually reaches the shared game framebuffer during held thrust', () => {
    const h = createFlightHarness({ sourceCabinetInput: true, infiniteSmartBombs: true });
    let matches = 0;
    const colours = new Set();
    for (let tick = 0; tick < 105; tick++) {
        h.INPUT({ thrust: true });
        h.STEP();
        const column = (h.ram.read16(a('PLAXC')) - 0x100 + 1) & 0xffff;
        const fromSource = h.ram.read8(h.ram.read16(a('THX')));
        const framebufferByte = h.video.read8(column);
        colours.add(framebufferByte);
        // PRDISP is raster-gated: matching on more than half the IRQ updates
        // confirms that source THOUT actually redraws the visible video bytes.
        if (framebufferByte === fromSource)
            matches++;
    }
    assert.equal(h.ram.read8(a('PIA21')) & 2, 2, 'cabinet thrust switch reaches source PIA21');
    assert.ok(colours.size >= 12, 'thrust pixels should animate rather than hold one colour');
    assert.ok(matches > 50, 'source THOUT writes must reach the same game framebuffer as the ship');
});
test('source star blink changes star VIDEO bytes, not only stored RAM palette values', () => {
    const h = createFlightHarness({ sourceCabinetInput: true, infiniteSmartBombs: true });
    const seen = Array.from({ length: 16 }, () => new Set());
    for (let frame = 0; frame < 640; frame++) {
        h.STEP();
        for (let n = 0; n < 16; n++) {
            const entry = a('SMAP') + n * a('SLGTH');
            seen[n].add(h.video.read8(h.ram.read16(entry)));
        }
    }
    assert.ok(seen.filter(colors => colors.size >= 3).length >= 12, 'STOUT must write evolving source star colours into game video memory');
});
