import { FEATURE } from 'src/app/services/AccountPlan/feature-access.map';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MatTableDataSource } from '@angular/material/table';
import { Subscription } from 'rxjs';
import { JobListService } from 'src/app/services/Jobs/job-list.service';
import { SharedRoutinesService } from 'src/app/services/Function/shared-routines.service';
import { ChartSeries } from 'src/app/ComponentSharedUI/mini-chart/mini-chart.component';

interface StatCard { label: string; icon: string; value: number; sub: string; route: string; }

/**
 * Recruiter dashboard (DEF-CLIENT). Everything comes from GET getClientDashboard, which only ever returns the
 * signed-in account's own job listings and the applications made to them. No sample data.
 */
@Component({
  selector: 'app-client-dashboard',
  templateUrl: './client-dashboard.component.html',
  styleUrls: ['./client-dashboard.component.css']
})
export class ClientDashboardComponent implements OnInit, OnDestroy {
  /** feature codes for the template */
  readonly FEATURE = FEATURE;

  role = '';
  loading = true;        // first load: skeletons
  refreshing = false;    // later loads keep the old data visible
  error = false;
  data: any = null;
  lastUpdated: Date | null = null;

  cards: StatCard[] = [];
  trendSeries: ChartSeries[] = [];
  vacancies = new MatTableDataSource<any>([]);
  displayedColumns = ['job', 'location', 'applicants', 'status', 'actions'];
  broken: Record<string, boolean> = {};

  private sub?: Subscription;

  constructor(
    private jobs: JobListService,
    private router: Router,
    private shared: SharedRoutinesService
  ) { }

  ngOnInit(): void {
    this.role = this.shared.getRole();
    this.load();
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  load(): void {
    this.sub?.unsubscribe();
    this.error = false;
    this.data ? (this.refreshing = true) : (this.loading = true);

    this.sub = this.jobs.getClientDashboard().subscribe({
      next: (res: any) => {
        this.loading = false;
        this.refreshing = false;
        if (!res?.success) { this.error = true; return; }
        this.data = res;
        this.lastUpdated = new Date();
        this.build();
      },
      error: () => { this.loading = false; this.refreshing = false; this.error = true; }
    });
  }

  private build(): void {
    const t = this.data.totals;

    this.cards = [
      { label: 'Active vacancies', icon: 'work_outline', value: t.vacancies, sub: `${t.vacancies_all} listing${t.vacancies_all === 1 ? '' : 's'} in total`, route: 'vacancies' },
      { label: 'Total applicants', icon: 'groups', value: t.applicants, sub: 'Across all your listings', route: 'candidates' },
      { label: 'In review', icon: 'pending_actions', value: t.in_review, sub: 'Being reviewed', route: 'candidates' },
      { label: 'Interviews', icon: 'event_available', value: t.interviews, sub: 'Invited to interview', route: 'interviews' },
      { label: 'Approved', icon: 'check_circle', value: t.approved, sub: 'Approved applicants', route: 'candidates' },
    ];

    this.trendSeries = [{
      name: 'Applications', color: '#0a66c2',
      points: this.data.trend.map((p: any) => ({ label: p.label, value: p.count }))
    }];

    this.vacancies.data = this.data.vacancies;
  }

  // ------------------------------------------------------------------ template helpers
  get firstName(): string {
    return String(this.data?.user?.fullname || '').trim().split(/\s+/)[0] || 'there';
  }

  get totalPipeline(): number {
    return (this.data?.pipeline || []).reduce((n: number, s: any) => n + s.count, 0);
  }

  pct(count: number): number {
    return this.totalPipeline ? Math.round((count / this.totalPipeline) * 100) : 0;
  }

  go(route: string): void { this.router.navigate(['/' + this.role, route]); }

  openProfile(code: any): void {
    if (code) { this.router.navigate(['/' + this.role, 'profile', code]); }
  }

  initials(name: string): string { return this.shared.getInitials(name || ''); }

  statusLabel(s: string): string {
    const map: Record<string, string> = { applied_active: 'Applied', review: 'In review', interview: 'Interview', approved: 'Approved', reject: 'Rejected' };
    return map[s] || (s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/[_-]+/g, ' ') : 'Applied');
  }

  /** CSS class used to colour a status chip */
  statusClass(s: string): string {
    return ({ applied_active: 'st-applied', review: 'st-review', interview: 'st-interview', approved: 'st-approved', reject: 'st-reject' } as any)[s] || 'st-applied';
  }

  trackIdx(i: number): number { return i; }
}
