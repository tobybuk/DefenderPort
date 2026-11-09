import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, verify, SOURCE } from './source-util.mjs';
import { inventoryFile } from './inventory-core.mjs';
try {
    verify();
    const status = JSON.parse(readFileSync(resolve(ROOT, 'docs/PORT_STATUS.json'), 'utf8'));
    const known = new Set();
    for (const file of [...new Set(status.entries.map(e => e.module))]) {
        const inventory = inventoryFile(file, readFileSync(resolve(SOURCE, file), 'utf8'));
        for (const item of inventory.labels)
            known.add(item.name);
    }
    let good = 0;
    for (const entry of status.entries) {
        if (!known.has(entry.label) || !known.has(entry.asm_start) || !known.has(entry.asm_end_exclusive))
            throw new Error(`Source mapping invalid: ${entry.label}`);
        const code = readFileSync(resolve(ROOT, entry.js), 'utf8');
        const pattern = new RegExp(`\\bfunction\\s+${entry.label}\\s*\\(`);
        if (!pattern.test(code))
            throw new Error(`No 1:1 JavaScript routine for ${entry.label}`);
        if (entry.status === 'verified' && !entry.evidence)
            throw new Error(`Cannot mark ${entry.label} verified without differential evidence`);
        good++;
    }
    const overlap = new Set(status.entries.map(x => x.label));
    for (const label of status.explicitly_untranslated)
        if (overlap.has(label))
            throw new Error(`Untranslated label ${label} incorrectly listed translated`);
    console.log(`Audited ${good} source-labelled JavaScript translations; ${status.explicitly_untranslated.length} critical routines remain explicitly incomplete.`);
}
catch (e) {
    console.error(e.message);
    process.exitCode = 1;
}
