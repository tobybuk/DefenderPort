/** Stage 32: 12,000-update integration regressions: moving player, laser and cabinet actions, wave bonus. */
import { createFlightHarness } from '../demo/flight-harness.js';
import assert from 'node:assert/strict';
const h = createFlightHarness({ infiniteSmartBombs: true, sourceCabinetInput: true, playerCollisions: true });
const at = n => h.Layout.at(n), counts = ['LNDCNT', 'LNDRES', 'TIECNT', 'PRBCNT', 'SWCNT', 'SCZCNT', 'SCZRES'];
let resetCount = 0, maximumWave = 1, laserCount = 0, bonusTicks = 0;
for (let n = 0; n < 12000; n++) {
    let s = h.STATE();
    if (s.gameOver) {
        h.RESET();
        resetCount++;
        s = h.STATE();
    }
    // Force wave completion only periodically, to cover the bonus process under
    // normal active wave, death, and scanner states. Do not manufacture points.
    if (n % 1200 === 300) {
        for (const key of counts)
            h.ram.write8(at(key), 0);
    }
    h.INPUT({
        thrust: n % 180 < 110,
        up: n % 180 < 45,
        down: n % 180 >= 80 && n % 180 < 105,
        fire: n % 7 === 0,
        reverse: n % 160 === 0,
        smartBomb: n % 130 === 1,
        hyperspace: n % 350 === 0
    });
    h.STEP();
    s = h.STATE();
    if (s.bonus)
        bonusTicks++;
    maximumWave = Math.max(maximumWave, s.wave.wave);
    laserCount = Math.max(laserCount, s.laserShots);
    assert.equal(s.infiniteSmartBombs, true);
}
assert.ok(maximumWave >= 2, `expected source wave-2 transition; only reached ${maximumWave}`);
assert.ok(bonusTicks > 128, `expected bonus presentation; observed ${bonusTicks} ticks`);
console.log(`PASS 12000 updates; max wave ${maximumWave}; bonus ticks ${bonusTicks}; laser requests ${laserCount}; resets ${resetCount}; exception-free`);
