const KEY = "komorebiSecretBattle";

export function consumeBattleActivation(history) {
  if (history.state?.[KEY] !== true) return false;
  const state = { ...history.state };
  delete state[KEY];
  history.replaceState(state, "");
  return true;
}

export function activateBattle(history, reload) {
  history.replaceState({ ...history.state, [KEY]: true }, "");
  reload();
}

/** A deliberate hover / long press reveals the secret without changing URLs. */
export function installBattleSecret(
  icon,
  { onActivate, chargeMs = 1300, activateMs = 4200 } = {},
) {
  if (!icon) return () => {};
  let chargeTimer,
    activationTimer,
    origin = null,
    activated = false;
  const listeners = new AbortController();
  const listen = (target, name, handler, options = {}) =>
    target.addEventListener(name, handler, {
      ...options,
      signal: listeners.signal,
    });
  const stop = () => {
    clearTimeout(chargeTimer);
    clearTimeout(activationTimer);
    icon.classList.remove("secret-charging");
    icon.removeAttribute("data-secret-hint");
    origin = null;
  };
  const start = () => {
    stop();
    if (activated || document.hidden) return;
    chargeTimer = setTimeout(() => {
      icon.classList.add("secret-charging");
      icon.setAttribute("data-secret-hint", "力が欲しいか、、、");
    }, chargeMs);
    activationTimer = setTimeout(() => {
      activated = true;
      stop();
      onActivate();
    }, activateMs);
  };
  listen(icon, "pointerenter", (event) => {
    if (event.pointerType !== "touch") start();
  });
  listen(icon, "pointerleave", stop);
  listen(icon, "pointerdown", (event) => {
    if (event.pointerType === "mouse" || !event.isPrimary) return;
    event.preventDefault();
    start();
    origin = { x: event.clientX, y: event.clientY, id: event.pointerId };
  });
  listen(window, "pointermove", (event) => {
    if (
      origin?.id === event.pointerId &&
      Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 12
    )
      stop();
  });
  listen(window, "pointerup", (event) => {
    if (origin?.id === event.pointerId) stop();
  });
  listen(window, "pointercancel", stop);
  listen(icon, "contextmenu", (event) => {
    if (origin) event.preventDefault();
  });
  listen(icon, "keydown", (event) => {
    if (![" ", "Enter"].includes(event.key)) return;
    event.preventDefault();
    if (!event.repeat) start();
  });
  listen(icon, "keyup", stop);
  listen(icon, "blur", stop);
  listen(window, "blur", stop);
  listen(document, "visibilitychange", () => {
    if (document.hidden) stop();
  });
  icon.tabIndex = 0;
  icon.setAttribute("aria-label", "こもれびの猫。じっと見つめると…？");
  return () => {
    stop();
    listeners.abort();
  };
}
