import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { CvSetupService } from './cv-setup.service';

describe('CvSetupService', () => {
  let svc: CvSetupService;
  let http: HttpTestingController;

  const reply = (over: any = {}) => ({ success: true, data: { applies: true, complete: false, missing: ['Summary'], total: 9, ...over } });

  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem('token', 'tok-1');
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    svc = TestBed.inject(CvSetupService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { http.verify(); sessionStorage.clear(); });

  it('asks the API with the bearer token and returns the status', () => {
    let out: any;
    svc.check().subscribe(s => out = s);
    const req = http.expectOne(r => r.url.endsWith('cv/status'));
    expect(req.request.headers.get('Authorization')).toBe('Bearer tok-1');
    req.flush(reply());
    expect(out).toEqual({ applies: true, complete: false, missing: ['Summary'], total: 9 });
    expect(svc.latest?.missing).toEqual(['Summary']);
    expect(svc.isKnownComplete()).toBeFalse();
  });

  it('remembers a finished CV for this sign-in and stops calling the API', () => {
    svc.check().subscribe();
    http.expectOne(r => r.url.endsWith('cv/status')).flush(reply({ complete: true, missing: [] }));
    expect(svc.isKnownComplete()).toBeTrue();

    let out: any;
    svc.check().subscribe(s => out = s);          // no request this time
    http.expectNone(r => r.url.endsWith('cv/status'));
    expect(out.complete).toBeTrue();
  });

  it('force always asks the API again, and un-remembers if the CV is no longer finished', () => {
    svc.markComplete();
    svc.check(true).subscribe();
    http.expectOne(r => r.url.endsWith('cv/status')).flush(reply({ complete: false }));
    expect(svc.isKnownComplete()).toBeFalse();
  });

  it('a new sign-in (new token) is checked again', () => {
    svc.markComplete();
    expect(svc.isKnownComplete()).toBeTrue();
    sessionStorage.setItem('token', 'tok-2');
    expect(svc.isKnownComplete()).toBeFalse();
  });

  it('roles without a CV count as done', () => {
    svc.check().subscribe();
    http.expectOne(r => r.url.endsWith('cv/status')).flush(reply({ applies: false, complete: true, missing: [], total: 0 }));
    expect(svc.isKnownComplete()).toBeTrue();
  });

  it('never marks anything complete without a token', () => {
    sessionStorage.removeItem('token');
    svc.markComplete();
    expect(svc.isKnownComplete()).toBeFalse();
  });
});
