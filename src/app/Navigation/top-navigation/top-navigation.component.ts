import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatMenuPanel } from '@angular/material/menu';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, Subscription, firstValueFrom } from 'rxjs';
import { map, startWith, distinctUntilChanged, skip } from 'rxjs/operators';
import { SigInService } from 'src/app/services/signIn/sig-in.service';
import { TNavigationService } from 'src/app/services/TNavigation/tnavigation.service';
import { slideUp, slideFade } from 'src/app/animations';
import { ChatPopupComponent } from 'src/app/ComponentUI/messages/chat-popup/chat-popup.component';
import { MatDialog } from '@angular/material/dialog';
import { ChatService } from 'src/app/services/chat.service';
import { NotificationComponent } from 'src/app/ComponentUI/notification/notification.component';
import { NotificationService } from 'src/app/services/notification.service';
import { NotificationPrefsService } from 'src/app/services/notification-prefs.service';
import { NotificationDeliveryService } from 'src/app/services/notification-delivery.service';
import { EchoService } from 'src/app/services/echo.service';
import { Title } from '@angular/platform-browser';
import { NotificationsService } from 'src/app/services/Global/notifications.service';
import { SharedRoutinesService } from 'src/app/services/Function/shared-routines.service';
import { ProfileService } from 'src/app/services/Profile/profile.service';
import { CurriculumVitaeService } from 'src/app/services/CV/curriculum-vitae.service';
import { FeatureService } from 'src/app/services/AccountPlan/feature.service';
import { ProfileImageService } from 'src/app/services/Profile/profile-image.service';
import { filter } from 'rxjs/operators';

export interface User {
  name: string;
}

// How long the user must be inactive before we stop auto-refreshing modules.
// Prevents indefinite background polling (and API traffic) while the tab sits idle.
const INACTIVITY_CHECK_INTERVAL_MS = 30_000;
const MAX_IDLE_REFRESHES = 1; // only auto-refresh once per idle period, not every 30s forever

@Component({
  selector: 'app-top-navigation',
  templateUrl: './top-navigation.component.html',
  styleUrls: ['./top-navigation.component.css'],
  animations: [slideUp, slideFade]
})
export class TopNavigationComponent implements OnInit, OnDestroy {
  isSidebarOpen = false;
  isMobile = window.innerWidth <= 768;
  searchValue = '';
  isLoading = false;
  success = false;
  isChatOpen = false;
  isSearchOpen = false;
  homeModule: any;
  nav_module: any = [];
  submenuMenu!: MatMenuPanel<any>;

  messageCount = 0;      // (was a hard-coded 3: no real count behind it)
  activityUnread = 0;    // friend requests, reactions, comments... waiting for you
  private prefsSub?: Subscription;
  private activitySub?: Subscription;
  notificationCounts = 0;
  notificationCount: any = [];
  notifications: any[] = [];

  myControl = new FormControl();
  options: User[] = [{ name: 'Mary' }, { name: 'Shelley' }, { name: 'Igor' }];
  filteredOptions!: Observable<User[]>;

  searchQuery = '';
  filteredData: string[] = [];
  totalUnreadMessages = 0;
  data: string[] = [
    'Software Engineer', 'Frontend Developer', 'Backend Developer',
    'Full Stack Developer', 'Data Scientist', 'Machine Learning Engineer',
    'DevOps Engineer', 'UI/UX Designer', 'Product Manager', 'Project Manager'
  ];

  notificationCountSubject = new BehaviorSubject<number>(0);
  unreadCount$ = this.notificationCountSubject.asObservable();
  userId = 0;
  unreadCount = 0;
  isOpen = false;
  homeNewDataCount = 0;

  mobileMenu!: MatMenuPanel<any>;
  desktopMenu!: MatMenuPanel<any>;

  user: any;
  lastActionTime = Date.now();
  inactivityCheck: any;
  idleRefreshCount = 0;
  refreshingIcon: string | null = null;
  profileservices: any;
  private photoSub?: Subscription;
  error: any;

  searchKeyword = '';
  chatHistory: { [key: number]: any[] } = {};

  chatDialogRef: any;
  chatUpdateSub: Subscription | undefined;
  countsSubscription: Subscription | undefined;

