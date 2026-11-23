import { Component, HostListener, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ChartSeries, ChartSlice } from 'src/app/ComponentSharedUI/mini-chart/mini-chart.component';
import { SharedRoutinesService } from 'src/app/services/Function/shared-routines.service';
import { RecruitmentService } from 'src/app/services/Jobs/recruitment.service';

type Preset = '7' | '30' | '90' | '365' | 'custom';

const STATUS_COLOR: Record<string, string> = { applied_active: '#0a66c2', review: '#d97706', interview: '#7a5af8', approved: '#16a34a', reject: '#dc2626' };
const AI_COLOR: Record<string, string> = { strong: '#16a34a', qualified: '#0a66c2', review: '#d97706', low: '#dc2626' };
const AI_LABEL: Record<string, string> = { strong: 'Strong match', qualified: 'Qualified', review: 'Needs review', low: 'Low match' };

/** Reports / Analytics: how hiring is going across the recruiter's own vacancies. Counts and averages only. */
@Component({
  selector: 'app-reports',
  templateUrl: './reports.component.html',
  styleUrls: ['./reports.component.css']
})
export class ReportsComponent implements OnInit {
  data: any = null;
  isLoading = true;
  error = '';
  isMobile = window.innerWidth < 768;

  preset: Preset = '90';
  from = '';
  to = '';
  transNo = '';

  trend: ChartSeries[] = [];
  pipelineSlices: ChartSlice[] = [];
  aiSlices: ChartSlice[] = [];

  readonly presets: { key: Preset; label: string }[] = [
    { key: '7', label: '7 days' }, { key: '30', label: '30 days' }, { key: '90', label: '90 days' }, { key: '365', label: '12 months' }, { key: 'custom', label: 'Custom' },
  ];

  constructor(private api: RecruitmentService, private router: Router, private routines: SharedRoutinesService) { }

  @HostListener('window:resize') onResize(): void { this.isMobile = window.innerWidth < 768; }

  ngOnInit(): void { this.setPreset('90'); }

  // ------------------------------------------------------------------ range
  private iso(d: Date): string { return d.toISOString().slice(0, 10); }

  setPreset(p: Preset): void {
    this.preset = p;
    if (p !== 'custom') {
      const end = new Date(); const start = new Date(Date.now() - (Number(p) - 1) * 86400000);
      this.from = this.iso(start); this.to = this.iso(end);
      this.load();
    }
  }

  onCustom(): void { if (this.from && this.to && this.from <= this.to) { this.preset = 'custom'; this.load(); } }
  setJob(t: string): void { this.transNo = t; this.load(); }

  get rangeError(): string { return this.from && this.to && this.from > this.to ? 'The start date must be before the end date.' : ''; }

  // ------------------------------------------------------------------ data
  load(): void {
    if (this.rangeError) { return; }
    this.isLoading = true; this.error = '';
    this.api.reports({ from: this.from, to: this.to, transNo: this.transNo }).subscribe({
      next: r => { this.data = r; this.isLoading = false; this.build(); },
      error: e => { this.isLoading = false; this.error = this.api.errorText(e, 'The report could not be loaded.'); }
    });
  }

  private build(): void {
    const d = this.data;
    this.trend = [
      { name: 'Applications', color: '#0a66c2', points: d.trend.applications.map((p: any) => ({ label: p.label, value: p.value })) },
      { name: 'Approved', color: '#16a34a', points: d.trend.approved.map((p: any) => ({ label: p.label, value: p.value })) },
    ];
    this.pipelineSlices = d.pipeline.map((p: any) => ({ label: p.label, value: p.count, color: STATUS_COLOR[p.key] }));
    this.aiSlices = Object.keys(AI_LABEL).map(k => ({ label: AI_LABEL[k], value: d.ai.distribution[k] || 0, color: AI_COLOR[k] }));
  }

  get k(): any { return this.data?.kpis; }
  get isEmpty(): boolean { return !this.isLoading && !!this.data && this.data.kpis.total === 0; }
  get granLabel(): string { return ({ day: 'per day', week: 'per week', month: 'per month' } as any)[this.data?.range?.granularity] || ''; }

  /** each funnel step as a share of everyone who applied, and of the previous step */
  funnelRows(): { label: string; count: number; pctAll: number; pctPrev: number | null; color: string }[] {
    const f = this.data?.funnel || [];
    const total = f[0]?.count || 0;
    const colors = [STATUS_COLOR['applied_active'], STATUS_COLOR['review'], STATUS_COLOR['interview'], STATUS_COLOR['approved']];
    return f.map((s: any, i: number) => ({
      label: s.label, count: s.count, color: colors[i],
      pctAll: total ? Math.round((s.count / total) * 100) : 0,
      pctPrev: i === 0 ? null : (f[i - 1].count ? Math.round((s.count / f[i - 1].count) * 100) : 0)
    }));
  }

  fmt(v: number | null | undefined, suffix = ''): string { return v === null || v === undefined ? '–' : v + suffix; }
  scoreClass(s: number | null): string { return s === null ? 'na' : s >= 85 ? 'strong' : s >= 70 ? 'qualified' : s >= 50 ? 'review' : 'low'; }
  trackKey(_: number, x: any): any { return x.transNo ?? x.key ?? x.label; }

  openJob(transNo: string): void { this.router.navigate(['/' + this.routines.getRole(), 'vacancies', transNo, 'candidates']); }

  // ------------------------------------------------------------------ export / print
  exportCsv(): void {
    const d = this.data; if (!d) { return; }
    const q = (v: any) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const rows: any[][] = [
      ['NEXSUZ recruiting report'], ['Period', d.range.from + ' to ' + d.range.to], [],
      ['Summary'], ['Applicants', d.kpis.total], ['Under review', d.kpis.in_review], ['Interviewing', d.kpis.interviewing], ['Approved', d.kpis.approved], ['Rejected', d.kpis.rejected],
      ['Approval rate %', d.kpis.approval_rate ?? ''], ['Rejection rate %', d.kpis.rejection_rate ?? ''], ['Avg days to first decision', d.kpis.avg_days_to_decision ?? ''],
      ['AI evaluated', d.ai.evaluated], ['Average AI score', d.ai.avg_score ?? ''], [],
      ['Vacancy', 'Reference', 'Status', 'Applicants', 'Under review', 'Interview', 'Approved', 'Rejected', 'Avg AI score', 'Approval rate %'],
      ...d.by_vacancy.map((v: any) => [v.job_name, v.transNo, v.status, v.applicants, v.review, v.interview, v.approved, v.rejected, v.avg_ai_score ?? '', v.approval_rate ?? '']),
    ];
    const blob = new Blob(['\ufeff' + rows.map(r => r.map(q).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'nexsuz-report-' + d.range.from + '-to-' + d.range.to + '.csv';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  print(): void { window.print(); }
}
