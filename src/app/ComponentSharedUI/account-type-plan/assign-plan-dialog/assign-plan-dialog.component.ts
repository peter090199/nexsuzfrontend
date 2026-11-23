import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, switchMap, takeUntil } from 'rxjs/operators';
import { SearchService } from 'src/app/services/search.service';
import { UserPlanService } from 'src/app/services/AccountPlan/user-plan.service';
import { NotificationsService } from 'src/app/services/Global/notifications.service';

/**
 * DEF-MASTERADMIN: change the plan of one user (assign / upgrade / downgrade).
 * Not a payment. The server records it as ADMIN_ASSIGNED with amount 0 and
 * re-checks the caller's role, so this dialog is only the UI for it.
 */
@Component({
  selector: 'app-assign-plan-dialog',
  templateUrl: './assign-plan-dialog.component.html',
  styleUrls: ['./assign-plan-dialog.component.css']
})
export class AssignPlanDialogComponent implements OnInit, OnDestroy {

  form!: FormGroup;
  users: any[] = [];
  searching = false;
  saving = false;
  selected: any = null;
  currentSub: any = null;
  loadingSub = false;
  plans: any[] = [];

  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private searchService: SearchService,
    private planService: UserPlanService,
    private notify: NotificationsService,
    private dialogRef: MatDialogRef<AssignPlanDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { plan: any; plans: any[] }
  ) { }

  ngOnInit(): void {
    this.plans = (this.data?.plans || []).filter(p => p.recordStatus === 'active');

    this.form = this.fb.group({
      search: [''],
      planId: [this.data?.plan?.planId || '', Validators.required],
      remarks: ['', Validators.maxLength(200)]
    });

    this.form.get('search')!.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$),
      switchMap(v => {
        // Choosing an option writes the user object into the control: that is not typing
        if (v && typeof v !== 'string') { return of(null); }

        const q = (v || '').trim();
        // typing again after picking a user clears the selection
        if (this.selected && q !== this.selected.fullname) { this.selected = null; this.currentSub = null; }
        if (q.length < 2 || (this.selected && q === this.selected.fullname)) { return of(null); }

        this.searching = true;
        return this.searchService.getSearch(q).pipe(catchError(() => of(null)));
      })
    ).subscribe(res => {
      this.searching = false;
      this.users = res ? [...(res.online || []), ...(res.offline || [])].slice(0, 12) : [];
    });
  }

  displayUser = (u: any): string => (u && typeof u === 'object' ? u.fullname : u) || '';

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  pick(user: any): void {
    this.selected = user;
    this.form.get('search')!.setValue(user.fullname, { emitEvent: false });
    this.users = [];
    this.loadingSub = true;
    this.currentSub = null;

    this.planService.getUserSubscription(user.code).subscribe({
      next: (res: any) => { this.currentSub = res?.subscription || null; this.loadingSub = false; },
      error: () => { this.loadingSub = false; this.notify.toastrError('Could not load this user\'s subscription.'); }
    });
  }

  get chosenPlan(): any {
    return this.plans.find(p => p.planId === this.form.get('planId')?.value);
  }

  /** upgrade / downgrade / same, based on plan_level */
  get change(): 'new' | 'same' | 'upgrade' | 'downgrade' | null {
    if (!this.selected || !this.chosenPlan || this.loadingSub) { return null; }
    if (!this.currentSub) { return 'new'; }
    if (this.currentSub.planId === this.chosenPlan.planId) { return 'same'; }
    const cur = this.plans.find(p => p.planId === this.currentSub.planId);
    return cur && Number(this.chosenPlan.plan_level) < Number(cur.plan_level) ? 'downgrade' : 'upgrade';
  }

  get canSave(): boolean {
    return !!this.selected && this.form.valid && !this.saving && !this.loadingSub && this.change !== 'same';
  }

  save(): void {
    if (!this.canSave) { return; }
    const plan = this.chosenPlan;

    this.notify.popupWarning(
      `${this.change === 'downgrade' ? 'Downgrade' : this.change === 'upgrade' ? 'Upgrade' : 'Assign'} ${this.selected.fullname}?`,
      `Their plan will change to ${plan.plan_name}. This is recorded as an admin change, not a payment.`
    ).then(result => {
      if (!result.isConfirmed) { return; }

      this.saving = true;
      this.planService.assignPlan({
        code: this.selected.code,
        planId: plan.planId,
        remarks: this.form.get('remarks')?.value || ''
      }).subscribe({
        next: (res: any) => {
          this.saving = false;
          if (res?.success) {
            this.notify.toastrSuccess(res.message);
            this.dialogRef.close(true);
          } else {
            this.notify.toastrError(res?.message || 'Could not change the subscription.');
          }
        },
        error: (err) => {
          this.saving = false;
          this.notify.toastrError(err?.error?.message || 'Could not change the subscription.');
        }
      });
    });
  }

  close(): void {
    this.dialogRef.close();
  }
}
