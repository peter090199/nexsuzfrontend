import { _url } from 'src/global-variables';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService } from 'src/app/services/auth.service';
import { NotificationsService } from 'src/app/services/Global/notifications.service';
import { CurriculumVitaeService } from 'src/app/services/CV/curriculum-vitae.service';
import { ProfileService } from 'src/app/services/Profile/profile.service';
import { SharedRoutinesService } from 'src/app/services/Function/shared-routines.service';
import { ForgetPasswordService } from 'src/app/services/Password/Forget/forget-password.service';
import { SettingsConfirmDialogComponent } from './confirm-dialog/confirm-dialog.component';
import { ReactionFxService } from 'src/app/ComponentSharedUI/Reactions/reaction-fx.service';
import { ChatService } from 'src/app/services/chat.service';
import { NotificationPrefsService, NotificationPrefs } from 'src/app/services/notification-prefs.service';
import { NotificationDeliveryService } from 'src/app/services/notification-delivery.service';

type SectionId =
  | 'account' | 'privacy' | 'security' | 'password' | 'notifications'
  | 'email' | 'appearance' | 'blocked' | 'danger' | 'plan';

interface SettingsSection {
  id: SectionId;
  label: string;
  icon: string;
  description: string;
  /** false = no backend support yet, panel shows an honest "not available" state */
  available: boolean;
}

const SECTION_KEY = 'nx-settings-section';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css']
})
export class SettingsComponent implements OnInit {
  users: any = {};
  role: any;
  profile_pic: any = null;
  preview: string | ArrayBuffer | null = null;

  isLoading = true;
  loadError = false;
  coverUploading = false;
  /** cover URL failed to load: show the gradient instead of a broken image */
  coverBroken = false;

  /** userprofiles row exists (saveProfile can only update an existing row without a new photo) */
  profileExists = false;
  private profileData: any = {};

  savingAccount = false;
  savingPrivacy = false;
  sendingReset = false;

  accountForm!: FormGroup;
  privacyForm!: FormGroup;

  activeSection: SectionId = 'account';

  sections: SettingsSection[] = [
    { id: 'account', label: 'Account Information', icon: 'person_outline', description: 'Your name, email and contact details.', available: true },
    { id: 'privacy', label: 'Profile & Privacy', icon: 'visibility', description: 'Control what other people can see.', available: true },
    { id: 'security', label: 'Login & Security', icon: 'shield', description: 'Account status and sign-in.', available: true },
    { id: 'password', label: 'Password Management', icon: 'lock_reset', description: 'Reset your password by email.', available: true },
    { id: 'notifications', label: 'Notifications', icon: 'notifications_none', description: 'Choose what you get notified about.', available: true },
    { id: 'email', label: 'Email Preferences', icon: 'mail_outline', description: 'Manage the emails we send you.', available: false },
    { id: 'appearance', label: 'Appearance & Theme', icon: 'palette', description: 'Reaction sounds and effects.', available: true },
    { id: 'blocked', label: 'Blocked Users', icon: 'block', description: 'People you have blocked.', available: false },
    { id: 'danger', label: 'Deactivation / Deletion', icon: 'person_off', description: 'Deactivate or delete your account.', available: false },
  ];

