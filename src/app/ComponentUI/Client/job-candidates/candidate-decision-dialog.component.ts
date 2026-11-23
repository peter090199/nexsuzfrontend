import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NotificationsService } from 'src/app/services/Global/notifications.service';
import { PipelineStatus, RECOMMENDATION_LABEL, RecruitmentService, STATUS_META } from 'src/app/services/Jobs/recruitment.service';

export interface DecisionData {
  appliedId: number; fullname: string; jobName: string; from: PipelineStatus; to: PipelineStatus;
  aiScore?: number | null; aiRecommendation?: keyof typeof RECOMMENDATION_LABEL | null;
}

/**
 * Move a candidate to another stage. The AI score is shown as advice only: approving or rejecting always takes a
 * person's explicit confirmation here, a reason for a rejection, and the applicant message can be previewed and edited.
 */
@Component({
  selector: 'app-candidate-decision-dialog',
  template: `
<h2 mat-dialog-title class="dd-title"><mat-icon [ngClass]="'t-' + data.to">{{ icon }}</mat-icon> {{ title }}</h2>

<mat-dialog-content class="dd-body">
  <p class="dd-who"><strong>{{ data.fullname }}</strong> · {{ data.jobName }}</p>

  <div class="dd-ai" *ngIf="data.aiScore !== null && data.aiScore !== undefined" role="note">
    <mat-icon>auto_awesome</mat-icon>
    <div>
      <strong>AI advice: {{ data.aiScore }}/100</strong>
      <span>{{ data.aiRecommendation ? labels[data.aiRecommendation] : '' }}. The AI only recommends. This decision is yours.</span>
    </div>
  </div>

  <mat-form-field appearance="outline" class="full" *ngIf="data.to === 'reject' || data.to === 'approved'">
    <mat-label>{{ data.to === 'reject' ? 'Reason for rejection (required)' : 'Note (optional)' }}</mat-label>
    <textarea matInput rows="3" [(ngModel)]="reason" maxlength="1000" [required]="data.to === 'reject'"
      [placeholder]="data.to === 'reject' ? 'Why is this candidate not moving forward? Kept internally, not sent to the applicant.' : 'Anything the team should remember'"></textarea>
    <mat-hint *ngIf="data.to === 'reject'">Internal only: the applicant gets a polite standard message, not this text.</mat-hint>
  </mat-form-field>

  <mat-slide-toggle [(ngModel)]="notify" color="primary" (change)="onNotifyToggle()">Notify the applicant</mat-slide-toggle>

  <div class="dd-msg" *ngIf="notify">
    <div class="dd-loading" *ngIf="loadingMsg"><mat-spinner diameter="22"></mat-spinner> Preparing message…</div>
    <ng-container *ngIf="!loadingMsg && subject">
      <small class="dd-to">To the applicant by {{ channels.join(' and ') }}. You can edit it before sending.</small>
      <div class="dd-subject">{{ subject }}</div>
      <textarea class="dd-text" rows="6" [(ngModel)]="message" maxlength="3000" aria-label="Message to the applicant"></textarea>
    </ng-container>
  </div>

  <mat-checkbox [(ngModel)]="confirmed" color="primary" class="dd-confirm">
    I have reviewed this candidate{{ data.to === 'reject' ? ' and confirm the rejection' : data.to === 'approved' ? ' and confirm the approval' : '' }}.
  </mat-checkbox>

  <p class="dd-error" *ngIf="error" role="alert"><mat-icon>error_outline</mat-icon> {{ error }}</p>
</mat-dialog-content>

<mat-dialog-actions align="end" class="dd-actions">
  <button mat-button type="button" (click)="ref.close(false)" [disabled]="saving">Cancel</button>
  <button mat-flat-button type="button" [color]="data.to === 'reject' ? 'warn' : 'primary'" (click)="submit()" [disabled]="!canSubmit || saving">
    <mat-spinner *ngIf="saving" diameter="18"></mat-spinner>
    {{ confirmLabel }}
  </button>
</mat-dialog-actions>
`,
  styles: [`
    :host { display: block; font-family: Verdana, Geneva, Tahoma, sans-serif; }
    .dd-title { display: flex; align-items: center; gap: 8px; font-size: 18px !important; }
    .t-approved { color: #1b8a4b; } .t-reject { color: #c62828; } .t-interview { color: #5a3cc9; } .t-review { color: #9a5b00; }
    .dd-body { min-width: min(520px, 86vw); max-width: 560px; display: flex; flex-direction: column; gap: 10px; }
    .dd-who { margin: 0; font-size: 13px; color: #34476a; text-align: left; }
    .dd-ai { display: flex; gap: 10px; padding: 10px 12px; border-radius: 12px; background: #f4f0ff; border: 1px solid #ddd2fb; color: #3d2a8f; font-size: 12.5px; }
    .dd-ai div { display: flex; flex-direction: column; gap: 2px; } .dd-ai mat-icon { flex: none; }
    .full { width: 100%; }
    .dd-msg { border: 1px solid #e6eaf1; border-radius: 12px; padding: 10px 12px; background: #fafcff; display: flex; flex-direction: column; gap: 6px; }
    .dd-to { color: #6b7a99; } .dd-subject { font-weight: 700; font-size: 13px; }
    .dd-text { width: 100%; border: 1px solid #d5deec; border-radius: 10px; padding: 10px; font: inherit; font-size: 13px; resize: vertical; background: #fff; }
    .dd-loading { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #6b7a99; }
    .dd-confirm { margin-top: 4px; font-size: 13px; }
    .dd-error { display: flex; align-items: center; gap: 6px; margin: 0; color: #c62828; font-size: 12.5px; }
    .dd-actions mat-spinner { display: inline-block; margin-right: 6px; vertical-align: middle; }
    .dd-actions button { border-radius: 999px; }
    @media (max-width: 599.98px) { .dd-body { min-width: 0; max-width: none; } }
  `]
})
export class CandidateDecisionDialogComponent implements OnInit {
  readonly labels = RECOMMENDATION_LABEL;
  reason = '';
  notify = true;
  confirmed = false;
  message = '';
  subject = '';
  channels: string[] = [];
  loadingMsg = false;
  saving = false;
  error = '';

