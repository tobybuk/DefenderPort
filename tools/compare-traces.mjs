/** Compare original-game reference state snapshots with native JS snapshots.
 * Input JSON: [{"step": 1, "ram": {"A042": 17, ...}, "events": ["PINIT"]},...]
 * These should be measured independently, never generated from a JavaScript guess.
 */
import { readFileSync } from 'node:fs';
const [original, ported] = process.argv.slice(2);
if (!original || !ported) {
    console.error('Usage: node tools/compare-traces.mjs ORIGINAL.json JAVASCRIPT.json');
    process.exit(2);
}
const A = JSON.parse(readFileSync(original, 'utf8'));
const B = JSON.parse(readFileSync(ported, 'utf8'));
let differences = 0;
function compare(left, right, path) {
    if (left && typeof left === 'object' && right && typeof right === 'object') {
        const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
        for (const k of keys)
            compare(left[k], right[k], `${path}.${k}`);
        return;
    }
    if (left !== right) {
        if (++differences <= 50)
            console.log(`${path}: original=${JSON.stringify(left)} js=${JSON.stringify(right)}`);
    }
}
compare(A, B, 'trace');
console.log(differences ? `FAIL: ${differences} differences` : 'PASS: identical recorded states');
process.exitCode = differences ? 1 : 0;
