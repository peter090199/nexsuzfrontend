import { Injectable } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router } from '@angular/router';
import { BehaviorSubject, Observable, of, timer } from 'rxjs';
import { distinctUntilChanged, map, startWith, switchMap } from 'rxjs/operators';

/** background refreshes (polling) that must NOT light the loading bar: notifications, chat, presence */
const BACKGROUND_GET = /(conversations|getNotifications|getMessagesAll|update_count|getActiveUsers|activity-notifications|notification-settings|receivemessages|messages\/read|accessmenu)/i;

/**
 * App-wide "something is loading" signal for the top loading bar.
 * Counts requests that are in flight plus page changes. It waits 250 ms before showing (quick responses never flash
 * the bar) and keeps it up for 300 ms after the last one finishes (no flicker between back-to-back requests).
 */
@Injectable({ providedIn: 'root' })
export class LoadingService {
  private pending = 0;
  private navigating = false;
  private readonly raw$ = new BehaviorSubject<boolean>(false);

  /** true while the bar should be visible */
  readonly busy$: Observable<boolean> = this.raw$.pipe(
    switchMap(on => on ? timer(250).pipe(map(() => true)) : timer(300).pipe(map(() => false))),
    startWith(false),
    distinctUntilChanged()
  );

  constructor(router: Router) {
    router.events.subscribe(e => {
      if (e instanceof NavigationStart) { this.navigating = true; this.update(); }
      else if (e instanceof NavigationEnd || e instanceof NavigationCancel || e instanceof NavigationError) { this.navigating = false; this.update(); }
    });
  }

  /** should this request show the bar? */
  tracks(method: string, url: string): boolean {
    return !(method === 'GET' && BACKGROUND_GET.test(url));
  }

  begin(): void { this.pending++; this.update(); }
  end(): void { this.pending = Math.max(0, this.pending - 1); this.update(); }

  private update(): void {
    const on = this.pending > 0 || this.navigating;
    if (on !== this.raw$.value) { this.raw$.next(on); }
  }
}
