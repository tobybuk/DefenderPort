import test from 'node:test';
import assert from 'node:assert/strict';
import { RAM } from '../runtime/ram.js';
import { PHR6_LAYOUT as L } from '../runtime/phr6-layout.js';
import { createDefa7IrqRoutines } from '../original/defa7-irq.js';
import { createDefa7InitRoutines } from '../original/defa7-init.js';
function fixture(extra = {}) {
    const ram = new RAM(), calls = [];
    const names = ['SNDSEQ', 'PLAYER', 'STOUT', 'OPROC', 'PRDISP', 'SHELL', 'CSCAN', 'BGOUT', 'VELO'];
    const mock = Object.fromEntries(names.map(name => [name, (...args) => calls.push([name, ...args])]));
    const irq = createDefa7IrqRoutines(ram, L, { ...mock, ...extra });
    const r = n => ram.read8(L.at(n)), w = (n, v) => ram.write8(L.at(n), v);
    const rr = n => ram.read16(L.at(n)), ww = (n, v) => ram.write16(L.at(n), v);
    return { ram, calls, irq, r, w, rr, ww };
}
function output(f) {
    return f.calls.map(x => x[0]);
}
test('IRQ normal upper scanline follows source sequence SNDSEQ,PLAYER,STOUT,OPROC,PRDISP,SHELL', () => {
    const f = fixture();
    f.ram.write8(0xc800, 0x90);
    f.ww('XXX1', 0xff70);
    f.w('MAPCR', 3);
    f.irq.IRQ();
    assert.deepEqual(output(f), ['SNDSEQ', 'PLAYER', 'STOUT', 'OPROC', 'PRDISP', 'SHELL']);
    assert.equal(f.r('IFLG'), 1);
    assert.equal(f.r('XXX2'), 0x88);
    assert.deepEqual(f.calls.slice(3), [['OPROC', 0x8800], ['PRDISP', 0x8800], ['SHELL']]);
    assert.equal(f.ram.read8(0xd000), 3);
    assert.equal(f.ram.read8(0xcc03), 5);
});
test('IRQ upper scanline clamps write boundary to 0xA8 and runs only once per phase', () => {
    const f = fixture();
    f.ram.write8(0xc800, 0xfe);
    f.irq.IRQ();
    f.irq.IRQ();
    assert.equal(f.r('XXX2'), 0xa8);
    assert.equal(f.calls.length, 6);
});
test('IRQ normal lower path performs CSCAN,BGOUT,PRDISP,OPROC,VELO in this precise order', () => {
    const f = fixture();
    f.w('IFLG', 1);
    f.w('TIMER', 255);
    f.ww('XXX1', 0xff70);
    f.ram.write8(0xc800, 9);
    f.irq.IRQ();
    assert.deepEqual(output(f), ['CSCAN', 'BGOUT', 'PRDISP', 'OPROC', 'VELO']);
    assert.deepEqual(f.calls.slice(2, 4), [['PRDISP', 0xff70], ['OPROC', 0xff70]]);
    assert.equal(f.r('TIMER'), 0);
    assert.equal(f.r('IFLG'), 0);
    assert.equal(f.ram.read8(0xc3fc), 0x38);
});
test('IRQ status bit 1 disables BGOUT but still runs other lower-phase routines', () => {
    const f = fixture();
    f.w('IFLG', 1);
    f.w('STATUS', 2);
    f.ram.write8(0xc800, 0x10);
    f.irq.IRQ();
    assert.deepEqual(output(f), ['CSCAN', 'PRDISP', 'OPROC', 'VELO']);
});
test('IRQ copies all sixteen PCRAM bytes to CRAM only when VERTCT <=8', () => {
    const f = fixture();
    for (let i = 0; i < 16; i++)
        f.ram.write8(L.at('PCRAM') + i, (i * 13) & 255);
    f.w('IFLG', 1);
    f.ram.write8(0xc800, 8);
    f.irq.IRQ();
    assert.deepEqual(Array.from(f.ram.snapshot(0xc000, 0xc010)), Array.from({ length: 16 }, (_, i) => (i * 13) & 255));
    f.ram.clear(0xc000, 0xc010);
    f.w('IFLG', 1);
    f.ram.write8(0xc800, 9);
    f.irq.IRQ();
    assert.deepEqual(Array.from(f.ram.snapshot(0xc000, 0xc010)), Array(16).fill(0));
});
test('IRQ lower first invocation without upper phase is ignored, restores MAPC', () => {
    const f = fixture();
    f.w('MAPCR', 7);
    f.ram.write8(0xc800, 12);
    f.irq.IRQ();
    assert.deepEqual(f.calls, []);
    assert.equal(f.r('IFLG'), 0);
    assert.equal(f.ram.read8(0xd000), 7);
});
test('IRQ missing OPROC throws an explicit untranslated routine error', () => {
    const f = fixture({ OPROC: undefined });
    f.ram.write8(0xc800, 160);
    assert.throws(() => f.irq.IRQ(), /untranslated OPROC/);
    assert.equal(f.ram.read8(0xcc03), 5);
});
test('IRQB inverted upper phase calls CSCAN, BGOUT, PRDISP, OPROC only', () => {
    const f = fixture();
    f.w('MAPCR', 4);
    f.ram.write8(0xc800, 0x60);
    f.ww('XXX1', 0x3456);
    f.irq.IRQB();
    assert.deepEqual(output(f), ['CSCAN', 'BGOUT', 'PRDISP', 'OPROC']);
    assert.equal(f.r('IFLG'), 1);
    assert.equal(f.r('XXX2'), 0x9f);
    assert.deepEqual(f.calls.slice(2), [['PRDISP', 0x349f], ['OPROC', 0x349f]]);
    assert.equal(f.ram.read8(0xd000), 4);
});
test('IRQB lower phase orders SNDSEQ,PLAYER,STOUT,PRDISP,OPROC,SHELL,VELO', () => {
    const f = fixture();
    f.w('IFLG', 1);
    f.ram.write8(0xc800, 0x20);
    f.ww('XXX2', 0x9876);
    f.irq.IRQB();
    assert.deepEqual(output(f), ['SNDSEQ', 'PLAYER', 'STOUT', 'PRDISP', 'OPROC', 'SHELL', 'VELO']);
    assert.deepEqual(f.calls.slice(3, 5), [['PRDISP', 0x9876], ['OPROC', 0x9876]]);
    assert.equal(f.ram.read8(0xc3fc), 0x39);
    assert.equal(f.r('TIMER'), 1);
});
test('IRQB palette copy threshold <=4, mirrored to original 16 colour entries', () => {
    const f = fixture();
    f.w('IFLG', 1);
    f.ram.write8(0xc800, 4);
    f.ram.write8(L.at('PCRAM') + 15, 0x5a);
    f.irq.IRQB();
    assert.equal(f.ram.read8(0xc00f), 0x5a);
});
test('CRINIT transfers exactly original 16 source CRTAB bytes, refuses missing table', () => {
    const r = new RAM();
    const expected = Uint8Array.from({ length: 16 }, (_, i) => i + 33);
    assert.throws(() => createDefa7InitRoutines(r, L).CRINIT(), /original CRTAB/);
    createDefa7InitRoutines(r, L, { CRTAB: expected }).CRINIT();
    assert.deepEqual(Array.from(r.snapshot(L.at('PCRAM'), L.at('PCRAM') + 16)), Array.from(expected));
});
test('INIT20 reproduces exact source init order and does not invoke arbitrary browser setup', () => {
    const r = new RAM(), calls = [];
    const names = ['FISS', 'STINIT', 'OINIT', 'FBINIT', 'THINIT'];
    const deps = { CRTAB: new Uint8Array(16).fill(0x44) };
    for (const name of names)
        deps[name] = () => calls.push(name);
    createDefa7InitRoutines(r, L, deps).INIT20();
    assert.deepEqual(calls, names);
    assert.equal(r.read8(L.at('PCRAM') + 15), 0x44);
});
test('INIT20 refuses an untranslated subsystem even with colour data loaded', () => {
    const r = new RAM();
    const startup = createDefa7InitRoutines(r, L, { CRTAB: new Uint8Array(16) });
    assert.throws(() => startup.INIT20(), /untranslated FISS/);
});
test('P1SW stores the actual IRQ JMP vector, PIA config and watchdog, restores MAPCR', () => {
    const r = new RAM();
    r.write8(L.at('MAPCR'), 6);
    const start = createDefa7InitRoutines(r, L, { IRQ_ADDRESS: 0xd402 });
    start.P1SW();
    assert.equal(r.read8(L.at('IRQHK')), 0x7e);
    assert.equal(r.read16(L.at('IRQHK') + 1), 0xd402);
    assert.equal(r.read8(0xcc07), 0x3c);
    assert.equal(r.read8(0xc3fc), 0x38);
    assert.equal(r.read8(L.at('MAPCR')), 6);
    assert.equal(r.read8(0xd000), 6);
});
test('P2SW selects inverted IRQ only when original cocktail bit is set', () => {
    const r = new RAM();
    const deps = { IRQ_ADDRESS: 0xd402, IRQB_ADDRESS: 0xd441, MAPCHG: () => {
        } };
    const start = createDefa7InitRoutines(r, L, deps);
    r.write8(0xcc06, 0x80);
    start.P2SW();
    assert.equal(r.read16(L.at('IRQHK') + 1), 0xd441);
    assert.equal(r.read8(0xcc07), 0x34);
    assert.equal(r.read8(0xc3fc), 0x39);
    r.write8(0xcc06, 0);
    start.P2SW();
    assert.equal(r.read16(L.at('IRQHK') + 1), 0xd402);
});
test('SINIT missing original external code explicitly fails, does not launch a fictional game', () => {
    const r = new RAM();
    const start = createDefa7InitRoutines(r, L);
    assert.throws(() => start.SINIT(), /untranslated DISABLE_IRQ/);
});
test('Full SINIT control-flow fixture preserves source call sequence and initialization stores', () => {
    const r = new RAM(), calls = [];
    const order = ['DISABLE_IRQ', 'SCRCLR', 'RCMOSB', 'MAPCH3', 'RHSTDS', 'PINIT', 'FISS', 'STINIT', 'OINIT', 'FBINIT', 'THINIT', 'INIT', 'MKPROC', 'ENABLE_IRQ', 'EXEC'];
    const deps = { IRQ_ADDRESS: 0xd402, ATTR_ADDRESS: 0xd250, CREDST_ADDRESS: 0xc400, CRTAB: Uint8Array.from({ length: 16 }, (_, i) => i) };
    for (const name of order)
        deps[name] = (...args) => {
            calls.push([name, ...args]);
            return name === 'RCMOSB' ? 0x12 : (name === 'EXEC' ? 'executor-translated-entry' : undefined);
        };
    const init = createDefa7InitRoutines(r, L, deps);
    r.write8(0x9c00, 55);
    r.write8(0xbfff, 66);
    assert.equal(init.SINIT(), 'executor-translated-entry');
    assert.deepEqual(calls.map(x => x[0]), order);
    assert.equal(r.read8(0x9c00), 0);
    assert.equal(r.read8(0xbfff), 0);
    assert.equal(r.read8(L.at('CREDIT')), 0x12);
    assert.equal(r.read16(L.at('HSEED')), 0xa55a);
    assert.equal(r.read16(L.at('XXX1')), 0xff70);
    assert.equal(r.read8(L.at('XXX3')), 0);
    assert.equal(r.read8(0xcc01), 0x14);
    assert.equal(r.read8(0xcc03), 0x05);
    assert.equal(r.read8(0xcc05), 0x34);
    assert.equal(r.read8(0xcc07), 0x3c);
    assert.equal(r.read8(L.at('STATUS')), 255);
    assert.equal(r.read16(L.at('IRQHK') + 1), 0xd402);
    assert.equal(r.read8(0xc3fc), 0x38);
    assert.deepEqual(Array.from(r.snapshot(L.at('PCRAM'), L.at('PCRAM') + 16)), Array.from({ length: 16 }, (_, i) => i));
});
test('SINIT rejects invalid CMOS credit BCD rather than inventing credits', () => {
    const r = new RAM(), names = ['DISABLE_IRQ', 'SCRCLR', 'MAPCH3', 'RHSTDS', 'PINIT', 'FISS', 'STINIT', 'OINIT', 'FBINIT', 'THINIT', 'INIT', 'MKPROC', 'ENABLE_IRQ', 'EXEC'];
    const deps = { IRQ_ADDRESS: 0xd000, ATTR_ADDRESS: 0xd100, CREDST_ADDRESS: 0xc400, CRTAB: new Uint8Array(16), RCMOSB: () => 0x1a };
    for (const n of names)
        deps[n] = () => {
        };
    const startup = createDefa7InitRoutines(r, L, deps);
    startup.SINIT();
    assert.equal(r.read8(L.at('CREDIT')), 0);
});
