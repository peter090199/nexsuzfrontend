import { LanguageService } from 'src/app/services/language.service';
// import { Component, OnInit, OnDestroy } from '@angular/core';
// import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
// import { Router, NavigationEnd } from '@angular/router';
// import { Subscription, firstValueFrom } from 'rxjs';
import { ContactInquiriesService } from 'src/app/ComponentUI/ContactInquiries/contact-inquiries.service';
// import { filter } from 'rxjs/operators';
// import { SigInService } from 'src/app/services/signIn/sig-in.service';
// import { TNavigationService } from 'src/app/services/TNavigation/tnavigation.service';
// import { NotificationComponent } from 'src/app/ComponentUI/notification/notification.component';
// import { MatDialog } from '@angular/material/dialog';
// import { EchoService } from 'src/app/services/echo.service';
// import { Title } from '@angular/platform-browser';
// import { ProfileService } from 'src/app/services/Profile/profile.service';
// import { SharedService } from 'src/app/services/SharedServices/shared.service';
// import { SharedRoutinesService } from 'src/app/services/Function/shared-routines.service';
// import { Location } from '@angular/common';
// import { CurriculumVitaeService } from 'src/app/services/CV/curriculum-vitae.service';

// @Component({
//   selector: 'app-side-bar-panel',
//   templateUrl: './side-bar-panel.component.html',
//   styleUrls: ['./side-bar-panel.component.css']
// })
// export class SideBarPanelComponent implements OnInit, OnDestroy {
//   sidebarOpen = true;
//   isMobile = false;
//   menuItems: any[] = [];
//   pageTitle = 'Dashboard';
//   unreadCount = 0;
//   userName = 'John Doe';
//   profile: any;

//   private countsSubscription?: Subscription;
//   private breakpointSubscription?: Subscription;
//   private routerSubscription?: Subscription;

//   constructor(
//     private observer: BreakpointObserver,
//     private authService: SigInService,
//     private navigationService: TNavigationService,
//     private router: Router,
//     private dialog: MatDialog,
//     private echoService: EchoService,
//     private titleService: Title,
//     private profileService: ProfileService,
//     public sharedService: SharedRoutinesService,
//     private location: Location,
//     private cvService: CurriculumVitaeService,
//   ) { }

//   ngOnInit(): void {
//     this.breakpointSubscription = this.observer.observe([Breakpoints.Handset])
//       .subscribe(result => {
//         this.isMobile = result.matches;
//         this.sidebarOpen = !this.isMobile;
//       });

//     this.routerSubscription = this.router.events
//       .pipe(filter(event => event instanceof NavigationEnd))
//       .subscribe(() => this.updatePageTitle());

//     this.fetchModules();
//     this.loadRealtimeCounts();
//     this.getProfile();
//   }

//   // getProfile() {
//   //   this.profileService.getProfileByUserOnly().subscribe({
//   //     next: (res) => {
//   //       this.profile = res.message;
//   //       console.log(this.profile?.role_code);
//   //          console.log('Profile data loaded:', res);
//   //     },
//   //     error: (err) => console.error(err)
//   //   });
//   // }

//   getProfile(): void {
//     this.cvService.getDataCV().subscribe({
//       next: (res: any) => {
//         this.profile = res.message;
//       },
//       error: (err: any) => console.error('Error loading profile:', err)
//     });
//   }

//   ngOnDestroy(): void {
//     this.countsSubscription?.unsubscribe();
//     this.breakpointSubscription?.unsubscribe();
//     this.routerSubscription?.unsubscribe();
//   }

//   async fetchModules(): Promise<void> {
//     try {
//       const response = await firstValueFrom(this.navigationService.getData());
//       this.menuItems = response
//         .sort((a: any, b: any) => a.sort - b.sort)
//         .map((item: any) => ({
//           label: item.description,
//           icon: item.icon,
//           route: item.route,
//           submenus: item.submenus || [],
//           expanded: false
//         }));
//     } catch (error) {
//       console.error('Error fetching modules:', error);
//     }
//   }

