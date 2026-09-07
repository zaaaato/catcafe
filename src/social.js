const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const point = (cat) => ({ x: cat.root.position.x, z: cat.root.position.z });
const mix = (a, b, t) => ({
  x: a.x + (b.x - a.x) * t,
  z: a.z + (b.z - a.z) * t,
});

/** Coordinate one voluntary encounter; the scene retains all position/IK work. */
export function createSocialController(
  cats,
  { allowed, clearPath, onEvent } = {},
) {
  const isAllowed = allowed ?? (() => true);
  const isClear = clearPath ?? (() => true);
  const commands = new Map();
  let pair = null;
  let cooldown = 6;
  let clock = 0;
  let previousPair = "";
  const lastParticipation = new Map();

  const indexOf = (cat) =>
    Number.isInteger(cat.index) ? cat.index : cats.indexOf(cat);
  function eligible(cat) {
    return (
      cats.includes(cat) &&
      cat.root?.position &&
      Number.isFinite(cat.root.position.x) &&
      Number.isFinite(cat.root.position.z) &&
      Math.abs(cat.root.position.y ?? 0) < 0.2 &&
      !cat.jump &&
      cat.pose !== "sleep" &&
      cat.state !== "sleep" &&
      !(cat.pet > 0 || cat.feedTime > 0 || cat.brushTime > 0)
    );
  }
  function safe(a, b) {
    return isAllowed(b.x, b.z) && isClear(a, b);
  }
  function emit(phase, reason) {
    onEvent?.({
      phase,
      cats: pair ? pair.cats.map(indexOf) : [],
      reason,
      at: clock,
    });
  }
  function finish(reason = "complete") {
    if (pair) emit("end", reason);
    pair = null;
    commands.clear();
    cooldown = 18;
  }
  function choosePair() {
    const awake = cats.filter(eligible);
    let best = null;
    let bestCost = Infinity;
    for (let a = 0; a < awake.length; a++)
      for (let b = a + 1; b < awake.length; b++) {
        const first = awake[a],
          second = awake[b],
          pa = point(first),
          pb = point(second);
        const gap = distance(pa, pb);
        if (gap < 0.9 || gap > 4.8) continue;
        const half =
          (0.66 * ((first.root.scale?.z ?? 1) + (second.root.scale?.z ?? 1)) +
            0.015) /
          2;
        if (gap < half * 2 - 0.12) continue;
        const approachHalf = Math.max(0.45, half - 0.15);
        const center = mix(pa, pb, 0.5),
          dx = (pb.x - pa.x) / gap,
          dz = (pb.z - pa.z) / gap;
        const targets = [
          { x: center.x - dx * approachHalf, z: center.z - dz * approachHalf },
          { x: center.x + dx * approachHalf, z: center.z + dz * approachHalf },
        ];
        if (
          !safe(pa, targets[0]) ||
          !safe(pb, targets[1]) ||
          !safe(targets[0], targets[1])
        )
          continue;
        const pairKey = [indexOf(first), indexOf(second)]
          .sort((x, y) => x - y)
          .join(":");
        const recent = (cat) =>
          Math.max(
            0,
            1 - (clock - (lastParticipation.get(cat) ?? -Infinity)) / 45,
          ) * 0.22;
        const cost =
          gap +
          recent(first) +
          recent(second) +
          (pairKey === previousPair ? 0.45 : 0);
        if (cost < bestCost) {
          bestCost = cost;
          best = {
            cats: [first, second],
            targets,
            greetingDistance: half * 2,
            pairKey,
            phase: "approach",
            elapsed: 0,
            chasePath: [],
            pathIndex: 0,
            trail: [],
          };
        }
      }
    return best;
  }
  function beginPhase(phase) {
    if (phase === "greet") pair.targets = pair.cats.map(point);
    pair.phase = phase;
    pair.elapsed = 0;
    emit(phase);
  }
  function planChase() {
    const follower = point(pair.cats[0]),
      leader = point(pair.cats[1]);
    const angle = Math.atan2(leader.x - follower.x, leader.z - follower.z);
    for (const turn of [0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8, Math.PI]) {
      const dx = Math.sin(angle + turn),
        dz = Math.cos(angle + turn);
      const first = { x: leader.x + dx * 1.15, z: leader.z + dz * 1.15 };
      const second = {
        x: leader.x + dx * 1.85 + dz * 0.5,
        z: leader.z + dz * 1.85 - dx * 0.5,
      };
      if (!safe(leader, first) || !safe(first, second)) continue;
      pair.chasePath = [first, second];
      pair.pathIndex = 0;
      pair.trail = [follower, leader];
      return true;
    }
    return false;
  }
  function chaseTarget() {
    const leader = point(pair.cats[1]);
    const trail = pair.trail;
    if (distance(trail[trail.length - 1], leader) > 0.07) trail.push(leader);
    if (trail.length > 90) trail.shift();
    let remaining = 1.28;
    for (let i = trail.length - 1; i > 0; i--) {
      const length = distance(trail[i], trail[i - 1]);
      if (length >= remaining)
        return mix(trail[i], trail[i - 1], remaining / length);
      remaining -= length;
    }
    return { ...trail[0] };
  }
  function issueCommands() {
    commands.clear();
    if (!pair) return;
    const [first, second] = pair.cats;
    if (pair.phase === "chase") {
      const leader = point(second),
        follower = point(first);
      while (
        pair.pathIndex < pair.chasePath.length - 1 &&
        distance(leader, pair.chasePath[pair.pathIndex]) < 0.19
      )
        pair.pathIndex++;
      const leaderTarget = pair.chasePath[pair.pathIndex];
      const following = chaseTarget();
      const canFollow =
        distance(follower, leader) > 1.14 && safe(follower, following);
      commands.set(first, {
        phase: "chase",
        partner: indexOf(second),
        target: canFollow ? following : follower,
        faceTarget: leader,
        moving: canFollow && distance(follower, following) > 0.14,
        speed: 0.86,
        mood: "まてまて、追いかけっこ",
        paw: null,
        head: { yaw: 0, pitch: -0.03 },
      });
      commands.set(second, {
        phase: "chase",
        partner: indexOf(first),
        target: { ...leaderTarget },
        faceTarget: leaderTarget,
        moving: distance(leader, leaderTarget) > 0.16,
        speed: 0.72,
        mood: "こっちだよ！",
        paw: null,
        head: { yaw: 0, pitch: 0 },
      });
      return;
    }
    for (let i = 0; i < 2; i++) {
      const cat = pair.cats[i],
        partner = pair.cats[1 - i];
      const approaching = pair.phase === "approach";
      const pawTurn = Math.floor(pair.elapsed / 0.75) % 2;
      commands.set(cat, {
        phase: pair.phase,
        partner: indexOf(partner),
        target: { ...pair.targets[i] },
        faceTarget: point(partner),
        moving: approaching && distance(point(cat), pair.targets[i]) > 0.15,
        speed: 0.64,
        mood: approaching
          ? "友だちに、そーっと近づく"
          : pair.phase === "greet"
            ? "お鼻で、こんにちは"
            : "おててで、ちょいちょい",
        paw:
          pair.phase === "pawplay" && pawTurn === i ? (i === 0 ? 1 : 0) : null,
        head: { yaw: 0, pitch: pair.phase === "greet" ? 0.04 : 0.08 },
      });
    }
  }
  return {
    update(dt, { mode = "relax", interaction = null } = {}) {
      const step = Number.isFinite(dt) ? Math.max(0, dt) : 0;
      clock += step;
      if (mode !== "relax" || interaction) {
        if (pair) finish(interaction ? "interaction" : "mode");
        commands.clear();
        return;
      }
      if (pair && !pair.cats.every(eligible)) {
        finish("unavailable");
        return;
      }
      if (!pair) {
        cooldown = Math.max(0, cooldown - step);
        if (cooldown > 0) return;
        pair = choosePair();
        if (!pair) {
          cooldown = 2;
          return;
        }
        previousPair = pair.pairKey;
        pair.cats.forEach((cat) => lastParticipation.set(cat, clock));
        emit("approach");
      } else {
        pair.elapsed += step;
        if (pair.phase === "approach") {
          const ready = pair.cats.every(
            (cat, i) => distance(point(cat), pair.targets[i]) < 0.31,
          );
          const separation = distance(point(pair.cats[0]), point(pair.cats[1]));
          if (
            ready &&
            separation >= Math.max(1.12, pair.greetingDistance - 0.1) &&
            separation <= pair.greetingDistance + 0.075
          )
            beginPhase("greet");
          else if (pair.elapsed >= 15) {
            finish("approach-timeout");
            return;
          }
        } else if (pair.phase === "greet" && pair.elapsed >= 2)
          beginPhase("pawplay");
        else if (pair.phase === "pawplay" && pair.elapsed >= 3) {
          if (planChase()) beginPhase("chase");
          else {
            finish("no-safe-chase");
            return;
          }
        } else if (pair.phase === "chase" && pair.elapsed >= 5) {
          finish();
          return;
        }
      }
      issueCommands();
    },
    get(cat) {
      const resident =
        typeof cat === "number"
          ? cats.find((item) => indexOf(item) === cat)
          : cat;
      return commands.get(resident) ?? null;
    },
    cancel() {
      finish("cancelled");
    },
    snapshot() {
      return {
        active: Boolean(pair),
        phase: pair?.phase ?? null,
        cats: pair?.cats.map(indexOf) ?? [],
        elapsed: pair?.elapsed ?? 0,
        cooldown,
        commands: [...commands].map(([cat, command]) => ({
          index: indexOf(cat),
          ...command,
          target: { ...command.target },
          faceTarget: { ...command.faceTarget },
        })),
      };
    },
  };
}
