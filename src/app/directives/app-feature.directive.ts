import { Directive, Input, OnDestroy, OnInit, TemplateRef, ViewContainerRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { FeatureService } from 'src/app/services/AccountPlan/feature.service';

/**
 * Show something only when the account's subscription includes a feature:
 *
 *   <button *appFeature="'MESSAGING_ACCESS'">Message</button>
 *   <button *appFeature="FEATURE.JOB_POSTING; else upgrade">Post a job</button>
 *   <ng-template #upgrade><span>Upgrade to post jobs</span></ng-template>
 *
 * With several codes ( [..] ) every one must be included. It follows the plan live: when the plan changes (an upgrade,
 * an expiry, an administrator editing the plan) what is shown changes with it, with no reload.
 * Job seekers and recruiters are the only accounts ever limited: for anyone else the content is always shown.
 */
@Directive({ selector: '[appFeature]' })
export class AppFeatureDirective implements OnInit, OnDestroy {
  @Input('appFeature') codes: string | string[] = [];
  @Input('appFeatureElse') elseTpl?: TemplateRef<unknown>;

  private sub?: Subscription;
  private shown: boolean | null = null;

  constructor(private tpl: TemplateRef<unknown>, private vcr: ViewContainerRef, private features: FeatureService) { }

  ngOnInit(): void {
    this.sub = this.features.changes$.subscribe(() => this.render());
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  private render(): void {
    const list = Array.isArray(this.codes) ? this.codes : (this.codes ? [this.codes] : []);
    const ok = list.every(c => this.features.allows(c));
    if (ok === this.shown) { return; }
    this.shown = ok;
    this.vcr.clear();
    if (ok) { this.vcr.createEmbeddedView(this.tpl); }
    else if (this.elseTpl) { this.vcr.createEmbeddedView(this.elseTpl); }
  }
}
