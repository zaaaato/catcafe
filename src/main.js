import "./style.css";
import {
  createIcons,
  Cat,
  ArrowUpRight,
  VolumeX,
  Volume2,
  Sun,
  Moon,
  ChevronDown,
  PawPrint,
  Plus,
  Minus,
  RotateCcw,
  Maximize,
  Mouse,
  WandSparkles,
  Fish,
  Coffee,
  Heart,
  ChevronRight,
  MousePointer2,
  X,
  Camera,
  Download,
  Settings2,
  CircleHelp,
  Clock3,
  Check,
  Sparkles,
  ArrowRight,
  Leaf,
  Focus,
  Hand,
  Brush,
} from "lucide";
import { cats, favorites, stories } from "./cats.js";
import { observations } from "./observations.js";
import { createCafe } from "./scene.js";
import { createCafeAudio, AMBIENCE_PRESETS } from "./audio.js";
import {
  getState,
  updateSettings,
  recordInteraction,
  markOnboardingSeen,
  subscribe,
  getBondLabel,
  isPersistent,
} from "./state.js";
const icons = {
  Cat,
  ArrowUpRight,
  VolumeX,
  Volume2,
  Sun,
  Moon,
  ChevronDown,
  PawPrint,
  Plus,
  Minus,
  RotateCcw,
  Maximize,
  Mouse,
  WandSparkles,
  Fish,
  Coffee,
  Heart,
  ChevronRight,
  MousePointer2,
  X,
  Camera,
  Download,
  Settings2,
  CircleHelp,
  Clock3,
  Check,
  Sparkles,
  ArrowRight,
  Leaf,
  Focus,
  Hand,
  Brush,
};
const icon = (name, cls = "") => `<i data-lucide="${name}" class="${cls}"></i>`;
const face = (c) =>
  `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M13 30 11 10 27 20Q32 17 37 20L53 10 51 32" fill="${c.color}"/><ellipse cx="32" cy="36" rx="23" ry="20" fill="${c.color}"/><path d="m16 16 2 13 9-7m21-6-2 13-9-7" fill="#e8b6aa"/><path d="M21 35v3m22-3v3" stroke="${c.name === "くろ" ? "#e5dba7" : "#45433d"}" stroke-width="3" stroke-linecap="round"/><path d="m29 41 3 3 3-3" fill="#b47b74"/><path d="M14 42 5 40m9 6-9 1m45-5 9-2m-9 6 9 1" stroke="#8a8276" stroke-width="1.3"/></svg>`;
