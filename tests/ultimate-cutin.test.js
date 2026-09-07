import test from "node:test";
import assert from "node:assert/strict";
import { createCutinQueue } from "../src/ultimate-cutin.js";

function clock() {
  let now = 0;
  let sequence = 0;
  const jobs = new Map();
  return {
    schedule(callback, delay) {
      const id = ++sequence;
      jobs.set(id, { callback, due: now + delay });
      return id;
    },
    cancel(id) {
      jobs.delete(id);
    },
    advance(duration) {
      const end = now + duration;
      while (true) {
        const next = [...jobs.entries()]
          .filter(([, job]) => job.due <= end)
          .sort((a, b) => a[1].due - b[1].due)[0];
        if (!next) break;
        now = next[1].due;
        jobs.delete(next[0]);
        next[1].callback();
      }
      now = end;
    },
    callbacks: () => [...jobs.values()].map((job) => job.callback),
    pending: () => jobs.size,
  };
}

test("six simultaneous ultimates are all displayed in order, two at a time, for a full readable interval", () => {
  const timer = clock();
  const shown = [];
  const visible = new Set();
  const queue = createCutinQueue({
    schedule: timer.schedule,
    cancel: timer.cancel,
    show(item) {
      shown.push(item);
      visible.add(item);
      assert.ok(visible.size <= 2);
      return item;
    },
    hide(item) {
      assert.ok(visible.delete(item));
    },
  });
  for (let i = 0; i < 6; i++) queue.push(i);
  assert.deepEqual([...visible], [0, 1]);
  assert.deepEqual(queue.snapshot().queued, [2, 3, 4, 5]);
  timer.advance(1049);
  assert.deepEqual([...visible], [0, 1]);
  timer.advance(1);
  assert.deepEqual([...visible], [2, 3]);
  timer.advance(1050);
  assert.deepEqual([...visible], [4, 5]);
  assert.deepEqual(shown, [0, 1, 2, 3, 4, 5]);
  timer.advance(1050);
  assert.equal(visible.size, 0);
  assert.equal(timer.pending(), 0);
});

test("round reset removes active and queued ultimates; stale timer callbacks cannot replay the previous round", () => {
  const timer = clock();
  const shown = [];
  const removed = [];
  const queue = createCutinQueue({
    schedule: timer.schedule,
    cancel: timer.cancel,
    show: (item) => {
      shown.push(item);
      return item;
    },
    hide: (item) => removed.push(item),
  });
  for (let i = 0; i < 6; i++) queue.push(i);
  const staleCallbacks = timer.callbacks();
  queue.clear();
  assert.deepEqual(removed, [0, 1]);
  assert.equal(timer.pending(), 0);
  assert.deepEqual(queue.snapshot(), {
    active: [],
    queued: [],
    disposed: false,
  });
  queue.push("next round");
  staleCallbacks.forEach((callback) => callback());
  assert.deepEqual(shown, [0, 1, "next round"]);
  assert.deepEqual(queue.snapshot().active, ["next round"]);
});

test("dispose is idempotent, releases every timer, and ignores later casts", () => {
  const timer = clock();
  const shown = [];
  const removed = [];
  const queue = createCutinQueue({
    schedule: timer.schedule,
    cancel: timer.cancel,
    show: (item) => {
      shown.push(item);
      return item;
    },
    hide: (item) => removed.push(item),
  });
  queue.push("fire");
  queue.push("ice");
  queue.push("lightning");
  queue.dispose();
  queue.dispose();
  queue.push("late event");
  timer.advance(5000);
  assert.deepEqual(shown, ["fire", "ice"]);
  assert.deepEqual(removed, ["fire", "ice"]);
  assert.equal(timer.pending(), 0);
  assert.equal(queue.snapshot().disposed, true);
});
