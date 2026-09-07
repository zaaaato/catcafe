import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { animateTail } from "../src/tail-motion.js";

function makeTail() {
  const paths = [
    [
      [0, 0, 0],
      [0, 0.3, -0.2],
      [0.06, 0.75, -0.2],
      [0.04, 0.95, -0.05],
    ],
    [
      [0, 0, 0],
      [0.2, -0.2, -0.15],
      [0.4, -0.4, 0.4],
      [0.06, -0.5, 0.85],
    ],
    [
      [0, 0, 0],
      [0.22, -0.1, -0.1],
      [0.34, -0.22, 0.4],
      [0.03, -0.23, 0.78],
    ],
  ];
  const curves = paths.map(
    (path) =>
      new THREE.CatmullRomCurve3(
        path.map((point) => new THREE.Vector3(...point)),
      ),
  );
  const geometries = curves.map(
    (curve) => new THREE.TubeGeometry(curve, 20, 0.05, 8, false),
  );
  const geometry = geometries[0];
  geometry.morphAttributes.position = geometries
    .slice(1)
    .map((item) => item.attributes.position);
  geometry.morphAttributes.normal = geometries
    .slice(1)
    .map((item) => item.attributes.normal);
  const tailMesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  const tailTips = curves.map((curve) => curve.getPointAt(1));
  const tailTip = new THREE.Object3D();
  tailTip.position.copy(tailTips[0]);
  const source = geometries.map(
    (item) => new Float32Array(item.attributes.position.array),
  );
  return {
    cat: { tailMesh, tailTip, tailTips, phase: 0.8, pet: 0 },
    source,
    dispose() {
      geometries.forEach((item) => item.dispose());
      tailMesh.material.dispose();
    },
  };
}

function settle(cat, context = {}) {
  for (let frame = 0; frame < 120; frame++)
    animateTail(cat, { time: frame / 60, dt: 1 / 60, ...context });
}

function close(actual, expected, tolerance = 1e-6) {
  assert(Math.abs(actual - expected) <= tolerance, `${actual} ≈ ${expected}`);
}

test("the base remains attached while the whole tail and tip bend", () => {
  const rig = makeTail();
  try {
    const geometry = rig.cat.tailMesh.geometry;
    const attribute = geometry.attributes.position;
    settle(rig.cat, { moving: true });
    assert.equal(rig.cat.tailMesh.geometry, geometry);
    assert.equal(geometry.attributes.position, attribute);
    assert.deepEqual(geometry.morphAttributes, {});
    assert.deepEqual(rig.cat.tailMesh.morphTargetInfluences, [0, 0]);
    for (let offset = 0; offset < 9 * 3; offset++)
      close(attribute.array[offset], rig.source[0][offset]);
    const middle = 10 * 9 * 3;
    assert(Math.abs(attribute.array[middle] - rig.source[0][middle]) > 0.005);
    const tip = 20 * 9 * 3;
    assert(Math.abs(attribute.array[tip] - rig.source[0][tip]) > 0.02);
    close(
      rig.cat.tailTip.position.x - rig.cat.tailTips[0].x,
      attribute.array[tip] - rig.source[0][tip],
    );
    assert(attribute.version > 0);
    for (let i = 0; i < attribute.count; i++)
      assert(
        geometry.boundingSphere.containsPoint(
          new THREE.Vector3().fromBufferAttribute(attribute, i),
        ),
      );
  } finally {
    rig.dispose();
  }
});

test("CPU pose blending remains correct after GPU morph attributes are removed", () => {
  const rig = makeTail();
  try {
    rig.cat.tailMesh.morphTargetInfluences[0] = 0.3;
    rig.cat.tailMesh.morphTargetInfluences[1] = 0.5;
    settle(rig.cat, { sitting: true, motion: 0 });
    const output = rig.cat.tailMesh.geometry.attributes.position.array;
    for (let index = 0; index < output.length; index++)
      close(
        output[index],
        0.2 * rig.source[0][index] +
          0.3 * rig.source[1][index] +
          0.5 * rig.source[2][index],
      );
    for (const axis of ["x", "y", "z"])
      close(
        rig.cat.tailTip.position[axis],
        0.2 * rig.cat.tailTips[0][axis] +
          0.3 * rig.cat.tailTips[1][axis] +
          0.5 * rig.cat.tailTips[2][axis],
      );
    // Pose weights can keep changing even though GPU morph targets are gone.
    rig.cat.tailMesh.morphTargetInfluences[0] = 1;
    rig.cat.tailMesh.morphTargetInfluences[1] = 0;
    animateTail(rig.cat, { time: 3, dt: 0, motion: 0 });
    for (let index = 0; index < output.length; index++)
      close(output[index], rig.source[1][index]);
  } finally {
    rig.dispose();
  }
});

