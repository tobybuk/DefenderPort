/** Stage 79: STOUT→SBLNK fall-through in play, and the attract scanner trail.
 * 1. The attract demo's GETOB records used to sit at $B000 with a $10 stride,
 *    running into SETAB ($B05D). The rising Swarmer's record overwrote the
 *    scanner's erase pointers, so its blip was never erased.
 * 2. Game RAM holds the genuine WCURS so the fall-through SBLNK never fires
 *    the anti-tamper RAM write, and stars hyper-jump as on the board.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createAmode1Attract } from '../original/amode1-attract.js';
import { PHR6_LAYOUT as L } from '../runtime/phr6-layout.js';
import { createFlightHarness } from '../demo/flight-harness.js';

/** Count non-zero scanner bytes in one column, rows $0B..$1B (above the mini-terrain). */
const columnBytes = (video, col) => {
    let n = 0;
    for (let y = 0x0b; y < 0x1c; y++) if (video.read8((col << 8) | y)) n++;
    return n;
};

test('attract: the rising Swarmer leaves no blip trail on the scanner', () => {
    const a = createAmode1Attract();
    a.LEDRET();
    let worst = 0, sawSwarmerRise = false;
    for (let t = 0; t < 2400; t++) {
        const st = a.STEP();
        if (st.page !== 'instructions') break;
        if (st.step === 'AMOD12' && st.objectIndex === 5) {
            sawSwarmerRise = true;
            // The Swarmer blip ($2424) is 2 rows tall at scanner column $53.
            worst = Math.max(worst, columnBytes(a.video, 0x53));
        }
    }
    assert.ok(sawSwarmerRise, 'reached the Swarmer showcase step');
    assert.ok(worst <= 2, `at most the live 2-row blip in the column (saw ${worst})`);
});

test('attract: every enemy step keeps SETAB pointers intact (no record overlap)', () => {
    const a = createAmode1Attract();
    a.LEDRET();
    const SETAB = L.at('SETAB'), STETAB = L.at('STETAB');
    for (let t = 0; t < 2400; t++) {
        const st = a.STEP();
        if (st.page !== 'instructions') break;
        const end = a.ram.read16(L.at('SETEND'));
        for (let p = SETAB; p < end; p += 2) {
            const ptr = a.ram.read16(p);
            // A blip pointer is a scanner screen address: column $30..$6F, row < $30.
            assert.ok(ptr >> 8 >= 0x30 && ptr >> 8 < 0x70 && (ptr & 255) < 0x30,
                `SETAB entry ${(p - SETAB) / 2} = $${ptr.toString(16)} at tick ${t}`);
        }
        assert.ok(end <= STETAB);
    }
});

test('game RESET stores the genuine COPYRT WCURS so SBLNK never blasts RAM', () => {
    const h = createFlightHarness({ sourceCabinetInput: true });
    h.RESET();
    assert.equal(h.ram.read16(L.at('WCURS')), 0x6245);
});

test('in play, stars hyper-jump (even SEED) through the STOUT fall-through', () => {
    const h = createFlightHarness({ sourceCabinetInput: true });
    h.RESET();
    const base = L.at('SMAP');
    const xs = () => Array.from({ length: 16 }, (_, i) => h.ram.read8(base + i * 4));
    const ys = () => Array.from({ length: 16 }, (_, i) => h.ram.read8(base + i * 4 + 1));
    const y0 = ys();
    let jumps = 0, prev = xs();
    for (let t = 0; t < 300; t++) {
        h.INPUT({}); h.STEP();
        const now = xs();
        // The ship is idle, so ITEMP scroll is 0: any X change is an SBLNK hyper.
        for (let i = 0; i < 16; i++) if (now[i] !== prev[i]) jumps++;
        prev = now;
    }
    assert.ok(jumps > 20, `stars hyper-jumped ${jumps} times in 300 ticks`);
    assert.deepEqual(ys(), y0, 'with the planet intact, SBLNK keeps each star\'s Y');
});
