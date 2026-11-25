import { discardPeriodicTasks, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { MaterialModule } from 'src/Material/Material.module';
import { BusinessInfoComponent } from './business-info.component';
import { BusinessInfoService } from './business-info.service';
import { BrandingService } from 'src/app/services/Branding/branding.service';

const NAVY = { header_bg: '#002a57', header_text: '#ffffff', body_bg: '#eef2f8', card_bg: '#ffffff', text: '#1b2a4a', footer_bg: '#08203f', footer_text: '#b9c9e0', primary: '#0a66c2', secondary: '#002a57', button_bg: '#0a66c2', button_text: '#ffffff', link: '#0a66c2', border: '#dbe3f0', divider: '#e3e9f3' };
const DARK = { ...NAVY, header_bg: '#0b1220', body_bg: '#0f172a', card_bg: '#162033', text: '#e5eaf3', button_bg: '#38bdf8', button_text: '#0b1220' };
const GOFF = { enabled: false, from: '#002a57', to: '#0a4a94', angle: 135 };

describe('BusinessInfoComponent', () => {
  let http: HttpTestingController;
  let mailReq: any;

  const info = (over: any = {}) => ({
    business_name: 'Nexsuz', registered_name: '', tagline: 'Hire better', description: '', business_type: '', registration_type: 'SEC', registration_number: '123',
    established_on: '', country: 'Philippines', region: '', province: '', city: 'Makati', barangay: '', street: '', building: '', unit: '', zip_code: '', formatted_address: '',
    maps_url: '', phone_primary: '', phone_alt: '', email_official: '', email_support: '', website_url: '', customer_service: '', operating_hours: '',
    facebook: '', instagram: '', linkedin: '', youtube: '', twitter: '', tiktok: '', other_links: [],
    contact_heading: 'Get In Touch', contact_description: '', contact_recipient_email: '',
    show_address: true, show_phone: true, show_email: true, show_hours: true, show_socials: true,
    logo_url: null, logo_style: { bg_mode: "white", bg_color: "#ffffff", gradient_from: "#0a66c2", gradient_to: "#002a57", gradient_angle: 135, padding: 4, radius: 8, width: null, height: null, align: "left" }, email_theme: { preset: 'navy', colors: { ...NAVY }, header_gradient: { enabled: false, from: '#002a57', to: '#0a4a94', angle: 135 }, footer_gradient: { enabled: false, from: '#08203f', to: '#0c3563', angle: 135 } },
    email_presets: { navy: { label: 'Professional Navy Blue', colors: { ...NAVY }, header_gradient: GOFF, footer_gradient: GOFF }, dark: { label: 'Dark Technology', colors: { ...DARK }, header_gradient: { ...GOFF, enabled: true }, footer_gradient: GOFF } },
    computed_address: 'Makati, Philippines', saved: true, ...over,
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MaterialModule, FormsModule, ReactiveFormsModule, NoopAnimationsModule, HttpClientTestingModule, RouterTestingModule],
      declarations: [BusinessInfoComponent],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  const make = (data: any = info()) => {
    const f = TestBed.createComponent(BusinessInfoComponent);
    f.detectChanges();
    http.expectOne(r => r.method === 'GET' && r.url.endsWith('business-info')).flush({ success: true, data });
    mailReq = http.expectOne(r => r.method === 'GET' && r.url.endsWith('business-info/contact-mail'));
    http.match(r => r.url.endsWith('email-theme/preview')).forEach(q => q.flush({ success: true, html: '<html></html>' }));
    f.detectChanges();
    return f;
  };

  it('loads the saved record into the form and shows the header', () => {
    const f = make();
    expect(f.componentInstance.form.value.business_name).toBe('Nexsuz');
    expect((f.nativeElement as HTMLElement).querySelector('h1')?.textContent).toContain('Nexsuz');
    expect(f.componentInstance.dirty).toBeFalse();
  });

  it('saves with PUT, then shows the server copy and clears the dirty state', () => {
    const f = make(); const c = f.componentInstance;
    c.form.patchValue({ business_name: 'Nexsuz Inc.', city: 'Taguig' }); c.form.markAsDirty();
    c.save();
    const req = http.expectOne(r => r.method === 'PUT' && r.url.endsWith('business-info'));
    expect(req.request.body.business_name).toBe('Nexsuz Inc.');
    req.flush({ success: true, message: 'ok', data: info({ business_name: 'Nexsuz Inc.', city: 'Taguig' }) });
    expect(c.dirty).toBeFalse();
    expect(c.lastResult?.ok).toBeTrue();
  });

  it('does not call the API when a field is invalid', () => {
    const f = make(); const c = f.componentInstance;
    c.form.patchValue({ business_name: '', facebook: 'javascript:alert(1)', email_official: 'nope' });
    c.save();
    http.expectNone(r => r.method === 'PUT');
    expect(c.err('business_name')).toContain('required');
    expect(c.err('facebook')).toContain('http');
    expect(c.err('email_official')).toContain('valid email');
  });

  it('cancel restores what is saved', () => {
    const f = make(); const c = f.componentInstance;
    c.form.patchValue({ business_name: 'Changed' }); c.form.markAsDirty();
    c.cancel();
    expect(c.form.value.business_name).toBe('Nexsuz');
  });

  it('refuses a wrong logo type or size before any upload and previews a good one', () => {
    const f = make(); const c = f.componentInstance;
    const pick = (file: File) => c.onLogoPicked({ target: { files: [file], value: '' } } as any);
    pick(new File(['x'], 'a.pdf', { type: 'application/pdf' }));
    expect(c.logoError).toContain('PNG');
    expect(c.pendingLogo).toBeNull();
    pick(new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' }));
    expect(c.logoError).toContain('2 MB');
    pick(new File(['x'], 'ok.png', { type: 'image/png' }));
    expect(c.logoError).toBe('');
    expect(c.pendingPreview).toContain('blob:');
    http.expectNone(r => r.method === 'POST' && !r.url.endsWith('email-theme/preview'));
  });

  it('uploads the logo as multipart and keeps unsaved text edits', () => {
    const f = make(); const c = f.componentInstance;
    c.form.patchValue({ tagline: 'Unsaved tagline' }); c.form.markAsDirty();
    c.pendingLogo = new File(['x'], 'ok.png', { type: 'image/png' });
    c.uploadLogo();
    const req = http.expectOne(r => r.method === 'POST' && r.url.endsWith('business-info/logo'));
    expect(req.request.body instanceof FormData).toBeTrue();
    req.flush({ success: true, message: 'ok', data: info({ logo_url: 'http://x/storage/uploads/business/logo/u/logo.png' }) });
    expect(c.info?.logo_url).toContain('/storage/uploads/business/logo/');
    expect(c.form.value.tagline).toBe('Unsaved tagline');
  });

  it('removes the logo with DELETE', () => {
    const f = make(info({ logo_url: 'http://x/storage/uploads/business/logo/u/logo.png' }));
    f.componentInstance.removeLogo();
    http.expectOne(r => r.method === 'DELETE' && r.url.endsWith('business-info/logo')).flush({ success: true, message: 'ok', data: info() });
    expect(f.componentInstance.info?.logo_url).toBeNull();
  });

  it('shows a clear error and a retry when the page cannot be loaded (403)', () => {
    const f = TestBed.createComponent(BusinessInfoComponent);
    f.detectChanges();
    http.expectOne(r => r.method === 'GET' && r.url.endsWith('business-info')).flush({ message: 'no' }, { status: 403, statusText: 'Forbidden' });
    f.detectChanges();
    expect(f.componentInstance.loadError).toContain('do not have access');
    expect((f.nativeElement as HTMLElement).textContent).toContain('Retry');
  });

  it("previews the logo style before saving, then saves it and updates every logo", () => {
    const f = make(); const c = f.componentInstance;
    c.form.get("logo_style.bg_mode")!.setValue("navy"); c.form.get("logo_style.padding")!.setValue(12); c.form.markAsDirty();
    expect(c.previewCss["background"]).toBe("#002a57");
    expect(c.previewCss["padding"]).toBe("12px");
    http.expectNone(r => r.method === "PUT");   // nothing saved while only previewing
    const branding = TestBed.inject(BrandingService);
    c.save();
    const req = http.expectOne(r => r.method === "PUT");
    expect(req.request.body.logo_style.bg_mode).toBe("navy");
    req.flush({ success: true, message: "ok", data: info({ logo_style: { ...info().logo_style, bg_mode: "navy", padding: 12 } }) });
    expect(branding.style.bg_mode).toBe("navy");
    expect(branding.css["padding"]).toBe("12px");
  });

  it("cancel drops an unsaved style and reset restores the default look", () => {
    const f = make(); const c = f.componentInstance;
    c.form.get("logo_style.bg_mode")!.setValue("gradient"); c.form.markAsDirty();
    c.cancel();
    expect(c.styleValue.bg_mode).toBe("white");
    c.form.get("logo_style.radius")!.setValue(40);
    c.resetStyle();
    expect(c.styleValue.radius).toBe(8);
  });

  it('shows how inquiries are delivered without any password, and runs the check and test', () => {
    const f = make(); const c = f.componentInstance;
    mailReq.flush({ success: true, data: { configured: true, ready: true, missing: [], provider: 'Gmail / Google Workspace', host: 'smtp.gmail.com', port: 587, encryption: 'tls',
      username: 'a@gmail.com', has_password: true, from_address: 'a@gmail.com', recipient: 'inbox@nexsuz.com', warnings: [] } });
    c.runMail('check');
    const chk = http.expectOne(r => r.method === 'POST' && r.url.endsWith('business-info/contact-mail/check'));
    chk.flush({ success: false, message: 'The mail server rejected the sign-in. For Gmail use a Google App Password' }, { status: 422, statusText: 'x' });
    f.detectChanges();
    http.expectOne(r => r.method === 'GET' && r.url.endsWith('business-info/contact-mail')).flush({ success: true, data: c.mail });
    expect(c.mailResult?.ok).toBeFalse();
    expect(c.mailResult?.text).toContain('App Password');
    c.runMail('test');
    http.expectOne(r => r.method === 'POST' && r.url.endsWith('business-info/contact-mail/test')).flush({ success: true, message: 'Test email sent to inbox@nexsuz.com.', data: c.mail });
    expect(c.mailResult?.ok).toBeTrue();
    expect(JSON.stringify(c.mail)).not.toContain('"password"');
  });

  it('blocks an invalid recipient, then after saving a valid one re-reads the delivery status so readiness follows the real configuration', () => {
    const f = make(); const c = f.componentInstance;
    const notReady = { configured: true, ready: false, missing: [], provider: 'Gmail / Google Workspace', host: 'smtp.gmail.com', port: 465, encryption: 'ssl', username: 'a@gmail.com',
      has_password: true, from_address: 'a@gmail.com', recipient: null, recipient_problem: 'missing', warnings: ['No recipient email is set.'] };
    mailReq.flush({ success: true, data: notReady });
    f.detectChanges();
    expect(c.mail?.ready).toBeFalse();
    expect(c.mail?.recipient_problem).toBe('missing');

    for (const bad of ['nope', 'a@b', 'x@y.com, z@w.com']) {
      c.form.patchValue({ contact_recipient_email: bad }); c.save();
      http.expectNone(r => r.method === 'PUT');
      expect(c.err('contact_recipient_email')).toContain('valid email');
    }
    c.form.patchValue({ contact_recipient_email: 'info@mycompany.com' }); c.form.markAsDirty(); c.save();
    http.expectOne(r => r.method === 'PUT').flush({ success: true, message: 'ok', data: info({ contact_recipient_email: 'info@mycompany.com' }) });
    http.expectOne(r => r.method === 'GET' && r.url.endsWith('business-info/contact-mail')).flush({ success: true, data: { ...notReady, ready: true, recipient: 'info@mycompany.com', recipient_problem: null, warnings: [] } });
    f.detectChanges();
    expect(c.mail?.ready).toBeTrue();
    expect(c.mail?.recipient_problem).toBeNull();
  });

  it('email theme: picking a preset fills every color, editing one turns it into a custom theme, and the preview is requested from the server', fakeAsync(() => {
    const f = make(); const c = f.componentInstance;
    expect(c.themePreset).toBe('navy');
    c.applyPreset('dark');
    expect(c.theme.colors['card_bg']).toBe('#162033');
    expect(c.theme.header_gradient.enabled).toBeTrue();
    expect(c.dirty).toBeTrue();
    tick(400);
    const pv = http.expectOne(r => r.method === 'POST' && r.url.endsWith('email-theme/preview'));
    expect(pv.request.body.email_theme.preset).toBe('dark');
    pv.flush({ success: true, html: '<html><body>preview</body></html>' });

    c.form.get('email_theme.colors.header_bg')!.setValue('#123456'); c.markCustom();
    expect(c.themePreset).toBe('custom');
    expect(c.themeLabel).toBe('Custom Theme');
    tick(400);
    expect(http.expectOne(r => r.url.endsWith('email-theme/preview')).request.body.email_theme.colors.header_bg).toBe('#123456');
    discardPeriodicTasks();
  }));

  it('email theme: an invalid HEX stops the preview and the save, and low contrast is flagged', fakeAsync(() => {
    const f = make(); const c = f.componentInstance;
    c.form.get('email_theme.colors.header_bg')!.setValue('red'); c.markCustom();
    tick(400);
    http.expectNone(r => r.url.endsWith('email-theme/preview'));
    c.save();
    http.expectNone(r => r.method === 'PUT');
    c.form.get('email_theme.colors.header_bg')!.setValue('#ffffff'); c.form.get('email_theme.colors.header_text')!.setValue('#fafafa');
    expect(c.contrastIssues.map(i => i.label)).toContain('Header text on header');
    c.form.get('email_theme.colors.header_text')!.setValue('#000000');
    expect(c.contrastIssues.map(i => i.label)).not.toContain('Header text on header');
    tick(400);
    http.match(r => r.url.endsWith('email-theme/preview')).forEach(q => q.flush({ success: true, html: '' }));
    discardPeriodicTasks();
  }));

  it('email theme: Save sends the theme with the other business information, reset goes back to Navy', () => {
    const f = make(); const c = f.componentInstance;
    c.applyPreset('dark'); c.save();
    const req = http.expectOne(r => r.method === 'PUT');
    expect(req.request.body.email_theme.preset).toBe('dark');
    expect(req.request.body.email_theme.colors.button_bg).toBe('#38bdf8');
    req.flush({ success: true, message: 'ok', data: info({ email_theme: { ...info().email_theme, preset: 'dark', colors: { ...DARK } } }) });
    http.match(r => r.url.endsWith('email-theme/preview') || r.url.endsWith('contact-mail')).forEach(q => q.flush({ success: true, html: '', data: {} }));
    expect(c.themePreset).toBe('dark');
    c.resetTheme();
    expect(c.themePreset).toBe('navy');
    expect(c.theme.colors['header_bg']).toBe('#002a57');
  });

  it('email theme: the test email is only offered once saved and reports the result', () => {
    const f = make(); const c = f.componentInstance;
    mailReq.flush({ success: true, data: { configured: true, ready: true, missing: [], provider: 'Gmail', host: 'smtp.gmail.com', port: 465, encryption: 'ssl', username: 'a@gmail.com',
      has_password: true, from_address: 'a@gmail.com', recipient: 'inbox@x.com', recipient_problem: null, warnings: [] } });
    c.sendThemeTest();
    http.expectOne(r => r.method === 'POST' && r.url.endsWith('email-theme/test')).flush({ success: true, message: 'Theme test email sent to inbox@x.com.' });
    expect(c.themeResult?.ok).toBeTrue();
    c.sendThemeTest();
    http.expectOne(r => r.url.endsWith('email-theme/test')).flush({ message: 'The mail server rejected the sign-in.' }, { status: 422, statusText: 'x' });
    expect(c.themeResult?.ok).toBeFalse();
  });

  it('static helpers validate the logo file like the server does', () => {
    expect(BusinessInfoService.logoProblem(new File(['x'], 'a.svg', { type: 'image/svg+xml' }))).toBeNull();
    expect(BusinessInfoService.logoProblem(new File(['x'], 'a.gif', { type: 'image/gif' }))).not.toBeNull();
  });
});
