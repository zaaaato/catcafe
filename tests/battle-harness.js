import { createCafe } from "./.snapshot/scene.js";
import { cats } from "./.snapshot/cats.js";
import { runBattleSmoke } from "./battle-smoke.js";
import { BATTLE_CATS, createBattleEngine } from "./.snapshot/battle-engine.js";

const pending = new Map();
let next = 1;
window.requestAnimationFrame = (callback) => {
  const id = next++;
  pending.set(id, callback);
  return id;
};
window.cancelAnimationFrame = (id) => pending.delete(id);
let clock = performance.now();
const events = [];
const cafe = createCafe(
  document.querySelector("canvas"),
  cats,
  {},
  { battle: true },
);
cafe.setQuality("low");
const engine = createBattleEngine({
  onEvent: (event) => {
    events.push(event);
    cafe.playBattleEvent(event);
  },
});
cafe.setBattleSnapshot(engine.snapshot());
window.battleHarness = {
  runSmoke() {
    return runBattleSmoke(this);
  },
  catalog: BATTLE_CATS,
  cast: (a, b, move) => {
    const result = engine.cast(a, b, move);
    cafe.setBattleSnapshot(engine.snapshot());
    return result;
  },
  snapshot: () => ({
    engine: engine.snapshot(),
    scene: cafe.getSnapshot(),
    events,
  }),
  async advance(seconds) {
    for (let i = 0; i < Math.ceil(seconds * 30); i++) {
      clock += 1000 / 30;
      engine.update(1 / 30);
      cafe.setBattleSnapshot(engine.snapshot());
      const callbacks = [...pending.values()];
      pending.clear();
      callbacks.forEach((callback) => callback(clock));
      if (i % 60 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
    }
    return this.snapshot();
  },
  reset() {
    engine.reset();
    cafe.resetBattle();
    cafe.setBattleSnapshot(engine.snapshot());
  },
  dispose() {
    cafe.dispose();
  },
};
