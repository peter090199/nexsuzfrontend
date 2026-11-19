import { NexsuzTestingModule } from 'src/testing/nexsuz-testing.module';
import { ComponentFixture, TestBed, fakeAsync, flush, tick } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { of } from 'rxjs';

import { SettingsComponent } from './settings.component';
import { ChatService } from 'src/app/services/chat.service';
import { DEFAULT_PREFS, NotificationPrefs, NotificationPrefsService } from 'src/app/services/notification-prefs.service';
import { NotificationDeliveryService } from 'src/app/services/notification-delivery.service';
import { NotificationsService } from 'src/app/services/Global/notifications.service';
import { EchoService } from 'src/app/services/echo.service';

const conversation = {
  user_id: 9, code: 709, fullname: 'Dana Latest', photo_pic: 'http://localhost/dana.png', is_online: true, unread_count: 1,
  last_message: { id: 50, message: 'Lunch at noon?', sender_id: 9, is_read: false, created_at: '2026-01-01T09:30:00Z' },
};

describe('Settings > Notifications', () => {
  let fixture: ComponentFixture<SettingsComponent>;
  let component: SettingsComponent;
  let prefs: NotificationPrefsService;
  let delivery: NotificationDeliveryService;
  let updateSpy: jasmine.Spy;
  let warn: jasmine.Spy;

  const el = () => fixture.nativeElement as HTMLElement;
  const q = (s: string) => el().querySelector(s) as HTMLElement | null;
  const qa = (s: string) => Array.from(el().querySelectorAll(s)) as HTMLElement[];
  const input = (label: string) => q(`mat-slide-toggle input[aria-label="${label}"]`) as HTMLInputElement;
  const toggle = (label: string) => (input(label) ? input(label).closest('mat-slide-toggle') : null) as HTMLElement;
  const flip = (label: string) => { input(label).click(); fixture.detectChanges(); };
  const button = (text: string) => qa('button').find(b => b.textContent!.trim().includes(text))!;

  const init = (opts: { conv?: any; perm?: NotificationPermission | 'unsupported'; p?: Partial<NotificationPrefs> } = {}) => {
    const chat = TestBed.inject(ChatService);
    spyOn(chat, 'getConversations').and.returnValue(of({ success: true, data: opts.conv === undefined ? [conversation] : opts.conv ? [opts.conv] : [] }));
    prefs = TestBed.inject(NotificationPrefsService);
    delivery = TestBed.inject(NotificationDeliveryService);
    spyOn(prefs, 'load');
    prefs['subject'].next({ ...DEFAULT_PREFS, ...(opts.p || {}) });
    updateSpy = spyOn(prefs, 'update').and.callThrough();
    spyOn(prefs, 'flush');
    delivery.permission$.next(opts.perm ?? 'default');
    spyOn(delivery, 'refreshPermission');
    warn = spyOn(TestBed.inject(NotificationsService), 'toastrWarning');

    fixture = TestBed.createComponent(SettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    component.select('notifications');
    fixture.detectChanges();
  };

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [NexsuzTestingModule],
      declarations: [SettingsComponent],
      // the real EchoService opens a Pusher connection when it is created: not wanted (or allowed) in a unit test
      providers: [{ provide: EchoService, useValue: { notificationCount$: of(0) } }],
    }).compileComponents();
  });

  afterEach(() => { localStorage.clear(); fixture?.destroy(); });

  // ------------------------------------------------------------------------ the section
  it('Notifications is a real section now, not a "coming soon" placeholder', fakeAsync(() => {
    init();
    expect(component.sections.find(s => s.id === 'notifications')!.available).toBeTrue();
    expect(q('.st-empty')).toBeNull();
    expect(q('.st-panel-head h2')!.textContent).toContain('Notifications');
    flush();
  }));

  it('loads the account settings from the server when it opens', fakeAsync(() => {
    init();
    expect(prefs.load).toHaveBeenCalled();
    flush();
  }));

  it('shows every control: 6 message switches, 8 social and job switches, volume, test sound and the quick actions', fakeAsync(() => {
    init();
    expect(qa('mat-slide-toggle').length).toBe(14);
    ['New message notifications', 'Message preview', 'Unread message badges', 'Desktop browser notifications', 'Notification popup', 'Notification sound',
      'Friend requests', 'Friend request accepted', 'Post reactions', 'Post comments and replies',
      'Job applications', 'Interview invites', 'Application decisions', 'Application reviews'].forEach(l => expect(toggle(l)).withContext(l).not.toBeNull());
    expect(q('mat-slider')).not.toBeNull();
    expect(button('Test sound')).toBeDefined();
    ['Enable all', 'Disable all', 'Restore defaults'].forEach(l => expect(button(l)).withContext(l).toBeDefined());
    flush();
  }));

  it('reflects the saved settings, with sound and desktop OFF by default', fakeAsync(() => {
    init();
    const on = (l: string) => toggle(l).classList.contains('mat-checked');
    expect(on('Notification sound')).toBeFalse();
    expect(on('Desktop browser notifications')).toBeFalse();
    expect(on('New message notifications')).toBeTrue();
    expect(on('Notification popup')).toBeTrue();
    flush();
  }));

  // ------------------------------------------------------------------------ every switch
  const SWITCHES: [string, keyof NotificationPrefs, boolean][] = [
    ['New message notifications', 'messages_enabled', true],
    ['Message preview', 'message_preview', true],
    ['Unread message badges', 'unread_badge', true],
    ['Notification popup', 'toast', true],
    ['Notification sound', 'sound', false],
    ['Friend requests', 'friend_requests', true],
    ['Friend request accepted', 'friend_accepts', true],
    ['Post reactions', 'post_reactions', true],
    ['Post comments and replies', 'post_comments', true],
    ['Job applications', 'job_applications', true],
    ['Interview invites', 'job_interviews', true],
    ['Application decisions', 'job_status', true],
    ['Application reviews', 'job_reviews', true],
  ];
  SWITCHES.forEach(([label, key, defaultValue]) => {
    it('the "' + label + '" switch saves ' + key + ' immediately', fakeAsync(() => {
      init();
      flip(label);
      expect(updateSpy).toHaveBeenCalledWith({ [key]: !defaultValue });
      expect(prefs.prefs[key]).toBe(!defaultValue);            // applied at once
      expect(toggle(label).classList.contains('mat-checked')).toBe(!defaultValue);
      flush();
    }));
  });

  // ------------------------------------------------------------------------ desktop notifications + permission
  describe('desktop notifications and the browser permission', () => {
    it('asks the browser only when the user switches it on, and enables it if allowed', fakeAsync(() => {
      init({ perm: 'default' });
      const ask = spyOn(delivery, 'requestDesktopPermission').and.returnValue(Promise.resolve('granted' as NotificationPermission));
      flip('Desktop browser notifications'); tick(); fixture.detectChanges();
      expect(ask).toHaveBeenCalledTimes(1);
      expect(updateSpy).toHaveBeenCalledWith({ desktop_notifications: true });
      flush();
    }));

    it('keeps it off and explains when the browser refuses', fakeAsync(() => {
      init({ perm: 'default' });
      spyOn(delivery, 'requestDesktopPermission').and.returnValue(Promise.resolve('denied' as NotificationPermission));
      flip('Desktop browser notifications'); tick(); fixture.detectChanges();
      expect(updateSpy).toHaveBeenCalledWith({ desktop_notifications: false });
      expect(prefs.prefs.desktop_notifications).toBeFalse();
      expect(warn).toHaveBeenCalled();
      flush();
    }));

    it('switching it off never asks the browser', fakeAsync(() => {
      init({ perm: 'granted', p: { desktop_notifications: true } });
      const ask = spyOn(delivery, 'requestDesktopPermission');
      flip('Desktop browser notifications'); tick();
      expect(ask).not.toHaveBeenCalled();
      expect(updateSpy).toHaveBeenCalledWith({ desktop_notifications: false });
      flush();
    }));

    it('permission not asked yet: says the browser will ask', fakeAsync(() => {
      init({ perm: 'default' });
      expect(el().textContent).toContain('Your browser will ask for permission');
      flush();
    }));

    it('permission granted: says so, and the switch is usable', fakeAsync(() => {
      init({ perm: 'granted', p: { desktop_notifications: true } });
      expect(el().textContent).toContain('Allowed in your browser');
      expect(toggle('Desktop browser notifications').classList.contains('mat-checked')).toBeTrue();
      expect(toggle('Desktop browser notifications').classList.contains('mat-disabled')).toBeFalse();
      flush();
    }));

    it('permission blocked: explains how to fix it, the switch is disabled and shows off', fakeAsync(() => {
      init({ perm: 'denied', p: { desktop_notifications: true } });
      expect(q('.np-warn')!.textContent).toContain('Blocked in your browser');
      expect(toggle('Desktop browser notifications').classList.contains('mat-disabled')).toBeTrue();
      expect(toggle('Desktop browser notifications').classList.contains('mat-checked')).toBeFalse();   // never shown as on while blocked
      flush();
    }));

    it('no browser support: says so and the switch is disabled', fakeAsync(() => {
      init({ perm: 'unsupported' });
      expect(el().textContent).toContain('does not support desktop notifications');
      expect(toggle('Desktop browser notifications').classList.contains('mat-disabled')).toBeTrue();
      flush();
    }));

    it('reacts when the permission changes while the page is open', fakeAsync(() => {
      init({ perm: 'default' });
      delivery.permission$.next('denied'); fixture.detectChanges();
      expect(q('.np-warn')).not.toBeNull();
      flush();
    }));
  });

  // ------------------------------------------------------------------------ sound
  describe('sound', () => {
    it('the volume slider is disabled while sound is off', fakeAsync(() => {
      init();
      expect(q('mat-slider')!.getAttribute('aria-disabled')).toBe('true');
      flush();
    }));

    it('and usable once sound is on, showing the volume', fakeAsync(() => {
      init({ p: { sound: true, sound_volume: 40 } });
      expect(q('mat-slider')!.getAttribute('aria-disabled')).toBe('false');
      expect(q('.np-vol-num')!.textContent).toContain('40%');
      flush();
    }));

    it('changing the volume saves it', fakeAsync(() => {
      init({ p: { sound: true } });
      component.setPref('sound_volume', 25);
      expect(updateSpy).toHaveBeenCalledWith({ sound_volume: 25 });
      fixture.detectChanges();
      expect(q('.np-vol-num')!.textContent).toContain('25%');
      flush();
    }));

    it('Test sound plays the notification sound', fakeAsync(() => {
      init();
      const test = spyOn(delivery, 'testSound');
      button('Test sound').click();
      expect(test).toHaveBeenCalledTimes(1);
      flush();
    }));
  });

  // ------------------------------------------------------------------------ quick actions
  describe('enable all, disable all, restore defaults', () => {
    it('Enable all turns everything on, including desktop only when the browser already allows it', fakeAsync(() => {
      init({ perm: 'granted' });
      const all = spyOn(prefs, 'setAll').and.callThrough();
      button('Enable all').click();
      expect(all).toHaveBeenCalledWith(true, { desktop_notifications: true });
      flush();
    }));

    it('Enable all leaves desktop off when the browser has not allowed it', fakeAsync(() => {
      init({ perm: 'default' });
      const all = spyOn(prefs, 'setAll').and.callThrough();
      button('Enable all').click();
      expect(all).toHaveBeenCalledWith(true, { desktop_notifications: false });
      expect(prefs.prefs.desktop_notifications).toBeFalse();
      expect(prefs.prefs.sound).toBeTrue();
      flush();
    }));

    it('Disable all turns everything off at once', fakeAsync(() => {
      init();
      button('Disable all').click(); fixture.detectChanges();
      expect(qa('mat-slide-toggle.mat-checked').length).toBe(0);
      expect(prefs.prefs.messages_enabled).toBeFalse();
      expect(prefs.prefs.post_comments).toBeFalse();
      flush();
    }));

    it('Restore defaults asks first, then resets', fakeAsync(() => {
      init({ p: { sound: true, toast: false } });
      const reset = spyOn(prefs, 'reset');
      const dialog = spyOn(TestBed.inject(MatDialog), 'open').and.returnValue({ afterClosed: () => of(true) } as any);
      button('Restore defaults').click();
      expect(dialog).toHaveBeenCalled();
      expect(reset).toHaveBeenCalledTimes(1);
      flush();
    }));

    it('and does nothing if the user cancels', fakeAsync(() => {
      init();
      const reset = spyOn(prefs, 'reset');
      spyOn(TestBed.inject(MatDialog), 'open').and.returnValue({ afterClosed: () => of(false) } as any);
      button('Restore defaults').click();
      expect(reset).not.toHaveBeenCalled();
      flush();
    }));
  });

  // ------------------------------------------------------------------------ saving feedback
  describe('save feedback', () => {
    const status = () => q('.np-status')!.textContent!.trim();

    it('says changes apply immediately and are saved to the account', fakeAsync(() => {
      init();
      expect(status()).toContain('Saved to your account');
      flush();
    }));

    it('shows Saving, then All changes saved', fakeAsync(() => {
      init();
      prefs.status$.next({ state: 'saving' }); fixture.detectChanges();
      expect(status()).toContain('Saving');
      prefs.status$.next({ state: 'saved' }); fixture.detectChanges();
      expect(status()).toContain('All changes saved');
      flush();
    }));

    it('shows the error and that the settings were put back', fakeAsync(() => {
      init();
      prefs.status$.next({ state: 'error', message: 'No connection. Your change was not saved.' }); fixture.detectChanges();
      expect(status()).toContain('No connection');
      expect(status()).toContain('put back');
      expect(q('.np-status')!.classList).toContain('error');
      flush();
    }));
  });

  // ------------------------------------------------------------------------ preview
  describe('preview', () => {
    const toast = () => q('.np-toast')!;

    it('shows the latest real message: sender photo, name, text and time', fakeAsync(() => {
      init();
      expect(toast().textContent).toContain('Dana Latest');
      expect(toast().textContent).toContain('Lunch at noon?');
      expect((toast().querySelector('img') as HTMLImageElement).src).toContain('dana.png');
      expect(toast().querySelector('time')!.textContent!.trim().length).toBeGreaterThan(0);
      expect(el().textContent).toContain('This is your latest message');
      flush();
    }));

    it('with preview OFF the text is replaced by a generic line', fakeAsync(() => {
      init({ p: { message_preview: false } });
      expect(toast().textContent).toContain('Sent you a message');
      expect(toast().textContent).not.toContain('Lunch at noon?');
      flush();
    }));

    it('updates the moment the Message preview switch is flipped', fakeAsync(() => {
      init();
      flip('Message preview'); fixture.detectChanges();
      expect(toast().textContent).toContain('Sent you a message');
      flip('Message preview'); fixture.detectChanges();
      expect(toast().textContent).toContain('Lunch at noon?');
      flush();
    }));

    it('says clearly when message notifications are off, and dims the card', fakeAsync(() => {
      init({ p: { messages_enabled: false } });
      expect(q('.np-off')!.textContent).toContain('Message notifications are off');
      expect(toast().classList).toContain('off');
      flush();
    }));

    it('dims the card and explains when only the popup is off', fakeAsync(() => {
      init({ p: { toast: false } });
      expect(toast().classList).toContain('off');
      expect(el().textContent).toContain('The popup is off');
      flush();
    }));

    it('clicking it opens that conversation', fakeAsync(() => {
      init();
      const open = spyOn(delivery, 'openConversation');
      toast().click();
      expect(open).toHaveBeenCalledWith(9);
      flush();
    }));

    it('with no messages yet it shows an example and says so; clicking goes to Messages', fakeAsync(() => {
      init({ conv: null });
      expect(toast().textContent).toContain('Alex Rivera');
      expect(el().textContent).toContain('This is an example');
      const nav = spyOn(TestBed.inject(Router), 'navigate');
      toast().click();
      expect(nav).toHaveBeenCalled();
      expect((nav.calls.mostRecent().args[0] as string[])[0]).toContain('/message');
      flush();
    }));
  });
});
