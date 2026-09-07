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
const REVIVE_SECONDS = 5;
const BURN_PER_SECOND = 4;
const EFFECT_LIMITS = Object.freeze({
  burn: 6,
  freeze: 2.6,
  paralyze: 2,
  slow: 5,
  knockback: 1,
});
const newFighter = (index) => ({
  index,
  hp: MAX_HP,
  energy: MAX_ENERGY,
  statuses: new Map(),
  cooldowns: [0, 0, 0, 0],
  downRemaining: 0,
  globalCooldown: 0,
  burnReportDamage: 0,
  burnReportTime: 0,
});
const reject = (code, reason) => ({ ok: false, code, reason });

/** A rendering-independent, six-resident elemental battle sandbox. */
export function createBattleEngine({ onEvent } = {}) {
  let fighters = BATTLE_CATS.map((cat) => newFighter(cat.index));
  let time = 0;
  let casts = 0;
  let eventId = 0;
  const emit = (event) => onEvent?.({ id: ++eventId, time, ...event });
  const validIndex = (index) =>
    Number.isInteger(index) && index >= 0 && index < fighters.length;

  function down(fighter, attacker, at = time) {
    fighter.hp = 0;
    fighter.energy = 0;
    fighter.downRemaining = REVIVE_SECONDS;
    fighter.statuses.clear();
    fighter.burnReportDamage = 0;
    fighter.burnReportTime = 0;
    emit({ type: "down", attacker, target: fighter.index, time: at });
  }
  function revive(fighter, at) {
    fighter.hp = MAX_HP;
    fighter.energy = MAX_ENERGY;
    fighter.downRemaining = 0;
    fighter.globalCooldown = 0;
    fighter.cooldowns.fill(0);
    fighter.statuses.clear();
    fighter.burnReportDamage = 0;
    fighter.burnReportTime = 0;
    emit({ type: "revive", target: fighter.index, time: at });
  }
  function advanceFighter(fighter, dt) {
    let remaining = dt;
    while (remaining > 1e-9) {
      if (fighter.downRemaining > 0) {
        const step = Math.min(remaining, fighter.downRemaining);
        fighter.downRemaining = Math.max(0, fighter.downRemaining - step);
        remaining -= step;
        if (fighter.downRemaining < 1e-9)
          revive(fighter, time + dt - remaining);
        continue;
      }
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

  return {
    cast(attackerIndex, targetIndex, moveIndex) {
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
      if (attacker.downRemaining > 0)
        return reject("attacker-down", "休憩中です。回復を待ってください。");
      if (target.downRemaining > 0)
        return reject(
          "target-down",
          "相手は休憩中です。別の相手を選んでください。",
        );
      if (attacker.statuses.has("freeze"))
        return reject("frozen", "凍っていて、まだ動けません。");
      if (attacker.statuses.has("paralyze"))
        return reject(
          "paralyzed",
          "しびれが落ち着くまで、少し待ってください。",
        );
      if (attacker.globalCooldown > 1e-8)
        return reject("global-cooldown", "次の技まで、少し待ってください。");
      if (attacker.cooldowns[moveIndex] > 1e-8)
        return reject("cooldown", "この技は準備中です。");
      if (move.ultimate && attacker.energy < MAX_ENERGY)
        return reject("energy", "究極技にはエネルギーが100必要です。");

      const slow = attacker.statuses.has("slow");
      attacker.globalCooldown = GLOBAL_COOLDOWN * (slow ? 1.5 : 1);
      attacker.cooldowns[moveIndex] = move.cooldown;
      attacker.energy = move.ultimate
        ? attacker.energy - MAX_ENERGY
        : Math.min(MAX_ENERGY, attacker.energy + 24);
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
      return { ok: true, reason: "", damage, effect: move.effect };
    },
    update(dt) {
      if (!Number.isFinite(dt) || dt < 0 || !Number.isFinite(time + dt))
        return false;
      // Process effect expiration, knockout and revival boundaries exactly,
      // rather than applying a whole frame of burn after its duration expires.
      for (const fighter of fighters) advanceFighter(fighter, dt);
      time += dt;
      return true;
    },
    snapshot() {
      return {
        time,
        casts,
        fighters: fighters.map((fighter) => ({
          index: fighter.index,
          hp: fighter.hp,
          maxHp: MAX_HP,
          energy: fighter.energy,
          statuses: [...fighter.statuses.values()].map(
            ({ type, remaining }) => ({ type, remaining }),
          ),
          cooldowns: [...fighter.cooldowns],
          downRemaining: fighter.downRemaining,
          globalCooldown: fighter.globalCooldown,
        })),
      };
    },
    reset() {
      fighters = BATTLE_CATS.map((cat) => newFighter(cat.index));
      time = 0;
      casts = 0;
      eventId = 0;
      emit({ type: "reset" });
      return this.snapshot();
    },
  };
}
