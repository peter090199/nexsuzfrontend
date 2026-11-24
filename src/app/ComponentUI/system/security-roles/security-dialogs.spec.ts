import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MaterialModule } from 'src/Material/Material.module';
import { NotificationsService } from 'src/app/services/Global/notifications.service';
import { RoleFormDialogComponent } from './role-form-dialog.component';
import { RolePermissionsDialogComponent } from './role-permissions-dialog.component';
import { AssignRoleDialogComponent } from './assign-role-dialog.component';

const ref = jasmine.createSpyObj('MatDialogRef', ['close']);
const notify = jasmine.createSpyObj('NotificationsService', ['toastrSuccess', 'toastrError']);

function setup(component: any, data: any) {
  TestBed.configureTestingModule({
    imports: [HttpClientTestingModule, FormsModule, MaterialModule, NoopAnimationsModule],
    declarations: [component],
    providers: [{ provide: MatDialogRef, useValue: ref }, { provide: NotificationsService, useValue: notify }, { provide: MAT_DIALOG_DATA, useValue: data }],
  });
  const http = TestBed.inject(HttpTestingController);
  const f = TestBed.createComponent(component); f.detectChanges();
  return { f, c: f.componentInstance as any, http };
}

describe('RoleFormDialogComponent', () => {
  beforeEach(() => { ref.close.calls.reset(); notify.toastrSuccess.calls.reset(); });

  it('validates the code and uppercases it', () => {
    const { c } = setup(RoleFormDialogComponent, null);
    expect(c.canSave).toBeFalse();
    c.form.rolecode = 'ab'; c.form.description = 'x'; expect(c.canSave).toBeFalse();
    c.form.rolecode = 'lower'; expect(c.canSave).toBeFalse();
    c.form.rolecode = 'DEF-AUDITOR'; expect(c.canSave).toBeTrue();
    c.form.description = '  '; expect(c.canSave).toBeFalse();
  });

  it('creates a role with POST and closes with true', () => {
    const { c, http } = setup(RoleFormDialogComponent, null);
    c.form = { rolecode: 'DEF-AUDITOR', description: 'Audits' }; c.save();
    const req = http.expectOne(r => r.method === 'POST' && r.url.endsWith('security-admin/roles'));
    expect(req.request.body).toEqual({ rolecode: 'DEF-AUDITOR', description: 'Audits' });
    req.flush({ success: true, message: 'Role DEF-AUDITOR created.' });
    expect(ref.close).toHaveBeenCalledWith(true);
  });

  it('edits with PUT, and a system role or one with users cannot change its code', () => {
    const sys = setup(RoleFormDialogComponent, { role: { id: 1, rolecode: 'DEF-ADMIN', description: 'a', is_system: true, users_count: 2 } });
    expect(sys.c.codeLocked).toBeTrue();
    TestBed.resetTestingModule();
    const used = setup(RoleFormDialogComponent, { role: { id: 9, rolecode: 'ZZ-USED', description: 'a', is_system: false, users_count: 3 } });
    expect(used.c.codeLocked).toBeTrue();
    TestBed.resetTestingModule();
    const free = setup(RoleFormDialogComponent, { role: { id: 7, rolecode: 'ZZ-FREE', description: 'a', is_system: false, users_count: 0 } });
    expect(free.c.codeLocked).toBeFalse();
    free.c.form.description = 'changed'; free.c.save();
    const req = free.http.expectOne(r => r.method === 'PUT' && r.url.endsWith('security-admin/roles/7'));
    req.flush({ success: true, message: 'ok' });
    expect(ref.close).toHaveBeenCalledWith(true);
  });

  it('shows the server reason and stays open', () => {
    const { c, http } = setup(RoleFormDialogComponent, null);
    c.form = { rolecode: 'DEF-ADMIN', description: 'x' }; c.save();
    http.expectOne(r => r.method === 'POST').flush({ message: 'x', errors: { rolecode: ['The rolecode has already been taken.'] } }, { status: 422, statusText: 'x' });
    expect(c.error).toBe('The rolecode has already been taken.');
    expect(ref.close).not.toHaveBeenCalled();
  });
});

