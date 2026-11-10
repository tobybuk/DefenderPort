/**
 * Defender Red Label power-on video, native JavaScript translations of the
 * visible effects of ROMF8.SRC RESET/RESET1/RAM2/RAM3/RAM7/IDIS1/GAMEOV,
 * and ROMC0.SRC RORAOK. Original source pinned at e74006344b16d19245510b5e55780f90d7606bb8.
 *
 * No synthetic noise, CSS text, browser canvas glyphs, or invented success
 * screens: the RAM-test picture is composed of *actual RAM3 writes* in the
 * native Williams column-major framebuffer, and both later screens use the
 * existing MESS0 glyph bitmaps via original ROMF8.CWRIT.
 *
 * LIMITS: source ROM checksum testing, real RAM banking, watchdog / PIA LEDs,
 * and precise instruction-cycle timing are NOT fully translated. Each STEP
 * performs a bounded number of source-algorithm word operations to allow a
 * browser to show the otherwise invisible intermediate video writes.
 */
import { RAM } from '../runtime/ram.js';
import { VideoMemory } from '../runtime/video-memory.js';
import { createRomf8GraphicsRoutines } from '../original/romf8-graphics.js';
import { installBonusSourceFont } from '../original/defender-bonus-font.js';

export const BOOT_SOURCE = Object.freeze({
    romReset: 'ROMF8.SRC:RESET,RESET1,RAM2,RAM3,RAM7,IDIS1,GAMEOV',
    diagnostic: 'ROMC0.SRC:RORAOK',
    resetPaletteSeed: 0xc0,
    resetPaletteMultiplier: 0xb5,
    passes: 7,
    memoryLimit: 0xc000,
    displayHoldMilliseconds: 3000,
    title: 'INITIAL TESTS INDICATE',
    result: 'UNIT OK',
    titleAddress: 0x2870,
    resultAddress: 0x4090,
    successColour: 0x7a,
    gameOverAddress: 0x3880,
    gameOverColour: 0xa5
});

// Bound source instruction work, rather than drawing arbitrary random dots.
// The 6809 cycle cost is not yet complete; this is a browser pacing estimate.
export const RAM_TEST_WORDS_PER_STEP = 440;
export const BOOT_STAGES = Object.freeze([
    { name: 'RAM2 / RAM3: RAM WRITE', visual: 'rug' },
    { name: 'RAM7: RAM VERIFY', visual: 'rug' },
    { name: 'RORAOK: INITIAL TESTS INDICATE / UNIT OK', visual: 'result' },
    { name: 'GAMEOV: GAME OVER', visual: 'gameover' }
]);

/** ROMF8.RESET1: write 16 palette latches, A = high byte of A*$B5. */
export function resetPaletteBytes() {
    const bytes = [];
    let a = BOOT_SOURCE.resetPaletteSeed;
    for (let i = 0; i < 16; i++) {
        bytes.push(a);
        a = (a * BOOT_SOURCE.resetPaletteMultiplier) >>> 8;
    }
    return bytes;
}

/**
 * ROMF8.RAM3/RAM4/RAM5. D and the 6809 carry flag are local values.
 * COMB sets carry; BITB preserves it; RORA/LSRA transfer carry into RORB.
 * This is native *routine translation*, not a 6809 processor emulator.
 */
export function ram3NextWord(word) {
    let a = (word >>> 8) & 255;
    let b = word & 255;
    // RAM3: COMB / BITB #9 / BNE RAM4
    b ^= 0xff;
    if ((b & 9) !== 0) {
        // RAM4: COMB / BITB #9 / BNE RAM5
        b ^= 0xff;
        if ((b & 9) !== 0) {
            // RAM5: LSRA / RORB
            const carry = a & 1;
            a >>>= 1;
            b = (b >>> 1) | (carry << 7);
        } else {
            // RORA / RORB (the preceding COMB sets carry=1)
            const carry = a & 1;
            a = (a >>> 1) | 0x80;
            b = (b >>> 1) | (carry << 7);
        }
    } else {
        // RAM3's direct branch: COMB / RORA / RORB
        b ^= 0xff;
        const carry = a & 1;
        a = (a >>> 1) | 0x80;
        b = (b >>> 1) | (carry << 7);
    }
    return ((a << 8) | b) & 0xffff;
}

