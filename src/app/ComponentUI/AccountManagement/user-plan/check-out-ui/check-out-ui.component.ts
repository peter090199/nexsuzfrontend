import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { finalize, take } from 'rxjs/operators';

import { UserPlanService } from 'src/app/services/AccountPlan/user-plan.service';
import { SubscriptionService } from 'src/app/services/AccountPlan/subscription.service';
import { FeatureService } from 'src/app/services/AccountPlan/feature.service';
import { SharedRoutinesService } from 'src/app/services/Function/shared-routines.service';
import { NotificationsService } from 'src/app/services/Global/notifications.service';
import { TermsModalComponent } from 'src/app/TermsModal/terms-modal/terms-modal.component';
import { PrivacyComponent } from 'src/app/TermsModal/privacy/privacy.component';

type PaymentMethod = 'gcash' | 'paypal' | 'card';

@Component({
  selector: 'app-check-out-ui',
  templateUrl: './check-out-ui.component.html',
  styleUrls: ['./check-out-ui.component.css']
})
export class CheckOutUIComponent implements OnInit {

  readonly vatRate = 0.12;

  plan: any = null;
  planId: string | null = null;
  account: any = null;

  isLoading = false;
  planNotFound = false;
  isSubmitting = false;
  isSuccess = false;
  successData: any = null;
  errorMessage = '';

  selectedPayment: PaymentMethod | null = null;
  agreed = false;
  submitted = false; // true after the first attempt -> show validation messages

  readonly paymentMethods: { value: PaymentMethod; label: string; hint: string; icon: string }[] = [
    { value: 'gcash', label: 'GCash', hint: 'Pay with your GCash wallet', icon: 'smartphone' },
    { value: 'paypal', label: 'PayPal', hint: 'Pay with your PayPal account', icon: 'account_balance_wallet' },
    { value: 'card', label: 'Credit / Debit Card', hint: 'Visa, Mastercard and more', icon: 'credit_card' }
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private dialog: MatDialog,
    private userPlanService: UserPlanService,
    private subscriptionService: SubscriptionService,
    private featureService: FeatureService,
    private notification: NotificationsService,
    public sharedService: SharedRoutinesService
  ) { }

  ngOnInit(): void {
    this.loadAccount();

    // react to route changes so /checkout/:planId always shows the selected plan
    this.route.paramMap.subscribe(params => {
      this.planId = params.get('planId');
      this.plan = null;
      this.planNotFound = false;
      this.isSuccess = false;
      this.errorMessage = '';

      if (!this.planId) {
        this.planNotFound = true;
        return;
      }
      this.loadPlan(this.planId);
    });
  }

  /* ---------- pricing ---------- */

  get isFree(): boolean {
    return !!this.plan && this.price === 0;
  }

  get price(): number {
    return Number(this.plan?.price ?? 0);
  }

  get discount(): number {
    const d = Number(this.plan?.discount ?? 0);
    return d > 0 ? Math.min(d, this.price) : 0;
  }

  get subtotal(): number {
    return +(this.price - this.discount).toFixed(2);
  }

  get vat(): number {
    return +(this.subtotal * this.vatRate).toFixed(2);
  }

  get total(): number {
    return +(this.subtotal + this.vat).toFixed(2);
  }

  /** Subscription period matches the backend: one month from activation. */
  get periodEnd(): Date {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d;
  }

  get accountName(): string {
    const a = this.account;
    if (!a) { return ''; }
    return a.fullname || [a.fname, a.lname].filter(Boolean).join(' ') || a.username || '';
  }

  get paymentInvalid(): boolean {
    return !this.isFree && !this.selectedPayment;
  }

  get agreementInvalid(): boolean {
    return !this.agreed;
  }

  /* ---------- actions ---------- */

  selectPayment(method: PaymentMethod): void {
    this.selectedPayment = method;
    this.errorMessage = '';
  }

  openTerms(): void {
    this.dialog.open(TermsModalComponent, { data: { title: 'Terms of Use', content: '' }, width: '80%', maxWidth: '600px' });
  }

  openPrivacy(): void {
    this.dialog.open(PrivacyComponent, { data: { title: 'Data Privacy Policy', content: '' }, width: '80%', maxWidth: '600px' });
  }

  viewPlans(): void {
    this.router.navigateByUrl('/');
  }

  goToDashboard(): void {
    const role = sessionStorage.getItem('role') || 'DEF-USERS';
    this.router.navigateByUrl(`/${role}/home`);
  }

  subscribe(): void {
    if (this.isSubmitting || this.isSuccess) {
      return; // prevent duplicate submissions
    }

    this.submitted = true;
    this.errorMessage = '';

    if (!this.plan) {
      this.errorMessage = 'Plan not found.';
      return;
    }
    if (this.paymentInvalid || this.agreementInvalid) {
      return;
    }

    this.isSubmitting = true;

    const request$ = this.isFree
      ? this.userPlanService.activateFreePlan()
      : this.userPlanService.upgradePlan({
        planId: this.plan.planId,
        payment_method: this.getPaymentMethod()
      });

    request$
      .pipe(take(1), finalize(() => this.isSubmitting = false))
      .subscribe({
        next: (res: any) => {
          if (res?.success) {
            this.successData = res.data || null;
            this.isSuccess = true;
            this.notification.toastrSuccess(res.message || 'Subscription activated successfully.');
            this.refreshFeatures();
          } else {
            this.errorMessage = res?.message || 'Unable to complete your subscription.';
          }
        },
        error: (err) => {
          this.errorMessage = err?.error?.message || 'Something went wrong. Please try again.';
        }
      });
  }

  /* ---------- private ---------- */

  private getPaymentMethod(): string {
    const paymentMap: Record<PaymentMethod, string> = {
      gcash: 'GCash',
      paypal: 'PayPal',
      card: 'Credit Card'
    };
    return this.selectedPayment ? paymentMap[this.selectedPayment] : '';
  }

  /** Reload the user's feature access so the new plan applies immediately. */
  private refreshFeatures(): void {
    this.featureService.refresh().subscribe();
  }

  private loadAccount(): void {
    this.userPlanService.getCurrentUser().pipe(take(1)).subscribe({
      next: (u: any) => this.account = u,
      error: () => this.account = null
    });
  }

  private loadPlan(planId: string): void {
    this.isLoading = true;

    this.userPlanService.getById(planId)
      .pipe(take(1), finalize(() => this.isLoading = false))
      .subscribe({
        next: (res: any) => {
          if (res?.success && res.data) {
            this.plan = res.data;
          } else {
            this.planNotFound = true;
          }
        },
        error: () => {
          this.planNotFound = true;
        }
      });
  }

}
