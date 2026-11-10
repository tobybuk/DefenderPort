# Stage 79 — Stars restored to the source, attract scanner trail fixed

## 1. Stars: `STOUT` falls through into `SBLNK`

The source (`DEFA7.SRC`, star output) is laid out like this:

```
STOUT   ... erase all 16 old star bytes ([0,X] .. [60,X])
STOUT1  ... move each active star by the scroll delta, clamp at $9C/$C0,
            write SCOL & phase mask to [SX,X]
        DECB
        BNE    STOUT1
*
*STAR BLINK
*
SBLNK   LDB    SEED  ...
```

There is no `RTS` between the `STOUT1` loop and `SBLNK`. Every call of `STOUT` (once per frame, from the IRQ) therefore also runs `SBLNK`:
- The star selected by `SEED & $3C` steps its colour by `$11` (masked `$77`).
- If `SEED` is odd, that's all.
- If `SEED` is even, the star is erased and "hypered" to X = `SEED` (or `SEED − $84` when `SEED ≥ $98`).
- If the planet has gone (`STATUS` bit 1), the star also gets a new Y = `(LSEED & $3F) × 3 + YMIN`.

**What the port did.** `STOUT` returned after the loop. `SBLNK` was documented as having "no normal-play call site". A host adapter in `demo/flight-harness.js` called it once per game update, but only on odd `SEED`, so stars changed colour but never jumped. The adapter avoided even `SEED` because of the anti-tamper path below.

**Fix.** `STOUT` now calls `SBLNK` at the end, as the fall-through does, and the adapter is removed. `SBLNK` doesn't call `RAND`; it only reads `SEED`. Gameplay randomness is therefore unchanged.

### The anti-tamper "attract bomb"

On an even `SEED ≥ $98`, `SBLNK` checks `WCURS`. If it isn't `$6245`, and `STATUS` bit 7 is clear (not attract), and `SEED` is exactly `$A0`, it writes `HSEED` to `$A0:LSEED`. That is a random byte in the base page of RAM.

`WCURS` is set by `AMODE1.COPYRT`. If the Williams logo's colour is genuine full red, `COPYRT` stores `CUREND`, the screen address where the logo pen stopped. Simulating `LOGO`'s pen over the port's `LGOTAB` gives exactly `$6245`. A genuine, unmodified board therefore never fires the bomb.

- Game RAM now holds `WCURS = $6245` from `RESET` (the port's game RAM is separate from the attract RAM that runs `COPYRT`).
- The bomb path now matches the source. After `TFR D,X`, `X` stays `$A0:LSEED` for the rest of `SBLNK`, so `STA SX,X` immediately overwrites the blasted byte with `SEED − $84`, and the SMAP star isn't moved.

## 2. Attract scanner trail behind the rising Swarmer

**Symptom.** On the instruction page, while the Swarmer rose to be shot, its scanner blip left a vertical trail.

**Cause.** The scripted attract scene gives each `GETOB`/`APVCT` object a source-format record so that `APST`/`XSVCT` can read it. Those records were placed at `$B000 + n × $10`. That address range is not free:

| Address | Contents |
|---|---|
| `$B05D` | `SETAB`: the scanner's blip erase pointers |
| `$B125` | `STETAB`: the mini-terrain erase pointers |

The 7th record (`$B060`) is the Swarmer's. Every update wrote its `OX16`/`OY16` over `SETAB` entries 6–7. `SCNR` then erased the wrong addresses, and each old blip stayed on screen.

**Fix.** The records now come from the real object pool, `OLIST`, with the source's `OSIZE` (23-byte) stride. That's the pool `SCINIT`'s `OINIT` has just reset and the source's `GETOB` allocates from. The temporary `OPTR` list the port builds for the scanner moved there too, after the 24 records, instead of the fixed `$A700 + n × $20`.

## Tests

- Updated in `tests/stage3.test.mjs`:
  - The two `STOUT` tests now set an odd `SEED`, so the fall-through `SBLNK` only re-colours a different star.
  - The `$A0` test now checks the source's reused-`X` behaviour: `$A022` receives `HSEED`, then `$1C`.
- New in `tests/stage3.test.mjs`:
  - With the genuine `WCURS`, the `$A0` path leaves RAM alone.
  - `STOUT` hypers one star through the fall-through.
- New `tests/stage79-stars-scanner.test.mjs` (4 tests):
  - No Swarmer blip trail on the attract scanner.
  - `SETAB` pointers always stay valid scanner addresses throughout the instruction page.
  - Game `RESET` stores `WCURS = $6245`.
  - Stars hyper-jump during play, with Y unchanged while the planet exists.
  - The first two fail on the Stage 78 code.
- `npm test`: 663 tests pass, plus the source guardrail.
