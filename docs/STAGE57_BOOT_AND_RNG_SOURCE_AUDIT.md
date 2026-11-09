# Stage 57 — Defender Red Label power-on and first-wave RNG audit

## Sources

All source links pin `mwenge/defender@e74006344b16d19245510b5e55780f90d7606bb8`.

- `ROMF8.SRC` [RESET/RESET1/RAM2–RAM17, lines 62–204](https://github.com/mwenge/defender/blob/e74006344b16d19245510b5e55780f90d7606bb8/src/romf8.src#L62-L204).
- `DEFA7.SRC` [RAND, lines 944–961](https://github.com/mwenge/defender/blob/e74006344b16d19245510b5e55780f90d7606bb8/src/defa7.src#L944-L961), [SINIT/INIT20, lines 969–1030](https://github.com/mwenge/defender/blob/e74006344b16d19245510b5e55780f90d7606bb8/src/defa7.src#L969-L1030), [EXEC1, lines 3089–3095](https://github.com/mwenge/defender/blob/e74006344b16d19245510b5e55780f90d7606bb8/src/defa7.src#L3089-L3095).
- Williams [operator manual](https://www.mamechannel.it/files_free/arcade_manuals_unpacked/defndjeu.pdf): at power-on the machine produces a sound while running RAM/ROM/battery checks.

## Rug pattern: not two original source passes

At `ROMF8.SRC` lines 92–96 the initial test sets `Y` to **7**. Each `RAM2` writes all `$0000..$BFFF` RAM bytes through `RAM6`, then `RAM7` verifies them, and `RAM17` decrements `Y` and repeats until zero. The original program therefore executes **7 write sweeps and 7 readback verification phases**; a verify pass does not produce a second visible rug sweep. There is no source basis for reducing this to two. A contemporary arcade-repair account also recalls 7–8 visible sweeps, though only the assembly is authoritative for loop count.

Stage 56 displays 7 writing passes using a browser limiter of **440 words per nominal 16.64 ms frame**. `48,?` no: the source memory span is 49,152 bytes = 24,576 words. Each of the 14 phases takes 56 browser updates, yielding 784 updates or **approximately 13.05 seconds** for the RAM test, excluding the subsequent green success message (3 s) and GAME OVER handoff. That limiter is **a browser pacing approximation**, not derived from a complete 6809 cycle trace. Stage 57 retains the seven source passes unchanged; further changes to their absolute duration require an independent cabinet capture or full cycle-accounting of the `RAM3`/`RAM7` loops and interrupts. No arbitrary two-sweep shortcut is introduced.

## QUASAR startup cue

`ROMF8.RESET` writes `$C0` to the sound-board PIA at reset before `RESET1` writes the palette and before `RAM2` begins the rug writes. Stage 56 called `audio.powerOn()` only **after** `boot.RESET()` had prepared the browser's boot framebuffer. Stage 57 issues the sound command **first**, as soon as the browser audio context is user-unlocked, then initialises the boot screen. This preserves the approved `$1F` QUASAR synthesis. Web Audio policy still requires the POWER ON gesture. Browser audio output latency and full hardware PIA timing are unverified.

## Repeatable first-wave locations — confirmed Stage 56 bug

Original `DEFA7.SINIT` seeds `$A55A` into `HSEED` **once**, when the main game ROM initialises. `INIT20` consumes that seed for stars and sprites. `EXEC1` calls `RAND` on successive executive passes throughout attract mode. `START` does **not** call `SINIT`; therefore, when the player starts a new game, the enemy and astronaut routines inherit the then-current RNG. Two players starting after different amounts of attract time should normally see different first-wave positions.

Stage 56 had a separate browser `createFlightHarness.RESET()` for every game and wave, and it reseeded `HSEED` to `$A55A` each time. That restarted the pseudorandom stream and made first-wave placements repeat. This was an adapter bug, not intended original arcade behaviour.

Stage 57 transfers the three source random bytes (`SEED`, `HSEED`, `LSEED`) and the 16 `SMAP` star records from live attract RAM into the native game RAM when a paid game starts. For wave continuation, it carries forward the game RAM's source RNG state. **It does not call `Math.random` or use wall-clock entropy.** This reproduces the original shared-state principle while keeping the existing separate browser attract/game modules. Source `RAND`, `STINIT`, and `LANDST` remain unchanged.

### Test verification

- Seven complete RAM write/verify phases, original green success and GAME OVER sequence.
- Source random state changes after 80 attract updates.
- Different attract durations produce different positions for all 10 initial astronaut objects and for the first five landers (`LNDP1`).
- Wave continuation retains the RNG state instead of forcing `$A55A`.
- Power-on code issues `audio.powerOn()` before `boot.RESET()`.
- The new tests plus retained game suite pass; Chromium desktop and mobile boot, QUASAR command, coin gate and game start pass without page errors.

## Remaining fidelity limits

Stage 57 does not claim cycle-accurate RAM/ROM diagnostics or a fully shared ROM address-space for attract/game. The boot ROM checksum routines remain unimplemented, and the browser's audio command/sample scheduling is not an independent measurement of cabinet output timing. The native game harness still has a few compatibility initialisations that run at each game start, including thrust/laser data, rather than a completely integrated single `SINIT` state machine.

### Additional Stage 57 lifecycle correction

The first audit found two browser-boundary reseeds: (1) attract → game and (2) game → attract after the last life. Both have now been fixed. `AMODE1.RESET()` accepts the game's source RNG and `SMAP` state when the Hall of Fame/attract sequence resumes. A menu-triggered Watch Demo also retains the live source state. Only cold power-on runs the initial `$A55A` seed setup. This preserves the original continuous random stream across multiple games, rather than only changing the first game's opening positions.

Final test suite: **532 tests pass**.  Desktop (1280×900) and phone-width (390×844) Chromium smoke tests loaded the single-file HTML without page errors; POWER ON submitted command `$1F`, boot reached attract mode, and a paid credit started gameplay with ten initial astronauts and three Smart Bombs.
