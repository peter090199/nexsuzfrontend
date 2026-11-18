import { NexsuzTestingModule } from 'src/testing/nexsuz-testing.module';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed, discardPeriodicTasks, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { BehaviorSubject, NEVER, Subject, of, throwError } from 'rxjs';

import { MessengerChatComponent } from './messenger-chat.component';
import { ChatService } from '../services/chat.service';
import { EchoService } from '../services/echo.service';
import { AuthService } from '../services/auth.service';
import { NotificationsService } from '../services/Global/notifications.service';
import { SharedRoutinesService } from '../services/Function/shared-routines.service';

const iso = (daysAgo = 0, hour = 10, minute = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
};

const ME = 1;

const conversations = () => ({
  success: true,
  unread_total: 2,
  data: [
    { user_id: 2, code: 702, fullname: 'Bob Builder', photo_pic: null, is_online: true, unread_count: 2,
      last_message: { id: 30, message: 'see you at 5', sender_id: 2, is_read: false, created_at: iso(0, 9, 30) } },
    { user_id: 3, code: 703, fullname: 'Carol Singer', photo_pic: null, is_online: false, unread_count: 0,
      last_message: { id: 20, message: 'ok thanks', sender_id: ME, is_read: true, created_at: iso(1, 18, 0) } },
    { user_id: 4, code: 704, fullname: 'Dan Online', photo_pic: null, is_online: true, unread_count: 0,
      last_message: { id: 10, message: 'hello dan', sender_id: ME, is_read: false, created_at: iso(10, 8, 0) } },
  ]
});

const history = () => ([
  { id: 1, sender_id: 2, receiver_id: ME, message: 'older day', created_at: iso(1, 17, 0), is_read: true },
  { id: 2, sender_id: ME, receiver_id: 2, message: 'my reply', created_at: iso(1, 17, 2), is_read: true },
  { id: 29, sender_id: 2, receiver_id: ME, message: 'hi there', created_at: iso(0, 9, 29), is_read: false },
  { id: 30, sender_id: 2, receiver_id: ME, message: 'see you at 5', created_at: iso(0, 9, 30), is_read: false },
  { id: 31, sender_id: ME, receiver_id: 2, message: 'sure!', created_at: iso(0, 9, 31), is_read: false },
]);

