/**
 * AMODE1.SRC HALLOF/HALL1/HALL4/HALL6, CPXCY, HOFIN, HOFUL,
 * HOFAS/HOFMD, HOFST/HOFBL/HOFUD/HOFUD5/HOFUD9 (Red Label).
 *
 * Native JS translation of the source state changes. MESS0's original glyph
 * descriptors are rendered by the existing WTEXTB/CWRIT video writer.
 * Browser storage/physical inputs are adapters; they are not original ROM.
 * Original references:
 * https://github.com/mwenge/defender/blob/e74006344b16d19245510b5e55780f90d7606bb8/src/amode1.src#L112-L365
 * https://github.com/mwenge/defender/blob/e74006344b16d19245510b5e55780f90d7606bb8/src/mess0.src#L298-L326
 */
import { DEFAULT_HALL_OF_FAME } from './amode1-presentation-data.js';

const INITIAL_MIN = 0x40; // source pseudo ASCII space
const INITIAL_MAX = 0x5a; // Z
const INITIALS_LENGTH = 3;
const RECORD_COUNT = 8;

export function decodePackedScore(bytes) {
    if (!bytes || bytes.length < 4) throw new RangeError('P1SCR needs four bytes');
    // DEFA7.SCORE: first byte of P1SCR is the replay/counter header.
    // CPXCY compares only the three packed-BCD score bytes at +1..+3.
    let score = 0;
    for (let i = 1; i <= 3; i++) {
        const b = bytes[i];
        if ((b & 15) > 9 || (b >>> 4) > 9) throw new Error('Invalid source packed BCD score');
        score = score * 100 + (b >>> 4) * 10 + (b & 15);
    }
    return score;
}

const clone = rows => rows.map(r => ({ score: r.score, initials: r.initials }));
export function validHallRows(rows) {
    return Array.isArray(rows) && rows.length === RECORD_COUNT && rows.every(r =>
        r && Number.isInteger(r.score) && r.score >= 0 && r.score <= 999999 &&
        typeof r.initials === 'string' && /^[A-Z ]{3}$/.test(r.initials));
}
/** HOFMD shifts one source 12-nibble score-and-initials record. */
export function HOFMD(rows, oldIndex) {
    return { ...rows[oldIndex] };
}
export function hallInsert(rows, entry) {
    if (!validHallRows(rows)) throw new TypeError('Expected eight source-format Hall of Fame records');
    if (!Number.isInteger(entry.score) || entry.score < 0 || entry.score > 999999 || !/^[A-Z ]{3}$/.test(entry.initials))
        throw new RangeError('Invalid source record');
    // CPXCY: equal scores do not displace existing records (BHS rejects tie).
    const index = rows.findIndex(r => entry.score > r.score);
    if (index < 0) return clone(rows);
    const result = clone(rows);
    for (let i = RECORD_COUNT - 1; i > index; i--) {
        // AMODE1.HOFAS1 invokes HOFMD to shift each 12-nibble CMOS record.
        result[i] = HOFMD(result, i - 1);
    }
    result[index] = { ...entry };
    return result;
}

