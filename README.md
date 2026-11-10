# DefenderPort

A source-first JavaScript port of Williams *Defender* (1980, Red Label), translated routine by routine from the original 6809 assembly, with an attract-mode AI. Open `play.html` to play or choose **WATCH AI PLAY**. `npm test` runs the test suite.

> **Notice:** *Defender* (1980) and its original 6809 source code are the property of their rights holders. This project is an unofficial, non-commercial JavaScript translation made from the publicly posted source at [mwenge/defender](https://github.com/mwenge/defender), which states no licence. No licence is granted here for the original game material.

# Stage 80 — Cabinet controls, sound checks, a calmer AI demo

- **START needs a credit**, as on the cabinet (or Free Play). It no longer inserts a coin itself.
- **One sound control on the toolbar:** a mute button and a volume slider. Volume starts at 100%, and volume and mute are saved in the browser.
- **The start sound was checked against the original code.** The original `vsndrm1.src` was assembled and run on an independent 6800 emulator (`tools/m6800-reference.mjs`), and every DAC write was compared. The port's start sound matches exactly, all 18,432 writes. The pulsing is in the original: 256 echoes, with a decay that wraps round. Every other command matches too.
- **Power-on sound.** Leaving the AI demo reset the sound board one frame late, which cut off QUASAR after a power cycle from the demo, and the start sound when START was pressed during the demo. That is fixed. POWER ON also now waits for the browser's audio output to be running before it plays QUASAR.
- **Escape** ends the current game or the AI demo and returns to the attract mode.
- **DEMO** now flashes at 20% opacity above the spare ships for the whole AI demo.
- **Page.** The project notes and diagnostics panel is gone. The developer tools are in the menu.
- **A calmer AI demo.** It turns round 42 times a minute instead of 77, and turns within half a second of the last fell from 54% to 1%. It dies slightly less often and scores about the same.

See [STAGE80_CABINET_UI.md](STAGE80_CABINET_UI.md). `npm test`: 671 tests pass.

# Stage 79 — Stars restored to the source, attract scanner trail fixed

- **Stars.** In the source, `STOUT` has no `RTS`: it falls straight into `SBLNK`. So every frame, after the stars are drawn, one random star changes colour and, on an even `SEED`, jumps to a new X position (and a new height once the planet has gone). The port had treated `SBLNK` as having no caller and ran only its colour change, from a host adapter, so stars never jumped. `STOUT` now falls through as in the source, and the adapter is gone.
- **Anti-tamper.** `SBLNK` contains a deliberate RAM-corrupting "bomb" that fires only if `WCURS` doesn't hold the value the genuine Williams logo leaves there ($6245, which the port's own logo data reproduces). Game RAM now holds that value, so the bomb stays dormant, as on a genuine board. The bomb path itself now matches the source exactly, including its reuse of the corrupted address.
- **Scanner trail in attract mode.** The attract demo's object records were placed at a fixed address that ran into the scanner's erase table. When the Swarmer rose to be shot, its position overwrote the saved blip addresses, so old blips were never erased. The records now come from the real object pool (`OLIST`), where the source's `GETOB` takes them.

See [STAGE79_STARS_SCANNER.md](STAGE79_STARS_SCANNER.md). `npm test`: 663 tests pass.

# Stage 78 — AI endgame: the long way round, Baiters, the last human

- **The long way round.** The AI only read the active object list. The original's `OSCAN` parks every object outside a 500-pixel band around the screen on the inactive list, so the AI couldn't see the wave's last enemies and patrolled in an arbitrary direction. It now reads both lists, as a player reads the scanner. Long-way travel in the endgame fell from 14% of the time to 2%.
- **Baiters.** With the wave's last enemies left, the AI finishes the wave instead of fighting Baiters, while still defending against a close one. Endgame time spent targeting a Baiter fell from 54% to 4%, and endgames are 40% shorter.
- **The last human.** With one human left, Landers are ranked by how close they are to *him*, and with nothing to hunt the AI waits over him.

Across 32 benchmark games the mean score rose from 74.3k to 77.7k and the planet is destroyed less often (56% of the time, down from 64%). Deaths per 10k ticks rose about 9%, from 1.58 to 1.72, because the AI now flies out to enemies it previously couldn't see; deaths per wave are almost unchanged. See [STAGE78_ENDGAME_AI.md](STAGE78_ENDGAME_AI.md). `npm test`: 657 tests pass.

# Stage 77 — Sound audit, sound-board rebuild, silent demo, menus

The game now requests the right sound at every original trigger. Catching a falling human played the Lander scream; it now plays `ACSND`, as `AKIL1` does.

The sound board has been rebuilt as one persistent, streaming translation of VSNDRM1:
- Board RAM carries over between commands, so the rising Lander-carry spinner, the pull-in sweep and the post-thrust `BG1` background work.
- Effects play to their natural end instead of being cut off.
- Every routine uses the original 6800 instruction cycle counts. Thrust ran about 40% fast and the scream an octave high. The high-score organ tunes played at the wrong pitch; they are now correct.

The AI demo is silent. START works during the demo and drops a coin in if you have no credit. The toolbar, status line and menu were reorganised. See [STAGE77_SOUND_AND_MENUS.md](STAGE77_SOUND_AND_MENUS.md). `npm test`: 653 tests pass.

# Stage 76 — Source audit of enemy movement and timing

Every enemy movement routine and every process timing was compared, instruction by instruction, with the pinned original source. Landers, Mutants, Swarmers, Baiters, Pods, humans, enemy shots, `VELO` and `PLAYER` all match. All gameplay `NAP` timings and the 60.096 Hz frame rate match.

Fixed:
- **Bombers (`TIE`):** an off-by-one in their vertical damping (made them drift upward), a wrong-direction cruise correction low off-screen, and the wrong height used when tracking the player.
- **Bomber mines:** they were never wired up, so Bombers laid no mines. They are now restored from the original `BOMBST`.
- **Swarmer explosions:** they now use the original `SWXP1` picture and offset.

Not matched: the arcade's slowdown when the screen is busy. The port always runs one executive pass per frame; see `STAGE76_SOURCE_AUDIT.md`.

"DEMO MODE ACTIVE" flashes for 5 seconds at the start of each demo game. `npm test`: 644 tests pass, plus the guardrail.

---

# Stage 75 — Engine fixes, demo robustness, source-faithful shield (historical)

**Engine fixes**, both checked against the pinned upstream source:
- `KILOFF` now falls through to `OFSHIT` as in the original, so 250/500 rescue scores and other retired objects no longer leave pixels behind.
- Pods are killed with the original `KILO` macro (object only), not `KILP`. `KILP` also killed whichever unrelated process had reused the Pod creator's slot, which later tripped the "KILL: … not in ACTIVE" ERROR trap.

**Demo mode** restarts a fresh game instead of freezing on any source trap, and opens each game with a flashing **DEMO MODE ACTIVE** in the boot screen's font and colour for 5 seconds.

**The AI's shield** now predicts Swarmers and Baiters with their source rules. A kept human is carried at a height set by the real terrain, and set down if he would stall the wave. The AI never fires through a human, and uses hyperspace when a collision is otherwise certain.

**Measured** against Stage 74 on the same engine (64 games):
- Deaths per tick down 34%; game-overs 19 → 3.
- Mean score 68k → 77k; deaths with shells / Swarmers / Baiters nearest roughly halved.

See `STAGE75_AI_NOTES.md`. `npm test`: 639 tests pass, plus the guardrail.

---

# Stage 74 — Wave tactics: Pods, scarce humans, post-planet smart bombs, Baiters (historical)

Open `play.html` and choose **WATCH AI PLAY**. The attract AI now hunts Pods and shoots them from range instead of retreating. When humans are down to three or fewer, it keeps a caught human aboard, flying high enough that he never touches the ground, so Landers can't take him and the planet survives. After the planet is lost, it lets Mutants gather and smart bombs them, always keeping two bombs for emergencies. When Baiters appear, it finishes the wave's other enemies first, unless Baiters are close or there are three or more.

**Measured** (56 paired seeded games against Stage 73, 30,000-tick cap):
- Mean score 58,240 → 70,350; mean furthest wave 6.1 → 7.3; waves cleared 15% faster.
- Pods destroyed +25%; Baiter presence 27% → 21% of the time, and deaths to Baiters 70 → 31.
- Planet-destroyed time 65% → 60%; time carrying a human 0.4% → 6.4%.
- Overall deaths per tick slightly lower. Swarmer deaths are up, and Mutant deaths are still about twice Stage 73's.

