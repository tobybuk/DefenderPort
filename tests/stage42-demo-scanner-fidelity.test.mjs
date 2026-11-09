/**
 * Stage 42 source-grounded attract-page regressions.
 * Upstream ROM disassembly (pinned e74006344b16d19245510b5e55780f90d7606bb8):
 * AMODE1.SRC 468-528: LEDRET/SCINIT; 697-710: AMODES; 957-971: CREDS.
 * DEFA7.SRC 905-928: BORDER; AMODE1.SRC 1159-1220: SCNR/MT1.
 * These assertions use values independently derived from assembly labels,
 * not screen coordinates invented to match a reference screenshot.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createAmode1Attract } from '../original/amode1-attract.js';
import { PHR6_LAYOUT as L } from '../runtime/phr6-layout.js';
const byte = (a, p) => a.video.read8(p);
function region(a, x0, x1, y0, y1) {
    let count = 0;
    for (let x = x0; x <= x1; x++)
        for (let y = y0; y <= y1; y++)
            if (byte(a, (x << 8) | y))
                count++;
    return count;
}
test('LEDRET exactly retains source SCINIT STATUS $DB followed by $D9 before SCPROC', () => {
    const a = createAmode1Attract();
    a.SCINIT();
    assert.equal(a.ram.read8(L.at('STATUS')), 0xdb, 'SCINIT LDA #$DB');
    assert.equal(a.ram.read8(L.at('PLAXC')), 0x10, 'SCINIT LDX #$1030, high byte');
    assert.equal(a.ram.read8(L.at('PLAYC')), 0x30, 'SCINIT LDX #$1030, low byte');
    a.LEDRET();
    assert.equal(a.ram.read8(L.at('STATUS')), 0xd9, 'LEDRET overwrites SCINIT status with $D9');
    assert.equal(a.ram.read16(L.at('BGL')), 0);
    assert.equal(a.ram.read16(L.at('BGLX')), 0);
});
test('DEFA7.BORDER writes all four distinct scanner frame segments into column-major video RAM', () => {
    const a = createAmode1Attract({ initialCredits: 0 });
    a.LEDRET();
    // BORDER BORDLP, BORD1, BORD2, BORD3; verify source addresses rather than
    // comparing against the JavaScript implementation's own coordinate math.
    for (const ptr of [0x0028, 0x1028, 0x3028, 0x9b28])
        assert.equal(byte(a, ptr), 0x55, `lower divider source framebuffer $${ptr.toString(16)}`);
    for (const ptr of [0x2f10, 0x7010])
        assert.equal(byte(a, ptr), 0x55, `side wall source framebuffer $${ptr.toString(16)}`);
    assert.equal(byte(a, 0x3007), 0x55, 'source top edge');
    assert.equal(byte(a, 0x4b07), 0x55, 'source top edge at central marker');
});
test('scanner colour 5 remains Red Label CRTAB $81, including after attract colour cycling', () => {
    const a = createAmode1Attract();
    a.LEDRET();
    assert.equal(a.ram.read8(L.at('PCRAM') + 5), 0x81, 'source PCRAM palette slot 5');
    assert.equal(a.ram.read8(0xc005), 0x81, 'latched hardware palette slot 5');
    for (let i = 0; i < 48; i++)
        a.STEP();
    assert.equal(a.ram.read8(0xc005), 0x81, 'cycling must not overwrite scanner colour');
});
test('MT1 renders orange scanner mini-terrain rather than an empty framed rectangle', () => {
    const a = createAmode1Attract();
    a.LEDRET();
    // Scanner bounds x=$30..$70, y=$08..$27; interior terrain is from the
    // ROM BLK71.MTERR table via AMODE1.SCNR.MT1 (not browser drawing).
    const inside = region(a, 0x31, 0x6f, 0x09, 0x26);
    assert.ok(inside > 50, `original radar contains terrain, got ${inside} nonzero source bytes`);
    for (let i = 0; i < 96; i++)
        a.STEP();
    assert.ok(region(a, 0x31, 0x6f, 0x09, 0x26) > 50, 'MT1 terrain survives subsequent scanner frames');
    assert.equal(a.ram.read8(L.at('STATUS')), 0xd9, 'scanner terrain enabling status is retained');
});
test('SCINIT scanner ship marker stays $1030; scripted PLAPIC movement may not change its position', () => {
    const a = createAmode1Attract();
    a.LEDRET();
    for (let i = 0; i < 400; i++)
        a.STEP();
    assert.equal(a.STATE().page, 'instructions');
    assert.equal(a.ram.read8(L.at('PLAXC')), 0x10);
    assert.equal(a.ram.read8(L.at('PLAYC')), 0x30);
});
test('original CREDS reads CREDIT, suppresses zero and displays injected credits in source ROM glyphs', () => {
    const empty = createAmode1Attract({ initialCredits: 0 });
    empty.LEDRET();
    const withCoins = createAmode1Attract({ initialCredits: 2 });
    withCoins.LEDRET();
    // $28E5 CREDV starts, $48E5 number. Neither is allowed to be a
    // permanent screenshot overlay independent of cabinet credit RAM.
    assert.equal(region(empty, 0x28, 0x58, 0xe5, 0xed), 0, 'zero CREDIT must not draw credits');
    assert.ok(region(withCoins, 0x28, 0x58, 0xe5, 0xed) > 80, 'nonzero CREDIT produces source font glyphs');
    const numeric = region(withCoins, 0x48, 0x4d, 0xe5, 0xed);
    assert.ok(numeric > 0, 'WNUMBB-like source numeric glyph appears at $48E5');
    withCoins.ram.write8(L.at('CREDIT'), 0);
    withCoins.LEDRET();
    assert.equal(region(withCoins, 0x28, 0x58, 0xe5, 0xed), 0, 'credits are not hardcoded in the canvas');
});
test('AMODES restores original $FB on page restart; demo does not leak $D9 into title', () => {
    const a = createAmode1Attract();
    assert.equal(a.ram.read8(L.at('STATUS')), 0xfb, 'initial AMODES source status');
    a.LEDRET();
    assert.equal(a.ram.read8(L.at('STATUS')), 0xd9);
    a.AMODES();
    assert.equal(a.ram.read8(L.at('STATUS')), 0xfb, 'return-to-title AMODES status');
});
test('single-source DEMO preserves original scanner captions and cycle-specific score labels', () => {
    const a = createAmode1Attract();
    a.LEDRET();
    // Source TEXTP starts with SCANNER. LANDER appears only when BMODE2
    // increments TEXPTR, not in the initial screen initializer.
    a.STEP();
    assert.ok(region(a, 0x43, 0x62, 0x30, 0x39) > 20, 'source SCANNER text');
    assert.equal(region(a, 0x1c, 0x2e, 0x70, 0x79), 0, 'LANDER not written before its source TEXTAB step');
    for (let i = 0; i < 900; i++) {
        const s = a.STEP();
        if (s.page === 'instructions' && s.textLimit >= 2) {
            for (let j = 0; j < 32; j++)
                a.STEP();
            assert.ok(region(a, 0x1c, 0x2e, 0x70, 0x79) > 20, 'LANDER appears at source event');
            assert.ok(region(a, 0x22, 0x31, 0x7a, 0x83) > 10, '150 point value source row');
            return;
        }
    }
    assert.fail('source BMODE2 caption transition not reached');
});
test('later TEXTAB pages retain radar frame, ground and the first three named enemies', () => {
    const a = createAmode1Attract();
    a.LEDRET();
    for (let i = 0; i < 1600; i++)
        a.STEP();
    const state = a.STATE();
    assert.equal(state.page, 'instructions');
    assert.ok(state.textLimit >= 3, 'source advances TEXTP limit on scripted enemy deaths');
    assert.equal(byte(a, 0x0028), 0x55, 'full-width divider remains through subsequent explosion materialisations');
    assert.ok(region(a, 0x31, 0x6f, 0x09, 0x26) > 40, 'miniature terrain remains populated');
    assert.ok(region(a, 0x43, 0x62, 0x30, 0x39) > 15, 'SCANNER still visible');
    assert.ok(region(a, 0x1c, 0x2f, 0x70, 0x79) > 15, 'LANDER heading');
    assert.ok(region(a, 0x3c, 0x50, 0x70, 0x79) > 15, 'MUTANT heading');
    assert.ok(region(a, 0x5f, 0x72, 0x70, 0x79) > 15, 'BAITER heading');
    assert.ok(region(a, 0x20, 0x50, 0xd0, 0xe0) > 20, 'original foreground terrain survives stage transitions');
});
test('full scripted enemy sequence returns naturally to AMODES with ROM $FB status', () => {
    const a = createAmode1Attract();
    a.LEDRET();
    let finished = false;
    for (let i = 0; i < 2600; i++) {
        const state = a.STEP();
        if (state.page === 'presentation') {
            assert.equal(a.ram.read8(L.at('STATUS')), 0xfb);
            assert.equal(state.step, 'LOGO0');
            finished = true;
            break;
        }
    }
    assert.ok(finished, 'source demo returns to animated Williams logo after enemy sequence');
});
