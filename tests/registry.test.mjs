import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const status = JSON.parse(readFileSync(resolve(root, 'docs/PORT_STATUS.json'), 'utf8'));
test('every claimed source routine has a corresponding named native JavaScript function', () => {
    for (const e of status.entries) {
        const code = readFileSync(resolve(root, e.js), 'utf8');
        assert.match(code, new RegExp(`\\bfunction\\s+${e.label}\\s*\\(`), e.label);
        assert.notEqual(e.status, 'verified', 'No reference execution trace has been validated yet');
    }
});
test('no critical known untranslated routine is accidentally described as complete', () => {
    const tracked = new Set(status.entries.map(e => e.label));
    for (const label of status.explicitly_untranslated)
        assert.equal(tracked.has(label), false, label);
    assert.equal(status.not_playable, true);
});
