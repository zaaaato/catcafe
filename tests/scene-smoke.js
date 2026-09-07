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
  await harness.advance(45);
  harness.assert(
    "all cats safely descend and reach food",
    harness.snapshot().cats.every((c) => c.state === "eat" && c.jump === null),
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
  return harness.report();
}
