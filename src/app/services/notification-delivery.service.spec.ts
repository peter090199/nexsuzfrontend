import { TestBed, fakeAsync, flush, tick } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { BehaviorSubject, of, throwError } from 'rxjs';

import { NotificationDeliveryService } from './notification-delivery.service';
import { ChatService } from './chat.service';
import { EchoService } from './echo.service';
import { DEFAULT_PREFS, NotificationPrefs, NotificationPrefsService } from './notification-prefs.service';
import { SharedRoutinesService } from './Function/shared-routines.service';
import { _url } from 'src/global-variables';

/** a stand-in for the browser's Notification: records what was shown and how often permission was asked */
class FakeNotification {
  static permission: NotificationPermission = 'default';
  static asked = 0;
  static answer: NotificationPermission = 'granted';
  static shown: { title: string; options: any }[] = [];
  static last: FakeNotification | null = null;
  onclick: any;
  closed = false;
  constructor(public title: string, public options: any) { FakeNotification.shown.push({ title, options }); FakeNotification.last = this; }
  close() { this.closed = true; }
  static requestPermission(): Promise<NotificationPermission> {
    FakeNotification.asked++;
    FakeNotification.permission = FakeNotification.answer;
    return Promise.resolve(FakeNotification.answer);
  }
}

class FakeAudio {
  static instances: FakeAudio[] = [];
  volume = 1; currentTime = 0; played = 0; paused = 0; reject = false;
  constructor(public src: string) { FakeAudio.instances.push(this); }
  pause() { this.paused++; }
  play() { this.played++; return this.reject ? Promise.reject(new Error('NotAllowedError')) : Promise.resolve(); }
}

const conv = (id: number, name: string, msgId: number, text: string, unread = 1, fromThem = true) => ({
  user_id: id, code: 700 + id, fullname: name, photo_pic: 'http://localhost/p' + id + '.png', is_online: true, unread_count: unread,
  last_message: { id: msgId, message: text, sender_id: fromThem ? id : 1, is_read: false, created_at: '2026-01-01T10:00:00Z' },
});
const inbox = (...c: any[]) => ({ success: true, data: c });

