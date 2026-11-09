import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { verify, saveJson, ROOT, SOURCE, META, sha256 } from './source-util.mjs';
import { inventoryFile, addGlobalReferences, callableCandidates } from './inventory-core.mjs';
try {
    const commit = verify();
    const files = addGlobalReferences(META.core_files.map(file => {
        const source = readFileSync(resolve(SOURCE, file), 'utf8');
        return { ...inventoryFile(file, source), sha256: sha256(source) };
    }));
    const status = JSON.parse(readFileSync(resolve(ROOT, 'docs/PORT_STATUS.json'), 'utf8'));
    const candidates = callableCandidates(files, status.entries);
    const output = { commit, notes: 'Call/continuation targets are CANDIDATES, not necessarily independent subroutines. Every candidate is incomplete-unreviewed unless explicitly tracked.',
        summary: { moduleCount: files.length, labels: files.reduce((n, f) => n + f.labels.length, 0), potentialReferences: files.reduce((n, f) => n + f.references.length, 0), callableCandidates: candidates.length, unreviewedCandidates: candidates.filter(x => x.status === 'incomplete-unreviewed').length },
        candidates, files };
    saveJson(resolve(ROOT, 'generated/inventory.json'), output);
    console.log(`Inventory: ${output.summary.moduleCount} source modules, ${output.summary.labels} labels, ${output.summary.callableCandidates} entrypoint candidates, ${output.summary.unreviewedCandidates} still unreviewed.`);
}
catch (e) {
    console.error(e.message);
    process.exitCode = 1;
}
