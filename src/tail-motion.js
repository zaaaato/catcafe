import * as THREE from "three";

const tails = new WeakMap();

function initialize(cat) {
  const geometry = cat.tailMesh?.geometry;
  const position = geometry?.attributes.position;
  const normal = geometry?.attributes.normal;
  if (!position || !normal) return null;
  const radial = geometry.parameters?.radialSegments ?? 10;
  const stride = radial + 1;
  const rings = position.count / stride;
  if (!Number.isInteger(rings) || rings < 2) return null;
  const positions = [position, ...(geometry.morphAttributes.position ?? [])]
    .slice(0, 3)
    .map((attribute) => new Float32Array(attribute.array));
  const normals = [normal, ...(geometry.morphAttributes.normal ?? [])]
    .slice(0, 3)
    .map((attribute) => new Float32Array(attribute.array));
  while (positions.length < 3) positions.push(positions[0]);
  while (normals.length < 3) normals.push(normals[0]);
  const centers = positions.map((array) => {
    const result = new Float32Array(rings * 3);
    for (let ring = 0; ring < rings; ring++) {
      // The final radial vertex duplicates the seam, so exclude it here.
      for (let side = 0; side < radial; side++) {
        const offset = (ring * stride + side) * 3;
        for (let axis = 0; axis < 3; axis++)
          result[ring * 3 + axis] += array[offset + axis] / radial;
      }
    }
    return result;
  });
  const bounds = new THREE.Box3();
  const point = new THREE.Vector3();
  for (const array of positions)
    for (let offset = 0; offset < array.length; offset += 3)
      bounds.expandByPoint(point.fromArray(array, offset));
  bounds.expandByScalar(0.45);
  geometry.boundingBox = bounds;
  geometry.boundingSphere = bounds.getBoundingSphere(new THREE.Sphere());

  // Three uploads morph targets to a texture once. Updating those attributes
  // would leave GPU poses stale. Keep the mesh's influence array for the scene
  // animator, but blend their immutable snapshots into the base buffer here.
  geometry.morphAttributes = {};
  position.setUsage(THREE.DynamicDrawUsage);
  normal.setUsage(THREE.DynamicDrawUsage);
  const state = {
    geometry,
    position,
    normal,
    positions,
    normals,
    centers,
    stride,
    rings,
    offsets: new Float32Array(rings),
    blendedCenters: new Float32Array(rings * 3),
    amplitude: 0,
    frequency: 1.8,
    flick: 0,
    wavePhase: 0,
    flickPhase: 0,
    flickFrequency: 6.1,
    fallbackTip: cat.tailTip?.position.clone(),
  };
  tails.set(cat, state);
  return state;
}

/**
 * Call after the scene has set the two pose influences and tail-root rotations.
 * The root stays attached while a delayed bend travels down the tail and its
 * tip makes a smaller, quicker flick. All source vertices remain immutable.
 */
