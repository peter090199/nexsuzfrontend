import { TestBed } from '@angular/core/testing';
import { HTTP_INTERCEPTORS, HttpClient } from '@angular/common/http';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { FeatureService } from 'src/app/services/AccountPlan/feature.service';
import { FeatureLockInterceptor } from './feature-lock.interceptor';

describe('FeatureLockInterceptor', () => {
  let http: HttpClient;
  let ctrl: HttpTestingController;
  let features: { lockedByServer: jasmine.Spy };

  beforeEach(() => {
    features = { lockedByServer: jasmine.createSpy('lockedByServer') };
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        { provide: FeatureService, useValue: features },
        { provide: HTTP_INTERCEPTORS, useClass: FeatureLockInterceptor, multi: true },
      ],
    });
    http = TestBed.inject(HttpClient);
    ctrl = TestBed.inject(HttpTestingController);
  });

  it('shows the plan message and looks at the plan again when the API says the feature is locked', () => {
    let status = 0;

    http.post('/api/savePost', {}).subscribe({ error: e => (status = e.status) });
    ctrl.expectOne('/api/savePost').flush(
      { success: false, code: 'feature_locked', feature: 'NETWORK_FEED', message: 'Not in your plan' },
      { status: 403, statusText: 'Forbidden' });

    expect(features.lockedByServer).toHaveBeenCalledWith('NETWORK_FEED', 'Not in your plan');
    expect(status).toBe(403);                      // the caller still gets the error and keeps its own handling
  });

  it('ignores other 403s (a role rule, a blocked user ...)', () => {
    http.get('/api/x').subscribe({ error: () => { } });
    ctrl.expectOne('/api/x').flush({ success: false, message: 'Your account type cannot create or edit a CV.' }, { status: 403, statusText: 'Forbidden' });

    expect(features.lockedByServer).not.toHaveBeenCalled();
  });

  it('ignores other errors and successful answers', () => {
    http.get('/api/a').subscribe({ error: () => { } });
    ctrl.expectOne('/api/a').flush('x', { status: 500, statusText: 'Server Error' });
    http.get('/api/b').subscribe();
    ctrl.expectOne('/api/b').flush({ ok: true });

    expect(features.lockedByServer).not.toHaveBeenCalled();
  });
});
