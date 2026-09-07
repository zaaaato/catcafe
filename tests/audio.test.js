import test from "node:test";
import assert from "node:assert/strict";
import { createCafeAudio } from "../src/audio.js";

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};

function harness(t, { supported = true } = {}) {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const originals = {
    document: globalThis.document,
    AudioContext: globalThis.AudioContext,
    webkitAudioContext: globalThis.webkitAudioContext,
  };
  const listeners = new Map();
  const contexts = [];
  const engines = [];
  const document = {
    hidden: false,
    addEventListener: (event, handler) => listeners.set(event, handler),
    removeEventListener: (event) => listeners.delete(event),
  };
  const param = () => ({
    value: 0,
    cancelAndHoldAtTime() {},
    setValueAtTime(value) {
      this.value = value;
    },
    setTargetAtTime(value) {
      this.value = value;
    },
    linearRampToValueAtTime(value) {
      this.value = value;
    },
    exponentialRampToValueAtTime(value) {
      this.value = value;
    },
  });
  class MockContext {
    constructor() {
      this.state = "suspended";
      this.sampleRate = 1000;
      this.currentTime = 10;
      this.destination = {};
      this.nodes = [];
      this.resumeQueue = [];
      this.resumeCalls = 0;
      contexts.push(this);
    }
    node() {
      const result = {
        gain: param(),
        frequency: param(),
        Q: param(),
        pan: param(),
        threshold: param(),
        knee: param(),
        ratio: param(),
        attack: param(),
        release: param(),
        disconnected: false,
        stopped: false,
        connect() {},
        disconnect() {
          this.disconnected = true;
        },
        start() {},
        stop() {
          this.stopped = true;
        },
      };
      this.nodes.push(result);
      return result;
    }
    createGain() {
      return this.node();
    }
    createDynamicsCompressor() {
      return this.node();
    }
    createBiquadFilter() {
      return this.node();
    }
    createOscillator() {
      return this.node();
    }
    createStereoPanner() {
      return this.node();
    }
    createBufferSource() {
      return this.node();
    }
    createBuffer(channels, length) {
      return { getChannelData: () => new Float32Array(length) };
    }
    async resume() {
      this.resumeCalls++;
      if (this.resumeQueue.length) await this.resumeQueue.shift();
      if (this.state === "closed") throw new Error("closed");
      this.state = "running";
    }
    async suspend() {
      if (this.state !== "closed") this.state = "suspended";
    }
    async close() {
      this.state = "closed";
    }
  }
  globalThis.document = document;
  globalThis.AudioContext = supported ? MockContext : undefined;
  globalThis.webkitAudioContext = undefined;
  t.after(async () => {
    for (const engine of engines) await engine.destroy();
    for (const [key, value] of Object.entries(originals)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  });
  return {
    contexts,
    listeners,
    create(options) {
      const engine = createCafeAudio(options);
      engines.push(engine);
      return engine;
    },
    visibility(hidden) {
      document.hidden = hidden;
      listeners.get("visibilitychange")?.();
    },
  };
}

test("silent visits and preference changes never request audio access", async (t) => {
  const h = harness(t);
  const engine = h.create();
  engine.setPreset("rain");
  engine.setVolume(0.3);
  engine.playEffect("purr");
  assert.equal(h.contexts.length, 0);
  assert.equal(engine.getState().enabled, false);
  await engine.toggle();
  assert.equal(h.contexts.length, 1);
  assert.equal(engine.getState().preset, "rain");
  assert.equal(engine.getState().volume, 0.3);
});

test("an unsupported browser stays usable and silent", async (t) => {
  const h = harness(t, { supported: false });
  const engine = h.create();
  assert.equal(await engine.setEnabled(true), false);
  engine.setPreset("garden");
  engine.playEffect("treat");
  assert.deepEqual(engine.getState(), {
    enabled: false,
    preset: "garden",
    volume: 0.65,
    supported: false,
  });
});

test("browser resume rejection resets the switch and allows a later retry", async (t) => {
  const h = harness(t);
  const engine = h.create();
  await engine.setEnabled(true);
  await engine.setEnabled(false);
  h.contexts[0].resumeQueue.push(Promise.reject(new Error("NotAllowedError")));
  assert.equal(await engine.setEnabled(true), false);
  assert.equal(engine.getState().enabled, false);
  assert.equal(await engine.setEnabled(true), true);
});

test("rapid OFF then ON cancels the pending suspension", async (t) => {
  const h = harness(t);
  const engine = h.create();
  await engine.setEnabled(true);
  await engine.setEnabled(false);
  await engine.setEnabled(true);
  t.mock.timers.tick(1000);
  assert.equal(engine.getState().enabled, true);
  assert.equal(h.contexts[0].state, "running");
});

test("OFF wins over an earlier pending ON request", async (t) => {
  const h = harness(t);
  const engine = h.create();
  await engine.setEnabled(true);
  const pending = deferred();
  h.contexts[0].resumeQueue.push(pending.promise);
  const on = engine.setEnabled(true);
  await engine.setEnabled(false);
  pending.resolve();
  await on;
  t.mock.timers.tick(400);
  assert.equal(engine.getState().enabled, false);
  assert.equal(h.contexts[0].state, "suspended");
  assert.equal(h.contexts[0].nodes[0].gain.value, 0);
});

test("returning to the page preserves a visitor’s explicit OFF choice", async (t) => {
  const h = harness(t);
  const engine = h.create();
  await engine.setEnabled(true);
  h.visibility(true);
  t.mock.timers.tick(200);
  assert.equal(h.contexts[0].state, "suspended");
  await engine.setEnabled(false);
  const resumeCalls = h.contexts[0].resumeCalls;
  h.visibility(false);
  t.mock.timers.tick(400);
  assert.equal(h.contexts[0].resumeCalls, resumeCalls);
  assert.equal(engine.getState().enabled, false);
});

test("a stale visibility resume rejection cannot overwrite a newer ON choice", async (t) => {
  const h = harness(t);
  const engine = h.create();
  await engine.setEnabled(true);
  h.visibility(true);
  t.mock.timers.tick(200);
  const pending = deferred();
  h.contexts[0].resumeQueue.push(pending.promise);
  h.visibility(false);
  await engine.setEnabled(false);
  await engine.setEnabled(true);
  pending.reject(new Error("interrupted old resume"));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(engine.getState().enabled, true);
});

test("destroy during pending resume releases nodes and cannot restart audio", async (t) => {
  const h = harness(t);
  const engine = h.create();
  await engine.setEnabled(true);
  const pending = deferred();
  h.contexts[0].resumeQueue.push(pending.promise);
  const on = engine.setEnabled(true);
  await engine.destroy();
  pending.resolve();
  await on;
  t.mock.timers.tick(60000);
  assert.equal(h.contexts[0].state, "closed");
  assert(h.contexts[0].nodes.every((node) => node.disconnected));
  assert.equal(h.listeners.size, 0);
  assert.equal(await engine.toggle(), false);
});

test("rapid ambience switching and effects leave no retained audio nodes on exit", async (t) => {
  const h = harness(t);
  const engine = h.create();
  await engine.setEnabled(true);
  for (const preset of ["garden", "rain", "cafe", "rain"])
    engine.setPreset(preset);
  for (const effect of ["purr", "toy", "treat"]) engine.playEffect(effect);
  engine.setVolume(5);
  assert.equal(engine.getState().volume, 1);
  engine.setVolume(-1);
  assert.equal(engine.getState().volume, 0);
  engine.setVolume(NaN);
  assert.equal(engine.getState().volume, 0);
  await engine.destroy();
  t.mock.timers.tick(60000);
  assert(h.contexts[0].nodes.every((node) => node.disconnected));
});
