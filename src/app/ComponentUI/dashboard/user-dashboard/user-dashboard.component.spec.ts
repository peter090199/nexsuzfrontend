import { HttpTestingController } from '@angular/common/http/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NexsuzTestingModule } from 'src/testing/nexsuz-testing.module';
import { _url } from 'src/global-variables';
import { UserDashboardComponent } from './user-dashboard.component';

describe('Job seeker dashboard', () => {
  let fixture: ComponentFixture<UserDashboardComponent>;
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const app = (id: number, status: string) => ({ id, reference: 'APP-' + id, job_title: 'Job ' + id, company: 'ACME', location: null,
    trans_no: 'T' + id, job_available: true, status, applied_at: '2026-11-20T10:00:00Z', updated_at: '2026-11-25T10:00:00Z' });

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [NexsuzTestingModule], declarations: [UserDashboardComponent], schemas: [NO_ERRORS_SCHEMA] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(UserDashboardComponent);
    fixture.detectChanges();
  });

  const flush = (body: any) => { http.expectOne(`${_url}my-applications`).flush({ success: true, ...body }); fixture.detectChanges(); };

  it('shows the counts, the five newest applications, the updates and a chart of the statuses in use', () => {
    flush({ total: 6, counts: { applied_active: 2, review: 1, interview: 1, approved: 1, reject: 1 },
      data: [1, 2, 3, 4, 5, 6].map(i => app(i, i === 1 ? 'approved' : 'applied_active')),
      updates: [{ id: 1, job_title: 'Job 1', status: 'approved', at: '2026-11-26T10:00:00Z' }] });
    const cards = Array.from(el().querySelectorAll('.ud-card strong')).map(s => s.textContent);
    expect(cards).toEqual(['6', '2', '1', '1', '1', '1']);
    expect(el().querySelectorAll('.ud-list li').length).toBe(5);
    expect(el().querySelector('.ud-updates small')!.textContent).toBe('Status changed toHired');   // two parts, so each is translated
    expect(fixture.componentInstance.slices.map(s => s.label)).toEqual(['Pending', 'Under Review', 'Interview', 'Hired', 'Rejected']);
  });

  it('has quick links to Browse Jobs and My Job Applications, and an empty state', () => {
    flush({ total: 0, counts: {}, data: [], updates: [] });
    expect(el().querySelector('a[routerLink="../jobs"]')).not.toBeNull();
    expect(el().querySelector('a[routerLink="../my-applications"]')).not.toBeNull();
    expect(el().textContent).toContain("You haven't applied for any jobs yet");
  });

  it('only reads', () => {
    flush({ total: 0, counts: {}, data: [], updates: [] });
    http.verify();
  });
});
