import { face } from "./cafe-shell.js";
import { cats } from "./cats.js";

/** Two readable cut-ins at a time; every queued ultimate gets its own full interval. */
export function createCutinQueue({
  show,
  hide,
  duration = 1050,
  capacity = 2,
  schedule = setTimeout,
  cancel = clearTimeout,
}) {
  const queued = [];
  const active = new Set();
  let disposed = false;
  let generation = 0;
  function pump() {
    while (!disposed && queued.length && active.size < capacity) {
      const item = queued.shift();
      const entry = { item, token: show(item), timer: null };
      const version = generation;
      active.add(entry);
      entry.timer = schedule(() => {
        if (disposed || version !== generation || !active.has(entry)) return;
        active.delete(entry);
        hide(entry.token);
        pump();
      }, duration);
    }
  }
  function clear() {
    generation++;
    queued.length = 0;
    for (const entry of active) {
      cancel(entry.timer);
      hide(entry.token);
    }
    active.clear();
  }
  return {
    push(item) {
      if (!disposed) {
        queued.push(item);
        pump();
      }
    },
    clear,
    dispose() {
      if (!disposed) {
        disposed = true;
        clear();
      }
    },
    snapshot: () => ({
      active: [...active].map((entry) => entry.item),
      queued: queued.slice(),
      disposed,
    }),
  };
}

const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const symbols = ["炎", "氷", "闇", "風", "雷", "地"];

export function createUltimateCutins({
  container,
  catalog,
  reducedMotion = false,
}) {
  const layer = document.createElement("div");
  layer.className = `ultimate-cutins${reducedMotion ? " is-still" : ""}`;
  layer.setAttribute("aria-hidden", "true");
  const announcement = document.createElement("span");
  announcement.className = "sr-only";
  announcement.setAttribute("role", "status");
  announcement.setAttribute("aria-live", "polite");
  announcement.setAttribute("aria-atomic", "true");
  container.append(layer, announcement);
  const cards = new Map();
  let announceTimer = 0;
  let disposed = false;
  const queue = createCutinQueue({
    show(event) {
      const cat = cats[event.attacker];
      const element = catalog[event.attacker];
      const cutin = document.createElement("div");
      cutin.className = "ultimate-cutin";
      cutin.style.setProperty("--ultimate-color", element.color);
      cutin.innerHTML = `<span class="ultimate-cutin-portrait">${face(cat)}</span><span class="ultimate-cutin-copy"><span class="ultimate-cutin-heading"><b>究極技</b><span>${escapeHtml(cat.name)} <span>·</span> ${escapeHtml(element.label)}</span></span><strong>${escapeHtml(event.move.name)}</strong></span><span class="ultimate-cutin-symbol">${symbols[event.attacker]}</span>`;
      layer.append(cutin);
      clearTimeout(announceTimer);
      announceTimer = setTimeout(() => {
        announcement.textContent = [
          ...layer.querySelectorAll(".ultimate-cutin-copy"),
        ]
          .map((item) => item.textContent)
          .join("。");
      }, 60);
      return cutin;
    },
    hide(cutin) {
      cutin.remove();
    },
  });
  function clearCards() {
    for (const [index, entry] of cards) {
      clearTimeout(entry.timer);
      entry.badge.remove();
      entry.card.classList.remove("battle-ultimate");
      cards.delete(index);
    }
  }
  function clear() {
    queue.clear();
    clearTimeout(announceTimer);
    announcement.textContent = "";
    clearCards();
  }
  return {
    enqueue(event) {
      if (
        disposed ||
        !event.move?.ultimate ||
        !cats[event.attacker] ||
        !catalog[event.attacker]
      )
        return;
      queue.push(event);
      const card = document.querySelector(`[data-cat="${event.attacker}"]`);
      if (!card) return;
      const existing = cards.get(event.attacker);
      if (existing) {
        clearTimeout(existing.timer);
        existing.badge.remove();
      }
      const badge = document.createElement("span");
      badge.className = "ultimate-card-label";
      badge.textContent = "究極技！";
      badge.setAttribute("aria-hidden", "true");
      card.classList.add("battle-ultimate");
      card.append(badge);
      const timer = setTimeout(() => {
        badge.remove();
        card.classList.remove("battle-ultimate");
        cards.delete(event.attacker);
      }, 1450);
      cards.set(event.attacker, { card, badge, timer });
    },
    clear,
    dispose() {
      if (!disposed) {
        disposed = true;
        clear();
        queue.dispose();
        layer.remove();
        announcement.remove();
      }
    },
  };
}