See `STAGE74_AI_NOTES.md`, including an engine ERROR trap seen once during benchmarking. `npm test`: 631 tests pass, plus the source guardrail. `npm run ai:benchmark` reproduces the metrics.

---

# Stage 73 — Symmetric Mutant duel and collision shield (historical)

Open `play.html` and choose **WATCH AI PLAY**. The attract AI now handles Mutants from above **and below**: it opens horizontal distance, turns and fires from range, and never climbs or dives towards a Mutant it overlaps. A collision shield simulates the source `SCZ0` Mutant rules (plus shells and other enemies) for each candidate input and refuses inputs that lead into a collision. Only `createAttractPilot()` changed; the translated game is untouched.

**Measured** (64 seeded full games, 40,000-tick cap): Mutant deaths per 10,000 ticks 1.62 → 0.19; all deaths per 10,000 ticks 4.99 → 2.45; mean survival 7,417 → at least 32,790 ticks; mean score 13,272 → 71,775; mean furthest wave 2.56 → 7.11. In the new `npm run mutant:arena`, late-wave Mutants starting below the ship killed Stage 72 in 22 of 24 encounters and Stage 73 in none.

Stage 72's Mutant tests only used slow Mutants placed above the ship, 32 columns from where they were meant to be. See `STAGE73_AI_NOTES.md` for root causes, design, A/B results, retired tests and limitations. `npm test`: 622 tests pass, plus the source guardrail.

---

# Stage 72 — Overhead Mutant emergency response (historical)

Stage 72 introduces a narrowly triggered, latched evasive manoeuvre when a Mutant approaching from above is predicted to intersect the player ship. The pilot commits to a downward escape lane and horizontally opens separation before turning to fire. General hunting and source gameplay remain unchanged. The WATCH AI PLAY shortcut remains.

See `STAGE72_AI_NOTES.md` for measured comparisons and limitations.

# Stage 71 — Source-verified Mutant targeting

# Stage 70 — Previous tactical strategy

Open `play.html` and choose **WATCH AI PLAY** for immediate computer-controlled gameplay. The original Williams title, Hall of Fame and enemy showcase still lead automatically into the same demonstration. The Mutant pilot now uses a source-derived, empirically selected separation–align–counterattack plan for genuinely threatening overhead approaches. It preserves the original `PLAYER`, `SCZ0`, `LFIRE`, collision, scoring, human pickup/delivery and all finite resources. The host AI is outside the original game engine.

**Measured:** 67/96 Mutants killed versus Stage 69's 52/96 across two arranged, source-engine scenario sets, with no player deaths versus two, and 424 vertical direction changes versus 657. Ordinary 16-game benchmarks averaged 48.8 confirmed hits versus 47.8 (minor improvement) and 6.19 lost astronauts versus 6.06 (minor regression). These are deterministic samples, not a mathematical proof of optimal play.

The complete methodology, strategy, limitations and reproduction commands are in [`STAGE70_AI_NOTES.md`](STAGE70_AI_NOTES.md). `npm test` runs all **617 tests** plus the source-fidelity guardrail. `npm run build` regenerates the self-contained `play.html`.

---

# Stage 69 — Mutant stand-off, stable aiming and attack-run commitment (historical)

Open `play.html`, then choose **WATCH AI PLAY** to begin the AI exhibition immediately. The original enemy showcase still hands off automatically. A near enemy can no longer be abandoned for an unrelated faraway target behind the ship. Genuine overhead diving Mutants trigger a longer but bounded breakout, while ordinary Mutant duels still use quicker counterattacks. Small vertical hops no longer cause repeated micro-corrections. Bombers, Pods and other enemies are still read directly from source `OPTR` objects. The translated game engine and its finite gameplay rules are unchanged.

**Stage 69 verification:** All 611 tests pass. In 16 deterministic engine games, the pilot averaged 47.8 confirmed hits (Stage 68: 45.9) and reached wave 3 in 9/16 games (Stage 68: 8/16). In the isolated 24-Mutant sample, 15 were killed (Stage 68: 16), so the Mutant challenge is not solved completely. Full details, test design, source boundary and limitations: [`STAGE69_AI_NOTES.md`](STAGE69_AI_NOTES.md).

---

# Stage 68 — Full original enemy roster and predictive overhead Mutant counterattack (earlier implementation)

Open `play.html` and select **WATCH AI PLAY** to jump straight into an unmodified normal game controlled by the AI. Bombers, Pods and Swarmers are now discovered by reading the **source `OPTR` chain** rather than the incomplete historical `ENEMY_STATE()` array. All four animated Bomber frames and Pods can be engaged. Predictive Mutant interception detects a descending enemy before it reaches the ship, and reserves longer retreat for those approaching overhead on a collision trajectory. Ordinary close Mutant duels use the faster established turn-and-fire plan. Stage 68 passes **605 tests**. See `STAGE68_AI_NOTES.md` for source explanation, real-engine comparisons and limitations.

---

# Stage 67 — Mutant engagement and overhead retreat (historical)

Open `play.html` and choose **WATCH AI PLAY**. Normal gameplay is unchanged; the AI uses source `lab.INPUT()` only, consumes finite resources, can die and restarts from ordinary game-over.

- Initiates a horizontal stand-off manoeuvre against approaching overhead Mutants earlier (roughly within 75 screen columns and 60 pixels above the ship), before climbing into them.
- If a close overhead Mutant remains in the collision path and the ship's *actual horizontal velocity* is still toward it, continues the retreat rather than reversing prematurely; retreat has a firm timeout.
- Slightly widens the existing laser corridor tolerance for Mutants (to 2.2 pixels), retaining narrow tolerance for other enemy types.
- Retains source-current sprite identification, complete passenger delivery, Pod-safe distance, Bombers, rescued humans, normal game rules and scarce smart bombs/hyperspace.

**Measured limitations:** Against 24 isolated Mutant fixtures on the unchanged gameplay engine, 16 were killed within 430 ticks versus 14 with Stage 66 (neither set lost a ship). In 16 ordinary 12,000-tick seeded games the Stage 67 controller averaged 8,564 ticks, 37.1 hits and 4.31 humans lost, compared with Stage 66 at 8,791 ticks, 38.8 hits and 3.94 humans lost. This is a Mutant-specific gain, **not** an overall statistical improvement. It is not yet expert AI, and prolonged browser visuals have not been confirmed. Tests and exact command paths: `STAGE67_AI_NOTES.md`.

---

# Stage 66 — Threat-aware attract-mode AI (historical)

Open `play.html` and select **WATCH AI PLAY** to skip directly to a normal game controlled by the AI. The original Williams enemy showcase still hands off automatically at its end. Original gameplay, input, finite ammunition, collisions, score, astronaut handling and game-over remain unchanged. The external exhibition controller starts another normal game on game-over.

- Derives enemy type from current source `OPICT` instead of stale array labels; excludes explosions and inactive sprites.
- Recognises original astronaut passenger `AFALL2` and descends steadily until the actual `ALAND` result; records source-confirmed deliveries.
- Responds to close overhead threats with deliberate horizontal separation, reversal and firing from a safer distance. Stand-off is limited to tactical emergencies to avoid compromising ordinary hunting.
- Stays clear of Pods before destroying them, because the real `PRBKIL` creates Swarmers at the Pod's location. Attacks Pods from longer range.
- Explicitly recognises and targets actual TIEP Bombers, SCZP Mutants and SWPIC Swarmers, including mutated objects whose allocation label hasn't changed.
- Retains Stage 65's opportunistic lasers, captor interception, projectile prediction and strict smart-bomb/hyperspace thresholds.

See [`STAGE66_AI_NOTES.md`](STAGE66_AI_NOTES.md), `tests/stage66-ai-tactics.test.mjs`, `npm test`, and `node tools/benchmark16.mjs ../browser/flight.js ../../baseline-flight.js` for regression checks and reproducible results. A live browser-session endurance test remains unverified; source-engine integration tests are authoritative for game mechanics, not visual smoothness in every browser.

---

# Stage 65 — Tactical AI attract player (historical)

Open `play.html` and click **WATCH AI PLAY** to start a completely normal game controlled by the AI, or allow the Williams showcase to complete and start it automatically. The original game engine is unchanged: finite lives and smart bombs, ordinary source collisions, ordinary astronaut pickups, original waves and normal game-over. The external attract controller starts a new game after a loss so the exhibit continues indefinitely.

