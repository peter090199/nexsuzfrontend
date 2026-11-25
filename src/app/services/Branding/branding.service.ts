import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';
import { BusinessInfoService, DEFAULT_LOGO_STYLE, LogoStyle, logoCss } from 'src/app/ComponentUI/BusinessInfo/business-info.service';

const CACHE_KEY = 'nx_brand_logo';
const STYLE_KEY = 'nx_brand_logo_style';

/**
 * The one place every logo in the app comes from: the logo AND its container style saved in Nexsuz Information
 * (public API). Components never fetch them themselves. The last known values are kept only to avoid a flash of the
 * default look on the next visit; the API answer always replaces them. Saving in Nexsuz Information calls
 * setBranding(), so every visible logo updates at once.
 */
@Injectable({ providedIn: 'root' })
export class BrandingService {
  private readonly subject = new BehaviorSubject<string | null>(BrandingService.cached(CACHE_KEY));
  private readonly styleSubject = new BehaviorSubject<LogoStyle>({ ...DEFAULT_LOGO_STYLE, ...(BrandingService.cachedStyle() || {}) });
  private started = false;
  private originalIcon: { href: string; type: string | null } | null = null;

  constructor(private api: BusinessInfoService) { }

  /** Starts the one-time load on first use, so pages that never show a logo make no request. */
  get logo$(): Observable<string | null> {
    this.ensureLoaded();
    return this.subject.pipe(distinctUntilChanged());
  }
  get style$(): Observable<LogoStyle> { this.ensureLoaded(); return this.styleSubject.asObservable(); }
  /** CSS properties for the logo container, from the saved style. */
  get css$(): Observable<{ [prop: string]: string }> { return this.style$.pipe(map(s => logoCss(s))); }
  get css(): { [prop: string]: string } { return logoCss(this.styleSubject.value); }

  get logoUrl(): string | null { return this.subject.value; }
  get style(): LogoStyle { return this.styleSubject.value; }
  get hasCustomLogo(): boolean { return !!this.subject.value; }

  ensureLoaded(): void {
    if (!this.started) { this.started = true; this.refresh(); }
  }

  /** Re-read the saved logo and style from the API. A failed request keeps what is already shown. */
  refresh(): void {
    this.started = true;
    this.api.getPublic().subscribe({ next: r => this.setBranding(r?.data?.logo_url || null, r?.data?.logo_style), error: () => { /* keep current */ } });
  }

  /** Use right after saving in Nexsuz Information: no extra request, every logo updates immediately. */
  setBranding(url: string | null, style?: LogoStyle | null): void {
    this.setLogo(url);
    if (style) { this.setStyle(style); }
  }

  setLogo(url: string | null): void {
    this.subject.next(url);
    try { url ? localStorage.setItem(CACHE_KEY, url) : localStorage.removeItem(CACHE_KEY); } catch { /* storage unavailable */ }
    this.syncFavicon(url);
  }

  setStyle(style: LogoStyle): void {
    this.styleSubject.next({ ...DEFAULT_LOGO_STYLE, ...style });
    try { localStorage.setItem(STYLE_KEY, JSON.stringify(style)); } catch { /* storage unavailable */ }
  }

  private syncFavicon(url: string | null): void {
    const link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
    if (!link) { return; }
    if (!this.originalIcon) { this.originalIcon = { href: link.getAttribute('href') || '', type: link.getAttribute('type') }; }
    if (url) { link.removeAttribute('type'); link.setAttribute('href', url); }
    else {
      link.setAttribute('href', this.originalIcon.href);
      this.originalIcon.type ? link.setAttribute('type', this.originalIcon.type) : link.removeAttribute('type');
    }
  }

  private static cached(key: string): string | null {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  private static cachedStyle(): Partial<LogoStyle> | null {
    try { return JSON.parse(localStorage.getItem(STYLE_KEY) || 'null'); } catch { return null; }
  }
}
