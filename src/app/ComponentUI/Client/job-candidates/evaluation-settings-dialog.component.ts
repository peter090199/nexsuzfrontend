import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NotificationsService } from 'src/app/services/Global/notifications.service';
import { RecruitmentService } from 'src/app/services/Jobs/recruitment.service';

const CATS: { key: string; label: string; hint: string }[] = [
  { key: 'education', label: 'Education', hint: 'Meets the education requirement' },
  { key: 'experience', label: 'Experience', hint: 'Relevant work history' },
  { key: 'skills', label: 'Skills', hint: 'Required skills found on the CV and in answers' },
  { key: 'answers', label: 'Screening answers', hint: 'Quality and relevance of the answers' },
  { key: 'competencies', label: 'Job competencies', hint: 'Your job-specific criteria below' },
];

/** Scoring weights, recommendation thresholds, passing score and job-specific criteria for ONE job (or the global defaults). */
@Component({
  selector: 'app-evaluation-settings-dialog',
  template: `
<h2 mat-dialog-title class="es-title"><mat-icon>tune</mat-icon> Evaluation settings</h2>
<mat-dialog-content class="es-body">
  <p class="es-lead">{{ global ? 'Defaults for every job that has no settings of its own.' : 'Applies to ' + data.jobName + '. Jobs you don\\'t change use the global defaults.' }}</p>

  <mat-button-toggle-group *ngIf="canGlobal" class="es-scope" [value]="global ? 'global' : 'job'" (change)="switchScope($event.value)" aria-label="Settings scope">
    <mat-button-toggle value="job">This job</mat-button-toggle>
    <mat-button-toggle value="global">Global defaults</mat-button-toggle>
  </mat-button-toggle-group>

  <div class="es-loading" *ngIf="loading"><mat-spinner diameter="28"></mat-spinner></div>

  <ng-container *ngIf="!loading && s">
    <h3>Scoring weights <small>(share of the overall score)</small></h3>
    <div class="es-row" *ngFor="let c of cats">
      <div class="es-label"><strong>{{ c.label }}</strong><small>{{ c.hint }}</small></div>
      <mat-slider min="0" max="100" step="5" [value]="s.weights[c.key]" (input)="s.weights[c.key] = $any($event.value)" [attr.aria-label]="c.label + ' weight'"></mat-slider>
      <span class="es-val">{{ s.weights[c.key] }} <small>({{ share(c.key) }}%)</small></span>
    </div>
    <p class="es-note">Categories that don't apply (for example answers when a job has no questions) are left out and the others re-balance.</p>

    <h3>Recommendation thresholds</h3>
    <div class="es-thr">
      <mat-form-field appearance="outline"><mat-label>Strong match from</mat-label><input matInput type="number" min="1" max="100" [(ngModel)]="s.thresholds.strong"></mat-form-field>
      <mat-form-field appearance="outline"><mat-label>Qualified from</mat-label><input matInput type="number" min="1" max="100" [(ngModel)]="s.thresholds.qualified"></mat-form-field>
      <mat-form-field appearance="outline"><mat-label>Needs review from</mat-label><input matInput type="number" min="1" max="100" [(ngModel)]="s.thresholds.review"></mat-form-field>
    </div>
    <p class="es-note">Below the last value: low match, manual review required. Defaults: 85 / 70 / 50.</p>

    <mat-form-field appearance="outline" class="full">
      <mat-label>Passing score</mat-label>
      <input matInput type="number" min="0" max="100" [(ngModel)]="s.passing_score">
      <mat-hint>Shown next to each candidate's score. It never rejects anyone by itself.</mat-hint>
    </mat-form-field>

    <mat-form-field appearance="outline" class="full" *ngIf="!global">
      <mat-label>Job-specific competencies (one per line)</mat-label>
      <textarea matInput rows="4" [(ngModel)]="competencies" placeholder="Customer focus&#10;Team collaboration&#10;Attention to detail"></textarea>
      <mat-hint>Looked for in the CV and screening answers, by meaning, not exact words.</mat-hint>
    </mat-form-field>

    <p class="es-error" *ngIf="error" role="alert"><mat-icon>error_outline</mat-icon> {{ error }}</p>
  </ng-container>
</mat-dialog-content>
<mat-dialog-actions align="end">
  <button mat-button type="button" (click)="ref.close(false)" [disabled]="saving">Cancel</button>
  <button mat-flat-button color="primary" type="button" (click)="save()" [disabled]="loading || saving">
    <mat-spinner *ngIf="saving" diameter="18"></mat-spinner> Save settings
  </button>
</mat-dialog-actions>
`,
  styles: [`
    :host { display: block; font-family: Verdana, Geneva, Tahoma, sans-serif; }
    .es-title { display: flex; align-items: center; gap: 8px; font-size: 18px !important; }
    .es-body { min-width: min(560px, 88vw); max-width: 620px; }
    .es-lead { margin: 0 0 8px; font-size: 13px; color: #6b7a99; text-align: left; }
    .es-scope { margin-bottom: 8px; }
    .es-loading { text-align: center; padding: 20px; }
    h3 { margin: 14px 0 6px; font-size: 14px; } h3 small { font-weight: 400; color: #8a97b0; }
    .es-row { display: grid; grid-template-columns: minmax(120px, 1.2fr) minmax(100px, 2fr) 72px; align-items: center; gap: 8px; }
    .es-label { display: flex; flex-direction: column; } .es-label small { color: #8a97b0; font-size: 11px; }
    .es-val { font-size: 13px; font-weight: 700; text-align: right; } .es-val small { font-weight: 400; color: #8a97b0; }
    mat-slider { width: 100%; }
    .es-note { margin: 4px 0 8px; font-size: 12px; color: #8a97b0; text-align: left; }
    .es-thr { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .full { width: 100%; }
    .es-error { display: flex; align-items: center; gap: 6px; color: #c62828; font-size: 12.5px; }
    mat-dialog-actions button { border-radius: 999px; } mat-dialog-actions mat-spinner { display: inline-block; margin-right: 6px; vertical-align: middle; }
    @media (max-width: 599.98px) { .es-body { min-width: 0; } .es-row { grid-template-columns: 1fr 64px; } .es-row mat-slider { grid-column: 1 / -1; grid-row: 2; } .es-thr { grid-template-columns: 1fr; } }
  `]
})
export class EvaluationSettingsDialogComponent implements OnInit {
  readonly cats = CATS;
  s: any = null;
  competencies = '';
  loading = true;
  saving = false;
  error = '';
  global = false;
  canGlobal = false;

