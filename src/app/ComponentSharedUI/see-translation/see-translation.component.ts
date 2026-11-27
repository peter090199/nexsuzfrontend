import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, Injectable, Input, OnChanges, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';
import { _url } from 'src/global-variables';

const headers = () => new HttpHeaders({ Authorization: `Bearer ${sessionStorage.getItem('token') || ''}` });

/** Asks once (per sign-in) whether paid translation is available, however many texts are on screen. */
@Injectable({ providedIn: 'root' })
export class TextTranslationService {
  private token = '';
  private status$?: Observable<boolean>;

  constructor(private http: HttpClient) { }

  enabled(): Observable<boolean> {
    const token = sessionStorage.getItem('token') || '';
    if (!token) { return of(false); }
    if (!this.status$ || token !== this.token) {
      this.token = token;
      this.status$ = this.http.get<any>(`${_url}translation/status`, { headers: headers() }).pipe(
        map(r => !!r?.enabled), catchError(() => of(false)), shareReplay(1));
    }

    return this.status$;
  }

  languages(): Observable<{ code: string; name: string }[]> {
    return this.http.get<any>(`${_url}translation/languages`, { headers: headers() }).pipe(map(r => r?.data || []), catchError(() => of([])));
  }

  translate(text: string, target: string): Observable<any> {
    return this.http.post<any>(`${_url}translation/text`, { text, target }, { headers: headers() });
  }
}

/**
 * "See translation" under something a person wrote. Nothing is sent anywhere until it is clicked, and it is only
 * shown while an administrator has the paid plan on. The original stays on screen.
 */
@Component({
  selector: 'app-see-translation',
  host: { 'data-no-translate': '' },
  template: `
<ng-container *ngIf="available && hasWords">
  <button type="button" class="st-link" [disabled]="loading" (click)="toggle(); $event.stopPropagation()" title="Google">
    {{ (shown ? 'ls_show_original' : 'ls_see_translation') | translate }}<ng-container *ngIf="loading">…</ng-container>
  </button>
  <span class="st-result" *ngIf="shown && result" dir="auto">{{ result }}<small>{{ 'ls_translated_by' | translate }}</small></span>
  <span class="st-error" *ngIf="error" role="alert">{{ error }}</span>
</ng-container>`,
  styles: [`
    :host { display: block; text-align: start; }
    .st-link { padding: 2px 0; border: 0; background: none; color: inherit; opacity: .8; font: inherit; font-size: 12px; font-weight: 700; text-decoration: underline; cursor: pointer; }
    .st-result { display: block; margin: 4px 0; padding: 6px 10px; border-inline-start: 3px solid #0a66c2; white-space: pre-wrap; overflow-wrap: anywhere; }
    .st-result small { display: block; opacity: .6; font-size: 10px; }
    .st-error { display: block; font-size: 12px; color: #b3261e; }
  `]
})
export class SeeTranslationComponent implements OnInit, OnChanges {
  @Input() text: string | null | undefined = '';
  /** translate into this language; empty = the reader's own */
  @Input() into = '';

  available = false;
  shown = false;
  loading = false;
  result = '';
  error = '';
  private target = '';

  constructor(private service: TextTranslationService, private translator: TranslateService) { }

  ngOnInit(): void {
    this.service.enabled().subscribe(on => this.available = on);
  }

  ngOnChanges(): void {
    this.shown = false;
    this.result = this.error = '';
  }

  get hasWords(): boolean { return /\p{L}/u.test(this.text || ''); }

  toggle(): void {
    const target = this.into || this.translator.currentLang || 'en-US';
    this.error = '';
    if (this.shown) { this.shown = false; return; }
    if (this.result && target === this.target) { this.shown = true; return; }

    const text = this.text || '';
    this.loading = true;
    this.service.translate(text, target).subscribe({
      next: res => {
        this.loading = false;
        if (text !== this.text) { return; }
        this.target = target;
        this.result = res.translated;
        this.shown = true;
      },
      error: err => {
        this.loading = false;
        this.error = err?.error?.message || this.translator.instant('ls_translation_failed');
      }
    });
  }
}
