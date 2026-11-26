import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ProfileService } from 'src/app/services/Profile/profile.service';

/**
 * /p/:code — the address "Share profile" hands out. Signed-in members go to their normal profile page; everyone else
 * sees only what the API allows for owners who opted in to logged-out visitors (never contact details or CV).
 */
@Component({
  selector: 'app-public-profile',
  template: `
<div class="pp">
  <mat-progress-bar *ngIf="loading" mode="indeterminate"></mat-progress-bar>

  <section class="card state" *ngIf="!loading && !p">
    <mat-icon>lock</mat-icon>
    <p>{{ error }}</p>
    <a mat-flat-button color="primary" routerLink="/signin">Sign in</a>
  </section>

  <ng-container *ngIf="p">
    <section class="card head">
      <div class="cover"><img *ngIf="p.coverphoto" [src]="p.coverphoto" (error)="p.coverphoto = null" alt="Cover photo"></div>
      <div class="id">
        <img class="avatar" [src]="p.photo_pic || 'assets/images/default.png'" nxFallback alt="Profile picture">
        <h1>{{ p.name }}</h1>
        <p *ngIf="p.profession || p.company">{{ p.profession }}<ng-container *ngIf="p.profession && p.company"> · </ng-container>{{ p.company }}</p>
        <p class="muted"><ng-container *ngIf="p.location">{{ p.location }} · </ng-container>{{ p.connections_count }} connections</p>
        <a mat-flat-button color="primary" routerLink="/signin">Sign in to connect</a>
      </div>
    </section>

    <section class="card" *ngIf="p.about || p.industry || p.companywebsite">
      <h2>About</h2>
      <p *ngIf="p.about">{{ p.about }}</p>
      <p class="muted" *ngIf="p.industry">{{ p.industry }}</p>
      <p *ngIf="website"><a [href]="website" target="_blank" rel="noopener noreferrer nofollow">{{ p.companywebsite }}</a></p>
    </section>

    <section class="card" *ngIf="p.jobs.length">
      <h2>Open jobs</h2>
      <article *ngFor="let j of p.jobs">
        <h3>{{ j.job_name }}</h3>
        <p class="muted">{{ j.company }} · {{ j.location }} · {{ j.work_type }} · Posted {{ j.created_at | date:'mediumDate' }}</p>
      </article>
    </section>

    <section class="card">
      <h2>Activity</h2>
      <p class="muted" *ngIf="!p.posts.length">No public posts yet.</p>
      <article *ngFor="let post of p.posts">
        <p class="muted"><mat-icon inline>public</mat-icon> Public · {{ post.created_at | date:'medium' }}</p>
        <p class="caption">{{ post.caption }}</p>
        <img class="media" *ngFor="let i of post.images" [src]="i.path_url" loading="lazy" alt="Post image">
      </article>
    </section>
  </ng-container>
</div>
`,
  styles: [`
    :host { display: block; min-height: 100vh; background: var(--nx-bg, #f3f6fb); font-family: var(--nx-font, Verdana, sans-serif); }
    .pp { max-width: 760px; margin: 0 auto; padding: 16px; }
    .card { background: #fff; border: 1px solid var(--nx-border, #e3e9f3); border-radius: 14px; padding: 18px; margin-bottom: 14px; }
    .head { padding: 0; overflow: hidden; }
    .cover { height: 160px; background: linear-gradient(135deg, #004182, #0a66c2); }
    .cover img { width: 100%; height: 100%; object-fit: cover; }
    .id { padding: 0 18px 18px; text-align: center; }
    .avatar { width: 112px; height: 112px; margin-top: -56px; border-radius: 50%; border: 4px solid #fff; object-fit: cover; background: #fff; }
    h1 { margin: 8px 0 0; font-size: 22px; color: #004182; } h2 { font-size: 15px; color: #004182; margin: 0 0 10px; }
    h3 { margin: 0; font-size: 14px; } p { margin: 4px 0 8px; text-align: inherit; overflow-wrap: anywhere; }
    article { border-top: 1px solid var(--nx-border, #e3e9f3); padding: 10px 0; }
    .muted { color: #6b7a99; font-size: 12px; } .caption { white-space: pre-line; }
    .media { max-width: 100%; border-radius: 10px; margin-top: 6px; display: block; }
    .state { text-align: center; padding: 40px 18px; }
  `]
})
export class PublicProfileComponent implements OnInit {
  p: any = null;
  loading = true;
  error = '';

  constructor(private route: ActivatedRoute, private router: Router, private profiles: ProfileService) { }

  ngOnInit(): void {
    const code = this.route.snapshot.paramMap.get('code') || '';
    const role = sessionStorage.getItem('role');
    if (sessionStorage.getItem('token') && role) {
      this.router.navigate(['/' + role, 'profile', code], { replaceUrl: true });
      return;
    }
    this.profiles.getPublicProfile(code).subscribe({
      next: (res: any) => { this.p = res?.data || null; this.loading = false; },
      error: (err: any) => {
        this.loading = false;
        this.error = err?.status === 404 ? 'This profile is only visible to signed-in members.'
          : 'Could not load this profile. Please try again.';
      }
    });
  }

  get website(): string {
    const site = String(this.p?.companywebsite || '').trim();
    if (!site) return '';
    return /^https?:\/\//i.test(site) ? site : 'https://' + site;
  }
}
