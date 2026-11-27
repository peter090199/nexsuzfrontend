import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SecurityRolesService } from 'src/app/services/Security/security-roles.service';

/**
 * Security overview on the DEF-MASTERADMIN dashboard: totals, users by role, recent role assignments and recent security
 * activity. Reads GET security-admin/stats (master admin only on the server). Only the master dashboard renders it.
 */
@Component({
  selector: 'app-security-overview',
  template: `
    <section class="so" aria-label="Security overview">
      <header class="so-head">
        <div><h2>Security overview</h2><small>Roles, permissions and recent security changes</small></div>
        <button type="button" class="link" (click)="open()"><mat-icon>security</mat-icon> Manage roles &amp; permissions</button>
      </header>

      <div class="state" *ngIf="error" role="alert"><mat-icon>error_outline</mat-icon> {{ error }} <button type="button" class="link" (click)="load()">Try again</button></div>

      <div class="cards" *ngIf="loading">
        <div class="stat sk" *ngFor="let i of [1,2,3,4]"><span class="skl"></span><span class="skn"></span></div>
      </div>

      <ng-container *ngIf="data && !loading">
        <div class="cards">
          <div class="stat" *ngFor="let c of cards" [attr.title]="c.hint">
            <span class="ico"><mat-icon>{{ c.icon }}</mat-icon></span>
            <span class="lbl">{{ c.label }}</span>
            <strong class="val" [attr.data-testid]="c.id">{{ c.value | number }}</strong>
          </div>
        </div>

        <div class="grid">
          <section class="panel span-5">
            <header><h3>Users by role</h3><small>All accounts</small></header>
            <app-mini-chart type="donut" [slices]="slices" ariaLabel="Users by role" emptyText="No users yet"></app-mini-chart>
            <ul class="bars">
              <li *ngFor="let r of data.users_by_role">
                <div class="bar-head"><span>{{ r.role_code }}</span><strong>{{ r.total }}</strong></div>
                <div class="bar-track" [attr.title]="r.active + ' active'"><span class="bar-fill" [style.width.%]="width(r.total)"></span></div>
              </li>
            </ul>
          </section>

          <section class="panel span-7">
            <header><h3>Recent role assignments</h3><small>Latest 10</small></header>
            <table class="tbl" *ngIf="data.recent_assignments.length; else noAssign">
              <thead><tr><th>When</th><th>Change</th><th>By</th></tr></thead>
              <tbody><tr *ngFor="let a of data.recent_assignments"><td>{{ a.created_at | date:'MMM d, h:mm a' }}</td><td data-no-translate>{{ a.summary }}</td><td data-no-translate>{{ a.actor_name }}</td></tr></tbody>
            </table>
            <ng-template #noAssign><p class="empty">No role assignments yet.</p></ng-template>

            <header class="sub"><h3>Recent security activities</h3><small>Latest 10</small></header>
            <table class="tbl" *ngIf="data.recent_activities.length; else noAct">
              <thead><tr><th>When</th><th>Activity</th><th>By</th></tr></thead>
              <tbody>
                <tr *ngFor="let a of data.recent_activities">
                  <td>{{ a.created_at | date:'MMM d, h:mm a' }}</td>
                  <td data-no-translate><mat-icon class="ai">{{ icon(a.action) }}</mat-icon>{{ a.summary }}</td>
                  <td data-no-translate>{{ a.actor_name }}</td>
                </tr>
              </tbody>
            </table>
            <ng-template #noAct><p class="empty">No security activity recorded yet.</p></ng-template>
          </section>
        </div>
      </ng-container>
    </section>`,
  styles: [`
    .so { display: flex; flex-direction: column; gap: 14px; }
    .so-head { display: flex; align-items: flex-end; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
    h2 { margin: 0; font-size: 18px; color: #14243f; } .so-head small, header small { color: #8a96ab; font-size: 11px; }
    h3 { margin: 0; font-size: 14px; color: #14243f; }
    .link { border: 0; background: none; padding: 4px 8px; border-radius: 6px; font: inherit; font-size: 12px; color: #0a66c2; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; }
    .link:hover { background: #eef5fc; } .link mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 14px; }
    .stat { background: #fff; border: 1px solid #e6ecf5; border-radius: 14px; padding: 16px; display: flex; flex-direction: column; gap: 2px; box-shadow: 0 1px 3px rgba(0, 65, 130, .06); min-width: 0; }
    .ico { width: 38px; height: 38px; border-radius: 10px; background: #e8f1fb; color: #0a4a94; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 6px; }
    .lbl { font-size: 12px; color: #6b7a99; } .val { font-size: 28px; line-height: 1.15; font-weight: 700; color: #14243f; }
    .grid { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 14px; }
    .span-5 { grid-column: span 5; } .span-7 { grid-column: span 7; }
    @media (max-width: 960px) { .span-5, .span-7 { grid-column: span 12; } }
    .panel { background: #fff; border: 1px solid #e6ecf5; border-radius: 14px; padding: 16px 18px 18px; box-shadow: 0 1px 3px rgba(0, 65, 130, .06); min-width: 0; }
    .panel > header { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 8px; } .panel > header.sub { margin-top: 18px; }
    .bars { list-style: none; margin: 14px 0 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
    .bar-head { display: flex; justify-content: space-between; font-size: 12.5px; margin-bottom: 3px; }
    .bar-track { height: 8px; background: #eef2f8; border-radius: 999px; overflow: hidden; } .bar-fill { display: block; height: 100%; background: #0a66c2; border-radius: 999px; }
    .tbl { width: 100%; border-collapse: collapse; font-size: 12.5px; } .tbl th { text-align: left; color: #6b7a99; font-weight: 600; padding: 6px 8px; border-bottom: 1px solid #e6ecf5; }
    .tbl td { padding: 7px 8px; border-bottom: 1px solid #f0f3f9; vertical-align: top; } .tbl td:first-child { white-space: nowrap; color: #6b7a99; }
    .ai { font-size: 16px; width: 16px; height: 16px; vertical-align: -3px; margin-right: 6px; color: #0a4a94; }
    .empty { margin: 8px 0; color: #8a96ab; font-size: 13px; text-align: center; padding: 14px 0; }
    .state { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 10px; background: #fdecea; color: #b42318; font-size: 13px; }
    .sk .skl, .sk .skn { display: block; border-radius: 6px; background: linear-gradient(90deg, #eef2f8 25%, #f6f8fc 50%, #eef2f8 75%); } .sk .skl { height: 12px; width: 60%; margin-bottom: 10px; } .sk .skn { height: 28px; width: 40%; }
  `]
})
export class SecurityOverviewComponent implements OnInit {
  data: any = null;
  loading = true;
  error = '';
  cards: { id: string; label: string; value: number; icon: string; hint: string }[] = [];
  slices: { label: string; value: number; color: string }[] = [];
  private palette = ['#0a66c2', '#6aa7e6', '#9db4d1', '#c4cedd', '#1b8a4b', '#e0a100', '#b42318'];

