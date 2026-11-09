import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const file = f => readFileSync(resolve(root, f), 'utf8');
const modules = ['runtime/integers.js', 'runtime/ram.js', 'runtime/phr6-layout.js', 'runtime/video-memory.js', 'runtime/continuations.js', 'original/samexap7-cycle-ledger.js', 'runtime/source-cpu-budget.js', 'runtime/source-attract-processes.js',
    'original/defa7.js', 'original/defb6-ufo.js', 'original/defb6-swarm.js', 'original/defb6-target.js', 'original/defb6-probe.js', 'original/defb6-shoot.js', 'original/defb6-lander.js', 'original/defb6-mutant-start.js', 'original/defb6-astronaut.js', 'original/defa7-astronaut-start.js', 'original/defa7-player.js', 'original/defa7-random.js',
    'original/blk71-data.js', 'original/blk71-terrain.js', 'original/blk71-player-explosion.js',
    'original/defa7-stars.js', 'original/defa7-thrust.js', 'original/defb6-colour-processes.js', 'original/defa7-scanning.js',
    'original/defb6-player-data.js', 'original/defb6-enemy-pictures.js', 'original/defb6-gameplay-pictures.js', 'original/defa7-player-video.js',
    'original/defa7-object-video.js',
    'original/defa7-object-process.js', 'original/defa7-shells.js', 'original/defa7-fire-tables.js',
    'original/defa7-top-display.js', 'original/defa7-sound.js',
    'original/VSNDRM1-data.js', 'original/VSNDRM1-synth.js',
    'original/blk71-wave-data.js', 'original/defa7-wave-params.js', 'original/defa7-wave-exec.js', 'original/defa7-process-tasks.js', 'original/samexap7-explosion-start.js', 'original/samexap7-explosion-update.js', 'original/defa7-rev.js',
    'original/defa7-player-index.js',
    'original/defb6-active-screen-clear.js', 'original/defa7-hyperspace.js',
    'original/defa7-score.js', 'original/defa7-score-display.js', 'original/samexap7-appearance.js',
    'original/defa7-laser.js', 'original/defa7-collision.js', 'original/defa7-smart-bomb.js', 'original/defa7-player-death.js', 'original/defb6-rescue-points.js', 'original/defb6-terrain-blow.js', 'original/defb6-tie.js',
    'original/defa7-hud.js', 'original/defender-hud-data.js', 'original/defender-bonus-font.js', 'original/defa7-bonus.js', 'original/defa7-switches.js', 'original/defb6-switch-table.js', 'original/defa7-exec.js', 'original/romf8-graphics.js',
    'original/amode1-scanner.js', 'original/amode1-attract-data.js', 'original/amode1-presentation-data.js', 'original/amode1-hall-of-fame.js', 'original/amode1-attract.js', 'original/defa7-irq.js', 'original/defa7-init.js', 'original/defb6-banking-object.js',
    'demo/flight-harness.js', 'demo/process-harness.js', 'demo/enemy-harness.js', 'demo/lander-harness.js', 'browser/defender-palette.js', 'browser/source-clock.js', 'browser/video-presenter.js', 'browser/source-sound-output.js', 'browser/control-bindings.js', 'browser/touch-controls.js', 'browser/cabinet-operator.js', 'browser/cabinet-boot.js', 'browser/flight.js'];
let script = '';
for (const path of modules) {
    let src = file(path).replace(/^import .*?;\s*$/gm, '').replace(/\bexport\s+(?=(?:class|const|function)\b)/g, '');
    // `export` left over would mean the standalone build is not truly standalone.
    if (/^\s*(?:import|export)\s/m.test(src))
        throw new Error(`Standalone module syntax left in ${path}`);
    script += `\n/* MODULE ${path} */\n${src}\n`;
}
let html = file('index.html').replace('<link rel="stylesheet" href="style.css"/>', `<style>${file('style.css')}</style>`);
html = html.replace('<script type="module" src="browser/flight.js"></script>', () => `<script>\n${script}\n</script>`);
writeFileSync(resolve(root, 'play.html'), html);
console.log('Built standalone play.html (' + html.length + ' bytes)');
