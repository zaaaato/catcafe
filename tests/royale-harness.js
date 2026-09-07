import { createCafe } from "./.snapshot/scene.js";
import { cats } from "./.snapshot/cats.js";
import { createBattleEngine } from "./.snapshot/battle-engine.js";
const pending = new Map();
let next = 1;
window.requestAnimationFrame = (callback) => {
  const id = next++;
  pending.set(id, callback);
  return id;
};
window.cancelAnimationFrame = (id) => pending.delete(id);
let clock = performance.now();
let seed = 2941;
const random = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
const events = [];
const cafe = createCafe(
  document.querySelector("canvas"),
  cats,
  {},
  { battle: true },
);
cafe.setQuality("low");
const engine = createBattleEngine({
  autonomous: true,
  random,
  onEvent: (event) => {
    events.push(event);
    cafe.playBattleEvent(event);
  },
});
cafe.setBattleSnapshot(engine.snapshot());
const initialPhase = engine.snapshot().phase;
const samples = [];
window.royaleHarness = {
  snapshot: () => ({
    engine: engine.snapshot(),
    scene: cafe.getSnapshot(),
    events,
  }),
  async advance(seconds) {
    for (let i = 0; i < Math.ceil(seconds * 30); i++) {
      clock += 1000 / 30;
      engine.update(1 / 30, cafe.getBattlePositions());
      cafe.setBattleSnapshot(engine.snapshot());
      const callbacks = [...pending.values()];
      pending.clear();
      callbacks.forEach((callback) => callback(clock));
      if (i % 15 === 0) samples.push(this.snapshot());
      if (i % 60 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
    }
    return this.snapshot();
  },
  async runSmoke() {
    await this.advance(100);
    const cast = events.filter((e) => e.type === "cast");
    const down = samples.filter((s) =>
      s.engine.fighters.some((f) => f.hp === 0),
    );
    const winners = samples.filter((s) => s.engine.phase === "finished");
    return [
      {
        name: "battle begins immediately without a countdown",
        pass: initialPhase === "fighting",
      },
      {
        name: "all six cats cast autonomously",
        pass: new Set(cast.map((e) => e.attacker)).size === 6,
      },
      {
        name: "normal moves and ultimates are both used",
        pass:
          cast.some((e) => e.move.ultimate) &&
          cast.some((e) => !e.move.ultimate),
      },
      {
        name: "cats move around the arena",
        pass: samples.some((s) =>
          s.scene.cats.some(
            (c, i) =>
              Math.hypot(
                c.position.x - Math.sin((i * Math.PI) / 3) * 1.55,
                c.position.z - 0.75 - Math.cos((i * Math.PI) / 3) * 1.25,
              ) > 0.5,
          ),
        ),
      },
      {
        name: "eliminated cats fall onto their side",
        pass: down.some((s) =>
          s.scene.cats.some(
            (c) =>
              s.engine.fighters[c.index].hp === 0 && Math.abs(c.roll) > 1.45,
          ),
        ),
      },
      {
        name: "each completed round has at most one survivor",
        pass:
          winners.length > 0 &&
          winners.every(
            (s) => s.engine.fighters.filter((f) => f.hp > 0).length <= 1,
          ),
      },
      {
        name: "another round starts automatically",
        pass: this.snapshot().engine.round > 1,
      },
      {
        name: "positions remain finite and inside the cafe",
        pass: samples.every((s) =>
          s.scene.cats.every(
            (c) =>
              Object.values(c.position).every(Number.isFinite) &&
              Math.abs(c.position.x) < 5 &&
              c.position.z > -3.1 &&
              c.position.z < 4,
          ),
        ),
      },
    ];
  },
  dispose() {
    cafe.dispose();
  },
};
