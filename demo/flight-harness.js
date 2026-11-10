/** A diagnostic INPUT FIXTURE, not a translation of original SINIT/PLSTRT.
 * Executes the real translated PLAYER/STINIT/PINIT/OINIT code. No substitute
 * physics, enemies, terrain, scanner, or sound are introduced.
 */
import { RAM } from '../runtime/ram.js';
import { PHR6_LAYOUT } from '../runtime/phr6-layout.js';
import { createDefa7Routines } from '../original/defa7.js';
import { createDefa7PlayerRoutines } from '../original/defa7-player.js';
import { createDefa7RandomRoutines } from '../original/defa7-random.js';
import { s16 } from '../runtime/integers.js';
import { VideoMemory } from '../runtime/video-memory.js';
import { createDefa7StarRoutines } from '../original/defa7-stars.js';
import { createDefa7ThrustRoutines } from '../original/defa7-thrust.js';
import { createDefa7ScanningRoutines } from '../original/defa7-scanning.js';
import { createDefa7PlayerVideoRoutines } from '../original/defa7-player-video.js';
import { createDefa7TopDisplayRoutines } from '../original/defa7-top-display.js';
import { createDefa7SoundRoutines, soundTableFixture } from '../original/defa7-sound.js';
import { createDefa7ScoreRoutines } from '../original/defa7-score.js';
import { createDefa7ScoreDisplayRoutines } from '../original/defa7-score-display.js';
import { createDefa7HudRoutines } from '../original/defa7-hud.js';
import { createDefa7SwitchRoutines } from '../original/defa7-switches.js';
import { defenderGameSwitchTable } from '../original/defb6-switch-table.js';
import { createDefa7Executive } from '../original/defa7-exec.js';
import { createRomf8GraphicsRoutines } from '../original/romf8-graphics.js';
import { createAmode1ScannerRoutines } from '../original/amode1-scanner.js';
import { createDefa7IrqRoutines } from '../original/defa7-irq.js';
import { createDefa7InitRoutines } from '../original/defa7-init.js';
import { createDefa7ObjectProcessRoutines } from '../original/defa7-object-process.js';
import { createDefa7ShellRoutines } from '../original/defa7-shells.js';
import { createDefa7FireTableRoutines } from '../original/defa7-fire-tables.js';
import { PLAPIC, PLBPIC } from '../original/defb6-player-data.js';
import { ENEMY_PICTURES } from '../original/defb6-enemy-pictures.js';
import { createDefa7ObjectVideoRoutines } from '../original/defa7-object-video.js';
import { createBlk71TerrainRoutines, BLK71_ADDR } from '../original/blk71-terrain.js';
import { MTERR } from '../original/blk71-data.js';
import { createBlk71PlayerExplosionRoutines } from '../original/blk71-player-explosion.js';
import { createDefb6BankingObjectRoutines } from '../original/defb6-banking-object.js';
import { createDefb6UfoRoutines } from '../original/defb6-ufo.js';
import { createDefa7WaveExecutive } from '../original/defa7-wave-exec.js';
import { createDefa7WaveParameterRoutines } from '../original/defa7-wave-params.js';
import { createDefb6LanderRoutines } from '../original/defb6-lander.js';
import { createDefb6MutantStartRoutines } from '../original/defb6-mutant-start.js';
import { createDefb6TargetRoutines } from '../original/defb6-target.js';
import { createDefb6AstronautRoutines } from '../original/defb6-astronaut.js';
import { createDefb6ShootRoutines } from '../original/defb6-shoot.js';
import { createDefb6SwarmerRoutines } from '../original/defb6-swarm.js';
import { createDefa7AstronautStartRoutines } from '../original/defa7-astronaut-start.js';
import { createDefa7ProcessTasks } from '../original/defa7-process-tasks.js';
import { createSamexap7ExplosionStartRoutines } from '../original/samexap7-explosion-start.js';
import { createSamexap7ExplosionUpdateRoutines } from '../original/samexap7-explosion-update.js';
import { createSamexap7AppearanceRoutines } from '../original/samexap7-appearance.js';
import { createDefa7LaserRoutines } from '../original/defa7-laser.js';
import { createDefa7CollisionRoutines } from '../original/defa7-collision.js';
import { createDefa7ReverseRoutines } from '../original/defa7-rev.js';
import { createDefa7SmartBombRoutines } from '../original/defa7-smart-bomb.js';
import { createDefa7PlayerDeathRoutines } from '../original/defa7-player-death.js';
import { createDefb6RescuePointsRoutines } from '../original/defb6-rescue-points.js';
import { createDefb6TerrainBlowRoutines } from '../original/defb6-terrain-blow.js';
import { C25P1, C5P1, TEREX, TIEP1, TIEP2, TIEP3, TIEP4, BXPIC } from '../original/defb6-gameplay-pictures.js';
import { createDefb6TieRoutines } from '../original/defb6-tie.js';
import { createDefb6ProbeRoutines } from '../original/defb6-probe.js';
import { createDefb6ActiveScreenClearRoutines } from '../original/defb6-active-screen-clear.js';
import { createDefa7HyperspaceRoutines } from '../original/defa7-hyperspace.js';
import { CRTAB, WCTAB, HUD_SOURCE_RELOC, installHudSourceData } from '../original/defender-hud-data.js';
import { installBonusSourceFont } from '../original/defender-bonus-font.js';
import { createDefa7BonusRoutines } from '../original/defa7-bonus.js';
import { createDefb6ColourProcesses, installBombColourSourceData } from '../original/defb6-colour-processes.js';
export function createFlightHarness({ diagnosticSwarmer = false, infiniteSmartBombs = false, playerCollisions = false, sourceCabinetInput = false, onSoundPIAWrite = null, startingShips = 3, replayLevel = 10000 } = {}) {
    // Stage 19 continuation handles: diagnostic addresses, not asserted ROM addresses.
    // Browser operator CMOS affects the NEXT START, never an active wave.
    let configuredShips = startingShips;
    let configuredReplay = replayLevel;
    function CONFIGURE_OPERATOR({ ships = configuredShips, bonus = configuredReplay } = {}) {
        if (!Number.isInteger(ships) || ships < 1 || ships > 9) throw new RangeError('NSHIP 1..9');
        if (!Number.isInteger(bonus) || bonus < 0 || bonus > 990000 || bonus % 5000 !== 0) throw new RangeError('REPLAY level');
        configuredShips = ships; configuredReplay = bonus;
    }
    const WAVE_ADDR = Object.freeze({ GEX0: 0xf701, COLR: 0xf718, COLRLP: 0xf71a, THPROC: 0xf71c, TIECOL: 0xf71e, TIECL: 0xf720, CBOMB: 0xf722, CBMB1: 0xf724, SCPROC: 0xf710, SCP1: 0xf712, SCP2: 0xf714, UFOLP: 0xf702, UFOKIL: 0xf703, NULOB: 0xff9d,
        UFOP1: 0xe100, UFOP3: 0xe114, USHSND: 0xf704,
        LANDS0: 0xe201, LANDG: 0xe203, LANDF: 0xe205, LNDFXA: 0xe207,
        LNDP1: 0xe140, LNDP3: 0xe154, LKILL: 0xe228, LKIL1: 0xe22a,
        ASTRO: 0xe230, ASTKIL: 0xe232, AKIL1: 0xe234,
        ASTP1: 0xe240, ASTP2: 0xe24a, ASTP3: 0xe254, ASTP4: 0xe25e,
        SWPIC1: 0xe130, SWXP1: 0xe2b0, PRBP1: 0xe2ba, SCZP1: 0xe2c4, ASXP1: 0xe2ce, BMBP1: 0xe2d8, BMBP2: 0xe2e2,
        LPKSND: 0xe270, LSKSND: 0xe272, LSHSND: 0xe274, ASCSND: 0xe276, ACSND: 0xe278,
        SCZP1: 0xe280, SCZKIL: 0xe282, SCZ0: 0xe284, SSHSND: 0xe286,
        FBOUT: 0xf200, BMBOUT: 0xf204, BMBP1: 0xe292, BKIL: 0xe294, BXPIC: 0xe342,
        AFALL: 0xe298, AFALL2: 0xe29a, TERBLO: 0xe29c,
        P250: 0xe2a0, P500: 0xe2a2, ASXP1: 0xe2a4, AHSND: 0xe2a6, ALSND: 0xe2a8,
        UFHSND: 0xe410, SCHSND: 0xe412, SWHSND: 0xe414, PRHSND: 0xe416, TBSND: 0xe418, APSND: 0xe41a, LHSND: 0xe41c, MSWM: 0xe2ec, MSWLP: 0xe2ee, MSWKIL: 0xe2f0, SWSSND: 0xe2f2,
        PRBKIL: 0xe2f4, C25P1: 0xe304, C5P1: 0xe30e, TEREX: 0xe318, NOKILL: 0xe31c,
        TIE: 0xe420, TIEKIL: 0xe422, TIHSND: 0xe424, TIEP1: 0xe430, TIEP2: 0xe43a, TIEP3: 0xe444, TIEP4: 0xe44e, P503: 0xe322, TBLP0: 0xe324, TBL3: 0xe326, TBL4: 0xe328,
        LFIRE: 0xf930, LASR0: 0xf931, LASL0: 0xf932,
        REV: 0xf940, REV2: 0xf942, REVX1: 0xf944,
        SBOMB: 0xf950, SBMBX1: 0xf952, SBX1A: 0xf954, SBX2A: 0xf956, SBSND: 0xf958,
        PLEND: 0xf960, PDTHL: 0xf962, PDTH2: 0xf964, PDTH5: 0xf966, PX1A: 0xf968,
        HYPER: 0xf970, HYP02: 0xf972, HYP2: 0xf974, HYPAPL: 0xe3d0, HYPBPL: 0xe3d4 });
    const Layout = PHR6_LAYOUT;
    const ram = new RAM(), video = new VideoMemory(), procs = createDefa7Routines(ram, Layout), player = createDefa7PlayerRoutines(ram, Layout), random = createDefa7RandomRoutines(ram, Layout), stars = createDefa7StarRoutines(ram, Layout, video), thrust = createDefa7ThrustRoutines(ram, Layout, random, procs, WAVE_ADDR), scanning = createDefa7ScanningRoutines(ram, Layout);
    const playerVideo = createDefa7PlayerVideoRoutines(ram, Layout, video);
    // Original OPROC/GETSHL/SHELL callbacks are fully resolved only after the
    // original DEFB6 object descriptor symbol tables have been installed.
    // These two pointer values belong to the DIAGNOSTIC alone, not ROM addresses.
    const DEMO_PICTURE = 0xf100, DEMO_SHELL_OUT = 0xf200;
    const resolvePicture = Y => Y === DEMO_PICTURE ? {
        OBJW: 8,
        OBJDEL: (D) => playerVideo.OFF86(D),
        OBJWRT: (D, Y, X, carry) => playerVideo.ON86(D, PLAPIC, carry)
    } : null;
    const enemyVideo = createDefa7ObjectVideoRoutines(video);
    // Descriptor keys are standalone-JS symbolic handles, not asserted ROM addresses.
    // Picture bytes and dimensions, however, are exact FDB source translations.
    const ENEMY_DESCRIPTOR = Object.freeze({ BXPIC: WAVE_ADDR.BXPIC, C25P1: WAVE_ADDR.C25P1, C5P1: WAVE_ADDR.C5P1, TEREX: WAVE_ADDR.TEREX, TIEP1: WAVE_ADDR.TIEP1, TIEP2: WAVE_ADDR.TIEP2, TIEP3: WAVE_ADDR.TIEP3, TIEP4: WAVE_ADDR.TIEP4, UFOP1: 0xe100, UFOP2: 0xe10a, UFOP3: 0xe114,
        SWPIC1: 0xe130, LNDP1: 0xe140, LNDP2: 0xe14a, LNDP3: 0xe154,
        ASTP1: WAVE_ADDR.ASTP1, ASTP2: WAVE_ADDR.ASTP2, ASTP3: WAVE_ADDR.ASTP3, ASTP4: WAVE_ADDR.ASTP4,
        SCZP1: WAVE_ADDR.SCZP1, ASXP1: WAVE_ADDR.ASXP1, SWXP1: WAVE_ADDR.SWXP1,
        PRBP1: WAVE_ADDR.PRBP1, BMBP1: WAVE_ADDR.BMBP1, BMBP2: WAVE_ADDR.BMBP2,
        HYPAPL: WAVE_ADDR.HYPAPL, HYPBPL: WAVE_ADDR.HYPBPL });
    const imageFunctions = { BXPIC: ['ON48', 'OFF48'], C25P1: ['ON66', 'OFF66'], C5P1: ['ON66', 'OFF66'], TEREX: ['ON86', 'OFF86'], TIEP1: ['ON48', 'OFF48'], TIEP2: ['ON48', 'OFF48'], TIEP3: ['ON48', 'OFF48'], TIEP4: ['ON48', 'OFF48'], UFOP1: ['ON64', 'OFF64'], UFOP2: ['ON64', 'OFF64'], UFOP3: ['ON64', 'OFF64'],
        SWPIC1: ['ON34', 'OFF34'],
        ASTP1: ['ON28', 'OFF28'], ASTP2: ['ON28', 'OFF28'], ASTP3: ['ON28', 'OFF28'], ASTP4: ['ON28', 'OFF28'],
        SCZP1: ['ON58', 'OFF58'], ASXP1: ['ON48', 'OFF48'], SWXP1: ['ON48', 'OFF48'],
        PRBP1: ['ON48', 'OFF48'], BMBP1: ['ON23', 'OFF23'], BMBP2: ['ON23', 'OFF23'], LNDP1: ['ON58', 'OFF58'], LNDP2: ['ON58', 'OFF58'], LNDP3: ['ON58', 'OFF58'],
        HYPAPL: ['ON86', 'OFF86'], HYPBPL: ['ON86', 'OFF86'] };
    // The player descriptors are source PLAPIC/PLBPIC 8-byte x 6-row data.
    // width is measured in video bytes, not the 16 visible horizontal pixels.
    const hyperspacePictures = Object.freeze({
        HYPAPL: { width: 8, height: 6, phases: PLAPIC.phases },
        HYPBPL: { width: 8, height: 6, phases: PLBPIC.phases }
    });
    const allPictures = { ...ENEMY_PICTURES, C25P1, C5P1, TEREX, TIEP1, TIEP2, TIEP3, TIEP4, BXPIC, ...hyperspacePictures };
    const pictureFor = ptr => {
        const name = Object.keys(ENEMY_DESCRIPTOR).find(k => ENEMY_DESCRIPTOR[k] === ptr);
        return name ? allPictures[name] : null;
    };
    const enemyRegistry = new Map(Object.entries(ENEMY_DESCRIPTOR).map(([label, ptr]) => {
        const [on, off] = imageFunctions[label], pic = allPictures[label];
        const isPlayer = label === 'HYPAPL' || label === 'HYPBPL';
        return [ptr, { OBJW: pic.width, OBJDEL: D => isPlayer ? playerVideo.OFF86(D) : enemyVideo[off](D),
                OBJWRT: (D, Y, X, carry) => isPlayer ? playerVideo.ON86(D, label === 'HYPAPL' ? PLAPIC : PLBPIC, carry) : enemyVideo[on](D, pic, carry) }];
    }));
    const nullDescriptor = { OBJW: 1, OBJDEL: () => {
        }, OBJWRT: () => {
        } };
    const objectVideo = createDefa7ObjectProcessRoutines(ram, Layout, {
        resolvePicture: Y => Y === WAVE_ADDR.NULOB ? nullDescriptor : Y === DEMO_PICTURE ? resolvePicture(Y) : enemyRegistry.get(Y)
    });
    let enemyObjects = [];
    let lastScannerState = null, scannerRedraws = 0; // Count original scheduled SCNRV redraws.
    let waveTicks = 0, sourceUfoCount = 0, sourceLanderCount = 0, astronautProcess = 0;
    // Source OBI/OBINIT/GETOB and actual OPTR list; only initial placements
    // are controlled test input, not original wave spawning or APVCT.
    function seedEnemy(label, worldX, y, vx, vy, processAddress = 0xf760) {
        const U = procs.MKPROC(processAddress, Layout.at('STYPE'));
        const X = procs.OBINIT(U, { OPICT: ENEMY_DESCRIPTOR[label], OCVECT: 0xf762,
            OBJCOL: label.startsWith('LNDP') ? 0x4433 : label === 'SWPIC1' ? 0x2424 : 0x3333 });
        ram.write16(U + Layout.at('PD'), X);
        ram.write16(X + Layout.at('OX16'), worldX & 65535);
        ram.write16(X + Layout.at('OY16'), (y << 8) & 65535);
        ram.write16(X + Layout.at('OXV'), vx & 65535);
        ram.write16(X + Layout.at('OYV'), vy & 65535);
        // Equivalent object-list link used by original APVCT; this is a boundary
        // adapter until the source APVCT implementation is separately verified.
        ram.write16(Layout.at('OPTR'), X);
        enemyObjects.push({ label, object: X, process: U });
        return X;
    }
    function ENEMY_STATE() {
        return enemyObjects.map(({ label, object: X }) => ({ label,
            object: X, worldX: ram.read16(X + Layout.at('OX16')),
            y: ram.read8(X + Layout.at('OY16')),
            video: ram.read16(X + Layout.at('OBJX')) }));
    }
    let sourceShells;
    sourceShells = createDefa7ShellRoutines(ram, Layout, video, {
        // Both experimental FBOUT and actual SHL FBOUT resolve to the translated
        // source shell output routine. The retirement path erases via original OFSHIT.
        resolveOutput: ptr => (ptr === DEMO_SHELL_OUT || ptr === WAVE_ADDR.FBOUT) ? sourceShells.FBOUT
            : ptr === WAVE_ADDR.BMBOUT ? sourceShells.BMBOUT : null,
        OFSHIT: X => bankObjects.OFSHIT(X)
    });
    const fireTables = createDefa7FireTableRoutines(ram, Layout, { RAND: random.RAND });
    let demoObject = 0, demoShell = 0;
    const topDisplay = createDefa7TopDisplayRoutines(video);
    const terrain = createBlk71TerrainRoutines(ram, video);
    const scanner = createAmode1ScannerRoutines(ram, Layout, video, { MTERR });
    // Source IRQ and startup are available for isolated verification, but no
    // fictitious OPROC/SHELL/BGOUT hooks are installed in this flight fixture.
    const startup = createDefa7InitRoutines(ram, Layout, { CRTAB });
    // These routines are present, but not falsely wired into the IRQ/game loop.
    // Original character descriptor tables still need data-level translation.
    const romf8 = createRomf8GraphicsRoutines(video, ram);
    const displayEquates = { ...HUD_SOURCE_RELOC, P1SBD: 0x291b, P2SBD: 0x8b1b, P1DISP: 0x0f1c, P2DISP: 0x711c, DIGLTH: 0x0400, P1LAT: 0x0f14, P2LAT: 0x7114 };
    const scoreDisplay = createDefa7ScoreDisplayRoutines(ram, Layout, { displayEquates, CWRIT: romf8.CWRIT, COFF: romf8.COFF });
    const hud = createDefa7HudRoutines(ram, Layout, { displayEquates, BLKCLR: romf8.BLKCLR, CWRIT: romf8.CWRIT, BORDER: topDisplay.BORDER, SCRTR0: scoreDisplay.SCRTR0 });
    const scoreRequests = [];
    const scoring = createDefa7ScoreRoutines(ram, Layout, { SCRTRN: () => {
            scoreDisplay.SCRTRN();
            scoreRequests.push('SCRTRN rendered in source framebuffer');
            if (scoreRequests.length > 8)
                scoreRequests.shift();
        },
        LDISP: hud.LDISP, SBDISP: hud.SBDISP,
        // SCORE.SCRX -> LDD #RPSND / JSR SNDLD on a replay threshold.
        // This closure resolves `sound` after source wiring is complete.
        SNDLD: () => sound.SNDLD(soundTables.labels.RPSND), AUDIT: () => {
        } });
    // The original two-sample SSCAN reads the hardware PIA2/PIA3 bytes and
    // queues the first pressed SWTAB action; SWP creates its original process.
    // Source cabinet mode is opt-in to preserve diagnostic callers that write
    // PIA21/PIA31 directly. Coin/start controls are intentionally not simulated.
    const sourceSwitchTable = defenderGameSwitchTable(WAVE_ADDR, { STYPE: Layout.at('STYPE') });
    const switches = createDefa7SwitchRoutines(ram, Layout, {
        readPIA: index => index === 2 ? ram.read8(0xcc04) : index === 3 ? ram.read8(0xcc06) : 0,
        gameSwitchTable: sourceSwitchTable,
        coinDebounce1ms: () => {
        } // coin port held at zero; no invented credits
    });
    // Source EXEC bridge: the original IRQ updates TIMER, then EXEC performs
    // collision, explosion update, RAND, SWTAB switch dispatch and DISP in that
    // order. Source EXE overload logic remains inside createDefa7Executive.
    const executive = createDefa7Executive(ram, Layout, procs, {
        MAPC: bank => ram.write8(Layout.at('MAPC'), bank),
        COLCHK: () => {
            if (playerCollisions && !playerDeathActive && !(read8('STATUS') & 0x18) && collision.COLCHK())
                schedulePlayerDeath();
        },
        XUVCT: () => explosionUpdate.EXPU(),
        RAND: () => random.RAND(),
        OFSHIT: X => bankObjects.OFSHIT(X)
    });
    let soundPIASink = onSoundPIAWrite;
    const soundTables = soundTableFixture();
    const soundBus = [];
    const sound = createDefa7SoundRoutines(ram, Layout, { readSourceByte: soundTables.read8, onBusWrite: byte => {
            soundBus.push(byte);
            if (soundBus.length > 32)
                soundBus.shift();
            if (soundPIASink)
                soundPIASink(byte, ram.read8(Layout.at('SNDTMR')));
        } });
    const bankObjects = createDefb6BankingObjectRoutines(ram, Layout, {
        resolvePicture: Y => Y === WAVE_ADDR.NULOB ? nullDescriptor : Y === DEMO_PICTURE ? resolvePicture(Y) : enemyRegistry.get(Y),
        KILLOB: procs.KILLOB, BGINIT: terrain.BGINIT
    });
    // Synthetic source labels index the real (transcribed) sound tables. We
    // never pass a synthetic process/continuation address to SNDLD as ROM data.
    const soundHandles = new Map(['USHSND', 'LSHSND', 'LPKSND', 'LSKSND', 'ASCSND', 'ACSND', 'AHSND', 'ALSND', 'SSHSND', 'SWSSND', 'LHSND', 'UFHSND', 'SCHSND', 'SWHSND', 'PRHSND', 'TBSND', 'APSND', 'TIHSND']
        .filter(name => Number.isInteger(WAVE_ADDR[name]) && Number.isInteger(soundTables.labels[name]))
        .map(name => [WAVE_ADDR[name], soundTables.labels[name]]));
    const SNDLD = handle => {
        const sourceTable = soundHandles.get(handle);
        if (sourceTable === undefined)
            throw new Error('Unmapped source sound handle $' + handle.toString(16));
        return sound.SNDLD(sourceTable);
    };
    const scanTasks = createDefa7ProcessTasks(ram, Layout, procs, {
        addresses: WAVE_ADDR, ISCAN: scanning.ISCAN, OSCAN: scanning.OSCAN,
        SHSCAN: sourceShells.SHSCAN, MAPCH1: bankObjects.MAPCH1,
        SCNRV: () => {
            lastScannerState = scanner.SCNR();
            scannerRedraws++;
            return lastScannerState;
        }
    });
    const colourTasks = createDefb6ColourProcesses(ram, Layout, procs, WAVE_ADDR); // Original IRQ's D register is passed to the existing original PRDISP(A,B) routine.
    const irq = createDefa7IrqRoutines(ram, Layout, {
        SNDSEQ: () => {
            sound.SNDSEQ();
            if (sourceCabinetInput)
                switches.SSCAN();
        },
        PLAYER: player.PLAYER, STOUT: stars.STOUT,
        OPROC: objectVideo.OPROC, PRDISP: D => playerVideo.PRDISP(D >>> 8, D & 255),
        SHELL: sourceShells.SHELL, CSCAN: switches.CSCAN, BGOUT: terrain.BGOUT,
        VELO: player.VELO
    });
    const pos = n => Layout.at(n), read8 = n => ram.read8(pos(n)), read16 = n => ram.read16(pos(n));
    const write8 = (n, v) => ram.write8(pos(n), v), write16 = (n, v) => ram.write16(pos(n), v);
    // GEXEC and UFOST are the actual source-named process and spawn routines.
    // The adapter is confined to unresolved APVCT object-list insertion and
    // synthetic continuation/sound symbol addresses. The WVTAB is source data;
    // MAPCH7 is a no-op because it is already resident in JavaScript memory.
    // Blank CMOS bonus settings are an explicit diagnostic cabinet input.
    // For the first wave, GETWV uses WVTAB exactly regardless of those values.
    const waveParameters = createDefa7WaveParameterRoutines(ram, Layout, {
        MAPCH7: () => {
        }, RCMOSA: setting => setting === 'GA1+6' ? 5 : 0, RCMOSD: () => 0
    });
    let waveUfo, waveLander, mutantStart, probe, tie;
    let smartBomb;
    let transitionScheduled = false;
    let transitionTicks = 0;
    let waveCompleted = 0;
    let pendingWaveTransition = false, levelCompleted = 0, laserHits = 0, scoreHits = 0;
    let bonus, bonusGlyphs;
    let gameOver = false, playerDeaths = 0, playerDeathActive = false, hyperspaces = 0, laserShots = 0;
    const target = createDefb6TargetRoutines(ram, Layout);
    const explosionStart = createSamexap7ExplosionStartRoutines(ram, Layout, video, {
        resolvePicture: pictureFor
    });
    const explosionUpdate = createSamexap7ExplosionUpdateRoutines(ram, Layout, video, {
        resolvePicture: pictureFor,
        EERASE: explosionStart.EERASE
    });
    const appearance = createSamexap7AppearanceRoutines(ram, Layout, {
        NULOB: WAVE_ADDR.NULOB, EERASE: explosionStart.EERASE,
        APSND: WAVE_ADDR.APSND, SNDLD
    });
    const astronaut = createDefb6AstronautRoutines(ram, Layout, procs, {
        addresses: WAVE_ADDR, KILOFF: bankObjects.KILOFF, XSVCT: explosionStart.EXST, SNDLD,
        readAltitude: index => terrain.terrainBank.read8(BLK71_ADDR.ALTTBL + index)
    });
    // ASTST and the astronaut portion of PLRES are translated from DEFA7
    // lines 1513-1576. The original player-data PTARG value is set below as
    // an explicit level-one fixture; creation/placement is no longer a fixture.
    const astronautStart = createDefa7AstronautStartRoutines(ram, Layout, procs, {
        RAND: random.RAND, addresses: WAVE_ADDR,
        PRBST: A => probe.PRBST(A, astronautProcess),
        TIEST: A => tie.TIEST(A), SCZST: A => mutantStart.SCZST(A),
        MMSW: (A, X) => swarmer.MMSW(A, X),
        onAstronaut: X => enemyObjects.push({ label: 'ASTP1', object: X, process: 0 })
    });
    // LSHOT and SHOOT are the actual translated original shooting routines;
    // GETSHL still uses original shell allocation and visibility restrictions.
    const firing = createDefb6ShootRoutines(ram, Layout, {
        addresses: WAVE_ADDR, GETSHL: sourceShells.GETSHL,
        RMAX: bound => wave.RMAX(bound), SNDLD
    });
    const wave = createDefa7WaveExecutive(ram, Layout, procs, {
        addresses: { GEX0: WAVE_ADDR.GEX0 }, RAND: random.RAND,
        UFOST: () => {
            const { process: U, object: X } = waveUfo.UFOST();
            enemyObjects.push({ label: 'UFOP1', object: X, process: U });
            sourceUfoCount++;
        },
        LANDST: A => {
            const born = waveLander.LANDST(A);
            // LANDST's source return is an array of records if astronauts exist.
            for (const { process: U, object: X } of born) {
                enemyObjects.push({ label: 'LNDP1', object: X, process: U });
                sourceLanderCount++;
            }
        },
        WDELT: waveParameters.WDELT,
        GNCIDE: procs.GNCIDE,
        PLSAV: () => {
            // DEFA7 PLSAV: preserve astronaut target and game parameters in player record.
            const Y = read16('PLRX');
            for (let p = Y + pos('PTARG'); p < Y + pos('PENEMY') + 50; p++)
                ram.write8(p, 0);
            ram.write8(Y + pos('PTARG'), read8('ASTCNT'));
            for (let i = 0; i < pos('ELEND') - pos('ELIST'); i++) {
                const live = ram.read8(pos('ELIST') + i);
                const res = i < pos('ELIST1') - pos('ELIST') ? ram.read8(pos('ELEND') + i) : 0;
                ram.write8(Y + pos('PENEMY') + i, (live + res) & 255);
            }
        },
        BONUS: () => {
            // DEFA7 BONUS/BC1/BC2/BC3: source MESS0 text, one survivor reward
            // every four IRQ ticks, GETWV only once tallying finishes, then $80
            // ticks before the next PLSTR0. No immediate bulk scoring shortcut.
            bonus.BONUS();
            waveCompleted++;
        },
        PLSTR0: () => {
            transitionScheduled = true;
            transitionTicks = bonus.STATE().remainingTicks;
            return { kind: 'end-of-dispatch', next: 'PLSTR0' };
        },
        AUDIT: () => {
        } // diagnostic missing CMOS audit hardware, no in-game logic
    });
    bonus = createDefa7BonusRoutines(ram, Layout, {
        CWRIT: romf8.CWRIT, SCLR1: () => activeScreenClear.SCLR1(),
        SCORE: scoring.SCORE, GETWV: waveParameters.GETWV,
        // Installed during RESET after RAM.clear and before the first wave starts.
        get sourceGlyphs() {
            return bonusGlyphs;
        }, numeralBase: HUD_SOURCE_RELOC.N0V
    });
    const swarmer = createDefb6SwarmerRoutines(ram, Layout, procs, {
        addresses: WAVE_ADDR, OBINIT: procs.OBINIT,
        RAND: random.RAND, RMAX: wave.RMAX,
        SHL: (X, U, descriptor) => sourceShells.GETSHL(X, U, descriptor),
        SNDLD
    });
    waveLander = createDefb6LanderRoutines(ram, Layout, procs, {
        addresses: WAVE_ADDR, OBINIT: procs.OBINIT, RAND: random.RAND, RMAX: wave.RMAX,
        APVCT: appearance.APST, GTARG: target.GTARG,
        GETALT: astronaut.GETALT, LSHOT: firing.LSHOT, SHOOT: firing.SHOOT,
        SNDLD, SNDOUT: sound.SNDOUT, KILOFF: bankObjects.KILOFF, KILP, ASTK1: astronaut.ASTK1,
        SCZS0: remaining => mutantStart.SCZS0(remaining)
    });
    mutantStart = createDefb6MutantStartRoutines(ram, Layout, procs, {
        addresses: WAVE_ADDR, OBINIT: procs.OBINIT, RAND: random.RAND, RMAX: wave.RMAX,
        APVCT: appearance.APST,
        onMutant: (X, U) => enemyObjects.push({ label: 'SCZP1', object: X, process: U })
    });
    waveUfo = createDefb6UfoRoutines(ram, Layout, procs, {
        addresses: WAVE_ADDR, OBINIT: procs.OBINIT,
        APVCT: appearance.APST,
        RMAX: wave.RMAX,
        SHOOT: firing.SHOOT,
        SNDLD
    });
    // Original score-display processes and laser collision vectors share the
    // real OPTR object records. No UI-side sprites or duplicate collision arrays.
    const points = createDefb6RescuePointsRoutines(ram, Layout, procs, {
        addresses: WAVE_ADDR, SCORE: scoring.SCORE, KILOFF: bankObjects.KILOFF
    });
    const terrBlow = createDefb6TerrainBlowRoutines(ram, Layout, procs, {
        addresses: WAVE_ADDR, RAND: random.RAND, RMAX: wave.RMAX,
        GETALT: astronaut.GETALT, EXST: explosionStart.EXST,
        BGERAS: terrain.BGERAS, SNDLD, terrainBank: terrain.terrainBank
    });
    function objectPresent(X) {
        for (const list of ['OPTR', 'IPTR']) {
            let p = read16(list);
            for (let n = 0; p && n < 96; n++, p = ram.read16(p + pos('OLINK')))
                if (p === X)
                    return true;
        }
        return false;
    }
    function terminateOwner(X) {
        const U = ram.read16(X + pos('OBJID'));
        if (!U)
            return;
        // Probe has no dedicated owner process: it holds the spawning executive.
        const ownerAddress = ram.read16(U + pos('PADDR'));
        if (ownerAddress === WAVE_ADDR.GEX0)
            return;
        const candidates = [];
        let p = ram.read16(pos('ACTIVE'));
        for (let n = 0; p && n < 100; n++, p = ram.read16(p))
            candidates.push(p);
        if (candidates.includes(U) && U !== read16('CRPROC'))
            procs.KILL(U);
    }
    function KILP(X, pointsBCD, soundHandle) {
        return killObject(X, pointsBCD, soundHandle, true);
    }
    /** PHR6 KILO macro (DEFA7 KILOS): like KILP but the object only. Pods use
     * it because they have no process: their OBJID is just whichever process
     * created them, and that slot may since belong to something else. */
    function KILO(X, pointsBCD, soundHandle) {
        return killObject(X, pointsBCD, soundHandle, false);
    }
    function killObject(X, pointsBCD, soundHandle, withProcess, explosion = null) {
        // DEFB6 KILP: unlink target and owner, retain original picture for EXST.
        if (!objectPresent(X))
            return false;
        // The source appearance slot retains a back-pointer to this object.
        // Retire it before freeing X so EXPU cannot write to a reused record.
        const original = appearance.CANCEL(X);
        if (ram.read16(X + pos('OBJX')))
            bankObjects.OFSHIT(X);
        bankObjects.KILOFF(X);
        if (withProcess)
            terminateOwner(X);
        ram.write16(X + pos('OPICT'), original);
        if (explosion)
            explosion(X);
        explosionStart.EXST(X);
        scoring.SCORE(pointsBCD >>> 8, pointsBCD & 255);
        scoreHits++;
        if (soundHandles.has(soundHandle))
            SNDLD(soundHandle);
        return true;
    }
    function shellPresent(X) {
        for (let p = read16('SPTR'), n = 0; p && n < 96; n++, p = ram.read16(p + pos('OLINK')))
            if (p === X)
                return true;
        return false;
    }
    /** DEFA7.SRC 2697-2717 BKIL, including the source shell-list KILSHL
     * and the BXPIC explosion descriptor. Source scoreboard uses $0025. */
    function BKIL(X) {
        if (!shellPresent(X))
            return false;
        scoring.SCORE(0, 0x25);
        scoreHits++;
        write8('BMBCNT', (read8('BMBCNT') - 1) & 255);
        procs.KILSHL(X);
        if (ram.read16(X + pos('OBJX')))
            bankObjects.OFSHIT(X);
        const oldX = ram.read16(X + pos('OX16'));
        ram.write16(X + pos('OX16'), ((oldX >>> 2) + read16('BGL')) & 65535);
        ram.write8(X + pos('OY16'), (ram.read8(X + pos('OY16')) - 2) & 255);
        ram.write16(X + pos('OPICT'), WAVE_ADDR.BXPIC);
        explosionStart.EXST(X);
        SNDLD(WAVE_ADDR.AHSND);
        return true;
    }
    function KILL_BY_VECTOR(X, vector) {
        if (vector === WAVE_ADDR.BKIL)
            return BKIL(X);
        if (!objectPresent(X))
            return false;
        const dec = name => write8(name, (read8(name) - 1) & 255);
        if (vector === WAVE_ADDR.LKILL) {
            dec('LNDCNT');
            return KILP(X, 0x0115, WAVE_ADDR.LHSND);
        }
        if (vector === WAVE_ADDR.LKIL1) {
            return waveLander.LKIL1(X);
        }
        if (vector === WAVE_ADDR.UFOKIL) {
            dec('UFOCNT');
            return KILP(X, 0x0120, WAVE_ADDR.UFHSND);
        }
        if (vector === WAVE_ADDR.SCZKIL) {
            dec('SCZCNT');
            return KILP(X, 0x0115, WAVE_ADDR.SCHSND);
        }
        if (vector === WAVE_ADDR.MSWKIL) {
            // DEFB6 MSWKIL: KILOFF, KILLOP, then explode SWXP1 at OX16-$40 and
            // two pixels higher (Stage 76: was the generic KILP explosion).
            dec('SWCNT');
            return killObject(X, 0x0115, WAVE_ADDR.SWHSND, true, Y => {
                ram.write16(Y + pos('OX16'), (ram.read16(Y + pos('OX16')) - 0x40) & 0xffff);
                ram.write8(Y + pos('OY16'), (ram.read8(Y + pos('OY16')) - 2) & 0xff);
                ram.write16(Y + pos('OPICT'), WAVE_ADDR.SWXP1);
            });
        }
        if (vector === WAVE_ADDR.ASTKIL || vector === WAVE_ADDR.AKIL1)
            return vector === WAVE_ADDR.AKIL1 ? astronaut.AKIL1(X) : astronaut.ASTKIL(X);
        if (vector === WAVE_ADDR.PRBKIL) {
            // DEFB6 PRBKIL: KILO (object only, not KILP), RMAX 6, MMSW, DEC PRBCNT.
            // Stage 75: KILP here killed an unrelated process that had reused the
            // Pod creator's slot (e.g. a carried human's AFALL2), later
            // tripping KILL: "not in ACTIVE" when that human was shot.
            const result = KILO(X, 0x0210, WAVE_ADDR.PRHSND);
            if (result) {
                const count = wave.RMAX(6);
                swarmer.MMSW(count, X); // original PRBKIL -> MMSW, using destroyed probe's world position
                dec('PRBCNT');
            }
            return result;
        }
        if (vector === WAVE_ADDR.TIEKIL) {
            // TIEKIL unlinks the Bomber before the next raster OPROC erase pass.
            // At the standalone framebuffer integration boundary, explicitly perform
            // the translated OFSHIT erase *before* the cell is returned to OFREE.
            // Otherwise its last TIEP1-4 bitmap survives after a Smart Bomb hit.
            if (ram.read16(X + pos('OBJX')))
                bankObjects.OFSHIT(X);
            return tie.TIEKIL(X);
        }
        if (vector === WAVE_ADDR.NOKILL)
            return false;
        throw new Error('COLIDE reached untranslated original collision vector $' + vector.toString(16));
    }
    const laser = createDefa7LaserRoutines(ram, Layout, procs, video, {
        pictures: pictureFor,
        kill: (X, vector) => {
            const killed = KILL_BY_VECTOR(X, vector);
            if (killed && !read8('PCFLG'))
                laserHits++;
            return killed;
        },
        SNDLD: () => sound.SNDLD(soundTables.labels.LASSND)
    });
    const collision = createDefa7CollisionRoutines(ram, Layout, { COLIDE: laser.COLIDE, PLAPIC, PLBPIC });
    // PLEND's PLSAV uses exactly the same RAM target/enemy save operations
    // as the wave executive, without applying the wave-completion BONUS.
    function savePlayerOnDeath() {
        const Y = read16('PLRX');
        for (let p = Y + pos('PTARG'); p < Y + pos('PENEMY') + 50; p++)
            ram.write8(p, 0);
        ram.write8(Y + pos('PTARG'), read8('ASTCNT'));
        for (let i = 0; i < pos('ELEND') - pos('ELIST'); i++) {
            const live = ram.read8(pos('ELIST') + i);
            const reserve = i < pos('ELIST1') - pos('ELIST') ? ram.read8(pos('ELEND') + i) : 0;
            ram.write8(Y + pos('PENEMY') + i, (live + reserve) & 255);
        }
    }
    function completePlayerDeath() {
        // DEFA7 PDTH5 after BLK71 PXVCT returns: CLR SNDTMR / SNDOUT $13.
        // Only original sound-board command bytes are emitted; firmware/DAC
        // synthesis is not substituted by a Web Audio approximation.
        write8('SNDTMR', 0);
        sound.SNDOUT(0x13);
        playerDeaths++;
        playerDeathActive = false;
        // Source PLE01 tests PLAS after the last ship has died; the initial
        // PLSTR3 consumed one ship and each respawn consumes another.
        const remaining = ram.read8(read16('PLRX') + pos('PLAS'));
        if (!remaining) {
            gameOver = true;
            write8('STATUS', 0xff);
            return;
        }
        // The original PLSTRT performs an additional startup delay. Our existing
        // source restore bridge accounts for that delay without a CPU emulator.
        transitionScheduled = true;
        transitionTicks = 0x60;
    }
    const playerExplosion = createBlk71PlayerExplosionRoutines(video, {
        onColour: value => ram.write8(pos('PCRAM') + 0x0b, value)
    });
    const playerDeath = createDefa7PlayerDeathRoutines(ram, Layout, procs, {
        addresses: WAVE_ADDR, playerVideo,
        PLSAV: savePlayerOnDeath,
        SNDLD: () => sound.SNDLD(soundTables.labels.PDSND),
        beginExplosion: playerExplosion.PLEX,
        updateExplosion: () => {
            const done = playerExplosion.PX1A();
            if (done)
                playerExplosion.FINISH_DISPLAY();
            return done;
        },
        finishDeath: completePlayerDeath
    });
    function schedulePlayerDeath() {
        if (gameOver || playerDeathActive || (read8('STATUS') & 0x08))
            return false;
        procs.MKPROC(WAVE_ADDR.PLEND, pos('STYPE'));
        write8('STATUS', read8('STATUS') | 0x08);
        playerDeathActive = true;
        return true;
    }
    const activeScreenClear = createDefb6ActiveScreenClearRoutines(video, Layout);
    const hyperspace = createDefa7HyperspaceRoutines(ram, Layout, procs, {
        addresses: WAVE_ADDR, SCLR1: activeScreenClear.SCLR1, BGI: bankObjects.BGI,
        APVCT: appearance.APST, KILOFF: bankObjects.KILOFF, OFSHIT: bankObjects.OFSHIT,
        CANCEL: appearance.CANCEL,
        onFatal: () => {
            playerDeathActive = true;
            return playerDeath.PLEND();
        }
    });
    const reverse = createDefa7ReverseRoutines(ram, Layout, procs, WAVE_ADDR);
    smartBomb = createDefa7SmartBombRoutines(ram, Layout, procs, {
        addresses: WAVE_ADDR, kill: KILL_BY_VECTOR, infiniteAmmo: infiniteSmartBombs,
        // SBDISP now uses original DEFB6.SRC SBD10 bytes through ROMF8 CWRIT.
        // The temporary infiniteAmmo option leaves the stored P1SBC unchanged;
        // the development readout independently indicates ∞ above the canvas.
        SBDISP: hud.SBDISP,
        SNDLD: () => sound.SNDLD(soundTables.labels.SBSND)
    });
    probe = createDefb6ProbeRoutines(ram, Layout, {
        addresses: WAVE_ADDR, OBINIT: procs.OBINIT, RAND: random.RAND,
        APVCT: appearance.APST
    });
    tie = createDefb6TieRoutines(ram, Layout, procs, {
        addresses: WAVE_ADDR, RMAX: wave.RMAX, KILOFF: bankObjects.KILOFF,
        EXST: explosionStart.EXST, SCORE: scoring.SCORE, SNDLD,
        SHL: (X, U, descriptor) => sourceShells.GETSHL(X, U, descriptor)
    });
    // The source field addresses are external symbols, so the diagnostic handles
    // are resolved here by address without modifying PHR6_LAYOUT.
    const resumeSource = result => {
        let next = result;
        for (let n = 0; n < 100; n++) {
            if (next.kind === 'end-of-dispatch')
                return;
            if (next.kind !== 'resume')
                throw new Error('Unexpected original process continuation');
            if (next.address === WAVE_ADDR.GEX0) {
                // Host scheduling boundary, NOT a rewrite of GEX0. A bomb that kills
                // the final enemies must finish its original palette inversions before
                // the inter-wave BONUS text is drawn. GEX3 preserves the normal
                // 15-tick source-executive cadence until the flashing phase ends.
                next = (wave.WVCHK() === 0 && smartBomb.FLASHING()) ? wave.GEX3() : wave.GEX0();
            }
            else if (next.address === WAVE_ADDR.COLR)
                next = scanTasks.COLR();
            else if (next.address === WAVE_ADDR.COLRLP)
                next = scanTasks.COLRLP();
            else if (next.address === WAVE_ADDR.THPROC)
                next = thrust.THPROC();
            else if (next.address === WAVE_ADDR.TIECOL)
                next = colourTasks.TIECOL();
            else if (next.address === WAVE_ADDR.TIECL)
                next = colourTasks.TIECL();
            else if (next.address === WAVE_ADDR.CBOMB)
                next = colourTasks.CBOMB();
            else if (next.address === WAVE_ADDR.CBMB1)
                next = colourTasks.CBMB1();
            else if (next.address === WAVE_ADDR.SCPROC)
                next = scanTasks.SCPROC();
            else if (next.address === WAVE_ADDR.SCP1)
                next = scanTasks.SCP1();
            else if (next.address === WAVE_ADDR.SCP2)
                next = scanTasks.SCP2();
            else if (next.address === WAVE_ADDR.UFOLP)
                next = waveUfo.UFOLP();
            else if (next.address === WAVE_ADDR.ASTRO)
                next = astronaut.ASTRO();
            else if (next.address === WAVE_ADDR.TIE)
                next = tie.TIE();
            else if (next.address === WAVE_ADDR.LFIRE) {
                if (sourceCabinetInput)
                    laserShots++;
                next = laser.LFIRE();
            }
            else if (next.address === WAVE_ADDR.LASR0)
                next = laser.LASR0();
            else if (next.address === WAVE_ADDR.LASL0)
                next = laser.LASL0();
            else if (next.address === WAVE_ADDR.HYPER) {
                if (sourceCabinetInput)
                    hyperspaces++;
                next = hyperspace.HYPER();
            }
            else if (next.address === WAVE_ADDR.HYP02)
                next = hyperspace.HYP02();
            else if (next.address === WAVE_ADDR.HYP2)
                next = hyperspace.HYP2();
            else if (next.address === WAVE_ADDR.REV)
                next = reverse.REV();
            else if (next.address === WAVE_ADDR.REV2)
                next = reverse.REV2();
            else if (next.address === WAVE_ADDR.REVX1)
                next = reverse.REVX1();
            else if (next.address === WAVE_ADDR.PLEND)
                next = playerDeath.PLEND();
            else if (next.address === WAVE_ADDR.PDTHL)
                next = playerDeath.PDTHL();
            else if (next.address === WAVE_ADDR.PDTH2)
                next = playerDeath.PDTH2();
            else if (next.address === WAVE_ADDR.PDTH5)
                next = playerDeath.PDTH5();
            else if (next.address === WAVE_ADDR.PX1A)
                next = playerDeath.PX1A();
            else if (next.address === WAVE_ADDR.SBOMB)
                next = smartBomb.SBOMB();
            else if (next.address === WAVE_ADDR.SBMBX1)
                next = smartBomb.SBMBX1();
            else if (next.address === WAVE_ADDR.SBX1A)
                next = smartBomb.SBX1A();
            else if (next.address === WAVE_ADDR.SBX2A)
                next = smartBomb.SBX2A();
            else if (next.address === WAVE_ADDR.P250)
                next = points.P250();
            else if (next.address === WAVE_ADDR.P500)
                next = points.P500();
            else if (next.address === WAVE_ADDR.P503)
                next = points.P503();
            else if (next.address === WAVE_ADDR.TBLP0)
                next = terrBlow.TBLP0();
            else if (next.address === WAVE_ADDR.TBL3)
                next = terrBlow.TBL3();
            else if (next.address === WAVE_ADDR.TBL4)
                next = terrBlow.TBL4();
            else if (next.address === WAVE_ADDR.MSWM)
                next = swarmer.MSWM();
            else if (next.address === WAVE_ADDR.MSWLP)
                next = swarmer.MSWLP();
            else if (next.address === WAVE_ADDR.AFALL)
                next = astronaut.AFALL();
            else if (next.address === WAVE_ADDR.AFALL2)
                next = astronaut.AFALL2();
            else if (next.address === WAVE_ADDR.LANDS0)
                next = waveLander.LANDS0();
            else if (next.address === WAVE_ADDR.LANDG)
                next = waveLander.LANDG();
            else if (next.address === WAVE_ADDR.LANDF)
                next = waveLander.LANDF();
            else if (next.address === WAVE_ADDR.LNDFXA)
                next = waveLander.LNDFXA();
            else if (next.address === WAVE_ADDR.SCZ0)
                next = waveLander.SCZ0();
            else if (next.address === WAVE_ADDR.TERBLO)
                next = terrBlow.TERBLO();
            else if (next.address === 0xf760) { // legacy Stage 15 fixture process: inert diagnostic
                next = procs.SLEEP(240, 0xf760);
            }
            else
                throw new Error('Stage 17 untranslated process $' + next.address.toString(16));
        }
        throw new Error('Stage 17 process dispatch exceeded same-tick guard');
    };
    function ASTRONAUT_STATE() {
        const living = [];
        for (let p = pos('TLIST'); p < pos('TLEND'); p += 2) {
            const X = ram.read16(p);
            if (!X)
                continue;
            living.push({ object: X, worldX: ram.read16(X + pos('OX16')),
                video: ram.read16(X + pos('OBJX')), picture: ram.read16(X + pos('OPICT')) });
        }
        return Object.freeze({ count: read8('ASTCNT'), living });
    }
    function WAVE_STATE() {
        return { ticks: waveTicks, wave: read8('P1WAV'), ufoSpawned: sourceUfoCount,
            ufoCount: read8('UFOCNT'), ufoTimer: read8('UFOTMR'), waveTimer: read8('WAVTMR'),
            landerSpawned: sourceLanderCount, landerCount: read8('LNDCNT'), landerReserve: read8('LNDRES'), astronautCount: read8('ASTCNT'), active: enemyObjects.length, astronautProcess, waveCompleted, transitionTicks };
    }
    function RESET(restored = null, sourceRandomState = null) {
        gameOver = false;
        playerDeathActive = false;
        transitionTicks = 0;
        transitionScheduled = false;
        scannerRedraws = 0;
        playerExplosion.RESET();
        smartBomb.RESET();
        if (!restored) {
            playerDeaths = 0;
            waveCompleted = 0;
            hyperspaces = 0;
            laserShots = 0;
        }
        ram.clear(0, 0x10000);
        video.clear();
        laserHits = 0;
        scoreHits = 0;
        soundBus.length = 0;
        scoreRequests.length = 0;
        demoObject = 0;
        demoShell = 0;
        enemyObjects = [];
        waveTicks = 0;
        sourceUfoCount = 0;
        sourceLanderCount = 0;
        astronautProcess = 0;
        procs.PINIT();
        procs.OINIT();
        write8('CURPLR', 1);
        write8('PLRCNT', 1);
        // Empty cabinet inputs at boot; the host does not fabricate pressed keys.
        ram.write8(0xcc04, 0);
        ram.write8(0xcc06, 0);
        // Original HUD source descriptors and CRTAB are installed in translated data RAM.
        installHudSourceData(ram);
        installBombColourSourceData(ram);
        bonusGlyphs = installBonusSourceFont(ram, ENEMY_PICTURES.ASTP3);
        bonus.RESET();
        startup.CRINIT();
        // Hardware power-on colour latch until the next original IRQ copyPalette.
        for (let i = 0; i < 16; i++)
            ram.write8(0xc000 + i, ram.read8(pos('PCRAM') + i));
        // BLK71 original terrain tables are generated from its actual TDATA stream.
        // This is diagnostic wiring, not a claim of translated SINIT/IRQ scheduling.
        terrain.BGALT();
        terrain.BGINIT();
        // Source STCHKA suppresses terrain drawing whenever the player's
        // carried PTARG is zero. Do not briefly regenerate a destroyed world.
        const incomingTarget = restored ? restored[pos('P1TRG') - pos('P1SCR')] : 10;
        if (incomingTarget !== 0)
            terrain.BGOUT();
        // SINIT sets HSEED=$A55A ONCE at cabinet initialization. START and
        // PLSTRT do not reseed. On a paid start, preserve the live attract-mode
        // SEED/HSEED/LSEED and its existing SMAP star records. This browser has
        // separate RAM objects for attract and play, so the host explicitly
        // transfers that original shared-RAM state across the adapter boundary.
        // The legacy isolated harness RESET() retains its deterministic fixture.
        if (sourceRandomState !== null) {
            const { seed, hseed, lseed, starMap } = sourceRandomState;
            const count = pos('SMEND') - pos('SMAP');
            if (![seed, hseed, lseed].every(v => Number.isInteger(v) && v >= 0 && v <= 255)
                || !(starMap instanceof Uint8Array) || starMap.length !== count)
                throw new TypeError('RESET requires source SEED/HSEED/LSEED and SMAP bytes');
            write8('SEED', seed);
            write8('HSEED', hseed);
            write8('LSEED', lseed);
            for (let i = 0; i < count; i++) ram.write8(pos('SMAP') + i, starMap[i]);
            write8('STRCNT', 16);
        } else {
            write16('HSEED', 0xa55a);
            random.STINIT();
        }
        // AMODE1.COPYRT stores the Williams-logo pen end (CUREND) in WCURS on
        // a genuine board; the LGOTAB pen ends at $6245. SBLNK's anti-tamper
        // RAM "bomb" only fires when WCURS holds anything else.
        write16('WCURS', 0x6245);
        thrust.THINIT();
        // Direct test inputs, not an assertion about original PLSTRT values.
        write16('PLADIR', 0x0300);
        write16('NPLAD', 0x0300);
        write16('PLAX16', 0x2000);
        write16('PLAY16', 0x8500);
        write8('NPLAXC', 0x20);
        write8('NPLAYC', 0x85);
        write8('PLAXC', 0x20);
        write8('PLAYC', 0x85);
        write8('STATUS', 0);
        // Raster boundary is a diagnostic hardware value, not game control logic.
        write8('XXX1', 0xff);
        // Fixture sets POUT as initial drawing after selected source RAM inputs.
        // Full original SINIT/IRQ is not yet ported.
        playerVideo.POUT();
        playerVideo.THOUT();
        // START (DEFA7 1138-1150) initialises the player's first-wave data via
        // GETWV; PLRES ASTSX/ELS1/ELS2 copies those exact BLK71 WVTAB values
        // into live ELIST and clears ECNTS. No invented spawn parameters.
        // P1WAV is zero in blank RAM before GETWV increments it to wave one.
        write16('PLRX', pos('P1SCR'));
        if (restored) {
            for (let i = 0; i < restored.length; i++)
                ram.write8(pos('P1SCR') + i, restored[i]);
        }
        else
            waveParameters.GETWV(pos('P1SCR'));
        // DEFA7.START (lines 1151-1155) copies CMOS REPLAY into REPLA and
        // P1RP and clears P1RP+2. The original ROMC8.DEFALT lines 800-801
        // contain packed BCD $0100: one free ship at 10,000 points and then
        // increments of 10,000. Stage 43 left REPLA at zero, inadvertently
        // disabling SCORE.SCRX/RPSND. This is the documented DEFAULT operator
        // setting, not a host-invented extra-ship threshold. With restored
        // player data, preserve P1RP; REPLA is global cabinet configuration.
        const tenThousands = Math.floor(configuredReplay / 10000);
        const thousands = Math.floor((configuredReplay % 10000) / 1000);
        // Packed BCD REPLAY: ROMC8 default $0100 means 10,000 points.
        const replayBcd = ((Math.floor(tenThousands / 10) << 12) | ((tenThousands % 10) << 8) | (thousands << 4)) & 0xffff;
        write16('REPLA', replayBcd);
        if (!restored) {
            write16('P1RP', replayBcd);
            ram.write8(pos('P1RP') + 2, 0);
        }
        // Source PLSTRT initialises TPTR to TLIST; PLRES reads PTARG from the
        // selected player-data record. Initial PTARG=10 comes from the original
        // level-one setup, which is not yet translated in this harness.
        write16('TPTR', pos('TLIST'));
        if (!restored) {
            // Original START reads the operator NSHIP setting (default 3) and
            // writes it to both P1LAS and P1SBC before GETWV/PLSTRT.
            ram.write8(pos('P1TRG'), 10);
            write8('P1LAS', configuredShips);
            write8('P1SBC', configuredShips);
        }
        // Original PLSTR3 sources the wall colour from WCTAB[wave modulo 8].
        write8('PCRAM', read8('PCRAM'));
        ram.write8(pos('PCRAM') + 5, WCTAB[(read8('P1WAV') - 1) & 7]);
        // Original PLSTR3 consumes one ship on initial entry and every respawn.
        // The source GEXEC wave bridge adds it back before a normal wave transition.
        write8('P1LAS', (read8('P1LAS') - 1) & 255);
        hud.TDISP();
        procs.MKPROC(WAVE_ADDR.COLR, pos('STYPE'));
        // Original PLSTRT starts THPROC, CBOMB, TIECOL as distinct NAP tasks.
        procs.MKPROC(WAVE_ADDR.THPROC, pos('STYPE'));
        procs.MKPROC(WAVE_ADDR.CBOMB, pos('STYPE'));
        procs.MKPROC(WAVE_ADDR.TIECOL, pos('STYPE'));
        const humanStart = astronautStart.PLRES_ASTROS(ram.read8(pos('P1TRG')));
        astronautProcess = humanStart.astronautProcess;
        // DEFA7 STCHK/STCHKA after PLRES: STATUS bit 1 is the no-terrain
        // state, recomputed from current ASTCNT after each wave transition.
        write8('STATUS', read8('ASTCNT') ? 0 : 2);
        astronautStart.PLRES_ENEMIES();
        fireTables.FBINIT();
        laser.FISS(random.RAND);
        // An initial GEXEC process runs the same source sequence as subsequent
        // scheduled 15-tick wakeups. No hand-placed UFO coordinates are supplied.
        // PLSTRT creates SCPROC as an original linked scheduler process. The
        // scan processes now own ISCAN/OSCAN and shell retirement cadence.
        procs.MKPROC(WAVE_ADDR.SCPROC, pos('STYPE'));
        const wproc = procs.MKPROC(WAVE_ADDR.GEX0, pos('STYPE'));
        ram.write16(pos('CRPROC'), wproc);
        resumeSource(wave.GEXEC());
        // Never inject a swarmer into the normal opening wave. Swarmers originate
        // from source probe destruction (PRBKIL -> MMSW), still untranslated.
        // Only the opt-in isolated legacy MSWM test creates the former fixture.
        if (diagnosticSwarmer) {
            write8('SWCNT', 1);
            const sw = seedEnemy('SWPIC1', (read16('BGL') + 0x1200) & 65535, 127, 0xffe8, 0x0018, WAVE_ADDR.MSWM);
            const swU = ram.read16(sw + pos('OBJID'));
            ram.write8(swU + pos('PD2'), 0x18);
            ram.write8(swU + pos('PD4'), 60);
        }
        objectVideo.OPROC(0xef2a);
        // The Stage 15 test objects are already on the source OPTR list, but
        // SCNR had previously been callable only from the manual test button.
        // Draw original terrain/blips immediately so first presented frame is valid.
        lastScannerState = scanner.SCNR();
    }
    function INPUT({ thrust = false, up = false, down = false, reverse = false, smartBomb = false, fire = false, hyperspace = false } = {}) {
        const pia2 = (fire ? 0x01 : 0) | (thrust ? 0x02 : 0) | (smartBomb ? 0x04 : 0) |
            (hyperspace ? 0x08 : 0) | (reverse ? 0x40 : 0) | (down ? 0x80 : 0);
        const pia3 = up ? 0x01 : 0;
        if (sourceCabinetInput) {
            ram.write8(0xcc04, pia2);
            ram.write8(0xcc06, pia3);
        }
        else {
            // Retain the earlier diagnostic direct-input contract for test workbenches.
            write8('PIA21', pia2);
            write8('PIA31', pia3);
        }
    }
    function IRQ_PAIR() {
        // Diagnostic hardware stimulus only: these two VERTCT samples cross the
        // original upper/lower scanline branch boundary. All game-visible work
        // comes from the original IRQ call sequence and original named routines.
        ram.write8(0xc800, 0x90);
        irq.IRQ();
        ram.write8(0xc800, 0x08);
        irq.IRQ();
        return { timer: read8('TIMER'), iflg: read8('IFLG'), mapcr: read8('MAPCR') };
    }
    function STEP() {
        if (gameOver)
            return { gameOver: true };
        if (transitionTicks) {
            // The original BONUS NAP 4,BC1 awards are processed one at a time;
            // GETWV and NAP $80,BC3 occur only after the last survivor. Player
            // death's separate $60 respawn pause retains its original adapter.
            if (bonus.STATE()) {
                const complete = bonus.ADVANCE();
                transitionTicks = bonus.STATE().remainingTicks;
                if (!complete)
                    return { timer: read8('TIMER'), iflg: read8('IFLG'), mapcr: read8('MAPCR') };
            }
            else
                transitionTicks--;
            if (!transitionTicks && transitionScheduled) {
                transitionScheduled = false;
                const playerData = ram.snapshot(pos('P1SCR'), pos('P2SCR'));
                const savedCount = waveCompleted;
                const preservedRandom = RANDOM_STATE();
                RESET(playerData, preservedRandom);
                waveCompleted = savedCount;
                return { timer: read8('TIMER'), iflg: read8('IFLG'), mapcr: read8('MAPCR') };
            }
            return { timer: read8('TIMER'), iflg: read8('IFLG'), mapcr: read8('MAPCR') };
        }
        const irqState = IRQ_PAIR();
        // Execute original player collision path (COLCHK scans OPTR, then SPTR).
        waveTicks++;
        // SBLNK runs from STOUT's fall-through on every IRQ star output.
        if (sourceCabinetInput) {
            // Original EXEC/EXEC1: reset TIMER, bound overloaded object rendering,
            // run COLCHK → XUVCT → RAND → SWP → DISP. Unlike the former host ordering,
            // collisions are checked BEFORE process dispatch. XUVCT is the same
            // translated source EXPU, not a substitute renderer.
            const next = executive.EXEC();
            if (next.kind === 'await-original-timer')
                throw new Error('IRQ did not advance original TIMER before EXEC');
            resumeSource(next);
        }
        else {
            // Compatibility path for existing isolated diagnostic fixture tests.
            resumeSource(procs.DISP());
            if (playerCollisions && !playerDeathActive && !(read8('STATUS') & 0x18) && collision.COLCHK())
                schedulePlayerDeath();
            explosionUpdate.EXPU();
        }
        // SCPROC/SCP1/SCP2 already schedule SCNRV every eight process ticks.
        // Do NOT redraw here: duplicate rendering once per host frame would bypass
        // the source 2+2+4 scan-phase timing and erase transient framebuffer pixels.
        return irqState;
    }
    function STATE() {
        return Object.freeze({
            x: read8('NPLAXC'), y: read8('NPLAYC'), plax16: read16('PLAX16'), play16: read16('PLAY16'),
            bgl: read16('BGL'), bglx: read16('BGLX'), terrainBglx: terrain.terrainBank.read16(BLK71_ADDR.BGLX), bgdelt: s16(read16('BGDELT')),
            vx: s16(read16('PLAXV')), vxFraction: ram.read8(pos('PLAXV') + 2), vy: s16(read16('PLAYV')),
            worldX: read16('PLABX'), direction: read16('PLADIR'), starCount: read8('STRCNT'),
            status: read8('STATUS'), seed: read8('SEED'),
            sndpri: read8('SNDPRI'), sndtmr: read8('SNDTMR'), sndrep: read8('SNDREP'),
            scannerObjects: lastScannerState?.objects ?? 0, scannerRedraws, sourceCabinetInput, wave: WAVE_STATE(),
            smartBombs: infiniteSmartBombs ? Infinity : ram.read8(read16('PLRX') + pos('PSBC')),
            storedSmartBombs: ram.read8(read16('PLRX') + pos('PSBC')), infiniteSmartBombs,
            smartBombActive: read8('SBFLG'), reverseActive: read8('REVFLG'),
            scoreBCD: Array.from(ram.snapshot(pos('P1SCR'), pos('P1SCR') + 4)), scoreRequests: [...scoreRequests],
            soundBus: soundBus.slice(-8),
            laserHits, scoreHits, wavesCompleted: waveCompleted, levelTransition: transitionTicks,
            playerDeaths, playerDeathActive, playerExplosion: playerExplosion.STATE(), gameOver, shipsInReserve: read8('P1LAS'),
            hyperspaceActive: !!(read8('STATUS') & 0x40) && !playerDeathActive,
            hyperspaces, laserShots, bonus: bonus.STATE(),
        });
    }
    function FIRE() {
        if (gameOver || playerDeathActive || (read8('STATUS') & 0x40))
            return false;
        // The original LFIRE caps simultaneous shots at four. Prevent a browser
        // input burst from exhausting the finite normal process pool before the
        // source LFIRE continuations have had their first dispatch.
        const pending = read8('LFLG');
        if (pending >= 4)
            return false;
        const result = laser.FIRE();
        if (result)
            laserShots++;
        return !!result;
    }
    function REVERSE() {
        // SWITCH normally creates REV as a linked process on a fresh press.
        if (gameOver || playerDeathActive || read8('REVFLG'))
            return false;
        procs.MKPROC(WAVE_ADDR.REV, pos('STYPE'));
        return true;
    }
    function HYPERSPACE() {
        if (gameOver || playerDeathActive || (read8('STATUS') & 0xfd) || transitionTicks)
            return false;
        procs.MKPROC(WAVE_ADDR.HYPER, pos('STYPE'));
        hyperspaces++;
        return true;
    }
    function SMART_BOMB() {
        // Source SBFLG prevents concurrent smart bombs, PSBC is tested by SBOMB.
        if (gameOver || playerDeathActive || read8('SBFLG') || (!infiniteSmartBombs && !ram.read8(read16('PLRX') + pos('PSBC'))))
            return false;
        procs.MKPROC(WAVE_ADDR.SBOMB, pos('STYPE'));
        return true;
    }
    function TEST_SCANNER() {
        // Invoke the original SCNR/MT1 code WITH exact MTERR table bytes.
        return lastScannerState = scanner.SCNR();
    }
    function TEST_OFSHIT() {
        if (!demoObject)
            TEST_OPROC();
        bankObjects.OFSHIT(demoObject);
        return ram.read16(demoObject + Layout.at('OBJX'));
    }
    function TEST_TERRAIN() {
        // Explicit original BGOUT entry point for terrain framebuffer inspection.
        terrain.BGOUT();
        return terrain.terrainBank.read16(BLK71_ADDR.BGLX);
    }
    /** Explicit diagnostic object, drawn only via original OPROC -> ON86. */
    function TEST_OPROC() {
        const at = n => Layout.at(n);
        if (!demoObject) {
            demoObject = procs.GETOB();
            ram.write16(demoObject + at('OLINK'), ram.read16(at('OPTR')));
            ram.write16(at('OPTR'), demoObject);
            ram.write16(demoObject + at('OPICT'), DEMO_PICTURE);
            ram.write8(demoObject + at('OY16'), 0xa0);
            ram.write16(demoObject + at('OX16'), (read16('BGL') + 0x1800) & 0xffff);
        }
        else {
            ram.write16(demoObject + at('OX16'), (ram.read16(demoObject + at('OX16')) + 0x80) & 0xffff);
        }
        objectVideo.OPROC(0xef2a);
        return ram.read16(demoObject + at('OBJX'));
    }
    /** Generate actual FBTAB with source RAND, then pass it through source SHELL/FBOUT. */
    function TEST_FBOUT() {
        const at = n => Layout.at(n);
        fireTables.FBINIT();
        laser.FISS(random.RAND);
        if (!demoShell) {
            demoShell = procs.GETOB();
            ram.write16(demoShell + at('OLINK'), ram.read16(at('SPTR')));
            ram.write16(at('SPTR'), demoShell);
            ram.write16(demoShell + at('OBJCOL'), DEMO_SHELL_OUT);
            ram.write16(demoShell + at('OX16'), 0x6600);
            ram.write16(demoShell + at('OY16'), 0xa400);
            ram.write16(demoShell + at('OXV'), 0);
            ram.write16(demoShell + at('OYV'), 0x0100);
        }
        sourceShells.SHELL();
        return ram.read16(demoShell + at('OBJX'));
    }
    function TEST_SCORE() {
        return scoring.SCORE(0, 0x10); /* 10 points: harness input, not gameplay */
    }
    /** Snapshot shared original random/star RAM across this browser's
     * separate presentation and play memories. The source cabinet's START
     * does not call SINIT and therefore does not restart its random sequence. */
    function RANDOM_STATE() {
        return {
            seed: read8('SEED'), hseed: read8('HSEED'), lseed: read8('LSEED'),
            starMap: ram.snapshot(pos('SMAP'), pos('SMEND'))
        };
    }
    function TRIGGER_SOUND(label) {
        if (!Object.hasOwn(soundTables.labels, label))
            throw new Error('Unknown original sound table: ' + label);
        return sound.SNDLD(soundTables.labels[label]);
    }
    function SET_SOUND_PIA_SINK(handler) {
        if (handler !== null && typeof handler !== 'function')
            throw new TypeError('Sound PIA sink must be a function');
        soundPIASink = handler;
    }
    RESET();
    /** Read-only GETALT lookup (DEFB6 GETALT: ALTTBL + OX16>>6) for host observers such as the attract pilot. */
    const ALTITUDE = x16 => terrain.terrainBank.read8(BLK71_ADDR.ALTTBL + ((x16 & 0xffff) >>> 6));
    return Object.freeze({ SET_SOUND_PIA_SINK, CONFIGURE_OPERATOR, ALTITUDE, ram, video, Layout, procs, player, random, stars, thrust, scanning, playerVideo, topDisplay, romf8, scoreDisplay, hud, scoring, switches, sound, scanner, scanTasks, terrain, irq, startup, bankObjects, IRQ_PAIR, objectVideo, appearance, laser, collision, points, terrBlow, tie, probe, KILL_BY_VECTOR, FIRE, REVERSE, SMART_BOMB, HYPERSPACE, bonus, reverse, smartBomb, hyperspace, activeScreenClear, sourceShells, fireTables, target, astronaut, astronautStart, explosionStart, explosionUpdate, mutantStart, waveLander, TEST_OPROC, TEST_OFSHIT, TEST_FBOUT, TEST_SCANNER, TEST_TERRAIN, TEST_SCORE, TRIGGER_SOUND, RANDOM_STATE, RESET, INPUT, STEP, STATE, ENEMY_STATE, ASTRONAUT_STATE, WAVE_STATE, playerDeath, playerExplosion, schedulePlayerDeath, executive, sourceSwitchTable });
}
