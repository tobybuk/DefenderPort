import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
export const ROOT = resolve(import.meta.dirname, '..');
export const META = JSON.parse(readFileSync(resolve(ROOT, 'docs/UPSTREAM.json'), 'utf8'));
export const SOURCE = resolve(ROOT, META.game_sources_path);
export function verify() {
    const repo = resolve(ROOT, 'source/defender');
    if (!existsSync(resolve(repo, '.git')))
        throw new Error('Pinned source not found. Run npm run source:fetch (requires Git/network).');
    const sha = execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    if (sha !== META.commit)
        throw new Error(`REFUSING DIFFERENT UPSTREAM REVISION: expected ${META.commit}, got ${sha}`);
    for (const name of META.core_files) {
        if (!existsSync(resolve(SOURCE, name)))
            throw new Error(`Missing original source ${name}`);
    }
    return sha;
}
export const sha256 = t => createHash('sha256').update(t).digest('hex');
export function saveJson(path, object) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(object, null, 2) + '\n');
}
export function sourceLines(name) {
    return readFileSync(resolve(SOURCE, name), 'utf8').replace(/\r/g, '').split('\n');
}
export function parseLine(line) {
    const noComment = line.split(';')[0];
    if (/^\s*(\*|;|$)/.test(line))
        return null;
    const match = noComment.match(/^([A-Za-z_.$][\w.$]*)\s+(\S+)(?:\s+(.*))?$/);
    if (match)
        return { label: match[1].toUpperCase(), op: match[2].toUpperCase(), arg: (match[3] || '').trim() };
    const unlab = noComment.match(/^\s+(\S+)(?:\s+(.*))?$/);
    if (unlab)
        return { label: null, op: unlab[1].toUpperCase(), arg: (unlab[2] || '').trim() };
    const solo = noComment.trim().match(/^([A-Za-z_.$][\w.$]*)$/);
    if (solo)
        return { label: solo[1].toUpperCase(), op: null, arg: '' };
    return null;
}
