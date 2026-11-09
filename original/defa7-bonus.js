/**
 * DEFA7.SRC BONUS/BON1/BCLP/BCLPA/BC1/BC2/BC3, lines 1785-1844.
 * Native JS sequence at browser IRQ-tick granularity. This module preserves
 * source message labels, FDB glyphs, video positions and the four-tick award
 * cadence followed by the original $80-tick inter-wave pause. The original
 * program uses NAP processes; the host's transitional tick adapter invokes
 * BC1/BC3 without allowing the removed wave's other processes to execute.
 *
 * The message words come from MESS0.SRC: ATW, COMP and BONUSX. Rendering
 * delegates only to the translated ROMF8 CWRIT function and source glyphs.
 * No HTML/Canvas lettering is drawn over the framebuffer.
 */
export function createDefa7BonusRoutines(RAM, Layout, dependencies = {}) {
    const { CWRIT, SCLR1, SCORE, GETWV, numeralBase } = dependencies;
    const sourceGlyphs = () => dependencies.sourceGlyphs;
    const at = name => Layout.at(name);
    const get = n => RAM.read8(at(n));
    const requireFn = (name, fn) => {
        if (typeof fn !== 'function')
            throw new Error('BONUS requires original ' + name);
        return fn;
    };
    const draw = requireFn('CWRIT', CWRIT), clear = requireFn('SCLR1', SCLR1);
    const score = requireFn('SCORE', SCORE), nextWave = requireFn('GETWV', GETWV);
    let state = null;
    function glyph(letter) {
        if (letter === ' ')
            return null;
        if (letter >= '0' && letter <= '9')
            return numeralBase + (letter.charCodeAt(0) - 48) * 4;
        const desc = sourceGlyphs()?.descriptors?.[letter];
        if (!Number.isInteger(desc))
            throw Error('Untranslated MESS0 letter: ' + letter);
        return desc;
    }
    function writeText(label, address) {
        let x = address >>> 8;
        const y = address & 255;
        for (const letter of label) {
            const descriptor = glyph(letter);
            let width = 1; // MESS0 CHRTBL SPACE descriptor is 1 column
            if (descriptor !== null) {
                width = RAM.read8(descriptor);
                draw(((x & 255) << 8) | y, descriptor);
            }
            x += width + 1; // MESS0 TEXT7B: ADDA glyph-width; ADDA CHARSP (default 1)
        }
        // MESS0 word strings terminate in '/'. TEXT3 writes that terminator
        // as a SPACE glyph (width 1) then adds source CHARSP (default 1),
        // including for the final word before the original WNBV call.
        x += 2;
        return (x << 8) | y;
    }
    /** WNBV: render the byte converted by original HEXBCD as two digits. */
    function writeNumber(value, address) {
        // HEXBCD converts the source 8-bit wave/bonus value into display BCD.
        // The original two-digit numeral renderer cannot display a third digit.
        const n = value % 100;
        const bcd = ((Math.trunc(n / 10) << 4) | (n % 10)) & 255;
        const chars = n < 10 ? String(n) : String(bcd >>> 4) + String(bcd & 15);
        return writeText(chars, address);
    }
    function remaining() {
        if (!state)
            return 0;
        return (state.awardsLeft + (state.phase === 'awards' ? 1 : 0)) * 4 + state.waitTicks;
    }
    function BONUS() {
        if (state)
            throw Error('Source BONUS is already active');
        RAM.write8(at('PCRAM'), 0);
        clear();
        const wave = RAM.read8(RAM.read16(at('PLRX')) + at('PWAV'));
        const multiplier = Math.min(wave, 5), survivors = get('ASTCNT');
        // MESS calls: MESS(ATWV,$3850), WNBV(wave), MESS(COMPV,$3D60),
        // MESS(BONSX,$3C90), WNBV(min(wave,5)). Literal words are from MESS0.
        const cursor = writeText('ATTACK WAVE', 0x3850);
        writeNumber(wave, cursor);
        writeText('COMPLETED', 0x3d60);
        const bonusCursor = writeText('BONUS X', 0x3c90);
        writeNumber(multiplier, bonusCursor);
        state = { wave, multiplier, survivors, awardsLeft: survivors, awards: 0,
            cursor: 0x3ca0, waitTicks: 0, phase: survivors ? 'awards' : 'hold', awardTick: 0, done: false };
        if (survivors)
            BCLP();
        else
            BC2();
        return STATE();
    }
    /** BCLP: draw ASTP3 and SCORE A=1 B=multiplier*16 BCD. */
    function BCLP() {
        if (!state || state.phase !== 'awards')
            throw Error('BCLP called outside bonus tally');
        draw(state.cursor, sourceGlyphs().ASTP3);
        // Source LDB PWAV capped at 5; ASLB four times; LDA #$01.
        score(1, state.multiplier << 4);
        state.awards++;
        state.awardsLeft--;
        state.cursor = (state.cursor + 0x0400) & 0xffff;
        state.awardTick = 4; // NAP 4,BC1
        return STATE();
    }
    /** BC1 is awakened only after exactly four source update ticks. */
    function BC1() {
        if (!state || state.phase !== 'awards')
            throw Error('BC1 called outside bonus tally');
        if (state.awardsLeft)
            BCLP();
        else
            BC2();
        return STATE();
    }
    /** BC2 obtains new wave data only after the LAST survivor's 4 ticks. */
    function BC2() {
        if (!state)
            throw Error('BC2 without BONUS');
        nextWave(RAM.read16(at('PLRX')));
        state.phase = 'hold';
        state.waitTicks = 128;
        state.awardTick = 0; // NAP $80,BC3
        return STATE();
    }
    function BC3() {
        if (!state || state.phase !== 'hold')
            throw Error('BC3 without BC2');
        state.phase = 'complete';
        state.done = true;
        return STATE();
    }
    function ADVANCE() {
        if (!state)
            return false;
        if (state.phase === 'awards') {
            if (--state.awardTick === 0)
                BC1();
        }
        else if (state.phase === 'hold') {
            if (--state.waitTicks === 0)
                BC3();
        }
        return !!state.done;
    }
    function RESET() {
        state = null;
    }
    function STATE() {
        return state ? Object.freeze({ ...state, remainingTicks: remaining() }) : null;
    }
    return Object.freeze({ BONUS, BCLP, BC1, BC2, BC3, ADVANCE, STATE, RESET });
}
