import { HttpClient } from '@angular/common/http';
import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { NexsuzTestingModule } from 'src/testing/nexsuz-testing.module';
import { _url } from 'src/global-variables';

import { LanguageService, languageForCountry, matchBrowserLanguage, NexsuzTranslateLoader, withoutCoveredContent } from './language.service';
import { MenuLabelPipe } from './menu-label.pipe';

describe('database texts', () => {
  it('are listed only when no existing key has the same English', () => {
    expect(withoutCoveredContent({ web_600: 'STARTER', web_db_a: 'STARTER', web_db_b: 'New feature' }))
      .toEqual({ web_600: 'STARTER', web_db_b: 'New feature' });
  });
});

describe('Language support', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [NexsuzTestingModule] });
    http = TestBed.inject(HttpTestingController);
    localStorage.removeItem('language');
    sessionStorage.removeItem('nx-dir'); sessionStorage.removeItem('nx-lang');
    sessionStorage.removeItem('token');
  });
  afterEach(() => { localStorage.removeItem('language'); sessionStorage.removeItem('nx-dir'); sessionStorage.removeItem('nx-lang'); document.documentElement.dir = 'ltr'; });

  it('merges the base file, the country file and the saved texts, and ignores what is missing', () => {
    let result: any;
    new NexsuzTranslateLoader(TestBed.inject(HttpClient)).getTranslation('fr-CA').subscribe(r => result = r);

    http.expectOne('./assets/i18n/fr.json').flush({ a: 'base', b: 'base', c: 'base' });
    http.expectOne('./assets/i18n/fr-CA.json').flush('', { status: 404, statusText: 'Not found' });
    http.expectOne(`${_url}i18n/translations/fr-CA`).flush({ data: { b: 'saved', c: 'variant' } });

    expect(result).toEqual({ a: 'base', b: 'saved', c: 'variant' });
  });

  it('shows a menu label as stored when there is no translation', () => {
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('fil-PH', { nav_job_vacancies: 'Mga Bakanteng Trabaho' });
    translate.use('fil-PH');
    const pipe = new MenuLabelPipe(translate);

    expect(pipe.transform('Job Vacancies')).toBe('Mga Bakanteng Trabaho');
    expect(pipe.transform('Something New')).toBe('Something New');
  });

  it('switches to right-to-left in place, and saves the signed-in person\'s choice first', () => {
    sessionStorage.setItem('token', 't');
    const service = TestBed.inject(LanguageService);
    service.languages$.next([{ code: 'ar', name: 'Arabic', native: 'العربية', rtl: true }]);
    document.documentElement.dir = 'ltr';

    service.choose('ar');
    expect(document.documentElement.dir).toBe('ltr');          // not before it is saved
    const save = http.expectOne(`${_url}i18n/preference`);
    expect(save.request.body).toEqual({ language: 'ar' });
    save.flush({ success: true });

    expect(sessionStorage.getItem('nx-lang')).toBe('ar');
    expect(sessionStorage.getItem('nx-dir')).toBe('rtl');
    expect(localStorage.getItem('language')).toBeNull();       // not shared with other tabs
    expect(document.documentElement.dir).toBe('rtl');
    sessionStorage.removeItem('token');
  });

  it('matches the browser language to an active one', () => {
    const active = ['en-US', 'fil-PH', 'zh-CN', 'es-ES', 'es-MX'];
    expect(matchBrowserLanguage(['es-MX'], active)).toBe('es-MX');
    expect(matchBrowserLanguage(['en-AU'], active)).toBe('en-US');
    expect(matchBrowserLanguage(['tl-PH'], active)).toBe('fil-PH');
    expect(matchBrowserLanguage(['de-DE', 'zh'], active)).toBe('zh-CN');
    expect(matchBrowserLanguage(['zh-TW'], active)).toBeNull();          // never Simplified for a Traditional reader
    expect(matchBrowserLanguage(['de-DE'], active)).toBeNull();
  });

  describe('which language wins', () => {
    const config = { default: 'zh-CN', languages: ['en-US', 'fil-PH', 'zh-CN', 'es-ES'].map(code => ({ code, name: code, native: '', rtl: false })) };

    function resolveWith(saved: string | null, browser: string[]): string {
      sessionStorage.setItem('token', 't');
      const service = TestBed.inject(LanguageService);
      spyOn(service, 'browserLanguages').and.returnValue(browser);
      const use = spyOn(TestBed.inject(TranslateService), 'use').and.callThrough();
      document.documentElement.dir = 'ltr';

      service.resolve();
      http.expectOne(`${_url}i18n/config`).flush(config);
      http.expectOne(`${_url}i18n/preference`).flush({ success: true, language: saved });
      sessionStorage.removeItem('token');

      return use.calls.mostRecent().args[0];
    }

    it('the saved preference', () => expect(resolveWith('fil-PH', ['es-ES'])).toBe('fil-PH'));
    it('else the browser language', () => expect(resolveWith(null, ['es-ES'])).toBe('es-ES'));
    it('else the system default', () => expect(resolveWith(null, ['de-DE'])).toBe('zh-CN'));
  });
});

describe('languageForCountry', () => {
  const lang = (code: string, countries: string[]) => ({ code, name: code, native: '', rtl: false, countries });
  const languages = [lang('zh-CN', ['CN']), lang('en-US', ['US']), lang('fil-PH', ['PH']), lang('ar', ['IL', 'SA']), lang('es', ['ES', 'MX'])];

  it('gives the country its switched-on language', () => {
    expect(['CN', 'PH', 'SA', 'MX', 'US'].map(c => languageForCountry(c, languages))).toEqual(['zh-CN', 'fil-PH', 'ar', 'es', 'en-US']);
  });

  it('picks sensibly where a country has several languages', () => {
    const several = [lang('fr', ['CH', 'CA', 'FR']), lang('de', ['CH', 'DE']), lang('sv', ['FI', 'SE'])];

    expect(['CH', 'FR', 'CA', 'FI', 'SE'].map(c => languageForCountry(c, several))).toEqual(['de', 'fr', 'en-US', 'en-US', 'sv']);
  });

  it('else English', () => {
    expect(['FR', 'IL', 'TW', ''].map(c => languageForCountry(c, languages))).toEqual(['en-US', 'en-US', 'en-US', 'en-US']);
  });
});

describe('Automatic language', () => {
  beforeEach(() => { sessionStorage.clear(); localStorage.clear(); TestBed.configureTestingModule({ imports: [NexsuzTestingModule] }); });
  afterEach(() => { sessionStorage.clear(); localStorage.clear(); });

  it('forgets the picked language and follows the browser again', () => {
    const service = TestBed.inject(LanguageService);
    const http = TestBed.inject(HttpTestingController);
    spyOn(service, 'browserLanguages').and.returnValue(['ja-JP']);
    localStorage.setItem('language', 'fil-PH');
    const config = { default: 'en-US', languages: ['en-US', 'fil-PH', 'ja'].map(code => ({ code, name: code, native: '', rtl: false })) };

    service.choose('auto');
    http.expectOne(`${_url}i18n/config`).flush(config);

    expect(localStorage.getItem('language')).toBeNull();
    expect(service.automatic).toBeTrue();
    expect(sessionStorage.getItem('nx-lang')).toBe('ja');
  });
});
