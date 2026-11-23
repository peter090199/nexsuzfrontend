import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-sub-page-header',
  template: `
    <nav class="crumbs" aria-label="Breadcrumb">
      <span>Master Admin</span><mat-icon>chevron_right</mat-icon>
      <span>{{ section }}</span><mat-icon>chevron_right</mat-icon>
      <strong>{{ title }}</strong>
    </nav>
    <div class="head">
      <div class="head-text">
        <h1>{{ title }}</h1>
        <p>{{ subtitle }}</p>
      </div>
      <div class="head-actions"><ng-content></ng-content></div>
    </div>`,
  styles: [`
    :host { display: block; margin-bottom: 20px; }
    .crumbs { display: flex; align-items: center; flex-wrap: wrap; font-size: 12px; color: #6b7a99; margin-bottom: 8px; }
    .crumbs mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .crumbs strong { color: #004182; }
    .head { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
    h1 { margin: 0; font-size: 22px; color: #002a57; }
    p { margin: 4px 0 0; color: #6b7a99; font-size: 13px; }
    .head-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    @media (max-width: 600px) { .head-actions { width: 100%; } .head-actions ::ng-deep button { flex: 1 1 auto; } }
  `]
})
export class SubPageHeaderComponent {
  @Input() title = '';
  @Input() subtitle = '';
  /** Middle breadcrumb, e.g. Subscription or System. */
  @Input() section = 'Subscription';
}
