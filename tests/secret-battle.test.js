import test from "node:test";
import assert from "node:assert/strict";
import {
  activateBattle,
  consumeBattleActivation,
} from "../src/secret-battle.js";

test("the secret activates once, preserving unrelated history state and the URL", () => {
  const history = {
    state: { other: 42 },
    replaceState(state, title, url) {
      assert.equal(url, undefined);
      this.state = state;
    },
  };
  let reloaded = 0;
  assert.equal(consumeBattleActivation(history), false);
  activateBattle(history, () => reloaded++);
  assert.equal(reloaded, 1);
  assert.equal(consumeBattleActivation(history), true);
  assert.deepEqual(history.state, { other: 42 });
  assert.equal(consumeBattleActivation(history), false);
});

test("hover and touch must linger; leaving, moving or releasing cancels the secret", async (t) => {
  const { installBattleSecret } = await import("../src/secret-battle.js");
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  globalThis.window = new EventTarget();
  globalThis.document = Object.assign(new EventTarget(), { hidden: false });
  t.after(() => {
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
  });
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const classes = new Set();
  const icon = Object.assign(new EventTarget(), {
    classList: {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
    },
    setAttribute() {},
    removeAttribute() {},
  });
  let activations = 0;
  const dispose = installBattleSecret(icon, {
    onActivate: () => activations++,
  });
  t.after(dispose);
  const emit = (target, type, values = {}) => {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, values);
    target.dispatchEvent(event);
  };
  emit(icon, "pointerenter", { pointerType: "mouse" });
  t.mock.timers.tick(1400);
  assert.equal(classes.has("secret-charging"), true);
  emit(icon, "pointerleave");
  t.mock.timers.tick(5000);
  assert.equal(activations, 0);
  emit(icon, "pointerdown", {
    pointerType: "touch",
    isPrimary: true,
    pointerId: 7,
    clientX: 20,
    clientY: 20,
  });
  t.mock.timers.tick(1400);
  emit(window, "pointermove", { pointerId: 7, clientX: 40, clientY: 20 });
  t.mock.timers.tick(5000);
  assert.equal(activations, 0);
  emit(icon, "pointerdown", {
    pointerType: "touch",
    isPrimary: true,
    pointerId: 8,
    clientX: 20,
    clientY: 20,
  });
  t.mock.timers.tick(2000);
  emit(window, "pointerup", { pointerId: 8 });
  t.mock.timers.tick(5000);
  assert.equal(activations, 0);
  emit(icon, "pointerdown", {
    pointerType: "touch",
    isPrimary: true,
    pointerId: 9,
    clientX: 20,
    clientY: 20,
  });
  t.mock.timers.tick(4200);
  assert.equal(activations, 1);
  emit(icon, "pointerenter", { pointerType: "mouse" });
  t.mock.timers.tick(5000);
  assert.equal(activations, 1);
});
