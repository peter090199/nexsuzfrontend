import { Direction, Directionality } from '@angular/cdk/bidi';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { MissingTranslationHandler, MissingTranslationHandlerParams, TranslateLoader, TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, forkJoin, Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { _url } from 'src/global-variables';

export interface Language { code: string; name: string; native: string; rtl: boolean; countries?: string[]; }

export const FALLBACK_LANGUAGE = 'en-US';
/** what a visitor picked on this device (shared by tabs) */
const DEVICE = 'language';
/** per tab, so two people signed in side by side never overwrite each other */
const TAB = 'nx-lang';
export const DIRECTION_STORE = 'nx-dir';

/** which variant a browser asking for a bare language gets */
const PREFERRED: Record<string, string> = { en: 'en-US', fil: 'fil-PH', zh: 'zh-CN', es: 'es-ES', fr: 'fr-FR', pt: 'pt-BR' };

/**
 * The first of the browser's languages that is switched on here, or null.
 * Tagalog is Filipino; Traditional Chinese readers are never given Simplified.
 */
export function matchBrowserLanguage(wanted: readonly string[], available: string[]): string | null {
  const find = (code: string) => available.find(a => a.toLowerCase() === code.toLowerCase());
  for (const raw of wanted) {
    let [base] = raw.toLowerCase().split('-');
    if (base === 'tl') { base = 'fil'; }
    const traditional = base === 'zh' && /-(hant|tw|hk|mo)\b/i.test(raw);

    const hit = find(raw)
      || (traditional ? find('zh-TW') || find('zh-HK') : find(PREFERRED[base] || base))
      || find(base)
      || (traditional ? undefined : available.find(a => a.toLowerCase().split('-')[0] === base));
    if (hit) { return hit; }
  }

  return null;
}

/** countries that list another language, but where English is the better choice (HK, TW: never give Simplified) */
const ENGLISH_COUNTRIES = ['BZ', 'CA', 'CY', 'ER', 'FI', 'GG', 'GU', 'HK', 'IL', 'JE', 'MU', 'NA', 'RW', 'SC', 'SG', 'SX', 'TW', 'VU'];
/** countries with several languages, where the first in the list is not the one to start with */
const COUNTRY_LANGUAGE: Record<string, string> = { BE: 'nl', CH: 'de', LU: 'fr', MO: 'zh-HK' };

/** The language to show for a chosen country: one of the switched-on languages, else English. */
export function languageForCountry(country: string, languages: Language[]): string {
  const used = languages.filter(l => l.countries?.includes(country));
  const local = used.filter(l => !l.code.startsWith('en'));
  const own = local.find(l => l.code.endsWith(`-${country}`));
  if (own) { return own.code; }

  const chosen = languages.find(l => l.code === COUNTRY_LANGUAGE[country]);
  if (chosen) { return chosen.code; }

  return ENGLISH_COUNTRIES.includes(country) || !local.length ? FALLBACK_LANGUAGE : local[0].code;
}

/** drops database texts (web_db_) that a translated key already covers with the same English */
export function withoutCoveredContent(texts: Record<string, string>): Record<string, string> {
  const covered = new Set(Object.keys(texts).filter(k => !k.startsWith('web_db_')).map(k => texts[k]));

  return Object.fromEntries(Object.entries(texts).filter(([k, v]) => !k.startsWith('web_db_') || !covered.has(v)));
}

/**
 * The texts of one language: the files shipped in assets/i18n (base language, then the country variant) with the
 * administrator's saved texts on top. Anything missing falls back to English (the default language).
 */
export class NexsuzTranslateLoader implements TranslateLoader {
  constructor(private http: HttpClient) { }

  getTranslation(lang: string): Observable<Record<string, string>> {
    const codes = Array.from(new Set([lang.split('-')[0], lang]));
    const empty = () => of({} as Record<string, string>);
    const files = codes.map(c => this.http.get<Record<string, string>>(`./assets/i18n/${c}.json`).pipe(catchError(empty)));
    const saved = this.http.get<any>(`${_url}i18n/translations/${lang}`).pipe(map(r => (r?.data || {}) as Record<string, string>), catchError(empty));

    return forkJoin([...files, saved]).pipe(map(parts => withoutCoveredContent(Object.assign({}, ...parts))));
  }
}

/** keys the screens asked for that no language file defines; Language Setup lists them */
export const MISSING_KEYS = new Set<string>();

export class NexsuzMissingTranslationHandler implements MissingTranslationHandler {
  handle(params: MissingTranslationHandlerParams): string {
    // before the first file has arrived everything looks missing
    const loaded = params.translateService.translations?.[FALLBACK_LANGUAGE];
    if (loaded && Object.keys(loaded).length && !(params.key in loaded)) { MISSING_KEYS.add(params.key); }

    return params.key;
  }
}

@Injectable({ providedIn: 'root' })
export class LanguageService {
  readonly languages$ = new BehaviorSubject<Language[]>([{ code: FALLBACK_LANGUAGE, name: 'English (United States)', native: 'English', rtl: false }]);
  private started = false;
  /** true while no language has been picked: it is detected from the browser */
  automatic = true;
  /** only the newest resolution is applied (sign in and start-up can overlap) */
  private run = 0;

  constructor(private http: HttpClient, private translate: TranslateService, private directionality: Directionality) { }

  get current(): string { return this.translate.currentLang || FALLBACK_LANGUAGE; }

  get isStarted(): boolean { return this.started; }

  /** at start-up: show the last known language at once, then decide properly */
  init(): void {
    if (this.started) { return; }
    this.started = true;
    this.translate.setDefaultLang(FALLBACK_LANGUAGE);
    const known = sessionStorage.getItem(TAB) || (this.signedIn ? null : this.device());
    this.translate.use(known || FALLBACK_LANGUAGE);
    document.documentElement.lang = known || FALLBACK_LANGUAGE;
    this.resolve();
  }

  /**
   * Saved preference (the account's; for a visitor, their pick on this device), then the browser's language,
   * then the administrator's default, then English.
   */
  resolve(): void {
    const run = ++this.run;
    const config$ = this.http.get<any>(`${_url}i18n/config`);
    const saved$ = this.signedIn
      ? this.http.get<any>(`${_url}i18n/preference`, { headers: this.headers() }).pipe(map(r => r?.language || null), catchError(() => of(null)))
      : of(this.device());

    forkJoin({ config: config$, saved: saved$ }).subscribe({
      next: ({ config, saved }) => {
        if (run !== this.run || !config?.languages?.length) { return; }
        const languages: Language[] = config.languages;
        this.languages$.next(languages);
        const active = languages.map(l => l.code);
        this.automatic = !saved || !active.includes(saved);
        const code = [saved, matchBrowserLanguage(this.browserLanguages(), active), config.default]
          .find((c): c is string => !!c && active.includes(c)) || FALLBACK_LANGUAGE;
        this.apply(code);
      },
      error: () => { /* offline: keep what is showing */ }
    });
  }

  /** after sign in and after a refresh */
  restoreForUser(): void { this.resolve(); }

  /** the person picked a language */
  choose(code: string): void {
    if (code === 'auto') { this.detect(); return; }
    this.automatic = false;
    this.run++;      // a resolution still in flight must not undo this
    if (!this.signedIn) {
      this.store(localStorage, DEVICE, code);
      this.apply(code);
      return;
    }
    // saved first: switching reading direction reloads the page
    this.http.put(`${_url}i18n/preference`, { language: code }, { headers: this.headers() })
      .pipe(catchError(() => of(null)))
      .subscribe(() => this.apply(code));
  }

  /** the person picked a country: its language follows */
  chooseForCountry(country: string): void {
    const code = languageForCountry(country, this.languages$.value);
    // before the list has arrived only English is known: keep what is showing
    if (this.languages$.value.length > 1 && code !== this.current) { this.choose(code); }
  }

  /** "Automatic": forget the picked language and detect it from the browser again */
  private detect(): void {
    this.automatic = true;
    this.run++;
    sessionStorage.removeItem(TAB);
    if (!this.signedIn) {
      localStorage.removeItem(DEVICE);
      this.resolve();
      return;
    }
    this.http.put(`${_url}i18n/preference`, { language: 'auto' }, { headers: this.headers() })
      .pipe(catchError(() => of(null)))
      .subscribe(() => this.resolve());
  }

  browserLanguages(): readonly string[] { return navigator.languages?.length ? navigator.languages : [navigator.language || '']; }

  private apply(code: string): void {
    const direction = this.languages$.value.find(l => l.code === code)?.rtl ? 'rtl' : 'ltr';
    this.store(sessionStorage, TAB, code);
    document.documentElement.lang = code;
    if (this.translate.currentLang !== code) { this.translate.use(code); }

    this.setDirection(direction);
  }

  private setDirection(direction: Direction): void {
    this.store(sessionStorage, DIRECTION_STORE, direction);      // main.ts restores it before the next start
    if ((document.documentElement.dir || 'ltr') === direction) { return; }
    document.documentElement.dir = direction;
    // Angular Material only reads the direction at start-up: tell it, so no reload is needed
    (this.directionality as { value: Direction }).value = direction;
    this.directionality.change.emit(direction);
  }

  private get signedIn(): boolean { return !!sessionStorage.getItem('token'); }

  private device(): string | null {
    const code = localStorage.getItem(DEVICE);
    return code === 'en' ? FALLBACK_LANGUAGE : code;
  }

  private store(where: Storage, key: string, value: string): boolean {
    try { where.setItem(key, value); return true; } catch { return false; }
  }

  private headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${sessionStorage.getItem('token') || ''}` });
  }
}
