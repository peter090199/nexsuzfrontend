import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { Router } from '@angular/router';
import { BrandingService } from 'src/app/services/Branding/branding.service';
import { BusinessInfo, BusinessInfoService, ContactMailStatus, EMAIL_COLOR_GROUPS, EmailPreset, EmailTheme, contrastRatio, DEFAULT_LOGO_STYLE, LogoBgMode, LogoStyle, logoCss } from './business-info.service';

type Busy = '' | 'load' | 'save' | 'logo' | 'reset' | 'mail';

const URL_RE = /^https?:\/\/[^\s/$.?#][^\s]*$/i;
const RECIPIENT_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[A-Za-z]{2,}$/;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const PHONE_RE = /^[0-9+()\-.\s]*$/;
const TEXT_KEYS = ['business_name', 'registered_name', 'tagline', 'description', 'business_type', 'registration_type', 'registration_number', 'established_on',
  'country', 'region', 'province', 'city', 'barangay', 'street', 'building', 'unit', 'zip_code', 'formatted_address', 'maps_url',
  'phone_primary', 'phone_alt', 'email_official', 'email_support', 'website_url', 'customer_service', 'operating_hours',
  'facebook', 'instagram', 'linkedin', 'youtube', 'twitter', 'tiktok', 'contact_heading', 'contact_description', 'contact_recipient_email'];
const FLAG_KEYS = ['show_address', 'show_phone', 'show_email', 'show_hours', 'show_socials'];

/** Nexsuz Information: one business record shared by the Admin page, the Master Admin page and the public Contact section. */
@Component({
  selector: 'app-business-info',
  templateUrl: './business-info.component.html',
  styleUrls: ['./business-info.component.scss']
})
export class BusinessInfoComponent implements OnInit, OnDestroy {
  info?: BusinessInfo;
  busy: Busy = 'load';
  loadError = '';
  lastResult: { ok: boolean; text: string } | null = null;
  confirmReset = false;

  /** A chosen but not yet uploaded logo file and its local preview. */
  pendingLogo: File | null = null;
  pendingPreview: string | null = null;
  logoError = '';

  readonly registrationTypes = ['DTI', 'SEC', 'CDA', 'BIR', 'Other'];
  readonly industries = ['Information Technology', 'Recruitment & Staffing', 'Human Resources', 'Professional Services', 'Education & Training', 'Other'];
  readonly maxOtherLinks = 5;
  readonly bgModes: { id: LogoBgMode; label: string; icon: string }[] = [
    { id: 'transparent', label: 'Transparent', icon: 'blur_on' }, { id: 'white', label: 'White', icon: 'light_mode' },
    { id: 'navy', label: 'Dark navy', icon: 'dark_mode' }, { id: 'color', label: 'Custom color', icon: 'palette' }, { id: 'gradient', label: 'Gradient', icon: 'gradient' }];
  /** Where the live previews are drawn: each place as it really looks, or forced onto a light / dark surface. */
  surface: 'actual' | 'light' | 'dark' = 'actual';
  readonly today = new Date().toISOString().slice(0, 10);

  private baseline = '';

  form: FormGroup = this.fb.group({
    business_name: ['', [Validators.required, Validators.maxLength(150)]],
    registered_name: ['', Validators.maxLength(190)],
    tagline: ['', Validators.maxLength(190)],
    description: ['', Validators.maxLength(2000)],
    business_type: ['', Validators.maxLength(120)],
    registration_type: [''],
    registration_number: ['', Validators.maxLength(60)],
    established_on: [''],
    country: ['', Validators.maxLength(80)], region: ['', Validators.maxLength(100)], province: ['', Validators.maxLength(100)],
    city: ['', Validators.maxLength(100)], barangay: ['', Validators.maxLength(100)], street: ['', Validators.maxLength(150)],
    building: ['', Validators.maxLength(100)], unit: ['', Validators.maxLength(50)], zip_code: ['', [Validators.maxLength(12), Validators.pattern(/^[A-Za-z0-9 \-]*$/)]],
    formatted_address: ['', Validators.maxLength(400)],
    maps_url: ['', [Validators.maxLength(255), Validators.pattern(URL_RE)]],
    phone_primary: ['', [Validators.maxLength(30), Validators.pattern(PHONE_RE)]],
    phone_alt: ['', [Validators.maxLength(30), Validators.pattern(PHONE_RE)]],
    email_official: ['', [Validators.email, Validators.maxLength(190)]],
    email_support: ['', [Validators.email, Validators.maxLength(190)]],
    website_url: ['', [Validators.maxLength(255), Validators.pattern(URL_RE)]],
    customer_service: ['', Validators.maxLength(190)],
    operating_hours: ['', Validators.maxLength(400)],
    facebook: ['', [Validators.maxLength(255), Validators.pattern(URL_RE)]], instagram: ['', [Validators.maxLength(255), Validators.pattern(URL_RE)]],
    linkedin: ['', [Validators.maxLength(255), Validators.pattern(URL_RE)]], youtube: ['', [Validators.maxLength(255), Validators.pattern(URL_RE)]],
    twitter: ['', [Validators.maxLength(255), Validators.pattern(URL_RE)]], tiktok: ['', [Validators.maxLength(255), Validators.pattern(URL_RE)]],
    other_links: this.fb.array([]),
    email_theme: this.fb.group({
      preset: ['navy'],
      colors: this.fb.group(Object.assign({}, ...EMAIL_COLOR_GROUPS.flatMap(g => g.fields).map(f => ({ [f.key]: ['#000000', [Validators.required, Validators.pattern(HEX_RE)]] })))),
      header_gradient: this.fb.group({ enabled: [false], from: ['#002a57', Validators.pattern(HEX_RE)], to: ['#0a4a94', Validators.pattern(HEX_RE)], angle: [135, [Validators.min(0), Validators.max(360)]] }),
      footer_gradient: this.fb.group({ enabled: [false], from: ['#08203f', Validators.pattern(HEX_RE)], to: ['#0c3563', Validators.pattern(HEX_RE)], angle: [135, [Validators.min(0), Validators.max(360)]] }),
    }),
    logo_style: this.fb.group({
      bg_mode: ['white'], bg_color: ['#ffffff', Validators.pattern(HEX_RE)], gradient_from: ['#0a66c2', Validators.pattern(HEX_RE)], gradient_to: ['#002a57', Validators.pattern(HEX_RE)],
      gradient_angle: [135, [Validators.min(0), Validators.max(360)]], padding: [4, [Validators.min(0), Validators.max(32)]], radius: [8, [Validators.min(0), Validators.max(60)]],
      width: [null, [Validators.min(16), Validators.max(400)]], height: [null, [Validators.min(16), Validators.max(200)]], align: ['left'],
    }),
    contact_heading: ['', Validators.maxLength(120)],
    contact_description: ['', Validators.maxLength(500)],
    contact_recipient_email: ['', [Validators.email, Validators.maxLength(190), Validators.pattern(RECIPIENT_RE)]],
    show_address: [true], show_phone: [true], show_email: [true], show_hours: [true], show_socials: [true],
  });

  constructor(private sanitizer: DomSanitizer, private fb: FormBuilder, private api: BusinessInfoService, private snack: MatSnackBar, private router: Router, private branding: BrandingService) { }

  /** How website inquiries are sent (from the server's .env) and the last check result. */
  mail: ContactMailStatus | null = null;
  mailResult: { ok: boolean; text: string } | null = null;

  ngOnInit(): void {
    this.load(); this.loadMail();
    // the preview is rendered by the server with the same Blade layout as the real emails; redraw shortly after every edit
    this.subs.add(this.form.get('email_theme')!.valueChanges.pipe(debounceTime(350)).subscribe(() => this.refreshPreview()));
  }

  /* ---------- email theme ---------- */
  readonly colorGroups = EMAIL_COLOR_GROUPS;
  presets: { [id: string]: EmailPreset } = {};
  get presetList(): { id: string; label: string; colors: { [k: string]: string } }[] { return Object.keys(this.presets).map(id => ({ id, label: this.presets[id].label, colors: this.presets[id].colors })); }
  previewDevice: 'desktop' | 'mobile' = 'desktop';
  previewDoc: SafeHtml = '';
  previewError = '';
  previewBusy = false;
  themeResult: { ok: boolean; text: string } | null = null;
  private subs = new Subscription();
  private previewSub?: Subscription;

  get theme(): EmailTheme { return (this.form.get('email_theme') as FormGroup).getRawValue(); }
  get themePreset(): string { return this.form.get('email_theme.preset')!.value; }
  get themeLabel(): string { return this.themePreset === 'custom' ? 'Custom Theme' : (this.presets[this.themePreset]?.label || ''); }

  /** Choose a preset (fills every color so it can be fine-tuned) or switch to a custom theme that keeps the current colors. */
  applyPreset(id: string): void {
    const g = this.form.get('email_theme')!;
    if (id !== 'custom') {
      const p = this.presets[id];
      if (!p) { return; }
      g.patchValue({ preset: id, colors: p.colors, header_gradient: p.header_gradient, footer_gradient: p.footer_gradient });
    } else {
      g.patchValue({ preset: 'custom' });
    }
    this.form.markAsDirty();
  }
  /** Editing any color turns the theme into a custom one. */
  markCustom(): void { if (this.themePreset !== 'custom') { this.form.get('email_theme.preset')!.setValue('custom'); } this.form.markAsDirty(); }
  resetTheme(): void { this.applyPreset('navy'); this.themeResult = null; }

  /** Pairs that are hard to read, with their contrast ratio (WCAG: 4.5 or more for text). */
  get contrastIssues(): { label: string; ratio: number }[] {
    const c = this.theme.colors; const out: { label: string; ratio: number }[] = [];
    const pairs: [string, string, string][] = [['Header text on header', c['header_text'], c['header_bg']], ['Content text on card', c['text'], c['card_bg']], ['Footer text on footer', c['footer_text'], c['footer_bg']],
      ['Button text on button', c['button_text'], c['button_bg']], ['Links on card', c['link'], c['card_bg']]];
    for (const [label, a, b] of pairs) { const r = contrastRatio(a, b); if (r !== null && r < 4.5) { out.push({ label, ratio: Math.round(r * 10) / 10 }); } }
    return out;
  }

  refreshPreview(): void {
    if (!this.info || this.form.get('email_theme')!.invalid) { return; }
    this.previewSub?.unsubscribe();
    this.previewBusy = true; this.previewError = '';
    this.previewSub = this.api.previewEmailTheme(this.theme, this.form.value.business_name || '').subscribe({
      next: r => { this.previewDoc = this.sanitizer.bypassSecurityTrustHtml(r.html); this.previewBusy = false; },
      error: e => { this.previewBusy = false; this.previewError = BusinessInfoService.errorMessage(e, 'The preview could not be drawn.'); }
    });
  }

  /** Sends the saved theme as a real email to the business recipient, to check it in an inbox. */
  sendThemeTest(): void {
    this.busy = 'mail'; this.themeResult = null;
    this.api.testEmailTheme().subscribe({
      next: r => { this.busy = ''; this.themeResult = { ok: true, text: r.message }; },
      error: e => { this.busy = ''; this.themeResult = { ok: false, text: BusinessInfoService.errorMessage(e) }; }
    });
  }

  loadMail(): void {
    this.api.contactMail().subscribe({ next: r => this.mail = r.data, error: () => this.mail = null });
  }

  /** mode "check" signs in to the SMTP server only; "test" also sends a test email to the saved recipient. Save the recipient first. */
  runMail(mode: 'check' | 'test'): void {
    this.busy = 'mail'; this.mailResult = null;
    (mode === 'check' ? this.api.checkContactMail() : this.api.testContactMail()).subscribe({
      next: r => { this.mail = r.data; this.mailResult = { ok: true, text: r.message }; this.busy = ''; },
      error: e => { this.mailResult = { ok: false, text: BusinessInfoService.errorMessage(e) }; this.busy = ''; this.loadMail(); }
    });
  }
  ngOnDestroy(): void { this.discardPending(); this.subs.unsubscribe(); this.previewSub?.unsubscribe(); }

  get otherLinks(): FormArray { return this.form.get('other_links') as FormArray; }
  get dirty(): boolean { return this.form.dirty || JSON.stringify(this.form.getRawValue()) !== this.baseline; }
  /** The role prefix in the address bar (DEF-ADMIN or DEF-MASTERADMIN), only used for the breadcrumb. */
  get section(): string { return this.router.url.includes('DEF-MASTERADMIN') ? 'Master Admin' : 'Admin'; }
  get initials(): string { return (this.info?.business_name || 'N').split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase(); }
  get styleValue(): LogoStyle { return { ...DEFAULT_LOGO_STYLE, ...this.form.get('logo_style')!.value }; }
  /** The container style as being edited, before saving. Same function the real logos use. */
  get previewCss(): { [p: string]: string } { return logoCss(this.styleValue); }
  get styleHint(): string {
    return this.styleValue.bg_mode === 'transparent' ? 'Transparent shows the logo directly on each background. Check the Light and Dark previews so it stays readable on both.' : '';
  }
  resolvedSurface(natural: 'light' | 'dark'): 'light' | 'dark' { return this.surface === 'actual' ? natural : this.surface; }
  /** The uploaded logo, or the default mark that suits the surface. */
  previewSrc(surface: 'light' | 'dark'): string { return this.shownLogo || (surface === 'dark' ? 'assets/images/logo.png' : 'assets/images/logo2.png'); }
  resetStyle(): void { this.form.get('logo_style')!.reset({ ...DEFAULT_LOGO_STYLE }); this.form.markAsDirty(); }
  get shownLogo(): string | null { return this.pendingPreview || this.info?.logo_url || null; }
  get addressPreview(): string {
    const v = this.form.getRawValue();
    if ((v.formatted_address || '').trim()) { return v.formatted_address.trim(); }
    const line1 = [v.unit, v.building].filter(Boolean).join(' ');
    return [line1, v.street, v.barangay, v.city, v.province, v.region, [v.zip_code, v.country].filter(Boolean).join(' ')].filter((p: string) => (p || '').trim()).join(', ');
  }

  load(): void {
    this.busy = 'load'; this.loadError = '';
    this.api.get().subscribe({
      next: r => { this.apply(r.data); this.busy = ''; },
      error: e => { this.busy = ''; this.loadError = BusinessInfoService.errorMessage(e, 'Could not load the business information.'); }
    });
  }

  private apply(d: BusinessInfo): void {
    this.info = d;
    const patch: any = {};
    TEXT_KEYS.concat(FLAG_KEYS).forEach(k => patch[k] = (d as any)[k]);
    this.form.patchValue(patch, { emitEvent: false });
    this.presets = d.email_presets || {};
    if (d.email_theme) { this.form.get('email_theme')!.patchValue(d.email_theme, { emitEvent: false }); }
    this.form.get('logo_style')!.reset({ ...DEFAULT_LOGO_STYLE, ...(d.logo_style || {}) }, { emitEvent: false });
    this.otherLinks.clear();
    (d.other_links || []).forEach(l => this.otherLinks.push(this.linkGroup(l.label, l.url)));
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.baseline = JSON.stringify(this.form.getRawValue());
    this.refreshPreview();
  }

  private linkGroup(label = '', url = ''): FormGroup {
    return this.fb.group({ label: [label, Validators.maxLength(40)], url: [url, [Validators.maxLength(255), Validators.pattern(URL_RE)]] });
  }

  addLink(): void { if (this.otherLinks.length < this.maxOtherLinks) { this.otherLinks.push(this.linkGroup()); this.form.markAsDirty(); } }
  removeLink(i: number): void { this.otherLinks.removeAt(i); this.form.markAsDirty(); }

  private say(ok: boolean, text: string): void {
    this.lastResult = { ok, text };
    this.snack.open(text, 'OK', { duration: ok ? 3500 : 7000 });
  }

  save(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) { this.say(false, 'Fix the highlighted fields first.'); return; }
    this.busy = 'save';
    this.api.save(this.form.getRawValue()).subscribe({
      next: r => { this.apply(r.data); this.branding.setBranding(r.data.logo_url, r.data.logo_style); this.loadMail(); this.busy = ''; this.say(true, 'Business information saved.'); },
      error: e => { this.busy = ''; this.say(false, BusinessInfoService.errorMessage(e)); }
    });
  }

  /** Throw away unsaved edits and show what is saved. */
  cancel(): void { if (this.info) { this.apply(this.info); this.lastResult = null; } }

  askReset(): void { this.confirmReset = true; }
  doReset(): void {
    this.confirmReset = false; this.busy = 'reset';
    this.api.reset().subscribe({
      next: r => { this.apply(r.data); this.loadMail(); this.busy = ''; this.say(true, 'Reset to the defaults. The logo was kept.'); },
      error: e => { this.busy = ''; this.say(false, BusinessInfoService.errorMessage(e)); }
    });
  }

  /* ---------- logo ---------- */
  onLogoPicked(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files && input.files[0];
    input.value = '';
    if (!file) { return; }
    this.logoError = BusinessInfoService.logoProblem(file) || '';
    if (this.logoError) { return; }
    this.discardPending();
    this.pendingLogo = file;
    this.pendingPreview = URL.createObjectURL(file);
  }

  discardPending(): void {
    if (this.pendingPreview) { URL.revokeObjectURL(this.pendingPreview); }
    this.pendingLogo = null; this.pendingPreview = null;
  }

  uploadLogo(): void {
    if (!this.pendingLogo) { return; }
    this.busy = 'logo';
    this.api.uploadLogo(this.pendingLogo).subscribe({
      next: r => { this.refreshLogoOnly(r.data); this.discardPending(); this.busy = ''; this.say(true, 'Logo updated.'); },
      error: e => { this.busy = ''; this.logoError = BusinessInfoService.errorMessage(e); this.say(false, this.logoError); }
    });
  }

  removeLogo(): void {
    this.busy = 'logo';
    this.api.removeLogo().subscribe({
      next: r => { this.refreshLogoOnly(r.data); this.busy = ''; this.say(true, 'Logo removed.'); },
      error: e => { this.busy = ''; this.say(false, BusinessInfoService.errorMessage(e)); }
    });
  }

  /** A logo change must not wipe unsaved edits in the form. */
  private refreshLogoOnly(d: BusinessInfo): void {
    if (this.info) { this.info = { ...this.info, logo_url: d.logo_url }; }
    this.branding.setLogo(d.logo_url);   // every logo in the app updates now
  }

  err(name: string): string {
    const c = this.form.get(name);
    if (!c || !c.touched || !c.errors) { return ''; }
    if (c.errors['required']) { return 'This field is required'; }
    if (c.errors['email']) { return 'Enter a valid email address'; }
    if (name === 'contact_recipient_email' && (c.errors['pattern'] || c.errors['email'])) { return 'Enter one valid email address, like name@gmail.com or info@yourcompany.com'; }
    if (c.errors['pattern']) { return PHONE_FIELDS.includes(name) ? 'Use digits, spaces and + ( ) - only' : name === 'zip_code' ? 'Letters, digits, spaces and - only' : 'Enter a full web address starting with http:// or https://'; }
    if (c.errors['maxlength']) { return `Too long (max ${c.errors['maxlength'].requiredLength} characters)`; }
    return 'Invalid value';
  }
}

const PHONE_FIELDS = ['phone_primary', 'phone_alt'];
