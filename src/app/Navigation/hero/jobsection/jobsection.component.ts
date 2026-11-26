import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from 'src/app/services/auth.service';
import { JobListService } from 'src/app/services/Jobs/job-list.service';
import { SharedRoutinesService } from 'src/app/services/Function/shared-routines.service';
import { JobPostingService } from 'src/app/services/Jobs/job-posting.service';
import { ImagesService } from 'src/app/services/images/images.service';
import { SearchService } from 'src/app/services/search.service';
import { NotificationsService } from 'src/app/services/Global/notifications.service';
import { ProfileService } from 'src/app/services/Profile/profile.service';

interface Job {
  transNo: string;
  job_name: string;
  job_position: string;
  location: string;
  currency?: string;
  min_salary?: number;
  max_salary?: number;
  work_type: string;
  typeClass: string;
  image: string;
}

interface Person {
  code: number;
  role_code: string;
  status: string;
  fullname: string;
  skills: string;
  profession: string;
  image: string;
  isOnline: boolean;
  cover?: string | null;
  follow_status?: string;
  follow_id?: number | null;
}

type SearchType = 'jobs' | 'people';

@Component({
  selector: 'app-jobsection',
  templateUrl: './jobsection.component.html',
  styleUrls: ['./jobsection.component.scss']
})
export class JobsectionComponent implements OnInit {
  searchText = '';
  searchType: SearchType = 'jobs';
  searchPlaceholder = 'Search jobs, positions, locations...';
  isLoading = false;
  isLoadingMore = false;

  jobs: Job[] = [];
  filteredJobs: Job[] = [];
  currentPage = 1;
  lastPage = 1;
  hasMore = false;

  onlinePeople: Person[] = [];
  offlinePeople: Person[] = [];
  filteredOnlinePeople: Person[] = [];
  filteredOfflinePeople: Person[] = [];

  readonly peoplePerPage = 10;
  peoplePage = 1;
  peopleOnlineHasMore = false;
  peopleOfflineHasMore = false;

  code: any;
  currentUserCode: any;
  placeholderImg = 'assets/images/logo2.png';

  constructor(
   
    private peopleService: SearchService,
    private route: ActivatedRoute,
    private authService: AuthService,
    private router: Router,
    private sharedService: ImagesService,
    private sharedRoutineService: SharedRoutinesService,
     private jobServices: JobListService,
    private alert: NotificationsService,
    private profile: ProfileService,
    private postings: JobPostingService,
  ) { }

  ngOnInit(): void {
    this.currentUserCode = this.authService.getAuthCode();
    this.code = this.route.snapshot.paramMap.get('code') || window.location.href.split('/').pop() || '';
    this.getActiveJobsByCode();
    this.loadOwnJobs();

    // arrived from sign in via "People": open the people view straight away
    if (this.route.snapshot.queryParamMap.get('type') === 'people' && this.isLoggedIn) {
      this.setSearchType('people');
    }
  }

  /** People are only for signed-in users; guests are sent to sign in */
  get isLoggedIn(): boolean { return this.authService.isLoggedIn(); }

  setSearchType(type: SearchType): void {
    if (type === 'people' && !this.isLoggedIn) {
      this.router.navigate(['/signin'], { queryParams: { view: 'people' } });   // after signing in, come back to the people
      return;
    }
    this.searchType = type;
    this.searchText = '';

    if (type === 'people') {
      this.searchPlaceholder = 'Search people, names, skills...';
      if (this.onlinePeople.length === 0 && this.offlinePeople.length === 0) {
        this.peoplePage = 1;
        this.getActivePeopleByCode('', 1);
      } else {
        this.filteredOnlinePeople = [...this.onlinePeople];
        this.filteredOfflinePeople = [...this.offlinePeople];
      }
    } else {
      this.searchPlaceholder = 'Search jobs, positions, locations...';
      this.filteredJobs = [...this.jobs];
    }
  }

