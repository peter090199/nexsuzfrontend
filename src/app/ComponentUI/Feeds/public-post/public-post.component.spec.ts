import { Subject, throwError } from 'rxjs';
import { of } from 'rxjs';
import { NexsuzTestingModule } from 'src/testing/nexsuz-testing.module';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PublicPostComponent } from './public-post.component';

describe('PublicPostComponent', () => {
  let component: PublicPostComponent;
  let fixture: ComponentFixture<PublicPostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NexsuzTestingModule],
      schemas: [NO_ERRORS_SCHEMA],
      declarations: [ PublicPostComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PublicPostComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('edit post in the feed', () => {
    const base = () => ([
      { id: 1, caption: 'first', is_owner: true, my_reaction: 'Like', comments_count: 3, photo_pic: 'a.png',
        images: [{ posts_uuind: 'x', path_url: 'http://localhost:8000/storage/uploads/posts/1/a/x.png' }], videos: [], status: 1 },
      { id: 2, caption: 'second', is_owner: false, my_reaction: null, comments_count: 0, images: [], videos: [], status: 1 },
    ]);

    beforeEach(() => {
      component.posts = base();
    });

    it('swaps the edited post in place and keeps likes, comments, owner flag and position', () => {
      (component as any).applyEditedPost({
        id: 1, caption: 'first (edited)', status: 0, updated_at: '2026-11-16 12:00:00',
        images: [{ posts_uuind: 'y', path_url: 'http://localhost:8000/storage/uploads/posts/1/a/y.png' }], videos: [],
      });

      expect(component.posts.length).toBe(2);
      const edited = component.posts[0];
      expect(edited.id).toBe(1);                                      // same post, same position
      expect(edited.caption).toBe('first (edited)');
      expect(edited.images.map((i: any) => i.posts_uuind)).toEqual(['y']);
      expect(edited.my_reaction).toBe('Like');                        // reaction kept
      expect(edited.comments_count).toBe(3);                          // comment count kept
      expect(edited.is_owner).toBeTrue();
      expect(edited.photo_pic).toBe('a.png');                         // author avatar kept
      expect(component.posts[1].caption).toBe('second');              // other posts untouched
    });

    it('creates a new list reference so the view refreshes immediately', () => {
      const before = component.posts;
      (component as any).applyEditedPost({ id: 1, caption: 'x', images: [], videos: [] });
      expect(component.posts).not.toBe(before);
    });

    it('ignores an edited post that is not in the list', () => {
      (component as any).applyEditedPost({ id: 999, caption: 'ghost', images: [], videos: [] });
      expect(component.posts.map(p => p.caption)).toEqual(['first', 'second']);
    });

    it('opens the editor with the selected post and applies the saved result', () => {
      const updated = { id: 2, caption: 'second (edited)', images: [], videos: [] };
      const dialog = (component as any).dialog;
      const open = spyOn(dialog, 'open').and.returnValue({ afterClosed: () => of({ post: updated }) } as any);

      const target = component.posts[1];

      component.onEditPost(target);

      expect((open.calls.mostRecent().args as any[])[1].data).toBe(target);     // the editor receives the selected post
      expect(component.posts[1].caption).toBe('second (edited)');     // and its saved result is applied
    });

    it('cancel leaves the feed exactly as it was (no reload, no change)', () => {
      const dialog = (component as any).dialog;
      spyOn(dialog, 'open').and.returnValue({ afterClosed: () => of(false) } as any);
      const reload = spyOn(component, 'loadPosts');
      const snapshot = JSON.stringify(component.posts);

      component.onEditPost(component.posts[0]);

      expect(reload).not.toHaveBeenCalled();
      expect(JSON.stringify(component.posts)).toBe(snapshot);
    });
  });


  describe('reactions and comments in the feed', () => {
    const post = () => ({
      id: 5, posts_uuid: 'uuid-5', caption: 'hello', my_reaction: null as string | null,
      reaction_summary: { total: 2, breakdown: [{ reaction: 'Like', count: 2 }], mine: null as string | null },
      comments_count: 4, showComments: false, reactBusy: false, images: [], videos: [],
    });
    let reactions: any;

    beforeEach(() => {
      reactions = (component as any).reactionByIdService;
      component.posts = [post()];
    });

    it('moves the counts at once, then adopts the numbers the database returns', () => {
      const reply = new Subject<any>();
      const set = spyOn(reactions, 'setReaction').and.returnValue(reply as any);

      component.onReact(component.posts[0], 'Love');

      expect(set).toHaveBeenCalledWith(5, 'Love');
      expect(component.posts[0].my_reaction).toBe('Love');                       // instant
      expect(component.posts[0].reaction_summary.total).toBe(3);
      expect(component.posts[0].reactBusy).toBeTrue();

      reply.next({ success: true, reactions: { total: 9, breakdown: [{ reaction: 'Love', count: 7 }, { reaction: 'Like', count: 2 }], mine: 'Love' } });

      expect(component.posts[0].reaction_summary.total).toBe(9);               // the server's truth
      expect(component.posts[0].my_reaction).toBe('Love');
      expect(component.posts[0].reactBusy).toBeFalse();
    });

    it('changing the reaction does not add a second vote', () => {
      component.posts = [{ ...post(), my_reaction: 'Like', reaction_summary: { total: 2, breakdown: [{ reaction: 'Like', count: 2 }], mine: 'Like' } }];
      spyOn(reactions, 'setReaction').and.returnValue(new Subject<any>() as any);

      component.onReact(component.posts[0], 'Haha');

      expect(component.posts[0].reaction_summary.total).toBe(2);
      expect(component.posts[0].reaction_summary.breakdown).toEqual(
        jasmine.arrayContaining([{ reaction: 'Haha', count: 1 }, { reaction: 'Like', count: 1 }]));
    });

    it('removing a reaction takes the vote back', () => {
      component.posts = [{ ...post(), my_reaction: 'Like', reaction_summary: { total: 2, breakdown: [{ reaction: 'Like', count: 2 }], mine: 'Like' } }];
      const remove = spyOn(reactions, 'removeReaction').and.returnValue(new Subject<any>() as any);

      component.onUnreact(component.posts[0]);

      expect(remove).toHaveBeenCalledWith(5);
      expect(component.posts[0].my_reaction).toBeNull();
      expect(component.posts[0].reaction_summary.total).toBe(1);
    });

    it('puts everything back and tells the user when saving fails', () => {
      const toast = spyOn((component as any).alert, 'toastrError');
      spyOn(reactions, 'setReaction').and.returnValue(throwError(() => ({ status: 500, error: { message: 'Nope' } })));

      component.onReact(component.posts[0], 'Wow');

      expect(component.posts[0].my_reaction).toBeNull();
      expect(component.posts[0].reaction_summary.total).toBe(2);
      expect(component.posts[0].reactBusy).toBeFalse();
      expect(toast).toHaveBeenCalledWith('Nope');
    });

    it('ignores extra clicks while a reaction is being saved', () => {
      const set = spyOn(reactions, 'setReaction').and.returnValue(new Subject<any>() as any);
      component.onReact(component.posts[0], 'Like');
      component.onReact(component.posts[0], 'Love');
      component.onReact(component.posts[0], 'Wow');
      expect(set).toHaveBeenCalledTimes(1);
    });

    it('opens and closes the inline comment section', () => {
      expect(component.posts[0].showComments).toBeFalse();
      component.toggleComments(component.posts[0]);
      expect(component.posts[0].showComments).toBeTrue();
      component.toggleComments(component.posts[0]);
      expect(component.posts[0].showComments).toBeFalse();
    });

    it('gives every loaded post a reaction summary, a reaction and a comment count even when the API sends none', () => {
      const formatted = component.formatPost({ id: 1, images: [], videos: [] });
      expect(formatted.reaction_summary).toEqual({ total: 0, breakdown: [], mine: null });
      expect(formatted.my_reaction).toBeNull();
      expect(formatted.comments_count).toBe(0);
    });
  });

  describe('"No posts yet" card', () => {
    const card = () => (fixture.nativeElement as HTMLElement).querySelector('[data-testid="no-posts"]') as HTMLElement | null;
    const show = (over: Partial<{ loading: boolean; error: string; posts: any[] }> = {}) => {
      component.isLoadingPosts = over.loading ?? false;
      component.loadError = over.error ?? '';
      component.posts = over.posts ?? [];
      fixture.detectChanges();
    };

    it('is a mat-card with the same look as "Start a post" (the global nx-card), with the message', () => {
      show();
      const c = card()!;
      expect(c).not.toBeNull();
      expect(c.tagName.toLowerCase()).toBe('mat-card');
      expect(c.classList.contains('nx-card')).toBeTrue();
      expect(c.textContent).toContain('No posts yet');
      expect(c.textContent).toContain('Share an update or connect with people to see posts here.');
      expect(c.getAttribute('role')).toBe('status');
    });

    it('only shows when there is nothing loading, no error and no post', () => {
      show({ loading: true }); expect(card()).toBeNull();
      show({ error: 'The feed could not be loaded.' }); expect(card()).toBeNull();
      show({ posts: [{ id: 1, caption: 'hi', images: [], videos: [], status: 1, created_at: '2026-11-24 10:00:00' }] }); expect(card()).toBeNull();
      show(); expect(card()).not.toBeNull();
    });

    it('has layout rules for tablet and phone widths and never grows wider than its column', () => {
      const css = ((PublicPostComponent as any).ɵcmp.styles as string[]).join('\n');
      const rules = css.slice(css.indexOf('feed-empty'));
      expect(rules).toContain('@media (max-width: 768px)');
      expect(rules).toContain('@media (max-width: 599.98px)');
      expect(rules).toContain('@media (max-width: 359.98px)');
      expect(rules).toContain('max-width: 100%');
      expect(rules).toContain('box-sizing: border-box');
      expect(rules).toContain('overflow-wrap: anywhere');
    });
  });
});