/**
 * AMODE1.SRC attract-mode transliteration, pinned Red Label e740063.
 * Source entry points reproduced here: AMODES, LOGO/LOGO0, HALDIS,
 * LEDRET, AMODE1–8, AMOD12, AMOD10–11, BMODE2–3, AMOD13, LASRS.
 *
 * This is the original attract DEMONSTRATION's scripted object movements,
 * fixed-point source constants, original pixel assets and NAPP timings. It
 * has a separate original-style video bank and source RAM; it never runs the
 * playable GEXEC during the attract loop. The source high-score CMOS and
 * DEFNNN large 60x24 logo are still untranslated boundaries; HALDIS only
 * renders source MESS0 title text, not fabricated high-score entries.
 *
 * Background terrain and font are the existing original BLK71 and MESS0
 * routines, NOT CSS/Canvas recreations. Audio remains intentionally silent.
 */
import { RAM } from '../runtime/ram.js';
import { createAttractProcessDispatcher } from '../runtime/source-attract-processes.js';
import { createSourceCpuBudget } from '../runtime/source-cpu-budget.js';
import { VideoMemory } from '../runtime/video-memory.js';
import { PHR6_LAYOUT } from '../runtime/phr6-layout.js';
import { createDefa7ObjectVideoRoutines } from './defa7-object-video.js';
import { createDefa7PlayerVideoRoutines } from './defa7-player-video.js';
import { createRomf8GraphicsRoutines } from './romf8-graphics.js';
import { installBonusSourceFont } from './defender-bonus-font.js';
import { installHudSourceData, CRTAB, HUD_SOURCE_RELOC } from './defender-hud-data.js';
import { ENEMY_PICTURES } from './defb6-enemy-pictures.js';
import { TIEP1, C5P1 } from './defb6-gameplay-pictures.js';
import { PLAPIC, PLBPIC } from './defb6-player-data.js';
import { createBlk71TerrainRoutines } from './blk71-terrain.js';
import { createAmode1ScannerRoutines } from './amode1-scanner.js';
import { createDefa7TopDisplayRoutines } from './defa7-top-display.js';
import { createDefa7ScoreDisplayRoutines } from './defa7-score-display.js';
import { MTERR } from './blk71-data.js';
import { createDefa7RandomRoutines } from './defa7-random.js';
import { createDefa7StarRoutines } from './defa7-stars.js';
import { createDefa7FireTableRoutines } from './defa7-fire-tables.js';
import { LGOTAB, AMODE_ENEMIES, DEFNNN } from './amode1-attract-data.js';
import { COLTAB } from './defa7-process-tasks.js';
import { TCTAB } from './defb6-colour-processes.js';
import { createSamexap7AppearanceRoutines } from './samexap7-appearance.js';
import { createSamexap7ExplosionStartRoutines, SAMEX_RAM } from './samexap7-explosion-start.js';
import { createSamexap7ExplosionUpdateRoutines } from './samexap7-explosion-update.js';
import { DEFAULT_HALL_OF_FAME, CPRTAB } from './amode1-presentation-data.js';
export function createAmode1Attract({ initialCredits = 2 } = {}) {
    // CREDIT is cabinet state, not a ROM-defined constant. Two inserted credits
    // recreate the user-supplied cabinet screenshot; pass 0 for an empty cabinet.
    if (!Number.isInteger(initialCredits) || initialCredits < 0 || initialCredits > 99)
        throw new RangeError('credits must be 0..99');
    let cabinetCredits = initialCredits;
    let hallToday = DEFAULT_HALL_OF_FAME.map(r => ({ ...r }));
    let hallAllTime = DEFAULT_HALL_OF_FAME.map(r => ({ ...r }));
    const ram = new RAM(), video = new VideoMemory(), L = PHR6_LAYOUT;
    const cpuBudget = createSourceCpuBudget();
    const at = n => L.at(n), r = n => ram.read8(at(n)), w = (n, v) => ram.write8(at(n), v), w16 = (n, v) => ram.write16(at(n), v);
    const objVideo = createDefa7ObjectVideoRoutines(video);
    const playerVideo = createDefa7PlayerVideoRoutines(ram, L, video);
    const rom = createRomf8GraphicsRoutines(video, ram);
    const terrain = createBlk71TerrainRoutines(ram, video);
    const scanner = createAmode1ScannerRoutines(ram, L, video, { MTERR });
    const topDisplay = createDefa7TopDisplayRoutines(video);
    const scoreDisplay = createDefa7ScoreDisplayRoutines(ram, L, {
        displayEquates: { P1DISP: 0x0f1c, P2DISP: 0x711c, N0V: HUD_SOURCE_RELOC.N0V, DIGLTH: 0x0400 },
        CWRIT: rom.CWRIT, COFF: rom.COFF
    });
    const random = createDefa7RandomRoutines(ram, L);
    const stars = createDefa7StarRoutines(ram, L, video);
    const fireTable = createDefa7FireTableRoutines(ram, L, { RAND: random.RAND });
    const pictureData = { ...ENEMY_PICTURES, TIEP1, C5P1, PLAPIC, PLBPIC };
    const defenderLogoBytes = DEFNNN();
    // Exact Red Label attract scratch area: DEFDSC, 15 14-byte object records,
    // 15 four-byte descriptors and the original 60x24 expanded DEFBLK.
    const DEFDSC = 0xb300, DEFRAM = DEFDSC + 4, DEFPIC = DEFRAM + 15 * 14;
    const DEFBLK = DEFPIC + 15 * 4;
    // Picture handles for the original AMODE1 attract demonstration. The
    // normal title's DEFPIC descriptors are added to the same resolver later.
    // The handles here are data relocation addresses, not CPU instructions.
    const appearancePictures = new Map();
    const demoPictureHandles = new Map();
    const ORIGINAL_DEMO_PICTURES = { ASTP1: ENEMY_PICTURES.ASTP1, LNDP1: ENEMY_PICTURES.LNDP1,
        SCZP1: ENEMY_PICTURES.SCZP1, UFOP1: ENEMY_PICTURES.UFOP1,
        TIEP1, PRBP1: ENEMY_PICTURES.PRBP1, SWPIC1: ENEMY_PICTURES.SWPIC1 };
    let demoPicturePtr = 0xe800;
    for (const [name, pic] of Object.entries(ORIGINAL_DEMO_PICTURES)) {
        const ptr = demoPicturePtr;
        demoPicturePtr += 4;
        demoPictureHandles.set(name, ptr);
        appearancePictures.set(ptr, pic);
    }
    // A single source-format object record is sufficient for XSVCT: EXST
    // copies its OX16, OY16 and OPICT values to a SAMEX explosion slot.
    // It is separate from the scripted sprite presenter (which cannot
    // execute 6809 KILLOB/GETOB) and lives outside the original PHR6 tables.
    const DEMO_XSVCT_OBJECT = 0xb200;
    // Source GETOB records in the attract scene, kept separately from DEFRAM
    // ($B300), SAMEX RAM ($9C00), and the XSVCT scratch record ($B200).
    // Native JS records are data relocations, not 6809 object emulation.
    const DEMO_OBJECT_BASE = 0xb000, DEMO_OBJECT_STRIDE = 0x10;
    let demoObjectCount = 0;
    const explosions = createSamexap7ExplosionStartRoutines(ram, L, video, { resolvePicture: id => appearancePictures.get(id) });
    const updates = createSamexap7ExplosionUpdateRoutines(ram, L, video, { resolvePicture: id => appearancePictures.get(id), EERASE: explosions.EERASE });
    const appearance = createSamexap7AppearanceRoutines(ram, L, { NULOB: 0, EERASE: explosions.EERASE });
    const fullDescriptor = () => {
        ram.write8(DEFDSC, 60);
        ram.write8(DEFDSC + 1, 24);
        ram.write16(DEFDSC + 2, DEFBLK);
    };
    const installDefenderSource = () => {
        for (let i = 0; i < defenderLogoBytes.length; i++)
            ram.write8(DEFBLK + i, defenderLogoBytes[i]);
        fullDescriptor();
    };
    // LOGO0 is the sole source of WILLIAMS pixels. Its recorded nibble
    // addresses also allow the browser-only presentation pass to restore
    // lettering cleared by asynchronous SAMEX EERASE writes. No replacement
    // logo glyphs or guessed bitmap are introduced.
    const logoNibbles = new Map();
    let glyphs = null;
    let state = { phase: 'AMODES', page: 'presentation', tick: 0, remaining: 0, logoIndex: 0, logoX: 0, logoY: 0,
        step: 'LOGO0', sourceExecCycles: 0, samexWriteBlocks: 0, samexEraseBlocks: 0, objectIndex: 0, captionIndex: 0, logoComplete: false, logoRate: 3, logoPasses: 0, presTicks: 0, laserFrames: 0, colourIndex: 0, tiePhase: 0, defenderPhase: 'waiting', defenderAge: -1, defenderSlices: 0, defenderCBomb: false, cBombStage: 0 };
    let sprites = [];
    // Source-named AMODE1 continuations run through DEFA7's PTIME/SLEEP
    // semantics, not one synthetic defenderAge gate in the browser presenter.
    let titleProcesses = null;
    // AMODE1/LASRS process state: original PD, PD+2 and LSTATE pointers.
    // `beam` holds only surviving video bytes so object re-rendering cannot
    // accidentally erase a live laser. No substitute Canvas laser is drawn.
    let beam = new Map(), laser = null;
    const add16 = (v, delta) => (v + delta) & 0xffff;
    // DEFA7.OPON: source world-X minus BGL, ASLB/ROLA twice, then high byte
    // selects the video byte-column. Attract SCINIT sets BGL=0.
    // Stage 36 incorrectly used OX16>>>8; this compressed every actor 4x left.
    const projected = s => (s.x16 << 2) & 0xffff;
    const addr = s => ((projected(s) & 0xff00) | (s.y16 >>> 8)) & 0xffff;
    const carryFor = s => (projected(s) & 0x80) !== 0;
    const operation = { ASTP1: ['ON28', 'OFF28'], LNDP1: ['ON58', 'OFF58'], SCZP1: ['ON58', 'OFF58'],
        UFOP1: ['ON64', 'OFF64'], TIEP1: ['ON48', 'OFF48'], PRBP1: ['ON48', 'OFF48'],
        SWPIC1: ['ON34', 'OFF34'], C5P1: ['ON66', 'OFF66'] };
    function drawSprite(s) {
        // APST swaps OPICT for the source NULOB descriptor while EWRITE paints
        // converging picture bytes. Drawing a complete sprite simultaneously
        // would conceal the original implosion/arrival and is not in AMODE1.
        if (!s || !s.visible || s.appearing)
            return;
        const target = addr(s), carry = carryFor(s);
        if (s.picture === 'PLAPIC' || s.picture === 'PLBPIC')
            playerVideo.ON86(target, pictureData[s.picture], carry);
        else {
            const [on] = operation[s.picture];
            objVideo[on](target, pictureData[s.picture], carry);
        }
        s.last = target;
    }
    function eraseSprite(s) {
        if (!s || s.last === undefined)
            return;
        if (s.picture === 'PLAPIC' || s.picture === 'PLBPIC')
            playerVideo.OFF86(s.last);
        else {
            const [, off] = operation[s.picture];
            objVideo[off](s.last);
        }
        delete s.last;
    }
    function make(picture, x16, y16, vx = 0, vy = 0, blip = 0) {
        return { picture, x16, y16, vx, vy, visible: true, blip };
    }
    // AMODE1.STILOB/GETOB record content -> SAMEXAP7.APST/EXPU4.
    function startAppearance(s) {
        if (s.record === undefined) {
            if (demoObjectCount >= 24)
                throw new Error('AMODE1 source demonstration object records exhausted');
            s.record = DEMO_OBJECT_BASE + DEMO_OBJECT_STRIDE * demoObjectCount++;
        }
        const ptr = demoPictureHandles.get(s.picture);
        if (ptr === undefined)
            throw new Error('AMODE1 APVCT unresolved picture ' + s.picture);
        ram.write16(s.record + L.at('OX16'), s.x16);
        ram.write16(s.record + L.at('OY16'), s.y16);
        ram.write16(s.record + L.at('OPICT'), ptr);
        ram.write8(s.record + L.at('OTYP'), 0);
        // APST replaces OPICT with source NULOB; the presenter respects it.
        s.appearing = appearance.APST(s.record) !== null;
        return s.appearing;
    }
    function syncSourceObjects() {
        for (const s of sprites) {
            if (s.record === undefined)
                continue;
            ram.write16(s.record + L.at('OX16'), s.x16);
            ram.write16(s.record + L.at('OY16'), s.y16);
        }
    }
    function finishAppearances() {
        for (const s of sprites) {
            if (!s.appearing)
                continue;
            // In original EXPU6, the picture descriptor returns to OPICT and the
            // APST slot's size is cleared. No guessed frame/timer threshold.
            if (ram.read16(s.record + L.at('OPICT')) === demoPictureHandles.get(s.picture))
                s.appearing = false;
        }
    }
    // Source MESS0.TEXT7B cursor advance and ROMF8.CWRIT descriptors.
    // Addresses are always original column-major video bytes, never Canvas text.
    function WTEXTB(value, location) {
        let x = location >>> 8, y = location & 255;
        for (const ch of value) {
            if (ch === ' ') {
                x += 2;
                continue;
            }
            const descriptor = /\d/.test(ch) ? HUD_SOURCE_RELOC.N0V + (ch.charCodeAt(0) - 48) * 4 : glyphs.descriptors[ch];
            if (descriptor === undefined)
                throw new Error('Missing MESS0 source glyph ' + ch);
            rom.CWRIT((x << 8) | y, descriptor);
            x += ram.read8(descriptor) + 1;
        }
        return (x << 8) | y;
    }
    // DEFA7 COLR/COLRLP: palette #1 cycles every 2 original process ticks.
    // DEFB6 TIECOL/TIECL: D,E,F cycle through the source three-row TCTAB
    // every six process ticks. F is the Williams line-art colour index.
    // Copy PCRAM to hardware $C000-$C00F on each IRQ-style attract update.
    function palette() {
        ram.write8(at('PCRAM') + 1, 0x38);
        ram.write8(at('PCRAM') + 12, 0x3f);
        for (let i = 0; i < 3; i++)
            ram.write8(at('PCRAM') + 13 + i, TCTAB[i]);
        latchPalette();
    }
    function latchPalette() {
        for (let i = 0; i < 16; i++)
            ram.write8(0xc000 + i, ram.read8(at('PCRAM') + i));
    }
    function COLRLP() {
        const colour = COLTAB[state.colourIndex];
        if (colour === 0) {
            state.colourIndex = 0;
            return COLRLP();
        }
        ram.write8(at('PCRAM') + 1, colour);
        state.colourIndex++;
    }
    function TIECL() {
        const offset = state.tiePhase * 3;
        for (let k = 0; k < 3; k++)
            ram.write8(at('PCRAM') + 13 + k, TCTAB[offset + k]);
        state.tiePhase = (state.tiePhase + 1) % 3;
    }
    function CBOMB() {
        ram.write8(at('PCRAM') + 10, 0xff);
        ram.write8(at('PCRAM') + 12, 0);
        state.cBombStage = 3;
    }
    function CBMB1() {
        const colour = COLTAB[r('SEED') & 0x1f];
        ram.write8(at('PCRAM') + 10, colour);
        ram.write8(at('PCRAM') + 12, colour);
        state.cBombStage = 6;
    }
    function colourProcesses() {
        if (state.tick === 1 || (state.tick & 1) === 1)
            COLRLP();
        if (state.page !== 'highscores' && state.tick % 6 === 0)
            TIECL();
        if (state.defenderCBomb) {
            if (state.cBombStage <= 0) {
                CBOMB();
            }
            else if (--state.cBombStage === 0) {
                if (ram.read8(at('PCRAM') + 12) === 0)
                    CBMB1();
                else
                    CBOMB();
            }
        }
        latchPalette();
    }
    // AMODE1.SCINIT, source lines 515-528. This source entry owns the
    // scanner marker: the *scripted demo sprite* is not the player state.
    function SCINIT() {
        w('STATUS', 0xff);
        w16('OPTR', 0);
        w16('IPTR', 0);
        w16('SETEND', 0);
        video.clear();
        w16('BGL', 0);
        w16('BGLX', 0);
        terrain.BGINIT();
        terrain.BGOUT(); // original MLJSR 0,BGI
        // CRINIT: exactly sixteen bytes from DEFB6.CRTAB. The blue BORDER
        // uses colour nibble 5, which must retain CRTAB's $81 latch.
        CRTAB.forEach((v, i) => ram.write8(at('PCRAM') + i, v));
        latchPalette();
        w('STATUS', 0xdb);
        w('PLAXC', 0x10);
        w('PLAYC', 0x30);
    }
    // AMODE1.SCORES, source lines 983-989: reads PLRCNT, then SCRTR0.
    function SCORES() {
        let a = r('PLRCNT');
        while (a) {
            scoreDisplay.SCRTR0(a);
            a = (a - 1) & 255;
        }
    }
    // AMODE1.CREDS, lines 958-971. Message is MESS0.CREDV -> CREDWS
    // (the source word "CREDITS:"); the number comes from source WNUMBB.
    // Only nonzero cabinet CREDIT values display the line.
    function CREDS() {
        const credit = r('CREDIT');
        if (!credit)
            return;
        WTEXTB('CREDITS:', 0x28e5);
        // WNUMBB uses packed decimal number. 1 or 2 digits are sufficient
        // for the supported 0..99 cabinet state, with the original source
        // numeral descriptors installed by installHudSourceData.
        let ptr = 0x48e5;
        for (const ch of String(credit)) {
            rom.CWRIT(ptr, HUD_SOURCE_RELOC.N0V + (ch.charCodeAt(0) - 48) * 4);
            ptr = (ptr + 0x0400) & 65535;
        }
    }
    // AMODE1.COPYRT/CPR1-CPR4: 8 raster rows per source 16-bit record.
    function COPYRT() {
        let X = 0x3bd0;
        for (let i = 0; i < CPRTAB.length; i += 2) {
            for (let bit = 1; bit <= 0x80; bit <<= 1) {
                const value = ((CPRTAB[i] & bit) ? 0x10 : 0) | ((CPRTAB[i + 1] & bit) ? 1 : 0);
                video.write8(X++, value);
            }
            X += 0xf8;
        }
    }
    /** AMODE3/AMOD11 -> XSVCT -> SAMEX.EXST. The original assembly kills
     * each scripted enemy, then creates an expansion from that enemy's source
     * OX16/OY16/OPICT. Keep this behaviour in JS rather than merely hiding
     * its bitmap. Browser sprites remain a presentation boundary only. */
    function XSVCT(sprite) {
        const ptr = demoPictureHandles.get(sprite.picture);
        if (ptr === undefined)
            throw new Error('AMODE1 XSVCT unresolved original picture ' + sprite.picture);
        ram.write16(DEMO_XSVCT_OBJECT + L.at('OX16'), sprite.x16);
        ram.write16(DEMO_XSVCT_OBJECT + L.at('OY16'), sprite.y16);
        ram.write16(DEMO_XSVCT_OBJECT + L.at('OPICT'), ptr);
        return explosions.EXST(DEMO_XSVCT_OBJECT);
    }
    /** PRES/PRES1: AMODE1.SRC repeats the MESS0 ELECV text every five
     * process ticks. Original EXPU expansion blocks erase any pixels below
     * them; drawing only once was why the words fragmented in Stage 39. */
    function PRES1() {
        // MESS0.SRC ELEC: ELECTR ; RLF,RLF,HMC,12 ; PRESEN.
        // MESS0.RLF1 resets X to TOPL and increments Y by LINESP=$0A;
        // MESS0.HMC1 adds 12 original VIDEO BYTE columns, not 12 pixels.
        const TOPL = 0x3258, second = ((((TOPL >>> 8) + 12) & 255) << 8) | ((TOPL + 2 * 0x0a) & 255);
        WTEXTB('ELECTRONICS INC.', TOPL);
        WTEXTB('PRESENTS', second);
    }
    // AMODE1.TEXTAB (1116-1130) and MESS0.SRC LAND/MUT/BAIT/BOMBR/SWRMP/SWARM.
    // Captions appear in TEXTP order and retain original second-line scoring
    // via source RLF + HMC offsets; no independently centered/fitted text.
    const TEXTAB = Object.freeze([
        { at: 0x4330, name: 'SCANNER' },
        { at: 0x1c70, name: 'LANDER', score: '150', hmc: 6 },
        { at: 0x3c70, name: 'MUTANT', score: '150', hmc: 6 },
        { at: 0x5f70, name: 'BAITER', score: '200', hmc: 6 },
        { at: 0x1ca8, name: 'BOMBER', score: '250', hmc: 6 },
        { at: 0x40a8, name: 'POD', score: '1000', hmc: 0 },
        { at: 0x5ca8, name: 'SWARMER', score: '150', hmc: 8 }
    ]);
    function TEXTP1(i) {
        const msg = TEXTAB[i];
        WTEXTB(msg.name, msg.at);
        if (msg.score) {
            const top = msg.at;
            // MESS0.RLF then HMC (relative to the returned-to-top cursor).
            WTEXTB(msg.score, (((((top >>> 8) + msg.hmc) & 255) << 8) | ((top + 10) & 255)));
        }
    }
    function TEXTP() {
        TEXTP1(state.textCursor);
        state.textCursor++;
        if (state.textCursor >= state.textLimit)
            state.textCursor = 0;
    }
    // DEFEND/DEFENS/DEF1/DEF2/DEF33/DEF50/DEF44, source 791-834.
    // Each of the 15 original four-column source chunks is an APST object,
    // managed by the same SAMEX appearance/erase implementation as gameplay.
    function DEFENS() {
        state.defenderPhase = 'appearing';
        state.defenderAge = 0;
        state.defenderSlices = 0;
        // Do not clear demo explosion descriptors: source XSVCT is used again
        // on the following scripted instruction page.
        for (const descriptor of [...appearancePictures.keys()])
            if (descriptor >= DEFPIC && descriptor < DEFPIC + 60)
                appearancePictures.delete(descriptor);
        for (let i = 0; i < 15; i++) {
            const descriptor = DEFPIC + 4 * i, object = DEFRAM + 14 * i;
            // Original DEF1 descriptor $040C, original data advances 4*24 bytes.
            const bytes = defenderLogoBytes.slice(i * 4 * 24, i * 4 * 24 + 4 * 12);
            appearancePictures.set(descriptor, { width: 4, height: 12, phases: [bytes] });
            ram.write8(descriptor, 4);
            ram.write8(descriptor + 1, 12);
            ram.write16(descriptor + 2, DEFBLK + i * 4 * 24);
            ram.write16(object + L.at('OX16'), 0x0c00 + i * 0x100);
            ram.write16(object + L.at('OY16'), 0x9800);
            ram.write8(object + L.at('OTYP'), 0);
            ram.write16(object + L.at('OPICT'), descriptor);
            if (appearance.APST(object) !== null)
                state.defenderSlices++;
        }
    }
    /** DEFEND / DEFENS / DEF33 / DEF50 / DEF44 are independent source
     * continuations; EXPU is executed by EXEC/XUVCT *before* DISP each tick.
     * This local dispatcher translates only the title's linked processes.
     */
    // ROMF8.CWRIT even-length path: each 16-bit data pair costs
    // LDU B,Y (7), STU B,X (7), SUBB #2 (2), BPL (3) =19 cycles.
    // 60 columns * 12 pairs, plus 25 cycles/column and entry/exit.
    const DEF50_CWRIT_CYCLES = 60 * (12 * 19 + 25) + 45;
    function DEF50() {
        rom.CWRIT(0x3090, DEFDSC);
        state.sourceExecCycles += DEF50_CWRIT_CYCLES;
    }
    function DEFEND({ sleep }) {
        sleep(0x30, 'DEFENS');
    }
    function DEF33({ spawn, sleep }) {
        fullDescriptor();
        state.defenderPhase = 'restoring';
        state.defenderRestoreActive = true;
        spawn('DEF50'); // NEWP inserted after CRPROC with PTIME=1 (MKP1).
        sleep(0x28, 'DEF44');
    }
    function DEF51({ sleep }) {
        sleep(1, 'DEF50');
    }
    function DEF50Process({ spawn, sleep, suicide }) {
        DEF50();
        state.defender50Draws = (state.defender50Draws || 0) + 1;
        // AMODE1.DEF50 tests the HIGH byte of the first two RSIZE words.
        const first = ram.read8(SAMEX_RAM.RAMALS);
        const second = ram.read8(SAMEX_RAM.RAMALS + SAMEX_RAM.RAMSIZ);
        if (!first && !second) {
            state.defenderRestoreActive = false;
            spawn('WILLIR');
            suicide();
        }
        else
            DEF51({ sleep });
    }
    function DEF44({ suicide }) {
        state.defenderCBomb = true;
        state.defenderPhase = 'complete';
        COPYRT();
        // COPYRT continues into the separately untranslated CPR55/credit
        // controller. This title-only process boundary ends here; the existing
        // non-title attract page lifecycle retains its documented host limit.
        suicide();
    }
    function WILLIR({ sleep }) {
        state.logoRate = 0xff;
        state.willIRUsed = true;
        sleep(2, 'WILR1');
    }
    function WILR1({ suicide }) {
        state.logoRate = 10;
        suicide();
    }
    function createTitleProcesses() {
        return createAttractProcessDispatcher({
            DEFEND, DEFENS: ({ sleep }) => {
                DEFENS();
                sleep(0x2e, 'DEF33');
            },
            DEF33, DEF50: DEF50Process, DEF44, WILLIR, WILR1
        });
    }
    function drawHall() {
        // HALDIS / HALD1 / HALDT: original MESS0 glyphs, source screen
        // coordinates, and original ROMC8.DEFALT factory CMOS records.
        rom.CWRIT(0x3038, DEFDSC);
        WTEXTB('HALL OF FAME', 0x3854);
        WTEXTB('TODAYS', 0x2268);
        WTEXTB('ALL TIME', 0x6568);
        WTEXTB('GREATEST', 0x1e73);
        WTEXTB('GREATEST', 0x6473);
        for (let col = 0x1e; col <= 0x3d; col++)
            video.write8((col << 8) | 0x7b, 0x11);
        for (let col = 0x41; col <= 0x7c; col++)
            video.write8((col << 8) | 0x7b, 0x11);
        for (let i = 0; i < DEFAULT_HALL_OF_FAME.length; i++) {
            const y = 0x86 + i * 10;
            for (const [base, line] of [[0x18, hallToday[i]], [0x59, hallAllTime[i]]]) {
                WTEXTB(String(i + 1), (base << 8) | y);
                WTEXTB(line.initials, ((base + 8) << 8) | y);
                WTEXTB(String(line.score), ((base + 23) << 8) | y);
            }
        }
    }
    function newPage(name) {
        video.clear();
        sprites = [];
        beam = new Map();
        laser = null;
        w16('OPTR', 0);
        w16('IPTR', 0);
        w16('SETEND', 0);
        demoObjectCount = 0;
        state.page = name;
        state.phase = name;
        state.tick = 0;
        state.remaining = 0;
        state.colourIndex = 0;
        state.tiePhase = 0;
        state.defenderCBomb = false;
        state.cBombStage = 0;
        state.defenderPhase = 'waiting';
        state.defenderAge = -1;
        state.defenderSlices = 0;
        state.defenderRestoreActive = false;
        state.willIR = 0;
        state.willIRUsed = false;
        state.defender50Draws = 0;
        state.sourceExecCycles = 0;
        state.samexWriteBlocks = 0;
        state.samexEraseBlocks = 0;
        titleProcesses = createTitleProcesses();
        ram.write16(at('LSEXPL'), 0);
        for (let Y = SAMEX_RAM.RAMALS; Y < SAMEX_RAM.RAMEND; Y += SAMEX_RAM.RAMSIZ)
            ram.write16(Y, 0);
        palette();
        if (name === 'presentation') {
            // AMODE1.AMODES: LDA #$FB; STA STATUS (lines 701-702). A
            // restarted title must not retain LEDRET's $D9 scanner status.
            w('STATUS', 0xfb);
            logoNibbles.clear();
            state.step = 'LOGO0';
            state.logoIndex = 0;
            state.logoX = 0;
            state.logoY = 0;
            state.logoComplete = false;
            state.logoRate = 3;
            state.logoPasses = 0;
            state.presTicks = 0;
        }
        else if (name === 'highscores') {
            drawHall();
            state.remaining = 300;
            state.step = 'HALD3';
        }
        else if (name === 'instructions') {
            // SCINIT/LEDRET: fixed demo world; original source uses BGI, then
            // 2-player score, border, original scanner and scripted objects.
            SCINIT();
            // AMODE1.LEDRET line 470: LDA #$D9; STA STATUS after SCINIT
            // leaves $DB. Bit $02 selects whether MT1 draws scanner terrain.
            w('STATUS', 0xd9);
            // LEDRET: SCORES; NEWP CREDS; JSR BORDER; NEWP SCPROC / TEXTP.
            // BORDER is the exact already-translated DEFA7 routine shared with
            // gameplay, not a new drawing based on reference screenshots.
            SCORES();
            CREDS();
            topDisplay.BORDER();
            // AMODE1.LEDRET NEWP CBOMB: palette #$C flashes throughout the
            // demonstration. SCZP1 (MUTANT) contains $C pixels; without this
            // process it never receives the original characteristic animation.
            state.defenderCBomb = true;
            state.cBombStage = 0;
            sprites = [make('ASTP1', 0x1e00, 0xdb00, 0, 0, 0x6666),
                make('PLAPIC', 0x0800, 0x5000, 0, 0, 0),
                make('LNDP1', 0x1da0, 0x4000, 0, 0x00a0, 0x4433)];
            // LEDRET: newly allocated Lander executes APVCT immediately.
            startAppearance(sprites[2]);
            // TEXTP begins at TEXTAB; TEXPTR initially TEXTAB+2 (SCANNER only).
            state.textCursor = 0;
            state.textLimit = 1;
            state.step = 'LEDRET';
            state.remaining = 0xe6;
            state.objectIndex = 0;
            scanner.SCNR();
        }
    }
    // LOGO/LOGO0/LOGO10: source counts data bytes, not elapsed ticks.
    // Each invocation processes LGOFLG source bytes and then sleeps two updates.
    // Only after the FIRST COMPLETE LGOTAB traversal does LOGO10 switch 3->10
    // and spawn PRES. Stage 36 sped up after an arbitrary 100 elapsed ticks.
    function LOGO0() {
        let amount = state.logoRate;
        while (amount > 0) {
            const b = LGOTAB[state.logoIndex++];
            if (b === undefined)
                throw new Error('LOGO0 LGOTAB missing QUIT sentinel');
            if (b === 0xff)
                continue; // original NULL: not counted towards TEMPB
            if (b === 0xfd) {
                state.logoPasses++;
                state.logoIndex = 0;
                // Original LOGO10 starts the second, faster drawing pass only
                // after all bytes of the first pass have already been processed.
                if (state.logoRate === 3) {
                    state.logoRate = 10;
                    state.logoComplete = true;
                    state.step = 'PRES';
                    state.presTicks = 0;
                }
                // Source LOGO10 jumps back to LOGO0 with new LGOFLG value.
                break;
            }
            if (b === 0xfe) {
                state.logoX = LGOTAB[state.logoIndex++];
                state.logoY = LGOTAB[state.logoIndex++];
                logoPixel();
                amount--;
                continue;
            }
            let A = b;
            do {
                if (A & 0x80)
                    state.logoX = (state.logoX - 1) & 255;
                A = (A << 1) & 255;
                if (A & 0x80)
                    state.logoX = (state.logoX + 1) & 255;
                A = (A << 1) & 255;
                if (A & 0x80)
                    state.logoY = (state.logoY - 1) & 255;
                A = (A << 1) & 255;
                if (A & 0x80)
                    state.logoY = (state.logoY + 1) & 255;
                A = (A << 1) & 255;
                logoPixel();
            } while (A !== 0);
            amount--;
        }
    }
    function logoPixel() {
        const address = ((state.logoX >>> 1) << 8) | state.logoY;
        const nibble = (state.logoX & 1) ? 0x0f : 0xf0;
        logoNibbles.set(address, (logoNibbles.get(address) || 0) | nibble);
        const old = video.read8(address);
        video.write8(address, old | nibble);
    }
    // Presentation boundary: LOGO0 and SAMEX.EERASE are independent source
    // processes, but the incomplete browser process scheduler serialises them.
    // Restore only nibbles already traced by the ORIGINAL LOGO0/LGOTAB path,
    // AFTER EXPU, to avoid a many-frame hole until the next source LOGO pass.
    // This is not a new draw routine or cycle-exact scheduler replacement.
    function restoreLogoFromLOGO0() {
        for (const [address, nibble] of logoNibbles) {
            const old = video.read8(address);
            video.write8(address, (old & (~nibble & 255)) | nibble);
        }
    }
    // Actual source LASRS/LASRR/LAS0/LAS1/LAS2/LAS3/LAS4.
    // A forward beam has four $11 columns, a $99 head and a moving tail
    // animated with three sequential bytes from the original FISTAB table.
    function eraseBeam() {
        for (const p of beam.keys())
            video.write8(p, 0);
        beam.clear();
        laser = null;
    }
    function beamWrite(p, v) {
        p &= 0xffff;
        video.write8(p, v);
        if (v)
            beam.set(p, v);
        else
            beam.delete(p);
    }
    function beginLaser() {
        const ship = sprites.find(s => s.picture === 'PLAPIC' || s.picture === 'PLBPIC');
        if (!ship)
            return;
        const start = add16(ship.last === undefined ? addr(ship) : ship.last, 0x704);
        laser = { head: start, tail: start, clear: start, frames: 0 };
        state.laserFrames = 0;
    }
    function LASRS() {
        if (!laser)
            beginLaser();
        if (!laser)
            return;
        let p = laser.head;
        for (let i = 0; i < 4; i++) {
            beamWrite(p, 0x11);
            p = add16(p, 0x100);
        }
        beamWrite(p, 0x99);
        laser.head = p;
        let table = ram.read16(at('FISX'));
        if (table >= at('FISEND') - 3 || table < at('FISTAB'))
            table = at('FISTAB');
        p = laser.tail;
        for (let i = 0; i < 3; i++) {
            beamWrite(p, ram.read8(table++));
            p = add16(p, 0x100);
        }
        ram.write16(at('FISX'), table);
        laser.tail = p;
        beamWrite(laser.clear, 0);
        laser.clear = add16(laser.clear, 0x100);
        laser.frames++;
        state.laserFrames = laser.frames;
    }
    function redraw() {
        for (const s of sprites)
            eraseSprite(s);
        // An object OFF routine may cross a laser. Redraw only the source laser
        // bytes after sprites have moved, retaining its PD/PD+2/LSTATE progress.
        for (const p of beam.keys())
            video.write8(p, 0);
        for (const s of sprites) {
            s.x16 = (s.x16 + s.vx) & 65535;
            s.y16 = (s.y16 + s.vy) & 65535;
        }
        for (const s of sprites)
            drawSprite(s);
        if (state.step === 'AMODE2' || state.step === 'AMOD10')
            LASRS();
        for (const [p, b] of beam)
            video.write8(p, b);
        // Source TEXTP is scheduled independently by STEP (one message per 6
        // original process ticks). Do not overlay every caption each redraw.
        if ((state.tick & 7) === 0 && state.page === 'instructions') {
            const nodes = sprites.filter(s => s.visible && s.blip);
            for (let i = 0; i < nodes.length; i++) {
                const s = nodes[i], ptr = 0xa700 + i * 0x20;
                ram.write16(ptr, i + 1 < nodes.length ? 0xa700 + (i + 1) * 0x20 : 0);
                ram.write16(ptr + at('OX16'), s.x16);
                ram.write16(ptr + at('OY16'), s.y16);
                ram.write16(ptr + at('OBJCOL'), s.blip);
            }
            w16('OPTR', nodes.length ? 0xa700 : 0);
            // SCINIT's $1030 PLAXC/PLAYC source scanner position stays fixed.
            // STILOB's scripted PLAPIC object does not write these globals.
            scanner.SCNR();
        }
    }
    function AMODE1() {
        const land = sprites.find(s => s.picture === 'LNDP1');
        const man = sprites.find(s => s.picture === 'ASTP1');
        if (land)
            land.vy = 0xff50;
        if (man)
            man.vy = 0xff50;
        state.step = 'AMODE1';
        state.remaining = 0xa0;
    }
    function AMODE2() {
        state.step = 'AMODE2';
        state.remaining = 0x15;
        beginLaser();
    }
    function AMODE3() {
        eraseBeam();
        const land = sprites.find(s => s.picture === 'LNDP1');
        if (land) {
            eraseSprite(land);
            land.visible = false;
            XSVCT(land);
        }
        const ship = sprites.find(s => s.picture === 'PLAPIC');
        if (ship) {
            ship.vx = 0x0040;
            ship.vy = 0x00d4;
        }
        const man = sprites.find(s => s.picture === 'ASTP1');
        if (man)
            man.vy = 0;
        state.step = 'AMODE4';
        state.remaining = 0x2d * 2;
        state.manFrames = 0x2d;
    }
    function AMODE4() {
        // Source AMODE4 accelerates man every 2 ticks, 45 frames in all.
        state.step = 'AMODE4';
        state.remaining = 0x2d * 2;
        state.manFrames = 0x2d;
    }
    function AMODE5() {
        const ship = sprites.find(s => s.picture === 'PLAPIC');
        const man = sprites.find(s => s.picture === 'ASTP1');
        if (ship) {
            ship.vx = 0;
            ship.vy = 0x00c0;
        }
        if (man) {
            man.x16 = 0x1e80;
            man.y16 = 0xa2e0;
            man.vy = 0x00c0;
        }
        sprites.push(make('C5P1', 0x1dff, 0x9000));
        state.step = 'AMODE5';
        state.remaining = 0x50;
    }
    function AMODE7() {
        const pts = sprites.find(s => s.picture === 'C5P1');
        if (pts) {
            pts.x16 = 0x1c00;
            pts.y16 = 0xe000;
        }
        const man = sprites.find(s => s.picture === 'ASTP1');
        if (man)
            man.vy = 0;
        const ship = sprites.find(s => s.picture === 'PLAPIC');
        if (ship) {
            ship.picture = 'PLBPIC';
            ship.vx = 0xffc0;
            ship.vy = 0xfe80;
        }
        state.step = 'AMODE7';
        state.remaining = 0x60;
    }
    function AMODE8() {
        const ship = sprites.find(s => s.picture === 'PLBPIC');
        if (ship) {
            eraseSprite(ship);
            ship.picture = 'PLAPIC';
            ship.vx = 0;
            ship.vy = 0;
        }
        const pts = sprites.find(s => s.picture === 'C5P1');
        if (pts)
            pts.visible = false;
        state.objectIndex = 0;
        AMOD12();
    }
    function AMOD12() {
        if (state.objectIndex === AMODE_ENEMIES.length) {
            state.step = 'AMOD13';
            state.remaining = 0xff * 2;
            return;
        }
        const record = AMODE_ENEMIES[state.objectIndex];
        const enemy = make(record.picture, 0x1f00, 0xa000, 0, 0xff40, record.blip);
        sprites.push(enemy);
        // AMODE1.AMOD12: JSR APVCT, *before* the $5F frame movement.
        startAppearance(enemy);
        state.step = 'AMOD12';
        state.remaining = 0x5f;
    }
    function AMOD10() {
        state.step = 'AMOD10';
        state.remaining = 0x17;
        beginLaser();
    }
    function AMOD11() {
        eraseBeam();
        const record = AMODE_ENEMIES[state.objectIndex];
        const enemy = sprites.find(s => s.picture === record.picture && s.visible);
        if (enemy) {
            // AMOD11: KILLOB -> GETOB -> XSVCT followed by new display-position
            // OX16/OY16 and APVCT. Do not replace the source explosion with an
            // immediate sprite swap.
            eraseSprite(enemy);
            if (enemy.appearing) {
                appearance.CANCEL(enemy.record);
                enemy.appearing = false;
            }
            XSVCT(enemy);
            enemy.x16 = record.x;
            enemy.y16 = record.y;
            enemy.vx = 0;
            enemy.vy = 0;
            // Source GETOB reuses the object after XSVCT and invokes APVCT again,
            // materialising its picture next to its TEXTAB caption.
            startAppearance(enemy);
        }
        // Source does not write the caption here: TEXTP sees new TEXPTR at BMODE2.
        state.step = 'BMODE2';
        state.remaining = 0x20;
    }
    function BMODE2() {
        state.textLimit = Math.min(TEXTAB.length, state.textLimit + 1);
        state.step = 'BMODE3';
        state.remaining = 0x20;
    }
    function BMODE3() {
        state.objectIndex++;
        AMOD12();
    }
    function RESET(sourceRandomState = null) {
        ram.clear();
        video.clear();
        installHudSourceData(ram);
        installDefenderSource();
        glyphs = installBonusSourceFont(ram, ENEMY_PICTURES.ASTP3);
        CRTAB.forEach((v, i) => ram.write8(at('PCRAM') + i, v));
        palette();
        w('CREDIT', cabinetCredits);
        state.oldCredits = cabinetCredits;
        // SINIT runs only at cabinet initialisation. When returning from a
        // paid game, the original RAM contains the *live* SEED and SMAP.
        // The browser's game/attract modules have separate RAM stores, so
        // explicitly carry that same source state across this boundary.
        if (sourceRandomState !== null) {
            const { seed, hseed, lseed, starMap } = sourceRandomState;
            const starLength = at('SMEND') - at('SMAP');
            if (![seed, hseed, lseed].every(v => Number.isInteger(v) && v >= 0 && v <= 255)
                || !(starMap instanceof Uint8Array) || starMap.length !== starLength)
                throw new TypeError('AMODE1 RESET requires original SEED/HSEED/LSEED and SMAP');
            w('SEED', seed);
            w('HSEED', hseed);
            w('LSEED', lseed);
            for (let i = 0; i < starLength; i++) ram.write8(at('SMAP') + i, starMap[i]);
            w('STRCNT', 16);
        } else {
            w16('HSEED', 0xa55a);
            random.STINIT();
        }
        fireTable.FISS();
        newPage('presentation');
        cpuBudget.reset();
    }
    function STEP() {
        state.tick++;
        // Main EXEC advances RAND once each step in the original board.
        random.RAND();
        if (state.page === 'presentation') {
            // DEFA7.EXEC1 calls XUVCT (SAMEX.EXPU) BEFORE RAND and DISP.
            // The 15 APST allocations must not be advanced in their creation
            // tick: they are initialised by DEFENS in a *later* process pass.
            if (state.defenderAge >= 0) {
                const cost = updates.EXPU();
                state.sourceExecCycles = cost.cycles;
                state.samexWriteBlocks = cost.writerBlocks;
                state.samexEraseBlocks = cost.eraserBlocks;
                state.defenderAge++;
            }
            else {
                state.sourceExecCycles = 0;
                state.samexWriteBlocks = 0;
                state.samexEraseBlocks = 0;
            }
            // LOGO0 is still a separate twice-per-EXEC process boundary.
            if ((state.tick & 1) === 0)
                LOGO0();
            if (state.step === 'PRES') {
                state.presTicks++;
                // PRES NEWP DEFEND at its first process invocation. The dispatcher
                // runs DEFEND, which SLEEPs $30, then DEFENS SLEEPs $2E, and DEF33
                // creates a fresh DEF50 process with PTIME=1.
                if (state.presTicks === 1)
                    titleProcesses.spawn('DEFEND');
                titleProcesses.dispatch();
                // MESS0.PRES1 repeats every five ticks. Keep the established
                // presentation restoration adapter until full EXEC/IRQ interleaving
                // is translated; this has no effect on title-process wake times.
                if ((state.presTicks - 1) % 5 === 0 || state.defenderAge >= 0)
                    PRES1();
                if (state.defenderAge >= 0)
                    restoreLogoFromLOGO0();
                if (state.presTicks >= 0x30 + 0x2e + 0x28 + 600)
                    newPage('highscores');
            }
        }
        else if (state.page === 'highscores') {
            if (--state.remaining === 0)
                newPage('instructions');
        }
        else if (state.page === 'instructions') {
            // Source TEXTP redraws one TEXTAB entry every six sleeping ticks;
            // TEXPTR grows at BMODE2. Include the original score lines.
            if (state.tick === 1 || state.tick % 6 === 1)
                TEXTP();
            if (state.tick % 16 === 0)
                CREDS();
            // APST reads the current object OX16/OY16 from RAM each source update.
            syncSourceObjects();
            // DEFA7.IRQ high-raster branch calls STOUT between PLAYER and OPROC.
            // The original scene's scanner/terrain alone cannot populate stars.
            // This writes the original SMAP-derived nibble values to video RAM.
            stars.STOUT();
            updates.EXPU();
            finishAppearances();
            if (state.step === 'AMODE4' && (state.tick & 1) === 0) {
                const man = sprites.find(s => s.picture === 'ASTP1');
                if (man)
                    man.vy = (man.vy + 8) & 65535;
            }
            if (--state.remaining === 0) {
                switch (state.step) {
                    case 'LEDRET':
                        AMODE1();
                        break;
                    case 'AMODE1':
                        AMODE2();
                        break;
                    case 'AMODE2':
                        AMODE3();
                        break;
                    case 'AMODE4':
                        AMODE5();
                        break;
                    case 'AMODE5':
                        AMODE7();
                        break;
                    case 'AMODE7':
                        AMODE8();
                        break;
                    case 'AMOD12':
                        AMOD10();
                        break;
                    case 'AMOD10':
                        AMOD11();
                        break;
                    case 'BMODE2':
                        BMODE2();
                        break;
                    case 'BMODE3':
                        BMODE3();
                        break;
                    case 'AMOD13':
                        newPage('presentation');
                        break;
                    default:
                        throw new Error('AMODE1 untranslated continuation ' + state.step);
                }
            }
            redraw();
            // BLK71.BGOUT is the original terrain framebuffer writer. The source
            // draws the same static world throughout LEDRET; our browser's merged
            // EXPU/object updates otherwise leave EERASE's zeroed terrain pixels
            // permanently missing. Preserve the source writer and original STBL;
            // call it after the shared video writers until the original IRQ/task
            // interleaving is translated in full (presentation scheduling only).
            terrain.BGOUT();
        }
        colourProcesses();
        return STATE();
    }
    // Video presentation receives a fixed physical CPU budget per video frame.
    // The named STEP/EXPU/DEF50 routines are unchanged; a busy 6809 executive
    // can now span multiple actual display frames, as in source EXEC/TIMER.
    function DISPLAY_STEP() {
        // DEFA7 IRQ/I0: INC TIMER is driven by the video clock even while
        // the preceding source EXEC is busy. EXEC0 reads AND clears the
        // accumulated byte once; DISP decrements PTIME only once per EXEC.
        // In particular, two elapsed IRQs do not imply two DEF50 calls.
        cpuBudget.advance(({ timerTicks }) => {
            state.execTimerRead = timerTicks;
            STEP();
            return state.sourceExecCycles;
        }, {
            onTimerIncrement: value => w('TIMER', value),
            onTimerClear: () => w('TIMER', 0)
        });
        return STATE();
    }
    function STATE() {
        return Object.freeze({ ...state, cpuBudget: cpuBudget.state(), titleProcessState: titleProcesses?.state() ?? null, laser: laser ? { ...laser } : null, objects: sprites.filter(s => s.visible).map(s => Object.freeze({ picture: s.picture, x16: s.x16, y16: s.y16, blip: s.blip, appearing: !!s.appearing })) });
    }
    function SET_CREDITS(value) {
        if (!Number.isInteger(value) || value < 0 || value > 99) throw new RangeError('CREDIT 0..99');
        cabinetCredits = value;
        w('CREDIT', value);
        // Actual CREDS reappears on the next source page redraw. Do not
        // paint browser text over the source framebuffer.
    }
    function SET_HALL_OF_FAME(tables) {
        if (!Array.isArray(tables?.today) || tables.today.length !== 8 ||
            !Array.isArray(tables?.allTime) || tables.allTime.length !== 8) {
            throw new TypeError('Source HALDT expects two eight-entry tables');
        }
        hallToday = tables.today.map(r => ({ ...r }));
        hallAllTime = tables.allTime.map(r => ({ ...r }));
        if (state.page === 'highscores') newPage('highscores');
    }
    RESET();
    return Object.freeze({ ram, video, RESET, SET_CREDITS, SET_HALL_OF_FAME, STEP, DISPLAY_STEP, TIMING_TRACE: cpuBudget.trace, STATE, AMODES: () => newPage('presentation'), HALDIS: () => newPage('highscores'), LEDRET: () => newPage('instructions'),
        LOGO0, SCINIT, SCORES, CREDS, BORDER: topDisplay.BORDER, PRES1, TEXTP1, TEXTP, XSVCT, DEFENS, DEFEND, DEF50, COPYRT, COLRLP, TIECL, AMODE1, AMODE2, AMODE3, AMODE4, AMODE5, AMODE7, AMODE8, AMOD12, AMOD10, AMOD11, BMODE2, BMODE3, LASRS, WTEXTB });
}
