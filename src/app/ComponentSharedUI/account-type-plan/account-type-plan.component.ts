import { Component, HostListener, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { UserPlanService } from 'src/app/services/AccountPlan/user-plan.service';
import { SharedRoutinesService } from 'src/app/services/Function/shared-routines.service';
import { NotificationsService } from 'src/app/services/Global/notifications.service';
import { UserPlanUIComponent } from 'src/app/ComponentUI/AccountManagement/user-plan/user-plan-ui/user-plan-ui.component';
import { AssignPlanDialogComponent } from './assign-plan-dialog/assign-plan-dialog.component';

@Component({
  selector: 'app-account-type-plan',
  templateUrl: './account-type-plan.component.html',
  styleUrls: ['./account-type-plan.component.css']
})
export class AccountTypePlanComponent implements OnInit {

  plans: any[] = [];
  planFeatures: any = [];
  isLoading = false;

  /** plan being changed right now (disables its buttons) */
  busyId: string | null = null;

  constructor(
    private router: Router, public sharedService: SharedRoutinesService,
    private userPlanService: UserPlanService,
    private dialog: MatDialog,
    private notify: NotificationsService
  ) { }

  /** DEF-ADMIN and DEF-MASTERADMIN manage plans. UI only: the Laravel API enforces the same on every management route. */
  get canManagePlans(): boolean {
    return this.sharedService.canManageSubscriptions();
  }

  /** Only job seekers (DEF-USERS) and recruiters (DEF-CLIENT) can subscribe; admins and master admins cannot. */
  get canSubscribe(): boolean {
    const r = this.sharedService.getRole();
    return r === 'DEF-USERS' || r === 'DEF-CLIENT';
  }

  /** 'DEF-USERS' -> job seekers, 'DEF-CLIENT' -> recruiters: whose plans this page shows */
  get audienceLabel(): string {
    return this.sharedService.getRole() === 'DEF-CLIENT' ? 'Recruiter' : 'Job seeker';
  }

  /** the signed-in account's own current plan (job seekers: a job seeker plan, recruiters: a recruiter plan) */
  get currentPlan(): any | null {
    return this.plans.find(p => this.isCurrent(p)) || null;
  }

  isEnabled(plan: any): boolean {
    return plan.recordStatus === 'active';
  }

  isCurrent(plan: any): boolean {
    // only the server's flag: the stored button text "Current Plan" is not proof of anything
    return !!plan.is_current;
  }

  activeFeatures(planId: string): any[] {
    return (this.planFeatures?.[planId] || []).filter((f: any) => f.recordStatus !== 'inactive');
  }

  trackByPlan(_: number, plan: any): string {
    return plan.planId;
  }

  ngOnInit(): void {
    this.loadPlans();
  }

  getBadgeClass(color: string): string {
    return color || 'primary';
  }

  goToCheckout(plan: any): void {
    if (plan.tag === 'STARTER' && this.sharedService.getRole() === 'DEF-USERS') {
      this.sharedService.goToSubscription();
      return;
    }
    if (!this.canSubscribe) { return; }
    // job seekers and recruiters each have their own checkout route
    this.router.navigate(['/' + this.sharedService.getRole(), 'checkout', plan.planId]);
  }

  /** this account's subscription summary from the server: status, price, dates, features, usage (null for admins) */
  subscription: any | null = null;

  /** "used / limit" text for one usage row */
  usageText(u: any): string {
    return u.unlimited ? `${u.used} used · Unlimited` : u.limit != null ? `${u.used} / ${u.limit}` : `${u.used} used`;
  }

  usagePercent(u: any): number {
    return !u.unlimited && u.limit ? Math.min(100, Math.round((u.used / u.limit) * 100)) : 0;
  }

  /** Upgrade: jump to the plan cards (the existing checkout flow starts from a card's button). */
  scrollToPlans(): void {
    document.getElementById('plan-cards')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /** set when the plan list could not be loaded (shows a message with Retry instead of an empty page) */
  loadFailed = false;
  /** plans whose "not included" features are expanded */
  showMissing: Record<string, boolean> = {};

  /** Features to list on a card: what the plan includes (with its limit), and optionally what it lacks. */
  featureRows(plan: any): { name: string; detail: string; included: boolean }[] {
    if (Array.isArray(plan.features)) {
      return plan.features
        .filter((f: any) => f.included || (this.canSeeMissing && this.showMissing[plan.planId]))
        .map((f: any) => ({ name: f.name, detail: f.detail || '', included: !!f.included }));
    }
    // master admin view: the raw rows of the plan
    return this.activeFeatures(plan.planId).map((f: any) => ({ name: f.feature_name, detail: '', included: true }));
  }

  /** "Show features not included" is an admin tool: only DEF-MASTERADMIN and DEF-ADMIN get it (job seekers and recruiters never do) */
  get canSeeMissing(): boolean {
    const r = this.sharedService.getRole();
    return r === 'DEF-MASTERADMIN' || r === 'DEF-ADMIN';
  }

  /** the card has features it does not include, and the viewer is allowed to see them */
  hasMissing(plan: any): boolean {
    return this.canSeeMissing && Array.isArray(plan.features) && plan.features.some((f: any) => !f.included);
  }

  includedCount(plan: any): number {
    return Array.isArray(plan.features) ? plan.features.filter((f: any) => f.included).length : this.activeFeatures(plan.planId).length;
  }

  toggleMissing(planId: string): void { this.showMissing[planId] = !this.showMissing[planId]; }

  /** Button text. The server only says which plan is current and which are locked; the words are chosen here. */
  buttonLabel(plan: any): string {
    if (plan.is_current) { return 'Current Plan'; }
    if (plan.disabled) { return 'Downgrade'; }
    return plan.button_name || 'Choose plan';
  }

  loadPlans(): void {

    this.isLoading = true;
    this.loadFailed = false;

    // job seekers and recruiters: the plans of their own account type, with features and limits exactly as the master
    // admin set them up (one call, instead of a plan list plus one request per plan)
    if (this.canSubscribe && !this.canManagePlans) {
      this.userPlanService.overview().subscribe({
        next: (res: any) => {
          this.plans = (res?.data?.plans || []).map((p: any) => ({
            ...p, recordStatus: 'active', tagmonthYear: p.billing === 'yearly' ? 'Yearly' : 'Monthly',
          }));
          this.subscription = res?.data?.subscription || null;
          this.isLoading = false;
        },
        error: () => { this.isLoading = false; this.loadFailed = true; this.plans = []; }
      });
      return;
    }

    // a master admin manages every plan; everyone else sees the plans for their own account type
    const audience = this.canSubscribe ? this.sharedService.getRole() : undefined;
    this.userPlanService.getAll(this.canManagePlans, audience).subscribe({
      next: (res: any) => {

        if (!res.success) {
          this.isLoading = false;
          return;
        }

        this.plans = res.data || [];

        if (!this.plans.length) {
          this.isLoading = false;
          return;
        }

        let loaded = 0;

        this.plans.forEach(plan => {

          this.userPlanService.getFeatures(plan.planId).subscribe({
            next: (featureRes: any) => {
              this.planFeatures[plan.planId] = featureRes.success
                ? featureRes.data
                : [];
            },
            error: () => {
              this.planFeatures[plan.planId] = [];
            },
            complete: () => {
              loaded++;

              if (loaded === this.plans.length) {
                this.isLoading = false;
              }
            }
          });

        });

      },
      error: () => {
        this.isLoading = false;
      }
    });

  }

  /* =====================================
     DEF-ADMIN / DEF-MASTERADMIN plan management
  ===================================== */

  private reloadAfter(ok: any): void {
    if (ok) { this.loadPlans(); }
  }

  openNewPlan(): void {
    this.dialog.open(UserPlanUIComponent, { width: '500px', maxWidth: '96vw', disableClose: true, autoFocus: true })
      .afterClosed().subscribe(ok => this.reloadAfter(ok));
  }

  editPlan(plan: any): void {
    this.dialog.open(UserPlanUIComponent, { width: '500px', maxWidth: '96vw', disableClose: true, data: plan })
      .afterClosed().subscribe(ok => this.reloadAfter(ok));
  }

  /** Features are managed on the Plan Feature Assignment page, opened with this plan selected. */
  editFeatures(plan: any): void {
    this.router.navigate(['/' + this.sharedService.getRole(), 'planfeatureassignment'], { queryParams: { plan: plan.planId } });
  }

  assignToUser(plan: any): void {
    this.dialog.open(AssignPlanDialogComponent, {
      width: '520px', maxWidth: '96vw', disableClose: true,
      data: { plan, plans: this.plans }
    }).afterClosed().subscribe(ok => this.reloadAfter(ok));
  }

  toggleStatus(plan: any): void {
    const enabling = !this.isEnabled(plan);

    this.notify.popupWarning(
      `${enabling ? 'Enable' : 'Disable'} ${plan.plan_name}?`,
      enabling
        ? 'It will be offered to subscribers again.'
        : 'It will no longer be offered to new subscribers. Existing subscriptions and payment records are kept.'
    ).then(result => {
      if (!result.isConfirmed) { return; }

      this.busyId = plan.planId;
      const call = enabling
        ? this.userPlanService.activate(plan.planId)
        : this.userPlanService.deactivate(plan.planId);

      call.subscribe({
        next: (res: any) => {
          this.busyId = null;
          res?.success ? this.notify.toastrSuccess(res.message) : this.notify.toastrError(res?.message || 'Could not update the plan.');
          this.loadPlans();
        },
        error: (err) => {
          this.busyId = null;
          this.notify.toastrError(err?.error?.message || 'Could not update the plan.');
        }
      });
    });
  }

  makePopular(plan: any): void {
    this.notify.popupWarning(
      `Make ${plan.plan_name} the Most Popular plan?`,
      'The badge moves from the current Most Popular plan to this one.'
    ).then(result => {
      if (!result.isConfirmed) { return; }

      this.busyId = plan.planId;
      this.userPlanService.setPopular(plan.planId).subscribe({
        next: (res: any) => {
          this.busyId = null;
          res?.success ? this.notify.toastrSuccess(res.message) : this.notify.toastrError(res?.message || 'Could not update the plan.');
          this.loadPlans();
        },
        error: (err) => {
          this.busyId = null;
          this.notify.toastrError(err?.error?.message || 'Could not update the plan.');
        }
      });
    });
  }

  /* =====================================
     Disable Right Click
  ===================================== */

  @HostListener('document:contextmenu', ['$event'])
  onRightClick(event: MouseEvent): void {
    if (this.canManagePlans) { return; }
    event.preventDefault();
  }

  /* =====================================
     Disable Common Developer Shortcuts
  ===================================== */

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {

    if (this.canManagePlans) { return; }

    const key = event.key.toUpperCase();

    if (
      key === 'F12' ||
      (event.ctrlKey && key === 'U') ||
      (event.ctrlKey && event.shiftKey &&
        ['I', 'J', 'C', 'K'].includes(key))
    ) {
      event.preventDefault();
      event.stopPropagation();
    }

  }

}