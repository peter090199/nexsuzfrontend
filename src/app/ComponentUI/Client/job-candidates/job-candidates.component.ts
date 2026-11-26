import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { PageEvent } from '@angular/material/paginator';
import { ActivatedRoute, Router } from '@angular/router';
import { NotificationsService } from 'src/app/services/Global/notifications.service';
import { SharedRoutinesService } from 'src/app/services/Function/shared-routines.service';
import {
  CandidateList, CandidateRow, PipelineStatus, RECOMMENDATION_LABEL, RecruitmentService, STATUS_META
} from 'src/app/services/Jobs/recruitment.service';
import { CandidateReviewDialogComponent, ReviewTab } from './candidate-review-dialog.component';
import { CandidateDecisionDialogComponent } from './candidate-decision-dialog.component';
import { EvaluationSettingsDialogComponent } from './evaluation-settings-dialog.component';

type SortKey = 'latest' | 'applied' | 'name' | 'score' | 'status';
const REFRESH_MS = 30000;

/** Candidates of ONE vacancy: pipeline summary, search, sort, table / cards, and every recruiter action. */
@Component({
  selector: 'app-job-candidates',
  templateUrl: './job-candidates.component.html',
  styleUrls: ['./job-candidates.component.css']
})
export class JobCandidatesComponent implements OnInit, OnDestroy {
  readonly statuses = STATUS_META;
  readonly labels = RECOMMENDATION_LABEL;
  /** the job column only makes sense when the page lists several vacancies */
  get columns(): string[] { return this.allMode ? ['candidate', 'job', 'applied', 'score', 'status', 'actions'] : ['candidate', 'applied', 'score', 'status', 'actions']; }
  readonly pageSizes = [10, 25, 50];

  transNo = '';
  /** /candidates (no job in the address): everyone who applied to any of my vacancies */
  get allMode(): boolean { return !this.transNo; }
  jobFilter = '';
  isLoading = false;
  loadFailed = '';
  list: CandidateList | null = null;

