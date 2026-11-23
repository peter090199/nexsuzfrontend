import { Injectable, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, filter, finalize, map, shareReplay, take, tap, timeout } from 'rxjs/operators';
import { SubscriptionService } from './subscription.service';
import { FeatureCode, PlanInfo, PLAN_ROLES, PlanRole, ROUTE_FEATURES } from './feature-access.map';

/**
 * The single, central subscription-feature service of the app (job seekers and recruiters).
 *
 *  - ONE API call (account-plan-details/my-plan-features) tells what this account may use today: the features of the plan
 *    the master admin assigned, whether the subscription is active / expired / suspended, and an upgrade message for
 *    everything it may not use. Every guard, menu, button and directive reads it from here.
 *  - it refreshes itself: after sign-in and checkout (callers use refresh()), when the tab comes back into view, every
 *    few minutes (a plan changed or edited by an administrator), at the moment a subscription runs out, and whenever the
 *    API refuses something (FeatureLockInterceptor).
 *  - only DEF-USERS and DEF-CLIENT are ever limited. Admins and master admins never are.
 *  - the API enforces the same features on its own: hiding things here is the courtesy, the server is the lock.
 */
@Injectable({ providedIn: 'root' })
export class FeatureService {

  /** feature_code => feature_value of the current plan (the older way pages read the plan) */
  private featureMap: { [key: string]: any } = {};
  /** code => may use it, for the features enforced for this account type */
  private access: Record<string, boolean> = {};
  /** code => why not (the upgrade message) */
  private messages: Record<string, string> = {};
  private info: PlanInfo = { status: 'unknown', plan: null, subscribed: null, expiresAt: null };

  private loaded = false;
  private inflight?: Observable<void>;
  private lastLoad = 0;
  private autoStarted = false;
  private expiryTimer?: any;
  private lastToast: Record<string, number> = {};

  /** ticks whenever what the account may use changes: menus and directives re-evaluate on it */
  readonly changes$ = new BehaviorSubject<number>(0);
  /** true once the first answer (or a failure) is in */
  readonly loaded$ = new BehaviorSubject<boolean>(false);

  constructor(private subs: SubscriptionService, private router: Router, private snack: MatSnackBar, private zone: NgZone) { }

  // ------------------------------------------------------------------ who is limited

  private get role(): string | null {
    try { return sessionStorage.getItem('role'); } catch { return null; }
  }

  /** Subscription plans apply to job seekers and recruiters. Admins and master admins (a known, different role) are never plan-limited. */
  get planApplies(): boolean {
    const r = this.role;
    return !r || (PLAN_ROLES as readonly string[]).includes(r);
  }

  // ------------------------------------------------------------------ loading and refreshing

  /** Load (or reload) what this account may use. One request at a time; everyone who asks shares it. */
  refresh(): Observable<void> {
    if (!this.planApplies) { this.reset(); return of(void 0); }
    if (!this.hasToken()) { return of(void 0); }
    if (this.inflight) { return this.inflight; }

    const call$ = this.subs.myFeatures().pipe(
      tap((res: any) => (res && res.success !== false ? this.apply(res) : this.markUnknown())),
      map(() => void 0),
      // an API failure never locks anybody out of the screens: the server still enforces every action
      catchError(() => { this.markUnknown(); return of(void 0); }),
      finalize(() => { this.inflight = undefined; }),
      shareReplay(1)
    );
    this.inflight = call$;
    call$.subscribe();
    return call$;
  }

  /** Emits once the first answer is in (or after 8 seconds: a slow API must not freeze navigation). */
  whenLoaded(): Observable<void> {
    if (!this.planApplies || this.loaded) { return of(void 0); }
    if (this.hasToken()) { this.refresh(); }
    return this.loaded$.pipe(filter(Boolean), take(1), timeout({ first: 8000, with: () => of(true) }), map(() => void 0));
  }

  /** the older way pages hand over just the feature rows (kept for callers that still do) */
  set(features: any[]): void {
    this.featureMap = {};
    (features || []).forEach(f => { this.featureMap[f.feature_code] = f.feature_value; });
    this.touch();
  }

  /** a different account signs in: forget the previous answer so nothing of it is judged against the new person */
  invalidate(): void {
    this.featureMap = {}; this.access = {}; this.messages = {};
    this.info = { status: 'unknown', plan: null, subscribed: null, expiresAt: null };
    this.loaded = false; this.loaded$.next(false);
    this.lastToast = {};
    this.touch();
  }

  /** forget everything (signed out / an account type that is never limited) */
  reset(): void {
    this.featureMap = {}; this.access = {}; this.messages = {};
    this.info = { status: 'unknown', plan: null, subscribed: null, expiresAt: null };
    this.loaded = true; this.loaded$.next(true);
    this.touch();
  }

  private apply(res: any): void {
    this.featureMap = {};
    (res.features || []).forEach((f: any) => { this.featureMap[f.feature_code] = f.feature_value; });
    this.access = res.access && typeof res.access === 'object' && !Array.isArray(res.access) ? res.access : {};
    this.messages = res.messages && typeof res.messages === 'object' && !Array.isArray(res.messages) ? res.messages : {};
    this.info = {
      status: res.status || 'unknown',
      plan: res.effective_plan ?? res.CurrentPlan ?? null,
      subscribed: res.subscribed_plan ?? res.CurrentPlan ?? null,
      expiresAt: res.expires_at ?? null,
    };
    this.loaded = true; this.lastLoad = Date.now(); this.loaded$.next(true);
    this.touch();
    this.scheduleExpiry();
    this.startAuto();
    this.announce();
  }

