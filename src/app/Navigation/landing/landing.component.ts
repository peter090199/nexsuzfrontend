import { Component, HostListener, OnInit, AfterViewInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { CurriculumVitaeService } from 'src/app/services/CV/curriculum-vitae.service';
import { SharedRoutinesService } from 'src/app/services/Function/shared-routines.service';
import { MatDialog } from '@angular/material/dialog';
import { ChatWebsitePopUPComponent } from 'src/app/ComponentUI/messages/chat-website-pop-up/chat-website-pop-up.component';

export interface User {
  name: string;
}

@Component({
  selector: 'app-landing',
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.css']
})
export class LandingComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly sectionIds = [
    'home-section',
    'about-section',
    'pricing-section',
    'jobs-section',
    'client-section'
  ];
  private readonly chatStorageKey = 'chatOpened';
  private readonly mobileBreakpoint = 959;   // same width as the CSS that hides the desktop links
  private readonly scrollTopThreshold = 300;
  private readonly sectionOffset = 120;

  @ViewChild('pageContent') pageContentRef?: ElementRef<HTMLElement>;
  private scrollContainer: HTMLElement | null = null;
  private scrollTicking = false;
  private revealObserver?: IntersectionObserver;
  private mutationObserver?: MutationObserver;
  private mutationRaf = 0;
  private readonly revealSelector = [
    '.section-title', '.section-heading', '.hero-header', '.search-container',
    '.feature-card', '.plan-box', '.job-card', '.people-section-title',
    '.about-section-1 .feature', '.about-section-1 .hero-image',
    '.contact-info-card', '.contact-form', '.recruiter-section .cta'
  ].join(',');

  fadeIn = false;
  isSidebarOpen = false;
  isMobile = false;
  activeSection = 'home-section';
  chatOpened = false;
  showScrollTop = false;
  navScrolled = false;

  myControl = new FormControl();
  options: User[] = [
    { name: 'UX Designer' },
    { name: 'Software Engineer' },
    { name: 'Data Scientist' }
  ];
  filteredOptions!: Observable<User[]>;

  searchQuery = '';
  filteredData: string[] = [];
  data: string[] = [
    'Software Engineer',
    'Frontend Developer',
    'Backend Developer',
    'Full Stack Developer',
    'Data Scientist',
    'Machine Learning Engineer',
    'DevOps Engineer',
    'UI/UX Designer',
    'Product Manager',
    'Project Manager',
    'System Administrator',
    'Cloud Engineer',
    'Database Administrator',
    'Quality Assurance Engineer',
    'Technical Support Specialist',
    'Business Analyst',
    'Network Engineer',
    'Security Engineer',
    'Web Developer',
    'Mobile Developer',
    'SEO Specialist',
    'Digital Marketing Manager',
    'Content Writer',
    'Graphic Designer',
    'Game Developer'
  ];


  /** the menu shown in the mobile side menu */
  readonly navLinks = [
    { id: 'home-section', label: 'Home', icon: 'home' },
    { id: 'about-section', label: 'About', icon: 'info' },
    { id: 'pricing-section', label: 'Pricing', icon: 'sell' },
    { id: 'jobs-section', label: 'Jobs', icon: 'work' },
    { id: 'client-section', label: 'Clients', icon: 'business' },
    { id: 'contact-section', label: 'Contact us', icon: 'contacts' },
  ];
  trackLink(_: number, l: { id: string }): string { return l.id; }

  // ---- account icon (only when someone is signed in)
  loggedIn = false;
  accountName = '';
  accountPhoto: string | null = null;
  accountRole = '';

  private static readonly HOME: Record<string, string> = {
    'DEF-USERS': '/DEF-USERS/home', 'DEF-CLIENT': '/DEF-CLIENT/client-dashboard',
    'DEF-ADMIN': '/DEF-ADMIN/admin-dashboard', 'DEF-MASTERADMIN': '/DEF-MASTERADMIN/admin-dashboard'
  };
  private static readonly ROLE: Record<string, string> = {
    'DEF-USERS': 'Job seeker', 'DEF-CLIENT': 'Recruiter', 'DEF-ADMIN': 'Administrator', 'DEF-MASTERADMIN': 'Master administrator'
  };

  get accountInitials(): string {
    return (this.accountName || '?').trim().split(/\s+/).slice(0, 2).map(w => w.charAt(0).toUpperCase()).join('') || '?';
  }

  constructor(
    private router: Router,
    private dialog: MatDialog,
    private auth: AuthService,
    private cv: CurriculumVitaeService,
    private routines: SharedRoutinesService
  ) {
    this.updateMobileState();
  }

  ngOnInit(): void {
    this.fadeIn = true;
    this.loadAccount();

    this.filteredOptions = this.myControl.valueChanges.pipe(
      startWith(''),
      map(value => (typeof value === 'string' ? value : value.name)),
      map(name => (name ? this._filter(name) : this.options.slice()))
    );

    const storedState = localStorage.getItem(this.chatStorageKey);
    this.chatOpened = storedState ? JSON.parse(storedState) : false;
  }

  ngAfterViewInit(): void {
    // .page-content is the actual scrolling element (mat-sidenav-content),
    // not window — grab a direct reference instead of relying on the template event.
    this.scrollContainer = this.pageContentRef?.nativeElement
      ?? document.querySelector('.page-content');

    this.initScrollReveal();
  }

  /** who is signed in on this tab (nothing is shown, and nothing is requested, when nobody is) */
  private loadAccount(): void {
    this.loggedIn = this.auth.isLoggedIn();
    if (!this.loggedIn) { return; }
    this.accountRole = LandingComponent.ROLE[sessionStorage.getItem('role') || ''] || 'Signed in';
    this.cv.getDataCV().subscribe({
      next: (res: any) => { this.accountName = res?.message?.name || ''; this.accountPhoto = res?.message?.photo_pic || null; },
      error: () => { /* the icon still works with initials only */ }
    });
  }

  openWorkspace(): void {
    this.router.navigateByUrl(LandingComponent.HOME[sessionStorage.getItem('role') || ''] || '/');
  }

  /** sign out of this account and go straight to the sign-in page to use another one */
  switchAccount(): void { this.routines.onLogout('/signin'); }

  signOut(): void { this.routines.onLogout('/'); }

  ngOnDestroy(): void {
    this.revealObserver?.disconnect();
    this.mutationObserver?.disconnect();
    if (this.mutationRaf) cancelAnimationFrame(this.mutationRaf);
  }

  // ============================================================
  // Scroll-triggered reveal (styles live in landing.component.css)
  // ============================================================

  private initScrollReveal(): void {
    const root = this.scrollContainer;
    if (!root || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    this.revealObserver = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target as HTMLElement;
        this.revealObserver?.unobserve(el);
        el.classList.add('lx-in');
        // once the entrance has played, drop the helper classes so hover effects own the transform
        setTimeout(() => {
          el.classList.remove('lx-reveal', 'lx-in');
          el.style.removeProperty('--lx-delay');
        }, 1600);
      }
    }, { root, threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

    this.registerRevealTargets();

    // Jobs / plans arrive from the API after first paint — pick them up as they render.
    this.mutationObserver = new MutationObserver(() => {
      if (this.mutationRaf) return;
      this.mutationRaf = requestAnimationFrame(() => {
        this.mutationRaf = 0;
        this.registerRevealTargets();
      });
    });
    this.mutationObserver.observe(root, { childList: true, subtree: true });
  }

  private registerRevealTargets(): void {
    const root = this.scrollContainer;
    if (!root || !this.revealObserver) return;

    root.querySelectorAll<HTMLElement>(this.revealSelector).forEach(el => {
      if (el.dataset['lx']) return;
      el.dataset['lx'] = '1';
      const index = el.parentElement ? Array.prototype.indexOf.call(el.parentElement.children, el) : 0;
      el.style.setProperty('--lx-delay', `${Math.min(index, 8) * 90}ms`);
      el.classList.add('lx-reveal');
      this.revealObserver!.observe(el);
    });
  }

  // ============================================================
  // Scroll handling
  // ============================================================

  onPageScroll(event: Event): void {
    // rAF-throttle so we update state at most once per frame, regardless of
    // how many scroll events fire.
    if (this.scrollTicking) return;
    this.scrollTicking = true;

    requestAnimationFrame(() => {
      const target = (event.target as HTMLElement) ?? this.scrollContainer;
      if (target) {
        this.showScrollTop = target.scrollTop > this.scrollTopThreshold;
        this.navScrolled = target.scrollTop > 40;
        this.updateActiveSection(target.scrollTop);
      }
      this.scrollTicking = false;
    });
  }

  private updateActiveSection(scrollTop: number): void {
    const scrollPosition = scrollTop + this.sectionOffset;

    for (const id of this.sectionIds) {
      const section = document.getElementById(id);
      if (!section) continue;

      const top = section.offsetTop;
      const bottom = top + section.offsetHeight;

      if (scrollPosition >= top && scrollPosition < bottom) {
        this.activeSection = id;
        break;
      }
    }
  }

  scrollToSection(event: Event, sectionId: string): void {
    event.preventDefault();

    const el = document.getElementById(sectionId);
    if (!el) return;

    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    this.activeSection = sectionId;

    // reflect the anchor in the address bar without triggering navigation or scroll jump
    const basePath = window.location.pathname + window.location.search;
    history.replaceState(null, '', `${basePath}#${sectionId}`);
  }

  scrollToTop(): void {
    this.scrollContainer?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  @HostListener('window:resize', [])
  onResize(): void {
    this.updateMobileState();
  }

  private updateMobileState(): void {
    this.isMobile = window.innerWidth <= this.mobileBreakpoint;
  }

  // ============================================================
  // Autocomplete
  // ============================================================

  displayFn(user: User): string {
    return user?.name ?? '';
  }

  private _filter(name: string): User[] {
    const filterValue = name.toLowerCase();
    return this.options.filter(option => option.name.toLowerCase().includes(filterValue));
  }

  filterData(): void {
    this.filteredData = this.data.filter(item =>
      item.toLowerCase().includes(this.searchQuery.toLowerCase())
    );
  }

  // ============================================================
  // Sidebar / navigation
  // ============================================================

  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  refreshHomePage(): void {
    this.router.navigate(['/homepage']).then(() => {
      window.location.reload();
    });
  }

  // ============================================================
  // Chat popup
  // ============================================================

  openChat(): void {
    const dialogRef = this.dialog.open(ChatWebsitePopUPComponent, {
      width: '450px',
      position: { bottom: '20px', right: '20px' },
      panelClass: 'custom-chat-popup'
    });

    this.chatOpened = true;
    localStorage.setItem(this.chatStorageKey, JSON.stringify(true));

    dialogRef.afterClosed().subscribe(() => {
      this.chatOpened = false;
      localStorage.setItem(this.chatStorageKey, JSON.stringify(false));
    });
  }

  closeChat(): void {
    this.chatOpened = false;
    localStorage.setItem(this.chatStorageKey, JSON.stringify(false));
  }
}