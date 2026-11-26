import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { NotificationsService } from 'src/app/services/Global/notifications.service';
import {
  Evaluation, PipelineStatus, RECOMMENDATION_LABEL, RecruitmentService, STATUS_META
} from 'src/app/services/Jobs/recruitment.service';
import { CandidateDecisionDialogComponent } from './candidate-decision-dialog.component';
import { EvaluationSettingsDialogComponent } from './evaluation-settings-dialog.component';

export type ReviewTab = 'application' | 'cv' | 'ai' | 'answers' | 'interview' | 'notes' | 'history';
const TABS: ReviewTab[] = ['application', 'cv', 'ai', 'answers', 'interview', 'notes', 'history'];

/**
 * One dialog for everything a recruiter does with a candidate: application, CV, AI evaluation, screening answers,
 * interview, notes and history. Opens on the tab the recruiter asked for.
 */
@Component({
  selector: 'app-candidate-review-dialog',
  templateUrl: './candidate-review-dialog.component.html',
  styleUrls: ['./candidate-review-dialog.component.css']
})
export class CandidateReviewDialogComponent implements OnInit, OnDestroy {
  readonly labels = RECOMMENDATION_LABEL;
  readonly statusMeta = STATUS_META;
  readonly tabs = TABS;

  d: any = null;                 // application detail from the API
  loading = true;
  loadError = '';
  index = 0;
  changed = false;               // something was changed: the list behind the dialog must refresh

  // CV
  cvState: 'idle' | 'loading' | 'ready' | 'none' | 'missing' | 'unsupported' | 'error' = 'idle';
  cvMessage = '';
  cvUrl: SafeResourceUrl | null = null;
  private cvObjectUrl = '';
  cvView: 'document' | 'details' = 'document';

  // AI
  evals: Evaluation[] = [];
  evalsLoaded = false;
  evalIndex = 0;
  overrides: any[] = [];
  evaluating = false;
  edits: Record<number, { score: number | null; reason: string }> = {};
  overall = { score: null as number | null, reason: '' };
  savingOverrides = false;
  overrideError = '';

  // interview
  showSchedule = false;
  sched: any = { date: '', time: '10:00', duration_min: 30, type: 'online', meeting_link: '', location: '', interviewer_name: '', notify: true, message: '' };
  schedError = '';
  scheduling = false;
  feedback: Record<number, any> = {};

  // notes
  note = '';
  savingNote = false;

  constructor(
    public ref: MatDialogRef<CandidateReviewDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { appliedId: number; tab?: ReviewTab; schedule?: boolean },
    private api: RecruitmentService,
    private dialog: MatDialog,
    private notice: NotificationsService,
    private san: DomSanitizer
  ) { }

  ngOnInit(): void {
    this.index = Math.max(0, TABS.indexOf(this.data.tab || 'application'));
    this.showSchedule = !!this.data.schedule;
    this.load(true);   // the page behind refreshes its list whenever this dialog closes
  }

  ngOnDestroy(): void { this.revokeCv(); }

  get tab(): ReviewTab { return TABS[this.index]; }
  get a(): any { return this.d?.application; }
  get cv(): any { return this.d?.cv; }
  get status(): PipelineStatus { return this.a?.status; }
  get evalNow(): Evaluation | null { return this.evals[this.evalIndex] || this.d?.evaluation || null; }
  get isLatest(): boolean { return this.evalIndex === 0; }
  get allowed(): PipelineStatus[] { return this.d?.transitions || []; }
  get hasCv(): boolean { return (this.d?.resumes || []).length > 0; }

  // ------------------------------------------------------------------ loading
  load(first = false): void {
    this.loading = first;
    this.api.application(this.data.appliedId).subscribe({
      next: r => {
        this.d = r;
        this.loading = false;
        this.fillEdits();
        this.onTab();
      },
      error: e => { this.loading = false; this.loadError = this.api.errorText(e, 'Could not load this application.'); }
    });
  }

  onTabChange(i: number): void { this.index = i; this.onTab(); }

  private onTab(): void {
    if (this.tab === 'cv' && this.cvState === 'idle') { this.loadCv(); }
    if ((this.tab === 'ai' || this.tab === 'answers' || this.tab === 'history') && !this.evalsLoaded) { this.loadEvals(); }
  }

  // ------------------------------------------------------------------ CV
  private revokeCv(): void { if (this.cvObjectUrl) { URL.revokeObjectURL(this.cvObjectUrl); this.cvObjectUrl = ''; } }

  loadCv(): void {
    if (!this.hasCv) { this.cvState = 'none'; this.cvMessage = 'This applicant did not upload a CV file. Their profile details are shown instead.'; return; }
    this.cvState = 'loading';
    const rid = this.d.resumes[this.d.resumes.length - 1]?.id;
    this.api.resume(this.data.appliedId, rid).subscribe({
      next: blob => {
        this.revokeCv();
        this.cvObjectUrl = URL.createObjectURL(blob);
        this.cvUrl = this.san.bypassSecurityTrustResourceUrl(this.cvObjectUrl);
        this.cvState = 'ready';
      },
      error: async e => {
        let msg = '';
        try { msg = JSON.parse(await (e.error as Blob).text()).message; } catch { /* not JSON */ }
        this.cvState = e.status === 404 ? 'missing' : e.status === 415 ? 'unsupported' : 'error';
        this.cvMessage = msg || (this.cvState === 'missing' ? 'The CV file could not be found. It may have been removed.' : 'The CV could not be opened.');
      }
    });
  }