test("repeated frames do not accumulate deformation and normals remain finite unit vectors", () => {
  const rig = makeTail();
  try {
    settle(rig.cat, { moving: true });
    animateTail(rig.cat, { time: 4, dt: 0, moving: true });
    const geometry = rig.cat.tailMesh.geometry;
    const expected = new Float32Array(geometry.attributes.position.array);
    const expectedTip = rig.cat.tailTip.position.clone();
    for (let repeat = 0; repeat < 300; repeat++)
      animateTail(rig.cat, { time: 4, dt: 0, moving: true });
    assert.deepEqual(geometry.attributes.position.array, expected);
    assert(rig.cat.tailTip.position.equals(expectedTip));
    const normal = geometry.attributes.normal;
    for (let index = 0; index < normal.count; index++)
      close(
        Math.hypot(normal.getX(index), normal.getY(index), normal.getZ(index)),
        1,
        1e-5,
      );
  } finally {
    rig.dispose();
  }
});

test("sleeping and reduced motion calm the tail; affectionate and hunting poses stay finite", () => {
  const rigs = [makeTail(), makeTail(), makeTail(), makeTail()];
  try {
    const contexts = [
      { moving: true },
      { sleeping: true },
      { moving: true, motion: 0.18 },
      { wiggling: true },
    ];
    rigs.forEach((rig, index) => settle(rig.cat, contexts[index]));
    const displacement = (rig) =>
      Math.abs(rig.cat.tailTip.position.x - rig.cat.tailTips[0].x);
    assert(displacement(rigs[1]) < displacement(rigs[0]) * 0.4);
    assert(displacement(rigs[2]) < displacement(rigs[0]) * 0.25);
    rigs[3].cat.pet = 2;
    settle(rigs[3].cat, { sitting: true });
    for (const rig of rigs)
      assert(
        [...rig.cat.tailMesh.geometry.attributes.position.array].every(
          Number.isFinite,
        ),
      );
  } finally {
    rigs.forEach((rig) => rig.dispose());
  }
});

test("activity changes after a long session do not jump the wave phase", () => {
  const rig = makeTail();
  try {
    for (let frame = 0; frame < 120; frame++)
      animateTail(rig.cat, {
        time: 100000 + frame / 60,
        dt: 1 / 60,
        moving: true,
      });
    const before = new Float32Array(
      rig.cat.tailMesh.geometry.attributes.position.array,
    );
    animateTail(rig.cat, { time: 100002, dt: 1 / 60, wiggling: true });
    const after = rig.cat.tailMesh.geometry.attributes.position.array;
    let maximumStep = 0;
    for (let index = 0; index < after.length; index++)
      maximumStep = Math.max(
        maximumStep,
        Math.abs(after[index] - before[index]),
      );
    assert(
      maximumStep < 0.03,
      `activity transition moved a vertex by ${maximumStep}`,
    );
  } finally {
    rig.dispose();
  }
});

test("a seated cat still gets a more expressive affectionate tail", () => {
  const quiet = makeTail(),
    affectionate = makeTail();
  try {
    affectionate.cat.pet = 3;
    const peaks = [0, 0];
    for (let frame = 0; frame < 480; frame++) {
      for (const [index, rig] of [quiet, affectionate].entries()) {
        animateTail(rig.cat, { time: frame / 60, dt: 1 / 60, sitting: true });
        peaks[index] = Math.max(
          peaks[index],
          Math.abs(rig.cat.tailTip.position.x - rig.cat.tailTips[0].x),
        );
      }
    }
    assert(
      peaks[1] > peaks[0] * 1.4,
      `${peaks[1]} should be visibly stronger than ${peaks[0]}`,
    );
  } finally {
    quiet.dispose();
    affectionate.dispose();
  }
});
