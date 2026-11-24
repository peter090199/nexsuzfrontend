import { NexsuzTestingModule } from 'src/testing/nexsuz-testing.module';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed, discardPeriodicTasks, fakeAsync, flush, tick } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Subject, of, throwError } from 'rxjs';

import { AnnouncementsComponent } from './announcements.component';
import { AnnouncementDialogComponent } from './announcement-dialog.component';
import { Announcement, AnnouncementService } from 'src/app/services/Announcements/announcement.service';
import { CommentService } from 'src/app/services/comment/comment.service';
import { EchoService } from 'src/app/services/echo.service';
import { NotificationsService } from 'src/app/services/Global/notifications.service';

const card = (over: Partial<Announcement> = {}): Announcement => ({
  id: 1, announcement_uuid: 'uuid-1', title: 'Holiday schedule', content: 'Offices close on Friday.', priority: 'normal', is_pinned: false, status: 'published',
  is_expired: false, published_at: '2026-11-24 10:00:00', expires_at: null, created_at: '2026-11-24 09:00:00', updated_at: '2026-11-24 09:00:00',
  author: { code: 701, fullname: 'Ana Admin', role_code: 'DEF-ADMIN', photo_pic: null }, images: [], attachments: [],
  reaction_summary: { total: 0, breakdown: [], mine: null }, my_reaction: null, comments_count: 0, is_owner: false, can_edit: false, can_moderate: false, ...over,
});

