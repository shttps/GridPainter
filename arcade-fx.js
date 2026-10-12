'use strict';
(() => {
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => motionPreference.matches;
  const lerp = (a, b, t) => a + (b - a) * t;
  function keyframe(values, t) {
    const p = Math.max(0, Math.min(.999999, t)) * (values.length - 1), i = Math.floor(p);
    return lerp(values[i], values[i + 1], p - i);
  }
  // The scale/rotation keyframes match Crownfall's BounceIn and DropIn.
  function pop(g, x, y, t, drop = false) {
    if (reduced()) return;
    t = Math.max(0, Math.min(1, t));
    const scale = drop ? (t < .9 ? lerp(1.8, .8, t / .9) : lerp(.8, 1, (t - .9) / .1)) : keyframe([.3, 1.5, .8, 1.1, 1], t);
    g.translate(x, y + (drop ? (t < .9 ? lerp(-60, 2, t / .9) : lerp(2, 0, (t - .9) / .1)) : 0));
    g.rotate(drop ? 0 : keyframe([-10, 2, -2, 1, 0], t) * Math.PI / 180);
    g.scale(scale, scale); g.translate(-x, -y);
    g.globalAlpha *= Math.min(1, t * 5);
  }
  class Particles {
    constructor() { this.items = []; }
    burst(x, y, color, count = 20, speed = 90, gravity = 100) {
      if (reduced()) return;
      for (let i = 0; i < count && this.items.length < 220; i++) {
        const a = Math.random() * Math.PI * 2, v = speed * (.25 + Math.random());
        this.items.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, color, gravity, age: 0, life: .25 + Math.random() * .55, size: .8 + Math.random() * 2 });
      }
    }
    step(dt) {
      for (const p of this.items) { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.gravity * dt; }
      this.items = this.items.filter(p => p.age < p.life);
    }
    draw(g, sizeScale = 1) {
      g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
      for (const p of this.items) {
        g.globalAlpha = Math.pow(1 - p.age / p.life, 1.5); g.strokeStyle = p.color; g.lineWidth = p.size * sizeScale;
        g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * .025, p.y - p.vy * .025); g.stroke();
      }
      g.restore();
    }
    clear() { this.items.length = 0; }
  }
  window.ArcadeFX = { Particles, pop, keyframe, reduced };
})();