describe('RolePermissionsDialogComponent', () => {
  const tree = (locked = false) => ({ success: true, data: { role: { id: 5, rolecode: 'ZZ-P', locked }, items: [
    { type: 'menu', id: 1, name: 'Home', routes: 'home', icon: 'home', active: true, flags: ['add', 'edit', 'delete', 'approve', 'manage'], view: true, add: false, edit: true, delete: false, approve: false, manage: false, children: [] },
    { type: 'menu', id: 2, name: 'System', routes: '#', icon: 'settings', active: true, flags: [], view: false, add: false, edit: false, delete: false, approve: false, manage: false,
      children: [{ type: 'submenu', id: 20, name: 'Users', routes: 'user', icon: '', active: true, flags: ['add', 'edit', 'delete', 'approve', 'manage'], view: false, add: false, edit: false, delete: false, approve: false, manage: false }] },
  ] } });

  function open(locked = false) {
    const s = setup(RolePermissionsDialogComponent, { role: { id: 5, rolecode: 'ZZ-P' } });
    s.http.expectOne(r => r.url.endsWith('security-admin/roles/5/permissions')).flush(tree(locked));
    s.f.detectChanges();
    return s;
  }
  const row = (c: any, type: string, id: number) => c.rows.find((r: any) => r.type === type && r.id === id);
  beforeEach(() => { ref.close.calls.reset(); });

  it('lists menus and submenus and starts clean', () => {
    const { c } = open();
    expect(c.rows.map((r: any) => r.name)).toEqual(['Home', 'System', 'Users']);
    expect(c.dirtyCount).toBe(0);
    expect(c.viewCount).toBe(1);
  });

  it('a flag turns View on, a submenu turns its menu on, and View off clears flags and submenus', () => {
    const { c } = open();
    c.setFlag(row(c, 'submenu', 20), 'delete', true);
    expect(row(c, 'submenu', 20).view).toBeTrue();
    expect(row(c, 'menu', 2).view).toBeTrue();

    c.setView(row(c, 'menu', 1), false);
    expect(row(c, 'menu', 1).edit).toBeFalse();

    c.setView(row(c, 'menu', 2), false);
    expect(row(c, 'submenu', 20).view).toBeFalse();
    expect(row(c, 'submenu', 20).delete).toBeFalse();
  });

  it('saves only what changed, with every flag, and closes with true', () => {
    const { c, http } = open();
    c.setFlag(row(c, 'menu', 1), 'manage', true);
    expect(c.dirtyCount).toBe(1);
    c.save();
    const req = http.expectOne(r => r.method === 'PUT' && r.url.endsWith('security-admin/roles/5/permissions'));
    expect(req.request.body.items).toEqual([{ type: 'menu', id: 1, view: true, add: false, edit: true, delete: false, approve: false, manage: true }]);
    req.flush({ success: true, message: 'Permissions saved (1 granted, 0 revoked).' });
    expect(ref.close).toHaveBeenCalledWith(true);
  });

  it('is read-only for a locked role and shows the server error on a failed save', () => {
    const locked = open(true);
    expect(locked.c.locked).toBeTrue();
    TestBed.resetTestingModule();
    const { c, http } = open();
    c.setView(row(c, 'menu', 1), false); c.save();
    http.expectOne(r => r.method === 'PUT').flush({ message: 'No view.' }, { status: 422, statusText: 'x' });
    expect(c.error).toBe('No view.');
    expect(ref.close).not.toHaveBeenCalled();
  });

  it('filters modules and keeps a menu when a submenu matches', () => {
    const { c } = open();
    c.filter = 'users';
    expect(c.visible().map((r: any) => r.name)).toEqual(['System', 'Users']);
  });
});

describe('AssignRoleDialogComponent', () => {
  const users = [{ code: 720, fullname: 'Sam', role_code: 'DEF-USERS' }, { code: 721, fullname: 'Ann', role_code: 'DEF-USERS' }];
  const roles = [{ rolecode: 'DEF-ADMIN', description: 'Admin' }, { rolecode: 'ZZ-X', description: 'x' }];
  beforeEach(() => { ref.close.calls.reset(); notify.toastrSuccess.calls.reset(); });

  it('needs a role, posts the selected users, and reports a reason for each skipped user', () => {
    const { c, http } = setup(AssignRoleDialogComponent, { users, roles });
    c.save(); http.expectNone(() => true);
    c.roleCode = 'ZZ-X'; c.save();
    const req = http.expectOne(r => r.method === 'POST' && r.url.endsWith('security-admin/users/assign'));
    expect(req.request.body).toEqual({ codes: [720, 721], role_code: 'ZZ-X' });
    req.flush({ success: true, message: '1 updated, 1 skipped.', data: { updated: 1, skipped: 1, results: [{ code: '720', ok: true, message: 'Sam: DEF-USERS → ZZ-X' }, { code: '721', ok: false, message: 'Already has the role ZZ-X.' }] } });
    expect(c.results.length).toBe(2);
    expect(c.changed).toBeTrue();
    expect(ref.close).not.toHaveBeenCalled();        // more than one result: let the admin read it
  });

  it('closes straight away for one user that succeeded, and shows the reason for one that was refused', () => {
    const one = setup(AssignRoleDialogComponent, { users: [users[0]], roles });
    one.c.roleCode = 'DEF-ADMIN'; one.c.save();
    one.http.expectOne(r => r.method === 'POST').flush({ success: true, data: { updated: 1, skipped: 0, results: [{ code: '720', ok: true, message: 'ok' }] } });
    expect(ref.close).toHaveBeenCalledWith(true);

    TestBed.resetTestingModule(); ref.close.calls.reset();
    const bad = setup(AssignRoleDialogComponent, { users: [users[0]], roles });
    bad.c.roleCode = 'DEF-ADMIN'; bad.c.save();
    bad.http.expectOne(r => r.method === 'POST').flush({ success: false, message: 'You can\'t change your own role.', data: { updated: 0, skipped: 1, results: [{ code: '720', ok: false, message: 'You can\'t change your own role.' }] } }, { status: 422, statusText: 'x' });
    expect(bad.c.results[0].message).toContain('own role');
    expect(bad.c.changed).toBeFalse();
    expect(ref.close).not.toHaveBeenCalled();
  });
});
