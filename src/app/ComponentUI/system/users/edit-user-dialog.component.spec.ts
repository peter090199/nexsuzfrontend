import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MaterialModule } from 'src/Material/Material.module';
import { NotificationsService } from 'src/app/services/Global/notifications.service';
import { EditUserDialogComponent } from './edit-user-dialog.component';

describe('EditUserDialogComponent', () => {
  let http: HttpTestingController;
  const ref = jasmine.createSpyObj('MatDialogRef', ['close']);
  const notify = jasmine.createSpyObj('NotificationsService', ['toastrSuccess', 'toastrError']);
  const user = { code: 810, fullname: 'Sam Seeker', fname: 'Sam', lname: 'Seeker', email: 'sam@example.test', contactno: '917', company: 'Acme', role_code: 'DEF-USERS' };

  const make = () => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, FormsModule, MaterialModule, NoopAnimationsModule],
      declarations: [EditUserDialogComponent],
      providers: [{ provide: MatDialogRef, useValue: ref }, { provide: NotificationsService, useValue: notify }, { provide: MAT_DIALOG_DATA, useValue: { user } }],
    });
    http = TestBed.inject(HttpTestingController);
    const f = TestBed.createComponent(EditUserDialogComponent); f.detectChanges();
    return f.componentInstance;
  };
  beforeEach(() => { ref.close.calls.reset(); notify.toastrSuccess.calls.reset(); });

  it('starts from the account details and needs names and a valid email', () => {
    const c = make();
    expect(c.form.email).toBe('sam@example.test');
    expect(c.canSave).toBeTrue();
    c.form.email = 'nope'; expect(c.canSave).toBeFalse();
  });

  it('PATCHes the details only (no role, status or password), notifies and closes with true', () => {
    const c = make(); c.form.company = 'New Co'; c.save();
    const req = http.expectOne(r => r.method === 'PATCH' && r.url.endsWith('users/810'));
    expect(Object.keys(req.request.body).sort()).toEqual(['company', 'contactno', 'email', 'fname', 'lname']);
    req.flush({ success: true, message: 'Sam Seeker was updated.' });
    expect(notify.toastrSuccess).toHaveBeenCalled();
    expect(ref.close).toHaveBeenCalledWith(true);
  });

  it('shows the server error and stays open', () => {
    const c = make(); c.save();
    http.expectOne(r => r.method === 'PATCH').flush({ message: 'x', errors: { email: ['The email has already been taken.'] } }, { status: 422, statusText: 'x' });
    expect(c.error).toBe('The email has already been taken.');
    expect(ref.close).not.toHaveBeenCalled();
  });
});
