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
      const engine = createBattleEngine({ autonomous: false });
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
  const engine = createBattleEngine({ autonomous: false });
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
  const engine = createBattleEngine({ autonomous: false });
  assert(engine.cast(0, 1, 0).ok);
  assert.equal(engine.cast(0, 2, 1).code, "global-cooldown");
  engine.update(0.7);
  assert.equal(engine.cast(0, 2, 0).code, "cooldown");
  assert(engine.cast(0, 2, 1).ok);
  engine.update(0.91);
  assert(engine.cast(0, 3, 0).ok);
});

test("ultimate costs 100 energy and regular moves replenish it without overflow", () => {
  const engine = createBattleEngine({ autonomous: false });
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
    const engine = createBattleEngine({ autonomous: false });
    assert(engine.cast(attacker, 0, move).ok);
    assert.equal(engine.cast(0, 3, 0).code, code);
    engine.update(duration + 0.001);
    assert(engine.cast(0, 3, 0).ok);
  }
});

test("shadow slowing extends the cast interval and repeated status hits do not stack rows", () => {
  const engine = createBattleEngine({ autonomous: false });
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
  const engine = createBattleEngine({
    autonomous: false,
    onEvent: (event) => events.push(event),
  });
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

test("large and small time steps agree through burning and permanent round elimination", () => {
  const events = [];
  const large = createBattleEngine({
    autonomous: false,
    onEvent: (event) => events.push(event),
  });
  const small = createBattleEngine({ autonomous: false });
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
  assert.equal(fighter(large, 1).hp, 0);
  assert.equal(fighter(large, 1).eliminated, true);
  const down = events.find((event) => event.type === "down");
  const revive = events.find((event) => event.type === "revive");
  near(down.time, 1.5);
  assert.equal(revive, undefined);
});

test("an eliminated fighter cannot act or return before the next round", () => {
  const engine = createBattleEngine({ autonomous: false });
  assert(engine.cast(5, 0, 3).ok);
  assert(engine.cast(2, 0, 3).ok);
  assert(engine.cast(3, 0, 0).ok);
  assert.equal(fighter(engine, 0).hp, 0);
  assert.equal(fighter(engine, 0).eliminated, true);
  assert.equal(engine.cast(0, 1, 0).code, "attacker-down");
  assert.equal(engine.cast(4, 0, 0).code, "target-down");
  engine.update(30);
  assert.equal(fighter(engine, 0).hp, 0);
  assert.equal(fighter(engine, 0).eliminated, true);
  engine.reset();
  assert.equal(fighter(engine, 0).hp, 100);
  assert.equal(fighter(engine, 0).eliminated, false);
});

test("cast events carry the actual target damage and snapshots cannot edit engine state", () => {
  const events = [];
  const engine = createBattleEngine({
    autonomous: false,
    onEvent: (event) => events.push(event),
  });
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
  const engine = createBattleEngine({ autonomous: false });
  const initial = engine.snapshot();
  burningKnockout(engine);
  engine.update(0.75);
  engine.reset();
  assert.deepEqual(engine.snapshot(), initial);
  assert(engine.cast(0, 1, 3).ok);
});

function seeded(seed) {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}
function runToWinner(engine, maximumSeconds = 90) {
  for (let frame = 0; frame < maximumSeconds / 0.05; frame++) {
    engine.update(0.05);
    if (engine.snapshot().phase === "finished") return engine.snapshot();
  }
  assert.fail("Autonomous battle did not reach a winner");
}

test("spectator mode starts fighting immediately and all six cats move on the first frame", () => {
  const events = [];
  const engine = createBattleEngine({
    random: seeded(1),
    onEvent: (event) => events.push(event),
  });
  assert.equal(engine.snapshot().phase, "fighting");
  assert.equal("countdown" in engine.snapshot(), false);
  assert(
    engine
      .snapshot()
      .fighters.every(
        (f) => f.energy === 35 && f.target === null && f.speed === 0,
      ),
  );
  engine.update(0.05);
  assert.equal(engine.snapshot().phase, "fighting");
  assert(engine.snapshot().fighters.every((f) => f.moveTarget && f.speed > 0));
  assert.equal(
    events.filter((event) => event.type === "round-start").length,
    1,
  );
  const result = runToWinner(engine);
  const attacks = events.filter((event) => event.type === "cast");
  assert.equal(new Set(attacks.map((event) => event.attacker)).size, 6);
  assert(attacks.some((event) => event.move.ultimate));
  assert.equal(result.fighters.filter((f) => !f.eliminated).length, 1);
  assert.equal(result.winner, result.fighters.find((f) => !f.eliminated).index);
  assert.equal(events.filter((event) => event.type === "round-end").length, 1);
});

test("twelve deterministic autonomous matches all reach a winner and never restore eliminated cats mid-round", () => {
  for (let seed = 1; seed <= 12; seed++) {
    const engine = createBattleEngine({ random: seeded(seed) });
    const eliminated = new Set();
    let result;
    for (let frame = 0; frame < 1800; frame++) {
      engine.update(0.05);
      result = engine.snapshot();
      for (const resident of result.fighters) {
        if (eliminated.has(resident.index)) assert(resident.eliminated);
        if (resident.eliminated) {
          eliminated.add(resident.index);
          assert.equal(resident.hp, 0);
          assert.equal(resident.speed, 0);
          assert.equal(resident.moveTarget, null);
        }
        assert(Number.isFinite(resident.hp));
        assert(resident.hp >= 0 && resident.hp <= 100);
      }
      if (result.phase === "finished") break;
    }
    assert.equal(result.phase, "finished", `seed ${seed}`);
    assert.equal(eliminated.size, 5);
  }
});

test("the winner remains for eight seconds before the next round starts fighting immediately", () => {
  const events = [];
  const engine = createBattleEngine({
    random: seeded(7),
    onEvent: (event) => events.push(event),
  });
  const finished = runToWinner(engine);
  const winner = finished.winner;
  engine.update(7.85);
  assert.equal(engine.snapshot().phase, "finished");
  assert.equal(engine.snapshot().winner, winner);
  assert.equal(engine.snapshot().round, 1);
  engine.update(0.2);
  const next = engine.snapshot();
  assert.equal(next.round, 2);
  assert.equal(next.phase, "fighting");
  assert.equal("countdown" in next, false);
  assert.equal(
    events.filter((event) => event.type === "round-start" && event.round === 2)
      .length,
    1,
  );
  assert.equal(next.winner, null);
  assert(
    next.fighters.every(
      (f) => f.hp === 100 && f.energy === 35 && !f.eliminated,
    ),
  );
  assert.equal(
    events.filter((event) => event.type === "reset" && event.round === 2)
      .length,
    1,
  );
});

test("wind moves fastest, earth slowest, and slowing still reduces elemental speed", () => {
  const engine = createBattleEngine({ random: seeded(5) });
  const positions = Array.from({ length: 6 }, (_, index) => ({
    x: index * 0.2,
    y: 0,
    z: 0,
  }));
  engine.update(0.01, positions);
  const speeds = engine.snapshot().fighters.map((f) => f.speed);
  const order = [3, 4, 0, 2, 1, 5];
  for (let i = 1; i < order.length; i++)
    assert(speeds[order[i - 1]] > speeds[order[i]]);
  assert(speeds[3] >= speeds[5] * 30);
  assert(speeds[3] >= 5);
  assert(engine.cast(2, 3, 0).ok);
  engine.update(0.01, positions);
  near(fighter(engine, 3).speed, speeds[3] * 0.55);
  near(fighter(engine, 4).speed, speeds[4]);
});

test("external scene positions are respected and frozen cats receive no movement intent", () => {
  const engine = createBattleEngine({ random: seeded(5) });
  const original = engine.snapshot().fighters.map((f) => ({ ...f.position }));
  engine.update(0, original);
  assert(engine.cast(1, 0, 2).ok);
  engine.update(0.05, original);
  const frozen = fighter(engine, 0);
  assert.equal(frozen.speed, 0);
  assert.equal(frozen.moveTarget, null);
  assert.deepEqual(frozen.position, original[0]);
  const other = engine
    .snapshot()
    .fighters.filter((f) => f.index !== 0 && f.moveTarget);
  assert(other.length > 0);
  for (const resident of other) {
    assert(resident.moveTarget.x >= -1.8 && resident.moveTarget.x <= 1.8);
    assert(resident.moveTarget.z >= -1 && resident.moveTarget.z <= 2.65);
    assert(resident.target !== resident.index);
  }
  assert.deepEqual(
    engine.snapshot().fighters.map((f) => f.position),
    original,
  );
});

test("autonomous ultimates require ordinary attacks first and eliminated opponents are never selected", () => {
  const normals = new Map(),
    dead = new Set();
  const engine = createBattleEngine({
    random: seeded(9),
    onEvent: (event) => {
      if (event.type === "cast") {
        assert(!dead.has(event.target));
        assert(!dead.has(event.attacker));
        if (event.move.ultimate)
          assert((normals.get(event.attacker) ?? 0) >= 3);
        else
          normals.set(event.attacker, (normals.get(event.attacker) ?? 0) + 1);
      }
      if (event.type === "down") dead.add(event.target);
    },
  });
  runToWinner(engine);
  assert.equal(dead.size, 5);
});

test("bad position samples and random values cannot put NaN into an autonomous match", () => {
  const engine = createBattleEngine({ random: () => NaN });
  engine.update(4, [
    { x: NaN, z: 3 },
    { x: 1, y: Infinity, z: 1 },
  ]);
  for (const resident of engine.snapshot().fighters) {
    assert(Number.isFinite(resident.position.x));
    assert(Number.isFinite(resident.position.y));
    assert(Number.isFinite(resident.position.z));
    if (resident.moveTarget)
      assert(
        Number.isFinite(resident.moveTarget.x) &&
          Number.isFinite(resident.moveTarget.z),
      );
  }
  assert.equal(engine.update(Number.MAX_VALUE), false);
});
