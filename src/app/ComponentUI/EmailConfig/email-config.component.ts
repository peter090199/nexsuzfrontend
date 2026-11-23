import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NotificationsService } from 'src/app/services/Global/notifications.service';
import { EmailConfigService, EmailConfigView, Encryption, Provider, SmtpForm } from './email-config.service';

type Busy = '' | 'load' | 'save' | 'connection' | 'email' | 'toggle' | 'reset';

@Component({
  selector: 'app-email-config',
  templateUrl: './email-config.component.html',
  styleUrls: ['./email-config.component.scss']
})
export class EmailConfigComponent implements OnInit, OnDestroy {
  view?: EmailConfigView;
  busy: Busy = 'load';
  loadError = '';
  showPassword = false;
  testTo = '';
  /** Outcome of the last button press, shown under the form (the snackbar alone is easy to miss). */
  lastResult: { ok: boolean; text: string } | null = null;
  /** Set when something has been running for a few seconds, so the page explains the wait instead of looking frozen. */
  slow = false;
  private slowTimer: any;

  private baseline = '';

  form = this.fb.group({
    provider: ['custom', Validators.required],
    host: ['', [Validators.required, Validators.maxLength(190), Validators.pattern(/^[A-Za-z0-9]([A-Za-z0-9.\-]*[A-Za-z0-9])?$/)]],
    port: [587, [Validators.required, Validators.min(1), Validators.max(65535)]],
    encryption: ['tls' as Encryption, Validators.required],
    username: ['', [Validators.required, Validators.maxLength(190)]],
    password: ['', Validators.maxLength(255)],
    from_address: ['', [Validators.required, Validators.email, Validators.maxLength(190)]],
    from_name: ['', [Validators.required, Validators.maxLength(120)]],
  });

  constructor(private fb: FormBuilder, private api: EmailConfigService, private snack: MatSnackBar, private notify: NotificationsService) { }

  ngOnInit(): void { this.load(); }

  // ------------------------------------------------------------------- state
  get saved(): boolean { return !!this.view?.saved; }
  get providers(): { id: string; p: Provider }[] { return Object.entries(this.view?.providers || {}).map(([id, p]) => ({ id, p })); }
  get providerNote(): string { return this.view?.providers[this.form.value.provider || '']?.note || ''; }
  get hasPassword(): boolean { return !!this.view?.settings.has_password; }
  get enabled(): boolean { return !!this.view?.status.enabled; }
  get working(): boolean { return this.busy !== '' ; }

  /** Which wait message applies to the current action. */
  get waitText(): string {
    switch (this.busy) {
      case 'load': return 'Still loading… the server is taking longer than usual.';
      case 'save': case 'connection': case 'toggle': return 'Contacting the mail server… this can take up to 15 seconds, especially if the login is rejected.';
      case 'email': return 'Sending… this can take up to 15 seconds.';
      default: return '';
    }
  }

  /** Single place that flips the busy flag so the slow-wait hint always matches it. */
  private setBusy(b: Busy): void {
    this.busy = b;
    this.slow = false;
    clearTimeout(this.slowTimer);
    if (b !== '') { this.slowTimer = setTimeout(() => this.slow = this.busy !== '', b === 'load' ? 3000 : 2500); }
  }

  ngOnDestroy(): void { clearTimeout(this.slowTimer); }

  /** Anything typed that differs from what is saved (a typed password always counts). */
  get dirty(): boolean { return this.snapshot() !== this.baseline; }
  private snapshot(): string { return JSON.stringify(this.form.getRawValue()); }

  /** Configuration chip: Saved / Unsaved changes / Not saved. */
  get configState(): { label: string; cls: string } {
    if (!this.saved) { return { label: this.dirty ? 'Unsaved' : 'Not saved (using server .env)', cls: 'warn' }; }
    return this.dirty ? { label: 'Unsaved changes', cls: 'warn' } : { label: 'Saved', cls: 'ok' };
  }
  get connectionState(): { label: string; cls: string } {
    switch (this.view?.status.connection) {
      case 'connected': return { label: 'Connected', cls: 'ok' };
      case 'failed': return { label: 'Failed', cls: 'bad' };
      default: return { label: 'Not tested', cls: 'muted' };
    }
  }

  // -------------------------------------------------------------------- load
  load(): void {
    this.setBusy('load'); this.loadError = '';
    this.api.get().subscribe({
      next: r => { this.adopt(r.data); this.setBusy(''); },
      error: e => { this.setBusy(''); this.loadError = EmailConfigService.errorMessage(e, 'Could not load the email settings.'); },
    });
  }

  /** Put what the server says into the form. The password field always starts empty. */
  private adopt(v: EmailConfigView): void {
    this.view = v;
    const s = v.settings;
    this.form.reset({ provider: s.provider, host: s.host, port: s.port, encryption: s.encryption, username: s.username,
      password: '', from_address: s.from_address, from_name: s.from_name });
    this.baseline = this.snapshot();
  }

  /** Choosing a provider fills in its standard host, port and encryption. They stay editable. */
  onProvider(id: string): void {
    const p = this.view?.providers[id];
    if (p && id !== 'custom') { this.form.patchValue({ host: p.host, port: p.port, encryption: p.encryption }); }
  }

