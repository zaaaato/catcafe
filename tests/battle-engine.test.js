import test from "node:test";
import assert from "node:assert/strict";
import { BATTLE_CATS, createBattleEngine } from "../src/battle-engine.js";
const fighter = (engine, index) => engine.snapshot().fighters[index];
const near = (actual, expected, tolerance = 1e-7) =>
  assert(Math.abs(actual - expected) < tolerance, `${actual} ≈ ${expected}`);

function burningKnockout(engine) {
  assert(engine.cast(5, 1, 3).ok); // 100 -> 51
  assert(engine.cast(2, 1, 1).ok); // 51 -> 28
  assert(engine.cast(3, 1, 0).ok); // 28 -> 16
  assert(engine.cast(0, 1, 0).ok); // 16 -> 6, burn knocks out after 1.5 s.
}

test("catalog contains six immutable elements and 24 unique, immediately usable moves", () => {
  assert.equal(BATTLE_CATS.length, 6);
  const ids = new Set(),
    names = new Set();
  for (const resident of BATTLE_CATS) {
    assert.equal(resident.moves.length, 4);
    assert.equal(resident.moves.filter((move) => move.ultimate).length, 1);
    for (const [index, move] of resident.moves.entries()) {
      ids.add(move.id);
      names.add(move.name);
      assert.equal(move.element, resident.element);
      assert(move.description.length > 5);
      assert(Object.isFrozen(move));
      const engine = createBattleEngine();
      const target = (resident.index + 1) % 6;
      assert(engine.cast(resident.index, target, index).ok);
      assert.equal(fighter(engine, target).hp, 100 - move.damage);
      assert.equal(
        fighter(engine, resident.index).energy,
        move.ultimate ? 0 : 100,
      );
      assert.equal(
        fighter(engine, resident.index).cooldowns[index],
        move.cooldown,
      );
    }
  }
  assert.equal(ids.size, 24);
  assert.equal(names.size, 24);
});

test("invalid indices, self targeting and malformed elapsed time never mutate state", () => {
  const engine = createBattleEngine();
  const initial = engine.snapshot();
  for (const args of [
    [NaN, 1, 0],
    [0, Infinity, 0],
    [0, 0, 0],
    [-1, 1, 0],
    [0, 6, 0],
    [0, 1, -1],
    [0, 1, 4],
    [0, 1, "0"],
    [0.1, 1, 0],
    [0, 1, NaN],
  ]) {
    const result = engine.cast(...args);
    assert.equal(result.ok, false);
    assert(result.reason.length > 0);
    assert.deepEqual(engine.snapshot(), initial);
  }
  for (const dt of [NaN, Infinity, -1, "1", undefined])
    assert.equal(engine.update(dt), false);
  assert.deepEqual(engine.snapshot(), initial);
});

test("global cast delay and per-move cooldown are independently enforced", () => {
  const engine = createBattleEngine();
  assert(engine.cast(0, 1, 0).ok);
  assert.equal(engine.cast(0, 2, 1).code, "global-cooldown");
  engine.update(0.7);
  assert.equal(engine.cast(0, 2, 0).code, "cooldown");
  assert(engine.cast(0, 2, 1).ok);
  engine.update(0.91);
  assert(engine.cast(0, 3, 0).ok);
});

test("ultimate costs 100 energy and regular moves replenish it without overflow", () => {
  const engine = createBattleEngine();
  assert(engine.cast(2, 0, 3).ok);
  assert.equal(fighter(engine, 2).energy, 0);
  engine.update(10);
  assert.equal(engine.cast(2, 0, 3).code, "energy");
  for (let count = 0; count < 5; count++) {
    assert(engine.cast(2, (count % 2) + 3, 0).ok);
    engine.update(1.8);
  }
  assert.equal(fighter(engine, 2).energy, 100);
  assert(engine.cast(2, 1, 3).ok);
  assert.equal(fighter(engine, 2).energy, 0);
});

test("freeze and paralysis block casting only for their remaining duration", () => {
  for (const [attacker, move, duration, code] of [
    [1, 2, 1.6, "frozen"],
    [4, 2, 1.2, "paralyzed"],
  ]) {
    const engine = createBattleEngine();
    assert(engine.cast(attacker, 0, move).ok);
    assert.equal(engine.cast(0, 3, 0).code, code);
    engine.update(duration + 0.001);
    assert(engine.cast(0, 3, 0).ok);
  }
});

