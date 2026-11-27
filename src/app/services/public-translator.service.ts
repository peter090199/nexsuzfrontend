import { DOCUMENT } from '@angular/common';
import { Inject, Injectable, NgZone } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { filter } from 'rxjs/operators';
import { FALLBACK_LANGUAGE } from './language.service';

const PUBLIC_PATHS = /^\/($|signin|signup|clientsignup|forgetpassword|reset-password|activation|homepage)/;
/** signed-in screens whose own texts have web_ keys; anything people typed there is marked data-no-translate */
const SIGNED_IN_PATHS = /^\/DEF-(USERS|CLIENT|MASTERADMIN|ADMIN)\/(admin-dashboard|client-dashboard|home|settings|network|vacancies|posting-job|candidates|interviews|reports|contactinquiries|user|recommended-jobs\/[^/]+|message|profile(\/[^/]+)?|client_profile\/[^/]+|dashboard|my-applications)\/?$/;
const ATTRIBUTES = ['placeholder', 'title', 'aria-label', 'alt'];
/** text that must never be rewritten (posts, announcements and chat are people's own words) */
const SKIP = 'script, style, mat-icon, textarea, [data-no-translate], option:not([value]), app-post-comments, .pre, .msg-body';

interface Seen { source: string; shown: string; }

const collapse = (s: string) => s.replace(/\s+/g, ' ').trim();

/**
 * Translates the PUBLIC website (landing, sign in / up, password and activation pages, and their dialogs and toasts).
 *
 * The texts live in the normal translation files under web_ keys, so they can be edited in Language Setup and fall back
 * to English. A text on screen is replaced when it is exactly one of the English web_ texts. It runs on public pages
 * only: inside the signed-in app, where the same words could be people's own content, nothing is rewritten.
 */
@Injectable({ providedIn: 'root' })
export class PublicTranslatorService {
  private observer?: MutationObserver;
  private texts = new Map<Node, Seen>();
  private attrs = new Map<Element, Record<string, Seen>>();
  /** English text -> translation key */
  private keys = new Map<string, string>();
  /** English texts with a value inside, e.g. "Choose {0}" */
  private patterns: { regex: RegExp; key: string }[] = [];
  /** English country name -> ISO code (country names are localized by the browser) */
  private countries?: Map<string, string>;
  private started = false;

  constructor(private router: Router, private translate: TranslateService, private zone: NgZone,
    @Inject(DOCUMENT) private doc: Document) { }

