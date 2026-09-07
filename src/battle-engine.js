const makeMove = (
  element,
  id,
  name,
  description,
  damage,
  cooldown,
  effect = null,
  duration = 0,
  ultimate = false,
) =>
  Object.freeze({
    id,
    name,
    description,
    damage,
    cooldown,
    effect,
    duration,
    ultimate,
    element,
  });
const resident = (index, element, label, color, rows) =>
  Object.freeze({
    index,
    element,
    label,
    color,
    moves: Object.freeze(rows.map((row) => makeMove(element, ...row))),
  });

export const BATTLE_CATS = Object.freeze([
  resident(0, "fire", "炎", "#ed8655", [
    [
      "spark-paw",
      "火花ねこパンチ",
      "小さな火花をぱちん。炎が少しのあいだ残る。",
      10,
      1.6,
      "burn",
      2,
    ],
    [
      "sunny-flare",
      "ひだまりフレア",
      "集めた陽だまりを、まっすぐ放つ。",
      21,
      3.1,
    ],
    [
      "tail-firewheel",
      "しっぽ火輪",
      "しっぽで描いた火の輪が、じんわり燃える。",
      14,
      4.2,
      "burn",
      4,
    ],
    [
      "nine-suns",
      "究極・九つの陽炎",
      "幾重もの炎の輪と火花で、相手を包みこむ。",
      40,
      10,
      "burn",
      6,
      true,
    ],
  ]),
  resident(1, "ice", "氷", "#8acddd", [
    [
      "snowball-tap",
      "雪玉ころりん",
      "雪玉をころころ。冷たさで動きがゆっくりに。",
      11,
      1.8,
      "slow",
      2.5,
    ],
    [
      "frost-whisker",
      "霜ひげビーム",
      "きらめくひげから氷の光を飛ばす。",
      18,
      3.2,
      "freeze",
      0.8,
    ],
    [
      "ice-pawprint",
      "こおりの肉球",
      "足もとに雪の肉球を咲かせ、少し足止め。",
      13,
      4.2,
      "freeze",
      1.6,
    ],
    [
      "moon-snow-palace",
      "究極・月雪のねこ宮",
      "幾重もの氷の輪と結晶が広がり、相手を凍らせる。",
      39,
      10,
      "freeze",
      2.6,
      true,
    ],
  ]),
  resident(2, "dark", "闇", "#a899d6", [
    [
      "shadow-toe",
      "影ふみトコトコ",
      "影をふんで、相手のテンポを少しだけ遅らせる。",
      12,
      1.7,
      "slow",
      2,
    ],
    [
      "night-whisker",
      "夜ひげスラッシュ",
      "夜色のひげが、すっと空を切る。",
      23,
      3.4,
    ],
    [
      "phantom-purr",
      "まぼろしゴロゴロ",
      "不思議な喉鳴らしで影を揺らす。",
      15,
      4.4,
      "slow",
      4,
    ],
    [
      "thousand-night-cats",
      "究極・千夜ねこ行列",
      "夜色の波と光の粒が広がり、相手の動きを遅らせる。",
      46,
      10,
      "slow",
      5,
      true,
    ],
  ]),
  resident(3, "wind", "風", "#8acbaa", [
    [
      "breeze-paw",
      "そよかぜパンチ",
      "軽やかな風の肉球で、ふわっと押し返す。",
      12,
      1.5,
      "knockback",
      0.35,
    ],
    [
      "leaf-dance",
      "木の葉くるり",
      "くるりと回って、木の葉の輪を届ける。",
      22,
      3,
    ],
    [
      "whirlwind-leap",
      "つむじ風ジャンプ",
      "跳び上がった風が、相手をふわりと運ぶ。",
      17,
      4,
      "knockback",
      0.65,
    ],
    [
      "sky-cat-parade",
      "究極・天空ねこパレード",
      "大きな風の輪が広がり、相手をふわっと押し出す。",
      45,
      10,
      "knockback",
      1,
      true,
    ],
  ]),
  resident(4, "lightning", "雷", "#dfc55e", [
    [
      "static-paw",
      "ぱちぱち肉球",
      "ぱちっと小さな静電気。ほんの少し動きが止まる。",
      10,
      1.5,
      "paralyze",
      0.45,
    ],
    [
      "thunder-bell",
      "かみなり鈴",
      "りん、と鳴った鈴から雷がひとすじ。",
      22,
      3.2,
    ],
    [
      "zigzag-sprint",
      "ジグザグ電光",
      "稲妻みたいに走り、びりっと足止めする。",
      16,
      4.1,
      "paralyze",
      1.2,
    ],
    [
      "galaxy-thunder-paw",
      "究極・銀河雷ねこパンチ",
      "幾重もの雷の輪と電光が走り、びりっと足止めする。",
      43,
      10,
      "paralyze",
      2,
      true,
    ],
  ]),
  resident(5, "earth", "大地", "#bd9d70", [
    [
      "pebble-toss",
      "こいしコロコロ",
      "磨いた小石をころころ転がす、得意の一手。",
      15,
      1.7,
    ],
    [
      "earth-stamp",
      "どすんと肉球",
      "大地に肉球を置いて、小さな地響きを起こす。",
      20,
      3.3,
      "knockback",
      0.45,
    ],
    [
      "sand-cushion",
      "すなばクッション",
      "舞い上がる砂の粒で、相手のテンポをゆっくりに。",
      16,
      4.2,
      "slow",
      3,
    ],
    [
      "mountain-cat-throne",
      "究極・山猫の大地玉座",
      "大地の波と土のかけらが広がり、相手を押し返す。",
      49,
      10,
      "knockback",
      0.85,
      true,
    ],
  ]),
]);

