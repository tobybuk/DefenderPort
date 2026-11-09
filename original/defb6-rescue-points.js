/** Direct P250/P500/P5000/P503 source translation (DEFB6.SRC 495-528).
 * The source renders an ephemeral score bitmap in the original object list,
 * awards packed-BCD points, and retires that object after 50 ticks.
 */
import { u8, u16 } from '../runtime/integers.js';
export function createDefb6RescuePointsRoutines(RAM, L, procs, { addresses, SCORE, KILOFF } = {}) {
    const a = n => L.at(n), r = n => RAM.read8(a(n)), rw = n => RAM.read16(a(n));
    const b = (X, n) => RAM.read8(u16(X + a(n))), d = (X, n) => RAM.read16(u16(X + a(n)));
    const wd = (X, n, v) => RAM.write16(u16(X + a(n)), v), wb = (X, n, v) => RAM.write8(u16(X + a(n)), v);
    const current = () => rw('CRPROC');
    function make(label, pts) {
        const U = current(), Y = d(U, 'PD');
        if (!Y)
            throw Error(label + ' original missing astronaut PD');
        const X = procs.OBINIT(U, { OPICT: addresses[label === 'P250' ? 'C25P1' : 'C5P1'], OCVECT: addresses.NOKILL, OBJCOL: 0 });
        SCORE(1, pts);
        wd(X, 'OXV', rw('PLAXV'));
        wd(X, 'OYV', 0);
        wb(X, 'OTYP', 0x11);
        wd(X, 'OX16', d(Y, 'OX16'));
        const height = d(Y, 'OY16');
        wd(X, 'OY16', u16(height + (height & 0x8000 ? -0x2000 : 0x1800)));
        RAM.write16(a('OPTR'), X);
        wd(U, 'PD', X);
        return procs.SLEEP(50, addresses.P503);
    }
    function P250() {
        return make('P250', 0x25);
    }
    function P500() {
        return make('P500', 0x50);
    }
    function P503() {
        KILOFF(d(current(), 'PD'));
        return procs.SUCIDE();
    }
    return Object.freeze({ P250, P500, P503 });
}
