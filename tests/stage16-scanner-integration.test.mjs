import test from 'node:test';
import assert from 'node:assert/strict';
import { createFlightHarness } from '../demo/flight-harness.js';
const marker = (lab, ptr) => [lab.video.read8(ptr), lab.video.read8((ptr + 1) & 65535)];
function scannerPointers(lab) {
    const { ram, Layout } = lab, SETAB = Layout.at('SETAB'), SETEND = ram.read16(Layout.at('SETEND'));
    assert.equal((SETEND - SETAB) % 2, 0, 'original SETAB contains 16-bit video pointers');
    return Array.from({ length: (SETEND - SETAB) / 2 }, (_, i) => ram.read16(SETAB + i * 2));
}
test('scanner is populated from actual Stage 15 OPTR objects at initial presentation', () => {
    const lab = createFlightHarness(), { ram, Layout } = lab;
    assert.equal(lab.STATE().scannerObjects, 15);
    const points = scannerPointers(lab);
    assert.equal(points.length, 15);
    assert.equal(new Set(points).size, 15);
    for (const address of points)
        assert.ok(marker(lab, address).some(Boolean), `blip at $${address.toString(16)}`);
    // No Canvas-scanner implementation: pointer data and pixel values are video RAM.
    const objectColours = [];
    let X = ram.read16(Layout.at('OPTR'));
    while (X) {
        objectColours.push(ram.read16(X + Layout.at('OBJCOL')));
        X = ram.read16(X);
    }
    assert.equal(objectColours.length, 15);
});
test('SCNR refresh follows source VELO motion and erases previous blip', () => {
    const lab = createFlightHarness();
    const first = scannerPointers(lab);
    const originalValues = new Map(first.map(ptr => [ptr, marker(lab, ptr)]));
    // Confirm all enemy pointers change with motion, and no two source blips alias.
    for (let i = 0; i < 16; i++)
        lab.STEP();
    const second = scannerPointers(lab);
    assert.equal(second.length, lab.ENEMY_STATE().length, 'source GEXEC may create further UFOs during movement');
    assert.ok(second.some((ptr, i) => ptr !== first[i]), 'scanner pointers must follow enemy world coordinates');
    for (const address of second)
        assert.ok(marker(lab, address).some(Boolean));
    for (const previous of first.filter(ptr => !second.includes(ptr))) {
        assert.notDeepEqual(marker(lab, previous), originalValues.get(previous), `stale marker at $${previous.toString(16)} must not retain the old enemy colour; underlying scanner terrain may be redrawn`);
    }
});
test('scanner reset restores markers immediately and does not require button press', () => {
    const lab = createFlightHarness(), original = scannerPointers(lab);
    for (let i = 0; i < 30; i++)
        lab.STEP();
    lab.RESET();
    assert.deepEqual(scannerPointers(lab), original);
    assert.equal(lab.STATE().scannerObjects, 15);
    for (const ptr of original)
        assert.ok(marker(lab, ptr).some(Boolean));
});
test('scanner handles IPTR as well as OPTR using source SCNR3', () => {
    const lab = createFlightHarness(), { ram, Layout } = lab;
    const X = ram.read16(Layout.at('OPTR'));
    ram.write16(Layout.at('OPTR'), ram.read16(X));
    ram.write16(X, 0);
    ram.write16(Layout.at('IPTR'), X);
    const state = lab.TEST_SCANNER();
    assert.equal(state.objects, 15, 'source SCNR must scan both lists');
    assert.equal(lab.STATE().scannerObjects, 15);
});
