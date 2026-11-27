import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { forkJoin } from 'rxjs';
import { NotificationsService } from 'src/app/services/Global/notifications.service';
import { NexsuzTranslateLoader } from 'src/app/services/language.service';
import { _url } from 'src/global-variables';

const BATCH = 500;

/** DEF-ADMIN and DEF-MASTERADMIN: translation plans, pricing, budget and paid usage. The API enforces everything. */
@Component({
  selector: 'app-translation-plans',
  templateUrl: './translation-plans.component.html',
  styleUrls: ['./translation-plans.component.css']
})
export class TranslationPlansComponent implements OnInit {
  data: any = null;
  failed = false;
  busy = false;
  /** editable copy of the pricing settings */
  form: any = null;
  thresholds = '';
  apiKey = '';
  approve = false;

  languages: { code: string; name: string }[] = [];
  locale = '';
  /** system texts the chosen language has no translation for */
  missing: Record<string, string> | null = null;

  constructor(private http: HttpClient, private alert: NotificationsService) { }

  ngOnInit(): void {
    this.load();
    this.http.get<any>(`${_url}i18n/config`).subscribe({
      next: res => this.languages = (res?.languages || []).filter((l: any) => !/^en(-|$)/.test(l.code)),
      error: () => { }
    });
  }

  load(): void {
    this.failed = false;
    this.http.get<any>(`${_url}translation-billing`, { headers: this.headers() }).subscribe({
      next: res => this.show(res.data),
      error: () => this.failed = true
    });
  }

  private show(data: any): void {
    this.data = data;
    const c = data.config;
    this.form = {
      currency: c.currency, pricing_url: c.pricing_url, price_per_million: c.price_per_million, free_allowance: c.free_allowance,
      monthly_budget: c.monthly_budget, monthly_char_limit: c.monthly_char_limit, expected_characters: c.expected_characters
    };
    this.thresholds = c.thresholds.join(', ');
    this.approve = false;
  }

  get paid(): boolean { return this.data?.config.plan === 'paid'; }
  get symbol(): string { return this.data?.config.currency === 'PHP' ? '₱' : '$'; }
  get canEnable(): boolean {
    const c = this.data?.config;
    return !!c && this.data.key.saved && !!c.test?.ok && c.price_per_million !== null && c.monthly_budget !== null;
  }
  get connection(): string {
    if (!this.data.key.saved) { return 'No API key'; }
    const test = this.data.config.test;
    return !test ? 'Not tested' : test.ok ? 'Connected' : `Failed: ${test.message}`;
  }

  money(amount: number | null): string {
    return amount === null || amount === undefined ? '—' : `${this.symbol}${Number(amount).toLocaleString('en-US', { maximumFractionDigits: 4 })}`;
  }

  saveSettings(): void {
    const blank = (v: any) => v === '' || v === undefined ? null : v;
    this.send('put', 'settings', {
      ...this.form,
      price_per_million: blank(this.form.price_per_million),
      monthly_budget: blank(this.form.monthly_budget),
      monthly_char_limit: blank(this.form.monthly_char_limit),
      free_allowance: this.form.free_allowance || 0,
      expected_characters: this.form.expected_characters || 0,
      thresholds: this.thresholds.split(',').map(t => Number(t.trim())).filter(t => !!t)
    });
  }

  saveKey(): void {
    if (!this.apiKey.trim()) { return; }
    this.send('put', 'key', { api_key: this.apiKey.trim() }, () => this.apiKey = '');
  }

  removeKey(): void { this.send('delete', 'key'); }
  test(): void { this.send('post', 'test'); }
  enablePaid(): void { if (this.approve) { this.send('put', 'plan', { plan: 'paid', confirm: true }); } }
  useFree(): void { this.send('put', 'plan', { plan: 'free' }); }

  findMissing(): void {
    const code = this.locale;
    this.missing = null;
    if (!code) { return; }
    const loader = new NexsuzTranslateLoader(this.http);
    forkJoin([loader.getTranslation('en-US'), loader.getTranslation(code)]).subscribe(([english, current]) => {
      if (code !== this.locale) { return; }
      this.missing = Object.fromEntries(Object.entries(english).filter(([k, v]) => /^(web|nav|ls)_/.test(k) && !!v && !current[k]));
    });
  }

  get missingCount(): number { return Object.keys(this.missing || {}).length; }
  get missingCharacters(): number { return Object.values(this.missing || {}).reduce((n, t) => n + Array.from(t).length, 0); }

  translateMissing(): void {
    const texts = Object.fromEntries(Object.entries(this.missing || {}).slice(0, BATCH));
    if (!this.paid || !Object.keys(texts).length) { return; }
    this.send('post', 'translate', { locale: this.locale, texts }, res => {
      const r = res.result;
      const done = `${r.translated} translated, ${r.characters} characters sent.`;
      r.blocked ? this.alert.toastrWarning(`${done} Stopped: the monthly budget or limit would be passed.`) : this.alert.toastrSuccess(done);
      if (r.alert) { this.alert.toastrWarning(`Usage has passed ${r.alert}% of this month's limit.`); }
      this.findMissing();
    });
  }

  private send(method: 'put' | 'post' | 'delete', path: string, body: any = {}, done?: (res: any) => void): void {
    this.busy = true;
    this.http.request<any>(method, `${_url}translation-billing/${path}`, { body, headers: this.headers() }).subscribe({
      next: res => {
        this.busy = false;
        this.show(res.data);
        if (res.test && !res.test.ok) { this.alert.toastrError(res.message); } else if (res.message) { this.alert.toastrSuccess(res.message); }
        done?.(res);
      },
      error: err => {
        this.busy = false;
        this.alert.toastrError(err?.error?.message || 'Could not save.');
        this.load();        // usage may have changed even though the request failed
      }
    });
  }

  private headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${sessionStorage.getItem('token') || ''}` });
  }
}
