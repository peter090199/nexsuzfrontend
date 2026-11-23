import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject } from 'rxjs';
import { _url } from 'src/global-variables';

/** Every setting. Must match App\Helpers\NotificationPrefs on the server. */
export interface NotificationPrefs {
  // messages
  messages_enabled: boolean;
  message_preview: boolean;
  unread_badge: boolean;
  desktop_notifications: boolean;
  toast: boolean;
  sound: boolean;
  sound_volume: number;
  /** background of the navigation bars, "#rrggbb"; null = the standard look */
  nav_color: string | null;
  // social activity
  friend_requests: boolean;
  friend_accepts: boolean;
  post_reactions: boolean;
  post_comments: boolean;
  // jobs
  job_applications: boolean;
  job_interviews: boolean;
  job_status: boolean;
  job_reviews: boolean;
  // email (security emails are always sent and are not a setting)
  email_application_updates: boolean;
}

/** Sound and desktop notifications are OFF until the user turns them on. */
export const DEFAULT_PREFS: NotificationPrefs = {
  messages_enabled: true,
  message_preview: true,
  unread_badge: true,
  desktop_notifications: false,
  toast: true,
  sound: false,
  sound_volume: 70,
  nav_color: null,
  friend_requests: true,
  friend_accepts: true,
  post_reactions: true,
  post_comments: true,
  job_applications: true,
  job_interviews: true,
  job_status: true,
  job_reviews: true,
  email_application_updates: true,
};

export const BOOLEAN_KEYS = (Object.keys(DEFAULT_PREFS) as (keyof NotificationPrefs)[]).filter(k => k !== 'sound_volume' && k !== 'nav_color');

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';
export interface SaveStatus { state: SaveState; message?: string; }

const SAVE_DELAY_MS = 350;
const RESYNC_AFTER_MS = 20000;
const RESYNC_EVERY_MS = 60000;

/**
 * The signed-in user's notification preferences.
 *
 *  - the server (Laravel, per account) is the source of truth: loaded after login, so they follow the user to any device
 *  - a copy in this browser makes the first paint instant and is replaced as soon as the server answers
 *  - a change applies at once (every subscriber sees it immediately), is saved in the background, and is put back
 *    with a clear error if the server refuses it
 *  - another device's change arrives when this tab regains focus, on a slow timer, or via another tab of this browser
 */
@Injectable({ providedIn: 'root' })
export class NotificationPrefsService implements OnDestroy {
  private readonly subject = new BehaviorSubject<NotificationPrefs>(this.readCache() || { ...DEFAULT_PREFS });
  readonly prefs$ = this.subject.asObservable();
  readonly status$ = new BehaviorSubject<SaveStatus>({ state: 'idle' });
  readonly loaded$ = new BehaviorSubject<boolean>(false);

  /** what the server last confirmed: where a refused change goes back to */
  private confirmed: NotificationPrefs = { ...this.subject.value };
  private pending: Partial<NotificationPrefs> = {};
  private timer?: any;
  private inFlight = false;
  private lastLoad = 0;
  private syncing = false;
  private resyncTimer?: any;
  private savedTimer?: any;

  private readonly onVisible = () => { if (document.visibilityState === 'visible' && Date.now() - this.lastLoad > RESYNC_AFTER_MS) { this.load(); } };
  private readonly onStorage = (e: StorageEvent) => {
    if (e.key === this.cacheKey() && e.newValue) {
      try { this.apply(this.normalise(JSON.parse(e.newValue))); } catch { /* ignore a corrupt value */ }
    }
  };

  constructor(private http: HttpClient) {}

  get prefs(): NotificationPrefs { return this.subject.value; }

  // ------------------------------------------------------------------ loading + syncing
  /** Fetch the account's settings. Needs a signed-in user; silent when it fails (the cached copy stays in use). */
  load(): void {
    if (!sessionStorage.getItem('token')) { return; }
    this.http.get<any>(`${_url}notification-settings`, { headers: this.headers() }).subscribe({
      next: res => {
        this.lastLoad = Date.now();
        if (!res?.success) { return; }
        const server = this.normalise(res.data);
        this.confirmed = server;
        // a change made a moment ago and still being saved wins over what the server had before it
        this.apply({ ...server, ...this.pending } as NotificationPrefs, false);
        this.writeCache(this.subject.value);
        this.loaded$.next(true);
      },
      error: () => { /* offline or signed out: keep the cached copy */ }
    });
  }

  /** Pick up changes made on another device: when the tab regains focus, every minute, and from other tabs here */
  startSync(): void {
    if (this.syncing) { return; }
    this.syncing = true;
    document.addEventListener('visibilitychange', this.onVisible);
    window.addEventListener('storage', this.onStorage);
    this.resyncTimer = setInterval(() => { if (document.visibilityState === 'visible') { this.load(); } }, RESYNC_EVERY_MS);
  }

  stopSync(): void {
    if (!this.syncing) { return; }
    this.syncing = false;
    document.removeEventListener('visibilitychange', this.onVisible);
    window.removeEventListener('storage', this.onStorage);
    clearInterval(this.resyncTimer);
  }

