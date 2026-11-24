import { NexsuzTestingModule } from 'src/testing/nexsuz-testing.module';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { SecurityRolesService } from 'src/app/services/Security/security-roles.service';
import { SecurityOverviewComponent } from './security-overview.component';

describe('SecurityOverviewComponent', () => {
  let fixture: ComponentFixture<SecurityOverviewComponent>;
  let component: SecurityOverviewComponent;
  let api: SecurityRolesService;

  const stats = {
    total_users: 5, total_roles: 5, total_permissions: 76, active_roles: 3,
    users_by_role: [{ role_code: 'DEF-USERS', total: 2, active: 2 }, { role_code: 'DEF-ADMIN', total: 2, active: 2 }, { role_code: 'DEF-CLIENT', total: 0, active: 0 }],
    recent_assignments: [{ id: 1, action: 'role.assign', summary: 'Changed Sam from DEF-USERS to DEF-ADMIN', actor_name: 'Boss', created_at: '2026-11-24 10:00:00' }],
    recent_activities: [{ id: 2, action: 'permission.update', summary: 'Changed permissions of DEF-ADMIN: 2 granted, 0 revoked', actor_name: 'Boss', created_at: '2026-11-24 10:05:00' }],
  };

  async function setup(result: any) {
    await TestBed.configureTestingModule({ imports: [NexsuzTestingModule], schemas: [NO_ERRORS_SCHEMA], declarations: [SecurityOverviewComponent] }).compileComponents();
    api = TestBed.inject(SecurityRolesService);
    spyOn(api, 'adminStats').and.returnValue(result);
    fixture = TestBed.createComponent(SecurityOverviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }
  const el = () => fixture.nativeElement as HTMLElement;

  it('shows total users, roles, permissions and active roles', async () => {
    await setup(of({ success: true, data: stats }));
    const v = (id: string) => el().querySelector(`[data-testid="${id}"]`)?.textContent?.trim();
    expect(v('total-users')).toBe('5');
    expect(v('total-roles')).toBe('5');
    expect(v('total-permissions')).toBe('76');
    expect(v('active-roles')).toBe('3');
  });

  it('draws users by role (roles with nobody are left out of the chart) and lists recent assignments and activities', async () => {
    await setup(of({ success: true, data: stats }));
    expect(component.slices.map(s => s.label)).toEqual(['DEF-USERS', 'DEF-ADMIN']);
    expect(component.width(2)).toBe(100);
    expect(el().textContent).toContain('Changed Sam from DEF-USERS to DEF-ADMIN');
    expect(el().textContent).toContain('Changed permissions of DEF-ADMIN');
  });

  it('says so when there is no activity yet', async () => {
    await setup(of({ success: true, data: { ...stats, recent_assignments: [], recent_activities: [] } }));
    expect(el().textContent).toContain('No role assignments yet');
    expect(el().textContent).toContain('No security activity recorded yet');
  });

  it('shows an error with a retry when the stats cannot be loaded', async () => {
    await setup(throwError(() => ({ error: { message: 'Only a master administrator can do this.' } })));
    expect(el().querySelector('.state')?.textContent).toContain('Only a master administrator');
    (api.adminStats as jasmine.Spy).and.returnValue(of({ success: true, data: stats }));
    component.load(); fixture.detectChanges();
    expect(component.error).toBe('');
    expect(component.cards.length).toBe(4);
  });

  it('opens the Security page for the master admin', async () => {
    await setup(of({ success: true, data: stats }));
    const nav = spyOn(TestBed.inject(Router), 'navigate').and.returnValue(Promise.resolve(true));
    component.open();
    expect(nav).toHaveBeenCalledWith(['/DEF-MASTERADMIN', 'security']);
  });
});