Stage 65 adds stable multi-tick vertical-motion estimates, committed hunting/interception decisions, source-geometry firing on **all** nearby enemies (not just the primary target), earlier reverse-and-fire fly-bys, explicit identification of abductors and falling astronauts, and much stricter emergency resource thresholds. Full implementation, benchmark results and limitations: [`STAGE65_AI_NOTES.md`](STAGE65_AI_NOTES.md). Verify with `npm test` and `node tools/benchmark-pilot.mjs ../browser/flight.js`.

**Validation:** 590 passing tests and original-source guardrails; four identical seeded real-engine comparisons improved confirmed kills and astronaut survival versus Stage 64. The browser smoke run remains unverified because Chromium failed to finish a headless session here.

---

# Stage 64 — Model-based attract AI (historical milestone)

Open `play.html`, then select **WATCH AI PLAY** to skip the attract intro. The original enemy showcase automatically hands control to the same AI when AMOD13 ends. AI play uses normal gameplay inputs and ordinary finite resources, lives and collisions; real game-over automatically starts a fresh demonstration game. An ordinary human START game is unaffected.

The pilot now plans firing using original laser travel and enemy video coordinates, handles projectiles from the source SPTR list, recognises abductors, actively sweeps empty space, and saves smart bombs for unusually large on-screen clusters. See [`STAGE64_AI_NOTES.md`](STAGE64_AI_NOTES.md) and `tests/stage64-ai-tactics.test.mjs` for detailed model, thresholds and real-engine test results.

---

# Stage 58 — Touch controls and fullscreen

Open `play.html` to run the standalone game. On a touchscreen, use the left vertical slide control for UP/DOWN and the right buttons for FIRE, THRUST, HYPERSPACE and SMART BOMB; REVERSE is at lower left. A FULLSCREEN button enters aspect-preserving cabinet fullscreen. Use MENU to show/hide the touch overlay. Full details in `docs/STAGE58_TOUCH_AND_FULLSCREEN.md`.

# Stage 56 — Original ROMF8/ROMC0 power-on sequence

This revision replaces the Stage 55 fabricated boot graphics and message with source-derived ROMF8 RAM-test framebuffer writes and ROMC0 RORAOK green text, followed by GAMEOV. Clicking POWER ON activates Web Audio (as browser policy requires) and plays the original QUASAR sound-board command. Original sound synthesis, coin gate and gameplay are retained. **Full ROM checksumming, hardware faults, complete service diagnostics and cycle-exact timing are not implemented.** See [the Stage 56 boot source audit](docs/STAGE56_ROM_BOOT_SOURCE_AUDIT.md).

# Stage 55 — Cabinet-start and operator controls

Open `play.html` to use the standalone native JavaScript build. Boot/reference screens appear first; the game requires inserting a coin before one-player START (factory Free Play is disabled). The default Fire key is Enter. The default UI shows only the coin slot, start, credits and a menu; all developer controls are under advanced disclosures. The full implementation/provenance limitations are in `docs/STAGE55_CABINET_SETUP_AND_SELFTEST.md`.

The boot visual sequence and service pages are manual-derived **references**; they are not original 6809 diagnostic ROM execution. This is a native JavaScript transliteration with separate browser adapters, not a 6809 CPU emulator.

# Stage 54 — configurable ENTER key for FIRE

The browser adapter now accepts **Enter** and **Numpad Enter** as FIRE bindings. The original default FIRE key remains F, unless the player changes it in **KEYBOARD CONTROLS**. Enter starts the game on the title screen, fires during gameplay when assigned to FIRE, and confirms initials in the Hall of Fame. Escape remains a reserved dialog-cancel key. Browser storage may be unavailable when opening downloaded HTML directly on some phones; assignment remains active for the current session even without persistent storage.

Full original-routine gameplay and sound paths are retained. See [the Stage 54 source note](docs/STAGE54_ENTER_FIRE.md) and `tests/stage54-enter-fire.test.mjs`.

---

# Stage 51 — Source IRQ/TIMER/executive timing audit

**Historical Stage 51 timing milestone (current playable build: Stage 69).** The game remains native, readable JavaScript; no 6809 emulator is embedded. The Stage 51 changes correct the separate physical video clock, 8-bit IRQ TIMER latch, and single-dispatch-per-EXEC semantics, even when a 6809 graphics pass exceeds a video frame. The full 6809 IRQ and process instruction-cycle accounting is **not** complete. These changes do not by themselves claim that the DEFENDER title now matches a cabinet's speed. See [the deep timing audit](docs/STAGE51_DEEP_TIMING_AUDIT.md) and the reproducible `npm run timing:trace` data.

---

**Current title-animation correction:** Stage 50 budgets original 6809 drawing work (EXPU/EERASE/EWRITE and CWRIT) against the physical 16,640-cycle video frame. The source process sleeps and arithmetic are unchanged. See [Stage 50 CPU workload audit](docs/STAGE50_TITLE_CPU_WORKLOAD_AUDIT.md). This is a source-derived estimate, not a fully traced original ROM.

# Stage 48 — Original sound-board integration

[Stage 48 source sound integration audit](docs/STAGE48_SOUND_SOURCE_INTEGRATION.md) documents the new PIA-backed sound-board adapter. Original gameplay `SNDLD/SNDSEQ/SNDOUT` output drives the Stage 47 native JavaScript 6808 firmware synthesis, with original table priorities, command durations and repeats; there are no host-generated hit/laser/ship sounds. The cabinet **START** button translates the original `ST1SND` request, and the browser's **ENABLE SOUND** user gesture unlocks the original deferred QUASAR power-on sound. The missing source replay initialisation is fixed so **Extra Ship** is awarded and sounds at 10,000 points. `npm run build && npm test`: **474/474 tests passed**; desktop/mobile Chromium smoke tests verified audio dispatch and no browser errors. Original 6808 IRQ-retained-state and analogue output fidelity remain unverified.

---

# Stage 39 — Correct DEFENDER attract title animation

[Stage 39 source audit](docs/STAGE39_DEFENDER_ANIMATION_FIX.md) describes the corrected original `EXPU7` register arithmetic. Stage 38 built the right title artwork but calculated each appearance fragment’s centre from the **wrong byte of the second 6809 multiply**, placing it far off-screen. Stage 39 restores the correct 15-piece source animation, preserving `DEFENS/APST/EXPU/DEF50/DEF44` timings and all prior gameplay features. Audio remains deferred.

# Stage 38 — Source-derived attract animation, colours and factory Hall of Fame

[Stage 38 implementation notes](docs/STAGE38_ATTRACT_COLOURS_TITLE_HOF.md) cover the fixes prompted by original arcade screenshots. The attract presentation now runs the Williams source `COLR` and `TIECOL` palette processes, splits the DEFENDER title into 15 appearance objects using `DEFENS/APST/EXPU/DEF50`, runs original `CBOMB` colour cycling and writes the `CPRTAB` copyright bitmap. The original Red Label ROMC8 factory Hall of Fame scores appear in both columns (not persistent user records). The Williams and DEFENDER assets remain source-derived; the browser is only a presenter. Audio remains deferred, and playable-game Smart Bombs remain unlimited.

# Stage 37 — Corrected Williams Defender attract presentation

[Stage 37 source fidelity report](docs/STAGE37_ATTRACT_FIDELITY.md) covers the
original video-coordinate mapping for all six enemy types, the source-defined
first/second `LOGO0` tracing rates, and the real `LASRS` moving laser byte
sequence. Fixed after user feedback about the Stage 36 phone presentation.

The standalone `play.html` still starts in attract mode; press Enter or **START
GAME** for the original five-Lander opening wave. **WATCH DEMO** restarts the
presentation. Sound remains deferred, Smart Bombs remain temporarily unlimited.

Validation: 436 passing automated tests, real desktop/mobile Chromium tests,
correct display-pixel colour at the original `$99` laser tip, and functioning
Start-to-game transition. Full original-machine timing remains unverified.

---

# Stage 36 — Williams Defender original attract mode

See [Stage 36 source-attract documentation](docs/STAGE36_AMODE1_ATTRACT.md).

The standalone game now begins with the source-driven Williams logo, DEFENDER title art, Hall of Fame heading, animated rescue and original six-enemy introduction. Press **Enter/START GAME** to begin normal wave one. **WATCH DEMO** returns to attract mode. Sounds remain deferred; Smart Bombs remain unlimited.

# Stage 35 — Smart Bomb / bonus flash and orphaned Bomber pixels

