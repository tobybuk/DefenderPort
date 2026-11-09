import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const { repository, commit } = JSON.parse(readFileSync(resolve(root, 'docs/UPSTREAM.json'), 'utf8'));
const dest = resolve(root, 'source/defender');
function run(...argv) {
    const p = spawnSync('git', argv, { stdio: 'inherit' });
    if (p.status !== 0)
        throw new Error(`git ${argv[0]} failed. You can also place an existing checkout at source/defender; verify its commit matches ${commit}.`);
}
try {
    mkdirSync(dirname(dest), { recursive: true });
    if (!existsSync(resolve(dest, '.git')))
        run('clone', '--no-checkout', repository, dest);
    run('-C', dest, 'fetch', '--depth', '1', 'origin', commit);
    run('-C', dest, 'checkout', '--detach', commit);
    const p = spawnSync('git', ['-C', dest, 'rev-parse', 'HEAD'], { encoding: 'utf8' });
    if (p.status !== 0 || p.stdout.trim() !== commit)
        throw new Error('Source SHA mismatch: refusing to generate translations or annotations.');
    console.log(`Verified upstream commit ${commit}`);
}
catch (e) {
    console.error(e.message);
    process.exitCode = 1;
}
