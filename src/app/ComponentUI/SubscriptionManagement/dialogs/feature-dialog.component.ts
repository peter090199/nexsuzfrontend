import { Component, Inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { SubFeature, SubscriptionApiService } from '../shared/subscription-api.service';
import { notBlank } from './plan-dialog.component';

const ICONS = ['work', 'person', 'hub', 'insights', 'support_agent', 'star', 'bolt', 'verified', 'visibility', 'mail'];

/** Add / Edit a feature. data = { feature?: SubFeature, categories: string[] }. The key is immutable after creation. */
@Component({
  selector: 'app-feature-dialog',
  template: `
    <button mat-icon-button type="button" class="close-button" aria-label="Close" [mat-dialog-close]="false">
      <mat-icon>close</mat-icon>
    </button>
    <h2 mat-dialog-title>{{ data.feature ? 'Edit feature' : 'Add feature' }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <mat-dialog-content>
        <mat-form-field appearance="outline" class="w-100">
          <mat-label>Feature name</mat-label>
          <input matInput formControlName="name" required>
          <mat-error>Feature name is required</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline" class="w-100">
          <mat-label>Feature key</mat-label>
          <input matInput formControlName="feature_code" required placeholder="e.g. CONNECTION_LIMIT" style="text-transform: uppercase">
          <mat-icon matSuffix *ngIf="data.feature" matTooltip="Keys cannot be changed after creation">lock</mat-icon>
          <mat-hint>{{ data.feature ? 'Immutable — the app reads plans by this key' : 'Capital letters, numbers and underscores' }}</mat-hint>
          <mat-error *ngIf="form.get('feature_code')?.hasError('pattern')">Use capital letters, numbers and underscores only</mat-error>
          <mat-error *ngIf="form.get('feature_code')?.hasError('required')">Feature key is required</mat-error>
        </mat-form-field>
        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>Category</mat-label>
            <mat-select formControlName="category">
              <mat-option *ngFor="let c of categories" [value]="c">{{ c }}</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Value type</mat-label>
            <mat-select formControlName="value_type">
              <mat-option value="toggle">On / off</mat-option>
              <mat-option value="limit">Numeric limit</mat-option>
            </mat-select>
          </mat-form-field>
        </div>
        <mat-form-field appearance="outline" class="w-100">
          <mat-label>Icon</mat-label>
          <mat-select formControlName="icon">
            <mat-select-trigger><mat-icon class="trig">{{ form.value.icon }}</mat-icon> {{ form.value.icon }}</mat-select-trigger>
            <mat-option *ngFor="let i of icons" [value]="i"><mat-icon>{{ i }}</mat-icon> {{ i }}</mat-option>
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" class="w-100">
          <mat-label>Description</mat-label>
          <textarea matInput rows="2" formControlName="description"></textarea>
        </mat-form-field>
        <mat-slide-toggle formControlName="is_active">{{ form.value.is_active ? 'Active' : 'Disabled' }}</mat-slide-toggle>
        <p class="err" *ngIf="error" role="alert">{{ error }}</p>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-stroked-button type="button" [mat-dialog-close]="false">Cancel</button>
        <button mat-flat-button color="primary" type="submit" [disabled]="saving">{{ saving ? 'Saving…' : 'Save feature' }}</button>
      </mat-dialog-actions>
    </form>`,
  styles: [`
    .w-100 { width: 100%; }
    .row { display: flex; gap: 12px; } .row mat-form-field { flex: 1 1 0; min-width: 0; }
    .trig { vertical-align: middle; font-size: 18px; height: 18px; width: 18px; }
    .err { color: #c62828; font-size: 13px; margin: 10px 0 0; }
    @media (max-width: 480px) { .row { flex-direction: column; gap: 0; } }
  `]
})
export class FeatureDialogComponent {
  icons = ICONS;
  categories: string[];
  saving = false;
  error = '';

  form = this.fb.group({
    name: ['', [Validators.required, notBlank]],
    feature_code: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9_]+$/)]],
    category: ['General'],
    value_type: ['toggle'],
    icon: ['star'],
    description: [''],
    is_active: [true],
  });

  constructor(
    private fb: FormBuilder, private api: SubscriptionApiService,
    private ref: MatDialogRef<FeatureDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { feature?: SubFeature; categories: string[] }
  ) {
    this.categories = Array.from(new Set(['Jobs', 'Profile', 'Networking', 'Analytics', 'Support', 'General', ...(data.categories || [])]));
    const f = data.feature;
    if (f) {
      this.form.patchValue({
        name: f.name, feature_code: f.key, category: f.category, value_type: f.value_type,
        icon: f.icon, description: f.description || '', is_active: f.active,
      });
      this.form.get('feature_code')?.disable();
    }
  }

  save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue() as any;
    const body: any = {
      name: v.name.trim(), category: v.category, value_type: v.value_type, icon: v.icon,
      description: v.description, is_active: v.is_active,
    };
    this.saving = true; this.error = '';
    const call = this.data.feature
      ? this.api.updateFeature(this.data.feature.id, body)
      : this.api.createFeature({ ...body, feature_code: String(v.feature_code).toUpperCase() });
    call.subscribe({
      next: () => this.ref.close(true),
      error: err => { this.saving = false; this.error = SubscriptionApiService.errorMessage(err); },
    });
  }
}
