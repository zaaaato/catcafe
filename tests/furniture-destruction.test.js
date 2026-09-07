import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createFurnitureDestruction } from "../src/furniture-destruction.js";

// Real meshes share graphics resources, as the cafe furniture does. The
// controller owns its debris, never these source geometries or materials.
function makeFurnitureScene() {
  const scene = new THREE.Scene();
  const material = new THREE.MeshStandardMaterial({ color: 0xaa7755 });
  const geometry = new THREE.BoxGeometry(1, 0.5, 1);
  const near = new THREE.Group();
  near.name = "near-table";
  near.position.set(0, 0.4, 0);
  near.rotation.set(0.02, 0.17, -0.01);
  near.scale.set(1.1, 0.9, 1.05);
  const top = new THREE.Mesh(geometry, material);
  top.position.y = 0.4;
  near.add(top);
  const leg = new THREE.Mesh(geometry, material);
  leg.scale.set(0.12, 1.5, 0.12);
  leg.position.set(0.3, -0.2, 0.3);
  near.add(leg);
  const far = near.clone(true);
  far.name = "far-table";
  far.position.set(12, 0.4, 12);
  scene.add(near, far);
  scene.updateMatrixWorld(true);
  return { scene, material, geometry, near, far };
}

function remember(root) {
  const transforms = new Map();
  root.traverse((object) =>
    transforms.set(object, {
      position: object.position.toArray(),
      quaternion: object.quaternion.toArray(),
      scale: object.scale.toArray(),
      visible: object.visible,
    }),
  );
  return transforms;
}

function assertRestored(transforms) {
  for (const [object, original] of transforms) {
    assert.deepEqual(
      object.position.toArray(),
      original.position,
      `${object.name} position restored`,
    );
    assert.deepEqual(
      object.quaternion.toArray(),
      original.quaternion,
      `${object.name} rotation restored`,
    );
    assert.deepEqual(
      object.scale.toArray(),
      original.scale,
      `${object.name} scale restored`,
    );
    assert.equal(
      object.visible,
      original.visible,
      `${object.name} visibility restored`,
    );
  }
}

function fixture(options = {}) {
  const rig = makeFurnitureScene();
  const originals = remember(rig.near);
  const farOriginals = remember(rig.far);
  const controller = createFurnitureDestruction({
    scene: rig.scene,
    items: [
      { id: "near", object: rig.near, radius: 0.8 },
      { id: "far", object: rig.far, radius: 0.8 },
    ],
    ...options,
  });
  const hit = (overrides = {}) =>
    controller.hit({
      position: { x: 0, y: 0.4, z: 0 },
      direction: { x: 1, z: 0.2 },
      element: "fire",
      damage: 34,
      ultimate: false,
      ...overrides,
    });
  const step = (seconds, observe = () => {}, updateOptions = {}) => {
    for (let frame = 0; frame < Math.ceil(seconds * 60); frame++) {
      controller.update(1 / 60, updateOptions);
      observe(controller.snapshot(), frame);
    }
  };
  return {
    ...rig,
    controller,
    originals,
    farOriginals,
    hit,
    step,
    dispose() {
      controller.dispose();
      rig.geometry.dispose();
      rig.material.dispose();
    },
  };
}

function assertFinite(rig) {
  rig.scene.updateMatrixWorld(true);
  rig.scene.traverse((object) => {
    assert(
      object.matrixWorld.elements.every(Number.isFinite),
      `${object.name} has finite transform`,
    );
  });
  const state = rig.controller.snapshot();
  assert(
    state.debris.active >= 0 && state.debris.active <= state.debris.capacity,
  );
  for (const item of state.items) {
    assert(Object.values(item.position).every(Number.isFinite));
    assert(item.hp >= 0 && item.hp <= item.maxHp);
  }
}

test("an impact damages nearby furniture while distant furniture stays untouched", () => {
  const rig = fixture();
  try {
    rig.hit();
    const [near, far] = rig.controller.snapshot().items;
    assert(
      near.hp > 0 && near.hp < near.maxHp,
      "ordinary impact damages without instantly destroying",
    );
    assert.equal(near.state, "damaged");
    assert.equal(far.hp, far.maxHp);
    assert.equal(far.hits, 0);
    assertRestored(rig.farOriginals);
    const before = rig.controller.snapshot();
    rig.hit({ position: { x: -100, y: 0, z: -100 } });
    assert.deepEqual(
      rig.controller.snapshot(),
      before,
      "a distant miss has no side effects",
    );
  } finally {
    rig.dispose();
  }
});