  constructor(private api: SecurityRolesService, private router: Router) { }

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true; this.error = '';
    this.api.adminStats().subscribe({
      next: (r: any) => {
        this.data = r?.data || null;
        this.loading = false;
        if (!this.data) { return; }
        const d = this.data;
        this.cards = [
          { id: 'total-users', label: 'Total Users', value: d.total_users, icon: 'groups', hint: 'Every account' },
          { id: 'total-roles', label: 'Total Roles', value: d.total_roles, icon: 'admin_panel_settings', hint: 'Roles defined' },
          { id: 'total-permissions', label: 'Total Permissions', value: d.total_permissions, icon: 'vpn_key', hint: 'Granted permission entries: menu and submenu access plus every Add / Edit / Delete / Approve / Manage switched on' },
          { id: 'active-roles', label: 'Active Roles', value: d.active_roles, icon: 'verified_user', hint: 'Roles with at least one active user' },
        ];
        this.slices = (d.users_by_role as any[]).filter(r => r.total > 0).map((r, i) => ({ label: r.role_code, value: r.total, color: this.palette[i % this.palette.length] }));
      },
      error: e => { this.loading = false; this.error = e?.error?.message || 'We couldn\'t load the security overview.'; },
    });
  }

  width(total: number): number {
    const max = Math.max(1, ...(this.data?.users_by_role || []).map((r: any) => r.total));
    return Math.round((total / max) * 100);
  }

  icon(action: string): string {
    return ({ 'role.create': 'add_moderator', 'role.update': 'edit', 'role.delete': 'delete', 'role.assign': 'manage_accounts',
      'role.remove': 'person_remove', 'permission.update': 'security' } as Record<string, string>)[action] || 'history';
  }

  open(): void { this.router.navigate(['/DEF-MASTERADMIN', 'security']); }
}
