# Stage 55 — Defender cabinet startup, coin/start and operator controls

## Primary provenance

1. **Williams Defender early-series operating/setup booklet**, 16P-3000-103, pp. 1–5: `https://www.coinopstuff.com/manuals/williams-defender-early-upright-instruction-manual.pdf`.
2. **Aaron Liddiment's 3 January 1995 transcription** of Williams' booklet, at `https://www.mikesarcade.com/cgi-bin/spies.cgi?action=url&type=info&page=DefenderSetup.txt`.
3. **Pinned Red Label source** `https://github.com/mwenge/defender/tree/e74006344b16d19245510b5e55780f90d7606bb8/src` (not a ROM emulator).

## Is the linked setup page describing original game routines?

The source is a Usenet response **quoting the original Williams operator manual**, not a disassembly or an API. Its numbered "Functions" are cabinet bookkeeping display/adjustment **function numbers**, not JavaScript functions and not physical DIP positions. The values are stored in the original game's CMOS-backed configuration and read by original game routines.

Source relationships in our port:

| Manual component | Original routine / storage | Stage 55 |
| --- | --- | --- |
| Coin switches, hardware debounce | `DEFA7.CSCAN`, `SSCAN`, `SWTAB`, `START1`/`START2` | Separate browser coin ledger; original full physical input path not yet complete |
| Credits and attract display | `PHR6.CREDIT`, `AMODE1.CREDS`, `RCMOSB` | Attract reads current cabinet credit count, no fake credits |
| Bonus ship threshold | `DEFA7.START`, `SCORE`, `REPLA`, `P1RP` | Function 08 applied to the new game at START |
| Ships per game | `DEFA7.START`, `NSHIP`, `P1LAS`, `P1SBC` | Function 09 applied on START; original finite ammunition is active |
| Operator coinage/price | `ROMC8` factory values; coin/credit logic | Manual defaults and configurable browser ledger; nondefault table selects NOT fully translated |
| Background sound / difficulty / planet restoration | CMOS adjustment readers, `GETWV`, source wave process | Settings retained but some behavioural application still missing |
| High-score records | `AMODE1.HALLOF` and CMOS table | Existing Hall of Fame adapter remains in place |

### Original adjustment settings (08–21)

| Function | Factory | Description |
| --- | ---: | --- |
| 08 | 10000 | Bonus ship level |
| 09 | 3 | Ships per game |
| 10 | 3 | Coinage selection |
| 11 | 1 | Left coin multiplier |
| 12 | 4 | Centre coin multiplier |
| 13 | 1 | Right coin multiplier |
| 14 | 1 | Coins for credit |
| 15 | 0 | Coins for bonus |
| 16 | 0 | Minimum coins |
| 17 | 0 | Free play |
| 18 | 0 | Starting difficulty |
| 19 | 10 | Progressive difficulty limit |
| 20 | 1 | Background sound |
| 21 | 5 | Planet restoration wave |

Functions 1–7 are counters: coins per chute, paid games, bonus ships, playtime and ships played. Functions 22–27 are marked unused in the cited booklet. Function 28 performs special/service operations, not a switch.

### DIP switches?

The setup page does not describe physical DIP banks for these functions. **No DIP switches need to be created** to select these settings. The cabinet's **AUTO-UP/MANUAL-DOWN**, **ADVANCE** and **HIGH SCORE RESET** switches operate the bookkeeping and adjustments on the original machine. Stage 55 provides them through an optional operator menu instead of a literal DIP panel.

## Stage 55 boot behaviour

The booklet states that initial RAM/ROM/battery checks produce random-looking video patterns, then game-over/attract. It identifies "INITIAL TESTS OK" as a successful power-on indication. The original test ROM implementation is a **missing translation**; the project does NOT have original physical ROM/RAM/CMOS hardware, so it cannot truthfully claim that those tests ran. `browser/cabinet-boot.js` supplies a separate visual reference display and an actual native-JS RAM sanity check, NOT an equivalent 6809 diagnostic. Timing and noise graphics are browser presentation choices, not ROM-derived cycles or bitmaps.

Under MENU > SERVICE TEST SCREENS, the optional manual-derived reference pages cover ROM TEST 1, RAM TEST 2, CMOS TEST 3, COLOUR TEST 4, SWITCH TEST 6 and MONITOR TEST 7; the "NO CABINET ROM CHECK" footer is intentional. These are service/reference pages, not the automatic boot sequence.

## New cabinet sequence

- On load, show the boot reference screens before entering the existing source-driven attract animation.
- Credit count defaults to zero and survives browser reload when local storage is available.
- Left-chute **INSERT COIN** produces one credit with factory pricing and selects the original `CNSND` first command `$19` through the two-write PIA handshake once sound is enabled.
- START is disabled until credit exists (unless an operator explicitly enables original Function 17 Free Play). No anonymous paid game or implicit credits.
- One-player START consumes a single credit, calls the existing `ST1SND` and starts normal source game flow. Paid credits remain on the cabinet if one is inserted during a game.
- Two-player alternating play is **not yet implemented**; do not offer a non-working 2-player button.
- The user-requested keyboard defaults now include **Enter for Fire**, maintaining Enter as the separate Start and initials confirmation gesture in those modes. The control storage key advanced to v2 to let the new default take effect, rather than silently using a previous F assignment.
- Default Smart Bombs are the original limited three, not the earlier development-only infinity option.
- The default user interface contains just INSERT COIN, START 1 PLAYER, credit count and MENU; keyboard/audio/operator configuration and diagnostic tools remain in disclosures.

## Known limits / work not claimed as complete

1. Exact boot diagnostic ROM execution, correct diagnostic ROM video bitmaps, timing and real RAM/ROM/CMOS checking remain missing.
2. The complete coin pricing matrix (function 10 selects, centre/right multipliers, bonus coins) is not fully translated; **nonfactory coinage in the browser ledger is an adapter**.
3. Credits are managed at the browser/cabinet boundary, not by a complete original 6809 `CSCAN/START1`/CMOS path.
4. Two-player/alternating play remains missing.
5. Settings 18–21 currently persist but their original gameplay effects are not fully connected. Playtime/bonus-ship audit tracking is not fully translated.
6. A browser typically cannot play the boot `QUASAR` sound automatically: it requires a user gesture to enable Web Audio. The sound remains available from MENU > ENABLE SOUND.
7. Existing exact IRQ/executive timing remains incomplete, per the Stage 51 audit.
8. The new browser menu and boot-reference drawing are clearly separated from original source game/video routines. They are not portrayed as 6809 transliterations.

## Verification

523 Node/native JavaScript tests passing at packaging time, including boot transitions, credit rejection, coin sound trigger connection, credit decrement, operator storage, initial finite ammunition, service-page progression and configuration of new-game ships and replay threshold. We could not complete fresh Chromium GUI validation because this execution environment's managed Chromium policy URLBlocklist blocks every navigation; a previous source-level VM test is not a browser-rendering test.
