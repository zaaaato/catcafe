import * as THREE from "three";

// The center of the visible split lip in createCat, in the head's local space.
// Tracking a real mouth landmark (rather than the head origin) keeps the muzzle
// on the food even when root scale, shoulder pitch and head rotation change.
export const FEEDING_MOUTH_LOCAL = new THREE.Vector3(0, -0.13, 0.285);
const REST_HEAD_LOCAL = new THREE.Vector3(0, 0.92, 0.38);
const states = new WeakMap();

function stateFor(cat) {
  let state = states.get(cat);
  if (!state) {
    state = {
      active: false,
      phase: "idle",
      source: null,
      food: null,
      position: cat.head.position.clone(),
      quaternion: cat.head.quaternion.clone(),
      desiredQuaternion: new THREE.Quaternion(),
      rotation: new THREE.Euler(),
      foodWorld: new THREE.Vector3(),
      mouthWorld: new THREE.Vector3(),
      desiredWorld: new THREE.Vector3(),
      localTarget: new THREE.Vector3(),
      mouthOffset: new THREE.Vector3(),
      contactDistance: null,
      recover: false,
    };
    states.set(cat, state);
  }
  return state;
}

function closestFood(cat, group, direct) {
  if (!group) return null;
  group.updateWorldMatrix(true, true);
  const position = new THREE.Vector3();
  const rootWorld = cat.root.getWorldPosition(new THREE.Vector3());
  let nearest = null;
  let distance = Infinity;
  // The communal group's first child is its ceramic bowl, not edible food.
  const candidates = direct ? group.children : group.children.slice(1);
  for (const object of candidates) {
    if (!object.isMesh) continue;
    object.getWorldPosition(position);
    const next = position.distanceToSquared(rootWorld);
    if (next < distance) {
      distance = next;
      nearest = object;
    }
  }
  return nearest;
}

/**
 * Call after the ordinary head rotations, on every animation frame.
 *
 * The existing body animation should use an eating shoulder height of -0.19
 * and torso pitch of +0.18 before its existing leg IK. That bends the front
 * legs with their paws still planted. This helper then positions the muzzle
 * against an actual food mesh without scaling or stretching the neck.
 *
 * `treats` is the existing communal bowl group; `cat.snack` supplies direct
 * feeding. No new cat properties or changes to route/feet/root are required.
 */
export function applyFeedingPose(
  cat,
  {
    eating = false,
    sniffing = false,
    dt = 1 / 60,
    time = 0,
    treats,
    motion = 1,
  } = {},
) {
  const state = stateFor(cat);
  const step = THREE.MathUtils.clamp(Number.isFinite(dt) ? dt : 0, 0, 0.1);
  const direct = cat.feedTime > 0;
  const source = direct ? cat.snack : treats;
  const active = Boolean(eating && !cat.jump && source);

  if (!active) {
    if (state.active) {
      state.position.copy(cat.head.position);
      state.recover = true;
    }
    state.active = false;
    state.phase = "idle";
    state.source = null;
    state.food = null;
    state.contactDistance = null;
    if (state.recover) {
      state.position.lerp(REST_HEAD_LOCAL, 1 - Math.exp(-step * 9));
      cat.head.position.copy(state.position);
      if (state.position.distanceToSquared(REST_HEAD_LOCAL) < 0.000001) {
        cat.head.position.copy(REST_HEAD_LOCAL);
        state.recover = false;
      }
    }
    return;
  }

  if (!state.active || state.source !== source) {
    state.position.copy(cat.head.position);
    state.quaternion.copy(cat.head.quaternion);
    state.source = source;
    state.food = closestFood(cat, source, direct);
    state.recover = false;
  }
  if (!state.food) {
    state.active = false;
    state.phase = "idle";
    state.contactDistance = null;
    return;
  }
  state.active = true;
  state.phase = sniffing ? "sniff" : "eat";

  // Food pieces are scaled unit spheres. Their upper surface is at local y=1;
  // use y=.82 so the lip reaches the kibble rather than hovering over its rim.
  state.food.updateWorldMatrix(true, false);
  state.foodWorld.set(0, 0.82, 0).applyMatrix4(state.food.matrixWorld);
  cat.torso.updateWorldMatrix(true, false);
  state.localTarget.copy(state.foodWorld);
  cat.torso.worldToLocal(state.localTarget);

  const yaw = THREE.MathUtils.clamp(
    Math.atan2(state.localTarget.x, Math.max(0.12, state.localTarget.z - 0.2)),
    -0.32,
    0.32,
  );
  const chew = Math.max(0, Math.sin(time * 8.5 + (cat.phase || 0)));
  const pitch = (sniffing ? 0.65 : 0.82) + chew * 0.014 * motion;
  state.rotation.set(pitch, yaw, 0, "XYZ");
  state.desiredQuaternion.setFromEuler(state.rotation);
  state.quaternion.slerp(state.desiredQuaternion, 1 - Math.exp(-step * 13));
  cat.head.quaternion.copy(state.quaternion);

  state.desiredWorld.copy(state.foodWorld);
  state.desiredWorld.y += sniffing
    ? 0.075 + Math.sin(time * 3.5) * 0.008 * motion
    : 0.002 + chew * 0.003 * motion;
  cat.torso.worldToLocal(state.desiredWorld);
  state.mouthOffset
    .copy(FEEDING_MOUTH_LOCAL)
    .multiply(cat.head.scale)
    .applyQuaternion(state.quaternion);
  state.desiredWorld.sub(state.mouthOffset);
  // An independent position state prevents the ordinary head bob from pulling
  // the muzzle away every frame and leaving a permanent food-contact gap.
  state.position.lerp(state.desiredWorld, 1 - Math.exp(-step * 15));
  cat.head.position.copy(state.position);
  cat.head.updateWorldMatrix(true, false);
  state.mouthWorld.copy(FEEDING_MOUTH_LOCAL).applyMatrix4(cat.head.matrixWorld);
  state.contactDistance = state.mouthWorld.distanceTo(state.foodWorld);
}

/** JSON-safe measurements for the real WebGL integration harness. */
export function getFeedingDiagnostics(cat) {
  const state = states.get(cat);
  if (!state || !state.active)
    return { active: false, phase: "idle", contactDistance: null };
  return {
    active: true,
    phase: state.phase,
    contactDistance: state.contactDistance,
    mouthWorld: {
      x: state.mouthWorld.x,
      y: state.mouthWorld.y,
      z: state.mouthWorld.z,
    },
    foodWorld: {
      x: state.foodWorld.x,
      y: state.foodWorld.y,
      z: state.foodWorld.z,
    },
  };
}
