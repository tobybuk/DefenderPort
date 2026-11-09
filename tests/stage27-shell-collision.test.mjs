/**
 * Stage 27 Williams DEFA7.SRC COLCHK/COL0 (3128-3151) and BKIL
 * (2697-2717) cross-list integration. Enemy projectiles are held in SPTR,
 * not OPTR, and use source BMBP1/BXPIC rather than substituted hitboxes.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFlightHarness } from '../demo/flight-harness.js';
import { BXPIC } from '../original/defb6-gameplay-pictures.js';
const off = (h, n) => h.Layout.at(n);
function projectileOnShip(h) {
    const R = h.ram, X = h.procs.GETOB(), { x, y } = h.STATE();
    const a = n => off(h, n), wr = (k, v) => R.write16(X + a(k), v);
    wr('OLINK', R.read16(a('SPTR')));
    R.write16(a('SPTR'), X);
    wr('OBJX', ((x + 1) << 8) | (y + 1));
    wr('OX16', (R.read16(a('BGL')) + ((x + 1) << 6)) & 65535);
    wr('OY16', (y + 1) << 8);
    wr('OPICT', 0xe292); // WAVE_ADDR.BMBP1, original 2×3 bitmap
    wr('OCVECT', 0xe294); // WAVE_ADDR.BKIL, source shell collision vector
    R.write8(a('BMBCNT'), R.read8(a('BMBCNT')) + 1);
    return X;
}
test('source BXD10 projectile explosion has 4 by 8 original colour bytes', () => {
    assert.equal(BXPIC.width, 4);
    assert.equal(BXPIC.height, 8);
    assert.equal(Buffer.from(BXPIC.phases[0]).toString('hex'), '000ccccccccc0c00cccccccccccccccccccccccccccccccc00c0ccccccccc000');
});
test('player collision must scan SPTR after OPTR, invoke BKIL and unlink the projectile', () => {
    const h = createFlightHarness(), X = projectileOnShip(h);
    assert.equal(h.ram.read16(off(h, 'SPTR')), X);
    assert.equal(h.collision.COLCHK(), X);
    assert.equal(h.ram.read16(off(h, 'SPTR')), 0, 'BKIL removes projectile from source SPTR');
    assert.equal(h.ram.read8(off(h, 'BMBCNT')), 0);
    assert.equal(h.STATE().scoreHits, 1, 'source BKIL awards points via SCORE');
    assert.equal(h.ram.read16(X + off(h, 'OPICT')), 0xe342, 'source BXPIC registered');
    assert.ok(h.ram.read16(off(h, 'LSEXPL')), 'BKIL starts original explosion');
});
test('collision detection does not invent offscreen or empty shell collisions', () => {
    const h = createFlightHarness(), X = projectileOnShip(h);
    h.ram.write16(X + off(h, 'OBJX'), 0); // hidden shell has no pixel address
    assert.equal(h.collision.COLCHK(), 0);
    assert.equal(h.ram.read16(off(h, 'SPTR')), X);
    assert.equal(h.STATE().scoreHits, 0);
});
