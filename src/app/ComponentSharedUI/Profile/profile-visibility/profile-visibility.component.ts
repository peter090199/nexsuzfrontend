import { Component, OnInit } from '@angular/core';
import { NotificationsService } from 'src/app/services/Global/notifications.service';
import { ProfileService } from 'src/app/services/Profile/profile.service';

/** Settings > Profile & Privacy: who may see the profile. The API enforces it; this only saves the choice. */
@Component({
  selector: 'app-profile-visibility',
  template: `
<mat-card class="pv" *ngIf="s">
  <h3>Who can see my profile</h3>
  <p class="hint">"Public" means every signed-in member. Each post also keeps its own visibility.</p>
  <mat-form-field appearance="outline" *ngFor="let f of fields">
    <mat-label>{{ f.label }}</mat-label>
    <mat-select [(value)]="s[f.key]">
      <mat-option value="public"><mat-icon>public</mat-icon> Public</mat-option>
      <mat-option value="connections"><mat-icon>group</mat-icon> Connections only</mat-option>
      <mat-option value="private"><mat-icon>lock</mat-icon> Only me</mat-option>
    </mat-select>
  </mat-form-field>
  <mat-slide-toggle color="primary" [checked]="s.visitors && s.profile === 'public'" [disabled]="s.profile !== 'public'"
    (change)="s.visitors = $event.checked">Also show my basic profile, company, open jobs and Public posts to people who are not signed in</mat-slide-toggle>
  <mat-slide-toggle color="primary" [checked]="s.cv_link" (change)="s.cv_link = $event.checked">Allow my shared CV link to work</mat-slide-toggle>
  <div class="actions">
    <button mat-flat-button color="primary" type="button" (click)="save()" [disabled]="saving">{{ saving ? 'Saving…' : 'Save visibility' }}</button>
  </div>
</mat-card>
<p class="hint" *ngIf="failed">Could not load your visibility settings.</p>
`,
  styles: [`
    :host { display: block; margin-bottom: 16px; }
    .pv { display: flex; flex-direction: column; gap: 6px; }
    h3 { margin: 0; font-size: 15px; } .hint { font-size: 12px; color: #6b7a99; text-align: left; }
    mat-slide-toggle { margin-bottom: 8px; white-space: normal; }
    ::ng-deep app-profile-visibility .mat-slide-toggle-content { white-space: normal; }
    .actions { text-align: right; }
  `]
})
export class ProfileVisibilityComponent implements OnInit {
  readonly fields = [
    { key: 'profile', label: 'My profile' },
    { key: 'contact', label: 'Contact details' },
    { key: 'experience', label: 'Experience, education and skills' },
    { key: 'personal', label: 'Birth date and home location' },
  ];
  s: any = null;
  saving = false;
  failed = false;

  constructor(private profiles: ProfileService, private alert: NotificationsService) { }

  ngOnInit(): void {
    this.profiles.getPrivacy().subscribe({
      next: (res: any) => this.s = res?.data || null,
      error: () => this.failed = true
    });
  }

  save(): void {
    this.saving = true;
    this.profiles.savePrivacy({ ...this.s, visitors: this.s.visitors && this.s.profile === 'public' }).subscribe({
      next: (res: any) => { this.saving = false; this.s = res?.data || this.s; this.alert.toastrSuccess(res?.message || 'Saved.'); },
      error: (err: any) => { this.saving = false; this.alert.toastrError(err?.error?.message || 'Could not save your settings.'); }
    });
  }
}
