import { parseLine } from './source-util.mjs';
const DATA = new Set(['RMB', 'EQU', 'FCB', 'FDB', 'FCC', 'FILL', 'RZB', 'RMW', 'FCS', 'ORG', 'SET']);
const CALL = new Set(['JSR', 'LBSR', 'BSR', 'JMP', 'LBRA', 'BRA', 'NEWP', 'NAP', 'NAPP', 'KILP', 'KILO']);
export function inventoryFile(name, source) {
    const lines = source.replace(/\r/g, '').split('\n');
    const labels = [], references = [];
    let macro = false;
    for (let i = 0; i < lines.length; i++) {
        const part = parseLine(lines[i]);
        if (!part)
            continue;
        const { label, op, arg } = part;
        if (op === 'MACRO') {
            if (label)
                labels.push({ name: label, line: i + 1, kind: 'macro' });
            macro = true;
            continue;
        }
        if (op === 'ENDM') {
            macro = false;
            continue;
        }
        if (macro)
            continue;
        if (label)
            labels.push({ name: label, line: i + 1, kind: op === null ? 'branch-or-alias' : DATA.has(op) ? 'data-or-definition' : 'code-label', op });
        if (CALL.has(op)) {
            const raw = arg.split(',');
            for (const word of raw) {
                const m = word.replace(/^[#\[\s]+/, '').match(/^([A-Za-z_][A-Za-z0-9_]*)/);
                if (m)
                    references.push({ fromLine: i + 1, target: m[1].toUpperCase(), op });
            }
        }
    }
    return { file: name, lines: lines.length, labels, references };
}
export function addGlobalReferences(files) {
    const names = new Set(files.flatMap(f => f.labels.map(x => x.name)));
    return files.map(f => ({ ...f, references: f.references.map(x => ({ ...x, resolvesInInventory: names.has(x.target) })) }));
}
/** Build conservative candidate list: branches/continuations/calls may name a callable
 * original entrypoint. Never claim every label is a function.
 */
export function callableCandidates(files, statusEntries = []) {
    const status = new Map(statusEntries.map(e => [`${e.module}:${e.label}`, e.status]));
    const all = [];
    for (const f of files) {
        for (const label of f.labels) {
            const calls = files.flatMap(g => g.references.filter(r => r.target === label.name)
                .map(r => ({ fromFile: g.file, fromLine: r.fromLine, op: r.op })));
            if (!calls.length)
                continue;
            all.push({ module: f.file, label: label.name, line: label.line, kind: label.kind,
                references: calls, status: status.get(`${f.file}:${label.name}`) || 'incomplete-unreviewed' });
        }
    }
    return all;
}