test("shadow slowing extends the cast interval and repeated status hits do not stack rows", () => {
  const engine = createBattleEngine();
  assert(engine.cast(2, 0, 0).ok);
  assert(engine.cast(0, 3, 0).ok);
  engine.update(0.71);
  assert.equal(engine.cast(0, 3, 1).code, "global-cooldown");
  engine.update(0.35);
  assert(engine.cast(0, 3, 1).ok);
  assert(engine.cast(2, 0, 2).ok);
  const slows = fighter(engine, 0).statuses.filter(
    (status) => status.type === "slow",
  );
  assert.equal(slows.length, 1);
  assert(slows[0].remaining <= 5);
});

test("burn expires exactly and visual damage events are bounded at two per second", () => {
  const events = [];
  const engine = createBattleEngine({ onEvent: (event) => events.push(event) });
  assert(engine.cast(0, 1, 2).ok);
  for (let frame = 0; frame < 600; frame++) engine.update(1 / 60);
  near(fighter(engine, 1).hp, 70);
  assert.deepEqual(fighter(engine, 1).statuses, []);
  const ticks = events.filter((event) => event.type === "damage");
  assert.equal(ticks.length, 8);
  near(
    ticks.reduce((sum, event) => sum + event.damage, 0),
    16,
  );
});

test("large and small time steps agree through burning, knockout and revival", () => {
  const events = [];
  const large = createBattleEngine({ onEvent: (event) => events.push(event) });
  const small = createBattleEngine();
  burningKnockout(large);
  burningKnockout(small);
  large.update(8);
  for (let frame = 0; frame < 480; frame++) small.update(1 / 60);
  for (let index = 0; index < 6; index++) {
    const a = fighter(large, index),
      b = fighter(small, index);
    near(a.hp, b.hp);
    near(a.energy, b.energy);
    near(a.downRemaining, b.downRemaining);
    a.cooldowns.forEach((remaining, move) =>
      near(remaining, b.cooldowns[move]),
    );
  }
  assert.equal(fighter(large, 1).hp, 100);
  const down = events.find((event) => event.type === "down");
  const revive = events.find((event) => event.type === "revive");
  near(down.time, 1.5);
  near(revive.time, 6.5);
});

test("a down fighter cannot act or be targeted and returns after five seconds", () => {
  const engine = createBattleEngine();
  assert(engine.cast(5, 0, 3).ok);
  assert(engine.cast(2, 0, 3).ok);
  assert(engine.cast(3, 0, 0).ok);
  assert.equal(fighter(engine, 0).hp, 0);
  assert.equal(engine.cast(0, 1, 0).code, "attacker-down");
  assert.equal(engine.cast(4, 0, 0).code, "target-down");
  engine.update(4.99);
  assert(fighter(engine, 0).downRemaining > 0);
  engine.update(0.02);
  assert.equal(fighter(engine, 0).hp, 100);
  assert.equal(fighter(engine, 0).energy, 100);
  assert(engine.cast(0, 1, 3).ok);
});

test("cast events carry the actual target damage and snapshots cannot edit engine state", () => {
  const events = [];
  const engine = createBattleEngine({ onEvent: (event) => events.push(event) });
  engine.cast(5, 0, 3);
  engine.cast(2, 0, 3);
  engine.cast(3, 0, 0);
  const hit = events.filter((event) => event.type === "cast").at(-1);
  assert.equal(hit.attacker, 3);
  assert.equal(hit.target, 0);
  assert.equal(hit.damage, 5);
  assert.equal(hit.move, BATTLE_CATS[3].moves[0]);
  const snapshot = engine.snapshot();
  snapshot.fighters[1].hp = -100;
  snapshot.fighters[1].cooldowns[0] = 999;
  snapshot.fighters[1].statuses.push({ type: "freeze", remaining: 999 });
  assert.equal(fighter(engine, 1).hp, 100);
  assert.equal(fighter(engine, 1).cooldowns[0], 0);
  assert.deepEqual(fighter(engine, 1).statuses, []);
});

test("reset clears every combat timer, effect and resource change", () => {
  const engine = createBattleEngine();
  const initial = engine.snapshot();
  burningKnockout(engine);
  engine.update(0.75);
  engine.reset();
  assert.deepEqual(engine.snapshot(), initial);
  assert(engine.cast(0, 1, 3).ok);
});
