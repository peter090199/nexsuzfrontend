import { Injectable, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';
import { NotificationPrefsService } from './notification-prefs.service';

export interface NavSwatch { name: string; color: string | null; }

/**
 * The colour of the navigation bars (the top bar and the client sidebar's top bar).
 *
 * The choice is an account setting (saved with the user's other settings, so it follows them to any device and
 * survives logging out). This service turns it into three CSS variables on <html> plus a class, which the shared
 * stylesheet uses for every nav bar: change the colour once and every bar changes, with no refresh.
 *
 *   --nx-nav-bg    the colour
 *   --nx-nav-fg    white or near-black, whichever stays readable on it
 *   --nx-nav-soft  a gentle tint for search boxes and hover areas on top of it
 *
 * With no colour chosen the class and variables are removed and the bars look exactly as they always did.
 */
@Injectable({ providedIn: 'root' })
export class NavThemeService implements OnDestroy {
  readonly swatches: NavSwatch[] = [
    { name: 'Standard', color: null },
    { name: 'NEXSUZ navy', color: '#0863be' },
    { name: 'Blue', color: '#0a66c2' },
    { name: 'Green', color: '#1b8a4b' },
    { name: 'Purple', color: '#6a1b9a' },
    { name: 'Red', color: '#c62828' },
    { name: 'Amber', color: '#e08a00' },
    { name: 'Slate', color: '#37474f' },
    { name: 'Black', color: '#111111' },
    { name: 'White', color: '#ffffff' },
  ];

  private sub: Subscription;

  constructor(private prefs: NotificationPrefsService) {
    this.sub = this.prefs.prefs$.pipe(map(p => p.nav_color), distinctUntilChanged()).subscribe(c => this.apply(c));
  }

  ngOnDestroy(): void { this.sub.unsubscribe(); }

  get color(): string | null { return this.prefs.prefs.nav_color; }

  /** Choose a colour (applies at once, saved to the account); null = the standard look */
  set(color: string | null): void {
    if (color !== null && !/^#[0-9a-fA-F]{6}$/.test(color)) { return; }
    this.prefs.update({ nav_color: color === null ? null : color.toLowerCase() });
  }

  reset(): void { this.set(null); }

  /** Text colour that stays readable on a background (WCAG relative luminance) */
  static readableOn(hex: string): '#ffffff' | '#111111' {
    const m = /^#([0-9a-f]{6})$/i.exec(hex);
    if (!m) { return '#ffffff'; }
    const n = parseInt(m[1], 16);
    const lin = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
    return L > 0.5 ? '#111111' : '#ffffff';
  }

  private apply(color: string | null): void {
    const root = document.documentElement;
    if (!color) {
      root.classList.remove('nx-custom-nav');
      ['--nx-nav-bg', '--nx-nav-fg', '--nx-nav-soft'].forEach(v => root.style.removeProperty(v));
      return;
    }
    const fg = NavThemeService.readableOn(color);
    root.style.setProperty('--nx-nav-bg', color);
    root.style.setProperty('--nx-nav-fg', fg);
    root.style.setProperty('--nx-nav-soft', fg === '#ffffff' ? 'rgba(255, 255, 255, .18)' : 'rgba(0, 0, 0, .07)');
    root.classList.add('nx-custom-nav');
  }
}
