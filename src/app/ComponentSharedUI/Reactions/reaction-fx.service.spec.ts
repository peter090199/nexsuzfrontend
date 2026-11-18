import { TestBed } from '@angular/core/testing';
import { ReactionFxService } from './reaction-fx.service';

describe('ReactionFxService', () => {
  const KEY = 'nx-reaction-sound';
  let fx: ReactionFxService;

  const make = () => { TestBed.resetTestingModule(); TestBed.configureTestingModule({}); return TestBed.inject(ReactionFxService); };

  beforeEach(() => { localStorage.removeItem(KEY); fx = make(); });
  afterEach(() => localStorage.removeItem(KEY));

  it('sound is OFF by default', () => {
    expect(fx.soundOn).toBeFalse();
  });

  it('remembers the choice in this browser', () => {
    fx.setSound(true);
    expect(localStorage.getItem(KEY)).toBe('1');
    expect(make().soundOn).toBeTrue();            // a new service instance (page reload) reads it back
    fx.setSound(false);
    expect(make().soundOn).toBeFalse();
  });

  it('announces changes through sound$', () => {
    const seen: boolean[] = [];
    const sub = fx.sound$.subscribe(v => seen.push(v));
    fx.setSound(true);
    fx.setSound(false);
    sub.unsubscribe();
    expect(seen).toEqual([false, true, false]);
  });

  it('never creates an audio context while sound is off (no autoplay / permission issues)', () => {
    const Original = (window as any).AudioContext;
    let created = 0;
    (window as any).AudioContext = function () { created++; };
    try {
      fx.play('Love');
      expect(created).toBe(0);
    } finally { (window as any).AudioContext = Original; }
  });

  it('plays only one sound at a time: a new reaction stops the previous one', () => {
    const stops: string[] = [];
    const Original = (window as any).AudioContext;
    const fakeNode = (name: string) => ({
      type: '', frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
      gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {} },
      connect() {}, start() {}, stop() { stops.push(name); }
    });
    let n = 0;
    (window as any).AudioContext = function () {
      return {
        state: 'running', currentTime: 0, destination: {},
        resume: () => Promise.resolve(),
        createOscillator: () => fakeNode('osc' + (n++)),
        createGain: () => fakeNode('gain')
      };
    };
    try {
      fx.setSound(true);
      fx.play('Haha');                 // 4 oscillators
      const stopsBefore = stops.length;
      fx.play('Love');                 // must stop the Haha oscillators first
      expect(stops.length).toBeGreaterThan(stopsBefore);
      expect(stops.filter(s => s.startsWith('osc')).length).toBeGreaterThanOrEqual(4);
    } finally { (window as any).AudioContext = Original; }
  });

  it('turning sound off cuts a sound that is playing', () => {
    expect(() => { fx.setSound(true); fx.setSound(false); }).not.toThrow();
  });

  describe('burst (floating emoji)', () => {
    const origin = () => { const b = document.createElement('button'); document.body.appendChild(b); return b; };
    const floating = () => Array.from(document.body.querySelectorAll('span[aria-hidden="true"]'))
      .filter(e => (e as HTMLElement).style.position === 'fixed');

    afterEach(() => floating().forEach(e => e.remove()));

    it('adds one floating emoji for Like and cleans it up afterwards', async () => {
      const before = new Set(floating());                          // other specs may have left emojis in the page
      fx.burst(origin(), '👍', 'Like');
      const mine = floating().filter(e => !before.has(e));
      expect(mine.length).toBe(1);
      expect(mine[0].textContent).toBe('👍');
      await new Promise(r => setTimeout(r, 1300));
      expect(document.body.contains(mine[0])).toBeFalse();         // removed when its animation finished
    });

    it('adds particles for Love and Haha only', () => {
      const base = new Set(floating());
      fx.burst(origin(), '❤️', 'Love');
      expect(floating().filter(e => !base.has(e)).length).toBe(7);   // main emoji + 6 particles
      const b2 = new Set(floating());
      fx.burst(origin(), '😮', 'Wow');
      expect(floating().filter(e => !b2.has(e)).length).toBe(1);
    });

    it('does nothing without an element or emoji', () => {
      const base = floating().length;
      fx.burst(null, '👍', 'Like');
      fx.burst(origin(), undefined, 'Like');
      expect(floating().length).toBe(base);
    });

    it('does not pile up on rapid clicks', () => {
      const base = new Set(floating());
      const o = origin();
      for (let i = 0; i < 40; i++) { fx.burst(o, '❤️', 'Love'); }
      const added = floating().filter(e => !base.has(e)).length;
      expect(added).toBeLessThan(40 * 7);                          // capped, never an unbounded pile
      expect(added).toBeLessThanOrEqual(24 + 7 + 7);
    });
  });
});
