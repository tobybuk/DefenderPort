import test from 'node:test';
import assert from 'node:assert/strict';
import { RAM, Layout } from '../runtime/ram.js';
import { PHR6_SYMBOLS } from '../runtime/phr6-layout.js';
import { createDefa7Routines } from '../original/defa7.js';
import { createDefb6UfoRoutines } from '../original/defb6-ufo.js';
import { createDefb6SwarmerRoutines } from '../original/defb6-swarm.js';
import { createDefb6ProbeRoutines } from '../original/defb6-probe.js';
import { createDefb6TargetRoutines } from '../original/defb6-target.js';
import { Continuations, TranslationBoundaryError } from '../runtime/continuations.js';
import { s16, u8, u16 } from '../runtime/integers.js';
// Synthetic process/descriptor addresses exist only in these tests and the
// diagnostic harness, NOT in original game data or the translated algorithms.
const addresses = { UFOLP: 0xe002, UFOP1: 0xe010, UFOP3: 0xe024, UFOKIL: 0xe028, NULOB: 0xff9d,
    USHSND: 0xe070, MSWM: 0xe080, MSWLP: 0xe082, FBOUT: 0xe090, BMBP1: 0xe092,
    BKIL: 0xe094, SWSSND: 0xe096, SWPIC1: 0xe0a0, MSWKIL: 0xe0a2, PRBP1: 0xe0b0, PRBKIL: 0xe0b2 };
