/**
 * Procedurally-generated ground/table textures for the different themes.
 *
 * Everything is drawn on a canvas so the app stays self-contained (no image
 * assets to load). Each theme also carries the scene background and lighting
 * accent so switching themes restyles the whole stage coherently.
 */

import * as THREE from 'three';

const TILE = 512;
const cache = new Map();

function makeCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = TILE;
  canvas.height = TILE;
  return canvas;
}

function toTexture(canvas, repeat) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

/** Green felt / poker cloth: flat colour with fine speckled noise. */
function feltCanvas() {
  const canvas = makeCanvas();
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1f6a44';
  ctx.fillRect(0, 0, TILE, TILE);
  for (let i = 0; i < 24000; i++) {
    const x = Math.random() * TILE;
    const y = Math.random() * TILE;
    const shade = Math.random() < 0.5 ? 0 : 255;
    ctx.fillStyle = `rgba(${shade},${shade},${shade},0.05)`;
    ctx.fillRect(x, y, 1.5, 1.5);
  }
  return canvas;
}

/** Wooden table: warm planks with grain streaks. */
function woodCanvas() {
  const canvas = makeCanvas();
  const ctx = canvas.getContext('2d');
  const plankH = TILE / 5;
  const bases = ['#6b4326', '#7a4e2c', '#5f3b20', '#734829', '#68401f'];
  for (let p = 0; p < 5; p++) {
    ctx.fillStyle = bases[p];
    ctx.fillRect(0, p * plankH, TILE, plankH);
    // Grain streaks.
    for (let i = 0; i < 60; i++) {
      const y = p * plankH + Math.random() * plankH;
      ctx.strokeStyle = `rgba(40,24,12,${0.05 + Math.random() * 0.12})`;
      ctx.lineWidth = 0.5 + Math.random();
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(TILE * 0.3, y + 3, TILE * 0.6, y - 3, TILE, y);
      ctx.stroke();
    }
    // Plank seam.
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, p * plankH, TILE, 2);
  }
  return canvas;
}

/** Dark arcade grid with glowing lines. */
function gridCanvas() {
  const canvas = makeCanvas();
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0a0e1a';
  ctx.fillRect(0, 0, TILE, TILE);
  const step = TILE / 8;
  ctx.strokeStyle = '#2de2e6';
  ctx.lineWidth = 2;
  ctx.shadowColor = '#2de2e6';
  ctx.shadowBlur = 8;
  for (let i = 0; i <= 8; i++) {
    const p = i * step;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, TILE);
    ctx.moveTo(0, p);
    ctx.lineTo(TILE, p);
    ctx.stroke();
  }
  return canvas;
}

export const THEMES = [
  {
    id: 'felt',
    label: 'Felt',
    background: '#0e2018',
    fog: '#0e2018',
    groundColor: '#3f9e69',
    accent: '#fff4e6',
    build: feltCanvas,
    repeat: 5,
    roughness: 0.95,
  },
  {
    id: 'wood',
    label: 'Wood',
    background: '#241609',
    fog: '#241609',
    groundColor: '#b0784a',
    accent: '#ffe6c2',
    build: woodCanvas,
    repeat: 3,
    roughness: 0.7,
  },
  {
    id: 'grid',
    label: 'Neon',
    background: '#05060f',
    fog: '#05060f',
    groundColor: '#1a2b46',
    accent: '#9ad7ff',
    build: gridCanvas,
    repeat: 6,
    roughness: 0.4,
  },
];

export const THEME_BY_ID = Object.fromEntries(THEMES.map((t) => [t.id, t]));
export const DEFAULT_THEME = THEMES[0];

/** Get (and cache) the ground texture for a theme id. */
export function getGroundTexture(themeId) {
  if (cache.has(themeId)) return cache.get(themeId);
  const theme = THEME_BY_ID[themeId] ?? DEFAULT_THEME;
  const texture = toTexture(theme.build(), theme.repeat);
  cache.set(themeId, texture);
  return texture;
}