  downloadCv(): void {
    const rid = this.d?.resumes?.[this.d.resumes.length - 1]?.id;
    this.api.resume(this.data.appliedId, rid, true).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${(this.a?.fullname || 'candidate').replace(/[^\w .-]/g, '')} CV.pdf`;
        document.body.appendChild(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      },
      error: e => this.notice.toastrError(this.cvMessage || 'The CV could not be downloaded.')
    });
  }

  printCv(): void {
    const frame = document.getElementById('cv-frame') as HTMLIFrameElement | null;
    try { frame?.contentWindow?.focus(); frame?.contentWindow?.print(); } catch { this.notice.toastrWarning('Open the CV in a new tab and print it from there.'); }
  }

  openCvTab(): void { if (this.cvObjectUrl) { window.open(this.cvObjectUrl, '_blank', 'noopener'); } }

  /** shares a link to this review screen (recruiters only: the CV itself is never put in the link) */
  async shareCv(): Promise<void> {
    const link = `${location.origin}${location.pathname}?candidate=${this.data.appliedId}`;
    const text = `Candidate review: ${this.a?.fullname} for ${this.a?.job_name}`;
    try {
      if ((navigator as any).share) { await (navigator as any).share({ title: text, text, url: link }); return; }
      await navigator.clipboard.writeText(link);
      this.notice.toastrSuccess('Link copied. Only people who may review this job can open it.');
    } catch { /* cancelled */ }
  }

  // ------------------------------------------------------------------ AI evaluation
  loadEvals(): void {
    this.api.evaluations(this.data.appliedId).subscribe({
      next: r => { this.evals = r.data; this.overrides = r.overrides; this.evalsLoaded = true; this.fillEdits(); },
      error: () => { this.evalsLoaded = true; }
    });
  }

  runEvaluation(): void {
    this.evaluating = true;
    this.api.evaluate(this.data.appliedId).subscribe({
      next: r => {
        this.evaluating = false;
        this.changed = true;
        this.evals = [r.data, ...this.evals];
        this.evalIndex = 0;
        this.evalsLoaded = true;
        this.fillEdits();
        this.notice.toastrSuccess('Evaluation complete. Review it before deciding.');
        if (this.tab !== 'ai' && this.tab !== 'answers') { this.index = TABS.indexOf('ai'); }
      },
      error: e => { this.evaluating = false; this.notice.toastrError(this.api.errorText(e, 'The evaluation could not be completed.')); }
    });
  }

  selectEval(i: number): void { this.evalIndex = i; this.fillEdits(); }

  private fillEdits(): void {
    this.edits = {}; this.overall = { score: null, reason: '' }; this.overrideError = '';
    (this.evalNow?.answers || []).forEach(x => { this.edits[x.question_id] = { score: null, reason: '' }; });
  }

  catEntries(): { key: string; label: string; score: number | null; evidence: string; weight: number }[] {
    const e = this.evalNow;
    if (!e) { return []; }
    const names: Record<string, string> = { skills: 'Required skills', experience: 'Relevant experience', education: 'Education', requirements: 'Job requirements', certifications: 'Certifications', answers: 'Screening answers', competencies: 'Job competencies' };
    // answers / competencies only exist on runs made before the five criteria
    return Object.keys(names).filter(k => e.categories[k]).map(k => ({ key: k, label: names[k], score: e.categories[k]?.score ?? null, evidence: e.categories[k]?.evidence || '', weight: e.weights?.[k] ?? 0 }));
  }

  answerFor(qid: number) { return this.evalNow?.answers.find(x => x.question_id === qid) || null; }

  get pendingChanges(): { question_id: number | null; score: number; reason: string }[] {
    const out: { question_id: number | null; score: number; reason: string }[] = [];
    Object.keys(this.edits).forEach(k => {
      const v = this.edits[+k];
      if (v.score !== null && v.score !== undefined && `${v.score}` !== '') { out.push({ question_id: +k, score: +v.score, reason: v.reason.trim() }); }
    });
    if (this.overall.score !== null && `${this.overall.score}` !== '') { out.push({ question_id: null, score: +this.overall.score, reason: this.overall.reason.trim() }); }
    return out;
  }

  saveOverrides(): void {
    const changes = this.pendingChanges;
    const e = this.evalNow;
    if (!e || !changes.length) { return; }
    if (changes.some(c => c.reason.length < 5)) { this.overrideError = 'Say why you are changing each score (at least 5 characters).'; return; }
    if (changes.some(c => c.score < 0 || c.score > 100)) { this.overrideError = 'Scores are from 0 to 100.'; return; }
    this.savingOverrides = true;
    this.overrideError = '';
    this.api.override(e.id, changes).subscribe({
      next: r => {
        this.savingOverrides = false; this.changed = true;
        this.evals[this.evalIndex] = r.data;
        this.notice.toastrSuccess(r.message || 'Scores updated.');
        this.loadEvals();
      },
      error: err => { this.savingOverrides = false; this.overrideError = this.api.errorText(err, 'Could not save the scores.'); }
    });
  }

  // ------------------------------------------------------------------ decisions
  decide(to: PipelineStatus): void {
    const e = this.evalNow;
    this.dialog.open(CandidateDecisionDialogComponent, {
      width: '580px', maxWidth: '96vw', autoFocus: false,
      data: { appliedId: this.a.applied_id, fullname: this.a.fullname, jobName: this.a.job_name, from: this.status, to, aiScore: e ? e.score : null, aiRecommendation: e ? e.recommendation : null }
    }).afterClosed().subscribe(ok => { if (ok) { this.changed = true; this.load(); } });
  }

  label(s: string): string { return this.statusMeta.find(m => m.key === s)?.label || s; }
  icon(s: string): string { return this.statusMeta.find(m => m.key === s)?.icon || 'help'; }

  openSettings(): void {
    this.dialog.open(EvaluationSettingsDialogComponent, { width: '640px', maxWidth: '96vw', autoFocus: false, data: { transNo: this.a.transNo, jobName: this.a.job_name } })
      .afterClosed().subscribe(ok => { if (ok) { this.notice.toastrInfo('Run the evaluation again to use the new settings.'); } });
  }

  // ------------------------------------------------------------------ interview
  openSchedule(): void {
    this.showSchedule = true;
    if (!this.sched.date) { const t = new Date(Date.now() + 86400000); this.sched.date = t.toISOString().slice(0, 10); }
    this.previewSchedule();
  }

  previewSchedule(): void {
    if (!this.sched.notify) { return; }
    this.api.previewNotification(this.a.applied_id, 'interview').subscribe({ next: r => { if (!this.sched.message) { this.sched.message = r.message.body; } } });
  }

  submitSchedule(): void {
    const s = this.sched;
    if (!s.date || !s.time) { this.schedError = 'Choose the interview date and time.'; return; }
    if (!s.interviewer_name.trim()) { this.schedError = 'Say who will interview the candidate.'; return; }
    this.scheduling = true;
    this.schedError = '';
    this.api.schedule(this.a.applied_id, {
      scheduled_at: `${s.date} ${s.time}`, duration_min: s.duration_min, type: s.type,
      meeting_link: s.type === 'online' ? s.meeting_link : null, location: s.type === 'onsite' ? s.location : null,
      interviewer_name: s.interviewer_name, notify: s.notify, message: s.notify && s.message ? s.message : undefined
    }).subscribe({
      next: r => { this.scheduling = false; this.changed = true; this.showSchedule = false; this.sched.message = ''; this.notice.toastrSuccess(r.message); this.load(); },
      error: e => { this.scheduling = false; this.schedError = this.api.errorText(e, 'Could not schedule the interview.'); }
    });
  }

  fb(i: any): any { return this.feedback[i.id] || (this.feedback[i.id] = { feedback: i.feedback || '', score: i.score, result: i.result || '', notes: i.notes || '', error: '', saving: false }); }

  saveFeedback(i: any, status?: string): void {
    const f = this.fb(i);
    f.saving = true; f.error = '';
    this.api.updateInterview(i.id, {
      status: status || undefined, feedback: f.feedback || undefined, score: f.score !== null && f.score !== '' ? +f.score : undefined,
      result: f.result || undefined, notes: f.notes || undefined
    }).subscribe({
      next: r => { f.saving = false; this.changed = true; this.notice.toastrSuccess(r.message); delete this.feedback[i.id]; this.load(); },
      error: e => { f.saving = false; f.error = this.api.errorText(e, 'Could not save the feedback.'); }
    });
  }

  // ------------------------------------------------------------------ notes
  addNote(): void {
    if (this.note.trim().length < 2) { return; }
    this.savingNote = true;
    this.api.addNote(this.a.applied_id, this.note.trim()).subscribe({
      next: () => { this.savingNote = false; this.note = ''; this.changed = true; this.load(); },
      error: e => { this.savingNote = false; this.notice.toastrError(this.api.errorText(e, 'Could not save the note.')); }
    });
  }

  // ------------------------------------------------------------------ small helpers
  initials(n: string): string { return String(n || '?').trim().split(/\s+/).slice(0, 2).map(w => w.charAt(0).toUpperCase()).join(''); }
  scoreClass(s: number | null | undefined): string { return s === null || s === undefined ? 'na' : s >= 90 ? 'excellent' : s >= 80 ? 'strong' : s >= 70 ? 'good' : s >= 60 ? 'moderate' : 'low'; }
  trackIdx(i: number): number { return i; }
  trackKey(_: number, x: { key: string }): string { return x.key; }
  trackId(_: number, x: any): any { return x.id ?? x.question_id; }
  sourceLabel(s: string): string { return ({ recruiter: 'Recruiter', auto_screen: 'Automatic screening', applicant: 'Applicant', system: 'System' } as any)[s] || s; }
  close(): void { this.ref.close(this.changed); }
}
