import { NexsuzTestingModule } from 'src/testing/nexsuz-testing.module';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';

import { SecurityRolesComponent } from './security-roles.component';
import { SecurityRolesService } from 'src/app/services/Security/security-roles.service';
import { NotificationsService } from 'src/app/services/Global/notifications.service';

describe('SecurityRolesComponent', () => {
  let component: SecurityRolesComponent;
  let fixture: ComponentFixture<SecurityRolesComponent>;
  let api: SecurityRolesService;

  const role = (over: any = {}) => ({ id: 1, rolecode: 'ZZ-X', description: 'd', is_system: false, users_count: 0, active_users: 0, permissions_count: 0, created_by: 'me', ...over });
  const roles = [role({ id: 1, rolecode: 'DEF-MASTERADMIN', is_system: true, users_count: 1 }), role({ id: 2, rolecode: 'ZZ-EMPTY' }), role({ id: 3, rolecode: 'ZZ-USED', users_count: 2 })];
  const users = [{ code: 701, fullname: 'Me Master', email: 'me@x.test', role_code: 'DEF-MASTERADMIN', status: 'A' }, { code: 720, fullname: 'Sam User', email: 's@x.test', role_code: 'DEF-USERS', status: 'A' },
    { code: 721, fullname: 'Ann Auditor', email: 'a@x.test', role_code: 'ZZ-USED', status: 'I' }];

  beforeEach(async () => {
    sessionStorage.setItem('code', '701');
    await TestBed.configureTestingModule({ imports: [NexsuzTestingModule], schemas: [NO_ERRORS_SCHEMA], declarations: [SecurityRolesComponent] }).compileComponents();
    api = TestBed.inject(SecurityRolesService);
    spyOn(api, 'adminRoles').and.returnValue(of({ success: true, data: roles }));
    spyOn(api, 'adminUsers').and.returnValue(of({ success: true, data: users, total: 3, role_counts: { 'DEF-USERS': 1, 'ZZ-USED': 1, 'DEF-MASTERADMIN': 1 } }));
    spyOn(api, 'auditLog').and.returnValue(of({ success: true, data: [{ id: 1, action: 'role.create', summary: 'Created role ZZ-X', actor_name: 'Me', created_at: '2026-11-24 10:00:00' }], total: 1 }));
    fixture = TestBed.createComponent(SecurityRolesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });
  afterEach(() => sessionStorage.removeItem('code'));

  it('should create and load the roles', () => {
    expect(component).toBeTruthy();
    expect(component.roles.data.map(r => r.rolecode)).toEqual(['DEF-MASTERADMIN', 'ZZ-EMPTY', 'ZZ-USED']);
  });

  it('searches the roles', () => {
    component.roleSearch = 'empty'; component.applyRoleFilter();
    expect(component.roles.filteredData.map(r => r.rolecode)).toEqual(['ZZ-EMPTY']);
    component.clearRoleSearch();
    expect(component.roles.filteredData.length).toBe(3);
  });

  describe('deleting a role', () => {
    it('is blocked for system roles and for roles that still have users, with the reason', () => {
      expect(component.deleteBlockedReason(roles[0])).toContain('System');
      expect(component.deleteBlockedReason(roles[2])).toContain('2 user');
      expect(component.deleteBlockedReason(roles[1])).toBe('');
    });

    it('never opens the confirmation for a blocked role', () => {
      const open = spyOn(TestBed.inject(MatDialog), 'open');
      component.deleteRole(roles[0]);
      component.deleteRole(roles[2]);
      expect(open).not.toHaveBeenCalled();
    });

    it('asks first, deletes, and reloads', () => {
      spyOn(TestBed.inject(MatDialog), 'open').and.returnValue({ afterClosed: () => of(true) } as any);
      const del = spyOn(api, 'deleteRole').and.returnValue(of({ success: true, message: 'Role ZZ-EMPTY deleted.' }));
      const ok = spyOn(TestBed.inject(NotificationsService), 'toastrSuccess');
      component.deleteRole(roles[1]);
      expect(del).toHaveBeenCalledWith(2);
      expect(ok).toHaveBeenCalled();
      expect((api.adminRoles as jasmine.Spy).calls.count()).toBe(2);
    });

    it('does nothing when the confirmation is declined, and shows the server reason when it fails', () => {
      const open = spyOn(TestBed.inject(MatDialog), 'open').and.returnValue({ afterClosed: () => of(false) } as any);
      const del = spyOn(api, 'deleteRole');
      component.deleteRole(roles[1]);
      expect(del).not.toHaveBeenCalled();

      open.and.returnValue({ afterClosed: () => of(true) } as any);
      del.and.returnValue(throwError(() => ({ error: { message: 'Nope' } })));
      const err = spyOn(TestBed.inject(NotificationsService), 'toastrError');
      component.deleteRole(roles[1]);
      expect(err).toHaveBeenCalledWith('Nope');
    });
  });

  it('Add role and Edit role open the form and reload after a save', () => {
    const open = spyOn(TestBed.inject(MatDialog), 'open').and.returnValue({ afterClosed: () => of(true) } as any);
    component.addRole();
    component.editRole(roles[1]);
    expect(open).toHaveBeenCalledTimes(2);
    expect((open.calls.argsFor(1)[1] as any).data.role.rolecode).toBe('ZZ-EMPTY');
    expect((api.adminRoles as jasmine.Spy).calls.count()).toBe(3);
  });

  it('Permissions opens the matrix for that role', () => {
    const open = spyOn(TestBed.inject(MatDialog), 'open').and.returnValue({ afterClosed: () => of(false) } as any);
    component.editPermissions(roles[2]);
    expect((open.calls.mostRecent().args[1] as any).data.role.id).toBe(3);
  });

  describe('role assignment', () => {
    beforeEach(async () => { component.onTab(1); await fixture.whenStable(); });

    it('loads users, role counts and pages from the server', () => {
      expect(api.adminUsers).toHaveBeenCalledWith({ search: '', role: '', page: 1, per_page: 10 });
      expect(component.users.length).toBe(3);
      expect(component.roleCounts['DEF-USERS']).toBe(1);
      component.userSearch = ' sam '; component.userRole = 'DEF-USERS'; component.searchUsers();
      expect((api.adminUsers as jasmine.Spy).calls.mostRecent().args[0]).toEqual({ search: 'sam', role: 'DEF-USERS', page: 1, per_page: 10 });
    });

    it('you cannot select, change or remove your own role', () => {
      expect(component.isSelf(users[0])).toBeTrue();
      component.toggleAllOnPage(true);
      expect(component.selectedUsers.map(u => u.code)).toEqual([720, 721]);
      expect(component.canRemove(users[0])).toBeFalse();
    });

    it('Remove is offered only for an extra role, not for DEF-USERS', () => {
      expect(component.canRemove(users[1])).toBeFalse();
      expect(component.canRemove(users[2])).toBeTrue();
    });

    it('Assign role opens the dialog with the selected users and every role, then refreshes', () => {
      const open = spyOn(TestBed.inject(MatDialog), 'open').and.returnValue({ afterClosed: () => of(true) } as any);
      component.toggle(users[1], true); component.toggle(users[2], true);
      component.assign(component.selectedUsers);
      const data = (open.calls.mostRecent().args[1] as any).data;
      expect(data.users.map((u: any) => u.code)).toEqual([720, 721]);
      expect(data.roles.length).toBe(3);
      expect(component.selected.size).toBe(0);
      expect((api.adminUsers as jasmine.Spy).calls.count()).toBe(2);
    });

    it('removing an assignment asks first and then calls the API', () => {
      spyOn(TestBed.inject(MatDialog), 'open').and.returnValue({ afterClosed: () => of(true) } as any);
      const rm = spyOn(api, 'removeUserRole').and.returnValue(of({ success: true, message: 'ok' }));
      component.removeAssignment(users[2]);
      expect(rm).toHaveBeenCalledWith(721);
    });
  });

  it('loads the activity tab once, on first visit', async () => {
    component.onTab(2); component.onTab(2); await fixture.whenStable();
    expect(api.auditLog).toHaveBeenCalledTimes(1);
    expect(component.audit[0].summary).toBe('Created role ZZ-X');
    expect(component.actionLabel('permission.update')).toBe('Permissions changed');
  });
});