export function animateTail(
  cat,
  {
    time = 0,
    dt = 1 / 60,
    moving = false,
    sitting = false,
    sleeping = false,
    wiggling = false,
    eating = false,
    motion = 1,
  } = {},
) {
  const state = tails.get(cat) ?? initialize(cat);
  if (!state) return;
  const step = THREE.MathUtils.clamp(Number.isFinite(dt) ? dt : 0, 0, 0.1);
  const clock = Number.isFinite(time) ? time : 0;
  const activity = THREE.MathUtils.clamp(
    Number.isFinite(motion) ? motion : 1,
    0,
    1,
  );
  const affectionate = cat.pet > 0;
  const targetAmplitude =
    (sleeping
      ? 0.012
      : affectionate
        ? 0.145
        : sitting
          ? 0.075
          : wiggling
            ? 0.14
            : moving
              ? 0.12
              : eating
                ? 0.055
                : 0.065) * activity;
  const targetFrequency = sleeping
    ? 0.7
    : wiggling
      ? 6.3
      : moving
        ? 3.2
        : affectionate
          ? 2.7
          : 1.8;
  state.amplitude = THREE.MathUtils.damp(
    state.amplitude,
    targetAmplitude,
    5,
    step,
  );
  state.frequency = THREE.MathUtils.damp(
    state.frequency,
    targetFrequency,
    4,
    step,
  );
  state.flick = THREE.MathUtils.damp(
    state.flick,
    (sleeping ? 0.006 : wiggling ? 0.045 : affectionate ? 0.027 : 0.02) *
      activity,
    5,
    step,
  );
  state.flickFrequency = THREE.MathUtils.damp(
    state.flickFrequency,
    wiggling ? 12 : 6.1,
    4,
    step,
  );
  state.wavePhase = (state.wavePhase + step * state.frequency) % (Math.PI * 2);
  state.flickPhase =
    (state.flickPhase + step * state.flickFrequency) % (Math.PI * 2);
  const phase = Number.isFinite(cat.phase) ? cat.phase : 0;
  const weights = [
    0,
    THREE.MathUtils.clamp(cat.tailMesh.morphTargetInfluences?.[0] ?? 0, 0, 1),
    THREE.MathUtils.clamp(cat.tailMesh.morphTargetInfluences?.[1] ?? 0, 0, 1),
  ];
  const total = weights[1] + weights[2];
  if (total > 1) {
    weights[1] /= total;
    weights[2] /= total;
  }
  weights[0] = 1 - weights[1] - weights[2];

  for (let ring = 0; ring < state.rings; ring++) {
    const t = ring / (state.rings - 1);
    const tipEnvelope = THREE.MathUtils.smoothstep(t, 0.66, 1);
    // The squared envelope pins the root, including its first derivative.
    const wave = Math.sin(state.wavePhase - t * 2.5 + phase);
    const tipFlick =
      Math.sin(state.flickPhase + phase * 1.7) *
      Math.pow(Math.max(0, Math.sin(clock * 0.73 + phase)), 4);
    state.offsets[ring] =
      t * t * state.amplitude * wave + tipEnvelope * state.flick * tipFlick;
    for (let axis = 0; axis < 3; axis++) {
      const index = ring * 3 + axis;
      state.blendedCenters[index] =
        weights[0] * state.centers[0][index] +
        weights[1] * state.centers[1][index] +
        weights[2] * state.centers[2][index];
    }
  }

  const output = state.position.array,
    outputNormals = state.normal.array;
  for (let ring = 0; ring < state.rings; ring++) {
    const previous = Math.max(0, ring - 1),
      next = Math.min(state.rings - 1, ring + 1);
    const tx =
      state.blendedCenters[next * 3] - state.blendedCenters[previous * 3];
    const ty =
      state.blendedCenters[next * 3 + 1] -
      state.blendedCenters[previous * 3 + 1];
    const tz =
      state.blendedCenters[next * 3 + 2] -
      state.blendedCenters[previous * 3 + 2];
    const lengthSquared = tx * tx + ty * ty + tz * tz;
    const derivative =
      lengthSquared > 1e-10
        ? (state.offsets[next] - state.offsets[previous]) / lengthSquared
        : 0;
    const gx = tx * derivative,
      gy = ty * derivative,
      gz = tz * derivative;
    // Inverse transpose for x' = x + f(distance along the tail).
    const denominator = Math.abs(1 + gx) > 0.05 ? 1 + gx : 1;
    for (let side = 0; side < state.stride; side++) {
      const index = (ring * state.stride + side) * 3;
      for (let axis = 0; axis < 3; axis++) {
        output[index + axis] =
          weights[0] * state.positions[0][index + axis] +
          weights[1] * state.positions[1][index + axis] +
          weights[2] * state.positions[2][index + axis];
        outputNormals[index + axis] =
          weights[0] * state.normals[0][index + axis] +
          weights[1] * state.normals[1][index + axis] +
          weights[2] * state.normals[2][index + axis];
      }
      output[index] += state.offsets[ring];
      const correction = outputNormals[index] / denominator;
      const nx = outputNormals[index] - gx * correction;
      const ny = outputNormals[index + 1] - gy * correction;
      const nz = outputNormals[index + 2] - gz * correction;
      const inverseLength = 1 / (Math.hypot(nx, ny, nz) || 1);
      outputNormals[index] = nx * inverseLength;
      outputNormals[index + 1] = ny * inverseLength;
      outputNormals[index + 2] = nz * inverseLength;
    }
  }
  state.position.needsUpdate = true;
  state.normal.needsUpdate = true;
  if (cat.tailTip) {
    if (cat.tailTips?.length >= 3)
      cat.tailTip.position
        .copy(cat.tailTips[0])
        .multiplyScalar(weights[0])
        .addScaledVector(cat.tailTips[1], weights[1])
        .addScaledVector(cat.tailTips[2], weights[2]);
    else if (state.fallbackTip) cat.tailTip.position.copy(state.fallbackTip);
    cat.tailTip.position.x += state.offsets[state.rings - 1];
  }
}
