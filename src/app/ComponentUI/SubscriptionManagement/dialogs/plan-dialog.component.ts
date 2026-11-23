import { Component, Inject } from '@angular/core';
import { AbstractControl, FormBuilder, ValidationErrors, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { SubPlan, SubscriptionApiService } from '../shared/subscription-api.service';

export function notBlank(c: AbstractControl): ValidationErrors | null {
  return typeof c.value === 'string' && c.value.length > 0 && !c.value.trim() ? { blank: true } : null;
}

/** The plans that can be created. An older plan with another name keeps it (it is added to the list while it is edited). */
export const PLAN_NAMES = ['Free', 'Starter', 'Basic', 'Premium', 'Business Unlimited'];

/** Add / Edit / View a subscription plan. data = { plan?: SubPlan, readonly?: boolean, audience?, plans? } */
@Component({
  selector: 'app-plan-dialog',
  template: `
    <button mat-icon-button type="button" class="close-button" aria-label="Close" [mat-dialog-close]="false">
      <mat-icon>close</mat-icon>
    </button>
    <h2 mat-dialog-title>{{ readonly ? 'Plan details' : (data.plan ? 'Edit plan' : 'Add plan') }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <mat-dialog-content>
        <mat-form-field appearance="outline" class="w-100">
          <mat-label>Plan name</mat-label>
          <mat-select formControlName="plan_name" required>
            <mat-option *ngFor="let n of nameOptions" [value]="n" [disabled]="isTaken(n)">
              {{ n }}<span class="taken" *ngIf="isTaken(n)"> (already exists)</span>
            </mat-option>
          </mat-select>
          <mat-hint>Choose the plan this is</mat-hint>
          <mat-error>Choose a plan name</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline" class="w-100">
          <mat-label>Plan is for</mat-label>
          <mat-select formControlName="audience">
            <mat-option value="DEF-USERS">Job seekers</mat-option>
            <mat-option value="DEF-CLIENT">Recruiters</mat-option>
          </mat-select>
          <mat-hint>Controls which tab of the public pricing page shows this plan</mat-hint>
        </mat-form-field>
        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>Badge</mat-label>
            <input matInput formControlName="tag" required placeholder="e.g. PREMIUM">
            <mat-hint>Unique within {{ form.value.audience === 'DEF-CLIENT' ? 'recruiter' : 'job seeker' }} plans</mat-hint>
            <mat-error>Badge is required</mat-error>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Sort number</mat-label>
            <input matInput type="number" min="1" formControlName="sort_number" required>
            <mat-error>Enter 1 or more</mat-error>
          </mat-form-field>
        </div>
        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>Price (₱)</mat-label>
            <input matInput type="number" min="0" step="0.01" formControlName="price" required>
            <mat-error>Enter a price of 0 or more</mat-error>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Billing cycle</mat-label>
            <mat-select formControlName="tagmonthYear">
              <mat-option value="Monthly">Monthly</mat-option>
              <mat-option value="Yearly">Yearly</mat-option>
            </mat-select>
          </mat-form-field>
        </div>
        <mat-form-field appearance="outline" class="w-100">
          <mat-label>Button text</mat-label>
          <input matInput formControlName="button_name" required placeholder="e.g. Go Premium">
          <mat-error>Button text is required</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline" class="w-100">
          <mat-label>Description</mat-label>
          <textarea matInput rows="2" formControlName="description"></textarea>
        </mat-form-field>
        <mat-slide-toggle formControlName="active">{{ form.value.active ? 'Active' : 'Inactive' }}</mat-slide-toggle>
        <p class="err" *ngIf="error" role="alert">{{ error }}</p>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-stroked-button type="button" [mat-dialog-close]="false">{{ readonly ? 'Close' : 'Cancel' }}</button>
        <button mat-flat-button color="primary" type="submit" *ngIf="!readonly" [disabled]="saving">
          {{ saving ? 'Saving…' : 'Save plan' }}
        </button>
      </mat-dialog-actions>
    </form>`,
  styles: [`
    .w-100 { width: 100%; }
    .row { display: flex; gap: 12px; } .row mat-form-field { flex: 1 1 0; min-width: 0; }
    mat-dialog-content { padding-top: 8px; }
    .err { color: #c62828; font-size: 13px; margin: 10px 0 0; }
    .taken { color: #8a96ab; font-size: 12px; }
    @media (max-width: 480px) { .row { flex-direction: column; gap: 0; } }
  `]
})
export class PlanDialogComponent {
  readonly = false;
  saving = false;
  error = '';
  form = this.fb.group({
    plan_name: ['', [Validators.required, notBlank]],
    tag: ['', [Validators.required, notBlank]],
    sort_number: [1, [Validators.required, Validators.min(1)]],
    price: [0, [Validators.required, Validators.min(0)]],
    tagmonthYear: ['Monthly'],
    audience: ['DEF-USERS'],
    button_name: ['', [Validators.required, notBlank]],
    description: [''],
    active: [true],
  });

  constructor(
    private fb: FormBuilder, private api: SubscriptionApiService,
    private ref: MatDialogRef<PlanDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { plan?: SubPlan; readonly?: boolean; audience?: 'DEF-USERS' | 'DEF-CLIENT'; plans?: SubPlan[] }
  ) {
    this.readonly = !!data.readonly;
    if (data.plan) {
      this.form.patchValue({ ...data.plan, active: data.plan.recordStatus === 'active' } as any);
    }
    // adding while the page is filtered to one audience: start on that audience
    if (!data.plan && data.audience) { this.form.patchValue({ audience: data.audience }); }
    if (this.readonly) { this.form.disable(); }
  }

  /** the names to choose from, plus the name this plan already has when it is not one of them */
  get nameOptions(): string[] {
    const current = this.data.plan?.plan_name?.trim();
    return current && !PLAN_NAMES.some(n => n.toLowerCase() === current.toLowerCase()) ? [...PLAN_NAMES, current] : PLAN_NAMES;
  }

  /** a name already used by another plan of the same audience (job seekers and recruiters each have their own set) */
  isTaken(name: string): boolean {
    const audience = this.form.value.audience;
    return (this.data.plans || []).some(p =>
      p.planId !== this.data.plan?.planId && (p.audience || 'DEF-USERS') === audience && p.plan_name.trim().toLowerCase() === name.toLowerCase());
  }

  save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue() as any;
    if (this.isTaken(v.plan_name)) { this.error = `A ${v.audience === 'DEF-CLIENT' ? 'recruiter' : 'job seeker'} plan named "${v.plan_name}" already exists. Choose another name.`; return; }
    this.saving = true; this.error = '';
    this.api.savePlan({
      planId: this.data.plan?.planId,
      plan_name: v.plan_name.trim(), tag: v.tag.trim(), button_name: v.button_name.trim(),
      sort_number: +v.sort_number, price: +v.price, tagmonthYear: v.tagmonthYear, audience: v.audience,
      description: v.description, recordStatus: v.active ? 'active' : 'inactive',
    } as any).subscribe({
      next: () => this.ref.close(true),
      error: err => { this.saving = false; this.error = SubscriptionApiService.errorMessage(err); },
    });
  }
}
