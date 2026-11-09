/** Stage 74: wave tactics for the attract pilot — Pods, keeping a scarce
 * human aboard, gathering Mutants for a smart bomb after the planet is lost,
 * finishing the wave when Baiters appear, and racing abductions.
 * Fixtures present source-shaped RAM to the shipping pilot; only PIA-style
 * commands come back. Full-game effects are measured in STAGE74_AI_NOTES.md.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script, createContext } from 'node:vm';

const source = readFileSync(new URL('../browser/flight.js', import.meta.url), 'utf8');
const first = source.indexOf('function createAttractPilot()');
const end = source.indexOf('const attractPilot=createAttractPilot();', first);
const create = new Script(source.slice(first, end) + ';createAttractPilot;').runInContext(createContext({}));
const off = { OPTR: 10, SPTR: 12, OLINK: 2, OPICT: 4, OCVECT: 6, OXV: 8, OYV: 10, OY16: 12, OBJX: 14, OBJID: 16, PADDR: 18, OX16: 24 };
const layout = { at: name => off[name] ?? 0 };
const PIC = { lander: 0xe140, mutant: 0xe280, pod: 0xe2ba, baiter: 0xe100 };

/** enemies: {dx (columns from ship), dy (px from ship), picture, vx, vy, carrier} */
function scenario({ shipY = 120, enemies = [], humans = null, smartBombs = 3, shipDir = 0x300 } = {}) {
    const shipX = 0x3000, mem = new Map([[off.OPTR, enemies.length ? 1000 : 0], [off.SPTR, 0]]);
    const game = { x: 32, y: shipY, play16: shipY << 8, worldX: shipX, vx: 0, vy: 0, direction: shipDir, smartBombs, shipsInReserve: 3,
        smartBombActive: 0, gameOver: false, playerDeathActive: false, hyperspaceActive: false, bonus: null,
        wave: humans === null ? { wave: 3 } : { wave: 3, astronautCount: humans } };
    const ids = enemies.map((e, i) => {
        const id = 1000 + i * 40, x = (shipX + e.dx * 64) & 65535, y = shipY + (e.dy ?? 0), sx = 32 + e.dx;
        mem.set(id + off.OLINK, i + 1 < enemies.length ? id + 40 : 0);
        mem.set(id + off.OPICT, e.picture);
        mem.set(id + off.OCVECT, e.carrier ? 0xe22a : 0xe228);
        mem.set(id + off.OXV, (e.vx ?? 0) & 65535);
        mem.set(id + off.OYV, Math.round((e.vy ?? 0) * 256) & 65535);
        mem.set(id + off.OY16, (y << 8) & 65535);
        mem.set(id + off.OX16, x);
        mem.set(id + off.OBJX, sx > 0 && sx < 150 ? (sx << 8) | y : 0);
        return id;
    });
    const ram = { read16: a => mem.get(a & 65535) ?? 0, read8: a => (mem.get(a & 65535) ?? 0) >>> 8 };
    const astronauts = { living: [], count: humans ?? undefined };
    const step = p => {
        const cmd = p.sample(game, [], astronauts, ram, layout);
        if (cmd.down) game.y = Math.min(238, game.y + 2);
        if (cmd.up) game.y = Math.max(43, game.y - 2);
        game.play16 = game.y << 8;
        if (cmd.reverse) game.direction = game.direction & 0x8000 ? 0x300 : 0xfd00;
        return cmd;
    };
    return { game, mem, ids, astronauts, step };
}
function carry(s) {
    const astronaut = 7000, proc = 8200;
    s.astronauts.living = [{ object: astronaut, worldX: 0x3080, video: 0 }];
    s.mem.set(astronaut + off.OBJID, proc); s.mem.set(proc + off.PADDR, 0xe29a);
    s.mem.set(astronaut + off.OCVECT, 0xe234);
}

test('a Pod 30 columns ahead is shot without the old retreat', () => {
    const s = scenario({ enemies: [{ dx: 30, dy: -1, picture: PIC.pod }] }), p = create();
    const cmds = Array.from({ length: 30 }, () => s.step(p));
    assert.ok(cmds.some(c => c.fire), 'fires at the Pod');
    assert.equal(cmds.filter(c => c.reverse).length, 0, 'does not turn away from it');
    assert.notEqual(p.state().combatPhase, 'EXTEND');
});

