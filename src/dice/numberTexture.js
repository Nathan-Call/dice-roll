/**
 * Number-face textures rendered with the 2D canvas API.
 *
 * Using canvas (system fonts) rather than a webfont keeps the dice fully
 * self-contained — no network font fetch, so numbers always render. Textures
 * are cached by "value|color" so identical faces share one GPU texture.
 */

import * as THREE from 'three';

const cache = new Map();
const SIZE = 256;

export function getNumberTexture(value, color) {
  const key = `${value}|${color}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, SIZE, SIZE);
  ctx.fillStyle = color;
  ctx.font = `bold ${SIZE * 0.62}px "Segoe UI", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const label = String(value);
  ctx.fillText(label, SIZE / 2, SIZE * 0.52);

  // Underline 6 and 9 so their orientation is unambiguous.
  if (value === 6 || value === 9) {
    ctx.fillRect(SIZE * 0.34, SIZE * 0.78, SIZE * 0.32, SIZE * 0.05);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  cache.set(key, texture);
  return texture;
}

// Standard domino/dice pip layouts on a 3x3 grid (columns/rows in [0,1]).
const PIP_SPOTS = {
  1: [[0.5, 0.5]],
  2: [[0.26, 0.26], [0.74, 0.74]],
  3: [[0.22, 0.22], [0.5, 0.5], [0.78, 0.78]],
  4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]],
  5: [[0.26, 0.26], [0.74, 0.26], [0.5, 0.5], [0.26, 0.74], [0.74, 0.74]],
  6: [
    [0.28, 0.22], [0.72, 0.22],
    [0.28, 0.5], [0.72, 0.5],
    [0.28, 0.78], [0.72, 0.78],
  ],
};

/** Classic d6 face: pips (dots) instead of a digit. Cached by "value|color". */
export function getPipTexture(value, color) {
  const key = `pip:${value}|${color}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, SIZE, SIZE);
  ctx.fillStyle = color;

  const r = SIZE * 0.12;
  for (const [cx, cy] of PIP_SPOTS[value] ?? []) {
    ctx.beginPath();
    ctx.arc(cx * SIZE, cy * SIZE, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  cache.set(key, texture);
  return texture;
}

let glowTexture = null;

/**
 * Soft glowing ring used to highlight the winning face after a roll. White so
 * it can be additively tinted to any colour; a halo (not a disc) so it frames
 * the face without washing out the number.
 */
export function getGlowTexture() {
  if (glowTexture) return glowTexture;

  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  const c = SIZE / 2;

  const gradient = ctx.createRadialGradient(c, c, 0, c, c, c);
  gradient.addColorStop(0.0, 'rgba(255,255,255,0)');
  gradient.addColorStop(0.52, 'rgba(255,255,255,0)');
  gradient.addColorStop(0.74, 'rgba(255,255,255,0.95)');
  gradient.addColorStop(0.9, 'rgba(255,255,255,0.25)');
  gradient.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SIZE, SIZE);

  glowTexture = new THREE.CanvasTexture(canvas);
  glowTexture.anisotropy = 4;
  glowTexture.needsUpdate = true;
  return glowTexture;
}
