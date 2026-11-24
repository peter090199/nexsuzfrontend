import { NexsuzTestingModule } from 'src/testing/nexsuz-testing.module';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { NotificationsService } from 'src/app/services/Global/notifications.service';

import { UsersComponent } from './users.component';

describe('UsersComponent', () => {
  let component: UsersComponent;
  let fixture: ComponentFixture<UsersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NexsuzTestingModule],
      schemas: [NO_ERRORS_SCHEMA],
      declarations: [ UsersComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    sessionStorage.setItem('code', '701');
    fixture = TestBed.createComponent(UsersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });
  afterEach(() => sessionStorage.removeItem('code'));

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('delete account', () => {
    const seeker = { id: 1, code: 810, fullname: 'Sam Seeker', role_code: 'DEF-USERS', status: 'A' };
    const recruiter = { id: 2, code: 811, fullname: 'Rae Recruiter', role_code: 'DEF-CLIENT', status: 'A' };

    it('allows deleting individuals and companies', () => {
      expect(component.deleteBlockedReason(seeker)).toBe('');
      expect(component.deleteBlockedReason(recruiter)).toBe('');
    });

    it('allows admins and other master admins, but blocks your own account (icon shown disabled with a reason)', () => {
      expect(component.deleteBlockedReason({ ...seeker, role_code: 'DEF-ADMIN' })).toBe('');
      expect(component.deleteBlockedReason({ ...seeker, role_code: 'DEF-MASTERADMIN' })).toBe('');
      expect(component.deleteBlockedReason({ ...seeker, code: 701 })).toContain('your own account');
    });

    it('does not even open the dialog for a blocked account', () => {
      const open = spyOn(TestBed.inject(MatDialog), 'open');
      component.deleteUser({ ...seeker, code: 701 });
      expect(open).not.toHaveBeenCalled();
    });

    it('removes the row from the table once the dialog reports a delete', () => {
      component.dataSource.data = [seeker, recruiter];
      const toast = spyOn(TestBed.inject(NotificationsService), 'toastrSuccess');
      spyOn(TestBed.inject(MatDialog), 'open').and.returnValue({ afterClosed: () => of(true) } as any);
      component.deleteUser(seeker);
      expect(component.dataSource.data.map(u => u.code)).toEqual([811]);
      expect(toast).toHaveBeenCalled();
    });

    it('keeps the row when the dialog is cancelled', () => {
      component.dataSource.data = [seeker, recruiter];
      spyOn(TestBed.inject(MatDialog), 'open').and.returnValue({ afterClosed: () => of(false) } as any);
      component.deleteUser(seeker);
      expect(component.dataSource.data.length).toBe(2);
    });
  });

  describe('add DEF-ADMIN', () => {
    afterEach(() => sessionStorage.removeItem('role'));
    const button = () => (fixture.nativeElement as HTMLElement).querySelector('[data-testid="add-admin"]');

    it('shows the button only to a DEF-MASTERADMIN', () => {
      for (const role of ['DEF-ADMIN', 'DEF-USERS', 'DEF-CLIENT']) {
        sessionStorage.setItem('role', role); fixture.detectChanges();
        expect(button()).withContext(role).toBeNull();
      }
      sessionStorage.setItem('role', 'DEF-MASTERADMIN'); fixture.detectChanges();
      expect(button()).not.toBeNull();
    });

    it('does nothing for anyone else, and reloads the table after an account is created', () => {
      const open = spyOn(TestBed.inject(MatDialog), 'open').and.returnValue({ afterClosed: () => of(true) } as any);
      sessionStorage.setItem('role', 'DEF-ADMIN');
      component.addAdmin();
      expect(open).not.toHaveBeenCalled();

      sessionStorage.setItem('role', 'DEF-MASTERADMIN');
      const reload = spyOn(component, 'getUsers');
      component.addAdmin();
      expect(open).toHaveBeenCalledTimes(1);
      expect(reload).toHaveBeenCalled();
    });
  });

  describe('edit account', () => {
    afterEach(() => sessionStorage.removeItem('role'));
    const icon = () => (fixture.nativeElement as HTMLElement).querySelector('[data-testid="edit-user"]');
    const row = { id: 1, code: 810, fullname: 'Sam Seeker', role_code: 'DEF-USERS', status: 'A' };

    it('shows the edit icon only to a DEF-MASTERADMIN', () => {
      component.dataSource.data = [row];
      for (const role of ['DEF-ADMIN', 'DEF-USERS', 'DEF-CLIENT']) {
        sessionStorage.setItem('role', role); fixture.detectChanges();
        expect(icon()).withContext(role).toBeNull();
      }
      sessionStorage.setItem('role', 'DEF-MASTERADMIN'); fixture.detectChanges();
      expect(icon()).not.toBeNull();
    });

    it('opens nothing for anyone else, and reloads the table after a save', () => {
      const open = spyOn(TestBed.inject(MatDialog), 'open').and.returnValue({ afterClosed: () => of(true) } as any);
      sessionStorage.setItem('role', 'DEF-ADMIN');
      component.editUser(row);
      expect(open).not.toHaveBeenCalled();

      sessionStorage.setItem('role', 'DEF-MASTERADMIN');
      const reload = spyOn(component, 'getUsers');
      component.editUser(row);
      expect(open).toHaveBeenCalledTimes(1);
      expect(reload).toHaveBeenCalled();
    });
  });

  describe('columns by role', () => {
    afterEach(() => sessionStorage.removeItem('role'));

    it('DEF-ADMIN (and anyone else) gets no ID, Role or Actions column; DEF-MASTERADMIN does', () => {
      for (const role of ['DEF-ADMIN', 'DEF-USERS', 'DEF-CLIENT']) {
        sessionStorage.setItem('role', role);
        expect(component.displayedColumns).withContext(role).not.toContain('id');
        expect(component.displayedColumns).withContext(role).not.toContain('role_code');
        expect(component.displayedColumns).withContext(role).not.toContain('actions');
      }
      sessionStorage.setItem('role', 'DEF-MASTERADMIN');
      expect(component.displayedColumns[0]).toBe('id');
      expect(component.displayedColumns).toContain('role_code');
      expect(component.displayedColumns).toContain('actions');
      expect(component.displayedColumns).toBe(component.displayedColumns);   // same array each time
    });
  });
});
