/** Real WebGL handover test; this file is never imported by the product. */
import { createCafe } from "./.snapshot/scene.js";
import { cats } from "./.snapshot/cats.js";
import { createBattleEngine } from "./.snapshot/battle-engine.js";

const canvas = document.querySelector("#cafe");
const status = document.querySelector("#status");
const nativeRaf = window.requestAnimationFrame;
const nativeCancel = window.cancelAnimationFrame;
const nativeRandom = Math.random;
const pending = new Map();
let nextFrame = 1;
window.requestAnimationFrame = (callback) => {
  const id = nextFrame++;
  pending.set(id, callback);
  return id;
};
window.cancelAnimationFrame = (id) => pending.delete(id);
const seeded = (initial) => {
  let seed = initial;
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
};
Math.random = seeded(81273);
const events = [];
const normalEvents = [];
const assertions = [];
const samples = [];
let contextLosses = 0;
const onContextLost = () => {
  contextLosses++;
};
canvas.addEventListener("webglcontextlost", onContextLost);
const cafe = createCafe(canvas, cats, {
  onPet: (index) => normalEvents.push({ type: "pet", index }),
  onFocus: (index) => normalEvents.push({ type: "focus", index }),
  onInteraction: (detail) => normalEvents.push({ type: "interaction", detail }),
  onSocial: (detail) => normalEvents.push({ type: "social", detail }),
});
cafe.setQuality("low");
const originalContext = canvas.getContext("webgl2");
let clock = performance.now();
let engine = null;
let smokePromise;
let disposed = false;
let simulationSeconds = 0;

const closeArray = (a, b, epsilon = 1e-6) =>
  a.length === b.length &&
  a.every((value, i) => Math.abs(value - b[i]) <= epsilon);
const sameCamera = (a, b) =>
  closeArray(a.position, b.position) && closeArray(a.target, b.target);