//   loadRealtimeCounts() {
//     if (!this.countsSubscription || this.countsSubscription.closed) {
//       this.echoService.listenToNotificationCount();
//       this.countsSubscription = this.echoService.notificationCount$
//         .subscribe(count => {
//           this.unreadCount = count;
//           this.updateTitle(count);
//         });
//     }
//   }

//   toggleSidebar() {
//     this.sidebarOpen = !this.sidebarOpen;
//   }

//   toggleSubmenu(item: any): void {
//     item.expanded = !item.expanded;
//   }

//   openNotifications(): void {
//     const dialogRef = this.dialog.open(NotificationComponent, {
//       width: '400px',
//       maxHeight: '90vh',
//       position: { top: '40px', right: '90px' },
//       panelClass: 'custom-notification-popup',
//     });

//     dialogRef.afterClosed().subscribe(() => this.loadRealtimeCounts());
//   }

//   logout(): void {
//     this.authService.logout().subscribe({
//       next: () => {
//         sessionStorage.clear();
//         localStorage.clear();
//         localStorage.setItem('showWebsiteChat', 'false');
//         localStorage.setItem('cookiesAccepted', 'true');
//         window.location.href = '/homepage';
//       },
//       error: err => console.error('Logout failed:', err)
//     });
//   }

//   updateTitle(count: number): void {
//     this.titleService.setTitle(count > 0 ? `🔔 (${count}) Nexsuz` : 'Nexsuz');
//   }

//   updatePageTitle(): void {
//     const currentUrl = this.router.url;
//     const mainItem = this.menuItems.find(item => currentUrl.includes(item.route));
//     if (mainItem) {
//       this.pageTitle = mainItem.label;
//       return;
//     }

//     for (const item of this.menuItems) {
//       const sub = item.submenus?.find((subItem: any) => currentUrl.includes(subItem.route));
//       if (sub) {
//         this.pageTitle = sub.label || sub.description;
//         return;
//       }
//     }

//     this.pageTitle = 'Dashboard';
//   }

//   navigateTo(url: string) {
//     this.router.navigate([url]);
//   }

//   // get settingsUrl(): string {
//   //   return this.profile?.role_code === 'MASTER-ADMIN' ? '/masteradmin/settings' :
//   //     this.profile?.role_code === 'DEF-ADMIN' ? '/admin/settings' :
//   //       this.profile?.role_code === 'RECRUITER' ? '/recruiter/settings' :
//   //         '/settings';
//   // }

//   // get profileUrl(): string {
//   //   return this.profile?.role_code === 'MASTER-ADMIN' ? '/masteradmin/profile' :
//   //          this.profile?.role_code === 'DEF-ADMIN' ? '/admin/profile' :
//   //          this.profile?.role_code === 'RECRUITER' ? '/recruiter/profile' :
//   //          '/profile';
//   // }

//   //  settingsUrl(): string {
//   //     if (!this.profile) return '/profile';

//   //     const code = this.profile.code; // or id, depending on your API

//   //     switch (this.profile.role_code) {
//   //       case 'DEF-CLIENT':
//   //         return `/recruiter/settings`;
//   //       case 'DEF-MASTER-ADMIN':
//   //         return `/masteradmin/settings`;
//   //       case 'DEF-ADMIN':
//   //         return `/admin/settings`;
//   //       default:
//   //         return `/profile/settings`;
//   //     }
//   //   }

//   //   getProfileUrl(): string {
//   //     if (!this.profile) return '/profile';

//   //     const code = this.profile.code; // or id, depending on your API

//   //     switch (this.profile.role_code) {
//   //       case 'DEF-CLIENT':
//   //         return `/recruiter/client_profile/${code}`;
//   //       case 'DEF-MASTER-ADMIN':
//   //         return `/masteradmin/profile/${code}`;
//   //       case 'DEF-ADMIN':
//   //         return `/admin/profile/${code}`;
//   //       default:
//   //         return `/profile/${code}`;
//   //     }
//   //   }


