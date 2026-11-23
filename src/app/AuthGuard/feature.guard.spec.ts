import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, UrlTree } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { Observable, of } from 'rxjs';
import { FeatureService } from 'src/app/services/AccountPlan/feature.service';
import { FeatureGuard } from './feature.guard';

describe('FeatureGuard', () => {
  let guard: FeatureGuard;
  let router: Router;
  let features: { planApplies: boolean; allowed: Record<string, boolean>; whenLoaded: jasmine.Spy; allows: jasmine.Spy; notifyLocked: jasmine.Spy };

  const route = (feature?: string | string[]) => ({ data: feature === undefined ? {} : { feature } }) as unknown as ActivatedRouteSnapshot;

  /** the guard's answer, whether it is immediate or an observable */
  function result(r: boolean | UrlTree | Observable<boolean | UrlTree>): boolean | UrlTree {
    let out: boolean | UrlTree = false;
    if (typeof r === 'boolean' || r instanceof UrlTree) { return r; }
    r.subscribe(v => (out = v));
    return out;
  }

  beforeEach(() => {
    sessionStorage.setItem('role', 'DEF-USERS');
    features = {
      planApplies: true, allowed: {},
      whenLoaded: jasmine.createSpy('whenLoaded').and.callFake(() => of(void 0)),
      allows: jasmine.createSpy('allows').and.callFake((c: string) => features.allowed[c] !== false),
      notifyLocked: jasmine.createSpy('notifyLocked'),
    };
    TestBed.configureTestingModule({ imports: [RouterTestingModule], providers: [{ provide: FeatureService, useValue: features }] });
    guard = TestBed.inject(FeatureGuard);
    router = TestBed.inject(Router);
  });

  afterEach(() => sessionStorage.clear());

  it('lets a route with no feature through', () => {
    expect(result(guard.canActivate(route()))).toBeTrue();
    expect(features.whenLoaded).not.toHaveBeenCalled();
  });

  it('never limits an account that plans do not apply to', () => {
    features.planApplies = false;
    features.allowed['MESSAGING_ACCESS'] = false;

    expect(result(guard.canActivate(route('MESSAGING_ACCESS')))).toBeTrue();
  });

  it('opens a route whose feature the plan includes', () => {
    expect(result(guard.canActivate(route('MESSAGING_ACCESS')))).toBeTrue();
    expect(features.notifyLocked).not.toHaveBeenCalled();
  });

  it('waits for the answer, then refuses a route whose feature is missing: message and redirect home', () => {
    features.allowed['MESSAGING_ACCESS'] = false;

    const r = result(guard.canActivate(route('MESSAGING_ACCESS')));

    expect(features.whenLoaded).toHaveBeenCalled();
    expect(r instanceof UrlTree).toBeTrue();
    expect(router.serializeUrl(r as UrlTree)).toBe('/DEF-USERS/home');
    expect(features.notifyLocked).toHaveBeenCalledWith('MESSAGING_ACCESS');
  });

  it('sends a recruiter to their own home', () => {
    sessionStorage.setItem('role', 'DEF-CLIENT');
    features.allowed['JOB_POSTING'] = false;

    const r = result(guard.canActivate(route('JOB_POSTING')));

    expect(router.serializeUrl(r as UrlTree)).toBe('/DEF-CLIENT/home');
  });

  it('with several features, every one must be included', () => {
    features.allowed['JOB_APPLICANTS'] = false;

    expect(result(guard.canActivate(route(['JOB_POSTING', 'JOB_APPLICANTS']))) instanceof UrlTree).toBeTrue();
    expect(features.notifyLocked).toHaveBeenCalledWith('JOB_APPLICANTS');
    expect(result(guard.canActivate(route(['JOB_POSTING', 'MESSAGING_ACCESS'])))).toBeTrue();
  });
});
