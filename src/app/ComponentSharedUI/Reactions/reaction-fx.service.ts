import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/**
 * Reaction effects: a floating emoji (plus a few particles for Love and Haha) and optional sounds.
 *
 *  - lightweight: only transform/opacity animations through the Web Animations API, a handful of
 *    short-lived elements that are removed when they finish, pointer-events off so scrolling is never affected
 *  - respects "reduce motion"
 *  - sounds are synthesised with the Web Audio API (no audio files to download), OFF by default, saved in
 *    this browser, and only ever started from a click/tap handler so autoplay rules are never an issue
 *  - one sound at a time: a new reaction stops the previous sound first
 */
@Injectable({ providedIn: 'root' })
export class ReactionFxService {
  private static readonly KEY = 'nx-reaction-sound';
  private static readonly MAX_LIVE = 24;

  /** Sound ON/OFF (default OFF) */
  readonly sound$ = new BehaviorSubject<boolean>(false);

  private ctx?: AudioContext;
  private stopCurrent?: () => void;
  private live = 0;

  constructor() {
    try { this.sound$.next(localStorage.getItem(ReactionFxService.KEY) === '1'); } catch { /* storage unavailable: stay off */ }
  }

  get soundOn(): boolean { return this.sound$.value; }

  setSound(on: boolean): void {
    try { localStorage.setItem(ReactionFxService.KEY, on ? '1' : '0'); } catch { /* not persisted, still applies now */ }
    this.sound$.next(on);
    if (!on) { this.stopCurrent?.(); }
  }

  // ======================================================================== visual effect
  /** Floating emoji above `origin`; Love and Haha add a few particles. Call from the click handler. */
  burst(origin: HTMLElement | null | undefined, emoji: string | undefined, label: string): void {
    if (!emoji || !origin || typeof document === 'undefined' || this.reducedMotion()) { return; }
    if (this.live > ReactionFxService.MAX_LIVE) { return; }       // never pile up on rapid clicks

    const r = origin.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;

    this.float(emoji, x, y, 28, 0, -90, 950, 1.5);

    if (label === 'Love' || label === 'Haha') {
      const set = label === 'Love' ? ['❤️', '💖', '💕'] : ['😂', '🤣', '😆'];
      const n = 6;
      for (let i = 0; i < n; i++) {
        const angle = (-Math.PI / 2) + (i - (n - 1) / 2) * 0.55 + (Math.random() - .5) * .25;
        const dist = 60 + Math.random() * 45;
        this.float(set[i % set.length], x, y, 14 + Math.random() * 6, Math.cos(angle) * dist, Math.sin(angle) * dist, 700 + Math.random() * 400, 1.1);
      }
    }
  }

  private float(emoji: string, x: number, y: number, size: number, dx: number, dy: number, ms: number, peak: number): void {
    const el = document.createElement('span');
    el.textContent = emoji;
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText =
      `position:fixed;left:${x}px;top:${y}px;z-index:10000;pointer-events:none;font-size:${size}px;line-height:1;` +
      'will-change:transform,opacity;transform:translate(-50%,-50%);user-select:none;';
    document.body.appendChild(el);
    this.live++;

    const done = () => { if (el.parentNode) { el.parentNode.removeChild(el); } this.live = Math.max(0, this.live - 1); };
    if (typeof el.animate !== 'function') { setTimeout(done, ms); return; }

    const anim = el.animate([
      { transform: 'translate(-50%,-50%) scale(.4)', opacity: 0 },
      { transform: `translate(calc(-50% + ${dx * .25}px), calc(-50% + ${dy * .25}px)) scale(${peak})`, opacity: 1, offset: .25 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.9)`, opacity: 0 }
    ], { duration: ms, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' });
    anim.onfinish = done;
    anim.oncancel = done;
  }

  private reducedMotion(): boolean {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
  }

  // ======================================================================== sound
  /** Play the reaction's sound if sounds are ON. Must be called from a click/tap handler. */
  play(label: string): void {
    if (!this.soundOn) { return; }
    const ctx = this.audio();
    if (!ctx) { return; }

    this.stopCurrent?.();                                           // no overlapping sounds
    const nodes: { osc: OscillatorNode; gain: GainNode }[] = [];
    const now = ctx.currentTime;

    const tone = (type: OscillatorType, f0: number, f1: number, at: number, dur: number, vol: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(f0, now + at);
      if (f1 !== f0) { osc.frequency.exponentialRampToValueAtTime(f1, now + at + dur); }
      gain.gain.setValueAtTime(0.0001, now + at);
      gain.gain.exponentialRampToValueAtTime(vol, now + at + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + dur);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(now + at); osc.stop(now + at + dur + 0.03);
      nodes.push({ osc, gain });
    };

    switch (label) {
      case 'Like':  tone('sine', 520, 900, 0, 0.08, 0.09); break;                                   // subtle pop
      case 'Love':  tone('sine', 120, 90, 0, 0.11, 0.14); tone('sine', 120, 90, 0.15, 0.13, 0.12);  // soft heartbeat
                    tone('sine', 240, 200, 0, 0.09, 0.03); break;
      case 'Haha':  [523, 659, 784, 659].forEach((f, i) => tone('triangle', f, f * 1.02, i * 0.075, 0.07, 0.07)); break;  // playful
      case 'Wow':   tone('sine', 380, 940, 0, 0.19, 0.08); tone('sine', 940, 940, 0.2, 0.05, 0.05); break;                // surprise
      case 'Sad':   tone('sine', 440, 392, 0, 0.17, 0.06); tone('sine', 370, 294, 0.17, 0.22, 0.055); break;              // soft, falling
      case 'Angry': tone('sine', 85, 50, 0, 0.13, 0.16); tone('sawtooth', 150, 70, 0, 0.08, 0.035); break;                // impact
      default:      tone('sine', 520, 900, 0, 0.08, 0.08);
    }

    this.stopCurrent = () => {
      nodes.forEach(({ osc, gain }) => {
        try { gain.gain.cancelScheduledValues(ctx.currentTime); gain.gain.setValueAtTime(0.0001, ctx.currentTime); osc.stop(); } catch { /* already stopped */ }
      });
      this.stopCurrent = undefined;
    };
    const mine = this.stopCurrent;
    setTimeout(() => { if (this.stopCurrent === mine) { this.stopCurrent = undefined; } }, 900);
  }

  /** Created lazily inside a user gesture (browser and mobile audio policies). */
  private audio(): AudioContext | undefined {
    try {
      const AC: typeof AudioContext | undefined = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AC) { return undefined; }
      this.ctx = this.ctx || new AC();
      if (this.ctx.state === 'suspended') { void this.ctx.resume(); }
      return this.ctx;
    } catch {
      return undefined;
    }
  }
}