//   getsettingsUrl(): void {
//     this.router.navigate(
//       this.sharedService.getsettingsRoute()
//     );
//   }

//   getProfileUrl(): void {
//     this.router.navigate(
//       this.sharedService.getProfileRoute(this.profile.code)
//     );
//   }

//   goBack(): void {
//     this.location.back();
//   }

// }


import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { MatSidenavContainer } from '@angular/material/sidenav';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Router, NavigationEnd } from '@angular/router';
import { FeatureService } from 'src/app/services/AccountPlan/feature.service';
import { FEATURE } from 'src/app/services/AccountPlan/feature-access.map';
import { Subscription, firstValueFrom } from 'rxjs';
import { filter } from 'rxjs/operators';

import { SigInService } from 'src/app/services/signIn/sig-in.service';
import { TNavigationService } from 'src/app/services/TNavigation/tnavigation.service';
import { NotificationComponent } from 'src/app/ComponentUI/notification/notification.component';
import { MatDialog } from '@angular/material/dialog';
import { EchoService } from 'src/app/services/echo.service';
import { NotificationPrefsService } from 'src/app/services/notification-prefs.service';
import { NotificationDeliveryService } from 'src/app/services/notification-delivery.service';
import { Title } from '@angular/platform-browser';
import { ProfileService } from 'src/app/services/Profile/profile.service';
import { SharedRoutinesService } from 'src/app/services/Function/shared-routines.service';
import { Location } from '@angular/common';
import { CurriculumVitaeService } from 'src/app/services/CV/curriculum-vitae.service';
import { ProfileImageService } from 'src/app/services/Profile/profile-image.service';
import { SavedJobsStateService } from 'src/app/services/Jobs/saved-jobs-state.service';

@Component({
  selector: 'app-side-bar-panel',
  templateUrl: './side-bar-panel.component.html',
  styleUrls: ['./side-bar-panel.component.css']
})
export class SideBarPanelComponent implements OnInit, OnDestroy {

  // ================= UI STATE =================
  sidebarOpen = true;
  isMobile = false;

  // ================= MENU =================
  menuItems: any[] = [];
  originalMenuItems: any[] = [];
  /** the menu exactly as the server sent it, before the plan hides what it does not include */
  private rawMenu: any[] = [];
  private featureSub?: Subscription;

  // ================= SEARCH =================
  showSearch = false;
  searchText = '';

  // ================= PAGE =================
  pageTitle = 'Dashboard';

  // ================= NOTIFICATION =================
  unreadCount = 0;
  activityUnread = 0;
  private activitySub?: Subscription;

  /** unread messages (when the user wants unread badges) + waiting friend requests / reactions / comments */
  get bellCount(): number { return (this.prefs.prefs.unread_badge ? this.unreadCount : 0) + this.activityUnread; }

  // ================= PROFILE =================
  profile: any;

  // ================= SUBSCRIPTIONS =================
  private countsSubscription?: Subscription;
  private breakpointSubscription?: Subscription;
  private routerSubscription?: Subscription;
  private photoSub?: Subscription;

  constructor(
    private observer: BreakpointObserver,
    private authService: SigInService,
    private navigationService: TNavigationService,
    private router: Router,
    private dialog: MatDialog,
    private echoService: EchoService,
    private titleService: Title,
    private profileService: ProfileService,
    public sharedService: SharedRoutinesService,
    public languages: LanguageService,
    private location: Location,
    private cvService: CurriculumVitaeService,
    private prefs: NotificationPrefsService,
    private delivery: NotificationDeliveryService,
    private profileImages: ProfileImageService,
    public savedJobsState: SavedJobsStateService,
    public features: FeatureService,
    private inquiries: ContactInquiriesService,
  ) { }

