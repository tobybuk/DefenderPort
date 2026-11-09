/**
 * Conservative conversion of literal original 6809 FCB/FDB tables into JS data.
 * It must FAIL if a table contains an expression, macro, relocation or opcode
 * we cannot prove, rather than invent replacement bytes.
 *
 * No ROM or 6809 instructions are interpreted. This is a source-data compiler
 * for the fixed upstream commit, used at build/verification time only.
 */
import { parseLine } from './source-util.mjs';
export function numericLiteral(text) {
    const v = text.trim();
    if (/^\$[0-9a-f]+$/i.test(v))
        return parseInt(v.slice(1), 16);
    if (/^%[01]+$/.test(v))
        return parseInt(v.slice(1), 2);
    if (/^\d+$/.test(v))
        return Number(v);
    if (/^'[^']'$/.test(v))
        return v.charCodeAt(1);
    throw new Error(`Symbolic or unsupported source data expression: ${v}`);
}
export function extractLiteralTables(src, names) {
    const request = new Set(names.map(x => x.toUpperCase()));
    const result = new Map(), lines = src.split(/\r?\n/);
    let active = null;
    for (let i = 0; i < lines.length; i++) {
        const part = parseLine(lines[i]);
        if (!part)
            continue;
        const { label, op, arg } = part;
        if (label && request.has(label)) {
            if (result.has(label))
                throw new Error(`Duplicate source table ${label}`);
            result.set(label, []);
            active = label;
        }
        else if (label && active) {
            active = null;
        }
        if (!active)
            continue;
        if (op !== 'FCB' && op !== 'FDB')
            throw new Error(`Unsupported data directive in ${active} at ${i + 1}: ${op}`);
        for (const word of arg.split(',')) {
            const value = numericLiteral(word);
            const limit = op === 'FCB' ? 255 : 65535;
            if (value < 0 || value > limit)
                throw new Error(`Out of range ${op} literal in ${active}`);
            if (op === 'FCB')
                result.get(active).push(value);
            else
                result.get(active).push((value >>> 8) & 255, value & 255);
        }
    }
    for (const name of request)
        if (!result.has(name))
            throw new Error(`Missing original data table ${name}`);
    return Object.fromEntries(result);
}