  constructor(
    public ref: MatDialogRef<CandidateDecisionDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DecisionData,
    private api: RecruitmentService,
    private notice: NotificationsService
  ) { }

  ngOnInit(): void { this.loadPreview(); }

  get meta() { return STATUS_META.find(s => s.key === this.data.to)!; }
  get icon(): string { return this.meta.icon; }
  get title(): string {
    return ({ interview: 'Move to Interview', approved: 'Approve candidate', reject: 'Reject candidate', review: 'Move to Under review', applied_active: 'Move back to Applied' } as any)[this.data.to];
  }
  get confirmLabel(): string {
    return ({ interview: 'Move to Interview', approved: 'Approve', reject: 'Reject candidate', review: 'Move to review', applied_active: 'Move back' } as any)[this.data.to];
  }

  get canSubmit(): boolean {
    if (!this.confirmed) { return false; }
    if (this.data.to === 'reject' && this.reason.trim().length < 5) { return false; }
    return true;
  }

  onNotifyToggle(): void { if (this.notify && !this.subject) { this.loadPreview(); } }

  private loadPreview(): void {
    this.loadingMsg = true;
    this.api.previewNotification(this.data.appliedId, this.data.to).subscribe({
      next: r => { this.subject = r.message.subject; this.message = r.message.body; this.channels = r.channels || []; this.loadingMsg = false; },
      error: () => { this.loadingMsg = false; this.subject = ''; }
    });
  }

  submit(): void {
    if (!this.canSubmit || this.saving) { return; }
    this.saving = true;
    this.error = '';
    this.api.changeStatus(this.data.appliedId, {
      status: this.data.to, reason: this.reason.trim() || undefined, notify: this.notify, message: this.notify ? this.message : undefined
    }).subscribe({
      next: r => { this.saving = false; this.notice.toastrSuccess(r.message || 'Status updated.'); this.ref.close(true); },
      error: e => { this.saving = false; this.error = this.api.errorText(e, 'Could not change the status.'); }
    });
  }
}