test("repeated normal impacts break furniture and an ultimate breaks a fresh item immediately", () => {
  const rig = fixture();
  try {
    for (let i = 0; i < 4; i++) rig.hit();
    let near = rig.controller.snapshot().items[0];
    assert.equal(near.hp, 0);
    assert.equal(near.destroyed, true);
    rig.controller.reset();
    rig.hit({ ultimate: true });
    near = rig.controller.snapshot().items[0];
    assert.equal(near.hp, 0);
    assert.equal(near.destroyed, true);
    assert.equal(rig.controller.snapshot().items[1].hp, 100);
  } finally {
    rig.dispose();
  }
});

test("flying furniture stays finite, lands, and stops moving after the impact", () => {
  const rig = fixture();
  try {
    const start = rig.near.position.clone();
    rig.hit({ ultimate: true, element: "wind" });
    let peak = start.y;
    rig.step(12, () => {
      assertFinite(rig);
      peak = Math.max(peak, rig.near.position.y);
    });
    assert(peak > start.y + 0.05, "a strong impact launches furniture");
    assert.equal(rig.controller.snapshot().items[0].state, "destroyed");
    const rubble = rig.scene
      .getObjectByName("furniture-destruction")
      .children.filter((mesh) => mesh.visible);
    assert(
      rubble.length > 0,
      "broken furniture leaves visible rubble after airborne fragments finish",
    );
    for (const mesh of rubble) {
      assert(
        mesh.position.y >= 0 && mesh.position.y < 0.3,
        "persistent rubble rests on the floor",
      );
    }
    const restingPosition = rig.near.position.clone();
    const restingQuaternion = rig.near.quaternion.clone();
    rig.step(2);
    assert(
      rig.near.position.distanceTo(restingPosition) < 1e-8,
      "landed furniture no longer drifts",
    );
    assert(
      rig.near.quaternion.angleTo(restingQuaternion) < 1e-7,
      "landed furniture no longer spins",
    );
  } finally {
    rig.dispose();
  }
});

test("repeated impacts use a bounded debris budget and reset restores exact source poses", () => {
  const rig = fixture();
  try {
    const capacity = rig.controller.snapshot().debris.capacity;
    assert(capacity > 0 && capacity <= 100);
    let maximumActive = 0;
    for (let round = 0; round < 15; round++) {
      for (let impact = 0; impact < 20; impact++) rig.hit({ ultimate: true });
      rig.step(0.25, (state) => {
        maximumActive = Math.max(maximumActive, state.debris.active);
        assert.equal(state.debris.capacity, capacity);
        assertFinite(rig);
      });
      rig.controller.reset();
      assertRestored(rig.originals);
      assertRestored(rig.farOriginals);
      const reset = rig.controller.snapshot();
      assert.equal(reset.destroyedCount, 0);
      assert.equal(reset.debris.active, 0);
      assert(
        reset.items.every(
          (item) => item.hp === item.maxHp && item.state === "intact",
        ),
      );
    }
    assert(maximumActive > 0, "impacts visibly emit debris");
  } finally {
    rig.dispose();
  }
});

test("reduced motion still communicates destruction and preserves finite, restorable furniture", () => {
  const rig = fixture({ reducedMotion: true });
  try {
    rig.hit({ ultimate: true, direction: { x: 0, z: 0 } });
    rig.step(12, () => assertFinite(rig), { reducedMotion: true });
    assert.equal(rig.controller.snapshot().items[0].destroyed, true);
    rig.controller.reset();
    assertRestored(rig.originals);
    rig.hit({ element: "ice" });
    assert(
      rig.controller.snapshot().items[0].hp < 100,
      "reduced motion does not suppress damage",
    );
  } finally {
    rig.dispose();
  }
});

test("dispose restores hidden originals and never disposes shared furniture resources", () => {
  const rig = makeFurnitureScene();
  rig.near.children[1].visible = false;
  rig.far.visible = false;
  const originals = remember(rig.near);
  const farOriginals = remember(rig.far);
  let materialDisposals = 0;
  let geometryDisposals = 0;
  rig.material.addEventListener("dispose", () => materialDisposals++);
  rig.geometry.addEventListener("dispose", () => geometryDisposals++);
  const controller = createFurnitureDestruction({
    scene: rig.scene,
    items: [
      { id: "near", object: rig.near },
      { id: "far", object: rig.far },
    ],
  });
  controller.hit({
    position: { x: 0, y: 0, z: 0 },
    direction: { x: 1, z: 1 },
    ultimate: true,
  });
  controller.update(0.1);
  controller.dispose();
  controller.dispose();
  assertRestored(originals);
  assertRestored(farOriginals);
  assert.equal(materialDisposals, 0);
  assert.equal(geometryDisposals, 0);
  assert.equal(rig.near.parent, rig.scene);
  assert.equal(rig.far.parent, rig.scene);
  assert.doesNotThrow(() => {
    controller.update(1 / 60);
    controller.reset();
  });
  rig.geometry.dispose();
  rig.material.dispose();
});
