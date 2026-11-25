import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { shareReplay, timeout } from 'rxjs/operators';
import { _url } from 'src/global-variables';

/** Email theme: one saved choice that styles every Nexsuz email (server side Blade layout). */
export interface EmailGradient { enabled: boolean; from: string; to: string; angle: number; }
export interface EmailTheme { preset: string; colors: { [key: string]: string }; header_gradient: EmailGradient; footer_gradient: EmailGradient; }
export interface EmailPreset { label: string; colors: { [key: string]: string }; header_gradient: EmailGradient; footer_gradient: EmailGradient; }
export const EMAIL_COLOR_GROUPS: { title: string; icon: string; fields: { key: string; label: string }[] }[] = [
  { title: 'Header', icon: 'web_asset', fields: [{ key: 'header_bg', label: 'Header background' }, { key: 'header_text', label: 'Header text' }] },
  { title: 'Body and content', icon: 'article', fields: [{ key: 'body_bg', label: 'Body background' }, { key: 'card_bg', label: 'Content / card background' }, { key: 'text', label: 'Content text' }] },
  { title: 'Footer', icon: 'call_to_action', fields: [{ key: 'footer_bg', label: 'Footer background' }, { key: 'footer_text', label: 'Footer text' }] },
  { title: 'Brand', icon: 'palette', fields: [{ key: 'primary', label: 'Primary brand color' }, { key: 'secondary', label: 'Secondary brand color' }] },
  { title: 'Buttons and links', icon: 'smart_button', fields: [{ key: 'button_bg', label: 'Button background' }, { key: 'button_text', label: 'Button text' }, { key: 'link', label: 'Link color' }] },
  { title: 'Lines', icon: 'horizontal_rule', fields: [{ key: 'border', label: 'Border color' }, { key: 'divider', label: 'Divider color' }] },
];
function luminance(hex: string): number {
  const n = parseInt(hex.replace('#', ''), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
/** WCAG contrast ratio between two #rrggbb colors (null when either is not a valid color). */
export function contrastRatio(a: string, b: string): number | null {
  const ok = /^#[0-9a-fA-F]{6}$/;
  if (!ok.test(a) || !ok.test(b)) { return null; }
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

export interface OtherLink { label: string; url: string; }

/** How the logo container looks. The uploaded image itself is never changed. */
export type LogoBgMode = 'transparent' | 'white' | 'navy' | 'color' | 'gradient';
export interface LogoStyle {
  bg_mode: LogoBgMode; bg_color: string; gradient_from: string; gradient_to: string; gradient_angle: number;
  padding: number; radius: number; width: number | null; height: number | null; align: 'left' | 'center' | 'right';
}
export const DEFAULT_LOGO_STYLE: LogoStyle = {
  bg_mode: 'white', bg_color: '#ffffff', gradient_from: '#0a66c2', gradient_to: '#002a57', gradient_angle: 135,
  padding: 4, radius: 8, width: null, height: null, align: 'left',
};
export const NAVY = '#002a57';

/** The ONE place a LogoStyle becomes CSS. Used by the real logos and by the live previews, so they always match. */
export function logoCss(s: LogoStyle | null | undefined): { [prop: string]: string } {
  const v = { ...DEFAULT_LOGO_STYLE, ...(s || {}) };
  const bg = v.bg_mode === 'transparent' ? 'transparent' : v.bg_mode === 'white' ? '#ffffff' : v.bg_mode === 'navy' ? NAVY
    : v.bg_mode === 'color' ? v.bg_color : `linear-gradient(${v.gradient_angle}deg, ${v.gradient_from}, ${v.gradient_to})`;
  const css: { [prop: string]: string } = {
    'background': bg, 'padding': `${v.padding}px`, 'border-radius': `${v.radius}px`,
    'margin-left': v.align === 'left' ? '0' : 'auto', 'margin-right': v.align === 'right' ? '0' : 'auto',
  };
  if (v.width) { css['max-width'] = `${v.width}px`; }
  if (v.height) { css['max-height'] = `${v.height}px`; }
  return css;
}

/** The one business record, as the admin pages edit it. */
export interface BusinessInfo {
  business_name: string; registered_name: string; tagline: string; description: string; business_type: string;
  registration_type: string; registration_number: string; established_on: string;
  country: string; region: string; province: string; city: string; barangay: string; street: string; building: string; unit: string;
  zip_code: string; formatted_address: string; maps_url: string;
  phone_primary: string; phone_alt: string; email_official: string; email_support: string; website_url: string; customer_service: string; operating_hours: string;
  facebook: string; instagram: string; linkedin: string; youtube: string; twitter: string; tiktok: string; other_links: OtherLink[];
  contact_heading: string; contact_description: string; contact_recipient_email: string;
  show_address: boolean; show_phone: boolean; show_email: boolean; show_hours: boolean; show_socials: boolean;
  logo_url: string | null; logo_style: LogoStyle; email_theme: EmailTheme; email_presets: { [id: string]: EmailPreset }; computed_address: string; saved: boolean;
}

/** What the public website Contact section receives (only fields the display switches allow). */
export interface PublicBusinessInfo {
  business_name: string; tagline: string; logo_url: string | null; logo_style: LogoStyle; contact_heading: string; contact_description: string;
  address: string | null; maps_url: string | null; phone_primary: string | null; phone_alt: string | null; email: string | null;
  website_url: string | null; operating_hours: string | null; social: { [network: string]: string }; other_links: OtherLink[];
}

/** Sender setup for the website inbox. Built from .env on the server; the password is never sent, only whether one exists. */
export interface ContactMailStatus {
  configured: boolean; ready: boolean; missing: string[]; provider: string | null; host: string | null; port: number | null; encryption: string | null;
  username: string | null; has_password: boolean; from_address: string | null; recipient: string | null; recipient_problem: 'missing' | 'invalid' | null; warnings: string[];
}

export interface ContactMessage { fullName: string; email: string; phone: string; subject: string; message: string; }

export const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
export const LOGO_MAX_BYTES = 2 * 1024 * 1024;

@Injectable({ providedIn: 'root' })
export class BusinessInfoService {
  private base = `${_url}business-info`;

  constructor(private http: HttpClient) { }

  private get opts() {
    return { headers: new HttpHeaders({ Authorization: `Bearer ${sessionStorage.getItem('token') || ''}` }) };
  }

  static errorMessage(err: any, fallback = 'Something went wrong. Please try again.'): string {
    const e = err?.error;
    if (e?.errors) { const first = Object.values(e.errors)[0] as string[]; if (first?.length) { return first[0]; } }
    if (err?.name === 'TimeoutError') { return 'The server took too long to answer. Please try again.'; }
    if (err?.status === 0) { return 'Cannot reach the server. Check that the backend is running and your network connection.'; }
    if (err?.status === 403) { return 'You do not have access to manage the business information.'; }
    if (err?.status === 429) { return 'Too many requests. Please wait a minute and try again.'; }
    return e?.message || fallback;
  }

  /** Client-side check that mirrors the server rules, so a bad file is refused before any upload. */
  static logoProblem(file: File): string | null {
    if (!LOGO_TYPES.includes(file.type)) { return 'The logo must be a PNG, JPG, JPEG, WEBP or SVG file.'; }
    if (file.size > LOGO_MAX_BYTES) { return 'The logo must be 2 MB or smaller.'; }
    return null;
  }

  get(): Observable<{ success: boolean; data: BusinessInfo }> { return this.http.get<any>(this.base, this.opts).pipe(timeout(20000)); }
  save(body: Partial<BusinessInfo>): Observable<{ success: boolean; message: string; data: BusinessInfo }> { return this.http.put<any>(this.base, body, this.opts).pipe(timeout(30000)); }
  reset(): Observable<{ success: boolean; message: string; data: BusinessInfo }> { return this.http.post<any>(`${this.base}/reset`, {}, this.opts).pipe(timeout(30000)); }
  uploadLogo(file: File): Observable<{ success: boolean; message: string; data: BusinessInfo }> {
    const fd = new FormData(); fd.append('logo', file);
    return this.http.post<any>(`${this.base}/logo`, fd, this.opts).pipe(timeout(60000));
  }
  removeLogo(): Observable<{ success: boolean; message: string; data: BusinessInfo }> { return this.http.delete<any>(`${this.base}/logo`, this.opts).pipe(timeout(30000)); }

  previewEmailTheme(theme: EmailTheme, businessName: string): Observable<{ success: boolean; html: string }> {
    return this.http.post<any>(`${this.base}/email-theme/preview`, { email_theme: theme, business_name: businessName }, this.opts).pipe(timeout(20000));
  }
  testEmailTheme(): Observable<{ success: boolean; message: string }> { return this.http.post<any>(`${this.base}/email-theme/test`, {}, this.opts).pipe(timeout(60000)); }
  contactMail(): Observable<{ success: boolean; data: ContactMailStatus }> { return this.http.get<any>(`${this.base}/contact-mail`, this.opts).pipe(timeout(20000)); }
  checkContactMail(): Observable<{ success: boolean; message: string; data: ContactMailStatus }> { return this.http.post<any>(`${this.base}/contact-mail/check`, {}, this.opts).pipe(timeout(45000)); }
  testContactMail(): Observable<{ success: boolean; message: string; data: ContactMailStatus }> { return this.http.post<any>(`${this.base}/contact-mail/test`, {}, this.opts).pipe(timeout(60000)); }

  /** Public (no login). Always fresh: a visitor must see the latest saved data, never a stale copy. */
  getPublic(): Observable<{ success: boolean; data: PublicBusinessInfo }> { return this.http.get<any>(`${this.base}/public`).pipe(timeout(15000)); }
  sendContact(body: ContactMessage): Observable<{ success: boolean; message: string }> { return this.http.post<any>(`${_url}contact-message`, body).pipe(timeout(30000)); }
}
