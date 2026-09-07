export async function runBattleSmoke(harness) {
  const results = [];
  const assert = (name, pass) => results.push({ name, pass: Boolean(pass) });
  for (let attacker = 0; attacker < 6; attacker++) {
    for (let move = 0; move < 4; move++) {
      harness.reset();
      await harness.advance(0.1);
      const target = (attacker + 1) % 6;
      const cast = harness.cast(attacker, target, move);
      const hit = harness.snapshot();
      await harness.advance(0.8);
      const state = harness.snapshot();
      assert(
        `cat ${attacker}, move ${move}: hit and finite visual reaction`,
        cast.ok &&
          hit.engine.fighters[target].hp ===
            100 - harness.catalog[attacker].moves[move].damage &&
          state.scene.cats.every((cat) =>
            Object.values(cat.position).every(Number.isFinite),
          ),
      );
    }
  }
  harness.reset();
  harness.cast(4, 0, 2);
  assert(
    "paralysis stops the affected cat from casting",
    !harness.cast(0, 1, 0).ok,
  );
  harness.reset();
  harness.cast(0, 1, 2);
  const before = harness.snapshot().engine.fighters[1].hp;
  await harness.advance(2);
  assert(
    "burning continues to reduce HP",
    harness.snapshot().engine.fighters[1].hp < before - 7,
  );
  harness.reset();
  harness.cast(3, 0, 3);
  await harness.advance(0.7);
  const peak = harness.snapshot().scene.cats[0].position;
  assert(
    "wind ultimate lifts and pushes the target",
    peak.y > 0.2 && peak.z > 2.2,
  );
  await harness.advance(2.5);
  assert(
    "the knocked-back cat lands",
    Math.abs(harness.snapshot().scene.cats[0].position.y + 0.015) < 0.001,
  );
  harness.reset();
  await harness.advance(2);
  assert(
    "reset removes lingering damage and displacement",
    harness
      .snapshot()
      .engine.fighters.every(
        (cat) => cat.hp === 100 && cat.statuses.length === 0,
      ) && Math.abs(harness.snapshot().scene.cats[0].position.z - 2) < 0.001,
  );
  harness.reset();
  harness.cast(0, 1, 3);
  await harness.advance(1);
  const furniture = harness.snapshot().scene.furniture;
  assert(
    "ultimate impacts destroy nearby furniture and launch it into the air",
    furniture.destroyedCount > 0 &&
      furniture.items.some(
        (item) => item.state === "flying" && item.position.y > 0.3,
      ),
  );
  await harness.advance(2);
  assert(
    "broken furniture leaves bounded debris after the flight",
    harness
      .snapshot()
      .scene.furniture.items.some((item) => item.state === "destroyed") &&
      harness.snapshot().scene.furniture.debris.active <=
        furniture.debris.capacity,
  );
  harness.reset();
  assert(
    "round reset restores every piece of furniture",
    harness
      .snapshot()
      .scene.furniture.items.every(
        (item) =>
          item.hp === item.maxHp && item.visible && item.state === "intact",
      ) && harness.snapshot().scene.furniture.debris.active === 0,
  );
  return results;
}
