import { Component, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SubReport, Subscriber, SubscriptionApiService } from '../shared/subscription-api.service';

@Component({
  selector: 'app-subscription-reports',
  templateUrl: './subscription-reports.component.html',
  styleUrls: ['./subscription-reports.component.scss']
})
export class SubscriptionReportsComponent implements OnInit {
  readonly palette = ['#0a66c2', '#6aa7e6', '#1b8a4b', '#9db4d1', '#e08a00'];
  report?: SubReport;
  expiringDays = 30;
  loading = true;
  exporting = false;
  error = '';

  constructor(private api: SubscriptionApiService, private snack: MatSnackBar) { }

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true; this.error = '';
    this.api.report(this.expiringDays).subscribe({
      next: r => { this.report = r; this.loading = false; },
      error: err => { this.loading = false; this.error = SubscriptionApiService.errorMessage(err, 'Could not load the report.'); },
    });
  }

  get t() { return this.report?.totals || { subscribers: 0, paid: 0, free: 0, monthly_revenue: 0, all_users: 0 }; }
  get paidPct(): number { return this.t.subscribers ? Math.round((this.t.paid / this.t.subscribers) * 100) : 0; }
  get donut(): string { return `conic-gradient(#0a66c2 0 ${this.paidPct}%, #cfe0f4 ${this.paidPct}% 100%)`; }
  get growthMax(): number { return Math.max(1, ...(this.report?.growth || []).map(g => g.value)); }

  distribution() {
    const rows = this.report?.distribution || [];
    const total = rows.reduce((n, r) => n + r.count, 0);
    return rows.map((r, i) => ({ ...r, pct: total ? Math.round((r.count / total) * 100) : 0, color: this.palette[i % this.palette.length] }));
  }
  revenue() {
    const rows = this.report?.revenue || [];
    const max = Math.max(1, ...rows.map(r => r.monthly));
    return rows.map((r, i) => ({ ...r, pct: Math.round((r.monthly / max) * 100), color: this.palette[i % this.palette.length] }));
  }
  statusTotal(): number { return (this.report?.status || []).reduce((n, s) => n + s.count, 0); }
  statusClass(s: string): string { return s === 'active' ? 'ok' : s === 'expired' ? 'bad' : s === 'none' ? 'muted' : 'warn'; }
  statusLabel(s: string): string { return s === 'none' ? 'No subscription' : s.charAt(0).toUpperCase() + s.slice(1); }

  /** Export every user's subscription: pages through the API (100 per page) and builds the CSV in the browser. */
  exportCsv(): void {
    this.exporting = true;
    const all: Subscriber[] = [];
    const next = (page: number) => this.api.subscribers({ page, per_page: 100 }).subscribe({
      next: r => {
        all.push(...r.data);
        if (page < r.meta.last_page) { next(page + 1); } else { this.download(all); this.exporting = false; }
      },
      error: err => { this.exporting = false; this.snack.open(SubscriptionApiService.errorMessage(err), 'OK', { duration: 4000 }); },
    });
    next(1);
  }

  private download(rows: Subscriber[]): void {
    const head = ['Name', 'Email', 'Plan', 'Status', 'Start', 'End', 'Payment'];
    const lines = [head, ...rows.map(s => [s.name, s.email, s.plan || '', s.status, s.start || '', s.end || '', s.payment_method || ''])]
      .map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(','));
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'subscription-report.csv'; a.click();
    URL.revokeObjectURL(url);
  }
}