This is the direct successor to Stage 34. It fixes two reported gameplay bugs
**in the existing native-JS transliteration**, without adding separate Canvas
effects, rewriting the original routines or enabling sound.

**Wave-completion flash overlap.** Reproduced at the original source process
cadence: a Smart Bomb kills the last enemies, and four updates later `GEX0`
previously entered `BONUS` with `SBFLG=1` while the bomb palette process was
still active. Now the translated `SBOMB` routine exposes a *host-only* `FLASHING`
flag for the eight-update colour-inversion interval (`SBMBX`→`SBX10`). The
**harness integration**, not the source-native `GEX0` routine, uses original
`GEX3` scheduling to defer wave completion while that interval is active.
This does *not* wait for the subsequent button-release debounce, and preserves
`BONUS`/`BCLP` score tallying and wave progression.

**Intermittent orphaned sprite.** Reproduced with a source-generated Bomber
from `TIEST`, drawn by `OPROC → ON48`. Its `TIEKIL` routine unlinks it from
`OPTR` before a subsequent `OPROC` can erase its last display position. The
host's `KILL_BY_VECTOR` integration now invokes the translated `OFSHIT`
**before** `TIEKIL`, preserving the original bitmap dimensions and source
video-memory write path. A direct test shows **21 nonzero original sprite
bytes before death, zero after death**. The same fix applies to laser and Smart
Bomb collision vectors.

**Validation:** `npm run build`, `npm test` (424/424), standalone JavaScript
parse and a real Chromium loaded via `set_content` (no console errors).
The Chromium run forced a bomb to end a wave and confirmed the bonus display
began **after** the palette inversions; it separately verified all 21 Bomber
sprite bytes were erased. Two further 12,000-tick scenarios, including over
550 bomb activations, completed without exceptions and progressed as far as
wave six. Browser capture: `docs/Stage35_Bonus_No_Flash.png`.

**Retained:** original initial enemies, Mutant behaviour, wave bonuses,
programmable colours and star animation, mobile controls and unlimited Smart
Bombs. **Sound is still deferred**. Original-machine raster/cycle fidelity is
not claimed. This release addresses two confirmed root causes; it does not
establish that no other rare display artifact can occur.

---

# Stage 34 — Visible star twinkle and corrected colour output

The user correctly reported that Stage 33's stars still appeared static and its
colours were wrong. The existing tests asserted changes to palette/source
*memory*, not sufficiently frequent or correct *displayed RGB pixels*.

**Critical display defect found and fixed:** Stage 29–33 called
`framePixels(video, {...viewport, palette:...})`, but `framePixels` takes the
palette as its **third positional argument**. JavaScript silently ignored the
embedded `palette` property, so **the browser always displayed its hard-coded
`DIAGNOSTIC_RGB` palette**, rendering Bomber colour cycling and Smart Bomb
colour flashes wrong regardless of what source palette RAM contained. Stage 34
corrects `presentFrame(ctx, video, RAM)` to pass the IRQ-latched hardware
palette in the right argument. A new test directly samples rendered RGB pixels
and fails if this regression ever returns. Real Chromium checks also inspect
all three Bomber palette phases on actual coloured sprite pixels.

**Stage 34 fixes:**

- `demo/flight-harness.js`: the translated `SBLNK` star-colour branch now runs
  every `STEP` with **odd source `SEED`**, rather than on every fourth update
  with an odd-seed restriction. `STOUT` still draws the source star records into
  the same video memory used by the rest of the game. An actual visual-pixel
  regression checks individual star brightness transitions. In a deterministic
  240-update comparison, this raises visible star brightness changes from
  **3 (Stage 33) to 25 (Stage 34)**. We do **not** silently call the source's
  even-seed `SBLNK` code, which contains a RAM-changing routine and must not
  be guessed into the browser's game loop. The exact original *call cadence*
  remains unresolved: there is no proven normal-play caller in the pinned
  `DEFA7.SRC` assembly, so this browser sampler is provisional.
- `browser/defender-palette.js`: the browser now converts BBGGGRRR colour RAM
  through the **physical Williams board resistor-weighted DAC** (R/G
  1200/560/330 Ω; B 560/330 Ω), rather than using Stage 33's ideal linear
  3/3/2 scaling. Hardware colour latching through IRQ is unchanged. Analogue
  CRT and transistor effects remain unmodelled.
- Bomber `TIECOL` is **source-correct**: the original three triple-colour
  `TCTAB` phases were already translated accurately. The new test goes
  beyond register inspection: it creates a source Bomber with `TIEST`, moves
  it to a **test-only** visible location, follows its actual D/E/F nibble
  sprite pixels through the framebuffer, reads latched colour RAM, converts
  to final RGB and verifies that all three phases really appear in RGB.
- Player thrust `THPROC` remains original and is regression-checked against
  the video framebuffer (see Stage 33 coverage).
- The initial five-Lander first wave, Mutants, scanner, lives, rescue/bonus,
  Hyperspace, touch controls, and **unlimited Smart Bombs** are retained.
  **Sound remains deferred at the user's request.**

**Build/test:** `npm run build && npm test` plus
`python tools/verify-stage34-browser.py` for an actual Chromium Canvas check.
Source commit: `e74006344b16d19245510b5e55780f90d7606bb8`.
This is a source-based improvement; full original-hardware parity, original
`SBLNK` invocation cadence, CRT gamma and instruction-exact timing are **not**
yet proven.

---

# Stage 33 — Thrust, stars and Bomber colour-cycling integration

Stage 33 fixes missing background tasks in the **main playable source harness** rather than overlaying graphics in Canvas:

- `THPROC / THPR1 / THPR2` run with the original four-tick `NAP` and rotate original `THX` and `FBX` data-table pointers, used by the ship's source `THOUT / THOUT1` renderer.
- `TIECOL / TIECL` cycle the original `TCTAB` 3×3 colour bytes into palette registers 13–15, with six-update sleeps between phases. These govern the Bomber (Tie) sprite's colour indices.
- `CBOMB / CBMB1` update colour registers 10 and 12 and alternate the two original `BMBD10`/`BMBD20` bomb bitmap phases. The original image bytes are installed in the host's synthetic source table region to be consumed by `BMBOUT`.
- `SBLNK` from original DEFA7 has been connected in a **provisional, explicit host display adapter**. The pinned source contains this blinking routine but not a verified regular-gameplay scheduler call. The original even-seed branch can overwrite unrelated source RAM; for the currently unsupported call path the adapter executes only the **source's odd-seed colour-only branch** every four game updates. The register-byte transform remains exact, but the scheduling is *not claimed as verified arcade timing*.
- Existing level-one five-Lander population, source bonus screen, Android button protections, unlimited Smart Bombs and deferred sound are unchanged.

See `docs/STAGE33_THRUST_STARS_BOMBER.md` for direct source mappings, tests and limitations. Run `npm run build && npm test`, then open `play.html`.

---

# Stage 32 — Original inter-wave completion and astronaut bonus

This build replaces the Stage 31 bulk score update and artificial 128-tick
inter-wave delay with the original **DEFA7.SRC BONUS → BCLP → BC1 → BC2 → BC3**
sequence. The existing translated `GEXEC` still initiates the completion.

* The game video RAM displays **ATTACK WAVE [N] COMPLETED** and **BONUS X[N]**
  using source `MESS0.SRC` letter FDB bitmaps and the existing `ROMF8.CWRIT`.
* The original `ASTP3` astronaut picture is drawn once per surviving astronaut,
  adding **100 × min(completed wave, 5)** points per survivor via source `SCORE`.
  Each award is separated by the original four-update `NAP 4,BC1` cadence.
* `GETWV` advances the wave only after the final award and four-tick pause,
  followed by the original 128-update `NAP $80,BC3` hold before `PLSTR0`.
* The real arcade HUD score changes as rewards are credited. An external
  development readout reports bonus progress; it is not drawn on the playfield.
* Zero survivors produce no astronaut bonus and no astronaut bonus icon.
* The source `EXEC`, `SSCAN`, `SCPROC`, original wave populations, player
  movement, laser routines, mutant AI, Reverse, Hyperspace, and temporary
  unlimited Smart Bombs are retained. **Audio remains deferred.**

Run `npm run build && npm test`. Stage 32 source mapping and test notes:
[`docs/STAGE32_INTERWAVE_BONUS_FIDELITY.md`](docs/STAGE32_INTERWAVE_BONUS_FIDELITY.md).
The four-update BONUS ticks and 128-update hold are source-defined; exact
CPU-cycle/raster alignment and full original-machine differential testing
remain outstanding.

