import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { SubPlan, SubscriberDetail, SubscriptionApiService } from '../shared/subscription-api.service';

export type SubscriberMode = 'details' | 'history' | 'change' | 'extend' | 'suspend' | 'reactivate';

/** One dialog for every subscriber action. data = { code, name, mode, plans } */
@Component({
  selector: 'app-subscriber-dialog',
  template: `
    <button mat-icon-button type="button" class="close-button" aria-label="Close" [mat-dialog-close]="false">
      <mat-icon>close</mat-icon>
    </button>
    <h2 mat-dialog-title>{{ titles[mode] }} — {{ data.name }}</h2>
    <mat-dialog-content>
      <mat-progress-bar *ngIf="loading" mode="indeterminate"></mat-progress-bar>

      <ng-container *ngIf="detail">
        <ng-container *ngIf="mode === 'details'">
          <dl class="kv">
            <dt>Email</dt><dd>{{ detail.email }}</dd>
            <dt>Current plan</dt><dd>{{ detail.plan || 'No subscription' }}</dd>
            <dt>Status</dt><dd class="cap">{{ detail.status }}</dd>
            <dt>Started</dt><dd>{{ detail.start ? (detail.start | date:'mediumDate') : '—' }}</dd>
            <dt>Expires</dt><dd>{{ detail.end ? (detail.end | date:'mediumDate') : '—' }}</dd>
          </dl>
          <h3>Feature usage</h3>
          <div class="usage" *ngFor="let u of detail.usage">
            <div class="u-top"><span>{{ u.name }}</span><span>{{ u.used }} / {{ u.unlimited ? 'Unlimited' : (u.limit ?? 'No cap') }}</span></div>
            <div class="meter"><span [style.width.%]="pct(u)"></span></div>
          </div>
          <p class="none" *ngIf="!detail.usage.length">No measurable usage for this plan.</p>
        </ng-container>

        <ol class="timeline" *ngIf="mode === 'history'">
          <li *ngFor="let h of detail.history">
            <strong>{{ h.plan_name }} <span class="st cap">{{ h.status }}</span></strong>
            <span>{{ h.payment_method || '—' }} · ₱{{ h.amount | number:'1.2-2' }}</span>
            <small>{{ h.start_date | date:'mediumDate' }} → {{ h.end_date | date:'mediumDate' }}</small>
            <small *ngIf="h.remarks">{{ h.remarks }}</small>
          </li>
          <li *ngIf="!detail.history.length">No subscription history.</li>
        </ol>
      </ng-container>

      <ng-container *ngIf="mode === 'change'">
        <mat-form-field appearance="outline" class="w-100">
          <mat-label>New plan</mat-label>
          <mat-select [(ngModel)]="newPlanId">
            <mat-option *ngFor="let p of activePlans" [value]="p.planId">{{ p.plan_name }} — ₱{{ p.price | number:'1.0-0' }}/{{ p.tagmonthYear === 'Yearly' ? 'yr' : 'mo' }}</mat-option>
          </mat-select>
        </mat-form-field>
      </ng-container>

      <ng-container *ngIf="mode === 'extend'">
        <mat-form-field appearance="outline" class="w-100">
          <mat-label>Extend by</mat-label>
          <mat-select [(ngModel)]="days">
            <mat-option [value]="7">7 days</mat-option>
            <mat-option [value]="30">30 days</mat-option>
            <mat-option [value]="90">90 days</mat-option>
            <mat-option [value]="365">1 year</mat-option>
          </mat-select>
        </mat-form-field>
      </ng-container>

      <ng-container *ngIf="mode === 'suspend'">
        <p>The user will lose access to paid features until you reactivate the subscription.</p>
        <mat-form-field appearance="outline" class="w-100">
          <mat-label>Reason (optional)</mat-label>
          <textarea matInput rows="2" maxlength="200" [(ngModel)]="reason"></textarea>
        </mat-form-field>
      </ng-container>
      <p *ngIf="mode === 'reactivate'">Reactivate this subscription and restore access?</p>

      <p class="err" *ngIf="error" role="alert">{{ error }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-stroked-button type="button" [mat-dialog-close]="false">{{ isView ? 'Close' : 'Cancel' }}</button>
      <button mat-flat-button [color]="mode === 'suspend' ? 'warn' : 'primary'" type="button" *ngIf="!isView"
        (click)="confirm()" [disabled]="busy">{{ busy ? 'Working…' : confirmLabel[mode] }}</button>
    </mat-dialog-actions>`,
  styles: [`
    .w-100 { width: 100%; } .cap { text-transform: capitalize; }
    .kv { display: grid; grid-template-columns: 110px 1fr; gap: 6px 12px; margin: 0 0 12px; }
    .kv dt { color: #6b7a99; font-size: 12px; } .kv dd { margin: 0; word-break: break-word; }
    h3 { font-size: 13px; margin: 14px 0 8px; color: #002a57; }
    .usage { margin-bottom: 10px; } .u-top { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px; }
    .meter { height: 6px; background: #e8eef7; border-radius: 99px; overflow: hidden; }
    .meter span { display: block; height: 100%; background: #0a66c2; }
    .none { color: #6b7a99; font-size: 13px; }
    .err { color: #c62828; font-size: 13px; }
    .timeline { list-style: none; margin: 0; padding: 0 0 0 14px; border-left: 2px solid #e3e9f3; }
    .timeline li { position: relative; padding: 0 0 14px 14px; display: flex; flex-direction: column; font-size: 13px; }
    .timeline li::before { content: ''; position: absolute; left: -22px; top: 4px; width: 10px; height: 10px; border-radius: 50%; background: #0a66c2; }
    .timeline small { color: #6b7a99; } .st { font-weight: 400; color: #6b7a99; font-size: 12px; margin-left: 6px; }
    @media (max-width: 480px) { .kv { grid-template-columns: 1fr; } }
  `]
})
export class SubscriberDialogComponent implements OnInit {
  mode: SubscriberMode;
  detail?: SubscriberDetail;
  loading = false;
  busy = false;
  error = '';
  newPlanId = '';
  days = 30;
  reason = '';