  start(): void {
    if (this.started) { return; }
    this.started = true;
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => this.toggle(this.router.url));
    this.translate.onLangChange.subscribe(() => this.refresh());
    this.translate.onDefaultLangChange.subscribe(() => this.refresh());
    this.translate.onTranslationChange.subscribe(() => this.refresh());
  }

  isPublic(url: string): boolean { return PUBLIC_PATHS.test(url.split(/[?#]/)[0] || '/'); }

  get active(): boolean { return !!this.observer; }

  toggle(url: string): void {
    if (this.isPublic(url) || SIGNED_IN_PATHS.test(url.split(/[?#]/)[0])) {
      this.observe();
      this.refresh();
    } else {
      this.stop();
    }
  }

  private observe(): void {
    if (this.observer) { return; }
    this.zone.runOutsideAngular(() => {
      this.observer = new MutationObserver(changes => {
        for (const change of changes) {
          if (change.type === 'childList') {
            change.addedNodes.forEach(n => this.walk(n));
          } else if (change.type === 'characterData') {
            this.text(change.target as Text);
          } else {
            this.attributes(change.target as Element);
          }
        }
      });
      this.observer.observe(this.doc.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRIBUTES });
    });
  }

  /** leaving the public pages: put the English back, so nothing translated is carried into the app */
  private stop(): void {
    if (!this.observer) { return; }
    this.observer.disconnect();
    this.observer = undefined;
    this.texts.forEach((seen, node) => { if (node.nodeValue === seen.shown) { node.nodeValue = seen.source; } });
    this.attrs.forEach((byName, el) => Object.entries(byName).forEach(([name, seen]) => {
      if (el.getAttribute(name) === seen.shown) { el.setAttribute(name, seen.source); }
    }));
    this.texts.clear();
    this.attrs.clear();
  }

  refresh(): void {
    if (!this.observer) { return; }
    const english = this.translate.translations?.[FALLBACK_LANGUAGE] || {};
    const web = Object.keys(english).filter(k => k.startsWith('web_')).map(k => [collapse(String(english[k])), k]);
    this.keys = new Map(web.filter(([text]) => !text.includes('{0}')) as [string, string][]);
    // the most specific (longest) pattern is tried first
    this.patterns = web.filter(([text]) => text.includes('{0}')).sort((a, b) => b[0].length - a[0].length).map(([text, key]) => ({
      regex: new RegExp('^' + text.split(/\{\d\}/).map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('(.+?)') + '$'), key
    }));
    // forget nodes that left the page
    this.texts.forEach((_, node) => { if (!node.isConnected) { this.texts.delete(node); } });
    this.attrs.forEach((_, el) => { if (!el.isConnected) { this.attrs.delete(el); } });
    this.walk(this.doc.body);
  }

  /** the shown form of an English text, or the text itself */
  lookup(source: string): string {
    const plain = collapse(source);
    if (!plain) { return source; }
    let result: string | undefined;
    const key = this.keys.get(plain);
    if (key) {
      const value = this.translate.instant(key);
      result = value === key ? plain : value;
    } else {
      result = this.fromPattern(plain) ?? this.countryName(plain);
    }
    if (result === undefined || result === plain) { return source; }

    // keep the spacing around the words
    return source.match(/^\s*/)![0] + result + source.match(/\s*$/)![0];
  }

  private fromPattern(plain: string): string | undefined {
    for (const { regex, key } of this.patterns) {
      const match = regex.exec(plain);
      if (!match) { continue; }
      const value = this.translate.instant(key);

      return value === key ? undefined : value.replace(/\{(\d)\}/g,(_: string, i: string) => match[+i + 1] ?? '');
    }

    return undefined;
  }

  private countryName(english: string): string | undefined {
    const lang = this.translate.currentLang;
    const Names = (Intl as any).DisplayNames;
    if (!Names || !lang || lang.startsWith('en')) { return undefined; }
    if (!this.countries) {
      const names = new Names(['en'], { type: 'region', fallback: 'none' });
      const found = new Map<string, string>();
      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      for (const a of letters) {
        for (const b of letters) {
          const name = names.of(a + b);
          if (name && !found.has(name)) { found.set(name, a + b); }
        }
      }
      this.countries = found;
    }
    const code = this.countries.get(english);

    return code ? new Names([lang], { type: 'region' }).of(code) : undefined;
  }

  private walk(root: Node): void {
    if (root.nodeType === Node.TEXT_NODE) { this.text(root as Text); return; }
    if (root.nodeType !== Node.ELEMENT_NODE) { return; }
    const el = root as Element;
    this.attributes(el);
    el.querySelectorAll(ATTRIBUTES.map(a => `[${a}]`).join(',')).forEach(e => this.attributes(e));
    const walker = this.doc.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) { this.text(node as Text); }
  }

  private text(node: Text): void {
    const parent = node.parentElement;
    if (!parent || parent.closest(SKIP)) { return; }
    const value = node.nodeValue || '';
    let seen = this.texts.get(node);
    // anything we did not write ourselves is new English from the app
    if (!seen || value !== seen.shown) { seen = { source: value, shown: value }; }
    const shown = this.lookup(seen.source);
    seen.shown = shown;
    if (shown !== seen.source || this.texts.has(node)) { this.texts.set(node, seen); }
    if (value !== shown) { node.nodeValue = shown; }
  }

  private attributes(el: Element): void {
    if (el.closest('[data-no-translate]')) { return; }
    for (const name of ATTRIBUTES) {
      const value = el.getAttribute(name);
      if (value === null) { continue; }
      const byName = this.attrs.get(el) || {};
      let seen = byName[name];
      if (!seen || value !== seen.shown) { seen = { source: value, shown: value }; }
      const shown = this.lookup(seen.source);
      seen.shown = shown;
      if (shown !== seen.source || byName[name]) { byName[name] = seen; this.attrs.set(el, byName); }
      if (value !== shown) { el.setAttribute(name, shown); }
    }
  }
}
