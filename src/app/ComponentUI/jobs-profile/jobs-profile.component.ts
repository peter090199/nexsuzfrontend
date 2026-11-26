import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { JobListService } from 'src/app/services/Jobs/job-list.service';
import { AuthService } from 'src/app/services/auth.service';
import { NotificationsService } from 'src/app/services/Global/notifications.service';
import { SharedRoutinesService } from 'src/app/services/Function/shared-routines.service';
import { AppliedStatusDialogComponent } from '../jobs/applied-status-dialog/applied-status-dialog.component';
import { FeatureService } from 'src/app/services/AccountPlan/feature.service';
import { ImagesService } from 'src/app/services/images/images.service';
import { SavedJobsStateService } from 'src/app/services/Jobs/saved-jobs-state.service';
import { JobTemplate, JobTemplateService } from 'src/app/services/Jobs/job-template.service';
import { Observable, of } from 'rxjs';

@Component({
  selector: 'app-jobs-profile',
  templateUrl: './jobs-profile.component.html',
  styleUrls: ['./jobs-profile.component.css']
})
export class JobsProfileComponent implements OnInit {

  jobs: any[] = [];
  savedJobs: any[] = [];

  selectedJob: any = null;

  isLoading = false;
  isSavedLoading = false;

  saved = false;

  currentUserCode: string | null = null;

  skeletonRows = Array.from({ length: 5 });

  constructor(
    private jobListServices: JobListService,
    public feature: FeatureService,
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private dialog: MatDialog,
    private alert: NotificationsService,
    private sharedService: ImagesService,
    public sharedRoutines: SharedRoutinesService,
    private savedJobsState: SavedJobsStateService,
    private templateSvc: JobTemplateService
  ) { }

  // the template a job was posted with (cached per id, so the async pipe keeps the same stream)
  private readonly noTemplate$: Observable<JobTemplate | null> = of(null);
  templateFor(job: any): Observable<JobTemplate | null> {
    return job?.template_id ? this.templateSvc.get(Number(job.template_id)) : this.noTemplate$;
  }

  // =========================================================
  // INIT
  // =========================================================

  async ngOnInit(): Promise<void> {

    this.currentUserCode = this.authService.getAuthCode();

    await this.getJobPosting();
    await this.getSavedJobs();

    this.route.paramMap.subscribe(async params => {

      const transNo = params.get('transNo');

      if (!transNo) {
        return;
      }

      const job = this.jobs.find(
        j => String(j.transNo) === String(transNo)
      );

      if (job) {
        this.selectedJob = { ...job };

        this.updateSavedState();

        await this.loadAppliedStatus(this.selectedJob);
      }
    });
  }

  // =========================================================
  // GET ACTIVE JOBS
  // =========================================================

  async getJobPosting(): Promise<void> {

    try {

      this.isLoading = true;

      const res = await firstValueFrom(
        this.jobListServices.getActiveJobs()
      );

      if (res?.success) {

        this.jobs = (res.data || []).map((job: any) => ({
          ...job,
          applied_status: 'default',
          job_image: this.sharedService.cleanImageUrl(
            job.job_image
          )
        }));

      } else {

        this.jobs = [];

      }

    } catch (error) {

      console.error('Get active jobs error:', error);

      this.jobs = [];

    } finally {

      this.isLoading = false;

    }
  }

  // =========================================================
  // GET SAVED JOBS
  // =========================================================
  async getSavedJobs(): Promise<void> {
    try {
      this.isSavedLoading = true;
      const res = await firstValueFrom(
        this.jobListServices.getSaveJobs()
      );

      if (res?.success) {
        this.savedJobs = (res.data || []).map((job: any) => ({
          ...job,
          job_image: this.sharedService.cleanImageUrl(
            job.job_image
          )
        }));

      } else {

        this.savedJobs = [];

      }

      this.updateSavedState();

    } catch (error) {

      console.error('Get saved jobs error:', error);

      this.savedJobs = [];

      this.saved = false;

    } finally {

      this.isSavedLoading = false;

    }
  }

  // =========================================================
  // CHECK IF SELECTED JOB IS SAVED
  // =========================================================

  updateSavedState(): void {

    if (!this.selectedJob) {
      this.saved = false;
      return;
    }

    this.saved = this.savedJobs.some(
      savedJob =>
        Number(savedJob.job_id) ===
        Number(this.selectedJob.job_id)
    );
  }

  // =========================================================
  // LOAD APPLICATION STATUS
  // =========================================================

  async loadAppliedStatus(job: any): Promise<void> {

    if (!job?.transNo) {
      return;
    }

    try {

      const res = await firstValueFrom(
        this.jobListServices.getAppliedStatus(job.transNo)
      );

      const status =
        res?.success && res?.data?.length
          ? res.data[0].applied_status
          : 'default';

      job.applied_status = status;

      this.selectedJob = {
        ...job,
        applied_status: status
      };

    } catch (error) {

      console.error('Load applied status error:', error);

      this.selectedJob = {
        ...job,
        applied_status: 'default'
      };
    }
  }

  // =========================================================
  // BUTTON STATUS
  // =========================================================

  getButtonStatus(job: any): string {

    if (!job) {
      return 'default';
    }

    if (job.code === this.currentUserCode) {
      return 'applied_active';
    }

    return job.applied_status || 'default';
  }

  getStatusIcon(status: string): string {

    switch (status) {

      case 'applied_active':
        return 'hourglass_top';

      case 'review':
        return 'search';

      case 'interview':
        return 'event';

      case 'approved':
        return 'check_circle';

      case 'reject':
        return 'cancel';

      default:
        return 'send';
    }
  }