describe('AnnouncementsComponent', () => {
  let fixture: ComponentFixture<AnnouncementsComponent>;
  let component: AnnouncementsComponent;
  let api: AnnouncementService;
  let announced$: Subject<any>;

  const el = () => fixture.nativeElement as HTMLElement;
  const q = (s: string) => el().querySelector(s) as HTMLElement | null;
  const qa = (s: string) => Array.from(el().querySelectorAll(s)) as HTMLElement[];

  /** `open`: true / false = what the user chose earlier this session; null = a fresh session (closed by default) */
  async function setup(role: string, feed: Announcement[], manage: Announcement[] = [], opts: { open?: boolean | null; seen?: number } = {}) {
    sessionStorage.setItem('role', role);
    sessionStorage.setItem('code', '900');
    const open = opts.open === undefined ? true : opts.open;
    if (open === null) { sessionStorage.removeItem('nx-announcements-open'); } else { sessionStorage.setItem('nx-announcements-open', open ? '1' : '0'); }
    localStorage.setItem('nx-announcements-seen', String(opts.seen ?? 0));
    announced$ = new Subject<any>();
    await TestBed.configureTestingModule({
      imports: [NexsuzTestingModule], schemas: [NO_ERRORS_SCHEMA], declarations: [AnnouncementsComponent],
      providers: [{ provide: EchoService, useValue: { listenToPosts: () => undefined, announcement$: announced$.asObservable() } }],
    }).compileComponents();
    api = TestBed.inject(AnnouncementService);
    spyOn(api, 'feed').and.returnValue(of({ success: true, data: feed }));
    spyOn(api, 'manage').and.returnValue(of({ success: true, data: manage, counts: { published: manage.length, draft: 0, archived: 0 } }));
    fixture = TestBed.createComponent(AnnouncementsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }
  afterEach(() => {
    ['role', 'code', 'nx-announcements-open'].forEach(k => sessionStorage.removeItem(k));
    localStorage.removeItem('nx-announcements-seen');
    fixture?.destroy();
  });

  describe('closed by default, opened with View', () => {
    const feed = [card({ id: 7, priority: 'urgent' }), card({ id: 3, announcement_uuid: 'u3', title: 'Older' })];

    it('starts closed: a bar with the count, the new and urgent badges, and no cards', fakeAsync(async () => {
      await setup('DEF-USERS', feed, [], { open: null });
      expect(component.open).toBeFalse();
      expect(q('[data-testid="announcements"]')).not.toBeNull();
      expect(q('[data-testid="announcements-body"]')).toBeNull();
      expect(qa('mat-card.card').length).toBe(0);
      expect(q('[data-testid="summary"]')!.textContent).toContain('2 announcements');
      expect(q('[data-testid="new-badge"]')!.textContent).toContain('2 new');
      expect(q('[data-testid="urgent-badge"]')!.textContent).toContain('1 urgent');
      const t = q('[data-testid="toggle"]')!;
      expect(t.textContent).toContain('View');
      expect(t.getAttribute('aria-expanded')).toBe('false');
      discardPeriodicTasks();
    }));

    it('View opens it, Hide closes it, and the badges go once the list has been looked at', fakeAsync(async () => {
      await setup('DEF-USERS', feed, [], { open: null });
      (q('[data-testid="toggle"]') as HTMLButtonElement).click(); fixture.detectChanges();
      expect(component.open).toBeTrue();
      expect(q('[data-testid="announcements-body"]')).not.toBeNull();
      expect(qa('mat-card.card').length).toBe(2);
      expect(q('[data-testid="toggle"]')!.textContent).toContain('Hide');
      expect(q('[data-testid="toggle"]')!.getAttribute('aria-expanded')).toBe('true');
      expect(q('[data-testid="new-badge"]')).toBeNull();
      expect(localStorage.getItem('nx-announcements-seen')).toBe('7');

      (q('[data-testid="toggle"]') as HTMLButtonElement).click(); fixture.detectChanges();
      expect(q('[data-testid="announcements-body"]')).toBeNull();
      expect(q('[data-testid="new-badge"]')).toBeNull();          // already seen
      expect(q('[data-testid="summary"]')!.textContent).toContain('2 announcements');
      discardPeriodicTasks();
    }));

    it('only what was published since the last look counts as new', fakeAsync(async () => {
      await setup('DEF-USERS', feed, [], { open: null, seen: 5 });
      expect(component.newCount).toBe(1);                          // id 7 only
      expect(q('[data-testid="new-badge"]')!.textContent).toContain('1 new');
      discardPeriodicTasks();
    }));

    it('keeps what the user chose for the rest of the browser session', fakeAsync(async () => {
      await setup('DEF-USERS', feed, [], { open: null });
      component.toggle();
      expect(sessionStorage.getItem('nx-announcements-open')).toBe('1');
      fixture.destroy(); TestBed.resetTestingModule();
      await setup('DEF-USERS', feed, [], { open: true });          // coming back to Home in the same session
      expect(component.open).toBeTrue();
      expect(qa('mat-card.card').length).toBe(2);
      discardPeriodicTasks();
    }));

    it('a live refresh while it is open marks the new announcement as seen at once', fakeAsync(async () => {
      await setup('DEF-USERS', [card({ id: 3 })], [], { open: true });
      (api.feed as jasmine.Spy).and.returnValue(of({ success: true, data: [card({ id: 9 }), card({ id: 3 })] }));
      announced$.next({ id: 9, priority: 'normal' }); tick(1000);
      expect(component.items.length).toBe(2);
      expect(component.newCount).toBe(0);
      discardPeriodicTasks();
    }));

    it('an administrator keeps New announcement and Manage on the bar while it is closed; Manage opens it', fakeAsync(async () => {
      await setup('DEF-ADMIN', [], [card({ id: 1, status: 'draft', can_edit: true, can_moderate: true })], { open: null });
      expect(component.open).toBeFalse();
      expect(q('[data-testid="new-announcement"]')).not.toBeNull();
      expect(q('[data-testid="manage-toggle"]')).not.toBeNull();
      expect(q('[data-testid="summary"]')!.textContent).toContain('None live right now');
      expect(q('[data-testid="manage-panel"]')).toBeNull();

      (q('[data-testid="manage-toggle"]') as HTMLButtonElement).click(); fixture.detectChanges();
      expect(component.open).toBeTrue();
      expect(q('[data-testid="manage-panel"]')).not.toBeNull();
      expect(api.manage).toHaveBeenCalled();
      discardPeriodicTasks();
    }));
  });

  describe('responsive', () => {
    it('uses mat-card for the bar, the announcements and the management panel', fakeAsync(async () => {
      await setup('DEF-ADMIN', [card()], [card({ can_edit: true })]);
      component.toggleManage(); fixture.detectChanges();
      expect(q('mat-card.ann-head')).not.toBeNull();
      expect(qa('mat-card.card').length).toBe(1);
      expect(q('mat-card.manage')).not.toBeNull();
      discardPeriodicTasks();
    }));

    it('ships layout rules for tablet and phone widths (stacked bar, thumb-sized buttons, two-column images)', () => {
      const css = ((AnnouncementsComponent as any).ɵcmp.styles as string[]).join('\n');
      expect(css).toContain('@media (max-width: 768px)');
      expect(css).toContain('@media (max-width: 600px)');
      expect(css).toContain('min-height: 42px');
      expect(css).toContain('flex-wrap: wrap');
      expect(css).toContain('grid-template-columns: repeat(2, 1fr)');
    });
  });

  describe('as a job seeker or recruiter', () => {
    for (const role of ['DEF-USERS', 'DEF-CLIENT']) {
      it(`${role} sees the live announcements, with author, role, date and content`, fakeAsync(async () => {
        await setup(role, [card()]);
        expect(q('[data-testid="announcements"]')).not.toBeNull();
        expect(q('[data-testid="card-1"] h3')!.textContent).toContain('Holiday schedule');
        expect(q('[data-testid="card-1"]')!.textContent).toContain('Ana Admin');
        expect(q('[data-testid="card-1"]')!.textContent).toContain('Administrator');
        expect(q('[data-testid="card-1"]')!.textContent).toContain('Offices close on Friday.');
        expect(q('[data-testid="card-1"]')!.textContent).toContain('Nov 24, 2026');
        discardPeriodicTasks();
      }));
    }

    it('has no toolbar and no management panel (the API would refuse them anyway)', fakeAsync(async () => {
      await setup('DEF-USERS', [card()]);
      expect(component.isManager).toBeFalse();
      expect(q('[data-testid="new-announcement"]')).toBeNull();
      expect(q('[data-testid="manage-toggle"]')).toBeNull();
      expect(q('[data-testid="manage-panel"]')).toBeNull();
      expect(api.manage).not.toHaveBeenCalled();
      discardPeriodicTasks();
    }));

    it('shows nothing at all when there is no live announcement', fakeAsync(async () => {
      await setup('DEF-USERS', []);
      expect(q('[data-testid="announcements"]')).toBeNull();
      discardPeriodicTasks();
    }));

    it('marks pinned and priority, and shows images, attachments and the expiry', fakeAsync(async () => {
      await setup('DEF-USERS', [card({
        id: 2, priority: 'urgent', is_pinned: true, expires_at: '2026-12-31 08:00:00',
        images: [{ id: 1, url: 'http://x/storage/uploads/announcements/1/a.jpg', name: 'a.jpg', mime: 'image/jpeg', size: 1000 }],
        attachments: [{ id: 2, url: 'http://x/storage/uploads/announcements/1/s.pdf', name: 'schedule.pdf', mime: 'application/pdf', size: 120000 }],
      })]);
      const c = q('[data-testid="card-2"]')!;
      expect(c.classList.contains('urgent')).toBeTrue();
      expect(c.textContent).toContain('Pinned');
      expect(c.textContent).toContain('Urgent');
      expect(c.querySelectorAll('.images img').length).toBe(1);
      expect(c.querySelector('.attachments a')!.getAttribute('href')).toContain('s.pdf');
      expect(c.textContent).toContain('schedule.pdf');
      expect(c.textContent).toContain('Until Dec 31, 2026');
      discardPeriodicTasks();
    }));

    it('long content is shortened with Show more', fakeAsync(async () => {
      await setup('DEF-USERS', [card({ content: 'x'.repeat(500) })]);
      expect(q('.body')!.classList.contains('clamp')).toBeTrue();
      (q('.link') as HTMLButtonElement).click(); fixture.detectChanges();
      expect(q('.body')!.classList.contains('clamp')).toBeFalse();
      discardPeriodicTasks();
    }));

    it('reacts, changes the reaction and removes it, using the summary the API returns', fakeAsync(async () => {
      await setup('DEF-USERS', [card()]);
      const a = component.items[0];
      const summary = (mine: string | null, total: number) => ({ total, breakdown: mine ? [{ reaction: mine, count: total }] : [], mine });
      const react = spyOn(api, 'react').and.callFake((_id: number, r: string) => of({ reaction_summary: summary(r, 1) }));
      const unreact = spyOn(api, 'unreact').and.returnValue(of({ reaction_summary: summary(null, 0) }));

      component.react(a, 'Love');
      expect(react).toHaveBeenCalledWith(1, 'Love');
      expect(a.my_reaction).toBe('Love');
      expect(a.reaction_summary.total).toBe(1);
      component.react(a, 'Wow');
      expect(a.my_reaction).toBe('Wow');
      component.react(a, 'Wow');                                // the same one again removes it
      expect(unreact).toHaveBeenCalledWith(1);
      expect(a.my_reaction).toBeNull();
      discardPeriodicTasks();
    }));

    it('a refused reaction shows the server message and changes nothing', fakeAsync(async () => {
      await setup('DEF-USERS', [card()]);
      spyOn(api, 'react').and.returnValue(throwError(() => ({ error: { message: 'Announcement not found.' } })));
      const err = spyOn(TestBed.inject(NotificationsService), 'toastrError');
      component.react(component.items[0], 'Like');
      expect(err).toHaveBeenCalledWith('Announcement not found.');
      expect(component.items[0].my_reaction).toBeNull();
      discardPeriodicTasks();
    }));

    it('opens the comments, shows them oldest first, posts a new one and reloads the thread', fakeAsync(async () => {
      await setup('DEF-USERS', [card({ comments_count: 1 })]);
      const comments = TestBed.inject(CommentService);
      const list = spyOn(comments, 'list').and.returnValue(of([{ comment_uuid: 'c2', comment: 'second', fullname: 'B', code: 5 }, { comment_uuid: 'c1', comment: 'first', fullname: 'A', code: 6 }]));
      const create = spyOn(comments, 'create').and.returnValue(of({}));
      const a = component.items[0];

      component.toggleComments(a);
      expect(list).toHaveBeenCalledWith('uuid-1', 50);
      expect(component.threads[1].list.map(c => c.comment)).toEqual(['first', 'second']);

      component.threads[1].text = '  Thanks!  ';
      component.addComment(a);
      expect(create).toHaveBeenCalledWith('uuid-1', 'Thanks!');
      expect(a.comments_count).toBe(2);
      expect(component.threads[1].text).toBe('');
      expect(list).toHaveBeenCalledTimes(2);
      discardPeriodicTasks();
    }));

    it('may delete only their own comment (the API enforces it too)', fakeAsync(async () => {
      await setup('DEF-USERS', [card()]);
      const a = component.items[0];
      expect(component.canDeleteComment(a, { code: 900 })).toBeTrue();
      expect(component.canDeleteComment(a, { code: 5 })).toBeFalse();
      expect(component.canDeleteComment({ ...a, is_owner: true }, { code: 5 })).toBeTrue();   // the administrator who wrote it
      discardPeriodicTasks();
    }));
  });

  describe('live refresh', () => {
    it('a published signal reloads the feed once, however many arrive together', fakeAsync(async () => {
      await setup('DEF-USERS', [card()]);
      (api.feed as jasmine.Spy).calls.reset();
      announced$.next({ id: 5, priority: 'normal' }); announced$.next({ id: 6, priority: 'urgent' }); announced$.next({ id: 7, priority: 'normal' });
      tick(1000);
      expect(api.feed).toHaveBeenCalledTimes(1);
      discardPeriodicTasks();
    }));

    it('looks again every minute while the tab is visible, as a fallback', fakeAsync(async () => {
      await setup('DEF-CLIENT', [card()]);
      (api.feed as jasmine.Spy).calls.reset();
      tick(60000);
      expect(api.feed).toHaveBeenCalledTimes(1);
      tick(60000);
      expect(api.feed).toHaveBeenCalledTimes(2);
      discardPeriodicTasks();
    }));

    it('a failed refresh keeps what is already on screen', fakeAsync(async () => {
      await setup('DEF-USERS', [card()]);
      (api.feed as jasmine.Spy).and.returnValue(throwError(() => new Error('offline')));
      component.load();
      expect(component.items.length).toBe(1);
      expect(component.error).toBe('');
      discardPeriodicTasks();
    }));
  });

  describe('as an administrator', () => {
    for (const role of ['DEF-ADMIN', 'DEF-MASTERADMIN']) {
      it(`${role} gets New announcement and Manage`, fakeAsync(async () => {
        await setup(role, []);
        expect(component.isManager).toBeTrue();
        expect(q('[data-testid="new-announcement"]')).not.toBeNull();
        expect(q('[data-testid="manage-toggle"]')).not.toBeNull();
        expect(el().textContent).toContain('No announcement is live right now');
        discardPeriodicTasks();
      }));
    }

    it('Manage lists the announcements with only the actions the API allows each one', fakeAsync(async () => {
      const mine = card({ id: 1, status: 'draft', can_edit: true, can_moderate: true });
      const othersPublished = card({ id: 2, status: 'published', can_edit: false, can_moderate: true });   // the master admin moderating
      const othersArchived = card({ id: 3, status: 'archived', can_edit: false, can_moderate: false });
      await setup('DEF-MASTERADMIN', [], [mine, othersPublished, othersArchived]);
      (q('[data-testid="manage-toggle"]') as HTMLButtonElement).click(); fixture.detectChanges();

      const acts = (id: number) => Array.from(el().querySelectorAll(`[data-testid="manage-row-${id}"] [data-testid^="act-"]`)).map(b => b.getAttribute('data-testid'));
      expect(acts(1)).toEqual(['act-edit', 'act-publish', 'act-delete']);                 // a draft of mine
      expect(acts(2)).toEqual(['act-archive', 'act-delete']);                             // somebody else's published one: moderate only, no edit
      expect(acts(3)).toEqual([]);                                                        // somebody else's archived one: read only
      discardPeriodicTasks();
    }));

    it('publishes, archives and restores through the status endpoint, then reloads', fakeAsync(async () => {
      await setup('DEF-ADMIN', [], [card({ id: 4, status: 'draft', can_edit: true, can_moderate: true })]);
      component.toggleManage();                                  // opening Manage is what loads the list
      const set = spyOn(api, 'setStatus').and.returnValue(of({ success: true, message: 'Announcement published.' }));
      (api.feed as jasmine.Spy).calls.reset();
      component.change(component.manageItems[0], 'published');
      expect(set).toHaveBeenCalledWith(4, 'published');
      expect(api.feed).toHaveBeenCalledTimes(1);
      component.change(component.manageItems[0], 'archived');
      expect(set).toHaveBeenCalledWith(4, 'archived');
      discardPeriodicTasks(); flush();                         // the success toasts have timers of their own
    }));

    it('asks before deleting, and does nothing when declined', fakeAsync(async () => {
      await setup('DEF-ADMIN', [], [card({ id: 4, can_edit: true, can_moderate: true })]);
      component.toggleManage();
      const open = spyOn(TestBed.inject(MatDialog), 'open').and.returnValue({ afterClosed: () => of(false) } as any);
      const del = spyOn(api, 'remove').and.returnValue(of({ success: true }));
      component.remove(component.manageItems[0]);
      expect(open).toHaveBeenCalled();
      expect(del).not.toHaveBeenCalled();
      open.and.returnValue({ afterClosed: () => of(true) } as any);
      component.remove(component.manageItems[0]);
      expect(del).toHaveBeenCalledWith(4);
      discardPeriodicTasks(); flush();
    }));

    it('New announcement opens the form and reloads after a save', fakeAsync(async () => {
      await setup('DEF-ADMIN', []);
      const open = spyOn(TestBed.inject(MatDialog), 'open').and.returnValue({ afterClosed: () => of(true) } as any);
      (api.feed as jasmine.Spy).calls.reset();
      component.create();
      expect((open.calls.mostRecent().args[0] as any)).toBe(AnnouncementDialogComponent);
      expect(api.feed).toHaveBeenCalledTimes(1);
      discardPeriodicTasks();
    }));
  });
});

describe('AnnouncementDialogComponent', () => {
  const ref = jasmine.createSpyObj('MatDialogRef', ['close']);
  const notify = jasmine.createSpyObj('NotificationsService', ['toastrSuccess', 'toastrError']);
  let http: HttpTestingController;

  function open(data: any) {
    TestBed.configureTestingModule({
      imports: [NexsuzTestingModule], schemas: [NO_ERRORS_SCHEMA], declarations: [AnnouncementDialogComponent],
      providers: [{ provide: MatDialogRef, useValue: ref }, { provide: NotificationsService, useValue: notify }, { provide: MAT_DIALOG_DATA, useValue: data }],
    });
    http = TestBed.inject(HttpTestingController);
    const f = TestBed.createComponent(AnnouncementDialogComponent); f.detectChanges();
    return f.componentInstance;
  }
  const file = (name: string, type: string, size = 1000) => new File([new ArrayBuffer(size)], name, { type });
  beforeEach(() => { ref.close.calls.reset(); notify.toastrSuccess.calls.reset(); });

  it('needs a title and content', () => {
    const c = open(null);
    expect(c.canSave).toBeFalse();
    c.form.title = 'T'; expect(c.canSave).toBeFalse();
    c.form.content = 'C'; expect(c.canSave).toBeTrue();
    c.form.title = '   '; expect(c.canSave).toBeFalse();
  });

  it('publishes: multipart with status, priority, pin, expiry, images and attachments', () => {
    const c = open(null);
    c.form = { title: ' Notice ', content: ' Body ', priority: 'urgent', is_pinned: true, expires_at: '2099-01-01T09:00' };
    c.images.push(file('a.png', 'image/png')); c.files.push(file('s.pdf', 'application/pdf'));
    c.save('published');
    const req = http.expectOne(r => r.method === 'POST' && r.url.endsWith('announcements'));
    const b = req.request.body as FormData;
    expect([b.get('title'), b.get('content'), b.get('priority'), b.get('is_pinned'), b.get('status'), b.get('expires_at')]).toEqual(['Notice', 'Body', 'urgent', '1', 'published', '2099-01-01T09:00']);
    expect((b.getAll('images[]') as File[]).map(f => f.name)).toEqual(['a.png']);
    expect((b.getAll('attachments[]') as File[]).map(f => f.name)).toEqual(['s.pdf']);
    req.flush({ success: true, message: 'Announcement published.' }, { status: 201, statusText: 'Created' });
    expect(notify.toastrSuccess).toHaveBeenCalled();
    expect(ref.close).toHaveBeenCalledWith(true);
  });

  it('saves a draft without an expiry when none is given', () => {
    const c = open(null);
    c.form.title = 'T'; c.form.content = 'C';
    c.save('draft');
    const b = http.expectOne(r => r.method === 'POST').request.body as FormData;
    expect(b.get('status')).toBe('draft');
    expect(b.has('expires_at')).toBeFalse();
  });

  it('refuses an expiry in the past for a publish before calling the API', () => {
    const c = open(null);
    c.form = { title: 'T', content: 'C', priority: 'normal', is_pinned: false, expires_at: '2000-01-01T00:00' };
    c.save('published');
    http.expectNone(() => true);
    expect(c.error).toContain('future');
  });

  it('checks file types and sizes on the way in, with the same limits as the API', () => {
    const c = open(null);
    const pick = (fn: 'addImages' | 'addFiles', files: File[]) => (c as any)[fn]({ target: { files, value: 'x' } });
    pick('addImages', [file('a.pdf', 'application/pdf')]);
    expect(c.images.length).toBe(0); expect(c.error).toContain('JPG');
    pick('addImages', [file('big.jpg', 'image/jpeg', 4 * 1024 * 1024)]);
    expect(c.images.length).toBe(0); expect(c.error).toContain('3 MB');
    pick('addImages', [file('ok.jpg', 'image/jpeg')]);
    expect(c.images.length).toBe(1);
    pick('addFiles', [file('virus.exe', 'application/octet-stream')]);
    expect(c.files.length).toBe(0); expect(c.error).toContain('PDF');
    pick('addFiles', [file('huge.pdf', 'application/pdf', 11 * 1024 * 1024)]);
    expect(c.files.length).toBe(0); expect(c.error).toContain('10 MB');
    pick('addFiles', Array.from({ length: 7 }, (_, i) => file(`f${i}.pdf`, 'application/pdf')));
    expect(c.files.length).toBe(5);
  });

  it('editing: starts from the announcement, sends the cleared expiry, new files and the attachments to remove, to the update endpoint', () => {
    const a = card({ id: 9, title: 'Old', content: 'Old body', priority: 'important', is_pinned: true, expires_at: '2026-12-31 08:00:00',
      images: [{ id: 11, url: 'u', name: 'i.jpg', mime: 'image/jpeg', size: 1 }], attachments: [{ id: 12, url: 'u', name: 'd.pdf', mime: 'application/pdf', size: 1 }] });
    const c = open({ announcement: a });
    expect(c.form.title).toBe('Old');
    expect(c.form.expires_at).toBe('2026-12-31T08:00');
    expect(c.existingImages.length).toBe(1);

    c.form.expires_at = '';                       // clear the expiry
    c.removeExisting(12);
    c.files.push(file('new.pdf', 'application/pdf'));
    c.save();
    const req = http.expectOne(r => r.method === 'POST' && r.url.endsWith('announcements/9/update'));
    const b = req.request.body as FormData;
    expect(b.get('expires_at')).toBe('');
    expect(b.has('status')).toBeFalse();          // the lifecycle is changed from the list, not here
    expect(b.getAll('remove_attachments[]')).toEqual(['12']);
    expect((b.getAll('attachments[]') as File[]).map(f => f.name)).toEqual(['new.pdf']);
    req.flush({ success: true, message: 'Announcement updated.' });
    expect(ref.close).toHaveBeenCalledWith(true);
  });

  it('shows the API reason and stays open', () => {
    const c = open(null);
    c.form.title = 'T'; c.form.content = 'C';
    c.save('published');
    http.expectOne(r => r.method === 'POST').flush({ message: 'x', errors: { expires_at: ['The expiration date must be in the future.'] } }, { status: 422, statusText: 'x' });
    expect(c.error).toBe('The expiration date must be in the future.');
    expect(c.working).toBeFalse();
    expect(ref.close).not.toHaveBeenCalled();
  });
});

describe('AnnouncementService', () => {
  let http: HttpTestingController;
  let svc: AnnouncementService;
  beforeEach(() => {
    sessionStorage.setItem('token', 'tok');
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    http = TestBed.inject(HttpTestingController);
    svc = TestBed.inject(AnnouncementService);
  });
  afterEach(() => sessionStorage.removeItem('token'));

  it('calls each endpoint with the signed-in token', () => {
    const check = (m: string, urlEnd: string) => { const r = http.expectOne(x => x.method === m && x.url.endsWith(urlEnd)); expect(r.request.headers.get('Authorization')).toBe('Bearer tok'); r.flush({}); return r; };
    svc.feed().subscribe(); check('GET', 'announcements');
    svc.manage('draft').subscribe(); const r = http.expectOne(x => x.url.endsWith('announcements/manage')); expect(r.request.params.get('status')).toBe('draft'); r.flush({});
    svc.setStatus(3, 'archived').subscribe(); const s = check('POST', 'announcements/3/status'); expect(s.request.body).toEqual({ status: 'archived' });
    svc.remove(3).subscribe(); check('DELETE', 'announcements/3');
    svc.react(3, 'Like').subscribe(); const x = check('POST', 'announcements/3/react'); expect(x.request.body).toEqual({ reaction: 'Like' });
    svc.unreact(3).subscribe(); check('DELETE', 'announcements/3/react');
  });
});
