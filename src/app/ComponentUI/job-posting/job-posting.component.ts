import { FEATURE } from 'src/app/services/AccountPlan/feature-access.map';
import { Component, OnInit, ViewChild } from '@angular/core';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { MatPaginator } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { firstValueFrom } from 'rxjs';
import { SharedRoutinesService } from 'src/app/services/Function/shared-routines.service';
import { JobPostingUIComponent } from 'src/app/ComponentSharedUI/job-posting-ui/job-posting-ui.component';
import { JobPostingService } from 'src/app/services/Jobs/job-posting.service';
import { NotificationsService } from 'src/app/services/Global/notifications.service';
import { Router } from '@angular/router';
import { JobViewDetailsComponent } from './job-view-details/job-view-details.component';
import { PostingJobComponent } from 'src/app/ComponentSharedUI/posting-job/posting-job.component';
import { ListAppliedJobsComponent } from '../jobs/list-applied-jobs/list-applied-jobs.component';
import { ImagesService } from 'src/app/services/images/images.service';

@Component({
  selector: 'app-job-posting',
  templateUrl: './job-posting.component.html',
  styleUrls: ['./job-posting.component.css']
})
export class JobPostingComponent implements OnInit {
  /** feature codes for the template */
  readonly FEATURE = FEATURE;
  searchKey: string = '';
  isLoading: boolean = false;
  failed = false;
  statusFilter: 'all' | 'active' | 'draft' = 'all';
  sortBy: 'newest' | 'oldest' | 'title' = 'newest';

  dataSource = new MatTableDataSource<any>([]);
  jobPosting: any[] = [];
  questions: any[] = [];
  pageSizeOptions: number[] = [5, 10, 25, 100];
  success: boolean = false;
  /** the cards on screen: filtered, sorted and paged by the data source */
  readonly jobs$ = this.dataSource.connect();

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  constructor(
    private jobServices: JobPostingService, private router: Router,
    public dialog: MatDialog,
    private notificationsService: NotificationsService,
    private sharedService: ImagesService,
    private sharedRoutines: SharedRoutinesService
  ) { }

  ngOnInit(): void {
    this.getJobPosting();
  }

  applyFilter() {
    const key = this.searchKey.trim().toLocaleLowerCase();
    const rows = this.jobPosting
      .filter(j => this.statusFilter === 'all' || this.statusOf(j) === this.statusFilter)
      .filter(j => !key || [j.job_name, j.job_position, j.company, j.location, j.work_type, j.employment_type, j.transNo]
        .some(v => String(v ?? '').toLocaleLowerCase().includes(key)));
    const time = (j: any) => new Date(j.created_at || 0).getTime();
    rows.sort((x, y) => this.sortBy === 'title' ? String(x.job_name).localeCompare(String(y.job_name))
      : this.sortBy === 'oldest' ? time(x) - time(y) : time(y) - time(x));
    this.dataSource.data = rows;
    this.paginator?.firstPage();
  }

  clearSearch() {
    this.searchKey = '';
    this.applyFilter();
  }

  setStatus(status: 'all' | 'active' | 'draft'): void {
    this.statusFilter = status;
    this.applyFilter();
  }

  statusOf(job: any): string { return job?.recordstatus || 'active'; }
  count(status: 'active' | 'draft'): number { return this.jobPosting.filter(j => this.statusOf(j) === status).length; }

  /** the public job page; only active vacancies are listed there, so a draft has none */
  jobLink(job: any): any[] | null {
    return this.statusOf(job) === 'active' ? ['/' + this.sharedRoutines.getRole(), 'recommended-jobs', job.transNo] : null;
  }

  async copyLink(job: any): Promise<void> {
    const link = this.jobLink(job);
    if (!link) { return; }
    const url = window.location.origin + this.router.serializeUrl(this.router.createUrlTree(link));
    try {
      await navigator.clipboard.writeText(url);
      this.notificationsService.toastrSuccess('Job link copied.');
    } catch {
      window.prompt('Copy this link', url);
    }
  }

  jobPosting2() {
    this.router.navigateByUrl("/posting-job")
  }

  onClickNew(): void {
    const dialogConfig = new MatDialogConfig();
    dialogConfig.disableClose = true;
    dialogConfig.autoFocus = true;
    dialogConfig.width = '800px';

    const dialogRef = this.dialog.open(JobPostingUIComponent, dialogConfig);
    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.getJobPosting();
      }
    });
  }

  async getJobPosting(): Promise<void> {
    try {
      this.isLoading = true;
      this.failed = false;

      const res = await firstValueFrom(this.jobServices.getJobPosting());

      if (res.success) {
        this.success = true;

        this.jobPosting = res.jobs.map((job: any) => {
          const relatedQuestions = res.questions.filter(
            (q: any) => q.transNo === job.transNo
          );

          return {
            ...job,
            job_image: this.sharedService.cleanImageUrl(job.job_image),
            questions: relatedQuestions
          };  
        });

        this.dataSource.paginator = this.paginator;
        this.applyFilter();
      } else {
        this.success = false;
        this.failed = true;
      }

    } catch (error) {
      console.error('Error fetching jobs:', error);
      this.failed = true;
    } finally {
      this.isLoading = false;
    }
  }

  
  viewCandidates(user: any) {

  }

  /** candidates of this vacancy have their own page */
  openCandidates(job: any): void {
    this.router.navigate(['/' + this.sharedRoutines.getRole(), 'vacancies', job.transNo, 'candidates']);
  }


  delete2(job: any): void {
    this.notificationsService.popupWarning(
      job.job_name,
      ' Are you sure to delete this job posting?'
    ).then((result) => {
      if (result.value) {
        this.jobServices.deleteJobPosting(job.transNo).subscribe({
          next: (res) => {
            if (res.success === true) {
              this.notificationsService.toastrSuccess(res.message);
            } else {
              this.notificationsService.toastrError(res.message);
            }
            this.getJobPosting();
          },
          error: (error) => {
            this.notificationsService.toastrError(error.error);
          }
        });
      }
    });
  }


  createJobPosting(): void {
    this.router.navigate(['/' + this.sharedRoutines.getRole(), 'posting-job']);
  }


  edit(job: any): void {
    this.router.navigate(['/' + this.sharedRoutines.getRole(), 'posting-job'], { queryParams: { job: job.transNo } });
  }


  viewDetails(data: any): void {

    const dialogRef = this.dialog.open(JobViewDetailsComponent, {
      width: '800px',
      data: data
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.getJobPosting();
      }
    });
  }



}