---

# Stage 31 — Source cabinet input and main executive integration

Stage 31 integrates the translated **SSCAN → SWTAB → SWP** input pathway and
**EXEC → COLCHK → XUVCT → RAND → SWP → DISP** scheduling in the
actual playable harness. The scanner redraw is now scheduled by the original
SCPROC / SCP1 / SCP2 process rather than redrawn unconditionally every host frame.

* Four primary cabinet buttons (FIRE, REVERSE, SMART BOMB, HYPERSPACE)
  now enter via the original two-history-sample switch scanner and its process
  queue. Player movement controls still use the PIA samples as before.
* Very short keyboard/touch taps are latched for one browser update and then
  processed through the source switch scanner.
* Holding FIRE repeats with a seven-update **browser convenience** input pulse;
  the source scanner itself remains edge-triggered.
* The opening wave still starts with five Landers, no Baiters or Swarmers;
  unlimited Smart Bombs remain intentionally enabled for development.
* Cabinet audio waveform synthesis is **not** implemented, as requested.
* Source calls are preserved by name, but some relocation handles, host input
  timing and IRQ connections remain adapters rather than verified ROM locations.
* Exact CPU cycle / raster alignment and complete original-machine differential
  comparison remain unverified.

Run `npm run build && npm test` to regenerate standalone `play.html` and run
the guardrail checks. Browser QA: `python tools/verify-stage30-browser.py`
(the old filename is retained for backwards compatibility) and Stage 31's
additional real-browser short-tap smoke test.

See `docs/STAGE31_CABINET_INPUT_EXEC.md` for source and test details.

---

# Stage 30 — Hyperspace and source-routine hold-to-fire

**Play:** `play.html` (released as `Defender_Source_Stage30_Run.html`). Stage 30 adds the original `HYPER → HYP02 → HYP2` hyperspace sequence, including delayed teleport, shell clearing, ship reappearance, and the original failure chance/`PLEND` transition. The source `SCLR1` clears the playfield while preserving scanner and score video memory. Press **H** or tap **HYPERSPACE**.

Hold **F** or **HOLD FIRE** to repeat calls into the translated laser routines. The seven-source-tick repeat interval is an expressly **browser-side input adapter**, not a claim of exact arcade switch-sampling cadence. **Unlimited Smart Bombs remain a temporary development option**, and **sound-board synthesis remains deferred** at the user's request. The original colour-RAM/HUD improvements from Stage 29 remain.

**Validation:** `npm run build && npm test`; a Chromium smoke check of the actual self-contained HTML verified the normal first wave, a completed teleport, firing while held, and no JavaScript console errors. Stage 30 source mapping and caveats: [`docs/STAGE30_HYPERSPACE_INPUT.md`](docs/STAGE30_HYPERSPACE_INPUT.md).

---

## Archived prior milestone (Stage 29 and earlier)

# Stage 29 — Original programmable palette, HUD and browser pacing

**Play:** `play.html` (also published as `Defender_Source_Stage29_Run.html`). Stage 29 builds on Stage 28 and implements three non-audio areas:

- **Colour hardware:** the exact source `DEFB6.SRC CRTAB` palette, source `DEFA7.SRC WCTAB` terrain colours, `CRINIT`, the scheduled `COLR` laser-colour process, and IRQ copying of staging `PCRAM` into the separate `0xC000` colour-RAM latch. The browser decodes each latched 3:3:2 RGB DAC byte into RGB. CRT gamma, brightness and resistor tolerances are not replicated.
- **Original arcade HUD:** ten `MESS0.SRC` numeral bitmaps, the `DEFB6.SRC` miniature ship and Smart Bomb bitmaps, source `TDISP/LDISP/SBDISP`, `SCRTRN/SCRTR0`, and `ROMF8 CWRIT/COFF/BLKCLR`. Pixels are written into source video RAM; there is no browser-generated score/font overlay. Source icon count still depicts the stored initial three Smart Bombs; the temporary **unlimited Smart Bomb** option is shown as `∞` in the external development readout.
- **Host frame pacing and timing checks:** a 1 MHz / 16,640-count = 60.096153846 Hz nominal frame budget, a bounded catch-up accumulator and pause/resume reset. One source `STEP` calls both original IRQ half-frame translations; process `DISP` and the scheduled `COLR` run within this budget. No claim is made of exact raster-phase register values, 6809 instruction timing or whole-machine differential verification. Original sound-board synthesis is **deferred at the user's request**.

**Validation:** `npm run build && npm test`. Stage 29 has added source bitmap/DAC, IRQ latch, HUD score/icon, timing and browser-boot regression checks. The pinned original Defender source commit remains `e74006344b16d19245510b5e55780f90d7606bb8`. Technical detail: [`docs/STAGE29_HUD_PALETTE_AND_TIMING.md`](docs/STAGE29_HUD_PALETTE_AND_TIMING.md).

---

## Archived development milestones (Stages 1–28)

Older descriptions below record the state of prior stages, **not** outstanding work in Stage 29.

# Stage 28 — Original player shattering integrated

**Play:** `play.html` (also released as `Defender_Source_Stage28_Run.html`). Stage 28 translates the original banked player explosion (`BLK71.SRC PLEX/PX1A/PXCOL`) into 128 source-defined moving fragments in the shared video framebuffer. The original `PLEND` colour cycle now transitions into a 108-update shatter animation before respawn or game over, with the original stop-sound command issued at its completion. **Unlimited Smart Bombs remain enabled temporarily.** The 15-Lander opening wave and delayed Baiters remain unchanged.

Run `npm run build && npm test`; new test coverage and exact source notes are in [`docs/STAGE28_PLAYER_SHATTER.md`](docs/STAGE28_PLAYER_SHATTER.md). The original palette DAC, sound-board firmware, cabinet-exact timing and some HUD glyphs remain incomplete. The browser still uses a diagnostic palette, and independent Chromium screenshot capture timed out.

---

# Stage 27 — Unlimited Smart Bombs, player deaths and projectile collisions

**Current runnable build:** `play.html`. The normal browser game temporarily supplies **unlimited Smart Bombs** (`∞` shown in the HUD). Smart Bomb still has the source-defined `SBFLG` release/debounce requirement; holding it down is not auto-repeat. Its original three-charge counter and decrement remain available by starting `createFlightHarness()` with `infiniteSmartBombs:false` (the source/default diagnostic mode). The browser runs `createFlightHarness({infiniteSmartBombs:true,playerCollisions:true})` and the `SBOMB` routine skips only the `PSBC` guard/decrement in that mode.

New in Stage 27: the translated `PLEND`, `PDTHL`, `PDTH2`, `PDTH5` ship-death process, original `PXCTB` colour sequence and source RAM life accounting (two ships in reserve at first spawn), two lives-based restarts, and `STATUS=$FF` game-over transition when all three ships are lost. `COLCHK` now invokes `COLIDE` on `OPTR` and, if that misses, `COL0` on `SPTR`. Source `BKIL` removes a hit projectile, updates `BMBCNT`, scores, and uses the original 4×8 `BXPIC` explosion bitmap. Mobile pointer controls remain non-selectable on long press.

**Important remaining boundaries:** The final `PXVCT` ship explosion sprite and authentic programmable-colour DAC output are not yet integrated; the colour-cycle process is running. Full original `EXEC` timing, some HUD glyphs, arcade sound synthesis and original cabinet input are not yet verified. The source startup and game loop still use a documented diagnostic host boundary. A successful JavaScript test run does not establish arcade-perfect parity.

**Verification:** `npm run build && npm test` for all source/regression/standalone checks; see `docs/STAGE27_UNLIMITED_BOMBS_PLAYER_DEATH.md` for the current source mapping and measured test coverage. Stage 26 and earlier notes below are historical snapshots.

---

# Stage 26 — persistent planet destruction, Reverse and Smart Bomb

**Current runnable build:** `play.html`, native JavaScript source translation (not a 6809 emulator). Keyboard **R** reverses, **S** uses a Smart Bomb (3 at default game start); the corresponding touch buttons are above the game. The original `REV` and `SBOMB` process continuations, enemy collision vectors and charge/debounce rules are wired into the main wave harness. When every astronaut has died the terrain stays absent across later waves; the **default fifth-wave restoration** recreates the ten humans and terrain, as in the source.

