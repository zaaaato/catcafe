import * as THREE from "three";

const COLORS = {
  fire: 0xff9b42,
  lightning: 0xffe96b,
  ice: 0x97e7ff,
  wind: 0xb9f4d7,
  dark: 0xbe9aff,
  earth: 0xd6ad78,
};
const UP = new THREE.Vector3(0, 1, 0);
const CAPACITY = 100;
const FLOOR = -0.015;

/** Small, pooled fantasy effects. Owns its graphics, never the cats' materials. */
export function createBattleEffects({
  scene,
  cats,
  allowed = () => true,
  clearPath = () => true,
}) {
  const container = new THREE.Group();
  container.name = "cafe-battle-effects";
  scene.add(container);
  const geometry = {
    orb: new THREE.IcosahedronGeometry(1, 1),
    crystal: new THREE.OctahedronGeometry(1),
    shard: new THREE.BoxGeometry(1, 1, 1),
    ring: new THREE.TorusGeometry(1, 0.045, 5, 32),
    beam: new THREE.CylinderGeometry(1, 1, 1, 5),
  };
  const pool = Array.from({ length: CAPACITY }, () => {
    const material = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const mesh = new THREE.Mesh(geometry.orb, material);
    mesh.visible = false;
    mesh.frustumCulled = false;
    mesh.renderOrder = 3;
    container.add(mesh);
    return {
      mesh,
      active: false,
      age: 0,
      life: 1,
      size: 0.1,
      kind: "spark",
      start: new THREE.Vector3(),
      end: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      target: -1,
      attacker: -1,
      ultimate: false,
      element: "wind",
      impact: null,
      nextTrail: 0,
    };
  });
  const knocks = new Map();
  const statusClocks = cats.map(() => ({
    burn: 0,
    freeze: 0,
    paralyze: 0,
    slow: 0,
  }));
  const shaking = new Set();
  const origin = new THREE.Vector3();
  const destination = new THREE.Vector3();
  const delta = new THREE.Vector3();
  let time = 0;
  let disposed = false;
  let cursor = 0;
  let reducedMotion = false;

  const catAt = (value) =>
    cats[typeof value === "number" ? value : value?.index];
  const indexOf = (value) => (typeof value === "number" ? value : value?.index);
  function acquire(kind, element, size, life) {
    if (disposed) return null;
    let particle;
    for (let i = 0; i < CAPACITY; i++) {
      const candidate = pool[(cursor + i) % CAPACITY];
      if (!candidate.active) {
        particle = candidate;
        cursor = (cursor + i + 1) % CAPACITY;
        break;
      }
    }
    // Ambient sparks can be dropped when the scene is busy. Do not evict a
    // projectile, as its arrival carries the visual impact and knockback.
    if (!particle) return null;
    Object.assign(particle, {
      active: true,
      age: 0,
      life,
      size,
      kind,
      element,
      target: -1,
      attacker: -1,
      ultimate: false,
      impact: null,
      nextTrail: 0,
    });
    const mesh = particle.mesh;
    mesh.visible = true;
    mesh.geometry =
      geometry[
        kind === "ring"
          ? "ring"
          : kind === "beam"
            ? "beam"
            : element === "ice"
              ? "crystal"
              : element === "earth"
                ? "shard"
                : "orb"
      ];
    mesh.material.color.setHex(COLORS[element] ?? COLORS.wind);
    mesh.material.opacity = 0.85;
    mesh.material.blending =
      element === "earth" ? THREE.NormalBlending : THREE.AdditiveBlending;
    mesh.position.set(0, 0, 0);
    mesh.rotation.set(0, 0, 0);
    mesh.scale.setScalar(size);
    particle.velocity.set(0, 0, 0);
    return particle;
  }
  function release(particle) {
    particle.active = false;
    particle.mesh.visible = false;
    particle.impact = null;
  }
  function spark(position, element, scale = 1, gentle = false) {
    const particle = acquire(
      "spark",
      element,
      (0.025 + Math.random() * 0.035) * scale,
      0.35 + Math.random() * 0.5,
    );
    if (!particle) return;
    particle.mesh.position.copy(position);
    particle.velocity.set(
      (Math.random() - 0.5) * (gentle ? 0.3 : 1.7),
      gentle ? 0.3 + Math.random() * 0.5 : 0.4 + Math.random() * 1.2,
      (Math.random() - 0.5) * (gentle ? 0.3 : 1.7),
    );
    if (element === "ice")
      particle.mesh.scale.set(
        particle.size * 0.6,
        particle.size * 1.8,
        particle.size * 0.6,
      );
  }
  function ring(position, element, size = 0.25, life = 0.55) {
    const particle = acquire("ring", element, size, life);
    if (!particle) return;
    particle.mesh.position.copy(position);
    particle.mesh.rotation.x = Math.PI / 2;
  }
  function burst(position, element, ultimate = false) {
    const count = reducedMotion ? (ultimate ? 4 : 2) : ultimate ? 13 : 6;
    for (let i = 0; i < count; i++)
      spark(position, element, ultimate ? 1.4 : 1, reducedMotion);
    ring(position, element, ultimate ? 0.48 : 0.22, ultimate ? 0.85 : 0.5);
    if (ultimate && !reducedMotion) {
      origin.copy(position);
      origin.y += 0.3;
      ring(origin, element, 0.32, 1);
    }
  }
  function lightning(start, end, ultimate) {
    const pieces = ultimate ? 7 : 5;
    let x = start.x,
      y = start.y,
      z = start.z;
    for (let i = 1; i <= pieces; i++) {
      const t = i / pieces;
      const nx =
        THREE.MathUtils.lerp(start.x, end.x, t) +
        (i === pieces ? 0 : (Math.random() - 0.5) * 0.28);
      const ny =
        THREE.MathUtils.lerp(start.y, end.y, t) +
        (i === pieces ? 0 : (Math.random() - 0.5) * 0.32);
      const nz =
        THREE.MathUtils.lerp(start.z, end.z, t) +
        (i === pieces ? 0 : (Math.random() - 0.5) * 0.28);
      const particle = acquire(
        "beam",
        "lightning",
        ultimate ? 0.028 : 0.017,
        0.18,
      );
      if (particle) {
        delta.set(nx - x, ny - y, nz - z);
        particle.mesh.position.set((x + nx) / 2, (y + ny) / 2, (z + nz) / 2);
        particle.mesh.quaternion.setFromUnitVectors(
          UP,
          delta.clone().normalize(),
        );
        particle.mesh.scale.set(particle.size, delta.length(), particle.size);
      }
      x = nx;
      y = ny;
      z = nz;
    }
  }
  function knockback(attacker, target, ultimate) {
    const source = catAt(attacker),
      victim = catAt(target);
    if (!source || !victim) return;
    const direction = victim.root.position.clone().sub(source.root.position);
    direction.y = 0;
    if (direction.lengthSq() < 0.0001) direction.set(0, 0, 1);
    direction.normalize();
    knocks.set(indexOf(target), {
      direction,
      age: 0,
      life: ultimate ? 0.62 : 0.44,
      distance: ultimate ? 1.1 : 0.58,
      height: ultimate ? 0.5 : 0.26,
    });
  }
  function impact(particle) {
    const target = catAt(particle.target);
    if (!target) return;
    destination.copy(target.root.position);
    destination.y += 0.66;
    burst(destination, particle.element, particle.ultimate);
    if (particle.impact === "knockback")
      knockback(particle.attacker, particle.target, particle.ultimate);
  }
  function play(event) {
    if (disposed || !event) return;
    const target = catAt(event.target ?? event.index);
    if (!target) return;
    if (event.type === "down" || event.type === "revive") {
      origin.copy(target.root.position);
      origin.y += 0.2;
      burst(
        origin,
        event.type === "revive" ? "wind" : "dark",
        event.type === "revive",
      );
      return;
    }
    if (event.type === "damage") {
      if (event.effect === "burn") {
        origin.copy(target.root.position);
        origin.y += 0.7;
        spark(origin, "fire", 0.8, true);
      }
      return;
    }
    if (event.type !== "cast") return;
    const source = catAt(event.attacker);
    if (!source) return;
    const move = event.move ?? {};
    const element = COLORS[move.element] ? move.element : "wind";
    const ultimate = Boolean(move.ultimate);
    const particle = acquire(
      "projectile",
      element,
      ultimate ? 0.18 : 0.105,
      element === "lightning" ? 0.16 : 0.46,
    );
    if (!particle) return;
    particle.start.copy(source.root.position);
    particle.start.y += 0.82;
    particle.end.copy(target.root.position);
    particle.end.y += 0.68;
    particle.mesh.position.copy(particle.start);
    Object.assign(particle, {
      target: indexOf(event.target),
      attacker: indexOf(event.attacker),
      ultimate,
      impact: event.effect ?? move.effect,
    });
    if (element === "lightning")
      lightning(particle.start, particle.end, ultimate);
    if (element === "ice")
      particle.mesh.scale.set(
        particle.size * 0.7,
        particle.size * 1.8,
        particle.size * 0.7,
      );
    if (ultimate) {
      origin.copy(source.root.position);
      origin.y += 0.09;
      ring(origin, element, 0.62, 0.9);
    }
  }

  function update(dt, snapshot, options = {}) {
    if (disposed) return;
    reducedMotion = Boolean(options?.reducedMotion);
    dt = Number.isFinite(dt) ? Math.min(0.06, Math.max(0, dt)) : 0;
    time += dt;
    for (const particle of pool) {
      if (!particle.active) continue;
      particle.age += dt;
      const t = particle.age / particle.life;
      if (t >= 1) {
        if (particle.kind === "projectile") impact(particle);
        release(particle);
        continue;
      }
      const mesh = particle.mesh;
      if (particle.kind === "projectile") {
        const target = catAt(particle.target);
        if (target) {
          particle.end.copy(target.root.position);
          particle.end.y += 0.68;
        }
        mesh.position.lerpVectors(particle.start, particle.end, t);
        mesh.position.y +=
          Math.sin(t * Math.PI) *
          (reducedMotion ? 0.035 : particle.element === "earth" ? 0.55 : 0.16);
        mesh.rotation.y += dt * (reducedMotion ? 1 : 7);
        mesh.rotation.z += dt * (reducedMotion ? 0.5 : 5);
        mesh.material.opacity = 0.85;
        if (particle.age >= particle.nextTrail) {
          particle.nextTrail = particle.age + (reducedMotion ? 0.2 : 0.055);
          spark(mesh.position, particle.element, 0.7, true);
          if (
            !reducedMotion &&
            (particle.element === "wind" || particle.element === "dark")
          )
            ring(mesh.position, particle.element, 0.12, 0.3);
        }
      } else if (particle.kind === "ring") {
        mesh.scale.setScalar(
          particle.size * (1 + t * (reducedMotion ? 0.6 : 2.4)),
        );
        mesh.material.opacity = (1 - t) * 0.6;
        mesh.rotation.z += dt * (reducedMotion ? 0.2 : 1.2);
      } else if (particle.kind === "beam")
        mesh.material.opacity = (1 - t) * 0.95;
      else {
        mesh.position.addScaledVector(particle.velocity, dt);
        particle.velocity.y -= dt * (particle.element === "earth" ? 2.1 : 0.38);
        mesh.material.opacity = (1 - t) * 0.75;
        mesh.scale.multiplyScalar(Math.max(0.8, 1 - dt * 0.6));
        mesh.rotation.x += dt * 3;
        mesh.rotation.z += dt * 2;
      }
    }

    for (const index of shaking)
      if (cats[index]) cats[index].root.rotation.z = 0;
    shaking.clear();
    for (const fighter of snapshot?.fighters ?? []) {
      const cat = cats[fighter.index];
      const clocks = statusClocks[fighter.index];
      if (!cat || !clocks) continue;
      for (const status of fighter.statuses ?? []) {
        if (status.remaining <= 0) continue;
        const type = status.type;
        if (!(type in clocks)) continue;
        clocks[type] -= dt;
        if (type === "paralyze") {
          cat.root.rotation.z = reducedMotion
            ? 0
            : Math.sin(time * 75 + fighter.index) * 0.013;
          shaking.add(fighter.index);
        }
        if (clocks[type] > 0) continue;
        clocks[type] =
          (type === "freeze" ? 0.5 : type === "slow" ? 0.7 : 0.11) *
          (reducedMotion ? 2.5 : 1);
        origin.copy(cat.root.position);
        if (type === "freeze" || type === "slow") {
          origin.y += 0.12;
          ring(origin, type === "freeze" ? "ice" : "wind", 0.32, 0.6);
          if (type === "freeze") {
            origin.y += 0.42;
            spark(origin, "ice", 1.2, true);
          }
        } else {
          origin.x += (Math.random() - 0.5) * 0.42;
          origin.z += (Math.random() - 0.5) * 0.45;
          origin.y += type === "burn" ? 0.52 : 0.76;
          spark(origin, type === "burn" ? "fire" : "lightning", 0.8, true);
        }
      }
    }
    for (const [index, knock] of knocks) {
      const cat = cats[index];
      if (!cat) {
        knocks.delete(index);
        continue;
      }
      knock.age += dt;
      const t = Math.min(1, knock.age / knock.life);
      const amount = (knock.distance * (1 - t) * 2 * dt) / knock.life;
      destination
        .copy(cat.root.position)
        .addScaledVector(knock.direction, amount);
      if (
        allowed(destination.x, destination.z) &&
        clearPath(cat.root.position, destination)
      ) {
        cat.root.position.x = destination.x;
        cat.root.position.z = destination.z;
      }
      cat.root.position.y =
        FLOOR + Math.sin(t * Math.PI) * (reducedMotion ? 0.018 : knock.height);
      if (t >= 1) {
        cat.root.position.y = FLOOR;
        knocks.delete(index);
      }
    }
  }

  function reset() {
    if (disposed) return;
    for (const index of shaking)
      if (cats[index]) cats[index].root.rotation.z = 0;
    for (const index of knocks.keys())
      if (cats[index]) cats[index].root.position.y = FLOOR;
    shaking.clear();
    knocks.clear();
    pool.forEach(release);
    statusClocks.forEach((clocks) => {
      for (const type of Object.keys(clocks)) clocks[type] = 0;
    });
    time = 0;
    cursor = 0;
  }
  function dispose() {
    if (disposed) return;
    reset();
    disposed = true;
    container.removeFromParent();
    pool.forEach((particle) => particle.mesh.material.dispose());
    Object.values(geometry).forEach((item) => item.dispose());
    container.clear();
  }
  return { play, update, reset, dispose };
}
