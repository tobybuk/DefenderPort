import test from 'node:test';
import assert from 'node:assert/strict';
import { RAM } from '../runtime/ram.js';
import { PHR6_LAYOUT as L } from '../runtime/phr6-layout.js';
import { DAA8, ADD_BCD, createDefa7ScoreRoutines } from '../original/defa7-score.js';
import { createDefa7ScoreDisplayRoutines } from '../original/defa7-score-display.js';
import { createDefa7HudRoutines } from '../original/defa7-hud.js';
import { createDefa7SwitchRoutines } from '../original/defa7-switches.js';
const ramFixture = () => {
    const r = new RAM();
    return { r, get: n => r.read8(L.at(n)), set: (n, v) => r.write8(L.at(n), v), get16: n => r.read16(L.at(n)), set16: (n, v) => r.write16(L.at(n), v) };
};
test('6809 DAA normal, tens carry, and inherited carry after ADCA', () => {
    assert.deepEqual(DAA8(0x0a), { value: 0x10, carry: false });
    assert.deepEqual(DAA8(0x9a), { value: 0, carry: true });
    assert.deepEqual(ADD_BCD(0x99, 0x01), { value: 0, carry: true });
    assert.deepEqual(ADD_BCD(0x50, 0x49), { value: 0x99, carry: false });
    assert.deepEqual(ADD_BCD(0x99, 0, 1), { value: 0, carry: true });
    assert.deepEqual(ADD_BCD(0x09, 0x07), { value: 0x16, carry: false });
});
test('RCHK compares MSB word and then 3rd byte, not a JS decimal string', () => {
    const f = ramFixture(), a = 0xa100, b = 0xa200;
    const { RCHK } = createDefa7ScoreRoutines(f.r, L);
    f.r.write16(a, 0x0011);
    f.r.write16(b, 0x0010);
    assert.ok(RCHK(a, b) > 0);
    f.r.write16(b, 0x0011);
    f.r.write8(a + 2, 0x03);
    f.r.write8(b + 2, 0x04);
    assert.ok(RCHK(a, b) < 0);
    f.r.write8(b + 2, 0x03);
    assert.equal(RCHK(a, b), 0);
});
test('SCORE directly updates source 4-byte packed-BCD player score, carry propagation, and flag', () => {
    const f = ramFixture(), calls = [];
    f.set('CURPLR', 1);
    const { SCORE } = createDefa7ScoreRoutines(f.r, L, { SCRTRN: () => calls.push('SCRTRN') });
    let result = SCORE(0, 0x99);
    assert.deepEqual(result.score, [0, 0, 0, 0x99]);
    result = SCORE(0, 0x01);
    assert.deepEqual(result.score, [0, 0, 0x01, 0x00]);
    assert.deepEqual(calls, ['SCRTRN', 'SCRTRN']);
    assert.equal(f.get('SCRFLG'), 3);
    result = SCORE(1, 0x10);
    assert.deepEqual(result.score, [0, 0, 0x02, 0x00]); // odd exponent multiplies D by 16
    result = SCORE(2, 0x01);
    assert.deepEqual(result.score, [0, 0, 0x03, 0x00]);
});
test('SCORE keeps player 2 BCD in P2SCR and does not touch player 1', () => {
    const f = ramFixture();
    f.set('CURPLR', 2);
    const { SCORE } = createDefa7ScoreRoutines(f.r, L, { SCRTRN: () => {
        } });
    assert.deepEqual(SCORE(3, 0x10).score, [0, 0x01, 0, 0]);
    assert.deepEqual(Array.from(f.r.snapshot(L.at('P1SCR'), L.at('P1SCR') + 4)), [0, 0, 0, 0]);
});
test('SCORE rejects decimal-looking non-BCD mantissa, instead of guessing score units', () => {
    const { SCORE } = createDefa7ScoreRoutines(new RAM(), L, { SCRTRN: () => {
        } });
    assert.throws(() => SCORE(0, 0x1a), /packed BCD/);
    assert.throws(() => SCORE(8, 0x10), /packed BCD/);
});
test('SCORE replay branch uses source REPLA and 3-byte RCHK, then source side-effect order', () => {
    const f = ramFixture(), calls = [];
    f.set('CURPLR', 1);
    f.set16('REPLA', 0x0005);
    const x = L.at('P1SCR');
    f.r.write8(x + 1, 0);
    f.r.write8(x + 2, 0x10);
    f.r.write8(x + 4, 0);
    f.r.write8(x + 5, 0x05);
    const { SCORE } = createDefa7ScoreRoutines(f.r, L, {
        LDISP: () => calls.push('LDISP'), SBDISP: () => calls.push('SBDISP'),
        SNDLD: s => calls.push('SNDLD ' + s), AUDIT: n => calls.push('AUDIT ' + n),
        SCRTRN: () => calls.push('SCRTRN')
    });
    const result = SCORE(0, 0x01);
    assert.equal(result.replay, true);
    assert.equal(f.r.read8(x + 5), 0x10);
    assert.equal(f.get('P1LAS'), 1);
    assert.equal(f.get('P1SBC'), 1);
    assert.deepEqual(calls, ['LDISP', 'SBDISP', 'SNDLD RPSND', 'AUDIT 5', 'SCRTRN']);
});
test('SCORE refuses to hide missing original SCRTRN and replay side effects', () => {
    const f = ramFixture();
    f.set('CURPLR', 1);
    const { SCORE } = createDefa7ScoreRoutines(f.r, L);
    assert.throws(() => SCORE(0, 0x01), /untranslated SCRTRN/);
});
test('SCRTR0 uses high/low nibble phase and suppresses only 4 leading zeros', () => {
    const f = ramFixture(), calls = [];
    f.set('MAPCR', 7);
    const eq = { P1DISP: 0x2008, P2DISP: 0x6008, N0V: 0xc000, DIGLTH: 0x0500 };
    const funcs = createDefa7ScoreDisplayRoutines(f.r, L, { displayEquates: eq,
        CWRIT: (d, y) => calls.push(['on', d, y]), COFF: d => calls.push(['off', d]) });
    const x = L.at('P1SCR');
    f.r.write8(x + 1, 0x01);
    f.r.write8(x + 2, 0x23);
    f.r.write8(x + 3, 0x45);
    funcs.SCRTR0(1);
    assert.deepEqual(calls, [['off', 0x2008], ['on', 0x2508, 0xc004], ['on', 0x2a08, 0xc008], ['on', 0x2f08, 0xc00c], ['on', 0x3408, 0xc010], ['on', 0x3908, 0xc014]]);
    assert.equal(f.get('MAPCR'), 7);
    assert.equal(f.r.read8(L.at('MAPC')), 7);
});
test('SCRTRN selects CURPLR; zeros in final two displayed positions are kept', () => {
    const f = ramFixture(), calls = [];
    f.set('CURPLR', 2);
    const eq = { P1DISP: 0x2008, P2DISP: 0x6008, N0V: 0xc000, DIGLTH: 0x0400 };
    createDefa7ScoreDisplayRoutines(f.r, L, { displayEquates: eq,
        CWRIT: (d, y) => calls.push(['on', d, y]), COFF: d => calls.push(['off', d]) }).SCRTRN();
    assert.deepEqual(calls.slice(0, 4).map(x => x[0]), ['off', 'off', 'off', 'off']);
    assert.deepEqual(calls.slice(4), [['on', 0x7008, 0xc000], ['on', 0x7408, 0xc000]]);
});
test('Untranslated score glyphs cause a strict boundary, not an invented HTML numeral', () => {
    const f = ramFixture();
    const d = createDefa7ScoreDisplayRoutines(f.r, L);
    assert.throws(() => d.SCRTR0(1), /CWRIT is untranslated/);
});
test('LDISP and SBDISP use original P1/P2 counts, caps and address increments', () => {
    const f = ramFixture(), calls = [];
    const eq = { P1LAT: 0x2109, P2LAT: 0x6209, PLAMIN: 0xc100, P1SBD: 0x4507, P2SBD: 0x7507, SBPIC: 0xc200 };
    f.set('PLRCNT', 2);
    f.set('P1LAS', 7);
    f.set('P2LAS', 2);
    f.set('P1SBC', 4);
    f.set('P2SBC', 1);
    const h = createDefa7HudRoutines(f.r, L, { displayEquates: eq,
        BLKCLR: (d, w, h) => calls.push(['clear', d, w, h]), CWRIT: (d, y) => calls.push(['write', d, y]) });
    h.LDISP();
    h.SBDISP();
    assert.deepEqual(calls.filter(x => x[0] === 'clear'), [
        ['clear', 0x2109, 0x20, 6], ['clear', 0x6209, 0x20, 6], ['clear', 0x4507, 3, 11], ['clear', 0x7507, 3, 11]
    ]);
    const ships = calls.filter(x => x[0] === 'write' && x[2] === eq.PLAMIN).map(x => x[1]);
    assert.deepEqual(ships, [0x2109, 0x2709, 0x2d09, 0x3309, 0x3909, 0x6209, 0x6809]);
    const bombs = calls.filter(x => x[0] === 'write' && x[2] === eq.SBPIC).map(x => x[1]);
    assert.deepEqual(bombs, [0x4507, 0x450b, 0x450f, 0x7507]);
});
test('TDISP original top clear, BORDER, laser, bomb and score sequence', () => {
    const f = ramFixture(), seq = [];
    f.set('PLRCNT', 2);
    const eq = { P1LAT: 0x2109, P2LAT: 0x6209, PLAMIN: 0xc100, P1SBD: 0x4507, P2SBD: 0x7507, SBPIC: 0xc200 };
    const h = createDefa7HudRoutines(f.r, L, { displayEquates: eq,
        BLKCLR: (x, w, h) => seq.push('BLKCLR ' + x.toString(16)), CWRIT: () => {
        },
        BORDER: () => seq.push('BORDER'), SCRTR0: i => seq.push('SCRTR0 ' + i) });
    h.TDISP();
    assert.deepEqual(seq, ['BLKCLR 3008', 'BORDER', 'BLKCLR 2109', 'BLKCLR 6209', 'BLKCLR 4507', 'BLKCLR 7507', 'SCRTR0 2', 'SCRTR0 1']);
});
test('TDISP cannot silently paint a substitute screen when BLKCLR is untranslated', () => {
    const f = ramFixture(), h = createDefa7HudRoutines(f.r, L);
    assert.throws(() => h.TDISP(), /BLKCLR/);
});
test('SSCAN decrements source debounce timers and captures previous/new PIA bytes', () => {
    const f = ramFixture();
    f.set('SLMCNT', 9);
    f.set('LCCNT', 2);
    f.set('CCCNT', 1);
    f.set('RCCNT', 0);
    f.set('PIA21', 0xff);
    f.set('PIA22', 0xff);
    f.set('PIA01', 0xff);
    f.set('PIA02', 0xff);
    const input = { '0-control': 0, 0: 0, 2: 0x08, 3: 0x90 };
    const s = createDefa7SwitchRoutines(f.r, L, { readPIA: p => input[p] });
    assert.equal(s.SSCAN(), null);
    assert.equal(f.get('SLMCNT'), 8);
    assert.equal(f.get('LCCNT'), 1);
    assert.equal(f.get('CCCNT'), 0);
    assert.equal(f.get('PIA22'), 0xff);
    assert.equal(f.get('PIA21'), 0x08);
    assert.equal(f.get('PIA31'), 0x90);
});
test('SSCAN slam load 60 then same-scan decrement to 59, as original order', () => {
    const f = ramFixture();
    f.set('PIA21', 255);
    f.set('PIA22', 255);
    f.set('PIA01', 255);
    f.set('PIA02', 255);
    const input = { '0-control': 0x40, 0: 0, 2: 0, 3: 0 };
    const s = createDefa7SwitchRoutines(f.r, L, { readPIA: p => input[p] });
    s.SSCAN();
    assert.equal(f.get('SLMCNT'), 59);
});
test('SWITCH chooses lowest asserted bit and writes original 2-slot SWPROC queue', () => {
    const f = ramFixture(), table = new Uint8Array(32);
    table.set([0x01, 0x02, 0x90, 0x10], 0);
    table.set([0x03, 0x04, 0x90, 0x20], 4);
    table.set([0x05, 0x06, 0x90, 0x30], 8);
    const s = createDefa7SwitchRoutines(f.r, L);
    assert.deepEqual(s.SWITCH(0x04, table), { bit: 2, slot: 0, processTypeWord: 0x0506, processAddress: 0x9030 });
    assert.deepEqual(s.SWITCH(0x03, table), { bit: 0, slot: 4, processTypeWord: 0x0102, processAddress: 0x9010 });
    assert.equal(f.r.read16(L.at('SWPROC')), 0x0506);
    assert.equal(f.r.read16(L.at('SWPROC') + 2), 0x9030);
    assert.equal(f.r.read16(L.at('SWPROC') + 4), 0x0102);
    assert.equal(f.r.read16(L.at('SWPROC') + 6), 0x9010);
});
test('SSCAN game input queues source table entry on edge, not on held input', () => {
    const f = ramFixture();
    let raw = 0x01;
    const io = { '0-control': 0, 0: 0, 2: raw, 3: 0 };
    const game = new Uint8Array([0x01, 0x04, 0xc2, 0x35]);
    const s = createDefa7SwitchRoutines(f.r, L, { readPIA: p => io[p], gameSwitchTable: game });
    assert.equal(s.SSCAN().processAddress, 0xc235);
    assert.equal(s.SSCAN(), null);
    assert.equal(f.r.read16(L.at('SWPROC') + 4), 0);
});
test('CSCAN original 1ms coin confirmation double-reads and rejects a bounce', () => {
    const f = ramFixture();
    let port = 1, waits = 0;
    const tab = new Uint8Array([0x01, 0x04, 0xc2, 0x80]);
    const s = createDefa7SwitchRoutines(f.r, L, { readPIA: p => p === 0 ? port : 0, coinSwitchTable: tab, coinDebounce1ms: () => {
            waits++;
            port = 0;
        } });
    assert.equal(s.CSCAN(), null);
    assert.equal(waits, 1);
    assert.equal(f.r.read16(L.at('SWPROC')), 0);
});
test('CSCAN queues a stable coin entry only with real source switch data', () => {
    const f = ramFixture();
    let waits = 0;
    const tab = new Uint8Array([0x02, 0x01, 0xc2, 0xf0]);
    const s = createDefa7SwitchRoutines(f.r, L, { readPIA: p => p === 0 ? 1 : 0, coinSwitchTable: tab, coinDebounce1ms: () => waits++ });
    assert.equal(s.CSCAN().processAddress, 0xc2f0);
    assert.equal(waits, 1);
    assert.equal(f.get('PIA01'), 1);
});
test('Original switch tables are mandatory; no guessed switch action may run', () => {
    const f = ramFixture();
    const s = createDefa7SwitchRoutines(f.r, L, { readPIA: p => p === 2 ? 1 : 0 });
    assert.throws(() => s.SSCAN(), /SWTAB\/SWTAB1/);
});
