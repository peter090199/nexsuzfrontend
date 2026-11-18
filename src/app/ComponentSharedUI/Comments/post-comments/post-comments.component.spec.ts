import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { NexsuzTestingModule } from 'src/testing/nexsuz-testing.module';

import { PostCommentsComponent } from './post-comments.component';
import { ReactionButtonComponent } from '../../Reactions/reaction-button/reaction-button.component';
import { ReactionSummaryComponent } from '../../Reactions/reaction-summary/reaction-summary.component';
import { CommentService } from 'src/app/services/comment/comment.service';
import { NotificationsService } from 'src/app/services/Global/notifications.service';

const noReactions = () => ({ total: 0, breakdown: [], mine: null });

function comment(n: number, extra: any = {}) {
  return {
    id: n, type: 'comment', comment_uuid: 'c' + n, post_uuidOrUind: 'post-1', code: 10 + n, fullname: 'User ' + n,
    profile_pic: 'pic.png', comment: 'comment ' + n, attachment_url: null, created_at: '2026-11-16T04:00:00.000000Z',
    edited: false, is_owner: false, can_delete: false, reactions: noReactions(), replies: [], replies_count: 0, ...extra,
  };
}
function reply(id: number, parent: string, extra: any = {}) {
  return {
    id, type: 'reply', comment_uuid: parent, code: 50, fullname: 'Replier', profile_pic: 'r.png', comment: 'reply ' + id,
    attachment_url: null, created_at: '2026-11-16T04:05:00.000000Z', edited: false, is_owner: false, can_delete: false,
    reactions: noReactions(), ...extra,
  };
}
const page = (data: any[], extra: any = {}) => ({ success: true, data, total: data.length, total_with_replies: data.length, has_more: false, next_before: data.length ? data[data.length - 1].id : null, ...extra });

function imageFile(name: string, type = 'image/png', size = 1000): File {
  const f = new File(['x'], name, { type });
  Object.defineProperty(f, 'size', { value: size });
  return f;
}
const pickEvent = (f: File) => ({ target: { files: [f], value: 'x' } } as unknown as Event);

