/** Extract original MTERR FCB data from an independently obtained pinned checkout.
 * Never assembles or emulates 6809 machine code. Input must be the exact src/blk71.src
 * revision selected by tools/fetch-source.mjs. No original bytes are guessed.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { verify } from './source-util.mjs';
export function extractMTERR(src) {
    const lines = src.split(/\r?\n/);
    const start = lines.findIndex(x => /^\s*MTERR\s+FCB\s/i.test(x));
    if (start < 0)
        throw new Error('MTERR not found in pinned BLK71.SRC');
    const bytes = [];
    for (let n = start; n < lines.length; n++) {
        const line = lines[n];
        const m = line.match(/^\s*(?:MTERR\s+)?FCB\s+([^;*]+)/i);
        if (!m)
            break;
        for (const p of m[1].split(',').map(x => x.trim())) {
            if (!/^\$[0-9a-f]{1,2}$/i.test(p))
                throw new Error(`MTERR contains nonliteral FCB at line ${n + 1}: ${p}`);
            bytes.push(parseInt(p.slice(1), 16));
        }
    }
    if (bytes.length !== 384)
        throw new Error(`MTERR must contain 384 source bytes, got ${bytes.length}`);
    return Uint8Array.from(bytes);
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
    verify(); // Refuse to extract assets from anything but the pinned commit.
    const root = resolve(import.meta.dirname, '..');
    const original = resolve(root, 'source/defender/src/blk71.src');
    const out = resolve(root, 'original/amode1-mterr.generated.js');
    const bytes = extractMTERR(readFileSync(original, 'utf8'));
    writeFileSync(out, `// Extracted verbatim from pinned original BLK71.SRC; user local source required.\nexport const MTERR=Uint8Array.from(${JSON.stringify(Array.from(bytes))});\n`);
    console.log(`Generated ${out}: ${bytes.length} original source data bytes`);
}
