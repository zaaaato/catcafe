/** Run from the dedicated browser harness. Uses actual Three.js/WebGL, a seeded
 * random source and a deterministic animation clock. No production hooks. */
export async function runSceneSmoke(harness) {
  harness.clearHistory();
  harness.recreate();
  harness.setReducedMotion(false);
  harness.setMode("relax");
  await harness.advance(100);
  const observed = harness.summarize();
  harness.assert(
    "cats greet and play with one another",
    [
      "お鼻で、こんにちは",
      "おててで、ちょいちょい",
      "まてまて、追いかけっこ",
    ].every((mood) => observed.moods.includes(mood)),
    observed.moods,
  );

  harness.assert(
    "natural poses",
    ["sit", "sleep", "groom", "knead", "stretch"].every((p) =>
      observed.poses.includes(p),
    ),
    observed.poses,
  );
  harness.assert(
    "both elevated resting places",
    observed.highSpots.length === 2,
    observed.highSpots,
  );
  harness.setMode("treat");
  harness.assert(
    "food mode cancels social play",
    harness.snapshot().cats.every((c) => c.social === null),
  );
  await harness.advance(45);
  // Arrival depends on the cats' current routes and reserved high resting spots.
  // Allow a bounded settling period instead of sampling one arbitrary frame.
  for (
    let attempt = 0;
    attempt < 15 &&
    harness
      .snapshot()
      .cats.some(
        (c) =>
          c.state !== "eat" ||
          c.jump !== null ||
          !c.feeding.active ||
          c.feeding.contactDistance >= 0.02,
      );
    attempt++
  )
    await harness.advance(3);
  harness.assert(
    "all cats safely descend and reach food",
    harness.snapshot().cats.every((c) => c.state === "eat" && c.jump === null),
  );
  harness.assert(
    "mouth touches communal food",
    harness
      .snapshot()
      .cats.every((c) => c.feeding.active && c.feeding.contactDistance < 0.02),
  );
  harness.setMode("play");
  await harness.advance(25);
  const moods = harness.summarize().moods;
  harness.assert(
    "hunting sequence",
    ["おしり、ふりふり…", "えいっ、つかまえた？", "あれ、どこいった？"].every(
      (m) => moods.includes(m),
    ),
  );
  const ball = harness.snapshot().toy;
  harness.assert(
    "rolling ball stays above rug",
    ball.position[1] - ball.radius >= ball.floorY,
  );
  harness.moveToy(100, -100);
  const moved = harness.snapshot().toy;
  await harness.advance(1);
  harness.assert(
    "manual toy stays put inside play area",
    moved.manual &&
      Math.abs(moved.position[0]) < 1.8 &&
      Math.abs(moved.position[2]) < 2.1 &&
      harness.snapshot().toy.position.every((n, i) => n === moved.position[i]),
  );
  harness.setInteraction("brush", 0);
  await harness.advance(2);
  harness.performInteraction();
  await harness.advance(0.2);
  harness.assert(
    "brushing response",
    harness.snapshot().cats[0].mood.includes("ブラシ"),
  );
  await harness.advance(4);
  harness.setInteraction("feed", 0);
  harness.performInteraction();
  await harness.advance(0.2);
  harness.assert(
    "sniff before eating",
    harness.snapshot().cats[0].mood.includes("くんくん"),
  );
  await harness.advance(1.2);
  harness.assert(
    "eat after sniffing",
    harness.snapshot().cats[0].mood.includes("もぐもぐ"),
  );
  await harness.advance(0.7);
  harness.assert(
    "mouth touches individual snack",
    harness.snapshot().cats[0].feeding.contactDistance < 0.02,
  );
  harness.setReducedMotion(true);
  harness.setQuality("high");
  await harness.advance(0.3);
  harness.setQuality("low");
  harness.assert(
    "quality and reduced motion",
    harness.snapshot().quality === "low" && harness.snapshot().reducedMotion,
  );
  const png = harness.capture();
  harness.assert(
    "nonempty PNG capture",
    png.startsWith("data:image/png;base64,") && png.length > 10000,
  );
  harness.setInteraction(null);
  harness.recreate();
  await harness.advance(2);
  const initialTails = harness.snapshot().cats.map((c) => c.tailTip);
  await harness.advance(0.7);
  harness.assert(
    "all six tails flex independently",
    harness
      .snapshot()
      .cats.every(
        (c, i) =>
          c.tailTip.every(Number.isFinite) &&
          Math.abs(c.tailTip[0] - initialTails[i][0]) > 0.00001,
      ),
  );
  return harness.report();
}
