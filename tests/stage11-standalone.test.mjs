import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Script } from 'node:vm';
const root = resolve(import.meta.dirname, '..');
test('Stage 11 standalone build contains parseable complete native JS, no ROM loader or emulator', () => {
    const html = readFileSync(resolve(root, 'play.html'), 'utf8');
    const match = html.match(/<script>([\s\S]*?)<\/script>/);
    assert.ok(match, 'single-file standalone JS must be embedded');
    assert.doesNotThrow(() => new Script(match[1], { filename: 'standalone-defender-stage11.js' }));
    assert.match(match[1], /function GEXEC\(/);
    assert.match(match[1], /function GETWV\(/);
    assert.match(match[1], /function WDELT\(/);
    assert.match(match[1], /function COLR\(/);
    assert.match(match[1], /function SCPROC\(/);
    for (const id of ['processStep', 'process120', 'process600', 'processReverse', 'processReset'])
        assert.match(html, new RegExp(`id="${id}"`));
    assert.doesNotMatch(html, /type="file"/);
});
test('Stage 11 process controls are registered once outside requestAnimationFrame loop', () => {
    const source = readFileSync(resolve(root, 'browser/flight.js'), 'utf8');
    const first = source.indexOf('function loop(timestamp)');
    const end = source.indexOf('window.addEventListener', first);
    assert.ok(first >= 0 && end > first);
    assert.doesNotMatch(source.slice(first, end), /processStep|process600|processReverse/);
    assert.equal((source.match(/processStep:/g) || []).length, 1);
});
