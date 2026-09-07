import * as THREE from "three";

const CAPACITY = 80;
const COLORS = {
  fire: 0xdf6b28,
  ice: 0x73b9d8,
  lightning: 0xd8b64b,
  wind: 0x77a382,
  dark: 0x765789,
  earth: 0x9c7149,
};
const finite = (value, fallback = 0) =>
  Number.isFinite(value) ? value : fallback;

/** Round-local prop destruction. Never disposes or modifies a prop's materials. */
export function createFurnitureDestruction({
  scene,
  items = [],
  reducedMotion = false,
}) {
  const root = new THREE.Group();
  root.name = "furniture-destruction";
  scene.add(root);
  scene.updateMatrixWorld(true);
  const geometries = {
    board: new THREE.BoxGeometry(1, 1, 1),
    chunk: new THREE.DodecahedronGeometry(1, 0),
    mark: new THREE.CylinderGeometry(1, 1, 1, 18),
  };
  const particles = Array.from({ length: CAPACITY }, () => {
    const material = new THREE.MeshStandardMaterial({
      color: 0xa48660,
      roughness: 1,
      metalness: 0,
      transparent: true,
      opacity: 1,
      flatShading: true,
    });
    const mesh = new THREE.Mesh(geometries.board, material);
    mesh.visible = false;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
    return {
      mesh,
      active: false,
      reserved: false,
      age: 0,
      life: 4,
      settled: false,
      bounce: 0,
      velocity: new THREE.Vector3(),
      spin: new THREE.Vector3(),
    };
  });
  const records = items
    .filter((item) => item?.object?.isObject3D)
    .map((item, index) => {
      const object = item.object;
      const bounds = new THREE.Box3().setFromObject(object);
      const size = bounds.isEmpty()
        ? new THREE.Vector3(0.8, 0.8, 0.8)
        : bounds.getSize(new THREE.Vector3());
      const center = bounds.isEmpty()
        ? object.getWorldPosition(new THREE.Vector3())
        : bounds.getCenter(new THREE.Vector3());
      const maxHp = Math.max(1, finite(item.hp ?? item.maxHp, 100));
      let woodColor = 0xa48660;
      object.traverse((child) => {
        if (child.isMesh && child.material?.color && woodColor === 0xa48660)
          woodColor = child.material.color.getHex();
      });
      return {
        id: item.id ?? `furniture-${index}`,
        object,
        size,
        center,
        radius: Math.max(
          0.1,
          finite(item.radius, Math.hypot(size.x, size.z) * 0.5),
        ),
        maxHp,
        hp: maxHp,
        state: "intact",
        hits: 0,
        age: 0,
        life: 0,
        ultimate: false,
        woodColor,
        direction: new THREE.Vector3(),
        throwOffset: new THREE.Vector3(),
        axis: new THREE.Vector3(1, 0, 0),
        original: {
          position: object.position.clone(),
          quaternion: object.quaternion.clone(),
          scale: object.scale.clone(),
          visible: object.visible,
        },
        originWorld: object.getWorldPosition(new THREE.Vector3()),
        wreck: [],
      };
    });
  // Four permanent wreck pieces per item remain on its original footprint.
  // These slots are part of the same 80-object cap as all airborne fragments.
  const slotsPerItem = records.length
    ? Math.min(4, Math.floor(40 / records.length))
    : 0;
  let reservedCount = 0;
  for (const record of records) {
    for (let i = 0; i < slotsPerItem; i++) {
      const particle = particles[reservedCount++];
      particle.reserved = true;
      record.wreck.push(particle);
    }
  }
  let disposed = false;
  let motionReduced = Boolean(reducedMotion);
  let cursor = reservedCount;
  const local = new THREE.Vector3();
  const offset = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const parentRotation = new THREE.Quaternion();
  const shakeRotation = new THREE.Euler();

  function restoreTransform(record) {
    record.object.position.copy(record.original.position);
    record.object.quaternion.copy(record.original.quaternion);
    record.object.scale.copy(record.original.scale);
  }
  function placeWorld(record, worldPosition) {
    local.copy(worldPosition);
    record.object.parent?.worldToLocal(local);
    record.object.position.copy(local);
  }
  function showWreck(record) {
    for (let i = 0; i < record.wreck.length; i++) {
      const particle = record.wreck[i],
        mesh = particle.mesh;
      particle.active = true;
      mesh.visible = true;
      mesh.material.opacity = 1;
      mesh.position.set(record.center.x, 0.09 + i * 0.025, record.center.z);
      mesh.rotation.set(0, (i - 1) * 0.8, i % 2 ? 0.1 : -0.08);
      mesh.material.color
        .setHex(record.woodColor)
        .multiplyScalar(i === 3 ? 0.4 : 0.75 + i * 0.1);
      mesh.geometry =
        i === 3
          ? geometries.mark
          : i === 2
            ? geometries.chunk
            : geometries.board;
      if (i === 3) {
        mesh.scale.set(
          Math.max(record.radius * 0.8, 0.3),
          0.025,
          Math.max(record.radius * 0.8, 0.3),
        );
        mesh.position.y = 0.03;
        mesh.rotation.set(0, 0, 0);
      } else if (i === 2) {
        mesh.scale.set(
          Math.max(0.2, record.size.x * 0.28),
          Math.max(0.13, record.size.y * 0.1),
          Math.max(0.2, record.size.z * 0.28),
        );
      } else
        mesh.scale.set(
          Math.max(0.45, record.size.x * (i ? 0.6 : 0.95)),
          0.12,
          Math.max(0.2, record.size.z * (i ? 0.95 : 0.32)),
        );
    }
  }
  function acquireDebris() {
    for (let i = 0; i < CAPACITY - reservedCount; i++) {
      const index =
        reservedCount +
        ((cursor - reservedCount + i) % (CAPACITY - reservedCount));
      const particle = particles[index];
      if (!particle.active) {
        cursor =
          reservedCount +
          ((index - reservedCount + 1) % (CAPACITY - reservedCount));
        return particle;
      }
    }
    let oldest = null;
    for (const particle of particles)
      if (!particle.reserved && (!oldest || particle.age > oldest.age))
        oldest = particle;
    return oldest;
  }
  function scatter(record, element, ultimate) {
    const count = motionReduced ? 3 : ultimate ? 18 : 9;
    for (let i = 0; i < count; i++) {
      const particle = acquireDebris();
      if (!particle) return;
      Object.assign(particle, {
        active: true,
        age: 0,
        life: 3.6 + Math.random() * 1.2,
        settled: false,
        bounce: 0,
      });
      const mesh = particle.mesh;
      mesh.visible = true;
      mesh.material.opacity = 1;
      mesh.material.color.setHex(
        i % 4 === 0 ? (COLORS[element] ?? record.woodColor) : record.woodColor,
      );
      mesh.geometry = i % 3 === 0 ? geometries.chunk : geometries.board;
      mesh.position.copy(record.center);
      mesh.position.x += (Math.random() - 0.5) * Math.min(record.size.x, 1);
      mesh.position.z += (Math.random() - 0.5) * Math.min(record.size.z, 1);
      mesh.scale.set(
        0.12 + Math.random() * 0.24,
        0.08 + Math.random() * 0.13,
        0.08 + Math.random() * 0.28,
      );
      mesh.rotation.set(Math.random(), Math.random(), Math.random());
      const speed = motionReduced ? 0.3 : ultimate ? 4.4 : 2.3;
      particle.velocity.set(
        record.direction.x * speed + (Math.random() - 0.5) * speed,
        motionReduced ? 0.5 : 2.8 + Math.random() * (ultimate ? 4 : 1.5),
        record.direction.z * speed + (Math.random() - 0.5) * speed,
      );
      particle.spin
        .set(Math.random() * 6, Math.random() * 6, Math.random() * 6)
        .multiplyScalar(motionReduced ? 0.15 : 1);
    }
  }
  function destroyFurniture(record, event) {
    record.state = "flying";
    record.age = 0;
    record.ultimate = Boolean(event.ultimate);
    record.life = record.ultimate ? 1.35 : 0.8;
    record.direction.set(
      finite(event.direction?.x),
      0,
      finite(event.direction?.z),
    );
    if (record.direction.lengthSq() < 0.001)
      record.direction
        .copy(record.center)
        .sub(
          new THREE.Vector3(
            finite(event.position?.x),
            record.center.y,
            finite(event.position?.z),
          ),
        );
    if (record.direction.lengthSq() < 0.001) record.direction.set(0.8, 0, 0.6);
    record.direction.normalize();
    const distance = motionReduced ? 0.08 : record.ultimate ? 2.65 : 0.9;
    record.throwOffset.copy(record.direction).multiplyScalar(distance);
    record.throwOffset.x =
      THREE.MathUtils.clamp(
        record.originWorld.x + record.throwOffset.x,
        -4.85,
        4.85,
      ) - record.originWorld.x;
    record.throwOffset.z =
      THREE.MathUtils.clamp(
        record.originWorld.z + record.throwOffset.z,
        -4.35,
        3.8,
      ) - record.originWorld.z;
    record.axis.set(record.direction.z, 0, -record.direction.x);
    if (record.object.parent) {
      record.object.parent.getWorldQuaternion(parentRotation);
      record.axis.applyQuaternion(parentRotation.invert());
    }
    record.axis.normalize();
    showWreck(record);
    scatter(record, event.element, record.ultimate);
  }
  function hit(event = {}) {
    if (
      disposed ||
      !Number.isFinite(event.position?.x) ||
      !Number.isFinite(event.position?.z)
    )
      return [];
    const affected = [];
    const area = event.ultimate ? 3.4 : 0.9;
    for (const record of records) {
      if (record.hp <= 0 || !record.original.visible) continue;
      if (
        Math.hypot(
          record.center.x - event.position.x,
          record.center.z - event.position.z,
        ) >
        area + record.radius
      )
        continue;
      const damage = event.ultimate
        ? record.hp
        : THREE.MathUtils.clamp(finite(event.damage, 34), 8, 60);
      record.hp = Math.max(0, record.hp - damage);
      record.hits++;
      if (record.hp === 0) destroyFurniture(record, event);
      else {
        record.state = "damaged";
        record.age = 0;
        record.life = 0.5;
      }
      affected.push({
        id: record.id,
        hp: record.hp,
        state: record.state,
        damage,
      });
    }
    return affected;
  }
  function update(dt, options = {}) {
    if (disposed) return;
    if (typeof options?.reducedMotion === "boolean")
      motionReduced = options.reducedMotion;
    dt = Math.min(0.06, Math.max(0, finite(dt)));
    for (const record of records) {
      if (record.state === "damaged" && record.age < record.life) {
        record.age += dt;
        restoreTransform(record);
        const t = Math.min(1, record.age / record.life);
        const shake =
          Math.sin(t * Math.PI * 8) * (1 - t) * (motionReduced ? 0.004 : 0.045);
        shakeRotation.set(shake * 0.6, 0, shake);
        rotation.setFromEuler(shakeRotation);
        record.object.quaternion.multiply(rotation);
      } else if (record.state === "flying") {
        record.age += dt;
        const t = Math.min(1, record.age / record.life);
        offset
          .copy(record.originWorld)
          .addScaledVector(record.throwOffset, 1 - (1 - t) ** 2);
        offset.y +=
          Math.sin(t * Math.PI) *
          (motionReduced ? 0.06 : record.ultimate ? 3.1 : 0.95);
        placeWorld(record, offset);
        rotation.setFromAxisAngle(
          record.axis,
          (motionReduced
            ? 0.07
            : record.ultimate
              ? Math.PI * 1.2
              : Math.PI * 0.6) * t,
        );
        record.object.quaternion
          .copy(record.original.quaternion)
          .premultiply(rotation);
        if (t >= 1) {
          record.state = "destroyed";
          record.object.visible = false;
        }
      }
    }
    for (const particle of particles) {
      if (!particle.active || particle.reserved) continue;
      particle.age += dt;
      if (particle.age >= particle.life) {
        particle.active = false;
        particle.mesh.visible = false;
        continue;
      }
      const mesh = particle.mesh;
      if (!particle.settled) {
        particle.velocity.y -= 9.8 * dt;
        mesh.position.addScaledVector(particle.velocity, dt);
        mesh.rotation.x += particle.spin.x * dt;
        mesh.rotation.y += particle.spin.y * dt;
        mesh.rotation.z += particle.spin.z * dt;
        mesh.position.x = THREE.MathUtils.clamp(mesh.position.x, -4.85, 4.85);
        mesh.position.z = THREE.MathUtils.clamp(mesh.position.z, -4.35, 3.8);
        if (mesh.position.y <= 0.08) {
          mesh.position.y = 0.08;
          if (
            particle.bounce++ === 0 &&
            Math.abs(particle.velocity.y) > 1 &&
            !motionReduced
          ) {
            particle.velocity.y *= -0.26;
            particle.velocity.x *= 0.45;
            particle.velocity.z *= 0.45;
          } else {
            particle.settled = true;
            particle.velocity.set(0, 0, 0);
          }
        }
      }
      mesh.material.opacity = Math.min(
        1,
        (particle.life - particle.age) / 0.65,
      );
    }
  }
  function snapshot() {
    return {
      items: records.map((record) => ({
        id: record.id,
        hp: record.hp,
        maxHp: record.maxHp,
        state: record.state,
        destroyed: record.hp <= 0,
        hits: record.hits,
        position: {
          x: record.object.position.x,
          y: record.object.position.y,
          z: record.object.position.z,
        },
        visible: record.object.visible,
      })),
      debris: {
        active: particles.filter((particle) => particle.active).length,
        capacity: CAPACITY,
      },
      destroyedCount: records.filter((record) => record.hp <= 0).length,
    };
  }
  function reset() {
    if (disposed) return;
    for (const record of records) {
      restoreTransform(record);
      record.object.visible = record.original.visible;
      record.hp = record.maxHp;
      record.state = "intact";
      record.hits = 0;
      record.age = 0;
      record.life = 0;
    }
    for (const particle of particles) {
      particle.active = false;
      particle.mesh.visible = false;
      particle.velocity.set(0, 0, 0);
    }
    cursor = reservedCount;
  }
  function dispose() {
    if (disposed) return;
    reset();
    disposed = true;
    root.removeFromParent();
    for (const particle of particles) particle.mesh.material.dispose();
    for (const geometry of Object.values(geometries)) geometry.dispose();
    root.clear();
  }
  return { hit, update, reset, dispose, snapshot };
}
