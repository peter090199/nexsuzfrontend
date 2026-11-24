import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { NotificationsService } from 'src/app/services/Global/notifications.service';
import { UserServicesService } from 'src/app/services/MasterAdmin/user-services.service';

/**
 * Add a DEF-ADMIN account. The role is not a field: it is fixed to DEF-ADMIN here and again by the API, which also
 * rejects any other role and any caller who is not DEF-MASTERADMIN.
 */
@Component({
  selector: 'app-add-admin-dialog',
  template: `
    <button mat-icon-button type="button" class="close-button" aria-label="Close" [mat-dialog-close]="false" [disabled]="working">
      <mat-icon>close</mat-icon>
    </button>
    <h2 mat-dialog-title><mat-icon>admin_panel_settings</mat-icon> Add DEF-ADMIN</h2>

    <mat-dialog-content>
      <mat-progress-bar *ngIf="working" mode="indeterminate"></mat-progress-bar>
      <p class="err" *ngIf="error" role="alert">{{ error }}</p>
      <p class="hint">The new account is created with the <b>DEF-ADMIN</b> role and is active immediately.</p>

      <div class="row">
        <mat-form-field appearance="outline"><mat-label>First name</mat-label>
          <input matInput name="fname" [(ngModel)]="form.fname" [disabled]="working" autocomplete="off"></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Last name</mat-label>
          <input matInput name="lname" [(ngModel)]="form.lname" [disabled]="working" autocomplete="off"></mat-form-field>
      </div>
      <mat-form-field appearance="outline" class="w-100"><mat-label>Email</mat-label>
        <input matInput type="email" name="email" [(ngModel)]="form.email" [disabled]="working" autocomplete="off"></mat-form-field>
      <div class="row">
        <mat-form-field appearance="outline"><mat-label>Contact no. (optional)</mat-label>
          <input matInput name="contactno" [(ngModel)]="form.contactno" [disabled]="working" maxlength="15" autocomplete="off"></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Company (optional)</mat-label>
          <input matInput name="company" [(ngModel)]="form.company" [disabled]="working" autocomplete="off"></mat-form-field>
      </div>
      <div class="row">
        <mat-form-field appearance="outline"><mat-label>Password</mat-label>
          <input matInput type="password" name="password" [(ngModel)]="form.password" [disabled]="working" autocomplete="new-password"></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Confirm password</mat-label>
          <input matInput type="password" name="password_confirmation" [(ngModel)]="form.password_confirmation" [disabled]="working"
            autocomplete="new-password" (keyup.enter)="canSave && save()"></mat-form-field>
      </div>
      <p class="hint" *ngIf="form.password && form.password.length < 8">Use at least 8 characters.</p>
      <p class="hint warn" *ngIf="form.password_confirmation && form.password !== form.password_confirmation">The passwords do not match.</p>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-stroked-button type="button" [mat-dialog-close]="false" [disabled]="working">Cancel</button>
      <button mat-flat-button color="primary" type="button" (click)="save()" [disabled]="!canSave">
        <mat-icon>person_add</mat-icon> {{ working ? 'Adding…' : 'Add DEF-ADMIN' }}
      </button>
    </mat-dialog-actions>`,
  styles: [`
    .row { display: flex; gap: 12px; flex-wrap: wrap; } .row mat-form-field { flex: 1 1 200px; }
    .w-100 { width: 100%; }
    h2 mat-icon { vertical-align: middle; margin-right: 6px; }
    .hint { font-size: 12px; color: #6b7a99; margin: 4px 0; } .hint.warn { color: #b42318; }
    .err { color: #c62828; font-size: 13px; }
  `]
})
export class AddAdminDialogComponent {
  form = { fname: '', lname: '', email: '', contactno: '', company: '', password: '', password_confirmation: '' };
  working = false;
  error = '';

  constructor(private users: UserServicesService, private ref: MatDialogRef<AddAdminDialogComponent>, private notify: NotificationsService) { }

  get canSave(): boolean {
    const f = this.form;
    return !this.working && !!f.fname.trim() && !!f.lname.trim() && /\S+@\S+\.\S+/.test(f.email.trim())
      && f.password.length >= 8 && f.password === f.password_confirmation;
  }

  save(): void {
    if (!this.canSave) { return; }
    this.working = true; this.error = '';
    const f = this.form;
    this.users.addAdmin({ ...f, fname: f.fname.trim(), lname: f.lname.trim(), email: f.email.trim() }).subscribe({
      next: r => { this.working = false; this.notify.toastrSuccess(r?.message || 'Admin added.'); this.ref.close(true); },
      error: e => {
        this.working = false;
        const errs = e?.error?.errors;
        const first = errs ? (Object.values(errs)[0] as string[])?.[0] : '';
        this.error = first || e?.error?.message || 'The admin could not be added.';
      },
    });
  }
}