  constructor(
    public ref: MatDialogRef<EvaluationSettingsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { transNo: string; jobName: string },
    private api: RecruitmentService,
    private notice: NotificationsService
  ) { }

  ngOnInit(): void { this.load(); }

  private load(): void {
    this.loading = true;
    this.api.settings(this.global ? null : this.data.transNo).subscribe({
      next: r => {
        this.s = JSON.parse(JSON.stringify(r.data));
        this.competencies = (r.data.competencies || []).join('\n');
        this.canGlobal = !!r.can_edit_global;
        this.loading = false;
      },
      error: e => { this.loading = false; this.error = this.api.errorText(e, 'Could not load the settings.'); }
    });
  }

  switchScope(v: string): void { this.global = v === 'global'; this.error = ''; this.load(); }

  share(key: string): number {
    const total = Object.values(this.s.weights as Record<string, number>).reduce((a, b) => a + (+b || 0), 0);
    return total > 0 ? Math.round(((+this.s.weights[key] || 0) / total) * 100) : 0;
  }

  save(): void {
    this.saving = true;
    this.error = '';
    this.api.saveSettings({
      transNo: this.global ? null : this.data.transNo, weights: this.s.weights, thresholds: this.s.thresholds,
      passing_score: this.s.passing_score, competencies: this.global ? null : this.competencies
    }).subscribe({
      next: r => { this.saving = false; this.notice.toastrSuccess(r.message || 'Saved.'); this.ref.close(true); },
      error: e => { this.saving = false; this.error = this.api.errorText(e, 'Could not save the settings.'); }
    });
  }
}