  constructor(
    private authService: SigInService,
    private navigationService: TNavigationService,
    private dialog: MatDialog,
    private router: Router,
    private chatService: ChatService,
    private echoService: EchoService,
    private notificationService: NotificationService,
    private titleService: Title,
    private alert: NotificationsService,
    public sharedRoutines: SharedRoutinesService,
    private profile: ProfileService,
    private cvService: CurriculumVitaeService,
    public feature: FeatureService,
    public sharedService: SharedRoutinesService,
    private profileImages: ProfileImageService,
    private prefs: NotificationPrefsService,
    private delivery: NotificationDeliveryService
  ) {
    this.sharedRoutines.onNewPostsDetected = (count: number) => {
      this.homeNewDataCount = count;
    };
  }

  ngOnInit(): void {
    this.getProfile();

    // notification preferences follow the account: load them, keep them in sync across devices, and deliver by them
    this.prefs.load();
    this.prefs.startSync();
    this.delivery.start();
    this.prefsSub = this.prefs.prefs$.subscribe(() => this.updateTitle(this.bellCount));
    // the server counts only the activity types switched on, so re-ask as soon as one of those switches changes
    this.prefsSub.add(this.prefs.prefs$.pipe(
      map(p => [p.friend_requests, p.friend_accepts, p.post_reactions, p.post_comments, p.announcements, p.job_applications, p.job_interviews, p.job_status, p.job_reviews].join()),
      distinctUntilChanged(),
      skip(1)
    ).subscribe(() => this.delivery.refreshActivity()));
    this.activitySub = this.delivery.activityUnread$.subscribe(n => { this.activityUnread = n; this.updateTitle(this.bellCount); });

    // a new / removed profile photo shows in the bar at once
    this.photoSub = this.profileImages.photo$.pipe(filter(url => url !== undefined)).subscribe(url => {
      this.profileservices = { ...(this.profileservices || {}), photo_pic: url };
    });

    this.inactivityCheck = setInterval(() => this.checkInactivity(), INACTIVITY_CHECK_INTERVAL_MS);
    setTimeout(() => (this.isLoading = false), 5000);

    this.loadRealtimeCounts();
    this.fetchModules();
    this.loadUserData();

    this.filteredOptions = this.myControl.valueChanges.pipe(
      startWith(''),
      map(value => (typeof value === 'string' ? value : value?.name)),
      map(name => (name ? this._filter(name) : this.options.slice()))
    );
  }

  ngOnDestroy(): void {
    if (this.inactivityCheck) {
      clearInterval(this.inactivityCheck);
    }
    this.countsSubscription?.unsubscribe();
    this.prefsSub?.unsubscribe();
    this.activitySub?.unsubscribe();
    this.chatUpdateSub?.unsubscribe();
    this.photoSub?.unsubscribe();
  }

  @HostListener('document:click')
  @HostListener('document:mousemove')
  @HostListener('document:keydown')
  onUserAction(): void {
    this.lastActionTime = Date.now();
    this.idleRefreshCount = 0; // user is active again, allow future idle refresh
  }

  @HostListener('window:resize')
  onResize(): void {
    this.isMobile = window.innerWidth <= 768;
  }

  // Only refresh once after crossing the idle threshold, not every 30s forever.
  // The previous version reset lastActionTime on every tick, so it kept
  // re-triggering fetchModules()/loadUserData() every minute indefinitely
  // while the tab sat idle — unnecessary background traffic.
  checkInactivity(): void {
    const minutesInactive = (Date.now() - this.lastActionTime) / (1000 * 60);
    if (minutesInactive >= 1 && this.idleRefreshCount < MAX_IDLE_REFRESHES) {
      this.triggerRefresh();
      this.idleRefreshCount++;
    }
  }

  triggerRefresh(): void {
    this.isLoading = true;
    this.fetchModules();
    this.loadUserData();
    setTimeout(() => (this.isLoading = false), 3000);
  }

  refreshHomePage(): void {
    // Pick one: SPA navigation OR full reload, not both — chaining them
    // forces a full asset re-download right after a route change.
    this.router.navigate(['/homepage']);
  }

  getProfile(): void {
    this.cvService.getDataCV().subscribe({
      next: (res: any) => (this.profileservices = res.message),
      error: (err: any) => console.error('Error loading profile:', err)
    });
  }

  loadUserData(): void {
    this.profile.getProfileByUserOnly().subscribe({
      next: (response) => {
        if (response.success) {
          this.user = response.message;
        } else {
          this.error = 'Failed to load profile data';
        }
      },
      error: (err) => {
        this.error = err.message || 'An error occurred while fetching profile data';
      }
    });
  }

