import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { forkJoin } from 'rxjs';
import { PlanUsersDialogComponent } from '../dialogs/plan-users-dialog.component';
import { PlanDialogComponent } from '../dialogs/plan-dialog.component';
import { Cell, SubFeature, SubPlan, SubscriptionApiService } from '../shared/subscription-api.service';
import { Router } from '@angular/router';
import { UserPlanService } from 'src/app/services/AccountPlan/user-plan.service';
import { NotificationsService } from 'src/app/services/Global/notifications.service';
import { SharedRoutinesService } from 'src/app/services/Function/shared-routines.service';
import { AssignPlanDialogComponent } from 'src/app/ComponentSharedUI/account-type-plan/assign-plan-dialog/assign-plan-dialog.component';

@Component({
  selector: 'app-subscription-plans',
  templateUrl: './subscription-plans.component.html',
  styleUrls: ['./subscription-plans.component.scss']
})
export class SubscriptionPlansComponent implements OnInit {
  all: SubPlan[] = [];
  features: SubFeature[] = [];
  matrix: { [planId: string]: Cell[] } = {};
  loading = true;
  error = '';
  busyId = '';
  search = '';
  status: 'all' | 'active' | 'inactive' = 'all';
  audience: 'all' | 'DEF-USERS' | 'DEF-CLIENT' = 'all';

  constructor(
    private api: SubscriptionApiService, private dialog: MatDialog, private snack: MatSnackBar,
    private router: Router, private userPlans: UserPlanService, private notify: NotificationsService,
    private shared: SharedRoutinesService
  ) { }

  /** Features are managed on the Plan Feature Assignment page, opened with this plan selected. */
  editFeatures(p: SubPlan): void {
    this.router.navigate(['/' + this.shared.getRole(), 'planfeatureassignment'], { queryParams: { plan: p.planId } });
  }

  assignToUser(p: SubPlan): void {
    this.dialog.open(AssignPlanDialogComponent, {
      width: '520px', maxWidth: '96vw', disableClose: true, data: { plan: p, plans: this.all }
    }).afterClosed().subscribe(ok => { if (ok) { this.load(); } });
  }

  /** One Most Popular plan per audience (job seekers and recruiters each have their own). */
  makePopular(p: SubPlan): void {
    this.notify.popupWarning(
      `Make ${p.plan_name} the Most Popular plan?`,
      `The badge moves from the current Most Popular ${p.audience === 'DEF-CLIENT' ? 'recruiter' : 'job seeker'} plan to this one.`
    ).then(r => {
      if (!r.isConfirmed) { return; }
      this.busyId = p.planId;
      this.userPlans.setPopular(p.planId).subscribe({
        next: (res: any) => { this.busyId = ''; this.snack.open(res?.message || 'Plan updated', 'OK', { duration: 2500 }); this.load(); },
        error: err => { this.busyId = ''; this.snack.open(SubscriptionApiService.errorMessage(err), 'OK', { duration: 4000 }); },
      });
    });
  }

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true; this.error = '';
    forkJoin({ plans: this.api.plans(), feats: this.api.features(), matrix: this.api.assignmentsOverview() }).subscribe({
      next: r => { this.all = r.plans; this.features = r.feats.data; this.matrix = r.matrix; this.loading = false; },
      error: err => { this.loading = false; this.error = SubscriptionApiService.errorMessage(err, 'Could not load plans.'); },
    });
  }

  get plans(): SubPlan[] {
    const q = this.search.trim().toLowerCase();
    return this.all.filter(p =>
      (this.status === 'all' || (this.status === 'active') === (p.recordStatus === 'active')) &&
      (this.audience === 'all' || p.audience === this.audience) &&
      (!q || p.plan_name.toLowerCase().includes(q) || (p.tag || '').toLowerCase().includes(q)));
  }
  private readonly audienceTabs: Array<'all' | 'DEF-USERS' | 'DEF-CLIENT'> = ['all', 'DEF-USERS', 'DEF-CLIENT'];
  get tabIndex(): number { return this.audienceTabs.indexOf(this.audience); }
  set tabIndex(i: number) { this.audience = this.audienceTabs[i] ?? 'all'; }

  /** how many plans each audience tab holds (shown in the tab) */
  audienceCount(a: 'all' | 'DEF-USERS' | 'DEF-CLIENT'): number {
    return a === 'all' ? this.all.length : this.all.filter(p => p.audience === a).length;
  }
  get activeCount(): number { return this.all.filter(p => p.recordStatus === 'active').length; }
  get subscriberTotal(): number { return this.all.reduce((n, p) => n + (p.subscribers || 0), 0); }

  enabledCount(planId: string): number { return (this.matrix[planId] || []).filter(c => c.enabled).length; }

  /** Numeric limits shown on the card (only features that are limit-type and enabled for this plan). */
  limits(planId: string): { name: string; value: string }[] {
    return (this.matrix[planId] || [])
      .filter(c => c.enabled && (c.unlimited || c.limit !== null))
      .map(c => ({ name: this.features.find(f => f.id === c.feature_id)?.name || c.feature_code, value: c.unlimited ? 'Unlimited' : String(c.limit) }))
      .slice(0, 4);
  }

  open(plan?: SubPlan, readonly = false): void {
    this.dialog.open(PlanDialogComponent, { width: '480px', maxWidth: '95vw', data: { plan, readonly, plans: this.all, audience: this.audience === 'all' ? undefined : this.audience } })
      .afterClosed().subscribe(ok => { if (ok) { this.snack.open('Plan saved', 'OK', { duration: 2500 }); this.load(); } });
  }

  viewUsers(p: SubPlan): void {
    this.dialog.open(PlanUsersDialogComponent, { width: '520px', maxWidth: '95vw', data: { plan: p } });
  }

  toggle(p: SubPlan): void {
    const activate = p.recordStatus !== 'active';
    this.busyId = p.planId;
    this.api.setPlanActive(p.planId, activate).subscribe({
      next: r => { this.busyId = ''; this.snack.open(r.message || 'Plan updated', 'OK', { duration: 2500 }); this.load(); },
      error: err => { this.busyId = ''; this.snack.open(SubscriptionApiService.errorMessage(err), 'OK', { duration: 4000 }); },
    });
  }

  trackById(_: number, p: SubPlan): string { return p.planId; }
}
