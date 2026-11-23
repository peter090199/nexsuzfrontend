import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MaterialModule } from 'src/Material/Material.module';
import { SubscriptionApiService } from './shared/subscription-api.service';
import { SubPageHeaderComponent } from './shared/sub-page-header.component';
import { SubscriptionPlansComponent } from './subscription-plans/subscription-plans.component';
import { FeatureManagementComponent } from './feature-management/feature-management.component';
import { PlanFeatureAssignmentComponent } from './plan-feature-assignment/plan-feature-assignment.component';
import { UserSubscriptionMonitoringComponent } from './user-subscription-monitoring/user-subscription-monitoring.component';
import { SubscriptionReportsComponent } from './subscription-reports/subscription-reports.component';

describe('SubscriptionApiService', () => {
  let api: SubscriptionApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    api = TestBed.inject(SubscriptionApiService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('sends the bearer token and maps plans (price to number)', () => {
    sessionStorage.setItem('token', 'abc');
    let out: any;
    api.plans().subscribe(p => out = p);
    const req = http.expectOne(r => r.url.endsWith('account-plan/list?all=1'));
    expect(req.request.headers.get('Authorization')).toBe('Bearer abc');
    req.flush({ success: true, data: [{ planId: 'PLN1', plan_name: 'Free', price: '0.00', subscribers: 3 }] });
    expect(out[0].price).toBe(0);
    expect(out[0].subscribers).toBe(3);
  });

  it('builds subscriber query params and skips empty ones', () => {
    api.subscribers({ search: 'ann', status: '', page: 2, per_page: 8 }).subscribe();
    const req = http.expectOne(r => r.url.endsWith('subscription-admin/subscribers'));
    expect(req.request.params.get('search')).toBe('ann');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.has('status')).toBeFalse();
    req.flush({ data: [], meta: { total: 0, per_page: 8, current_page: 1, last_page: 1 }, counts: {} });
  });

  it('saves assignments with PUT to the plan', () => {
    api.saveAssignments('PLN1', [{ feature_id: 1, enabled: true, limit: 5, unlimited: false }]).subscribe();
    const req = http.expectOne(r => r.url.endsWith('subscription-admin/assignments/PLN1'));
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.items.length).toBe(1);
    req.flush({});
  });

  it('extracts the first validation message, then the message, then a fallback', () => {
    expect(SubscriptionApiService.errorMessage({ error: { errors: { x: ['Bad x'] }, message: 'm' } })).toBe('Bad x');
    expect(SubscriptionApiService.errorMessage({ error: { message: 'Nope' } })).toBe('Nope');
    expect(SubscriptionApiService.errorMessage({})).toContain('Something went wrong');
  });
});

describe('Subscription pages render', () => {
  const pages: any[] = [SubscriptionPlansComponent, FeatureManagementComponent, PlanFeatureAssignmentComponent,
    UserSubscriptionMonitoringComponent, SubscriptionReportsComponent];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MaterialModule, FormsModule, ReactiveFormsModule, NoopAnimationsModule, HttpClientTestingModule, RouterTestingModule],
      declarations: [SubPageHeaderComponent, ...pages],
    }).compileComponents();
  });

  pages.forEach(p => {
    it(p.name + ' creates and renders its header while loading', () => {
      const f = TestBed.createComponent(p);
      f.detectChanges();
      expect((f.nativeElement as HTMLElement).querySelector('h1')).toBeTruthy();
    });
  });

  it('plans page shows an error banner with retry when the API fails', () => {
    const http = TestBed.inject(HttpTestingController);
    const f = TestBed.createComponent(SubscriptionPlansComponent);
    f.detectChanges();
    // forkJoin cancels the sibling requests after the first error, so only one needs to fail
    http.match(() => true)[0].flush({ message: 'Only a master administrator can do this.' }, { status: 403, statusText: 'Forbidden' });
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).querySelector('.state.error')?.textContent).toContain('Only a master administrator');
  });
});
