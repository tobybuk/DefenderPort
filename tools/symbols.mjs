import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { verify, saveJson, ROOT, SOURCE, sha256 } from './source-util.mjs';
import { scanSymbols } from './symbols-core.mjs';
try {
    const commit = verify();
    const source = readFileSync(resolve(SOURCE, 'phr6.src'), 'utf8');
    const { symbols, issues } = scanSymbols(source.split(/\r?\n/));
    if (issues.length)
        throw new Error(`${issues.length} source symbol parse issues`);
    for (const key of ['RAM', 'ACTIVE', 'FREE', 'CRPROC', 'PTAB', 'PSIZE', 'TABEND', 'SPTAB', 'SPSIZE', 'SPTEND', 'PLINK', 'PADDR', 'PTIME', 'PTYPE', 'PCOD', 'OBJID', 'CTYPE']) {
        if (!(key in symbols))
            throw new Error(`Required source symbol ${key} missing. Must not guess RAM address.`);
    }
    const out = { commit, sourceSha256: sha256(source), symbols };
    saveJson(resolve(ROOT, 'generated/phr6.symbols.json'), out);
    console.log(`Parsed ${Object.keys(symbols).length} source symbols from phr6.src; output generated/phr6.symbols.json`);
}
catch (e) {
    console.error(e.message);
    process.exitCode = 1;
}
