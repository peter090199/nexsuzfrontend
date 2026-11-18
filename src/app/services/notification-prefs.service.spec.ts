import { TestBed, fakeAsync, flush, tick } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { BOOLEAN_KEYS, DEFAULT_PREFS, NotificationPrefs, NotificationPrefsService } from './notification-prefs.service';
import { _url } from 'src/global-variables';

describe('NotificationPrefsService', () => {
  let service: NotificationPrefsService;
  let http: HttpTestingController;
  const URL = () => `${_url}notification-settings`;
  const CACHE = 'nx-notif-prefs:555';

  const make = () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(NotificationPrefsService);
  };
  const ok = (data: Partial<NotificationPrefs>) => ({ success: true, message: 'OK', data: { ...DEFAULT_PREFS, ...data } });

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.setItem('token', 'tok-1');
    sessionStorage.setItem('code', '555');
    make();
  });
  afterEach(() => { service.ngOnDestroy(); localStorage.clear(); sessionStorage.removeItem('token'); sessionStorage.removeItem('code'); });

  // ------------------------------------------------------------------------ defaults + loading
  it('starts with the defaults: sound OFF, desktop OFF', () => {
    expect(service.prefs).toEqual(DEFAULT_PREFS);
    expect(service.prefs.sound).toBeFalse();
    expect(service.prefs.desktop_notifications).toBeFalse();
    expect(service.prefs.sound_volume).toBe(70);
  });

  it('loads the account settings with the user\'s token', () => {
    service.load();
    const req = http.expectOne(URL());
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Authorization')).toBe('Bearer tok-1');
    req.flush(ok({ sound: true, sound_volume: 25, post_comments: false }));

    expect(service.prefs.sound).toBeTrue();
    expect(service.prefs.sound_volume).toBe(25);
    expect(service.prefs.post_comments).toBeFalse();
    expect(service.loaded$.value).toBeTrue();
  });

  it('does not call the server when nobody is signed in', () => {
    sessionStorage.removeItem('token');
    service.load();
    http.expectNone(URL());
  });

  it('keeps the cached settings when the server cannot be reached', fakeAsync(() => {
    service.update({ toast: false });
    tick(400);
    http.expectOne(URL()).flush(ok({ toast: false }));
    service.load();
    http.expectOne(URL()).error(new ProgressEvent('offline'));
    expect(service.prefs.toast).toBeFalse();
    flush();
  }));

  it('remembers the settings in this browser for an instant start next time (and only for this account)', fakeAsync(() => {
    service.update({ sound: true });
    tick(400);
    http.expectOne(URL()).flush(ok({ sound: true }));
    expect(JSON.parse(localStorage.getItem(CACHE)!).sound).toBeTrue();

    make();                                              // a reload: no network yet, but the settings are already there
    expect(service.prefs.sound).toBeTrue();

    sessionStorage.setItem('code', '999');               // somebody else signs in on this browser
    make();
    expect(service.prefs.sound).toBeFalse();
    flush();
  }));

  it('ignores nonsense from the server: wrong types fall back to defaults, the volume is clamped', () => {
    service.load();
    http.expectOne(URL()).flush({ success: true, data: { sound: 'yes', toast: null, sound_volume: 900, message_preview: 0, unknown_key: true } });
    expect(service.prefs.sound).toBeFalse();            // 'yes' is not a boolean: default
    expect(service.prefs.toast).toBeTrue();             // null: default
    expect(service.prefs.sound_volume).toBe(100);
    expect(service.prefs.message_preview).toBeFalse();  // 0 means off
    expect((service.prefs as any).unknown_key).toBeUndefined();
  });

  // ------------------------------------------------------------------------ changing
  it('applies a change to every subscriber immediately, before the server answers', fakeAsync(() => {
    const seen: boolean[] = [];
    const sub = service.prefs$.subscribe(p => seen.push(p.toast));
    service.update({ toast: false });
    expect(service.prefs.toast).toBeFalse();
    expect(seen[seen.length - 1]).toBeFalse();
    expect(service.status$.value.state).toBe('saving');
    http.expectNone(URL());                                // not sent yet (small delay to batch changes)
    sub.unsubscribe();
    tick(400); http.expectOne(URL()).flush(ok({ toast: false })); flush();
  }));

  it('saves with one PUT, even for several quick changes', fakeAsync(() => {
    service.update({ toast: false });
    service.update({ sound: true });
    service.update({ sound_volume: 30 });
    tick(400);
    const req = http.expectOne(URL());
    expect(req.request.method).toBe('PUT');
    expect(req.request.headers.get('Authorization')).toBe('Bearer tok-1');
    expect(req.request.body).toEqual({ toast: false, sound: true, sound_volume: 30 });
    req.flush(ok({ toast: false, sound: true, sound_volume: 30 }));
    expect(service.status$.value.state).toBe('saved');
    tick(3000);
    expect(service.status$.value.state).toBe('idle');
  }));

  it('only sends what changed, not the whole object', fakeAsync(() => {
    service.update({ friend_requests: false });
    tick(400);
    expect(http.expectOne(URL()).request.body).toEqual({ friend_requests: false });
    flush();
  }));

  it('clamps the volume and rejects a non-number before anything is sent', fakeAsync(() => {
    service.update({ sound_volume: 500 });
    expect(service.prefs.sound_volume).toBe(100);
    service.update({ sound_volume: -20 });
    expect(service.prefs.sound_volume).toBe(0);
    tick(400);
    expect(http.expectOne(URL()).request.body).toEqual({ sound_volume: 0 });
    flush();
  }));

  it('puts the screen back and says why when the server refuses a change', fakeAsync(() => {
    service.update({ sound_volume: 40 });
    tick(400);
    http.expectOne(URL()).flush({ success: false, message: 'The volume must be between 0 and 100.', errors: { sound_volume: ['The volume must be between 0 and 100.'] } }, { status: 422, statusText: 'Unprocessable' });

    expect(service.prefs.sound_volume).toBe(70);       // back to what the server has
    expect(service.status$.value.state).toBe('error');
    expect(service.status$.value.message).toContain('volume must be between');
  }));

  it('explains a lost connection', fakeAsync(() => {
    service.update({ toast: false });
    tick(400);
    http.expectOne(URL()).error(new ProgressEvent('offline'), { status: 0 });
    expect(service.prefs.toast).toBeTrue();            // reverted
    expect(service.status$.value.message).toContain('No connection');
  }));

  it('keeps a change made while the previous save is still in flight', fakeAsync(() => {
    service.update({ toast: false });
    tick(400);
    const first = http.expectOne(URL());
    service.update({ sound: true });                   // the user keeps clicking
    first.flush(ok({ toast: false }));                 // the reply to the first save must not undo the second change
    expect(service.prefs.sound).toBeTrue();
    expect(service.prefs.toast).toBeFalse();
    tick(400);
    const second = http.expectOne(URL());
    expect(second.request.body).toEqual({ sound: true });
    second.flush(ok({ toast: false, sound: true }));
    expect(service.status$.value.state).toBe('saved');
    flush();                                             // the "Saved" message fades after a moment
  }));

  it('Enable all and Disable all change every on/off setting, not the volume', fakeAsync(() => {
    service.update({ sound_volume: 20 }); tick(400); http.expectOne(URL()).flush(ok({ sound_volume: 20 }));

    service.setAll(false);
    BOOLEAN_KEYS.forEach(k => expect(service.prefs[k]).toBeFalse());
    expect(service.prefs.sound_volume).toBe(20);
    tick(400); http.expectOne(URL()).flush(ok({ sound_volume: 20, ...Object.fromEntries(BOOLEAN_KEYS.map(k => [k, false])) }));

    service.setAll(true);
    BOOLEAN_KEYS.forEach(k => expect(service.prefs[k]).toBeTrue());
    tick(400); http.expectOne(URL()).flush(ok({ sound_volume: 20, ...Object.fromEntries(BOOLEAN_KEYS.map(k => [k, true])) }));
    flush();
  }));

  it('Enable all can leave desktop notifications off (no browser permission yet)', fakeAsync(() => {
    service.setAll(true, { desktop_notifications: false });
    expect(service.prefs.desktop_notifications).toBeFalse();
    expect(service.prefs.sound).toBeTrue();
    expect(service.prefs.messages_enabled).toBeTrue();
    tick(400);
    expect(http.expectOne(URL()).request.body.desktop_notifications).toBeFalse();
    flush();
  }));

  it('Restore defaults resets on the server and on screen', fakeAsync(() => {
    service.update({ sound: true, toast: false }); tick(400); http.expectOne(URL()).flush(ok({ sound: true, toast: false }));

    service.reset();
    expect(service.prefs).toEqual(DEFAULT_PREFS);       // immediately
    const req = http.expectOne(`${URL()}/reset`);
    expect(req.request.method).toBe('POST');
    req.flush(ok({}));
    expect(service.status$.value.state).toBe('saved');
    expect(JSON.parse(localStorage.getItem(CACHE)!)).toEqual(DEFAULT_PREFS);
    tick(3000);
  }));

  // ------------------------------------------------------------------------ other devices
  it('picks up a change made on another device the next time it loads', () => {
    service.load();
    http.expectOne(URL()).flush(ok({}));
    expect(service.prefs.toast).toBeTrue();

    service.load();                                      // e.g. the tab regained focus
    http.expectOne(URL()).flush(ok({ toast: false, sound: true }));
    expect(service.prefs.toast).toBeFalse();
    expect(service.prefs.sound).toBeTrue();
  });

  it('a change made here a moment ago is not overwritten by an older load', fakeAsync(() => {
    service.update({ sound: true });
    service.load();
    http.expectOne(URL()).flush(ok({ sound: false }));    // server still had the old value
    expect(service.prefs.sound).toBeTrue();
    tick(400); http.expectOne(URL()).flush(ok({ sound: true }));
    flush();
  }));

  it('refreshes when the tab becomes visible again after a while, not on every focus', fakeAsync(() => {
    service.startSync();
    service.load(); http.expectOne(URL()).flush(ok({}));

    document.dispatchEvent(new Event('visibilitychange'));            // just loaded: nothing to do
    http.expectNone(URL());

    tick(25000);
    document.dispatchEvent(new Event('visibilitychange'));
    http.expectOne(URL()).flush(ok({ post_reactions: false }));
    expect(service.prefs.post_reactions).toBeFalse();
    service.stopSync();
    discardTimers();
  }));

  function discardTimers() { try { flush(); } catch { /* the periodic re-sync timer is stopped */ } }

  it('re-syncs every minute while visible', fakeAsync(() => {
    service.startSync();
    tick(60000);
    http.expectOne(URL()).flush(ok({ friend_accepts: false }));
    expect(service.prefs.friend_accepts).toBeFalse();
    service.stopSync();
  }));

  it('applies a change made in another tab of this browser', () => {
    service.startSync();
    const other = { ...DEFAULT_PREFS, sound: true };
    window.dispatchEvent(new StorageEvent('storage', { key: CACHE, newValue: JSON.stringify(other) }));
    expect(service.prefs.sound).toBeTrue();
    service.stopSync();
  });

  it('startSync can be called twice without doubling the listeners', fakeAsync(() => {
    service.startSync(); service.startSync();
    tick(60000);
    http.expectOne(URL()).flush(ok({}));                 // exactly one request, not two
    service.stopSync();
  }));
});
