/** Stage 74 attract-AI benchmark: seeded full games on the unmodified
 * translated engine, with tactic-specific metrics (Pods, Baiters, planet loss,
 * carrying a human, smart bomb use) as well as survival and score.
 *
 * Usage: node tools/stage74-benchmark.mjs [flight.js] [games=16] [ticks=30000] [firstSeed=0]
 * Seeds follow tools/benchmark16.mjs (seed+g*43, hseed+g*11, lseed+g*67).
 * STAGE74_AI_NOTES.md figures use 64 games (8 runs of 8, firstSeed 0..56).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Script, createContext } from 'node:vm';
import { createFlightHarness } from '../demo/flight-harness.js';

const [path = fileURLToPath(new URL('../browser/flight.js', import.meta.url)), games = '16', ticks = '30000', first = '0'] = process.argv.slice(2);
const GAMES = +games, TICKS = +ticks, FIRST = +first;
const src = readFileSync(path, 'utf8');
const a = src.indexOf('function createAttractPilot()'), b = src.indexOf('const attractPilot=createAttractPilot();', a);
const createPilot = new Script(src.slice(a, b) + ';createAttractPilot').runInContext(createContext({}));
const kindOf = pic => {
    if (pic >= 0xe140 && pic <= 0xe154 && (pic - 0xe140) % 10 === 0) return 'Lander';
    if (pic === 0xe280 || pic === 0xe2c4) return 'Mutant';
    if (pic === 0xe130) return 'Swarmer';
    if (pic >= 0xe100 && pic <= 0xe114 && (pic - 0xe100) % 10 === 0) return 'Baiter';
    if (pic >= 0xe430 && pic <= 0xe44e && (pic - 0xe430) % 10 === 0) return 'Bomber';
    if (pic === 0xe2ba) return 'Pod';
    return null;
};
const M = { ticks: 0, deaths: 0, byKiller: {}, hits: 0, humansLost: 0, waves: 0, maxWaveSum: 0, score: 0, gameOvers: 0,
    podKills: 0, podNearTicks: 0, podNearReverses: 0, baiterTicks: 0, baiterSum: 0, planetGoneTicks: 0, carryTicks: 0, bombs: 0, bombVictims: 0 };
for (let g = FIRST; g < FIRST + GAMES; g++) {
    const lab = createFlightHarness({ infiniteSmartBombs: false, playerCollisions: true, sourceCabinetInput: true });
    lab.RESET();
    const sv = lab.RANDOM_STATE();
    lab.RESET(null, { ...sv, seed: (sv.seed + g * 43) & 255, hseed: (sv.hseed + g * 11) & 255, lseed: (sv.lseed + g * 67) & 255 });
    const ram = lab.ram, at = n => lab.Layout.at(n), r8 = n => ram.read8(at(n)), pilot = createPilot();
    let dying = false, lastHits = 0, humans = null, maxWave = 1, lastWave = 1, lastPrb = r8('PRBCNT'), t;
    for (t = 0; t < TICKS; t++) {
        const s = lab.STATE(), as = lab.ASTRONAUT_STATE();
        if (humans !== null && as.count < humans) M.humansLost += humans - as.count;
        humans = as.count;
        if (s.laserHits < lastHits) lastHits = 0;
        M.hits += s.laserHits - lastHits; lastHits = s.laserHits;
        if (s.wave.wave > lastWave) { M.waves += s.wave.wave - lastWave; lastWave = s.wave.wave; }
        maxWave = Math.max(maxWave, s.wave.wave);
        const cmd = pilot.sample(s, lab.ENEMY_STATE(), as, ram, lab.Layout, { altitude: lab.ALTITUDE });
        if (pilot.state().carrying) M.carryTicks++;
        const near = [];
        let q = ram.read16(at('OPTR'));
        for (let i = 0; q && i < 95; i++) {
            const k = kindOf(ram.read16(q + at('OPICT'))), v = ram.read16(q + at('OBJX'));
            if (k) near.push({ k, v, x: v >>> 8, y: v & 255, d: (((ram.read16(q + at('OX16')) - s.worldX + 32768) & 65535) - 32768) / 64 });
            q = ram.read16(q + at('OLINK'));
        }
        q = ram.read16(at('SPTR'));
        for (let i = 0; q && i < 95; i++) { const v = ram.read16(q + at('OBJX')); if (v) near.push({ k: 'Shell', v, x: v >>> 8, y: v & 255, d: 0 }); q = ram.read16(q + at('OLINK')); }
        if (near.some(o => o.k === 'Pod' && Math.abs(o.d) < 50)) { M.podNearTicks++; if (cmd.reverse) M.podNearReverses++; }
        const ufo = r8('UFOCNT');
        if (ufo) { M.baiterTicks++; M.baiterSum += ufo; }
        const onScreen = near.filter(o => o.v).map(o => ({ ...o, dist: Math.abs(o.x - s.x) + Math.abs(o.y - s.y) })).sort((u, w) => u.dist - w.dist);
        const bombsBefore = ram.read8(ram.read16(at('PLRX')) + at('PSBC'));
        lab.INPUT(cmd); lab.STEP();
        const n = lab.STATE();
        if (ram.read8(ram.read16(at('PLRX')) + at('PSBC')) < bombsBefore && n.wave.wave === s.wave.wave) {
            M.bombs++; M.bombVictims += onScreen.filter(o => o.k !== 'Shell').length;
        }
        const prb = r8('PRBCNT'); if (prb === lastPrb - 1) M.podKills++; lastPrb = prb;
        if (r8('ASTCNT') === 0) M.planetGoneTicks++;
        if (n.playerDeathActive && !dying) { M.deaths++; const k = onScreen[0]?.k ?? '?'; M.byKiller[k] = (M.byKiller[k] || 0) + 1; }
        dying = n.playerDeathActive;
        if (n.gameOver) { M.gameOvers++; break; }
    }
    M.ticks += t; M.maxWaveSum += maxWave;
    M.score += +lab.STATE().scoreBCD.map(x => x.toString(16).padStart(2, '0')).join('');
}
const per10k = x => +(x / M.ticks * 1e4).toFixed(2);
console.log(JSON.stringify({
    games: GAMES, meanTicks: Math.round(M.ticks / GAMES), gameOvers: M.gameOvers, meanScore: Math.round(M.score / GAMES),
    meanMaxWave: +(M.maxWaveSum / GAMES).toFixed(2), wavesPer10k: per10k(M.waves), deathsPer10k: per10k(M.deaths),
    mutantDeathsPer10k: per10k(M.byKiller.Mutant || 0), humansLostPer10k: per10k(M.humansLost), podKillsPer10k: per10k(M.podKills),
    podNearShare: +(M.podNearTicks / M.ticks).toFixed(3), reversesPer1kPodNearTicks: +(M.podNearReverses / Math.max(1, M.podNearTicks) * 1000).toFixed(1),
    baiterShare: +(M.baiterTicks / M.ticks).toFixed(3), meanBaitersWhenPresent: +(M.baiterSum / Math.max(1, M.baiterTicks)).toFixed(2),
    planetGoneShare: +(M.planetGoneTicks / M.ticks).toFixed(3), carryShare: +(M.carryTicks / M.ticks).toFixed(3),
    bombsPer10k: per10k(M.bombs), victimsPerBomb: +(M.bombVictims / Math.max(1, M.bombs)).toFixed(2), deathsByNearestObject: M.byKiller,
}));
