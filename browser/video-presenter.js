import { defenderHardwarePalette } from './defender-palette.js';
/**
 * Browser-only presentation of original column-major framebuffer bytes.
 * There are TWO HORIZONTAL 4-bit pixels per byte. The byte's high address
 * selects X/2 and the low address selects Y. This mapping is presentation,
 * not game logic or sprite rasterisation.
 *
 * MAME Defender Red Label visible rectangle is x = 12..303, y = 7..246,
 * i.e. 292 x 240 pixels (the full source memory remains 256x256 bytes).
 * The palette comes from the sixteen colour RAM latches, when RAM is supplied.
 */
export const DEFENDER_VISIBLE = Object.freeze({ left: 12, top: 7, width: 292, height: 240 });
export const DIAGNOSTIC_RGB = Object.freeze([
    [0, 0, 0], [255, 255, 102], [85, 255, 255], [255, 255, 255],
    [136, 255, 187], [255, 119, 170], [255, 225, 163], [204, 214, 255],
    [251, 180, 249], [255, 186, 85], [168, 221, 250], [204, 255, 136],
    [175, 255, 68], [119, 255, 238], [255, 240, 206], [255, 255, 255]
]);
export function getPixel(video, x, y, { left = 12, top = 7 } = DEFENDER_VISIBLE) {
    const hardwareX = x + left, hardwareY = y + top;
    const byte = video.read8((((hardwareX >>> 1) & 255) << 8) | (hardwareY & 255));
    return hardwareX & 1 ? byte & 15 : byte >>> 4;
}
export function framePixels(video, { left = 12, top = 7, width = 292, height = 240 } = DEFENDER_VISIBLE, palette = DIAGNOSTIC_RGB) {
    const result = new Uint8ClampedArray(width * height * 4);
    let i = 0;
    for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
            const [r, g, b] = palette[getPixel(video, x, y, { left, top })];
            result[i++] = r;
            result[i++] = g;
            result[i++] = b;
            result[i++] = 255;
        }
    return result;
}
export function presentFrame(ctx, video, RAM) {
    const { width, height } = DEFENDER_VISIBLE;
    // IMPORTANT: framePixels(video, viewport, palette) receives the palette
    // as its THIRD positional argument. Stage 29-33 accidentally embedded it in
    // the viewport object, so the canvas always fell back to DIAGNOSTIC_RGB;
    // moving PCRAM/colour RAM was invisible even though source tests passed.
    const pixels = framePixels(video, DEFENDER_VISIBLE, RAM ? defenderHardwarePalette(RAM) : DIAGNOSTIC_RGB);
    const image = ctx.createImageData(width, height);
    image.data.set(pixels);
    ctx.putImageData(image, 0, 0);
}