describe('PostCommentsComponent', () => {
  let fixture: ComponentFixture<PostCommentsComponent>;
  let component: PostCommentsComponent;
  let svc: CommentService;
  let alert: NotificationsService;
  let counts: number[];

  async function setup(firstPage: any = page([])) {
    await TestBed.configureTestingModule({
      imports: [NexsuzTestingModule],
      declarations: [PostCommentsComponent, ReactionButtonComponent, ReactionSummaryComponent],
    }).compileComponents();
    svc = TestBed.inject(CommentService);
    alert = TestBed.inject(NotificationsService);
    spyOn(svc, 'list').and.returnValue(of(firstPage));
    fixture = TestBed.createComponent(PostCommentsComponent);
    component = fixture.componentInstance;
    component.postUuid = 'post-1';
    counts = [];
    component.countChange.subscribe((n: number) => counts.push(n));
    fixture.detectChanges();
  }
  const el = () => fixture.nativeElement as HTMLElement;

  // ----------------------------------------------------------------- loading
  it('loads the first page of comments for the post', async () => {
    await setup(page([comment(2), comment(1)], { total_with_replies: 2 }));
    expect((svc.list as jasmine.Spy).calls.mostRecent().args).toEqual(['post-1', 5]);
    expect(component.comments.map(c => c.comment_uuid)).toEqual(['c2', 'c1']);
    expect(counts).toEqual([2]);
    expect(el().querySelectorAll('.list > .item').length).toBe(2);
  });

  it('shows a friendly empty state', async () => {
    await setup(page([]));
    expect(el().querySelector('.state.empty')?.textContent).toContain('No comments yet');
  });

  it('shows an error with a retry when loading fails', async () => {
    await TestBed.configureTestingModule({ imports: [NexsuzTestingModule], declarations: [PostCommentsComponent, ReactionButtonComponent, ReactionSummaryComponent] }).compileComponents();
    svc = TestBed.inject(CommentService);
    spyOn(svc, 'list').and.returnValue(throwError(() => ({ status: 500, error: { message: 'Server broke' } })));
    fixture = TestBed.createComponent(PostCommentsComponent);
    component = fixture.componentInstance;
    component.postUuid = 'post-1';
    fixture.detectChanges();
    expect(el().querySelector('.state.error')?.textContent).toContain('Server broke');
    expect(el().querySelector('.state.error button')).not.toBeNull();
  });

  it('"View more comments" loads the next page after the cursor and never shows a comment twice', async () => {
    await setup(page([comment(5), comment(4)], { has_more: true, next_before: 4 }));
    (svc.list as jasmine.Spy).and.returnValue(of(page([comment(4), comment(3), comment(2)], { has_more: false, next_before: 2 })));   // 4 overlaps

    component.loadMore();

    expect((svc.list as jasmine.Spy).calls.mostRecent().args).toEqual(['post-1', 5, 4]);
    expect(component.comments.map(c => c.comment_uuid)).toEqual(['c5', 'c4', 'c3', 'c2']);
    expect(component.hasMore).toBeFalse();
  });

  // ----------------------------------------------------------------- posting
  it('posts a comment, shows it at the top at once and updates the count', async () => {
    await setup(page([comment(1)], { total_with_replies: 1 }));
    const created = comment(9, { comment: 'Fresh!', is_owner: true, can_delete: true });
    const create = spyOn(svc, 'create').and.returnValue(of({ success: true, data: created }));

    component.draft = '  Fresh!  ';
    component.submitComment();

    expect(create).toHaveBeenCalledWith('post-1', 'Fresh!', undefined);      // trimmed
    expect(component.comments[0].comment_uuid).toBe('c9');
    expect(component.draft).toBe('');
    expect(counts[counts.length - 1]).toBe(2);
    fixture.detectChanges();
    expect(el().querySelectorAll('.list > .item').length).toBe(2);
  });

  it('refuses an empty or blank comment', async () => {
    await setup();
    const create = spyOn(svc, 'create');
    component.draft = '   ';
    expect(component.canSend).toBeFalse();
    component.submitComment();
    expect(create).not.toHaveBeenCalled();
    expect(component.composerError).toContain('Write a comment');
  });

  it('refuses a comment over the length limit', async () => {
    await setup();
    const create = spyOn(svc, 'create');
    component.draft = 'x'.repeat(component.maxChars + 1);
    component.submitComment();
    expect(create).not.toHaveBeenCalled();
    expect(component.composerError).toContain('2000');
  });

  it('prevents duplicate submissions while one is in flight', async () => {
    await setup();
    const create = spyOn(svc, 'create').and.returnValue(new Subject<any>() as any);
    component.draft = 'once';
    component.submitComment();
    component.submitComment();
    component.submitComment();
    expect(create).toHaveBeenCalledTimes(1);
    expect(component.isSubmitting).toBeTrue();
    expect(component.canSend).toBeFalse();
  });

  it('does not add a comment twice when the server says it was a duplicate', async () => {
    await setup(page([comment(9)], { total_with_replies: 1 }));
    spyOn(svc, 'create').and.returnValue(of({ success: true, duplicate: true, data: comment(9) }));
    component.draft = 'again';
    component.submitComment();
    expect(component.comments.length).toBe(1);
    expect(component.total).toBe(1);
  });

  it('keeps the text and shows the server message when posting fails', async () => {
    await setup();
    spyOn(svc, 'create').and.returnValue(throwError(() => ({ status: 422, error: { message: 'The image must be 3 MB or smaller.' } })));
    component.draft = 'keep me';
    component.submitComment();
    expect(component.draft).toBe('keep me');
    expect(component.composerError).toBe('The image must be 3 MB or smaller.');
    expect(component.isSubmitting).toBeFalse();
  });

  it('reports being offline in plain words', async () => {
    await setup();
    spyOn(svc, 'create').and.returnValue(throwError(() => ({ status: 0 })));
    component.draft = 'x';
    component.submitComment();
    expect(component.composerError).toContain('offline');
  });

  // ----------------------------------------------------------------- photos
  it('previews a chosen photo with a usable blob: src and sends the file', async () => {
    await setup();
    const create = spyOn(svc, 'create').and.returnValue(of({ success: true, data: comment(9) }));
    const file = imageFile('pic.png');

    component.pickDraftImage(pickEvent(file));
    fixture.detectChanges();

    const img = el().querySelector('.img-preview img') as HTMLImageElement;
    expect(img.getAttribute('src')).toMatch(/^blob:/);
    expect(component.canSend).toBeTrue();                             // a photo alone is enough

    component.submitComment();
    expect(create).toHaveBeenCalledWith('post-1', '', file);
    expect(component.draftImage).toBeNull();
  });

  it('rejects unsupported and oversized photos with a friendly message', async () => {
    await setup();
    component.pickDraftImage(pickEvent(imageFile('cv.pdf', 'application/pdf')));
    expect(component.draftImage).toBeNull();
    expect(component.composerError).toContain('JPG, PNG, GIF or WEBP');

    component.pickDraftImage(pickEvent(imageFile('big.png', 'image/png', 4 * 1024 * 1024)));
    expect(component.draftImage).toBeNull();
    expect(component.composerError).toContain('3 MB');
  });

  it('revokes the preview URL when the photo is removed', async () => {
    await setup();
    const revoke = spyOn(URL, 'revokeObjectURL').and.callThrough();
    component.pickDraftImage(pickEvent(imageFile('a.png')));
    const url = component.draftImage!.url;
    component.clearDraftImage();
    expect(revoke).toHaveBeenCalledWith(url);
  });

  // ----------------------------------------------------------------- replies
  it('adds a reply under its comment and counts it', async () => {
    await setup(page([comment(1)], { total_with_replies: 1 }));
    const c = component.comments[0];
    const send = spyOn(svc, 'reply').and.returnValue(of({ success: true, data: reply(77, 'c1', { comment: 'thanks' }) }));

    component.startReply(c);
    c.replyText = 'thanks';
    component.submitReply(c);

    expect(send).toHaveBeenCalledWith('c1', 'thanks', undefined);
    expect(c.replies.map((r: any) => r.id)).toEqual([77]);
    expect(c.replies_count).toBe(1);
    expect(component.total).toBe(2);
    expect(counts[counts.length - 1]).toBe(2);
    expect(c.replying).toBeFalse();
  });

  it('replying to a reply mentions that person but stays under the same comment', async () => {
    await setup(page([comment(1, { replies: [reply(5, 'c1', { fullname: 'Carol' })], replies_count: 1 })]));
    const c = component.comments[0];
    component.startReply(c, c.replies[0]);
    expect(c.replyText).toBe('@Carol ');
    expect(c.replying).toBeTrue();
  });

  it('refuses an empty reply and blocks a second submit while sending', async () => {
    await setup(page([comment(1)]));
    const c = component.comments[0];
    const send = spyOn(svc, 'reply').and.returnValue(new Subject<any>() as any);

    c.replyText = '  ';
    component.submitReply(c);
    expect(send).not.toHaveBeenCalled();
    expect(c.replyError).toContain('Write a reply');

    c.replyText = 'hello';
    component.submitReply(c);
    component.submitReply(c);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('collapses long reply lists and expands them on request', async () => {
    await setup(page([comment(1, { replies: [reply(1, 'c1'), reply(2, 'c1'), reply(3, 'c1')], replies_count: 3 })]));
    const c = component.comments[0];
    expect(component.visibleReplies(c).map((r: any) => r.id)).toEqual([3]);
    c.showAllReplies = true;
    expect(component.visibleReplies(c).length).toBe(3);
  });

  // ----------------------------------------------------------------- edit
  it('edits a comment in place and marks it as edited', async () => {
    await setup(page([comment(1, { is_owner: true })]));
    const c = component.comments[0];
    const edit = spyOn(svc, 'edit').and.returnValue(of({ success: true, data: { comment: 'better', attachment_url: null, updated_at: 'now' } }));

    component.startEdit(c);
    expect(c.editText).toBe('comment 1');
    c.editText = '  better  ';
    component.saveEdit(c);

    expect(edit).toHaveBeenCalledWith('c1', 'com_headers', 'better', { removeImage: false });
    expect(c.comment).toBe('better');
    expect(c.edited).toBeTrue();
    expect(c.editing).toBeFalse();
  });

  it('edits a reply through the reply endpoint (by id)', async () => {
    await setup(page([comment(1, { replies: [reply(8, 'c1', { is_owner: true })], replies_count: 1 })]));
    const r = component.comments[0].replies[0];
    const edit = spyOn(svc, 'edit').and.returnValue(of({ success: true, data: { comment: 'x', attachment_url: null, updated_at: 'now' } }));
    component.startEdit(r);
    r.editText = 'x';
    component.saveEdit(r);
    expect(edit).toHaveBeenCalledWith(8, 'com_replies', 'x', { removeImage: false });
  });

  it('will not save an emptied comment, and cancel changes nothing', async () => {
    await setup(page([comment(1, { is_owner: true })]));
    const c = component.comments[0];
    const edit = spyOn(svc, 'edit');
    component.startEdit(c);
    c.editText = '   ';
    expect(component.canSaveEdit(c)).toBeFalse();
    component.saveEdit(c);
    expect(edit).not.toHaveBeenCalled();
    component.cancelEdit(c);
    expect(c.comment).toBe('comment 1');
  });

  it('can remove the photo while editing', async () => {
    await setup(page([comment(1, { is_owner: true, attachment_url: 'http://x/y.png' })]));
    const c = component.comments[0];
    const edit = spyOn(svc, 'edit').and.returnValue(of({ success: true, data: { comment: 'text', attachment_url: null, updated_at: 'n' } }));
    component.startEdit(c);
    c.editRemoveImage = true;
    component.saveEdit(c);
    expect((edit as jasmine.Spy).calls.mostRecent().args[3]).toEqual({ removeImage: true });
    expect(c.attachment_url).toBeNull();
  });

  it('shows the server\'s reason when an edit is refused', async () => {
    await setup(page([comment(1, { is_owner: true })]));
    const c = component.comments[0];
    spyOn(svc, 'edit').and.returnValue(throwError(() => ({ status: 403, error: { message: 'You can only edit your own comments.' } })));
    component.startEdit(c);
    component.saveEdit(c);
    expect(c.editError).toBe('You can only edit your own comments.');
    expect(c.editing).toBeTrue();
  });

  // ----------------------------------------------------------------- delete
  it('only offers Edit to the author and Delete to the author or post owner', async () => {
    await setup(page([
      comment(1, { is_owner: true, can_delete: true }),
      comment(2, { is_owner: false, can_delete: true }),     // the post owner moderating
      comment(3, { is_owner: false, can_delete: false }),
    ]));
    fixture.detectChanges();
    const rows = Array.from(el().querySelectorAll('.list > .item'));
    const links = (row: Element) => Array.from(row.querySelectorAll('.meta .link')).map(b => b.textContent!.trim());
    expect(links(rows[0])).toEqual(['Reply', 'Edit', 'Delete']);
    expect(links(rows[1])).toEqual(['Reply', 'Delete']);
    expect(links(rows[2])).toEqual(['Reply']);
  });

  it('asks before deleting and then removes the comment and its replies from the count', async () => {
    await setup(page([comment(1, { can_delete: true, replies: [reply(1, 'c1'), reply(2, 'c1')], replies_count: 2 }), comment(2)], { total_with_replies: 4 }));
    spyOn(alert, 'popupWarning').and.returnValue(Promise.resolve({ value: true }) as any);
    const remove = spyOn(svc, 'remove').and.returnValue(of({ success: true }));

    component.confirmDelete(component.comments[0]);
    await Promise.resolve(); await Promise.resolve();

    expect(remove).toHaveBeenCalledWith('c1', 'com_headers');
    expect(component.comments.map(c => c.comment_uuid)).toEqual(['c2']);
    expect(component.total).toBe(1);                                   // 4 - the comment - its 2 replies
    expect(counts[counts.length - 1]).toBe(1);
  });

  it('does nothing when the user cancels the delete confirmation', async () => {
    await setup(page([comment(1, { can_delete: true })]));
    spyOn(alert, 'popupWarning').and.returnValue(Promise.resolve({ value: false }) as any);
    const remove = spyOn(svc, 'remove');
    component.confirmDelete(component.comments[0]);
    await Promise.resolve(); await Promise.resolve();
    expect(remove).not.toHaveBeenCalled();
    expect(component.comments.length).toBe(1);
  });

  it('deletes a single reply and keeps the rest', async () => {
    await setup(page([comment(1, { replies: [reply(1, 'c1'), reply(2, 'c1', { can_delete: true })], replies_count: 2 })], { total_with_replies: 3 }));
    const c = component.comments[0];
    const remove = spyOn(svc, 'remove').and.returnValue(of({ success: true }));
    component.delete(c.replies[1], c);
    expect(remove).toHaveBeenCalledWith(2, 'com_replies');
    expect(c.replies.map((r: any) => r.id)).toEqual([1]);
    expect(c.replies_count).toBe(1);
    expect(component.total).toBe(2);
  });

  it('keeps the comment and reports the problem when a delete fails', async () => {
    await setup(page([comment(1, { can_delete: true })]));
    const toast = spyOn(alert, 'toastrError');
    spyOn(svc, 'remove').and.returnValue(throwError(() => ({ status: 403, error: { message: 'Not allowed' } })));
    component.delete(component.comments[0]);
    expect(component.comments.length).toBe(1);
    expect(component.comments[0].busy).toBeFalse();
    expect(toast).toHaveBeenCalledWith('Not allowed');
  });

  // ----------------------------------------------------------------- reactions on comments
  it('reacts to a comment instantly, then adopts the database\'s numbers', async () => {
    await setup(page([comment(1)]));
    const c = component.comments[0];
    const subject = new Subject<any>();
    const react = spyOn(svc, 'reactToComment').and.returnValue(subject as any);

    component.onReact(c, 'Love');
    expect(react).toHaveBeenCalledWith('comment', 'c1', 'Love');
    expect(c.reactions).toEqual({ total: 1, breakdown: [{ reaction: 'Love', count: 1 }], mine: 'Love' });   // before the reply

    subject.next({ success: true, reactions: { total: 3, breakdown: [{ reaction: 'Love', count: 3 }], mine: 'Love' } });
    expect(c.reactions.total).toBe(3);
    expect(c.reactBusy).toBeFalse();
  });

  it('changes and removes a reaction', async () => {
    await setup(page([comment(1, { reactions: { total: 1, breakdown: [{ reaction: 'Like', count: 1 }], mine: 'Like' } })]));
    const c = component.comments[0];
    spyOn(svc, 'reactToComment').and.returnValue(of({ success: true, reactions: { total: 1, breakdown: [{ reaction: 'Wow', count: 1 }], mine: 'Wow' } }));
    const unreact = spyOn(svc, 'removeCommentReaction').and.returnValue(of({ success: true, reactions: noReactions() }));

    component.onReact(c, 'Wow');
    expect(c.reactions.mine).toBe('Wow');
    component.onUnreact(c);
    expect(unreact).toHaveBeenCalledWith('comment', 'c1');
    expect(c.reactions.total).toBe(0);
  });

  it('reacts to a reply through the reply target', async () => {
    await setup(page([comment(1, { replies: [reply(4, 'c1')], replies_count: 1 })]));
    const r = component.comments[0].replies[0];
    const react = spyOn(svc, 'reactToComment').and.returnValue(of({ success: true, reactions: noReactions() }));
    component.onReact(r, 'Care');
    expect(react).toHaveBeenCalledWith('reply', 4, 'Care');
  });

  it('rolls the reaction back when the request fails', async () => {
    await setup(page([comment(1)]));
    const c = component.comments[0];
    const toast = spyOn(alert, 'toastrError');
    spyOn(svc, 'reactToComment').and.returnValue(throwError(() => ({ status: 500 })));
    component.onReact(c, 'Angry');
    expect(c.reactions).toEqual(noReactions());
    expect(toast).toHaveBeenCalled();
  });

  it('ignores rapid repeat clicks while a reaction is being saved (no duplicates)', async () => {
    await setup(page([comment(1)]));
    const c = component.comments[0];
    const react = spyOn(svc, 'reactToComment').and.returnValue(new Subject<any>() as any);
    component.onReact(c, 'Like');
    component.onReact(c, 'Love');
    component.onReact(c, 'Wow');
    expect(react).toHaveBeenCalledTimes(1);
  });

  // ----------------------------------------------------------------- rendering
  it('is not affected by Bootstrap\'s global .row rule (avatars keep their size, rows keep their position)', async () => {
    await setup(page([comment(1)]));
    fixture.detectChanges();
    const avatar = el().querySelector('.cm-row > img.avatar') as HTMLImageElement;
    const row = avatar.parentElement as HTMLElement;
    const a = getComputedStyle(avatar);
    expect(a.paddingLeft).toBe('0px');
    expect(a.paddingRight).toBe('0px');
    expect(Math.round(avatar.getBoundingClientRect().width)).toBe(36);
    expect(getComputedStyle(row).marginLeft).toBe('0px');                      // Bootstrap's .row pulls it 12px left
    expect(row.classList.contains('row')).toBeFalse();
  });

  it('renders author, comment, date and time, edited flag, photo and reaction count', async () => {
    await setup(page([comment(1, {
      comment: 'Hello there', edited: true, attachment_url: 'http://x/pic.png',
      reactions: { total: 2, breakdown: [{ reaction: 'Love', count: 2 }], mine: null },
    })]));
    fixture.detectChanges();
    const text = el().textContent!;
    expect(text).toContain('User 1');
    expect(text).toContain('Hello there');
    expect(text).toContain('Edited');
    expect(el().querySelector('.attachment img')).not.toBeNull();
    expect(el().querySelector('.when')!.textContent).toMatch(/2026/);          // date ...
    expect(el().querySelector('.when')!.textContent).toMatch(/\d{1,2}:\d{2}/); // ... and time
    expect(el().querySelector('app-reaction-summary .count')!.textContent).toContain('2');
  });
});
