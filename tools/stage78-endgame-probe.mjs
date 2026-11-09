/** Stage 78 diagnostic: how the attract AI behaves when the wave is nearly
 * finished (1–2 wave enemies left), when a Baiter is present at the end of a
 * wave, and when one human is left.
 *
 * Usage: node tools/stage78-endgame-probe.mjs [flight.js] [games=8] [ticks=30000] [firstSeed=0]
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Script, createContext } from 'node:vm';
import { createFlightHarness } from '../demo/flight-harness.js';

const [path = fileURLToPath(new URL('../browser/flight.js', import.meta.url)), games = '8', ticks = '30000', first = '0'] = process.argv.slice(2);
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
const M = { ticks: 0, endTicks: 0, wrongWay: 0, wrongWayFar: 0, endBaiterTicks: 0, endBaiterTargetBaiter: 0,
    endgames: 0, endgameTicksSum: 0, lastHumanTicks: 0, lastHumanLost: 0, lastHumanGuardNear: 0, waves: 0, deaths: 0, hist: [], losses: [], trace: [], samples: [], reasons: {}, dist: {}, kinds: {} };
for (let g = +first; g < +first + +games; g++) {
    const lab = createFlightHarness({ infiniteSmartBombs: false, playerCollisions: true, sourceCabinetInput: true });
    lab.RESET();
    const sv = lab.RANDOM_STATE();
    lab.RESET(null, { ...sv, seed: (sv.seed + g * 43) & 255, hseed: (sv.hseed + g * 11) & 255, lseed: (sv.lseed + g * 67) & 255 });
    const ram = lab.ram, at = n => lab.Layout.at(n), pilot = createPilot();
    let endStart = -1, lastWave = 1, dying = false, prevHumans = null;
    for (let t = 0; t < +ticks; t++) {
        const s = lab.STATE(), as = lab.ASTRONAUT_STATE();
        const objs = [];
        for (const list of ['OPTR', 'IPTR']) {
            let q = ram.read16(at(list));
            for (let i = 0; q && i < 95; i++) {
                const k = kindOf(ram.read16(q + at('OPICT')));
                if (k) objs.push({ id: q, k, d: (((ram.read16(q + at('OX16')) - s.worldX + 32768) & 65535) - 32768) / 64, y: ram.read8(q + at('OY16')) });
                q = ram.read16(q + at('OLINK'));
            }
        }
        const wave = objs.filter(o => o.k !== 'Baiter');
        const reserve = ram.read8(at('LNDRES')) + ram.read8(at('LNDCNT'));
        const cmd = pilot.sample(s, lab.ENEMY_STATE(), as, ram, lab.Layout, { altitude: lab.ALTITUDE });
        const st = pilot.state();
        const target = objs.find(o => o.id === st.targetId);
        const live = !s.playerDeathActive && !s.bonus && !s.hyperspaceActive && !s.gameOver;
        if (live && wave.length && wave.length <= 2 && ram.read8(at('LNDRES')) === 0) {
            M.endTicks++;
            const rk = st.reason.replace(/ \S+$/, m => /[A-Z]{3,}\d/.test(m) ? '' : m).slice(0, 40); M.reasons[rk] = (M.reasons[rk] || 0) + 1;
            const nd = Math.min(...wave.map(o => Math.abs(o.d))); M.dist[nd < 75 ? 'onScreen' : nd < 250 ? 'near' : 'far'] = (M.dist[nd < 75 ? 'onScreen' : nd < 250 ? 'near' : 'far'] || 0) + 1;
            M.kinds[wave.map(o=>o.k).sort().join('+')] = (M.kinds[wave.map(o=>o.k).sort().join('+')] || 0) + 1;
            if (endStart < 0) { endStart = t; M.endgames++; }
            const t0 = target && target.k !== 'Baiter' ? target : wave.slice().sort((u, w) => Math.abs(u.d) - Math.abs(w.d))[0];
            const moving = Math.sign(s.vx) || 0;
            if (Math.abs(t0.d) > 60 && Math.abs(s.vx) > 60 && moving && moving !== Math.sign(t0.d)) {
                M.wrongWay++;
                if (Math.abs(t0.d) > 200) M.wrongWayFar++;
                if (M.samples.length < 12 && t % 40 === 0) M.samples.push({ g, t, reason: st.reason, d: t0.d, k: t0.k, vx: s.vx, facing: (s.direction & 0x8000) ? -1 : 1, target: target?.k, tgtD: target?.d });
            }
            if (process.env.TRACE && g === +process.env.TRACE && t % 8 === 0) M.trace.push(`${t} ${st.reason.slice(0,26).padEnd(26)} tgt=${(target?.k||'-').padEnd(7)} d=${t0.d.toFixed(0).padStart(5)} y=${t0.y} shipY=${s.y} vx=${String(s.vx).padStart(4)} face=${(s.direction & 0x8000) ? -1 : 1} n=${wave.length}${objs.some(o=>o.k==='Baiter')?' B':''}`);
            if (objs.some(o => o.k === 'Baiter')) { M.endBaiterTicks++; if (target?.k === 'Baiter') M.endBaiterTargetBaiter++; }
        }
        if (s.wave.wave > lastWave) { M.waves++; lastWave = s.wave.wave; if (endStart >= 0) { M.endgameTicksSum += t - endStart; endStart = -1; } }
        if (live && as.count === 1) {
            M.lastHumanTicks++;
            const h = (as.living || [])[0];
            if (h) { const hd = (((h.worldX - s.worldX + 32768) & 65535) - 32768) / 64; if (Math.abs(hd) < 75) M.lastHumanGuardNear++; }
        }
        if (as.count === 1) { const h = (as.living || [])[0]; M.hist.push({ t, reason: st.reason, hd: h ? Math.round((((h.worldX - s.worldX + 32768) & 65535) - 32768) / 64) : null, carrier: objs.filter(o => o.k === 'Lander').map(o => Math.round(o.d)).join(',') }); if (M.hist.length > 400) M.hist.shift(); }
        if (prevHumans === 1 && as.count === 0) { M.lastHumanLost++; if (process.env.LOSS && M.losses.length < 6) M.losses.push({ g, t, hist: M.hist.filter((x, i) => i % 25 === 0 || i > M.hist.length - 4) }); }
        if (as.count !== 1) M.hist.length = 0;
        prevHumans = as.count;
        lab.INPUT(cmd); lab.STEP();
        const n = lab.STATE();
        if (n.playerDeathActive && !dying) M.deaths++;
        dying = n.playerDeathActive;
        M.ticks++;
        if (n.gameOver) break;
    }
}
const out = { ticks: M.ticks, waves: M.waves, deathsPer10k: +(M.deaths / M.ticks * 1e4).toFixed(2), endgames: M.endgames,
    meanEndgameTicks: Math.round(M.endgameTicksSum / Math.max(1, M.waves)),
    wrongWayShare: +(M.wrongWay / Math.max(1, M.endTicks)).toFixed(3), wrongWayFarShare: +(M.wrongWayFar / Math.max(1, M.endTicks)).toFixed(3),
    endBaiterTargetShare: +(M.endBaiterTargetBaiter / Math.max(1, M.endBaiterTicks)).toFixed(3), endBaiterTicks: M.endBaiterTicks,
    lastHumanTicks: M.lastHumanTicks, lastHumanNearShare: +(M.lastHumanGuardNear / Math.max(1, M.lastHumanTicks)).toFixed(3), lastHumansLost: M.lastHumanLost };
console.log(JSON.stringify(out));
if (process.env.SAMPLES) console.log(M.samples);
if (process.env.TRACE) console.log(M.trace.slice(0, +(process.env.N||300)).join('\n'));
if (process.env.LOSS) console.log(JSON.stringify(M.losses, null, 0));
if (process.env.DETAIL) console.log(M.reasons, M.dist, M.kinds);
