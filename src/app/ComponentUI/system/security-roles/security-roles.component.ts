import { Component, OnInit, ViewChild } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';

import { NotificationsService } from 'src/app/services/Global/notifications.service';
import { SecurityRolesService } from 'src/app/services/Security/security-roles.service';
import { SettingsConfirmDialogComponent } from 'src/app/ComponentUI/profile/settings/confirm-dialog/confirm-dialog.component';
import { RoleFormDialogComponent } from './role-form-dialog.component';
import { RolePermissionsDialogComponent } from './role-permissions-dialog.component';
import { AssignRoleDialogComponent } from './assign-role-dialog.component';

/**
 * Role & Permission Management (DEF-MASTERADMIN). Roles: create / edit / delete / permissions. Assignments: give users a
 * role, change or remove it. Activity: the audit trail. The API enforces every rule; the UI only mirrors them.
 */
@Component({
  selector: 'app-security-roles',
  templateUrl: './security-roles.component.html',
  styleUrls: ['./security-roles.component.css']
})
export class SecurityRolesComponent implements OnInit {
  // ---------------- roles
  roleSearch = '';
  roleColumns: string[] = ['rolecode', 'description', 'users_count', 'permissions_count', 'created_by', 'actions'];
  roles = new MatTableDataSource<any>([]);
  rolesLoading = false;
  rolesError = '';
  pageSizeOptions = [5, 10, 25, 100];

  @ViewChild('rolesPaginator') set rolesPaginator(p: MatPaginator) { if (p) { this.roles.paginator = p; } }
  @ViewChild('rolesSort') set rolesSort(s: MatSort) { if (s) { this.roles.sort = s; } }

  // ---------------- assignments
  userColumns: string[] = ['select', 'fullname', 'email', 'role_code', 'status', 'actions'];
  users: any[] = [];
  usersTotal = 0;
  usersPage = 0;
  usersPageSize = 10;
  userSearch = '';
  userRole = '';
  roleCounts: Record<string, number> = {};
  selected = new Map<string, any>();
  usersLoading = false;
  usersError = '';
  private usersLoaded = false;

  // ---------------- activity
  auditColumns: string[] = ['created_at', 'action', 'summary', 'actor_name'];
  audit: any[] = [];
  auditTotal = 0;
  auditPage = 0;
  auditPageSize = 25;
  auditLoading = false;
  auditError = '';
  private auditLoaded = false;

  constructor(
    private api: SecurityRolesService,
    private dialog: MatDialog,
    private notify: NotificationsService
  ) {}

  ngOnInit(): void {
    this.loadRoles();
  }

  // ================= roles =================
  async loadRoles(): Promise<void> {
    this.rolesLoading = true; this.rolesError = '';
    try {
      const r: any = await firstValueFrom(this.api.adminRoles());
      this.roles.data = r?.data || [];
    } catch (e: any) {
      this.rolesError = e?.error?.message || 'Could not load the roles.';
    } finally {
      this.rolesLoading = false;
    }
  }

  applyRoleFilter(): void { this.roles.filter = this.roleSearch.trim().toLowerCase(); }
  clearRoleSearch(): void { this.roleSearch = ''; this.applyRoleFilter(); }
  get allRoles(): any[] { return this.roles.data; }

  addRole(): void {
    this.dialog.open(RoleFormDialogComponent, { width: '480px', maxWidth: '95vw', disableClose: true, autoFocus: false, data: null })
      .afterClosed().subscribe(ok => { if (ok) { this.loadRoles(); this.auditLoaded = false; } });
  }

  editRole(role: any): void {
    this.dialog.open(RoleFormDialogComponent, { width: '480px', maxWidth: '95vw', disableClose: true, autoFocus: false, data: { role } })
      .afterClosed().subscribe(ok => { if (ok) { this.loadRoles(); this.auditLoaded = false; this.usersLoaded = false; } });
  }

  editPermissions(role: any): void {
    this.dialog.open(RolePermissionsDialogComponent, { width: '860px', maxWidth: '96vw', disableClose: true, autoFocus: false, data: { role } })
      .afterClosed().subscribe(ok => { if (ok) { this.loadRoles(); this.auditLoaded = false; } });
  }

  /** Why Delete is off for this role (the API enforces the same rules), or '' when it is allowed. */
  deleteBlockedReason(role: any): string {
    if (role.is_system) { return 'System roles can\'t be deleted'; }
    if (role.users_count > 0) { return `${role.users_count} user(s) still have this role`; }
    return '';
  }

  deleteRole(role: any): void {
    if (this.deleteBlockedReason(role)) { return; }
    this.dialog.open(SettingsConfirmDialogComponent, {
      width: '440px',
      data: {
        title: `Delete ${role.rolecode}?`, icon: 'delete_forever', danger: true, confirmText: 'Delete role',
        message: `This removes the role and its ${role.permissions_count} menu permission(s). No user has this role. It cannot be undone.`
      }
    }).afterClosed().subscribe(ok => {
      if (!ok) { return; }
      this.api.deleteRole(role.id).subscribe({
        next: (r: any) => { this.notify.toastrSuccess(r?.message || 'Role deleted.'); this.loadRoles(); this.auditLoaded = false; },
        error: e => this.notify.toastrError(e?.error?.message || 'The role could not be deleted.')
      });
    });
  }

