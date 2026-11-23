import { NexsuzTestingModule } from 'src/testing/nexsuz-testing.module';
import { discardPeriodicTasks, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';
import { _url } from 'src/global-variables';

import { FeatureService } from './feature.service';
import { FEATURE } from './feature-access.map';

const URL_FEATURES = `${_url}account-plan-details/my-plan-features`;

describe('FeatureService', () => {
  let service: FeatureService;
  let http: HttpTestingController;
  let snack: MatSnackBar;

  function signInAs(role: string | null): void {
    sessionStorage.clear();
    if (role) { sessionStorage.setItem('role', role); sessionStorage.setItem('token', 't'); }
  }

  /** a my-plan-features answer */
  function answer(over: any = {}): any {
    return {
      success: true, plan_applies: true, status: 'active', expires_at: null, CurrentPlan: 'Free', subscribed_plan: 'Free',
      effective_plan: 'Free', features: [{ feature_code: 'APPLY_JOBS', feature_value: 'YES' }],
      access: { APPLY_JOBS: true, MESSAGING_ACCESS: false }, messages: { MESSAGING_ACCESS: 'Messaging is not included in your plan. Upgrade your plan to use it.' },
      ...over,
    };
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [NexsuzTestingModule] });
    service = TestBed.inject(FeatureService);
    http = TestBed.inject(HttpTestingController);
    snack = TestBed.inject(MatSnackBar);
    spyOn(snack, 'open').and.returnValue({ onAction: () => of() } as any);
  });

  afterEach(() => { sessionStorage.clear(); });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ---------------------------------------------------------------- who is limited

  it('limits job seekers and recruiters only', () => {
    signInAs('DEF-USERS');   expect(service.planApplies).toBeTrue();
    signInAs('DEF-CLIENT');  expect(service.planApplies).toBeTrue();
    signInAs('DEF-ADMIN');   expect(service.planApplies).toBeFalse();
    signInAs('DEF-MASTERADMIN'); expect(service.planApplies).toBeFalse();
  });

  it('never limits an administrator and never calls the API for one', () => {
    signInAs('DEF-MASTERADMIN');

    service.refresh().subscribe();

    http.expectNone(URL_FEATURES);
    for (const code of Object.values(FEATURE)) { expect(service.allows(code)).toBeTrue(); expect(service.can(code)).toBeTrue(); }
    expect(service.allowsRoute('/DEF-MASTERADMIN/message')).toBeTrue();
  });

  // ---------------------------------------------------------------- loading

  it('reads what the plan includes from one API call and answers from it', () => {
    signInAs('DEF-USERS');

    service.refresh().subscribe();
    http.expectOne(URL_FEATURES).flush(answer());

    expect(service.allows(FEATURE.APPLY_JOBS)).toBeTrue();
    expect(service.allows(FEATURE.MESSAGING_ACCESS)).toBeFalse();
    expect(service.can(FEATURE.APPLY_JOBS)).toBeTrue();
    expect(service.can(FEATURE.MESSAGING_ACCESS)).toBeFalse();
    expect(service.message(FEATURE.MESSAGING_ACCESS)).toContain('Upgrade your plan');
    expect(service.planInfo.status).toBe('active');
    expect(service.planInfo.plan).toBe('Free');
  });

  it('shares one request between everybody who asks at the same time', () => {
    signInAs('DEF-CLIENT');

    service.refresh().subscribe();
    service.refresh().subscribe();
    service.whenLoaded().subscribe();

    http.expectOne(URL_FEATURES).flush(answer({ access: { JOB_POSTING: true } }));
  });

  it('a feature that is not enforced for this account is allowed', () => {
    signInAs('DEF-USERS');
    service.refresh().subscribe();
    http.expectOne(URL_FEATURES).flush(answer());

    expect(service.allows('SOMETHING_ELSE')).toBeTrue();
  });

  it('does not lock anybody out of the screens when the API cannot be reached', () => {
    signInAs('DEF-USERS');

    service.refresh().subscribe();
    http.expectOne(URL_FEATURES).flush('boom', { status: 500, statusText: 'Server Error' });

    expect(service.allows(FEATURE.MESSAGING_ACCESS)).toBeTrue();   // the API still refuses the actions that are really off
  });

  it('whenLoaded() waits for the first answer', fakeAsync(() => {
    signInAs('DEF-USERS');
    let done = false;

    service.whenLoaded().subscribe(() => (done = true));
    expect(done).toBeFalse();
    http.expectOne(URL_FEATURES).flush(answer());
    tick();

    expect(done).toBeTrue();
    discardPeriodicTasks();
  }));

  it('a new sign-in forgets the previous account\'s answer', () => {
    signInAs('DEF-USERS');
    service.refresh().subscribe();
    http.expectOne(URL_FEATURES).flush(answer());
    expect(service.allows(FEATURE.MESSAGING_ACCESS)).toBeFalse();

    service.invalidate();

    expect(service.allows(FEATURE.MESSAGING_ACCESS)).toBeTrue();   // unknown again, not judged on the old account
    expect(service.planInfo.status).toBe('unknown');
  });

  it('announces a change of what the account may use', () => {
    signInAs('DEF-USERS');
    const seen: number[] = [];
    service.changes$.subscribe(n => seen.push(n));

    service.refresh().subscribe();
    http.expectOne(URL_FEATURES).flush(answer());

    expect(seen.length).toBeGreaterThan(1);
  });

  // ---------------------------------------------------------------- routes

  it('knows which feature a route needs, per account type', () => {
    signInAs('DEF-USERS');
    expect(service.routeFeature('/DEF-USERS/message')).toBe(FEATURE.MESSAGING_ACCESS);
    expect(service.routeFeature('network')).toBe(FEATURE.NETWORK_FEED);
    expect(service.routeFeature('/DEF-USERS/apply-job/TR-000001')).toBe(FEATURE.APPLY_JOBS);
    expect(service.routeFeature('/DEF-USERS/user-cv?x=1')).toBe(FEATURE.CREATE_RESUME);
    expect(service.routeFeature('/DEF-USERS/home')).toBeNull();
    expect(service.routeFeature('candidates')).toBeNull();            // a recruiter page is not tied to anything for a job seeker

    signInAs('DEF-CLIENT');
    expect(service.routeFeature('candidates')).toBe(FEATURE.JOB_APPLICANTS);
    expect(service.routeFeature('/DEF-CLIENT/posting-job')).toBe(FEATURE.JOB_POSTING);
    expect(service.routeFeature('vacancies')).toBeNull();             // the list of your own jobs stays open
    expect(service.routeFeature('user-cv')).toBeNull();
  });

  it('hides a route the plan does not include', () => {
    signInAs('DEF-USERS');
    service.refresh().subscribe();
    http.expectOne(URL_FEATURES).flush(answer());

    expect(service.allowsRoute('/DEF-USERS/message')).toBeFalse();
    expect(service.allowsRoute('/DEF-USERS/home')).toBeTrue();
    expect(service.allowsRoute('/DEF-USERS/apply-job/X')).toBeTrue();
  });

  // ---------------------------------------------------------------- expiry, refusals

  it('tells the person once when the subscription has expired', () => {
    signInAs('DEF-USERS');
    service.refresh().subscribe();
    http.expectOne(URL_FEATURES).flush(answer({ status: 'expired', subscribed_plan: 'Gold', effective_plan: 'Free' }));

    expect(snack.open).toHaveBeenCalledTimes(1);
    expect((snack.open as jasmine.Spy).calls.mostRecent().args[0]).toContain('expired');
    expect(service.planInfo.status).toBe('expired');
    expect(service.planInfo.subscribed).toBe('Gold');

    service.refresh().subscribe();
    http.expectOne(URL_FEATURES).flush(answer({ status: 'expired', subscribed_plan: 'Gold', effective_plan: 'Free' }));
    expect(snack.open).toHaveBeenCalledTimes(1);                  // not again in the same session
  });

  it('shows the upgrade message for a refused feature, but not over and over', () => {
    signInAs('DEF-USERS');

    service.notifyLocked(FEATURE.MESSAGING_ACCESS, 'Messaging is not in your plan.');
    service.notifyLocked(FEATURE.MESSAGING_ACCESS, 'Messaging is not in your plan.');

    expect(snack.open).toHaveBeenCalledTimes(1);
  });

  it('looks at the plan again when the API refuses something', () => {
    signInAs('DEF-USERS');

    service.lockedByServer(FEATURE.APPLY_JOBS, 'Not in your plan');

    http.expectOne(URL_FEATURES).flush(answer({ access: { APPLY_JOBS: false } }));
    expect(service.allows(FEATURE.APPLY_JOBS)).toBeFalse();
  });

  it('refreshes at the moment a subscription runs out', fakeAsync(() => {
    signInAs('DEF-USERS');
    const soon = new Date(Date.now() + 5000).toISOString();          // the API sends an ISO timestamp with its offset

    service.refresh().subscribe();
    http.expectOne(URL_FEATURES).flush(answer({ expires_at: soon, status: 'active' }));
    tick(7000);

    http.expectOne(URL_FEATURES).flush(answer({ status: 'expired' }));   // looked again by itself
    expect(service.planInfo.status).toBe('expired');
    discardPeriodicTasks();
  }));
});
