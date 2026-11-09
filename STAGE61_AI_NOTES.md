# Stage 61 — attract mode AI player

- The original enemy showcase (AMODE1 through AMOD13) runs unchanged. At its completion the browser host launches an ordinary `createFlightHarness` game via `lab.RESET`, without coins.
- The independent AI in `browser/flight.js` observes source RAM-backed object lists and player state, and drives **only** `lab.INPUT()` switches. It has no direct access to player health, score, enemy hit detection or resources.
- The game engine retains player collisions, finite smart bombs, normal hyperspace risk, lives, scoring, and wave transitions. Death eventually reaches normal GAME OVER. After 180 ticks, an entirely fresh standard game begins. This is the meaning of indefinite attract mode; the AI has no unlimited lives.
- Press WATCH DEMO to restart the show; START GAME uses cabinet credits and replaces the AI with human input.
- AI targets living enemies, favours landers, steers vertically accounting for velocity, gates reverse via the physical switch, pulses fire through SSCAN, and consumes bombs/hyperspace sparingly.
- JS syntax was checked with Node v22. A full real-time browser/gameplay quality assessment was **not** possible in this environment; verify wave survival and attract/human takeover manually.
