/**
 * randomSources.js
 *
 * Every randomness source implements:
 *
 *   await nextFloat()
 *
 * which returns a float in [0,1).
 *
 * Sources:
 *  - Local Entropy (default)
 *  - Atmospheric Noise (Random.org)
 *  - Quantum RNG (ANU)
 */

const UINT32_MAX = 0x100000000;
const encoder = new TextEncoder();

/* -------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------- */

async function entropyToFloat(data) {
  const hash = await crypto.subtle.digest("SHA-256", data);

  const view = new DataView(hash);

  return view.getUint32(0) / UINT32_MAX;
}

function uint32ToFloat(value) {
  return (value >>> 0) / UINT32_MAX;
}

/* -------------------------------------------------------------
 * Local Entropy Collection
 * ------------------------------------------------------------- */

const entropyPool = [];

function addEntropy(value) {
  entropyPool.push(String(value));

  // Keep the pool bounded
  if (entropyPool.length > 500) entropyPool.shift();
}

window.addEventListener("mousemove", (e) => {
  addEntropy(e.clientX);
  addEntropy(e.clientY);
  addEntropy(performance.now());
});

window.addEventListener("keydown", (e) => {
  addEntropy(e.code);
  addEntropy(performance.now());
});

window.addEventListener("scroll", () => {
  addEntropy(window.scrollX);
  addEntropy(window.scrollY);
  addEntropy(performance.now());
});

window.addEventListener("touchstart", (e) => {
  const t = e.touches[0];

  if (t) {
    addEntropy(t.clientX);
    addEntropy(t.clientY);
  }

  addEntropy(performance.now());
});

window.addEventListener("resize", () => {
  addEntropy(window.innerWidth);
  addEntropy(window.innerHeight);
  addEntropy(performance.now());
});

async function collectLocalEntropy() {
  const cryptoValues = new Uint32Array(16);

  crypto.getRandomValues(cryptoValues);

  const payload = [
    // Web Crypto
    ...cryptoValues,

    // Timing
    performance.now(),
    Date.now(),

    // Browser
    navigator.hardwareConcurrency,
    navigator.deviceMemory ?? 0,
    navigator.language,
    navigator.platform,

    // Screen
    screen.width,
    screen.height,
    screen.colorDepth,

    // Window
    window.innerWidth,
    window.innerHeight,

    // Timezone
    Intl.DateTimeFormat().resolvedOptions().timeZone,

    // User interaction
    ...entropyPool,
  ].join("|");

  return encoder.encode(payload);
}

/* -------------------------------------------------------------
 * Local Entropy Source
 * ------------------------------------------------------------- */

export function createLocalSource() {
  return {
    id: "local",

    label: "Local Entropy",

    description: "Uses browser timing, interaction, and Web Crypto entropy.",

    quality: "High",

    latency: "Instant",

    offline: true,

    async nextFloat() {
      const entropy = await collectLocalEntropy();

      return entropyToFloat(entropy);
    },
  };
}

/* -------------------------------------------------------------
 * Atmospheric Random.org Source
 * ------------------------------------------------------------- */

export function createAtmosphericSource() {
  let cache = [];

  async function refill() {
    const response = await fetch(
      "https://www.random.org/integers/?num=1024&min=0&max=999999999&col=1&base=10&format=plain&rnd=new",
    );

    const text = await response.text();

    cache = text.trim().split("\n").map(Number);
  }

  return {
    id: "atmospheric",

    label: "Atmospheric Noise",

    description: "Generated from atmospheric radio noise via Random.org.",

    quality: "True Random",

    latency: "Network",

    offline: false,

    async nextFloat() {
      if (cache.length === 0) await refill();

      return uint32ToFloat(cache.shift());
    },
  };
}

/* -------------------------------------------------------------
 * Quantum RNG Source (Australian National University)
 * ------------------------------------------------------------- */

export function createQuantumSource() {
  let cache = [];

  async function refill() {
    const response = await fetch("https://qrng.anu.edu.au/API/jsonI.php?length=2048&type=uint16");

    const json = await response.json();

    cache = json.data;
  }

  return {
    id: "quantum",

    label: "Quantum",

    description: "Generated from quantum measurements.",

    quality: "True Random",

    latency: "Network",

    offline: false,

    async nextFloat() {
      if (cache.length < 2) await refill();

      const hi = cache.shift();
      const lo = cache.shift();

      return uint32ToFloat((hi << 16) | lo);
    },
  };
}

/* -------------------------------------------------------------
 * Registry
 * ------------------------------------------------------------- */

export const SOURCES = {
  local: createLocalSource,

  atmospheric: createAtmosphericSource,

  quantum: createQuantumSource,
};
