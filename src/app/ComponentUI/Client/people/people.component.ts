import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ProfileService } from 'src/app/services/Profile/profile.service';
import { SharedRoutinesService } from 'src/app/services/Function/shared-routines.service';
import { ImagesService } from 'src/app/services/images/images.service';
import { NotificationsService } from 'src/app/services/Global/notifications.service';

interface Person {
  code: number;
  role_code: string;
  fullname: string;
  skills: string;
  profession: string;
  image: string;
  cover: string | null;
  follow_status?: string;
  follow_id?: number | null;
}

/**
 * The "People" tab of a company profile: the people connected to the company, laid out exactly like the People
 * results on the search page (Online / Offline groups of the shared person card).
 */
@Component({
  selector: 'app-people',
  templateUrl: './people.component.html',
  styleUrls: ['./people.component.css']
})
export class PeopleComponent implements OnInit, OnDestroy {

  /** company account code; defaults to the :code of the profile page this tab sits in */
  @Input() code = '';

  readonly perPage = 10;
  readonly placeholder = 'assets/images/default.png';

  online: Person[] = [];
  offline: Person[] = [];
  onlineHasMore = false;
  offlineHasMore = false;
  page = 1;

  searchText = '';
  isLoading = true;
  isLoadingMore = false;
  failed = false;
  private timer: any;

  constructor(
    private route: ActivatedRoute,
    private profile: ProfileService,
    private shared: SharedRoutinesService,
    private alert: NotificationsService,
    private images: ImagesService
  ) { }

  ngOnInit(): void {
    this.code = this.code || this.route.snapshot.paramMap.get('code') || '';
    this.load(1);
  }

  ngOnDestroy(): void { clearTimeout(this.timer); }

  get total(): number { return this.online.length + this.offline.length; }
  get hasMore(): boolean { return this.onlineHasMore || this.offlineHasMore; }
  get ownCode(): string { return String(sessionStorage.getItem('code') || ''); }
  get canAct(): boolean {
    const r = this.shared.getRole();
    return r === 'DEF-USERS' || r === 'DEF-CLIENT';
  }

  profileLink(p: Person): any[] | null {
    const role = this.shared.getRole();
    return role ? ['/' + role, 'profile', p.code] : null;
  }

  load(page: number): void {
    page === 1 ? (this.isLoading = true) : (this.isLoadingMore = true);
    this.failed = false;
    this.profile.getCompanyPeople(this.code, this.searchText.trim(), page, this.perPage).subscribe({
      next: (res: any) => {
        if (res?.success) {
          const on = (res.online ?? []).map((p: any) => this.map(p));
          const off = (res.offline ?? []).map((p: any) => this.map(p));
          this.online = page === 1 ? on : [...this.online, ...on];
          this.offline = page === 1 ? off : [...this.offline, ...off];
          this.page = res.meta?.current_page ?? page;
          this.onlineHasMore = !!res.meta?.online_has_more;
          this.offlineHasMore = !!res.meta?.offline_has_more;
        } else {
          this.online = []; this.offline = [];
        }
        this.isLoading = false; this.isLoadingMore = false;
      },
      error: () => { this.isLoading = false; this.isLoadingMore = false; this.failed = true; }
    });
  }

  /** typing in the box searches the server, a moment after the last key */
  onSearch(value: string): void {
    this.searchText = value;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.load(1), 300);
  }

  loadMore(): void {
    if (!this.isLoadingMore && this.hasMore) { this.load(this.page + 1); }
  }

  private map(p: any): Person {
    return {
      code: p.code,
      role_code: p.role_code ?? '',
      fullname: p.fullname ?? 'Unknown',
      skills: p.skills ?? '',
      profession: p.profession ?? '',
      image: p.photo_pic ? this.images.cleanImageUrl(p.photo_pic) : this.placeholder,
      cover: p.coverphoto ? this.images.cleanImageUrl(p.coverphoto) : null,
      follow_status: p.follow_status,
      follow_id: p.id ?? null,
    };
  }

  /** same follow / cancel / unfollow flow as the search page */
  connect(person: Person): void {
    let message = '';
    let done = '';
    switch (person.follow_status) {
      case 'not_following': message = 'Send a follow request to this user?'; done = 'Follow request sent.'; break;
      case 'pending': message = 'Cancel your pending follow request?'; done = 'Follow request canceled.'; break;
      case 'accepted': message = 'Unfollow this user?'; done = 'Unfollowed successfully.'; break;
      default: return;
    }
    this.alert.popupWarning(person.fullname, message).then((result: any) => {
      if (!result.value) { return; }
      const call = person.follow_status === 'accepted'
        ? this.profile.Unfollow(person.follow_id ?? 0)
        : this.profile.AddFollow(String(person.code));
      call.subscribe({
        next: (res: any) => {
          if (res.status === true || res.success === true) {
            this.alert.toastrSuccess(done);
            const status = res.follow_status || 'not_following';
            const update = (list: Person[]) => list.map(p => p.code === person.code ? { ...p, follow_status: status } : p);
            this.online = update(this.online);
            this.offline = update(this.offline);
          } else {
            this.alert.toastrError(res.message || 'Action failed.');
          }
        },
        error: (err: any) => this.alert.toastrError(err.error?.message || 'Something went wrong.')
      });
    });
  }

  /** after blocking someone, take them out at once */
  removeBlocked(code: any): void {
    const keep = (list: Person[]) => list.filter(p => String(p.code) !== String(code));
    this.online = keep(this.online);
    this.offline = keep(this.offline);
  }
}