const check = (name, pass, detail) => {
  const result = { name, pass: Boolean(pass) };
  if (detail !== undefined) result.detail = detail;
  assertions.push(result);
  return result;
};
function snapshot() {
  return {
    scene: cafe.getSnapshot(),
    engine: engine?.snapshot() ?? null,
    events: events.slice(),
    seconds: simulationSeconds,
  };
}
async function advance(seconds, { driveEngine = true } = {}) {
  if (disposed) throw new Error("The live battle harness is disposed");
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > 120)
    throw new Error("Advance accepts 0–120 seconds");
  const step = 1 / 30;
  for (let i = 0; i < Math.ceil(seconds / step); i++) {
    clock += step * 1000;
    simulationSeconds += step;
    if (engine && driveEngine) {
      engine.update(step, cafe.getBattlePositions());
      cafe.setBattleSnapshot(engine.snapshot());
    }
    const callbacks = [...pending.values()];
    pending.clear();
    callbacks.forEach((callback) => callback(clock));
    if (engine && i % 15 === 0) {
      samples.push({ engine: engine.snapshot(), scene: cafe.getSnapshot() });
      if (samples.length > 400) samples.shift();
    }
    if (i % 60 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return snapshot();
}
function startBattle() {
  if (engine) return;
  cafe.enterBattle();
  engine = createBattleEngine({
    autonomous: true,
    random: seeded(2941),
    onEvent: (event) => {
      events.push(event);
      cafe.playBattleEvent(event);
    },
  });
  cafe.setBattleSnapshot(engine.snapshot());
}

async function runSmoke() {
  status.textContent = "Checking live handover and autonomous rounds…";
  const initial = cafe.getSnapshot();
  check(
    "starts as a normal cafe on a real WebGL canvas",
    !initial.battleMode && initial.battle === null && Boolean(originalContext),
  );

  cafe.setMode("play");
  await advance(0.6);
  const playing = cafe.getSnapshot();
  check(
    "the existing cafe has an active toy before handover",
    playing.mode === "play" && playing.toy.visible,
  );
  cafe.setInteraction("brush", 2);
  await advance(0.4);
  const before = cafe.getSnapshot();
  check(
    "handover begins during an existing close interaction",
    before.interaction?.kind === "brush" &&
      before.camera.controls.enableRotate === false,
  );
  const normalEventCount = normalEvents.length;

  startBattle();
  const entered = cafe.getSnapshot();
  check(
    "handover reuses the exact canvas and WebGL context",
    document.querySelector("#cafe") === canvas &&
      canvas.getContext("webgl2") === originalContext &&
      contextLosses === 0,
  );
  check(
    "handover preserves camera position and target",
    sameCamera(before.camera, entered.camera),
    { before: before.camera, after: entered.camera },
  );
  check(
    "battle owns the scene and receives a live engine snapshot",
    entered.battleMode &&
      entered.battle?.phase === "fighting" &&
      entered.battle.fighters.length === 6,
  );
  check(
    "camera rotation and zoom are available after leaving the interaction",
    entered.camera.controls.enabled &&
      entered.camera.controls.enableRotate &&
      entered.camera.controls.enableZoom,
  );
  check(
    "normal interaction, social behavior, and the toy are released",
    entered.mode === "relax" &&
      entered.interaction === null &&
      entered.focused === -1 &&
      !entered.toy.visible &&
      !entered.toy.dragging &&
      !entered.toy.manual &&
      !entered.social.active &&
      entered.social.commands.length === 0 &&
      entered.cats.every((cat) => cat.social === null && cat.jump === null),
  );

  await advance(0.3);
  check(
    "the former close-up transition cannot pull the battle camera",
    sameCamera(entered.camera, cafe.getSnapshot().camera),
  );
  const preZoom = cafe.getSnapshot().camera;
  cafe.zoom(0.8);
  const zoomed = cafe.getSnapshot().camera;
  check(
    "zoom applies the requested multiplier to the same camera",
    Math.abs(zoomed.distance - preZoom.distance / 0.8) < 1e-6 &&
      closeArray(zoomed.target, preZoom.target),
  );
  await advance(0.4);
  check(
    "autonomous action does not overwrite the visitor's camera",
    sameCamera(zoomed, cafe.getSnapshot().camera),
  );

  const beforeIgnoredInput = cafe.getSnapshot();
  cafe.pet(0);
  cafe.setInteraction("feed", 1);
  cafe.performInteraction();
  cafe.setMode("treat");
  cafe.setMode("play");
  cafe.focus(4);
  cafe.moveToy(0.2, 0.2);
  const afterIgnoredInput = cafe.getSnapshot();
  check(
    "old cafe controls cannot interfere with an active battle",
    afterIgnoredInput.mode === "relax" &&
      afterIgnoredInput.interaction === null &&
      !afterIgnoredInput.toy.visible &&
      afterIgnoredInput.focused === -1 &&
      sameCamera(beforeIgnoredInput.camera, afterIgnoredInput.camera) &&
      JSON.stringify(beforeIgnoredInput.cats) ===
        JSON.stringify(afterIgnoredInput.cats) &&
      normalEvents.length === normalEventCount,
  );

  cafe.enterBattle();
  const repeated = cafe.getSnapshot();
  check(
    "a repeated handover is idempotent",
    sameCamera(repeated.camera, afterIgnoredInput.camera) &&
      JSON.stringify(repeated.cats) ===
        JSON.stringify(afterIgnoredInput.cats) &&
      repeated.battle !== null,
  );
  cafe.resetBattle();
  const reset = cafe.getSnapshot();
  check(
    "resetting the round preserves the visitor's camera and controls",
    sameCamera(zoomed, reset.camera) &&
      reset.camera.controls.enabled &&
      reset.camera.controls.enableRotate &&
      reset.camera.controls.enableZoom,
  );
  cafe.setBattleSnapshot(engine.snapshot());
  await advance(100);
  const final = snapshot();
  const casts = events.filter((event) => event.type === "cast");
  const completed = samples.filter(
    (sample) => sample.engine.phase === "finished",
  );
  check(
    "all six transferred cats participate autonomously",
    new Set(casts.map((event) => event.attacker)).size === 6,
  );
  check(
    "the continuous simulation reaches rounds with at most one survivor",
    completed.length > 0 &&
      completed.every(
        (sample) =>
          sample.engine.fighters.filter((fighter) => fighter.hp > 0).length <=
          1,
      ),
    { completedSamples: completed.length },
  );
  check(
    "a subsequent round starts on the same live scene",
    final.engine.round > 1 &&
      final.scene.battleMode &&
      final.scene.battle !== null,
    { round: final.engine.round },
  );
  check(
    "automatic round resets preserve the visitor's camera",
    sameCamera(zoomed, final.scene.camera),
  );
  check(
    "the original context survives the full live battle",
    canvas.getContext("webgl2") === originalContext &&
      !originalContext.isContextLost() &&
      contextLosses === 0,
  );
  check(
    "all sampled positions remain finite and inside the cafe",
    samples.every((sample) =>
      sample.scene.cats.every(
        (cat) =>
          Object.values(cat.position).every(Number.isFinite) &&
          Math.abs(cat.position.x) < 5 &&
          cat.position.z > -3.1 &&
          cat.position.z < 4,
      ),
    ),
  );
  status.textContent = `${assertions.filter((result) => result.pass).length}/${assertions.length} live handover checks passed`;
  return assertions;
}

window.liveBattleHarness = {
  snapshot,
  advance,
  startBattle,
  runSmoke: () => (smokePromise ??= runSmoke()),
  report: () => ({
    assertions,
    events: events.length,
    normalEvents: normalEvents.length,
    samples: samples.length,
    snapshot: snapshot(),
  }),
  dispose() {
    if (disposed) return;
    disposed = true;
    cafe.dispose();
    pending.clear();
    canvas.removeEventListener("webglcontextlost", onContextLost);
    window.requestAnimationFrame = nativeRaf;
    window.cancelAnimationFrame = nativeCancel;
    Math.random = nativeRandom;
  },
};
status.textContent =
  "Ready — normal cafe, original canvas, deterministic frame clock";
