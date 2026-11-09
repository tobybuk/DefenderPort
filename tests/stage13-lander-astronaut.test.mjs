import test from 'node:test';
import assert from 'node:assert/strict';
import { RAM, Layout } from '../runtime/ram.js';
import { PHR6_SYMBOLS } from '../runtime/phr6-layout.js';
import { createDefa7Routines } from '../original/defa7.js';
import { createDefb6LanderRoutines } from '../original/defb6-lander.js';
import { createDefb6AstronautRoutines } from '../original/defb6-astronaut.js';
import { createDefb6TargetRoutines } from '../original/defb6-target.js';
import { TranslationBoundaryError } from '../runtime/continuations.js';
import { u16, s16 } from '../runtime/integers.js';
// Diagnostic ONLY: source labels mapped to distinct synthetic code-space IDs;
// game modules do not contain any of these numeric constants.
const addr = { LANDS0: 0xe101, LANDG: 0xe103, LANDF: 0xe105, LNDFXA: 0xe107,
    LKILL: 0xe109, LKIL1: 0xe10b, LNDP1: 0xe110, LNDP3: 0xe124, NULOB: 0xefd0,
    LPKSND: 0xe130, LSKSND: 0xe132, ASTKIL: 0xe140, AKIL1: 0xe142,
    SCZP1: 0xe150, SCZKIL: 0xe154, SCZ0: 0xe156, SSHSND: 0xe158,
    TERBLO: 0xe162, ASTRO: 0xe164, ASTP1: 0xe170, ASTP2: 0xe17a,
    ASTP3: 0xe184, ASTP4: 0xe18e, AFALL: 0xe190, AFALL2: 0xe192,
    P250: 0xe194, P500: 0xe196, ASXP1: 0xe198, AHSND: 0xe19a, ALSND: 0xe19c, ASCSND: 0xe19e, LHSND: 0xe1a0 };
