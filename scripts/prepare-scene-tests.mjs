import { mkdir, copyFile } from "node:fs/promises";
const target = new URL("../tests/.snapshot/", import.meta.url);
await mkdir(target, { recursive: true });
for (const name of [
  "scene.js",
  "cats.js",
  "feeding.js",
  "tail-motion.js",
  "social.js",
  "battle-effects.js",
  "furniture-destruction.js",
  "battle-engine.js",
]) {
  await copyFile(
    new URL(`../src/${name}`, import.meta.url),
    new URL(name, target),
  );
}
console.log(
  "Scene test snapshot prepared. With npm run dev active, open /tests/scene-harness.html.",
);
