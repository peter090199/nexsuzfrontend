import { Component, Input, OnChanges } from '@angular/core';

export interface ChartPoint { label: string; value: number; }
export interface ChartSeries { name: string; color: string; points: ChartPoint[]; }
export interface ChartSlice { label: string; value: number; color: string; }

interface Tip { left: number; top: number; title: string; rows: { name: string; color: string; value: number; extra?: string }[]; }

/**
 * Small dependency-free SVG charts for the dashboards.
 *
 *   <app-mini-chart type="bar"   [series]="[{ name, color, points }]"></app-mini-chart>
 *   <app-mini-chart type="line"  [series]="[a, b]"></app-mini-chart>      (any number of series)
 *   <app-mini-chart type="donut" [slices]="[{ label, value, color }]"></app-mini-chart>
 *
 * Hover (or touch) shows a tooltip. The SVG scales to its container, so it works from desktop to phone.
 */
@Component({
  selector: 'app-mini-chart',
  templateUrl: './mini-chart.component.html',
  styleUrls: ['./mini-chart.component.css']
})
export class MiniChartComponent implements OnChanges {
  @Input() type: 'line' | 'bar' | 'donut' = 'line';
  @Input() series: ChartSeries[] = [];
  @Input() slices: ChartSlice[] = [];
  @Input() emptyText = 'No data for this period';
  @Input() ariaLabel = 'Chart';

  // plot geometry (viewBox units)
  readonly W = 600;
  readonly H = 240;
  readonly pad = { l: 38, r: 14, t: 14, b: 28 };

  yTicks: { y: number; label: string }[] = [];
  xLabels: { x: number; label: string }[] = [];
  lines: { name: string; color: string; d: string; dots: { x: number; y: number }[] }[] = [];
  bars: { x: number; y: number; w: number; h: number; color: string }[] = [];
  guideX: number | null = null;
  hoverIndex: number | null = null;
  tip: Tip | null = null;
  isEmpty = true;

  // donut
  readonly R = 56;
  readonly C = 2 * Math.PI * 56;
  arcs: { color: string; dash: string; offset: number; label: string; value: number; pct: number }[] = [];
  total = 0;
  hoverSlice: number | null = null;

  private count = 0;
  private slot = 0;

  ngOnChanges(): void {
    this.tip = null; this.hoverIndex = null; this.hoverSlice = null; this.guideX = null;
    this.type === 'donut' ? this.buildDonut() : this.buildXY();
  }

  // ------------------------------------------------------------------ line / bar
  private buildXY(): void {
    const all = this.series.flatMap(s => s.points.map(p => p.value));
    this.count = this.series[0]?.points.length || 0;
    this.isEmpty = !this.count || !all.some(v => v > 0);
    if (this.isEmpty) { this.yTicks = []; this.xLabels = []; this.lines = []; this.bars = []; return; }

    const max = this.niceMax(Math.max(...all));
    const { l, r, t, b } = this.pad;
    const pw = this.W - l - r;
    const ph = this.H - t - b;
    const y = (v: number) => t + ph - (v / max) * ph;

    this.yTicks = [0, 1, 2, 3, 4].map(i => ({ y: y((max / 4) * i), label: this.fmt((max / 4) * i) }));

    this.slot = pw / this.count;
    const xAt = (i: number) => this.type === 'bar'
      ? l + this.slot * i + this.slot / 2
      : (this.count === 1 ? l + pw / 2 : l + (pw / (this.count - 1)) * i);

    // at most 6 evenly spaced labels on the x axis
    const every = Math.max(1, Math.ceil(this.count / 6));
    this.xLabels = (this.series[0]?.points || [])
      .map((p, i) => ({ x: xAt(i), label: p.label.replace('Week of ', ''), i }))
      .filter(p => p.i % every === 0 || p.i === this.count - 1)
      .map(p => ({ x: p.x, label: p.label }));

    if (this.type === 'bar') {
      const n = this.series.length;
      const group = Math.min(this.slot * 0.72, 38 * n);
      const bw = group / n;
      this.bars = [];
      this.series.forEach((s, si) => s.points.forEach((p, i) => {
        const h = (p.value / max) * ph;
        this.bars.push({ x: xAt(i) - group / 2 + si * bw + 1, y: t + ph - h, w: Math.max(2, bw - 2), h, color: s.color });
      }));
      this.lines = [];
    } else {
      this.bars = [];
      this.lines = this.series.map(s => ({
        name: s.name, color: s.color,
        d: s.points.map((p, i) => `${i ? 'L' : 'M'}${xAt(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' '),
        dots: s.points.map((p, i) => ({ x: xAt(i), y: y(p.value) }))
      }));
    }
  }

  onMove(ev: PointerEvent, host: HTMLElement): void {
    if (this.isEmpty || !this.count) { return; }
    const rect = host.getBoundingClientRect();
    const vx = ((ev.clientX - rect.left) / rect.width) * this.W;          // pointer in viewBox units
    const { l, r } = this.pad;
    const pw = this.W - l - r;

    let i = this.type === 'bar'
      ? Math.floor((vx - l) / this.slot)
      : Math.round(((vx - l) / pw) * (this.count - 1));
    i = Math.max(0, Math.min(this.count - 1, i));

    this.hoverIndex = i;
    this.guideX = this.type === 'bar'
      ? l + this.slot * i + this.slot / 2
      : (this.count === 1 ? l + pw / 2 : l + (pw / (this.count - 1)) * i);

    const left = (this.guideX / this.W) * 100;
    this.tip = {
      left: Math.min(88, Math.max(12, left)),
      top: 6,
      title: this.series[0].points[i].label,
      rows: this.series.map(s => ({ name: s.name, color: s.color, value: s.points[i].value }))
    };
  }

  onLeave(): void { this.tip = null; this.hoverIndex = null; this.guideX = null; this.hoverSlice = null; }

  // ------------------------------------------------------------------ donut
  private buildDonut(): void {
    const items = this.slices.filter(s => s.value > 0);
    this.total = items.reduce((a, s) => a + s.value, 0);
    this.isEmpty = this.total === 0;

    let acc = 0;
    this.arcs = items.map(s => {
      const len = (s.value / this.total) * this.C;
      const arc = { color: s.color, dash: `${len} ${this.C - len}`, offset: -acc, label: s.label, value: s.value, pct: Math.round((s.value / this.total) * 100) };
      acc += len;
      return arc;
    });
  }

  onSlice(i: number, ev: PointerEvent, host: HTMLElement): void {
    this.hoverSlice = i;
    const rect = host.getBoundingClientRect();
    const a = this.arcs[i];
    this.tip = {
      left: Math.min(80, Math.max(20, ((ev.clientX - rect.left) / rect.width) * 100)),
      top: Math.max(0, ev.clientY - rect.top - 44),
      title: a.label,
      rows: [{ name: 'Accounts', color: a.color, value: a.value, extra: `${a.pct}%` }]
    };
  }

  // ------------------------------------------------------------------ helpers
  /** Axis max so that the four steps are whole numbers (these charts count things): 3 -> 4, 6 -> 8, 13 -> 20, 130 -> 200 */
  private niceMax(v: number): number {
    const need = Math.max(1, Math.ceil(v / 4));
    const p = Math.pow(10, Math.floor(Math.log10(need)));
    const n = need / p;
    const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
    return step * 4;
  }

  private fmt(v: number): string {
    return Number.isInteger(v) ? String(v) : v.toFixed(1);
  }

  trackIdx(i: number): number { return i; }
}
