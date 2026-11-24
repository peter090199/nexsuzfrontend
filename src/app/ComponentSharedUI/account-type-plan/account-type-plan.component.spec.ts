import { NexsuzTestingModule } from 'src/testing/nexsuz-testing.module';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { UserPlanService } from 'src/app/services/AccountPlan/user-plan.service';

import { AccountTypePlanComponent } from './account-type-plan.component';

describe('AccountTypePlanComponent', () => {
  let component: AccountTypePlanComponent;
  let fixture: ComponentFixture<AccountTypePlanComponent>;
  let svc: UserPlanService;
  let router: Router;

  const feat = (name: string, included: boolean, detail = '') => ({ key: name.toUpperCase(), name, category: 'Jobs', icon: 'star', included, unlimited: detail === 'Unlimited', limit: null, detail });
  const plan = (over: any = {}) => ({
    planId: 'P1', plan_name: 'Free', price: 0, billing: 'monthly', tag: 'STARTER', description: 'Start here', button_name: 'Get started free',
    button_color: 'basic', is_popular: false, is_current: false, current_end: null, disabled: false, included_count: 2,
    features: [feat('Apply to Jobs', true), feat('Connections', true, '15'), feat('AI Resume Optimization', false)], ...over,
  });

  async function setup(role: string, overview: any) {
    sessionStorage.setItem('role', role);
    sessionStorage.setItem('token', 'tok');
    await TestBed.configureTestingModule({ imports: [NexsuzTestingModule], schemas: [NO_ERRORS_SCHEMA], declarations: [AccountTypePlanComponent] }).compileComponents();
    svc = TestBed.inject(UserPlanService);
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.returnValue(Promise.resolve(true));
    spyOn(svc, 'overview').and.returnValue(overview);
    fixture = TestBed.createComponent(AccountTypePlanComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }
  afterEach(() => { sessionStorage.removeItem('role'); sessionStorage.removeItem('token'); });

  const el = () => fixture.nativeElement as HTMLElement;

  it('should create', async () => {
    await setup('DEF-USERS', of({ success: true, data: { audience: 'DEF-USERS', plans: [] } }));
    expect(component).toBeTruthy();
  });

  it('a job seeker loads their plans from the overview endpoint, one call, no per-plan requests', async () => {
    await setup('DEF-USERS', of({ success: true, data: { audience: 'DEF-USERS', plans: [plan(), plan({ planId: 'P2', plan_name: 'Basic', price: 199 })] } }));
    expect(svc.overview).toHaveBeenCalledTimes(1);
    expect(component.plans.map(p => p.planId)).toEqual(['P1', 'P2']);
    expect(component.plans[1].tagmonthYear).toBe('Monthly');
    expect(el().querySelectorAll('.plan-box').length).toBe(2);
  });

  it('a recruiter uses the same page and gets their own plans', async () => {
    await setup('DEF-CLIENT', of({ success: true, data: { audience: 'DEF-CLIENT', plans: [plan({ planId: 'R1', plan_name: 'Hire', price: 1500 })] } }));
    expect(component.plans[0].planId).toBe('R1');
    expect(el().textContent).toContain('Hire');
  });

  it('lists included features with their limits and keeps the missing ones hidden until asked', async () => {
    await setup('DEF-USERS', of({ success: true, data: { plans: [plan()] } }));
    expect(component.featureRows(component.plans[0]).map(f => f.name)).toEqual(['Apply to Jobs', 'Connections']);
    expect(component.featureRows(component.plans[0])[1].detail).toBe('15');
    expect(el().textContent).toContain('15');
    expect(el().textContent).toContain('2 features included');
    expect(el().textContent).not.toContain('AI Resume Optimization');
    expect(component.hasMissing(component.plans[0])).toBeTrue();

    component.toggleMissing('P1');
    fixture.detectChanges();
    expect(el().textContent).toContain('AI Resume Optimization');
    expect(component.featureRows(component.plans[0]).find(f => f.name === 'AI Resume Optimization')!.included).toBeFalse();
    expect(el().querySelector('.feature.na')).toBeTruthy();
  });

  it('shows "Unlimited" limits', async () => {
    await setup('DEF-USERS', of({ success: true, data: { plans: [plan({ features: [feat('Job Applications', true, 'Unlimited')] })] } }));
    expect(el().textContent).toContain('Unlimited');
  });

  it('marks the current plan with its end date and disables its button and the locked downgrades', async () => {
    await setup('DEF-USERS', of({ success: true, data: { plans: [
      plan({ planId: 'P1', plan_name: 'Free', disabled: true }),
      plan({ planId: 'P2', plan_name: 'Basic', is_current: true, current_end: '2026-12-31 00:00:00' }),
      plan({ planId: 'P3', plan_name: 'Premium', button_name: 'Go Premium' }),
    ] } }));
    expect(component.buttonLabel(component.plans[0])).toBe('Downgrade');
    expect(component.buttonLabel(component.plans[1])).toBe('Current Plan');
    expect(component.buttonLabel(component.plans[2])).toBe('Go Premium');
    expect(el().querySelector('.current-badge')!.textContent).toContain('Dec 31, 2026');
    const buttons = Array.from(el().querySelectorAll('button[mat-raised-button]')) as HTMLButtonElement[];
    expect(buttons.map(b => b.disabled)).toEqual([true, true, false]);
  });

  it('choosing a plan opens the checkout for the account\'s own role', async () => {
    await setup('DEF-USERS', of({ success: true, data: { plans: [plan({ planId: 'P3', plan_name: 'Premium', tag: 'PREMIUM' })] } }));
    component.goToCheckout(component.plans[0]);
    expect(router.navigate).toHaveBeenCalledWith(['/DEF-USERS', 'checkout', 'P3']);
  });

  it('a recruiter goes to the recruiter checkout', async () => {
    await setup('DEF-CLIENT', of({ success: true, data: { plans: [plan({ planId: 'R1', tag: 'STARTER' })] } }));
    component.goToCheckout(component.plans[0]);
    expect(router.navigate).toHaveBeenCalledWith(['/DEF-CLIENT', 'checkout', 'R1']);
  });

  it('says so when no plans are published for this account type', async () => {
    await setup('DEF-CLIENT', of({ success: true, data: { audience: 'DEF-CLIENT', plans: [] } }));
    const state = el().querySelector('[data-testid="no-plans"]')!;
    expect(state).toBeTruthy();
    expect(state.textContent).toContain('Recruiter plans have not been published');
    expect(el().querySelector('.plan-box')).toBeNull();
  });

  it('shows an error with Retry when the plans cannot be loaded, and recovers', async () => {
    await setup('DEF-USERS', throwError(() => ({ status: 500 })));
    expect(component.loadFailed).toBeTrue();
    expect(el().querySelector('.plans-state.error')!.textContent).toContain('couldn\'t load the plans');
    (svc.overview as jasmine.Spy).and.returnValue(of({ success: true, data: { plans: [plan()] } }));
    component.loadPlans();
    fixture.detectChanges();
    expect(component.loadFailed).toBeFalse();
    expect(el().querySelectorAll('.plan-box').length).toBe(1);
  });

  it('DEF-ADMIN and DEF-MASTERADMIN get the plan management tools; job seekers and recruiters do not', async () => {
    const empty = () => of({ success: true, data: { plans: [] } });
    const getAll = (r: string) => `${r}`;
    for (const [role, manage] of [['DEF-ADMIN', true], ['DEF-MASTERADMIN', true], ['DEF-USERS', false], ['DEF-CLIENT', false]] as [string, boolean][]) {
      TestBed.resetTestingModule();
      await setup(role, empty());
      expect(component.canManagePlans).withContext(getAll(role)).toBe(manage);
      expect(el().querySelector('.admin-bar') !== null).withContext(getAll(role)).toBe(manage);
    }
  });
});