/** At power-on RAM2 writes the generated 16-bit D, RAM7 compares it. */
export function createCabinetBoot() {
    const ram = new RAM();
    const video = new VideoMemory();
    const rom = createRomf8GraphicsRoutines(video, ram);
    const { descriptors } = installBonusSourceFont(ram);
    let phase, pass, address, seed, startSeed, hold, finished, ramAccessible;
    let firstEight;

    function putPalette(index, value) {
        ram.write8(0xc000 + index, value);
    }
    function paletteReset() {
        resetPaletteBytes().forEach((value, index) => putPalette(index, value));
    }
    function writeSourceText(text, videoAddress) {
        let x = videoAddress >>> 8;
        const y = videoAddress & 255;
        for (const character of text) {
            if (character === ' ') {
                x += 2;
                continue;
            }
            const descriptor = descriptors[character];
            if (descriptor === undefined) throw Error('Missing original MESS0 glyph ' + character);
            rom.CWRIT(((x << 8) | y) & 0xffff, descriptor);
            x += ram.read8(descriptor) + 1;
        }
    }
    function RORAOK() {
        // ROMC0.RORAOK: NEWTST -> SETCOL $7A -> VWTEXT twice.
        video.clear();
        for (let c = 0; c < 16; c++) putPalette(c, 0);
        putPalette(1, BOOT_SOURCE.successColour);
        writeSourceText(BOOT_SOURCE.title, BOOT_SOURCE.titleAddress);
        writeSourceText(BOOT_SOURCE.result, BOOT_SOURCE.resultAddress);
        phase = 'result';
        hold = 0;
    }
    function GAMEOV() {
        // ROMF8.GAMEOV: SCRCLR -> VPWRUP -> LETCOL $A5 -> TV1 "GAME OVER".
        // VPWRUP CMOS branch, IGAMEO instructions and actual cabinet switch
        // scan are not yet translated, so this page is a brief boundary.
        video.clear();
        for (let c = 0; c < 16; c++) putPalette(c, 0);
        putPalette(1, BOOT_SOURCE.gameOverColour);
        writeSourceText('GAME OVER', BOOT_SOURCE.gameOverAddress);
        phase = 'gameover';
        hold = 0;
    }
    function RESET() {
        // ROMF8.RESET: CPU/PIA setup then RESET1 initial colour latches.
        video.clear();
        paletteReset();
        phase = 'write';
        pass = 0;
        address = 0;
        seed = 0;
        startSeed = 0;
        hold = 0;
        finished = false;
        ramAccessible = true;
        firstEight = [];
        return STATE();
    }
    function STATE() {
        return Object.freeze({
            phase, pass, address, hold, finished, ramAccessible,
            stage: phase === 'write' ? 0 : phase === 'verify' ? 1 : phase === 'result' ? 2 : 3,
            visual: phase === 'write' || phase === 'verify' ? 'rug' : phase,
            message: phase === 'write' || phase === 'verify' ? `RAM TEST ${pass + 1} / 7` :
                phase === 'result' ? 'INITIAL TESTS INDICATE / UNIT OK' : 'GAME OVER',
            firstEight: firstEight.slice(),
            palette: Array.from({length: 16}, (_, n) => ram.read8(0xc000 + n))
        });
    }
    function STEP() {
        if (finished) return STATE();
        if (phase === 'result') {
            if (++hold >= Math.round(BOOT_SOURCE.displayHoldMilliseconds / (1000 / (1000000 / 16640)))) {
                GAMEOV();
            }
            return STATE();
        }
        if (phase === 'gameover') {
            // ROMF8.GAMEOV waits on cabinet switches indefinitely; a native
            // browser's existing AMODE1 attract loop is our next handoff.
            if (++hold >= 60) finished = true;
            return STATE();
        }
        for (let n = 0; n < RAM_TEST_WORDS_PER_STEP && address < BOOT_SOURCE.memoryLimit; n++) {
            seed = ram3NextWord(seed);
            if (phase === 'write') {
                // ROMF8.RAM6 STD ,X++ is a physical RAM write. The visible CRT
                // scans $0000–$97FF; the rest is not screen pixel memory.
                if (address < 0x9c00) {
                    video.write8(address, seed >>> 8);
                    video.write8(address + 1, seed & 255);
                }
                if (firstEight.length < 8) firstEight.push(seed);
                // Full 48K RAM is logically tested; the JS video is distinct.
                ram.write16(address, seed);
            } else if (ram.read16(address) !== seed) {
                ramAccessible = false;
            }
            address += 2;
        }
        if (address >= BOOT_SOURCE.memoryLimit) {
            if (phase === 'write') {
                phase = 'verify';
                address = 0;
                seed = startSeed;
            } else {
                pass++;
                if (pass >= BOOT_SOURCE.passes) {
                    RORAOK();
                } else {
                    phase = 'write';
                    address = 0;
                    startSeed = seed;
                }
            }
        }
        return STATE();
    }
    RESET();
    return Object.freeze({ video, ram, RESET, STEP, STATE, RORAOK, GAMEOV });
}

