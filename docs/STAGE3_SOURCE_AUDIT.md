# Stage 3 — source-aligned translation and audit

Pinned original: `mwenge/defender` revision `e74006344b16d19245510b5e55780f90d7606bb8`, `src/defa7.src`.

## New translations (all `translated-unverified`)

| Original label | Original lines | JavaScript function | Original shared state | Status |
|---|---:|---|---|---|
| STOUT, STOUT0..STOUT3 | 2094–2154 | `STOUT` | SMAP, STRCNT, BGL, BGLX, ITEMP, ITEMP2 | unit-tested, no MAME comparison |
| SBLNK, SBLNK0, SBL00, SBLNK1 | 2156–2198 | `SBLNK` | SMAP, SEED, LSEED, HSEED, STATUS | unit-tested, no MAME comparison |
| THINIT, THI1 | 2202–2209 | `THINIT` | THX, THTAB, SEED | unit-tested, no MAME comparison |
| THPROC, THPR1, THPR2 | 3278–3292 | `THPROC`, `THPR1`, `THPR2` | THX, FBX, THTAB, FBTAB | unit-tested, continuation address unresolved |
| OSCAN, OSC1, OSCLP | 3307–3327 | `OSCAN` | OPTR, IPTR, BGL, XTEMP, OX16 | unit-tested, no MAME comparison |
| ISCAN, ISC1, SCYV3, SCYV4, ISCLP | 3329–3372 | `ISCAN` | IPTR, OPTR, OXV, OYV, OX16, OY16 | unit-tested, no MAME comparison |

Every new named callable entry point retains its original name. Internal fall-through labels are identified in the corresponding JavaScript function documentation; no additional gameplay scheduling was introduced.

### STARS

`STOUT` mirrors the original half-byte background offset calculation, the initial clearing of all 16 old locations, its loop count (`STRCNT`), its source byte overflow/zero-or-$9B clamp, and the `$F0/$0F` phase masking. Actual byte writes use the same original indirect `(SX<<8)|SY` byte address, backed by a separate 64 KiB video byte array. This does not claim to simulate every Williams bank-switch or palette detail.

`SBLNK` implements the original colour increment, odd-seed early return, optional relocation, screen erase and even the unusual rare RAM overwrite on `SEED==$A0` when its guards permit it. That behaviour is preserved deliberately, not redesigned. Tests cover the branch; real bank mapping still needs cross-validation.

### THRUST

`THINIT` retains the source loop's 33 iterations (including the final write at `THTAB+64`), not a tidier but incorrect 32-iteration table. `THPROC` follows `THPR1/THPR2` and requests the **original scheduler** `SLEEP(4,THPROC)`. It refuses to execute without a resolved original continuation address; nothing falls back to a JS timer.

### OBJECT SCANNING

`OSCAN`/`ISCAN` use the original 100×32 left buffer, 500×32 unsigned scan width, 16-bit wraparound arithmetic and linked list node splicing. `ISCAN` advances offscreen objects by eight times their source-defined velocity, including Y wrapping. The Stage 3 diagnostic has no original enemy or object creation processes, so these are unit-tested but not called in the browser flight fixture.

### Browser scope

Only the original `PLAYER`, `STINIT`, `STOUT` and `THINIT` routines are coupled to the flight test (alongside the Stage 1 memory and object-list setup). The grid remains a **diagnostic measuring aid**. The stars are plotted by reading the actual `STOUT`-written video bytes; there are no browser-imposed star speeds or random effects.

### Known limitations

* `SINIT`, full IRQ event scheduling, general Williams framebuffer pipeline, `BGOUT`, `PRDISP`, terrain, sound firmware and enemy processes are not translated.
* The game is **not yet playable**; this is an expanded, genuinely runnable diagnostic.
* Existing Stage 2 routines remain **translated-unverified** pending side-by-side original execution traces. All new routines have source-derived unit vectors but have **not** been promoted to `verified`.
* GitHub source fetch is unavailable in this environment. The locally-run annotation tool can add original full assembly comments from the pinned checkout without shipping the upstream assembly in this ZIP.
