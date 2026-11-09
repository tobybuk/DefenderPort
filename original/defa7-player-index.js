/**
 * Original `PLINDX`, `PLND1`, `PLINX`, `PLDX` (pinned DEFA7.SRC).
 * Source immediately follows BORDER and precedes RAND.
 * Both original public entry points return X pointing at the currently
 * selected player's original PHR6 RAM record.
 * The original 6809 `DECA / BEQ` selects player 1 only if CURPLR==1.
 */
import { u8 } from '../runtime/integers.js';
export function createDefa7PlayerIndexRoutines(RAM, Layout) {
    /** Original shared internal label PLND1, with PLINX return. */
    function PLND1() {
        let A = RAM.read8(Layout.at('CURPLR'));
        let X = Layout.at('PLDATA');
        A = u8(A - 1);
        if (A !== 0)
            X = Layout.at('P2SCR');
        return X;
    }
    /** Original PLINDX (A saved/restored by PSHS/PULS; returns X). */
    function PLINDX() {
        return PLND1();
    }
    /** Original PLDX branches to PLND1; returns same player X. */
    function PLDX() {
        return PLND1();
    }
    return Object.freeze({ PLINDX, PLDX });
}
