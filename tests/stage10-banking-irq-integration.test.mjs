import test from 'node:test';
import assert from 'node:assert/strict';
import { RAM } from '../runtime/ram.js';
import { VideoMemory } from '../runtime/video-memory.js';
import { PHR6_LAYOUT as L } from '../runtime/phr6-layout.js';
import { createDefa7Routines } from '../original/defa7.js';
import { createDefb6BankingObjectRoutines } from '../original/defb6-banking-object.js';
import { createDefa7PlayerVideoRoutines } from '../original/defa7-player-video.js';
import { PLAPIC } from '../original/defb6-player-data.js';
import { createFlightHarness } from '../demo/flight-harness.js';
import { createDefa7Executive } from '../original/defa7-exec.js';
const A = n => L.at(n), offs = (X, n) => (X + A(n)) & 65535;
function fixture() {
    const r = new RAM(), v = new VideoMemory(), p = createDefa7Routines(r, L);
    p.OINIT();
    const X = p.GETOB(), Y = 0xe123;
    const draw = createDefa7PlayerVideoRoutines(r, L, v);
    const calls = [];
    const resolvePicture = ptr => ptr === Y ? {
        OBJDEL: (D, y, x) => {
            calls.push(['OBJDEL', D, y, x]);
            draw.OFF86(D);
        },
        OBJW: 8, OBJWRT: () => {
        }
    } : null;
    const b = createDefb6BankingObjectRoutines(r, L, { resolvePicture, KILLOB: p.KILLOB, BGINIT: () => {
            calls.push(['BGINIT', r.read8(A('MAPCR')), r.read8(A('MAPC'))]);
        } });
    r.write16(offs(X, 'OPICT'), Y);
    r.write16(offs(X, 'OBJX'), 0x4080);
    return { r, v, p, X, Y, b, calls, draw };
}
test('MAPCH1/2/3/7 and MAPCHG preserve the original two ordered bank-register writes', () => {
    const { r, b } = fixture();
    for (const [name, bank] of [['MAPCH1', 1], ['MAPCH2', 2], ['MAPCH3', 3], ['MAPCH7', 7]]) {
        r.write8(A('MAPCR'), 0xff);
        r.write8(A('MAPC'), 0xff);
        b[name]();
        assert.equal(r.read8(A('MAPCR')), bank);
        assert.equal(r.read8(A('MAPC')), bank);
    }
    b.MAPCHG(0x109);
    assert.equal(r.read8(A('MAPCR')), 9);
    assert.equal(r.read8(A('MAPC')), 9);
});
test('BGI chooses source bank 7 BEFORE calling original BGINIT', () => {
    const f = fixture();
    f.b.BGI();
    assert.deepEqual(f.calls, [['BGINIT', 7, 7]]);
});
test('BGI refuses to invent missing BGINIT but leaves source MAPCR/MAPC writes visible', () => {
    const r = new RAM();
    const b = createDefb6BankingObjectRoutines(r, L);
    assert.throws(() => b.BGI(), /untranslated BGINIT/);
    assert.equal(r.read8(A('MAPCR')), 7);
    assert.equal(r.read8(A('MAPC')), 7);
});
test('OFSHIT selects bank 2, reads OBJX and OPICT in original record, erases that bitmap', () => {
    const f = fixture();
    f.draw.ON86(0x4080, PLAPIC, false);
    assert.ok(Array.from({ length: 8 * 6 }, (_, i) => f.v.read8((((0x40 + (i / 6 | 0)) & 255) << 8) | (0x80 + i % 6))).some(Boolean));
    const before = f.r.snapshot(f.X, f.X + 23);
    f.b.OFSHIT(f.X);
    assert.deepEqual(f.calls, [['OBJDEL', 0x4080, 0xe123, f.X]]);
    assert.equal(f.r.read8(A('MAPCR')), 2);
    assert.equal(f.r.read8(A('MAPC')), 2);
    assert.deepEqual(f.r.snapshot(f.X, f.X + 23), before, 'OFSHIT must not mutate the object record');
    for (let col = 0; col < 8; col++)
        for (let row = 0; row < 6; row++)
            assert.equal(f.v.read8(((0x40 + col) << 8) | (0x80 + row)), 0);
});
test('OFSHIT missing source picture descriptor is an explicit error, not an invented erasure', () => {
    const f = fixture();
    f.r.write16(offs(f.X, 'OPICT'), 0xeeee);
    assert.throws(() => f.b.OFSHIT(f.X), /unresolved original OBJDEL descriptor \$eeee/);
    assert.equal(f.r.read8(A('MAPCR')), 2);
});
test('KILOFF delegates exactly to original KILLOB with the same pointer', () => {
    const f = fixture();
    f.r.write16(A('OPTR'), f.X);
    const next = f.r.read16(offs(f.X, 'OLINK'));
    f.b.KILOFF(f.X);
    assert.equal(f.r.read16(A('OPTR')), next);
    assert.equal(f.r.read16(A('OFREE')), f.X);
});
test('KILOFF refuses to replace untranslated object deletion', () => {
    const b = createDefb6BankingObjectRoutines(new RAM(), L);
    assert.throws(() => b.KILOFF(0x1000), /untranslated KILLOB/);
});
test('IRQ_PAIR runs the actual source IRQ upper and lower halves and increments TIMER once', () => {
    const f = createFlightHarness();
    const before = f.STATE();
    const result = f.IRQ_PAIR();
    assert.equal(result.timer, 1);
    assert.equal(result.iflg, 0);
    assert.equal(f.ram.read8(A('XXX2')), 0x88);
    assert.equal(f.ram.read8(0xcc03), 5);
    assert.equal(f.ram.read8(0xc3fc), 0x38);
    assert.equal(f.ram.read8(A('MAPC')), f.ram.read8(A('MAPCR')));
    assert.equal(f.STATE().x, before.x);
});
test('IRQ_PAIR takes flight input through original PLAYER, not a diagnostic substitute movement function', () => {
    const f = createFlightHarness();
    f.INPUT({ thrust: true });
    const before = f.STATE();
    for (let i = 0; i < 24; i++)
        f.STEP();
    const after = f.STATE();
    assert.equal(f.ram.read8(A('TIMER')), 24);
    assert.notEqual(after.vx, before.vx);
    assert.notEqual(after.worldX, before.worldX);
    assert.equal(f.ram.read8(A('IFLG')), 0);
});
test('IRQ_PAIR executes terrain and a source OPROC descriptor without a fake enemy loop', () => {
    const f = createFlightHarness();
    const p = f.TEST_OPROC();
    assert.notEqual(p, 0);
    const old = f.ram.read8(A('TIMER'));
    f.IRQ_PAIR();
    assert.equal(f.ram.read8(A('TIMER')), (old + 1) & 255);
    const x = f.ram.read16(A('OPTR'));
    assert.notEqual(x, 0);
    assert.notEqual(f.ram.read16(offs(x, 'OBJX')), 0);
});
test('EXEC overload erase passes the source X object pointer to OFSHIT', () => {
    const r = new RAM(), p = createDefa7Routines(r, L);
    p.PINIT();
    p.OINIT();
    const X = p.GETOB();
    r.write16(A('OPTR'), X);
    r.write8(offs(X, 'OTYP'), 0);
    r.write16(offs(X, 'OX16'), 0x3000);
    r.write16(A('SEED'), 0x1234);
    r.write8(A('TIMER'), 3);
    r.write8(A('OVCNT'), 1);
    const erased = [];
    const ex = createDefa7Executive(r, L, p, {
        OFSHIT: x => erased.push(x), MAPC: () => {
        },
        COLCHK: () => {
        }, XUVCT: () => {
        }, RAND: () => {
        }
    });
    const result = ex.EXEC();
    assert.deepEqual(erased, [X]);
    assert.equal(r.read16(A('IPTR')), X);
    assert.equal(r.read16(A('OPTR')), 0);
    assert.equal(r.read16(offs(X, 'OBJX')), 0);
    assert.equal(result.next, 'EXEC');
});