  /** feature codes for the template (so no screen hard-codes one) */
  readonly FEATURE = FEATURE;
  @ViewChild('searchSidenav') searchSidenav: any;
  @ViewChild(MatSidenavContainer) private container?: MatSidenavContainer;

  // ================= SIDEBAR LOOK (desktop rail / tablet / mobile drawer) =================
  /** icon-only rail on desktop and tablet (never on the mobile drawer) */
  collapsed = false;
  isTablet = false;
  private currentUrl = '';
  private tabletSubscription?: Subscription;
  private static readonly COLLAPSE_KEY = 'nexsuz_sidebar_collapsed';

  get railMode(): boolean { return this.collapsed && !this.isMobile; }

  ngOnInit(): void {
    // after sign in and after a refresh: this person's own language
    this.languages.restoreForUser();

    // the menu follows the subscription: hide what the plan does not include, live
    this.featureSub = this.features.changes$.subscribe(() => { if (this.rawMenu.length) { this.applyFeatureFilter(); } });

    // RESPONSIVE CHECK
    this.breakpointSubscription = this.observer
      .observe([Breakpoints.Handset])
      .subscribe(result => {
        this.isMobile = result.matches;
        this.sidebarOpen = !this.isMobile;
      });

    // TABLET: start as a compact rail unless the user chose otherwise
    this.tabletSubscription = this.observer
      .observe(['(min-width: 600px) and (max-width: 1100px)'])
      .subscribe(result => {
        this.isTablet = result.matches;
        const stored = this.readCollapsePref();
        this.collapsed = stored !== null ? stored : this.isTablet;
        this.refreshMargins();
      });

    // ROUTE CHANGE TITLE + active highlighting
    this.currentUrl = this.router.url;
    this.routerSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((e: any) => {
        this.currentUrl = e.urlAfterRedirects || e.url || this.router.url;
        this.updatePageTitle();
        this.expandActiveParents();
        if (this.isMobile) { this.sidebarOpen = false; }   // drawer closes after choosing a page
      });

    this.fetchModules();
    this.loadRealtimeCounts();
    this.getProfile();
    this.savedJobsState.load();   // saved-jobs badge in the top bar

    // a new / removed profile photo shows in the sidebar at once
    this.photoSub = this.profileImages.photo$.pipe(filter(url => url !== undefined)).subscribe(url => {
      this.profile = { ...(this.profile || {}), photo_pic: url };
    });

    // notification preferences: load, stay in sync across devices, deliver by them
    this.prefs.load();
    this.prefs.startSync();
    this.delivery.start();
    this.activitySub = this.delivery.activityUnread$.subscribe(n => { this.activityUnread = n; this.updateTitle(this.bellCount); });
  }

  // ================= PROFILE =================
  getProfile(): void {
    this.cvService.getDataCV().subscribe({
      next: (res: any) => {
        this.profile = res.message;
      },
      error: (err: any) => console.error('Error loading profile:', err)
    });
  }

  // ================= CONTACT INQUIRIES BADGE =================
  private inquiryTimer: any;
  get inquiryUnread(): number { return this.inquiries.unread$.value; }
  isInquiries(item: any): boolean { return String(item?.route || '').split('/')[0] === 'contactinquiries'; }
  /** Only accounts that were given the menu ask for the count; it refreshes every minute and instantly on the page itself. */
  private startInquiryBadge(): void {
    if (this.inquiryTimer || !this.rawMenu.some(i => this.isInquiries(i))) { return; }
    this.inquiries.refreshUnread();
    this.inquiryTimer = setInterval(() => this.inquiries.refreshUnread(), 60000);
  }