describe('MessengerChatComponent (Messages page)', () => {
  let fixture: ComponentFixture<MessengerChatComponent>;
  let component: MessengerChatComponent;
  let chat: jasmine.SpyObj<ChatService>;
  let notify: jasmine.SpyObj<NotificationsService>;
  let count$: BehaviorSubject<number>;
  let queryUser: string | null;

  const el = () => fixture.nativeElement as HTMLElement;
  const q = (sel: string) => el().querySelector(sel) as HTMLElement | null;
  const qa = (sel: string) => Array.from(el().querySelectorAll(sel)) as HTMLElement[];
  const names = () => qa('.msgr-side .conv .name').map(n => n.textContent!.trim());
  const type = (text: string) => {
    const ta = q('textarea.input') as HTMLTextAreaElement;
    ta.value = text; ta.dispatchEvent(new Event('input')); fixture.detectChanges();
  };
  const press = (key: string, shift = false) => {
    const ta = q('textarea.input') as HTMLTextAreaElement;
    ta.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey: shift, bubbles: true, cancelable: true }));
    fixture.detectChanges();
  };

  /** let the component's own short timers (focus, refresh guard) finish, then drop the 8 s poll */
  const end = () => { tick(2000); discardPeriodicTasks(); };

  /** build the component; the API answers are set on the spies BEFORE calling this */
  const init = () => {
    fixture = TestBed.createComponent(MessengerChatComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();            // ngOnInit
    tick(); fixture.detectChanges();
  };

  beforeEach(async () => {
    localStorage.clear();
    queryUser = null;
    count$ = new BehaviorSubject<number>(0);
    chat = jasmine.createSpyObj<ChatService>('ChatService',
      ['getConversations', 'getMessages', 'sendMessage', 'markConversationRead', 'getActiveMessages', 'loadNotifications']);
    chat.getConversations.and.returnValue(of(conversations()));
    chat.getMessages.and.returnValue(of(history()));
    chat.sendMessage.and.callFake((to: number, message: string) =>
      of({ success: true, data: { id: 99, sender_id: ME, receiver_id: to, message, created_at: new Date().toISOString(), is_read: 0 } }));
    chat.markConversationRead.and.returnValue(of({ message: 'ok', updated: 2 }));
    chat.getActiveMessages.and.returnValue(of([
      { id: ME, code: 701, fullname: 'Me Myself', photo_pic: null, is_online: 1 },
      { id: 2, code: 702, fullname: 'Bob Builder', photo_pic: null, is_online: 1 },
      { id: 5, code: 705, fullname: 'Erin Newperson', photo_pic: null, is_online: 0 },
    ]));
    notify = jasmine.createSpyObj<NotificationsService>('NotificationsService', ['toastrSuccess', 'toastrError', 'toastrInfo', 'toastrWarning']);

    await TestBed.configureTestingModule({
      imports: [NexsuzTestingModule],
      declarations: [MessengerChatComponent],
      providers: [
        { provide: ChatService, useValue: chat },
        { provide: EchoService, useValue: { notificationCount$: count$.asObservable() } },
        { provide: AuthService, useValue: { getData: () => of({ id: ME }) } },
        { provide: NotificationsService, useValue: notify },
        { provide: SharedRoutinesService, useValue: { getRole: () => 'DEF-USERS' } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: (k: string) => (k === 'user' ? queryUser : null) } } } },
      ],
    }).compileComponents();
  });

  afterEach(() => localStorage.clear());

  // ----------------------------------------------------------------------------- conversation list
  describe('conversation list (GET conversations)', () => {
    it('asks the API and shows real conversations: name, last message, time, unread badge, online dot', fakeAsync(() => {
      init();
      expect(chat.getConversations).toHaveBeenCalledTimes(1);
      expect(names()).toEqual(['Bob Builder', 'Carol Singer', 'Dan Online']);

      const bob = qa('.msgr-side .conv')[0];
      expect(bob.textContent).toContain('see you at 5');
      expect(bob.querySelector('.badge')!.textContent!.trim()).toBe('2');
      expect(bob.querySelector('.dot')).not.toBeNull();
      expect(bob.classList).toContain('unread');

      const carol = qa('.msgr-side .conv')[1];
      expect(carol.textContent).toContain('You: ok thanks');                 // my own message is prefixed
      expect(carol.querySelector('.badge')).toBeNull();
      expect(carol.querySelector('.dot')).toBeNull();
      expect(carol.querySelector('.when')!.textContent!.trim()).toBe('Yesterday');
      end();
    }));

    it('shows a loading skeleton, then the list', fakeAsync(() => {
      chat.getConversations.and.returnValue(NEVER);                    // the server has not answered yet
      init();
      expect(component.loadingList).toBeTrue();
      expect(qa('.skeleton-row').length).toBeGreaterThan(0);
      expect(names()).toEqual([]);
      end();
    }));

    it('shows an error with a Try again button, and the button asks the API again', fakeAsync(() => {
      chat.getConversations.and.returnValue(throwError(() => ({ status: 500 })));
      init();
      expect(q('.state[role="alert"]')!.textContent).toContain("Couldn't load your conversations");

      chat.getConversations.and.returnValue(of(conversations()));
      (q('.state[role="alert"] button') as HTMLButtonElement).click();
      tick(); fixture.detectChanges();
      expect(chat.getConversations).toHaveBeenCalledTimes(2);
      expect(names().length).toBe(3);
      expect(q('.state[role="alert"]')).toBeNull();
      end();
    }));

    it('an empty inbox is an empty state with a New message button, not an error', fakeAsync(() => {
      chat.getConversations.and.returnValue(of({ success: true, data: [], unread_total: 0 }));
      init();
      expect(q('.state strong')!.textContent).toContain('No conversations yet');
      expect(q('.state[role="alert"]')).toBeNull();
      expect(q('.state button')!.textContent).toContain('New message');
      end();
    }));
  });

  // ----------------------------------------------------------------------------- tabs
  describe('All / Unread / Online / Archived tabs', () => {
    const tab = (label: string) => qa('.tabs button').find(b => b.textContent!.trim().startsWith(label))!;

    it('counts and filters', fakeAsync(() => {
      init();
      expect(tab('Unread').textContent).toContain('1');
      expect(tab('Online').textContent).toContain('2');

      tab('Unread').click(); fixture.detectChanges();
      expect(names()).toEqual(['Bob Builder']);

      tab('Online').click(); fixture.detectChanges();
      expect(names()).toEqual(['Bob Builder', 'Dan Online']);

      tab('All').click(); fixture.detectChanges();
      expect(names().length).toBe(3);
      end();
    }));

    it('archiving hides a conversation from the inbox and lists it under Archived (kept in this browser)', fakeAsync(() => {
      init();
      component.toggleArchive(component.conversations[1]);       // Carol
      fixture.detectChanges();
      expect(names()).toEqual(['Bob Builder', 'Dan Online']);
      expect(JSON.parse(localStorage.getItem('nx-chat-archived-1')!)).toEqual([3]);

      tab('Archived').click(); fixture.detectChanges();
      expect(names()).toEqual(['Carol Singer']);

      component.toggleArchive(component.conversations[1]);       // unarchive
      fixture.detectChanges();
      expect(names()).toEqual([]);
      expect(q('.state strong')!.textContent).toContain('No archived conversations');
      end();
    }));

    it('a new message brings an archived conversation back so nothing is missed', fakeAsync(() => {
      localStorage.setItem('nx-chat-archived-1', JSON.stringify([2]));      // Bob archived, but Bob has 2 unread
      init();
      expect(names()).toContain('Bob Builder');
      expect(JSON.parse(localStorage.getItem('nx-chat-archived-1')!)).toEqual([]);
      end();
    }));
  });

  // ----------------------------------------------------------------------------- search
  describe('search', () => {
    const search = (text: string) => {
      const input = q('.search input') as HTMLInputElement;
      input.value = text; input.dispatchEvent(new Event('input')); tick(); fixture.detectChanges();
    };

    it('filters conversations by name', fakeAsync(() => {
      init(); search('carol');
      expect(names()).toEqual(['Carol Singer']);
      end();
    }));

    it('filters conversations by what was said', fakeAsync(() => {
      init(); search('hello dan');
      expect(names()).toEqual(['Dan Online']);
      end();
    }));

    it('offers people from the user list that you have not talked to, and opens a new chat with them', fakeAsync(() => {
      chat.getMessages.and.returnValue(of([]));
      init(); search('erin');
      expect(chat.getActiveMessages).toHaveBeenCalled();
      expect(q('.section')!.textContent).toContain('People');
      const person = qa('.conv.person')[0];
      expect(person.textContent).toContain('Erin Newperson');

      person.click(); tick(); fixture.detectChanges();
      expect(chat.getMessages).toHaveBeenCalledWith(5);
      expect(component.selected!.fullname).toBe('Erin Newperson');
      expect(q('.state.hello')!.textContent).toContain('No messages yet');
      end();
    }));

    it('never offers yourself or people you already talk to under People', fakeAsync(() => {
      init(); search('b');
      const people = qa('.conv.person').map(p => p.textContent);
      expect(people.join('')).not.toContain('Me Myself');
      expect(people.join('')).not.toContain('Bob Builder');
      end();
    }));

    it('says so when nothing matches', fakeAsync(() => {
      init(); search('zzzz');
      expect(q('.state strong')!.textContent).toContain('No results for "zzzz"');
      end();
    }));
  });

  // ----------------------------------------------------------------------------- opening a chat
  describe('opening a conversation', () => {
    const openBob = () => { qa('.msgr-side .conv')[0].click(); tick(); fixture.detectChanges(); };

    it('loads that person\'s history from the API', fakeAsync(() => {
      init(); openBob();
      expect(chat.getMessages).toHaveBeenCalledWith(2);
      expect(qa('.bubble').map(b => b.textContent!.trim())).toEqual(['older day', 'my reply', 'hi there', 'see you at 5', 'sure!']);
      expect(q('.chat-head strong')!.textContent).toContain('Bob Builder');
      expect(q('.chat-head small')!.textContent).toContain('Online');
      end();
    }));

    it('marks the conversation read on the server, clears the badge and refreshes the top-bar count', fakeAsync(() => {
      init(); openBob();
      expect(chat.markConversationRead).toHaveBeenCalledWith(2);
      expect(chat.loadNotifications).toHaveBeenCalled();
      expect(component.conversations[0].unread_count).toBe(0);
      expect(qa('.msgr-side .conv')[0].querySelector('.badge')).toBeNull();
      expect(qa('.msgr-side .conv')[0].classList).not.toContain('unread');
      end();
    }));

    it('does not call mark-read when there is nothing unread', fakeAsync(() => {
      chat.getMessages.and.returnValue(of(history().map(m => ({ ...m, is_read: true }))));
      init(); qa('.msgr-side .conv')[1].click(); tick(); fixture.detectChanges();      // Carol: 0 unread
      expect(chat.markConversationRead).not.toHaveBeenCalled();
      end();
    }));

    it('separates days with Today / Yesterday labels', fakeAsync(() => {
      init(); openBob();
      expect(qa('.sep span').map(s => s.textContent!.trim())).toEqual(['Yesterday', 'Today']);
      end();
    }));

    it('styles my messages and theirs differently and shows a time under each run', fakeAsync(() => {
      init(); openBob();
      const msgs = qa('.msg');
      expect(msgs.map(m => m.classList.contains('mine'))).toEqual([false, true, false, false, true]);
      expect(qa('.foot time').length).toBeGreaterThan(0);
      end();
    }));

    it('shows Delivered, or Seen once the other person has read my last message', fakeAsync(() => {
      init(); openBob();
      expect(q('.msg.mine:last-child .st.sent, .msg:last-child .st.sent')!.textContent).toContain('Delivered');

      const seen = history().map(m => ({ ...m, is_read: true }));
      chat.getMessages.and.returnValue(of(seen));
      component.refresh(); tick(); fixture.detectChanges();
      expect(qa('.st.read').length).toBeGreaterThan(0);
      expect(qa('.st.read')[0].textContent).toContain('Seen');
      end();
    }));

    it('shows an error with Try again when the history cannot be loaded', fakeAsync(() => {
      chat.getMessages.and.returnValue(throwError(() => ({ status: 500 })));
      init(); openBob();
      expect(q('.chat-body .state[role="alert"]')!.textContent).toContain("Couldn't load this conversation");
      chat.getMessages.and.returnValue(of(history()));
      (q('.chat-body .state[role="alert"] button') as HTMLButtonElement).click(); tick(); fixture.detectChanges();
      expect(qa('.bubble').length).toBe(5);
      end();
    }));

    it('opens the chat named in ?user= straight away', fakeAsync(() => {
      queryUser = '3';
      init();
      expect(component.selected!.user_id).toBe(3);
      expect(chat.getMessages).toHaveBeenCalledWith(3);
      end();
    }));

    it('has an empty state until a conversation is chosen', fakeAsync(() => {
      init();
      expect(q('.blank h2')!.textContent).toContain('Your messages');
      expect(q('.composer')).toBeNull();
      end();
    }));
  });

  // ----------------------------------------------------------------------------- sending
  describe('sending (POST send-message)', () => {
    const openBob = () => { qa('.msgr-side .conv')[0].click(); tick(); fixture.detectChanges(); };

    it('Enter sends the trimmed text to that person and clears the box', fakeAsync(() => {
      init(); openBob();
      type('  Hello Bob  '); press('Enter');
      tick(); fixture.detectChanges();
      expect(chat.sendMessage).toHaveBeenCalledOnceWith(2, 'Hello Bob');
      expect(component.draft).toBe('');
      expect(qa('.bubble').pop()!.textContent!.trim()).toBe('Hello Bob');
      expect(chat.getConversations).toHaveBeenCalledTimes(2);                      // the list refreshed with the new last message
      end();
    }));

    it('the Send button works too, and is disabled for an empty or whitespace-only box', fakeAsync(() => {
      init(); openBob();
      const btn = q('.send') as HTMLButtonElement;
      expect(btn.disabled).toBeTrue();
      type('   '); expect(btn.disabled).toBeTrue();
      type('hi'); expect(btn.disabled).toBeFalse();
      btn.click(); tick();
      expect(chat.sendMessage).toHaveBeenCalledOnceWith(2, 'hi');
      end();
    }));

    it('Shift+Enter makes a new line instead of sending', fakeAsync(() => {
      init(); openBob();
      type('line one'); press('Enter', true);
      expect(chat.sendMessage).not.toHaveBeenCalled();
      end();
    }));

    it('refuses more than 5000 characters', fakeAsync(() => {
      init(); openBob();
      component.draft = 'x'.repeat(5001); fixture.detectChanges();
      component.send();
      expect(chat.sendMessage).not.toHaveBeenCalled();
      expect(component.canSend).toBeFalse();
      end();
    }));

    it('shows the message at once as "Sending…", then as sent', fakeAsync(() => {
      const never = new Subject<any>();
      chat.sendMessage.and.returnValue(never);
      init(); openBob();
      type('slow one'); press('Enter'); fixture.detectChanges();
      expect(qa('.bubble').pop()!.textContent).toContain('slow one');
      expect(q('.st.sending')!.textContent).toContain('Sending');

      never.next({ success: true, data: { id: 77, sender_id: ME, receiver_id: 2, message: 'slow one', created_at: new Date().toISOString(), is_read: 0 } });
      tick(); fixture.detectChanges();
      expect(q('.st.sending')).toBeNull();
      expect(component.messages.some(m => m.id === 77)).toBeTrue();
      end();
    }));

    it('a failed send is marked "Not sent", keeps the text, tells the user, and Retry sends it again', fakeAsync(() => {
      chat.sendMessage.and.returnValue(throwError(() => ({ status: 500, error: { message: 'Server error' } })));
      init(); openBob();
      type('flaky'); press('Enter'); tick(); fixture.detectChanges();
      expect(q('.st.fail')!.textContent).toContain('Not sent');
      expect(qa('.bubble').pop()!.textContent).toContain('flaky');
      expect(notify.toastrError).toHaveBeenCalledWith('Server error');

      chat.sendMessage.and.callFake((to: number, message: string) =>
        of({ success: true, data: { id: 88, sender_id: ME, receiver_id: to, message, created_at: new Date().toISOString(), is_read: 0 } }));
      (q('.st.fail button') as HTMLButtonElement).click(); tick(); fixture.detectChanges();
      expect(chat.sendMessage).toHaveBeenCalledTimes(2);
      expect(q('.st.fail')).toBeNull();
      expect(component.messages.some(m => m.id === 88)).toBeTrue();
      end();
    }));

    it('shows the server\'s validation message (e.g. a person that no longer exists)', fakeAsync(() => {
      chat.sendMessage.and.returnValue(throwError(() => ({ status: 422, error: { errors: { receiver_id: ['That person could not be found.'] } } })));
      init(); openBob();
      type('hello'); press('Enter'); tick();
      expect(notify.toastrError).toHaveBeenCalledWith('That person could not be found.');
      end();
    }));
  });

  // ----------------------------------------------------------------------------- composer tools
  describe('emoji and copy', () => {
    const openBob = () => { qa('.msgr-side .conv')[0].click(); tick(); fixture.detectChanges(); };

    it('the emoji picker inserts an emoji at the cursor', fakeAsync(() => {
      init(); openBob();
      type('Hello ');
      (q('.emoji-btn') as HTMLButtonElement).click(); fixture.detectChanges();
      expect(q('.emoji-panel')).not.toBeNull();
      (qa('.emoji-panel button')[0] as HTMLButtonElement).click(); tick(); fixture.detectChanges();
      expect(component.draft).toBe('Hello ' + component.emojis[0]);
      end();
    }));

    it('copy puts the message text on the clipboard', fakeAsync(() => {
      init(); openBob();
      const write = jasmine.createSpy('writeText').and.returnValue(Promise.resolve());
      spyOnProperty(navigator, 'clipboard', 'get').and.returnValue({ writeText: write } as any);
      component.copy(component.messages[0]); tick();
      expect(write).toHaveBeenCalledWith('older day');
      expect(notify.toastrSuccess).toHaveBeenCalledWith('Message copied.');
      end();
    }));
  });

  // ----------------------------------------------------------------------------- new message dialog
  describe('new message', () => {
    it('lists people from the API, filters them, and starts a chat', fakeAsync(() => {
      chat.getMessages.and.returnValue(of([]));
      init();
      const app = TestBed.inject(ApplicationRef);
      component.openNew(); tick(); fixture.detectChanges(); app.tick();
      expect(chat.getActiveMessages).toHaveBeenCalled();
      const rows = () => Array.from(document.querySelectorAll('.nm .conv .name')).map(n => n.textContent!.trim());
      expect(rows()).toEqual(['Bob Builder', 'Erin Newperson']);              // never myself

      component.newQuery = 'erin'; fixture.detectChanges(); app.tick();
      expect(rows()).toEqual(['Erin Newperson']);

      (document.querySelector('.nm .conv') as HTMLButtonElement).click(); tick(); fixture.detectChanges(); app.tick();
      expect(component.selected!.user_id).toBe(5);
      expect(chat.getMessages).toHaveBeenCalledWith(5);
      end();
    }));
  });

  // ----------------------------------------------------------------------------- live updates
  describe('new mail while the page is open', () => {
    const openBob = () => { qa('.msgr-side .conv')[0].click(); tick(); fixture.detectChanges(); };

    it('polls every 8 seconds and shows a new incoming message in the open chat', fakeAsync(() => {
      init(); openBob();
      const callsBefore = chat.getMessages.calls.count();

      chat.getMessages.and.returnValue(of([...history(), { id: 40, sender_id: 2, receiver_id: ME, message: 'ping!', created_at: iso(0, 9, 40), is_read: false }]));
      tick(8000); fixture.detectChanges();
      expect(chat.getMessages.calls.count()).toBeGreaterThan(callsBefore);
      expect(qa('.bubble').pop()!.textContent).toContain('ping!');
      expect(chat.markConversationRead).toHaveBeenCalledTimes(2);                // the new message is marked read too
      end();
    }));

    it('refreshes the list when the Pusher unread count changes', fakeAsync(() => {
      init();
      const before = chat.getConversations.calls.count();
      count$.next(5); tick(); fixture.detectChanges();
      expect(chat.getConversations.calls.count()).toBe(before + 1);
      end();
    }));

    it('a failed background refresh keeps what is on screen', fakeAsync(() => {
      init();
      chat.getConversations.and.returnValue(throwError(() => ({ status: 0 })));
      tick(8000); fixture.detectChanges();
      expect(names().length).toBe(3);
      expect(q('.state[role="alert"]')).toBeNull();
      end();
    }));

    it('stops polling when the page is closed', fakeAsync(() => {
      init();
      fixture.destroy();
      const calls = chat.getConversations.calls.count();
      tick(30000);
      expect(chat.getConversations.calls.count()).toBe(calls);
    }));
  });

  // ----------------------------------------------------------------------------- mobile
  describe('mobile: one pane at a time', () => {
    it('shows the list first; opening a chat adds chat-open; Back returns to the list', fakeAsync(() => {
      init();
      expect(q('.msgr')!.classList).not.toContain('chat-open');
      qa('.msgr-side .conv')[0].click(); tick(); fixture.detectChanges();
      expect(q('.msgr')!.classList).toContain('chat-open');

      (q('.chat-head .back') as HTMLButtonElement).click(); fixture.detectChanges();
      expect(q('.msgr')!.classList).not.toContain('chat-open');
      expect(component.selected).toBeNull();
      end();
    }));

    [320, 390].forEach(width => {
      it('does not overflow horizontally at ' + width + 'px, list or chat', fakeAsync(() => {
        init();
        const host = el();
        host.style.cssText = 'display:block;width:' + width + 'px';
        document.body.appendChild(host);
        const overflow = () => [
          ...(host.scrollWidth > host.clientWidth + 1 ? ['host'] : []),
          ...Array.from(host.querySelectorAll('.msgr-side, .msgr-chat, .chat-body, .list, .composer'))
            .filter(n => (n as HTMLElement).scrollWidth > (n as HTMLElement).clientWidth + 1).map(n => n.className),
        ];

        expect(getComputedStyle(host.querySelector('.msgr') as HTMLElement).overflowX).toBe('hidden');   // the sliding pane is clipped
        expect(overflow()).toEqual([]);
        qa('.msgr-side .conv')[0].click(); tick(); fixture.detectChanges();
        component.draft = 'a-very-long-unbroken-message-' + 'x'.repeat(200); component.send(); tick(); fixture.detectChanges();
        expect(overflow()).toEqual([]);
        host.remove();
        end();
      }));
    });
  });
});