  readonly titles: { [k in SubscriberMode]: string } = {
    details: 'Subscription details', history: 'Subscription history', change: 'Change plan',
    extend: 'Extend subscription', suspend: 'Suspend subscription', reactivate: 'Reactivate subscription',
  };
  readonly confirmLabel: { [k in SubscriberMode]: string } = {
    details: '', history: '', change: 'Change plan', extend: 'Extend', suspend: 'Suspend', reactivate: 'Reactivate',
  };

  constructor(
    private api: SubscriptionApiService, private ref: MatDialogRef<SubscriberDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { code: string; name: string; mode: SubscriberMode; plans: SubPlan[]; planId?: string | null }
  ) {
    this.mode = data.mode;
    this.newPlanId = data.planId || '';
  }

  get isView(): boolean { return this.mode === 'details' || this.mode === 'history'; }
  get activePlans(): SubPlan[] { return (this.data.plans || []).filter(p => p.recordStatus === 'active'); }

  ngOnInit(): void {
    if (this.isView) {
      this.loading = true;
      this.api.subscriber(this.data.code).subscribe({
        next: d => { this.detail = d; this.loading = false; },
        error: err => { this.loading = false; this.error = SubscriptionApiService.errorMessage(err); },
      });
    }
  }

  pct(u: { used: number; limit: number | null; unlimited: boolean }): number {
    return u.unlimited || !u.limit ? 8 : Math.min(100, Math.round((u.used / u.limit) * 100));
  }

  confirm(): void {
    const code = this.data.code;
    const call = this.mode === 'change' ? this.api.changePlan(code, this.newPlanId)
      : this.mode === 'extend' ? this.api.extend(code, this.days)
      : this.mode === 'suspend' ? this.api.suspend(code, this.reason.trim() || undefined)
      : this.api.reactivate(code);
    this.busy = true; this.error = '';
    call.subscribe({
      next: (r: any) => this.ref.close(r?.message || true),
      error: err => { this.busy = false; this.error = SubscriptionApiService.errorMessage(err); },
    });
  }
}