  // ================= assignments =================
  async loadUsers(): Promise<void> {
    this.usersLoading = true; this.usersError = '';
    try {
      const r: any = await firstValueFrom(this.api.adminUsers({ search: this.userSearch.trim(), role: this.userRole, page: this.usersPage + 1, per_page: this.usersPageSize }));
      this.users = r?.data || [];
      this.usersTotal = r?.total || 0;
      this.roleCounts = r?.role_counts || {};
      this.usersLoaded = true;
    } catch (e: any) {
      this.usersError = e?.error?.message || 'Could not load the users.';
    } finally {
      this.usersLoading = false;
    }
  }

  searchUsers(): void { this.usersPage = 0; this.loadUsers(); }
  onUsersPage(e: PageEvent): void { this.usersPage = e.pageIndex; this.usersPageSize = e.pageSize; this.loadUsers(); }
  filterByRole(role: string): void { this.userRole = this.userRole === role ? '' : role; this.searchUsers(); }

  isSelf(user: any): boolean { return String(user?.code) === String(sessionStorage.getItem('code')); }
  isSelected(user: any): boolean { return this.selected.has(String(user.code)); }
  toggle(user: any, on: boolean): void { on ? this.selected.set(String(user.code), user) : this.selected.delete(String(user.code)); }
  get selectableOnPage(): any[] { return this.users.filter(u => !this.isSelf(u)); }
  get allOnPageSelected(): boolean { return this.selectableOnPage.length > 0 && this.selectableOnPage.every(u => this.isSelected(u)); }
  toggleAllOnPage(on: boolean): void { this.selectableOnPage.forEach(u => this.toggle(u, on)); }
  get selectedUsers(): any[] { return Array.from(this.selected.values()); }

  /** Assign Role button (the selected users) and the per-row change icon (one user) share this. */
  assign(users: any[]): void {
    if (!users.length) { return; }
    this.dialog.open(AssignRoleDialogComponent, { width: '520px', maxWidth: '95vw', disableClose: true, autoFocus: false, data: { users, roles: this.allRoles } })
      .afterClosed().subscribe(changed => { if (changed) { this.afterAssignmentChange(); } });
  }

  /** "Remove" an assignment = back to the standard role, DEF-USERS. */
  removeAssignment(user: any): void {
    this.dialog.open(SettingsConfirmDialogComponent, {
      width: '440px',
      data: { title: `Remove ${user.role_code}?`, icon: 'person_remove', danger: true, confirmText: 'Remove role',
        message: `${user.fullname} goes back to the standard role (DEF-USERS) and is signed out.` }
    }).afterClosed().subscribe(ok => {
      if (!ok) { return; }
      this.api.removeUserRole(user.code).subscribe({
        next: (r: any) => { this.notify.toastrSuccess(r?.message || 'Role removed.'); this.afterAssignmentChange(); },
        error: e => this.notify.toastrError(e?.error?.message || 'The role could not be removed.')
      });
    });
  }

  private afterAssignmentChange(): void { this.selected.clear(); this.loadUsers(); this.loadRoles(); this.auditLoaded = false; }

  /** Remove is for a user who has an extra role; a standard DEF-USERS account has none, and you can't touch yourself. */
  canRemove(user: any): boolean { return !this.isSelf(user) && user.role_code !== 'DEF-USERS'; }

  // ================= activity =================
  async loadAudit(): Promise<void> {
    this.auditLoading = true; this.auditError = '';
    try {
      const r: any = await firstValueFrom(this.api.auditLog(this.auditPage + 1, this.auditPageSize));
      this.audit = r?.data || [];
      this.auditTotal = r?.total || 0;
      this.auditLoaded = true;
    } catch (e: any) {
      this.auditError = e?.error?.message || 'Could not load the activity.';
    } finally {
      this.auditLoading = false;
    }
  }

  onAuditPage(e: PageEvent): void { this.auditPage = e.pageIndex; this.auditPageSize = e.pageSize; this.loadAudit(); }

  actionLabel(action: string): string {
    return ({ 'role.create': 'Role created', 'role.update': 'Role edited', 'role.delete': 'Role deleted', 'role.assign': 'Role assigned',
      'role.remove': 'Role removed', 'permission.update': 'Permissions changed' } as Record<string, string>)[action] || action;
  }

  actionIcon(action: string): string {
    return ({ 'role.create': 'add_moderator', 'role.update': 'edit', 'role.delete': 'delete', 'role.assign': 'manage_accounts',
      'role.remove': 'person_remove', 'permission.update': 'security' } as Record<string, string>)[action] || 'history';
  }

  // ================= tabs =================
  onTab(index: number): void {
    if (index === 1 && !this.usersLoaded && !this.usersLoading) { this.loadUsers(); }
    if (index === 2 && !this.auditLoaded && !this.auditLoading) { this.loadAudit(); }
  }
}
