import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { NexsuzTestingModule } from 'src/testing/nexsuz-testing.module';
import { RecruitmentService } from 'src/app/services/Jobs/recruitment.service';
import { JobCandidatesComponent } from './job-candidates.component';

describe('JobCandidatesComponent latest data', () => {
  const row = (id: number, status: string, applied: string, updated: string) =>
    ({ applied_id: id, applied_status: status, applied_at: applied, updated_at: updated, fullname: 'C' + id, email: '', phone_number: '', transNo: 'T' });
  const list = (data: any[]) => ({ success: true, data, counts: {}, total: data.length, job: {}, transitions: {} }) as any;

  it('shows the latest activity first in every tab and picks up new data by itself', () => {
    TestBed.configureTestingModule({ imports: [NexsuzTestingModule], declarations: [JobCandidatesComponent], schemas: [NO_ERRORS_SCHEMA] });
    const api = TestBed.inject(RecruitmentService);
    const older = row(1, 'review', '2026-11-01 08:00:00', '2026-11-20 08:00:00');
    const newer = row(2, 'review', '2026-11-10 08:00:00', '2026-11-10 08:00:00');
    const get = spyOn(api, 'allCandidates').and.returnValue(of(list([newer, older])));
    const component = TestBed.createComponent(JobCandidatesComponent).componentInstance;
    component.ngOnInit();

    expect(component.sorted.map(c => c.applied_id)).toEqual([1, 2]);       // 1 changed status last
    component.setFilter('review');
    expect(component.sorted.map(c => c.applied_id)).toEqual([1, 2]);

    get.and.returnValue(of(list([row(3, 'review', '2026-11-27 09:00:00', '2026-11-27 09:00:00'), newer, older])));
    component.refreshQuietly();
    expect(component.sorted.map(c => c.applied_id)).toEqual([3, 1, 2]);
    expect(component.isLoading).toBeFalse();
    component.ngOnDestroy();
  });
});
