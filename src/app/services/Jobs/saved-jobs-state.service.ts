import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { JobListService } from './job-list.service';

/**
 * The signed-in user's saved jobs, shared between the top bar (icon + list) and the jobs page (Save button),
 * so saving or removing a job in one place shows in the other at once.
 */
@Injectable({ providedIn: 'root' })
export class SavedJobsStateService {
  private readonly listSubject = new BehaviorSubject<any[]>([]);
  readonly list$ = this.listSubject.asObservable();
  loading = false;

  constructor(private jobs: JobListService) { }

  get list(): any[] { return this.listSubject.value; }

  load(): void {
    this.loading = true;
    this.jobs.getSaveJobs().subscribe({
      next: (res: any) => {
        this.listSubject.next(res?.success ? (res.data || []) : []);
        this.loading = false;
      },
      error: () => { this.listSubject.next([]); this.loading = false; }
    });
  }

  /** remove a job from the saved list (the same toggle call the Save button uses) */
  remove(job: any, done?: () => void): void {
    if (!job?.job_id) { return; }
    this.jobs.saveJob(Number(job.job_id)).subscribe({
      next: () => { this.load(); done?.(); },
      error: () => { done?.(); }
    });
  }
}
