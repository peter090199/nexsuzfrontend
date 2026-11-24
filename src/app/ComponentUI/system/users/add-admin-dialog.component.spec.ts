import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MaterialModule } from 'src/Material/Material.module';
import { NotificationsService } from 'src/app/services/Global/notifications.service';
import { AddAdminDialogComponent } from './add-admin-dialog.component';

describe('AddAdminDialogComponent', () => {
  let http: HttpTestingController;
  const ref = jasmine.createSpyObj('MatDialogRef', ['close']);
  const notify = jasmine.createSpyObj('NotificationsService', ['toastrSuccess', 'toastrError']);

  const make = () => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, FormsModule, MaterialModule, NoopAnimationsModule],
      declarations: [AddAdminDialogComponent],
      providers: [{ provide: MatDialogRef, useValue: ref }, { provide: NotificationsService, useValue: notify }],
    });
    http = TestBed.inject(HttpTestingController);
    const f = TestBed.createComponent(AddAdminDialogComponent); f.detectChanges();
    return f.componentInstance;
  };
  const fill = (c: AddAdminDialogComponent) => Object.assign(c.form, { fname: 'Ann', lname: 'Lee', email: 'ann@example.test', password: 'Aa1!aaaa', password_confirmation: 'Aa1!aaaa' });

  beforeEach(() => { ref.close.calls.reset(); notify.toastrSuccess.calls.reset(); });

  it('needs names, a valid email and a matching password of 8+ characters', () => {
    const c = make();
    expect(c.canSave).toBeFalse();
    fill(c); expect(c.canSave).toBeTrue();
    c.form.password_confirmation = 'nope'; expect(c.canSave).toBeFalse();
    c.form.password = c.form.password_confirmation = 'short'; expect(c.canSave).toBeFalse();
  });

  it('posts to users/admin WITHOUT any role, notifies and closes with true', () => {
    const c = make(); fill(c); c.save();
    const req = http.expectOne(r => r.method === 'POST' && r.url.endsWith('users/admin'));
    expect(Object.keys(req.request.body)).not.toContain('role_code');
    req.flush({ success: true, message: 'Ann Lee was added as DEF-ADMIN.' });
    expect(notify.toastrSuccess).toHaveBeenCalled();
    expect(ref.close).toHaveBeenCalledWith(true);
  });

  it('shows the server validation error and stays open', () => {
    const c = make(); fill(c); c.save();
    http.expectOne(r => r.method === 'POST').flush({ message: 'x', errors: { email: ['The email has already been taken.'] } }, { status: 422, statusText: 'x' });
    expect(c.error).toBe('The email has already been taken.');
    expect(c.working).toBeFalse();
    expect(ref.close).not.toHaveBeenCalled();
  });
});