  // ================= MENU LOAD =================
  async fetchModules(): Promise<void> {
    try {
      const response = await firstValueFrom(this.navigationService.getData());

      const formatted = response
        .sort((a: any, b: any) => a.sort - b.sort)
        .map((item: any) => ({
          label: item.description,
          icon: item.icon,
          route: item.route,
          submenus: item.submenus || [],
          expanded: false
        }));

      this.rawMenu = formatted;
      this.applyFeatureFilter();
      this.expandActiveParents();
      this.startInquiryBadge();

    } catch (error) {
      console.error('Error fetching modules:', error);
    }
  }
  /**
   * Hide the menu entries the account's subscription does not include (job seekers and recruiters only: nobody else is
   * ever limited by a plan). Runs again whenever the plan changes, so an upgrade, an expiry or an administrator editing
   * the plan shows up in the menu without a reload.
   */
  private applyFeatureFilter(): void {
    const ok = (route: string) => this.features.allowsRoute(route);
    const kept = this.rawMenu
      .map(item => ({ ...item, submenus: (item.submenus || []).filter((s: any) => ok(s.route)) }))
      .filter((item, i) => ok(item.route) && (item.submenus.length > 0 || !(this.rawMenu[i].submenus || []).length));
    this.menuItems = kept;
    this.originalMenuItems = JSON.parse(JSON.stringify(kept));
  }

  isSearchOpen = false;
  // ================= SEARCH =================
  
  toggleSearch(): void {
    const role = this.sharedService.getRole();
    this.router.navigate([`${role}/search`]);
  }


  filterMenu(): void {
    const search = this.searchText.toLowerCase().trim();

    if (!search) {
      this.menuItems = JSON.parse(JSON.stringify(this.originalMenuItems));
      return;
    }

    this.menuItems = this.originalMenuItems
      .map(item => {

        const matchParent = item.label.toLowerCase().includes(search);

        const filteredSubmenus = item.submenus?.filter((sub: any) =>
          (sub.label || sub.description)?.toLowerCase().includes(search)
        );

        if (matchParent || (filteredSubmenus && filteredSubmenus.length)) {
          return {
            ...item,
            submenus: filteredSubmenus,
            expanded: true
          };
        }

        return null;
      })
      .filter(Boolean);
  }

  closeSearch(): void {
    this.searchSidenav.close();
    this.clearSearch();
  }

  clearSearch(): void {
    this.searchText = '';
    this.menuItems = JSON.parse(JSON.stringify(this.originalMenuItems));
  }
  // ================= SIDEBAR =================
  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  toggleSubmenu(item: any): void {
    item.expanded = !item.expanded;
  }

  // ================= SIDEBAR: rail, drawer, groups, icons =================
  toggleCollapse(): void {
    this.collapsed = !this.collapsed;
    try { localStorage.setItem(SideBarPanelComponent.COLLAPSE_KEY, this.collapsed ? '1' : '0'); } catch { /* storage blocked */ }
    this.refreshMargins();
  }

  closeMobile(): void {
    this.sidebarOpen = false;
  }

  /** a parent row: opens its submenu, or (in the rail) widens the sidebar first so the submenu is visible */
  onParentClick(item: any): void {
    if (this.railMode) {
      this.collapsed = false;
      try { localStorage.setItem(SideBarPanelComponent.COLLAPSE_KEY, '0'); } catch { /* storage blocked */ }
      item.expanded = true;
      this.refreshMargins();
      return;
    }
    this.toggleSubmenu(item);
  }

  private readCollapsePref(): boolean | null {
    try {
      const v = localStorage.getItem(SideBarPanelComponent.COLLAPSE_KEY);
      return v === null ? null : v === '1';
    } catch { return null; }
  }

  /** the drawer width is set by CSS, so tell the content to re-measure it */
  private refreshMargins(): void {
    setTimeout(() => this.container?.updateContentMargins(), 0);
  }

  private pathOf(url: string): string {
    return (url || '').split('?')[0].split('#')[0].replace(/\/+$/, '');
  }

  private isRouteActive(route: string): boolean {
    if (!route || route === '#') { return false; }
    return this.pathOf(this.currentUrl).endsWith('/' + route.replace(/^\/+/, ''));
  }

  isParentActive(item: any): boolean {
    return !!item.submenus?.some((s: any) => this.isRouteActive(s.route));
  }