  async getActiveJobsByCode(page: number = 1): Promise<void> {
    try {
      page === 1 ? (this.isLoading = true) : (this.isLoadingMore = true);
      const res = await firstValueFrom(this.jobServices.getActiveJobsByPublic(page));

      if (res?.success) {
        const mapped = res.data.data.map((job: any) => this.mapJob(job));
        this.jobs = page === 1 ? mapped : [...this.jobs, ...mapped];
        this.filteredJobs = [...this.jobs];
        this.currentPage = res.data.current_page;
        this.lastPage = res.data.last_page;
        this.hasMore = !!res.data.next_page_url;
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      this.isLoading = false;
      this.isLoadingMore = false;
    }
  }

  async getActivePeopleByCode(query: string = '', page: number = 1): Promise<void> {
    try {
      page === 1 ? (this.isLoading = true) : (this.isLoadingMore = true);

      const res = this.authService.isLoggedIn()
        ? await firstValueFrom(this.peopleService.searchUsers(query, page, this.peoplePerPage))
        : await firstValueFrom(this.peopleService.searchUsersBypublic(query, page, this.peoplePerPage));

      if (res?.success) {
        const mappedOnline = (res.online ?? []).map((p: any) => this.mapPerson(p));
        const mappedOffline = (res.offline ?? []).map((p: any) => this.mapPerson(p));

        this.onlinePeople = page === 1 ? mappedOnline : [...this.onlinePeople, ...mappedOnline];
        this.offlinePeople = page === 1 ? mappedOffline : [...this.offlinePeople, ...mappedOffline];

        this.filteredOnlinePeople = [...this.onlinePeople];
        this.filteredOfflinePeople = [...this.offlinePeople];

        this.peoplePage = res.meta?.current_page ?? page;
        this.peopleOnlineHasMore = !!res.meta?.online_has_more;
        this.peopleOfflineHasMore = !!res.meta?.offline_has_more;
      }
    } catch (error) {
      console.error('Error fetching people:', error);
    } finally {
      this.isLoading = false;
      this.isLoadingMore = false;
    }
  }

  loadMore(): void {
    if (this.isLoadingMore) return;

    if (this.searchType === 'jobs') {
      if (!this.hasMore) return;
      this.getActiveJobsByCode(this.currentPage + 1);
    } else {
      if (!this.peopleHasMore) return;
      this.getActivePeopleByCode(this.searchText.trim(), this.peoplePage + 1);
    }
  }

  get peopleHasMore(): boolean {
    return this.peopleOnlineHasMore || this.peopleOfflineHasMore;
  }

  onSearch(): void {
    const keyword = (this.searchText ?? '').trim().toLowerCase();

    if (this.searchType === 'jobs') {
      this.filteredJobs = !keyword
        ? [...this.jobs]
        : this.jobs.filter(job =>
          job.job_name?.toLowerCase().includes(keyword) ||
          job.job_position?.toLowerCase().includes(keyword) ||
          job.location?.toLowerCase().includes(keyword) ||
          job.work_type?.toLowerCase().includes(keyword)
        );
      return;
    }

    this.filteredOnlinePeople = !keyword
      ? [...this.onlinePeople]
      : this.onlinePeople.filter(p =>
        p.fullname?.toLowerCase().includes(keyword) ||
        p.skills?.toLowerCase().includes(keyword)
      );

    this.filteredOfflinePeople = !keyword
      ? [...this.offlinePeople]
      : this.offlinePeople.filter(p =>
        p.fullname?.toLowerCase().includes(keyword) ||
        p.skills?.toLowerCase().includes(keyword)
      );
  }

  onEnter(): void {
    if (this.searchType === 'people') {
      this.peoplePage = 1;
      this.getActivePeopleByCode(this.searchText.trim(), 1);
    } else {
      this.onSearch();
    }
  }

  clearSearch(): void {
    this.searchText = '';

    if (this.searchType === 'jobs') {
      this.filteredJobs = [...this.jobs];
    } else {
      this.peoplePage = 1;
      this.getActivePeopleByCode('', 1);
    }
  }

  selectJob(job: Job): void {
    const role = this.authService.isLoggedIn() ? sessionStorage.getItem('role') : null;
    if (!role) return;

    this.router.navigate([`${role}/recommended-jobs`, job.transNo], {
      queryParams: { jobName: job.job_name ?? '' }
    });
  }

  /** profile link for the card (guests have none, so the card does nothing for them) */
  profileLink(person: Person): any[] | null {
    const role = this.authService.isLoggedIn() ? sessionStorage.getItem('role') : null;
    return role ? ['/' + role, 'profile', person.code] : null;
  }

  selectPerson(person: Person): void {
    const role = this.authService.isLoggedIn() ? sessionStorage.getItem('role') : null;
    if (!role) return;

    this.router.navigate([`${role}/profile`, person.code]);
  }

  /** a signed-in recruiter (the public landing page uses this component too) */
  get isRecruiter(): boolean { return this.authService.isLoggedIn() && sessionStorage.getItem('role') === 'DEF-CLIENT'; }

  /** the recruiter's own vacancies; the public job list does not say who posted each job */
  private ownJobs = new Set<string>();

  private loadOwnJobs(): void {
    if (!this.isRecruiter) { return; }
    this.postings.getJobPosting().subscribe({
      next: (res: any) => this.ownJobs = new Set((res?.jobs || []).map((j: any) => String(j.transNo))),
      error: () => this.alert.toastrError('Could not load your vacancies, so Manage Job is not available.')
    });
  }

  canManage(job: Job): boolean { return this.isRecruiter && this.ownJobs.has(String(job.transNo)); }

  /** opens the vacancy in the editor */
  manageJob(job: Job): void {
    this.router.navigate(['/DEF-CLIENT/posting-job'], { queryParams: { job: job.transNo } });
  }

  openJobApply(job: Job): void {
    const transNo = job.transNo;

    if (this.authService.isLoggedIn()) {
      const role = sessionStorage.getItem('role');
      this.router.navigate([`/${role}/apply-job`, transNo]);
    } else {
      this.router.navigate(['/signin'], { queryParams: { applyTransNo: transNo } });
    }
  }

  openJobApplyxx(job: Job): void {
    this.router.navigate(
      [...this.sharedRoutineService.getApplyJobRoute(), job.transNo],
      { queryParams: { code: this.currentUserCode } }
    );
  }

  formatSalary(job: Job): string {
    if (job.min_salary == null && job.max_salary == null) return 'Salary not specified';
    const symbol = this.getCurrencySymbol(job.currency);
    return `${symbol}${job.min_salary ?? ''} - ${symbol}${job.max_salary ?? ''}`;
  }

  private mapJob(job: any): Job {
    return {
      ...job,
      job_name: job.job_name ?? 'Untitled Job',
      location: job.location ?? 'Not specified',
      work_type: job.work_type,
      image: job.job_image ? this.sharedService.cleanImageUrl(job.job_image) : this.placeholderImg,
      typeClass: this.getTypeClass(job.work_type)
    };
  }

  private mapPerson(p: any): Person {
    return {
      code: p.code,
      role_code: p.role_code ?? '',
      status: p.status ?? '',
      fullname: p.fullname ?? 'Unknown',
      skills: p.skills ?? 'No skills listed',
      profession: p.profession ?? '',
      image: p.photo_pic ? this.sharedService.cleanImageUrl(p.photo_pic) : this.placeholderImg,
      isOnline: !!p.is_online,
      cover: p.coverphoto ? this.sharedService.cleanImageUrl(p.coverphoto) : null,
      follow_status: p.follow_status,
      follow_id: p.id ?? null
    };
  }

  /** same follow / cancel / unfollow flow as "people you may know" */
  AddConnect(person: Person): void {
    if (!person?.code) {
      this.alert.toastrWarning('⚠️ No user code provided.');
      return;
    }

    let confirmMessage = '';
    let successAction = '';
    switch (person.follow_status) {
      case 'not_following':
        confirmMessage = 'Send a follow request to this user?';
        successAction = 'Follow request sent.';
        break;
      case 'pending':
        confirmMessage = 'Cancel your pending follow request?';
        successAction = 'Follow request canceled.';
        break;
      case 'accepted':
        confirmMessage = 'Unfollow this user?';
        successAction = 'Unfollowed successfully.';
        break;
      default:
        return;
    }

    this.alert.popupWarning(person.fullname, confirmMessage).then((result) => {
      if (!result.value) return;

      const action$ = person.follow_status === 'accepted'
        ? this.profile.Unfollow(person.follow_id ?? 0)
        : this.profile.AddFollow(String(person.code));

      action$.subscribe({
        next: (res: any) => {
          if (res.status === true || res.success === true) {
            this.alert.toastrSuccess(successAction);
            const status = res.follow_status || 'not_following';
            const update = (list: Person[]) => list.map(p => p.code === person.code ? { ...p, follow_status: status } : p);
            this.onlinePeople = update(this.onlinePeople);
            this.offlinePeople = update(this.offlinePeople);
            this.filteredOnlinePeople = update(this.filteredOnlinePeople);
            this.filteredOfflinePeople = update(this.filteredOfflinePeople);
          } else {
            this.alert.toastrError(res.message || 'Action failed.');
          }
        },
        error: (err: any) => {
          this.alert.toastrError(err.error?.message || 'Something went wrong.');
        }
      });
    });
  }

  /** after blocking someone, take them out of the lists at once */
  removeBlocked(code: any): void {
    const keep = (list: Person[]) => list.filter(p => String(p.code) !== String(code));
    this.onlinePeople = keep(this.onlinePeople);
    this.offlinePeople = keep(this.offlinePeople);
    this.filteredOnlinePeople = keep(this.filteredOnlinePeople);
    this.filteredOfflinePeople = keep(this.filteredOfflinePeople);
  }

  private getTypeClass(type?: string): string {
    if (!type) return 'default';
    const normalized = type.toLowerCase().trim();

    if (normalized.includes('remote') || normalized.includes('home')) return 'remote';
    if (normalized.includes('hybrid')) return 'hybrid';
    if (normalized.includes('onsite') || normalized.includes('on-site') || normalized.includes('office')) return 'onsite';
    if (normalized.includes('freelance') || normalized.includes('contract')) return 'freelance';
    if (normalized.includes('part')) return 'parttime';
    if (normalized.includes('full')) return 'fulltime';

    return 'default';
  }

  private getCurrencySymbol(code?: string): string {
    const map: Record<string, string> = { PHP: '₱', USD: '$', EUR: '€', GBP: '£', JPY: '¥' };
    return code ? (map[code] ?? code + ' ') : '';
  }
}