function setup() {
    const ram = new RAM(), L = new Layout({ ...PHR6_SYMBOLS, ...addresses });
    const P = createDefa7Routines(ram, L);
    P.PINIT();
    P.OINIT();
    const read = n => ram.read8(L.at(n)), write = (n, v) => ram.write8(L.at(n), v), word = n => ram.read16(L.at(n)), setword = (n, v) => ram.write16(L.at(n), v);
    const field = (p, n) => ram.read16(p + L.at(n)), setfield = (p, n, v) => ram.write16(p + L.at(n), v);
    function make(label = addresses.MSWLP) {
        const U = P.MKPROC(label, 0), X = P.GETOB();
        setfield(U, 'PD', X);
        setword('CRPROC', U);
        return { U, X };
    }
    return { ram, L, P, read, write, word, setword, field, setfield, make };
}
test('OBINIT preserves original 3-word OBI descriptor and owner, leaving OPTR unchanged', () => {
    const s = setup();
    const U = s.P.MKPROC(addresses.UFOLP, 0);
    const X = s.P.OBINIT(U, { OPICT: addresses.UFOP1, OCVECT: addresses.UFOKIL, OBJCOL: 0x3333 });
    assert.equal(s.field(X, 'OPICT'), addresses.UFOP1);
    assert.equal(s.field(X, 'OCVECT'), addresses.UFOKIL);
    assert.equal(s.field(X, 'OBJCOL'), 0x3333);
    assert.equal(s.field(X, 'OBJID'), U);
    assert.equal(s.word('OPTR'), 0);
    assert.equal(s.word('OFREE'), X + 23);
});
test('UFONV0 seeks distant player, using original XTEMP and sign-extended velocities', () => {
    const s = setup(), { X } = s.make();
    const u = createDefb6UfoRoutines(s.ram, s.L, s.P, { addresses });
    s.setword('PLABX', 0x1000);
    s.setword('PLAXV', 0x0120);
    s.write('PLAYC', 100);
    s.setword('PLAYV', 0x0020);
    s.setfield(X, 'OX16', 0x2000);
    s.ram.write8(X + s.L.at('OY16'), 120);
    u.UFONV0(X);
    assert.equal(s.field(X, 'OXV'), u16(0x0120 - 0x40));
    assert.equal(s.field(X, 'OYV'), u16(s16(0xff20) >> 1));
    assert.equal(s.word('XTEMP'), 0xc0ff);
});
test('UFONV0 retains horizontal velocity inside original +/-20 pixels close-zone', () => {
    const s = setup(), { X } = s.make(), u = createDefb6UfoRoutines(s.ram, s.L, s.P, { addresses });
    s.setword('PLABX', 0x2000);
    s.setfield(X, 'OX16', 0x2000);
    s.setfield(X, 'OXV', 0x789a);
    s.write('PLAYC', 90);
    s.ram.write8(X + s.L.at('OY16'), 90);
    s.setfield(X, 'OYV', 0x1111);
    u.UFONV0(X);
    assert.equal(s.field(X, 'OXV'), 0x789a);
    assert.equal(s.field(X, 'OYV'), 0x1111);
});
test('UFONV original seed threshold skips velocity update without touching RAM', () => {
    const s = setup(), { X } = s.make(), u = createDefb6UfoRoutines(s.ram, s.L, s.P, { addresses });
    s.write('SEED', 15);
    s.write('UFOSK', 15);
    s.setfield(X, 'OXV', 0x4444);
    u.UFONV(X);
    assert.equal(s.field(X, 'OXV'), 0x4444);
    s.write('SEED', 16);
    s.setfield(X, 'OX16', 0x3000);
    u.UFONV(X);
    assert.notEqual(s.field(X, 'OXV'), 0x4444);
});
test('UFOST uses original source NEWP+OBI, zero velocities, eight-shot timer and APVCT', () => {
    const s = setup();
    const appeared = [];
    s.setword('BGL', 0x1000);
    s.setword('SEED', 0x3456);
    s.setword('PLABX', 0x2000);
    s.write('PLAYC', 100);
    const u = createDefb6UfoRoutines(s.ram, s.L, s.P, { addresses, OBINIT: s.P.OBINIT, APVCT: X => appeared.push(X) });
    const { process: U, object: X } = u.UFOST();
    const spawnWorld = u16(0x2456);
    assert.equal(s.field(X, 'OX16'), spawnWorld);
    assert.equal(s.ram.read8(X + s.L.at('OY16')), u8(42 + ((spawnWorld & 0xff) >>> 1)));
    assert.equal(s.field(U, 'PD'), X);
    assert.equal(s.ram.read8(U + s.L.at('PD2')), 8);
    assert.equal(s.field(X, 'OBJID'), U);
    assert.equal(s.field(X, 'OPICT'), addresses.UFOP1);
    assert.equal(s.field(X, 'OCVECT'), addresses.UFOKIL);
    assert.deepEqual(appeared, [X]);
});
test('UFOST halts at untranslated appearance rather than silently inventing it', () => {
    const s = setup();
    const u = createDefb6UfoRoutines(s.ram, s.L, s.P, { addresses, OBINIT: s.P.OBINIT });
    assert.throws(() => u.UFOST(), TranslationBoundaryError);
});
test('UFOLP decrements source shot timer and NAPs six ticks, no frame counter', () => {
    const s = setup(), { U, X } = s.make(addresses.UFOLP), sounds = [], shots = [];
    s.setfield(X, 'OPICT', addresses.UFOP1);
    s.ram.write8(U + s.L.at('PD2'), 1);
    s.write('UFSTIM', 30);
    s.write('SEED', 0);
    s.write('UFOSK', 255);
    const u = createDefb6UfoRoutines(s.ram, s.L, s.P, { addresses, RMAX: () => 7, SHOOT: x => {
            shots.push(x);
            return true;
        }, SNDLD: x => sounds.push(x) });
    const outcome = u.UFOLP();
    assert.equal(outcome.kind, 'end-of-dispatch');
    assert.deepEqual(shots, [X]);
    assert.deepEqual(sounds, [addresses.USHSND]);
    assert.equal(s.ram.read8(U + s.L.at('PD2')), 7);
    assert.equal(s.field(X, 'OPICT'), addresses.UFOP1 + s.L.at('OBJL'));
    assert.equal(s.ram.read8(U + s.L.at('PTIME')), 6);
    assert.equal(s.field(U, 'PADDR'), addresses.UFOLP);
});
test('UFOLP NULOB appearance state skips firing and animation', () => {
    const s = setup(), { U, X } = s.make(addresses.UFOLP);
    s.setfield(X, 'OPICT', addresses.NULOB);
    s.ram.write8(U + s.L.at('PD2'), 8);
    const u = createDefb6UfoRoutines(s.ram, s.L, s.P, { addresses });
    u.UFOLP();
    assert.equal(s.ram.read8(U + s.L.at('PD2')), 8);
    assert.equal(s.field(X, 'OPICT'), addresses.NULOB);
});
test('UFOLP image wrap is the only point that invokes gated UFONV', () => {
    const s = setup(), { X } = s.make(addresses.UFOLP);
    s.write('SEED', 250);
    s.write('UFOSK', 0);
    s.setfield(X, 'OPICT', addresses.UFOP3);
    s.setword('PLABX', 0x1000);
    s.setfield(X, 'OX16', 0x3000);
    s.write('PLAYC', 80);
    s.ram.write8(X + s.L.at('OY16'), 120);
    const u = createDefb6UfoRoutines(s.ram, s.L, s.P, { addresses });
    u.UFOLP();
    assert.equal(s.field(X, 'OPICT'), addresses.UFOP1);
    assert.notEqual(s.field(X, 'OXV'), 0);
});
test('RANDV sign-extends and doubles original 8-bit SEED, masks LSEED', () => {
    const s = setup(), { X } = s.make(), calls = [];
    const sw = createDefb6SwarmerRoutines(s.ram, s.L, s.P, { addresses, RAND: () => {
            calls.push('RAND');
            s.write('SEED', 0xf0);
            s.write('LSEED', 0xff);
        } });
    sw.RANDV(X);
    assert.deepEqual(calls, ['RAND']);
    assert.equal(s16(s.field(X, 'OYV')), -32);
    assert.equal(s16(s.field(X, 'OXV')), 31);
});
test('MSWM points left or right using original unsigned CMPY then NAP 3', () => {
    const s = setup(), { U, X } = s.make();
    s.write('SWXV', 0x40);
    const sw = createDefb6SwarmerRoutines(s.ram, s.L, s.P, { addresses });
    s.setword('PLABX', 0x3000);
    s.setfield(X, 'OX16', 0x4000);
    sw.MSWM();
    assert.equal(s16(s.field(X, 'OXV')), -64);
    assert.equal(s.ram.read8(U + s.L.at('PTIME')), 3);
    s.setword('PLABX', 0x5000);
    sw.MSWM();
    assert.equal(s16(s.field(X, 'OXV')), 64);
});
test('MSWLP follows exact signed clamp, complement-shift damping and random factor', () => {
    const s = setup(), { U, X } = s.make();
    s.write('PLAYC', 130);
    s.ram.write8(X + s.L.at('OY16'), 120);
    s.ram.write8(U + s.L.at('PD2'), 64);
    s.ram.write8(U + s.L.at('PD4'), 8);
    s.setword('PLABX', 0x2200);
    s.setfield(X, 'OX16', 0x2300);
    s.setfield(X, 'OYV', 0x01f0);
    s.write('SEED', 0x10);
    const sw = createDefb6SwarmerRoutines(s.ram, s.L, s.P, { addresses });
    sw.MSWLP();
    // clamp to 0x200; COM 0xfdff <<2 = 0xf7fc, high = -9 => 0x1f7
    assert.equal(s16(s.field(X, 'OYV')), 0x1f7);
    assert.equal(s.ram.read8(U + s.L.at('PD4')), 7);
});
test('MSWLP at fire deadline fails at untranslated SWBMB dependency, not an invented projectile', () => {
    const s = setup(), { U, X } = s.make();
    s.ram.write8(U + s.L.at('PD4'), 1);
    s.setword('PLABX', 0x2000);
    s.setfield(X, 'OX16', 0x2000);
    const sw = createDefb6SwarmerRoutines(s.ram, s.L, s.P, { addresses });
    assert.throws(() => sw.MSWLP(), TranslationBoundaryError);
});
test('SWBMB source heading test prevents spawning when moving away, but resets timer', () => {
    const s = setup(), { U, X } = s.make(), shots = [];
    s.setword('PLABX', 0x2000);
    s.setfield(X, 'OX16', 0x1000);
    s.setfield(X, 'OXV', 0xffc0);
    s.write('SWSTIM', 21);
    const sw = createDefb6SwarmerRoutines(s.ram, s.L, s.P, { addresses, RMAX: () => 5, SHL: () => {
            shots.push(1);
            return 0;
        } });
    sw.SWBMB(X, U);
    assert.deepEqual(shots, []);
    assert.equal(s.ram.read8(U + s.L.at('PD4')), 5);
});
test('SWBMB original 8x x-speed and signed 5-bit y-aiming on newly allocated shell', () => {
    const s = setup(), { U, X } = s.make(), shell = s.P.GETOB(), sounds = [];
    s.setword('PLABX', 0x4000);
    s.setfield(X, 'OX16', 0x3000);
    s.setfield(X, 'OXV', 0x0030);
    s.write('PLAYC', 120);
    s.ram.write8(shell + s.L.at('OY16'), 100);
    const sw = createDefb6SwarmerRoutines(s.ram, s.L, s.P, { addresses, RMAX: () => 3, SHL: () => shell, SNDLD: val => sounds.push(val) });
    sw.SWBMB(X, U);
    assert.equal(s.field(shell, 'OXV'), 0x0180);
    assert.equal(s16(s.field(shell, 'OYV')), s16(20 << 8) >> 5);
    assert.deepEqual(sounds, [addresses.SWSSND]);
    assert.equal(s.ram.read8(U + s.L.at('PD4')), 3);
});
test('GTARG traverses TLIST by two bytes, wraps 64 byte ring and records target offsets', () => {
    const s = setup(), { U } = s.make();
    s.write('ASTCNT', 2);
    s.setword('TPTR', s.L.at('TLIST') + 62);
    s.ram.write16(s.L.at('TLIST') + 2, 0x9001);
    s.ram.write16(s.L.at('TLIST') + 18, 0x9002);
    const target = createDefb6TargetRoutines(s.ram, s.L);
    assert.equal(target.GTARG(U), 0x9001);
    assert.equal(s.word('TPTR'), s.L.at('TLIST') + 2);
    assert.equal(s.field(U, 'PD2'), 0x9001);
    assert.equal(s.field(U, 'PD4'), s.L.at('TLIST') + 2);
    assert.equal(target.GTARG(U), 0x9002);
});
test('GTARG with zero ASTCNT leaves target pointers untouched; absent slots terminate', () => {
    const s = setup(), { U } = s.make();
    s.setword('TPTR', s.L.at('TLIST'));
    s.setfield(U, 'PD2', 0xdead);
    const target = createDefb6TargetRoutines(s.ram, s.L);
    assert.equal(target.GTARG(U), 0);
    assert.equal(s.field(U, 'PD2'), 0xdead);
    s.write('ASTCNT', 1);
    assert.equal(target.GTARG(U), 0);
    assert.equal(s.word('TPTR'), s.L.at('TLIST'));
});
test('MMSW creates exact source process and object links, original velocity and per-process delay', () => {
    const s = setup();
    const Y = s.P.GETOB();
    s.setfield(Y, 'OX16', 0x4120);
    s.setfield(Y, 'OY16', 0x8120);
    s.write('SWCNT', 0);
    s.write('SWAC', 0x1f);
    s.write('SWSTIM', 20);
    const sw = createDefb6SwarmerRoutines(s.ram, s.L, s.P, { addresses,
        OBINIT: s.P.OBINIT, RAND: () => {
            s.write('HSEED', 0x23);
            s.write('LSEED', 0x54);
            s.write('SEED', 0x12);
        }, RMAX: () => 7 });
    assert.equal(sw.MMSW(2, Y), 2);
    assert.equal(s.read('SWCNT'), 2);
    const second = s.word('OPTR'), first = s.field(second, 'OLINK');
    assert.ok(first && second !== first);
    for (const X of [first, second]) {
        assert.equal(s.field(X, 'OX16'), 0x4120);
        assert.equal(s.field(X, 'OY16'), 0x8120);
        const U = s.field(X, 'OBJID');
        assert.ok(U);
        assert.equal(s.field(U, 'PD'), X);
        assert.equal(s.field(U, 'PADDR'), addresses.MSWM);
        assert.equal(s.ram.read8(U + s.L.at('PD2')), 0x54 & 0x1f);
        assert.equal(s.ram.read8(U + s.L.at('PD4')), 7);
        assert.equal(s.ram.read8(U + s.L.at('PTIME')), 0x23 & 0x1f);
        assert.equal(s.field(X, 'OPICT'), addresses.SWPIC1);
        assert.equal(s.field(X, 'OBJCOL'), 0x2424);
        assert.equal(s16(s.field(X, 'OYV')), 0x12 * 2);
    }
});
test('MMSW source cap of 20 prevents a new process or object after 20th swarmer', () => {
    const s = setup();
    const Y = s.P.GETOB();
    s.write('SWCNT', 19);
    s.write('SWAC', 255);
    const sw = createDefb6SwarmerRoutines(s.ram, s.L, s.P, { addresses,
        OBINIT: s.P.OBINIT, RAND: () => {
        }, RMAX: () => 4 });
    assert.equal(sw.MMSW(4, Y), 1);
    assert.equal(s.read('SWCNT'), 20);
    let n = 0;
    for (let p = s.word('OPTR'); p; p = s.field(p, 'OLINK'))
        n++;
    assert.equal(n, 1);
});
test('MMSW requires original OBI and RMAX; no substitute spawns or shooting', () => {
    const s = setup();
    const Y = s.P.GETOB();
    const sw = createDefb6SwarmerRoutines(s.ram, s.L, s.P, { addresses });
    assert.throws(() => sw.MMSW(1, Y), TranslationBoundaryError);
});
test('PRBST uses original OBI, RAND seed mask and B/SEX sign-extension for pod velocities', () => {
    const s = setup();
    const U = s.P.MKPROC(addresses.MSWM, 0);
    s.setword('CRPROC', U);
    const appearances = [];
    const probe = createDefb6ProbeRoutines(s.ram, s.L, { addresses, OBINIT: s.P.OBINIT,
        RAND: () => {
            s.write('HSEED', 0x35);
            s.write('LSEED', 0x7f);
            s.write('SEED', 0x2a);
        },
        APVCT: X => appearances.push(X) });
    const objects = probe.PRBST(3, U);
    assert.equal(objects.length, 3);
    assert.deepEqual(appearances, objects);
    assert.equal(s.read('XTEMP'), 0);
    for (const X of objects) {
        assert.equal(s.field(X, 'OX16'), 0x457f);
        assert.equal(s.ram.read8(X + s.L.at('OY16')), 42 + (0x7f >>> 1));
        assert.equal(s16(s.field(X, 'OXV')), 0x2a - 0x20);
        assert.equal(s16(s.field(X, 'OYV')), 0x3f); // B=(0x7F-0x40)|0x20
        assert.equal(s.field(X, 'OPICT'), addresses.PRBP1);
        assert.equal(s.field(X, 'OCVECT'), addresses.PRBKIL);
        assert.equal(s.field(X, 'OBJCOL'), 0xcccc);
    }
});
test('PRBST negative seed channel clears source $20 bit and keeps negative high byte', () => {
    const s = setup();
    const U = s.P.MKPROC(addresses.MSWM, 0);
    s.setword('CRPROC', U);
    const probe = createDefb6ProbeRoutines(s.ram, s.L, { addresses, OBINIT: s.P.OBINIT,
        RAND: () => {
            s.write('LSEED', 0x20);
        }, APVCT: () => {
        } });
    const [X] = probe.PRBST(1, U);
    assert.equal(s16(s.field(X, 'OYV')), -64); // -32 byte E0 -> C0 by ANDB #$DF
});
test('PRBST throws instead of inventing missing original appearance', () => {
    const s = setup();
    const U = s.P.MKPROC(addresses.MSWM, 0);
    s.setword('CRPROC', U);
    const probe = createDefb6ProbeRoutines(s.ram, s.L, { addresses, OBINIT: s.P.OBINIT, RAND: () => {
        } });
    assert.throws(() => probe.PRBST(1, U), TranslationBoundaryError);
});
test('MMSW source zero A means wraparound countdown, stopping at 20 swarmer cap', () => {
    const s = setup(), Y = s.P.GETOB();
    s.write('SWCNT', 19);
    const sw = createDefb6SwarmerRoutines(s.ram, s.L, s.P, { addresses,
        OBINIT: s.P.OBINIT, RAND: () => {
        }, RMAX: () => 2 });
    assert.equal(sw.MMSW(0, Y), 1);
    assert.equal(s.read('SWCNT'), 20);
});
test('PRBST source zero A does not invent a zero-spawn special case', () => {
    const s = setup();
    const U = s.P.MKPROC(addresses.MSWM, 0);
    s.setword('CRPROC', U);
    const probe = createDefb6ProbeRoutines(s.ram, s.L, { addresses,
        OBINIT: s.P.OBINIT, RAND: () => {
        }, APVCT: () => {
        } });
    // Original DEC counter wraps to 255, then runs past 95 object slots.
    assert.throws(() => probe.PRBST(0, U), /out of object cells/);
});
