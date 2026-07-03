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

- `randomSource.js` — a "source" is any object with `nextFloat(): number` in
  `[0, 1)`. Three are built in: `crypto` (CSPRNG, default), `math`
  (`Math.random`) and `seeded` (deterministic mulberry32).
- `dice.js` — owns the active source and exposes `rollDie(sides)`, which draws
  an unbiased integer via rejection sampling.

Change the source at runtime (the UI dropdown does exactly this):

```js
import { setRandomSource, rollDie } from './random/dice';

setRandomSource('seeded');   // reproducible rolls
rollDie(20);                 // -> 1..20
```

To add a new source (e.g. a hardware RNG or network beacon), implement
`nextFloat()` and register the factory in `SOURCES` — nothing else changes.

```js
setRandomSource({ id: 'atmos', label: 'Atmospheric', nextFloat: () => /* ... */ });
```
