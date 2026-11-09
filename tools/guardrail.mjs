import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from './source-util.mjs';
const dir = resolve(ROOT, 'original');
let bad = [];
for (const file of readdirSync(dir).filter(x => x.endsWith('.js'))) {
    const data = readFileSync(resolve(dir, file), 'utf8');
    for (const [pattern, description] of [
        [/\bMath\.random\s*\(/, 'invented random generator'],
        [/\brequestAnimationFrame\s*\(/, 'browser scheduling inside original translation'],
        [/\bsetInterval\s*\(/, 'custom timer inside original translation'],
        [/\bframe\s*%/, 'invented frame-modulo game scheduling'],
        [/\bCanvasRenderingContext2D\b/, 'Canvas dependency in game translation'],
    ])
        if (pattern.test(data))
            bad.push(`${file}: ${description}`);
}
if (bad.length) {
    console.error(bad.join('\n'));
    process.exitCode = 1;
}
else
    console.log('PASS: no prohibited substitution patterns found in original/ translations');