/** Native original framebuffer display; keep source-written pixels unchanged. */
export function drawCabinetBoot(ctx, boot) {
    // Accept the boot object; the application uses presentFrame() below.
    const { presentFrame } = boot;
    if (typeof presentFrame === 'function') presentFrame(ctx, boot.video, boot.ram);
}

/**
 * Service tests are unchanged from Stage 55: they are *not* a full diagnostic
 * ROM translation and remain in the menu, clearly marked as references.
 */
export const SERVICE_TESTS = Object.freeze([
    ['ROM DIAGNOSTICS - TEST 1', 'ORIGINAL SERVICE ROM NOT EXECUTED'],
    ['RAM DIAGNOSTICS - TEST 2', 'ORIGINAL SERVICE RAM CHECK NOT EXECUTED'],
    ['CMOS RAM DIAGNOSTICS - TEST 3', 'ORIGINAL SERVICE CMOS CHECK NOT EXECUTED'],
    ['COLOUR RAM TEST - TEST 4', 'RED / GREEN / BLUE INTENSITY'],
    ['SWITCH TEST - TEST 6', 'UP DOWN REVERSE START HYPER BOMB THRUST FIRE'],
    ['MONITOR SET-UP - TEST 7', 'CROSSHATCH / COLOUR BARS']
]);
export function drawCabinetService(ctx, index, width = 292, height = 240) {
    const [title, body] = SERVICE_TESTS[index % SERVICE_TESTS.length];
    ctx.fillStyle = '#000';ctx.fillRect(0, 0, width, height);
    ctx.textAlign = 'center';ctx.font = 'bold 9px monospace';
    ctx.fillStyle = '#81dcff';ctx.fillText(title, width / 2, 28);
    ctx.fillStyle = '#f1d090';
    if (index === 3) {
        const colors = ['#ff9595','#f22','#850000','#94ff94','#17dd17','#006b00','#aabaff','#335dff','#000b92'];
        colors.forEach((color,i)=>{ctx.fillStyle=color;ctx.fillRect(25,52+i*15,242,13);});
    } else if (index === 5) {
        ctx.strokeStyle = '#7de2ff';ctx.lineWidth = 1;ctx.beginPath();
        for(let x=20;x<width-20;x+=20){ctx.moveTo(x,45);ctx.lineTo(x,height-40);}
        for(let y=45;y<height-40;y+=20){ctx.moveTo(20,y);ctx.lineTo(width-20,y);}
        ctx.stroke();
    } else {
        const words=body.split(' ');let line='',y=90;
        for(const word of words){
            if((line+' '+word).length>31){ctx.fillText(line.trim(),width/2,y);line='';y+=16;}
            line+=' '+word;
        }
        ctx.fillText(line.trim(),width/2,y);
    }
    ctx.fillStyle='#6d8792';ctx.font='7px monospace';
    ctx.fillText('REFERENCE DISPLAY - NO CABINET ROM CHECK',width/2,224);
}
/**
 * Stage 75 "DEMO MODE ACTIVE" banner, drawn exactly like the RORAOK
 * "INITIAL TESTS INDICATE" text: original MESS0 glyphs written with
 * ROMF8.CWRIT into a column-major framebuffer, shown in the RORAOK success
 * colour ($7A). The banner lives in its own buffer and is composited over the
 * game picture by the browser, so it never touches the game's video memory.
 * Returns the hardware (x,y) of every lit pixel plus the colour byte.
 */
export function createSourceTextBanner(text = 'DEMO MODE ACTIVE', y = 0x80, { left = 6, span = 146 } = {}) {
    const ram = new RAM(), video = new VideoMemory();
    const rom = createRomf8GraphicsRoutines(video, ram);
    const { descriptors } = installBonusSourceFont(ram);
    const advance = character => character === ' ' ? 2 : ram.read8(descriptors[character]) + 1;
    for (const character of text)
        if (character !== ' ' && descriptors[character] === undefined)
            throw Error('Missing original MESS0 glyph ' + character);
    const widthBytes = [...text].reduce((sum, c) => sum + advance(c), 0) - 1;
    // Centre within byte columns left..left+span-1 (default: the visible
    // columns 6..151, hardware x 12..303).
    let x = left + Math.max(0, Math.floor((span - widthBytes) / 2));
    for (const character of text) {
        if (character !== ' ')
            rom.CWRIT(((x << 8) | y) & 0xffff, descriptors[character]);
        x += advance(character);
    }
    const lit = [];
    for (let address = 0; address < 0x10000; address++) {
        const byte = video.read8(address);
        if (!byte) continue;
        const hx = (address >>> 8) * 2, hy = address & 255;
        if (byte >>> 4) lit.push([hx, hy]);
        if (byte & 15) lit.push([hx + 1, hy]);
    }
    return Object.freeze({ text, colour: BOOT_SOURCE.successColour, lit: Object.freeze(lit) });
}
