import test from 'node:test';
import assert from 'node:assert/strict';
import { numericLiteral, extractLiteralTables } from '../tools/source-data-core.mjs';
test('source-data literals preserve decimal, hex, binary and byte/word ordering', () => {
    const text = `\nLASSND FCB $C0,$01,$30,$14,0\n\t FCB $02\n\nRPSND FCB $FF,1,32,$1e,0\nNEXT FDB $1234,%1001,'A'\n`;
    const { LASSND, RPSND, NEXT } = extractLiteralTables(text, ['LASSND', 'RPSND', 'NEXT']);
    assert.deepEqual(LASSND, [0xc0, 1, 0x30, 0x14, 0, 2]);
    assert.deepEqual(RPSND, [255, 1, 32, 30, 0]);
    assert.deepEqual(NEXT, [0x12, 0x34, 0, 9, 0, 65]);
});
test('source-data extraction refuses silent symbolic, unsupported macro and invalid width', () => {
    assert.throws(() => numericLiteral('PLAPIC+2'), /unsupported/);
    assert.throws(() => extractLiteralTables('X FCB $100\n', ['X']), /Out of range/);
    assert.throws(() => extractLiteralTables('X FDB PLAPIC\n', ['X']), /unsupported/);
    assert.throws(() => extractLiteralTables('X FCC "HELLO"\n', ['X']), /Unsupported/);
    assert.throws(() => extractLiteralTables('X FCB 3\n', ['Y']), /Missing original/);
});