const MAX_HP = 100;
const MAX_ENERGY = 100;
const GLOBAL_COOLDOWN = 0.7;
const BURN_PER_SECOND = 4;
const EFFECT_LIMITS = Object.freeze({
  burn: 6,
  freeze: 2.6,
  paralyze: 2,
  slow: 5,
  knockback: 1,
});
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const reject = (code, reason) => ({ ok: false, code, reason });
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const formation = (index) => ({
  x: Math.sin((index * Math.PI) / 3) * 1.55,
  y: 0,
  z: 0.75 + Math.cos((index * Math.PI) / 3) * 1.25,
});
const arenaPoint = (x, z) => ({
  x: clamp(x, -1.8, 1.8),
  z: clamp(z, -1, 2.65),
});

/** Six autonomous contestants; callers render movement intents, never pick attacks. */
export function createBattleEngine({
  onEvent,
  autonomous = true,
  random = Math.random,
} = {}) {
  const roll = () => {
    const value = random();
    return Number.isFinite(value) ? clamp(value, 0, 0.999999) : 0.5;
  };
  let time = 0,
    casts = 0,
    eventId = 0,
    round = 1;
  let phase = autonomous ? "countdown" : "fighting";
  let countdown = autonomous ? 3 : 0,
    winner = null,
    nextRoundIn = 0;
  let positions = BATTLE_CATS.map((cat) => formation(cat.index));
  const newFighter = (index) => ({
    index,
    hp: MAX_HP,
    energy: autonomous ? 35 : MAX_ENERGY,
    statuses: new Map(),
    cooldowns: [0, 0, 0, 0],
    eliminated: false,
    globalCooldown: 0,
    burnReportDamage: 0,
    burnReportTime: 0,
    target: null,
    moveTarget: null,
    speed: 0,
    normalCasts: 0,
    nextCast: 0.4 + index * 0.11 + roll() * 0.5,
    reconsiderIn: 0,
    lastAttacker: null,
    lastHitAt: -Infinity,
    orbitSign: roll() < 0.5 ? -1 : 1,
  });
  let fighters = BATTLE_CATS.map((cat) => newFighter(cat.index));
  const emit = (event) => onEvent?.({ id: ++eventId, time, round, ...event });
  const validIndex = (index) =>
    Number.isInteger(index) && index >= 0 && index < fighters.length;

  function down(fighter, attacker, at = time) {
    fighter.hp = 0;
    fighter.energy = 0;
    fighter.eliminated = true;
    fighter.target = null;
    fighter.moveTarget = null;
    fighter.speed = 0;
    fighter.statuses.clear();
    fighter.burnReportDamage = 0;
    fighter.burnReportTime = 0;
    emit({ type: "down", attacker, target: fighter.index, time: at });
  }
  function checkWinner() {
    if (phase !== "fighting") return;
    const alive = fighters.filter((fighter) => !fighter.eliminated);
    if (alive.length > 1) return;
    phase = "finished";
    winner = alive[0]?.index ?? null;
    nextRoundIn = autonomous ? 8 : 0;
    fighters.forEach((fighter) => {
      fighter.moveTarget = null;
      fighter.speed = 0;
      fighter.target = null;
    });
    emit({ type: "round-end", winner });
  }
  function startRound(number, restartTime = false) {
    if (restartTime) {
      time = 0;
      eventId = 0;
    }
    round = number;
    casts = 0;
    phase = autonomous ? "countdown" : "fighting";
    countdown = autonomous ? 3 : 0;
    nextRoundIn = 0;
    winner = null;
    positions = BATTLE_CATS.map((cat) => formation(cat.index));
    fighters = BATTLE_CATS.map((cat) => newFighter(cat.index));
    emit({ type: "reset" });
  }
  function advanceFighter(fighter, dt) {
    if (fighter.eliminated) return;
    let remaining = dt;
    while (remaining > 1e-9 && !fighter.eliminated) {
      const burn = fighter.statuses.get("burn");
      let step = remaining;
      for (const status of fighter.statuses.values())
        step = Math.min(step, status.remaining);
      if (burn)
        step = Math.min(
          step,
          fighter.hp / BURN_PER_SECOND,
          Math.max(0, 0.5 - fighter.burnReportTime),
        );
      fighter.globalCooldown = Math.max(0, fighter.globalCooldown - step);
      fighter.cooldowns = fighter.cooldowns.map((value) =>
        Math.max(0, value - step),
      );
      const damage = burn ? Math.min(fighter.hp, step * BURN_PER_SECOND) : 0;
      fighter.hp = Math.max(0, fighter.hp - damage);
      for (const [type, status] of fighter.statuses) {
        status.remaining = Math.max(0, status.remaining - step);
        if (status.remaining < 1e-9) fighter.statuses.delete(type);
      }
      remaining -= step;
      if (damage > 0) {
        fighter.burnReportDamage += damage;
        fighter.burnReportTime += step;
        if (
          fighter.burnReportTime >= 0.5 - 1e-9 ||
          !fighter.statuses.has("burn") ||
          fighter.hp < 1e-9
        ) {
          emit({
            type: "damage",
            attacker: burn.source,
            target: fighter.index,
            damage: fighter.burnReportDamage,
            effect: "burn",
            time: time + dt - remaining,
          });
          fighter.burnReportDamage = 0;
          fighter.burnReportTime = 0;
        }
      }
      if (fighter.hp < 1e-9) down(fighter, burn?.source, time + dt - remaining);
    }
  }
  function cast(attackerIndex, targetIndex, moveIndex) {
    if (!validIndex(attackerIndex))
      return reject("invalid-attacker", "攻撃する猫を選んでください。");
    if (!validIndex(targetIndex))
      return reject("invalid-target", "相手の猫を選んでください。");
    if (attackerIndex === targetIndex)
      return reject("self-target", "自分自身には技を使えません。");
    if (!Number.isInteger(moveIndex) || moveIndex < 0 || moveIndex > 3)
      return reject("invalid-move", "その技は使えません。");
    const attacker = fighters[attackerIndex],
      target = fighters[targetIndex];
    const move = BATTLE_CATS[attackerIndex].moves[moveIndex];
    if (attacker.eliminated)
      return reject("attacker-down", "このラウンドでは退場しています。");
    if (target.eliminated)
      return reject("target-down", "相手はこのラウンドから退場しています。");
    if (phase !== "fighting")
      return reject("not-fighting", "試合開始を待っています。");
    if (attacker.statuses.has("freeze"))
      return reject("frozen", "凍っていて、まだ動けません。");
    if (attacker.statuses.has("paralyze"))
      return reject("paralyzed", "しびれが落ち着くまで、少し待ってください。");
    if (attacker.globalCooldown > 1e-8)
      return reject("global-cooldown", "次の技まで、少し待ってください。");
    if (attacker.cooldowns[moveIndex] > 1e-8)
      return reject("cooldown", "この技は準備中です。");
    if (move.ultimate && attacker.energy < MAX_ENERGY)
      return reject("energy", "究極技にはエネルギーが100必要です。");
    if (
      autonomous &&
      distance(positions[attackerIndex], positions[targetIndex]) > 3.25
    )
      return reject("out-of-range", "射程外です。");
    attacker.globalCooldown =
      GLOBAL_COOLDOWN * (attacker.statuses.has("slow") ? 1.5 : 1);
    attacker.cooldowns[moveIndex] = move.cooldown;
    attacker.energy = move.ultimate
      ? attacker.energy - MAX_ENERGY
      : Math.min(MAX_ENERGY, attacker.energy + 24);
    if (!move.ultimate) attacker.normalCasts++;
    target.lastAttacker = attackerIndex;
    target.lastHitAt = time;
    const damage = Math.min(target.hp, move.damage);
    target.hp -= damage;
    if (target.hp > 0 && move.effect) {
      const previous = target.statuses.get(move.effect);
      target.statuses.set(move.effect, {
        type: move.effect,
        remaining: Math.min(
          EFFECT_LIMITS[move.effect],
          Math.max(previous?.remaining ?? 0, move.duration),
        ),
        source: attackerIndex,
      });
    }
    casts++;
    emit({
      type: "cast",
      attacker: attackerIndex,
      target: targetIndex,
      move,
      damage,
      effect: move.effect,
    });
    if (target.hp <= 0) down(target, attackerIndex);
    checkWinner();
    return { ok: true, reason: "", damage, effect: move.effect };
  }
  function chooseTarget(fighter) {
    let best = null,
      score = Infinity;
    for (const opponent of fighters) {
      if (opponent === fighter || opponent.eliminated) continue;
      const separation = distance(
        positions[fighter.index],
        positions[opponent.index],
      );
      const retaliation =
        opponent.index === fighter.lastAttacker && time - fighter.lastHitAt < 5
          ? 0.8
          : 0;
      const weakness = ((100 - opponent.hp) / 100) * 0.6;
      const candidate = separation - retaliation - weakness + roll() * 0.42;
      if (candidate < score) {
        score = candidate;
        best = opponent.index;
      }
    }
    fighter.target = best;
    fighter.reconsiderIn = 1.8 + roll() * 1.4;
  }
  function updateAI(dt) {
    for (const fighter of fighters) {
      if (phase !== "fighting") break;
      if (fighter.eliminated) continue;
      fighter.nextCast = Math.max(0, fighter.nextCast - dt);
      fighter.reconsiderIn -= dt;
      if (
        fighter.target === null ||
        fighters[fighter.target]?.eliminated ||
        fighter.reconsiderIn <= 0
      )
        chooseTarget(fighter);
      const target = fighters[fighter.target];
      if (
        !target ||
        fighter.statuses.has("freeze") ||
        fighter.statuses.has("paralyze")
      ) {
        fighter.speed = 0;
        fighter.moveTarget = null;
        continue;
      }
      const selfPosition = positions[fighter.index],
        targetPosition = positions[target.index];
      const dx = selfPosition.x - targetPosition.x,
        dz = selfPosition.z - targetPosition.z;
      const gap = Math.hypot(dx, dz),
        divisor = Math.max(gap, 0.001);
      const preferredRange =
        fighter.hp < 32 ? 2.65 : 1.75 + (fighter.index % 3) * 0.18;
      if (gap > 2.65) {
        fighter.moveTarget = arenaPoint(
          targetPosition.x + (dx / divisor) * 1.9,
          targetPosition.z + (dz / divisor) * 1.9,
        );
      } else if (fighter.hp < 32 && gap < 2.05) {
        fighter.moveTarget = arenaPoint(
          selfPosition.x + (dx / divisor) * 1.2,
          selfPosition.z + (dz / divisor) * 1.2,
        );
      } else {
        const angle = Math.atan2(dx, dz) + fighter.orbitSign * 0.38;
        fighter.moveTarget = arenaPoint(
          targetPosition.x + Math.sin(angle) * preferredRange,
          targetPosition.z + Math.cos(angle) * preferredRange,
        );
      }
      fighter.speed =
        (0.7 + (fighter.index % 3) * 0.065) *
        (fighter.statuses.has("slow") ? 0.55 : 1);
      if (fighter.nextCast > 0 || gap > 3.2) continue;
      const available = [0, 1, 2].filter(
        (index) => fighter.cooldowns[index] <= 1e-8,
      );
      let moveIndex = null;
      if (
        fighter.energy >= 100 &&
        fighter.normalCasts >= 3 &&
        fighter.cooldowns[3] <= 1e-8 &&
        roll() < 0.8
      )
        moveIndex = 3;
      else if (available.length) {
        const freshEffect = available.filter((index) => {
          const effect = BATTLE_CATS[fighter.index].moves[index].effect;
          return !effect || !target.statuses.has(effect);
        });
        const choices = freshEffect.length ? freshEffect : available;
        moveIndex = choices[Math.floor(roll() * choices.length)];
      }
      if (moveIndex === null) continue;
      const result = cast(fighter.index, target.index, moveIndex);
      if (result.ok) fighter.nextCast = 1.8 + roll() * 1.2;
    }
  }
  function snapshot() {
    return {
      time,
      casts,
      phase,
      round,
      countdown,
      winner,
      nextRoundIn,
      fighters: fighters.map((fighter) => ({
        index: fighter.index,
        hp: fighter.hp,
        maxHp: MAX_HP,
        energy: fighter.energy,
        statuses: [...fighter.statuses.values()].map(({ type, remaining }) => ({
          type,
          remaining,
        })),
        cooldowns: [...fighter.cooldowns],
        downRemaining: 0,
        globalCooldown: fighter.globalCooldown,
        eliminated: fighter.eliminated,
        target: fighter.target,
        moveTarget: fighter.moveTarget ? { ...fighter.moveTarget } : null,
        speed: fighter.speed,
        position: { ...positions[fighter.index] },
      })),
    };
  }
  return {
    cast,
    update(dt, suppliedPositions) {
      if (
        !Number.isFinite(dt) ||
        dt < 0 ||
        dt > 3600 ||
        !Number.isFinite(time + dt)
      )
        return false;
      const external = Array.isArray(suppliedPositions);
      if (external)
        suppliedPositions.forEach((position, index) => {
          if (
            positions[index] &&
            Number.isFinite(position?.x) &&
            Number.isFinite(position?.z)
          )
            positions[index] = {
              x: position.x,
              y: Number.isFinite(position.y) ? position.y : 0,
              z: position.z,
            };
        });
      if (!autonomous) {
        if (phase === "fighting") {
          fighters.forEach((fighter) => advanceFighter(fighter, dt));
          checkWinner();
        }
        time += dt;
        return true;
      }
      let remaining = dt;
      while (remaining > 1e-9) {
        const step = Math.min(
          remaining,
          0.05,
          phase === "countdown"
            ? Math.max(countdown, 1e-9)
            : phase === "finished"
              ? Math.max(nextRoundIn, 1e-9)
              : 0.05,
        );
        if (phase === "countdown") {
          countdown = Math.max(0, countdown - step);
          if (countdown < 1e-8) {
            countdown = 0;
            phase = "fighting";
            emit({ type: "round-start", time: time + step });
          }
        } else if (phase === "finished") {
          nextRoundIn = Math.max(0, nextRoundIn - step);
          if (nextRoundIn < 1e-8) startRound(round + 1);
        } else {
          fighters.forEach((fighter) => advanceFighter(fighter, step));
          checkWinner();
          if (phase === "fighting") updateAI(step);
          if (!external && phase === "fighting")
            for (const fighter of fighters) {
              if (
                !fighter.moveTarget ||
                fighter.speed <= 0 ||
                fighter.eliminated
              )
                continue;
              const position = positions[fighter.index],
                gap = distance(position, fighter.moveTarget);
              if (gap <= 0.13) continue;
              const stride = Math.min(gap, fighter.speed * step);
              position.x +=
                ((fighter.moveTarget.x - position.x) / gap) * stride;
              position.z +=
                ((fighter.moveTarget.z - position.z) / gap) * stride;
            }
        }
        time += step;
        remaining -= step;
      }
      return true;
    },
    snapshot,
    reset() {
      startRound(1, true);
      return snapshot();
    },
  };
}
