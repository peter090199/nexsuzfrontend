import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MaterialModule } from 'src/Material/Material.module';
import { NotificationsService } from 'src/app/services/Global/notifications.service';
import { SubPageHeaderComponent } from '../SubscriptionManagement/shared/sub-page-header.component';
import { EmailConfigComponent } from './email-config.component';
import { EmailConfigService } from './email-config.service';

describe('EmailConfigComponent', () => {
  let http: HttpTestingController;
  let confirmAnswer = true;

  const view = (over: any = {}) => ({
    mailer: 'smtp',
    providers: {
      hostinger: { label: 'Hostinger', host: 'smtp.hostinger.com', port: 465, encryption: 'ssl', note: 'Use your full mailbox address.' },
      gmail: { label: 'Gmail', host: 'smtp.gmail.com', port: 587, encryption: 'tls', note: 'Needs an App Password.' },
      custom: { label: 'Custom SMTP', host: '', port: 587, encryption: 'tls', note: '' },
    },
    saved: false, source: 'env',
    settings: { provider: 'hostinger', host: 'smtp.hostinger.com', port: 465, encryption: 'ssl', username: 'admin01@nexsuz.com', from_address: 'admin01@nexsuz.com', from_name: 'Nexsuz', has_password: true },
    env_fallback: { host: 'smtp.hostinger.com', port: 465, encryption: 'ssl', username: 'admin01@nexsuz.com', from_address: 'admin01@nexsuz.com', from_name: 'Nexsuz' },
    status: { enabled: true, connection: 'not_tested', last_test_at: null, last_success_at: null, last_error: null },
    ...over,
  });

  beforeEach(async () => {
    confirmAnswer = true;
    await TestBed.configureTestingModule({
      imports: [MaterialModule, FormsModule, ReactiveFormsModule, NoopAnimationsModule, HttpClientTestingModule],
      declarations: [SubPageHeaderComponent, EmailConfigComponent],
      providers: [{ provide: NotificationsService, useValue: { popupWarning: () => Promise.resolve({ isConfirmed: confirmAnswer }) } }],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  const make = (v: any = view()) => {
    const f = TestBed.createComponent(EmailConfigComponent);
    f.detectChanges();
    http.expectOne(r => r.url.endsWith('email-config') && r.method === 'GET').flush({ success: true, data: v });
    f.detectChanges();
    return f;
  };
  const flush = () => new Promise(r => setTimeout(r));

  it('loads the saved settings into the form (password stays empty) and shows the .env fallback notice', () => {
    const f = make(); const c = f.componentInstance;
    expect(c.form.value.host).toBe('smtp.hostinger.com');
    expect(c.form.value.port).toBe(465);
    expect(c.form.value.password).toBe('');
    expect(c.hasPassword).toBeTrue();
    expect(c.dirty).toBeFalse();
    expect((f.nativeElement as HTMLElement).textContent).toContain('No configuration is saved yet');
    expect(c.configState.label).toContain('Not saved');
  });

  it('nothing is hard-coded: providers and their defaults come from the API', () => {
    const c = make().componentInstance;
    expect(c.providers.map(p => p.id)).toEqual(['hostinger', 'gmail', 'custom']);
    c.form.patchValue({ provider: 'gmail' });
    c.onProvider('gmail');
    expect(c.form.value.host).toBe('smtp.gmail.com');
    expect(c.form.value.port).toBe(587);
    expect(c.form.value.encryption).toBe('tls');
    expect(c.providerNote).toBe('Needs an App Password.');
    c.form.patchValue({ host: 'smtp.mycompany.test' });      // still editable
    expect(c.form.value.host).toBe('smtp.mycompany.test');
    c.onProvider('custom');                                   // custom never overwrites what was typed
    expect(c.form.value.host).toBe('smtp.mycompany.test');
  });

  it('tracks unsaved changes and validates the fields', () => {
    const c = make().componentInstance;
    c.form.patchValue({ host: 'http://bad host' });
    expect(c.dirty).toBeTrue();
    expect(c.form.get('host')?.hasError('pattern')).toBeTrue();
    expect(c.canSubmit).toBeFalse();
    c.form.patchValue({ host: 'smtp.ok.test', from_address: 'not-an-email' });
    expect(c.canSubmit).toBeFalse();
    c.form.patchValue({ from_address: 'a@ok.test', port: 70000 });
    expect(c.canSubmit).toBeFalse();
    c.form.patchValue({ port: 587 });
    expect(c.canSubmit).toBeTrue();
  });

  it('requires a password the first time but not when one is already stored', () => {
    const c = make(view({ settings: { ...view().settings, has_password: false } })).componentInstance;
    expect(c.canSubmit).toBeFalse();
    c.form.patchValue({ password: 'pw' });
    expect(c.canSubmit).toBeTrue();
  });

  it('first save POSTs, omits a blank password, and adopts the saved view', () => {
    const f = make(); const c = f.componentInstance;
    c.form.patchValue({ host: 'smtp.new.test' });
    c.submit();
    const req = http.expectOne(r => r.url.endsWith('email-config') && r.method === 'POST');
    expect('password' in req.request.body).toBeFalse();
    expect(req.request.body.host).toBe('smtp.new.test');
    req.flush({ success: true, message: 'SMTP configuration saved.', data: view({ saved: true, source: 'database', settings: { ...view().settings, host: 'smtp.new.test' } }) });
    expect(c.saved).toBeTrue();
    expect(c.dirty).toBeFalse();
    expect(c.lastResult?.ok).toBeTrue();
    expect(c.configState.label).toBe('Saved');
  });

  it('after saving, the button becomes Update and uses PUT; typed passwords are sent, then cleared', async () => {
    const f = make(view({ saved: true, source: 'database' })); const c = f.componentInstance;
    c.form.patchValue({ password: 'new-secret' });
    expect(c.dirty).toBeTrue();
    c.submit();
    await flush();                                    // enabled + saved asks for confirmation first
    const req = http.expectOne(r => r.url.endsWith('email-config') && r.method === 'PUT');
    expect(req.request.body.password).toBe('new-secret');
    req.flush({ success: true, message: 'updated', data: view({ saved: true, source: 'database' }) });
    expect(c.form.value.password).toBe('');
  });

  it('shows the server error and keeps the form when the SMTP server refuses the credentials', () => {
    const f = make(); const c = f.componentInstance;
    c.form.patchValue({ password: 'wrong' });
    c.submit();
    http.expectOne(r => r.method === 'POST' && r.url.endsWith('email-config'))
      .flush({ success: false, message: 'Not saved. The SMTP server refused the connection: 535 Authentication failed.' }, { status: 422, statusText: 'x' });
    http.match(r => r.method === 'GET').forEach(r => r.flush({ success: true, data: view() }));
    expect(c.lastResult?.ok).toBeFalse();
    expect(c.lastResult?.text).toContain('535');
    expect(c.form.value.password).toBe('wrong');
  });

  it('test connection: sends the typed values when edited, nothing when untouched', () => {
    const c = make().componentInstance;
    c.testConnection();
    let req = http.expectOne(r => r.url.endsWith('test-connection'));
    expect(req.request.body).toEqual({});
    req.flush({ success: true, message: 'Connected', data: view({ status: { ...view().status, connection: 'connected' } }) });
    expect(c.connectionState.label).toBe('Connected');

    c.form.patchValue({ host: 'smtp.try.test' });
    c.testConnection();
    req = http.expectOne(r => r.url.endsWith('test-connection'));
    expect(req.request.body.host).toBe('smtp.try.test');
    req.flush({ success: false, message: 'refused' }, { status: 422, statusText: 'x' });
    http.match(r => r.method === 'GET').forEach(r => r.flush({ success: true, data: view() }));
    expect(c.lastResult?.ok).toBeFalse();
  });

  it('send test email needs a valid recipient and a confirmation', async () => {
    const c = make().componentInstance;
    c.testTo = 'nope';
    c.sendTestEmail();
    http.expectNone(r => r.url.endsWith('test-email'));

    c.testTo = 'me@example.test';
    confirmAnswer = false;
    c.sendTestEmail(); await flush();
    http.expectNone(r => r.url.endsWith('test-email'));

    confirmAnswer = true;
    c.sendTestEmail(); await flush();
    const req = http.expectOne(r => r.url.endsWith('test-email'));
    expect(req.request.body).toEqual({ to: 'me@example.test' });   // not dirty: uses the saved settings
    req.flush({ success: true, message: 'Test email sent to me@example.test.', data: view() });
    expect(c.lastResult?.ok).toBeTrue();
  });

  it('enable/disable asks first, then calls the API', async () => {
    const c = make().componentInstance;
    confirmAnswer = false;
    c.toggleService(); await flush();
    http.expectNone(r => r.url.endsWith('toggle'));

    confirmAnswer = true;
    c.toggleService(); await flush();
    const req = http.expectOne(r => r.url.endsWith('toggle'));
    expect(req.request.body).toEqual({ enabled: false });          // currently enabled, so this disables
    req.flush({ success: true, message: 'Email service disabled.', data: view({ status: { ...view().status, enabled: false } }) });
    expect(c.enabled).toBeFalse();
  });

  it('reset is only offered when something is saved, and confirms first', async () => {
    const unsaved = make().componentInstance;
    unsaved.resetToDefault(); await flush();
    http.expectNone(r => r.method === 'DELETE');

    const c = make(view({ saved: true, source: 'database' })).componentInstance;
    confirmAnswer = false;
    c.resetToDefault(); await flush();
    http.expectNone(r => r.method === 'DELETE');
    confirmAnswer = true;
    c.resetToDefault(); await flush();
    http.expectOne(r => r.method === 'DELETE').flush({ success: true, message: 'Reset.', data: view() });
    expect(c.saved).toBeFalse();
  });

  it('a server that never answers ends the loading state with an error and a Retry, instead of loading forever', fakeAsync(() => {
    const f = TestBed.createComponent(EmailConfigComponent);
    f.detectChanges();
    const req = http.expectOne(r => r.url.endsWith('email-config') && r.method === 'GET');
    expect(f.componentInstance.busy).toBe('load');

    tick(3500);                                    // still waiting: the page explains the delay
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).textContent).toContain('Still loading');

    tick(EmailConfigService.READ_TIMEOUT);          // never answered
    f.detectChanges();
    expect(f.componentInstance.busy).toBe('');
    expect(f.componentInstance.loadError).toContain('too long');
    expect((f.nativeElement as HTMLElement).textContent).toContain('Retry');
    expect(req.cancelled).toBeTrue();
  }));

  it('retry after a failed load fetches again and recovers', () => {
    const f = TestBed.createComponent(EmailConfigComponent);
    f.detectChanges();
    http.expectOne(r => r.method === 'GET').flush({ message: 'boom' }, { status: 500, statusText: 'x' });
    expect(f.componentInstance.loadError).toBe('boom');
    f.componentInstance.load();
    http.expectOne(r => r.method === 'GET').flush({ success: true, data: view() });
    expect(f.componentInstance.loadError).toBe('');
    expect(f.componentInstance.view).toBeTruthy();
    expect(f.componentInstance.busy).toBe('');
  });

  it('explains an unreachable backend and a timeout', () => {
    expect(EmailConfigService.errorMessage({ status: 0 })).toContain('Cannot reach the server');
    expect(EmailConfigService.errorMessage({ name: 'TimeoutError' })).toContain('too long');
  });

  it('turns API errors into readable messages', () => {
    expect(EmailConfigService.errorMessage({ status: 429 })).toContain('Too many requests');
    expect(EmailConfigService.errorMessage({ error: { errors: { host: ['Bad host'] } } })).toBe('Bad host');
    expect(EmailConfigService.errorMessage({ error: { message: 'Only a master administrator can do this.' } })).toContain('master administrator');
  });
});
