import { consumeBattleActivation } from "./secret-battle.js";

if (consumeBattleActivation(window.history)) {
  const [
    { mountBattlePage },
    { createCafe },
    { BATTLE_CATS, createBattleEngine },
  ] = await Promise.all([
    import("./battle-page.js"),
    import("./scene.js"),
    import("./battle-engine.js"),
  ]);
  mountBattlePage({ createCafe, BATTLE_CATS, createBattleEngine });
} else {
  await import("./main.js");
}