function setup() {
    const ram = new RAM(), L = new Layout({ ...PHR6_SYMBOLS, ...addr });
    const P = createDefa7Routines(ram, L);
    P.PINIT();
    P.OINIT();
    const read = n => ram.read8(L.at(n)), write = (n, v) => ram.write8(L.at(n), v), word = n => ram.read16(L.at(n)), setword = (n, v) => ram.write16(L.at(n), v), byte = (x, n) => ram.read8(x + L.at(n)), putbyte = (x, n, v) => ram.write8(x + L.at(n), v), field = (x, n) => ram.read16(x + L.at(n)), putfield = (x, n, v) => ram.write16(x + L.at(n), v);
    const work = (name) => {
        const U = P.MKPROC(addr[name], L.at('STYPE'));
        setword('CRPROC', U);
        return U;
    };
    const astronaut = () => {
        const X = P.GETOB();
        putfield(X, 'OX16', 0x4600);
        putbyte(X, 'OY16', 160);
        putbyte(X, 'OBJX', 9);
        putfield(X, 'OPICT', addr.ASTP1);
        putfield(X, 'OCVECT', addr.ASTKIL);
        setword('TLIST', X);
        setword('TPTR', L.at('TLIST') + 62);
        write('ASTCNT', 1);
        return X;
    };
    const lander = (U, Y = 0) => {
        const X = P.GETOB();
        putfield(X, 'OX16', 0x4400);
        putbyte(X, 'OY16', 100);
        putfield(X, 'OPICT', addr.LNDP1);
        putfield(X, 'OCVECT', addr.LKILL);
        putfield(X, 'OBJID', U);
        putfield(U, 'PD', X);
        putfield(U, 'PD2', Y);
        putfield(U, 'PD4', L.at('TLIST'));
        return X;
    };
    const events = [], altitude = () => 180;
    const makeLander = (options = {}) => createDefb6LanderRoutines(ram, L, P, {
        addresses: addr, GETALT: altitude, RAND: () => {
        }, RMAX: A => A,
        GTARG: createDefb6TargetRoutines(ram, L).GTARG,
        LSHOT: () => {
            events.push('LSHOT');
            return false;
        },
        SNDLD: A => events.push(['SNDLD', A]), SNDOUT: A => events.push(['SNDOUT', A]),
        ...options
    });
    const makeAstronaut = (options = {}) => createDefb6AstronautRoutines(ram, L, P, {
        addresses: addr, readAltitude: () => 180, KILOFF: () => events.push('KILOFF'),
        XSVCT: () => events.push('XSVCT'), SNDLD: A => events.push(['SNDLD', A]), ...options
    });
    setword('LNDYV', 0x0020);
    write('LDSTIM', 8);
    write('LNDXV', 12);
    return { ram, L, P, read, write, word, setword, byte, putbyte, field, putfield,
        work, astronaut, lander, makeLander, makeAstronaut, events };
}
test('GETALT uses original six 6809 two-byte shifts, no pixel-coordinate float', () => {
    const s = setup(), X = s.P.GETOB(), seen = [], a = s.makeAstronaut({ readAltitude: i => {
            seen.push(i);
            return i & 255;
        } });
    s.putfield(X, 'OX16', 0x1234);
    assert.equal(a.GETALT(X), 0x48);
    assert.deepEqual(seen, [0x48]);
});
test('LANDS0 descent above terrain stores source LNDYV; NAP six to original LANDSO', () => {
    const s = setup(), U = s.work('LANDS0'), Y = s.astronaut(), X = s.lander(U, Y);
    s.write('PLAYC', 110);
    s.putfield(X, 'OX16', 0x4000);
    const l = s.makeLander();
    const end = l.LANDS0();
    assert.equal(end.kind, 'end-of-dispatch');
    assert.equal(s.field(X, 'OYV'), 0x20);
    assert.equal(s.byte(U, 'PTIME'), 6);
    assert.equal(s.field(U, 'PADDR'), addr.LANDS0);
    assert.equal(s.field(X, 'OPICT'), addr.LNDP1 + s.L.at('OBJL'));
});
test('LANDS0 terrain-relative steering distinguishes descending, near-enough, rising', () => {
    const s = setup(), U = s.work('LANDS0'), Y = s.astronaut(), X = s.lander(U, Y);
    const l = s.makeLander();
    s.putbyte(X, 'OY16', 80);
    l.LANDSA(U);
    assert.equal(s.field(X, 'OYV'), 0x20);
    s.putbyte(X, 'OY16', 130);
    s.setword('CRPROC', U);
    l.LANDSA(U);
    assert.equal(s.field(X, 'OYV'), 0);
    s.putbyte(X, 'OY16', 170);
    s.setword('CRPROC', U);
    l.LANDSA(U);
    assert.equal(s.field(X, 'OYV'), 0xffdf);
});
test('LANDS0 skips laser and animation in original NULOB appearance state', () => {
    const s = setup(), U = s.work('LANDS0'), X = s.lander(U), l = s.makeLander();
    s.putfield(X, 'OPICT', addr.NULOB);
    l.LANDSA(U);
    assert.equal(s.field(X, 'OPICT'), addr.NULOB);
    assert.deepEqual(s.events, []);
});
test('LANDS0 invalid target uses original GTARG circular list', () => {
    const s = setup(), U = s.work('LANDS0'), Y = s.astronaut(), X = s.lander(U, Y), l = s.makeLander();
    s.putfield(U, 'PD2', 0);
    s.putfield(U, 'PD4', s.L.at('TLIST') + 2);
    l.LANDS0();
    assert.equal(s.field(U, 'PD2'), Y);
    assert.equal(s.field(U, 'PD4'), s.L.at('TLIST'));
    assert.equal(s.field(X, 'OTYP') & 1, 0);
});
test('LANDST must stop at missing original APVCT, not fabricate an appearance', () => {
    const s = setup();
    s.write('ASTCNT', 1);
    const l = s.makeLander({ OBINIT: s.P.OBINIT });
    assert.throws(() => l.LANDST(1), TranslationBoundaryError);
});
test('LANDST source allocation, seed, timer, and odd one-complement velocity', () => {
    const s = setup(), Y = s.astronaut();
    let calls = 0, appear = [];
    s.setword('HSEED', 0x4567);
    s.setword('PLABX', 0x2200);
    const l = s.makeLander({ OBINIT: s.P.OBINIT, APVCT: X => appear.push(X),
        RAND: () => {
            calls++;
        }, RMAX: A => A === 12 ? 3 : 7 });
    const made = l.LANDST(1);
    const { process: U, object: X } = made[0];
    assert.equal(s.field(X, 'OX16'), 0x4567);
    assert.equal(s.byte(X, 'OY16'), 44);
    assert.equal(s.field(X, 'OYV'), 0x20);
    assert.equal(s.field(X, 'OXV'), 0xfffc);
    assert.equal(s.byte(U, 'PD6'), 7);
    assert.equal(s.field(U, 'PD2'), Y);
    assert.equal(s.read('LNDCNT'), 1);
    assert.equal(calls, 1);
    assert.deepEqual(appear, [X]);
});
test('LANDG0 zeroes source velocities and enters 1-tick alignment', () => {
    const s = setup(), U = s.work('LANDS0'), Y = s.astronaut(), X = s.lander(U, Y), l = s.makeLander();
    s.putfield(X, 'OXV', 99);
    s.putfield(X, 'OYV', 99);
    l.LANDG0(U);
    assert.equal(s.field(X, 'OXV'), 0);
    assert.equal(s.field(X, 'OYV'), 0);
    assert.equal(s.byte(X, 'OTYP'), 1);
    assert.equal(s.field(U, 'PADDR'), addr.LANDG);
});
test('LANDG horizontal seek moves exactly one source world unit ($20)', () => {
    const s = setup(), U = s.work('LANDS0'), Y = s.astronaut(), X = s.lander(U, Y), l = s.makeLander();
    s.putfield(X, 'OX16', 0x4300);
    s.putbyte(X, 'OY16', 130);
    s.putbyte(Y, 'OY16', 150);
    l.LANDG(U);
    assert.equal(s.field(X, 'OX16'), 0x4320);
    assert.equal(s.field(U, 'PADDR'), addr.LANDG);
    assert.equal(s.byte(U, 'PTIME'), 1);
});
test('LANDG3 attaches astronaut with original kill vectors and one-complement ascent', () => {
    const s = setup(), U = s.work('LANDS0'), Y = s.astronaut(), X = s.lander(U, Y), l = s.makeLander();
    s.putfield(X, 'OX16', 0x4600);
    s.putbyte(X, 'OY16', 148);
    l.LANDG(U);
    assert.equal(s.field(X, 'OCVECT'), addr.LKIL1);
    assert.equal(s.field(Y, 'OCVECT'), addr.AKIL1);
    assert.equal(s.field(X, 'OYV'), 0xffdf);
    assert.equal(s.field(Y, 'OYV'), 0xffdf);
    assert.equal(s.field(U, 'PADDR'), addr.LANDF);
    assert.equal(s.byte(U, 'PTIME'), 4);
    assert.ok(s.events.some(e => Array.isArray(e) && e[1] === addr.LPKSND));
});
test('LANDFX/LNDFXA pulls human up one pixel and uses original $12 sound byte', () => {
    const s = setup(), U = s.work('LANDS0'), Y = s.astronaut(), X = s.lander(U, Y), l = s.makeLander();
    s.putbyte(X, 'OY16', 49);
    s.putbyte(Y, 'OY16', 90);
    l.LANDFX(U);
    assert.equal(s.byte(Y, 'OY16'), 89);
    assert.equal(s.field(U, 'PADDR'), addr.LNDFXA);
    assert.ok(s.events.includes('LSHOT') === false);
    assert.deepEqual(s.events.slice(-2), [['SNDLD', addr.LSKSND], ['SNDOUT', 0x12]]);
});
test('SCZ00 changes source lander counters, picture, colours, vector, and falls into SCZ0', () => {
    const s = setup(), U = s.work('LANDS0'), X = s.lander(U), l = s.makeLander();
    s.write('LNDCNT', 1);
    s.write('SCZCNT', 0);
    s.write('SZSTIM', 15);
    s.setword('PLABX', s.field(X, 'OX16'));
    s.write('PLAYC', 120);
    s.setword('SZYV', 0x10);
    s.write('SZXV', 4);
    l.SCZ00(U);
    assert.equal(s.read('LNDCNT'), 0);
    assert.equal(s.read('SCZCNT'), 1);
    assert.equal(s.field(X, 'OPICT'), addr.SCZP1);
    assert.equal(s.field(X, 'OBJCOL'), 0xcc33);
    assert.equal(s.field(X, 'OCVECT'), addr.SCZKIL);
    assert.equal(s.field(U, 'PADDR'), addr.SCZ0);
});
test('SCZ0 distant and close X follow original avoidance/seek branches, NAP three', () => {
    const s = setup(), U = s.work('LANDS0'), X = s.lander(U), l = s.makeLander();
    s.setword('PLABX', 0x4000);
    s.write('PLAYC', 100);
    s.setword('SZYV', 0x100);
    s.write('SZXV', 8);
    s.putfield(X, 'OX16', 0x6000);
    s.putbyte(X, 'OY16', 105);
    s.write('SEED', 0);
    s.write('SZRY', 0);
    l.SCZ0(U);
    assert.equal(s.field(X, 'OYV'), 0x100);
    assert.equal(s.byte(U, 'PTIME'), 3);
    s.putfield(X, 'OX16', 0x4000);
    s.putbyte(X, 'OBJX', 5);
    s.setword('CRPROC', U);
    l.SCZ0(U);
    assert.equal(s.field(X, 'OYV'), 0xfeff);
});
test('ASTRO scans original 16 target slots and walks source $20 in world X', () => {
    const s = setup(), U = s.work('ASTRO'), X = s.astronaut(), a = s.makeAstronaut();
    s.putfield(U, 'PD', s.L.at('TLIST') + 30);
    s.write('SEED', 30);
    a.ASTRO();
    assert.equal(s.field(U, 'PD'), s.L.at('TLIST'));
    assert.equal(s.field(X, 'OX16'), 0x45e0);
    assert.equal(s.byte(U, 'PTIME'), 2);
});
test('ASTRO reverses walking sprite when source SEED <=8, no custom timer', () => {
    const s = setup(), U = s.work('ASTRO'), X = s.astronaut(), a = s.makeAstronaut();
    s.putfield(U, 'PD', s.L.at('TLIST') - 2);
    s.write('SEED', 8);
    a.ASTRO();
    assert.equal(s.field(X, 'OPICT'), addr.ASTP3);
    assert.equal(s.field(X, 'OX16'), 0x4620);
});
test('ASTKIL suppresses player death while PCFLG nonzero', () => {
    const s = setup(), X = s.astronaut(), a = s.makeAstronaut();
    s.write('PCFLG', 1);
    assert.equal(a.ASTKIL(X), false);
    assert.equal(s.read('ASTCNT'), 1);
});
test('ASTCLR source removes from TLIST and spawns original TERBLO after last human', () => {
    const s = setup(), X = s.astronaut(), a = s.makeAstronaut();
    assert.equal(a.ASTCLR(X), true);
    assert.equal(s.word('TLIST'), 0);
    assert.equal(s.read('ASTCNT'), 0);
    assert.equal(s.field(s.P.MKPROC(addr.ASTRO, 0), 'PTYPE'), 0);
});
test('ASTK1 uses original erase, explosion switch, sound (unported callbacks required)', () => {
    const s = setup(), X = s.astronaut(), a = s.makeAstronaut();
    a.ASTK1(X);
    assert.equal(s.field(X, 'OPICT'), addr.ASXP1);
    assert.equal(s.field(X, 'OX16'), 0x45c0);
    assert.deepEqual(s.events, ['KILOFF', 'XSVCT', ['SNDLD', addr.AHSND]]);
});
test('AFALL accelerates by 8 and yields 4 ticks while above terrain', () => {
    const s = setup(), U = s.work('AFALL'), X = s.astronaut(), a = s.makeAstronaut();
    s.putfield(U, 'PD', X);
    s.putbyte(X, 'OY16', 140);
    a.AFALL();
    assert.equal(s.field(X, 'OYV'), 8);
    assert.equal(s.byte(U, 'PTIME'), 4);
    assert.equal(s.field(U, 'PADDR'), addr.AFALL);
});
test('AFALL2 source pickup puts astronaut at player+0x80 and yields 1 if airborne', () => {
    const s = setup(), U = s.work('AFALL2'), X = s.astronaut(), a = s.makeAstronaut();
    s.putfield(U, 'PD', X);
    s.setword('PLABX', 0x1200);
    s.write('PLAY16', 100);
    a.AFALL2();
    assert.equal(s.field(X, 'OX16'), 0x1280);
    assert.equal(s.byte(X, 'OY16'), 110);
    assert.equal(s.field(U, 'PADDR'), addr.AFALL2);
});
test('GETALT fails at missing original altitude table, not guessed ground height', () => {
    const s = setup(), X = s.P.GETOB();
    const a = s.makeAstronaut({ readAltitude: undefined });
    assert.throws(() => a.GETALT(X), TranslationBoundaryError);
});
test('LKIL1 source passenger death creates the AFALL process and preserves target pointer', () => {
    const s = setup(), U = s.work('LANDS0'), Y = s.astronaut(), X = s.lander(U, Y);
    const kills = [], l = s.makeLander({ KILP: (x, score, sound) => kills.push({ x, score, sound }) });
    s.write('LNDCNT', 1);
    s.putfield(Y, 'OYV', 0xff40);
    l.LKIL1(X);
    assert.equal(s.read('LNDCNT'), 0);
    assert.equal(kills.length, 1);
    assert.equal(kills[0].score, 0x115);
    assert.equal(kills[0].sound, addr.LHSND);
    const falling = s.field(Y, 'OBJID');
    assert.notEqual(falling, U);
    assert.equal(s.field(falling, 'PD'), Y);
    assert.equal(s.field(falling, 'PADDR'), addr.AFALL);
    assert.equal(s.field(Y, 'OYV'), 0);
    assert.deepEqual(s.events, [['SNDLD', addr.ASCSND]]);
});
test('LKILL refuses unported source KILPOS macro instead of inventing score and destruction', () => {
    const s = setup(), U = s.work('LANDS0'), X = s.lander(U), l = s.makeLander();
    s.write('LNDCNT', 1);
    assert.throws(() => l.LKILL(X), TranslationBoundaryError);
    assert.equal(s.read('LNDCNT'), 0);
});
test('LANDST no-target path transfers to source SCZS0, not a fabricated lander', () => {
    const s = setup();
    let count = 0;
    const l = s.makeLander({ SCZS0: n => {
            count = n;
            return 'SCZS0';
        } });
    assert.equal(l.LANDST(3), 'SCZS0');
    assert.equal(count, 3);
    assert.equal(s.read('LNDCNT'), 0);
});
test('LANDS0 source compares LOW collision-vector byte (OCVECT+1), not full address or high byte', () => {
    const s = setup(), U = s.work('LANDS0'), Y = s.astronaut(), X = s.lander(U, Y);
    s.putfield(X, 'OX16', 0x4300);
    s.putfield(Y, 'OX16', 0x4700);
    // A different bank address with identical low byte still passes the original test.
    s.putfield(Y, 'OCVECT', 0xd140);
    const l = s.makeLander({ GTARG: () => {
            throw Error('Wrongly rejected original low-byte match');
        } });
    l.LANDS0();
    assert.equal(s.field(U, 'PADDR'), addr.LANDS0);
});
