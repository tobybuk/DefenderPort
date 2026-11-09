import test from 'node:test';
import assert from 'node:assert/strict';
import { evalAsm, scanSymbols } from '../tools/symbols-core.mjs';
import { inventoryFile } from '../tools/inventory-core.mjs';
import { META } from '../tools/source-util.mjs';
test('source checkout pins a full 40-digit commit SHA', () => {
    assert.match(META.commit, /^[0-9a-f]{40}$/);
    assert.equal(META.edition, 'Red Label');
});
test('assembly expression parser supports original numeric notations', () => {
    assert.equal(evalAsm('$A000+2', {}, 0), 0xa002);
    assert.equal(evalAsm('4*256', {}, 0), 1024);
    assert.equal(evalAsm('RAM>>8', { RAM: 0xa000 }, 0), 160);
    assert.equal(evalAsm('RAMEND-RAMALS', { RAMEND: 0xa000, RAMALS: 0x9c00 }, 0), 1024);
    assert.equal(evalAsm('*', {}, 0xa100), 0xa100);
    assert.equal(evalAsm('PSIZE+8', { PSIZE: 15 }, 0), 23);
});
test('layout parser recognizes source-defined allocation offsets and self-address definitions', () => {
    const source = `        ORG    $A000
RAM    EQU    $A000
ACTIVE RMB    2
FREE   RMB    2
PTAB   EQU    *
PLINK  EQU    0
PADDR  EQU    2
PSIZE  EQU    15
        RMB    PSIZE*75
TABEND EQU    *
SPSIZE EQU    PSIZE+8
SPTAB  RMB    SPSIZE*5
SPTEND EQU    *
        ORG    $9C00
RAMALS RMB    RAMEND-RAMALS
RAMEND EQU    $A000`;
    // Forward constant RAMEND is normally defined earlier in real phr6.src.
    const resolved = scanSymbols(source.split('\n'), { strict: false });
    assert.equal(resolved.symbols.ACTIVE, 0xa000);
    assert.equal(resolved.symbols.PTAB, 0xa004);
    assert.equal(resolved.symbols.TABEND, 0xa004 + 75 * 15);
    assert.equal(resolved.symbols.SPSIZE, 23);
    assert.ok(resolved.issues.some(i => i.label === 'RAMALS'));
});
test('routine inventory reports actual labels separate from references and data', () => {
    const source = `* comment
START   JSR    PLAYER
        NAP    4,REV
BUFFER  RMB    12
PLAYER  LDD    WORD
INNER   ADDA   #1
        RTS
REV     EQU    *
        RTS`;
    const found = inventoryFile('test.src', source);
    assert.ok(found.labels.some(l => l.name === 'START' && l.kind === 'code-label'));
    assert.ok(found.labels.some(l => l.name === 'BUFFER' && l.kind === 'data-or-definition'));
    assert.ok(found.references.some(r => r.target === 'PLAYER'));
    assert.ok(found.references.some(r => r.target === 'REV'));
});
test('assembly parser refuses to silently guess an undefined memory symbol', () => {
    assert.throws(() => scanSymbols(['        ORG $A000', 'VAR RMB UNKNOWN']), /Unresolved symbol UNKNOWN/);
});
test('possible callable labels are surfaced as incomplete unless translated and tracked', async () => {
    const { callableCandidates } = await import('../tools/inventory-core.mjs');
    const file = inventoryFile('defa7.src', `START JSR PLAYER\nPLAYER RTS\nDATA RMB 4`);
    const found = callableCandidates([file]);
    assert.deepEqual(found.map(x => x.label), ['PLAYER']);
    assert.equal(found[0].status, 'incomplete-unreviewed');
});
