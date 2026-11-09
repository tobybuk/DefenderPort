/**
 * Attract-specific part of DEFA7.SRC MKPROC/SLEEP/DISP/DISP1/DISP2.
 *
 * This is NOT a CPU emulator or a substitute for source routines. It gives the
 * AMODE1 title tasks original PTIME/PADDR-like wake-up semantics without
 * tying their execution to presentation-frame counters. A newly linked
 * process is placed immediately after the current process (MKP1), with
 * PTIME=1. SLEEPP sets PTIME and continuation; DISP1 decrements the byte and
 * executes the continuation when it becomes zero. A process created while
 * dispatching can therefore run in that same executive pass.
 *
 * Scope: the AMODE1 title processes only, not the full cabinet EXEC/IRQ or
 * active-process pool. The video update and remaining attract processes have
 * their own documented translation boundaries.
 */
export function createAttractProcessDispatcher(handlers) {
    const tasks = [];
    let current = null;
    let tickCount = 0;
    let nextId = 1;
    function spawn(entry) {
        if (typeof handlers[entry] !== 'function')
            throw new Error('Untranslated attract continuation: ' + entry);
        const p = { id: nextId++, entry, ptime: 1 };
        const after = current === null ? tasks.length : tasks.indexOf(current) + 1;
        tasks.splice(after, 0, p);
        return p;
    }
    function sleep(ticks, entry) {
        if (!current)
            throw Error('SLEEP outside process');
        if (!Number.isInteger(ticks) || ticks < 1 || ticks > 255)
            throw RangeError('PTIME byte out of range');
        if (typeof handlers[entry] !== 'function')
            throw new Error('Untranslated attract continuation: ' + entry);
        current.ptime = ticks;
        current.entry = entry;
    }
    function suicide() {
        if (!current)
            throw Error('SUICIDE outside process');
        current.dead = true;
    }
    function dispatch() {
        tickCount++;
        let i = 0, executed = 0;
        while (i < tasks.length) {
            if (++executed > 1000)
                throw Error('Attract process dispatch did not terminate');
            const p = tasks[i];
            p.ptime = (p.ptime - 1) & 255;
            if (p.ptime !== 0) {
                i++;
                continue;
            }
            current = p;
            // A continuation must sleep or suicide. Keeping PTIME=0 would cause
            // 6809 DISP1 to wrap to $FF rather than retry it next tick.
            handlers[p.entry]({ spawn, sleep, suicide, tick: tickCount });
            current = null;
            if (p.dead) {
                tasks.splice(i, 1);
                continue;
            }
            if (p.ptime === 0)
                throw Error('Attract continuation ' + p.entry + ' omitted SLEEP/SUICIDE');
            i = tasks.indexOf(p) + 1;
        }
    }
    function reset() {
        tasks.length = 0;
        current = null;
        tickCount = 0;
        nextId = 1;
    }
    function state() {
        return Object.freeze({ ticks: tickCount, tasks: tasks.map(x => Object.freeze({ entry: x.entry, ptime: x.ptime })) });
    }
    return Object.freeze({ spawn, dispatch, reset, state });
}
