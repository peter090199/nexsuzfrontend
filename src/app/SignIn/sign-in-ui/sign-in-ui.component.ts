import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NotificationsService } from 'src/app/services/Global/notifications.service';
import { SigInService } from 'src/app/services/signIn/sig-in.service';
import { GoogleAuthService } from 'src/app/services/google/google-auth.service';
import { FeatureService } from 'src/app/services/AccountPlan/feature.service';
import { SubscriptionService } from 'src/app/services/AccountPlan/subscription.service';

@Component({
  selector: 'app-sign-in-ui',
  templateUrl: './sign-in-ui.component.html',
  styleUrls: ['./sign-in-ui.component.css']
})
export class SignInUIComponent implements OnInit {
  loginForm!: FormGroup;
  isLoading = false;
  isRedirecting = false;
  passwordVisible = false;
  private readonly REMEMBER_KEY = 'nexsuz_remembered_email';

  returnUrl: string | null = null;
  applyTransNo: string | null = null;
  viewPeople = false;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private sigInService: SigInService,
    private notificationService: NotificationsService,
    private googleAuth: GoogleAuthService,
    private subscriptionService: SubscriptionService,
    private featureService: FeatureService
  ) { }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const token = params['token'];
      if (token) {
        localStorage.setItem('auth_token', token);
        this.router.navigate(['/dashboard']);
      }

      this.returnUrl = params['returnUrl'] || null;
      this.applyTransNo = params['applyTransNo'] || null;
      this.viewPeople = params['view'] === 'people';
    });

    const rememberedEmail = this.getRememberedEmail();

    this.loginForm = this.fb.group({
      email: [rememberedEmail, [Validators.required, Validators.email]],
      password: ['', [
        Validators.required,
        Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{8,}$/)
      ]],
      rememberMe: [!!rememberedEmail]
    });
  }

  // Only the email is ever persisted - never the password.
  private getRememberedEmail(): string {
    try {
      return localStorage.getItem(this.REMEMBER_KEY) || '';
    } catch {
      return '';
    }
  }

  private saveRememberedEmail(email: string, remember: boolean): void {
    try {
      if (remember) {
        localStorage.setItem(this.REMEMBER_KEY, email);
      } else {
        localStorage.removeItem(this.REMEMBER_KEY);
      }
    } catch { /* storage unavailable - ignore */ }
  }

  get emailCtrl() { return this.loginForm.get('email'); }
  get passwordCtrl() { return this.loginForm.get('password'); }

  togglePasswordVisibility(): void {
    this.passwordVisible = !this.passwordVisible;
  }

  onSubmit(): void {
    if (this.loginForm.invalid || this.isLoading || this.isRedirecting) return;

    this.isLoading = true;
    const { email, password, rememberMe } = this.loginForm.value;

    this.sigInService.signin(email, password).subscribe({
      next: (res: any) => {
        this.isLoading = false;

        if (!res || !res.success) {
          this.notificationService.toastPopUpError(res?.message || 'Login failed');
          return;
        }

        this.saveRememberedEmail(email, !!rememberMe);

        // Save session
        sessionStorage.setItem('token', res.token);
        sessionStorage.setItem('role', res.role);
        // the account code is needed to tell "my own profile" from someone else's on every page, for every role
        if (res.code !== undefined && res.code !== null) { sessionStorage.setItem('code', String(res.code)); }
        sessionStorage.setItem('is_online', String(res.is_online ?? true));
        localStorage.setItem('chatmessages', 'true');
        // what this account's plan includes: asked for right away, shared by every guard and menu that needs it
        this.featureService.invalidate();
        this.featureService.refresh();

        // DEF-CLIENT always lands on the dashboard (job-seeker shortcuts below don't apply to recruiters)
        if (res.role === 'DEF-CLIENT') {
          this.redirectUser(res.role);
          return;
        }

        // Came from "Apply Now" -> go straight back to that job
        if (this.applyTransNo) {
          this.redirectTo([`/${res.role}/apply-job`, this.applyTransNo]);
          return;
        }

        // Came from "People" on the landing page -> open the people search
        if (this.viewPeople) {
          this.redirectTo([`/${res.role}/search`], { type: 'people' });
          return;
        }

        // Came from some other protected page -> go back there
        if (this.returnUrl) {
          this.isRedirecting = true;
          const target = this.returnUrl;
          setTimeout(() => this.router.navigateByUrl(target), 1200);
          return;
        }

        // DEF-USERS go straight to Home, with or without a plan (plan-limited actions ask to upgrade when used)

        // Load features, then redirect by role
        this.featureService.refresh().subscribe(() => this.redirectUser(res.role));
      },

      error: (err) => {
        this.isLoading = false;
        const errorMsg = err.status === 401
          ? err.error?.message || 'Invalid email or password'
          : err.message || 'Something went wrong';
        this.notificationService.toastPopUpError(errorMsg);
      }
    });
  }

  private redirectUser(role: string): void {
    const routes: Record<string, string> = {
      'DEF-CLIENT': '/DEF-CLIENT/client-dashboard',
      'DEF-ADMIN': '/DEF-ADMIN/admin-dashboard',
      'DEF-MASTERADMIN': '/DEF-MASTERADMIN/admin-dashboard',
      'DEF-USERS': '/DEF-USERS/home'
    };
    this.redirectTo([routes[role] || '/homepage']);
  }

  private redirectTo(commands: any[], queryParams?: any): void {
    this.isRedirecting = true;
    setTimeout(() => this.router.navigate(commands, queryParams ? { queryParams } : {}), 1200);
  }

  signInWithGoogle(): void {
    this.googleAuth.loginWithGoogle();
  }
}