/**
 * Randomness sources.
 *
 * A "source" is any object implementing `async nextFloat()` returning a value in
 * [0, 1). Keeping the contract this small (and async) is deliberate: network and
 * hardware entropy are inherently asynchronous, and the rest of the app never
 * touches a source directly, so swapping one is a one-line change (see dice.js).
 *
 * Sources:
 *  - Local Entropy (default, instant, offline)
 *  - Atmospheric   (Random.org — atmospheric radio noise)
 *  - Quantum       (ANU QRNG — quantum vacuum fluctuations)
 *
 * The network sources are rate-limited (the Quantum API in particular allows
 * only ~1 request/60s), so they fetch in large batches, serve from a buffer,
 * refill in the background on a cooldown, and transparently fall back to Local
 * Entropy whenever the buffer is empty — so a value is always available, every
 * second, no matter the source.
 */

const UINT32_MAX = 0x100000000; // 2^32
const encoder = new TextEncoder();

/* ------------------------------------------------------------------ *
 * Local entropy pool — one shared collector for the whole app.
 * ------------------------------------------------------------------ */

const entropyPool = [];
let nonce = 0; // monotonic counter so every draw is unique, even back-to-back

function addEntropy(value) {
  entropyPool.push(String(value));
  if (entropyPool.length > 500) entropyPool.shift();
}

if (typeof window !== "undefined") {
  window.addEventListener("mousemove", (e) => {
    addEntropy(e.clientX);
    addEntropy(e.clientY);
    addEntropy(performance.now());
  });
  window.addEventListener("keydown", (e) => {
    addEntropy(e.code);
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
  window.addEventListener("scroll", () => {
    addEntropy(window.scrollX);
    addEntropy(window.scrollY);
  });
}

/** Fold an arbitrary byte payload into a float in [0, 1) via SHA-256. */
async function digestToFloat(bytes) {
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return new DataView(hash).getUint32(0) / UINT32_MAX;
}

/** Snapshot every entropy signal available in the browser right now. */
function collectLocalEntropy() {
  const cryptoValues = new Uint32Array(16);
  crypto.getRandomValues(cryptoValues); // fresh CSPRNG bytes -> always unique

  const nav = typeof navigator !== "undefined" ? navigator : {};
  const scr = typeof screen !== "undefined" ? screen : {};
  const payload = [
    ...cryptoValues,
    nonce++, // guarantees uniqueness across rapid, identical-context draws
    performance.now(),
    Date.now(),
    nav.hardwareConcurrency ?? 0,
    nav.deviceMemory ?? 0,
    nav.language ?? "",
    scr.width ?? 0,
    scr.height ?? 0,
    scr.colorDepth ?? 0,
    ...entropyPool,
  ].join("|");

  return encoder.encode(payload);
}

/** A live float drawn from local entropy — also the universal fallback. */
function localFloat() {
  return digestToFloat(collectLocalEntropy());
}

/** Local Entropy source (default). Instant and works fully offline. */
export function createLocalSource() {
  return {
    id: "local",
    label: "Local Entropy",
    description: "Browser timing, interaction & Web Crypto entropy (SHA-256).",
    quality: "High",
    latency: "Instant",
    offline: true,
    async nextFloat() {
      return localFloat();
    },
  };
}

/* ------------------------------------------------------------------ *
 * Buffered network sources.
 *
 * `refill()` returns a fresh batch of floats. Because refills are rate-limited,
 * we buffer a large batch, top it up in the background before it runs dry, and
 * fall back to local entropy if the buffer empties while we're on cooldown.
 * ------------------------------------------------------------------ */

function createBufferedSource({
  id,
  label,
  description,
  quality,
  cooldownMs,
  lowWater,
  refill,
}) {
  let buffer = [];
  let lastAttempt = 0;
  let inFlight = null;
  let live = false; // has a real batch ever arrived?

  function tryRefill() {
    if (inFlight) return inFlight; // coalesce concurrent refills
    if (Date.now() - lastAttempt < cooldownMs) return null; // respect the limit
    lastAttempt = Date.now();
    inFlight = (async () => {
      try {
        const batch = await refill();
        if (Array.isArray(batch) && batch.length) {
          buffer.push(...batch);
          live = true;
        }
      } catch {
        // Network/CORS/quota failure: stay on cooldown, fall back to local.
      } finally {
        inFlight = null;
      }
    })();
    return inFlight;
  }

  return {
    id,
    label,
    description,
    quality,
    latency: "Network",
    offline: false,

    /** Warm the buffer ahead of the first roll (called when selected). */
    prefetch() {
      if (buffer.length === 0) tryRefill();
    },

    /** Debug/UI: how the source is currently behaving. */
    status() {
      return { buffered: buffer.length, live, fetching: !!inFlight, cooldownMs };
    },

    async nextFloat() {
      // Top up in the background well before the buffer runs dry.
      if (buffer.length < lowWater) tryRefill();
      if (buffer.length > 0) return buffer.shift();

      // Buffer empty: wait for an allowed/in-flight refill, then serve it...
      await tryRefill();
      if (buffer.length > 0) return buffer.shift();

      // ...otherwise keep the dice rolling with local entropy.
      return localFloat();
    },
  };
}

/** Atmospheric Noise source (Random.org). */
export function createAtmosphericSource() {
  return createBufferedSource({
    id: "atmospheric",
    label: "Atmospheric",
    description: "True random from atmospheric radio noise (Random.org).",
    quality: "True Random",
    cooldownMs: 10_000, // be gentle with Random.org's quota
    lowWater: 64,
    async refill() {
      const res = await fetch(
        "https://www.random.org/integers/?num=1024&min=0&max=999999999&col=1&base=10&format=plain&rnd=new",
      );
      if (!res.ok) throw new Error(`Random.org ${res.status}`);
      const text = await res.text();
      // 0..999,999,999 -> [0, 1)
      return text.trim().split("\n").map((n) => Number(n) / 1_000_000_000);
    },
  });
}

/** Quantum source (ANU QRNG). Hard-limited to ~1 request/60s upstream. */
export function createQuantumSource() {
  return createBufferedSource({
    id: "quantum",
    label: "Quantum",
    description: "True random from quantum vacuum fluctuations (ANU QRNG).",
    quality: "True Random",
    cooldownMs: 60_000, // upstream allows only one request per minute
    lowWater: 128,
    async refill() {
      const res = await fetch(
        "https://qrng.anu.edu.au/API/jsonI.php?length=1024&type=uint16",
      );
      if (!res.ok) throw new Error(`ANU QRNG ${res.status}`);
      const json = await res.json();
      if (!json.success || !Array.isArray(json.data)) throw new Error("ANU QRNG payload");
      // uint16 -> [0, 1)
      return json.data.map((v) => v / 65536);
    },
  });
}
