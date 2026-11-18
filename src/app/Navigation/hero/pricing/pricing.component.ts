import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { UserPlanService } from 'src/app/services/AccountPlan/user-plan.service';
import { SharedRoutinesService } from 'src/app/services/Function/shared-routines.service';

@Component({
  selector: 'app-pricing',
  templateUrl: './pricing.component.html',
  styleUrls: ['./pricing.component.css']
})
export class PricingComponent implements OnInit {

  plans: any[] = [];
  planFeatures: Record<string | number, any[]> = {};   // was `[]` – an object map is the correct type
  expanded: Record<string | number, boolean> = {};     // which cards show all features
  readonly visibleCount = 6;                           // features shown before "Show all"
  isLoading = false;

  constructor(
    private router: Router,
    public sharedService: SharedRoutinesService,
    private userPlanService: UserPlanService
  ) { }

  ngOnInit(): void {
    this.loadPlans();
  }

  /* ---------- template helpers ---------- */

  trackByPlan(_: number, plan: any): any {
    return plan.planId;
  }

  /** "Business Unlimited" -> "business-unlimited-plan" (the old replace(' ','-') only fixed the first space) */
  getPlanClass(plan: any): string {
    return (plan.plan_name || '').toLowerCase().trim().replace(/\s+/g, '-') + '-plan';
  }

  isFeatured(plan: any): boolean {
    return (plan.tag || '').toUpperCase() === 'MOST POPULAR';
  }

  getPlanIcon(plan: any): string {
    const name = (plan.plan_name || '').toLowerCase();
    if (name.includes('business')) return 'apartment';
    if (name.includes('premium')) return 'workspace_premium';
    if (name.includes('basic')) return 'star';
    return 'person';
  }

  getFeatureTitle(plan: any, index: number): string {
    if (index === 0) return 'What you get';
    const prev = this.plans[index - 1]?.plan_name;
    return prev ? `Everything in ${prev}, plus` : 'What you get';
  }

  toggleFeatures(planId: string | number): void {
    this.expanded[planId] = !this.expanded[planId];
  }

  getBadgeClass(color: string): string {
    return color || 'primary';
  }

  /* ---------- actions ---------- */

  goToCheckout(plan: any): void {
    if (!plan?.planId) {
      return;
    }
    const checkoutUrl = `/DEF-USERS/checkout/${encodeURIComponent(plan.planId)}`;

    // Logged in -> straight to the selected plan's checkout
    if (sessionStorage.getItem('token')) {
      this.router.navigateByUrl(checkoutUrl);
      return;
    }

    // Not logged in -> sign in (or register) first, then return to this exact checkout
    this.router.navigate(['/signin'], { queryParams: { returnUrl: checkoutUrl } });
  }

  /* ---------- data ---------- */

  loadPlans(): void {
    this.isLoading = true;

    this.userPlanService.getPlan().subscribe({
      next: (res: any) => {
        if (!res?.success || !res.data?.length) {
          this.plans = [];
          this.isLoading = false;
          return;
        }

        this.plans = res.data;

        // load every plan's features in parallel, finish once ALL are done
        forkJoin(
          this.plans.map(plan =>
            this.userPlanService.getFeatures2(plan.planId).pipe(
              map((r: any) => ({ id: plan.planId, data: r?.success ? r.data : [] })),
              catchError(() => of({ id: plan.planId, data: [] }))
            )
          )
        ).subscribe(results => {
          const featuresByPlan: Record<string | number, any[]> = {};
          results.forEach(r => (featuresByPlan[r.id] = r.data));
          this.planFeatures = featuresByPlan;
          this.isLoading = false;
        });
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }
}