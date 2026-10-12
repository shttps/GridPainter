'use strict';
/* Browser sound design based on Dota's event roles (see docs/arcade-effects.md).
   These are synthesized recreations, not recordings from Valve's sound bank. */
(() => {
  let ctx, master, compressor, noiseBuffer, muted = false, paused = false;
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
  function sound(name, options = {}) {
    if (muted || paused) return;
    unlock();
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const gap = name === 'reveal' ? .07 : name === 'tick' ? .1 : .035;
    if (now - (recent.get(name) ?? -10) < gap) return;
    recent.set(name, now);
    if (voices.size > 100) return;
    const pan = Math.max(-1, Math.min(1, options.pan || 0));
    const level = options.volume ?? 1;
    function voice(source, duration, gain, delay = 0, filter = null, attack = .003) {
      const at = now + delay, envelope = ctx.createGain(), stereo = ctx.createStereoPanner();
      stereo.pan.value = pan;
      envelope.gain.setValueAtTime(0, at);
      envelope.gain.linearRampToValueAtTime(gain * level, at + attack);
      envelope.gain.exponentialRampToValueAtTime(.0001, at + duration);
      if (filter) source.connect(filter).connect(envelope); else source.connect(envelope);
      envelope.connect(stereo).connect(master);
      voices.add(source);
      source.onended = () => { voices.delete(source); source.disconnect(); filter?.disconnect(); envelope.disconnect(); stereo.disconnect(); };
      source.start(at); source.stop(at + duration + .02);
    }
    function tone(f, duration, gain, delay = 0, end = f, type = 'sine') {
      const osc = ctx.createOscillator(); osc.type = type;
      osc.frequency.setValueAtTime(f, now + delay);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), now + delay + duration);
      voice(osc, duration, gain, delay);
    }
    function noise(duration, gain, frequency, delay = 0, end = frequency, type = 'bandpass') {
      const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter();
      source.buffer = noiseBuffer; filter.type = type; filter.Q.value = .75;
      filter.frequency.setValueAtTime(frequency, now + delay);
      filter.frequency.exponentialRampToValueAtTime(Math.max(30, end), now + delay + duration);
      voice(source, duration, gain, delay, filter);
    }
    function metal(base, gain = .13) {
      [1, 1.47, 2.09, 2.56, 3.91].forEach((r, i) => tone(base * r, .12 + i * .025, gain / (i + 1), 0, base * r * .96));
      noise(.045, .23, 4200);
    }
    switch (name) {
      case 'hit': metal(760); noise(.16, .12, 1700, .015, 400); break;
      case 'blue': metal(980, .09); [880, 1320, 1760].forEach((f, i) => tone(f, .38, .11, i * .045)); noise(.3, .1, 4800, 0, 1400); break;
      case 'miss': metal(170, .2); noise(.23, .32, 1100, 0, 160); tone(95, .25, .2, 0, 42); break;
      case 'tick': tone(1650, .04, .07); noise(.025, .08, 3600); break;
      case 'start': metal(460, .1); tone(230, .3, .13, .04, 115); break;
      // Dry wood/earth instead of the old electronic reveal beep.
      case 'reveal': noise(.24, .34, 1250, 0, 240, 'lowpass'); noise(.07, .18, 4200); tone(110, .1, .14, 0, 45); break;
      case 'flag': noise(.13, .33, 1600, 0, 450); tone(210, .1, .18, 0, 80); noise(.045, .17, 3000, .04); break;
      case 'unflag': noise(.19, .19, 2200, 0, 500); tone(150, .12, .07, 0, 60); break;
      case 'move': noise(.16, .14, 900, 0, 3200); tone(360, .12, .06, 0, 650); break;
      case 'clarity':
        noise(.55, .15, 1100, 0, 4800);
        [640, 920, 1260, 1690].forEach((f, i) => tone(f, .3, .065, i * .055, f * 1.3)); break;
      case 'clock':
        [0, .14, .28, .42].forEach((at, i) => { tone(i % 2 ? 1300 : 1850, .065, .12, at); noise(.025, .1, 3000, at); });
        tone(1040, .5, .07, .2, 1560); break;
      case 'expire': noise(.3, .12, 2000, 0, 180); tone(420, .27, .08, 0, 160); break;
      case 'invalid': tone(180, .13, .1, 0, 130); tone(191, .16, .08, .03, 140); break;
      case 'arm': noise(.18, .13, 1000, 0, 4500); tone(520, .2, .06, 0, 1040); break;
      case 'slash':
        noise(.32, .3, 700, 0, 6500); noise(.3, .16, 4800, .14, 800);
        [410, 617, 823].forEach(f => tone(f, .48, .065, 0, f * .65)); break;
      // Original minesweeper event: priming cue, then explosion at +0.400s.
      case 'prime': tone(1350, .12, .18); tone(1950, .11, .12, .17); noise(.39, .12, 3400, 0, 6000); break;
      case 'boom': case 'defuse': {
        const k = name === 'defuse' ? .4 : 1;
        noise(.9, .8 * k, 2900, 0, 90, 'lowpass'); noise(.13, .42 * k, 6500);
        tone(125, .6, .55 * k, 0, 28); tone(62, 1.05, .26 * k, .02, 23); break;
      }
      case 'win': case 'stage':
        [261.63, 329.63, 392, 523.25].forEach((f, i) => { tone(f, .8, .1, i * .075); tone(f * 2, .55, .035, i * .075); });
        noise(.45, .09, 3500); break;
      case 'end': tone(196, .8, .12); tone(233, .9, .08, .12); tone(98, 1.1, .15, .2); noise(.5, .1, 450, 0, 90); break;
    }
  }
  window.ArcadeAudio = {
    unlock, sound, stop,
    mute(on) { muted = on; if (on) stop(); volume(); },
    pause(on) { paused = on; if (on) stop(); volume(); },
  };
})();
