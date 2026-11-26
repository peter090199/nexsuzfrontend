import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { NotificationsService } from 'src/app/services/Global/notifications.service';
import { LanguageService, MISSING_KEYS, NexsuzTranslateLoader } from 'src/app/services/language.service';
import { _url } from 'src/global-variables';

interface Country { code: string; code3: string; name: string; dial: string; active: boolean; }
interface Lang { code: string; name: string; native: string; rtl: boolean; countries: string[]; active: boolean; is_default: boolean; }
interface Person { id: number; name: string; email: string; role_code: string; language: string | null; }
interface Row { key: string; english: string; value: string; saved: string; missing: boolean; edited: boolean; }

const PAGE = 50;

/** DEF-MASTERADMIN: countries, languages and translations. Countries and languages are two separate lists. */
@Component({
  selector: 'app-language-setup',
  templateUrl: './language-setup.component.html',
  styleUrls: ['./language-setup.component.css']
})
export class LanguageSetupComponent implements OnInit {
  loading = true;
  failed = false;
  countries: Country[] = [];
  languages: Lang[] = [];

  countrySearch = '';
  countryLimit = PAGE;

  languageSearch = '';
  languageCountry = '';
  activeOnly = false;
  languageLimit = PAGE;
  /** the add / edit form; null when closed */
  form: { code: string; name: string; native: string; rtl: boolean; countries: string[]; isNew: boolean } | null = null;

  locale = 'fil-PH';
  rows: Row[] = [];
  rowSearch = '';
  missingOnly = false;
  loadingRows = false;
  saving = false;

  people: Person[] = [];
  peopleSearch = '';
  peoplePage = 1;
  peopleLastPage = 1;
  loadingPeople = false;

  /** keys screens asked for during this visit that no language file defines */
  get missingKeys(): string[] { return Array.from(MISSING_KEYS).sort(); }

  constructor(private http: HttpClient, private alert: NotificationsService, private translate: TranslateService,
    private languageService: LanguageService) { }

  ngOnInit(): void {
    this.load();
    this.loadRows();
    this.loadPeople(1);
  }

  // ------------------------------------------------------------------ users
  loadPeople(page: number): void {
    this.loadingPeople = true;
    const search = this.peopleSearch.trim();
    this.http.get<any>(`${_url}i18n/users`, { headers: this.headers(), params: { page: String(page), search } }).subscribe({
      next: res => {
        if (search !== this.peopleSearch.trim()) { return; }        // an older search answered late
        this.people = res.data;
        this.peoplePage = res.current_page;
        this.peopleLastPage = res.last_page;
        this.loadingPeople = false;
      },
      error: () => { this.loadingPeople = false; this.alert.toastrError('Could not load the users.'); }
    });
  }

  setPersonLanguage(p: Person, code: string): void {
    const before = p.language;
    p.language = code || null;
    this.send('put', `users/${p.id}`, { language: p.language }, () => { }, () => p.language = before);
  }

  load(): void {
    this.loading = true;
    this.failed = false;
    this.http.get<any>(`${_url}i18n/admin`, { headers: this.headers() }).subscribe({
      next: res => { this.countries = res.countries; this.languages = res.languages; this.loading = false; },
      error: () => { this.failed = true; this.loading = false; }
    });
  }

  // ------------------------------------------------------------------ countries
  get filteredCountries(): Country[] {
    const q = this.countrySearch.trim().toLowerCase();
    return !q ? this.countries : this.countries.filter(c => `${c.name} ${c.code} ${c.code3} ${c.dial}`.toLowerCase().includes(q));
  }

  toggleCountry(c: Country, active: boolean): void {
    this.send('put', `countries/${c.code}`, { active }, () => c.active = active, () => c.active = !active);
    c.active = active;
  }

  // ------------------------------------------------------------------ languages
  get filteredLanguages(): Lang[] {
    const q = this.languageSearch.trim().toLowerCase();
    return this.languages.filter(l => (!this.activeOnly || l.active)
      && (!this.languageCountry || l.countries.includes(this.languageCountry))
      && (!q || `${l.name} ${l.native} ${l.code}`.toLowerCase().includes(q)));
  }

