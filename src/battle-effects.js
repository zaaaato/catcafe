import * as THREE from "three";

const COLORS = {
  fire: 0xff561c,
  lightning: 0xffd020,
  ice: 0x479fff,
  wind: 0x35bf7d,
  dark: 0x572485,
  earth: 0xa2693b,
};
const UP = new THREE.Vector3(0, 1, 0);
const CAPACITY = 140;
const PROJECTILE_RESERVE = 12;
const SPECTACLE_SCALE = 5;
const FLOOR = -0.015;
const SIGNATURE_KINDS = new Set([
  "flameColumn",
  "icePillar",
  "vortex",
  "eclipse",
  "accretion",
  "meteor",
  "fissure",
  "beam",
]);

/** Small, pooled fantasy effects. Owns its graphics, never the cats' materials. */
export function createBattleEffects({
  scene,
  cats,
  allowed = () => true,
  clearPath = () => true,
  onImpact = () => {},
}) {
  const container = new THREE.Group();
  container.name = "cafe-battle-effects";
  scene.add(container);
  const starShape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const angle = Math.PI / 2 + (i * Math.PI) / 5;
    const radius = i % 2 ? 0.43 : 1;
    if (i === 0)
      starShape.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    else starShape.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
  starShape.closePath();
  const boltShape = new THREE.Shape();
  [
    [-0.12, 1],
    [0.55, 1],
    [0.06, 0.18],
    [0.6, 0.18],
    [-0.5, -1],
    [-0.16, -0.18],
    [-0.65, -0.18],
  ].forEach(([x, y], i) =>
    i ? boltShape.lineTo(x, y) : boltShape.moveTo(x, y),
  );
  boltShape.closePath();
  const helixPoints = Array.from({ length: 65 }, (_, i) => {
    const t = i / 64,
      angle = t * Math.PI * 7;
    const radius = 0.18 + t * 0.72;
    return new THREE.Vector3(
      Math.cos(angle) * radius,
      t * 2,
      Math.sin(angle) * radius,
    );
  });
  const flameGeometry = new THREE.ConeGeometry(0.65, 2.3, 7, 3);
  flameGeometry.translate(0, 1.15, 0);
  const flameVertices = flameGeometry.attributes.position;
  for (let i = 0; i < flameVertices.count; i++) {
    const height = flameVertices.getY(i) / 2.3;
    flameVertices.setX(i, flameVertices.getX(i) + height * height * 0.38);
  }
  flameGeometry.computeVertexNormals();
  const geometry = {
    orb: new THREE.IcosahedronGeometry(1, 1),
    crystal: new THREE.OctahedronGeometry(1),
    shard: new THREE.BoxGeometry(1, 1, 1),
    ring: new THREE.TorusGeometry(1, 0.045, 5, 32),
    beam: new THREE.CylinderGeometry(1, 1, 1, 5),
    flame: flameGeometry,
    bolt: new THREE.ExtrudeGeometry(boltShape, {
      depth: 0.16,
      bevelEnabled: false,
    }),
    helix: new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(helixPoints),
      64,
      0.055,
      5,
      false,
    ),
    shadow: new THREE.SphereGeometry(1, 14, 10),
    rock: new THREE.DodecahedronGeometry(1, 0),
    star: new THREE.ExtrudeGeometry(starShape, {
      depth: 0.12,
      bevelEnabled: false,
    }),
  };
  const pool = Array.from({ length: CAPACITY }, () => {
    const material = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.NormalBlending,
      toneMapped: false,
      side: THREE.DoubleSide,
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
      phase: 0,
      strength: 1,
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
    // Make each effect conspicuously larger without multiplying draw calls or
    // memory. Reduced motion keeps the previous, restrained visual scale.
    size *= reducedMotion ? 1 : SPECTACLE_SCALE;
    let particle;
    let free = 0;
    for (const candidate of pool) if (!candidate.active) free++;
    const replaceCosmetic = kind !== "projectile" && free <= PROJECTILE_RESERVE;
    if (replaceCosmetic && !SIGNATURE_KINDS.has(kind)) return null;
    for (let i = 0; i < CAPACITY; i++) {
      const candidate = pool[(cursor + i) % CAPACITY];
      if (!replaceCosmetic && !candidate.active) {
        particle = candidate;
        cursor = (cursor + i + 1) % CAPACITY;
        break;
      }
    }
    // A cast must reach its target even when a crowd of sparkles fills the pool.
    // Cosmetics may be replaced; an in-flight projectile is never evicted.
    if (!particle && (kind === "projectile" || SIGNATURE_KINDS.has(kind))) {
      let shortest = Infinity;
      for (const candidate of pool) {
        if (
          candidate.kind !== "projectile" &&
          candidate.life - candidate.age < shortest
        ) {
          shortest = candidate.life - candidate.age;
          particle = candidate;
        }
      }
    }
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
      phase: Math.random() * Math.PI * 2,
      strength: 1,
    });
    const mesh = particle.mesh;
    mesh.visible = true;
    const elementGeometry = {
      fire: "flame",
      ice: "crystal",
      lightning: "bolt",
      wind: "helix",
      dark: "shadow",
      earth: "rock",
    };
    const kindGeometry = {
      star: "star",
      orbit: "star",
      confetti: "shard",
      ring: "ring",
      beam: "beam",
      flameColumn: "flame",
      icePillar: "crystal",
      vortex: "helix",
      eclipse: "shadow",
      accretion: "ring",
      gravity: "crystal",
      meteor: "rock",
      fissure: "beam",
    };
    mesh.geometry =
      geometry[kindGeometry[kind] ?? elementGeometry[element] ?? "orb"];
    mesh.name = `${element}:${kind}`;
    mesh.material.color.setHex(COLORS[element] ?? COLORS.wind);
    mesh.material.opacity = 0.85;
    mesh.material.blending = THREE.NormalBlending;
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
    if (!reducedMotion) particle.velocity.multiplyScalar(SPECTACLE_SCALE);
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
  function cartoonStar(position, element, ultimate = false) {
    const particle = acquire(
      "star",
      element,
      ultimate ? 0.23 : 0.14,
      reducedMotion ? 0.65 : 0.95,
    );
    if (!particle) return;
    particle.mesh.position.copy(position);
    particle.mesh.rotation.y = particle.phase;
    particle.mesh.material.color.setHex(
      Math.random() > 0.4 ? 0xffe34c : 0xff70c9,
    );
    const speed = reducedMotion ? 0.35 : ultimate ? 2.8 : 1.8;
    particle.velocity.set(
      Math.cos(particle.phase) * speed,
      reducedMotion ? 0.35 : 0.8 + Math.random() * 1.2,
      Math.sin(particle.phase) * speed,
    );
    if (!reducedMotion) particle.velocity.multiplyScalar(SPECTACLE_SCALE);
  }
  function dizzyStars(index) {
    const target = catAt(index);
    if (!target) return;
    for (let i = 0; i < (reducedMotion ? 2 : 5); i++) {
      const particle = acquire(
        "orbit",
        "lightning",
        reducedMotion ? 0.14 : 0.2,
        3.6,
      );
      if (!particle) break;
      particle.target = indexOf(index);
      particle.phase = (i * Math.PI * 2) / (reducedMotion ? 2 : 5);
      particle.mesh.material.color.setHex(i % 2 ? 0xff95d5 : 0xffe34c);
      particle.mesh.position.copy(target.root.position);
      particle.mesh.position.y += 1.05;
    }
  }
  function celebrate(index) {
    const winner = catAt(index);
    if (!winner) return;
    origin.copy(winner.root.position);
    origin.y += 0.9;
    const palette = [
      0xffe34c, 0xff70c9, 0x69dfff, 0x9aff78, 0xbe9aff, 0xff9b42,
    ];
    for (let i = 0; i < (reducedMotion ? 9 : 38); i++) {
      const particle = acquire(
        i % 4 === 0 ? "star" : "confetti",
        "wind",
        i % 4 === 0 ? 0.16 : 0.11,
        2 + Math.random() * 1.5,
      );
      if (!particle) break;
      particle.mesh.position.copy(origin);
      particle.mesh.material.color.setHex(palette[i % palette.length]);
      const speed = reducedMotion ? 0.35 : 1.5 + Math.random() * 1.6;
      particle.velocity.set(
        Math.cos(particle.phase) * speed,
        reducedMotion ? 0.6 : 2.4 + Math.random() * 2.3,
        Math.sin(particle.phase) * speed,
      );
      if (!reducedMotion) particle.velocity.multiplyScalar(SPECTACLE_SCALE);
      if (particle.kind === "confetti")
        particle.mesh.scale
          .set(0.065, 0.14, 0.025)
          .multiplyScalar(reducedMotion ? 1 : SPECTACLE_SCALE);
    }
    ring(origin, "lightning", reducedMotion ? 0.6 : 1.1, 1.4);
  }
  function feature(kind, position, element, size, life) {
    const particle = acquire(kind, element, size, life);
    if (!particle) return null;
    particle.start.copy(position);
    particle.mesh.position.copy(position);
    return particle;
  }
  function burst(position, element, ultimate = false) {
    // Each attribute owns a different silhouette and impact choreography.
    // Shared comedy stars belong to knockouts, never to elemental attacks.
    const center = position.clone();
    const ground = position.clone();
    ground.y = FLOOR + 0.05;
    const scale = reducedMotion ? 0.45 : 1;
    if (element === "fire") {
      const count = reducedMotion ? 2 : ultimate ? 6 : 3;
      for (let i = 0; i < count; i++) {
        const point = ground.clone();
        const angle = (i * Math.PI * 2) / count;
        point.x += Math.cos(angle) * (ultimate ? 1.15 : 0.35) * scale;
        point.z += Math.sin(angle) * (ultimate ? 1.15 : 0.35) * scale;
        const flame = feature(
          "flameColumn",
          point,
          element,
          ultimate ? 0.36 : 0.17,
          ultimate ? 1.3 : 0.7,
        );
        if (flame) {
          flame.phase = i * 1.3;
          flame.mesh.material.color.setHex(i % 2 ? 0xe33116 : 0xff861e);
        }
      }
    } else if (element === "ice") {
      const count = reducedMotion ? 3 : ultimate ? 9 : 4;
      for (let i = 0; i < count; i++) {
        const angle = (i * Math.PI * 2) / count;
        const point = ground.clone();
        point.x += Math.cos(angle) * (ultimate ? 1.6 : 0.6) * scale;
        point.z += Math.sin(angle) * (ultimate ? 1.6 : 0.6) * scale;
        const crystal = feature(
          "icePillar",
          point,
          element,
          ultimate ? 0.32 : 0.15,
          ultimate ? 1.5 : 0.8,
        );
        if (crystal) {
          crystal.mesh.rotation.z = Math.cos(angle) * 0.22;
          crystal.mesh.rotation.x = Math.sin(angle) * 0.22;
          crystal.mesh.material.color.setHex(i % 2 ? 0x61c6ff : 0x3178df);
        }
      }
    } else if (element === "lightning") {
      const count = reducedMotion ? 1 : ultimate ? 3 : 1;
      for (let i = 0; i < count; i++) {
        const top = center.clone();
        top.y += (ultimate ? 7 : 3) * scale;
        top.x += (i - (count - 1) / 2) * 1.4 * scale;
        lightning(top, ground, ultimate);
      }
    } else if (element === "wind") {
      const vortex = feature(
        "vortex",
        ground,
        element,
        ultimate ? 0.64 : 0.28,
        ultimate ? 1.55 : 0.85,
      );
      if (vortex) {
        vortex.ultimate = ultimate;
        vortex.mesh.material.opacity = 0.72;
      }
      if (ultimate && !reducedMotion) {
        const second = feature("vortex", ground, element, 0.43, 1.35);
        if (second) {
          second.phase = Math.PI;
          second.mesh.material.color.setHex(0x7fd34a);
        }
      }
    } else if (element === "dark") {
      const core = feature(
        "eclipse",
        center,
        element,
        ultimate ? 0.43 : 0.18,
        ultimate ? 1.5 : 0.8,
      );
      if (core) core.mesh.material.color.setHex(0x180822);
      for (let i = 0; i < (ultimate ? 2 : 1); i++) {
        const halo = feature(
          "accretion",
          center,
          element,
          ultimate ? 0.65 : 0.28,
          ultimate ? 1.5 : 0.8,
        );
        if (halo) {
          halo.mesh.rotation.set(Math.PI / 2 + i * 0.85, 0.35, 0);
          halo.mesh.material.color.setHex(i ? 0x893bc4 : 0x50107b);
        }
      }
      for (let i = 0; i < (reducedMotion ? 3 : ultimate ? 12 : 5); i++) {
        const point = center.clone();
        const angle = i * 2.4;
        point.x += Math.cos(angle) * (ultimate ? 4 : 1.8) * scale;
        point.z += Math.sin(angle) * (ultimate ? 4 : 1.8) * scale;
        point.y += Math.sin(angle * 2) * scale;
        const inward = feature(
          "gravity",
          point,
          element,
          0.045,
          ultimate ? 1.25 : 0.65,
        );
        if (inward) inward.end.copy(center);
      }
    } else {
      const rock = feature(
        "meteor",
        ground,
        "earth",
        ultimate ? 0.38 : 0.18,
        ultimate ? 1.1 : 0.7,
      );
      if (rock) {
        rock.strength = ultimate ? 5.4 : 1.5;
        rock.mesh.material.color.setHex(0x86512c);
      }
      for (let i = 0; i < (reducedMotion ? 3 : ultimate ? 8 : 4); i++) {
        const crack = feature(
          "fissure",
          ground,
          "earth",
          ultimate ? 0.028 : 0.014,
          ultimate ? 1.4 : 0.7,
        );
        if (crack) {
          crack.phase = (i * Math.PI * 2) / (ultimate ? 8 : 4);
          crack.strength = (ultimate ? 3.5 : 1.3) * scale;
          crack.mesh.material.color.setHex(i % 2 ? 0x55371c : 0xce873a);
        }
      }
    }
    for (let i = 0; i < (reducedMotion ? 2 : ultimate ? 7 : 4); i++)
      spark(center, element, ultimate ? 1.2 : 0.8, reducedMotion);
  }
  function lightning(start, end, ultimate) {
    const pieces = ultimate ? 7 : 5;
    const horizontalLength = Math.hypot(end.x - start.x, end.z - start.z);
    const sideX =
      horizontalLength > 0.01 ? -(end.z - start.z) / horizontalLength : 0.92;
    const sideZ =
      horizontalLength > 0.01 ? (end.x - start.x) / horizontalLength : 0.38;
    const amplitude = (ultimate ? 0.88 : 0.34) * (reducedMotion ? 0.35 : 1);
    let x = start.x,
      y = start.y,
      z = start.z;
    for (let i = 1; i <= pieces; i++) {
      const t = i / pieces;
      // Alternating elbows remain visibly jagged, unlike small random jitter
      // which could accidentally produce three nearly straight vertical lines.
      const bend =
        i === pieces
          ? 0
          : (i % 2 ? 1 : -1) * amplitude * (0.9 + Math.random() * 0.2);
      const nx = THREE.MathUtils.lerp(start.x, end.x, t) + sideX * bend;
      const ny =
        THREE.MathUtils.lerp(start.y, end.y, t) +
        (i === pieces ? 0 : (Math.random() - 0.5) * 0.32);
      const nz = THREE.MathUtils.lerp(start.z, end.z, t) + sideZ * bend;
      const particle = acquire(
        "beam",
        "lightning",
        ultimate ? 0.028 : 0.017,
        ultimate ? 0.46 : 0.22,
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
      life: (ultimate ? 0.85 : 0.62) * Math.sqrt(SPECTACLE_SCALE),
      distance: (ultimate ? 1.9 : 1.2) * SPECTACLE_SCALE,
      height: (ultimate ? 1.1 : 0.5) * SPECTACLE_SCALE,
    });
  }
  function impact(particle) {
    const target = catAt(particle.target);
    if (!target) return;
    destination.copy(target.root.position);
    destination.y += 0.66;
    onImpact({
      position: { x: destination.x, y: destination.y, z: destination.z },
      start: { x: particle.start.x, y: particle.start.y, z: particle.start.z },
      direction: {
        x: destination.x - particle.start.x,
        z: destination.z - particle.start.z,
      },
      element: particle.element,
      ultimate: particle.ultimate,
      damage: particle.damage,
    });
    burst(destination, particle.element, particle.ultimate);
    if (particle.impact === "knockback")
      knockback(particle.attacker, particle.target, particle.ultimate);
  }
  function play(event) {
    if (disposed || !event) return;
    if (event.type === "round-end") {
      celebrate(event.winner ?? event.target ?? event.index);
      return;
    }
    const target = catAt(event.target ?? event.index);
    if (!target) return;
    if (event.type === "down" || event.type === "revive") {
      origin.copy(target.root.position);
      origin.y += 0.2;
      for (let i = 0; i < (reducedMotion ? 2 : 7); i++)
        cartoonStar(origin, "lightning", false);
      if (event.type === "down") dizzyStars(event.target ?? event.index);
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
      ultimate ? 0.27 : 0.14,
      ultimate ? 0.62 : element === "lightning" ? 0.16 : 0.46,
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
      damage: Number.isFinite(event.damage) ? event.damage : move.damage || 0,
      impact: event.effect ?? move.effect,
    });
    if (element === "lightning" && !ultimate)
      lightning(particle.start, particle.end, ultimate);
    if (element === "ice")
      particle.mesh.scale.set(
        particle.size * 0.7,
        particle.size * 1.8,
        particle.size * 0.7,
      );
    if (element === "lightning") particle.mesh.material.opacity = 0;
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
        const movement = reducedMotion ? 0.08 : 1;
        if (
          particle.ultimate &&
          (particle.element === "earth" || particle.element === "ice")
        ) {
          mesh.position.copy(particle.end);
          mesh.position.y +=
            (1 - t) * (particle.element === "earth" ? 6 : 4.5) * movement;
        } else if (particle.ultimate && particle.element === "dark") {
          mesh.position.copy(particle.end);
          mesh.scale.setScalar(particle.size * (0.2 + t * 0.8));
          mesh.material.color.setHex(0x180822);
        } else
          mesh.position.y +=
            Math.sin(t * Math.PI) *
            (particle.element === "earth"
              ? 1.8
              : particle.element === "fire"
                ? 0.8
                : 0.16) *
            movement;
        if (particle.element === "ice") {
          delta.copy(particle.end).sub(particle.start).normalize();
          mesh.quaternion.setFromUnitVectors(
            UP,
            particle.ultimate ? UP : delta,
          );
          mesh.scale.set(
            particle.size * 0.35,
            particle.size * 1.8,
            particle.size * 0.35,
          );
        } else if (particle.element === "wind")
          mesh.rotation.y += dt * (reducedMotion ? 0.6 : 9);
        else if (particle.element === "earth") {
          mesh.rotation.x += dt * 3 * movement;
          mesh.rotation.z += dt * 2 * movement;
        } else if (particle.element === "fire")
          mesh.rotation.z = Math.sin(particle.age * 16) * 0.12 * movement;
        mesh.material.opacity = particle.element === "lightning" ? 0 : 0.88;
        if (particle.age >= particle.nextTrail) {
          particle.nextTrail = particle.age + (reducedMotion ? 0.2 : 0.055);
          if (particle.element !== "lightning")
            spark(mesh.position, particle.element, 0.45, true);
        }
      } else if (particle.kind === "flameColumn") {
        const grow = Math.min(1, t * 6) * Math.pow(1 - t, 0.35);
        mesh.scale.set(
          particle.size *
            (0.7 +
              Math.sin(time * 19 + particle.phase) *
                (reducedMotion ? 0.015 : 0.13)),
          particle.size * grow * 1.35,
          particle.size * 0.7,
        );
        mesh.rotation.z =
          Math.sin(time * 12 + particle.phase) * (reducedMotion ? 0.01 : 0.09);
        mesh.material.opacity = Math.min(0.88, (1 - t) * 2);
      } else if (particle.kind === "icePillar") {
        const height = particle.size * 1.65 * Math.min(1, t * 7);
        mesh.scale.set(particle.size * 0.38, height, particle.size * 0.38);
        mesh.position.y = particle.start.y + height;
        mesh.material.opacity = Math.min(0.86, (1 - t) * 3);
      } else if (particle.kind === "vortex") {
        mesh.rotation.y =
          particle.phase + particle.age * (reducedMotion ? 0.35 : 8);
        mesh.scale.setScalar(
          particle.size * (0.55 + Math.sin(t * Math.PI) * 0.45),
        );
        mesh.material.opacity = Math.sin(t * Math.PI) * 0.76;
      } else if (particle.kind === "eclipse") {
        mesh.scale.setScalar(
          particle.size * (0.65 + Math.sin(t * Math.PI) * 0.35),
        );
        mesh.material.opacity = Math.min(0.94, (1 - t) * 4);
      } else if (particle.kind === "accretion") {
        mesh.scale.set(
          particle.size * (1 - t * 0.25),
          particle.size * (1 - t * 0.25),
          particle.size * 0.65,
        );
        mesh.rotation.z += dt * (reducedMotion ? 0.3 : 4);
        mesh.material.opacity = Math.min(0.85, (1 - t) * 3);
      } else if (particle.kind === "gravity") {
        mesh.position.lerpVectors(particle.start, particle.end, t * t);
        mesh.position.y += Math.sin(t * Math.PI) * (reducedMotion ? 0.05 : 0.5);
        mesh.scale.setScalar(particle.size * (1 - t));
        mesh.material.opacity = 0.78;
      } else if (particle.kind === "meteor") {
        const falling = Math.max(0, 1 - t * 3);
        mesh.position.y =
          particle.start.y +
          particle.size * 0.55 +
          falling * particle.strength * (reducedMotion ? 0.04 : 1);
        mesh.scale.set(
          particle.size,
          particle.size * (falling ? 1 : 0.55),
          particle.size,
        );
        mesh.rotation.y += dt * (reducedMotion ? 0.1 : 2.5);
        mesh.material.opacity = Math.min(0.95, (1 - t) * 3);
      } else if (particle.kind === "fissure") {
        const length = particle.strength * Math.min(1, t * 6);
        delta.set(Math.cos(particle.phase), 0, Math.sin(particle.phase));
        mesh.position.copy(particle.start).addScaledVector(delta, length * 0.5);
        mesh.quaternion.setFromUnitVectors(UP, delta);
        mesh.scale.set(particle.size, length, particle.size * 0.35);
        mesh.material.opacity = Math.min(0.9, (1 - t) * 3);
      } else if (particle.kind === "ring") {
        mesh.scale.setScalar(
          particle.size * (1 + t * (reducedMotion ? 0.6 : 2.4)),
        );
        mesh.material.opacity = (1 - t) * 0.6;
        mesh.rotation.z += dt * (reducedMotion ? 0.2 : 1.2);
      } else if (particle.kind === "beam")
        mesh.material.opacity = (1 - t) * 0.95;
      else if (particle.kind === "orbit") {
        const target = catAt(particle.target);
        if (!target) {
          release(particle);
          continue;
        }
        const angle =
          particle.phase + particle.age * (reducedMotion ? 0.3 : 3.8);
        mesh.position.copy(target.root.position);
        mesh.position.x +=
          Math.cos(angle) * (reducedMotion ? 0.4 : 0.58 * SPECTACLE_SCALE);
        mesh.position.z +=
          Math.sin(angle) * (reducedMotion ? 0.4 : 0.58 * SPECTACLE_SCALE);
        mesh.position.y +=
          1.05 + Math.sin(angle * 2) * (reducedMotion ? 0.01 : 0.08);
        mesh.rotation.y = -angle;
        mesh.rotation.z = Math.sin(angle) * 0.25;
        mesh.material.opacity = Math.min(1, (1 - t) * 4);
      } else {
        mesh.position.addScaledVector(particle.velocity, dt);
        particle.velocity.y -=
          dt *
          (particle.kind === "confetti"
            ? 2
            : particle.kind === "star"
              ? 1.8
              : particle.element === "earth"
                ? 2.1
                : 0.38);
        mesh.material.opacity = (1 - t) * 0.75;
        mesh.scale.multiplyScalar(Math.max(0.8, 1 - dt * 0.6));
        mesh.rotation.x +=
          dt * (reducedMotion ? 0.3 : particle.kind === "confetti" ? 9 : 3);
        mesh.rotation.z +=
          dt * (reducedMotion ? 0.2 : particle.kind === "star" ? 7 : 2);
      }
    }

    for (const index of shaking)
      if (
        cats[index] &&
        !snapshot?.fighters?.some(
          (fighter) => fighter.index === index && fighter.hp <= 0,
        )
      )
        cats[index].root.rotation.z = 0;
    shaking.clear();
    for (const fighter of snapshot?.fighters ?? []) {
      const cat = cats[fighter.index];
      const clocks = statusClocks[fighter.index];
      // The scene owns the collapsed pose. Do not straighten a defeated cat or
      // let a lingering paralysis status overwrite that pose on the next frame.
      if (!cat || !clocks || fighter.hp <= 0) continue;
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
      const previousT = Math.min(1, knock.age / knock.life);
      knock.age += dt;
      const t = Math.min(1, knock.age / knock.life);
      const amount =
        knock.distance *
        (2 * t - t * t - (2 * previousT - previousT * previousT));
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
