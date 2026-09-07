import "./battle.css";
import { cats } from "./cats.js";
import {
  createIcons,
  Cat,
  ArrowLeft,
  ArrowRight,
  Flame,
  Snowflake,
  Moon,
  Wind,
  Zap,
  Mountain,
  Heart,
  PawPrint,
  Sun,
  Trophy,
} from "lucide";

const icons = {
  Cat,
  ArrowLeft,
  ArrowRight,
  Flame,
  Snowflake,
  Moon,
  Wind,
  Zap,
  Mountain,
  Heart,
  PawPrint,
  Sun,
  Trophy,
};
const icon = (name) => `<i data-lucide="${name}"></i>`;
const elementIcons = ["flame", "snowflake", "moon", "wind", "zap", "mountain"];
const statusNames = {
  burn: "やけど",
  freeze: "凍結",
  paralyze: "しびれ",
  slow: "スロウ",
  knockback: "吹き飛び",
};
const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ],
  );
const clamp = (value, min, max) =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));

/** Secret mode is entirely autonomous; there are no battle command controls. */
export function mountBattlePage({
  createCafe,
  BATTLE_CATS,
  createBattleEngine,
}) {
  const app = document.querySelector("#app");
  const $ = (selector) => app.querySelector(selector);
  let scene;
  let engine;
  let ready = false;
  let disposed = false;
  let frame = 0;
  let lastTime = performance.now();
  let lastPaint = -Infinity;
  let snapshot;
  let lastPhase = "";
  let lastOverlay = "";
  const lastMoves = new Map();
  const combatLog = [];
  const events = new AbortController();
  const refreshIcons = () => createIcons({ icons });
  const color = (index) => BATTLE_CATS[index]?.color || cats[index].color;
  const label = (index) => BATTLE_CATS[index]?.label || "魔法";
  const listen = (element, type, handler) =>
    element.addEventListener(type, handler, { signal: events.signal });
  document.title = "こもれび | Virtual Cat Café";
  app.innerHTML = `<div class="battle-page"><header class="battle-header"><a class="battle-brand" href="${import.meta.env.BASE_URL}" aria-label="こもれび猫カフェへ戻る"><span>${icon("cat")}</span><div><strong>こもれび<span>.</span></strong><small>VIRTUAL CAT CAFÉ</small></div></a><span class="battle-header-label">いつでも、ひとやすみ。</span><a class="battle-back" href="${import.meta.env.BASE_URL}">${icon("arrow-left")} カフェに戻る</a></header><main class="battle-main"><section class="battle-intro"><div><span class="battle-eyebrow">A LITTLE PAUSE, A LITTLE PURR.</span><h1>猫と、なにもしない時間。</h1><p>ここは、いつでも帰ってこられる小さな猫カフェ。<br class="battle-mobile-break">お気に入りの子と、のんびり過ごしていきませんか。</p></div><span class="battle-intro-note">${icon("sun")}<span>陽だまり、あります。<small>今日はどの子と過ごす？</small></span></span></section><div class="battle-layout"><section class="battle-experience" aria-label="猫たちの様子"><div class="battle-scene" id="battle-scene"><canvas id="battle-canvas" aria-label="6匹の猫が自由に魔法を放つ、自動進行のバトルロイヤル"></canvas><div class="battle-scene-top"><span class="battle-round" id="battle-round">ROUND 1</span><span class="battle-alive">残り <strong id="battle-alive">6</strong> 匹</span></div><div class="battle-phase-overlay" id="battle-phase-overlay" hidden aria-live="polite" aria-atomic="true"></div><span class="battle-scene-note">${icon("paw-print")} ただいま、猫たちがくつろぎ中</span><div id="battle-announcer" class="battle-announcer" role="status" aria-live="polite" aria-atomic="true"></div><div class="battle-loading" id="battle-loading" role="status"><span>${icon("cat")}</span><strong>猫たちが、お迎えの準備中。</strong><p>まもなくカフェが開きます。</p></div></div><div class="battle-afterword">${icon("heart")} ごゆっくり。猫たちが勝手にやっています。</div><div class="battle-log-panel"><div class="battle-log-heading"><span class="battle-eyebrow">TODAY AT KOMOREBI</span><h2>カフェのできごと</h2></div><ol id="battle-log"><li class="battle-log-empty">猫たちを、そっと見守っていてください。</li></ol></div></section><aside class="battle-sidebar" aria-label="カフェの猫たちの状態"><div class="battle-roster-heading"><div><span class="battle-eyebrow">MEET THE RESIDENTS</span><h2>カフェのねこたち</h2></div><span class="battle-roster-count">6</span></div><div class="battle-roster">${cats.map((cat, index) => `<article class="battle-cat" id="battle-fighter-${index}" style="--fighter-color:${escapeHtml(color(index))}" aria-label="${cat.name}の状態"><div class="battle-cat-top"><span class="battle-cat-avatar" style="--coat:${cat.color}">${icon("cat")}</span><div class="battle-cat-copy"><span class="battle-cat-name">${cat.name}<small>${cat.en}</small></span><span class="battle-cat-element">${icon(elementIcons[index])} ${escapeHtml(label(index))}</span></div><span class="battle-fighter-state" id="battle-fighter-state-${index}">のんびり</span></div><div class="battle-fighter-data" id="battle-fighter-data-${index}"></div></article>`).join("")}</div><p class="battle-sidebar-note">猫たちの気分に合わせて、ゆっくり。<br>再読み込みすると、いつものカフェへ。</p></aside></div><footer class="battle-footer"><span>${icon("paw-print")} こもれび <span>/</span> 心に、ひなたを。</span><a href="${import.meta.env.BASE_URL}">いつものカフェで、ひと休み ${icon("arrow-right")}</a></footer></main></div>`;
  $(".battle-layout").append($(".battle-log-panel"));
  refreshIcons();

  function announce(message) {
    $("#battle-announcer").textContent = message;
    $("#battle-announcer").classList.add("show");
    clearTimeout(announce.timeout);
    announce.timeout = setTimeout(
      () => $("#battle-announcer")?.classList.remove("show"),
      2600,
    );
  }
  function setUnavailable(message) {
    ready = false;
    $("#battle-loading").hidden = false;
    $("#battle-loading").innerHTML =
      `<strong>カフェを開けませんでした。</strong><p>${escapeHtml(message)}</p><button id="battle-retry">もう一度ひらく</button>`;
    listen($("#battle-retry"), "click", () => location.reload());
  }
  function renderLog() {
    $("#battle-log").innerHTML = combatLog.length
      ? combatLog
          .map(
            (item) =>
              `<li><span>${escapeHtml(item.message)}</span>${item.detail ? `<small>${escapeHtml(item.detail)}</small>` : ""}</li>`,
          )
          .join("")
      : '<li class="battle-log-empty">猫たちを、そっと見守っていてください。</li>';
  }
  function addLog(message, detail = "") {
    combatLog.unshift({ message, detail });
    combatLog.splice(6);
    renderLog();
  }
  function renderFighter(data) {
    const index = data.index;
    if (!cats[index]) return;
    const maxHp = data.maxHp || 100;
    const hp = Math.ceil(clamp(data.hp, 0, maxHp));
    const energy = Math.floor(clamp(data.energy, 0, 100));
    const eliminated = Boolean(data.eliminated);
    const statuses = (data.statuses || []).map(
      (status) =>
        `${statusNames[status.type] || status.type} ${Math.ceil(status.remaining)}s`,
    );
    const phase = snapshot.phase;
    const targetName =
      Number.isInteger(data.target) && cats[data.target]
        ? cats[data.target].name
        : null;
    const state = eliminated
      ? "ひと休み"
      : phase === "countdown"
        ? "きょろきょろ"
        : phase === "finished" && snapshot.winner === index
          ? "最後の1匹"
          : statuses.length
            ? statuses.join(" · ")
            : "元気いっぱい";
    $(`#battle-fighter-${index}`).classList.toggle("is-eliminated", eliminated);
    $(`#battle-fighter-${index}`).classList.toggle(
      "is-winner",
      phase === "finished" && snapshot.winner === index,
    );
    $(`#battle-fighter-state-${index}`).textContent = state;
    $(`#battle-fighter-data-${index}`).innerHTML =
      `<div class="battle-meter-label"><span>HP</span><span>${hp} / ${maxHp}</span></div><div class="battle-health" role="progressbar" aria-label="${cats[index].name}のHP" aria-valuemin="0" aria-valuemax="${maxHp}" aria-valuenow="${hp}"><span style="width:${(hp / maxHp) * 100}%"></span></div><div class="battle-meter-label is-energy"><span>魔力</span><span>${energy} / 100</span></div><div class="battle-energy" role="progressbar" aria-label="${cats[index].name}の魔力" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${energy}"><span style="width:${energy}%"></span></div><div class="battle-cat-thought"><span>${eliminated ? "次のラウンドまで、すやすや。" : targetName && phase === "fighting" ? `${targetName}を見ています` : "気ままに過ごしています"}</span><small>${escapeHtml(lastMoves.get(index) || "まだ、なにもしていません。")}</small></div>`;
  }
  function renderHUD() {
    if (!snapshot) return;
    const fighters = snapshot.fighters || [];
    const alive = fighters.filter(
      (item) => !item.eliminated && item.hp > 0,
    ).length;
    $("#battle-round").textContent = `ROUND ${snapshot.round || 1}`;
    $("#battle-alive").textContent = String(alive);
    fighters.forEach(renderFighter);
    const phase = snapshot.phase;
    let overlay = "";
    if (phase === "countdown")
      overlay = `<span class="battle-overlay-eyebrow">まもなく、はじまります。</span><strong class="battle-countdown">${Math.max(1, Math.ceil(snapshot.countdown || 0))}</strong>`;
    else if (phase === "finished") {
      const winner = Number.isInteger(snapshot.winner)
        ? cats[snapshot.winner]
        : null;
      overlay = `<span class="battle-overlay-eyebrow">${winner ? "本日の圧倒的ねこ" : "みんな、ひと休み"}</span><strong class="battle-winner-name">${winner ? winner.name : "引き分け"}</strong><span class="battle-next-round">次の乱闘まで ${Math.max(0, Math.ceil(snapshot.nextRoundIn || 0))} 秒</span>`;
    }
    $("#battle-phase-overlay").hidden = !overlay;
    if (overlay !== lastOverlay) {
      $("#battle-phase-overlay").innerHTML = overlay;
      lastOverlay = overlay;
    }
    if (phase !== lastPhase) {
      if (phase === "fighting") announce("いつもどおり、ごゆっくり。");
      lastPhase = phase;
    }
  }
  function onBattleEvent(event) {
    // The scene owns visual reset handling, so forward each event exactly once.
    scene?.playBattleEvent?.(event);
    if (event.type === "reset") {
      lastMoves.clear();
      combatLog.length = 0;
      renderLog();
    } else if (event.type === "cast") {
      const source = cats[event.attacker];
      const recipient = cats[event.target];
      const move =
        typeof event.move === "object"
          ? event.move
          : BATTLE_CATS[event.attacker]?.moves?.find(
              (item) => item.id === event.move,
            );
      const moveName = move?.name || event.moveName || "魔法";
      lastMoves.set(event.attacker, moveName);
      addLog(
        `${source?.name || "猫"}の「${moveName}」`,
        `${recipient?.name || "相手"}へ${event.damage > 0 ? ` · ${Math.round(event.damage)}ダメージ` : ""}`,
      );
    } else if (event.type === "down")
      addLog(`${cats[event.target]?.name || "猫"}は、ひと休み。`);
  }
  function tick(now) {
    if (disposed) return;
    frame = requestAnimationFrame(tick);
    const dt = Math.min(Math.max((now - lastTime) / 1000, 0), 0.06);
    lastTime = now;
    if (document.hidden || !ready) return;
    engine.update(dt, scene?.getBattlePositions?.());
    snapshot = engine.snapshot();
    scene?.setBattleSnapshot?.(snapshot);
    if (now - lastPaint >= 100) {
      renderHUD();
      lastPaint = now;
    }
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frame);
    clearTimeout(announce.timeout);
    events.abort();
    scene?.dispose();
  }
  try {
    engine = createBattleEngine({ onEvent: onBattleEvent, autonomous: true });
    snapshot = engine.snapshot();
  } catch (error) {
    console.error("Battle engine could not start:", error);
    setUnavailable(
      "猫たちを表示できませんでした。もう一度ページを開いてお試しください。",
    );
    return { dispose };
  }
  renderHUD();
  listen($("#battle-canvas"), "webglcontextlost", (event) => {
    event.preventDefault();
    setUnavailable(
      "3D表示が中断されました。ほかのタブを閉じてから、もう一度お試しください。",
    );
  });
  listen(document, "visibilitychange", () => {
    lastTime = performance.now();
  });
  listen(window, "pagehide", (event) => {
    if (!event.persisted) dispose();
    else cancelAnimationFrame(frame);
  });
  listen(window, "pageshow", (event) => {
    if (event.persisted && !disposed) {
      lastTime = performance.now();
      frame = requestAnimationFrame(tick);
    }
  });
  requestAnimationFrame(() => {
    if (disposed) return;
    try {
      scene = createCafe(
        $("#battle-canvas"),
        cats,
        {},
        { battle: true, spectator: true },
      );
      scene.setQuality?.(window.innerWidth < 600 ? "low" : "balanced");
      scene.setReducedMotion?.(
        window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      );
      scene.setBattleSnapshot?.(snapshot);
      ready = true;
      $("#battle-loading").hidden = true;
      renderHUD();
      lastTime = performance.now();
      frame = requestAnimationFrame(tick);
    } catch (error) {
      console.error("Battle scene could not start:", error);
      setUnavailable(
        "WebGLに対応したブラウザで、ハードウェアアクセラレーションを有効にしてお試しください。",
      );
    }
  });
  return { dispose };
}
