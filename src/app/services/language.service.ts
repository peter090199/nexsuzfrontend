import { Direction, Directionality } from '@angular/cdk/bidi';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { MissingTranslationHandler, MissingTranslationHandlerParams, TranslateLoader, TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, forkJoin, Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { _url } from 'src/global-variables';

export interface Language { code: string; name: string; native: string; rtl: boolean; }

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

    return forkJoin([...files, saved]).pipe(map(parts => Object.assign({}, ...parts)));
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
