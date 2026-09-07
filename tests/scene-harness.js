/** Test-only page; this module is not part of the production entry point. */
import { createCafe } from "./.snapshot/scene.js";
import { cats } from "./.snapshot/cats.js";
import { runSceneSmoke } from "./scene-smoke.js";

const canvas = document.querySelector("#test-canvas");
const status = document.querySelector("#status");
const nativeRaf = window.requestAnimationFrame.bind(window);
const nativeCancel = window.cancelAnimationFrame.bind(window);
const nativeRandom = Math.random;
let sequence = 1;
const pending = new Map();
window.requestAnimationFrame = (callback) => {
  const id = sequence++;
  pending.set(id, callback);
  return id;
};
window.cancelAnimationFrame = (id) => pending.delete(id);
let seed = 81273;
Math.random = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
let virtualTime = performance.now();
let simulationTime = 0;
let instance;
const events = [];
let snapshots = [];
let assertions = [];
const record = (type, detail) =>
  events.push({ at: simulationTime, type, ...detail });
function create() {
  instance = createCafe(canvas, cats, {
    onPet: (index) => record("pet", { index }),
    onMood: (index, mood) => record("mood", { index, mood }),
    onFocus: (index) => record("focus", { index }),
    onInteraction: (detail) => record("interaction", detail),
    onSocial: (detail) => record("social", detail),
  });
  virtualTime = performance.now();
  instance.setQuality("low");
  status.textContent =
    "Ready — deterministic virtual clock, real WebGL rendering";
}
function assert(name, condition, detail) {
  const result = {
    name,
    pass: Boolean(condition),
    ...(detail === undefined ? {} : { detail }),
  };
  assertions.push(result);
  return result;
}
function sample() {
  const snapshot = instance.getSnapshot();
  const finite = snapshot.cats.every((cat) =>
    Object.values(cat.position).every(Number.isFinite),
  );
  if (!finite) throw Error("A cat acquired a non-finite position");
  snapshots.push({ at: simulationTime, ...snapshot });
  if (snapshots.length > 3000) snapshots.shift();
  return snapshot;
}
async function advance(seconds, step = 1 / 30) {
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > 120)
    throw Error("Advance accepts 0–120 seconds");
  const frames = Math.ceil(seconds / step);
  for (let i = 0; i < frames; i++) {
    virtualTime += step * 1000;
    simulationTime += step;
    const callbacks = [...pending.values()];
    pending.clear();
    for (const callback of callbacks) callback(virtualTime);
    if (i % 15 === 0) sample();
    if (i % 60 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return sample();
}
create();
window.cafeHarness = {
  advance,
  snapshot: () => instance.getSnapshot(),
  events: () => events.slice(),
  report: () => ({
    seconds: simulationTime,
    assertions,
    events: events.length,
    samples: snapshots.length,
    snapshot: instance.getSnapshot(),
  }),
  moveToy: (dx, dz) => instance.moveToy(dx, dz),
  setMode: (value) => instance.setMode(value),
  setInteraction: (kind, index) => instance.setInteraction(kind, index),
  performInteraction: () => instance.performInteraction(),
  pet: (index) => instance.pet(index),
  focus: (index) => instance.focus(index),
  reset: () => instance.reset(),
  setQuality: (value) => instance.setQuality(value),
  setReducedMotion: (value) => instance.setReducedMotion(value),
  setEvening: (value) => instance.setEvening(value),
  capture: () => instance.capture(),
  assert,
  clearHistory() {
    events.length = 0;
    snapshots = [];
    assertions = [];
  },
  summarize() {
    const poses = [
      ...new Set(snapshots.flatMap((s) => s.cats.map((cat) => cat.pose))),
    ];
    const moods = [
      ...new Set(events.filter((e) => e.type === "mood").map((e) => e.mood)),
    ];
    const heights = snapshots.flatMap((s) =>
      s.cats.map((c) => c.position.y ?? 0),
    );
    const jumps = [
      ...new Set(
        snapshots.flatMap((s) => s.cats.map((c) => c.jump)).filter(Boolean),
      ),
    ];
    const highSpots = [
      ...new Set(
        snapshots
          .flatMap((s) =>
            s.cats.filter((c) => c.position.y > 0.5).map((c) => c.highSpot),
          )
          .filter(Boolean),
      ),
    ];
    return {
      poses,
      moods,
      jumps,
      highSpots,
      minY: Math.min(...heights),
      maxY: Math.max(...heights),
      pendingFrames: pending.size,
    };
  },
  recreate() {
    instance.dispose();
    assert("dispose cancels animation frame", pending.size === 0, pending.size);
    create();
    return instance.getSnapshot();
  },
  dispose() {
    instance.dispose();
    assert("dispose cancels animation frame", pending.size === 0, pending.size);
    window.requestAnimationFrame = nativeRaf;
    window.cancelAnimationFrame = nativeCancel;
    Math.random = nativeRandom;
    return assertions;
  },
};

window.cafeHarness.runSmoke = () => runSceneSmoke(window.cafeHarness);