  async onHomeClick(): Promise<void> {
    this.sharedRoutines.onNewPostsDetected = (count: number) => {
      this.homeNewDataCount = count;
    };
  }

  // Guarded so repeated calls (e.g. from openChatxx) don't stack duplicate
  // socket listeners; subscription is now actually stored so ngOnDestroy can clean it up.
  loadRealtimeCounts(): void {
    if (!this.countsSubscription || this.countsSubscription.closed) {
      this.echoService.listenToNotificationCount();
      this.countsSubscription = this.echoService.notificationCount$.subscribe(count => {
        this.unreadCount = count;
        this.updateTitle(this.bellCount);
      });
    }
  }

  /** unread messages, only when the user wants unread badges */
  get messageBadge(): number { return this.prefs.prefs.messages_enabled && this.prefs.prefs.unread_badge ? this.unreadCount : 0; }

  /** what the bell shows: unread messages (if badges are on) + waiting friend requests / reactions / comments */
  get bellCount(): number { return this.messageBadge + this.activityUnread; }

  updateTitle(count: number): void {
    this.titleService.setTitle(count > 0 ? `🔔 (${count}) Nexsuz` : 'Nexsuz');
  }

  openChat(notif?: any): void {
    this.chatDialogRef = this.dialog.open(ChatPopupComponent, {
      width: '500px',
      position: { bottom: '80px', right: '80px' },
      panelClass: 'custom-chat-popup',
      data: notif
    });
    this.chatDialogRef.afterClosed().subscribe(() => {});
  }

  openChatxx(): void {
    this.dialog.open(ChatPopupComponent, {
      width: '500px',
      position: { bottom: '80px', right: '20px' },
      panelClass: 'custom-chat-popup'
    });
    this.loadRealtimeCounts();
  }

  private _filter(name: string): User[] {
    return this.options.filter(option =>
      option.name.toLowerCase().includes(name.toLowerCase())
    );
  }

  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  toggleChat(): void {
    this.isChatOpen = !this.isChatOpen;
  }

  toggleSearch(): void {
    this.isSearchOpen = !this.isSearchOpen;
    if (this.isSearchOpen) {
      this.autoCloseSearch();
    }
  }

  closeSearchOnOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('search-overlay')) {
      this.toggleSearch();
    }
  }

  autoCloseSearch(): void {
    setTimeout(() => (this.isSearchOpen = false), 5000);
  }

  closeSearch(): void {
    this.isSearchOpen = false;
    this.searchQuery = '';
  }

  clearSearch(): void {
    this.searchValue = '';
  }

  filterData(): void {
    this.filteredData = this.data.filter(item =>
      item.toLowerCase().includes(this.searchQuery.toLowerCase())
    );
  }

  async fetchModules(): Promise<void> {
    this.isLoading = true;
    try {
      this.nav_module = await firstValueFrom(this.navigationService.getData());
    } catch (error) {
      console.error('Error fetching modules:', error);
    } finally {
      this.isLoading = false;
    }
  }

  refreshMenu(icon: string): void {
    if (icon === 'home') {
      this.refreshingIcon = icon;
      setTimeout(() => (this.refreshingIcon = null), 2000);
    }
  }

  async refreshMenux(icon: string): Promise<void> {
    if (this.refreshingIcon === icon) return; // prevent repeat clicks
    this.refreshingIcon = icon;
    await this.fetchModules();
    setTimeout(() => (this.refreshingIcon = null), 1000);
  }

  sendData(): void {
    const requestBody = { name: 'John Doe', email: 'john@example.com' };
    this.navigationService.postData('submit-form', requestBody).subscribe({
      next: response => {},
      error: error => console.error('Error submitting form:', error)
    });
  }

  onAddPost(): void {
    this.router.navigate(['/post/new']);
  }

  search(): void {
    if (!this.searchKeyword.trim()) return;
    // this.router.navigate(['/search'], { queryParams: { q: this.searchKeyword } });
  }


  openNotifications(): void {
    const dialogRef = this.dialog.open(NotificationComponent, {
      width: '400px',
      minHeight: 'auto',
      maxHeight: '90vh',
      position: { top: '40px', right: '90px' },
      panelClass: 'custom-notification-popup'
    });
    dialogRef.afterClosed().subscribe(() => { this.loadRealtimeCounts(); this.delivery.refreshActivity(); });
  }

  openSearch(): void {
    const role = this.sharedRoutines.getRole();
    this.router.navigate([`/${role}/search`]);
  }
}