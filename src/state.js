/** Local-only preferences and affection. No account, server, analytics or cookies. */
export const STORAGE_KEY = "komorebi.cafe.v1";
const CAT_COUNT = 6;
const SCHEMA_VERSION = 1;
const QUALITIES = new Set(["low", "balanced", "high"]);
const AMBIENCES = new Set(["cafe", "rain", "garden"]);
const INTERACTIONS = Object.freeze({
  pet: 3,
  treat: 2,
  feed: 2,
  brush: 2,
  play: 1,
  toy: 1,
});

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const plainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const copy = (value) => JSON.parse(JSON.stringify(value));

export function getBondLabel(value) {
  const score = Number.isFinite(value) ? clamp(value, 0, 100) : 0;
  if (score >= 80) return "だいすきな人";
  if (score >= 50) return "仲良しのともだち";
  if (score >= 20) return "気になる存在";
  return "これから、よろしく";
}

function defaults(reducedMotion) {
  return {
    version: SCHEMA_VERSION,
    settings: {
      soundEnabled: false,
      ambience: "cafe",
      volume: 0.35,
      reducedMotion,
      quality: "balanced",
      evening: false,
    },
    bonds: Array(CAT_COUNT).fill(0),
    onboardingSeen: false,
  };
}

function validSettings(input, initial) {
  const next = { ...initial };
  if (!plainObject(input)) return next;
  for (const key of ["soundEnabled", "reducedMotion", "evening"]) {
    if (typeof input[key] === "boolean") next[key] = input[key];
  }
  if (Number.isFinite(input.volume)) next.volume = clamp(input.volume, 0, 1);
  if (QUALITIES.has(input.quality)) next.quality = input.quality;
  if (AMBIENCES.has(input.ambience)) next.ambience = input.ambience;
  return next;
}

function hydrate(serialized, initial) {
  if (typeof serialized !== "string" || serialized.length > 20_000)
    return copy(initial);
  try {
    const value = JSON.parse(serialized);
    if (!plainObject(value) || value.version !== SCHEMA_VERSION)
      return copy(initial);
    return {
      version: SCHEMA_VERSION,
      settings: validSettings(value.settings, initial.settings),
      bonds: initial.bonds.map((_, i) =>
        Number.isFinite(value.bonds?.[i])
          ? Math.round(clamp(value.bonds[i], 0, 100))
          : 0,
      ),
      onboardingSeen: value.onboardingSeen === true,
    };
  } catch {
    return copy(initial);
  }
}

/** Injection keeps persistence behavior testable without a browser or network. */
export function createCafeStore({
  storage = null,
  now = () => Date.now(),
  reducedMotion = false,
  eventTarget = null,
} = {}) {
  const initial = defaults(Boolean(reducedMotion));
  let state = copy(initial);
  let persistent = Boolean(storage);
  let destroyed = false;
  const listeners = new Set();
  const lastInteractions = Array(CAT_COUNT).fill(-Infinity);
  try {
    state = hydrate(storage?.getItem(STORAGE_KEY), initial);
  } catch {
    persistent = false;
  }
  // Browsers require a fresh gesture; reopening never starts audio automatically.
  state.settings.soundEnabled = false;

  const notify = () => {
    for (const listener of listeners) {
      try {
        listener(copy(state));
      } catch (error) {
        console.warn("Komorebi preference listener failed:", error);
      }
    }
  };
  const persist = () => {
    try {
      if (storage) {
        storage.setItem(STORAGE_KEY, JSON.stringify(state));
        persistent = true;
      }
    } catch {
      persistent = false;
    }
  };
  const commit = () => {
    persist();
    notify();
  };

  const onStorage = (event) => {
    if (event.key !== STORAGE_KEY || destroyed) return;
    const next = hydrate(event.newValue, initial);
    // Other tabs may update preferences, but cannot turn this tab's audio on.
    next.settings.soundEnabled = state.settings.soundEnabled;
    state = next;
    notify();
  };
  eventTarget?.addEventListener?.("storage", onStorage);

  return {
    getState: () => copy(state),
    isPersistent: () => persistent,
    updateSettings(patch) {
      if (destroyed) return copy(state.settings);
      const next = validSettings(patch, state.settings);
      if (JSON.stringify(next) !== JSON.stringify(state.settings)) {
        state.settings = next;
        commit();
      }
      return copy(state.settings);
    },
    recordInteraction(index, kind = "pet") {
      if (!Number.isInteger(index) || index < 0 || index >= CAT_COUNT) return 0;
      if (destroyed || !Object.hasOwn(INTERACTIONS, kind))
        return state.bonds[index];
      const timestamp = now();
      if (!Number.isFinite(timestamp)) return state.bonds[index];
      // Real affection is leisurely. Holding a key or double clicking adds once.
      const elapsed = timestamp - lastInteractions[index];
      if (elapsed >= 0 && elapsed < 4_000) return state.bonds[index];
      lastInteractions[index] = timestamp;
      const next = Math.min(100, state.bonds[index] + INTERACTIONS[kind]);
      if (next !== state.bonds[index]) {
        state.bonds[index] = next;
        commit();
      }
      return next;
    },
    markOnboardingSeen() {
      if (!destroyed && !state.onboardingSeen) {
        state.onboardingSeen = true;
        commit();
      }
    },
    subscribe(listener) {
      if (typeof listener !== "function")
        throw new TypeError("Listener must be a function");
      if (destroyed) return () => {};
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    resetProgress() {
      if (destroyed) return;
      state.bonds.fill(0);
      lastInteractions.fill(-Infinity);
      commit();
    },
    destroy() {
      destroyed = true;
      listeners.clear();
      eventTarget?.removeEventListener?.("storage", onStorage);
    },
  };
}

let browserStorage = null;
let prefersReducedMotion = false;
try {
  browserStorage = typeof window !== "undefined" ? window.localStorage : null;
} catch {
  /* Private browsing still works. */
}
try {
  prefersReducedMotion =
    globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ??
    false;
} catch {
  /* System preference unavailable. */
}
const store = createCafeStore({
  storage: browserStorage,
  reducedMotion: prefersReducedMotion,
  eventTarget: typeof window !== "undefined" ? window : null,
});
export const getState = store.getState;
export const updateSettings = store.updateSettings;
export const recordInteraction = store.recordInteraction;
export const markOnboardingSeen = store.markOnboardingSeen;
export const subscribe = store.subscribe;
export const isPersistent = store.isPersistent;
export const resetProgress = store.resetProgress;
