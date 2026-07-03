/**
 * Die-type catalogue. Each entry defines how a die looks and how big its
 * numbers render. Geometry is produced by dice/geometry.js from `sides`/`kind`.
 *
 * d6 is the default and uses the classic white body / black numbers. Every
 * other die gets its own colour scheme so they're easy to tell apart.
 */

export const DICE = [
  {
    type: "d4",
    sides: 4,
    kind: "tetrahedron",
    label: "d4",
    body: "#14b8a6", // teal
    number: "#f8f8f5", // #062e2b
    fontScale: 0.62,
    scale: 1.07,
    // A real d4 carries its values at the corners, not the faces. It rests on a
    // face with the result vertex pointing up (see Die.jsx).
    cornerValues: true,
  },
  {
    type: "d6",
    sides: 6,
    kind: "cube",
    label: "d6",
    body: "#f8f8f5", // classic white
    number: "#161616", // classic black
    fontScale: 1.75,
    scale: 1.0,
    isDefault: true,
    pips: true, // classic domino-style dots instead of digits
  },
  {
    type: "d8",
    sides: 8,
    kind: "octahedron",
    label: "d8",
    body: "#f59e0b", // amber
    number: "#f5f3ff",
    fontScale: 0.8,
    scale: 1,
  },
  {
    type: "d10",
    sides: 10,
    kind: "trapezohedron",
    label: "d10",
    body: "#8b5cf6", // violet
    number: "#f5f3ff",
    fontScale: 1,
    // The trapezohedron extends further from its centre than the radius-1
    // solids, so scale it down to sit visually alongside the others.
    scale: 0.67,
  },
  {
    type: "d12",
    sides: 12,
    kind: "dodecahedron",
    label: "d12",
    body: "#22c55e", // green
    number: "#f5f3ff",
    fontScale: 0.62,
    scale: 0.9,
  },
  {
    type: "d20",
    sides: 20,
    kind: "icosahedron",
    label: "d20",
    body: "#ef4444", // crimson
    number: "#f5f3ff",
    fontScale: 0.5,
    scale: 1.0,
  },
];

export const DICE_BY_TYPE = Object.fromEntries(DICE.map((d) => [d.type, d]));

export const DEFAULT_DIE = DICE.find((d) => d.isDefault) ?? DICE[0];