  getStatusText(status: string): string {

    switch (status) {

      case 'applied_active':
        return 'Applied';

      case 'review':
        return 'Under Review';

      case 'interview':
        return 'Interview Scheduled';

      case 'approved':
        return 'Hired';

      case 'reject':
        return 'Rejected';

      default:
        return 'Apply Now';
    }
  }

  getStatusColor(status: string): string {

    switch (status) {

      case 'applied_active':
        return '#f4895e';

      case 'review':
        return '#ffb300';

      case 'interview':
        return '#6a5acd';

      case 'approved':
        return '#388e3c';

      case 'reject':
        return '#d32f2f';

      default:
        return '#3071e0';
    }
  }

  // =========================================================
  // APPLY
  // =========================================================

  onApplyClick(job: any): void {

    if (!this.feature.can('APPLY_JOBS')) {

      this.sharedRoutines.openUpgradeModal();

      return;
    }

    const status = this.getButtonStatus(job);

    if (status === 'default' && this.isClosed(job)) {
      this.alert.toastrWarning('Applications for this job are closed.');
      return;
    }

    if (status === 'default') {

      this.router.navigate([
        '/' + this.sharedRoutines.getRole() + '/apply-job',
        job.transNo
      ]);

      return;
    }

    this.openAppliedStatusDialog(job);
  }

  // =========================================================
  // APPLICATION STATUS DIALOG
  // =========================================================

  openAppliedStatusDialog(job: any): void {

    const dialogRef = this.dialog.open(
      AppliedStatusDialogComponent,
      {
        width: '460px',
        data: job
      }
    );

    dialogRef.afterClosed().subscribe(async res => {

      if (res) {

        await this.getJobPosting();

        const updated = this.jobs.find(
          x =>
            String(x.transNo) ===
            String(this.selectedJob?.transNo)
        );

        if (updated) {

          this.selectedJob = {
            ...updated
          };

          this.updateSavedState();

          await this.loadAppliedStatus(
            this.selectedJob
          );
        }
      }
    });
  }

  // =========================================================
  // SELECT JOB
  // =========================================================

  async selectJob(job: any): Promise<void> {

    if (!job) {
      return;
    }

    this.selectedJob = {
      ...job
    };

    this.updateSavedState();

    // Navigate only when the job has transNo
    if (job.transNo) {

      this.router.navigate([
        '/' + this.sharedRoutines.getRole() +
        '/recommended-jobs',
        job.transNo
      ]);
    }

    await this.loadAppliedStatus(
      this.selectedJob
    );
  }

  // =========================================================
  // SAVE / UNSAVE JOB
  // =========================================================

  async saveJobs(job: any): Promise<void> {

    if (!job?.job_id) {

      console.error('Job ID is missing:', job);

      return;
    }

    try {

      const res = await firstValueFrom(
        this.jobListServices.saveJob(
          Number(job.job_id)
        )
      );

      if (res?.saved === true) {

        this.saved = true;

        this.alert.toastrSuccess(
          'Job saved successfully'
        );

      } else if (res?.saved === false) {

        this.saved = false;

        this.alert.toastrWarning(
          'Job removed from saved jobs'
        );
      }

      // Reload saved jobs from database (and the top-bar saved-jobs list)
      await this.getSavedJobs();
      this.savedJobsState.load();

    } catch (error) {

      console.error(
        'Save job error:',
        error
      );

      this.alert.toastrError(
        'Unable to save job'
      );
    }
  }

  // =========================================================
  // CLOSE SIDEBAR
  // =========================================================

  // ---------------------------------------------------------------- display helpers for the job detail
  workplace(job: any): string {
    const map: Record<string, string> = { 'Onsite': 'On-site', 'Work From Home': 'Remote', 'Hybrid': 'Hybrid' };
    return map[job?.work_type] || job?.work_type || '';
  }

  salaryText(job: any): string {
    const has = (v: any) => v !== null && v !== undefined && v !== '' && !isNaN(Number(v));
    if (!has(job?.min_salary) && !has(job?.max_salary)) { return ''; }
    const sym = this.sharedRoutines.getCurrencyByCode(job?.currency || '')?.symbol || job?.currency || '';
    const n = (v: any) => Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 });
    const range = has(job.min_salary) && has(job.max_salary) ? `${sym}${n(job.min_salary)} – ${sym}${n(job.max_salary)}` : `${sym}${n(has(job.min_salary) ? job.min_salary : job.max_salary)}`;
    const unit: Record<string, string> = { Hourly: 'hour', Monthly: 'month', Yearly: 'year' };
    return job.salary_period ? `${range} / ${unit[job.salary_period] || job.salary_period}` : range;
  }

  skillsOf(job: any): string[] {
    let s = job?.required_skills;
    if (typeof s === 'string') { try { s = JSON.parse(s); } catch { s = []; } }
    return Array.isArray(s) ? s.filter((x: string) => !!x) : [];
  }

  deadlineOf(job: any): Date | null {
    return job?.application_deadline ? new Date(String(job.application_deadline).substring(0, 10) + 'T00:00:00') : null;
  }

  /** the API refuses applications after the deadline (end of that day); this only explains it to the user */
  isClosed(job: any): boolean {
    const d = this.deadlineOf(job);
    if (!d) { return false; }
    d.setDate(d.getDate() + 1);
    return d.getTime() <= Date.now();
  }

  daysLeft(job: any): number | null {
    const d = this.deadlineOf(job);
    if (!d || this.isClosed(job)) { return null; }
    return Math.ceil((d.getTime() + 86400000 - Date.now()) / 86400000);
  }

  /** DEF-CLIENT sees the job only: no "Jobs for you" list, no Apply, no Save */
  get isRecruiter(): boolean { return this.sharedRoutines.getRole() === 'DEF-CLIENT'; }

  closeSidebar(): void {

    this.selectedJob = null;

    this.saved = false;
  }
}