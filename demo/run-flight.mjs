#!/usr/bin/env node
import { createFlightHarness } from './flight-harness.js';
const lab = createFlightHarness();
console.log('Original PLAYER native JavaScript transliteration: deterministic flight fixture');
console.log('FRAME   SCREEN X/Y   BGL    WORLD X   VX (16:8)   VY');
for (let i = 0; i <= 180; i++) {
    lab.INPUT({ thrust: i < 130, up: i >= 30 && i < 50, down: i >= 120 && i < 145 });
    if (i !== 0)
        lab.STEP();
    if (i % 15 === 0) {
        const s = lab.STATE();
        console.log(String(i).padStart(5), String(s.x).padStart(6), String(s.y).padStart(3), ' $' + s.bgl.toString(16).padStart(4, '0'), ' $' + s.worldX.toString(16).padStart(4, '0'), String(s.vx).padStart(8) + ':' + s.vxFraction.toString(16).padStart(2, '0'), String(s.vy).padStart(6));
    }
}