const $ = (selector) => document.querySelector(selector);
const refreshIcons = () => createIcons({ icons });
const initial = getState();
document.querySelector("#app").innerHTML = `
<a class="skip-link" href="#cafe-controls">猫カフェの操作へ</a>
<header><a class="brand" href="./" aria-label="こもれび ホーム"><span class="brand-icon">${icon("cat")}</span><span><strong>こもれび<span class="brand-dot">.</span></strong><small>VIRTUAL CAT CAFÉ</small></span></a><nav aria-label="メインナビゲーション"><span class="nav-active" aria-current="page">猫カフェ</span><button id="about-btn">こもれびについて ${icon("arrow-up-right")}</button></nav><div class="header-right"><span class="open-dot"></span><span class="header-tagline">いつでも、ひとやすみ。</span><button class="icon-button" id="sound-btn" title="環境音をオンにする" aria-label="環境音をオンにする" aria-pressed="false">${icon("volume-x")}</button><button class="icon-button" id="settings-btn" title="カフェの設定" aria-label="カフェの設定">${icon("settings-2")}</button></div></header>
<main><section class="intro"><div><div class="eyebrow"><span></span> A LITTLE PAUSE, A LITTLE PURR.</div><h1>猫と、なにもしない時間。</h1><p>ここは、いつでも帰ってこられる小さな猫カフェ。<br class="mobile-break">お気に入りの子と、のんびり過ごしていきませんか。</p></div><div class="intro-note">${icon("sun")}<span>陽だまり、あります。<small>今日はどの子と過ごす？</small></span></div></section>
<div class="cafe-layout"><section class="experience" aria-label="バーチャル猫カフェ"><div class="scene-wrap" id="scene-wrap"><canvas id="cafe" tabindex="0" aria-label="6匹の猫が暮らす3D猫カフェ" aria-describedby="canvas-instructions"></canvas><p class="sr-only" id="canvas-instructions">ドラッグで見回し、スクロールで拡大・縮小。猫をクリックすると、なでられます。キーボードでは1から6で猫を選び、Pでなでなで、Rで視点を戻せます。おもちゃモードでは、ボールをドラッグするか矢印キーで動かせます。下のボタンからも操作できます。</p><div class="scene-top"><span class="live-label"><span></span> LIVE CAFÉ</span><button class="day-button" id="day-btn" aria-label="夕暮れに切り替え" aria-pressed="false">${icon("sun")}<span>昼下がり</span>${icon("chevron-down")}</button></div><div class="scene-caption"><span class="tiny-paw">${icon("paw-print")}</span><span>ただいま、6匹がくつろぎ中</span></div><div class="scene-side" aria-label="視点の操作"><button class="icon-button" id="zoom-in" aria-label="拡大" title="拡大（+）">${icon("plus")}</button><button class="icon-button" id="zoom-out" aria-label="縮小" title="縮小（−）">${icon("minus")}</button><span></span><button class="icon-button" id="reset-view" aria-label="視点をリセット" title="視点をリセット（R）">${icon("rotate-ccw")}</button><button class="icon-button" id="photo-btn" aria-label="カフェの写真を撮る" title="写真を撮る（C）">${icon("camera")}</button><button class="icon-button" id="fullscreen" aria-label="全画面表示" title="全画面表示">${icon("maximize")}</button></div><div id="interaction-cursor" class="interaction-cursor" aria-hidden="true" hidden><span data-cursor-tool="pet">${icon("hand")}</span><span data-cursor-tool="brush">${icon("brush")}</span><span data-cursor-tool="feed">${icon("fish")}</span></div><div class="interaction-tray" id="interaction-tray" hidden><div class="interaction-tray-heading"><span>${icon("heart")} <strong id="interaction-cat-name">きなこ</strong>と、ふれあい中</span><button id="end-interaction" class="text-link">おしまい ${icon("x")}</button></div><p id="interaction-guide" role="status" aria-live="polite">猫に触れて、そのままゆっくりなでてみて。</p><div class="interaction-tools" aria-label="ふれあいの道具"><button data-interaction="pet" aria-pressed="true" class="active">${icon("hand")} なでる</button><button data-interaction="brush" aria-pressed="false">${icon("brush")} ブラシ</button><button data-interaction="feed" aria-pressed="false">${icon("fish")} おやつ</button></div><div class="interaction-tray-foot"><small id="interaction-tool-hint">猫の頭や背中を、ゆっくりドラッグ</small><button id="perform-interaction" class="text-link">そっと、ひとなで</button></div></div><div class="toy-guide" id="toy-guide" hidden><span class="toy-guide-icon">${icon("hand")}</span><span><strong id="toy-guide-message" role="status" aria-live="polite">ボールをつかんで、動かしてみて。</strong><small><span class="toy-pointer-hint">ドラッグ・指で移動</span><span class="toy-keyboard-hint"> · カフェを選択中は矢印キーでも</span></small></span></div><div class="scene-help">${icon("mouse")} <span class="desktop-help">ドラッグで見回す · スクロールでズーム</span><span class="touch-help">1本指で見回す · 2本指でズーム</span></div><div id="toast" role="status" aria-live="polite" aria-atomic="true"></div><div class="scene-status" id="scene-status" role="status"><span class="loading-cat">${icon("cat")}</span><strong>猫たちが、お迎えの準備中。</strong><span>まもなくカフェが開きます</span></div><div class="welcome-tip" id="welcome-tip" hidden><button id="dismiss-welcome" class="icon-button" aria-label="案内を閉じる">${icon("x")}</button><span class="eyebrow">MAKE YOURSELF AT HOME</span><strong>ようこそ、こもれびへ。</strong><p>気になる猫を選んだら、そっとなでてみて。<br>何もしない時間も、どうぞごゆっくり。</p><button id="welcome-help" class="text-link">カフェの楽しみ方 ${icon("arrow-right")}</button></div></div>
<div class="interaction-bar" id="cafe-controls" tabindex="-1"><div class="interaction-copy"><span class="interaction-title">ちょっと、かまってみる？</span><small>猫たちの気分に合わせて、ゆっくり。</small></div><div class="actions" aria-label="猫たちとの過ごし方"><button id="toy-btn" aria-pressed="false">${icon("wand-sparkles")}<span>おもちゃ</span></button><button id="treat-btn" aria-pressed="false">${icon("fish")}<span>おやつ</span></button><button id="relax-btn" class="selected" aria-pressed="true">${icon("coffee")}<span>のんびり</span></button></div></div><div class="experience-meta"><div class="bottom-note">${icon("heart")} 何もしなくても、大丈夫。猫たちは自由に過ごしています。</div><button id="help-btn" class="text-link">${icon("circle-help")} 楽しみ方</button></div><div class="visit-strip"><span>${icon("clock-3")} <span>ここで過ごした時間 <b id="session-time">00:00</b></span></span><span class="saved-note">${icon("leaf")} 猫との思い出は、このブラウザに。</span></div><button class="observation-entry" id="observation-btn"><span class="observation-icon">${icon("paw-print")}</span><span><strong>しぐさの、観察ノート</strong><small id="observation-latest">なにげない一瞬に、猫らしさがいっぱい。</small></span><span class="observation-count"><b id="observation-count">0</b> / 7</span>${icon("chevron-right")}</button></section>
<aside aria-label="猫のプロフィール"><div class="residents-title"><div><span class="eyebrow">MEET THE RESIDENTS</span><h2>カフェのねこたち</h2></div><span class="count">6</span></div><div class="cat-list">${cats.map((c, i) => `<button class="cat-card ${i === 0 ? "active" : ""}" data-cat="${i}" aria-pressed="${i === 0}" aria-label="${c.name}、${c.coat}。そばへ移動"><span class="avatar" style="--cat-color:${c.color}">${face(c)}</span><span class="cat-text"><span class="cat-name">${c.name}<small>${c.en}</small></span><span class="cat-mood"><span class="mood-dot ${i === 5 ? "sleep" : ""}"></span><span id="mood-${i}">${c.mood}</span></span></span>${icon("chevron-right", "cat-arrow")}</button>`).join("")}</div><div class="resident-note">${icon("mouse-pointer-2")} 気になる子を選んで、そばへ。</div><div class="selected-info"><div class="profile-heading"><span id="selected-name">きなこ</span><span class="coat-tag" id="selected-coat">茶トラ</span><button id="profile-btn" class="icon-button" aria-label="きなこのプロフィールを見る" title="プロフィール">${icon("arrow-up-right")}</button></div><p id="selected-personality">好奇心いっぱいの甘えんぼ</p><div class="bond-heading"><span>${icon("heart")} <span id="bond-label">はじめまして</span></span><span id="bond-score">0 / 100</span></div><div class="bond-track" role="progressbar" id="bond-progress" aria-label="きなことの親密度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span id="bond-fill"></span></div><button id="pet-btn" class="pet-button">${icon("heart")} <span>きなこをなでる</span></button><button id="interact-btn" class="interact-button">${icon("hand")} そばで、ふれあう ${icon("chevron-right")}</button><span class="pet-hint">なでたり、ブラシをかけたり。猫のペースで。</span></div></aside></div>
<footer><span>${icon("paw-print")} こもれび <span class="footer-divider">/</span> 心に、ひなたを。</span><button id="footer-about">このカフェについて</button><span>A cozy little corner of the internet.</span></footer></main>
<dialog id="about" aria-labelledby="about-title"><button class="dialog-close icon-button" data-close="about" aria-label="閉じる">${icon("x")}</button><span class="eyebrow">WELCOME TO KOMOREBI</span><h2 id="about-title">何もしない、を楽しもう。</h2><p>こもれびは、6匹の猫が気ままに暮らす<br>ブラウザの中の小さな猫カフェです。</p><p>ドラッグでカフェを見回したり、猫をなでたり。<br>おもちゃやおやつで、仲良くなることも。<br>音をオンにして、ひと息ついていってください。</p><div class="about-details"><span>${icon("cat")} 6匹のオリジナル3D猫</span><span>${icon("volume-2")} ブラウザで奏でる環境音</span><span>${icon("heart")} 登録不要・無料</span></div><p class="privacy-note">設定と猫との親密度は、このブラウザに保存されます。写真は保存ボタンを押したときに、お使いの端末へダウンロードされます。アクセス解析や写真の外部送信は行いません。</p><p class="privacy-note">表示用の書体は Google Fonts から読み込んでいます。<a href="${import.meta.env.BASE_URL}third-party-notices.txt" target="_blank" rel="noopener">使用ライブラリとライセンス</a></p></dialog>
<dialog id="help-dialog" aria-labelledby="help-title"><button class="dialog-close icon-button" data-close="help-dialog" aria-label="閉じる">${icon("x")}</button><span class="eyebrow">YOUR LITTLE GUIDE</span><h2 id="help-title">こもれびの、過ごし方。</h2><div class="guide-list"><div>${icon("mouse")}<span><strong>好きな場所を、見つける。</strong><p>ドラッグで見回して、スクロールでズーム。スマートフォンでは1本指で回転、2本指でズームできます。</p></span></div><div>${icon("heart")}<span><strong>猫のペースで、仲良しに。</strong><p>猫を選んで「そばで、ふれあう」を。頭や背中をなでたり、ブラシをかけたり、おやつをあげたり。ゆっくり触れ合うと親密度が育ちます。</p></span></div><div>${icon("wand-sparkles")}<span><strong>今日の気分で、ひと遊び。</strong><p>「おもちゃ」を選んだら、ボールをつかんでドラッグ。スマートフォンでは指で動かせます。カフェを選択中は矢印キーでも移動できます。「のんびり」で自由な時間へ。毛づくろいや伸び、ぴょんと飛び乗る姿も、そっと観察してみて。</p></span></div><div>${icon("camera")}<span><strong>お気に入りの一瞬を、写真に。</strong><p>カメラボタンで撮影。気に入った写真は端末に保存できます。昼と夕暮れ、それぞれの光も楽しんで。</p></span></div></div><details class="keyboard-guide"><summary>キーボードでも、ゆったり。</summary><div><span><kbd>1</kbd>〜<kbd>6</kbd> 猫を選ぶ</span><span><kbd>P</kbd> なでる</span><span><kbd>R</kbd> 視点を戻す</span><span><kbd>C</kbd> 写真を撮る</span><span><kbd>+</kbd> <kbd>−</kbd> ズーム</span><span><kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd> ボールを動かす</span><span><kbd>Esc</kbd> ダイアログを閉じる</span></div></details><button class="primary-button wide-button" data-close="help-dialog">猫たちに会いにいく ${icon("arrow-right")}</button></dialog>
<dialog id="settings-dialog" aria-labelledby="settings-title"><button class="dialog-close icon-button" data-close="settings-dialog" aria-label="閉じる">${icon("x")}</button><span class="eyebrow">MAKE IT YOUR OWN</span><h2 id="settings-title">心地よさを、あなたに。</h2><div class="settings-section"><h3>カフェの音</h3><label class="setting-toggle" for="audio-enabled"><span><strong>環境音</strong><small>雨や鳥の声で、ひと息。</small></span><input type="checkbox" id="audio-enabled" role="switch"><span class="switch" aria-hidden="true"></span></label><label class="setting-label" for="ambience">音の風景</label><select id="ambience">${AMBIENCE_PRESETS.map((p) => `<option value="${p.id}">${p.label}</option>`).join("")}</select><label class="setting-label volume-label" for="volume">音量 <output id="volume-output" for="volume">35%</output></label><input id="volume" type="range" min="0" max="100" step="1" value="35"></div><div class="settings-section"><h3>カフェの表示</h3><label class="setting-toggle" for="reduced-motion"><span><strong>動きを控えめに</strong><small>猫やカメラの動きを穏やかにします。</small></span><input type="checkbox" id="reduced-motion" role="switch"><span class="switch" aria-hidden="true"></span></label><label class="setting-label" for="quality">描画品質</label><select id="quality"><option value="low">軽め — バッテリーをいたわる</option><option value="balanced">標準 — 心地よさと軽さのバランス</option><option value="high">高精細 — 猫の細部まで楽しむ</option></select></div><p class="settings-footnote">変更は自動で保存されます。音は訪問ごとにオフから始まります。</p><button class="primary-button wide-button" data-close="settings-dialog">この設定でくつろぐ ${icon("check")}</button></dialog>
<dialog id="profile-dialog" aria-labelledby="profile-title"><button class="dialog-close icon-button" data-close="profile-dialog" aria-label="閉じる">${icon("x")}</button><span class="eyebrow">A LITTLE MORE ABOUT ME</span><div id="profile-content"></div><button id="profile-pet" class="primary-button wide-button">${icon("heart")} そばで、なでてみる</button></dialog>
<dialog id="observation-dialog" aria-labelledby="observation-title"><button class="dialog-close icon-button" data-close="observation-dialog" aria-label="閉じる">${icon("x")}</button><span class="eyebrow">LITTLE THINGS, LITTLE JOYS</span><h2 id="observation-title">しぐさの、観察ノート。</h2><p class="observation-intro">この訪問で猫たちが見せてくれた、小さなしぐさ。<br>見つけたら、そっとページに残しておきます。</p><div id="observation-list" class="observation-list"></div><p class="observation-footnote">記録は、このページを開いている間だけ。<br>全部見つけなくても、どうぞごゆっくり。</p></dialog>
<dialog id="photo-dialog" aria-labelledby="photo-title"><button class="dialog-close icon-button" data-close="photo-dialog" aria-label="閉じる">${icon("x")}</button><span class="eyebrow">A MOMENT TO KEEP</span><h2 id="photo-title">今日の、こもれび。</h2><div class="photo-print"><img id="photo-preview" alt="こもれび猫カフェで撮影した写真"><div><span>こもれび<span class="brand-dot">.</span></span><time id="photo-date"></time></div></div><p class="photo-note">この一瞬が、またひと息つくきっかけに。</p><div class="photo-actions"><button id="retake-photo" class="secondary-button">${icon("rotate-ccw")} 撮り直す</button><a id="download-photo" class="primary-button" download="komorebi.png">${icon("download")} 写真を保存</a></div><small class="download-hint">PNG形式で保存します。写真の外部送信はありません。</small></dialog>`;
refreshIcons();

