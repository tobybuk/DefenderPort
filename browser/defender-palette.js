/**
 * Williams Defender programmable colour RAM: 16 independent 8-bit DAC values
 * select any 16 of 256 RGB colours. See DEFB6.SRC CRTAB and DEFA7 IRQ.
 * Bits 0..2 are red, bits 3..5 green, bits 6..7 blue (BBGGGRRR).
 * The DAC weights use original Williams resistor ratios, from the MAME
 * williams_state::palette_init: RGB 1200/560/330 ohms; blue 560/330 ohms.
 * This corrects the Stage 33 assumption of an ideal linear 3:3:2 DAC.
 * MAME ignores transistor and pullup/pulldown effects; so do we. CRT phosphor
 * response remains unmodelled. CRAM $C000 is the hardware LATCH.
 */
export const DAC_ADDRESS = 0xc000;
// Each bit drives a separate physical resistor; add conductances, then
// normalise the all-bits-on value to 255. No gamma or arbitrary tint is added.
const resistorWeights = resistors => {
    const conductances = resistors.map(ohms => 1 / ohms);
    const total = conductances.reduce((sum, g) => sum + g, 0);
    return conductances.map(g => g * 255 / total);
};
const RG_WEIGHTS = resistorWeights([1200, 560, 330]);
const B_WEIGHTS = resistorWeights([560, 330]);
function weightedChannel(bits, weights) {
    let value = 0;
    for (let i = 0; i < weights.length; i++)
        if (bits & (1 << i))
            value += weights[i];
    return Math.round(value);
}
export function defenderDacRGB(byte) {
    const value = byte & 255;
    return [weightedChannel(value & 7, RG_WEIGHTS),
        weightedChannel((value >>> 3) & 7, RG_WEIGHTS),
        weightedChannel((value >>> 6) & 3, B_WEIGHTS)];
}
export function defenderHardwarePalette(RAM) {
    return Array.from({ length: 16 }, (_, n) => defenderDacRGB(RAM.read8(DAC_ADDRESS + n)));
}
