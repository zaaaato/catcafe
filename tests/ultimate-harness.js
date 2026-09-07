import { mountBattlePage } from "../src/battle-page.js";
import { createCafe } from "./.snapshot/scene.js";
import { BATTLE_CATS, createBattleEngine } from "./.snapshot/battle-engine.js";

let engine;
let present;
const events = [];
const page = mountBattlePage({
  createCafe,
  BATTLE_CATS,
  createBattleEngine(options) {
    present = options.onEvent;
    engine = createBattleEngine({
      ...options,
      autonomous: false,
      onEvent(event) {
        events.push(event);
        options.onEvent(event);
      },
    });
    return engine;
  },
});

// Test-only driver: production mounts the autonomous engine without controls.
window.ultimateHarness = {
  cast(index, ultimate = true) {
    return engine.cast(index, (index + 1) % 6, ultimate ? 3 : 0);
  },
  simultaneous() {
    engine.reset();
    // Exercise six presentation events in one frame independently of status
    // effects, which can prevent later fighters from actually casting.
    BATTLE_CATS.forEach((cat, index) => {
      const move = cat.moves[3];
      present({
        type: "cast",
        attacker: index,
        target: (index + 1) % 6,
        move,
        damage: move.damage,
        effect: move.effect,
      });
    });
  },
  reset: () => engine.reset(),
  snapshot: () => ({ engine: engine.snapshot(), events }),
  dispose: () => page.dispose(),
};
