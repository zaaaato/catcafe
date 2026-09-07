import "./battle.css";
import { cats } from "./cats.js";
import {
  createIcons,
  Cat,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Flame,
  Snowflake,
  Moon,
  Wind,
  Zap,
  Mountain,
  Heart,
  Shield,
  RotateCcw,
  Plus,
  Minus,
  Maximize,
  Crosshair,
  WandSparkles,
  Clock3,
  ChevronRight,
  X,
  PawPrint,
} from "lucide";

const icons = {
  Cat,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Flame,
  Snowflake,
  Moon,
  Wind,
  Zap,
  Mountain,
  Heart,
  Shield,
  RotateCcw,
  Plus,
  Minus,
  Maximize,
  Crosshair,
  WandSparkles,
  Clock3,
  ChevronRight,
  X,
  PawPrint,
};
const icon = (name) => `<i data-lucide="${name}"></i>`;
const elementIcons = ["flame", "snowflake", "moon", "wind", "zap", "mountain"];
const statusNames = {
  paralyze: "しびれ",
  knockback: "吹き飛び",
  burn: "やけど",
  burning: "やけど",
  freeze: "凍結",
  frozen: "凍結",
  stun: "しびれ",
  stunned: "しびれ",
  slow: "スロウ",
  shield: "シールド",
  vulnerable: "無防備",
  weakness: "弱体",
  poison: "毒",
  blind: "目くらまし",
  haste: "加速",
  regen: "回復",
  root: "足止め",
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

/** Mounted after secret-mode activation; a normal cafe visit never calls this. */
export function mountBattlePage({
  createCafe,
  BATTLE_CATS,
  createBattleEngine,
}) {
  const app = document.querySelector("#app");
  const $ = (selector) => app.querySelector(selector);
  const catalog = BATTLE_CATS;
  let attacker = 0;
  let target = 1;
  let selectionRole = "attacker";
  let scene;
  let engine;
  let ready = false;
  let disposed = false;
  let frame = 0;
  let lastTime = performance.now();
  let lastPaint = -Infinity;
  let elapsed = 0;
  let currentSnapshot;
  let lastMoveMarkup = "";
  const combatLog = [];
  const events = new AbortController();
  const refreshIcons = () => createIcons({ icons });
  const fighter = (index) =>
    currentSnapshot?.fighters?.find((item) => item.index === index);
  const color = (index) => catalog[index]?.color || cats[index].color;
  const elementLabel = (index) =>
    catalog[index]?.label || catalog[index]?.element || "魔法";
  const listen = (element, type, handler) =>
    element.addEventListener(type, handler, { signal: events.signal });
  document.title = "ねこ魔法アリーナ | こもれび";
  app.innerHTML = `<div class="battle-page"><a class="battle-skip" href="#battle-moves">技を選ぶ操作へ</a><header class="battle-header"><a class="battle-brand" href="${import.meta.env.BASE_URL}" aria-label="こもれび猫カフェへ戻る"><span>${icon("cat")}</span><div><strong>こもれび<span>.</span></strong><small>VIRTUAL CAT CAFÉ</small></div></a><span class="battle-header-label">A LITTLE MAGIC, A LITTLE MISCHIEF.</span><a class="battle-back" href="${import.meta.env.BASE_URL}">${icon("arrow-left")} カフェに戻る</a></header><main class="battle-main"><section class="battle-intro"><div><span class="battle-eyebrow">KOMOREBI MAGIC ARENA</span><h1>いつもの猫に、ちょっと魔法を。</h1><p>6匹それぞれの力で、気ままに手合わせ。好きな猫と技を選んでみて。</p></div><span class="battle-room-tag">${icon("sparkles")} ねこ魔法アリーナ</span></section><div class="battle-layout"><section class="battle-experience" aria-label="魔法の手合わせ"><div class="battle-scene" id="battle-scene"><canvas id="battle-canvas" tabindex="0" aria-label="6匹の猫の魔法アリーナ。ドラッグで見回し、1から4キーで選んだ猫の技を使えます。"></canvas><div class="battle-scoreboard"><div class="battle-combatant" id="battle-attacker-hud"></div><span class="battle-vs">VS</span><div class="battle-combatant is-opponent" id="battle-target-hud"></div></div><div class="battle-camera"><button id="battle-zoom-in" aria-label="アリーナを拡大" title="拡大">${icon("plus")}</button><button id="battle-zoom-out" aria-label="アリーナを縮小" title="縮小">${icon("minus")}</button><button id="battle-view-reset" aria-label="視点を戻す" title="視点を戻す">${icon("rotate-ccw")}</button><button id="battle-fullscreen" aria-label="全画面で見る" title="全画面で見る">${icon("maximize")}</button></div><span class="battle-scene-note">${icon("wand-sparkles")} 猫を選んで、魔法で手合わせ。</span><div id="battle-announcer" class="battle-announcer" role="status" aria-live="polite" aria-atomic="true"></div><div class="battle-loading" id="battle-loading" role="status"><span>${icon("sparkles")}</span><strong>魔法の準備をしています。</strong><p>猫たちが、まもなく集まります。</p></div></div><div class="battle-move-heading"><div><span class="battle-eyebrow">CHOOSE YOUR SPELL</span><h2 id="battle-move-title">きなこの魔法</h2></div><span class="battle-key-hint"><kbd>1</kbd>〜<kbd>4</kbd> キーでも使えます</span></div><div class="battle-moves" id="battle-moves" tabindex="-1" aria-label="使う技を選ぶ"></div><div class="battle-afterword"><span>${icon("heart")} HPがなくなると、少し休んで元気に戻ります。</span><span id="battle-elapsed">00:00</span></div></section><aside class="battle-sidebar" aria-label="手合わせする猫を選ぶ"><div class="battle-roster-heading"><span class="battle-eyebrow">PICK YOUR PARTNERS</span><h2>だれと、手合わせする？</h2></div><div class="battle-role-tabs" aria-label="猫の選択先"><button data-battle-role="attacker" class="active" aria-pressed="true">${icon("wand-sparkles")} 技を使う猫</button><button data-battle-role="target" aria-pressed="false">${icon("crosshair")} 相手の猫</button></div><p class="battle-selection-hint" id="battle-selection-hint">技を使う猫を選んでください。</p><div class="battle-roster">${cats.map((cat, index) => `<button class="battle-cat" data-battle-cat="${index}" style="--fighter-color:${escapeHtml(color(index))}" aria-label="${cat.name}、${escapeHtml(elementLabel(index))}属性を選ぶ"><span class="battle-cat-avatar" style="--coat:${cat.color}">${icon("cat")}</span><span class="battle-cat-copy"><span class="battle-cat-name">${cat.name}<small>${cat.en}</small></span><span class="battle-cat-element">${icon(elementIcons[index])} ${escapeHtml(elementLabel(index))}</span></span><span class="battle-cat-role" id="battle-role-${index}"></span></button>`).join("")}</div><div class="battle-log-panel"><h3>${icon("sparkles")} いまの手合わせ</h3><ol id="battle-log"><li class="battle-log-empty">猫と技を選んだら、はじめの一手を。</li></ol></div><button id="battle-reset" class="battle-reset">${icon("rotate-ccw")} みんな元気に、やり直す</button><p class="battle-disclaimer">技は自分で選んで使えます。<br>カフェの親密度や設定には影響しません。<br>再読み込みすると、いつものカフェへ。</p></aside></div><footer class="battle-footer"><span>${icon("paw-print")} 心に、ひなたと、ちいさな魔法。</span><a href="${import.meta.env.BASE_URL}">いつものカフェで、ひと休み ${icon("arrow-right")}</a></footer></main></div>`;
  refreshIcons();

  function announce(message) {
    $("#battle-announcer").textContent = message;
    $("#battle-announcer").classList.add("show");
    clearTimeout(announce.timeout);
    announce.timeout = setTimeout(
      () => $("#battle-announcer")?.classList.remove("show"),
      3400,
    );
  }
  function setUnavailable(message) {
    ready = false;
    $("#battle-loading").hidden = false;
    $("#battle-loading").innerHTML =
      `<strong>アリーナを開けませんでした。</strong><p>${escapeHtml(message)}</p><button id="battle-retry">もう一度ひらく</button>`;
    listen($("#battle-retry"), "click", () => location.reload());
    app
      .querySelectorAll(".battle-move, .battle-camera button")
      .forEach((button) => {
        button.disabled = true;
      });
  }
  function renderCombatant(index, id, role) {
    const data = fighter(index) || {
      hp: 100,
      maxHp: 100,
      energy: 100,
      statuses: [],
    };
    const hp = Math.ceil(clamp(data.hp, 0, data.maxHp || 100));
    const maxHp = data.maxHp || 100;
    const energy = Math.floor(clamp(data.energy, 0, 100));
    const statuses = (data.statuses || [])
      .map(
        (status) =>
          `<span>${escapeHtml(statusNames[status.type] || status.type)} ${Math.ceil(status.remaining)}s</span>`,
      )
      .join("");
    $(id).style.setProperty("--fighter-color", color(index));
    $(id).innerHTML =
      `<div class="battle-combatant-top"><span class="battle-combatant-role">${role}</span><span class="battle-combatant-element">${escapeHtml(elementLabel(index))}</span></div><div class="battle-combatant-name"><strong>${cats[index].name}</strong><span>${hp}<small> / ${maxHp}</small></span></div><div class="battle-health" role="progressbar" aria-label="${cats[index].name}のHP" aria-valuemin="0" aria-valuemax="${maxHp}" aria-valuenow="${hp}"><span style="width:${(hp / maxHp) * 100}%"></span></div><div class="battle-energy-label"><span>魔力</span><span>${energy} / 100</span></div><div class="battle-energy" role="progressbar" aria-label="${cats[index].name}の魔力" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${energy}"><span style="width:${energy}%"></span></div><div class="battle-statuses">${data.downRemaining > 0 ? `<span class="battle-rest-status">ひと休み ${Math.ceil(data.downRemaining)}s</span>` : statuses || '<span class="battle-ready-status">元気いっぱい</span>'}</div>`;
  }
  function lockReason(move, index) {
    if (!ready) return "準備中";
    const data = fighter(attacker);
    const opponent = fighter(target);
    if (data?.downRemaining > 0 || data?.hp <= 0) return "ひと休み中";
    if (opponent?.downRemaining > 0 || opponent?.hp <= 0)
      return "相手はひと休み中";
    if (data?.statuses?.some((status) => status.type === "freeze"))
      return "凍結中";
    if (data?.statuses?.some((status) => status.type === "paralyze"))
      return "しびれ中";
    if (data?.globalCooldown > 0) return "次の魔法を準備中";
    const cooldown = data?.cooldowns?.[index] || 0;
    if (cooldown > 0) return `あと ${Math.ceil(cooldown)} 秒`;
    if (move.ultimate && (data?.energy ?? 0) < 100)
      return "魔力を100までためよう";
    return "";
  }
  function renderMoves(force = false) {
    const moves = catalog[attacker]?.moves || [];
    const markup = moves
      .map((move, index) => {
        const reason = lockReason(move, index);
        return `<button class="battle-move ${move.ultimate ? "is-ultimate" : ""}" data-battle-move="${index}" style="--fighter-color:${escapeHtml(color(attacker))}" ${reason ? "disabled" : ""} aria-label="${escapeHtml(move.name)}。${escapeHtml(reason || move.description)}"><span class="battle-move-top"><span class="battle-move-number">${index + 1}</span><span class="battle-move-kind">${move.ultimate ? "ULTIMATE · 究極魔法" : `${escapeHtml(elementLabel(attacker))}の魔法`}</span>${icon(move.ultimate ? "sparkles" : elementIcons[attacker])}</span><strong>${escapeHtml(move.name)}</strong><p>${escapeHtml(move.description)}</p><span class="battle-move-bottom"><span>${move.damage > 0 ? `威力 ${move.damage}` : "サポート"} <span>·</span> 再使用 ${move.cooldown}s</span><span class="battle-move-state">${escapeHtml(reason || (move.ultimate ? "魔力100で発動" : "使う"))}${!reason ? icon("chevron-right") : ""}</span></span></button>`;
      })
      .join("");
    if (force || markup !== lastMoveMarkup) {
      // Keep keyboard focus on the same move as its cooldown changes.
      const focusedMove = document.activeElement?.dataset?.battleMove;
      $("#battle-moves").innerHTML = markup;
      lastMoveMarkup = markup;
      refreshIcons();
      if (focusedMove !== undefined) {
        const nextButton = $(`[data-battle-move="${focusedMove}"]`);
        if (nextButton && !nextButton.disabled)
          nextButton.focus({ preventScroll: true });
        else $("#battle-moves").focus({ preventScroll: true });
      }
    }
  }
  function renderHUD(force = false) {
    if (!currentSnapshot) return;
    renderCombatant(attacker, "#battle-attacker-hud", "技を使う猫");
    renderCombatant(target, "#battle-target-hud", "相手の猫");
    renderMoves(force);
    $("#battle-elapsed").textContent =
      `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(Math.floor(elapsed % 60)).padStart(2, "0")}`;
  }
  function renderSelections() {
    app.querySelectorAll("[data-battle-cat]").forEach((button) => {
      const index = Number(button.dataset.battleCat);
      button.classList.toggle("is-attacker", index === attacker);
      button.classList.toggle("is-target", index === target);
      button.setAttribute(
        "aria-pressed",
        String(index === (selectionRole === "attacker" ? attacker : target)),
      );
      $(`#battle-role-${index}`).textContent =
        index === attacker ? "使う猫" : index === target ? "相手" : "";
    });
    app.querySelectorAll("[data-battle-role]").forEach((button) => {
      const active = button.dataset.battleRole === selectionRole;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    $("#battle-selection-hint").textContent =
      selectionRole === "attacker"
        ? "技を使う猫を選んでください。"
        : "魔法を向ける相手の猫を選んでください。";
    $("#battle-move-title").textContent = `${cats[attacker].name}の魔法`;
  }
  function selectCat(index) {
    if (!Number.isInteger(index) || !cats[index]) return;
    if (selectionRole === "attacker") {
      if (index === target) target = attacker;
      attacker = index;
    } else {
      if (index === attacker) attacker = target;
      target = index;
    }
    renderSelections();
    renderHUD(true);
    scene?.setBattleSnapshot?.({ ...currentSnapshot, attacker, target });
    scene?.focus?.(index);
  }
  function onBattleEvent(event) {
    scene?.playBattleEvent?.(event);
    if (event.type === "cast") {
      const source = cats[event.attacker];
      const recipient = cats[event.target];
      const move =
        typeof event.move === "object"
          ? event.move
          : catalog[event.attacker]?.moves?.find(
              (item) => item.id === event.move,
            );
      const moveName = move?.name || event.moveName || "魔法";
      const message = `${source?.name || "猫"}の「${moveName}」！`;
      announce(message);
      combatLog.unshift({
        message,
        detail: `${recipient?.name || "相手"}へ${event.damage > 0 ? ` · ${Math.round(event.damage)}ダメージ` : ""}`,
      });
      combatLog.splice(4);
      $("#battle-log").innerHTML = combatLog
        .map(
          (item) =>
            `<li><strong>${escapeHtml(item.message)}</strong><span>${escapeHtml(item.detail)}</span></li>`,
        )
        .join("");
    }
  }
  function cast(index) {
    if (!ready || !catalog[attacker]?.moves?.[index]) return;
    const result = engine.cast(attacker, target, index);
    if (!result.ok) announce(result.reason || "少し待って、もう一度。");
    currentSnapshot = engine.snapshot();
    scene?.setBattleSnapshot?.({ ...currentSnapshot, attacker, target });
    renderHUD(true);
  }
  try {
    engine = createBattleEngine({ onEvent: onBattleEvent });
    currentSnapshot = engine.snapshot();
  } catch (error) {
    console.error("Battle engine could not start:", error);
    setUnavailable(
      "魔法の準備に失敗しました。もう一度ページを開いてお試しください。",
    );
    return { dispose };
  }
  renderSelections();
  renderHUD(true);
  listen($("#battle-moves"), "click", (event) => {
    const button = event.target.closest("[data-battle-move]");
    if (button && !button.disabled) cast(Number(button.dataset.battleMove));
  });
  app
    .querySelectorAll("[data-battle-cat]")
    .forEach((button) =>
      listen(button, "click", () =>
        selectCat(Number(button.dataset.battleCat)),
      ),
    );
  app.querySelectorAll("[data-battle-role]").forEach((button) =>
    listen(button, "click", () => {
      selectionRole = button.dataset.battleRole;
      renderSelections();
    }),
  );
  listen($("#battle-reset"), "click", () => {
    engine.reset();
    scene?.resetBattle?.();
    elapsed = 0;
    combatLog.length = 0;
    $("#battle-log").innerHTML =
      '<li class="battle-log-empty">みんな元気に。次は、どんな魔法にする？</li>';
    currentSnapshot = engine.snapshot();
    scene?.setBattleSnapshot?.({ ...currentSnapshot, attacker, target });
    renderHUD(true);
    announce("みんな元気になりました。もう一度、手合わせを。");
  });
  listen($("#battle-zoom-in"), "click", () => scene?.zoom(1.15));
  listen($("#battle-zoom-out"), "click", () => scene?.zoom(1 / 1.15));
  listen($("#battle-view-reset"), "click", () => scene?.reset());
  listen($("#battle-fullscreen"), "click", async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await $("#battle-scene").requestFullscreen();
    } catch {
      announce("このブラウザでは全画面表示を利用できません。");
    }
  });
  listen(document, "keydown", (event) => {
    if (
      event.defaultPrevented ||
      event.repeat ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      !ready ||
      document.querySelector("dialog[open]")
    )
      return;
    if (event.target.closest('input,select,textarea,[contenteditable="true"]'))
      return;
    if (/^[1-4]$/.test(event.key)) {
      event.preventDefault();
      cast(Number(event.key) - 1);
    }
  });
  listen($("#battle-canvas"), "webglcontextlost", (event) => {
    event.preventDefault();
    setUnavailable(
      "3D表示が中断されました。ほかのタブを閉じてから、もう一度お試しください。",
    );
  });
  function tick(now) {
    if (disposed) return;
    frame = requestAnimationFrame(tick);
    const dt = Math.min(Math.max((now - lastTime) / 1000, 0), 0.06);
    lastTime = now;
    if (document.hidden || !ready) return;
    engine.update(dt);
    elapsed += dt;
    currentSnapshot = engine.snapshot();
    scene?.setBattleSnapshot?.({ ...currentSnapshot, attacker, target });
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
        { onBattleSelect: selectCat },
        { battle: true },
      );
      scene.setQuality?.(window.innerWidth < 600 ? "low" : "balanced");
      scene.setReducedMotion?.(
        window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      );
      scene.setBattleSnapshot?.({ ...currentSnapshot, attacker, target });
      ready = true;
      $("#battle-loading").hidden = true;
      renderHUD(true);
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
