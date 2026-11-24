import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NotificationsService } from 'src/app/services/Global/notifications.service';
import { SecurityRolesService } from 'src/app/services/Security/security-roles.service';

/**
 * Give one or more users a role. A user holds ONE role, so this replaces their current one. The API applies every rule
 * (not yourself, not the last master admin, no job seeker <-> recruiter switch, only a master admin may assign
 * DEF-MASTERADMIN) and reports a reason for each user it skips; the others still go through.
 */
@Component({
  selector: 'app-assign-role-dialog',
  template: `
    <button mat-icon-button type="button" class="close-button" aria-label="Close" [mat-dialog-close]="changed" [disabled]="working"><mat-icon>close</mat-icon></button>
    <h2 mat-dialog-title><mat-icon>manage_accounts</mat-icon> Assign role</h2>
    <mat-dialog-content>
      <mat-progress-bar *ngIf="working" mode="indeterminate"></mat-progress-bar>
      <p class="err" *ngIf="error" role="alert">{{ error }}</p>

      <ng-container *ngIf="!results">
        <p class="who">{{ data.users.length === 1 ? data.users[0].fullname + ' (' + data.users[0].role_code + ')' : data.users.length + ' users selected' }}</p>
        <ul class="list" *ngIf="data.users.length > 1"><li *ngFor="let u of data.users">{{ u.fullname }} <small>{{ u.role_code }}</small></li></ul>
        <mat-form-field appearance="outline" class="w-100">
          <mat-label>New role</mat-label>
          <mat-select [(ngModel)]="roleCode" [disabled]="working" name="role">
            <mat-option *ngFor="let r of data.roles" [value]="r.rolecode">{{ r.rolecode }}<small class="opt"> {{ r.description }}</small></mat-option>
          </mat-select>
        </mat-form-field>
        <p class="hint">This replaces the current role. The user is signed out and gets the new role's access when they sign in again.</p>
      </ng-container>

      <ng-container *ngIf="results">
        <p class="ok" *ngIf="updated"><mat-icon>check_circle</mat-icon> {{ updated }} updated</p>
        <ul class="res"><li *ngFor="let x of results" [class.bad]="!x.ok"><mat-icon>{{ x.ok ? 'check' : 'block' }}</mat-icon> {{ x.message }}</li></ul>
      </ng-container>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-stroked-button type="button" [mat-dialog-close]="changed" [disabled]="working">{{ results ? 'Close' : 'Cancel' }}</button>
      <button mat-flat-button color="primary" type="button" *ngIf="!results" (click)="save()" [disabled]="!roleCode || working"><mat-icon>check</mat-icon> {{ working ? 'Assigning…' : 'Assign role' }}</button>
    </mat-dialog-actions>`,
  styles: [`
    .w-100{width:100%} h2 mat-icon{vertical-align:middle;margin-right:6px} .who{font-weight:600;margin:4px 0 8px}
    .list{max-height:120px;overflow:auto;margin:0 0 10px;padding-left:18px;font-size:13px} .list small,.opt{color:#6b7a99;font-size:11px}
    .hint{font-size:12px;color:#6b7a99} .err{color:#c62828;font-size:13px} .ok{display:flex;align-items:center;gap:6px;color:#1b6a3d;font-weight:600}
    .res{list-style:none;margin:0;padding:0;font-size:13px} .res li{display:flex;align-items:center;gap:6px;padding:3px 0} .res li.bad{color:#b42318} .res mat-icon{font-size:18px;width:18px;height:18px}
  `]
})
export class AssignRoleDialogComponent {
  roleCode = '';
  working = false; error = ''; changed = false; updated = 0;
  results: { code: string; ok: boolean; message: string }[] | null = null;

  constructor(private api: SecurityRolesService, private ref: MatDialogRef<AssignRoleDialogComponent>, private notify: NotificationsService,
    @Inject(MAT_DIALOG_DATA) public data: { users: any[]; roles: any[] }) { }

  save(): void {
    if (!this.roleCode || this.working) { return; }
    this.working = true; this.error = '';
    this.api.assignRole(this.data.users.map(u => u.code), this.roleCode).subscribe({
      next: (r: any) => this.done(r?.data),
      error: e => {
        this.working = false;
        if (e?.error?.data?.results) { this.done(e.error.data); } else { this.error = e?.error?.message || e?.error?.errors?.codes?.[0] || 'The role could not be assigned.'; }
      },
    });
  }

  private done(d: any): void {
    this.working = false;
    this.results = d?.results || [];
    this.updated = d?.updated || 0;
    this.changed = this.updated > 0;
    if (this.changed) { this.notify.toastrSuccess(`${this.updated} user${this.updated === 1 ? '' : 's'} updated.`); }
    if (this.results!.length === 1 && this.results![0].ok) { this.ref.close(true); }   // one user, one success: nothing more to read
  }
}
