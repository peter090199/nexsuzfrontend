import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MaterialModule } from 'src/Material/Material.module';
import { NotificationsService } from 'src/app/services/Global/notifications.service';
import { SubPageHeaderComponent } from '../SubscriptionManagement/shared/sub-page-header.component';
import { DatabaseAdminComponent } from './database-admin.component';
import { DatabaseAdminService } from './database-admin.service';

describe('DatabaseAdminComponent', () => {
  let http: HttpTestingController;
  let confirmAnswer = true;

  beforeEach(async () => {
    confirmAnswer = true;
    await TestBed.configureTestingModule({
      imports: [MaterialModule, FormsModule, NoopAnimationsModule, HttpClientTestingModule],
      declarations: [SubPageHeaderComponent, DatabaseAdminComponent],
      providers: [{ provide: NotificationsService, useValue: { popupWarning: () => Promise.resolve({ isConfirmed: confirmAnswer }) } }],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  const make = () => {
    const f = TestBed.createComponent(DatabaseAdminComponent);
    f.detectChanges();
    return f;
  };

  it('loads the backup tab first and the other tabs only when opened', () => {
    const f = make();
    http.expectOne(r => r.url.endsWith('database-admin/backups')).flush({ data: [{ name: 'db-1.sql.gz', bytes: 2048, created_at: '2026-11-22 10:00:00' }] });
    http.expectNone(r => r.url.endsWith('database-admin/server'));
    f.detectChanges();
    expect(f.componentInstance.backups.length).toBe(1);

    f.componentInstance.open(1);
    http.expectOne(r => r.url.endsWith('database-admin/server')).flush({ data: { database: {}, app: { debug: true, environment: 'production' }, server: { extensions: { zlib: true } } } });
    expect(f.componentInstance.riskyDebug).toBeTrue();
    f.componentInstance.open(1);          // already loaded: no second request
    http.expectNone(r => r.url.endsWith('database-admin/server'));
  });

  it('formats sizes and uptime', () => {
    const c = make().componentInstance;
    http.match(() => true);
    expect(c.fmt(0)).toBe('0 B');
    expect(c.fmt(1536)).toBe('1.5 KB');
    expect(c.fmt(5 * 1024 * 1024 * 1024)).toBe('5.0 GB');
    expect(c.uptime(90061)).toBe('1d 1h');
    expect(c.uptime(3700)).toBe('1h 1m');
  });

  it('selects tables and only sends confirmed maintenance to the API', async () => {
    const c = make().componentInstance;
    http.match(() => true);
    c.tables = [
      { name: 'a', engine: 'InnoDB', rows: 1, data_bytes: 1, index_bytes: 0, free_bytes: 0, total_bytes: 1, collation: 'x' },
      { name: 'b', engine: 'MyISAM', rows: 1, data_bytes: 1, index_bytes: 0, free_bytes: 4096, total_bytes: 1, collation: 'x' },
    ];
    c.selectReclaimable();
    expect(Array.from(c.selected)).toEqual(['b']);
    c.toggleAll(true);
    expect(c.selected.size).toBe(2);

    confirmAnswer = false;
    c.run('optimize');
    await Promise.resolve(); await Promise.resolve();
    http.expectNone(r => r.url.includes('tables/optimize'));

    confirmAnswer = true;
    c.run('optimize', 'a');
    await Promise.resolve(); await Promise.resolve();
    const req = http.expectOne(r => r.url.endsWith('database-admin/tables/optimize'));
    expect(req.request.body).toEqual({ tables: ['a'] });
    req.flush({ message: 'Optimize finished for 1 table(s).', data: [{ table: 'a', status: 'status', message: 'OK' }] });
    expect(c.results.length).toBe(1);
    http.match(() => true);
  });

  it('turns API errors into readable messages', () => {
    expect(DatabaseAdminService.errorMessage({ status: 429 })).toContain('Too many requests');
    expect(DatabaseAdminService.errorMessage({ error: { message: 'Only a master administrator can do this.' } })).toContain('master administrator');
    expect(DatabaseAdminService.errorMessage({ error: { errors: { tables: ['Pick a table'] } } })).toBe('Pick a table');
  });
});
