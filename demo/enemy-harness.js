/**
 * Stage 12 diagnostic only. Original-named process routines run through the
 * original linked DISPATCH/SLEEP. RAM state is explicitly seeded by a test
 * fixture; this is NOT an implementation of Defender enemy wave spawning or
 * a replacement game loop. No alternative enemy steering logic exists here.
 *
 * Source entry addresses used below are synthetic identifiers and are NOT
 * asserted to be real Defender ROM addresses. Source names and field offsets
 * remain traceable 1:1 in original/defb6-ufo.js and defb6-swarm.js.
 */
import { RAM, Layout } from '../runtime/ram.js';
import { PHR6_SYMBOLS } from '../runtime/phr6-layout.js';
import { createDefa7Routines } from '../original/defa7.js';
import { createDefb6UfoRoutines } from '../original/defb6-ufo.js';
import { createDefb6SwarmerRoutines } from '../original/defb6-swarm.js';
import { createDefb6ShootRoutines } from '../original/defb6-shoot.js';
import { createDefa7ShellRoutines } from '../original/defa7-shells.js';
import { createDefa7RandomRoutines } from '../original/defa7-random.js';
import { createDefa7WaveExecutive } from '../original/defa7-wave-exec.js';
import { createDefa7SoundRoutines, soundTableFixture } from '../original/defa7-sound.js';
import { Continuations } from '../runtime/continuations.js';
import { s16 } from '../runtime/integers.js';
export const ENEMY_FIXTURE_IDENTIFIERS = Object.freeze({
    UFOLP: 0xf402, UFOP1: 0xf410, UFOP3: 0xf424, UFOKIL: 0xf430, NULOB: 0xff9d,
    USHSND: 0xf434, MSWM: 0xf440, MSWLP: 0xf442,
    SWPIC1: 0xf450, MSWKIL: 0xf452,
    FBOUT: 0xf460, BMBP1: 0xf462, BKIL: 0xf464, SWSSND: 0xf466
});
export function createSourceEnemyWorkbench() {
    const sourceSound = soundTableFixture({ base: 0x6000 });
    const addresses = { ...ENEMY_FIXTURE_IDENTIFIERS,
        USHSND: sourceSound.labels.USHSND, SWSSND: sourceSound.labels.SWSSND,
        LSHSND: sourceSound.labels.LSHSND };
    const layout = new Layout({ ...PHR6_SYMBOLS, ...addresses });
    const ram = new RAM(), proc = createDefa7Routines(ram, layout);
    const addr = n => layout.at(n), get8 = n => ram.read8(addr(n)), put8 = (n, v) => ram.write8(addr(n), v), get16 = n => ram.read16(addr(n)), put16 = (n, v) => ram.write16(addr(n), v), field = (p, n) => ram.read16(p + addr(n)), store = (p, n, v) => ram.write16(p + addr(n), v);
    const random = createDefa7RandomRoutines(ram, layout);
    const wave = createDefa7WaveExecutive(ram, layout, proc, { RAND: random.RAND });
    const sounds = createDefa7SoundRoutines(ram, layout, { readSourceByte: sourceSound.read8 });
    const shells = createDefa7ShellRoutines(ram, layout, null);
    const shooting = createDefb6ShootRoutines(ram, layout, { addresses, GETSHL: shells.GETSHL, RMAX: wave.RMAX, SNDLD: sounds.SNDLD });
    const ufo = createDefb6UfoRoutines(ram, layout, proc, { addresses,
        OBINIT: proc.OBINIT, SHOOT: shooting.SHOOT, RMAX: wave.RMAX, SNDLD: sounds.SNDLD });
    const swarm = createDefb6SwarmerRoutines(ram, layout, proc, { addresses,
        OBINIT: proc.OBINIT, RAND: random.RAND, RMAX: wave.RMAX, SHL: shells.GETSHL, SNDLD: sounds.SNDLD });
    const dispatch = new Continuations({ RAM: ram, Layout: layout, scheduler: proc });
    dispatch.register('UFOLP', ufo.UFOLP);
    dispatch.register('MSWM', swarm.MSWM);
    dispatch.register('MSWLP', swarm.MSWLP);
    let ticks = 0, refs = null;
    function fixtureObject(entry, picture, kill, col, x, y) {
        // This seeds *post-OBINIT* state for a diagnostic, not a translation of
        // UFO UFOST spawning/animation. Real APVCT is still untranslated.
        const U = proc.MKPROC(entry, addr('STYPE'));
        const X = proc.OBINIT(U, { OPICT: picture, OCVECT: kill, OBJCOL: col });
        store(U, 'PD', X);
        store(X, 'OBJID', U);
        store(X, 'OX16', x);
        store(X, 'OY16', y << 8);
        store(X, 'OXV', 0);
        store(X, 'OYV', 0);
        put16('OPTR', X); // only the fixture's own synthetic object chain
        return { U, X };
    }
    function RESET() {
        ram.clear(0, 0x10000);
        proc.PINIT();
        proc.OINIT();
        ticks = 0;
        put16('CRPROC', addr('ACTIVE'));
        put16('PLABX', 0x4000);
        put16('PLAXV', 0x0020);
        put16('PLAYV', 0);
        put16('BGL', 0x4200);
        put8('PLAYC', 100);
        put8('SEED', 0x10);
        put8('HSEED', 0x23);
        put8('LSEED', 0xb4);
        put8('UFOSK', 0);
        put8('UFSTIM', 16);
        put8('SWXV', 64);
        put8('SWSTIM', 16);
        const A = fixtureObject(addresses.UFOLP, addresses.UFOP1, addresses.UFOKIL, 0x3333, 0x4800, 130);
        ram.write8(A.U + addr('PD2'), 8); // UFOST: original LDA #8 / STA PD2,U initial shot timer
        // Original MMSW creates the swarmer from a synthetic centre object.
        // Only that centre object/seed values are diagnostic; process/object spawn
        // uses source MKPROC/OBINIT/RANDV/RMAX/PTIME, not a JS entity constructor.
        const centre = proc.GETOB();
        store(centre, 'OX16', 0x4400);
        store(centre, 'OY16', 115 << 8);
        swarm.MMSW(1, centre);
        const X = get16('OPTR'), U = field(X, 'OBJID');
        const B = { U, X };
        refs = { ufo: A, swarm: B };
        return STATE();
    }
    function STEP() {
        ticks++;
        const result = dispatch.resume(proc.DISP());
        if (result.kind !== 'end-of-dispatch')
            throw new Error('Enemy diagnostic failed source DISP boundary');
        return STATE();
    }
    function RUN(n = 1) {
        if (!Number.isInteger(n) || n < 1 || n > 240)
            throw new RangeError('RUN requires 1–240 DISP ticks');
        for (let i = 0; i < n; i++)
            STEP();
        return STATE();
    }
    function STATE() {
        const sample = ({ U, X }) => ({
            process: U, object: X, worldX: field(X, 'OX16'), height: ram.read8(X + addr('OY16')),
            vx: s16(field(X, 'OXV')), vy: s16(field(X, 'OYV')),
            image: field(X, 'OPICT'), next: field(U, 'PADDR'), time: ram.read8(U + addr('PTIME')),
            shotTimer: ram.read8(U + addr('PD4'))
        });
        return Object.freeze({ ticks, playerX: get16('PLABX'), playerY: get8('PLAYC'),
            activeShells: get8('BMBCNT'), soundPriority: get8('SNDPRI'),
            ufo: sample(refs.ufo), swarmer: sample(refs.swarm) });
    }
    RESET();
    return Object.freeze({ ram, layout, proc, dispatch, ufo, swarm, shooting, RESET, STEP, RUN, STATE });
}