let cafe;
let selectedCat = 0;
let interactionKind = null;
let currentMode = "relax";
let toyControlState = { dragging: false, manual: false };
let soundOn = false;
let audioBusy = false;
let sceneReady = false;
let photoUrl = "";
const discoveredGestures = new Map();
let evening = initial.settings.evening;
const sceneButtons = [
  "#pet-btn",
  "#toy-btn",
  "#treat-btn",
  "#relax-btn",
  "#zoom-in",
  "#zoom-out",
  "#reset-view",
  "#photo-btn",
  "#day-btn",
  "#fullscreen",
  "#profile-pet",
  "#interact-btn",
];
const toast = (message) => {
  const element = $("#toast");
  element.textContent = message;
  element.classList.add("show");
  clearTimeout(toast.timeout);
  toast.timeout = setTimeout(() => element.classList.remove("show"), 4200);
};
const audio = createCafeAudio({
  preset: initial.settings.ambience,
  volume: initial.settings.volume,
});
function openDialog(id) {
  const dialog = document.getElementById(id);
  if (!dialog.open) dialog.showModal();
}
for (const button of document.querySelectorAll("[data-close]"))
  button.addEventListener("click", () =>
    document.getElementById(button.dataset.close).close(),
  );
for (const dialog of document.querySelectorAll("dialog"))
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      dialog.close();
  });