  /** Read-only account facts (come from the `resources` table via user/profile) */
  accountFields = [
    { icon: 'badge', label: 'Full name', key: 'fullname' },
    { icon: 'email', label: 'Email', key: 'email' },
    { icon: 'work_outline', label: 'Profession', key: 'profession' },
    { icon: 'business', label: 'Company', key: 'company' },
    { icon: 'link', label: 'Website', key: 'companywebsite', link: true },
    { icon: 'verified_user', label: 'Role', key: 'role_code' },
  ];

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private alert: NotificationsService,
    private dialog: MatDialog,
    private cvService: CurriculumVitaeService,
    private profileService: ProfileService,
    private forgetService: ForgetPasswordService,
    private http: HttpClient,
    private route: ActivatedRoute,
    private router: Router,
    public sharedRoutines: SharedRoutinesService,
    public fx: ReactionFxService,
    private chat: ChatService,
    public prefsSvc: NotificationPrefsService,
    public delivery: NotificationDeliveryService
  ) { }

  ngOnInit(): void {
    this.role = this.sharedRoutines.getRole();
    if (this.role === 'DEF-USERS') {
      this.sections.splice(4, 0, {
        id: 'plan', label: 'Subscription Plan', icon: 'workspace_premium',
        description: 'Your account type and available plans.', available: true
      });
    }

    this.accountForm = this.fb.group({
      contact_no: ['', [Validators.maxLength(255), Validators.pattern(/^[0-9+()\-\s]*$/)]],
      date_birth: [''],
      current_location: ['', Validators.maxLength(255)],
      current_state: ['', Validators.maxLength(255)],
      home_country: ['', Validators.maxLength(255)],
      home_state: ['', Validators.maxLength(255)],
      summary: ['', Validators.maxLength(255)],
    });
    this.privacyForm = this.fb.group({
      contact_visibility: [false],
      email_visibility: [false],
    });

    // Restore last section: ?section=… wins, then what the user last viewed
    const wanted = this.route.snapshot.queryParamMap.get('section') || this.safeGet(SECTION_KEY);
    if (wanted && this.sections.some(s => s.id === wanted)) {
      this.activeSection = wanted as SectionId;
    }

    this.loadAll();
    this.prefsSvc.load();
    this.delivery.refreshPermission();
    this.loadPreview();
  }

  get current(): SettingsSection {
    return this.sections.find(s => s.id === this.activeSection) || this.sections[0];
  }

  select(id: SectionId): void {
    this.activeSection = id;
    this.safeSet(SECTION_KEY, id);
    this.router.navigate([], { relativeTo: this.route, queryParams: { section: id }, replaceUrl: true });
  }

  // ---------- Loading ----------
  async loadAll(): Promise<void> {
    this.isLoading = true;
    this.loadError = false;
    this.cvService.getDataCV().subscribe({
      next: (res: any) => (this.profile_pic = res?.message),
      error: () => { /* avatar falls back to default */ }
    });
    try {
      const [userRes, profileRes]: any[] = await Promise.all([
        firstValueFrom(this.authService.getProfilecode()),
        firstValueFrom(this.profileService.getProfileByBasicInfo()).catch(() => null),
      ]);
      this.users = { ...(userRes?.message || {}) };
      this.profileExists = !!profileRes?.success;
      this.profileData = profileRes?.data || {};
      this.resetForms();
    } catch (err) {
      this.loadError = true;
      this.alert.toastrError('Could not load your settings. Please try again.');
    } finally {
      this.isLoading = false;
    }
  }

  /** Cancel / initial fill: put saved values back in the forms */
  resetForms(): void {
    this.fillAccount();
    this.fillPrivacy();
  }

  private fillAccount(): void {
    const p = this.profileData || {};
    const u = this.users || {};
    this.accountForm.reset({
      contact_no: p.contact_no ?? u.contact_no ?? '',
      date_birth: (p.date_birth || u.date_birth || '').toString().substring(0, 10),
      current_location: p.current_location ?? u.current_location ?? '',
      current_state: p.current_state ?? '',
      home_country: p.home_country ?? u.home_country ?? '',
      home_state: p.home_state ?? '',
      summary: p.summary ?? '',
    });
    if (this.profileExists) this.accountForm.enable(); else this.accountForm.disable();
  }

  private fillPrivacy(): void {
    const p = this.profileData || {};
    this.privacyForm.reset({
      contact_visibility: !!p.contact_visibility,
      email_visibility: !!p.email_visibility,
    });
    if (this.profileExists) this.privacyForm.enable(); else this.privacyForm.disable();
  }

  // ---------- Save (shared by Account + Privacy; saveProfile replaces the whole row) ----------
  private buildPayload(which: 'account' | 'privacy'): any {
    const p = this.profileData || {};
    // Only the form being saved contributes edits; the other half is re-sent as last saved.
    const a = which === 'account' ? this.accountForm.getRawValue() : {
      contact_no: p.contact_no ?? this.users?.contact_no ?? '',
      date_birth: (p.date_birth || '').toString().substring(0, 10),
      current_location: p.current_location ?? '',
      current_state: p.current_state ?? '',
      home_country: p.home_country ?? '',
      home_state: p.home_state ?? '',
      summary: p.summary ?? '',
    };
    const v = which === 'privacy' ? this.privacyForm.getRawValue() : {
      contact_visibility: !!p.contact_visibility,
      email_visibility: !!p.email_visibility,
    };
    return {
      contact_no: a.contact_no || null,
      date_birth: this.toUsDate(a.date_birth),
      current_location: a.current_location || null,
      current_state: a.current_state || null,
      home_country: a.home_country || null,
      home_state: a.home_state || null,
      summary: a.summary || null,
      contact_visibility: !!v.contact_visibility,
      email_visibility: !!v.email_visibility,
    };
  }

  private persist(which: 'account' | 'privacy'): void {
    if (!this.profileExists) {
      this.alert.toastrInfo('Complete your profile first to change these settings.');
      return;
    }
    const form = which === 'account' ? this.accountForm : this.privacyForm;
    if (form.invalid) {
      form.markAllAsTouched();
      this.alert.toastrWarning('Please fix the highlighted fields.');
      return;
    }
    const payload = this.buildPayload(which);
    if (which === 'account') this.savingAccount = true; else this.savingPrivacy = true;

    this.profileService.postData('saveProfile', payload).subscribe({
      next: (res: any) => {
        if (res?.success) {
          this.alert.toastrSuccess(res.message || 'Settings saved.');
          this.reloadProfile();
        } else {
          this.alert.toastrError(this.firstMessage(res?.message) || 'Could not save your settings.');
        }
      },
      error: (err: any) => this.alert.toastrError(this.firstMessage(err?.error?.message) || 'Could not save your settings.'),
      complete: () => { this.savingAccount = false; this.savingPrivacy = false; }
    });
  }

  saveAccount(): void { this.persist('account'); }
  savePrivacy(): void { this.persist('privacy'); }
  cancelAccount(): void { this.fillAccount(); this.accountForm.markAsPristine(); }
  cancelPrivacy(): void { this.fillPrivacy(); this.privacyForm.markAsPristine(); }

  private async reloadProfile(): Promise<void> {
    const res: any = await firstValueFrom(this.profileService.getProfileByBasicInfo()).catch(() => null);
    this.profileData = res?.data || this.profileData;
    this.fillAccount();
    this.fillPrivacy();
    this.accountForm.markAsPristine();
    this.privacyForm.markAsPristine();
  }

  // ---------- Password ----------
  confirmPasswordReset(): void {
    const email = this.users?.email;
    if (!email) { this.alert.toastrError('No email address found on your account.'); return; }
    this.dialog.open(SettingsConfirmDialogComponent, {
      width: '420px',
      data: {
        title: 'Reset your password?',
        message: `We will send a password reset link to ${email}. The link expires in 5 minutes.`,
        confirmText: 'Send reset link', icon: 'lock_reset'
      }
    }).afterClosed().subscribe(ok => { if (ok) this.sendReset(email); });
  }

  private sendReset(email: string): void {
    this.sendingReset = true;
    this.forgetService.forgotPassword(email).subscribe({
      next: (res: any) => res?.success
        ? this.alert.toastrSuccess(res.message || 'Password reset email sent.')
        : this.alert.toastrWarning(this.firstMessage(res?.message) || 'Could not send the reset email.'),
      error: (err) => this.alert.toastrError(this.firstMessage(err?.error?.message) || 'Could not send the reset email.'),
      complete: () => (this.sendingReset = false)
    });
  }

  // ---------- Notifications ----------
  /** the most recent real message, so the preview shows exactly what a notification will look like for this user */
  previewConv: any = null;

  get np(): NotificationPrefs { return this.prefsSvc.prefs; }

  private loadPreview(): void {
    this.chat.getConversations().subscribe({
      next: (res: any) => {
        const list: any[] = Array.isArray(res?.data) ? res.data : [];
        this.previewConv = list.find(c => c.last_message && c.last_message.sender_id === c.user_id) || null;   // newest message FROM someone
      },
      error: () => { this.previewConv = null; }
    });
  }

  /** the text a notification will show: the message, or a generic line when previews are off */
  get previewBody(): string {
    if (!this.np.message_preview) { return 'Sent you a message'; }
    return this.previewConv ? String(this.previewConv.last_message.message || '') : 'Hi! Are you free to chat later today?';
  }
  get previewName(): string { return this.previewConv ? this.previewConv.fullname : 'Alex Rivera'; }
  get previewPhoto(): string { return (this.previewConv && this.previewConv.photo_pic) || 'assets/images/default.png'; }
  get previewTime(): Date { return this.previewConv ? new Date(this.previewConv.last_message.created_at) : new Date(); }

  /** click the preview: open that conversation (the example just opens Messages) */
  openPreview(): void {
    if (this.previewConv) { this.delivery.openConversation(this.previewConv.user_id); }
    else { this.router.navigate(['/' + this.role + '/message']); }
  }

  /** one switch changed: applies at once, saved in the background */
  setPref(key: keyof NotificationPrefs, value: any): void {
    this.prefsSvc.update({ [key]: value } as Partial<NotificationPrefs>);
  }

  /** Desktop notifications: the browser's permission is asked only here, once, and never forced */
  async setDesktop(on: boolean): Promise<void> {
    if (!on) { this.setPref('desktop_notifications', false); return; }
    const answer = await this.delivery.requestDesktopPermission();
    if (answer === 'granted') {
      this.setPref('desktop_notifications', true);
    } else {
      this.setPref('desktop_notifications', false);
      this.alert.toastrWarning(answer === 'denied'
        ? 'Your browser is blocking notifications for this site. Allow them in the browser settings first.'
        : answer === 'unsupported' ? 'This browser does not support desktop notifications.' : 'Desktop notifications were not allowed.');
    }
  }

  testSound(): void { this.delivery.testSound(); }

  enableAll(): void {
    // desktop notifications only come on if the browser already allows them
    this.prefsSvc.setAll(true, { desktop_notifications: this.delivery.permission$.value === 'granted' });
  }

  disableAll(): void { this.prefsSvc.setAll(false); }

  restoreDefaults(): void {
    this.dialog.open(SettingsConfirmDialogComponent, {
      width: '420px',
      data: { title: 'Restore default settings?', message: 'Every notification setting goes back to how it was when you joined. Sound and desktop notifications will be off.', confirmText: 'Restore defaults', icon: 'restart_alt', danger: true }
    }).afterClosed().subscribe(ok => { if (ok) { this.prefsSvc.reset(); } });
  }

  // ---------- Appearance: reaction sounds (stored in this browser, default OFF) ----------
  setReactionSound(on: boolean): void {
    this.fx.setSound(on);
    if (on) { this.fx.play('Like'); }          // the switch is a click: a direct user action, so audio is allowed
  }

  playSample(label: string): void { this.fx.play(label); }

  // ---------- Security ----------
  confirmSignOut(): void {
    this.dialog.open(SettingsConfirmDialogComponent, {
      width: '400px',
      data: { title: 'Sign out?', message: 'You will need to sign in again to access your account.', confirmText: 'Sign out', icon: 'logout', danger: true }
    }).afterClosed().subscribe(ok => { if (ok) this.sharedRoutines.onLogout(); });
  }

  // ---------- Photos (existing endpoints / flows) ----------
  async uploadCoverPhoto(event: any): Promise<void> {
    const file: File | undefined = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { this.preview = reader.result; this.coverBroken = false; };
    reader.readAsDataURL(file);

    const formData = new FormData();
    formData.append('coverphoto', file);
    this.coverUploading = true;
    try {
      const res: any = await firstValueFrom(this.http.post<any>(`${_url}uploadCoverPhoto`, formData, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` }
      }));
      if (res.success) {
        this.alert.toastrSuccess(res.message);
        const u: any = await firstValueFrom(this.authService.getProfilecode());
        this.users = { ...this.users, ...(u?.message || {}) };
        this.preview = null;
      } else {
        this.preview = null;
        this.alert.toastrError(this.firstMessage(res.message) || 'Failed to upload cover photo');
      }
    } catch (err: any) {
      this.preview = null;
      this.alert.toastrError(this.firstMessage(err?.error?.message) || 'Something went wrong while uploading the cover photo.');
    } finally {
      this.coverUploading = false;
      event.target.value = '';
    }
  }

  uploadPic(): void {
    window.location.href = `/${this.role}/user-cv`;
  }

  goToCV(): void { this.uploadPic(); }

  // ---------- helpers ----------
  get accountDirty(): boolean { return this.accountForm?.dirty; }
  get privacyDirty(): boolean { return this.privacyForm?.dirty; }

  /** yyyy-MM-dd -> M/d/yyyy (what saveProfile expects), without timezone shifts */
  private toUsDate(v: string): string | null {
    if (!v) return null;
    const [y, m, d] = v.split('-').map(Number);
    return y && m && d ? `${m}/${d}/${y}` : null;
  }

  private firstMessage(m: any): string {
    if (!m) return '';
    return Array.isArray(m) ? m.join(' ') : String(m);
  }

  private safeGet(k: string): string | null {
    try { return localStorage.getItem(k); } catch { return null; }
  }
  private safeSet(k: string, v: string): void {
    try { localStorage.setItem(k, v); } catch { /* storage unavailable */ }
  }
}
