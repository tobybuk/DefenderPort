import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDefb6BankingObjectRoutines } from '../original/defb6-banking-object.js';
import { RAM } from '../runtime/ram.js';
import { PHR6_LAYOUT } from '../runtime/phr6-layout.js';
const expected = ['KILOFF', 'OFSHIT', 'BGI', 'MAPCH7', 'MAPCH2', 'MAPCH3', 'MAPCH1', 'MAPCHG'];
test('Every new source entry has a one-to-one JS function and an explicit unverified source record', () => {
    const routines = createDefb6BankingObjectRoutines(new RAM(), PHR6_LAYOUT);
    const report = JSON.parse(readFileSync(new URL('../docs/PORT_STATUS.json', import.meta.url), 'utf8'));
    for (const label of expected) {
        assert.equal(typeof routines[label], 'function', `${label} has no matching callable JS routine`);
        const matches = report.entries.filter(e => e.label === label && e.module === 'defb6.src');
        assert.equal(matches.length, 1, `${label} must have exactly one original-to-JS map entry`);
        assert.equal(matches[0].status, 'translated-unverified');
        assert.equal(matches[0].js, 'original/defb6-banking-object.js');
    }
    assert.equal(report.not_playable, true);
    assert.equal(report.source_comparison_verified, false);
});
