import test from 'node:test';
import assert from 'node:assert/strict';
import { RAM, Layout } from '../runtime/ram.js';
import { createDefa7ProcessRoutines } from '../original/defa7.js';
import { Continuations, TranslationBoundaryError } from '../runtime/continuations.js';
// TEST FIXTURE. Addresses intentionally synthetic, never shipped as Defender's actual PHR6 layout.
const syms = {
    ACTIVE: 0xa040, FREE: 0xa042, CRPROC: 0xa044, SPFREE: 0xa046, OFREE: 0xa048, OPTR: 0xa04a, IPTR: 0xa04c, SPTR: 0xa04e,
    PTAB: 0xa100, PSIZE: 15, TABEND: 0xa100 + 15 * 75,
    SPTAB: 0xa600, SPSIZE: 23, SPTEND: 0xa600 + 23 * 5,
    PLINK: 0, PADDR: 2, PTIME: 4, PTYPE: 5, PCOD: 6, OBJID: 6, CTYPE: 2,
    OLIST: 0xa800, OSIZE: 23, OLEND: 0xa800 + 23 * 95, OLINK: 0, OBJX: 4, OTYP: 20,
    CONT1: 0xd100, CONT2: 0xd120
};
function setup() {
    const RAMx = new RAM(), L = new Layout(syms), p = createDefa7ProcessRoutines(RAMx, L);
    p.PINIT();
    return { RAMx, p, L };
}
const linklist = (m, start) => {
    const all = [];
    let x = m.read16(start);
    for (let i = 0; x && i < 100; i++, x = m.read16(x))
        all.push(x);
    return all;
};
test('PINIT: original normal and super free lists each have correct number of cells', () => {
    const { RAMx, p } = setup();
    assert.equal(linklist(RAMx, syms.FREE).length, 75);
    assert.equal(linklist(RAMx, syms.SPFREE).length, 5);
    assert.equal(RAMx.read16(syms.ACTIVE), 0);
    assert.equal(RAMx.read16(syms.CRPROC), syms.ACTIVE);
    assert.equal(RAMx.read16(syms.PTAB), syms.PTAB + 15);
});
test('MKPROC: newly created process is inserted AFTER current link, with PTIME=1', () => {
    const { RAMx, p } = setup();
    const a = p.MKPROC(syms.CONT1, 1), b = p.MKPROC(syms.CONT2, 2);
    assert.equal(a, syms.PTAB);
    assert.equal(b, syms.PTAB + 15);
    assert.deepEqual(linklist(RAMx, syms.ACTIVE), [b, a]);
    assert.equal(RAMx.read16(a + 2), syms.CONT1);
    assert.equal(RAMx.read8(a + 4), 1);
    assert.equal(RAMx.read8(a + 6), 0);
});
test('MSPROC: segregated allocation sets PCOD=1', () => {
    const { RAMx, p } = setup();
    const node = p.MSPROC(syms.CONT1, 0);
    assert.equal(node, syms.SPTAB);
    assert.equal(RAMx.read8(node + 6), 1);
});
test('DISP: decrement-to-zero dispatch and preserved linked process ordering', () => {
    const { RAMx, p } = setup();
    const a = p.MKPROC(syms.CONT1, 0), b = p.MKPROC(syms.CONT2, 0);
    const first = p.DISP();
    assert.deepEqual(first, { kind: 'resume', process: b, address: syms.CONT2 });
    const second = p.SLEEP(2, syms.CONT2);
    assert.deepEqual(second, { kind: 'resume', process: a, address: syms.CONT1 });
    assert.deepEqual(p.SLEEP(1, syms.CONT1), { kind: 'end-of-dispatch', next: 'EXEC' });
    assert.deepEqual(p.DISP(), { kind: 'resume', process: a, address: syms.CONT1 }); // b PTIME 2 -> 1; a PTIME 1 -> 0
    assert.deepEqual(p.SLEEP(1, syms.CONT1), { kind: 'end-of-dispatch', next: 'EXEC' });
    assert.deepEqual(p.DISP(), { kind: 'resume', process: b, address: syms.CONT2 });
});
test('SLEEP 0 does not turn into an invented immediate callback', () => {
    const { RAMx, p } = setup();
    const a = p.MKPROC(syms.CONT1, 0);
    p.DISP();
    p.SLEEP(0, syms.CONT2);
    assert.equal(RAMx.read8(a + 4), 0);
    const event = p.DISP();
    assert.equal(event.kind, 'end-of-dispatch');
    assert.equal(RAMx.read8(a + 4), 255);
});
test('SUCIDE removes current cell, resumes next cell without skipping it', () => {
    const { RAMx, p } = setup();
    const a = p.MKPROC(syms.CONT1, 0), b = p.MKPROC(syms.CONT2, 0);
    assert.equal(p.DISP().process, b);
    assert.deepEqual(p.SUCIDE(), { kind: 'resume', process: a, address: syms.CONT1 });
    assert.deepEqual(linklist(RAMx, syms.ACTIVE), [a]);
    assert.equal(RAMx.read16(syms.FREE), b);
});
test('KILL recycles normal and super cells to their distinct source lists', () => {
    const { RAMx, p } = setup();
    const a = p.MKPROC(syms.CONT1, 0), b = p.MSPROC(syms.CONT2, 0);
    assert.equal(p.KILL(b), syms.ACTIVE);
    assert.equal(RAMx.read16(syms.SPFREE), b);
    assert.equal(p.KILL(a), syms.ACTIVE);
    assert.equal(RAMx.read16(syms.FREE), a);
});
test('KILLOP uses OBJID pointer, not a guessed object property', () => {
    const { RAMx, p } = setup();
    const a = p.MKPROC(syms.CONT1, 0), obj = 0xbb00;
    RAMx.write16(obj + syms.OBJID, a);
    p.KILLOP(obj);
    assert.equal(RAMx.read16(syms.ACTIVE), 0);
});
test('GNCIDE preserves current process and coin processes', () => {
    const { RAMx, p } = setup();
    const a = p.MKPROC(syms.CONT1, 0), b = p.MKPROC(syms.CONT2, 2), c = p.MKPROC(syms.CONT1, 1);
    RAMx.write16(syms.CRPROC, c);
    p.GNCIDE();
    assert.deepEqual(linklist(RAMx, syms.ACTIVE), [c, b]);
});
test('exhausting original process slots traps rather than silently spawning replacement objects', () => {
    const { p } = setup();
    for (let i = 0; i < 75; i++)
        p.MKPROC(syms.CONT1, 0);
    assert.throws(() => p.MKPROC(syms.CONT1, 0), /out of normal process slots/);
});
test('KILL non-member is an explicit error', () => {
    const { p } = setup();
    assert.throws(() => p.KILL(0xa030), /not in ACTIVE/);
});
test('untranslated continuation is rejected; no invented gameplay handler', () => {
    const { RAMx, p, L } = setup();
    p.MKPROC(syms.CONT1, 0);
    const c = new Continuations({ RAM: RAMx, Layout: L, scheduler: p });
    assert.throws(() => c.resume(p.DISP()), TranslationBoundaryError);
});
test('translated continuation resumes by original label and SLEEP address', () => {
    const { RAMx, p, L } = setup();
    const a = p.MKPROC(syms.CONT1, 0);
    const c = new Continuations({ RAM: RAMx, Layout: L, scheduler: p });
    let counter = 0;
    c.register('CONT1', ({ scheduler }) => {
        counter++;
        return scheduler.SLEEP(3, syms.CONT2);
    });
    c.register('CONT2', ({ scheduler }) => {
        counter++;
        return scheduler.SLEEP(3, syms.CONT1);
    });
    assert.equal(c.resume(p.DISP()).kind, 'end-of-dispatch');
    assert.equal(counter, 1);
    // 2 quiet rounds then resume CONT2
    assert.equal(c.resume(p.DISP()).kind, 'end-of-dispatch');
    assert.equal(c.resume(p.DISP()).kind, 'end-of-dispatch');
    c.resume(p.DISP());
    assert.equal(counter, 2);
});
test('OINIT allocates 95 original object records and resets active/inactive/shell lists', () => {
    const { RAMx, p } = setup();
    p.OINIT();
    assert.equal(linklist(RAMx, syms.OFREE).length, 95);
    assert.equal(RAMx.read16(syms.OPTR), 0);
    assert.equal(RAMx.read16(syms.IPTR), 0);
    assert.equal(RAMx.read16(syms.SPTR), 0);
});
test('GETOB initializes source object fields but does not automatically link into OPTR', () => {
    const { RAMx, p } = setup();
    p.OINIT();
    const first = p.GETOB();
    assert.equal(first, syms.OLIST);
    assert.equal(RAMx.read16(syms.OFREE), first + 23);
    assert.equal(RAMx.read16(syms.OPTR), 0);
    assert.equal(RAMx.read16(first + 4), 0);
    assert.equal(RAMx.read8(first + 20), 0);
});
test('KILLOB unlinks from OPTR by pointer-to-link then recycles object into OFREE', () => {
    const { RAMx, p } = setup();
    p.OINIT();
    const a = p.GETOB(), b = p.GETOB();
    RAMx.write16(syms.OPTR, a);
    RAMx.write16(a, b);
    RAMx.write16(b, 0);
    p.KILLOB(a);
    assert.equal(RAMx.read16(syms.OPTR), b);
    assert.equal(RAMx.read16(syms.OFREE), a);
});
test('KILLOB searches IPTR when object is inactive', () => {
    const { RAMx, p } = setup();
    p.OINIT();
    const a = p.GETOB();
    RAMx.write16(syms.IPTR, a);
    p.KILLOB(a);
    assert.equal(RAMx.read16(syms.IPTR), 0);
    assert.equal(RAMx.read16(syms.OFREE), a);
});
test('KILSHL only searches shells; absent member is a hard error', () => {
    const { RAMx, p } = setup();
    p.OINIT();
    const a = p.GETOB();
    RAMx.write16(syms.SPTR, a);
    p.KILSHL(a);
    assert.equal(RAMx.read16(syms.SPTR), 0);
    assert.throws(() => p.KILSHL(a), /absent from shell list/);
});
