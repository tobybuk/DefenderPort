/**
 * Browser keyboard adapter — not a transliteration of cabinet inputs.
 *
 * Keep this separate from DEFA7.SSCAN/SWP: physical browser keys are mapped
 * into the existing *logical* switch names used by the source input adapter.
 * Use KeyboardEvent.code, not .key, so Right Shift is distinct from Left Shift,
 * and the mapping does not change because Shift happens to be held.
 */
export const CONTROL_ACTIONS = Object.freeze([
    ['up', 'Up', 'ArrowUp'],
    ['down', 'Down', 'ArrowDown'],
    ['thrust', 'Thrust', 'Space'],
    ['reverse', 'Reverse', 'KeyR'],
    ['smartBomb', 'Smart Bomb', 'KeyS'],
    ['hyperspace', 'Hyperspace', 'KeyH'],
    ['fire', 'Fire', 'KeyF']
]);

export const DEFAULT_CONTROL_BINDINGS = Object.freeze({
    up: 'KeyA',
    down: 'KeyZ',
    thrust: 'ShiftRight',
    reverse: 'Space',
    smartBomb: 'Tab',
    hyperspace: 'KeyH',
    fire: 'Enter' // Stage 55: user's requested default.
});

export const CONTROL_STORAGE_KEY = 'williams-defender-red-label-controls-v2';

export function isBindableCode(code) {
    // Escape is reserved to cancel key selection. Enter and NumpadEnter
    // are accepted specifically for FIRE by validateBindings/assignControl.
    // They still start the game on the attract screen.
    return typeof code === 'string' &&
        /^(?:Key[A-Z]|Digit[0-9]|Numpad[0-9]|Arrow(?:Up|Down|Left|Right)|Shift(?:Left|Right)|Enter|NumpadEnter|Space|Tab|Backspace|CapsLock|Slash|Backslash|Semicolon|Quote|Comma|Period|Minus|Equal|BracketLeft|BracketRight|Backquote)$/.test(code);
}

export function validateBindings(bindings) {
    if (!bindings || typeof bindings !== 'object') return false;
    const codes = CONTROL_ACTIONS.map(([action]) => bindings[action]);
    // Enter confirms Hall of Fame initials and starts from the title screen.
    // Restrict Enter to FIRE so those original control semantics cannot be
    // silently changed by assigning Enter to a different gameplay action.
    const enterCodes = new Set(['Enter', 'NumpadEnter']);
    return codes.every(isBindableCode) && new Set(codes).size === codes.length &&
        CONTROL_ACTIONS.every(([action]) => action === 'fire' || !enterCodes.has(bindings[action]));
}

export function loadControlBindings(storage) {
    try {
        const saved = JSON.parse(storage?.getItem(CONTROL_STORAGE_KEY));
        if (validateBindings(saved)) return { ...saved };
    } catch { /* local files/private modes may not support storage */ }
    return { ...DEFAULT_CONTROL_BINDINGS };
}

export function saveControlBindings(storage, bindings) {
    if (!validateBindings(bindings)) throw new TypeError('Invalid or duplicate keyboard assignments');
    try {
        storage?.setItem(CONTROL_STORAGE_KEY, JSON.stringify(bindings));
        return !!storage;
    } catch { return false; }
}

export function assignControl(bindings, action, code) {
    if (!CONTROL_ACTIONS.some(([key]) => key === action))
        throw new RangeError('Unknown control: ' + action);
    if (!isBindableCode(code)) throw new RangeError('That key is reserved or unsupported');
    if ((code === 'Enter' || code === 'NumpadEnter') && action !== 'fire')
        throw new RangeError('Enter can only be assigned to Fire');
    const existing = CONTROL_ACTIONS.find(([key]) => key !== action && bindings[key] === code);
    if (existing) throw new RangeError('Already assigned to ' + existing[1]);
    return { ...bindings, [action]: code };
}

export function logicalKeyForCode(code, bindings) {
    const found = CONTROL_ACTIONS.find(([action]) => bindings[action] === code);
    return found?.[2] ?? null;
}

export function displayKeyName(code) {
    const names = {
        ShiftRight: 'RIGHT SHIFT', ShiftLeft: 'LEFT SHIFT', Enter: 'ENTER',
        NumpadEnter: 'NUMPAD ENTER', Space: 'SPACE', Tab: 'TAB',
        ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
        Backspace: 'BACKSPACE', CapsLock: 'CAPS LOCK'
    };
    if (names[code]) return names[code];
    if (/^Key[A-Z]$/.test(code)) return code.slice(3);
    if (/^Digit[0-9]$/.test(code)) return code.slice(5);
    if (/^Numpad[0-9]$/.test(code)) return 'NUM ' + code.slice(6);
    return code.replace(/([a-z])([A-Z])/g, '$1 $2').toUpperCase();
}
