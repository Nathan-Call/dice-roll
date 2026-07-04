# Dice Lab

A dynamic, mobile-friendly 3D dice roller built with React, Vite and
[react-three-fiber](https://r3f.docs.pmnd.rs/). Roll d4, d6, d8, d10, d12 and
d20 in a real 3D scene — drag to orbit, tap to roll.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production bundle in dist/
```

## How it works

- **The randomness decides the result; the die animates to show it.** Each roll
  asks the RNG for a number, then the die tumbles and settles so the winning
  face lies flat, facing the camera, with its number upright.
- **Generic geometry engine** (`src/dice/geometry.js`). Platonic solids come
  from three's built-in geometries; faces are recovered by clustering triangles
  that share an outward direction. The d10 (a pentagonal trapezohedron) is built
  by hand. Numbers are stamped as canvas textures — no webfont fetch, so they
  always render.
- **d6 is the default** with the classic white body / black numbers; every other
  die has its own colour scheme (`src/dice/diceConfig.js`).

## Swapping the source of randomness

The one place randomness lives is `src/random/`:

- `randomSource.js` — a "source" is any object with `async nextFloat(): number`
  in `[0, 1)`. Three are built in:
  - **Local Entropy** (default) — SHA-256 over Web Crypto bytes, browser
    timing, device signals and captured user interaction. Instant and offline.
  - **Atmospheric** — true random from atmospheric radio noise (Random.org).
  - **Quantum** — true random from quantum vacuum fluctuations (ANU QRNG).
- `dice.js` — owns the active source and exposes `rollDie(sides)`, which draws a
  uniform integer with `floor(x * sides)` (correct for any source resolution).

Change the source at runtime (the UI dropdown does exactly this):

```js
import { setRandomSource, rollDie } from './random/dice';

setRandomSource('quantum');    // warms the buffer in the background
await rollDie(20);             // -> 1..20
```

**Rate limits & availability.** The network sources are metered — the ANU
Quantum API allows only ~1 request per 60s. So each network source fetches a
large batch (~1024 values), serves rolls from that buffer, tops it up in the
background on a cooldown (Quantum ≥ 60s, Atmospheric ≥ 10s), and **falls back to
Local Entropy** whenever the buffer is empty or a request fails (offline, CORS,
quota). The upshot: rolls are always available — every second — regardless of
source, and every value is unique.

To add a new source (e.g. a hardware RNG or network beacon), implement
`async nextFloat()` and register the factory in `SOURCES` — nothing else changes.

```js
setRandomSource({ id: 'atmos', label: 'Atmospheric', async nextFloat() { /* ... */ } });
```
