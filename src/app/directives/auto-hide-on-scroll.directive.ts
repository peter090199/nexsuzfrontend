import { AfterViewInit, Directive, ElementRef, Input, NgZone, OnDestroy, Renderer2 } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { animationFrameScheduler, fromEvent, Subscription } from 'rxjs';
import { auditTime, filter, map } from 'rxjs/operators';

/**
 * Smart auto-hide for a toolbar/navbar.
 *
 *  - scrolling DOWN hides it, scrolling UP shows it again
 *  - always visible at the top of the page
 *  - small movements (< THRESHOLD px) are ignored to avoid flicker
 *  - stays as-is when scrolling stops
 *  - never hides while a menu / dialog / drawer is open, the toolbar has
 *    keyboard focus, or `nxAutoHidePause` is true
 *
 * Usage: <mat-toolbar nxAutoHide nxAutoHideScroller=".page-content"> ...
 * The animation itself lives in the global NEXSUZ stylesheet
 * (.nx-autohide / .nx-nav-hidden in styles/nexsuz-design-system.scss).
 *
 * Scroll events run outside Angular's zone and the DOM is updated
 * directly, so scrolling never triggers change detection.
 */
@Directive({ selector: '[nxAutoHide]' })
export class AutoHideOnScrollDirective implements AfterViewInit, OnDestroy {

  /** CSS selector of the element that scrolls (closest ancestor first). Defaults to the window. */
  @Input('nxAutoHideScroller') scrollerSelector?: string;
  /** Extra condition that keeps the bar visible (e.g. mobile drawer open). */
  @Input('nxAutoHidePause') pause = false;

  private static readonly THRESHOLD = 8;           // px of same-direction travel before reacting
  private static readonly OPEN_OVERLAYS = [
    '.mat-menu-panel',
    '.mat-dialog-container',
    '.mat-select-panel',
    '.mat-autocomplete-panel',
    '.mat-datepicker-popup',
    '.mat-drawer.mat-drawer-opened.mat-drawer-over',
    '.dropdown-menu.show',
    '.modal.show',
  ].join(',');

  private scroller: HTMLElement | Window = window;
  private lastTop = 0;
  private travelled = 0;
  private hidden = false;
  private subs = new Subscription();
  private resizeObserver?: ResizeObserver;

  constructor(
    private host: ElementRef<HTMLElement>,
    private renderer: Renderer2,
    private zone: NgZone,
    private router: Router
  ) { }

  ngAfterViewInit(): void {
    const el = this.host.nativeElement;
    this.renderer.addClass(el, 'nx-autohide');

    if (this.scrollerSelector) {
      this.scroller = (el.closest(this.scrollerSelector) as HTMLElement)
        || (document.querySelector(this.scrollerSelector) as HTMLElement)
        || window;
    }
    this.lastTop = this.currentTop();

    this.zone.runOutsideAngular(() => {
      this.subs.add(
        fromEvent(this.scroller, 'scroll', { passive: true } as AddEventListenerOptions)
          .pipe(auditTime(0, animationFrameScheduler), map(() => this.currentTop()))
          .subscribe(top => this.onScroll(top))
      );
      // keyboard users tabbing into the bar must always see it
      this.subs.add(fromEvent(el, 'focusin').subscribe(() => this.setHidden(false)));

      // publish the bar height so layouts / sticky rails can offset from it
      if (typeof ResizeObserver !== 'undefined') {
        this.resizeObserver = new ResizeObserver(() => this.publishHeight());
        this.resizeObserver.observe(el);
      }
      this.publishHeight();
    });

    // a new page should start with the bar visible
    this.subs.add(
      this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => {
        this.lastTop = this.currentTop();
        this.travelled = 0;
        this.setHidden(false);
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.resizeObserver?.disconnect();
    const root = document.documentElement;
    root.classList.remove('nx-nav-is-hidden');
    root.style.removeProperty('--nx-nav-h');
  }

  // ------------------------------------------------------------------

  private currentTop(): number {
    const s = this.scroller;
    const top = s instanceof Window ? (window.scrollY || document.documentElement.scrollTop) : s.scrollTop;
    return Math.max(0, top);   // ignore iOS rubber-band overscroll (negative values)
  }

  private onScroll(top: number): void {
    // At the very top the bar is always visible
    if (top <= 0) {
      this.travelled = 0;
      this.lastTop = 0;
      this.setHidden(false);
      return;
    }

    // Something is open that belongs to the navigation: keep the bar where it is
    if (this.pause || this.hasOpenOverlay()) {
      this.lastTop = top;
      this.travelled = 0;
      this.setHidden(false);
      return;
    }

    const delta = top - this.lastTop;
    this.lastTop = top;
    if (delta === 0) { return; }

    // accumulate travel in one direction; reset when the direction flips
    this.travelled = Math.sign(delta) === Math.sign(this.travelled) ? this.travelled + delta : delta;

    if (this.travelled > AutoHideOnScrollDirective.THRESHOLD) {
      // do not hide until the content has actually passed under the bar
      if (top > this.host.nativeElement.offsetHeight) { this.setHidden(true); }
    } else if (this.travelled < -AutoHideOnScrollDirective.THRESHOLD) {
      this.setHidden(false);
    }
  }

  private hasOpenOverlay(): boolean {
    return !!document.querySelector(AutoHideOnScrollDirective.OPEN_OVERLAYS);
  }

  private setHidden(hidden: boolean): void {
    if (hidden === this.hidden) { return; }
    this.hidden = hidden;
    this.renderer.setStyle(this.host.nativeElement, 'pointer-events', hidden ? 'none' : '');
    this.host.nativeElement.classList.toggle('nx-nav-hidden', hidden);
    document.documentElement.classList.toggle('nx-nav-is-hidden', hidden);
  }

  private publishHeight(): void {
    document.documentElement.style.setProperty('--nx-nav-h', `${this.host.nativeElement.offsetHeight}px`);
  }
}
