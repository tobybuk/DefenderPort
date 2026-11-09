/** Stage 73 Mutant arena: one source-created Mutant against the attract pilot,
 * running the unmodified translated engine. Only the starting scene is arranged.
 *
 * Differences from the Stage 67-72 arenas (tools/mutant-*.mjs):
 *  - Mutants start ABOVE and BELOW the ship, on its LEFT and RIGHT. The older
 *    arenas only placed them above.
 *  - Mutant speed (SZXV/SZYV/SZRY) is set to the wave-1 start values and to
 *    values measured later in waves 2-3 and beyond. The older arenas always ran
 *    at the wave-1 start values, the slowest Mutant the game produces.
 *  - The ship's position is read after one STEP. Straight after RESET, PLABX is
 *    stale by $800 (32 columns), so the older arenas placed every Mutant 32
 *    columns further left than their offsets say.
 *
 * Usage: node tools/stage73-mutant-arena.mjs [browser/flight.js ...]
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { Script, createContext } from 'node:vm';
import { createFlightHarness } from '../demo/flight-harness.js';

export const SPEEDS = {
    'wave-1 start': null,                        // SZXV 12, SZYV 0.38px, SZRY 1
    'wave-2 start': { x: 28, y: 0x00e0, hop: 1 },
    'late wave 2-3': { x: 76, y: 0x0110, hop: 2 },
    'later waves': { x: 96, y: 0x0180, hop: 2 },
};

export function loadPilot(path) {
    const src = readFileSync(path, 'utf8');
    const a = src.indexOf('function createAttractPilot()'), b = src.indexOf('const attractPilot=createAttractPilot();', a);
    return new Script(src.slice(a, b) + ';createAttractPilot').runInContext(createContext({}));
}

/** One encounter. dx: Mutant left edge relative to ship left edge (columns);
 * dy: Mutant top relative to ship top (pixels). Returns kill/death/none. */
export function encounter(createPilot, { dx, dy, speed = null, seed = 0, ticks = 360 }) {
    const h = createFlightHarness({ infiniteSmartBombs: false, playerCollisions: true, sourceCabinetInput: true });
    h.RESET();
    const r = h.RANDOM_STATE();
    h.RESET(null, { ...r, seed: (r.seed + seed * 41) & 255, hseed: (r.hseed + seed * 17) & 255, lseed: (r.lseed + seed * 83) & 255 });
    h.INPUT({}); h.STEP();                       // PLABX is only current after one PLAYER pass
    const ram = h.ram, at = n => h.Layout.at(n), s = h.STATE();
    if (speed) { ram.write8(at('SZXV'), speed.x); ram.write16(at('SZYV'), speed.y); ram.write8(at('SZRY'), speed.hop); }
    for (const e of h.ENEMY_STATE()) if (e.object) ram.write16(e.object + at('OX16'), (s.worldX + 25000) & 65535);
    const x = h.mutantStart.SCZST(1)[0].object;
    ram.write16(x + at('OX16'), (s.worldX + dx * 64) & 65535);
    ram.write16(x + at('OY16'), Math.max(47, Math.min(225, s.y + dy)) << 8);
    const pilot = createPilot();
    let bombs = 0;
    for (let t = 0; t < ticks; t++) {
        const cmd = pilot.sample(h.STATE(), h.ENEMY_STATE(), h.ASTRONAUT_STATE(), ram, h.Layout, { altitude: h.ALTITUDE });
        bombs += +cmd.smartBomb;
        h.INPUT(cmd); h.STEP();
        const n = h.STATE();
        if (n.playerDeaths > 0) return { result: 'death', t, bombs };
        let q = ram.read16(at('OPTR')), seen = new Set(), live = false;
        while (q && !seen.has(q)) { if (q === x) { live = true; break; } seen.add(q); q = ram.read16(q + at('OLINK')); }
        if (!live && n.laserHits > 0) return { result: 'kill', t, bombs };
    }
    return { result: 'none', t: ticks, bombs };
}

export function arena(createPilot, speed) {
    const out = {};
    for (const [vName, vSign] of [['above', -1], ['below', 1]]) for (const [hName, dxs] of [['left', [-30, -22, -14, -8]], ['right', [2, 8, 16, 26]]]) {
        const tally = { kill: 0, death: 0, none: 0 };
        for (let i = 0; i < 12; i++) {
            const dx = dxs[i % 4], dy = vSign * [25, 50, 80][Math.floor(i / 4)];
            tally[encounter(createPilot, { dx, dy, speed, seed: i }).result]++;
        }
        out[`${vName}/${hName}`] = tally;
    }
    return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const paths = process.argv.slice(2);
    for (const path of paths.length ? paths : [fileURLToPath(new URL('../browser/flight.js', import.meta.url))]) {
        const create = loadPilot(path);
        console.log(path);
        for (const [name, speed] of Object.entries(SPEEDS)) console.log(`  ${name.padEnd(14)}`, JSON.stringify(arena(create, speed)));
    }
}
