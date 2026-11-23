import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface AppearancePrefs {
  /** page background colour, #rrggbb. null = the standard NEXSUZ background */
  bgColor: string | null;
  /** key of FONT_OPTIONS. 'verdana' = the standard font */
  fontKey: string;
  /** base text size in px (14 = standard) */
  fontSize: number;
}

export interface FontOption { key: string; label: string; stack: string; }

export const FONT_OPTIONS: FontOption[] = [
  { key: 'verdana', label: 'Verdana (standard)', stack: 'Verdana, Geneva, Tahoma, sans-serif' },
  { key: 'arial', label: 'Arial', stack: 'Arial, Helvetica, sans-serif' },
  { key: 'tahoma', label: 'Tahoma', stack: 'Tahoma, Geneva, Verdana, sans-serif' },
  { key: 'trebuchet', label: 'Trebuchet MS', stack: '"Trebuchet MS", Helvetica, sans-serif' },
  { key: 'segoe', label: 'Segoe UI', stack: '"Segoe UI", Tahoma, Geneva, sans-serif' },
  { key: 'georgia', label: 'Georgia', stack: 'Georgia, "Times New Roman", serif' },
  { key: 'times', label: 'Times New Roman', stack: '"Times New Roman", Times, serif' },
  { key: 'courier', label: 'Courier New', stack: '"Courier New", Courier, monospace' },
];

export const FONT_SIZE_MIN = 12;
export const FONT_SIZE_MAX = 20;
export const DEFAULT_APPEARANCE: AppearancePrefs = { bgColor: null, fontKey: 'verdana', fontSize: 14 };

/**
 * Page background colour, font family and text size, applied to every component at once.
 *
 * It turns the saved choice into CSS variables on <html> plus a class; the shared stylesheet
 * (styles/nexsuz-design-system.scss) reads them, so there is nothing to wire up per component and no refresh
 * is needed. Saved in this browser (localStorage); with nothing saved the app looks exactly as it always did.
 *
 *   --nx-user-font   font stack (also overrides --nx-font)
 *   --nx-user-zoom   text size / 14, scales the page content
 *   --nx-user-bg     page background colour (also overrides --nx-bg); light colours only
 */
@Injectable({ providedIn: 'root' })
export class AppearanceService {
  private static readonly KEY = 'nexsuz_appearance';

  readonly fonts = FONT_OPTIONS;
  readonly swatches: { name: string; color: string | null }[] = [
    { name: 'Standard', color: null },
    { name: 'White', color: '#ffffff' },
    { name: 'Soft blue', color: '#e8f1fb' },
    { name: 'Mint', color: '#e6f5ee' },
    { name: 'Lavender', color: '#efeafa' },
    { name: 'Peach', color: '#fdeee3' },
    { name: 'Sand', color: '#f6f1e7' },
    { name: 'Light grey', color: '#eceff3' },
    { name: 'Light yellow', color: '#fff8dc' },
  ];

  private readonly subject = new BehaviorSubject<AppearancePrefs>(this.read());
  readonly prefs$ = this.subject.asObservable();

  /** Call once at app start */
  init(): void {
    this.apply(this.subject.value);
  }

  get prefs(): AppearancePrefs { return this.subject.value; }

  get isCustom(): boolean {
    const p = this.subject.value;
    return p.bgColor !== null || p.fontKey !== DEFAULT_APPEARANCE.fontKey || p.fontSize !== DEFAULT_APPEARANCE.fontSize;
  }

  /** Save and apply to the whole app */
  save(next: AppearancePrefs): void {
    const clean = AppearanceService.sanitize(next);
    this.subject.next(clean);
    this.apply(clean);
    try {
      if (JSON.stringify(clean) === JSON.stringify(DEFAULT_APPEARANCE)) {
        localStorage.removeItem(AppearanceService.KEY);
      } else {
        localStorage.setItem(AppearanceService.KEY, JSON.stringify(clean));
      }
    } catch { /* storage blocked: the choice still applies for this visit */ }
  }

  reset(): void { this.save({ ...DEFAULT_APPEARANCE }); }

  stackOf(key: string): string {
    return (FONT_OPTIONS.find(f => f.key === key) || FONT_OPTIONS[0]).stack;
  }

  /**
   * Only light backgrounds are allowed: the app's dark text sits directly on this colour in many places and
   * many components inherit text colour, so a dark background would make text unreadable.
   */
  static isLight(hex: string | null): boolean {
    const m = hex ? /^#([0-9a-f]{6})$/i.exec(hex) : null;
    if (!m) { return false; }
    const n = parseInt(m[1], 16);
    const lin = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
    return L > 0.6;
  }

  static sanitize(p: Partial<AppearancePrefs> | null | undefined): AppearancePrefs {
    const bg = p?.bgColor && /^#[0-9a-fA-F]{6}$/.test(p.bgColor) && AppearanceService.isLight(p.bgColor)
      ? p.bgColor.toLowerCase() : null;
    const font = FONT_OPTIONS.some(f => f.key === p?.fontKey) ? (p!.fontKey as string) : DEFAULT_APPEARANCE.fontKey;
    const size = Math.round(Number(p?.fontSize));
    return {
      bgColor: bg,
      fontKey: font,
      fontSize: isFinite(size) ? Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, size)) : DEFAULT_APPEARANCE.fontSize
    };
  }

  private read(): AppearancePrefs {
    try {
      const raw = localStorage.getItem(AppearanceService.KEY);
      return raw ? AppearanceService.sanitize(JSON.parse(raw)) : { ...DEFAULT_APPEARANCE };
    } catch {
      return { ...DEFAULT_APPEARANCE };
    }
  }

  private apply(p: AppearancePrefs): void {
    const root = document.documentElement;
    const set = (k: string, v: string) => root.style.setProperty(k, v);
    const clear = (...ks: string[]) => ks.forEach(k => root.style.removeProperty(k));

    // font family
    if (p.fontKey !== DEFAULT_APPEARANCE.fontKey) {
      const stack = this.stackOf(p.fontKey);
      set('--nx-user-font', stack);
      set('--nx-font', stack);
    } else {
      clear('--nx-user-font', '--nx-font');
    }

    // text size
    if (p.fontSize !== DEFAULT_APPEARANCE.fontSize) {
      set('--nx-user-zoom', String(p.fontSize / DEFAULT_APPEARANCE.fontSize));
    } else {
      clear('--nx-user-zoom');
    }

    // background colour
    if (p.bgColor) {
      set('--nx-user-bg', p.bgColor);
      set('--nx-bg', p.bgColor);
    } else {
      clear('--nx-user-bg', '--nx-bg');
    }

    root.classList.toggle('nx-custom-font', p.fontKey !== DEFAULT_APPEARANCE.fontKey);
    root.classList.toggle('nx-custom-size', p.fontSize !== DEFAULT_APPEARANCE.fontSize);
    root.classList.toggle('nx-custom-bg', !!p.bgColor);
  }
}
