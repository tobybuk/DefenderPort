# Build and verification record

Source revision was inspected via GitHub at `e74006344b16d19245510b5e55780f90d7606bb8`.

This environment cannot resolve github.com from its local container, so `npm run source:fetch`, the full original-source symbol/label inventory, and reference-assembly differential execution were **not** run here. The JS code is tested using deliberately synthetic address layouts to validate data semantics, and `docs/PORT_STATUS.json` marks all translated routines `translated-unverified`.

The clean source build contains no previous prototype game engine, renderer or sound module. In particular, it does **not** claim that the complete game or even the full original executive is running. It translates only the process management foundation.

Run with Node.js 22+ in a network-connected workspace:

```bash
npm test
npm run source:prepare
npm run source:annotate
```

Inspect `generated/phr6.symbols.json`, `generated/inventory.json` and `generated/annotated/original/defa7.js`. Do not promote a routine to verified until a differential reference trace is captured and tests pass against that trace.

The ZIP excludes the original archived copyrighted assembly; the annotation tool locally reads the upstream checkout and inserts it into generated review files.
