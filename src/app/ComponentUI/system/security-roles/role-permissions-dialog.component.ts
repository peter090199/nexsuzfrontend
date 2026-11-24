import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NotificationsService } from 'src/app/services/Global/notifications.service';
import { SecurityRolesService } from 'src/app/services/Security/security-roles.service';

export const PERMISSION_FLAGS = ['add', 'edit', 'delete', 'approve', 'manage'] as const;
type Flag = typeof PERMISSION_FLAGS[number];

/**
 * What a role can open (View = the menu / submenu access the sidebar reads) and what it may Add, Edit, Delete, Approve
 * and Manage on each. The API re-checks every rule; this dialog only keeps the boxes consistent (a flag needs View, a
 * submenu needs its menu).
 */
@Component({
  selector: 'app-role-permissions-dialog',
  template: `
    <button mat-icon-button type="button" class="close-button" aria-label="Close" [mat-dialog-close]="false" [disabled]="working"><mat-icon>close</mat-icon></button>
    <h2 mat-dialog-title><mat-icon>security</mat-icon> Permissions: {{ data.role.rolecode }}</h2>
    <mat-dialog-content>
      <mat-progress-bar *ngIf="loading || working" mode="indeterminate"></mat-progress-bar>
      <p class="err" *ngIf="error" role="alert">{{ error }}</p>
      <p class="lock" *ngIf="locked"><mat-icon>lock</mat-icon> {{ lockReason }}</p>

      <div class="tools" *ngIf="!loading && rows.length">
        <mat-form-field appearance="outline" class="search" floatLabel="never"><input matInput placeholder="Filter modules" [(ngModel)]="filter" aria-label="Filter modules" autocomplete="off"></mat-form-field>
        <small>{{ viewCount }} of {{ rows.length }} modules visible to this role</small>
      </div>

      <div class="wrap" *ngIf="!loading && rows.length">
        <table class="pm" role="grid">
          <thead><tr><th>Module</th><th>View</th><th *ngFor="let f of flags">{{ f | titlecase }}</th></tr></thead>
          <tbody>
            <tr *ngFor="let r of visible()" [class.sub]="r.type === 'submenu'" [class.off]="!r.active">
              <td class="name"><mat-icon *ngIf="r.type === 'menu'">{{ r.icon || 'folder' }}</mat-icon><span>{{ r.name }}</span><em *ngIf="!r.active">inactive</em></td>
              <td><mat-checkbox [checked]="r.view" [disabled]="locked || working" (change)="setView(r, $event.checked)" [attr.aria-label]="'View ' + r.name"></mat-checkbox></td>
              <td *ngFor="let f of flags">
                <mat-checkbox *ngIf="r.flags.includes(f); else na" [checked]="r[f]" [disabled]="locked || working" (change)="setFlag(r, f, $event.checked)" [attr.aria-label]="(f | titlecase) + ' ' + r.name"></mat-checkbox>
                <ng-template #na><span class="na">—</span></ng-template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="hint" *ngIf="!locked">View opens the module in the sidebar at once. Add, Edit, Delete, Approve and Manage are saved for the role and need View.</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <span class="dirty" *ngIf="dirtyCount && !locked">{{ dirtyCount }} unsaved change{{ dirtyCount === 1 ? '' : 's' }}</span>
      <button mat-stroked-button type="button" [mat-dialog-close]="false" [disabled]="working">{{ locked ? 'Close' : 'Cancel' }}</button>
      <button mat-flat-button color="primary" type="button" *ngIf="!locked" (click)="save()" [disabled]="working || loading || !dirtyCount"><mat-icon>save</mat-icon> {{ working ? 'Saving…' : 'Save permissions' }}</button>
    </mat-dialog-actions>`,
  styles: [`
    h2 mat-icon{vertical-align:middle;margin-right:6px} .err{color:#c62828;font-size:13px} .hint{font-size:12px;color:#6b7a99}
    .lock{display:flex;align-items:center;gap:6px;background:#fff4e0;color:#8a5300;border-radius:10px;padding:8px 12px;font-size:13px}
    .tools{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap} .tools small{color:#6b7a99}
    .search{width:260px} .wrap{overflow:auto;max-height:56vh;border:1px solid #e6ecf5;border-radius:12px}
    table.pm{border-collapse:collapse;width:100%;min-width:640px} th,td{padding:6px 10px;text-align:center;border-bottom:1px solid #eef2f8;font-size:13px}
    th{position:sticky;top:0;background:#f6f8fc;font-size:12px;color:#3b4a68;z-index:1} th:first-child,td.name{text-align:left}
    td.name{display:flex;align-items:center;gap:8px} td.name mat-icon{font-size:18px;width:18px;height:18px;color:#0a4a94}
    tr.sub td.name{padding-left:34px} tr.sub td.name span{color:#3b4a68} tr.off{opacity:.55} td.name em{font-size:10px;color:#8a96ab;font-style:normal;border:1px solid #d5deec;border-radius:99px;padding:0 6px}
    .na{color:#c4cedd} .dirty{margin-right:auto;font-size:12px;color:#8a5300}
  `]
})
export class RolePermissionsDialogComponent implements OnInit {
  flags = PERMISSION_FLAGS;
  rows: any[] = [];
  private original = new Map<string, string>();
  locked = false;
  lockReason = '';
  loading = true; working = false; error = ''; filter = '';

