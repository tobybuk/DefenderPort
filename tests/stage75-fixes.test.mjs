/** Stage 75: engine fixes (KILOFF erase fall-through, PRBKIL = KILO) and
 * attract-pilot additions (real terrain keep height, human-safe firing,
 * last-resort hyperspace, Swarmer/Baiter shield models, demo banner).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script, createContext } from 'node:vm';
import { createFlightHarness } from '../demo/flight-harness.js';
import { createSourceTextBanner, BOOT_SOURCE } from '../browser/cabinet-boot.js';

const source = readFileSync(new URL('../browser/flight.js', import.meta.url), 'utf8');
const first = source.indexOf('function createAttractPilot()'), end = source.indexOf('const attractPilot=createAttractPilot();', first);
const create = new Script(source.slice(first, end) + ';createAttractPilot;').runInContext(createContext({}));

const activeProcesses = h => {
    const s = new Set();
    for (let q = h.ram.read16(h.Layout.at('ACTIVE')), i = 0; q && i < 200; i++, q = h.ram.read16(q)) s.add(q);
    return s;
};

test('KILOFF falls through to OFSHIT: a retired on-screen object leaves no pixels behind', () => {
    const h = createFlightHarness({ infiniteSmartBombs: false, playerCollisions: false, sourceCabinetInput: true });
    h.RESET();
    const at = n => h.Layout.at(n);
    let X = 0;
    for (let t = 0; t < 4000 && !X; t++) {
        h.INPUT({ thrust: true }); h.STEP();
        for (let q = h.ram.read16(at('OPTR')); q; q = h.ram.read16(q + at('OLINK')))
            if (h.ram.read16(q + at('OPICT')) === 0xe140 && (h.ram.read16(q + at('OBJX')) >>> 8) > 20 && (h.ram.read16(q + at('OBJX')) >>> 8) < 120) { X = q; break; }
    }
    assert.ok(X, 'a Lander came on screen');
    h.INPUT({}); h.STEP();
    const base = h.ram.read16(X + at('OBJX'));
    const bytes = () => { let n = 0; for (let c = 0; c < 5; c++) for (let r = 0; r < 8; r++) n += h.video.read8((base + c * 0x100 + r) & 0xffff) ? 1 : 0; return n; };
    assert.ok(bytes() > 0, 'Lander pixels drawn');
    h.bankObjects.KILOFF(X);
    assert.equal(bytes(), 0, 'Lander pixels erased by KILOFF');
});

test('PRBKIL kills only the Pod object, never the process its OBJID happens to name', () => {
    const h = createFlightHarness({ infiniteSmartBombs: false, playerCollisions: false, sourceCabinetInput: true });
    h.RESET(); h.INPUT({}); h.STEP();
    const at = n => h.Layout.at(n);
    // A live non-executive process stands in for whatever reused the Pod
    // creator's slot (the old harness guard only recognised GEX0 itself).
    const U = [...activeProcesses(h)].find(q => h.ram.read16(q + at('PADDR')) !== 0xf701 && q !== h.ram.read16(at('CRPROC')));
    assert.ok(activeProcesses(h).has(U));
    const routine = h.ram.read16(U + at('PADDR'));
    const pod = h.probe.PRBST(1, U)[0];
    assert.equal(h.ram.read16(pod + at('OBJID')), U);
    h.ram.write8(at('PRBCNT'), 1);
    assert.equal(h.KILL_BY_VECTOR(pod, 0xe2f4), true);
    // The old KILP freed U and MMSW immediately reused the slot for a Swarmer.
    assert.ok(activeProcesses(h).has(U), 'unrelated process survives the Pod kill');
    assert.equal(h.ram.read16(U + at('PADDR')), routine, 'and still runs its own routine');
    assert.equal(h.ram.read8(at('PRBCNT')), 0);
});

// ---- pilot fixtures (shape as Stage 74) ----
const off = { OPTR: 10, SPTR: 12, OLINK: 2, OPICT: 4, OCVECT: 6, OXV: 8, OYV: 10, OY16: 12, OBJX: 14, OBJID: 16, PADDR: 18, OX16: 24 };
const layout = { at: name => off[name] ?? 0 };
function scenario({ shipY = 120, enemies = [], humans = null, smartBombs = 3, shipVX = 0 } = {}) {
    const shipX = 0x3000, mem = new Map([[off.OPTR, enemies.length ? 1000 : 0], [off.SPTR, 0]]);
    const game = { x: 32, y: shipY, play16: shipY << 8, worldX: shipX, vx: shipVX, vy: 0, direction: 0x300, smartBombs, shipsInReserve: 3,
        smartBombActive: 0, gameOver: false, playerDeathActive: false, hyperspaceActive: false, bonus: null,
        wave: humans === null ? { wave: 3 } : { wave: 3, astronautCount: humans } };
    const ids = enemies.map((e, i) => {
        const id = 1000 + i * 40, y = shipY + (e.dy ?? 0), sx = 32 + e.dx;
        mem.set(id + off.OLINK, i + 1 < enemies.length ? id + 40 : 0);
        mem.set(id + off.OPICT, e.picture ?? 0xe140); mem.set(id + off.OCVECT, 0xe228);
        mem.set(id + off.OXV, (e.vx ?? 0) & 65535); mem.set(id + off.OYV, Math.round((e.vy ?? 0) * 256) & 65535);
        mem.set(id + off.OY16, (y << 8) & 65535); mem.set(id + off.OX16, (shipX + e.dx * 64) & 65535);
        mem.set(id + off.OBJX, sx > 0 && sx < 150 ? (sx << 8) | y : 0);
        return id;
    });
    const ram = { read16: a => mem.get(a & 65535) ?? 0, read8: a => (mem.get(a & 65535) ?? 0) >>> 8 };
    const astronauts = { living: [], count: humans ?? undefined };
    return { game, mem, ids, ram, astronauts };
}
const run = (p, s, terrain) => {
    const cmd = p.sample(s.game, [], s.astronauts, s.ram, layout, terrain);
    if (cmd.down) s.game.y = Math.min(238, s.game.y + 2);
    if (cmd.up) s.game.y = Math.max(43, s.game.y - 2);
    s.game.play16 = s.game.y << 8;
    return cmd;
};
function carry(s) {
    s.astronauts.living = [{ object: 7000, worldX: 0x3080, video: 0 }];
    s.mem.set(7000 + off.OBJID, 8200); s.mem.set(8200 + off.PADDR, 0xe29a); s.mem.set(7000 + off.OCVECT, 0xe234);
}

test('kept human: the keep height follows the real terrain instead of the highest peak', () => {
    const s = scenario({ shipY: 120, humans: 2, enemies: [{ dx: 60, dy: 90 }] }); carry(s);
    const p = create();
    let lowest = 0;
    for (let i = 0; i < 90; i++) { run(p, s, { altitude: () => 222 }); lowest = Math.max(lowest, s.game.y); }
    assert.ok(lowest > 160, `flat ground lets the ship go well below y148 (lowest ${lowest})`);
    assert.ok(lowest <= 222 - 11, `but the human still never touches it (lowest ${lowest})`);
    assert.equal(p.state().keepFloor, 209);
});

test('kept human is set down when Baiters arrive and every wave enemy is below the keep height', () => {
    const s = scenario({ shipY: 120, humans: 2, enemies: [{ dx: 60, dy: 95 }, { dx: 30, dy: -40, picture: 0xe100 }] }); carry(s);
    const p = create();
    run(p, s, { altitude: () => 170 });
    assert.match(p.state().reason, /DELIVER CARRIED HUMAN/);
});

test('never fires through a human standing in the beam before the target', () => {
    const blocked = scenario({ shipY: 120, enemies: [{ dx: 50, dy: -1 }] });
    blocked.astronauts.living = [{ object: 7100, worldX: 0, video: 0 }];
    blocked.mem.set(7100 + off.OBJX, ((32 + 25) << 8) | 118);
    const p = create();
    assert.ok(Array.from({ length: 12 }, () => run(p, blocked)).every(c => !c.fire));
    assert.ok(p.state().humanShotsHeld > 0);
    const clear = scenario({ shipY: 120, enemies: [{ dx: 50, dy: -1 }] });
    clear.astronauts.living = [{ object: 7100, worldX: 0, video: 0 }];
    clear.mem.set(7100 + off.OBJX, ((32 + 25) << 8) | 160);
    const q = create();
    assert.ok(Array.from({ length: 12 }, () => run(q, clear)).some(c => c.fire), 'a human off the beam line does not block');
});

test('hyperspace only when nothing avoids a collision within 3 ticks', () => {
    const doomed = scenario({ shipY: 120, smartBombs: 0, enemies: [{ dx: 11, dy: 0, vx: -200 }] }), p = create();
    assert.equal(run(p, doomed).hyperspace, true);
    assert.equal(p.state().hyperspaces, 1);
    const avoidable = scenario({ shipY: 120, smartBombs: 0, enemies: [{ dx: 40, dy: 0, vx: -40 }] }), q = create();
    assert.ok(Array.from({ length: 10 }, () => run(q, avoidable)).every(c => !c.hyperspace));
});

test('a Baiter about to re-aim is predicted to match the ship\'s speed and is avoided', () => {
    // Moving right at speed with a Baiter 24 columns behind (UFONV0 re-aims
    // beyond 20), on its last animation frame
    // (UFOP3), so UFOLP re-aims it next tick: UFONV0 sets OXV = PLAXV + $40 and it
    // closes. A straight-line model would see it falling behind.
    const s = scenario({ shipY: 120, shipVX: 180, enemies: [{ dx: -24, dy: 0, picture: 0xe114, vx: 0 }] }), p = create();
    run(p, s);
    assert.ok(p.state().shieldTriggers > 0, 'shield reacts to the closing Baiter');
});

test('DEMO MODE ACTIVE banner uses the MESS0 source font in the RORAOK colour, centred', () => {
    const banner = createSourceTextBanner('DEMO MODE ACTIVE');
    assert.equal(banner.colour, BOOT_SOURCE.successColour);
    assert.ok(banner.lit.length > 200);
    const xs = banner.lit.map(p => p[0]), centre = (Math.min(...xs) + Math.max(...xs)) / 2;
    assert.ok(Math.abs(centre - (12 + 303) / 2) <= 4, `centred (${centre})`);
    assert.throws(() => createSourceTextBanner('#'), /glyph/);
});
