import { useState, useCallback } from 'react';
import DiceScene from './components/DiceScene';
import { DICE, DEFAULT_DIE } from './dice/diceConfig';
import { rollDie, setRandomSource, SOURCES } from './random/dice';
import { THEMES, DEFAULT_THEME } from './dice/groundTexture';
import './App.css';

// Build the source labels once so the <select> doesn't re-instantiate sources.
const SOURCE_OPTIONS = Object.keys(SOURCES).map((id) => ({
  id,
  label: SOURCES[id]().label,
}));

export default function App() {
  const [config, setConfig] = useState(DEFAULT_DIE);
  const [result, setResult] = useState(null);
  const [rollId, setRollId] = useState(0);
  const [rolling, setRolling] = useState(false);
  const [sourceId, setSourceId] = useState('crypto');
  const [theme, setTheme] = useState(DEFAULT_THEME.id);

  const roll = useCallback(() => {
    if (rolling) return;
    setResult(rollDie(config.sides));
    setRollId((id) => id + 1);
    setRolling(true);
  }, [config.sides, rolling]);

  const selectDie = useCallback((die) => {
    setConfig(die);
    setResult(null);
    setRolling(false);
  }, []);

  const selectSource = useCallback((id) => {
    setRandomSource(id);
    setSourceId(id);
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
          </label>
        </div>
      </header>

      <main className="stage">
        <DiceScene
          config={config}
          result={result}
          rollId={rollId}
          onSettled={() => setRolling(false)}
          theme={theme}
        />
        <div className={`result ${result != null && !rolling ? 'show' : ''}`}>
          <span className="result-value" style={{ color: config.body }}>
            {result ?? '—'}
          </span>
          <span className="result-label">{config.label}</span>
        </div>
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
        <button className="roll-btn" onClick={roll} disabled={rolling}>
          {rolling ? 'Rolling…' : `Roll ${config.label}`}
        </button>
      </footer>
    </div>
  );
}
