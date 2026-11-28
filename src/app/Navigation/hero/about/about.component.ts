import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { PublicStats, PublicStatsService } from './public-stats.service';

/** One floating stat card in the About image. */
interface StatCard {
  key: keyof PublicStats;
  icon: string;
  one: string;      // label for exactly 1
  many: string;     // label for anything else
  target: number | null;   // real total from the API (null until it arrives, or if it cannot be loaded)
  shown: string;    // what the card shows right now (counts up to the target)
}

@Component({
  selector: 'app-about',
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.css']
})
export class AboutComponent implements OnInit, AfterViewInit, OnDestroy {

  stats: StatCard[] = [
    { key: 'professionals', icon: 'groups', one: 'Professional', many: 'Professionals', target: null, shown: '—' },
    { key: 'jobs', icon: 'work', one: 'Job Posted', many: 'Jobs Posted', target: null, shown: '—' },
    { key: 'companies', icon: 'verified', one: 'Company', many: 'Companies', target: null, shown: '—' },
  ];

  private revealObserver?: IntersectionObserver;
  private countObserver?: IntersectionObserver;
  private sub?: Subscription;
  private frame = 0;
  private loaded = false;
  private seen = false;
  private counted = false;

  constructor(private host: ElementRef<HTMLElement>, private api: PublicStatsService, private zone: NgZone) { }

  ngOnInit(): void {
    this.sub = this.api.get().subscribe({
      next: r => {
        this.stats.forEach(s => s.target = Math.max(0, Number(r?.data?.[s.key]) || 0));
        this.loaded = true;
        this.maybeCount();
      },
      error: () => { /* totals unavailable: the cards keep showing "—" */ }
    });
  }

  ngAfterViewInit(): void {
    if (typeof IntersectionObserver === 'undefined') {
      this.host.nativeElement.querySelectorAll('.reveal').forEach(el => el.classList.add('active'));
      this.seen = true;
      this.maybeCount();
      return;
    }

    // slide the two columns in when they scroll into view
    this.revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('active');
          this.revealObserver?.unobserve(entry.target);
        }
      });
    }, { threshold: 0.2 });
    this.host.nativeElement.querySelectorAll('.reveal').forEach(item => this.revealObserver!.observe(item));

    // count the totals up the first time the cards are on screen
    const cards = this.host.nativeElement.querySelector('.hero-image');
    if (!cards) { this.seen = true; this.maybeCount(); return; }
    this.countObserver = new IntersectionObserver(entries => {
      if (!entries.some(e => e.isIntersecting)) { return; }
      this.countObserver?.disconnect();
      this.zone.run(() => { this.seen = true; this.maybeCount(); });
    }, { threshold: 0.4 });
    this.countObserver.observe(cards);
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.revealObserver?.disconnect();
    this.countObserver?.disconnect();
    if (this.frame) { cancelAnimationFrame(this.frame); }
  }

  label(s: StatCard): string { return s.target === 1 ? s.one : s.many; }

  /** exact below 1,000 ("2"), shortened above it ("25.3K+", "1.2M+") */
  static format(n: number): string {
    if (n < 1000) { return String(n); }
    const [div, unit] = n >= 1_000_000 ? [1_000_000, 'M'] : [1000, 'K'];
    const v = Math.floor((n / div) * 10) / 10;
    return `${Number.isInteger(v) ? v : v.toFixed(1)}${unit}+`;
  }

  /** runs once both the totals have arrived and the cards have been seen */
  private maybeCount(): void {
    if (!this.loaded || !this.seen || this.counted) { return; }
    this.counted = true;

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      this.stats.forEach(s => s.shown = AboutComponent.format(s.target ?? 0));
      return;
    }

    const duration = 1600;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);   // ease-out cubic
      this.zone.run(() => this.stats.forEach(s => s.shown = AboutComponent.format(Math.round((s.target ?? 0) * eased))));
      this.frame = t < 1 ? requestAnimationFrame(step) : 0;
    };
    this.frame = requestAnimationFrame(step);
  }
}