function updateBond() {
  const bond = getState().bonds[selectedCat] || 0;
  $("#bond-label").textContent = getBondLabel(bond);
  $("#bond-score").textContent = `${bond} / 100`;
  $("#bond-fill").style.width = `${bond}%`;
  $("#bond-progress").setAttribute("aria-valuenow", String(bond));
  $("#bond-progress").setAttribute(
    "aria-label",
    `${cats[selectedCat].name}との親密度`,
  );
  $("#bond-progress").setAttribute(
    "aria-valuetext",
    `${getBondLabel(bond)}、${bond} / 100`,
  );
}
function selectCat(index, focus = true) {
  if (!Number.isInteger(index) || !cats[index]) return;
  selectedCat = index;
  document.querySelectorAll(".cat-card").forEach((element, n) => {
    element.classList.toggle("active", n === index);
    element.setAttribute("aria-pressed", String(n === index));
  });
  $("#selected-name").textContent = cats[index].name;
  $("#selected-coat").textContent = cats[index].coat;
  $("#selected-personality").textContent = cats[index].personality;
  $("#pet-btn span").textContent = `${cats[index].name}をなでる`;
  $("#profile-btn").setAttribute(
    "aria-label",
    `${cats[index].name}のプロフィールを見る`,
  );
  updateBond();
  if (focus) {
    cafe?.focus(index);
    if (interactionKind) beginInteraction(interactionKind, false);
  }
}
const interactionHints = {
  pet: [
    "猫に触れて、そのままゆっくりなでてみて。",
    "猫の頭や背中を、ゆっくりドラッグ",
  ],
  brush: [
    "毛並みに沿って、やさしくブラッシング。",
    "ブラシを選んだら、猫の上をゆっくりドラッグ",
  ],
  feed: [
    "ひとくち、どうぞ。猫に触れておやつを。",
    "猫をクリック・タップして、おやつをあげる",
  ],
};
function renderToyGuide() {
  const visible = sceneReady && currentMode === "play" && !interactionKind;
  $("#toy-guide").hidden = !visible;
  $("#scene-wrap").classList.toggle("is-playing", visible);
  $("#toy-guide").classList.toggle("is-dragging", toyControlState.dragging);
  const message = toyControlState.dragging
    ? "そのまま、猫の前でころころ。"
    : toyControlState.manual
      ? "好きな場所へ、もうひと転がし。"
      : "ボールをつかんで、動かしてみて。";
  if ($("#toy-guide-message").textContent !== message)
    $("#toy-guide-message").textContent = message;
  if (!interactionKind)
    $("#cafe").setAttribute(
      "aria-label",
      visible
        ? "おもちゃで遊ぶ3D猫カフェ。ボールをドラッグ・タッチ、または矢印キーで動かせます。"
        : "6匹の猫が暮らす3D猫カフェ",
    );
}
function beginInteraction(kind = "pet", scroll = true) {
  if (!sceneReady) return;
  interactionKind = kind;
  renderToyGuide();
  $("#interaction-cursor").dataset.tool = kind;
  hideInteractionCursor();
  cafe.setInteraction(kind, selectedCat);
  $("#scene-wrap").classList.add("is-interacting");
  $("#interaction-tray").hidden = false;
  $("#interaction-cat-name").textContent = cats[selectedCat].name;
  $("#interaction-guide").textContent = interactionHints[kind][0];
  $("#interaction-tool-hint").textContent = interactionHints[kind][1];
  $("#perform-interaction").textContent = {
    pet: "そっと、ひとなで",
    brush: "やさしく、とかす",
    feed: "ひとくち、どうぞ",
  }[kind];
  $("#perform-interaction").setAttribute(
    "aria-label",
    `${cats[selectedCat].name}に${{ pet: "ひとなでする", brush: "ブラシをかける", feed: "おやつをあげる" }[kind]}`,
  );
  $("#cafe").setAttribute(
    "aria-label",
    `${cats[selectedCat].name}とふれあう3D表示。${interactionHints[kind][1]}`,
  );
  document.querySelectorAll("[data-interaction]").forEach((button) => {
    const active = button.dataset.interaction === kind;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  if (scroll && window.innerWidth <= 850)
    $("#scene-wrap").scrollIntoView({
      block: "center",
      behavior: getState().settings.reducedMotion ? "instant" : "smooth",
    });
}
function endInteraction(reset = true) {
  interactionKind = null;
  hideInteractionCursor();
  cafe?.setInteraction(null);
  $("#scene-wrap").classList.remove("is-interacting");
  $("#interaction-tray").hidden = true;
  renderToyGuide();
  if (reset) cafe?.reset();
}
const activeCafePointers = new Set();
function hideInteractionCursor() {
  const cursor = $("#interaction-cursor");
  cursor.hidden = true;
  cursor.classList.remove("is-touching");
}
function moveInteractionCursor(event) {
  const cursor = $("#interaction-cursor");
  const rect = $("#cafe").getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  if (
    !interactionKind ||
    !sceneReady ||
    activeCafePointers.size > 1 ||
    document.documentElement.classList.contains("reduce-motion") ||
    x < 0 ||
    y < 0 ||
    x > rect.width ||
    y > rect.height
  ) {
    hideInteractionCursor();
    return;
  }
  cursor.hidden = false;
  cursor.style.left = `${x}px`;
  cursor.style.top = `${y}px`;
  cursor.classList.toggle("is-touch", event.pointerType === "touch");
  cursor.classList.toggle("is-touching", event.buttons > 0);
}
$("#cafe").addEventListener("pointermove", moveInteractionCursor, {
  passive: true,
});
$("#cafe").addEventListener(
  "pointerdown",
  (event) => {
    activeCafePointers.add(event.pointerId);
    if (currentMode === "play" && !interactionKind)
      $("#cafe").focus({ preventScroll: true });
    moveInteractionCursor(event);
  },
  { passive: true },
);
for (const type of ["pointerup", "pointercancel"])
  $("#cafe").addEventListener(
    type,
    (event) => {
      activeCafePointers.delete(event.pointerId);
      if (event.pointerType === "touch" || type === "pointercancel")
        hideInteractionCursor();
      else $("#interaction-cursor").classList.remove("is-touching");
    },
    { passive: true },
  );
$("#cafe").addEventListener(
  "pointerleave",
  () => {
    activeCafePointers.clear();
    hideInteractionCursor();
  },
  { passive: true },
);
function setSceneAvailability(available) {
  sceneReady = available;
  renderToyGuide();
  sceneButtons.forEach((selector) => {
    $(selector).disabled = !available;
  });
  document.querySelectorAll(".cat-card").forEach((button) => {
    button.disabled = !available;
  });
}
function showSceneError(message) {
  hideInteractionCursor();
  setSceneAvailability(false);
  const status = $("#scene-status");
  status.hidden = false;
  status.classList.add("has-error");
  status.replaceChildren();
  const title = document.createElement("strong");
  title.textContent = "カフェを開けませんでした。";
  const detail = document.createElement("span");
  detail.textContent = message;
  const reload = document.createElement("button");
  reload.className = "primary-button";
  reload.textContent = "もう一度ひらく";
  reload.addEventListener("click", () => location.reload());
  status.append(title, detail, reload);
  $("#welcome-tip").hidden = true;
}
function renderObservations() {
  $("#observation-count").textContent = String(discoveredGestures.size);
  $("#observation-list").innerHTML = observations
    .map((item) => {
      const discovery = discoveredGestures.get(item.id);
      return `<article class="observation-card ${discovery ? "discovered" : ""}"><span class="observation-card-icon">${icon(item.icon)}</span><div><h3>${item.title}</h3><p>${discovery ? item.detail : item.hint}</p><small>${discovery ? `${cats[discovery.index].name}が見せてくれました · ${discovery.time}` : "まだ出会っていないしぐさ"}</small></div>${discovery ? icon("check", "discovery-check") : ""}</article>`;
    })
    .join("");
  refreshIcons();
}
function observeGesture(index, mood) {
  for (const item of observations) {
    if (!discoveredGestures.has(item.id) && item.match.test(mood)) {
      discoveredGestures.set(item.id, {
        index,
        time: new Date().toLocaleTimeString("ja-JP", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      });
      $("#observation-latest").textContent =
        `${cats[index].name}の「${item.title}」を記録しました。`;
      renderObservations();
    }
  }
}
function renderDay() {
  $("#day-btn").innerHTML =
    `${icon(evening ? "moon" : "sun")}<span>${evening ? "夕暮れ" : "昼下がり"}</span>${icon("chevron-down")}`;
  $("#day-btn").setAttribute(
    "aria-label",
    evening ? "昼下がりに切り替え" : "夕暮れに切り替え",
  );
  $("#day-btn").setAttribute("aria-pressed", String(evening));
  refreshIcons();
}
function renderSettings() {
  const settings = getState().settings;
  $("#ambience").value = settings.ambience;
  $("#volume").value = String(Math.round(settings.volume * 100));
  $("#volume-output").value = `${Math.round(settings.volume * 100)}%`;
  $("#reduced-motion").checked = settings.reducedMotion;
  $("#quality").value = settings.quality;
  document.documentElement.classList.toggle(
    "reduce-motion",
    settings.reducedMotion,
  );
}
function renderSound() {
  const button = $("#sound-btn");
  button.innerHTML = icon(soundOn ? "volume-2" : "volume-x");
  button.setAttribute("aria-pressed", String(soundOn));
  button.setAttribute(
    "aria-label",
    soundOn ? "環境音をオフにする" : "環境音をオンにする",
  );
  button.title = button.getAttribute("aria-label");
  $("#audio-enabled").checked = soundOn;
  refreshIcons();
}
async function enableSound(enabled) {
  if (audioBusy) return;
  audioBusy = true;
  const focusedControl = document.activeElement;
  $("#sound-btn").disabled = true;
  $("#audio-enabled").disabled = true;
  try {
    soundOn = await audio.setEnabled(enabled);
    updateSettings({ soundEnabled: soundOn });
    renderSound();
    toast(
      soundOn
        ? "やさしい環境音と一緒に、ひと休み。"
        : enabled
          ? "音声を開始できませんでした。ブラウザの音声設定を確認して、もう一度お試しください。"
          : "環境音をオフにしました。",
    );
  } catch (error) {
    console.warn("Audio could not be started:", error);
    soundOn = false;
    renderSound();
    toast("音声を再生できませんでした。もう一度お試しください。");
  } finally {
    audioBusy = false;
    $("#sound-btn").disabled = false;
    $("#audio-enabled").disabled = false;
    if (
      (focusedControl === $("#sound-btn") ||
        focusedControl === $("#audio-enabled")) &&
      document.activeElement === document.body
    )
      focusedControl.focus({ preventScroll: true });
  }
}
function dismissWelcome() {
  $("#welcome-tip").hidden = true;
  markOnboardingSeen();
}
function takePhoto() {
  if (!sceneReady) return;
  try {
    photoUrl = cafe.capture({ type: "image/png" });
    if (typeof photoUrl !== "string" || !photoUrl.startsWith("data:image/"))
      throw new Error("Invalid capture result");
    const now = new Date();
    $("#photo-preview").src = photoUrl;
    $("#photo-date").textContent = now.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    $("#photo-date").dateTime = now.toISOString();
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
    $("#download-photo").href = photoUrl;
    $("#download-photo").download = `komorebi-${stamp}.png`;
    openDialog("photo-dialog");
  } catch (error) {
    console.warn("Photo capture failed:", error);
    toast("写真を撮れませんでした。少し待って、もう一度お試しください。");
  }
}
setSceneAvailability(false);
renderSettings();
renderObservations();
updateBond();
renderDay();
// Let the welcome shell paint before creating the 3D room.
requestAnimationFrame(() =>
  setTimeout(() => {
    try {
      cafe = createCafe($("#cafe"), cats, {
        onPet: (index) => {
          selectCat(index, false);
          recordInteraction(index, "pet");
          updateBond();
          audio.playEffect("purr");
          toast(`${cats[index].name}をなでなで。気持ちよさそう… ♡`);
        },
        onMood: (index, mood) => {
          observeGesture(index, mood);
          const element = $(`#mood-${index}`);
          if (element) {
            element.textContent = mood;
            element.previousElementSibling.classList.toggle(
              "sleep",
              /ねむ|ひるね|すや|眠/.test(mood),
            );
          }
        },
        onToyChange: (state) => {
          toyControlState = {
            dragging: Boolean(state.dragging),
            manual: Boolean(state.manual),
          };
          renderToyGuide();
        },
        onFocus: (index) => {
          if (index >= 0) selectCat(index, false);
        },
        onInteraction: ({ index, kind, message }) => {
          selectCat(index, false);
          if (kind !== "pet") {
            recordInteraction(index, kind);
            audio.playEffect(kind === "feed" ? "treat" : "purr");
          }
          $("#interaction-guide").textContent =
            message || `${cats[index].name}、気持ちよさそう。`;
          updateBond();
        },
      });
      const currentSettings = getState().settings;
      cafe.setQuality(currentSettings.quality);
      cafe.setReducedMotion(currentSettings.reducedMotion);
      cafe.setEvening(evening);
      setSceneAvailability(true);
      requestAnimationFrame(() => {
        $("#scene-status").hidden = true;
        if (!initial.onboardingSeen) $("#welcome-tip").hidden = false;
      });
    } catch (error) {
      console.error("Cafe initialization failed:", error);
      showSceneError(
        "3D表示を開始できません。WebGLに対応したブラウザで、ハードウェアアクセラレーションを有効にしてお試しください。",
      );
    }
  }, 0),
);
$("#cafe").addEventListener("webglcontextlost", (event) => {
  event.preventDefault();
  showSceneError(
    "3D表示が中断されました。ほかのタブを閉じてから、もう一度お試しください。",
  );
});
$("#pet-btn").addEventListener("click", () => cafe?.pet(selectedCat));
$("#interact-btn").addEventListener("click", () => beginInteraction());
$("#end-interaction").addEventListener("click", () => endInteraction());
$("#perform-interaction").addEventListener("click", () =>
  cafe?.performInteraction(),
);
for (const button of document.querySelectorAll("[data-interaction]"))
  button.addEventListener("click", () =>
    beginInteraction(button.dataset.interaction, false),
  );
for (const element of document.querySelectorAll(".cat-card"))
  element.addEventListener("click", () =>
    selectCat(Number(element.dataset.cat)),
  );
for (const [id, mode, effect, message] of [
  ["toy-btn", "play", "toy", "ボールをつかんで、猫たちと遊んでみよう。"],
  ["treat-btn", "treat", "treat", "おやつの時間。猫たちが集まってきます。"],
  ["relax-btn", "relax", null, "のんびり、猫たちのペースで。"],
])
  document.getElementById(id).addEventListener("click", () => {
    if (!sceneReady) return;
    if (interactionKind) endInteraction(false);
    currentMode = mode;
    toyControlState = { dragging: false, manual: false };
    cafe.setMode(mode);
    renderToyGuide();
    if (mode === "play") $("#cafe").focus({ preventScroll: true });
    document.querySelectorAll(".actions button").forEach((element) => {
      element.classList.toggle("selected", element.id === id);
      element.setAttribute("aria-pressed", String(element.id === id));
    });
    if (effect) audio.playEffect(effect);
    toast(message);
  });
$("#zoom-in").addEventListener("click", () => cafe?.zoom(1.15));
$("#zoom-out").addEventListener("click", () => cafe?.zoom(1 / 1.15));
$("#reset-view").addEventListener("click", () => {
  if (interactionKind) endInteraction(false);
  cafe?.reset();
  toast("カフェ全体を見渡す、いつもの席へ。");
});
$("#day-btn").addEventListener("click", () => {
  evening = !evening;
  cafe?.setEvening(evening);
  updateSettings({ evening });
  renderDay();
});
$("#photo-btn").addEventListener("click", takePhoto);
$("#retake-photo").addEventListener("click", () => {
  $("#photo-dialog").close();
  toast("好きな角度に合わせて、もう一度カメラボタンを。");
});
$("#download-photo").addEventListener("click", () => {
  if (photoUrl) toast("写真をダウンロードします。またいつでも、会いにきてね。");
});
$("#fullscreen").addEventListener("click", async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await $("#scene-wrap").requestFullscreen();
  } catch {
    toast("このブラウザでは全画面表示を利用できません。");
  }
});
document.addEventListener("fullscreenchange", () => {
  if (document.fullscreenElement && currentMode === "play" && !interactionKind)
    $("#cafe").focus({ preventScroll: true });
  $("#fullscreen").setAttribute(
    "aria-label",
    document.fullscreenElement ? "全画面表示を終了" : "全画面表示",
  );
  $("#fullscreen").setAttribute(
    "aria-pressed",
    String(Boolean(document.fullscreenElement)),
  );
});
$("#observation-btn").addEventListener("click", () => {
  renderObservations();
  openDialog("observation-dialog");
});
$("#about-btn").addEventListener("click", () => openDialog("about"));
$("#footer-about").addEventListener("click", () => openDialog("about"));
$("#help-btn").addEventListener("click", () => openDialog("help-dialog"));
$("#welcome-help").addEventListener("click", () => {
  dismissWelcome();
  openDialog("help-dialog");
});
$("#dismiss-welcome").addEventListener("click", dismissWelcome);
$("#settings-btn").addEventListener("click", () => {
  renderSettings();
  openDialog("settings-dialog");
});
$("#sound-btn").addEventListener("click", () => enableSound(!soundOn));
$("#audio-enabled").addEventListener("change", (event) =>
  enableSound(event.target.checked),
);
$("#ambience").addEventListener("change", (event) => {
  audio.setPreset(event.target.value);
  updateSettings({ ambience: event.target.value });
});
$("#volume").addEventListener("input", (event) => {
  const volume = Number(event.target.value) / 100;
  audio.setVolume(volume);
  $("#volume-output").value = `${Math.round(volume * 100)}%`;
});
$("#volume").addEventListener("change", (event) =>
  updateSettings({ volume: Number(event.target.value) / 100 }),
);
$("#reduced-motion").addEventListener("change", (event) => {
  const reducedMotion = event.target.checked;
  updateSettings({ reducedMotion });
  cafe?.setReducedMotion(reducedMotion);
  document.documentElement.classList.toggle("reduce-motion", reducedMotion);
});
$("#quality").addEventListener("change", (event) => {
  updateSettings({ quality: event.target.value });
  cafe?.setQuality(event.target.value);
});
$("#profile-btn").addEventListener("click", () => {
  const cat = cats[selectedCat];
  const bond = getState().bonds[selectedCat] || 0;
  $("#profile-content").innerHTML =
    `<div class="profile-portrait"><span class="avatar">${face(cat)}</span><div><h2 id="profile-title">${cat.name} <small>${cat.en}</small></h2><span class="coat-tag">${cat.coat}</span></div></div><p class="profile-personality">${cat.personality}</p><p>${stories[selectedCat]}</p><div class="profile-favorite">${icon("sparkles")}<span><small>すきなもの</small>${favorites[selectedCat]}</span></div><div class="profile-bond">${icon("heart")} ${getBondLabel(bond)} <span>${bond} / 100</span></div><small class="profile-footnote">親密度は、ゆっくりなでるたびに育ちます。<br>${isPersistent() ? "このブラウザで、次の訪問も続きを。" : "このタブを開いている間だけ、記録されます。"}</small>`;
  refreshIcons();
  openDialog("profile-dialog");
});
$("#profile-pet").addEventListener("click", () => {
  $("#profile-dialog").close();
  cafe?.focus(selectedCat);
  cafe?.pet(selectedCat);
});
let appliedSettings = { ...initial.settings };
function renderPersistence() {
  if (isPersistent()) return;
  $(".saved-note").innerHTML =
    `${icon("leaf")} 思い出は、このタブを開いている間だけ。`;
  $(".settings-footnote").textContent =
    "このブラウザでは保存を利用できません。設定はこのタブを開いている間だけ保持されます。";
  $(".pet-hint").textContent = "このタブを開いている間、親密度が育ちます。";
  $("#about .privacy-note").textContent =
    "このブラウザでは保存を利用できないため、設定と親密度はこのタブを開いている間だけ保持されます。写真は保存ボタンから端末へダウンロードできます。アクセス解析や写真の外部送信は行いません。";
  refreshIcons();
}
renderPersistence();
const unsubscribe = subscribe((state) => {
  updateBond();
  const next = state.settings;
  if (next.ambience !== appliedSettings.ambience)
    audio.setPreset(next.ambience);
  if (next.volume !== appliedSettings.volume) audio.setVolume(next.volume);
  if (next.quality !== appliedSettings.quality) cafe?.setQuality(next.quality);
  if (next.reducedMotion !== appliedSettings.reducedMotion)
    cafe?.setReducedMotion(next.reducedMotion);
  if (next.evening !== appliedSettings.evening) {
    evening = next.evening;
    cafe?.setEvening(evening);
    renderDay();
  }
  if (JSON.stringify(next) !== JSON.stringify(appliedSettings))
    renderSettings();
  if (state.onboardingSeen) $("#welcome-tip").hidden = true;
  appliedSettings = { ...next };
  renderPersistence();
});
let visibleSeconds = 0;
let sessionLastTick = performance.now();
const sessionTimer = setInterval(() => {
  const now = performance.now();
  if (!document.hidden)
    visibleSeconds += Math.min((now - sessionLastTick) / 1000, 2);
  sessionLastTick = now;
  const minutes = Math.floor(visibleSeconds / 60);
  const seconds = Math.floor(visibleSeconds % 60);
  $("#session-time").textContent =
    `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}, 1000);
document.addEventListener("visibilitychange", () => {
  sessionLastTick = performance.now();
});
document.addEventListener("keydown", (event) => {
  if (
    event.defaultPrevented ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    $("dialog[open]")
  )
    return;
  if (
    event.target.closest('input, select, textarea, [contenteditable="true"]') ||
    !sceneReady
  )
    return;
  const key = event.key.toLowerCase();
  const toyDirections = {
    arrowleft: [-0.22, 0],
    arrowright: [0.22, 0],
    arrowup: [0, -0.22],
    arrowdown: [0, 0.22],
  };
  if (
    currentMode === "play" &&
    !interactionKind &&
    event.target === $("#cafe") &&
    toyDirections[key]
  ) {
    event.preventDefault();
    cafe.moveToy(...toyDirections[key]);
    return;
  }
  if (event.repeat) return;
  if (
    (key === " " || key === "enter") &&
    event.target === $("#cafe") &&
    interactionKind
  ) {
    event.preventDefault();
    cafe.performInteraction();
    return;
  }
  if (/^[1-6]$/.test(key)) {
    event.preventDefault();
    selectCat(Number(key) - 1);
    toast(`${cats[selectedCat].name}のそばへ。`);
  } else if (key === "p") {
    event.preventDefault();
    cafe.pet(selectedCat);
  } else if (key === "r") {
    event.preventDefault();
    if (interactionKind) endInteraction(false);
    cafe.reset();
  } else if (key === "escape" && interactionKind) {
    event.preventDefault();
    endInteraction();
  } else if (key === "c") {
    event.preventDefault();
    takePhoto();
  } else if (key === "+" || key === "=") {
    event.preventDefault();
    cafe.zoom(1.15);
  } else if (key === "-") {
    event.preventDefault();
    cafe.zoom(1 / 1.15);
  }
});
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    clearInterval(sessionTimer);
    clearTimeout(toast.timeout);
    unsubscribe?.();
    cafe?.dispose();
    audio.destroy();
  });
