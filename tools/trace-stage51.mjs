/**
 * Source-level timing trace for the Stage 51 native JavaScript attract port.
 * No M6809 emulator, no network and no invented slowdown factors.
 * Each row is a nominal Williams raster tick, *not* a browser paint.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAmode1Attract } from '../original/amode1-attract.js';
import { VIDEO_FRAME_MS } from '../browser/source-clock.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const frames = Number(process.argv[2] ?? 520);
if (!Number.isInteger(frames) || frames < 1 || frames > 15000)
    throw Error('frame count must be an integer 1..15000');
const lab = createAmode1Attract();
const data = [];
for (let i = 1; i <= frames; i++) {
    const s = lab.DISPLAY_STEP();
    data.push({
        videoFrame: i,
        milliseconds: Number((i * VIDEO_FRAME_MS).toFixed(5)),
        executivePasses: s.cpuBudget.executivePasses,
        execTimerRead: s.execTimerRead ?? '',
        irqTimer: s.cpuBudget.timer,
        cpuBusyRemaining: s.cpuBudget.busyCyclesRemaining,
        estimatedExecCycles: s.sourceExecCycles,
        page: s.page,
        routine: s.step,
        defenderAge: s.defenderAge,
        defenderPhase: s.defenderPhase,
        fullWordWrites: s.defender50Draws ?? 0,
        maxTimerRead: s.cpuBudget.lastTimerRead
    });
}
const columns = Object.keys(data[0]);
const csv = [columns.join(','),...data.map(row => columns.map(c=>row[c]).join(','))].join('\n')+'\n';
const file = resolve(root,'docs/STAGE51_VIDEO_CPU_TRACE.csv');
writeFileSync(file,csv);
const ages = [0,15,30,45,46,48,86];
const checkpoints = Object.fromEntries(ages.map(age => {
    const frame = data.find(r=>r.defenderAge===age);
    return [age,frame?{displayFrame:frame.videoFrame,milliseconds:frame.milliseconds,executivePasses:frame.executivePasses}:null];
}));
const summary = {
    source:'mwenge/defender e74006344b16d19245510b5e55780f90d7606bb8',
    model:'native JS 6809 source-cycle estimates, not a full ROM CPU/IRQ trace',
    physicalFrames:frames,
    displayHz:1000/VIDEO_FRAME_MS,
    executivePasses:data.at(-1).executivePasses,
    extraIrqTicksOverExec: frames-data.at(-1).executivePasses,
    multiTimerReads:lab.TIMING_TRACE().filter(e=>e.timerTicks>1).length,
    checkpoints,
    knownUnknowns:['full IRQ routine CPU cycles','LOGO0 and MESS0 instruction cycles',
       '6809 interrupt preemption inside long EXEC', 'per-write video timestamps',
       'complete source-process scheduling across entire game']
};
writeFileSync(resolve(root,'docs/STAGE51_VIDEO_CPU_SUMMARY.json'),JSON.stringify(summary,null,2)+'\n');
console.log(`Created ${file}`); console.log(JSON.stringify(summary,null,2));
