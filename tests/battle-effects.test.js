import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { BATTLE_CATS } from "../src/battle-engine.js";
import { createBattleEffects } from "../src/battle-effects.js";

function fixture(options = {}) {
  const scene = new THREE.Scene();
  const catGeometry = new THREE.SphereGeometry(0.2, 8, 6);
  const catMaterial = new THREE.MeshBasicMaterial({ color: 0x886655 });
  const cats = BATTLE_CATS.map(({ index }) => {
    const root = new THREE.Group();
    root.position.set(
      Math.sin((index * Math.PI) / 3) * 1.5,
      -0.015,
      Math.cos((index * Math.PI) / 3) * 1.5,
    );
    root.add(new THREE.Mesh(catGeometry, catMaterial));
    scene.add(root);
    return { root };
  });
  const effects = createBattleEffects({
    scene,
    cats,
    allowed: options.allowed ?? ((x, z) => Math.abs(x) < 4 && Math.abs(z) < 4),
    clearPath: options.clearPath ?? (() => true),
  });
  const container = scene.getObjectByName("cafe-battle-effects");
  assert(container, "the effect layer must be attached to the scene");
  const snapshot = {
    fighters: cats.map((_, index) => ({ index, hp: 100, statuses: [] })),
  };
  const cast = (index, move, override = {}) =>
    effects.play({
      type: "cast",
      attacker: index,
      target: (index + 1) % cats.length,
      move: BATTLE_CATS[index].moves[move],
      effect: BATTLE_CATS[index].moves[move].effect,
      ...override,
    });
  const step = (
    seconds,
    observe = () => {},
    state = snapshot,
    options = {},
  ) => {
    for (let frame = 0; frame < Math.ceil(seconds * 60); frame++) {
      effects.update(1 / 60, state, options);
      observe(frame);
    }
  };
  return {
    scene,
    cats,
    effects,
    container,
    snapshot,
    cast,
    step,
    catMaterial,
    dispose() {
      effects.dispose();
      catGeometry.dispose();
      catMaterial.dispose();
    },
  };
}

function finiteScene(rig) {
  rig.scene.updateMatrixWorld(true);
  for (const mesh of rig.container.children) {
    if (!mesh.visible) continue;
    assert(
      mesh.matrixWorld.elements.every(Number.isFinite),
      `${mesh.name}: finite transform`,
    );
    assert(
      Number.isFinite(mesh.material.opacity),
      `${mesh.name}: finite opacity`,
    );
    assert(mesh.material.opacity >= 0 && mesh.material.opacity <= 1);
    assert(mesh.geometry.attributes.position.count > 0);
    for (const coordinate of mesh.geometry.attributes.position.array)
      assert(Number.isFinite(coordinate));
  }
  for (const cat of rig.cats)
    assert(cat.root.position.toArray().every(Number.isFinite));
}

test("all 24 techniques animate with finite geometry in a bounded pool and eventually finish", () => {
  const rig = fixture();
  try {
    const poolSize = rig.container.children.length;
    assert(
      poolSize > 0 && poolSize <= 200,
      "effects must keep a bounded rendering budget",
    );
    for (const resident of BATTLE_CATS)
      for (let move = 0; move < 4; move++) {
        rig.effects.reset();
        rig.cast(resident.index, move);
        assert(
          rig.container.children.some((mesh) => mesh.visible),
          `${resident.moves[move].id} must be visible`,
        );
        rig.step(3.5, (frame) => {
          if (frame % 15 === 0) finiteScene(rig);
          assert.equal(
            rig.container.children.length,
            poolSize,
            "casts must reuse the pool",
          );
        });
        rig.step(3);
        assert(
          rig.container.children.every((mesh) => !mesh.visible),
          `${resident.moves[move].id} must finish`,
        );
        for (const cat of rig.cats)
          assert(
            Math.abs(cat.root.position.y + 0.015) < 1e-6,
            "knocked cats land",
          );
      }
  } finally {
    rig.dispose();
  }
});

test("each elemental attack has a distinct visible silhouette as well as its own palette", () => {
  const rig = fixture();
  try {
    const shapes = new Set(),
      colors = new Set();
    for (const resident of BATTLE_CATS) {
      rig.effects.reset();
      rig.cast(resident.index, 0);
      const visible = rig.container.children.filter(
        (mesh) =>
          mesh.visible &&
          mesh.material.opacity > 0 &&
          mesh.name.startsWith(`${resident.element}:`),
      );
      // Lightning's travelling impact carrier is transparent; its visible bolt
      // segments, rather than that bookkeeping mesh, establish its silhouette.
      const primary =
        visible.find(
          (mesh) => mesh.name === `${resident.element}:projectile`,
        ) ?? visible[0];
      assert(primary, `${resident.element} has visible elemental geometry`);
      shapes.add(primary.geometry.type);
      colors.add(primary.material.color.getHex());
    }
    assert.equal(
      shapes.size,
      6,
      "elements must differ in shape, not only tint",
    );
    assert.equal(
      colors.size,
      6,
      "the six elemental palettes must remain recognizable",
    );
  } finally {
    rig.dispose();
  }
});

