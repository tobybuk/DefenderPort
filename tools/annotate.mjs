/** Locally generate assembly-prepended JavaScript without redistributing original source. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, SOURCE, verify } from './source-util.mjs';
import { parseLine } from './source-util.mjs';
try {
    verify();
    const status = JSON.parse(readFileSync(resolve(ROOT, 'docs/PORT_STATUS.json'), 'utf8'));
    const missing = status.entries.filter(e => !e.asm_start || !e.asm_end_exclusive);
    if (missing.length) {
        console.warn(`Annotation coverage: ${missing.length} legacy routine mappings lack explicit upstream range metadata and cannot be annotated yet:`);
        for (const entry of missing)
            console.warn(`  ${entry.label} (${entry.js})`);
    }
    const grouped = Map.groupBy(status.entries.filter(e => e.asm_start && e.asm_end_exclusive), e => e.js);
    const output = resolve(ROOT, 'generated/annotated');
    mkdirSync(output, { recursive: true });
    for (const [dest, entries] of grouped) {
        let code = readFileSync(resolve(ROOT, dest), 'utf8');
        for (const entry of entries) {
            const lines = readFileSync(resolve(SOURCE, entry.module), 'utf8').split(/\r?\n/);
            const positions = new Map();
            for (let i = 0; i < lines.length; i++) {
                const parsed = parseLine(lines[i]);
                if (parsed?.label && !positions.has(parsed.label))
                    positions.set(parsed.label, i);
            }
            const start = positions.get(entry.asm_start), end = entry.asm_end_exclusive === 'EOF' ? lines.length : positions.get(entry.asm_end_exclusive);
            if (start === undefined || end === undefined || end <= start)
                throw new Error(`Bad source block bounds for ${entry.label}`);
            const body = lines.slice(start, end).join('\n').replace(/\*\//g, '* /');
            const marker = `\n/* UPSTREAM: ${entry.module}:${start + 1}-${end} — ${entry.label}\n${body}\n*/\nfunction ${entry.label}(`;
            const pattern = new RegExp(`\\bfunction\\s+${entry.label}\\s*\\(`);
            if (!pattern.test(code))
                throw new Error(`Missing function ${entry.label}`);
            code = code.replace(pattern, marker);
        }
        const target = resolve(output, dest);
        mkdirSync(resolve(target, '..'), { recursive: true });
        writeFileSync(target, code);
        console.log(`Wrote ${target}`);
    }
}
catch (e) {
    console.error(e.message);
    process.exitCode = 1;
}
