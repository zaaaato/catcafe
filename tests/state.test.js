import test from "node:test";
import assert from "node:assert/strict";
import { createCafeStore, getBondLabel, STORAGE_KEY } from "../src/state.js";

function memoryStorage(seed) {
  const values = new Map(seed === undefined ? [] : [[STORAGE_KEY, seed]]);
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

test("saves preferences and affection across visits without autoplaying sound", () => {
  const storage = memoryStorage();
  const first = createCafeStore({ storage });
  first.updateSettings({
    volume: 0.7,
    quality: "high",
    soundEnabled: true,
    ambience: "rain",
    evening: true,
  });
  first.recordInteraction(2, "pet");
  first.markOnboardingSeen();
  const restored = createCafeStore({ storage }).getState();
  assert.deepEqual(restored.settings, {
    volume: 0.7,
    quality: "high",
    soundEnabled: false,
    ambience: "rain",
    evening: true,
    reducedMotion: false,
  });
  assert.deepEqual(restored.bonds, [0, 0, 3, 0, 0, 0]);
  assert.equal(restored.onboardingSeen, true);
});

test("corrupt, missing and future-version data cannot prevent opening the cafe", () => {
  for (const serialized of [
    "invalid json",
    "null",
    "[]",
    '{"version":999}',
    "x".repeat(21000),
  ]) {
    const store = createCafeStore({
      storage: memoryStorage(serialized),
      reducedMotion: true,
    });
    assert.equal(store.getState().settings.reducedMotion, true);
    assert.deepEqual(store.getState().bonds, [0, 0, 0, 0, 0, 0]);
  }
});

test("validates stored settings and clamps impossible values", () => {
  const storage = memoryStorage(
    JSON.stringify({
      version: 1,
      settings: {
        volume: 900,
        quality: "ultra",
        ambience: "unknown",
        evening: "yes",
      },
      bonds: [-3, 1000, "45", null, 44.7],
      onboardingSeen: "yes",
    }),
  );
  const state = createCafeStore({ storage }).getState();
  assert.equal(state.settings.volume, 1);
  assert.equal(state.settings.quality, "balanced");
  assert.equal(state.settings.ambience, "cafe");
  assert.equal(state.settings.evening, false);
  assert.deepEqual(state.bonds, [0, 100, 0, 0, 45, 0]);
  assert.equal(state.onboardingSeen, false);
});

test("restricted storage still allows all interactions in memory", () => {
  const storage = {
    getItem() {
      throw Error("denied");
    },
    setItem() {
      throw Error("quota");
    },
  };
  const store = createCafeStore({ storage });
  assert.equal(store.isPersistent(), false);
  store.updateSettings({ ambience: "garden" });
  assert.equal(store.recordInteraction(0), 3);
  assert.equal(store.getState().settings.ambience, "garden");
});

test("affection cooldown applies per cat and caps at 100", () => {
  let time = 10000;
  const store = createCafeStore({ now: () => time });
  assert.equal(store.recordInteraction(0), 3);
  assert.equal(store.recordInteraction(0, "treat"), 3);
  assert.equal(store.recordInteraction(1), 3);
  time += 3999;
  assert.equal(store.recordInteraction(0), 3);
  time += 1;
  assert.equal(store.recordInteraction(0), 6);
  for (let i = 0; i < 100; i++) {
    time += 4000;
    store.recordInteraction(0);
  }
  assert.equal(store.getState().bonds[0], 100);
  assert.equal(store.recordInteraction(0, "__proto__"), 100);
  assert.equal(store.recordInteraction(9), 0);
});

test("callers and subscribers cannot mutate the private store snapshot", () => {
  const store = createCafeStore();
  store.getState().settings.volume = 500;
  const stop = store.subscribe((state) => {
    state.bonds[0] = 500;
  });
  store.recordInteraction(0);
  assert.equal(store.getState().settings.volume, 0.35);
  assert.equal(store.getState().bonds[0], 3);
  stop();
});

test("reset keeps preferences and permits a new affectionate interaction", () => {
  const store = createCafeStore({ now: () => 1000 });
  store.updateSettings({ quality: "low" });
  store.recordInteraction(1);
  store.resetProgress();
  assert.deepEqual(store.getState().bonds, [0, 0, 0, 0, 0, 0]);
  assert.equal(store.getState().settings.quality, "low");
  assert.equal(store.recordInteraction(1), 3);
});

test("cross-tab synchronization never starts audio and releases its listener", () => {
  const listeners = new Map();
  const eventTarget = {
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: (name) => listeners.delete(name),
  };
  const store = createCafeStore({ eventTarget });
  const incoming = createCafeStore();
  incoming.updateSettings({ soundEnabled: true, volume: 0.2 });
  listeners.get("storage")({
    key: STORAGE_KEY,
    newValue: JSON.stringify(incoming.getState()),
  });
  assert.equal(store.getState().settings.soundEnabled, false);
  assert.equal(store.getState().settings.volume, 0.2);
  store.destroy();
  assert.equal(listeners.size, 0);
  store.updateSettings({ volume: 1 });
  assert.equal(store.getState().settings.volume, 0.2);
});

test("affection labels handle boundaries and untrusted inputs", () => {
  assert.equal(getBondLabel(19), "これから、よろしく");
  assert.equal(getBondLabel(20), "気になる存在");
  assert.equal(getBondLabel(50), "仲良しのともだち");
  assert.equal(getBondLabel(100), "だいすきな人");
  assert.equal(getBondLabel(NaN), "これから、よろしく");
});

test("hands-on care shares a cooldown rather than rewarding tool switching", () => {
  let time = 0;
  const store = createCafeStore({ now: () => time });
  assert.equal(store.recordInteraction(3, "brush"), 2);
  assert.equal(store.recordInteraction(3, "feed"), 2);
  assert.equal(store.recordInteraction(3, "pet"), 2);
  time = 4000;
  assert.equal(store.recordInteraction(3, "feed"), 4);
});
