import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { _url } from 'src/global-variables';

export interface CountryOption { code: string; code3: string; name: string; }

const STORE = 'country';

/** The region the browser says it is set to (en-PH -> PH), or ''. No location lookup is made. */
export function suggestedCountry(languages: readonly string[]): string {
  for (const tag of languages) {
    const region = tag.split('-').slice(1).find(part => /^[A-Za-z]{2}$/.test(part));
    if (region) { return region.toUpperCase(); }
  }

  return '';
}

/** Country choice with flags. Separate from the language: choosing a country never changes the language. */
@Component({
  selector: 'app-country-picker',
  template: `
<button mat-button type="button" class="cp-btn" [matMenuTriggerFor]="menu" (menuOpened)="load()" data-no-translate
  [attr.aria-label]="'ls_choose_country' | translate">
  <img *ngIf="selected; else globe" class="flag" [src]="flag(selected)" alt="" (error)="$any($event.target).style.visibility = 'hidden'">
  <ng-template #globe><mat-icon>public</mat-icon></ng-template>
  <span>{{ selected || '—' }}</span>
</button>
<mat-menu #menu="matMenu" class="cp-menu">
  <div class="cp-panel" data-no-translate (click)="$event.stopPropagation()" (keydown)="$event.stopPropagation()">
    <input type="search" [(ngModel)]="search" [placeholder]="'ls_search' | translate" [attr.aria-label]="'ls_choose_country' | translate">
    <button type="button" class="cp-row suggested" *ngIf="suggestion && suggestion !== selected && !search" (click)="choose(suggestion)">
      <img class="flag" [src]="flag(suggestion)" alt=""><span>{{ name(suggestion) }}</span><small>{{ 'ls_suggested' | translate }}</small>
    </button>
    <div class="cp-list">
      <button type="button" class="cp-row" *ngFor="let c of filtered; trackBy: trackCode" (click)="choose(c.code)"
        [class.on]="c.code === selected" [attr.aria-current]="c.code === selected">
        <img class="flag" [src]="flag(c.code)" alt="" loading="lazy" (error)="$any($event.target).style.visibility = 'hidden'">
        <span>{{ name(c.code) }}</span><small dir="ltr">{{ c.code }} · {{ c.code3 }}</small>
      </button>
      <p class="cp-none" *ngIf="countries.length && !filtered.length">{{ 'ls_nothing' | translate }}</p>
      <button type="button" class="cp-row" *ngIf="failed" (click)="load()">{{ 'ls_retry' | translate }}</button>
    </div>
  </div>
</mat-menu>
`,
  styles: [`
    .cp-btn { min-width: 0; padding: 0 8px; }
    .cp-btn span { margin-left: 4px; font-size: 12px; font-weight: 700; }
    .flag { width: 22px; height: 15px; object-fit: cover; border-radius: 2px; box-shadow: 0 0 0 1px rgba(0,0,0,.12); flex: none; vertical-align: middle; }
    .cp-panel { width: 280px; max-width: 80vw; padding: 0 8px; }
    input { width: 100%; box-sizing: border-box; height: 36px; padding: 0 10px; border: 1px solid #cfd9e8; border-radius: 8px; font: inherit; font-size: 13px; }
    .cp-list { max-height: 260px; overflow-y: auto; margin-top: 6px; }
    .cp-row { display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px 6px; border: 0; background: transparent; cursor: pointer; font: inherit; font-size: 13px; text-align: start; }
    .cp-row:hover, .cp-row.on { background: #eaf3fc; }
    .cp-row span { flex: 1; min-width: 0; } .cp-row small { color: #8a97b0; font-size: 11px; }
    .cp-row.suggested { border-bottom: 1px solid #e3eaf4; margin-top: 4px; }
    .cp-none { text-align: center; color: #6b7a99; font-size: 12px; }
  `]
})
export class CountryPickerComponent implements OnInit {
  countries: CountryOption[] = [];
  search = '';
  selected = '';
  suggestion = '';
  failed = false;
  private names: { lang: string; of: (code: string) => string | undefined } | null = null;

  constructor(private http: HttpClient, private translate: TranslateService) { }

  ngOnInit(): void {
    this.suggestion = suggestedCountry(this.browserLanguages());
    this.selected = localStorage.getItem(STORE) || '';
    if (this.signedIn) {
      this.http.get<any>(`${_url}i18n/preference`, { headers: this.headers() }).subscribe({
        next: res => { if (res?.country) { this.selected = res.country; } },
        error: () => { }
      });
    }
    if (!this.selected) { this.selected = this.suggestion; }
  }

  browserLanguages(): readonly string[] { return navigator.languages?.length ? navigator.languages : [navigator.language || '']; }

  load(): void {
    if (this.countries.length) { return; }
    this.failed = false;
    this.http.get<any>(`${_url}i18n/countries`).subscribe({
      next: res => this.countries = res?.data || [],
      error: () => this.failed = true
    });
  }

  get filtered(): CountryOption[] {
    const q = this.search.trim().toLowerCase();
    return !q ? this.countries : this.countries.filter(c => `${c.name} ${this.name(c.code)} ${c.code} ${c.code3}`.toLowerCase().includes(q));
  }

  /** the country's name in the current language (from the browser), else the English name */
  name(code: string): string {
    const lang = this.translate.currentLang || 'en';
    const Names = (Intl as any).DisplayNames;
    if (Names && this.names?.lang !== lang) {
      const display = new Names([lang], { type: 'region' });
      this.names = { lang, of: c => display.of(c) };
    }

    return this.names?.of(code) || this.countries.find(c => c.code === code)?.name || code;
  }

  flag(code: string): string { return `assets/flags/${code.toLowerCase()}.svg`; }

  choose(code: string): void {
    this.selected = code;
    this.search = '';
    if (this.signedIn) {
      this.http.put(`${_url}i18n/preference`, { country: code }, { headers: this.headers() }).subscribe({ error: () => { } });
    } else {
      localStorage.setItem(STORE, code);
    }
  }

  trackCode(_: number, c: CountryOption): string { return c.code; }

  private get signedIn(): boolean { return !!sessionStorage.getItem('token'); }
  private headers(): HttpHeaders { return new HttpHeaders({ Authorization: `Bearer ${sessionStorage.getItem('token') || ''}` }); }
}
