import { Component } from '@angular/core';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { NotificationsService } from 'src/app/services/Global/notifications.service';
import { routes } from '../app-routing.module';
import { CvSetupGuard } from './cv-setup.guard';

@Component({ template: '' }) class DummyComponent { }

describe('CvSetupGuard', () => {
  let router: Router;
  let http: HttpTestingController;
  let notify: jasmine.SpyObj<NotificationsService>;

  const status = (over: any = {}) => ({ success: true, data: { applies: true, complete: false, missing: ['Summary', 'Date of birth'], total: 9, ...over } });

  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem('token', 'tok');
    sessionStorage.setItem('role', 'DEF-USERS');
    notify = jasmine.createSpyObj('NotificationsService', ['toastrInfo']);
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule.withRoutes([
        {
          path: 'DEF-USERS', canActivateChild: [CvSetupGuard], children: [
            { path: 'user-cv', component: DummyComponent },
            { path: 'home', component: DummyComponent },
            { path: 'jobs', component: DummyComponent },
            { path: 'apply-job/:transNo', component: DummyComponent },
            { path: 'subscription', component: DummyComponent },
            { path: 'user-cv-evil', component: DummyComponent },
          ]
        },
        { path: 'DEF-CLIENT', canActivateChild: [CvSetupGuard], children: [{ path: 'home', component: DummyComponent }] },
      ])],
      providers: [{ provide: NotificationsService, useValue: notify }],
    });
    router = TestBed.inject(Router);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { http.verify(); sessionStorage.clear(); });

  /** Navigate and (optionally) answer the status request; returns where the user ended up. */
  function go(url: string, answer?: any, opts: { status?: number } = {}): string {
    let done = false;
    router.navigateByUrl(url).then(() => done = true);
    tick();
    const reqs = http.match(r => r.url.endsWith('cv/status'));
    if (answer !== undefined && reqs.length) {
      opts.status ? reqs[0].flush({ message: 'x' }, { status: opts.status, statusText: 'x' }) : reqs[0].flush(answer);
    }
    tick();
    expect(done).toBeTrue();
    return router.url;
  }

  it('sends an unfinished job seeker from EVERY other page to the CV editor', fakeAsync(() => {
    for (const url of ['/DEF-USERS/home', '/DEF-USERS/jobs', '/DEF-USERS/apply-job/TR-1', '/DEF-USERS/subscription', '/DEF-USERS/home?x=1#top']) {
      sessionStorage.removeItem('cv_setup_done');
      expect(go(url, status())).toBe('/DEF-USERS/user-cv', url);
    }
    expect(notify.toastrInfo).toHaveBeenCalled();
  }));

  it('lets them open the CV editor itself, without asking the API or showing a message', fakeAsync(() => {
    expect(go('/DEF-USERS/user-cv')).toBe('/DEF-USERS/user-cv');
    expect(go('/DEF-USERS/user-cv?step=2#x')).toBe('/DEF-USERS/user-cv?step=2#x');
    http.expectNone(r => r.url.endsWith('cv/status'));
    expect(notify.toastrInfo).not.toHaveBeenCalled();
  }));

  it('the redirect itself costs exactly one status call', fakeAsync(() => {
    let done = false;
    router.navigateByUrl('/DEF-USERS/jobs').then(() => done = true);
    tick();
    const reqs = http.match(r => r.url.endsWith('cv/status'));
    expect(reqs.length).toBe(1);
    reqs[0].flush(status());
    tick();
    expect(done).toBeTrue();
    expect(router.url).toBe('/DEF-USERS/user-cv');
    http.expectNone(r => r.url.endsWith('cv/status'));
  }));

  it('does not treat a look-alike path as the CV editor', fakeAsync(() => {
    expect(go('/DEF-USERS/user-cv-evil', status())).toBe('/DEF-USERS/user-cv');
  }));

  it('opens every page once the CV is finished, and then stops asking the API', fakeAsync(() => {
    expect(go('/DEF-USERS/home', status({ complete: true, missing: [] }))).toBe('/DEF-USERS/home');
    expect(go('/DEF-USERS/jobs')).toBe('/DEF-USERS/jobs');     // no request: remembered for this sign-in
    expect(go('/DEF-USERS/apply-job/TR-9')).toBe('/DEF-USERS/apply-job/TR-9');
  }));

  it('re-checks each time while unfinished, so finishing the CV opens the app immediately', fakeAsync(() => {
    expect(go('/DEF-USERS/jobs', status())).toBe('/DEF-USERS/user-cv');
    expect(go('/DEF-USERS/jobs', status({ complete: true, missing: [] }))).toBe('/DEF-USERS/jobs');
  }));

  it('does not touch other roles, and does not even call the API for them', fakeAsync(() => {
    sessionStorage.setItem('role', 'DEF-CLIENT');
    expect(go('/DEF-CLIENT/home')).toBe('/DEF-CLIENT/home');
    http.expectNone(r => r.url.endsWith('cv/status'));
  }));

  it('the API saying it does not apply to this account lets everything through', fakeAsync(() => {
    expect(go('/DEF-USERS/home', status({ applies: false, complete: true, missing: [] }))).toBe('/DEF-USERS/home');
  }));

  it('a server error does not lock anyone out', fakeAsync(() => {
    expect(go('/DEF-USERS/home', {}, { status: 500 })).toBe('/DEF-USERS/home');
  }));

  it('does nothing without a token (the auth guard handles that)', fakeAsync(() => {
    sessionStorage.removeItem('token');
    expect(go('/DEF-USERS/home')).toBe('/DEF-USERS/home');
    http.expectNone(r => r.url.endsWith('cv/status'));
  }));

  describe('wiring in the real route table', () => {
    const group = (path: string) => routes.find(r => r.path === path);

    it('guards every page under /DEF-USERS', () => {
      expect(group('DEF-USERS')?.canActivateChild).toContain(CvSetupGuard);
      expect(group('DEF-USERS')?.children?.some(c => c.path === 'user-cv')).toBeTrue();
    });

    it('does not guard the other roles', () => {
      for (const p of ['DEF-CLIENT', 'DEF-ADMIN', 'DEF-MASTERADMIN']) {
        expect(group(p)?.canActivateChild ?? []).not.toContain(CvSetupGuard);
      }
    });
  });
});