  /** Form values for the API; a blank password is left out so the stored one is kept. */
  private payload(): SmtpForm {
    const v = this.form.getRawValue();
    const body: SmtpForm = { provider: v.provider!, host: (v.host || '').trim(), port: Number(v.port), encryption: v.encryption as Encryption,
      username: (v.username || '').trim(), from_address: (v.from_address || '').trim(), from_name: (v.from_name || '').trim() };
    if (v.password) { body.password = v.password; }
    return body;
  }

  /** Can the form values be used to talk to a server? A password is needed unless one is already stored. */
  get canSubmit(): boolean {
    return this.form.valid && (this.hasPassword || !!this.form.value.password);
  }

  private done(ok: boolean, text: string): void {
    this.lastResult = { ok, text };
    this.snack.open(text, 'OK', { duration: ok ? 3500 : 7000 });
  }

  // ----------------------------------------------------------------- actions
  /** Save Configuration (first time) / Update Configuration (afterwards). The server proves the credentials first. */
  submit(): void {
    if (!this.canSubmit || this.working) { this.form.markAllAsTouched(); return; }
    const go = () => {
      this.setBusy('save');
      const call = this.saved ? this.api.update(this.payload()) : this.api.save(this.payload());
      call.subscribe({
        next: r => { this.adopt(r.data); this.setBusy(''); this.done(true, r.message || 'Saved.'); },
        error: e => { this.setBusy(''); this.done(false, EmailConfigService.errorMessage(e, 'Could not save the settings.')); this.refreshStatus(); },
      });
    };
    // changing live settings affects every email the app sends, so confirm first
    if (this.saved && this.enabled) {
      this.notify.popupWarning('Update the live SMTP settings?', 'The connection is tested first. If it fails, the current settings stay in use.')
        .then((r: any) => r.isConfirmed && go());
    } else { go(); }
  }

  testConnection(): void {
    if (this.working) { return; }
    if (this.dirty && !this.canSubmit) { this.form.markAllAsTouched(); this.done(false, 'Fix the highlighted fields first.'); return; }
    this.setBusy('connection');
    // unsaved edits are tested as typed; otherwise the saved (or .env) settings are tested
    this.api.testConnection(this.dirty ? this.payload() : {}).subscribe({
      next: r => { this.setBusy(''); this.view = r.data; this.done(true, r.message || 'Connected.'); },
      error: e => { this.setBusy(''); this.done(false, EmailConfigService.errorMessage(e, 'The connection test failed.')); this.refreshStatus(); },
    });
  }

  sendTestEmail(): void {
    const to = this.testTo.trim();
    if (this.working || !to || !/^\S+@\S+\.\S+$/.test(to)) { this.done(false, 'Enter a valid recipient address.'); return; }
    if (this.dirty && !this.canSubmit) { this.form.markAllAsTouched(); this.done(false, 'Fix the highlighted fields first.'); return; }
    this.notify.popupWarning(`Send a test email to ${to}?`, 'A real message is sent through the SMTP server.').then((r: any) => {
      if (!r.isConfirmed) { return; }
      this.setBusy('email');
      this.api.testEmail(to, this.dirty ? this.payload() : undefined).subscribe({
        next: res => { this.setBusy(''); this.view = res.data; this.done(true, res.message || 'Test email sent.'); },
        error: e => { this.setBusy(''); this.done(false, EmailConfigService.errorMessage(e, 'The test email could not be sent.')); this.refreshStatus(); },
      });
    });
  }

  toggleService(): void {
    if (this.working) { return; }
    const enable = !this.enabled;
    const title = enable ? 'Enable the email service?' : 'Disable the email service?';
    const text = enable
      ? 'The SMTP connection is tested first. Emails (sign-up activation, password reset, status updates) start sending again.'
      : 'While disabled NO emails are sent, so sign-up activation and password reset emails will not arrive.';
    this.notify.popupWarning(title, text).then((r: any) => {
      if (!r.isConfirmed) { return; }
      this.setBusy('toggle');
      this.api.toggle(enable).subscribe({
        next: res => { this.setBusy(''); this.syncKeepingEdits(res.data); this.done(true, res.message || 'Done.'); },
        error: e => { this.setBusy(''); this.done(false, EmailConfigService.errorMessage(e)); this.refreshStatus(); },
      });
    });
  }

  resetToDefault(): void {
    if (this.working || !this.saved) { return; }
    this.notify.popupWarning('Reset to default settings?', 'The saved configuration is deleted and the server\'s .env mail settings are used again.')
      .then((r: any) => {
        if (!r.isConfirmed) { return; }
        this.setBusy('reset');
        this.api.reset().subscribe({
          next: res => { this.adopt(res.data); this.setBusy(''); this.lastResult = null; this.done(true, res.message || 'Reset.'); },
          error: e => { this.setBusy(''); this.done(false, EmailConfigService.errorMessage(e)); },
        });
      });
  }

  /** Update the status cards without throwing away what the administrator is still typing. */
  private syncKeepingEdits(v: EmailConfigView): void {
    if (this.dirty) { this.view = v; } else { this.adopt(v); }
  }

  private refreshStatus(): void {
    this.api.get().subscribe({ next: r => { if (this.view) { this.view = { ...this.view, status: r.data.status }; } }, error: () => { } });
  }
}
