import { renderCafeShell, icon, face, refreshCafeIcons } from "./cafe-shell.js";
import { installBattleSecret, activateBattle } from "./secret-battle.js";
import "./style.css";

import { cats, favorites, stories } from "./cats.js";
import { observations } from "./observations.js";
import { createCafe } from "./scene.js";
import { createCafeAudio } from "./audio.js";
import {
  getState,
  updateSettings,
  recordInteraction,
  markOnboardingSeen,
  subscribe,
  getBondLabel,
  isPersistent,
} from "./state.js";
const $ = (selector) => document.querySelector(selector);
const refreshIcons = refreshCafeIcons;
const initial = getState();
document.querySelector("#app").innerHTML = renderCafeShell();
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

const disposeBattleSecret = installBattleSecret(
  document.querySelector(".brand-icon"),
  {
    onActivate: () =>
      activateBattle(window.history, () => window.location.reload()),
  },
);
if (import.meta.hot) import.meta.hot.dispose(disposeBattleSecret);