  /** open the submenu that contains the current page (user toggles still work afterwards) */
  private expandActiveParents(): void {
    for (const item of this.menuItems) {
      if (item.submenus?.length && this.isParentActive(item)) { item.expanded = true; }
    }
  }

  // ----- groups: display only, built from the same menu items (each item appears once) -----
  private static readonly GROUPS: { key: string; label: string; routes: string[] }[] = [
    { key: 'general', label: 'General', routes: ['client-dashboard', 'admin-dashboard', 'home', 'message', 'network'] },
    { key: 'career', label: 'Career', routes: ['search', 'jobs', 'applied-jobs', 'user-cv'] },
    { key: 'hiring', label: 'Hiring', routes: ['vacancies', 'recommended-jobs', 'candidates', 'interviews', 'reports'] },
    { key: 'admin', label: 'Administration', routes: ['contactinquiries', 'accountmanagement', '#'] },
  ];

  private groupsFor: any[] | null = null;
  private groupsCache: { key: string; label: string; items: any[] }[] = [];

  get groups(): { key: string; label: string; items: any[] }[] {
    if (this.groupsFor !== this.menuItems) {
      this.groupsFor = this.menuItems;
      this.groupsCache = this.buildGroups(this.menuItems);
    }
    return this.groupsCache;
  }

  private buildGroups(items: any[]): { key: string; label: string; items: any[] }[] {
    const defs = SideBarPanelComponent.GROUPS;
    const out = defs.map(d => ({ key: d.key, label: d.label, items: [] as any[] }));
    const more = { key: 'more', label: 'More', items: [] as any[] };

    for (const item of items || []) {
      const head = String(item.route || '').split('/')[0];
      const idx = defs.findIndex(d => d.routes.includes(head));
      if (idx >= 0) { out[idx].items.push(item); }
      else if (item.submenus?.length) { out[defs.length - 1].items.push(item); }
      else { more.items.push(item); }
    }
    return [...out, more].filter(g => g.items.length);
  }

  // ----- saved jobs (top bar icon + menu) -----
  trackSaved(_: number, job: any): any { return job.saved_job_id ?? job.job_id; }

  openSavedJob(job: any): void {
    if (!job?.transNo) { return; }
    this.router.navigate([this.sharedService.getRole(), 'recommended-jobs', job.transNo]);
  }

  removeSaved(job: any, ev: Event): void {
    ev.stopPropagation();
    ev.preventDefault();
    this.savedJobsState.remove(job);
  }

  // ----- mobile tab bar: first 4 menu items (More opens the full menu) -----
  get tabItems(): any[] { return (this.menuItems || []).slice(0, 4); }

  isMessageTab(item: any): boolean { return /messag|chat/i.test(String(item?.label || '') + ' ' + String(item?.route || '')); }

  /** a tab that has a submenu opens the drawer with that submenu expanded */
  openMoreFor(item: any): void {
    item.expanded = true;
    this.sidebarOpen = true;
  }

  trackByKey(_: number, g: { key: string }): string { return g.key; }
  trackByItem(_: number, item: any): string { return (item.route || '') + '|' + item.label; }

  // ----- icons: the menu's own FontAwesome icon when valid, otherwise a matching Material icon -----
  faIcon(item: any): string {
    const tokens = String(item?.icon || '').split(/\s+/).filter(Boolean);
    const style = tokens.filter(t => /^(fa|fas|far|fab|fa-solid|fa-regular|fa-brands)$/.test(t));
    const glyph = tokens.filter(t => /^fa-[a-z0-9-]+$/.test(t)
      && !/^fa-(solid|regular|brands|\d+x|xs|sm|lg|xl|2xs|2xl|fw|spin|pulse)$/.test(t));
    return glyph.length ? [...(style.length ? style : ['fas']), glyph[0]].join(' ') : '';
  }

