import { useState, useCallback, useEffect, useRef } from 'react';
import DiceScene from './components/DiceScene';
import { DICE, DEFAULT_DIE } from './dice/diceConfig';
import { rollDie, setRandomSource, getSourceStatus, SOURCES } from './random/dice';
import { THEMES, DEFAULT_THEME } from './dice/groundTexture';
import './App.css';

// Coarse-pointer (touch) devices get the swipe-to-roll hint.
const IS_TOUCH =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(pointer: coarse)').matches;

const SWIPE_MIN_DISTANCE = 55; // px
const SWIPE_MAX_TIME = 700; // ms

// Short caption shown next to the status dot for each mode.
const STATUS_TEXT = {
  local: 'ready',
  live: 'live',
  fetching: 'fetching…',
  fallback: 'fallback',
};

// Build the source labels once so the <select> doesn't re-instantiate sources.
const SOURCE_OPTIONS = Object.keys(SOURCES).map((id) => ({
  id,
  label: SOURCES[id]().label,
}));

export default function App() {
  const [config, setConfig] = useState(DEFAULT_DIE);
  const [result, setResult] = useState(null);
  const [rollId, setRollId] = useState(0);
  const [rollDir, setRollDir] = useState(null);
  const [rolling, setRolling] = useState(false);
  const [sourceId, setSourceId] = useState('local');
  const [status, setStatus] = useState(() => getSourceStatus());
  const [theme, setTheme] = useState(DEFAULT_THEME.id);

  // Poll the active source so the indicator reflects buffering/fallback live.
  useEffect(() => {
    const tick = () => setStatus(getSourceStatus());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [sourceId]);

  const roll = useCallback(
    async (dir = null) => {
      if (rolling) return;
      setRolling(true);
      try {
        // Await the source (a network source may still be fetching), then start
        // the animation once we have the result. `dir` (from a swipe) steers
        // which way the die rolls; null means a random direction.
        const value = await rollDie(config.sides);
        setRollDir(dir);
        setResult(value);
        setRollId((id) => id + 1);
      } catch {
        setRolling(false);
      }
    },
    [config.sides, rolling],
  );

  // Swipe-to-roll: a quick one-finger flick on the stage rolls the dice.
  // (Two-finger drag still orbits the camera — see DiceScene.)
  const swipeStart = useRef(null);
  const onTouchStart = useCallback((e) => {
    if (e.touches.length !== 1) {
      swipeStart.current = null; // multi-touch is an orbit gesture, not a swipe
      return;
    }
    const t = e.touches[0];
    swipeStart.current = { x: t.clientX, y: t.clientY, time: performance.now() };
  }, []);
  const onTouchEnd = useCallback(
    (e) => {
      const start = swipeStart.current;
      swipeStart.current = null;
      if (!start || e.touches.length > 0) return; // ignore if fingers remain
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      const dist = Math.hypot(dx, dy);
      const dt = performance.now() - start.time;
      if (dist >= SWIPE_MIN_DISTANCE && dt <= SWIPE_MAX_TIME) {
        // Direction the die should roll (screen X -> world X, screen down ->
        // toward camera), with a 0..1 "power" from the swipe length.
        const power = Math.min(1, (dist - SWIPE_MIN_DISTANCE) / 220);
        roll({ x: dx / dist, y: dy / dist, power });
      }
    },
    [roll],
  );

  const selectDie = useCallback((die) => {
    setConfig(die);
    setResult(null);
    setRolling(false);
  }, []);

  const selectSource = useCallback((id) => {
    setRandomSource(id);
    setSourceId(id);
    setStatus(getSourceStatus());
  }, []);

  return (
    <div className="app">
      <header className="topbar">
        <h1>Dice&nbsp;Lab</h1>
        <div className="selectors">
          <label className="picker">
            <span>Table</span>
            <select value={theme} onChange={(e) => setTheme(e.target.value)}>
              {THEMES.map((th) => (
                <option key={th.id} value={th.id}>
                  {th.label}
                </option>
              ))}
            </select>
          </label>
          <label className="picker">
            <span>Randomness</span>
            <select value={sourceId} onChange={(e) => selectSource(e.target.value)}>
              {SOURCE_OPTIONS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <span className={`src-status ${status.mode}`}>
              <span className="src-dot" />
              {STATUS_TEXT[status.mode]}
              {status.buffered != null && status.mode === 'live'
                ? ` · ${status.buffered}`
                : ''}
            </span>
          </label>
        </div>
      </header>

      <main className="stage" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <DiceScene
          config={config}
          result={result}
          rollId={rollId}
          rollDir={rollDir}
          onSettled={() => setRolling(false)}
          theme={theme}
        />
        <div className={`result ${result != null && !rolling ? 'show' : ''}`}>
          <span className="result-value" style={{ color: config.body }}>
            {result ?? '—'}
          </span>
          <span className="result-label">{config.label}</span>
        </div>
        {IS_TOUCH && (
          <div className={`swipe-hint ${rolling ? 'hidden' : ''}`}>
            Swipe to roll
          </div>
        )}
      </main>

      <footer className="controls">
        <div className="dice-picker">
          {DICE.map((die) => (
            <button
              key={die.type}
              className={`die-chip ${die.type === config.type ? 'active' : ''}`}
              style={{ '--chip': die.body }}
              onClick={() => selectDie(die)}
            >
              {die.label}
            </button>
          ))}
        </div>
        <button className="roll-btn" onClick={() => roll()} disabled={rolling}>
          {rolling ? 'Rolling…' : `Roll ${config.label}`}
        </button>
      </footer>
    </div>
  );
}