**Current verification:** 349 passing tests, plus two 10,000-update scenarios (normal and controls). Chrome screenshot verification was not achieved. `PLEND`, original HUD glyphs, full smart-bomb palette synthesis, original sound board and arcade-exact timing are still missing. Technical details and limitations: [`docs/STAGE26_REVERSE_SMART_BOMB_PLANET.md`](docs/STAGE26_REVERSE_SMART_BOMB_PLANET.md).

Build standalone HTML: `npm run build`. Run regression suite: `npm test`.

---

## Stage 25 milestone — five gameplay paths integrated

**Current build:** `play.html` (self-contained). Stage 25 adds native source-derived laser firing/collision/scoring, astronaut pickup/500-point processes, SAMEX appearance effects, terrain destruction, and wave transitions with original wave-two Ties and Probes. Mobile long-press suppression from Stage 24 remains enabled. **Important:** complete `PLEND` ship-death handling, automatic collision/pickup every frame, full source `INIT20` and arcade-exact frame timing are **not** finished. Read [`docs/STAGE25_GAMEPLAY_INTEGRATION.md`](docs/STAGE25_GAMEPLAY_INTEGRATION.md) before considering this a fully playable arcade recreation.

# Stage 24 — Mutant movement verification, original explosions and mobile controls

**This remains a source-transliteration diagnostic, not a complete arcade game.**

* Mobile: every button disables touch-callout, selection and context menus while held. Thrust, Up and Down use multi-pointer aware pointer events and non-passive touchstart prevention. Ordinary tap/click handlers and keyboard controls remain in place.
* Mutants: pinned `defb6.src` `SCZ0` (lines 843–900) checked against an **independent 6809 arithmetic/branch-flag reference** across 3,500 sampled states, plus a live post-abduction 120-update movement test. No discrepancy found in that routine's register effects. This is **not** proof that all cabinet timing or visual movement is identical: the original whole-game scheduler and hardware have not been differentially compared.
* Explosion animation: `original/samexap7-explosion-update.js` translates `EXPU`'s +`$00AA` size progression, view-scroll correction, expiry, and `EWRITE`'s sparse original FDB byte writes and reverse erase table, using the existing `EERASE`. Astronaut deaths now expand source graphics in **the same video RAM** as the game objects. Original `APST` appearances are not translated and raise an explicit source boundary if reached. The harness currently calls `EXPU` once per diagnostic update; original-machine cadence remains unverified.
* Continued original first wave: five Landers initially, ten astronauts, no Baiters or Swarmers at startup. Scanner and gameplay remain linked through source OPTR/IPTR records.
* Still missing: `TERBLO` / planet-destruction and wave transitions, player laser collision/scoring, source `APST`, some enemy types and cabinet sound board. At last-human death the game stops at a named untranslated boundary, not an invented effect.

Tests: `npm run build && npm test` — 331 tests passed including bundled mobile-control gesture assertions, the movement oracle, original explosion render/erase lifecycle and post-abduction runtime. Original 6809/MAME comparison is **not** complete. A real Chrome screenshot attempt timed out; the included video-RAM framebuffer is available for deterministic inspection.

Detailed audit: `docs/STAGE24_MUTANT_EXPLOSION_MOBILE.md`.

---

# Stage 23 — Source capture, mutant conversion, scanner task and live shells

The main runtime now runs **original SCPROC → ISCAN → OSCAN → SHSCAN** through
linked source process records; both the playfield and scanner track the same
OPTR/IPTR data. Landers fire source GETSHL projectiles, whose lifetime is
managed by the translated SHSCAN routine. Lander abduction now reaches
**ASTCLR → KILOFF → EXST → SCZ00** and changes the carrier to a Mutant.
The browser HUD reads the **live TLIST and ASTCNT** rather than counting
historical astronaut objects. Exact-source `SCZST/SCZS0` also creates
Mutants on the no-targets branch.

**Tested**: source wave starts with five Landers and ten humans, no early
Baiters or Swarmers; at update 3000, nine humans have been captured and
converted into nine Mutants, with one remaining human. At about update 3382,
original `TERBLO` starts and the diagnostic **stops at an explicit translation
boundary**: the terrain-destruction process is not implemented.

**Important**: `EXST` translates the original explosion *RAM allocation and
bookkeeping*, not `EXPU/EWRITE` bitmap animation. Dead astronaut pixels may
therefore persist until surrounding video is refreshed. Player collisions,
scoring, planet explosion, original sound-board synthesis and full arcade
startup remain incomplete. This is a source-faithful **diagnostic**, not a
finished playable Defender. New Stage 23 audit: `docs/STAGE23_CAPTURE_SCANNER_SHELLS.md`.

Run `npm run build` for single-file `play.html`; `npm test` for **321 passing
checks** and the source guardrail. Historical stage reports follow;
read their completion claims as applying to their respective release only.

---

# Stage 22 — Correct first wave: Landers, not Baiters

Stage 21 incorrectly set `UFOTIM=1`, `LNDRES=1`, `WAVSIZ=1` and inserted a diagnostic Swarmer. The visible enemies were therefore primarily Baiters appearing immediately at startup, contrary to the original wave data. Stage 22 fixes this using the original `BLK71.SRC WVTAB` data and `DEFA7.SRC GETWV → PLRES (ASTSX/ELS1/ELS2) → GEXEC → LANDST` sequence. Opening state: 10 astronauts, 5 immediately spawned Landers (15 allotted, 10 initially in reserve), no Baiters or Swarmers. Original `UFOTIM` is `$D4` (212 GEXEC countdown cycles), not 1; next five Landers are scheduled by `WAVTIM=30` and `WAVSIZ=5`. All created objects enter the real `OPTR` list, `OPROC` and `SCNR` video RAM.

The normal playfield now displays a live wave readout so visible enemy types and reserve counts can be checked without depending on a diagnostic panel. The separate source-process workbenches intentionally still include test fixture UFOs/swarmers; **they are not the opening game wave**. Stage 22 adds integration checks for visible original Lander bitmap pixels, the scanner, timing, reset, and the released standalone HTML.

**Known source-translation boundary:** `ASTK1`/astronaut explosion dependencies (`XSVCT`) and full abduction/collision handling remain unfinished. Once a lander reaches an abduction path, the browser now stops its gameplay update loop with a readable source-boundary message rather than throwing an uncaught exception or manufacturing substitute gameplay. Complete `SINIT/PLSTRT`, wave transitions, and sound-board emulation remain unported. Original 6809 CPU execution is not used anywhere.

Build offline HTML with `npm run build`. Run all regression tests with `npm test`. See `docs/STAGE22_OPENING_WAVE.md`.

---

# Stage 21 — Visible original astronaut population

Stage 20 populated just one tiny diagnostic astronaut, which was easily missed. Stage 21 translates `ASTST` and the astronaut-creation portion of `PLRES` (`original/defa7-astronaut-start.js`) and starts ten original RAM astronauts, spread across four world quadrants. Three are visible inside the initial playfield, and all ten are tracked by the source scanner. No Canvas sprite substitutes are used. The initial `PTARG=10` remains a documented level-one input fixture; the complete original startup is not yet ported. See `docs/STAGE21_ASTRONAUT_VISIBILITY.md`.

`npm run build` creates offline `play.html`; `npm test` includes an executable standalone-HTML startup check and actual sprite visibility tests. The current baseline is **308 passing tests**. Historical notes below describe prior stages and may contain superseded scope/status statements.

# Stage 19–20: Astronaut rendering and real swarmer processes

See `docs/STAGE20_BATCH_INTEGRATION.md` for verified changes and remaining fixtures.

# Stage 16: scanner now shows main-display enemies

Original `SCNR` is now automatically called at reset and after each IRQ pair. The same OPTR/IPTR enemy objects drive both playfield sprites and miniature scanner dots. See `docs/STAGE16_SCANNER_INTEGRATION.md`. Three enemies remain test-seeded fixtures, not original wave-spawned AI.

# Stage 15 — visible source-derived enemies in the main screen

**Confirmed improvement:** Main browser framebuffer now displays original `UFOP1`, `SWPIC1`, and `LNDP1` bitmaps (verified original DEFB6 FDB words). Real source `GETOB`/`OBINIT` RAM records are linked into the same `OPTR` read by `OPROC`, rendered by original `ON64`/`ON34`/`ON58`, erased by source `OFF*` functions, and advanced by the existing IRQ -> `VELO` path. The browser never draws enemy Canvas shapes. Initial position and velocity are labelled fixture inputs (not yet GEXEC wave start). Source byte, screen address, frame-to-frame motion and reset tests added.

