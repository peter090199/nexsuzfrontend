import { NexsuzTestingModule } from 'src/testing/nexsuz-testing.module';
import { ComponentFixture, TestBed, fakeAsync, flush, tick } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { NotificationComponent } from './notification.component';
import { ChatService } from 'src/app/services/chat.service';
import { EchoService } from 'src/app/services/echo.service';
import { ActivityItem, NotificationDeliveryService } from 'src/app/services/notification-delivery.service';
import { SharedRoutinesService } from 'src/app/services/Function/shared-routines.service';

let tick1 = 0;   // each item is a second older than the one before, so the feed order is the order given
const item = (over: Partial<ActivityItem>): ActivityItem => ({
  id: 'x', type: 'reaction', text: 'reacted Love to your post', created_at: new Date(Date.now() - 1000 * tick1++).toISOString(), unread: true,
  actor: { code: 702, user_id: 2, fullname: 'Pal Tester', photo_pic: null }, ...over,
});

describe('NotificationComponent: feed (messages + activity)', () => {
  let fixture: ComponentFixture<NotificationComponent>;
  let component: NotificationComponent;
  let delivery: NotificationDeliveryService;
  let nav: jasmine.Spy;

  const el = () => fixture.nativeElement as HTMLElement;
  const q = (s: string) => el().querySelector(s) as HTMLElement | null;
  const qa = (s: string) => Array.from(el().querySelectorAll(s)) as HTMLElement[];

  let chat: ChatService;
  const init = (items: ActivityItem[] | 'error' = [], unreadMessages: any[] = []) => {
    tick1 = 0;
    chat = TestBed.inject(ChatService);
    spyOn(chat, 'getNotifications').and.returnValue(of({ notifications: unreadMessages }));
    spyOn(chat, 'getIsRead').and.returnValue(of({ notifications: [] }));
    spyOn(chat, 'markMessagesAsRead').and.returnValue(of({}));
    delivery = TestBed.inject(NotificationDeliveryService);
    spyOn(delivery, 'fetchActivity').and.returnValue(items === 'error' ? throwError(() => ({ status: 500 })) : of({ success: true, data: items, unread_count: 0 }));
    spyOn(delivery, 'markActivityRead').and.returnValue(of({ success: true }));
    spyOn(delivery, 'refreshActivity');
    spyOn(delivery, 'openConversation');
    nav = spyOn(TestBed.inject(Router), 'navigate');

    fixture = TestBed.createComponent(NotificationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  /** the Activity filter pill */
  const openTab = () => {
    const pill = qa('.pill').find(l => l.textContent!.trim().startsWith('Activity'))!;
    expect(pill).withContext('the Activity pill exists').toBeDefined();
    pill.click(); fixture.detectChanges(); tick(); fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NexsuzTestingModule],
      declarations: [NotificationComponent],
      providers: [
        { provide: EchoService, useValue: { notificationCount$: of(0) } },
        { provide: SharedRoutinesService, useValue: { getRole: () => 'DEF-USERS' } },
      ],
    }).compileComponents();
  });

  it('has All, Messages and Activity pills', fakeAsync(() => {
    init();
    expect(qa('.pill').map(l => l.textContent!.trim().replace(/\s+/g, ' '))).toEqual(['All', 'Messages', 'Activity']);
    flush();
  }));

  it('loads activity when the popup opens, but only marks it read once the Activity pill is chosen', fakeAsync(() => {
    init([item({})]);
    expect(delivery.fetchActivity).toHaveBeenCalledTimes(1);
    expect(delivery.markActivityRead).not.toHaveBeenCalled();
    openTab();
    expect(delivery.markActivityRead).toHaveBeenCalledTimes(1);
    flush();
  }));

  it('mixes messages and activity newest first, and the pills filter them', fakeAsync(() => {
    const msg = { id: 7, sender_id: 9, fullname: 'Max Sender', message: 'Hello there', photo_pic: null, created_at: new Date(Date.now() + 500).toISOString(), is_read: 0 };
    init([item({ id: 'a', type: 'friend_request', text: 'sent you a friend request' })], [msg]);
    expect(qa('.activity-item').length).toBe(2);
    expect(qa('.activity-item')[0].textContent).toContain('Max Sender');
    qa('.pill')[1].click(); fixture.detectChanges();
    expect(qa('.activity-item').length).toBe(1);
    expect(qa('.activity-item')[0].textContent).toContain('Hello there');
    flush();
  }));

  it('clicking a message marks it read and opens that chat', fakeAsync(() => {
    const msg = { id: 7, sender_id: 9, fullname: 'Max Sender', message: 'Hello there', photo_pic: null, created_at: new Date().toISOString(), is_read: 0 };
    init([], [msg]);
    qa('.activity-item')[0].click();
    expect(chat.markMessagesAsRead).toHaveBeenCalledWith(7);
    expect(delivery.openConversation).toHaveBeenCalledWith(9);
    flush();
  }));

  it('lists who did what: photo, name, action, a comment excerpt and the time', fakeAsync(() => {
    init([
      item({ id: 'a', type: 'friend_request', text: 'sent you a friend request' }),
      item({ id: 'b', type: 'comment', text: 'commented on your post', excerpt: 'Great work!', actor: { code: 703, user_id: 3, fullname: 'Cy Writer', photo_pic: 'http://localhost/cy.png' } }),
    ]);
    openTab();
    const rows = qa('.activity-item');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('Pal Tester');
    expect(rows[0].textContent).toContain('sent you a friend request');
    expect(rows[1].textContent).toContain('Cy Writer');
    expect(rows[1].textContent).toContain('commented on your post');
    expect(rows[1].textContent).toContain('"Great work!"');
    expect((rows[1].querySelector('img') as HTMLImageElement).src).toContain('cy.png');
    expect(rows[0].querySelector('time')!.textContent!.trim()).toBe('Just now');
    flush();
  }));

  it('uses a different icon for each kind of activity', fakeAsync(() => {
    init([item({ id: '1', type: 'friend_request' }), item({ id: '2', type: 'friend_accept' }), item({ id: '3', type: 'reaction' }), item({ id: '4', type: 'comment' }), item({ id: '5', type: 'job_application' }), item({ id: '6', type: 'job_interview' }), item({ id: '7', type: 'job_status' }), item({ id: '8', type: 'job_review' })]);
    expect(qa('.act-badge').map(b => b.textContent!.trim())).toEqual(['person_add', 'how_to_reg', 'thumb_up', 'chat_bubble', 'work', 'event', 'verified', 'rate_review']);
    flush();
  }));

  it('marks new items and clears them once the tab has been seen', fakeAsync(() => {
    init([item({ id: 'n', unread: true }), item({ id: 'o', unread: false })]);
    openTab();
    expect(qa('.activity-item.unread').length).toBe(1);
    expect(qa('.act-unread').length).toBe(1);
    expect(delivery.markActivityRead).toHaveBeenCalledTimes(1);       // opening the tab is what marks it read
    flush();
  }));

  it('does not call mark-read when there is nothing new', fakeAsync(() => {
    init([item({ unread: false })]);
    openTab();
    expect(delivery.markActivityRead).not.toHaveBeenCalled();
    flush();
  }));

  it('shows an empty state', fakeAsync(() => {
    init([]);
    openTab();
    expect(el().textContent).toContain('all caught up');
    flush();
  }));

  it('shows an error with Try again', fakeAsync(() => {
    init('error');
    openTab();
    expect(el().textContent).toContain("Couldn't load your activity");
    (delivery.fetchActivity as jasmine.Spy).and.returnValue(of({ success: true, data: [item({})], unread_count: 0 }));
    const retry = qa('.no-notifications button').find(b => b.textContent!.includes('Try again'))!;
    retry.click(); fixture.detectChanges();
    expect(qa('.activity-item').length).toBe(1);
    flush();
  }));

  describe('clicking an item', () => {
    it('a friend request goes to the network page', fakeAsync(() => {
      init([item({ type: 'friend_request' })]);
      openTab(); qa('.activity-item')[0].click();
      expect(nav).toHaveBeenCalledWith(['/DEF-USERS/network']);
      flush();
    }));

    it('an accepted request opens that person\'s profile', fakeAsync(() => {
      init([item({ type: 'friend_accept', actor: { code: 705, user_id: 5, fullname: 'Erin', photo_pic: null } })]);
      openTab(); qa('.activity-item')[0].click();
      expect(nav).toHaveBeenCalledWith(['/DEF-USERS/profile', 705]);
      flush();
    }));

    it('a reaction or comment goes to your own profile where the post is', fakeAsync(() => {
      init([item({ type: 'reaction' }), item({ id: 'c', type: 'comment' })]);
      openTab();
      qa('.activity-item')[0].click();
      qa('.activity-item')[1].click();
      expect(nav.calls.allArgs()).toEqual([[['/DEF-USERS/profile']], [['/DEF-USERS/profile']]]);
      flush();
    }));

    it('job events go to the right page', fakeAsync(() => {
      init([item({ type: 'job_application' }), item({ id: 'i', type: 'job_interview' }), item({ id: 's', type: 'job_status' }), item({ id: 'r', type: 'job_review' })]);
      qa('.activity-item').forEach(r => r.click());
      expect(nav.calls.allArgs()).toEqual([[['/DEF-USERS/candidates']], [['/DEF-USERS/applied-jobs']], [['/DEF-USERS/applied-jobs']], [['/DEF-USERS/applied-jobs']]]);
      flush();
    }));

    it('works with the keyboard too', fakeAsync(() => {
      init([item({ type: 'friend_request' })]);
      openTab();
      qa('.activity-item')[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      expect(nav).toHaveBeenCalled();
      flush();
    }));
  });

  it('describes times in plain words', fakeAsync(() => {
    init();
    const ago = (ms: number) => component.ago(new Date(Date.now() - ms).toISOString());
    expect(ago(5 * 1000)).toBe('Just now');
    expect(ago(5 * 60000)).toBe('5 min ago');
    expect(ago(3 * 3600000)).toBe('3 h ago');
    expect(ago(2 * 86400000)).toBe('2 d ago');
    flush();
  }));
});