test("six simultaneous ultimate impacts survive a full cosmetic pool and knockbacks respect terrain", () => {
  const rig = fixture();
  try {
    const before = rig.cats.map((cat) => cat.root.position.clone());
    const peaks = rig.cats.map(() => -0.015);
    // Victory confetti competes for the same render budget as combat. Impact
    // delivery must survive this saturation even when cosmetics are dropped.
    for (let repeat = 0; repeat < 12; repeat++)
      rig.effects.play({ type: "round-end", winner: repeat % 6 });
    for (let index = 0; index < 6; index++)
      rig.cast(index, 3, { effect: "knockback" });
    rig.step(5, (frame) => {
      if (frame % 10 === 0) finiteScene(rig);
      rig.cats.forEach((cat, index) => {
        peaks[index] = Math.max(peaks[index], cat.root.position.y);
        assert(
          Math.abs(cat.root.position.x) < 4 &&
            Math.abs(cat.root.position.z) < 4,
          "terrain bounds remain respected",
        );
      });
    });
    peaks.forEach((peak, index) =>
      assert(peak > 0.5, `ultimate ${index} must deliver its impact`),
    );
    rig.cats.forEach((cat, index) => {
      assert(
        cat.root.position.distanceTo(before[index]) > 0.1,
        `target ${index} was pushed`,
      );
      assert(
        Math.abs(cat.root.position.y + 0.015) < 1e-6,
        `target ${index} landed`,
      );
    });
  } finally {
    rig.dispose();
  }

  const blocked = fixture({ clearPath: () => false });
  try {
    const before = blocked.cats[4].root.position.clone();
    blocked.cast(3, 3);
    blocked.step(4);
    assert(
      blocked.cats[4].root.position.distanceTo(before) < 1e-6,
      "blocked horizontal travel never crosses furniture",
    );
  } finally {
    blocked.dispose();
  }
});

test("reset releases transient poses and dispose frees owned graphics without disposing the cats", () => {
  const rig = fixture();
  const materials = new Set(),
    geometries = new Set();
  const rememberResources = () =>
    rig.container.children.forEach((mesh) => {
      materials.add(mesh.material);
      geometries.add(mesh.geometry);
    });
  let disposedCatMaterials = 0;
  rig.catMaterial.addEventListener("dispose", () => disposedCatMaterials++);
  try {
    for (const resident of BATTLE_CATS) {
      rig.cast(resident.index, 3);
      rig.step(0.7, rememberResources);
    }
    const paralyzed = {
      fighters: rig.snapshot.fighters.map((f) => ({
        ...f,
        statuses: f.index === 0 ? [{ type: "paralyze", remaining: 2 }] : [],
      })),
    };
    rig.step(0.1, rememberResources, paralyzed);
    rig.effects.reset();
    assert(rig.container.children.every((mesh) => !mesh.visible));
    assert.equal(rig.cats[0].root.rotation.z, 0);
    rig.cats.forEach((cat) =>
      assert(Math.abs(cat.root.position.y + 0.015) < 1e-6),
    );
    rig.step(4);
    assert(
      rig.container.children.every((mesh) => !mesh.visible),
      "reset also cancels delayed impacts",
    );
    rig.cast(0, 0);
    assert(
      rig.container.children.some((mesh) => mesh.visible),
      "reset leaves effects reusable",
    );
    rememberResources();
    const freedMaterials = new Set(),
      freedGeometries = new Set();
    materials.forEach((material) =>
      material.addEventListener("dispose", () => freedMaterials.add(material)),
    );
    geometries.forEach((geometry) =>
      geometry.addEventListener("dispose", () => freedGeometries.add(geometry)),
    );
    rig.effects.dispose();
    rig.effects.dispose();
    assert.equal(rig.scene.getObjectByName("cafe-battle-effects"), undefined);
    assert.equal(freedMaterials.size, materials.size);
    assert.equal(freedGeometries.size, geometries.size);
    assert.equal(disposedCatMaterials, 0);
    assert.doesNotThrow(() => {
      rig.cast(0, 3);
      rig.effects.update(1 / 60, rig.snapshot);
      rig.effects.reset();
    });
  } finally {
    rig.dispose();
  }
});
