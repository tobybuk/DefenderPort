/**
 * Stage 13 DIAGNOSTIC ONLY. It seeds initial original RAM records for one
 * astronaut and one lander; it does NOT replace source LANDST/APVCT game startup.
 * Then every process update is a translated original ASTRO / LANDS0 / LANDG...
 * via original DISP/SLEEP; objects advance through translated VELO. The
 * DISP-vs-VELO frequency here is a workbench control, not arcade timing.
 */
import { RAM, Layout } from '../runtime/ram.js';
import { PHR6_SYMBOLS } from '../runtime/phr6-layout.js';
import { createDefa7Routines } from '../original/defa7.js';
import { createDefa7PlayerRoutines } from '../original/defa7-player.js';
import { createDefa7RandomRoutines } from '../original/defa7-random.js';
import { createDefa7WaveExecutive } from '../original/defa7-wave-exec.js';
import { createDefa7ShellRoutines } from '../original/defa7-shells.js';
import { createDefb6ShootRoutines } from '../original/defb6-shoot.js';
import { createDefb6TargetRoutines } from '../original/defb6-target.js';
import { createDefb6AstronautRoutines } from '../original/defb6-astronaut.js';
import { createDefb6LanderRoutines } from '../original/defb6-lander.js';
import { createBlk71TerrainRoutines, BLK71_ADDR } from '../original/blk71-terrain.js';
import { Continuations } from '../runtime/continuations.js';
import { s16 } from '../runtime/integers.js';
export const LANDER_DIAGNOSTIC_IDENTIFIERS = Object.freeze({
    LANDS0: 0xe201, LANDG: 0xe203, LANDF: 0xe205, LNDFXA: 0xe207,
    LNDP1: 0xe210, LNDP3: 0xe224, LKILL: 0xe228, LKIL1: 0xe22a,
    ASTRO: 0xe230, ASTKIL: 0xe232, AKIL1: 0xe234,
    ASTP1: 0xe240, ASTP2: 0xe24a, ASTP3: 0xe254, ASTP4: 0xe25e,
    NULOB: 0xef9d, LPKSND: 0xe270, LSKSND: 0xe272, LSHSND: 0xe274,
    SCZP1: 0xe280, SCZKIL: 0xe282, SCZ0: 0xe284, SSHSND: 0xe286,
    FBOUT: 0xe290, BMBP1: 0xe292, BKIL: 0xe294,
    AFALL: 0xe298, AFALL2: 0xe29a, TERBLO: 0xe29c,
    P250: 0xe2a0, P500: 0xe2a2, ASXP1: 0xe2a4, AHSND: 0xe2a6, ALSND: 0xe2a8
});
export function createSourceLanderWorkbench() {
    const addresses = LANDER_DIAGNOSTIC_IDENTIFIERS;
    const Layout1 = new Layout({ ...PHR6_SYMBOLS, ...addresses });
    const ram = new RAM(), processes = createDefa7Routines(ram, Layout1);
    const at = n => Layout1.at(n), off = (X, n) => X + at(n);
    const read8 = n => ram.read8(at(n)), write8 = (n, v) => ram.write8(at(n), v);
    const read16 = n => ram.read16(at(n)), write16 = (n, v) => ram.write16(at(n), v);
    const byte = (X, n) => ram.read8(off(X, n)), word = (X, n) => ram.read16(off(X, n));
    const field = (X, n, v) => ram.write16(off(X, n), v), field8 = (X, n, v) => ram.write8(off(X, n), v);
    const video = { write8() {
        } }; // original BGALT doesn't access video
    const terrainBank = new RAM();
    const terrain = createBlk71TerrainRoutines(ram, video, { terrainBank });
    const getAltitude = index => terrainBank.read8(BLK71_ADDR.ALTTBL + index);
    const random = createDefa7RandomRoutines(ram, Layout1);
    const wave = createDefa7WaveExecutive(ram, Layout1, processes, { RAND: random.RAND });
    const shells = createDefa7ShellRoutines(ram, Layout1, video);
    const soundTrace = [];
    const SNDLD = command => soundTrace.push(command);
    const shooting = createDefb6ShootRoutines(ram, Layout1, { addresses,
        GETSHL: shells.GETSHL, RMAX: wave.RMAX, SNDLD });
    const astronauts = createDefb6AstronautRoutines(ram, Layout1, processes, {
        addresses, readAltitude: getAltitude,
        // A later kill path correctly stops at the unported appearance/explosion boundary.
        SNDLD
    });
    const landers = createDefb6LanderRoutines(ram, Layout1, processes, {
        addresses, GETALT: astronauts.GETALT, GTARG: createDefb6TargetRoutines(ram, Layout1).GTARG,
        LSHOT: shooting.LSHOT, RMAX: wave.RMAX, SNDLD,
        SNDOUT: command => soundTrace.push(command)
    });
    const player = createDefa7PlayerRoutines(ram, Layout1);
    const dispatcher = new Continuations({ RAM: ram, Layout: Layout1, scheduler: processes });
    for (const name of ['LANDS0', 'LANDG', 'LANDF', 'LNDFXA'])
        dispatcher.register(name, landers[name]);
    dispatcher.register('ASTRO', astronauts.ASTRO);
    let ticks = 0, refs;
    function RESET() {
        ram.clear(0, 0x10000);
        processes.PINIT();
        processes.OINIT();
        terrain.BGALT();
        soundTrace.length = 0;
        ticks = 0;
        write8('SEED', 0x45);
        write8('HSEED', 0x23);
        write8('LSEED', 0x18);
        write8('ASTCNT', 1);
        write8('LDSTIM', 15);
        write8('LNDXV', 12);
        write16('LNDYV', 0x20);
        write16('BGL', 0x4000);
        write16('PLABX', 0x4500);
        write8('PLAYC', 90);
        const AU = processes.MKPROC(addresses.ASTRO, at('STYPE'));
        const AX = processes.GETOB();
        field(AX, 'OX16', 0x4600);
        field8(AX, 'OY16', Math.min(0xe8, getAltitude(0x4600 >>> 6) + 4));
        field(AX, 'OBJX', 0x4000);
        field(AX, 'OPICT', addresses.ASTP1);
        field(AX, 'OCVECT', addresses.ASTKIL);
        field(AX, 'OBJID', AU);
        write16('TLIST', AX);
        write16('TPTR', at('TLIST') + 62);
        field(AU, 'PD', at('TLIST') + 30); // original ASTRO wraps to TLIST on next scan
        write16('OPTR', AX);
        const LU = processes.MKPROC(addresses.LANDS0, at('STYPE'));
        const LX = processes.GETOB();
        field(LX, 'OX16', 0x4200);
        field8(LX, 'OY16', at('YMIN') + 2);
        field(LX, 'OYV', read16('LNDYV'));
        field(LX, 'OPICT', addresses.LNDP1);
        field(LX, 'OCVECT', addresses.LKILL);
        field(LX, 'OBJCOL', 0x4433);
        field(LX, 'OBJID', LU);
        field(LU, 'PD', LX);
        field(LU, 'PD2', AX);
        field(LU, 'PD4', at('TLIST'));
        field8(LU, 'PD6', 15);
        write16('OPTR', LX);
        write8('LNDCNT', 1);
        refs = { astronaut: { U: AU, X: AX }, lander: { U: LU, X: LX } };
        return STATE();
    }
    function STATE() {
        const info = ({ U, X }) => ({ process: U, object: X,
            x: word(X, 'OX16'), y: byte(X, 'OY16'),
            xv: s16(word(X, 'OXV')), yv: s16(word(X, 'OYV')),
            picture: word(X, 'OPICT'), next: word(U, 'PADDR'), sleep: byte(U, 'PTIME') });
        return { ticks, altitudeAtLander: getAltitude(word(refs.lander.X, 'OX16') >>> 6),
            lander: info(refs.lander), astronaut: info(refs.astronaut),
            astronautCount: read8('ASTCNT'), landCount: read8('LNDCNT'),
            shots: read8('BMBCNT'), soundCommands: soundTrace.slice(-6) };
    }
    function STEP() {
        const result = dispatcher.resume(processes.DISP());
        if (result.kind !== 'end-of-dispatch')
            throw Error('Unexpected DISP state');
        player.VELO(); // original source routine; workbench cadence NOT cabinet-verified
        ticks++;
        return STATE();
    }
    function RUN(count) {
        if (!Number.isInteger(count) || count < 1 || count > 120)
            throw RangeError('1–120 source steps');
        for (let i = 0; i < count; i++)
            STEP();
        return STATE();
    }
    RESET();
    return Object.freeze({ ram, Layout: Layout1, processes, terrain,
        landers, astronauts, RESET, STEP, RUN, STATE });
}
