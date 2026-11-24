import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NotificationsService } from 'src/app/services/Global/notifications.service';
import { UserServicesService } from 'src/app/services/MasterAdmin/user-services.service';

/**
 * Edit an account's contact details. Role, status, password and code are not editable here, and the API ignores them
 * even if sent. DEF-MASTERADMIN only (the API checks the role).
 */
@Component({
  selector: 'app-edit-user-dialog',
  template: `
    <button mat-icon-button type="button" class="close-button" aria-label="Close" [mat-dialog-close]="false" [disabled]="working">
      <mat-icon>close</mat-icon>
    </button>
    <h2 mat-dialog-title><mat-icon>edit</mat-icon> Edit {{ data.user.fullname }}</h2>

    <mat-dialog-content>
      <mat-progress-bar *ngIf="working" mode="indeterminate"></mat-progress-bar>
      <p class="err" *ngIf="error" role="alert">{{ error }}</p>
      <p class="hint">Role: <b>{{ data.user.role_code }}</b> (cannot be changed here)</p>

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
          <input matInput name="company" [(ngModel)]="form.company" [disabled]="working" autocomplete="off" (keyup.enter)="canSave && save()"></mat-form-field>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-stroked-button type="button" [mat-dialog-close]="false" [disabled]="working">Cancel</button>
      <button mat-flat-button color="primary" type="button" (click)="save()" [disabled]="!canSave">
        <mat-icon>save</mat-icon> {{ working ? 'Saving…' : 'Save changes' }}
      </button>
    </mat-dialog-actions>`,
  styles: [`
    .row { display: flex; gap: 12px; flex-wrap: wrap; } .row mat-form-field { flex: 1 1 200px; }
    .w-100 { width: 100%; }
    h2 mat-icon { vertical-align: middle; margin-right: 6px; }
    .hint { font-size: 12px; color: #6b7a99; margin: 4px 0; }
    .err { color: #c62828; font-size: 13px; }
  `]
})
export class EditUserDialogComponent {
  form: { fname: string; lname: string; email: string; contactno: string; company: string };
  working = false;
  error = '';

  constructor(private users: UserServicesService, private ref: MatDialogRef<EditUserDialogComponent>, private notify: NotificationsService,
    @Inject(MAT_DIALOG_DATA) public data: { user: any }) {
    const u = data.user;
    this.form = { fname: u.fname || '', lname: u.lname || '', email: u.email || '', contactno: u.contactno || '', company: u.company || '' };
  }

  get canSave(): boolean {
    const f = this.form;
    return !this.working && !!f.fname.trim() && !!f.lname.trim() && /\S+@\S+\.\S+/.test(f.email.trim());
  }

  save(): void {
    if (!this.canSave) { return; }
    this.working = true; this.error = '';
    const f = this.form;
    this.users.updateUserDetails(this.data.user.code, { ...f, fname: f.fname.trim(), lname: f.lname.trim(), email: f.email.trim() }).subscribe({
      next: r => { this.working = false; this.notify.toastrSuccess(r?.message || 'Account updated.'); this.ref.close(true); },
      error: e => {
        this.working = false;
        const errs = e?.error?.errors;
        const first = errs ? (Object.values(errs)[0] as string[])?.[0] : '';
        this.error = first || e?.error?.message || 'The account could not be updated.';
      },
    });
  }
}
