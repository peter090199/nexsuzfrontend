import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MaterialModule } from 'src/Material/Material.module';
import { ResetDataDialogComponent } from './reset-data-dialog.component';

describe('ResetDataDialogComponent', () => {
  let http: HttpTestingController;
  const preview = (allowed = true) => ({
    accounts_removed: 12, rows_removed: 962, files: 6, allowed, phrase: 'RESET ALL DATA', protected_roles: ['DEF-ADMIN', 'DEF-MASTERADMIN'],
    steps: [
      { group: 'Posts & feed', label: 'Posts', table: 'posts', rows: 3 },
      { group: 'Posts & feed', label: 'Comments', table: 'commentposts', rows: 186 },
      { group: 'Messaging & network', label: 'Messages', table: 'messages', rows: 278 },
      { group: 'Profiles & CV', label: 'Skills', table: 'userskills', rows: 0 },
    ],
    protected: [{ code: '701', fullname: 'Boss', email: 'b@x.test', role_code: 'DEF-MASTERADMIN' }, { code: '714', fullname: 'Adm', email: 'a@x.test', role_code: 'DEF-ADMIN' }],
    kept_tables: [{ table: 'menus', rows: 12 }],
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MaterialModule, FormsModule, NoopAnimationsModule, HttpClientTestingModule],
      declarations: [ResetDataDialogComponent],
      providers: [{ provide: MatDialogRef, useValue: { close: () => { } } }],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  const make = (allowed = true) => {
    const f = TestBed.createComponent(ResetDataDialogComponent);
    f.detectChanges();
    http.expectOne(r => r.url.endsWith('database-admin/reset/preview')).flush({ data: preview(allowed) });
    f.detectChanges();
    return f;
  };

  it('shows what is kept and what goes, grouped, hiding empty groups', () => {
    const f = make();
    const text = (f.nativeElement as HTMLElement).textContent || '';
    expect(text).toContain('Kept: 2 admin accounts');
    expect(text).toContain('Master admin');
    expect(f.componentInstance.groups()).toEqual([{ name: 'Posts & feed', rows: 189 }, { name: 'Messaging & network', rows: 278 }]);
  });

  it('only enables the reset with the exact phrase AND a password', () => {
    const c = make().componentInstance;
    expect(c.canReset).toBeFalse();
    c.phrase = 'reset all data'; c.password = 'pw';
    expect(c.canReset).toBeFalse();               // wrong case
    c.phrase = 'RESET ALL DATA'; c.password = '';
    expect(c.canReset).toBeFalse();               // no password
    c.password = 'pw';
    expect(c.canReset).toBeTrue();
  });

  it('can never reset when the server has it switched off', () => {
    const f = make(false);
    f.componentInstance.phrase = 'RESET ALL DATA'; f.componentInstance.password = 'pw';
    expect(f.componentInstance.canReset).toBeFalse();
    expect((f.nativeElement as HTMLElement).textContent).toContain('switched off on this server');
  });

  it('sends the confirmation to the API, then shows the backup and clears the secrets', () => {
    const f = make(); const c = f.componentInstance;
    c.phrase = 'RESET ALL DATA'; c.password = 'pw'; c.deleteFiles = true;
    c.reset();
    const req = http.expectOne(r => r.url.endsWith('database-admin/reset') && r.method === 'POST');
    expect(req.request.body).toEqual({ password: 'pw', confirm: 'RESET ALL DATA', delete_files: true });
    expect(c.working).toBeTrue();
    req.flush({ message: 'All data was reset. Admin and master admin accounts were kept.', backup: { name: 'db-1.sql.gz', bytes: 5, created_at: 'x' }, data: { rows: 962, files: 6, deleted: [] } });
    f.detectChanges();
    expect(c.result?.backup.name).toBe('db-1.sql.gz');
    expect(c.password).toBe('');
    expect((f.nativeElement as HTMLElement).textContent).toContain('db-1.sql.gz');
  });

  it('shows the server error and stays open when the password is wrong', () => {
    const f = make(); const c = f.componentInstance;
    c.phrase = 'RESET ALL DATA'; c.password = 'bad';
    c.reset();
    http.expectOne(r => r.url.endsWith('database-admin/reset')).flush({ message: 'Your password is incorrect.' }, { status: 422, statusText: 'Unprocessable' });
    f.detectChanges();
    expect(c.error).toBe('Your password is incorrect.');
    expect(c.result).toBeUndefined();
    expect(c.working).toBeFalse();
  });

  it('does not send anything while the form is incomplete', () => {
    const c = make().componentInstance;
    c.reset();
    http.expectNone(r => r.url.endsWith('database-admin/reset'));
  });
});