**Remaining incomplete:** The real `APVCT` appearance sequence, actual wave spawning/`UFOST` and `LANDST` startup, process dispatch/AI steering/animations, collision, scoring and game over. Existing enemy process workbenches remain separate. Passing tests do not certify full arcade parity. See `docs/STAGE15_VISIBLE_ENEMIES.md`.

# Williams Defender — native source transliteration, Stage 14

## Confirmed missing-enemy display issue

Stage 13 did not render enemy sprites: `browser/flight.js` creates three isolated harnesses, and only the flight harness owns the displayed source framebuffer. Enemy processes therefore never join the main object list or the main video. Full `APVCT` appearance, original enemy picture descriptors, real wave startup and IRQ integration remain untranslated.

Stage 14 adds an explicitly **diagnostic enemy-location canvas**, showing positions sampled from the genuine object-record fields in the two enemy/lander workbenches, with labels for UFO, swarmer, lander and astronaut. These are debugging markers, **not invented game sprites**. No attempt has been made to claim that this fixes the missing game enemies. The next substantial stage must extract original enemy picture descriptors and connect `APVCT`/`OPROC`/`VELO` to a single source-driven object system.

## Previous Stage 13 notes

**This is a direct JavaScript transliteration project, not a 6809 emulator, not a remake and not yet a playable arcade game.** The original assembly defines algorithms, shared memory and scheduler behaviour. JavaScript preserves original routine names and integer-width arithmetic. Browser-specific code is isolated in `browser/`.

## Stage 13 — lander, astronaut, pickup and fall processes

New original-named `LANDST`, `LANDS0`, `LANDG0`, `LANDG`, `LANDF`, `LANDFX`, `LNDFXA`, `SCZ00`, `SCZ0`, `LKIL1`, `LKILL`, `ASTRO`, `GETALT`, `ASTCLR`, `ASTKIL`, `ASTK1`, `AFALL`, `AFALL2` and `ALAND` translations live in **`original/defb6-lander.js`** and **`original/defb6-astronaut.js`**. They use the original RAM and process state. Stage 13 fixes a low-byte collision-vector comparison error and tests the source's original carry/sign conditions, pickup geometry and fall thresholds.

The independent **lander/astronaut workbench** below the existing process panels uses source BLK71 `BGALT`, `DISP`, `SLEEP`, `VELO` and firing routines. It does **not** replace the missing main-game startup or appearance system. Original ROM execution parity remains unverified; this is still a diagnostic rather than the finished Defender game. See `docs/STAGE13_SOURCE_AUDIT.md`.

## Run locally

- **Open `play.html` directly in a browser** — all diagnostic JavaScript and bitmap data are bundled; no ROMs, emulator, build system or network needed.
- The upper diagnostic retains the source-named two-phase IRQ flight/terrain/stars/scanner/display path from Stage 10. Keyboard **Space** = thrust; **Up/Down** = move; buttons test drawing/score/sound command bytes.
- The **Stage 11 cooperative-process workbench**, lower down the page, steps **real translated** `DISP`/`SLEEP`/`GEXEC`/`COLR`/`THPROC`/`REV` routines. Buttons run 1, 120 or 600 linked-process ticks, spawn a reversal process or reset. It reports original RAM variables, original-process records and saved entry labels.
- **Important:** the two diagnostics are separately hosted fixtures. The complete arcade `SINIT` → `EXEC` loop is **not** wired through all original enemies and state transitions. The process workbench sets `STATUS` bit 3 (source dead-player branch), because the active gameplay paths depend on enemy routines that remain untranslated. The synthetic dispatcher keys `0xf100` etc. are *not original ROM addresses*, and are confined to the test adapter.

## Stage 11 — translated source additions

| Original source file | Source routines / data | JavaScript module |
| --- | --- | --- |
| `defa7.src`, 1641–1730 | `GEXEC`, `GEX0`, `GEX00`, `GEX002`, `GEX11`, `GEX2`, `GEX3`, `GEX6` wave executive branches, original 15-tick `NAP` | `original/defa7-wave-exec.js` |
| `defa7.src`, 1732–1783 | `RMAX`, `WVCHK`, `BCDHEX`, `HEXBCD` | `original/defa7-wave-exec.js` |
| `defa7.src`, 1846–1926 | `GETWV`, `WDELT`, original inter-/intra-wave byte arithmetic and player-record indexing | `original/defa7-wave-params.js` |
| `defa7.src`, 3020–3040 | `COLR`, `COLRLP`, original 37-byte `COLTAB` including terminator | `original/defa7-process-tasks.js` |
| `defa7.src`, 3294–3305 | `SCPROC`, `SCP1`, `SCP2` scan processes and 2/2/4 `NAP` | `original/defa7-process-tasks.js` |
| `blk71.src`, 672–721 | exact `WVTAB` (23 × 8 bytes) | `original/blk71-wave-data.js` |

All source references are pinned to commit `e74006344b16d19245510b5e55780f90d7606bb8` of https://github.com/mwenge/defender . `docs/STAGE11_SOURCE_AUDIT.md` details correspondence, tests, callbacks and unresolved dependencies.

**Missing routines are not guessed.** Source calls to unavailable enemy creation (`UFOST`, `LANDST`), wave-completion (`BONUS`), output, scanner and CMOS routines require named callbacks or throw `TranslationBoundaryError`. `GETWV` depends on external nonvolatile CMOS data, which is not invented.

## Build/test/trace

Node.js 22+ recommended:

```sh
npm test                 # Source arithmetic, process list and regression tests + guardrail
npm run build            # Rebuild standalone play.html from modules
npm run source:prepare   # Fetch pinned upstream; source inventory/audit (requires GitHub access)
npm run source:annotate  # Add full original assembly comments locally from a source checkout
```

The **276 automated tests** include the Stage 1–11 suite plus 29 focused Stage 13 checks. The Chromium in-memory page test exercises source UFO/swarmer workbench, projectiles, sound-command state, linked scheduling, player controls and reset with no browser JS errors. **Passing these does not prove MAME/arcade accuracy**; an original-machine differential trace remains outstanding.

## Original-source annotation

The archive contains the annotation tool; it can insert the original assembly immediately before its named JavaScript function *from your own upstream checkout*. The full unlicensed assembly is not included in this archive. `docs/PORT_STATUS.json` lists mapped routines, with the new Stage 11–13 routines flagged `translated-unverified`.

## Stage 13 — additional original enemy and projectile routines

The separate **Stage 12 enemy-process workbench** executes source `UFOLP`, `UFONV`, `MSWM`, `MSWLP` using the original linked process scheduler. The swarmer is constructed by translated `MMSW`/`RANDV`/`OBINIT`; the UFO initial record is a clearly labelled fixture with the original `UFOST` eight-tick shot timer. The source `SHOOT`, `LSHOT`, `GETSHL` and `SNDLD` routines are translated and integrated, so projectiles are allocated in original shell RAM and sound command priority is observable (not audible yet).

| Assembly source | Native JavaScript modules | Mapping |
| --- | --- | --- |
| `defb6.src:4–78` | `original/defb6-ufo.js` | `UFOST`, `UFOLP`, `UFONV`, `UFONV0` |
| `defb6.src:86–113` | `original/defb6-probe.js` | `PRBST` |
| `defb6.src:127–171,197–287` | `original/defb6-swarm.js` | `RANDV`, `MMSW`, `MSWM`, `MSWLP`, `SWBMB` |
| `defb6.src:533–582` | `original/defb6-shoot.js` | `SHOOT`, `LSHOT` |
| `defb6.src:630–646` | `original/defb6-target.js` | `GTARG` |
| `defa7.src:103–121` | `original/defa7.js` | `OBINIT` |

The source-linked tests check signed 8-bit aim, 16-bit velocity, 6809 clamping and damping, frame-independent 6-/3-tick process delays, packed source descriptors, linked process-object ownership, shell caps, sound priority and missing-dependency errors. The source annotation utility still enables original assembly comments before matching JavaScript functions from a local checkout.

**Diagnostic limits:** enemy objects are not yet driven through the complete actual arcade startup, `APVCT`, IRQ/`VELO` position advance and sprite presentation, collision/destruction, or the full round executive. The workbench deliberately holds world positions constant while the original named process routines update their velocity fields; the standalone upper panel remains a flight/graphics diagnostic. The sound-command bus is not DAC audio. `docs/STAGE12_SOURCE_AUDIT.md` gives exact source correspondence and limitations.