test('a Pod right beside the ship is still not burst at point-blank range', () => {
    const s = scenario({ enemies: [{ dx: 10, dy: -1, picture: PIC.pod }] }), p = create();
    const cmds = Array.from({ length: 20 }, () => s.step(p));
    assert.ok(cmds.every(c => !c.fire));
    assert.ok(p.state().podShotsDeclined > 0);
});

test('with humans scarce, a carried human is kept aboard above the highest terrain', () => {
    // A Lander low on the screen would normally pull the ship down to its height.
    const s = scenario({ shipY: 120, humans: 2, enemies: [{ dx: 60, dy: 90, picture: PIC.lander }] });
    carry(s);
    const p = create();
    let lowest = 0;
    for (let i = 0; i < 80; i++) {
        s.step(p);
        lowest = Math.max(lowest, s.game.y);
        assert.match(p.state().reason, /KEEP HUMAN/);
    }
    assert.ok(lowest <= 149, `ship stayed high enough for the human never to touch terrain (lowest y ${lowest})`);
    assert.ok(p.state().keepTicks >= 80);
});

test('with plenty of humans, a carried human is still delivered as before', () => {
    const s = scenario({ shipY: 120, humans: 8, enemies: [{ dx: 60, dy: -40, picture: PIC.lander }] });
    carry(s);
    const p = create();
    s.step(p);
    assert.match(p.state().reason, /DELIVER CARRIED HUMAN/);
});

test('planet gone: smart bomb once five Mutants are on screen, keeping two bombs in reserve', () => {
    const swarm = [[-28, -60], [-20, 50], [45, -50], [70, 60], [95, -20]].map(([dx, dy]) => ({ dx, dy, picture: PIC.mutant }));
    const s = scenario({ humans: 0, smartBombs: 3, enemies: swarm }), p = create();
    const cmds = Array.from({ length: 4 }, () => s.step(p));
    assert.ok(cmds.some(c => c.smartBomb), 'bombs the gathered swarm');
    assert.equal(p.state().gatherBombs, 1);
    const reserve = scenario({ humans: 0, smartBombs: 2, enemies: swarm }), q = create();
    assert.ok(Array.from({ length: 4 }, () => reserve.step(q)).every(c => !c.smartBomb), 'two bombs kept for emergencies');
});

test('planet gone: no gather bomb while most Mutants are still off screen', () => {
    const enemies = [[-28, -60], [45, -50], [70, 40]].map(([dx, dy]) => ({ dx, dy, picture: PIC.mutant }))
        .concat([[300, 0], [400, 20], [-300, 10], [-420, -20], [500, 30]].map(([dx, dy]) => ({ dx, dy, picture: PIC.mutant })));
    const s = scenario({ humans: 0, enemies }), p = create();
    assert.ok(Array.from({ length: 4 }, () => s.step(p)).every(c => !c.smartBomb));
});

test('when Baiters appear, the remaining wave enemies are hunted first', () => {
    const s = scenario({ humans: 6, enemies: [{ dx: 40, dy: -20, picture: PIC.baiter }, { dx: 90, dy: 30, picture: PIC.lander }] }), p = create();
    for (let i = 0; i < 5; i++) s.step(p);
    assert.equal(p.state().targetId, s.ids[1], 'goes for the Lander that keeps the wave alive');
});

test('Baiters are engaged once they are close or multiplying', () => {
    const close = scenario({ humans: 6, enemies: [{ dx: 15, dy: -10, picture: PIC.baiter }, { dx: 90, dy: 30, picture: PIC.lander }] }), p = create();
    for (let i = 0; i < 5; i++) close.step(p);
    assert.equal(p.state().targetId, close.ids[0]);
    const many = scenario({ humans: 6, enemies: [40, 50, 60].map(dx => ({ dx, dy: -20, picture: PIC.baiter })).concat([{ dx: 90, dy: 30, picture: PIC.lander }]) });
    const q = create();
    for (let i = 0; i < 5; i++) many.step(q);
    assert.notEqual(q.state().targetId, many.ids[3]);
});

test('an abduction in progress outranks a Mutant that is not yet dangerous', () => {
    const s = scenario({ humans: 6, enemies: [{ dx: 100, dy: -30, picture: PIC.lander, carrier: true, vy: -0.5 }, { dx: 30, dy: -70, picture: PIC.mutant, vx: -60 }] });
    const p = create();
    for (let i = 0; i < 3; i++) s.step(p);
    assert.match(p.state().reason, /INTERCEPT ABDUCTOR/);
    assert.equal(p.state().duelPhase, '');
});
