/** Compare Stage 5 sound table arrays against the pinned ORIGINAL source FCBs.
 * Requires npm run source:fetch; no attempt to download a ROM.
 */
import { verify, sourceLines } from './source-util.mjs';
import { extractLiteralTables } from './source-data-core.mjs';
import { SOURCE_SOUND_TABLES } from '../original/defa7-sound.js';
verify();
const originals = extractLiteralTables(sourceLines('defa7.src').join('\n'), Object.keys(SOURCE_SOUND_TABLES));
let mismatches = 0;
for (const [name, values] of Object.entries(SOURCE_SOUND_TABLES)) {
    const before = originals[name] || [];
    if (before.length !== values.length || before.some((v, i) => v !== values[i])) {
        mismatches++;
        console.error(`Sound table ${name} differs from original source`);
    }
}
if (mismatches)
    process.exitCode = 1;
else
    console.log(`Source-checked ${Object.keys(SOURCE_SOUND_TABLES).length} complete sound tables against pinned assembly`);
