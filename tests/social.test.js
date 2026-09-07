import test from "node:test";
import assert from "node:assert/strict";
import { createSocialController } from "../src/social.js";

function cat(index, x, z, scale = 1) {
  return {
    index,
    root: { position: { x, y: -0.015, z }, scale: { z: scale } },
    pose: "stand",
    state: "walk",
    pet: 0,
    feedTime: 0,
    brushTime: 0,
    jump: null,
  };
}
function fixture(options = {}) {
  const cats = options.cats ?? [cat(0, -1.5, 0), cat(1, 1.5, 0), cat(2, 0, 4)];
  const events = [];
  const allowed =
    options.allowed ?? ((x, z) => Math.abs(x) < 8 && Math.abs(z) < 8);
  const clearPath = options.clearPath ?? (() => true);
  const controller = createSocialController(cats, {
    allowed,
    clearPath,
    onEvent: (event) => events.push(event),
  });
  function step(dt = 0.05, context = {}) {
    controller.update(dt, { mode: "relax", ...context });
    // Match the real scene's .13 arrival radius. This catches coordination
    // deadlocks that a driver which teleports exactly onto a goal would miss.
    const moves = cats.map((resident) => {
      const command = controller.get(resident);
      if (!command?.moving) return null;
      const position = resident.root.position;
      const dx = command.target.x - position.x,
        dz = command.target.z - position.z;
      const distance = Math.hypot(dx, dz);
      if (distance <= 0.13) return null;
      const stride = Math.min(command.speed * dt, distance);
      return {
        position,
        x: position.x + (dx / distance) * stride,
        z: position.z + (dz / distance) * stride,
      };
    });
    moves.filter(Boolean).forEach((move) => {
      move.position.x = move.x;
      move.position.z = move.z;
    });
    return controller.snapshot();
  }
  function until(phase, seconds = 35) {
    for (let frame = 0; frame < seconds / 0.05; frame++) {
      if (step().phase === phase) return controller.snapshot();
    }
    assert.fail(
      `Never reached social phase ${phase}: ${JSON.stringify(controller.snapshot())}`,
    );
  }
  return { cats, events, controller, step, until };
}

test("waits six seconds and coordinates only the nearest eligible pair without mutating cats", () => {
  const { cats, controller } = fixture();
  const original = JSON.stringify(cats);
  controller.update(5.9, { mode: "relax" });
  assert.equal(controller.snapshot().active, false);
  controller.update(0.11, { mode: "relax" });
  assert.deepEqual(controller.snapshot().cats, [0, 1]);
  assert.equal(controller.get(cats[2]), null);
  assert.equal(JSON.stringify(cats), original);
  assert(controller.get(cats[0]).moving);
  assert.equal(controller.get(0).partner, 1);
});

test("nose greeting, alternate paws and safe chase all finish with the real scene stopping radius", () => {
  const rig = fixture();
  rig.until("greet");
  const gap = Math.hypot(
    rig.cats[0].root.position.x - rig.cats[1].root.position.x,
    rig.cats[0].root.position.z - rig.cats[1].root.position.z,
  );
  assert(gap >= 1.2 && gap <= 1.42, `nose gap ${gap}`);
  assert.equal(rig.controller.get(0).mood, "お鼻で、こんにちは");
  const stationary = rig.cats.map((item) => ({ ...item.root.position }));
  for (let frame = 0; frame < 20; frame++) rig.step();
  assert.deepEqual(
    rig.cats.map((item) => item.root.position),
    stationary,
  );
  rig.until("pawplay");
  assert.equal(rig.controller.get(0).paw, 1);
  assert.equal(rig.controller.get(1).paw, null);
  for (let frame = 0; frame < 16; frame++) rig.step();
  assert.equal(rig.controller.get(0).paw, null);
  assert.equal(rig.controller.get(1).paw, 0);
  rig.until("chase");
  let minimumGap = Infinity;
  for (let frame = 0; frame < 103; frame++) {
    rig.step();
    const a = rig.cats[0].root.position,
      b = rig.cats[1].root.position;
    minimumGap = Math.min(minimumGap, Math.hypot(a.x - b.x, a.z - b.z));
  }
  assert(minimumGap > 1.1, `chase gap ${minimumGap}`);
  assert.equal(rig.controller.snapshot().active, false);
  assert(rig.controller.snapshot().cooldown > 17);
  assert.deepEqual(
    rig.events.map((event) => event.phase),
    ["approach", "greet", "pawplay", "chase", "end"],
  );
});