  private markUnknown(): void {
    this.loaded = true; this.loaded$.next(true); this.touch();
  }

  private touch(): void { this.changes$.next(this.changes$.value + 1); }
  private hasToken(): boolean { try { return !!sessionStorage.getItem('token'); } catch { return false; } }

  // ------------------------------------------------------------------ keeping it fresh

  private startAuto(): void {
    if (this.autoStarted) { return; }
    this.autoStarted = true;
    // an administrator can change a plan or its features at any time: look again every few minutes
    setInterval(() => { if (typeof document === 'undefined' || document.visibilityState === 'visible') { this.refresh(); } }, 5 * 60 * 1000);
    // and when the person comes back to the tab after a while
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && Date.now() - this.lastLoad > 60 * 1000) { this.refresh(); }
      });
    }
  }

  /** when a paid subscription reaches its end date the features change: look again at that moment */
  private scheduleExpiry(): void {
    if (this.expiryTimer) { clearTimeout(this.expiryTimer); this.expiryTimer = undefined; }
    if (this.info.status !== 'active' || !this.info.expiresAt) { return; }
    const ms = Date.parse(this.info.expiresAt.replace(' ', 'T')) - Date.now() + 1500;
    if (ms > 0 && ms < 2147483000) { this.expiryTimer = setTimeout(() => this.refresh(), ms); }
  }

  /** tell the person, once per session, that their subscription expired or is suspended */
  private announce(): void {
    const s = this.info.status;
    if (s !== 'expired' && s !== 'suspended') { return; }
    const key = `feature_notice_${s}_${this.info.subscribed || ''}`;
    try { if (sessionStorage.getItem(key)) { return; } sessionStorage.setItem(key, '1'); } catch { /* storage blocked: tell them anyway */ }
    const text = s === 'expired'
      ? `Your ${this.info.subscribed || ''} subscription has expired. You are on the ${this.info.plan || 'Free'} plan now. Renew or upgrade to get your features back.`.replace('  ', ' ')
      : 'Your subscription is suspended. Please contact an administrator.';
    this.show(text, s === 'expired');
  }

  // ------------------------------------------------------------------ asking

  /** may this account use the feature? Not limited, not yet known, or a feature that is not enforced for it: yes. */
  allows(code: FeatureCode | string): boolean {
    if (!this.planApplies || !this.loaded) { return true; }
    return this.access[code] !== false;
  }

  /** Older way of asking (strict until the answer is in): used by the pages that already call it. */
  can(featureCode: string): boolean {
    if (!this.planApplies) { return true; }
    if (featureCode in this.access) { return this.access[featureCode]; }
    return this.featureMap[featureCode] === 'YES';
  }

  /** the upgrade message for a feature the account does not have */
  message(code: string): string {
    return this.messages[code] || 'This feature is not included in your plan. Upgrade your plan to use it.';
  }

  get planInfo(): PlanInfo { return this.info; }

  /** the feature a route needs (by its first path segment), or null when the route is not tied to one */
  routeFeature(path: string): FeatureCode | null {
    const role = this.role as PlanRole | null;
    if (!role || !ROUTE_FEATURES[role]) { return null; }
    const parts = (path || '').split(/[?#]/)[0].split('/').filter(Boolean);
    if (parts[0] && parts[0].startsWith('DEF-')) { parts.shift(); }
    return (parts[0] && ROUTE_FEATURES[role][parts[0]]) || null;
  }

  /** may this account open this route? (menus use it to hide what the plan does not include) */
  allowsRoute(path: string): boolean {
    const code = this.routeFeature(path);
    return !code || this.allows(code);
  }

  // ------------------------------------------------------------------ refusals

  /** The API refused something because of the plan: say why, once in a while, and look at the plan again. */
  lockedByServer(code: string, message?: string): void {
    this.notifyLocked(code, message);
    this.refresh();
  }

  /** show the upgrade message for a feature (at most once every 15 seconds per feature) */
  notifyLocked(code: string, message?: string): void {
    const now = Date.now();
    if (now - (this.lastToast[code] || 0) < 15000) { return; }
    this.lastToast[code] = now;
    this.show(message || this.message(code), true);
  }

  private show(text: string, withAction: boolean): void {
    this.zone.run(() => {
      const ref = this.snack.open(text, withAction ? 'View plans' : 'OK', { duration: 10000, verticalPosition: 'top', panelClass: 'feature-snack' });
      if (withAction) {
        ref.onAction().subscribe(() => { const r = this.role; if (r) { this.router.navigate(['/' + r, 'settings'], { queryParams: { section: 'plan' } }); } });
      }
    });
  }

  // ------------------------------------------------------------------ the older helpers (unchanged behaviour)

  getValue(featureCode: string): any { return this.featureMap[featureCode]; }

  has(featureCode: string): boolean {
    if (!this.planApplies) return true;
    return !!this.featureMap[featureCode];
  }

  limit(code: string): number {
    if (!this.planApplies) return Number.MAX_SAFE_INTEGER;
    return Number(this.featureMap[code] || 0);
  }

  isRestricted(code: string): boolean {
    if (!this.planApplies) return false;
    return ['LIMITED', 'RESTRICTED'].includes(this.featureMap[code]);
  }
}
