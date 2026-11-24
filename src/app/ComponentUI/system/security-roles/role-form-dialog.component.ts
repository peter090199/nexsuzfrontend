import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NotificationsService } from 'src/app/services/Global/notifications.service';
import { SecurityRolesService } from 'src/app/services/Security/security-roles.service';

export const ROLE_CODE_PATTERN = /^[A-Z][A-Z0-9_-]{2,39}$/;

/** Create a role, or edit one. System roles keep their code (the API refuses a rename too). DEF-MASTERADMIN only. */
@Component({
  selector: 'app-role-form-dialog',
  template: `
    <button mat-icon-button type="button" class="close-button" aria-label="Close" [mat-dialog-close]="false" [disabled]="working"><mat-icon>close</mat-icon></button>
    <h2 mat-dialog-title><mat-icon>{{ role ? 'edit' : 'add_moderator' }}</mat-icon> {{ role ? 'Edit role' : 'Add role' }}</h2>
    <mat-dialog-content>
      <mat-progress-bar *ngIf="working" mode="indeterminate"></mat-progress-bar>
      <p class="err" *ngIf="error" role="alert">{{ error }}</p>
      <p class="hint" *ngIf="role?.is_system">System role: the code can't be changed and the role can't be deleted.</p>
      <p class="hint" *ngIf="role && !role.is_system && role.users_count">{{ role.users_count }} user(s) have this role, so its code can't be changed until they are moved.</p>

      <mat-form-field appearance="outline" class="w-100">
        <mat-label>Role code</mat-label>
        <input matInput name="rolecode" [(ngModel)]="form.rolecode" (ngModelChange)="form.rolecode = ($event || '').toUpperCase()"
          [disabled]="working || codeLocked" autocomplete="off" spellcheck="false" maxlength="40" placeholder="DEF-AUDITOR">
        <mat-hint>Capital letters, digits, "-" or "_"</mat-hint>
      </mat-form-field>
      <p class="err" *ngIf="!codeValid">The code must be 3 to 40 characters and start with a letter.</p>
      <mat-form-field appearance="outline" class="w-100">
        <mat-label>Description</mat-label>
        <input matInput name="description" [(ngModel)]="form.description" [disabled]="working" maxlength="255" autocomplete="off" (keyup.enter)="canSave && save()">
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-stroked-button type="button" [mat-dialog-close]="false" [disabled]="working">Cancel</button>
      <button mat-flat-button color="primary" type="button" (click)="save()" [disabled]="!canSave"><mat-icon>save</mat-icon> {{ working ? 'Saving…' : 'Save' }}</button>
    </mat-dialog-actions>`,
  styles: [`.w-100{width:100%} h2 mat-icon{vertical-align:middle;margin-right:6px} .hint{font-size:12px;color:#6b7a99;margin:4px 0} .err{color:#c62828;font-size:13px}`]
})
export class RoleFormDialogComponent {
  role: any | null;
  form = { rolecode: '', description: '' };
  working = false;
  error = '';

  constructor(private api: SecurityRolesService, private ref: MatDialogRef<RoleFormDialogComponent>, private notify: NotificationsService,
    @Inject(MAT_DIALOG_DATA) data: { role?: any } | null) {
    this.role = data?.role || null;
    if (this.role) { this.form = { rolecode: this.role.rolecode, description: this.role.description || '' }; }
  }

  get codeLocked(): boolean { return !!this.role && (this.role.is_system || this.role.users_count > 0); }
  get codeValid(): boolean { return !this.form.rolecode || ROLE_CODE_PATTERN.test(this.form.rolecode); }
  get canSave(): boolean { return !this.working && ROLE_CODE_PATTERN.test(this.form.rolecode) && !!this.form.description.trim(); }

  save(): void {
    if (!this.canSave) { return; }
    this.working = true; this.error = '';
    const body = { rolecode: this.form.rolecode, description: this.form.description.trim() };
    (this.role ? this.api.updateRole(this.role.id, body) : this.api.createRole(body)).subscribe({
      next: (r: any) => { this.working = false; this.notify.toastrSuccess(r?.message || 'Role saved.'); this.ref.close(true); },
      error: e => {
        this.working = false;
        const errs = e?.error?.errors;
        this.error = (errs ? (Object.values(errs)[0] as string[])?.[0] : '') || e?.error?.message || 'The role could not be saved.';
      },
    });
  }
}