  filter: PipelineStatus | 'all' = 'all';
  searchKey = '';
  /** every tab starts with what changed last: a new application or a status change */
  sortKey: SortKey = 'latest';
  sortDir: 'asc' | 'desc' = 'desc';
  pageIndex = 0;
  pageSize = 10;
  isMobile = window.innerWidth < 768;
  private deepLink: number | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private dialog: MatDialog,
    private api: RecruitmentService,
    private notify: NotificationsService,
    public sharedService: SharedRoutinesService
  ) { }

  @HostListener('window:resize') onResize(): void { this.isMobile = window.innerWidth < 768; }

  ngOnInit(): void {
    this.route.paramMap.subscribe(p => { this.transNo = p.get('transNo') || ''; this.jobFilter = ''; this.pageIndex = 0; this.load(); });
    const c = Number(this.route.snapshot.queryParamMap.get('candidate'));
    this.deepLink = c > 0 ? c : null;
    this.timer = setInterval(() => this.refreshQuietly(), REFRESH_MS);
  }

  private timer: any;
  private refreshing = false;

  ngOnDestroy(): void { clearInterval(this.timer); }

  /** keeps the tabs current without a progress bar; coming back to the browser tab updates at once */
  @HostListener('document:visibilitychange')
  refreshQuietly(): void {
    // not while hidden, loading, or a recruiter has a dialog open (it reloads when closed)
    if (document.hidden || this.isLoading || this.refreshing || !this.list || this.dialog.openDialogs.length) { return; }
    this.refreshing = true;
    const transNo = this.transNo;
    (this.allMode ? this.api.allCandidates() : this.api.candidates(transNo)).subscribe({
      next: r => {
        this.refreshing = false;
        if (transNo !== this.transNo) { return; }
        this.list = r;
        this.pageIndex = Math.min(this.pageIndex, Math.max(0, Math.ceil(this.filtered.length / this.pageSize) - 1));
      },
      error: () => { this.refreshing = false; }      // keep what is on screen; Refresh reports problems
    });
  }

  /** when the application last changed */
  latest(c: CandidateRow): string { return c.updated_at || c.applied_at; }
  wasUpdated(c: CandidateRow): boolean { return !!c.updated_at && c.updated_at !== c.applied_at; }

  // ------------------------------------------------------------------ data
  get rows(): CandidateRow[] { return this.list?.data || []; }
  get counts(): Record<string, number> { return (this.list?.counts as any) || {}; }
  get total(): number { return this.list?.total || 0; }
  get jobName(): string { return this.allMode ? 'All vacancies' : (this.list?.job.job_name || 'Vacancy'); }

  /** the vacancies that have candidates, for the job filter */
  get jobs(): { transNo: string; name: string }[] {
    const seen = new Map<string, string>();
    this.rows.forEach(r => { if (!seen.has(r.transNo)) { seen.set(r.transNo, r.job_name); } });
    return Array.from(seen, ([transNo, name]) => ({ transNo, name })).sort((a, b) => a.name.localeCompare(b.name));
  }
  get passing(): number { return this.list?.passing_score ?? 70; }
  get provider(): string { return this.list?.ai_provider || 'local'; }

  load(): void {
    this.isLoading = true;
    this.loadFailed = '';
    (this.allMode ? this.api.allCandidates() : this.api.candidates(this.transNo)).subscribe({
      next: r => {
        this.list = r; this.isLoading = false;
        if (this.deepLink) {
          const open = this.deepLink; this.deepLink = null;
          if (r.data.some(x => x.applied_id === open)) { this.review({ applied_id: open } as CandidateRow, 'application'); }
          this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
        }
      },
      error: e => { this.isLoading = false; this.list = null; this.loadFailed = this.api.errorText(e, 'Could not load the candidates.'); }
    });
  }

  // ------------------------------------------------------------------ filter, search, sort, page
  private get order(): Record<string, number> { return { applied_active: 0, review: 1, interview: 2, approved: 3, reject: 4 }; }

  get filtered(): CandidateRow[] {
    const q = this.searchKey.trim().toLowerCase();
    return this.rows.filter(c => (this.filter === 'all' || c.applied_status === this.filter)
      && (!this.jobFilter || c.transNo === this.jobFilter)
      && (!q || [c.fullname, c.email, c.phone_number].join(' ').toLowerCase().includes(q)));
  }

  get sorted(): CandidateRow[] {
    const dir = this.sortDir === 'asc' ? 1 : -1;
    const val = (c: CandidateRow): any => this.sortKey === 'name' ? c.fullname.toLowerCase()
      : this.sortKey === 'score' ? (c.ai_score ?? -1)
      : this.sortKey === 'status' ? this.order[c.applied_status]
      : new Date(this.sortKey === 'latest' ? this.latest(c) : c.applied_at).getTime();
    return [...this.filtered].sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * dir);
  }

  get page(): CandidateRow[] { return this.sorted.slice(this.pageIndex * this.pageSize, (this.pageIndex + 1) * this.pageSize); }

  setFilter(f: PipelineStatus | 'all'): void { this.filter = f; this.pageIndex = 0; }
  setJob(t: string): void { this.jobFilter = t; this.pageIndex = 0; }
  onSearch(): void { this.pageIndex = 0; }
  clearSearch(): void { this.searchKey = ''; this.onSearch(); }
  sortBy(k: SortKey): void { if (this.sortKey === k) { this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc'; } else { this.sortKey = k; this.sortDir = k === 'name' ? 'asc' : 'desc'; } this.pageIndex = 0; }
  onPage(e: PageEvent): void { this.pageIndex = e.pageIndex; this.pageSize = e.pageSize; }
  arrow(k: SortKey): string { return this.sortKey === k ? (this.sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward') : ''; }

  // ------------------------------------------------------------------ look
  label(s: string): string { return STATUS_META.find(m => m.key === s)?.label || s; }
  icon(s: string): string { return STATUS_META.find(m => m.key === s)?.icon || 'help'; }
  initials(name: string): string { return String(name || '?').trim().split(/\s+/).slice(0, 2).map(w => w.charAt(0).toUpperCase()).join('') || '?'; }
  scoreClass(s: number | null): string { return s === null ? 'na' : s >= 90 ? 'excellent' : s >= 80 ? 'strong' : s >= 70 ? 'good' : s >= 60 ? 'moderate' : 'low'; }
  trackById(_: number, c: CandidateRow): number { return c.applied_id; }

  allowed(c: CandidateRow, to: PipelineStatus): boolean { return (this.list?.transitions[c.applied_status] || []).includes(to); }
  open(c: CandidateRow): boolean { return c.applied_status !== 'approved' && c.applied_status !== 'reject'; }

  // ------------------------------------------------------------------ actions
  back(): void { this.router.navigate(['/' + this.sharedService.getRole(), this.allMode ? 'home' : 'vacancies']); }

  /** open one vacancy's own candidates page */
  openJob(transNo: string): void { this.router.navigate(['/' + this.sharedService.getRole(), 'vacancies', transNo, 'candidates']); }

  review(c: CandidateRow, tab: ReviewTab, schedule = false): void {
    this.dialog.open(CandidateReviewDialogComponent, {
      width: '1040px', maxWidth: '100vw', height: '90vh', maxHeight: '100dvh', panelClass: 'cand-dialog', autoFocus: false,
      data: { appliedId: c.applied_id, tab, schedule }
    }).afterClosed().subscribe(() => this.load());
  }

  decide(c: CandidateRow, to: PipelineStatus): void {
    this.dialog.open(CandidateDecisionDialogComponent, {
      width: '580px', maxWidth: '96vw', autoFocus: false,
      data: { appliedId: c.applied_id, fullname: c.fullname, jobName: c.job_name, from: c.applied_status, to, aiScore: c.ai_score, aiRecommendation: c.ai_recommendation }
    }).afterClosed().subscribe(ok => { if (ok) { this.load(); } });
  }

  /** permanent: asks first, then removes the application, answers, CV, notes, evaluations, interviews and history */
  remove(c: CandidateRow): void {
    this.notify.popupWarning(
      `Delete ${c.fullname}?`,
      'This permanently deletes their application, CV file, screening answers, AI evaluations, interviews, notes and history for this job. It cannot be undone. The person can apply again.'
    ).then(r => {
      if (!r.value) { return; }
      this.api.deleteApplication(c.applied_id).subscribe({
        next: res => { this.notify.toastrSuccess(res.message || 'Candidate deleted.'); this.load(); },
        error: e => this.notify.toastrError(this.api.errorText(e, 'The candidate could not be deleted.'))
      });
    });
  }

  settings(): void {
    this.dialog.open(EvaluationSettingsDialogComponent, { width: '640px', maxWidth: '96vw', autoFocus: false, data: { transNo: this.transNo, jobName: this.jobName } })
      .afterClosed().subscribe(ok => { if (ok) { this.load(); } });
  }
}
