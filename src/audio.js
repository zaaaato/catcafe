/** A small, entirely local soundscape. No audio is created until the visitor opts in. */
export const AMBIENCE_PRESETS = Object.freeze([
  {
    id: "cafe",
    label: "カフェ",
    description: "柔らかな空気と、遠くのカップの音",
  },
  { id: "rain", label: "雨の日", description: "窓の向こうに降る、穏やかな雨" },
  {
    id: "garden",
    label: "庭の風",
    description: "木々を渡る風と、小鳥のさえずり",
  },
]);

const clamp = (value, fallback = 0.65) =>
  Number.isFinite(Number(value))
    ? Math.min(1, Math.max(0, Number(value)))
    : fallback;
const validPreset = (id) => AMBIENCE_PRESETS.some((item) => item.id === id);

export function createCafeAudio({
  preset = "cafe",
  volume = 0.65,
  onStateChange,
} = {}) {
  const AudioContextClass =
    globalThis.AudioContext || globalThis.webkitAudioContext;
  const page = typeof document !== "undefined" ? document : null;
  let context, master, compressor, buffers, ambience;
  let enabled = false;
  let destroyed = false;
  let generation = 0;
  let selectedPreset = validPreset(preset) ? preset : "cafe";
  let selectedVolume = clamp(volume);
  let suspensionTimer;
  const groups = new Set();
  const effectTimes = new Map();

  const getState = () => ({
    enabled,
    preset: selectedPreset,
    volume: selectedVolume,
    supported: Boolean(AudioContextClass) && !destroyed,
  });
  const notify = () => {
    if (typeof onStateChange === "function") onStateChange(getState());
  };
  const isAudible = () =>
    enabled && !destroyed && !page?.hidden && context?.state === "running";
  const ramp = (param, value, seconds = 0.35) => {
    const now = context.currentTime;
    if (typeof param.cancelAndHoldAtTime === "function")
      param.cancelAndHoldAtTime(now);
    else {
      param.cancelScheduledValues(now);
      param.setValueAtTime(param.value, now);
    }
    param.setTargetAtTime(value, now, seconds / 3);
  };

  function makeGroup() {
    const group = { nodes: [], sources: [], timers: new Set(), closed: false };
    group.gain = context.createGain();
    group.gain.gain.value = 0;
    group.gain.connect(master);
    group.nodes.push(group.gain);
    group.later = (fn, milliseconds) => {
      const timer = setTimeout(() => {
        group.timers.delete(timer);
        if (!group.closed) fn();
      }, milliseconds);
      group.timers.add(timer);
    };
    group.close = () => {
      if (group.closed) return;
      group.closed = true;
      group.timers.forEach(clearTimeout);
      group.timers.clear();
      group.sources.forEach((source) => {
        try {
          source.stop();
        } catch {
          /* Already finished. */
        }
      });
      group.nodes.forEach((node) => {
        try {
          node.disconnect();
        } catch {
          /* Already disconnected. */
        }
      });
      groups.delete(group);
    };
    groups.add(group);
    return group;
  }

  function initialize() {
    if (context || destroyed || !AudioContextClass) return;
    context = new AudioContextClass({ latencyHint: "playback" });
    master = context.createGain();
    master.gain.value = 0;
    compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -16;
    compressor.knee.value = 12;
    compressor.ratio.value = 6;
    compressor.attack.value = 0.008;
    compressor.release.value = 0.3;
    master.connect(compressor);
    compressor.connect(context.destination);

    // Shared buffers keep memory bounded. Brown noise is softer than white noise,
    // while the pink buffer gives rain and wind a natural broad spectrum.
    buffers = {};
    for (const kind of ["brown", "pink"]) {
      const buffer = context.createBuffer(
        1,
        context.sampleRate * 6,
        context.sampleRate,
      );
      const data = buffer.getChannelData(0);
      let brown = 0,
        b0 = 0,
        b1 = 0,
        b2 = 0;
      for (let i = 0; i < data.length; i++) {
        const white = Math.random() * 2 - 1;
        brown = (brown + white * 0.025) / 1.025;
        b0 = 0.99765 * b0 + white * 0.099046;
        b1 = 0.963 * b1 + white * 0.2965164;
        b2 = 0.57 * b2 + white * 1.0526913;
        data[i] =
          kind === "brown"
            ? brown * 2.8
            : (b0 + b1 + b2 + white * 0.1848) * 0.12;
      }
      // Blend the loop seam, avoiding a periodic click even on headphones.
      const seam = Math.floor(context.sampleRate * 0.06);
      for (let i = 0; i < seam; i++) {
        const mix = i / seam;
        data[data.length - seam + i] =
          data[data.length - seam + i] * (1 - mix) + data[0] * mix;
      }
      buffers[kind] = buffer;
    }
  }

  function noise(
    group,
    {
      kind = "pink",
      type = "lowpass",
      frequency = 800,
      level = 0.2,
      pan = 0,
      motion = 0,
    } = {},
  ) {
    const source = context.createBufferSource();
    source.buffer = buffers[kind];
    source.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = 0.5;
    const gain = context.createGain();
    gain.gain.value = level;
    source.connect(filter);
    filter.connect(gain);
    if (context.createStereoPanner) {
      const panner = context.createStereoPanner();
      panner.pan.value = pan;
      gain.connect(panner);
      panner.connect(group.gain);
      group.nodes.push(panner);
    } else gain.connect(group.gain);
    group.nodes.push(source, filter, gain);
    group.sources.push(source);
    source.start(0, Math.random() * 5);
    if (motion) {
      const oscillator = context.createOscillator();
      const depth = context.createGain();
      oscillator.frequency.value = motion;
      depth.gain.value = level * 0.25;
      oscillator.connect(depth);
      depth.connect(gain.gain);
      oscillator.start();
      group.nodes.push(oscillator, depth);
      group.sources.push(oscillator);
    }
    return { source, filter, gain };
  }

  // Each transient owns a short-lived group; finished nodes never accumulate.
  function tone({
    frequency,
    endFrequency = frequency,
    duration = 0.2,
    level = 0.025,
    delay = 0,
    pan = 0,
    type = "sine",
  }) {
    if (!isAudible()) return;
    const group = makeGroup();
    group.gain.gain.value = 1;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    const start = context.currentTime + delay;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(20, endFrequency),
      start + duration,
    );
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(
      level,
      start + Math.min(0.015, duration * 0.1),
    );
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(envelope);
    if (context.createStereoPanner) {
      const panner = context.createStereoPanner();
      panner.pan.value = pan;
      envelope.connect(panner);
      panner.connect(group.gain);
      group.nodes.push(panner);
    } else envelope.connect(group.gain);
    group.sources.push(oscillator);
    group.nodes.push(oscillator, envelope);
    oscillator.onended = group.close;
    oscillator.start(start);
    oscillator.stop(start + duration + 0.04);
    group.later(group.close, (delay + duration + 0.2) * 1000);
  }

  function cup(level = 0.024) {
    const pan = Math.random() * 1.2 - 0.6;
    tone({ frequency: 1710, duration: 0.24, level, pan });
    tone({
      frequency: 2483,
      duration: 0.11,
      level: level * 0.3,
      pan,
      delay: 0.01,
    });
  }

  function bird() {
    const pitch = 1700 + Math.random() * 700;
    const pan = Math.random() * 1.4 - 0.7;
    for (let i = 0; i < 3; i++)
      tone({
        frequency: pitch + i * 90,
        endFrequency: pitch * 1.4,
        duration: 0.085,
        level: 0.018,
        delay: i * 0.15,
        pan,
      });
  }

  function startAmbience() {
    if (!context || destroyed) return;
    const previous = ambience;
    ambience = makeGroup();
    const group = ambience;
    if (selectedPreset === "rain") {
      noise(group, {
        type: "lowpass",
        frequency: 1800,
        level: 0.23,
        pan: -0.5,
        motion: 0.075,
      });
      noise(group, {
        type: "bandpass",
        frequency: 3100,
        level: 0.07,
        pan: 0.55,
        motion: 0.11,
      });
      noise(group, { kind: "brown", frequency: 290, level: 0.1 });
    } else if (selectedPreset === "garden") {
      noise(group, {
        kind: "brown",
        frequency: 500,
        level: 0.21,
        pan: -0.25,
        motion: 0.12,
      });
      noise(group, {
        type: "bandpass",
        frequency: 1200,
        level: 0.1,
        pan: 0.4,
        motion: 0.08,
      });
      const visit = () => {
        if (isAudible() && ambience === group) bird();
        group.later(visit, 8000 + Math.random() * 13000);
      };
      group.later(visit, 2500 + Math.random() * 4000);
    } else {
      noise(group, {
        kind: "brown",
        frequency: 430,
        level: 0.21,
        motion: 0.09,
      });
      noise(group, {
        type: "bandpass",
        frequency: 900,
        level: 0.065,
        pan: 0.35,
        motion: 0.14,
      });
      const visit = () => {
        if (isAudible() && ambience === group) cup();
        group.later(visit, 11000 + Math.random() * 18000);
      };
      group.later(visit, 5000 + Math.random() * 5000);
    }
    ramp(group.gain.gain, 1, 1.2);
    if (previous) {
      ramp(previous.gain.gain, 0, 0.8);
      previous.later(previous.close, 1500);
    }
  }

  async function setEnabled(next) {
    if (destroyed || !AudioContextClass) return false;
    const desired = Boolean(next);
    const request = ++generation;
    clearTimeout(suspensionTimer);
    enabled = desired;
    if (!desired) {
      if (context) {
        ramp(master.gain, 0, 0.22);
        suspensionTimer = setTimeout(() => {
          if (!enabled && !destroyed) context.suspend().catch(() => {});
        }, 350);
      }
      notify();
      return false;
    }
    try {
      initialize();
      if (!ambience) startAmbience();
      // resume() is invoked within the visitor's click call stack.
      await context.resume();
      if (request !== generation || destroyed) return enabled;
      if (page?.hidden) await context.suspend();
      else ramp(master.gain, selectedVolume * 0.48, 0.6);
      notify();
      return enabled;
    } catch {
      if (request === generation) {
        enabled = false;
        notify();
      }
      return false;
    }
  }

  function setPreset(id) {
    if (!validPreset(id) || destroyed || id === selectedPreset) return;
    selectedPreset = id;
    if (context) startAmbience();
    notify();
  }

  function setVolume(value) {
    if (destroyed) return;
    selectedVolume = clamp(value, selectedVolume);
    if (context)
      ramp(master.gain, isAudible() ? selectedVolume * 0.48 : 0, 0.18);
    notify();
  }

  function playEffect(kind) {
    if (!isAudible() || selectedVolume === 0) return;
    const now = context.currentTime;
    if (
      now - (effectTimes.get(kind) ?? -Infinity) <
      (kind === "purr" ? 1.5 : 0.4)
    )
      return;
    effectTimes.set(kind, now);
    if (kind === "purr") {
      const group = makeGroup();
      const voice = noise(group, {
        kind: "brown",
        frequency: 280,
        level: 0.65,
      });
      const rumble = context.createOscillator();
      const depth = context.createGain();
      rumble.frequency.value = 26;
      depth.gain.value = 0.33;
      rumble.connect(depth);
      depth.connect(voice.gain.gain);
      rumble.start();
      group.sources.push(rumble);
      group.nodes.push(rumble, depth);
      const gain = group.gain.gain;
      gain.setValueAtTime(0, now);
      gain.linearRampToValueAtTime(0.65, now + 0.15);
      gain.linearRampToValueAtTime(0.4, now + 0.8);
      gain.linearRampToValueAtTime(0.65, now + 1.15);
      gain.linearRampToValueAtTime(0, now + 1.8);
      group.later(group.close, 2000);
    } else if (kind === "toy") {
      // Two inharmonic partials suggest the little bell on a cat wand.
      tone({ frequency: 1820, duration: 0.22, level: 0.023, pan: -0.12 });
      tone({
        frequency: 2917,
        duration: 0.13,
        level: 0.008,
        delay: 0.006,
        pan: -0.12,
      });
    } else if (kind === "treat") {
      cup(0.038);
      tone({
        frequency: 740,
        endFrequency: 390,
        duration: 0.075,
        level: 0.04,
        delay: 0.1,
      });
      tone({
        frequency: 680,
        endFrequency: 360,
        duration: 0.06,
        level: 0.028,
        delay: 0.2,
      });
    }
  }

  function handleVisibility() {
    if (!context || destroyed) return;
    clearTimeout(suspensionTimer);
    if (page.hidden) {
      ramp(master.gain, 0, 0.12);
      suspensionTimer = setTimeout(() => {
        if (page.hidden && !destroyed) context.suspend().catch(() => {});
      }, 180);
    } else if (enabled) {
      const request = generation;
      context
        .resume()
        .then(() => {
          if (request === generation && isAudible())
            ramp(master.gain, selectedVolume * 0.48, 0.4);
        })
        .catch(() => {
          // A delayed browser rejection must not undo a more recent visitor click.
          if (request === generation && !destroyed) {
            enabled = false;
            notify();
          }
        });
    }
  }

  async function destroy() {
    if (destroyed) return;
    destroyed = true;
    enabled = false;
    generation++;
    clearTimeout(suspensionTimer);
    page?.removeEventListener("visibilitychange", handleVisibility);
    groups.forEach((group) => group.close());
    master?.disconnect();
    compressor?.disconnect();
    buffers = null;
    if (context && context.state !== "closed")
      await context.close().catch(() => {});
  }

  page?.addEventListener("visibilitychange", handleVisibility);
  return {
    setEnabled,
    toggle: () => setEnabled(!enabled),
    setPreset,
    setVolume,
    playEffect,
    getState,
    destroy,
  };
}
