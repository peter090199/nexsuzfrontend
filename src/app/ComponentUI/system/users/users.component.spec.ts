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

    it('blocks admins, master admins and your own account, with a reason for the tooltip', () => {
      expect(component.deleteBlockedReason({ ...seeker, role_code: 'DEF-ADMIN' })).toContain('Admin accounts');
      expect(component.deleteBlockedReason({ ...seeker, role_code: 'DEF-MASTERADMIN' })).toContain('Admin accounts');
      expect(component.deleteBlockedReason({ ...seeker, code: 701 })).toContain('your own account');
    });

    it('does not even open the dialog for a blocked account', () => {
      const open = spyOn(TestBed.inject(MatDialog), 'open');
      component.deleteUser({ ...seeker, role_code: 'DEF-ADMIN' });
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
});
