/**
 * Williams Defender, native JavaScript transliteration.
 * Original src/defb6.src:651–900, revision e74006344b16d19245510b5e55780f90d7606bb8.
 * Original entry points: LANDST/LNDST0/LNDST1/LNS2/LNDSTX,
 * LANDS0/LNDSAA/LANDSA/LANDS1/LNDS1/LANDS2/LANDS3/LANDS4,
 * LANDG0/LANDG/LNDG1/LANDG1/LNDG2/LANDG2/LNDG20/LANDG3,
 * LANDF/LANDFX/LNDFXA/LNDFX0/LNDFX1, SCZ00, SCZ0.
 *
 * State is only source-defined RAM bytes and linked process entries.
 * Browser effects are not present; missing original jumps fail explicitly.
 * The annotation tool inserts the upstream assembly from a LOCAL checkout.
 */
import { u8, u16, s8, s16 } from '../runtime/integers.js';
import { TranslationBoundaryError } from '../runtime/continuations.js';
export function createDefb6LanderRoutines(RAM, Layout, processes, { addresses = {}, OBINIT, RAND, RMAX, APVCT, GTARG, GETALT, LSHOT, SNDLD, SNDOUT, KILOFF, ASTK1, SHOOT, SCZS0, KILP } = {}) {
    const at = n => Layout.at(n), off = (X, n) => u16(X + at(n));
    const r = n => RAM.read8(at(n)), r16 = n => RAM.read16(at(n));
    const w = (n, v) => RAM.write8(at(n), v), w16 = (n, v) => RAM.write16(at(n), v);
    const b = (X, n) => RAM.read8(off(X, n)), d = (X, n) => RAM.read16(off(X, n));
    const wb = (X, n, v) => RAM.write8(off(X, n), v), wd = (X, n, v) => RAM.write16(off(X, n), v);
    const dep = (name) => {
        const fn = { OBINIT, RAND, RMAX, APVCT, GTARG, GETALT, LSHOT, SNDLD, SNDOUT, KILOFF, ASTK1, SHOOT, SCZS0, KILP }[name];
        if (typeof fn !== 'function')
            throw new TranslationBoundaryError(`DEFB6 lander requires original ${name}`);
        return fn;
    };
    const sym = (name) => {
        const value = addresses[name];
        if (!Number.isInteger(value) || value <= 0 || value > 65535)
            throw new TranslationBoundaryError(`Unresolved original lander symbol ${name}`);
        return value;
    };
    const current = () => {
        const U = r16('CRPROC');
        if (!U || U === at('ACTIVE'))
            throw new TranslationBoundaryError('Lander requires original CRPROC');
        return U;
    };
    const nap = (ticks, label) => processes.SLEEP(ticks, sym(label));
    const obj = U => d(U, 'PD'), target = U => d(U, 'PD2');
    const alive = U => RAM.read16(d(U, 'PD4')) !== 0;
    // Source tests OCVECT+1,Y against ((ASTKIL << 8) & $FF00) >> 8.
    // Both are the LOW byte of the 16-bit vector, not the high byte.
    const astKillValid = Y => (d(Y, 'OCVECT') & 0xff) === (sym('ASTKIL') & 0xff);
    const retarget = U => {
        const X = obj(U);
        wb(X, 'OTYP', b(X, 'OTYP') & 0xfe);
        if (!dep('GTARG')(U))
            return SCZ00(U); // original LBEQ SCZ00
        return LANDSA(U);
    };
    /** LANDST: original NEWP/OBI, random spawn, alternating one's-complement X velocity. */
    function LANDST(A) {
        let remaining = u8(A);
        w('XTEMP', remaining);
        const created = [];
        for (;;) {
            if (!r('ASTCNT'))
                return dep('SCZS0')(remaining); // original JMP SCZS0; zero astronauts
            const U = processes.MKPROC(sym('LANDS0'), at('STYPE'));
            const X = dep('OBINIT')(U, { OPICT: sym('LNDP1'), OCVECT: sym('LKILL'), OBJCOL: 0x4433 });
            dep('RAND')();
            wd(X, 'OX16', r16('HSEED'));
            wb(X, 'OY16', at('YMIN') + 2);
            wd(X, 'OYV', r16('LNDYV'));
            wb(U, 'PD6', dep('RMAX')(r('LDSTIM')));
            let B = u8(dep('RMAX')(r('LNDXV'))), D = B;
            if (B & 1)
                D = u16(~D); // COMB; COMA is one's complement, NOT NEG
            wd(X, 'OXV', D);
            wd(X, 'OBJID', U);
            dep('APVCT')(X);
            wd(U, 'PD', X);
            dep('GTARG')(U);
            w('LNDCNT', r('LNDCNT') + 1);
            created.push({ process: U, object: X });
            remaining = u8(remaining - 1);
            w('XTEMP', remaining);
            if (remaining === 0)
                break;
        }
        return created;
    }
    /** LANDS0: validate target and steer vertically relative to original terrain altitude. */
    function LANDS0() {
        const U = current(), X = obj(U), Y = target(U);
        if (!alive(U) || !astKillValid(Y))
            return retarget(U);
        // Compare HIGH bytes masked FC, not full 16-bit proximity.
        if ((b(X, 'OX16') & 0xfc) === (b(Y, 'OX16') & 0xfc))
            return LANDG0(U);
        return LANDSA(U);
    }
    function LANDSA(U = current()) {
        const X = obj(U);
        // SUBA #50; SUBA OY16,X; BHI LANDS1; CMPA #-20; BLT LNDS1
        const altMinus = u8(dep('GETALT')(X) - 50);
        const difference = altMinus - b(X, 'OY16');
        const A = u8(difference);
        let D = 0;
        if (difference > 0)
            D = r16('LNDYV'); // LANDS1: BHI
        else if (s8(A) < -20)
            D = u16(~r16('LNDYV')); // LNDS1: COMA; COMB
        wd(X, 'OYV', D); // LANDS2
        if (d(X, 'OPICT') !== sym('NULOB')) {
            dep('LSHOT')(X, U);
            let pict = u16(d(X, 'OPICT') + at('OBJL'));
            if (pict > sym('LNDP3'))
                pict = sym('LNDP1');
            wd(X, 'OPICT', pict);
        }
        return nap(6, 'LANDS0');
    }
    /** LANDG0: enter pickup state, zero speed, set non-hyperable type. */
    function LANDG0(U = current()) {
        const X = obj(U);
        wb(X, 'OTYP', u8(b(X, 'OTYP') + 1));
        wd(X, 'OXV', 0);
        wd(X, 'OYV', 0);
        wd(X, 'OPICT', sym('LNDP1'));
        return LANDG(U);
    }
    /** LANDG: source quantised alignment and pickup; 1-tick continuation. */
    function LANDG(U = current()) {
        const X = obj(U), Y = target(U);
        if (!alive(U) || !astKillValid(Y))
            return retarget(U);
        const yWorld = d(Y, 'OX16') & 0xffe0, xWorld = d(X, 'OX16') & 0xffe0;
        if (xWorld !== yWorld)
            wd(X, 'OX16', u16(d(X, 'OX16') + (s16(xWorld) > s16(yWorld) ? -0x20 : 0x20))); // BLT signed
        const yTarget = u8(b(Y, 'OY16') - 12), y = b(X, 'OY16');
        if (yTarget !== y) {
            const D = yTarget >= y ? r16('LNDYV') : u16(~r16('LNDYV'));
            // Source STD OY16,X writes both height and the following fractional byte.
            wd(X, 'OY16', u16(d(X, 'OY16') + D));
            dep('LSHOT')(X, U);
            return nap(1, 'LANDG');
        }
        const delta = u16(d(X, 'OX16') + 0x40 - d(Y, 'OX16'));
        if (delta > 0x80) {
            dep('LSHOT')(X, U);
            return nap(1, 'LANDG');
        }
        // LANDG3: attach the astronaut and enter ascending LANDF.
        wd(X, 'OCVECT', sym('LKIL1'));
        const up = u16(~r16('LNDYV'));
        wd(X, 'OYV', up);
        wd(Y, 'OYV', up);
        dep('SNDLD')(sym('LPKSND'));
        wd(Y, 'OCVECT', sym('AKIL1'));
        return LANDF(U);
    }
    /** LANDF: climb to YMIN+8, 4-tick sleep; leave passenger attached. */
    function LANDF(U = current()) {
        const X = obj(U);
        if (b(X, 'OY16') <= at('YMIN') + 8)
            return LANDFX(U);
        dep('LSHOT')(X, U);
        return nap(4, 'LANDF');
    }
    function LANDFX(U = current()) {
        dep('SNDLD')(sym('LSKSND'));
        return LNDFXA(U);
    }
    /** LNDFXA: pull astronaut into ship, once per tick. */
    function LNDFXA(U = current()) {
        const X = obj(U), Y = target(U);
        if (!alive(U)) {
            dep('KILOFF')(X);
            w('LNDCNT', r('LNDCNT') - 1);
            w('LNDRES', r('LNDRES') + 1);
            return processes.SUCIDE();
        }
        wd(X, 'OYV', 0);
        wd(Y, 'OYV', 0);
        if (b(Y, 'OY16') > b(X, 'OY16')) {
            wb(Y, 'OY16', b(Y, 'OY16') - 1);
            dep('SNDOUT')(0x12);
            return nap(1, 'LNDFXA');
        }
        // LNDFX1: centre of explosion, ASTK1, then fall through SCZ00.
        w16('CENTMP', u16(d(Y, 'OBJX') + 0x100));
        dep('ASTK1')(Y);
        return SCZ00(U);
    }
    /** SCZ00: source transition from lander into mutant. */
    function SCZ00(U = current()) {
        const X = obj(U);
        w('LNDCNT', r('LNDCNT') - 1);
        w('SCZCNT', r('SCZCNT') + 1);
        wb(X, 'OTYP', 0);
        wd(X, 'OPICT', sym('SCZP1'));
        wd(X, 'OBJCOL', 0xcc33);
        wd(X, 'OCVECT', sym('SCZKIL'));
        wb(U, 'PD2', r('SZSTIM'));
        // Assembly falls through to SCZ0. It must not fake an enemy process here.
        return SCZ0(U);
    }
    /** SCZ0: original mutant horizontal seek and vertical avoidance/hunt, NAP 3. */
    function SCZ0(U = current()) {
        const X = obj(U), player = r16('PLABX'), world = d(X, 'OX16');
        let B = r('SZXV');
        if (s16(player) < s16(world))
            B = u8(-B); // BGE is signed
        wd(X, 'OXV', u16(s8(B)));
        const D = u16(player - world + 380);
        if (D <= 0x700) { // SCZ6: player relatively close in X, seek him in Y
            const vertical = r16('SZYV');
            wd(X, 'OYV', r('PLAYC') >= b(X, 'OY16') ? vertical : u16(~vertical));
            if (d(X, 'OBJX') === 0)
                return nap(3, 'SCZ0'); // SCZ12: not on screen
        }
        else { // source SCZ2/SCZ3/SCZ4/SCZ5: avoidance off-axis
            const py = r('PLAYC'), ey = b(X, 'OY16'), A = u8(py - ey);
            let velocity;
            if (py > ey) {
                velocity = A > 8 ? 0 : u16(~r16('SZYV'));
            }
            else {
                velocity = s8(A) > -8 ? r16('SZYV') : 0;
            }
            wd(X, 'OYV', velocity);
        }
        let hop = r('SZRY');
        if (!(r('SEED') & 0x80))
            hop = u8(-hop);
        let height = u8(hop + b(X, 'OY16'));
        if (height < at('YMIN'))
            height = at('YMAX');
        wb(X, 'OY16', height);
        const timer = u8(b(U, 'PD2') - 1);
        wb(U, 'PD2', timer);
        if (timer === 0) {
            wb(U, 'PD2', dep('RMAX')(r('SZSTIM')));
            if (dep('SHOOT')(X, U))
                dep('SNDLD')(sym('SSHSND'));
        }
        return nap(3, 'SCZ0');
    }
    /** LKIL1: killing a lander carrying an astronaut starts original AFALL. */
    function LKIL1(X) {
        const carrier = d(X, 'OBJID');
        if (!carrier || !RAM.read16(d(carrier, 'PD4')))
            return LKILL(X);
        const falling = processes.MKPROC(sym('AFALL'), at('STYPE'));
        const Y = d(carrier, 'PD2');
        wd(falling, 'PD', Y);
        dep('SNDLD')(sym('ASCSND'));
        wd(Y, 'OYV', 0);
        wd(Y, 'OBJID', falling);
        return LKILL(X);
    }
    /** LKILL: original kill-process macro KILP ($0115, LHSND). */
    function LKILL(X) {
        w('LNDCNT', r('LNDCNT') - 1);
        return dep('KILP')(X, 0x0115, sym('LHSND'));
    }
    return Object.freeze({ LANDST, LANDS0, LANDSA, LANDG0, LANDG, LANDF, LANDFX, LNDFXA, SCZ00, SCZ0, LKIL1, LKILL });
}