  constructor(private api: SecurityRolesService, private ref: MatDialogRef<RolePermissionsDialogComponent>, private notify: NotificationsService,
    @Inject(MAT_DIALOG_DATA) public data: { role: any }) { }

  ngOnInit(): void {
    this.api.rolePermissions(this.data.role.id).subscribe({
      next: (r: any) => {
        this.locked = !!r?.data?.role?.locked;
        this.lockReason = r?.data?.role?.lock_reason || `${this.data.role.rolecode}'s permissions can't be changed here.`;
        // flatten: each menu, then its submenus
        this.rows = (r?.data?.items || []).flatMap((m: any) => [{ ...m, children: undefined, parent: null }, ...(m.children || []).map((s: any) => ({ ...s, parent: m.id }))]);
        this.rows.forEach(x => this.original.set(this.key(x), this.sig(x)));
        this.loading = false;
      },
      error: e => { this.loading = false; this.error = e?.error?.message || 'Could not load the permissions.'; },
    });
  }

  private key(r: any): string { return r.type + ':' + r.id; }
  private sig(r: any): string { return [r.view, ...PERMISSION_FLAGS.map(f => r[f])].map(Boolean).join(); }

  visible(): any[] {
    const f = this.filter.trim().toLowerCase();
    if (!f) { return this.rows; }
    const hit = new Set(this.rows.filter(r => r.name.toLowerCase().includes(f)).map(r => this.key(r)));
    // keep a menu when one of its submenus matches, and a submenu when its menu matches
    return this.rows.filter(r => hit.has(this.key(r)) || (r.type === 'menu' && this.rows.some(c => c.parent === r.id && hit.has(this.key(c)))) || (r.type === 'submenu' && hit.has('menu:' + r.parent)));
  }

  get viewCount(): number { return this.rows.filter(r => r.view).length; }
  get dirtyCount(): number { return this.rows.filter(r => this.original.get(this.key(r)) !== this.sig(r)).length; }

  setView(r: any, on: boolean): void {
    r.view = on;
    if (!on) {
      PERMISSION_FLAGS.forEach(f => r[f] = false);
      if (r.type === 'menu') { this.rows.filter(c => c.parent === r.id).forEach(c => { c.view = false; PERMISSION_FLAGS.forEach(f => c[f] = false); }); }
    } else if (r.type === 'submenu') {
      const p = this.rows.find(m => m.type === 'menu' && m.id === r.parent);
      if (p) { p.view = true; }
    }
  }

  setFlag(r: any, f: Flag, on: boolean): void {
    r[f] = on;
    if (on) { this.setView(r, true); }
  }

  save(): void {
    if (this.working || !this.dirtyCount) { return; }
    this.working = true; this.error = '';
    const items = this.rows.filter(r => this.original.get(this.key(r)) !== this.sig(r))
      .map(r => ({ type: r.type, id: r.id, view: !!r.view, add: !!r.add, edit: !!r.edit, delete: !!r.delete, approve: !!r.approve, manage: !!r.manage }));
    this.api.saveRolePermissions(this.data.role.id, items).subscribe({
      next: (r: any) => { this.working = false; this.notify.toastrSuccess(r?.message || 'Permissions saved.'); this.ref.close(true); },
      error: e => { this.working = false; this.error = e?.error?.message || 'The permissions could not be saved.'; },
    });
  }
}
