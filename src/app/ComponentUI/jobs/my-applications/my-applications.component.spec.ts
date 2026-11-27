import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NexsuzTestingModule } from 'src/testing/nexsuz-testing.module';
import { _url } from 'src/global-variables';
import { MyApplicationsComponent } from './my-applications.component';

describe('My Job Applications', () => {
  let fixture: ComponentFixture<MyApplicationsComponent>;
  let c: MyApplicationsComponent;
  let http: HttpTestingController;
  const app = (id: number, status: string, job: string, company = 'ACME') => ({ id, reference: 'APP-' + id, job_title: job, company, location: 'Manila',
    trans_no: 'TR-' + id, job_available: true, status, applied_at: '2026-11-20T10:00:00Z', updated_at: '2026-11-25T10:00:00Z' });
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [NexsuzTestingModule], declarations: [MyApplicationsComponent] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MyApplicationsComponent);
    c = fixture.componentInstance;
    fixture.detectChanges();
  });

  const flush = (data: any[], counts: any = {}) => {
    http.expectOne(`${_url}my-applications`).flush({ success: true, data, counts });
    fixture.detectChanges();
  };

  it('lists the applications with status badges and counts', () => {
    flush([app(1, 'approved', 'Designer'), app(2, 'reject', 'Tester'), app(3, 'interview', 'Developer')], { approved: 1, reject: 1, interview: 1 });
    expect(el().querySelectorAll('.ma-row:not(.ma-th)').length).toBe(3);
    expect(Array.from(el().querySelectorAll('.ma-row .ma-badge')).map(b => b.textContent!.replace(b.querySelector('mat-icon')!.textContent!, '').trim())).toEqual(['Hired', 'Rejected', 'Interview']);
    expect(el().querySelector('.ma-card.hired strong')!.textContent).toBe('1');
  });

  it('filters by status and searches by title, company or reference', () => {
    flush([app(1, 'approved', 'Designer'), app(2, 'reject', 'Tester', 'Globex'), app(3, 'review', 'Developer')]);
    c.setFilter('reject');
    expect(c.visible.map(a => a.id)).toEqual([2]);
    c.setFilter('reject');                               // clicking the same card again shows everything
    c.search = 'globex';
    expect(c.visible.map(a => a.id)).toEqual([2]);
    c.search = 'APP-3';
    expect(c.visible.map(a => a.id)).toEqual([3]);
  });

  it('shows an empty state with a way to find jobs', () => {
    flush([]);
    expect(el().textContent).toContain("You haven't applied for any jobs yet");
    expect(el().querySelector('a[routerLink="../jobs"]')).not.toBeNull();
  });

  it('builds the progress timeline: reached steps dated, a rejection ends it', () => {
    const steps = c.steps({ status: 'interview', timeline: [{ status: 'applied_active', at: 'a' }, { status: 'review', at: 'b' }, { status: 'interview', at: 'c' }] });
    expect(steps.map(s => `${s.status}:${s.state}`)).toEqual(['applied_active:done', 'review:done', 'interview:current', 'approved:todo']);
    const rejected = c.steps({ status: 'reject', timeline: [{ status: 'applied_active', at: 'a' }, { status: 'reject', at: 'b' }] });
    expect(rejected.map(s => `${s.status}:${s.state}`)).toEqual(['applied_active:done', 'reject:current']);
  });

  it('only reads: it never sends a status change', () => {
    flush([app(1, 'review', 'Designer')]);
    c.open(c.items[0]);
    const req = http.expectOne(`${_url}my-applications/1`);
    expect(req.request.method).toBe('GET');
    http.verify();
  });
});
