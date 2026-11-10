/** Stage 80 attract-AI reversal probe: how often the demo ship turns round,
 * and how soon after the previous turn. Quick back-and-forth turning is hard
 * to watch, so the demo limits it (see STAGE80_CABINET_UI.md).
 *
 * Usage: node tools/stage80-reversal-probe.mjs [flight.js] [games=8] [ticks=12000] [firstSeed=100]
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Script, createContext } from 'node:vm';
import { createFlightHarness } from '../demo/flight-harness.js';

const [path = fileURLToPath(new URL('../browser/flight.js', import.meta.url)), games = '8', ticks = '12000', first = '100'] = process.argv.slice(2);
const src = readFileSync(path, 'utf8');
const a = src.indexOf('function createAttractPilot()'), b = src.indexOf('const attractPilot=createAttractPilot();', a);
const createPilot = new Script(src.slice(a, b) + ';createAttractPilot').runInContext(createContext({}));
const R = { ticks: 0, reversals: 0, under30: 0, under60: 0, deaths: 0, score: 0, waves: 0, byReason: {}, fastByReason: {} };
const bcd = bytes => +bytes.map(v => v.toString(16).padStart(2, "0")).join("");
for (let g = +first; g < +first + +games; g++) {
    const lab = createFlightHarness({ infiniteSmartBombs: false, playerCollisions: true, sourceCabinetInput: true });
    lab.RESET();
    const sv = lab.RANDOM_STATE();
    lab.RESET(null, { ...sv, seed: (sv.seed + g * 43) & 255, hseed: (sv.hseed + g * 11) & 255, lseed: (sv.lseed + g * 67) & 255 });
    const pilot = createPilot();
    let last = -1e9, wave = 1;
    for (let t = 0; t < +ticks; t++) {
        const s = lab.STATE();
        if (s.gameOver) break;
        const cmd = pilot.sample(s, lab.ENEMY_STATE(), lab.ASTRONAUT_STATE(), lab.ram, lab.Layout, { altitude: lab.ALTITUDE });
        if (cmd.reverse) {
            const gap = t - last, why = pilot.state().reason.replace(/[0-9]+/g, '#');
            R.reversals++; R.byReason[why] = (R.byReason[why] || 0) + 1;
            if (gap < 30) { R.under30++; R.fastByReason[why] = (R.fastByReason[why] || 0) + 1; }
            if (gap < 60) R.under60++;
            last = t;
        }
        lab.INPUT(cmd); lab.STEP(); R.ticks++;
        wave = Math.max(wave, s.wave.wave);
    }
    const end = lab.STATE();
    R.deaths += end.playerDeaths; R.waves += wave - 1;
    R.score += bcd(end.scoreBCD);
}
const per10k = v => +(v * 10000 / R.ticks).toFixed(2);
console.log(JSON.stringify({ ticks: R.ticks, reversalsPerMin: +(R.reversals / (R.ticks / 3600)).toFixed(1),
    under30pct: +(100 * R.under30 / R.reversals).toFixed(1), under60pct: +(100 * R.under60 / R.reversals).toFixed(1),
    deathsPer10k: per10k(R.deaths), wavesPer10k: per10k(R.waves), meanScore: Math.round(R.score / +games),
    top: Object.entries(R.byReason).sort((x, y) => y[1] - x[1]).slice(0, 8),
    fastTop: Object.entries(R.fastByReason).sort((x, y) => y[1] - x[1]).slice(0, 8) }, null, 1));
