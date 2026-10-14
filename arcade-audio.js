'use strict';
/* Browser sound design based on Dota's event roles (see docs/arcade-effects.md).
   These are synthesized recreations, not recordings from Valve's sound bank.
   sound() — игровые события; amb() — фон и мелочи (треск свечей, щелчки отмычки, птицы): тише и без учёта в журнале событий. */
(() => {
  let ctx, master, compressor, verb, verbSend, noiseBuffer, muted = false, paused = false;
  const voices = new Set(), recent = new Map();
  function unlock() {
    try {
      if (!ctx) {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        master = ctx.createGain();
        compressor = ctx.createDynamicsCompressor();
        compressor.threshold.value = -16; compressor.ratio.value = 5;
        master.gain.value = muted || paused ? 0 : .65;
        master.connect(compressor).connect(ctx.destination);
        noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const samples = noiseBuffer.getChannelData(0);
        let seed = 7183;
        for (let i = 0; i < samples.length; i++) {
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
          samples[i] = seed / 2147483648 - 1;
        }
        // короткий «каменный» хвост: затухающий шум как импульс зала — камера Сларка и открытое поле звучат объёмнее
        const len = Math.floor(ctx.sampleRate * 1.1), ir = ctx.createBuffer(2, len, ctx.sampleRate);
        for (let c = 0; c < 2; c++) {
          const d = ir.getChannelData(c);
          for (let i = 0; i < len; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; d[i] = (seed / 2147483648 - 1) * Math.pow(1 - i / len, 3.2); }
        }
        verb = ctx.createConvolver(); verb.buffer = ir;
        verbSend = ctx.createGain(); verbSend.gain.value = .22;
        verbSend.connect(verb).connect(master);
      }
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    } catch { /* Sound is optional on browsers without Web Audio. */ }
  }
  function volume() {
    if (!ctx) return;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(muted || paused ? 0 : .65, ctx.currentTime, .015);
  }
  function stop() {
    for (const source of voices) { try { source.stop(); } catch {} }
    voices.clear(); recent.clear();
  }
  const GAPS = { reveal: .07, tick: .1, rattle: .045, crackle: .05, grass: .03, heart: .3 };
  function play(name, options = {}) {
    if (muted || paused) return;
    unlock();
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    if (now - (recent.get(name) ?? -10) < (GAPS[name] ?? .035)) return;
    recent.set(name, now);
    if (voices.size > 100) return;
    const pan = Math.max(-1, Math.min(1, options.pan || 0));
    const level = options.volume ?? 1, P = options.pitch || 1, wet = options.wet ?? 1;
    function voice(source, duration, gain, delay = 0, filter = null, attack = .003) {
      const at = now + delay, envelope = ctx.createGain(), stereo = ctx.createStereoPanner();
      stereo.pan.value = pan;
      envelope.gain.setValueAtTime(0, at);
      envelope.gain.linearRampToValueAtTime(gain * level, at + attack);
      envelope.gain.exponentialRampToValueAtTime(.0001, at + duration);
      if (filter) source.connect(filter).connect(envelope); else source.connect(envelope);
      envelope.connect(stereo).connect(master);
      if (wet) stereo.connect(verbSend);
      voices.add(source);
      source.onended = () => { voices.delete(source); source.disconnect(); filter?.disconnect(); envelope.disconnect(); stereo.disconnect(); };
      source.start(at); source.stop(at + duration + .02);
    }
    function tone(f, duration, gain, delay = 0, end = f, type = 'sine', attack) {
      const osc = ctx.createOscillator(); osc.type = type;
      osc.frequency.setValueAtTime(f * P, now + delay);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, end * P), now + delay + duration);
      voice(osc, duration, gain, delay, null, attack);
    }
    function noise(duration, gain, frequency, delay = 0, end = frequency, type = 'bandpass', q = .75, attack) {
      const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter();
      source.buffer = noiseBuffer; filter.type = type; filter.Q.value = q;
      source.playbackRate.value = .8 + Math.random() * .4;
      filter.frequency.setValueAtTime(frequency, now + delay);
      filter.frequency.exponentialRampToValueAtTime(Math.max(30, end), now + delay + duration);
      voice(source, duration, gain, delay, filter, attack);
    }
    function metal(base, gain = .13, delay = 0) {
      [1, 1.47, 2.09, 2.56, 3.91].forEach((r, i) => tone(base * r, .12 + i * .025, gain / (i + 1), delay, base * r * .96));
      noise(.045, .23, 4200, delay);
    }
    switch (name) {
      // ---------- «Взлом замка» ----------
      case 'hit': metal(760); noise(.16, .12, 1700, .015, 400); tone(1520, .22, .05, .02, 1480, 'triangle'); break;
      case 'blue': metal(980, .09); [880, 1320, 1760].forEach((f, i) => tone(f, .38, .11, i * .045)); noise(.3, .1, 4800, 0, 1400); break;
      case 'miss': metal(170, .2); noise(.23, .32, 1100, 0, 160); tone(95, .25, .2, 0, 42); noise(.08, .2, 2600, .05, 900); break;
      case 'tick': tone(1650, .04, .07); noise(.025, .08, 3600); break;
      case 'heart': tone(62, .16, .34, 0, 40); tone(58, .2, .26, .17, 38); noise(.08, .12, 220, 0, 90, 'lowpass'); break;
      case 'start': metal(460, .1); tone(230, .3, .13, .04, 115); break;
      case 'go': metal(620, .1); tone(523, .18, .07, 0, 523, 'triangle'); tone(784, .3, .07, .07, 784, 'triangle'); break;
      // серия попаданий: короткая восходящая трель, выше с каждым попаданием (pitch задаёт игра)
      case 'combo': [1, 1.25, 1.5].forEach((r, i) => tone(880 * r, .16, .045, i * .035, 880 * r, 'triangle')); break;
      case 'whoosh': noise(.32, .22, 500, 0, 3800, 'bandpass', 1.4, .06); break;
      case 'spawn': [1320, 1760].forEach((f, i) => tone(f, .25, .025, i * .05, f * 1.02)); noise(.18, .03, 6000, 0, 3000); break;
      case 'fade': noise(.25, .05, 2400, 0, 500); break;
      // дужка выскакивает: тяжёлый щелчок механизма, звон пружины и золотой аккорд
      case 'unlock':
        metal(300, .24); noise(.1, .35, 2000, 0, 600); tone(110, .3, .3, 0, 55);
        metal(900, .1, .12); [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 1, .07, .2 + i * .06, f, 'triangle')); break;
      case 'jam': metal(220, .16); metal(205, .12, .12); noise(.3, .2, 800, 0, 200); break;
      // ---------- «Сапёр Сплин» ----------
      // Dry wood/earth instead of the old electronic reveal beep.
      case 'reveal': noise(.24, .34, 1250, 0, 240, 'lowpass'); noise(.07, .18, 4200); tone(110, .1, .14, 0, 45); break;
      // большой каскад: шорох травы раскатывается, чем больше клеток, тем длиннее
      case 'cascade': {
        const n = Math.min(10, options.count || 4);
        for (let k = 0; k < n; k++) noise(.12, .12, 1800 + k * 160, k * .045, 500);
        tone(90, .35, .12, 0, 50); break;
      }
      case 'grass': noise(.06, .07, 2600 + Math.random() * 1500, 0, 900); break;
      case 'flag': noise(.13, .33, 1600, 0, 450); tone(210, .1, .18, 0, 80); noise(.045, .17, 3000, .04); break;
      case 'unflag': noise(.19, .19, 2200, 0, 500); tone(150, .12, .07, 0, 60); break;
      case 'move': noise(.16, .14, 900, 0, 3200); tone(360, .12, .06, 0, 650); break;
      case 'itemspawn': [1200, 1600, 2000].forEach((f, i) => tone(f, .2, .03, i * .06, f * 1.05)); noise(.2, .04, 5000); break;
      case 'clarity':
        noise(.55, .15, 1100, 0, 4800);
        [640, 920, 1260, 1690].forEach((f, i) => tone(f, .3, .065, i * .055, f * 1.3)); break;
      case 'clock':
        [0, .14, .28, .42].forEach((at, i) => { tone(i % 2 ? 1300 : 1850, .065, .12, at); noise(.025, .1, 3000, at); });
        tone(1040, .5, .07, .2, 1560); break;
      case 'expire': noise(.3, .12, 2000, 0, 180); tone(420, .27, .08, 0, 160); break;
      case 'invalid': tone(180, .13, .1, 0, 130); tone(191, .16, .08, .03, 140); break;
      case 'nomana': tone(240, .12, .08, 0, 200, 'square'); tone(180, .16, .06, .09, 150, 'square'); break;
      case 'arm': noise(.18, .13, 1000, 0, 4500); tone(520, .2, .06, 0, 1040); break;
      case 'slash':
        noise(.32, .3, 700, 0, 6500); noise(.3, .16, 4800, .14, 800);
        [410, 617, 823].forEach(f => tone(f, .48, .065, 0, f * .65)); break;
      // Original minesweeper event: priming cue, then explosion at +0.400s.
      case 'prime': tone(1350, .12, .18); tone(1950, .11, .12, .17); noise(.39, .12, 3400, 0, 6000); break;
      case 'boom': case 'defuse': {
        const k = name === 'defuse' ? .4 : 1;
        noise(.9, .8 * k, 2900, 0, 90, 'lowpass'); noise(.13, .42 * k, 6500);
        tone(125, .6, .55 * k, 0, 28); tone(62, 1.05, .26 * k, .02, 23);
        if (k === 1) noise(1.6, .2, 600, .25, 120, 'lowpass'); break;   // осыпающаяся земля
      }
      case 'pop': noise(.18, .2, 900, 0, 120, 'lowpass'); tone(80, .2, .12, 0, 35); break;
      case 'win': case 'stage':
        [261.63, 329.63, 392, 523.25].forEach((f, i) => { tone(f, .8, .1, i * .075); tone(f * 2, .55, .035, i * .075); });
        noise(.45, .09, 3500); break;
      case 'end': tone(196, .8, .12); tone(233, .9, .08, .12); tone(98, 1.1, .15, .2); noise(.5, .1, 450, 0, 90); break;
      // ---------- фон ----------
      case 'crackle': for (let k = 0; k < 2 + Math.random() * 3; k++) noise(.02 + Math.random() * .03, .05 + Math.random() * .07, 2000 + Math.random() * 3500, Math.random() * .12); break;
      case 'rattle': noise(.03, .07, 3800 + Math.random() * 800); tone(2400 + Math.random() * 300, .03, .012); break;
      case 'drip': tone(1400 + Math.random() * 500, .12, .05, 0, 700 + Math.random() * 200); break;
      case 'bird': { const f = 2600 + Math.random() * 900; for (let k = 0; k < 2 + Math.random() * 3; k++) tone(f, .08, .025, k * .11, f * 1.35); break; }
    }
  }
  window.ArcadeAudio = {
    unlock, sound: play, stop,
    amb: (name, options = {}) => play(name, { ...options, volume: (options.volume ?? 1) * .55 }),
    mute(on) { muted = on; if (on) stop(); volume(); },
    pause(on) { paused = on; if (on) stop(); volume(); },
  };
})();
