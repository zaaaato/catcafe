import { createBattleEffects } from "./battle-effects.js";
import { createSocialController } from "./social.js";
import { animateTail } from "./tail-motion.js";
import { applyFeedingPose, getFeedingDiagnostics } from "./feeding.js";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

export function createCafe(canvas, catsData, callbacks = {}, options = {}) {
  const battleMode = options.battle === true;
  let battleSnapshot = null;
  let disposed = false,
    frameId = 0,
    reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches,
    quality = "balanced",
    evening = false,
    contextLost = false,
    interaction = null;
  const listeners = [];
  function listen(target, event, handler, options) {
    target.addEventListener(event, handler, options);
    listeners.push(() => target.removeEventListener(event, handler, options));
  }
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#e9e5d9");
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(12.7, 12.1, 15.5);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 1, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.065;
  controls.minDistance = 3;
  controls.maxDistance = 28;
  controls.maxPolarAngle = Math.PI * 0.46;
  controls.minPolarAngle = 0.2;
  controls.enablePan = false;
  const ambient = new THREE.HemisphereLight(0xfff7e6, 0x9b9c7c, 2.15);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xffe8b5, 4);
  sun.position.set(-3, 10, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -9;
  sun.shadow.camera.right = 9;
  sun.shadow.camera.top = 9;
  sun.shadow.camera.bottom = -9;
  sun.shadow.normalBias = 0.025;
  sun.shadow.bias = -0.0003;
  sun.shadow.radius = 4;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xe5efff, 1.2);
  fill.position.set(6, 6, -2);
  scene.add(fill);
  const materialCache = new Map();
  function mat(c, rough = 0.85) {
    const key = `${c}-${rough}`;
    if (!materialCache.has(key))
      materialCache.set(
        key,
        new THREE.MeshStandardMaterial({ color: c, roughness: rough }),
      );
    return materialCache.get(key);
  }
  function mesh(geo, color, parent, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(
      geo,
      typeof color === "object" ? color : mat(color),
    );
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  function box(parent, w, h, d, c, x = 0, y = 0, z = 0, r = 0.035) {
    return mesh(
      r
        ? new RoundedBoxGeometry(w, h, d, 2, r)
        : new THREE.BoxGeometry(w, h, d),
      c,
      parent,
      x,
      y,
      z,
    );
  }
  const sphereGeo = new THREE.SphereGeometry(1, 28, 20);
  function ell(parent, x, y, z, sx, sy, sz, c) {
    const m = mesh(sphereGeo, c, parent, x, y, z);
    m.scale.set(sx, sy, sz);
    return m;
  }
  function cyl(parent, rt, rb, h, c, x = 0, y = 0, z = 0) {
    return mesh(new THREE.CylinderGeometry(rt, rb, h, 32), c, parent, x, y, z);
  }
  function tube(parent, points, r, c) {
    return mesh(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))),
        24,
        r,
        8,
        false,
      ),
      c,
      parent,
    );
  }
  // Static surfaces sharing a material are batched once. The articulated pieces
  // remain separate, but hundreds of boards, whiskers and toes do not each need
  // their own GPU draw call.

  function batchMeshes(parent, recursive = false) {
    parent.updateWorldMatrix(true, true);
    const meshes = [];
    if (recursive)
      parent.traverse((object) => {
        if (
          object.isMesh &&
          !object.userData.animated &&
          !Array.isArray(object.material) &&
          !object.material.transparent
        )
          meshes.push(object);
      });
    else
      for (const object of parent.children)
        if (
          object.isMesh &&
          !object.userData.animated &&
          !Array.isArray(object.material) &&
          !object.material.transparent
        )
          meshes.push(object);
    const inverse = parent.matrixWorld.clone().invert(),
      groups = new Map();
    for (const object of meshes) {
      const key = `${object.material.uuid}-${!!object.geometry.index}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(object);
    }
    for (const objects of groups.values()) {
      if (objects.length < 2) continue;
      const geometries = objects.map((object) =>
        object.geometry
          .clone()
          .applyMatrix4(
            new THREE.Matrix4().multiplyMatrices(inverse, object.matrixWorld),
          ),
      );
      const geometry = mergeGeometries(geometries, false);
      geometries.forEach((item) => item.dispose());
      if (!geometry) continue;
      const combined = mesh(geometry, objects[0].material, parent);
      combined.castShadow = objects.some((object) => object.castShadow);
      combined.receiveShadow = true;
      for (const object of objects) {
        object.removeFromParent();
        if (object.geometry !== sphereGeo) object.geometry.dispose();
      }
    }
  }
  const room = new THREE.Group();
  scene.add(room);
  // A miniature room, with a solid timber foundation and individually laid floorboards.
  box(room, 11.4, 0.42, 9.4, 0xb29a7b, 0, -0.27, 0, 0.12);
  box(room, 11.2, 0.08, 9.2, 0xe3c9a2, 0, -0.04, 0);
  for (let row = 0; row < 19; row++)
    for (let col = 0; col < 6; col++) {
      let x = -4.67 + col * 1.87 + (row % 2 ? 0.935 : 0);
      if (x > 5.3) continue;
      const width = Math.min(1.84, 5.58 - x + 0.92);
      box(
        room,
        width,
        0.035,
        0.46,
        [0xd9bc93, 0xe0c59f, 0xe5cba6, 0xdcc098][(col * 3 + row) % 4],
        x,
        0,
        -4.36 + row * 0.485,
        0.005,
      );
    }
  box(room, 11.35, 4.5, 0.16, 0xe7e4d2, 0, 2.22, -4.65, 0.03);
  box(room, 0.16, 4.5, 9.35, 0xe4e2cb, -5.65, 2.22, 0, 0.03);
  box(room, 11.2, 0.19, 0.12, 0xb9b797, 0, 0.14, -4.53);
  box(room, 0.12, 0.19, 9.2, 0xb9b797, -5.54, 0.14, 0);
  // Large green-framed windows on the left wall.
  for (const z of [-2.8, 0.5]) {
    box(room, 0.08, 2.8, 2.62, 0xa7b59a, -5.54, 2.6, z);
    box(room, 0.1, 2.55, 2.39, 0xdce7ce, -5.48, 2.6, z);
    const windowMat = new THREE.MeshStandardMaterial({
      color: 0xe8eed5,
      emissive: 0xc0d3a3,
      emissiveIntensity: 0.45,
      roughness: 0.35,
    });
    box(room, 0.03, 2.48, 2.33, windowMat, -5.415, 2.6, z);
    for (const off of [-1.27, 0, 1.27])
      box(room, 0.13, 2.85, 0.07, 0x95a080, -5.35, 2.6, z + off);
    box(room, 0.14, 0.075, 2.62, 0x95a080, -5.34, 2.7, z);
    box(room, 0.43, 0.12, 2.95, 0xeae5d0, -5.35, 1.18, z);
  }
  // Sunlit rectangles stretch from the windows across the floor.
  const sunPatch = new THREE.MeshBasicMaterial({
    color: 0xfff0bd,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
  });
  for (let i = 0; i < 2; i++) {
    const patch = mesh(
      new THREE.PlaneGeometry(3.4, 2.1),
      sunPatch,
      room,
      -3.5,
      0.027,
      -2.1 + i * 3.3,
    );
    patch.rotation.x = -Math.PI / 2;
    patch.rotation.z = -0.32;
  }
  function plant(x, y, z, s = 1) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.scale.setScalar(s);
    room.add(g);
    cyl(g, 0.32, 0.23, 0.53, 0xc09472, 0, 0.265);
    cyl(g, 0.285, 0.285, 0.04, 0x645c40, 0, 0.54);
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4,
        hh = 0.8 + (i % 3) * 0.25;
      const end = [Math.sin(a) * 0.36, hh, Math.cos(a) * 0.36];
      tube(
        g,
        [[0, 0.48, 0], [end[0] * 0.6, hh * 0.8, end[2] * 0.6], end],
        0.013,
        0x77855a,
      );
      const leaf = ell(
        g,
        ...end,
        0.13,
        0.34,
        0.055,
        [0x7a8d61, 0x93a471, 0x657d52][i % 3],
      );
      leaf.rotation.z = -Math.sin(a) * 0.7;
      leaf.rotation.y = a;
    }
    return g;
  }
  plant(-4.75, 0, -3.7, 1.2);
  plant(4.65, 0, -3.8, 1.65);
  plant(-5.12, 1.25, 0.5, 0.52);
  // Rear coffee bar, with slatted oak front and an espresso station.
  box(room, 4.1, 1.45, 0.97, 0xc0a37d, 0.5, 0.75, -3.9);
  for (let i = 0; i < 27; i++)
    box(room, 0.06, 1.31, 0.04, 0xa48a66, -1.45 + i * 0.148, 0.74, -3.39, 0.01);
  box(room, 4.35, 0.16, 1.15, 0xebe2cd, 0.5, 1.55, -3.87, 0.06);
  box(room, 1.03, 0.65, 0.54, 0x666c61, -0.42, 1.95, -3.92);
  box(room, 0.91, 0.28, 0.16, 0xbcc2b5, -0.42, 2.03, -3.6);
  box(room, 1.1, 0.07, 0.68, 0x404c45, -0.42, 1.68, -3.87);
  for (let i = 0; i < 2; i++) {
    cyl(room, 0.04, 0.04, 0.21, 0x39463c, -0.68 + i * 0.49, 1.86, -3.56);
    cyl(room, 0.095, 0.07, 0.17, 0xf5f0df, -0.68 + i * 0.49, 1.77, -3.57);
  }
  function cup(parent, x, y, z) {
    cyl(parent, 0.085, 0.067, 0.15, 0xf5f0df, x, y + 0.075, z);
    cyl(parent, 0.066, 0.066, 0.008, 0x654b36, x, y + 0.155, z);
    const h = mesh(
      new THREE.TorusGeometry(0.05, 0.012, 8, 16),
      0xf5f0df,
      parent,
      x + 0.09,
      y + 0.08,
      z,
    );
    h.rotation.y = 0;
  }
  cup(room, 0.68, 1.65, -3.72);
  cup(room, 1, 1.65, -3.72);
  cyl(room, 0.22, 0.22, 0.035, 0xafa37e, 1.62, 1.67, -3.75);
  ell(room, 1.62, 1.75, -3.75, 0.15, 0.08, 0.12, 0xb78147);
  box(room, 2.8, 0.12, 0.42, 0xac9472, -0.4, 3.24, -4.34);
  for (let i = 0; i < 5; i++)
    cyl(
      room,
      0.1,
      0.09,
      0.24,
      [0xe3d9bc, 0x7d8a73, 0xbb9479][i % 3],
      -1.48 + i * 0.29,
      3.41,
      -4.34,
    );
  plant(0.6, 3.31, -4.3, 0.44);
  function textLabel(text, w, h, bg, fg, size = 70) {
    const c = document.createElement("canvas");
    c.width = 768;
    c.height = 256;
    const ctx = c.getContext("2d");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = fg;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${size}px Georgia`;
    ctx.fillText(text, 384, 135);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshBasicMaterial({ map: tex });
  }
  box(room, 2.65, 0.87, 0.08, 0xbba382, 2.8, 3.07, -4.51);
  box(
    room,
    2.47,
    0.7,
    0.02,
    textLabel("komorebi", 2, 0.5, "#eee9d8", "#69765a", 81),
    2.8,
    3.07,
    -4.455,
    0.001,
  );
  // A linen sofa below the windows, with separate cushions and tiny piped pillows.
  const sofa = new THREE.Group();
  sofa.position.set(-4.4, 0, 1.45);
  room.add(sofa);
  box(sofa, 1.55, 0.35, 3.05, 0xa5ad8c, 0, 0.48, 0, 0.15);
  box(sofa, 0.29, 1.03, 3.13, 0xa3ad8b, -0.66, 0.99, 0, 0.12);
  for (const z of [-1.5, 1.5])
    box(sofa, 1.5, 0.77, 0.23, 0xb4bc9c, 0, 0.84, z, 0.1);
  for (const z of [-0.73, 0.73])
    box(sofa, 1.2, 0.25, 1.34, 0xc7cbb0, 0.08, 0.76, z, 0.1);
  for (const z of [-1.17, 1.17])
    for (const x of [-0.5, 0.5])
      cyl(sofa, 0.045, 0.04, 0.33, 0x876b4e, x, 0.17, z);
  const pillow = box(sofa, 0.25, 0.66, 0.63, 0xe4d5b7, -0.38, 1.06, 0.9, 0.16);
  pillow.rotation.z = -0.22;
  box(sofa, 0.25, 0.59, 0.65, 0xc1a184, -0.39, 1.07, -0.88, 0.14);
  // Woven center rug.
  const rug = cyl(room, 2.48, 2.48, 0.035, 0xb7bd9d, 0.1, 0.035, 0.75);
  rug.scale.z = 0.78;
  for (const r of [2.39, 2.28, 2.18]) {
    const ring = mesh(
      new THREE.TorusGeometry(r, 0.015, 6, 100),
      0xd5d6b7,
      room,
      0.1,
      0.06,
      0.75,
    );
    ring.rotation.x = -Math.PI / 2;
    ring.scale.y = 0.78;
  }
  function table(x, z, s = 1) {
    const g = new THREE.Group();
    room.add(g);
    g.position.set(x, 0, z);
    g.scale.setScalar(s);
    cyl(g, 0.72, 0.76, 0.11, 0xd1b48b, 0, 0.94);
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2) / 3;
      const leg = cyl(
        g,
        0.045,
        0.065,
        0.89,
        0x9a7d59,
        Math.sin(a) * 0.43,
        0.45,
        Math.cos(a) * 0.43,
      );
      leg.rotation.z = -Math.sin(a) * 0.13;
      leg.rotation.x = Math.cos(a) * 0.13;
    }
    cup(g, -0.17, 1, 0);
    cyl(g, 0.16, 0.16, 0.018, 0xf2e9d2, 0.23, 1.007, 0.05);
    ell(g, 0.23, 1.04, 0.05, 0.1, 0.035, 0.075, 0xba8855);
    return g;
  }
  table(-2.5, 1.3, 0.85);
  table(2.85, 1.45, 0.95);
  function stool(x, z) {
    cyl(room, 0.39, 0.39, 0.14, 0xd2bb95, x, 0.59, z);
    for (const dx of [-0.22, 0.22])
      for (const dz of [-0.22, 0.22])
        cyl(room, 0.036, 0.045, 0.53, 0xa28760, x + dx, 0.26, z + dz);
  }
  stool(3.7, 2.5);
  stool(2.32, 0.27);
  // Cat tree: wrapped posts, padded perches, a cozy hideaway, dangling ball.
  const tree = new THREE.Group();
  tree.position.set(3.5, 0, -1.5);
  room.add(tree);
  box(tree, 1.78, 0.13, 1.5, 0xc9bb9a, 0, 0.09, 0, 0.12);
  for (const [x, z, h] of [
    [-0.48, -0.3, 2.7],
    [0.48, 0.29, 1.55],
  ]) {
    cyl(tree, 0.095, 0.095, h, 0xbea482, x, h / 2, z);
    for (let k = 0; k < h / 0.09; k++) {
      const ring = mesh(
        new THREE.TorusGeometry(0.097, 0.009, 5, 12),
        0xdac5a4,
        tree,
        x,
        k * 0.09,
        z,
      );
      ring.rotation.x = Math.PI / 2;
    }
    cyl(tree, 0.56, 0.56, 0.15, 0xc8bd9f, x, h, z);
    cyl(tree, 0.49, 0.49, 0.065, 0xe2d5b7, x, h + 0.1, z);
  }
  box(tree, 1.07, 0.82, 0.88, 0xc4b698, -0.32, 0.68, -0.24, 0.14);
  const hole = mesh(
    new THREE.CircleGeometry(0.265, 32),
    0x696553,
    tree,
    -0.32,
    0.67,
    0.211,
  );
  tube(
    tree,
    [
      [0.01, 2.7, -0.3],
      [0.17, 2.4, -0.3],
      [0.19, 2.14, -0.3],
    ],
    0.014,
    0x8c8061,
  );
  ell(tree, 0.19, 2.08, -0.3, 0.1, 0.1, 0.1, 0x9ba889);
  // Water bowl, low bed, books and wall details.
  cyl(room, 0.29, 0.24, 0.12, 0xe9e1ca, 4.4, 0.08, -0.2);
  cyl(
    room,
    0.225,
    0.225,
    0.015,
    new THREE.MeshStandardMaterial({
      color: 0x97b6ae,
      roughness: 0.12,
      metalness: 0.2,
    }),
    4.4,
    0.148,
    -0.2,
  );
  const bed = mesh(
    new THREE.TorusGeometry(0.67, 0.14, 12, 48),
    0xccad8a,
    room,
    1.15,
    0.18,
    3.25,
  );
  bed.rotation.x = -Math.PI / 2;
  bed.scale.y = 0.83;
  cyl(room, 0.62, 0.62, 0.12, 0xe5d3b2, 1.15, 0.1, 3.25).scale.z = 0.83;
  for (let i = 0; i < 3; i++)
    box(
      room,
      0.43,
      0.07,
      0.32,
      [0x88957b, 0xd0b69a, 0xe7dfca][i],
      -2.53,
      0.88 + i * 0.07,
      1.47,
    );
  box(room, 1.5, 0.09, 0.42, 0xb69b76, -3.4, 2.75, -4.32);
  plant(-3.7, 2.8, -4.32, 0.43);
  box(room, 0.43, 0.55, 0.055, 0xb7a07f, -3.06, 3.06, -4.35);
  box(
    room,
    0.34,
    0.45,
    0.025,
    textLabel("猫", 1, 1, "#efe8d6", "#8d9876", 140),
    -3.06,
    3.06,
    -4.31,
    0.01,
  );
  // Hanging shades.
  for (const x of [-2, 2]) {
    cyl(room, 0.012, 0.012, 0.9, 0x786f56, x, 4.24, -1.9);
    mesh(
      new THREE.ConeGeometry(0.47, 0.42, 40, 1, true),
      new THREE.MeshStandardMaterial({
        color: 0xd8bc87,
        side: THREE.DoubleSide,
      }),
      room,
      x,
      3.7,
      -1.9,
    );
    ell(
      room,
      x,
      3.58,
      -1.9,
      0.09,
      0.09,
      0.09,
      new THREE.MeshStandardMaterial({
        color: 0xffedc4,
        emissive: 0xffd180,
        emissiveIntensity: 2,
      }),
    );
    const lamp = new THREE.PointLight(0xffce8b, 3, 5, 2);
    lamp.position.set(x, 3.5, -1.9);
    room.add(lamp);
  }

  // Cats are articulated, individually textured sculptures. Their surfaces have soft fur grain,
  // anatomically shaped cheeks, shoulder blades, hocks, split toes and almond-shaped glossy eyes.
  function furMaterial(base, patch, index, region = "body") {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 256;
    const ctx = c.getContext("2d");
    ctx.fillStyle = `#${base.toString(16).padStart(6, "0")}`;
    ctx.fillRect(0, 0, 512, 256);
    let seed = index + 31;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    // Coat markings are region specific: quiet faces, broken mackerel flanks and
    // generous calico patches. A shared spherical texture would repeat every stripe
    // across the shoulders, cheeks and feet, creating an artificial pinwheel.
    if ((index === 0 || index === 4) && region === "body") {
      ctx.fillStyle = `#${patch.toString(16).padStart(6, "0")}`;
      ctx.globalAlpha = 0.64;
      for (let i = 0; i < 9; i++) {
        const x = 17 + i * 61;
        ctx.beginPath();
        ctx.moveTo(x, 65 + rand() * 12);
        ctx.bezierCurveTo(x + 17, 102, x - 9, 133, x + 5, 186);
        ctx.bezierCurveTo(x + 23, 151, x + 17, 113, x + 17, 76);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 0.28;
      ctx.fillRect(0, 66, 512, 9);
      ctx.globalAlpha = 1;
    }
    if (index === 3 && region === "body") {
      for (const [x, y, rx, ry, c] of [
        [96, 132, 60, 62, "#bc895d"],
        [214, 99, 48, 43, "#4e5046"],
        [355, 145, 67, 58, "#bc895d"],
        [455, 105, 40, 36, "#4e5046"],
      ]) {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.ellipse(x, y, rx, ry, 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const shade = ctx.createLinearGradient(0, 0, 0, 256);
    shade.addColorStop(0, "rgba(255,251,235,.12)");
    shade.addColorStop(0.6, "rgba(255,251,235,0)");
    shade.addColorStop(1, "rgba(70,45,25,.05)");
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 16000; i++) {
      ctx.strokeStyle =
        rand() > 0.5 ? "rgba(255,255,240,.09)" : "rgba(40,30,20,.045)";
      const x = rand() * 512,
        y = rand() * 256;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + rand() * 2, y + 2 + rand() * 4);
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.93,
      color: 0xffffff,
    });
  }
  const cats = [];
  function createCat(data, index) {
    const root = new THREE.Group();
    scene.add(root);
    root.userData.catIndex = index;
    const fur = furMaterial(data.body, data.patch, index),
      faceFur = furMaterial(data.body, data.patch, index, "face"),
      plain = mat(data.body),
      dark = mat(data.patch),
      cream = mat(index === 2 ? 0x6a6d65 : 0xf4e8d3),
      pink = mat(index === 2 ? 0xa37d80 : 0xd69e94);
    const torso = new THREE.Group();
    root.add(torso);
    ell(torso, 0, 0.58, -0.04, 0.265, 0.31, 0.46, fur);
    ell(torso, 0, 0.64, 0.23, 0.24, 0.29, 0.23, faceFur);
    ell(torso, 0, 0.57, -0.33, 0.28, 0.3, 0.23, faceFur);
    ell(torso, 0, 0.49, 0.3, 0.19, 0.23, 0.16, index === 5 ? plain : cream);
    // Each limb has a shoulder/hip, a flexing elbow/hock and a separate paw.
    // Paws are placed on the floor first; two-bone IK finds the natural knee bend.
    const legs = [];
    for (const [x, z, front] of [
      [-0.17, 0.28, true],
      [0.17, 0.28, true],
      [-0.2, -0.34, false],
      [0.2, -0.34, false],
    ]) {
      const group = new THREE.Group();
      root.add(group);
      const upper = ell(
        group,
        0,
        0,
        0,
        front ? 0.083 : 0.116,
        0.16,
        front ? 0.082 : 0.12,
        faceFur,
      );
      const lower = ell(
        group,
        0,
        0,
        0,
        0.062,
        0.16,
        0.063,
        index === 5 ? dark : plain,
      );
      const paw = new THREE.Group();
      group.add(paw);
      ell(
        paw,
        0,
        0.025,
        0.025,
        0.088,
        0.061,
        0.113,
        index === 5 ? dark : index === 2 ? plain : cream,
      );
      for (let j = -1; j <= 1; j++) {
        ell(
          paw,
          j * 0.044,
          0.013,
          0.106,
          0.027,
          0.036,
          0.036,
          index === 5 ? dark : index === 2 ? plain : cream,
        );
        ell(paw, j * 0.04, -0.025, 0.074, 0.022, 0.007, 0.025, pink);
      }
      ell(paw, 0, -0.029, 0.018, 0.044, 0.007, 0.042, pink);
      legs.push({
        group,
        upper,
        lower,
        paw,
        front,
        x,
        z,
        foot: new THREE.Vector3(x, 0.08, z + 0.055),
        hip: new THREE.Vector3(),
        knee: new THREE.Vector3(),
      });
    }
    const head = new THREE.Group();
    head.position.set(0, 0.92, 0.38);
    torso.add(head);
    ell(head, 0, 0, 0, 0.28, 0.248, 0.255, faceFur);
    ell(head, -0.195, -0.072, 0.09, 0.115, 0.13, 0.14, faceFur);
    ell(head, 0.195, -0.072, 0.09, 0.115, 0.13, 0.14, faceFur);
    if (index === 3) {
      const patch = ell(head, -0.119, 0.085, 0.121, 0.139, 0.161, 0.131, dark);
      patch.rotation.z = -0.22;
      ell(head, 0.16, 0.055, 0.126, 0.109, 0.145, 0.121, 0x4e5046);
    }
    if (index === 5) {
      ell(head, 0, -0.005, 0.118, 0.224, 0.195, 0.151, dark);
    }
    // Curved tapered triangular ears, with a recessed inner shell and pale guard hairs.
    function ear(sign) {
      const group = new THREE.Group();
      group.position.set(sign * 0.2, 0.16, -0.025);
      group.rotation.z = sign * -0.17;
      group.scale.y = 0.72;
      head.add(group);
      const shape = new THREE.Shape();
      shape.moveTo(-0.11, 0);
      shape.quadraticCurveTo(-0.12, 0.13, -0.025, 0.35);
      shape.quadraticCurveTo(0, 0.375, 0.032, 0.33);
      shape.quadraticCurveTo(0.13, 0.14, 0.125, 0);
      shape.quadraticCurveTo(0, -0.04, -0.11, 0);
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: 0.062,
        bevelEnabled: true,
        bevelSegments: 3,
        steps: 1,
        bevelSize: 0.027,
        bevelThickness: 0.025,
        curveSegments: 10,
      });
      mesh(geo, index === 5 ? dark : plain, group, 0, 0, -0.04);
      const inner = new THREE.Shape();
      inner.moveTo(-0.072, 0.035);
      inner.quadraticCurveTo(-0.075, 0.15, -0.008, 0.29);
      inner.quadraticCurveTo(0.07, 0.15, 0.079, 0.035);
      inner.closePath();
      mesh(new THREE.ShapeGeometry(inner), pink, group, 0, 0, 0.053);
      for (let j = 0; j < 4; j++)
        tube(
          group,
          [
            [-0.055 + j * 0.025, 0.04, 0.062],
            [-0.045 + j * 0.025, 0.095, 0.066],
            [-0.028 + j * 0.015, 0.15, 0.065],
          ],
          0.004,
          index === 2 ? 0x9b9e90 : 0xf2e6d1,
        );
      return group;
    }
    const ears = [ear(-1), ear(1)];
    const eyes = [];
    for (const sign of [-1, 1]) {
      const eye = new THREE.Group();
      eye.position.set(sign * 0.125, 0.025, 0.217);
      eye.rotation.y = sign * 0.22;
      head.add(eye);
      ell(
        eye,
        0,
        0,
        0,
        0.083,
        0.07,
        0.031,
        index === 5 ? dark : mat(index === 2 ? 0x252b27 : 0x7a6b52),
      );
      ell(
        eye,
        0,
        0,
        0.021,
        0.069,
        0.056,
        0.022,
        new THREE.MeshStandardMaterial({
          color: index === 5 ? 0x8bc9d8 : index === 4 ? 0xadd092 : 0xd4bd6d,
          roughness: 0.16,
        }),
      );
      ell(eye, 0, 0, 0.041, 0.018, 0.047, 0.009, 0x202b26);
      ell(eye, -0.022, 0.023, 0.049, 0.013, 0.013, 0.005, 0xffffff);
      ell(eye, 0.019, -0.017, 0.047, 0.005, 0.005, 0.004, 0xfffae7);
      eyes.push(eye);
    }
    ell(head, -0.075, -0.102, 0.223, 0.095, 0.074, 0.063, cream);
    ell(head, 0.075, -0.102, 0.223, 0.095, 0.074, 0.063, cream);
    ell(head, 0, -0.151, 0.2, 0.085, 0.047, 0.052, cream);
    const noseShape = new THREE.Shape();
    noseShape.moveTo(-0.042, 0);
    noseShape.quadraticCurveTo(0, 0.018, 0.042, 0);
    noseShape.quadraticCurveTo(0.019, -0.036, 0, -0.036);
    noseShape.quadraticCurveTo(-0.015, -0.033, -0.042, 0);
    mesh(
      new THREE.ExtrudeGeometry(noseShape, {
        depth: 0.015,
        bevelEnabled: true,
        bevelSegments: 2,
        bevelSize: 0.005,
        bevelThickness: 0.004,
      }),
      pink,
      head,
      0,
      -0.069,
      0.283,
    );
    tube(
      head,
      [
        [0, -0.1, 0.287],
        [0, -0.13, 0.285],
        [-0.032, -0.143, 0.28],
        [-0.059, -0.13, 0.277],
      ],
      0.005,
      0x735e52,
    );
    tube(
      head,
      [
        [0, -0.13, 0.285],
        [0.032, -0.143, 0.28],
        [0.059, -0.13, 0.277],
      ],
      0.005,
      0x735e52,
    );
    for (const sign of [-1, 1])
      for (let j = 0; j < 3; j++) {
        tube(
          head,
          [
            [sign * 0.105, -0.087 - j * 0.023, 0.274],
            [sign * 0.27, -0.065 - j * 0.041, 0.29],
            [sign * 0.4, -0.055 - j * 0.055, 0.265],
          ],
          0.0026,
          index === 2 ? 0xe0dfce : 0x9b9685,
        );
        ell(
          head,
          sign * (0.08 + (j % 2) * 0.035),
          -0.08 - j * 0.023,
          0.283,
          0.006,
          0.005,
          0.003,
          0x8c7e6e,
        );
      }
    const tongue = ell(head, 0, -0.145, 0.278, 0.026, 0.011, 0.031, pink);
    tongue.visible = false;
    tongue.userData.animated = true;
    // Soft fur tufts around both cheeks, not just a sphere silhouette.
    for (const sign of [-1, 1])
      for (let j = 0; j < 3; j++) {
        const tuft = ell(
          head,
          sign * (0.257 + j * 0.014),
          -0.04 - j * 0.045,
          0.03,
          0.045,
          0.028,
          0.06,
          faceFur,
        );
        tuft.rotation.z = sign * (0.2 + j * 0.17);
      }
    if (index === 0 || index === 4) {
      for (const sign of [-1, 1])
        for (let j = 0; j < 2; j++) {
          const stripe = ell(
            head,
            sign * (0.24 - j * 0.01),
            0.0 - j * 0.055,
            0.16,
            0.055,
            0.011,
            0.013,
            dark,
          );
          stripe.rotation.z = sign * 0.3;
        }
      for (let j = -1; j <= 1; j++)
        ell(head, j * 0.064, 0.17, 0.167, 0.012, 0.055, 0.012, dark);
    }
    if (index === 5) {
      ell(head, 0, 0.1, -0.12, 0.17, 0.16, 0.1, dark);
    }
    // One continuous tapered surface gives the tail a soft silhouette at every zoom.
    const tail = new THREE.Group();
    tail.position.set(0, 0.63, -0.42);
    torso.add(tail);
    function tailSurface(points) {
      const curve = new THREE.CatmullRomCurve3(
          points.map((point) => new THREE.Vector3(...point)),
        ),
        geometry = new THREE.TubeGeometry(curve, 40, 0.061, 10, false),
        positions = geometry.attributes.position,
        vertex = new THREE.Vector3();
      for (let ring = 0; ring <= 40; ring++) {
        const t = ring / 40,
          center = curve.getPointAt(t),
          taper = 1 - 0.79 * t;
        for (let side = 0; side <= 10; side++) {
          const i = ring * 11 + side;
          vertex
            .fromBufferAttribute(positions, i)
            .sub(center)
            .multiplyScalar(taper)
            .add(center);
          positions.setXYZ(i, vertex.x, vertex.y, vertex.z);
        }
      }
      geometry.computeVertexNormals();
      return { geometry, tip: curve.getPointAt(1) };
    }
    const standingTail = tailSurface([
      [0, 0, 0],
      [0, 0.16, -0.19],
      [0.018, 0.4, -0.29],
      [0.05, 0.67, -0.28],
      [0.07, 0.84, -0.19],
      [0.055, 0.9, -0.085],
    ]);
    const seatedTail = tailSurface([
      [0, 0, 0],
      [0.25, -0.19, -0.17],
      [0.44, -0.36, 0.17],
      [0.39, -0.49, 0.76],
      [0.15, -0.56, 1.01],
      [-0.06, -0.565, 1.0],
    ]);
    const sleepingTail = tailSurface([
      [0, 0, 0],
      [0.24, -0.13, -0.15],
      [0.39, -0.23, 0.07],
      [0.36, -0.23, 0.55],
      [0.15, -0.23, 0.81],
      [-0.04, -0.23, 0.83],
    ]);
    standingTail.geometry.morphAttributes.position = [
      seatedTail.geometry.attributes.position,
      sleepingTail.geometry.attributes.position,
    ];
    standingTail.geometry.morphAttributes.normal = [
      seatedTail.geometry.attributes.normal,
      sleepingTail.geometry.attributes.normal,
    ];
    const tailMesh = mesh(
        standingTail.geometry,
        index === 5 ? dark : fur,
        tail,
      ),
      tip = standingTail.tip;
    const tailTip = ell(
        tail,
        tip.x,
        tip.y,
        tip.z,
        0.0128,
        0.0128,
        0.0128,
        index === 5 ? dark : fur,
      ),
      tailTips = [standingTail.tip, seatedTail.tip, sleepingTail.tip];
    root.scale.setScalar(index === 1 ? 0.94 : index === 4 ? 0.91 : 1.02);
    const snack = new THREE.Group();
    root.add(snack);
    snack.visible = false;
    for (let i = 0; i < 3; i++)
      ell(
        snack,
        (i - 1) * 0.075,
        0.072,
        0.7 + (i % 2) * 0.06,
        0.037,
        0.026,
        0.038,
        0x986d42,
      );
    batchMeshes(torso);
    batchMeshes(head);
    for (const earGroup of ears) batchMeshes(earGroup);
    for (const leg of legs) batchMeshes(leg.paw);
    const cat = {
      root,
      torso,
      head,
      eyes,
      ears,
      legs,
      tail,
      tailMesh,
      tailTip,
      tailTips,
      snack,
      tongue,
      interactionAt: -Infinity,
      feedTime: 0,
      brushTime: 0,
      index,
      phase: index * 1.87,
      gait: index * 1.87,
      pose:
        index === 1 || index === 5 ? "sleep" : index === 2 ? "sit" : "stand",
      previousPose: "stand",
      poseTime: 0,
      blinkTime: 1.1 + index * 0.57,
      blinkRemaining: 0,
      lookTime: 1 + index * 0.8,
      lookAngle: 0,
      energy: 1,
      huntPhase: "stalk",
      huntTime: 1 + index * 0.65,
      huntDuration: 1,
      pounceTarget: new THREE.Vector3(),
      kneadTime: 0,
      jump: null,
      nextJump: 5 + index * 4,
      target: new THREE.Vector3(),
      state: "walk",
      timer: 2 + index,
      pet: 0,
      mood: "",
      velocity: 0,
      route: [],
      routeGoal: new THREE.Vector3(Infinity, 0, Infinity),
      routeTimer: 0,
    };
    cats.push(cat);
    return cat;
  }
  const starts = [
    [-1.0, 1.65],
    [-3.5, -1.9],
    [1.55, -0.25],
    [-1.5, -1.6],
    [2, 2.8],
    [1.15, 3.25],
  ];
  catsData.forEach((c, i) => {
    const cat = createCat(c, i);
    cat.root.position.set(
      starts[i % starts.length][0],
      -0.015,
      starts[i % starts.length][1],
    );
    cat.root.rotation.y = [0.6, 1.3, -0.9, 0.8, -1.8, 1.5][i];
    cat.target.copy(cat.root.position);
    if (i === 1 || i === 5) {
      cat.state = "rest";
      cat.timer = 10 + i * 2;
    }
  });
  batchMeshes(room, true);
  // Small drifting hearts on petting.
  const furMotes = [];
  const hearts = [];
  const heartShape = new THREE.Shape();
  heartShape.moveTo(0, 0.03);
  heartShape.bezierCurveTo(-0.15, 0.2, -0.27, 0.02, 0, -0.17);
  heartShape.bezierCurveTo(0.27, 0.02, 0.15, 0.2, 0, 0.03);
  const heartGeo = new THREE.ShapeGeometry(heartShape);
  function pet(i) {
    if (battleMode) {
      callbacks.onBattleSelect?.(i);
      return;
    }
    const cat = cats[i];
    if (!cat || disposed || cat.pet > 2.4) return;
    cat.pet = 3;
    cat.state = "rest";
    cat.pose = "sit";
    cat.timer = 4;
    for (let j = 0; j < (reducedMotion ? 0 : 4); j++) {
      const h = mesh(
        heartGeo,
        new THREE.MeshBasicMaterial({
          color: 0xc68f78,
          transparent: true,
          side: THREE.DoubleSide,
        }),
        scene,
      );
      h.position
        .copy(cat.root.position)
        .add(
          new THREE.Vector3((Math.random() - 0.5) * 0.4, 1.25 + j * 0.15, 0),
        );
      hearts.push({ mesh: h, age: -j * 0.18 });
    }
    callbacks.onPet?.(i);
  }
  const raycaster = new THREE.Raycaster(),
    pointer = new THREE.Vector2();
  let down = null;
  function pickInfo(event) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      (-(event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    // The first opaque object must belong to a cat: tables and walls occlude pets.
    const catHit = raycaster.intersectObjects(
      cats.map((cat) => cat.root),
      true,
    )[0];
    if (!catHit) return null;
    const blocker = raycaster
      .intersectObject(room, true)
      .find((hit) => !hit.object.material?.transparent);
    if (blocker && blocker.distance < catHit.distance - 0.005) return null;
    let object = catHit.object;
    while (object && object.userData.catIndex === undefined)
      object = object.parent;
    if (!object) return null;
    const index = object.userData.catIndex,
      point = cats[index].root.worldToLocal(catHit.point.clone());
    return {
      index,
      point: catHit.point,
      zone: point.y > 0.66 && point.z > 0.13 ? "head" : "back",
    };
  }
  function interact(event) {
    if (!interaction) return;
    const hit = event
      ? pickInfo(event)
      : { index: interaction.index, zone: "head" };
    if (!hit || hit.index !== interaction.index) return;
    const cat = cats[hit.index],
      kind = interaction.kind;
    if (cat.jump || time - cat.interactionAt < (kind === "feed" ? 3.6 : 1))
      return;
    cat.interactionAt = time;
    let message = "";
    if (kind === "pet") {
      pet(hit.index);
      message =
        hit.zone === "head"
          ? "そこ、気持ちいい… すりすり。"
          : "背中をなでると、しっぽがぴん。";
    }
    if (kind === "brush") {
      cat.brushTime = 2.6;
      cat.pet = 2.6;
      cat.pose = "sit";
      message = "やさしく、とかして。ふわふわになったね。";
      if (!reducedMotion)
        for (let j = 0; j < 5; j++) {
          const mote = ell(
            scene,
            0,
            0,
            0,
            0.026,
            0.01,
            0.016,
            catsData[hit.index].body,
          );
          mote.position
            .copy(cat.root.position)
            .add(new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.7, 0));
          mote.castShadow = false;
          furMotes.push({
            mesh: mote,
            age: 0,
            vx: (Math.random() - 0.5) * 0.3,
            vz: (Math.random() - 0.5) * 0.3,
          });
        }
    }
    if (kind === "feed") {
      cat.feedTime = 3.2;
      cat.snack.visible = true;
      cat.pose = "stand";
      cat.pet = 0;
      message = "まずは、くんくん。…気に入ったみたい。";
    }
    callbacks.onInteraction?.({
      index: hit.index,
      kind,
      zone: hit.zone,
      message,
    });
  }
  listen(canvas, "pointerdown", (event) => {
    if (!event.isPrimary || event.button !== 0) {
      down = null;
      return;
    }
    down = {
      x: event.clientX,
      y: event.clientY,
      id: event.pointerId,
      time: performance.now(),
      moved: false,
    };
  });
  listen(canvas, "pointermove", (event) => {
    if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) > 6)
      down.moved = true;
    canvas.style.cursor = interaction
      ? pickInfo(event)
        ? "pointer"
        : "crosshair"
      : hitsToy(event)
        ? "grab"
        : event.buttons
          ? "grabbing"
          : pickInfo(event)
            ? "pointer"
            : "grab";
    if (down && interaction && interaction.kind !== "feed") interact(event);
  });
  listen(canvas, "pointerup", (event) => {
    const start = down;
    down = null;
    if (
      !start ||
      start.id !== event.pointerId ||
      start.moved ||
      performance.now() - start.time > 650 ||
      Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6
    )
      return;
    if (interaction) {
      interact(event);
      return;
    }
    const hit = pickInfo(event);
    if (hit) pet(hit.index);
  });
  listen(canvas, "pointercancel", () => {
    down = null;
  });
  listen(canvas, "pointerleave", () => {
    down = null;
    canvas.style.cursor = interaction ? "crosshair" : "grab";
  });
  const toy = new THREE.Group();
  scene.add(toy);
  ell(toy, 0, 0, 0, 0.14, 0.14, 0.14, 0xb79576);
  const stripe = mesh(
    new THREE.TorusGeometry(0.141, 0.01, 8, 24),
    0xf1ddbc,
    toy,
    0,
    0,
    0,
  );
  stripe.rotation.x = 0.5;
  toy.visible = false;
  toy.position.set(0, 0.2055, 1.35);
  let toyDrag = null,
    toyManual = false;
  const toyPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.2055);
  function toyRay(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      (-(event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
  }
  function hitsToy(event) {
    if (!toy.visible || interaction) return false;
    toyRay(event);
    const sphere = new THREE.Sphere(toy.position, 0.25);
    const hit = raycaster.ray.intersectSphere(sphere, new THREE.Vector3());
    if (!hit) return false;
    const blocker = raycaster
      .intersectObject(room, true)
      .find((item) => !item.object.material?.transparent);
    return !blocker || blocker.distance > hit.distanceTo(raycaster.ray.origin);
  }
  function placeToy(x, z) {
    // Keep the ball on the open rug, away from furniture and room edges.
    x = THREE.MathUtils.clamp(x, -1.65, 1.65);
    z = THREE.MathUtils.clamp(z, -0.55, 2.05);
    const edge = Math.hypot((x - 0.1) / 1.65, (z - 0.75) / 1.2);
    if (edge > 1) {
      x = 0.1 + (x - 0.1) / edge;
      z = 0.75 + (z - 0.75) / edge;
    }
    const dx = x - toy.position.x,
      dz = z - toy.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance > 0)
      toy.quaternion.premultiply(
        new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(dz, 0, -dx).normalize(),
          distance / 0.151,
        ),
      );
    toy.position.set(x, 0.2055, z);
  }
  function notifyToy() {
    callbacks.onToyChange?.({ dragging: Boolean(toyDrag), manual: toyManual });
  }
  function releaseToy() {
    if (!toyDrag) return;
    const id = toyDrag.id;
    toyDrag = null;
    if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
    controls.enabled = true;
    canvas.style.cursor = interaction ? "crosshair" : "grab";
    notifyToy();
  }
  listen(
    canvas,
    "pointerdown",
    (event) => {
      if (!event.isPrimary || event.button !== 0 || !hitsToy(event)) return;
      event.stopImmediatePropagation();
      event.preventDefault();
      const point = raycaster.ray.intersectPlane(toyPlane, new THREE.Vector3());
      if (!point) return;
      toyDrag = {
        id: event.pointerId,
        offset: toy.position.clone().sub(point),
      };
      toyManual = true;
      down = null;
      controls.enabled = false;
      canvas.setPointerCapture(event.pointerId);
      canvas.focus({ preventScroll: true });
      canvas.style.cursor = "grabbing";
      notifyToy();
    },
    { capture: true },
  );
  listen(
    canvas,
    "pointermove",
    (event) => {
      if (!toyDrag || event.pointerId !== toyDrag.id) return;
      event.stopImmediatePropagation();
      toyRay(event);
      const point = raycaster.ray.intersectPlane(toyPlane, new THREE.Vector3());
      if (point)
        placeToy(point.x + toyDrag.offset.x, point.z + toyDrag.offset.z);
    },
    { capture: true },
  );
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
    listen(
      canvas,
      type,
      (event) => {
        if (!toyDrag || event.pointerId !== toyDrag.id) return;
        event.stopImmediatePropagation();
        releaseToy();
      },
      { capture: true },
    );
  listen(window, "blur", releaseToy);
  const treats = new THREE.Group();
  scene.add(treats);
  cyl(treats, 0.43, 0.38, 0.065, 0xd2a680, 0, 0.085, 0);
  for (let j = 0; j < 14; j++)
    ell(
      treats,
      Math.sin(j * 2.4) * (0.1 + j * 0.015),
      0.13,
      Math.cos(j * 2.4) * (0.1 + j * 0.015),
      0.045,
      0.027,
      0.035,
      0x8a6546,
    );
  treats.visible = false;
  treats.position.set(0, 0, 1);
  let mode = "relax",
    time = 0,
    focused = -1,
    hidden = document.hidden,
    cameraTransition = null;
  listen(document, "visibilitychange", () => {
    hidden = document.hidden;
    last = performance.now();
  });
  listen(canvas, "webglcontextlost", (event) => {
    event.preventDefault();
    contextLost = true;
    callbacks.onContextLost?.();
  });
  listen(canvas, "webglcontextrestored", () => {
    contextLost = false;
    last = performance.now();
    callbacks.onContextRestored?.();
  });
  const stopTransition = () => {
    cameraTransition = null;
  };
  controls.addEventListener("start", stopTransition);
  const obstacles = [
    { x: -4.4, z: 1.45, r: 1.15 },
    { x: 3.5, z: -1.5, r: 1.05 },
    { x: 2.85, z: 1.45, r: 0.86 },
    { x: -2.5, z: 1.3, r: 0.71 },
    { x: 3.7, z: 2.5, r: 0.5 },
    { x: 2.32, z: 0.27, r: 0.46 },
    { x: -4.75, z: -3.7, r: 0.55 },
    { x: 4.65, z: -3.8, r: 0.75 },
  ];
  function allowed(x, z) {
    return (
      x > -4.7 &&
      x < 4.8 &&
      z > -2.9 &&
      z < 3.8 &&
      !obstacles.some((o) => Math.hypot(x - o.x, z - o.z) < o.r + 0.22)
    );
  }
  // Precompute a small navigation graph so cats can walk around furniture, including
  // destinations on the opposite side of a table, without pushing against its edge.
  function clearPath(a, b) {
    if (!allowed(b.x, b.z)) return false;
    const dx = b.x - a.x,
      dz = b.z - a.z,
      length2 = dx * dx + dz * dz;
    return !obstacles.some((o) => {
      const t = length2
        ? THREE.MathUtils.clamp(
            ((o.x - a.x) * dx + (o.z - a.z) * dz) / length2,
            0,
            1,
          )
        : 0;
      return Math.hypot(a.x + dx * t - o.x, a.z + dz * t - o.z) < o.r + 0.221;
    });
  }
  const navNodes = [],
    navGrid = new Map(),
    spacing = 0.22;
  for (let x = 0; x < 43; x++)
    for (let z = 0; z < 30; z++) {
      const node = {
        x: -4.55 + x * spacing,
        z: -2.75 + z * spacing,
        links: [],
      };
      if (allowed(node.x, node.z)) {
        node.id = navNodes.length;
        navNodes.push(node);
        navGrid.set(`${x},${z}`, node);
        node.gx = x;
        node.gz = z;
      }
    }
  for (const node of navNodes)
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ]) {
      const next = navGrid.get(`${node.gx + dx},${node.gz + dz}`);
      if (next && clearPath(node, next)) node.links.push(next.id);
    }
  // Furniture can enclose narrow pockets; choose destinations in the connected cafe floor.
  let walkableNodes = [];
  const visited = new Set();
  for (const node of navNodes) {
    if (visited.has(node.id)) continue;
    const component = [node];
    visited.add(node.id);
    for (let i = 0; i < component.length; i++)
      for (const id of component[i].links)
        if (!visited.has(id)) {
          visited.add(id);
          component.push(navNodes[id]);
        }
    if (component.length > walkableNodes.length) walkableNodes = component;
  }
  function nearestNode(point, requireVisible = true) {
    let best = null,
      dist = Infinity;
    for (const node of walkableNodes) {
      const d = (point.x - node.x) ** 2 + (point.z - node.z) ** 2;
      if (d < dist && (!requireVisible || clearPath(point, node))) {
        best = node;
        dist = d;
      }
    }
    return best;
  }
  function planRoute(cat) {
    cat.routeTimer = 0.8;
    cat.routeGoal.copy(cat.target);
    const start = cat.root.position,
      goal = cat.target;
    if (clearPath(start, goal)) {
      cat.route = [goal.clone()];
      return;
    }
    const from = nearestNode(start),
      to = nearestNode(goal, allowed(goal.x, goal.z));
    cat.route = [];
    if (!from || !to) return;
    const queue = [from.id],
      previous = new Map([[from.id, null]]);
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const id = queue[cursor];
      if (id === to.id) break;
      for (const next of navNodes[id].links)
        if (!previous.has(next)) {
          previous.set(next, id);
          queue.push(next);
        }
    }
    if (!previous.has(to.id)) return;
    const path = [];
    let id = to.id;
    while (id !== null) {
      const node = navNodes[id];
      path.unshift(new THREE.Vector3(node.x, start.y, node.z));
      id = previous.get(id);
    }
    if (allowed(goal.x, goal.z) && clearPath(path[path.length - 1], goal))
      path.push(goal.clone());
    let anchor = start;
    while (path.length) {
      let next = path.length - 1;
      while (next > 0 && !clearPath(anchor, path[next])) next--;
      anchor = path[next];
      cat.route.push(anchor);
      path.splice(0, next + 1);
    }
  }
  // Perches reserve one place at a time. Their floor approaches are outside the
  // navigation obstacles; only a jump is allowed to cross furniture boundaries.
  const perches = [
    {
      name: "ソファ",
      position: new THREE.Vector3(-4.12, 0.905, 0.62),
      approach: new THREE.Vector3(-3.12, -0.015, 0.18),
      owner: -1,
    },
    {
      name: "キャットタワー",
      position: new THREE.Vector3(3.98, 1.68, -1.21),
      approach: new THREE.Vector3(4.63, -0.015, -0.36),
      owner: -1,
    },
  ];
  function reservePerch(cat) {
    const preferred = cat.index === 1 ? 0 : 1,
      spot = perches[preferred];
    if (spot.owner !== -1) return false;
    spot.owner = cat.index;
    cat.jump = {
      spot,
      stage: "approach",
      time: 0,
      duration: 0,
      start: new THREE.Vector3(),
      end: new THREE.Vector3(),
    };
    cat.target.copy(spot.approach);
    cat.state = "walk";
    cat.pose = "stand";
    cat.timer = 30;
    cat.routeTimer = 0;
    return true;
  }
  function beginFlight(cat, downward) {
    const jump = cat.jump;
    jump.stage = downward ? "air-down" : "air-up";
    jump.time = 0;
    jump.duration = downward ? 0.68 : 0.86;
    jump.start.copy(cat.root.position);
    jump.end.copy(downward ? jump.spot.approach : jump.spot.position);
    const delta = jump.end.clone().sub(jump.start);
    cat.root.rotation.y = Math.atan2(delta.x, delta.z);
  }
  function updateJump(cat, dt) {
    const jump = cat.jump;
    if (!jump) return false;
    jump.time += dt;
    if (jump.stage === "approach") {
      cat.target.copy(jump.spot.approach);
      cat.state = "walk";
      cat.pose = "stand";
      if (
        mode !== "relax" ||
        interaction?.index === cat.index ||
        jump.time > 30
      ) {
        jump.spot.owner = -1;
        cat.jump = null;
        cat.nextJump = 25;
        return false;
      }
      if (
        Math.hypot(
          cat.root.position.x - jump.spot.approach.x,
          cat.root.position.z - jump.spot.approach.z,
        ) < 0.16
      ) {
        jump.stage = "prepare-up";
        jump.time = 0;
        cat.state = "rest";
        cat.pose = "stand";
      }
    } else if (jump.stage === "prepare-up") {
      cat.state = "rest";
      const desired = Math.atan2(
        jump.spot.position.x - cat.root.position.x,
        jump.spot.position.z - cat.root.position.z,
      );
      cat.root.rotation.y +=
        Math.atan2(
          Math.sin(desired - cat.root.rotation.y),
          Math.cos(desired - cat.root.rotation.y),
        ) *
        (1 - Math.exp(-dt * 7));
      if (jump.time > 0.95) beginFlight(cat, false);
    } else if (jump.stage === "air-up" || jump.stage === "air-down") {
      cat.state = "rest";
      const progress = THREE.MathUtils.clamp(jump.time / jump.duration, 0, 1);
      cat.root.position.lerpVectors(jump.start, jump.end, progress);
      cat.root.position.y +=
        Math.sin(progress * Math.PI) *
        (jump.stage === "air-up" ? 0.48 : 0.28) *
        (reducedMotion ? 0.45 : 1);
      if (progress === 1) {
        cat.root.position.copy(jump.end);
        jump.stage = jump.stage === "air-up" ? "land-up" : "land-down";
        jump.time = 0;
      }
    } else if (jump.stage === "land-up") {
      if (jump.time > 0.55) {
        jump.stage = "perch";
        jump.time = 0;
        jump.duration = 10 + Math.random() * 12;
        cat.pose = cat.index === 1 ? "knead" : "sit";
        cat.poseTime = 0;
      }
    } else if (jump.stage === "perch") {
      cat.state = "rest";
      if (cat.pose === "knead" && jump.time > 5) cat.pose = "sleep";
      if (
        mode !== "relax" ||
        interaction?.index === cat.index ||
        jump.time > jump.duration
      ) {
        jump.stage = "prepare-down";
        jump.time = 0;
        cat.pose = "stand";
      }
    } else if (jump.stage === "prepare-down") {
      const desired = Math.atan2(
        jump.spot.approach.x - cat.root.position.x,
        jump.spot.approach.z - cat.root.position.z,
      );
      cat.root.rotation.y +=
        Math.atan2(
          Math.sin(desired - cat.root.rotation.y),
          Math.cos(desired - cat.root.rotation.y),
        ) *
        (1 - Math.exp(-dt * 7));
      if (jump.time > 0.75) beginFlight(cat, true);
    } else if (jump.stage === "land-down" && jump.time > 0.45) {
      jump.spot.owner = -1;
      cat.jump = null;
      cat.nextJump = 30 + Math.random() * 25;
      cat.pose = "stand";
      cat.state = "rest";
      cat.timer = 1;
      cat.routeTimer = 0;
    }
    return !!cat.jump;
  }
  function wander(cat) {
    const node =
      walkableNodes[Math.floor(Math.random() * walkableNodes.length)];
    cat.target.set(node.x, -0.015, node.z);
    cat.routeTimer = 0;
  }
  function mood(cat, text) {
    if (cat.mood !== text) {
      cat.mood = text;
      callbacks.onMood?.(cat.index, text);
    }
  }
  let last = performance.now();
  const direction = new THREE.Vector3(),
    upVector = new THREE.Vector3(0, 1, 0);
  // Give the close-up a little breathing room without changing a cat's route.
  // This is local steering on the camera-facing side only; airborne cats retain
  // their complete landing trajectory and cats behind the subject stay free.
  function makeRoomForInteraction(cat) {
    if (
      !interaction ||
      interaction.index === cat.index ||
      (cat.jump && cat.jump.stage !== "approach")
    )
      return null;
    const subject = cats[interaction.index];
    if (
      subject.jump ||
      Math.abs(subject.root.position.y - cat.root.position.y) > 0.4
    )
      return null;
    const forward = camera.position.clone().sub(subject.root.position);
    forward.y = 0;
    forward.normalize();
    const right = new THREE.Vector3(forward.z, 0, -forward.x);
    const relative = cat.root.position.clone().sub(subject.root.position);
    const along = relative.dot(forward),
      lateral = relative.dot(right);
    if (along < -0.2 || along > 1.85 || Math.abs(lateral) > 1.02) return null;
    const preferred =
      Math.abs(lateral) > 0.08 ? Math.sign(lateral) : cat.index % 2 ? 1 : -1;
    for (const sign of [preferred, -preferred]) {
      const escape = right
        .clone()
        .multiplyScalar(sign)
        .addScaledVector(forward, along > 0.8 ? 0.22 : -0.18)
        .normalize();
      const destination = cat.root.position
        .clone()
        .addScaledVector(escape, 0.35);
      if (
        allowed(destination.x, destination.z) &&
        clearPath(cat.root.position, destination)
      )
        return escape;
    }
    return null;
  }
  const social = createSocialController(cats, {
    allowed,
    clearPath,
    onEvent: (event) => callbacks.onSocial?.(event),
  });
  const battleEffects = battleMode
    ? createBattleEffects({ scene, cats, allowed, clearPath })
    : null;
  const battleMarkers = battleMode
    ? [0xe3b55e, 0xcf776b].map((color) => {
        const marker = new THREE.Mesh(
          new THREE.RingGeometry(0.44, 0.48, 48),
          new THREE.MeshBasicMaterial({
            color,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.85,
            depthWrite: false,
          }),
        );
        marker.rotation.x = -Math.PI / 2;
        scene.add(marker);
        return marker;
      })
    : [];
  function resetBattlePositions() {
    if (!battleMode) return;
    cats.forEach((cat, i) => {
      const angle = (i * Math.PI) / 3;
      cat.root.position.set(
        Math.sin(angle) * 1.55,
        -0.015,
        0.75 + Math.cos(angle) * 1.25,
      );
      cat.root.rotation.set(0, angle + Math.PI, 0);
      cat.state = "rest";
      cat.pose = "stand";
      cat.jump = null;
      cat.route.length = 0;
      cat.velocity = 0;
      cat.pet = 0;
      cat.feedTime = 0;
      cat.brushTime = 0;
      cat.battleAttackTime = 0;
    });
  }
  resetBattlePositions();
  if (battleMode) {
    camera.position.set(7.8, 8.6, 10.1);
    controls.target.set(0, 0.65, 0.75);
  }
  function animate(now) {
    if (disposed) return;
    frameId = requestAnimationFrame(animate);
    if (hidden || contextLost) return;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    time += dt;
    const motion = reducedMotion ? 0.18 : 1;
    if (mode === "play" && !toyManual && !toyDrag)
      placeToy(Math.sin(time * 0.65) * 1.35, Math.cos(time * 0.9) * 0.75 + 0.6);
    if (!battleMode) social.update(dt, { mode, interaction, reducedMotion });
    for (const cat of cats) {
      const fighter = battleSnapshot?.fighters?.[cat.index];
      cat.battleAttackTime = Math.max(0, (cat.battleAttackTime || 0) - dt);
      const socialAction = battleMode ? null : social.get(cat);
      if (cat.socialActive && !socialAction) {
        cat.state = "rest";
        cat.pose = "sit";
        cat.timer = 2;
        cat.route.length = 0;
      }
      cat.socialActive = Boolean(socialAction);
      cat.timer -= dt;
      cat.poseTime += dt;
      cat.nextJump -= dt;
      cat.feedTime = Math.max(0, cat.feedTime - dt);
      cat.brushTime = Math.max(0, cat.brushTime - dt);
      cat.snack.visible = cat.feedTime > 0.05;
      cat.pet = Math.max(0, cat.pet - dt);
      const pos = cat.root.position;
      if (
        !battleMode &&
        !cat.jump &&
        !socialAction &&
        mode === "relax" &&
        interaction?.index !== cat.index &&
        cat.pet === 0 &&
        cat.nextJump <= 0 &&
        (cat.index === 1 || cat.index === 3)
      )
        reservePerch(cat);
      const jumping = updateJump(cat, dt);
      const interacting = interaction?.index === cat.index && !jumping;
      if (battleMode) {
        cat.state = "rest";
        cat.pose = fighter?.hp === 0 ? "sleep" : "stand";
        cat.timer = 2;
        cat.target.copy(pos);
      } else if (jumping) {
      } else if (interacting) {
        cat.state = "rest";
        cat.pose = cat.feedTime > 0 ? "stand" : "sit";
        cat.timer = 4;
        const desired = Math.atan2(
          camera.position.x - pos.x,
          camera.position.z - pos.z,
        );
        cat.root.rotation.y +=
          Math.atan2(
            Math.sin(desired - cat.root.rotation.y),
            Math.cos(desired - cat.root.rotation.y),
          ) *
          (1 - Math.exp(-dt * 2.8));
      } else if (socialAction) {
        cat.target.set(socialAction.target.x, -0.015, socialAction.target.z);
        cat.state = socialAction.moving ? "walk" : "rest";
        cat.pose = "stand";
        cat.timer = 2;
      } else if (mode === "play") {
        cat.huntTime -= dt;
        const toToy = Math.hypot(
          toy.position.x - pos.x,
          toy.position.z - pos.z,
        );
        if (
          cat.huntPhase === "stalk" &&
          ((toToy < 1.05 && cat.huntTime < 0) || cat.huntTime < -4)
        ) {
          cat.huntPhase = "wiggle";
          cat.huntDuration = 0.85 + Math.random() * 0.6;
          cat.huntTime = cat.huntDuration;
        } else if (cat.huntPhase === "wiggle" && cat.huntTime <= 0) {
          cat.huntPhase = "pounce";
          cat.huntDuration = 0.46 + Math.random() * 0.12;
          cat.huntTime = cat.huntDuration;
          cat.pounceTarget.copy(toy.position);
          cat.pounceTarget.y = -0.015;
          cat.routeTimer = 0;
        } else if (cat.huntPhase === "pounce" && cat.huntTime <= 0) {
          cat.huntPhase = "search";
          cat.huntTime = 1.2 + Math.random() * 1.8;
        } else if (cat.huntPhase === "search" && cat.huntTime <= 0) {
          cat.huntPhase = "stalk";
          cat.huntTime = 0.6 + Math.random() * 1.8;
        }
        const a =
          (cat.index * Math.PI) / 3 + Math.sin(time * 0.4 + cat.phase) * 0.12;
        if (cat.huntPhase === "pounce") cat.target.copy(cat.pounceTarget);
        else
          cat.target
            .copy(toy.position)
            .add(
              new THREE.Vector3(
                Math.sin(a) * (0.7 + cat.index * 0.035),
                0,
                Math.cos(a) * (0.7 + cat.index * 0.035),
              ),
            );
        cat.target.y = -0.015;
        cat.state =
          cat.huntPhase === "wiggle" || cat.huntPhase === "search"
            ? "rest"
            : "walk";
        cat.pose = "stand";
      } else if (mode === "treat") {
        const a = ((cat.treatSeat ?? cat.index) * Math.PI) / 3;
        cat.target.set(Math.sin(a) * 0.96, -0.015, 1 + Math.cos(a) * 0.96);
        cat.state = cat.target.distanceTo(pos) < 0.16 ? "eat" : "walk";
      } else if (cat.timer < 0) {
        if (cat.state === "walk") {
          cat.state = "rest";
          cat.pose = ["sit", "groom", "knead", "stand", "groom", "sit"][
            Math.floor(Math.random() * 6)
          ];
          cat.poseTime = 0;
          cat.timer =
            cat.pose === "sleep"
              ? 12 + Math.random() * 14
              : 4 + Math.random() * 6;
        } else if (cat.pose === "knead") {
          cat.pose = "sleep";
          cat.poseTime = 0;
          cat.timer = 12 + Math.random() * 12;
        } else if (cat.pose === "sleep") {
          cat.pose = "stretch";
          cat.poseTime = 0;
          cat.timer = 3.4;
        } else {
          cat.state = "walk";
          cat.pose = "stand";
          cat.poseTime = 0;
          cat.timer = 7 + Math.random() * 9;
          wander(cat);
        }
      }
      const yielding = battleMode ? null : makeRoomForInteraction(cat);
      cat.routeTimer -= dt;
      const dist = Math.hypot(cat.target.x - pos.x, cat.target.z - pos.z);
      let moving = false;
      const pouncing =
          mode === "play" &&
          cat.huntPhase === "pounce" &&
          !jumping &&
          !interacting &&
          !yielding,
        wiggling =
          mode === "play" &&
          cat.huntPhase === "wiggle" &&
          !jumping &&
          !interacting &&
          !yielding,
        searching =
          mode === "play" &&
          cat.huntPhase === "search" &&
          !jumping &&
          !interacting &&
          !yielding;
      const speed =
        (socialAction?.moving
          ? socialAction.speed
          : pouncing
            ? 2.25
            : mode === "play"
              ? 0.47 + cat.index * 0.027
              : 0.3 + cat.index * 0.018) * (reducedMotion ? 0.38 : 1);
      if (yielding) {
        const step = Math.min(0.4 * dt * (reducedMotion ? 0.5 : 1), 0.025);
        const nx = pos.x + yielding.x * step,
          nz = pos.z + yielding.z * step;
        if (allowed(nx, nz)) {
          const desired = Math.atan2(yielding.x, yielding.z);
          cat.root.rotation.y +=
            Math.atan2(
              Math.sin(desired - cat.root.rotation.y),
              Math.cos(desired - cat.root.rotation.y),
            ) *
            (1 - Math.exp(-dt * 7));
          pos.x = nx;
          pos.z = nz;
          moving = true;
        }
      } else if (cat.state === "walk" && dist > 0.13 && cat.pet === 0) {
        if (
          cat.routeTimer <= 0 ||
          cat.routeGoal.distanceToSquared(cat.target) > 0.16
        )
          planRoute(cat);
        while (
          cat.route.length &&
          Math.hypot(cat.route[0].x - pos.x, cat.route[0].z - pos.z) < 0.1 &&
          (cat.route.length === 1 || clearPath(pos, cat.route[1]))
        )
          cat.route.shift();
        if (cat.route.length) {
          direction.copy(cat.route[0]).sub(pos);
          direction.y = 0;
          direction.normalize();
          let vx = direction.x,
            vz = direction.z;
          for (const other of cats) {
            if (other === cat || Math.abs(pos.y - other.root.position.y) > 0.5)
              continue;
            const dx = pos.x - other.root.position.x,
              dz = pos.z - other.root.position.z,
              d = Math.hypot(dx, dz);
            if (d < 0.84 && d > 0.01) {
              vx += (dx / d) * (0.84 - d) * 3.2;
              vz += (dz / d) * (0.84 - d) * 3.2;
            }
          }
          const norm = Math.hypot(vx, vz) || 1,
            step = Math.min(
              speed * dt,
              Math.hypot(cat.route[0].x - pos.x, cat.route[0].z - pos.z),
            );
          let nx = pos.x + (vx / norm) * step,
            nz = pos.z + (vz / norm) * step;
          if (!allowed(nx, nz) || !clearPath({ x: nx, z: nz }, cat.route[0])) {
            nx = pos.x + direction.x * step;
            nz = pos.z + direction.z * step;
          }
          if (allowed(nx, nz)) {
            const desired = Math.atan2(nx - pos.x, nz - pos.z);
            cat.root.rotation.y +=
              Math.atan2(
                Math.sin(desired - cat.root.rotation.y),
                Math.cos(desired - cat.root.rotation.y),
              ) * Math.min(1, dt * 6);
            moving = Math.hypot(nx - pos.x, nz - pos.z) > 0.00001;
            pos.x = nx;
            pos.z = nz;
          } else cat.routeTimer = 0;
        }
      } else if (
        cat.state === "walk" &&
        mode === "relax" &&
        cat.pet === 0 &&
        !socialAction
      ) {
        cat.state = "rest";
        cat.pose = ["sit", "stand", "groom"][cat.index % 3];
        cat.poseTime = 0;
        cat.timer = 3 + Math.random() * 5;
      }
      if (socialAction && !socialAction.moving && socialAction.faceTarget) {
        const point = socialAction.faceTarget;
        const desired = Math.atan2(point.x - pos.x, point.z - pos.z);
        cat.root.rotation.y +=
          Math.atan2(
            Math.sin(desired - cat.root.rotation.y),
            Math.cos(desired - cat.root.rotation.y),
          ) *
          (1 - Math.exp(-dt * 6));
      }
      if (!yielding && (cat.state === "eat" || wiggling)) {
        const point = wiggling ? toy.position : treats.position;
        const desired = Math.atan2(point.x - pos.x, point.z - pos.z);
        cat.root.rotation.y +=
          Math.atan2(
            Math.sin(desired - cat.root.rotation.y),
            Math.cos(desired - cat.root.rotation.y),
          ) * Math.min(1, dt * 5);
      }
      cat.velocity = THREE.MathUtils.damp(cat.velocity, moving ? 1 : 0, 6, dt);
      // Gait follows distance travelled, so changing frame rate or pace never makes
      // the legs slide independently of the body. Diagonal pairs alternate softly.
      cat.gait += dt * speed * 14 * cat.velocity;
      const gait = cat.gait,
        still = 1 - cat.velocity;
      const sleeping =
        (mode === "relax" || cat.jump?.stage === "perch") &&
        cat.state === "rest" &&
        !yielding &&
        cat.pose === "sleep" &&
        cat.pet === 0;
      const kneading =
        !yielding && mode === "relax" && cat.pose === "knead" && cat.pet === 0;
      const sitting =
        !yielding &&
        cat.state === "rest" &&
        (cat.pose === "sit" || cat.pose === "groom" || cat.pet > 0) &&
        !wiggling &&
        !searching;
      const grooming = sitting && cat.pose === "groom" && cat.pet === 0;
      const stretching =
        !yielding && mode === "relax" && cat.pose === "stretch";
      const eating = !yielding && (cat.state === "eat" || cat.feedTime > 0);
      const sniffing = cat.feedTime > 2.1;
      cat.tongue.visible =
        ((eating && !sniffing) || grooming) && Math.sin(time * 7) > 0.5;
      cat.tongue.position.z = 0.283 + Math.max(0, Math.sin(time * 7)) * 0.018;
      const jumpStage = cat.jump?.stage,
        airborne = jumpStage === "air-up" || jumpStage === "air-down",
        preparing = jumpStage === "prepare-up" || jumpStage === "prepare-down",
        landing = jumpStage === "land-up" || jumpStage === "land-down";
      const flightProgress = airborne
        ? THREE.MathUtils.clamp(cat.jump.time / cat.jump.duration, 0, 1)
        : 0;
      const breathe = Math.sin(time * 1.7 + cat.phase) * 0.006;
      if (!jumping)
        pos.y =
          -0.015 +
          (pouncing
            ? Math.sin(
                Math.PI *
                  THREE.MathUtils.clamp(
                    1 - cat.huntTime / cat.huntDuration,
                    0,
                    1,
                  ),
              ) *
              0.16 *
              motion
            : 0);
      cat.torso.position.y = THREE.MathUtils.damp(
        cat.torso.position.y,
        (preparing
          ? cat.jump.time > 0.45
            ? -0.19
            : 0
          : landing
            ? -0.13 * Math.max(0, 1 - cat.jump.time / 0.5)
            : sleeping
              ? -0.29
              : sitting
                ? -0.13
                : stretching
                  ? -0.11
                  : wiggling
                    ? -0.18
                    : kneading
                      ? -0.12
                      : eating
                        ? -0.19
                        : 0) +
          Math.sin(gait * 2) * 0.009 * cat.velocity +
          breathe,
        5,
        dt,
      );
      cat.torso.rotation.x = THREE.MathUtils.damp(
        cat.torso.rotation.x,
        airborne
          ? jumpStage === "air-up"
            ? -0.22
            : 0.2
          : sitting
            ? -0.23
            : stretching
              ? 0.29
              : eating
                ? 0.18
                : wiggling
                  ? 0.08
                  : 0,
        5,
        dt,
      );
      cat.torso.rotation.z = wiggling
        ? Math.sin(time * 17 + cat.phase) * 0.055 * motion
        : Math.sin(gait) * 0.012 * cat.velocity;
      cat.torso.rotation.y = THREE.MathUtils.damp(
        cat.torso.rotation.y,
        wiggling ? Math.sin(time * 17 + cat.phase) * 0.065 * motion : 0,
        18,
        dt,
      );
      cat.torso.scale.y = THREE.MathUtils.damp(
        cat.torso.scale.y,
        sleeping ? 0.88 : 1,
        4,
        dt,
      );
      cat.torso.updateMatrix();
      const groomCycle = cat.poseTime % 3.8,
        faceWipe = groomCycle > 1.45 && groomCycle < 3.15;
      for (let j = 0; j < 4; j++) {
        const leg = cat.legs[j],
          front = leg.front,
          phase = gait + (j === 0 || j === 3 ? 0 : Math.PI),
          swing = Math.sin(phase);
        let footX = leg.x,
          footY = 0.081,
          footZ = leg.z + 0.055;
        if (moving) {
          footZ += swing * 0.115 * cat.velocity;
          footY += Math.max(0, Math.cos(phase)) * 0.064 * cat.velocity;
        }
        if (sitting) {
          footZ = front ? 0.39 : -0.18;
          footX = leg.x * (front ? 1 : 1.3);
        }
        if (sleeping) {
          footZ = front ? 0.36 : -0.18;
          footX = leg.x * 1.1;
          footY = 0.075;
        }
        if (stretching) {
          footZ = front ? 0.61 : -0.3;
          footY = 0.075;
        }
        if (wiggling) {
          footX += Math.sin(time * 17 + cat.phase) * 0.009 * motion;
          footZ += front ? 0.09 : 0;
        }
        if (pouncing) {
          footZ += front ? 0.18 : -0.12;
          footY += 0.035;
        }
        if (airborne) {
          footZ += front ? 0.2 : -0.17;
          footY += front
            ? flightProgress > 0.65
              ? -0.08
              : 0.12
            : 0.19 * Math.sin(flightProgress * Math.PI);
        }
        if (landing) {
          footY += !front ? 0.08 * Math.max(0, 1 - cat.jump.time / 0.25) : 0;
        }
        if (kneading && front) {
          const knead = Math.sin(time * 4.5 + (j === 0 ? 0 : Math.PI));
          footY += Math.max(0, knead) * 0.072 * motion;
          footZ += 0.09 + Math.max(0, knead) * 0.028;
        }
        if (grooming && j === 0) {
          if (faceWipe) {
            const stroke = Math.sin(((groomCycle - 1.45) / 1.7) * Math.PI);
            footX = -0.22;
            footY = 0.69 + stroke * 0.25;
            footZ = 0.48 - stroke * 0.19;
          } else {
            footX = -0.09;
            footY = 0.65;
            footZ = 0.52;
          }
        }
        if (
          battleMode &&
          cat.battleAttackTime > 0 &&
          j === 1 &&
          fighter?.hp !== 0
        ) {
          footY = 0.46;
          footZ = 0.65;
        }
        if (
          socialAction?.phase === "pawplay" &&
          socialAction.paw === j &&
          front
        ) {
          footY = 0.43;
          footZ = 0.65;
          footX *= 0.55;
        }
        leg.foot.lerp(
          new THREE.Vector3(footX, footY, footZ),
          1 - Math.exp(-dt * 12),
        );
        leg.hip.set(leg.x, 0.6, leg.z).applyMatrix4(cat.torso.matrix);
        const upperLength = front ? 0.265 : 0.285,
          lowerLength = front ? 0.265 : 0.28;
        const delta = leg.foot.clone().sub(leg.hip),
          distance = THREE.MathUtils.clamp(
            delta.length(),
            0.025,
            upperLength + lowerLength - 0.001,
          ),
          axis = delta.normalize();
        const along =
            (upperLength * upperLength -
              lowerLength * lowerLength +
              distance * distance) /
            (2 * distance),
          height = Math.sqrt(
            Math.max(0, upperLength * upperLength - along * along),
          );
        const bend = new THREE.Vector3(0, -axis.z, axis.y)
          .normalize()
          .multiplyScalar(front ? 1 : -1);
        leg.knee
          .copy(leg.hip)
          .addScaledVector(axis, along)
          .addScaledVector(bend, height);
        for (const [bone, start, end] of [
          [leg.upper, leg.hip, leg.knee],
          [leg.lower, leg.knee, leg.foot],
        ]) {
          bone.position.copy(start).add(end).multiplyScalar(0.5);
          const direction = end.clone().sub(start);
          bone.quaternion.setFromUnitVectors(
            upVector,
            direction.clone().normalize(),
          );
          bone.scale.y = direction.length() * 0.62;
        }
        leg.paw.position.copy(leg.foot);
        leg.paw.rotation.x = THREE.MathUtils.damp(
          leg.paw.rotation.x,
          grooming && j === 0 ? -0.7 : 0,
          8,
          dt,
        );
      }
      // Independent, irregular blinks and quiet attention shifts avoid synchronized
      // metronome motion. Cats attend to the toy or the treat bowl with their heads.
      cat.lookTime -= dt;
      if (cat.lookTime <= 0) {
        cat.lookAngle = (Math.random() - 0.5) * 0.52;
        cat.lookTime = 1.6 + Math.random() * 4;
      }
      let headYaw = socialAction
        ? 0
        : searching
          ? Math.sin(time * 2.2 + cat.phase) * 0.6
          : cat.lookAngle * still;
      if (
        !interacting &&
        ((mode === "play" && !searching) || mode === "treat")
      ) {
        const point = mode === "play" ? toy.position : treats.position;
        const yaw =
          Math.atan2(point.x - pos.x, point.z - pos.z) - cat.root.rotation.y;
        headYaw = THREE.MathUtils.clamp(
          Math.atan2(Math.sin(yaw), Math.cos(yaw)),
          -0.5,
          0.5,
        );
      }
      cat.head.rotation.y = THREE.MathUtils.damp(
        cat.head.rotation.y,
        sleeping ? 0.2 : grooming ? -0.24 : interacting ? 0 : headYaw,
        3,
        dt,
      );
      cat.head.rotation.x = THREE.MathUtils.damp(
        cat.head.rotation.x,
        preparing
          ? jumpStage === "prepare-up"
            ? -0.35
            : 0.3
          : airborne
            ? -0.07
            : sleeping
              ? 0.2
              : wiggling
                ? 0.15
                : kneading
                  ? 0.13
                  : eating
                    ? (sniffing ? 0.27 : 0.4) +
                      Math.sin(time * (sniffing ? 3 : 5)) * 0.035 * motion
                    : grooming
                      ? faceWipe
                        ? -0.06
                        : 0.3 + Math.sin(time * 5) * 0.06 * motion
                      : stretching
                        ? -0.12
                        : cat.pet > 0
                          ? -0.15
                          : sitting
                            ? -0.12
                            : Math.sin(gait) * 0.015,
        5,
        dt,
      );
      cat.head.position.z = THREE.MathUtils.damp(
        cat.head.position.z,
        cat.pet > 0 ? 0.41 + Math.sin(time * 2.5) * 0.025 * motion : 0.38,
        4,
        dt,
      );
      cat.head.rotation.z = THREE.MathUtils.damp(
        cat.head.rotation.z,
        cat.pet > 0
          ? Math.sin(time * 3) * 0.055 * motion
          : grooming
            ? -0.14
            : Math.sin(time * 0.4 + cat.phase) * 0.025 * still * motion,
        5,
        dt,
      );
      if (socialAction) {
        cat.head.rotation.x = THREE.MathUtils.damp(
          cat.head.rotation.x,
          socialAction.phase === "greet"
            ? 0.04
            : socialAction.phase === "pawplay"
              ? 0.12
              : -0.05,
          8,
          dt,
        );
        cat.head.rotation.y = THREE.MathUtils.damp(
          cat.head.rotation.y,
          0,
          8,
          dt,
        );
      }
      applyFeedingPose(cat, { eating, sniffing, dt, time, treats, motion });
      cat.blinkTime -= dt;
      if (cat.blinkTime < 0) {
        cat.blinkRemaining = 0.16;
        cat.blinkTime = 2.7 + Math.random() * 4.5;
      }
      cat.blinkRemaining = Math.max(0, cat.blinkRemaining - dt);
      for (const eye of cat.eyes)
        eye.scale.y = THREE.MathUtils.damp(
          eye.scale.y,
          sleeping || cat.pet > 0
            ? 0.08
            : cat.blinkRemaining > 0
              ? 0.05
              : eating
                ? 0.65
                : 1,
          25,
          dt,
        );
      cat.ears[0].rotation.x =
        Math.sin(time * 1.7 + cat.phase) * 0.045 * motion;
      cat.ears[1].rotation.z =
        -0.17 + Math.sin(time * 1.3 + cat.phase) * 0.04 * motion;
      cat.tailMesh.morphTargetInfluences[0] = THREE.MathUtils.damp(
        cat.tailMesh.morphTargetInfluences[0],
        sitting ? 1 : 0,
        4,
        dt,
      );
      cat.tailMesh.morphTargetInfluences[1] = THREE.MathUtils.damp(
        cat.tailMesh.morphTargetInfluences[1],
        sleeping ? 1 : 0,
        4,
        dt,
      );
      const seatedWeight = cat.tailMesh.morphTargetInfluences[0],
        sleepWeight = cat.tailMesh.morphTargetInfluences[1],
        upright = 1 - seatedWeight - sleepWeight;
      cat.tailTip.position
        .copy(cat.tailTips[0])
        .multiplyScalar(upright)
        .addScaledVector(cat.tailTips[1], seatedWeight)
        .addScaledVector(cat.tailTips[2], sleepWeight);
      cat.tail.rotation.z =
        (wiggling
          ? Math.sin(time * 19 + cat.phase) * 0.16
          : Math.sin(time * (1.35 + cat.index * 0.055) + cat.phase) *
            (moving ? 0.25 : 0.16)) *
        motion *
        upright;
      cat.tail.rotation.x = THREE.MathUtils.damp(
        cat.tail.rotation.x,
        (eating
          ? -0.85
          : -0.25 + Math.sin(time * 0.9 + cat.phase) * 0.06 * motion) * upright,
        4,
        dt,
      );
      animateTail(cat, {
        time,
        dt,
        moving,
        sitting,
        sleeping,
        wiggling,
        eating,
        motion,
      });
      mood(
        cat,
        yielding
          ? "ちょっと、おとなりへ"
          : jumping
            ? jumpStage === "approach"
              ? `${cat.jump.spot.name}に行こうかな`
              : preparing
                ? jumpStage === "prepare-up"
                  ? "見上げて… ぴょんの準備"
                  : "下を確かめて…"
                : airborne
                  ? "ぴょんっ！"
                  : landing
                    ? "とんっ、上手に着地"
                    : sleeping
                      ? "高いところで、すやすや"
                      : kneading
                        ? "ソファで、ふみふみ"
                        : `${cat.jump.spot.name}で、みんなを観察`
            : cat.feedTime > 0
              ? sniffing
                ? "くんくん、いいにおい"
                : "もぐもぐ… おいしいね"
              : cat.brushTime > 0
                ? "ブラシ、そこそこ… ♡"
                : cat.pet > 0
                  ? "ごろごろ… ♡"
                  : interacting
                    ? "そばで、あなたを見ている"
                    : socialAction
                      ? socialAction.mood
                      : mode === "play"
                        ? wiggling
                          ? "おしり、ふりふり…"
                          : pouncing
                            ? "えいっ、つかまえた？"
                            : searching
                              ? "あれ、どこいった？"
                              : "そーっと、狙いをさだめて"
                        : eating
                          ? "もぐもぐ"
                          : mode === "treat"
                            ? "おやつへ！"
                            : sleeping
                              ? "すやすや、おひるね"
                              : grooming
                                ? faceWipe
                                  ? "おててで、顔をくしくし"
                                  : "おててをぺろぺろ"
                                : kneading
                                  ? "ふみふみ、ねむくなってきた"
                                  : stretching
                                    ? "ぐーんとのびのび"
                                    : moving
                                      ? "気ままにおさんぽ"
                                      : sitting
                                        ? "おすわり、のんびり"
                                        : "きょろきょろ",
      );
    }
    for (let j = furMotes.length - 1; j >= 0; j--) {
      const mote = furMotes[j];
      mote.age += dt;
      mote.mesh.position.x += mote.vx * dt;
      mote.mesh.position.z += mote.vz * dt;
      mote.mesh.position.y += dt * (0.17 - mote.age * 0.2);
      mote.mesh.scale.multiplyScalar(Math.exp(-dt * 0.8));
      if (mote.age > 1.4) {
        scene.remove(mote.mesh);
        furMotes.splice(j, 1);
      }
    }
    for (let j = hearts.length - 1; j >= 0; j--) {
      const h = hearts[j];
      h.age += dt;
      h.mesh.visible = h.age >= 0;
      if (h.age > 0) {
        h.mesh.position.y += dt * 0.45;
        h.mesh.quaternion.copy(camera.quaternion);
        h.mesh.material.opacity = Math.max(0, 1 - h.age / 2);
        h.mesh.scale.setScalar(0.65 + h.age * 0.12);
      }
      if (h.age > 2) {
        scene.remove(h.mesh);
        h.mesh.material.dispose();
        hearts.splice(j, 1);
      }
    }
    if (focused >= 0 && cats[focused]) {
      const cat = cats[focused],
        target = cat.root.position.clone().add(new THREE.Vector3(0, 0.57, 0));
      if (
        battleMode &&
        cats[battleSnapshot?.attacker] &&
        cats[battleSnapshot?.target]
      ) {
        target
          .copy(cats[battleSnapshot.attacker].root.position)
          .add(cats[battleSnapshot.target].root.position)
          .multiplyScalar(0.5);
        target.y += 0.57;
      }
      if (cameraTransition) cameraTransition.target.copy(target);
      const delta = target
        .sub(controls.target)
        .multiplyScalar(1 - Math.exp(-dt * 4));
      controls.target.add(delta);
      camera.position.add(delta);
    }
    if (cameraTransition) {
      const factor = reducedMotion ? 1 : 1 - Math.exp(-dt * 4.5);
      controls.target.lerp(cameraTransition.target, factor);
      const destination = controls.target.clone().add(cameraTransition.offset);
      camera.position.lerp(destination, factor);
      if (
        camera.position.distanceTo(destination) < 0.02 &&
        controls.target.distanceTo(cameraTransition.target) < 0.02
      )
        cameraTransition = null;
    }
    battleEffects?.update(dt, battleSnapshot, { reducedMotion });
    battleMarkers.forEach((marker, i) => {
      const index =
        i === 0
          ? (battleSnapshot?.attacker ?? 0)
          : (battleSnapshot?.target ?? 1);
      const cat = cats[index];
      marker.visible = Boolean(cat);
      if (cat)
        marker.position.set(cat.root.position.x, 0.085, cat.root.position.z);
    });
    controls.update();
    renderer.render(scene, camera);
  }
  const resize = () => {
    if (disposed) return;
    const w = Math.max(1, canvas.clientWidth),
      h = Math.max(1, canvas.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas.parentElement || canvas);
  resize();
  frameId = requestAnimationFrame(animate);
  function setQuality(value) {
    if (!["low", "balanced", "high"].includes(value) || disposed) return;
    quality = value;
    renderer.setPixelRatio(
      Math.min(
        window.devicePixelRatio || 1,
        value === "high" ? 2 : value === "balanced" ? 1.5 : 1,
      ),
    );
    renderer.shadowMap.enabled = value !== "low";
    const size = value === "high" ? 2048 : 1024;
    if (sun.shadow.mapSize.x !== size) {
      sun.shadow.mapSize.set(size, size);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
    }
    resize();
    renderer.shadowMap.needsUpdate = true;
  }
  function interactionOffset(index) {
    const cat = cats[index],
      current = camera.position.clone().sub(controls.target),
      angle = Math.atan2(current.x, current.z),
      probe = new THREE.Raycaster();
    scene.updateMatrixWorld(true);
    let best = null,
      bestScore = Infinity;
    for (const turn of [0, 0.6, -0.6, 1.2, -1.2, 1.9, -1.9, Math.PI]) {
      const offset = new THREE.Vector3(
          Math.sin(angle + turn),
          0.42,
          Math.cos(angle + turn),
        )
          .normalize()
          .multiplyScalar(3.8),
        destination = cat.root.position
          .clone()
          .add(new THREE.Vector3(0, 0.57, 0))
          .add(offset);
      let score = Math.abs(turn) * 0.04;
      for (const height of [0.48, 0.96]) {
        const origin = cat.root.position
            .clone()
            .add(new THREE.Vector3(0, height, 0)),
          direction = destination.clone().sub(origin);
        probe.set(origin, direction.clone().normalize());
        probe.far = direction.length();
        if (
          probe
            .intersectObject(room, true)
            .some((hit) => !hit.object.material?.transparent)
        )
          score += 1;
      }
      if (score < bestScore) {
        bestScore = score;
        best = offset;
      }
      if (score === 0) break;
    }
    return best;
  }
  function reset() {
    releaseToy();
    interaction = null;
    controls.enableRotate = true;
    focused = -1;
    callbacks.onFocus?.(-1);
    cameraTransition = {
      target: battleMode
        ? new THREE.Vector3(0, 0.65, 0.75)
        : new THREE.Vector3(0, 1, 0),
      offset: battleMode
        ? new THREE.Vector3(7.8, 7.95, 9.35)
        : new THREE.Vector3(12.7, 11.1, 15.5),
    };
  }
  return {
    setBattleSnapshot(snapshot) {
      if (battleMode) battleSnapshot = snapshot;
    },
    playBattleEvent(event) {
      if (!battleMode || disposed) return;
      if (event.type === "cast" && cats[event.attacker] && cats[event.target]) {
        const cat = cats[event.attacker],
          target = cats[event.target].root.position;
        cat.battleAttackTime = 0.65;
        cat.root.rotation.y = Math.atan2(
          target.x - cat.root.position.x,
          target.z - cat.root.position.z,
        );
      }
      battleEffects.play(event);
    },
    resetBattle() {
      if (!battleMode) return;
      battleEffects.reset?.();
      resetBattlePositions();
      reset();
    },
    pet(i) {
      if (cats[i]) pet(i);
    },
    setInteraction(kind, index = focused) {
      if (battleMode) return;
      social.cancel();
      releaseToy();
      if (kind === null) {
        interaction = null;
        controls.enableRotate = true;
        canvas.style.cursor = "grab";
        return;
      }
      if (!["pet", "brush", "feed"].includes(kind) || !cats[index] || disposed)
        return;
      interaction = { kind, index };
      controls.enableRotate = false;
      canvas.style.cursor = "crosshair";
      this.focus(index);
      const offset = interactionOffset(index);
      cameraTransition = {
        target: cats[index].root.position
          .clone()
          .add(new THREE.Vector3(0, 0.62, 0)),
        offset,
      };
    },
    performInteraction() {
      interact(null);
    },
    moveToy(dx, dz) {
      if (
        disposed ||
        mode !== "play" ||
        interaction ||
        !Number.isFinite(dx) ||
        !Number.isFinite(dz)
      )
        return;
      toyManual = true;
      placeToy(toy.position.x + dx, toy.position.z + dz);
      notifyToy();
    },
    setMode(value) {
      if (battleMode) return;
      if (!["relax", "play", "treat"].includes(value) || disposed) return;
      social.cancel();
      releaseToy();
      if (mode !== value) toyManual = false;
      mode = value;
      notifyToy();
      toy.visible = value === "play";
      treats.visible = value === "treat";
      if (value === "treat") {
        // Preserve circular order around the bowl so diners do not swap through
        // one another. Choose the rotation with the shortest total approach.
        const ordered = [...cats].sort(
          (a, b) =>
            Math.atan2(a.root.position.x, a.root.position.z - 1) -
            Math.atan2(b.root.position.x, b.root.position.z - 1),
        );
        let best = 0,
          cost = Infinity;
        for (let offset = 0; offset < cats.length; offset++) {
          const candidate = ordered.reduce((sum, cat, i) => {
            const angle = (((i + offset) % cats.length) * Math.PI) / 3;
            return (
              sum +
              Math.hypot(
                cat.root.position.x - Math.sin(angle) * 0.96,
                cat.root.position.z - 1 - Math.cos(angle) * 0.96,
              )
            );
          }, 0);
          if (candidate < cost) {
            cost = candidate;
            best = offset;
          }
        }
        ordered.forEach((cat, i) => {
          cat.treatSeat = (i + best) % cats.length;
        });
      }
      for (const cat of cats) {
        cat.routeTimer = 0;
        if (cat.jump) continue;
        if (value === "relax") {
          cat.timer = 2 + Math.random() * 4;
          cat.state = "rest";
          cat.pose = cat.index === 1 || cat.index === 5 ? "sleep" : "sit";
        } else {
          cat.pet = 0;
          cat.pose = "stand";
          cat.huntPhase = "stalk";
          cat.huntTime = 0.6 + cat.index * 0.6;
        }
      }
    },
    focus(i) {
      if (!Number.isInteger(i) || !cats[i] || disposed) return;
      focused = i;
      callbacks.onFocus?.(i);
      const target = cats[i].root.position
        .clone()
        .add(new THREE.Vector3(0, 0.57, 0));
      const offset = camera.position.clone().sub(controls.target);
      const distance =
        battleMode &&
        cats[battleSnapshot?.attacker] &&
        cats[battleSnapshot?.target]
          ? THREE.MathUtils.clamp(
              cats[battleSnapshot.attacker].root.position.distanceTo(
                cats[battleSnapshot.target].root.position,
              ) *
                1.1 +
                4,
              5.5,
              10,
            )
          : THREE.MathUtils.clamp(offset.length(), 4.1, 5.5);
      offset.y = Math.min(offset.y, Math.hypot(offset.x, offset.z) * 0.72);
      offset.normalize().multiplyScalar(distance);
      cameraTransition = { target, offset };
    },
    zoom(factor) {
      if (!Number.isFinite(factor) || factor <= 0 || disposed) return;
      cameraTransition = null;
      camera.position
        .sub(controls.target)
        .multiplyScalar(1 / factor)
        .clampLength(controls.minDistance, controls.maxDistance)
        .add(controls.target);
    },
    reset,
    setEvening(on) {
      evening = !!on;
      scene.background.set(evening ? 0xb9b2a5 : 0xe9e5d9);
      sun.color.set(evening ? 0xffb977 : 0xffe8b5);
      sun.intensity = evening ? 1.8 : 4;
      fill.intensity = evening ? 0.45 : 1.2;
      ambient.intensity = evening ? 1.35 : 2.15;
      renderer.toneMappingExposure = evening ? 0.96 : 1.08;
    },
    setQuality,
    setReducedMotion(value) {
      reducedMotion = !!value;
      controls.enableDamping = !reducedMotion;
    },
    capture({ type = "image/png", quality: imageQuality = 0.92 } = {}) {
      if (disposed || contextLost)
        throw new Error("Cafe renderer is unavailable");
      renderer.render(scene, camera);
      return canvas.toDataURL(type, imageQuality);
    },
    getSnapshot() {
      return {
        mode,
        battle: battleMode ? battleSnapshot : null,
        social: social.snapshot(),
        focused,
        quality,
        reducedMotion,
        evening,
        interaction: interaction ? { ...interaction } : null,
        toy: {
          visible: toy.visible,
          dragging: Boolean(toyDrag),
          manual: toyManual,
          position: toy.position.toArray(),
          radius: 0.151,
          floorY: 0.0525,
          screen: (() => {
            const p = toy.position.clone().project(camera);
            const r = canvas.getBoundingClientRect();
            return {
              x: r.left + ((p.x + 1) * r.width) / 2,
              y: r.top + ((1 - p.y) * r.height) / 2,
            };
          })(),
        },
        diagnostics: {
          drawCalls: renderer.info.render.calls,
          triangles: renderer.info.render.triangles,
          geometries: renderer.info.memory.geometries,
          textures: renderer.info.memory.textures,
        },
        cats: cats.map((cat) => ({
          index: cat.index,
          mood: cat.mood,
          state: cat.state,
          pose: cat.pose,
          feeding: getFeedingDiagnostics(cat),
          tailTip: cat.tailTip.position.toArray(),
          social: social.get(cat)?.phase ?? null,
          paws: cat.legs.map((leg) => leg.foot.toArray()),
          jump: cat.jump?.stage ?? null,
          highSpot: cat.jump?.spot.name ?? null,
          huntPhase: mode === "play" ? cat.huntPhase : null,
          position: {
            x: cat.root.position.x,
            y: cat.root.position.y,
            z: cat.root.position.z,
          },
        })),
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      listeners.forEach((remove) => remove());
      controls.removeEventListener("start", stopTransition);
      battleEffects?.dispose();
      controls.dispose();
      const geometries = new Set(),
        materials = new Set(),
        textures = new Set();
      scene.traverse((object) => {
        if (object.geometry) geometries.add(object.geometry);
        if (object.material)
          for (const material of Array.isArray(object.material)
            ? object.material
            : [object.material])
            materials.add(material);
      });
      materials.forEach((material) => {
        for (const value of Object.values(material))
          if (value?.isTexture) textures.add(value);
        material.dispose();
      });
      textures.forEach((texture) => texture.dispose());
      geometries.forEach((geometry) => geometry.dispose());
      heartGeo.dispose();
      sun.shadow.map?.dispose();
      renderer.dispose();
      canvas.style.cursor = "";
    },
  };
}
