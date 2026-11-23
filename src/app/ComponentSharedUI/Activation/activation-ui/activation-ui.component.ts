import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NotificationsService } from 'src/app/services/Global/notifications.service';
import { ActivatedRoute, Router } from '@angular/router';
import { ActivationService } from 'src/app/services/Activation/activation.service';

@Component({
  selector: 'app-activation-ui',
  templateUrl: './activation-ui.component.html',
  styleUrls: ['./activation-ui.component.css']
})
export class ActivationUIComponent implements OnInit, OnDestroy {

  isLoading: boolean= false;
  activationForm!: FormGroup; // Define the form group properly
  email: string = '';
  code: string = '';

  /** "Resend activation email" is locked for a minute after each press (the server also rate limits it). */
  readonly resendCooldownSeconds = 60;
  resending = false;
  cooldown = 0;
  private cooldownTimer: any;

  constructor(private fb: FormBuilder,private notificationsService:NotificationsService,
    private router:Router,  private route: ActivatedRoute,private activation:ActivationService

  ) { }

  ngOnInit(): void {
    this.email = this.route.snapshot.paramMap.get('email') || '';

    // The button in the email is /activation/<email>?code=<code>, so the code arrives already filled in
    const codeFromLink = (this.route.snapshot.queryParamMap.get('code') || '').trim();

    this.activationForm = this.fb.group({
      code: [codeFromLink, [Validators.required, Validators.pattern(/\S/)]],
    });
  }

  ngOnDestroy(): void { clearInterval(this.cooldownTimer); }

  errorMessage:string='';

  /** Readable message from a Laravel reply: its own message, else a plain fallback (never the raw HTTP error text). */
  private messageOf(error: any, fallback: string): string {
    if (error?.status === 429) { return 'Too many requests. Please wait a few minutes and try again.'; }
    const m = error?.error?.message;
    return Array.isArray(m) ? m.join(' ') : (m || fallback);
  }

  onSubmit() {
    if (this.activationForm.valid) {
      const payload = {
        email : this.email,
        code: String(this.activationForm.value.code).trim()
      };

      this.isLoading = true;
      this.activation.activate(payload).subscribe(
        (res) => {
          if (res.success)
          {
            this.notificationsService.toastrSuccess(res.message);
            // /signInUI no longer exists, so activation ends on the real sign-in page
            this.router.navigate(['/signin']);
          }
          else
          {
            this.isLoading = false;
            this.notificationsService.toastrWarning(Array.isArray(res.message) ? res.message.join(' ') : res.message);
          }
        },
        (error) => {
          this.isLoading = false;
          this.errorMessage = this.messageOf(error, 'Activation failed. Please try again.');
          this.notificationsService.toastrError(this.errorMessage);
        }
      );
    }
  }

  /** Send a new activation email (a fresh code replaces the old one). */
  resend(): void {
    if (!this.email || this.resending || this.cooldown > 0) { return; }
    this.resending = true;
    this.activation.resend(this.email).subscribe(
      (res) => {
        this.resending = false;
        this.notificationsService.toastrSuccess(res.message);
        this.startCooldown();
      },
      (error) => {
        this.resending = false;
        this.notificationsService.toastrError(this.messageOf(error, 'Could not send the email. Please try again later.'));
        if (error?.status === 429) { this.startCooldown(); }
      }
    );
  }

  private startCooldown(): void {
    this.cooldown = this.resendCooldownSeconds;
    clearInterval(this.cooldownTimer);
    this.cooldownTimer = setInterval(() => {
      this.cooldown = Math.max(0, this.cooldown - 1);
      if (this.cooldown === 0) { clearInterval(this.cooldownTimer); }
    }, 1000);
  }
}