test("small and large residents greet without overlapping noses", () => {
  for (const scale of [0.91, 0.94, 1.02]) {
    const rig = fixture({
      cats: [cat(0, -1.4, 0, scale), cat(1, 1.4, 0, scale)],
    });
    rig.until("greet");
    const gap = Math.abs(
      rig.cats[0].root.position.x - rig.cats[1].root.position.x,
    );
    assert(gap >= 0.66 * 2 * scale, `${scale} scale nose gap ${gap}`);
    assert(gap < 0.66 * 2 * scale + 0.11);
  }
});

test("sleep, elevated perches, jumps and direct interactions exclude residents", () => {
  for (const change of [
    (resident) => (resident.pose = "sleep"),
    (resident) => (resident.jump = { stage: "air-up" }),
    (resident) => (resident.pet = 2),
    (resident) => (resident.feedTime = 2),
    (resident) => (resident.brushTime = 2),
    (resident) => (resident.root.position.y = 1),
  ]) {
    const residents = [cat(0, -1.5, 0), cat(1, 1.5, 0)];
    change(residents[1]);
    const rig = fixture({ cats: residents });
    rig.controller.update(8, { mode: "relax" });
    assert.equal(rig.controller.snapshot().active, false);
  }
});

test("every phase cancels safely for another mode, direct interaction or unavailable partner", () => {
  for (const phase of ["approach", "greet", "pawplay", "chase"]) {
    for (const interruption of ["mode", "interaction", "jump"]) {
      const rig = fixture();
      rig.until(phase);
      const before = JSON.stringify(rig.cats.map((item) => item.root.position));
      if (interruption === "jump") rig.cats[0].jump = { stage: "prepare-up" };
      rig.controller.update(0.05, {
        mode: interruption === "mode" ? "treat" : "relax",
        interaction:
          interruption === "interaction" ? { index: 2, kind: "brush" } : null,
      });
      assert.equal(rig.controller.snapshot().active, false);
      assert.equal(rig.controller.get(0), null);
      assert.equal(
        JSON.stringify(rig.cats.map((item) => item.root.position)),
        before,
      );
    }
  }
});

test("blocked approaches time out and an unsafe chase never receives a movement command", () => {
  const frozen = fixture();
  frozen.controller.update(6, { mode: "relax" });
  frozen.controller.update(15, { mode: "relax" });
  assert.equal(frozen.controller.snapshot().active, false);
  assert.equal(frozen.events.at(-1).reason, "approach-timeout");
  let blocked = false;
  const safe = fixture({ clearPath: () => !blocked });
  safe.until("pawplay");
  blocked = true;
  for (let frame = 0; frame < 65; frame++) safe.step();
  assert.equal(safe.controller.snapshot().active, false);
  assert.equal(safe.events.at(-1).reason, "no-safe-chase");
  const never = fixture({ allowed: () => false });
  never.controller.update(10, { mode: "relax" });
  assert.equal(never.controller.snapshot().active, false);
});

test("recently participating pairs yield to another nearby resident after cooldown", () => {
  const rig = fixture({ cats: [cat(0, 0, 0), cat(1, 1.8, 0), cat(2, 0, 2)] });
  rig.controller.update(6, { mode: "relax" });
  assert.deepEqual(rig.controller.snapshot().cats, [0, 1]);
  rig.controller.cancel();
  rig.controller.update(17.9, { mode: "relax" });
  assert.equal(rig.controller.snapshot().active, false);
  rig.controller.update(0.11, { mode: "relax" });
  assert.deepEqual(rig.controller.snapshot().cats, [0, 2]);
});
