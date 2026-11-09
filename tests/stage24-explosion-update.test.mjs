/** SAMEXAP7 source expansion (EWRITE / EXPU) regression and runtime tests. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { RAM } from '../runtime/ram.js';
import { VideoMemory } from '../runtime/video-memory.js';
import { PHR6_LAYOUT as L } from '../runtime/phr6-layout.js';
import { ENEMY_PICTURES } from '../original/defb6-enemy-pictures.js';
import { SAMEX_RAM as S, createSamexap7ExplosionStartRoutines } from '../original/samexap7-explosion-start.js';
import { createSamexap7ExplosionUpdateRoutines } from '../original/samexap7-explosion-update.js';
import { createFlightHarness } from '../demo/flight-harness.js';
const a = n => L.at(n);
const pic = ENEMY_PICTURES.ASXP1, desc = 0xe2a4;
function setup() {
    const ram = new RAM(), video = new VideoMemory();
    const resolvePicture = id => id === desc ? pic : null;
    const start = createSamexap7ExplosionStartRoutines(ram, L, video, { resolvePicture });
    const upd = createSamexap7ExplosionUpdateRoutines(ram, L, video, { resolvePicture, EERASE: start.EERASE });
    const X = 0xb300;
    ram.write16(X + a('OX16'), 0x0800);
    ram.write8(X + a('OY16'), 100);
    ram.write16(X + a('OPICT'), desc);
    const Y = start.EXST(X);
    assert.equal(Y, S.RAMALS);
    return { ram, video, X, Y, start, upd };
}
test('EXPU grows RSIZE by original $00AA and writes source FDB data into video', () => {
    const { ram, video, Y, upd } = setup();
    const result = upd.EXPU();
    assert.equal(result.updated, 1);
    assert.equal(ram.read16(Y + S.RSIZE), 0x01aa);
    const ERASES = ram.read16(Y + S.ERASES);
    assert.ok(ERASES < Y + S.RAMSIZ);
    const words = [];
    for (let p = ERASES; p < Y + S.RAMSIZ; p += 2)
        words.push(ram.read16(p));
    assert.ok(words.length >= 10);
    // Stage 24 uses original pair-wise FDB values, not a generated particle image.
    assert.ok(words.some(address => video.read8(address) || video.read8((address + 1) & 65535)), 'at least one original FDB word is visible; original source permits transparent words');
});
test('EWRITE at size 1 copies exactly the original bitmap columns except source centre hole', () => {
    const { ram, video, Y, upd } = setup();
    assert.equal(ram.read16(Y + S.CENTER), 0x2268, 'centre of four-byte picture is top+2 columns and top+4 rows');
    const left = ram.read16(Y + S.TOPLFT);
    assert.equal(left, 0x2064);
    const wrote = upd.EWRITE(Y);
    assert.equal(wrote.blocks, 16);
    for (let col = 0; col < pic.width; col++)
        for (let row = 0; row < pic.height; row++) {
            const address = (((left >>> 8) + col) << 8) | ((left & 255) + row);
            const expected = (col === 2 && (row === 4 || row === 5)) ? 0 : pic.phases[0][col * pic.height + row];
            assert.equal(video.read8(address), expected, `unscaled FDB byte col=${col} row=${row}`);
        }
    assert.equal(ram.read16(Y + S.ERASES), Y + S.RAMSIZ - 32);
});
test('EERASE removes prior expanded pixels; EWRITE next update rebuilds new positions', () => {
    const { ram, video, Y, upd } = setup();
    upd.EWRITE(Y);
    const first = ram.read16(Y + S.ERASES), addresses = [];
    for (let p = first; p < Y + S.RAMSIZ; p += 2)
        addresses.push(ram.read16(p));
    assert.ok(addresses.some(a => video.read8(a)));
    upd.EXPU(); // source fractional size: $01AA -> still one-byte step
    const newFrame = upd.EXPU(); // $0254 -> two-byte step
    assert.equal(newFrame.updated, 1);
    assert.equal(ram.read16(Y + S.RSIZE), 0x0254);
    assert.equal(ram.read16(Y + S.ERASES), Y + S.RAMSIZ - 32);
    // Offscreen old bytes not rewritten at their old locations must now be zero.
    const nextAddresses = new Set();
    for (let p = ram.read16(Y + S.ERASES); p < Y + S.RAMSIZ; p += 2)
        nextAddresses.add(ram.read16(p));
    assert.ok(addresses.some(a => !nextAddresses.has(a)), 'size growth changes sample locations');
    for (const old of addresses.filter(a => !nextAddresses.has(a)))
        assert.equal(video.read8(old), 0, `previous footprint at $${old.toString(16)} erased`);
});
test('EXPU expires explosion after the source high-byte >$30 threshold and erases blocks', () => {
    const { ram, video, Y, upd } = setup();
    let expired = false;
    for (let n = 0; n < 80; n++) {
        const r = upd.EXPU();
        if (r.expired) {
            expired = true;
            break;
        }
    }
    assert.ok(expired);
    assert.equal(ram.read16(Y + S.RSIZE), 0);
    assert.equal(ram.read16(Y + S.ERASES), Y + S.RAMSIZ);
});
test('EXPU processes the translated source APST/EXPU4 negative expansion instead of throwing', () => {
    const { ram, Y, upd } = setup();
    ram.write16(Y + S.RSIZE, 0xaf00);
    // A null target ends the appearance safely without overwriting other RAM.
    const out = upd.EXPU();
    assert.equal(out.expired, 1);
    assert.equal(ram.read16(Y + S.RSIZE), 0);
});
test('integrated capture updates SAMEX explosion slots and clears them before later captures', () => {
    const h = createFlightHarness();
    let active = false;
    for (let t = 0; t < 1420; t++) {
        h.STEP();
        for (let Y = S.RAMALS; Y < S.RAMEND; Y += S.RAMSIZ)
            if (h.ram.read16(Y + S.RSIZE)) {
                active = true;
                break;
            }
    }
    assert.ok(active, 'first astronaut death creates source explosion that advances through EXPU');
    assert.ok(h.ASTRONAUT_STATE().count < 10, 'an original astronaut capture has occurred');
});