describe('NotificationDeliveryService', () => {
  let service: NotificationDeliveryService;
  let http: HttpTestingController;
  let chat: jasmine.SpyObj<ChatService>;
  let snack: jasmine.SpyObj<MatSnackBar>;
  let router: { url: string; navigate: jasmine.Spy };
  let count$: BehaviorSubject<number>;
  let prefs: { prefs: NotificationPrefs };
  let originalNotification: any;
  let originalAudio: any;
  let looking: boolean;                // is the user looking at this tab right now?

  const setPrefs = (p: Partial<NotificationPrefs>) => { prefs.prefs = { ...DEFAULT_PREFS, ...p }; };
  const toastData = () => snack.openFromComponent.calls.mostRecent().args[1]!.data as any;

  /** baseline = what is in the inbox when the app opens; then `after` is what arrives later */
  const arrive = (baseline: any, after: any) => {
    chat.getConversations.and.returnValue(of(baseline));
    service.start();
    chat.getConversations.and.returnValue(of(after));
    service.refreshMessages();
  };

  const make = () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        { provide: ChatService, useValue: chat },
        { provide: EchoService, useValue: { notificationCount$: count$.asObservable() } },
        { provide: NotificationPrefsService, useValue: prefs },
        { provide: MatSnackBar, useValue: snack },
        { provide: Router, useValue: router },
        { provide: SharedRoutinesService, useValue: { getRole: () => 'DEF-USERS' } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(NotificationDeliveryService);
  };

  beforeEach(() => {
    sessionStorage.setItem('token', 'tok-9');
    originalNotification = (window as any).Notification;
    originalAudio = (window as any).Audio;
    FakeNotification.permission = 'default'; FakeNotification.asked = 0; FakeNotification.answer = 'granted'; FakeNotification.shown = [];
    FakeAudio.instances = [];
    (window as any).Notification = FakeNotification;
    (window as any).Audio = FakeAudio;

    looking = false;                                                    // by default the tab is in the background
    spyOn(document, 'hasFocus').and.callFake(() => looking);
    spyOnProperty(document, 'visibilityState', 'get').and.callFake(() => (looking ? 'visible' : 'hidden'));
    spyOnProperty(document, 'hidden', 'get').and.callFake(() => !looking);

    chat = jasmine.createSpyObj<ChatService>('ChatService', ['getConversations']);
    chat.getConversations.and.returnValue(of(inbox()));
    snack = jasmine.createSpyObj<MatSnackBar>('MatSnackBar', ['openFromComponent']);
    router = { url: '/DEF-USERS/home', navigate: jasmine.createSpy('navigate') };
    count$ = new BehaviorSubject<number>(0);
    prefs = { prefs: { ...DEFAULT_PREFS } };
    make();
  });

  afterEach(() => {
    service.stop();
    (window as any).Notification = originalNotification;
    (window as any).Audio = originalAudio;
    sessionStorage.removeItem('token');
  });

  // ------------------------------------------------------------------------ what counts as "new"
  describe('what is notified', () => {
    it('never replays the mail that was already in the inbox when the app opened', () => {
      chat.getConversations.and.returnValue(of(inbox(conv(2, 'Bob', 10, 'old unread', 3))));
      service.start();
      expect(snack.openFromComponent).not.toHaveBeenCalled();
      expect(FakeNotification.shown.length).toBe(0);
    });

    it('notifies for a message that arrives after that', () => {
      arrive(inbox(conv(2, 'Bob', 10, 'old')), inbox(conv(2, 'Bob', 11, 'brand new')));
      expect(snack.openFromComponent).toHaveBeenCalledTimes(1);
      expect(toastData().notice.name).toBe('Bob');
      expect(toastData().body).toBe('brand new');
    });

    it('does not notify twice for the same message', () => {
      arrive(inbox(conv(2, 'Bob', 10, 'old')), inbox(conv(2, 'Bob', 11, 'new')));
      service.refreshMessages();
      service.refreshMessages();
      expect(snack.openFromComponent).toHaveBeenCalledTimes(1);
    });

    it('does not notify for my own message or one that is already read', () => {
      arrive(inbox(), inbox(conv(2, 'Bob', 11, 'my own words', 0, false), conv(3, 'Cy', 12, 'read already', 0)));
      expect(snack.openFromComponent).not.toHaveBeenCalled();
    });

    it('caps a burst at three notices', () => {
      arrive(inbox(), inbox(conv(2, 'A', 11, 'a'), conv(3, 'B', 12, 'b'), conv(4, 'C', 13, 'c'), conv(5, 'D', 14, 'd'), conv(6, 'E', 15, 'e')));
      expect(snack.openFromComponent).toHaveBeenCalledTimes(3);
    });

    it('refreshes when the unread count changes (Pusher), but not for the initial value of the count stream', () => {
      chat.getConversations.and.returnValue(of(inbox()));
      service.start();
      expect(chat.getConversations.calls.count()).toBe(1);             // just the opening baseline: the initial 0 did not trigger a second fetch

      chat.getConversations.and.returnValue(of(inbox(conv(2, 'Bob', 11, 'pushed'))));
      count$.next(1);                                                  // a real change pushed by the server
      expect(chat.getConversations.calls.count()).toBe(2);
      expect(snack.openFromComponent).toHaveBeenCalledTimes(1);
    });

    it('keeps quiet when the inbox cannot be loaded', () => {
      chat.getConversations.and.returnValue(throwError(() => ({ status: 500 })));
      expect(() => service.start()).not.toThrow();
      service.refreshMessages();
      expect(snack.openFromComponent).not.toHaveBeenCalled();
    });

    it('does nothing before sign-in', () => {
      sessionStorage.removeItem('token');
      service.start();
      expect(chat.getConversations).not.toHaveBeenCalled();
    });
  });

  // ------------------------------------------------------------------------ every channel obeys its own switch
  describe('each channel follows its preference', () => {
    const incoming = () => arrive(inbox(conv(2, 'Bob', 10, 'old')), inbox(conv(2, 'Bob', 11, 'secret plans')));
    const grant = () => { FakeNotification.permission = 'granted'; service.refreshPermission(); };

    it('with everything on it uses the popup, the desktop notification and the sound', () => {
      setPrefs({ sound: true, desktop_notifications: true });
      grant(); incoming();
      expect(snack.openFromComponent).toHaveBeenCalledTimes(1);
      expect(FakeNotification.shown.length).toBe(1);
      expect(FakeAudio.instances[0].played).toBe(1);
    });

    it('master switch OFF: nothing is delivered through any channel', () => {
      setPrefs({ messages_enabled: false, toast: true, sound: true, desktop_notifications: true });
      grant(); incoming();
      expect(snack.openFromComponent).not.toHaveBeenCalled();
      expect(FakeNotification.shown.length).toBe(0);
      expect(FakeAudio.instances.length).toBe(0);
    });

    it('popup OFF: no popup, the others still work', () => {
      setPrefs({ toast: false, sound: true, desktop_notifications: true });
      grant(); incoming();
      expect(snack.openFromComponent).not.toHaveBeenCalled();
      expect(FakeNotification.shown.length).toBe(1);
      expect(FakeAudio.instances[0].played).toBe(1);
    });

    it('sound is OFF by default: a new message is silent', () => {
      incoming();
      expect(snack.openFromComponent).toHaveBeenCalledTimes(1);
      expect(FakeAudio.instances.length).toBe(0);                       // the audio element is not even created
    });

    it('sound ON plays at the chosen volume', () => {
      setPrefs({ sound: true, sound_volume: 40 });
      incoming();
      expect(FakeAudio.instances[0].played).toBe(1);
      expect(FakeAudio.instances[0].volume).toBeCloseTo(0.4);
    });

    it('desktop OFF (the default): no browser notification even if the browser allows it', () => {
      grant(); incoming();
      expect(FakeNotification.shown.length).toBe(0);
    });

    it('desktop ON but the browser has not allowed it: nothing is shown and nothing is asked', () => {
      setPrefs({ desktop_notifications: true });
      FakeNotification.permission = 'default'; service.refreshPermission();
      incoming();
      expect(FakeNotification.shown.length).toBe(0);
      expect(FakeNotification.asked).toBe(0);
    });

    it('desktop ON but the browser blocks it: nothing is shown', () => {
      setPrefs({ desktop_notifications: true });
      FakeNotification.permission = 'denied'; service.refreshPermission();
      incoming();
      expect(FakeNotification.shown.length).toBe(0);
    });

    it('a desktop notification is only for when the tab is not in front', () => {
      setPrefs({ desktop_notifications: true });
      grant(); looking = true;
      incoming();
      expect(FakeNotification.shown.length).toBe(0);
      expect(snack.openFromComponent).toHaveBeenCalledTimes(1);          // but the in-app popup still shows
    });
  });

  // ------------------------------------------------------------------------ preview
  describe('message preview', () => {
    const incoming = () => arrive(inbox(), inbox(conv(2, 'Bob', 11, 'my password is hunter2')));

    it('ON: the popup shows the message', () => {
      incoming();
      expect(toastData().body).toBe('my password is hunter2');
      expect(service.bodyOf(toastData().notice)).toBe('my password is hunter2');
    });

    it('OFF: the message text is never put into the notice at all', () => {
      setPrefs({ message_preview: false });
      incoming();
      expect(toastData().notice.preview).toBeNull();
      expect(toastData().body).toBe('Sent you a message');
      expect(JSON.stringify(toastData().notice)).not.toContain('hunter2');
    });

    it('OFF also applies to the desktop notification', () => {
      setPrefs({ message_preview: false, desktop_notifications: true });
      FakeNotification.permission = 'granted'; service.refreshPermission();
      incoming();
      expect(FakeNotification.shown[0].options.body).toBe('Sent you a message');
      expect(JSON.stringify(FakeNotification.shown)).not.toContain('hunter2');
    });

    it('the desktop notification carries the sender name and photo', () => {
      setPrefs({ desktop_notifications: true });
      FakeNotification.permission = 'granted'; service.refreshPermission();
      incoming();
      expect(FakeNotification.shown[0].title).toBe('Bob');
      expect(FakeNotification.shown[0].options.icon).toBe('http://localhost/p2.png');
      expect(FakeNotification.shown[0].options.body).toBe('my password is hunter2');
    });
  });

  // ------------------------------------------------------------------------ the chat that is open
  describe('a chat you are already reading', () => {
    it('does not pop up for the open conversation while you are looking at it', () => {
      looking = true;
      service.activeChatUserId = 2;
      arrive(inbox(), inbox(conv(2, 'Bob', 11, 'hi')));
      expect(snack.openFromComponent).not.toHaveBeenCalled();
    });

    it('still pops up for a different conversation', () => {
      looking = true;
      service.activeChatUserId = 3;
      arrive(inbox(), inbox(conv(2, 'Bob', 11, 'hi')));
      expect(snack.openFromComponent).toHaveBeenCalledTimes(1);
    });

    it('notifies when the open chat is in a background tab', () => {
      looking = false;
      service.activeChatUserId = 2;
      arrive(inbox(), inbox(conv(2, 'Bob', 11, 'hi')));
      expect(snack.openFromComponent).toHaveBeenCalledTimes(1);
    });
  });

  // ------------------------------------------------------------------------ sound details
  describe('sound', () => {
    it('only one sound at a time: a new one restarts the same player', () => {
      service.playSound(50);
      service.playSound(80);
      expect(FakeAudio.instances.length).toBe(1);
      const a = FakeAudio.instances[0];
      expect(a.played).toBe(2);
      expect(a.paused).toBe(2);                                         // stopped before each start: no overlap
      expect(a.volume).toBeCloseTo(0.8);
    });

    it('volume is clamped to 0-100%', () => {
      service.playSound(500); expect(FakeAudio.instances[0].volume).toBe(1);
      service.playSound(-5);  expect(FakeAudio.instances[0].volume).toBe(0);
    });

    it('a browser that blocks autoplay is handled quietly', fakeAsync(() => {
      service.playSound(50);
      FakeAudio.instances[0].reject = true;
      expect(() => { service.playSound(50); flush(); }).not.toThrow();
    }));

    it('the Test sound button plays even when the sound switch is off', () => {
      setPrefs({ sound: false, sound_volume: 25 });
      service.testSound();
      expect(FakeAudio.instances[0].played).toBe(1);
      expect(FakeAudio.instances[0].volume).toBeCloseTo(0.25);
    });
  });

  // ------------------------------------------------------------------------ browser permission
  describe('browser permission', () => {
    it('never asks on its own: not at start, not when a message arrives', () => {
      setPrefs({ desktop_notifications: true });
      arrive(inbox(), inbox(conv(2, 'Bob', 11, 'hi')));
      expect(FakeNotification.asked).toBe(0);
    });

    it('asks once when requested while undecided, and reports the answer', async () => {
      FakeNotification.answer = 'granted';
      const result = await service.requestDesktopPermission();
      expect(result).toBe('granted');
      expect(FakeNotification.asked).toBe(1);
      expect(service.permission$.value).toBe('granted');
    });

    it('does not ask again once the browser has answered (granted)', async () => {
      FakeNotification.permission = 'granted';
      expect(await service.requestDesktopPermission()).toBe('granted');
      expect(FakeNotification.asked).toBe(0);
    });

    it('does not ask again once the browser has answered (blocked)', async () => {
      FakeNotification.permission = 'denied';
      expect(await service.requestDesktopPermission()).toBe('denied');
      expect(await service.requestDesktopPermission()).toBe('denied');
      expect(FakeNotification.asked).toBe(0);
      expect(service.permission$.value).toBe('denied');
    });

    it('reports a refusal', async () => {
      FakeNotification.answer = 'denied';
      expect(await service.requestDesktopPermission()).toBe('denied');
      expect(service.permission$.value).toBe('denied');
    });

    it('copes with a browser that has no notification support', async () => {
      (window as any).Notification = undefined;
      make();
      expect(service.permission$.value).toBe('unsupported');
      expect(await service.requestDesktopPermission()).toBe('unsupported');
    });
  });

  // ------------------------------------------------------------------------ opening the conversation
  describe('clicking a notification', () => {
    it('opens the chat inside the Messages page when it is already open', () => {
      router.url = '/DEF-USERS/message';
      const ids: number[] = [];
      service.openChat$.subscribe(id => ids.push(id));
      service.openConversation(7);
      expect(ids).toEqual([7]);
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('goes to the Messages page for that person from anywhere else', () => {
      router.url = '/DEF-USERS/home';
      service.openConversation(7);
      expect(router.navigate).toHaveBeenCalledWith(['/DEF-USERS/message'], { queryParams: { user: 7 } });
    });

    it('the popup\'s click handler opens that person\'s conversation', () => {
      arrive(inbox(), inbox(conv(2, 'Bob', 11, 'hi')));
      toastData().open();
      expect(router.navigate).toHaveBeenCalledWith(['/DEF-USERS/message'], { queryParams: { user: 2 } });
    });

    it('a desktop notification click focuses the window and opens the conversation', () => {
      setPrefs({ desktop_notifications: true });
      FakeNotification.permission = 'granted'; service.refreshPermission();
      const focus = spyOn(window, 'focus');
      arrive(inbox(), inbox(conv(2, 'Bob', 11, 'hi')));

      const note = FakeNotification.last!;
      expect(note).not.toBeNull();
      expect(focus).not.toHaveBeenCalled();
      note.onclick();                                                   // the user clicks the desktop notification
      expect(focus).toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/DEF-USERS/message'], { queryParams: { user: 2 } });
      expect(note.closed).toBeTrue();
    });
  });

  // ------------------------------------------------------------------------ polling
  describe('polling', () => {
    it('checks for new mail every 30 seconds while the tab is visible, and not while it is hidden', fakeAsync(() => {
      looking = true;
      chat.getConversations.and.returnValue(of(inbox()));
      service.start();
      const n = chat.getConversations.calls.count();
      tick(30000);
      expect(chat.getConversations.calls.count()).toBe(n + 1);

      looking = false;
      tick(60000);
      expect(chat.getConversations.calls.count()).toBe(n + 1);          // hidden: no polling
      service.stop();
      flush();
    }));

    it('stop() ends the timers', fakeAsync(() => {
      looking = true;
      service.start();
      http.match(() => true).forEach(r => r.flush({ success: true, unread_count: 0 }));
      service.stop();
      const n = chat.getConversations.calls.count();
      tick(120000);
      expect(chat.getConversations.calls.count()).toBe(n);
    }));
  });

  // ------------------------------------------------------------------------ social activity
  describe('social activity count', () => {
    it('asks the server for the unread activity count (the server already leaves out switched-off categories)', () => {
      service.refreshActivity();
      const req = http.expectOne(`${_url}activity-notifications?count_only=1`);
      expect(req.request.headers.get('Authorization')).toBe('Bearer tok-9');
      req.flush({ success: true, unread_count: 4 });
      expect(service.activityUnread$.value).toBe(4);
    });

    it('keeps the last count when the request fails', () => {
      service.activityUnread$.next(2);
      service.refreshActivity();
      http.expectOne(`${_url}activity-notifications?count_only=1`).error(new ProgressEvent('x'));
      expect(service.activityUnread$.value).toBe(2);
    });

    it('marking activity read clears the badge at once and tells the server', () => {
      service.activityUnread$.next(5);
      service.markActivityRead().subscribe();
      expect(service.activityUnread$.value).toBe(0);
      const req = http.expectOne(`${_url}activity-notifications/read`);
      expect(req.request.method).toBe('POST');
      req.flush({ success: true });
    });

    it('fetches the activity list', () => {
      service.fetchActivity().subscribe();
      const req = http.expectOne(`${_url}activity-notifications`);
      expect(req.request.method).toBe('GET');
      req.flush({ success: true, data: [], unread_count: 0 });
    });
  });
});
