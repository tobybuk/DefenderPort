/** Verify extracted BLK71 data against the fixed upstream source checkout.
 * Does not assemble or execute any game instructions.
 * The caller may pass an explicit SRC path for unit testing; the default
 * location is the Git checkout managed by tools/fetch-source.mjs.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { extractLiteralTables } from './source-data-core.mjs';
import { TDATA, MTERR } from '../original/blk71-data.js';
import { verify } from './source-util.mjs';
export function verifyBlk71Tables(sourceText) {
    const tables = extractLiteralTables(sourceText, ['TDATA', 'MTERR']);
    for (const [label, local, size] of [['TDATA', TDATA, 256], ['MTERR', MTERR, 384]]) {
        const found = tables[label];
        if (found.length !== size)
            throw new Error(`${label} original expected ${size} bytes, got ${found.length}`);
        for (let i = 0; i < size; i++)
            if (found[i] !== local[i])
                throw new Error(`${label} differs from original source at byte ${i}: expected $${found[i].toString(16)}, found $${local[i].toString(16)}`);
    }
    return { TDATA: tables.TDATA.length, MTERR: tables.MTERR.length };
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
    if (!process.argv[2])
        verify();
    const src = process.argv[2] || resolve(import.meta.dirname, '../source/defender/src/blk71.src');
    console.log('PASS: pinned BLK71 tables match:', verifyBlk71Tables(readFileSync(src, 'utf8')));
}
