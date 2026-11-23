import { Component, Input, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { UserPlanService } from 'src/app/services/AccountPlan/user-plan.service';
import { SharedRoutinesService } from 'src/app/services/Function/shared-routines.service';
import { ENTERPRISE_PLAN, FaqItem, PRICING_FAQ, YEARLY_PRICING, YearlyPrice } from './pricing.config';

export type Billing = 'monthly' | 'yearly';
export type Audience = 'DEF-USERS' | 'DEF-CLIENT';

/** One feature as shown on a card or in the comparison table. */
export interface FeatureCell {
  /** Included on this plan (own row or inherited from a lower plan). */
  included: boolean;
  /** Text next to the tick: a limit ("15"), "Unlimited", or '' for a plain yes/no feature. */
  detail: string;
}
export interface CompareRow {
  key: string;
  name: string;
  cells: { [planId: string]: FeatureCell };
  /** true when plans differ on this row, so the table can highlight it. */
  differs: boolean;
}

@Component({
  selector: 'app-pricing',
  templateUrl: './pricing.component.html',
  styleUrls: ['./pricing.component.css']
})
export class PricingComponent implements OnInit {

  /** Overridable (tests / future API): annual price per planId. */
  @Input() yearlyPricing: { [planId: string]: YearlyPrice } = YEARLY_PRICING;

  readonly enterprise = ENTERPRISE_PLAN;
  readonly faq: FaqItem[] = PRICING_FAQ;
  readonly visibleCount = 6;

  plans: any[] = [];
  planFeatures: Record<string, any[]> = {};     // own feature rows per plan (active only)
  rows: CompareRow[] = [];                       // comparison rows (union of features, cumulative by plan order)
  unavailable: Record<string, string[]> = {};    // feature names a plan does not include
  expanded: Record<string, boolean> = {};
  billing: Billing = 'monthly';
  /** Who the visible plans are for: job seekers or recruiters. */
  audience: Audience = 'DEF-USERS';
  readonly audiences: { id: Audience; label: string; icon: string }[] = [
    { id: 'DEF-USERS', label: 'Job Seekers', icon: 'person_search' },
    { id: 'DEF-CLIENT', label: 'Recruiters', icon: 'business_center' },
  ];
  isLoading = false;
  hasError = false;
  loggedIn = false;

  constructor(
    private router: Router,
    public sharedService: SharedRoutinesService,
    private userPlanService: UserPlanService
  ) { }

  ngOnInit(): void {
    this.loggedIn = !!sessionStorage.getItem('token');
    // a signed-in recruiter lands on the recruiter plans
    if (this.loggedIn && this.role === 'DEF-CLIENT') { this.audience = 'DEF-CLIENT'; }
    this.loadPlans();
  }

  /* ---------- audience ---------- */

  get role(): string { return sessionStorage.getItem('role') || ''; }

  setAudience(a: Audience): void {
    if (a === this.audience) { return; }
    this.audience = a;
    this.expanded = {};
    this.loadPlans();
  }

  /** A signed-in job seeker cannot buy a recruiter plan (and the other way round). */
  /** Admins and master admins never hold a plan. */
  private get adminAccount(): boolean { return this.loggedIn && (this.role === 'DEF-ADMIN' || this.role === 'DEF-MASTERADMIN'); }

  /** Admin accounts never buy a plan, so the plan cards show no button for them (and no label) */
  get showCta(): boolean { return !this.adminAccount; }

  private wrongAudience(plan: any): boolean {
    const planFor = plan.audience || this.audience;
    return this.adminAccount || (this.loggedIn && (this.role === 'DEF-USERS' || this.role === 'DEF-CLIENT') && this.role !== planFor);
  }

  private checkoutUrl(plan: any): string {
    return `/${plan.audience || this.audience}/checkout/${encodeURIComponent(plan.planId)}`;
  }

  /* ---------- billing ---------- */

  /** The toggle only appears once at least one plan has a configured annual price. */
  get yearlyAvailable(): boolean {
    return this.plans.some(p => this.yearlyOf(p) !== null);
  }

  setBilling(b: Billing): void { this.billing = b; }

  private yearlyOf(plan: any): number | null {
    const y = this.yearlyPricing?.[plan.planId];
    return y && y.price > 0 ? y.price : null;
  }

  isFree(plan: any): boolean { return +plan.price === 0; }

  /** Number shown big on the card for the selected billing period. */
  displayPrice(plan: any): number {
    if (this.billing === 'yearly') {
      const y = this.yearlyOf(plan);
      if (y !== null) { return y; }
    }
    return +plan.price;
  }

  /** "/ month" or "/ year"; plans without annual pricing keep their monthly period. */
  period(plan: any): string {
    if (this.billing === 'yearly' && this.yearlyOf(plan) !== null) { return 'year'; }
    return (plan.tagmonthYear || 'Monthly') === 'Yearly' ? 'year' : 'month';
  }

  /** Savings versus paying monthly for 12 months, only when annual pricing is configured and actually cheaper. */
  savings(plan: any): number {
    const y = this.yearlyOf(plan);
    if (this.billing !== 'yearly' || y === null || (plan.tagmonthYear || 'Monthly') === 'Yearly') { return 0; }
    return Math.max(0, Math.round(+plan.price * 12 - y));
  }

  /* ---------- template helpers ---------- */

  trackByPlan(_: number, plan: any): any { return plan.planId; }

  getPlanClass(plan: any): string {
    return (plan.plan_name || '').toLowerCase().trim().replace(/\s+/g, '-') + '-plan';
  }

  isFeatured(plan: any): boolean { return !!plan.is_popular || (plan.tag || '').toUpperCase() === 'MOST POPULAR'; }
  isCurrent(plan: any): boolean { return this.loggedIn && !!plan.is_current; }

  getPlanIcon(plan: any): string {
    const name = (plan.plan_name || '').toLowerCase();
    if (this.isFree(plan)) return 'person';
    if (name.includes('business')) return 'apartment';
    if (name.includes('premium') || name.includes('pro')) return 'workspace_premium';
    return 'star';
  }

  /** Button text. Logged-in users get their real state; visitors get a plan-specific call to action. */
  ctaLabel(plan: any): string {
    if (this.isCurrent(plan)) { return 'Current Plan'; }
    if (this.wrongAudience(plan)) { return (plan.audience || this.audience) === 'DEF-CLIENT' ? 'Recruiter accounts only' : 'Job seeker accounts only'; }
    if (this.loggedIn && plan.disabled) { return plan.button_name || 'Not available'; }
    if (this.isFree(plan)) { return 'Get Started Free'; }
    return this.isFeatured(plan) ? `Upgrade to ${plan.plan_name}` : `Choose ${plan.plan_name}`;
  }

  ctaDisabled(plan: any): boolean {
    return this.isCurrent(plan) || this.wrongAudience(plan) || (this.loggedIn && !!plan.disabled);
  }

  /** Features this plan adds on top of the previous plan (its own rows; "Everything in X" rows become the heading). */
  ownFeatures(plan: any): any[] {
    return (this.planFeatures[plan.planId] || []).filter(f => !this.isEverythingRow(f));
  }

  featureTitle(index: number): string {
    const prev = this.plans[index - 1]?.plan_name;
    return index > 0 && prev ? `Everything in ${prev}, plus` : 'What you get';
  }

  isOffRow(f: any): boolean { return PricingComponent.isOff(f); }

  featureDetail(f: any): string {
    return PricingComponent.detailOf(f);
  }

  toggleFeatures(planId: string): void { this.expanded[planId] = !this.expanded[planId]; }

  private isEverythingRow(f: any): boolean {
    return /^EVERYTHING_/i.test(f.feature_code || '') || /^everything in /i.test(f.feature_name || '');
  }

  /* ---------- actions ---------- */

  goToCheckout(plan: any): void {
    if (!plan?.planId || this.ctaDisabled(plan)) { return; }
    const checkoutUrl = this.checkoutUrl(plan);
    const jobSeekerPlan = (plan.audience || this.audience) === 'DEF-USERS';

    if (this.loggedIn) {
      // Free plan has no payment step; it is activated from the subscription page
      if (this.isFree(plan) && jobSeekerPlan) { this.sharedService.goToSubscription(); return; }
      this.router.navigateByUrl(checkoutUrl);
      return;
    }

    // Visitors register first (the existing sign-up flow forwards to sign-in, then to this return URL)
    const returnUrl = this.isFree(plan) && jobSeekerPlan ? '/DEF-USERS/subscription' : checkoutUrl;
    this.router.navigate(['/signup'], { queryParams: { returnUrl } });
  }

  contactSales(): void {
    document.getElementById(this.enterprise.contactSectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  scrollTo(id: string): void {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---------- data ---------- */

  loadPlans(): void {
    this.isLoading = true; this.hasError = false;

    // Logged-in users get the personalised list (current plan, locked downgrades); fall back to the public list.
    const plans$ = (this.loggedIn
      ? this.userPlanService.getAll(false, this.audience).pipe(catchError(() => this.userPlanService.getPlan(this.audience)))
      : this.userPlanService.getPlan(this.audience));

    plans$.subscribe({
      next: (res: any) => {
        if (!res?.success || !res.data?.length) {
          this.plans = []; this.isLoading = false;
          return;
        }
        this.plans = [...res.data].sort((a, b) => (a.sort_number ?? 0) - (b.sort_number ?? 0));

        forkJoin(
          this.plans.map(plan =>
            this.userPlanService.getFeatures2(plan.planId).pipe(
              map((r: any) => ({ id: plan.planId, data: r?.success ? r.data : [] })),
              catchError(() => of({ id: plan.planId, data: [] }))
            )
          )
        ).subscribe(results => {
          const byPlan: Record<string, any[]> = {};
          results.forEach(r => byPlan[r.id] = (r.data as any[]).filter(f => f.recordStatus !== 'inactive'));
          this.planFeatures = byPlan;
          this.buildComparison();
          this.isLoading = false;
        });
      },
      error: () => { this.isLoading = false; this.hasError = true; }
    });
  }

  /* ---------- comparison model ---------- */

  static keyOf(f: any): string {
    return ((f.feature_code || '').trim() || (f.feature_name || '').trim()).toUpperCase();
  }

  /** "Unlimited", a limit like "15" (only when the name does not already say it), or '' for a simple yes. */
  static detailOf(f: any): string {
    const v = String(f.feature_value ?? '').trim().toUpperCase();
    if (v === 'UNLIMITED') { return 'Unlimited'; }
    if (/^\d+$/.test(v) && !String(f.feature_name || '').includes(v)) { return v; }
    return '';
  }

  /** NO / 0 means the plan explicitly does not include the feature. */
  static isOff(f: any): boolean {
    const v = String(f.feature_value ?? '').trim().toUpperCase();
    return v === 'NO' || v === '0';
  }

  /**
   * Higher plans inherit lower plans, so a feature is included on plan N when it is switched on in plan N
   * or any plan below it (the nearest plan's value wins, e.g. a limit being raised).
   */
  buildComparison(): void {
    const names = new Map<string, string>();
    this.plans.forEach(p => (this.planFeatures[p.planId] || []).forEach(f => {
      if (this.isEverythingRow(f)) { return; }
      const k = PricingComponent.keyOf(f);
      if (k && !names.has(k)) { names.set(k, f.feature_name || k); }
    }));

    const state = new Map<string, FeatureCell>();
    const rows: CompareRow[] = Array.from(names.entries()).map(([key, name]) => ({ key, name, cells: {}, differs: false }));

    this.plans.forEach(p => {
      (this.planFeatures[p.planId] || []).forEach(f => {
        if (this.isEverythingRow(f)) { return; }
        const k = PricingComponent.keyOf(f);
        state.set(k, PricingComponent.isOff(f)
          ? { included: false, detail: '' }
          : { included: true, detail: PricingComponent.detailOf(f) });
      });
      rows.forEach(r => r.cells[p.planId] = { ...(state.get(r.key) || { included: false, detail: '' }) });
    });

    rows.forEach(r => {
      const sig = this.plans.map(p => `${r.cells[p.planId].included}|${r.cells[p.planId].detail}`);
      r.differs = new Set(sig).size > 1;
    });
    this.rows = rows;

    this.unavailable = {};
    this.plans.forEach(p => this.unavailable[p.planId] = rows.filter(r => !r.cells[p.planId].included).map(r => r.name));
  }
}
