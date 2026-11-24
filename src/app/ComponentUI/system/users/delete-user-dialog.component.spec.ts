import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MaterialModule } from 'src/Material/Material.module';
import { DeleteUserDialogComponent } from './delete-user-dialog.component';

describe('DeleteUserDialogComponent', () => {
  let http: HttpTestingController;

  const preview = (over: any = {}) => ({
    user: { code: 810, fullname: 'Sam Seeker', email: 'sam@example.test', role_code: 'DEF-USERS' },
    can_delete: true, reason: null, rows_removed: 40, jobs: 0, others_applications: 0, files: 2,
    steps: [
      { group: 'Posts & feed', label: 'Posts', table: 'posts', rows: 3 },
      { group: 'Posts & feed', label: 'Comments', table: 'commentposts', rows: 30 },
      { group: 'Messaging & network', label: 'Messages', table: 'messages', rows: 6 },
      { group: 'Profiles & CV', label: 'Skills', table: 'userskills', rows: 0 },
    ], ...over,
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MaterialModule, FormsModule, NoopAnimationsModule, HttpClientTestingModule],
      declarations: [DeleteUserDialogComponent],
      providers: [{ provide: MatDialogRef, useValue: { close: () => { } } }, { provide: MAT_DIALOG_DATA, useValue: { user: { code: 810, fullname: 'Sam Seeker' } } }],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  const make = (p: any = preview()) => {
    const f = TestBed.createComponent(DeleteUserDialogComponent);
    f.detectChanges();
    http.expectOne(r => r.url.endsWith('users/810/delete-preview')).flush({ success: true, data: p });
    f.detectChanges();
    return f;
  };

  it('previews what goes, grouped, hiding empty groups', () => {
    const f = make();
    expect(f.componentInstance.groups()).toEqual([{ name: 'Posts & feed', rows: 33 }, { name: 'Messaging & network', rows: 6 }]);
    expect((f.nativeElement as HTMLElement).textContent).toContain('permanently deletes');
  });

  it('only enables Delete when DELETE is typed exactly AND a password is given', () => {
    const c = make().componentInstance;
    expect(c.canDelete).toBeFalse();
    c.typed = 'delete'; c.password = 'pw';
    expect(c.canDelete).toBeFalse();
    c.typed = 'DELETE'; c.password = '';
    expect(c.canDelete).toBeFalse();
    c.password = 'pw';
    expect(c.canDelete).toBeTrue();
  });

  it('shows the reason and offers no delete for an account that cannot be deleted', () => {
    const f = make({ user: preview().user, can_delete: false, reason: "Admin and master admin accounts can't be deleted here." });
    f.componentInstance.typed = 'DELETE'; f.componentInstance.password = 'pw';
    expect(f.componentInstance.canDelete).toBeFalse();
    expect((f.nativeElement as HTMLElement).textContent).toContain("can't be deleted here");
  });

  it("warns when other people's applications will go with a recruiter's jobs", () => {
    const f = make(preview({ jobs: 2, others_applications: 5 }));
    const text = (f.nativeElement as HTMLElement).textContent || '';
    expect(text).toContain('5 applications');
    expect(text).toContain('2 jobs');
  });

  it('sends the confirmation, then shows the backup and clears the secrets', () => {
    const f = make(); const c = f.componentInstance;
    c.typed = 'DELETE'; c.password = 'pw';
    c.remove();
    const req = http.expectOne(r => r.method === 'DELETE' && r.url.endsWith('users/810'));
    expect(req.request.body).toEqual({ password: 'pw', confirm: 'DELETE' });
    req.flush({ success: true, message: 'Sam Seeker and all of their data were deleted.', backup: { name: 'db-1.sql.gz', reused: true }, data: { rows: 40, files: 1 } });
    f.detectChanges();
    expect(c.done?.backup.name).toBe('db-1.sql.gz');
    expect(c.password).toBe('');
    expect((f.nativeElement as HTMLElement).textContent).toContain('db-1.sql.gz');
  });

  it('shows the server error and stays open when the password is wrong', () => {
    const f = make(); const c = f.componentInstance;
    c.typed = 'DELETE'; c.password = 'bad';
    c.remove();
    http.expectOne(r => r.method === 'DELETE').flush({ message: 'Your password is incorrect.' }, { status: 422, statusText: 'x' });
    expect(c.error).toBe('Your password is incorrect.');
    expect(c.done).toBeUndefined();
    expect(c.working).toBeFalse();
  });

  it('sends nothing while the form is incomplete', () => {
    const c = make().componentInstance;
    c.remove();
    http.expectNone(r => r.method === 'DELETE');
  });
});
