import test from 'node:test';
import assert from 'node:assert/strict';
import { RAM, Layout } from '../runtime/ram.js';
import { PHR6_SYMBOLS } from '../runtime/phr6-layout.js';
import { createDefa7Routines } from '../original/defa7.js';
import { createDefa7ShellRoutines } from '../original/defa7-shells.js';
import { createDefb6ShootRoutines } from '../original/defb6-shoot.js';
import { TranslationBoundaryError } from '../runtime/continuations.js';
import { s16 } from '../runtime/integers.js';
const addresses = { FBOUT: 0xf600, BMBP1: 0xf602, BKIL: 0xf604, LSHSND: 0xf606 };
function setup() {
    const ram = new RAM(), L = new Layout({ ...PHR6_SYMBOLS, ...addresses });
    const proc = createDefa7Routines(ram, L);
    proc.PINIT();
    proc.OINIT();
    const U = proc.MKPROC(0xf700, 0), X = proc.GETOB();
    ram.write16(L.at('CRPROC'), U);
    ram.write16(X + L.at('OX16'), 0x1200);
    ram.write8(X + L.at('OY16'), 100);
    ram.write16(L.at('BGL'), 0x1000);
    ram.write8(L.at('PLAXC'), 0x40);
    ram.write8(L.at('PLAYC'), 120);
    ram.write8(L.at('SEED'), 0x10);
    ram.write8(L.at('LSEED'), 0x10);
    const shells = createDefa7ShellRoutines(ram, L, null);
    return { ram, L, proc, U, X, shells,
        field: (p, n) => ram.read16(p + L.at(n)),
        addr: n => L.at(n) };
}
test('SHOOT uses source GETSHL, original source byte-aim and NE success return', () => {
    const s = setup();
    const shoot = createDefb6ShootRoutines(s.ram, s.L, { addresses, GETSHL: s.shells.GETSHL });
    assert.equal(shoot.SHOOT(s.X, s.U), true);
    const bullet = s.ram.read16(s.L.at('SPTR'));
    assert.ok(bullet !== 0);
    assert.equal(s.field(bullet, 'OPICT'), addresses.BMBP1);
    assert.equal(s.field(bullet, 'OCVECT'), addresses.BKIL);
    assert.equal(s.field(bullet, 'OBJCOL'), addresses.FBOUT);
    // new shell X byte: ((0x1200-0x1000)<<2)>>8 = 8. Aim 0x40-8 = 56, *4
    assert.equal(s16(s.field(bullet, 'OXV')), 224);
    assert.equal(s16(s.field(bullet, 'OYV')), 80);
    assert.equal(s.ram.read8(s.L.at('BMBCNT')), 1);
});
test('SHOOT seed>120 adds PLAXV*4 as original relative-speed branch', () => {
    const s = setup();
    s.ram.write8(s.addr('SEED'), 0x90);
    s.ram.write16(s.addr('PLAXV'), 0x0050);
    const shoot = createDefb6ShootRoutines(s.ram, s.L, { addresses, GETSHL: s.shells.GETSHL });
    shoot.SHOOT(s.X, s.U);
    const bullet = s.ram.read16(s.addr('SPTR'));
    assert.equal(s16(s.field(bullet, 'OXV')), 224 + 0x50 * 4);
});
test('SHOOT original zero return on shell limit: no projectile and no substituted logic', () => {
    const s = setup();
    s.ram.write8(s.addr('BMBCNT'), 20);
    const shoot = createDefb6ShootRoutines(s.ram, s.L, { addresses, GETSHL: s.shells.GETSHL });
    assert.equal(shoot.SHOOT(s.X, s.U), false);
    assert.equal(s.ram.read16(s.addr('SPTR')), 0);
});
test('LSHOT decrements byte timer and fires/sounds only on zero, source RMAX reload', () => {
    const s = setup();
    const sounds = [], calls = [];
    const shoot = createDefb6ShootRoutines(s.ram, s.L, { addresses, GETSHL: s.shells.GETSHL,
        RMAX: n => {
            calls.push(n);
            return 13;
        }, SNDLD: n => sounds.push(n) });
    s.ram.write8(s.U + s.addr('PD6'), 2);
    s.ram.write8(s.addr('LDSTIM'), 22);
    assert.equal(shoot.LSHOT(s.X, s.U), false);
    assert.equal(s.ram.read8(s.U + s.addr('PD6')), 1);
    assert.deepEqual(calls, []);
    assert.equal(shoot.LSHOT(s.X, s.U), true);
    assert.deepEqual(calls, [22]);
    assert.deepEqual(sounds, [addresses.LSHSND]);
    assert.equal(s.ram.read8(s.U + s.addr('PD6')), 13);
});
test('LSHOT with timer expired and no original RMAX throws a named boundary', () => {
    const s = setup();
    s.ram.write8(s.U + s.addr('PD6'), 1);
    const shoot = createDefb6ShootRoutines(s.ram, s.L, { addresses, GETSHL: s.shells.GETSHL });
    assert.throws(() => shoot.LSHOT(s.X, s.U), TranslationBoundaryError);
});