export function createAmode1HallOfFame({
    writeText,
    video,
    ram,
    paletteAddr,
    tables = { today: DEFAULT_HALL_OF_FAME, allTime: DEFAULT_HALL_OF_FAME },
    onQualify = () => {},
    onFinish = () => {}
} = {}) {
    if (typeof writeText !== 'function' || !video || !ram || !Number.isInteger(paletteAddr))
        throw new TypeError('Hall entry requires MESS0 writer, source video/RAM and PCRAM address');
    let today = validHallRows(tables.today) ? clone(tables.today) : clone(DEFAULT_HALL_OF_FAME);
    let allTime = validHallRows(tables.allTime) ? clone(tables.allTime) : clone(DEFAULT_HALL_OF_FAME);
    let score = 0, phase = 'idle', initials = [0x41, 0x40, 0x40], active = 0;
    // AMODE1.HALLOF/HALL12: process player 1 then player 2, once each.
    // The single-player browser fixture supplies P2SCR=0: it may never
    // cause a second initials prompt. Do not treat Today's and All-Time
    // qualification as two separate initials-entry operations.
    let playerScores = [0, 0];
    let player = 1;
    let lastQualifiedScore = 0;
    let entryMade = false;
    let finishNotified = false;
    let stall = 40, stallTicks = 0, blinkTicks = 0, colourOn = false;
    let inputDirection = 0, lastDelay = 55, upDownCount = 0;
    let fireOpenCount = 0, fireArmed = false, waitTicks = 0;
    let input = { up: false, down: false, fire: false };
    function copyTables() { return { today: clone(today), allTime: clone(allTime) }; }
    function setTables(next) {
        if (!validHallRows(next?.today) || !validHallRows(next?.allTime)) throw new TypeError('Hall tables must each contain eight records');
        today = clone(next.today);
        allTime = clone(next.allTime);
    }
    function CPXCY(s = score, list = today) { return s > list[RECORD_COUNT - 1].score; }
    function HOFAS(list, entry) { return hallInsert(list, entry); }
    function moveRecord(list, i) { return HOFMD(list, i); }
    function writeLine(value, address) { writeText(value, address); }
    function HALL13() {
        // Source HALL13 is a SINGLE jump to HALDIS after both players.
        // The browser receives this callback once and handles the attract
        // table timer separately. No recursive HALLOF/requalification.
        if (finishNotified) return;
        finishNotified = true;
        phase = 'finished';
        onFinish(copyTables());
    }
    function HALL12() {
        // LDY #P2SCR / INCA / CMPA #3 / LBNE HALL1.
        // P2 is checked even in a one-player cabinet game, but its cleared
        // score cannot beat the eighth-place table entry.
        if (player === 1) {
            player = 2;
            score = playerScores[1];
            if (CPXCY(score, today)) return HALL1();
        }
        if (entryMade) HALL13();
        else {
            // Original NAPP $FF,HALL13 only when ENTFLG is zero.
            phase = 'no-entry';
            waitTicks = 0xff;
        }
        return false;
    }
    function HALL1() {
        if (!CPXCY(score, today)) return HALL12();
        entryMade = true;
        lastQualifiedScore = score;
        initials = [0x41, 0x40, 0x40];
        active = 0;
        stall = 40;
        stallTicks = 0;
        blinkTicks = 0;
        colourOn = false;
        inputDirection = 0;
        lastDelay = 55;
        upDownCount = 0;
        fireOpenCount = 0;
        fireArmed = false;
        input = { up: false, down: false, fire: false };
        phase = 'entering';
        render();
        onQualify(score > today[0].score ? 0x3d : 0x3e);
        return true;
    }
    function HOFIN() {
        // AMODE1 HOFIN: BLKCLR $46AC, width $14, height $08, then INITSSV.
        for (let x = 0; x < 20; x++) {
            for (let y = 0; y < 8; y++) video.write8((((0x46 + x) & 255) << 8) | (0xac + y), 0);
        }
        const printable = initials.map(i => String.fromCharCode(i === INITIAL_MIN ? 0x20 : i));
        for (let i = 0; i < 3; i++) {
            if (printable[i] !== ' ') writeText(printable[i], ((0x46 + i * 8) << 8) | 0xac);
        }
    }
    function HOFUL() {
        // Three source underlines, at $45B7, $4DB7, $55B7, width four bytes.
        for (let i = 0; i < INITIALS_LENGTH; i++) {
            const colour = i === active ? 0x0d : 0x01;
            for (let x = 0; x < 4; x++) video.write8(((0x45 + i * 8 + x) << 8) | 0xb7, (colour << 4) | colour);
        }
    }
    function HOFBL() {
        // AMODE1 HOFBL alternates PCRAM+$D between colour 1 and zero.
        colourOn = !colourOn;
        const colour = colourOn ? ram.read8(paletteAddr + 1) : 0;
        ram.write8(paletteAddr + 0x0d, colour);
        ram.write8(0xc000 + 0x0d, colour); // browser hardware latch on raster boundary
    }
    function render() {
        video.clear();
        // AMODE1.HALL1B: light-blue text colour $85 at PCRAM+1.
        ram.write8(paletteAddr + 1, 0x85);
        ram.write8(0xc001, 0x85); // original video IRQ latches the palette
        // MESS0 HOF message: original words and line breaks. MESS0's complete
        // RLF/HMC interpreter is still partial, so positions between source
        // line breaks are kept explicit; glyphs are not recreated.
        writeLine(`PLAYER ${player}`, 0x3e38);
        writeLine('YOU HAVE QUALIFIED FOR', 0x1458);
        writeLine('THE DEFENDER HALL OF FAME', 0x1462);
        writeLine('SELECT INITIALS WITH UP DOWN STICK', 0x0e76);
        writeLine('PRESS FIRE TO ENTER INITIAL', 0x168a);
        HOFIN();
        HOFUL();
        HOFBL();
    }
    function HALLOF(nextScore, secondPlayerScore = 0) {
        // HALLOF begins a new game-over sequence exactly once. Both scores
        // are snapshotted before HALL1; initials entry cannot restart it.
        if (!Number.isInteger(nextScore) || nextScore < 0 || nextScore > 999999 ||
            !Number.isInteger(secondPlayerScore) || secondPlayerScore < 0 || secondPlayerScore > 999999)
            throw new RangeError('Source scores must be 0..999999');
        playerScores = [nextScore, secondPlayerScore];
        player = 1;
        score = nextScore;
        entryMade = false;
        finishNotified = false;
        lastQualifiedScore = 0;
        waitTicks = 0;
        return HALL1();
    }
    function HOFUD() {
        if (active >= 3) return;
        const direction = input.up ? 1 : input.down ? -1 : 0;
        if (direction === 0) { inputDirection = 0; return; }
        if (direction !== inputDirection) {
            // HOFUD9: new direction; initially wait three process sleeps.
            inputDirection = direction;
            lastDelay = 55;
            upDownCount = 3;
            return;
        }
        if (--upDownCount !== 0) return;
        // HOFUD5: original $40..$5A circular alphabet, including space.
        const before = initials[active];
        initials[active] = before + direction;
        if (initials[active] === 0x3f) initials[active] = INITIAL_MAX;
        if (initials[active] === 0x5b) initials[active] = INITIAL_MIN;
        HOFIN();
        lastDelay = (lastDelay >>> 1) + 5;
        upDownCount = lastDelay;
    }
    function HALL4() {
        if (!input.fire) {
            // The source requires at least five consecutive FIRE-open ticks.
            if (stall === 0) return HALL6();
            fireOpenCount = Math.min(5, fireOpenCount + 1);
            if (fireOpenCount >= 5) fireArmed = true;
            return;
        }
        fireOpenCount = 0;
        if (!fireArmed) return;
        fireArmed = false;
        active++;
        stall = 20;
        stallTicks = 0;
        HOFUL();
        if (active >= 3) HALL6();
    }
    function HOFST() {
        if (++stallTicks >= 60) {
            stallTicks = 0;
            stall = Math.max(0, stall - 1);
        }
    }
    function HALL6() {
        if (phase !== 'entering') return;
        const entry = { score, initials: initials.map(c => String.fromCharCode(c === 0x40 ? 0x20 : c)).join('') };
        today = HOFAS(today, entry);
        if (CPXCY(score, allTime)) allTime = HOFAS(allTime, entry);
        HALL12();
    }
    function STEP(nextInput = input) {
        input = { up: !!nextInput.up, down: !!nextInput.down, fire: !!nextInput.fire };
        if (phase === 'no-entry') {
            if (--waitTicks <= 0) HALL13();
            return STATE();
        }
        if (phase !== 'entering') return STATE();
        HOFST();
        HOFUD();
        HALL4();
        if (phase !== 'entering') return STATE();
        if (++blinkTicks >= 15) { blinkTicks = 0; HOFBL(); }
        return STATE();
    }
    function STATE() {
        return Object.freeze({ score, lastQualifiedScore, player, playerScores: [...playerScores], entryMade, finishNotified, phase, active, stall, initials: initials.map(c => c === 0x40 ? ' ' : String.fromCharCode(c)).join(''), today: clone(today), allTime: clone(allTime), colourOn, fireArmed });
    }
    return Object.freeze({ HALLOF, HALL1, HALL12, HALL13, CPXCY, HOFAS, HOFMD: moveRecord, HOFIN, HOFUL, HOFBL, HOFUD, HOFST, HALL4, HALL6, STEP, STATE, setTables, copyTables });
}
