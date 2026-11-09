/** REV / REV1 / REV2 / REVX1 from pinned src/defa7.src L3155–3169.
 * One original process resumes across two original SLEEP continuations.
 * These are 1:1 source names; there is no synthetic cooldown timer.
 */
import { u16 } from '../runtime/integers.js';
export function createDefa7ReverseRoutines(RAM, Layout, processes, continuationAddresses) {
    const a = n => Layout.at(n), read = n => RAM.read8(a(n)), write = (n, v) => RAM.write8(a(n), v);
    const sleep = (ticks, label) => processes.SLEEP(ticks, continuationAddresses[label]);
    function REV() {
        if (read('REVFLG'))
            return processes.SUCIDE();
        write('REVFLG', 1);
        RAM.write16(a('NPLAD'), u16(-RAM.read16(a('PLADIR'))));
        return REV1();
    }
    function REV1() {
        return sleep(2, 'REV2');
    }
    function REV2() {
        return (read('PIA21') & 0x40) ? REV1() : sleep(5, 'REVX1');
    }
    function REVX1() {
        write('REVFLG', 0);
        return processes.SUCIDE();
    }
    return Object.freeze({ REV, REV1, REV2, REVX1 });
}
