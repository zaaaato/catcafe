import "./style.css";
import "./battle.css";
import { cats } from "./cats.js";
import { renderCafeShell, icon, refreshCafeIcons } from "./cafe-shell.js";
import { getState, getBondLabel } from "./state.js";

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

/** The normal cafe shell remains visible; its controls are disabled while cats act autonomously. */
export function mountBattlePage({
  createCafe,
  BATTLE_CATS,
  createBattleEngine,
}) {
  const app = document.querySelector("#app");
  const $ = (selector) => app.querySelector(selector);
  const initial = getState();
  const events = new AbortController();
  const lastMoves = new Map();
  const combatLog = [];
  let scene;
  let engine;
  let ready = false;
  let disposed = false;
  let frame = 0;
  let lastTime = performance.now();
  let lastPaint = -Infinity;
  let elapsed = 0;
  let snapshot;
  let lastOverlay = "";
  const listen = (element, type, handler) =>
    element.addEventListener(type, handler, { signal: events.signal });
  document.title = "こもれび | Virtual Cat Café";
  app.classList.add("cafe-battle");
  app.innerHTML = renderCafeShell();
  app.querySelectorAll("button,input,select,textarea").forEach((control) => {
    control.disabled = true;
  });
  app.querySelectorAll("a").forEach((link) => {
    link.removeAttribute("href");
    link.setAttribute("aria-disabled", "true");
    link.setAttribute("tabindex", "-1");
  });
  $("#cafe").removeAttribute("tabindex");
  $("#cafe-controls").removeAttribute("tabindex");
  $("#canvas-instructions").textContent =
    "猫たちは自動で動き回ります。この時間は、操作せずに見守ってください。";
  $("#welcome-tip").hidden = true;
  $("#scene-wrap").insertAdjacentHTML(
    "beforeend",
    `<div class="battle-round-hud"><span id="battle-round">ROUND 1</span><span>残り <strong id="battle-alive">6</strong> 匹</span></div><div class="battle-winner" id="battle-winner" hidden aria-live="polite" aria-atomic="true"></div>`,
  );
  $(".experience").insertAdjacentHTML(
    "beforeend",
    `<section class="battle-log-panel" aria-label="カフェのできごと"><div class="battle-log-heading"><span class="eyebrow">TODAY AT KOMOREBI</span><h2>カフェのできごと</h2></div><ol id="battle-log"><li>猫たちを、そっと見守っていてください。</li></ol></section>`,
  );
  cats.forEach((cat, index) => {
    const card = $(`[data-cat="${index}"]`);
    card.style.setProperty(
      "--battle-color",
      BATTLE_CATS[index]?.color || cat.color,
    );
    card
      .querySelector(".cat-text")
      .insertAdjacentHTML(
        "beforeend",
        `<span class="battle-card-stats"><span class="battle-card-health" id="battle-health-${index}" role="progressbar" aria-label="${cat.name}のHP" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100"><span></span></span><span class="battle-card-energy" id="battle-energy-${index}" role="progressbar" aria-label="${cat.name}の魔力" aria-valuemin="0" aria-valuemax="100" aria-valuenow="35"><span></span></span></span>`,
      );
  });
  const bond = initial.bonds[0] || 0;
  $("#bond-label").textContent = getBondLabel(bond);
  $("#bond-score").textContent = `${bond} / 100`;
  $("#bond-fill").style.width = `${bond}%`;
  $("#bond-progress").setAttribute("aria-valuenow", String(bond));
  $("#ambience").value = initial.settings.ambience;
  $("#volume").value = String(Math.round(initial.settings.volume * 100));
  $("#volume-output").value = `${Math.round(initial.settings.volume * 100)}%`;
  $("#reduced-motion").checked = initial.settings.reducedMotion;
  $("#quality").value = initial.settings.quality;
  if (initial.settings.evening) {
    $("#day-btn").innerHTML =
      `${icon("moon")}<span>夕暮れ</span>${icon("chevron-down")}`;
    $("#day-btn").setAttribute("aria-pressed", "true");
  }
  refreshCafeIcons();

  function setUnavailable(message) {
    ready = false;
    $("#scene-status").hidden = false;
    $("#scene-status").classList.add("has-error");
    $("#scene-status").innerHTML =
      `<strong>カフェを開けませんでした。</strong><span>${escapeHtml(message)} ページを再読み込みしてお試しください。</span>`;
  }
  function renderLog() {
    $("#battle-log").innerHTML = combatLog.length
      ? combatLog
          .map(
            (item) =>
              `<li><span>${escapeHtml(item.message)}</span>${item.detail ? `<small>${escapeHtml(item.detail)}</small>` : ""}</li>`,
          )
          .join("")
      : "<li>猫たちを、そっと見守っていてください。</li>";
  }
  function addLog(message, detail = "") {
    combatLog.unshift({ message, detail });
    combatLog.splice(6);
    renderLog();
  }
  function renderHUD() {
    if (!snapshot) return;
    $("#battle-round").textContent = `ROUND ${snapshot.round || 1}`;
    $("#battle-alive").textContent = String(
      snapshot.fighters.filter((item) => !item.eliminated && item.hp > 0)
        .length,
    );
    snapshot.fighters.forEach((data) => {
      const index = data.index;
      if (!cats[index]) return;
      const maxHp = data.maxHp || 100;
      const hp = Math.ceil(clamp(data.hp, 0, maxHp));
      const energy = Math.floor(clamp(data.energy, 0, 100));
      const healthBar = $(`#battle-health-${index}`);
      const energyBar = $(`#battle-energy-${index}`);
      healthBar.setAttribute("aria-valuemax", String(maxHp));
      healthBar.setAttribute("aria-valuenow", String(hp));
      healthBar.setAttribute("aria-valuetext", `HP ${hp} / ${maxHp}`);
      healthBar.firstElementChild.style.width = `${(hp / maxHp) * 100}%`;
      energyBar.setAttribute("aria-valuenow", String(energy));
      energyBar.setAttribute("aria-valuetext", `魔力 ${energy} / 100`);
      energyBar.firstElementChild.style.width = `${energy}%`;
      const statuses = (data.statuses || []).map(
        (status) => statusNames[status.type] || status.type,
      );
      const target =
        Number.isInteger(data.target) && cats[data.target]
          ? cats[data.target].name
          : null;
      $(`#mood-${index}`).textContent = data.eliminated
        ? "すやすや、おひるね"
        : snapshot.phase === "finished" && snapshot.winner === index
          ? "最後の1匹"
          : statuses.length
            ? statuses.join(" · ")
            : target
              ? `${target}を見ています`
              : "きょろきょろ";
      const card = $(`[data-cat="${index}"]`);
      card.classList.toggle("battle-eliminated", Boolean(data.eliminated));
      card.title = `HP ${hp} / ${maxHp} · 魔力 ${energy} / 100${lastMoves.has(index) ? ` · ${lastMoves.get(index)}` : ""}`;
    });
    const overlay =
      snapshot.phase === "finished"
        ? `<span>${Number.isInteger(snapshot.winner) ? "本日の圧倒的ねこ" : "みんな、ひと休み"}</span><strong>${Number.isInteger(snapshot.winner) ? cats[snapshot.winner]?.name || "" : "引き分け"}</strong><small>次の乱闘まで ${Math.max(0, Math.ceil(snapshot.nextRoundIn || 0))} 秒</small>`
        : "";
    $("#battle-winner").hidden = !overlay;
    if (overlay !== lastOverlay) {
      $("#battle-winner").innerHTML = overlay;
      lastOverlay = overlay;
    }
    $("#session-time").textContent =
      `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(Math.floor(elapsed % 60)).padStart(2, "0")}`;
  }
  function onBattleEvent(event) {
    scene?.playBattleEvent?.(event);
    if (event.type === "reset") {
      lastMoves.clear();
      combatLog.length = 0;
      renderLog();
    } else if (event.type === "cast") {
      const move =
        typeof event.move === "object"
          ? event.move
          : BATTLE_CATS[event.attacker]?.moves?.find(
              (item) => item.id === event.move,
            );
      const moveName = move?.name || event.moveName || "魔法";
      lastMoves.set(event.attacker, moveName);
      addLog(
        `${cats[event.attacker]?.name || "猫"}の「${moveName}」`,
        `${cats[event.target]?.name || "相手"}へ${event.damage > 0 ? ` · ${Math.round(event.damage)}ダメージ` : ""}`,
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
    elapsed += dt;
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
    events.abort();
    scene?.dispose();
    app.classList.remove("cafe-battle");
  }
  try {
    engine = createBattleEngine({ onEvent: onBattleEvent, autonomous: true });
    snapshot = engine.snapshot();
  } catch (error) {
    console.error("Battle engine could not start:", error);
    setUnavailable("猫たちを表示できませんでした。");
    return { dispose };
  }
  renderHUD();
  listen($("#cafe"), "webglcontextlost", (event) => {
    event.preventDefault();
    setUnavailable("3D表示が中断されました。ほかのタブを閉じてから、");
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
        $("#cafe"),
        cats,
        {},
        { battle: true, spectator: true },
      );
      scene.setQuality?.(initial.settings.quality);
      scene.setReducedMotion?.(initial.settings.reducedMotion);
      scene.setEvening?.(initial.settings.evening);
      scene.setBattleSnapshot?.(snapshot);
      ready = true;
      $("#scene-status").hidden = true;
      renderHUD();
      lastTime = performance.now();
      frame = requestAnimationFrame(tick);
    } catch (error) {
      console.error("Battle scene could not start:", error);
      setUnavailable(
        "WebGLに対応したブラウザで、ハードウェアアクセラレーションを有効にしてください。",
      );
    }
  });
  return { dispose };
}
