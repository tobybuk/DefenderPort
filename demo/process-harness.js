/**
 * Stage 11 SOURCE-PROCESS WORKBENCH. This is a TEST FIXTURE, not Defender's
 * finished EXEC startup. It runs original GEXEC (dead-player status branch),
 * COLR, THPROC, and REV via the original DISP/SLEEP linked process scheduler.
 *
 * The entry-address values below are *synthetic test addresses*, because
 * assembled address extraction from the pinned source is still unavailable.
 * They never reach a ROM or interpreter. Original memory offsets and routine
 * arithmetic are untouched. Unported source callbacks fail immediately.
 */
import { RAM, Layout } from '../runtime/ram.js';
import { PHR6_SYMBOLS } from '../runtime/phr6-layout.js';
import { createDefa7Routines } from '../original/defa7.js';
import { createDefa7RandomRoutines } from '../original/defa7-random.js';
import { createDefa7ThrustRoutines } from '../original/defa7-thrust.js';
import { createDefa7ReverseRoutines } from '../original/defa7-rev.js';
import { createDefa7WaveExecutive } from '../original/defa7-wave-exec.js';
import { createDefa7ProcessTasks } from '../original/defa7-process-tasks.js';
import { createDefa7FireTableRoutines } from '../original/defa7-fire-tables.js';
import { createDefb6BankingObjectRoutines } from '../original/defb6-banking-object.js';
import { createDefa7WaveParameterRoutines } from '../original/defa7-wave-params.js';
import { Continuations } from '../runtime/continuations.js';
// NEVER describe these fixture dispatch keys as source ROM addresses.
export const DIAGNOSTIC_ENTRY_ADDRESSES = Object.freeze({
    GEXEC: 0xf100, GEX0: 0xf102, COLR: 0xf104, COLRLP: 0xf106,
    THPROC: 0xf108, REV: 0xf10a, REV2: 0xf10c, REVX1: 0xf10e
});
export function createSourceProcessWorkbench() {
    const addresses = DIAGNOSTIC_ENTRY_ADDRESSES;
    const Layout = new LayoutClass({ ...PHR6_SYMBOLS, ...addresses });
    const ram = new RAM(), processes = createDefa7Routines(ram, Layout);
    const random = createDefa7RandomRoutines(ram, Layout);
    const thrust = createDefa7ThrustRoutines(ram, Layout, random, processes, addresses);
    const bank = createDefb6BankingObjectRoutines(ram, Layout);
    const waveParameters = createDefa7WaveParameterRoutines(ram, Layout, { MAPCH7: bank.MAPCH7 });
    const fireTables = createDefa7FireTableRoutines(ram, Layout, { RAND: random.RAND });
    const waves = createDefa7WaveExecutive(ram, Layout, processes, { addresses, RAND: random.RAND, WDELT: waveParameters.WDELT });
    const colours = createDefa7ProcessTasks(ram, Layout, processes, { addresses });
    const reverse = createDefa7ReverseRoutines(ram, Layout, processes, addresses);
    const continuations = new Continuations({ RAM: ram, Layout, scheduler: processes });
    for (const [label, fn] of Object.entries({
        GEXEC: waves.GEXEC, GEX0: waves.GEX0, COLR: colours.COLR, COLRLP: colours.COLRLP,
        THPROC: thrust.THPROC, REV: reverse.REV, REV2: reverse.REV2, REVX1: reverse.REVX1
    }))
        continuations.register(label, fn);
    const at = n => Layout.at(n), r8 = n => ram.read8(at(n)), w8 = (n, v) => ram.write8(at(n), v), r16 = n => ram.read16(at(n));
    let ticks = 0;
    function RESET() {
        ram.clear(0, 65536);
        processes.PINIT();
        processes.OINIT();
        ticks = 0;
        ram.write16(at('HSEED'), 0xa55a);
        random.STINIT();
        fireTables.FBINIT();
        thrust.THINIT();
        // STATUS bit 3 skips unported enemy branches in actual source GEX0.
        w8('STATUS', 8);
        ram.write16(at('PLADIR'), 0x0300);
        ram.write16(at('NPLAD'), 0x0300);
        ram.write16(at('CRPROC'), at('ACTIVE'));
        processes.MKPROC(addresses.GEXEC, 0);
        processes.MKPROC(addresses.COLR, 0);
        processes.MKPROC(addresses.THPROC, 0);
    }
    function STEP() {
        ticks++;
        const result = continuations.resume(processes.DISP());
        if (result.kind !== 'end-of-dispatch')
            throw Error('Original DISP did not reach EXEC boundary');
        return STATE();
    }
    function RUN(n = 1) {
        if (!Number.isInteger(n) || n < 1 || n > 240)
            throw Error('Workbench supports 1..240 ticks per batch');
        for (let i = 0; i < n; i++)
            STEP();
        return STATE();
    }
    function REV() {
        // Source MKPROC normally follows switch processing at CRPROC=ACTIVE.
        ram.write16(at('CRPROC'), at('ACTIVE'));
        return processes.MKPROC(addresses.REV, 0);
    }
    function STATE() {
        const active = [];
        let X = ram.read16(at('ACTIVE'));
        for (let i = 0; X && i < 80; i++, X = ram.read16(X)) {
            const saved = ram.read16(X + at('PADDR'));
            active.push({ node: X, entry: Object.entries(addresses).find(([, v]) => v === saved)?.[0] || '?', $time: ram.read8(X + at('PTIME')) });
        }
        return Object.freeze({ ticks, gt: r8('GTIME'), starCount: r8('STRCNT'),
            colourIndex: r8('LCOLRX'), laserColour: ram.read8(at('PCRAM') + 1),
            thrustIndex: r16('THX') - at('THTAB'), fireballIndex: r16('FBX') - at('FBTAB'),
            landerXVelocity: r8('LNDXV'),
            revFlag: r8('REVFLG'), direction: r16('NPLAD'), active });
    }
    RESET();
    return Object.freeze({ ram, Layout, processes, continuations, reverse, waves, colours, thrust,
        RESET, STEP, RUN, REV, STATE, waveParameters });
}
// Keep the Layout name from the shared runtime while avoiding the local variable.
const LayoutClass = Layout;