  materialIcon(item: any): string {
    const t = (String(item?.label || '') + ' ' + String(item?.route || '')).toLowerCase();
    const map: [RegExp, string][] = [
      [/my-applications|job applications/, 'work_history'], [/inquir|contact/, 'mail'], [/dashboard/, 'space_dashboard'], [/home/, 'home'], [/messag|chat/, 'chat_bubble_outline'],
      [/network|nexsuz/, 'hub'], [/vacanc/, 'campaign'], [/job/, 'work_outline'],
      [/applied/, 'assignment_turned_in'], [/search|find/, 'travel_explore'], [/cv|resume|curriculum/, 'description'],
      [/profile/, 'account_circle'], [/setting/, 'settings'], [/candidate/, 'groups'], [/interview|schedul/, 'event_available'], [/report|analytic/, 'insights'],
      [/account|plan/, 'account_balance_wallet'], [/system/, 'tune'], [/security/, 'security'],
      [/user/, 'person_outline'], [/role/, 'admin_panel_settings'], [/menu/, 'menu_open'], [/feature/, 'checklist'],
    ];
    return (map.find(([re]) => re.test(t)) || [null, 'radio_button_unchecked'])[1];
  }

  // ================= NOTIFICATIONS =================
  loadRealtimeCounts(): void {
    if (!this.countsSubscription || this.countsSubscription.closed) {
      this.echoService.listenToNotificationCount();

      this.countsSubscription = this.echoService.notificationCount$
        .subscribe(count => {
          this.unreadCount = count;
          this.updateTitle(this.bellCount);
        });
    }
  }

  openNotifications(): void {
    const dialogRef = this.dialog.open(NotificationComponent, {
      width: '400px',
      maxHeight: '90vh',
      position: { top: '40px', right: '90px' },
      panelClass: 'custom-notification-popup',
    });

    dialogRef.afterClosed().subscribe(() => this.loadRealtimeCounts());
  }

  updateTitle(count: number): void {
    this.titleService.setTitle(
      count > 0 ? `🔔 (${count}) Nexsuz` : 'Nexsuz'
    );
  }

  // ================= ROUTE TITLE =================
  updatePageTitle(): void {
    const currentUrl = this.router.url;

    const mainItem = this.menuItems.find(item =>
      currentUrl.includes(item.route)
    );

    if (mainItem) {
      this.pageTitle = mainItem.label;
      return;
    }

    for (const item of this.menuItems) {
      const sub = item.submenus?.find((subItem: any) =>
        currentUrl.includes(subItem.route)
      );

      if (sub) {
        this.pageTitle = sub.label || sub.description;
        return;
      }
    }

    this.pageTitle = 'Dashboard';
  }

  // ================= AUTH =================
  logout(): void {
    this.authService.logout().subscribe({
      next: () => {
        sessionStorage.clear();
        const remembered = localStorage.getItem('nexsuz_remembered_email'); // "Remember me" email survives logout
        localStorage.clear();
        if (remembered) localStorage.setItem('nexsuz_remembered_email', remembered);
        window.location.href = '/';
      },
      error: err => console.error('Logout failed:', err)
    });
  }

  // ================= NAVIGATION =================
  navigateTo(url: string): void {
    this.router.navigate([url]);
  }

  getsettingsUrl(): void {
    this.router.navigate(this.sharedService.getsettingsRoute());
  }

  getProfileUrl(): void {
    this.router.navigate(
      this.sharedService.getProfileRoute(this.profile.code)
    );
  }

  goBack(): void {
    this.location.back();
  }

  // ================= CLEANUP =================
  ngOnDestroy(): void {
    clearInterval(this.inquiryTimer);
    this.featureSub?.unsubscribe();
    this.countsSubscription?.unsubscribe();
    this.activitySub?.unsubscribe();
    this.breakpointSubscription?.unsubscribe();
    this.tabletSubscription?.unsubscribe();
    this.routerSubscription?.unsubscribe();
    this.photoSub?.unsubscribe();
  }
}