  ngOnDestroy(): void { this.stopSync(); clearTimeout(this.timer); clearTimeout(this.savedTimer); }

  // ------------------------------------------------------------------ changing
  /** Apply right now and save in the background (changes made in quick succession go out as one request) */
  update(patch: Partial<NotificationPrefs>): void {
    const clean = this.normalise({ ...this.subject.value, ...patch });
    const changed: Partial<NotificationPrefs> = {};
    (Object.keys(patch) as (keyof NotificationPrefs)[]).forEach(k => { (changed as any)[k] = clean[k]; });

    this.apply(clean);
    this.pending = { ...this.pending, ...changed };
    this.status$.next({ state: 'saving' });
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), SAVE_DELAY_MS);
  }

  /**
   * "Enable all" / "Disable all": every on/off setting at once (the volume is left alone).
   * `except` wins over the bulk value, e.g. desktop notifications stay off while the browser has not allowed them.
   */
  setAll(on: boolean, except: Partial<NotificationPrefs> = {}): void {
    const patch: Partial<NotificationPrefs> = {};
    // email preferences have their own section: "Enable/Disable all" is for notifications only
    BOOLEAN_KEYS.filter(k => !k.startsWith('email_')).forEach(k => { (patch as any)[k] = on; });
    this.update({ ...patch, ...except });
  }

  /** "Restore defaults": back to the defaults, on the server too */
  reset(): void {
    clearTimeout(this.timer);
    this.pending = {};
    this.status$.next({ state: 'saving' });
    this.apply({ ...DEFAULT_PREFS });
    this.http.post<any>(`${_url}notification-settings/reset`, {}, { headers: this.headers() }).subscribe({
      next: res => { this.confirmed = this.normalise(res?.data); this.apply(this.confirmed, false); this.writeCache(this.confirmed); this.saved(); },
      error: err => this.failed(err)
    });
  }

  /** Save what is pending now (also used by "Try again") */
  flush(): void {
    clearTimeout(this.timer);
    if (this.inFlight || !Object.keys(this.pending).length) { return; }
    const body = this.pending;
    this.pending = {};
    this.inFlight = true;

    this.http.put<any>(`${_url}notification-settings`, body, { headers: this.headers() }).subscribe({
      next: res => {
        this.inFlight = false;
        this.confirmed = this.normalise(res?.data);
        // keep anything the user changed while this request was out
        this.apply({ ...this.confirmed, ...this.pending } as NotificationPrefs, false);
        this.writeCache(this.subject.value);
        if (Object.keys(this.pending).length) { this.flush(); } else { this.saved(); }
      },
      error: err => {
        this.inFlight = false;
        this.pending = {};
        this.failed(err);
      }
    });
  }

  /** Put the screen back to what the server has after a refused or failed save */
  private failed(err: any): void {
    const e = err?.error;
    const message = (e?.errors && (Object.values(e.errors)[0] as string[])[0]) || e?.message
      || (err?.status === 0 ? 'No connection. Your change was not saved.' : 'Your change could not be saved.');
    this.apply({ ...this.confirmed }, false);
    this.status$.next({ state: 'error', message });
  }

  private saved(): void {
    this.status$.next({ state: 'saved' });
    clearTimeout(this.savedTimer);
    this.savedTimer = setTimeout(() => { if (this.status$.value.state === 'saved') { this.status$.next({ state: 'idle' }); } }, 2500);
  }

  // ------------------------------------------------------------------ internals
  private apply(next: NotificationPrefs, cache = true): void {
    this.subject.next(next);
    if (cache) { this.writeCache(next); }
  }

  /** every key present, right type, volume 0-100 */
  private normalise(raw: any): NotificationPrefs {
    const out: any = { ...DEFAULT_PREFS };
    BOOLEAN_KEYS.forEach(k => { if (raw && typeof raw[k] === 'boolean') { out[k] = raw[k]; } else if (raw && (raw[k] === 0 || raw[k] === 1)) { out[k] = !!raw[k]; } });
    if (raw && raw.sound_volume !== undefined && raw.sound_volume !== null && !isNaN(+raw.sound_volume)) {
      out.sound_volume = Math.max(0, Math.min(100, Math.round(+raw.sound_volume)));
    }
    out.nav_color = raw && typeof raw.nav_color === 'string' && /^#[0-9a-fA-F]{6}$/.test(raw.nav_color) ? raw.nav_color.toLowerCase() : null;
    return out as NotificationPrefs;
  }

  private headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${sessionStorage.getItem('token') || ''}` });
  }

  private cacheKey(): string { return 'nx-notif-prefs:' + (sessionStorage.getItem('code') || 'x'); }

  private readCache(): NotificationPrefs | null {
    try { const v = localStorage.getItem(this.cacheKey()); return v ? this.normalise(JSON.parse(v)) : null; } catch { return null; }
  }

  private writeCache(p: NotificationPrefs): void {
    try { localStorage.setItem(this.cacheKey(), JSON.stringify(p)); } catch { /* storage unavailable */ }
  }
}
