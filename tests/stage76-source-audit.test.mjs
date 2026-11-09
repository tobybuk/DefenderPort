/** Stage 76 source audit: Bomber (TIE) movement, Bomber mines (BOMBST) and
 * the Swarmer explosion (MSWKIL), each checked against the original DEFB6
 * instruction sequence (pinned e740063).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFlightHarness } from '../demo/flight-harness.js';

const s8 = v => ((v & 255) << 24) >> 24, s16 = v => ((v & 0xffff) << 16) >> 16, u8 = v => v & 255, u16 = v => v & 0xffff;

function bomberScene() {
    const h = createFlightHarness({ infiniteSmartBombs: false, playerCollisions: false, sourceCabinetInput: true });
    h.RESET(); h.INPUT({}); h.STEP();
    const at = n => h.Layout.at(n);
    const [{ process: P, object: X }] = h.tie.TIEST(1);
    h.ram.write16(at('CRPROC'), P);
    return { h, at, P, X };
}
/** Original TIE vertical damping: SEX/ADDD, then ASL x3, TFR A,B, NEGB, SEX, ADDD. */
function originalDamp(oyv, seed) {
    const delta = s8(u8((seed & 0x3f) - 0x20));
    const v = u16(oyv + delta);
    const high = u16(v << 3) >>> 8;
    return u16(v + s8(u8(-high)));
}

test('TIE vertical damping uses NEGB on the shifted high byte, as in DEFB6', () => {
    // SEED & 6 selects the squad slot; these seeds all pick slot 0 (our Bomber).
    for (const [oyv, seed] of [[0x0040, 0x50], [0xffa0, 0x41], [0x0123, 0x79], [0x0000, 0x20]]) {
        const { h, at, X } = bomberScene();
        h.ram.write16(X + at('OBJX'), 0x4060); // on screen, OBJY = $60
        h.ram.write8(at('PLAYC'), 0x60 + 0x18); // between the $10 and $20 bands: no tracking impulse
        h.ram.write8(at('SEED'), seed); h.ram.write8(at('LSEED'), 1);
        h.ram.write16(X + at('OYV'), oyv);
        h.tie.TIE();
        assert.equal(h.ram.read16(X + at('OYV')), originalDamp(oyv, seed), `OYV $${oyv.toString(16)} SEED $${seed.toString(16)}`);
    }
});

test('off-screen TIE cruise correction tests gap-$10, so gaps $80-$8F push upwards', () => {
    const { h, at, P, X } = bomberScene();
    h.ram.write16(X + at('OBJX'), 0);          // off screen
    h.ram.write8(at('SEED'), 0x41);            // > $40: no cruise-altitude change; delta +1
    h.ram.write8(P + at('PD') + 9, 0x40);       // cruise altitude
    h.ram.write8(X + at('OY16'), u8(0x40 + 0x10 - 0x88)); // gap = $88
    h.ram.write16(X + at('OYV'), 0);
    h.tie.TIE();
    const damped = originalDamp(0, 0x41);
    assert.equal(h.ram.read16(X + at('OYV')), u16(damped - 0x10), 'SUBA #$10 leaves $78 (positive): LDD #-$10');
});

test('on-screen TIE tracks the player using OBJY, the screen row', () => {
    const { h, at, X } = bomberScene();
    h.ram.write16(X + at('OBJX'), 0x4060);
    h.ram.write8(X + at('OY16'), 0x10);        // deliberately different from OBJY
    h.ram.write8(at('PLAYC'), 0x60 - 0x30);    // OBJY - PLAYC = $30 >= $20: LDD #$FFF0
    h.ram.write8(at('SEED'), 0x20); h.ram.write8(at('LSEED'), 1);
    h.ram.write16(X + at('OYV'), 0);
    h.tie.TIE();
    assert.equal(h.ram.read16(X + at('OYV')), u16(originalDamp(0, 0x20) - 0x10));
});

test('Bombers lay mines: BOMBST makes a stationary BMBOUT shell with lifetime (SEED&$1F)+1', () => {
    const { h, at, X } = bomberScene();
    // Put the Bomber on screen in world terms so GETSHL accepts it.
    h.ram.write16(X + at('OX16'), u16(h.ram.read16(at('BGL')) + 60 * 64));
    h.ram.write8(X + at('OY16'), 0x80);
    h.ram.write8(at('SEED'), 0x0b);
    const before = h.ram.read8(at('BMBCNT'));
    const mine = h.tie.BOMBST(X);
    assert.ok(mine, 'mine allocated');
    assert.equal(h.ram.read16(mine + at('OBJCOL')), 0xf204, 'BMBOUT output routine');
    assert.equal(h.ram.read16(mine + at('OXV')), 0); assert.equal(h.ram.read16(mine + at('OYV')), 0);
    assert.equal(h.ram.read8(mine + at('ODATA')), 0x0c);
    assert.equal(h.ram.read8(at('BMBCNT')), before + 1);
    h.ram.write8(at('BMBCNT'), 10);
    assert.equal(h.tie.BOMBST(X), null, 'no mine once 10 shells exist');
    // The mine is drawn and retired by the original SHELL/SHSCAN path without error.
    h.ram.write8(at('BMBCNT'), before + 1);
    for (let t = 0; t < 40; t++) { h.INPUT({}); h.STEP(); }
});

test('MSWKIL explodes SWXP1 at OX16-$40 and two pixels higher', () => {
    const h = createFlightHarness({ infiniteSmartBombs: false, playerCollisions: false, sourceCabinetInput: true });
    h.RESET(); h.INPUT({}); h.STEP();
    const at = n => h.Layout.at(n);
    // Spawn Swarmers the original way: a Pod destroyed by PRBKIL runs MMSW.
    const P = [...(function* () { for (let q = h.ram.read16(at('ACTIVE')); q; q = h.ram.read16(q)) yield q; })()][0];
    const pod = h.probe.PRBST(1, P)[0];
    h.ram.write8(at('PRBCNT'), 1);
    h.KILL_BY_VECTOR(pod, 0xe2f4);
    let X = 0;
    for (let q = h.ram.read16(at('OPTR')); q && !X; q = h.ram.read16(q + at('OLINK')))
        if (h.ram.read16(q + at('OPICT')) === 0xe130) X = q;
    assert.ok(X, 'Swarmers created');
    assert.equal(h.ram.read16(X + at('OPICT')), 0xe130, 'a Swarmer');
    const x16 = h.ram.read16(X + at('OX16')), y = h.ram.read8(X + at('OY16'));
    assert.equal(h.KILL_BY_VECTOR(X, h.ram.read16(X + at('OCVECT'))), true);
    assert.equal(h.ram.read16(X + at('OX16')), u16(x16 - 0x40));
    assert.equal(h.ram.read8(X + at('OY16')), u8(y - 2));
    assert.equal(h.ram.read16(X + at('OPICT')), 0xe2b0, 'SWXP1');
});