  countryNames(codes: string[]): string {
    const names = codes.map(code => this.countries.find(c => c.code === code)?.name || code);
    return names.length > 4 ? `${names.slice(0, 4).join(', ')} +${names.length - 4}` : names.join(', ');
  }

  setActive(l: Lang, active: boolean): void {
    this.send('put', `languages/${l.code}`, { active }, () => { l.active = active; this.languageService.resolve(); }, () => this.load());
  }

  makeDefault(l: Lang): void {
    this.send('put', `languages/${l.code}`, { is_default: true }, () => this.languages.forEach(x => x.is_default = x.code === l.code));
  }

  openForm(l?: Lang): void {
    this.form = l ? { code: l.code, name: l.name, native: l.native, rtl: l.rtl, countries: [...l.countries], isNew: false }
      : { code: '', name: '', native: '', rtl: false, countries: [], isNew: true };
  }

  saveForm(): void {
    const f = this.form;
    if (!f || !f.code.trim() || !f.name.trim()) { return; }
    const { isNew, ...body } = f;
    if (isNew && this.languages.some(l => l.code.toLowerCase() === f.code.trim().toLowerCase())) {
      this.alert.toastrWarning('That language code already exists.');
      return;
    }
    this.send('post', 'languages', { ...body, code: f.code.trim() }, () => { this.form = null; this.load(); this.languageService.resolve(); });
  }

  // ------------------------------------------------------------------ translations
  get activeLanguages(): Lang[] { return this.languages.filter(l => l.active && l.code !== 'en-US'); }

  /** every key of the English file, with what this language shows for it today */
  loadRows(): void {
    this.loadingRows = true;
    const loader = new NexsuzTranslateLoader(this.http);
    const code = this.locale;
    forkJoin({
      english: loader.getTranslation('en-US'),
      current: loader.getTranslation(code),
      saved: this.http.get<any>(`${_url}i18n/translations/${code}`).pipe(catchError(() => of({ data: {} })))
    }).subscribe(({ english, current, saved }) => {
      if (code !== this.locale) { return; }        // another language was picked meanwhile
      this.rows = Object.keys(english).sort().map(key => ({
        key, english: english[key], value: current[key] ?? '', saved: current[key] ?? '',
        missing: !current[key], edited: !!saved?.data?.[key]
      }));
      this.loadingRows = false;
    });
  }

  get missingCount(): number { return this.rows.filter(r => r.missing).length; }
  get changed(): Row[] { return this.rows.filter(r => r.value !== r.saved); }

  get filteredRows(): Row[] {
    const q = this.rowSearch.trim().toLowerCase();
    return this.rows.filter(r => (!this.missingOnly || r.missing) && (!q || `${r.key} ${r.english} ${r.value}`.toLowerCase().includes(q)));
  }

  saveRows(): void {
    const values: Record<string, string> = {};
    this.changed.forEach(r => values[r.key] = r.value);
    if (!Object.keys(values).length) { return; }
    this.saving = true;
    this.send('put', `translations/${this.locale}`, { values }, () => {
      this.saving = false;
      this.loadRows();
      this.translate.reloadLang(this.locale).subscribe(() => {
        if (this.translate.currentLang === this.locale) { this.translate.use(this.locale); }
      });
    }, () => this.saving = false);
  }

  trackCode(_: number, x: { code: string }): string { return x.code; }
  trackKey(_: number, x: Row): string { return x.key; }

  private send(method: 'put' | 'post', path: string, body: any, done: () => void, failed?: () => void): void {
    this.http.request<any>(method, `${_url}i18n/${path}`, { body, headers: this.headers() }).subscribe({
      next: res => { done(); this.alert.toastrSuccess(res?.message || 'Saved.'); },
      error: err => { failed?.(); this.alert.toastrError(err?.error?.message || 'Could not save.'); }
    });
  }

  private headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${sessionStorage.getItem('token') || ''}` });
  }
}