## Still incomplete

Complete original startup/`EXEC` integration and process spawning; enemy and collision logic; picture descriptor registry; explosions; cabinet palette; original sound-board DAC synthesis (sound sequencer currently emits PIA command bytes, not audio). The runnable HTML is **diagnostic** and does not pretend that these features work.

## Stage 17 — source wave/UFO integration (2026-11-06)

The upper playfield now runs translated `GEXEC/GEX0/GEX002/GEX11/GEX2/GEX3/GEX6` in the original linked `DISP` / `SLEEP` process schedule. The first UFO, and subsequent UFOs at the source 15-tick executive cadence, are created by translated `UFOST`, allocated through `MKPROC` and `OBINIT` and inserted into source `OPTR`, so they appear in the main `OPROC` framebuffer and `SCNR` scanner. The `UFOLP` animation/steering routine also runs as a translated source process. `GEXEC` caps UFO count at 12. `WDELT` uses the translated source `WVTAB` values.

**Important limits:** Initial `UFOTIM`, `WAVTIM`, `LNDCNT`, and other wave variables still come from *explicit diagnostic values*, not the actual `GETWV`/CMOS/`SINIT` startup. The existing swarmer and lander remain legacy test placements; `LANDST` cannot yet run in this shared playfield without source astronaut registration and target callbacks. The adapter for `APVCT` only links source `GETOB` records into `OPTR`; it is not a fully verified translation of original appearance. UFO projectile creation is deliberately disabled at a documented boundary until source shells/appearance can be connected; there is no invented substitute. The legacy fixture processes are inert and deliberately do not emulate enemy AI. Sound and full-wave completion are still incomplete. Synthetic labels in the adapter are not ROM addresses.

The existing Stage 15 graphics test was corrected to handle original odd-phase picture selection and shared-video writes. Four additional Stage 17 tests cover source spawning, scheduling, the original UFO cap, scanner linkage, and reset. A browser capture is still needed to confirm final arcade appearance; tests establish RAM/video integration, not visual fidelity.


## Stage 18 — lander spawning / target integration (2026-11-06)

The *main* runtime now allows original `GEXEC → GEX2 → LANDST` to create landers;
`LANDST` allocates through `MKPROC/OBINIT`, seeds world position through original
`RAND/HSEED`, inserts through the current APVCT list adapter, chooses a target
using original `GTARG` / `TLIST`, and starts `LANDS0`. `LANDS0`, `LANDG`,
`LANDF`, `LNDFXA` and `SCZ0` have source process-resume dispatch entries.
`GETALT` reads the original BLK71 altitude bank and `LSHOT` uses the
translated `SHOOT/GETSHL` path.

**Accuracy boundary:** A single human's initial `TLIST` entry and starting
coordinates are explicit test fixtures, NOT translated full astronaut/wave
initialisation. Original human sprite descriptions are not yet integrated
into the main playfield, so that test human is not rendered. The first
`RAND`-generated lander in this deterministic seed spawns outside the
current viewport; `SCNR` shows it through the shared OPTR object list.
Swarmer placement remains a diagnostic fixture, and full collision / wave
transition handling is not completed. All pseudo-continuation IDs are
standalone JavaScript handles, not claimed genuine ROM addresses.


## Stage 40 title lettering and original laser explosions

Stage 40 fixes the two reported attract defects: the original PRES1 source glyphs are refreshed after the DEFENDER fragment explosion pass, preserving the full ELECTRONICS INC. / PRESENTS text; original AMODE3/AMOD11 demonstration laser kills now invoke XSVCT -> EXST and run EXPU/EWRITE, rather than merely removing or moving sprites. Original period glyph added without changing BONUS glyph offsets. See `docs/STAGE40_PRESENTATION_TEXT_AND_DEMO_EXPLOSIONS.md` for provenance and original-versus-browser scheduling limits. Sound remains deferred.


## Stage 41 original MESS0 alignment and SAMEX materialisation fixes

Stage 40 incorrectly placed PRESENTS at `$456C` and skipped three source `APVCT` paths: initial Lander, each `AMOD12` enemy, and `AMOD11` post-hit materialisation. Stage 41 uses MESS0 `RLF,RLF,HMC,12` starting at `$3258`, arriving at `$3E6C`; invokes native `SAMEXAP7.APST/EXPU/EWRITE` for the six scripted arrivals and post-kill appearances; and restores the `TEXTP`/`TEXTAB` caption progression with ROM-defined point values. The source-routine integration remains partial and is explicitly documented in `docs/STAGE41_SOURCE_FIDELITY_AUDIT.md`. Audio remains deferred.

## Stage 42 — source scanner enclosure, mini-terrain, cabinet credits

`AMODE1.SRC:LEDRET` calls the existing `DEFA7.BORDER` and sets `STATUS=$D9` after `SCINIT` sets `$DB`. Stage 41 missed both, so the scanner was unframed and adding the frame alone would still leave its miniature terrain blank (`MT1` skips terrain when STATUS bit 1 is set). Stage 42 restores the byte-addressed `BORDER`, source `MTERR` terrain, fixed `$1030` scanner marker, `CRINIT` colour slot 5, `SCORES`, conditionally displayed original `CREDS` text and numeric glyph, and source `STOUT` stars. Title page restart resets status to original `$FB`.

See `docs/STAGE42_DEMO_SCREEN_SOURCE_AUDIT.md` for exact source addresses, cross-checks and remaining boundaries. **This stage is materially closer to the ROM but is not independently certified as 100% frame-identical**: the complete original cooperative task dispatcher, attract object list, original generic MESS0 interpreter, and real cabinet frame-by-frame regression oracle are still incomplete. No audio work was undertaken.


## Stage 43 — logo damage, MUTANT animation, explosion-erased terrain

Stage 42 inadvertently omitted `LEDRET`'s `NEWP CBOMB` process on the instruction page, so the original `SCZP1` MUTANT colour `$C` did not animate. Stage 43 starts that same source process; both original `AMOD12` and `AMOD11` `APVCT` materialisations remain.

Stage 42 also ran `BLK71.BGOUT` only during `SCINIT`, allowing repeated `SAMEX.EERASE` writes to leave permanent holes in the foreground. The same original BLK71 writer is now scheduled after the merged attract framebuffer updates on each displayed frame, so its `STBL`/flavour-table terrain data are restored without hand-drawn ground pixels.

For the Williams logo, the animation continues to use original `LGOTAB/LOGO0` pixel writes. An explicit browser **presentation-only** step uses precisely the nibble addresses traced by the original `LOGO0` to protect completed source lettering while `DEFENS`/`EXPU` uses the same framebuffer. The original `WILLIR` process remains; this overlap repair does **not** purport to be cycle-accurate 6809 scheduling.

The source audit is `docs/STAGE43_LOGO_MUTANT_TERRAIN_AUDIT.md`; regression tests are `tests/stage43-title-mutant-terrain.test.mjs`. No audio work was undertaken.

---

## Readable source edition (formatting-only)

This distribution has all 165 JavaScript and `.mjs` files reindented and split into readable statements; the standalone HTML has been rebuilt from those same readable modules. Original routine names, source-derived data and runtime behaviour are intentionally unchanged. The four tests tied to exact JS whitespace now accept either layout. All 484 tests pass.

Start with [`READABLE_SOURCE_NOTES.md`](READABLE_SOURCE_NOTES.md) and the audited [remaining-feature list](docs/STAGE50_READABILITY_AND_REMAINING_FEATURES.md). The older `docs/SOURCE_INVENTORY.md` describes a *very early* project milestone and must not be used as the current missing-feature list.

## Stage 57 update (source-based boot and random-state audit)

- Factory RAM test **remains seven write/verify passes** (`ROMF8.RAM2/RAM17`, not two visual sweeps). Existing 440-words-per-browser-step pacing remains *unverified* against a physical 6809 trace.
- At browser POWER ON, original `QUASAR` command `$1F` is issued **before** the first RAM-test framebuffer preparation, after user audio unlock.
- `SEED`, `HSEED`, `LSEED` and star-map bytes are retained through attract → game, wave transitions and game → attract, instead of silently reseeding to `$A55A` on every game. The original source `RAND` still generates all positions.
- See `docs/STAGE57_BOOT_AND_RNG_SOURCE_AUDIT.md` and `tests/stage57-boot-sound-and-random.test.mjs`.
