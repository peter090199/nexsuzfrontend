import { Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

import { CommentService } from 'src/app/services/comment/comment.service';
import { AuthService } from 'src/app/services/auth.service';
import { ProfileService } from 'src/app/services/Profile/profile.service';
import { NotificationsService } from 'src/app/services/Global/notifications.service';
import { ReactionPostComponent } from 'src/app/ComponentSharedUI/ReactionEmoji/reaction-post/reaction-post.component';
import { applyMyReaction, emptySummary } from '../../Reactions/reaction-meta';
import { ProfileImageService } from 'src/app/services/Profile/profile-image.service';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

interface PickedImage { file: File; url: string; safe: SafeUrl; }

/**
 * Comment section for one post (Facebook style): comments with an optional photo, replies,
 * edit / delete for the author, reactions on every comment and reply, "view more" paging.
 *
 * Every action updates the list immediately from the server's reply; nothing is a front-end only demo.
 */
@Component({
  selector: 'app-post-comments',
  templateUrl: './post-comments.component.html',
  styleUrls: ['./post-comments.component.css']
})
export class PostCommentsComponent implements OnInit, OnChanges, OnDestroy {
  /** posts.posts_uuid (or an attachment's posts_uuind) of the post being discussed */
  @Input() postUuid = '';
  /** comments + replies after every change, so the feed's counter can follow */
  @Output() countChange = new EventEmitter<number>();

  readonly pageSize = 5;
  readonly maxChars = 2000;
  readonly maxImageMB = 3;
  readonly allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  readonly defaultAvatar = 'assets/images/default.png';

  comments: any[] = [];
  total = 0;                    // comments + replies
  hasMore = false;
  private nextBefore: number | null = null;

  isLoading = false;
  isLoadingMore = false;
  loadError = '';

  me = { code: null as any, photo: '' };
  private photoSub?: Subscription;

  // new comment
  draft = '';
  draftImage: PickedImage | null = null;
  composerError = '';
  isSubmitting = false;

  constructor(
    private commentService: CommentService,
    private auth: AuthService,
    private profile: ProfileService,
    private alert: NotificationsService,
    private dialog: MatDialog,
    private sanitizer: DomSanitizer,
    private profileImages: ProfileImageService
  ) { }

  // ------------------------------------------------------------------ lifecycle

  ngOnInit(): void {
    this.me.code = this.auth.getAuthCode();
    this.profile.getProfileByBasicInfo().subscribe({
      next: (res: any) => this.me.photo = res?.data?.photo_pic || '',
      error: () => { }
    });
    this.photoSub = this.profileImages.photo$.pipe(filter(url => url !== undefined)).subscribe(url => {
      this.me.photo = url || '';
      // the user's own comments and replies show the new photo too
      this.comments.forEach(c => {
        if (String(c.code) === String(this.me.code)) { c.profile_pic = url; }
        (c.replies || []).forEach((r: any) => { if (String(r.code) === String(this.me.code)) { r.profile_pic = url; } });
      });
    });
    this.loadFirstPage();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['postUuid'] && !changes['postUuid'].firstChange) {
      this.loadFirstPage();
    }
  }

  ngOnDestroy(): void {
    this.photoSub?.unsubscribe();
    this.revoke(this.draftImage);
    this.comments.forEach(c => this.revoke(c.replyImage));
  }

  // ------------------------------------------------------------------ loading

  loadFirstPage(): void {
    if (!this.postUuid) { return; }
    this.isLoading = true;
    this.loadError = '';

    this.commentService.list(this.postUuid, this.pageSize).subscribe({
      next: (res: any) => {
        this.isLoading = false;
        if (!res?.success) {
          this.loadError = res?.message || 'Comments could not be loaded.';
          return;
        }
        this.comments = (res.data || []).map((c: any) => this.decorate(c));
        this.total = res.total_with_replies ?? 0;
        this.hasMore = !!res.has_more;
        this.nextBefore = res.next_before ?? null;
        this.emitCount();
      },
      error: (err) => {
        this.isLoading = false;
        this.loadError = this.errorText(err, 'Comments could not be loaded. Please check your connection.');
      }
    });
  }

  loadMore(): void {
    if (this.isLoadingMore || !this.hasMore) { return; }
    this.isLoadingMore = true;

    this.commentService.list(this.postUuid, this.pageSize, this.nextBefore).subscribe({
      next: (res: any) => {
        this.isLoadingMore = false;
        if (!res?.success) { return; }
        const known = new Set(this.comments.map(c => c.comment_uuid));          // a new comment may have shifted the pages
        this.comments = [...this.comments, ...(res.data || []).filter((c: any) => !known.has(c.comment_uuid)).map((c: any) => this.decorate(c))];
        this.hasMore = !!res.has_more;
        this.nextBefore = res.next_before ?? this.nextBefore;
      },
      error: (err) => {
        this.isLoadingMore = false;
        this.alert.toastrError(this.errorText(err, 'More comments could not be loaded.'));
      }
    });
  }

  /** Add the view-only state every comment/reply carries. */
  private decorate(item: any, isReply = false): any {
    const base = {
      ...item,
      reactions: item.reactions || emptySummary(),
      editing: false, editText: '', editRemoveImage: false, editError: '', busy: false, reactBusy: false,
    };
    if (isReply) { return base; }
    return {
      ...base,
      replies: (item.replies || []).map((r: any) => this.decorate(r, true)),
      replying: false, replyText: '', replyImage: null as PickedImage | null, replyError: '', replyBusy: false,
      showAllReplies: false,
    };
  }

  private emitCount(): void {
    this.countChange.emit(this.total);
  }

  // ------------------------------------------------------------------ new comment

  get canSend(): boolean {
    return !this.isSubmitting && (this.draft.trim().length > 0 || !!this.draftImage);
  }

  submitComment(): void {
    if (this.isSubmitting) { return; }                                  // no duplicate submissions
    const text = this.draft.trim();

    if (!text && !this.draftImage) { this.composerError = 'Write a comment or attach an image.'; return; }
    if (text.length > this.maxChars) { this.composerError = `A comment can be up to ${this.maxChars} characters.`; return; }

    this.composerError = '';
    this.isSubmitting = true;

    this.commentService.create(this.postUuid, text, this.draftImage?.file).subscribe({
      next: (res: any) => {
        this.isSubmitting = false;
        if (!res?.success || !res.data) {
          this.composerError = res?.message || 'Your comment could not be posted.';
          return;
        }
        if (!this.comments.some(c => c.comment_uuid === res.data.comment_uuid)) {
          this.comments = [this.decorate(res.data), ...this.comments];    // shows at the top immediately
          if (!res.duplicate) { this.total++; }
        }
        this.draft = '';
        this.clearDraftImage();
        this.emitCount();
      },
      error: (err) => {
        this.isSubmitting = false;
        this.composerError = this.errorText(err, 'Your comment could not be posted. Please try again.');
      }
    });
  }

  /** Enter sends on a desktop keyboard; Shift+Enter (and the phone keyboard's Enter) add a new line. */
  private enterShouldSend(event: Event): boolean {
    const e = event as KeyboardEvent;
    const hasFinePointer = typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(pointer: fine)').matches;
    if (e.shiftKey || !hasFinePointer) { return false; }
    e.preventDefault();
    return true;
  }

  onEnter(event: Event): void {
    if (this.enterShouldSend(event)) { this.submitComment(); }
  }

  onReplyEnter(event: Event, c: any): void {
    if (this.enterShouldSend(event)) { this.submitReply(c); }
  }

  pickDraftImage(event: Event): void {
    const picked = this.pick(event, err => this.composerError = err);
    if (picked) { this.revoke(this.draftImage); this.draftImage = picked; this.composerError = ''; }
  }

  clearDraftImage(): void {
    this.revoke(this.draftImage);
    this.draftImage = null;
  }

  // ------------------------------------------------------------------ replies

  visibleReplies(c: any): any[] {
    return c.showAllReplies || c.replies.length <= 1 ? c.replies : c.replies.slice(-1);
  }

  /** target: the reply being answered (its author is @mentioned); the reply still hangs under the top-level comment. */
  startReply(c: any, target: any = null): void {
    c.replying = true;
    c.showAllReplies = true;
    c.replyError = '';
    if (target && !c.replyText) { c.replyText = `@${target.fullname} `; }
    setTimeout(() => document.getElementById('reply-' + c.comment_uuid)?.focus(), 0);
  }

  cancelReply(c: any): void {
    c.replying = false;
    c.replyText = '';
    c.replyError = '';
    this.revoke(c.replyImage);
    c.replyImage = null;
  }

  pickReplyImage(c: any, event: Event): void {
    const picked = this.pick(event, err => c.replyError = err);
    if (picked) { this.revoke(c.replyImage); c.replyImage = picked; c.replyError = ''; }
  }

  clearReplyImage(c: any): void {
    this.revoke(c.replyImage);
    c.replyImage = null;
  }

  canSendReply(c: any): boolean {
    return !c.replyBusy && (String(c.replyText || '').trim().length > 0 || !!c.replyImage);
  }

  submitReply(c: any): void {
    if (c.replyBusy) { return; }
    const text = String(c.replyText || '').trim();

    if (!text && !c.replyImage) { c.replyError = 'Write a reply or attach an image.'; return; }
    if (text.length > this.maxChars) { c.replyError = `A reply can be up to ${this.maxChars} characters.`; return; }

    c.replyError = '';
    c.replyBusy = true;

    this.commentService.reply(c.comment_uuid, text, c.replyImage?.file).subscribe({
      next: (res: any) => {
        c.replyBusy = false;
        if (!res?.success || !res.data) { c.replyError = res?.message || 'Your reply could not be posted.'; return; }
        if (!c.replies.some((r: any) => r.id === res.data.id)) {
          c.replies = [...c.replies, this.decorate(res.data, true)];
          c.replies_count = c.replies.length;
          if (!res.duplicate) { this.total++; }
        }
        this.cancelReply(c);
        this.emitCount();
      },
      error: (err) => {
        c.replyBusy = false;
        c.replyError = this.errorText(err, 'Your reply could not be posted. Please try again.');
      }
    });
  }

  // ------------------------------------------------------------------ edit

  startEdit(item: any): void {
    item.editing = true;
    item.editText = item.comment;
    item.editRemoveImage = false;
    item.editError = '';
  }

  cancelEdit(item: any): void {
    item.editing = false;
    item.editError = '';
  }

  canSaveEdit(item: any): boolean {
    const keepsImage = !!item.attachment_url && !item.editRemoveImage;
    return !item.busy && (String(item.editText || '').trim().length > 0 || keepsImage);
  }

  saveEdit(item: any): void {
    if (item.busy) { return; }
    const text = String(item.editText || '').trim();
    const keepsImage = !!item.attachment_url && !item.editRemoveImage;

    if (!text && !keepsImage) { item.editError = 'A comment needs some text or an image.'; return; }
    if (text.length > this.maxChars) { item.editError = `A comment can be up to ${this.maxChars} characters.`; return; }

    const isReply = item.type === 'reply';
    item.editError = '';
    item.busy = true;

    this.commentService.edit(isReply ? item.id : item.comment_uuid, isReply ? 'com_replies' : 'com_headers', text,
      { removeImage: item.editRemoveImage }).subscribe({
        next: (res: any) => {
          item.busy = false;
          if (!res?.success || !res.data) { item.editError = res?.message || 'The change could not be saved.'; return; }
          item.comment = res.data.comment;
          item.attachment_url = res.data.attachment_url;
          item.updated_at = res.data.updated_at;
          item.edited = true;
          item.editing = false;
          this.alert.toastrSuccess(isReply ? 'Reply updated.' : 'Comment updated.');
        },
        error: (err) => {
          item.busy = false;
          item.editError = this.errorText(err, 'The change could not be saved. Please try again.');
        }
      });
  }

  // ------------------------------------------------------------------ delete

  confirmDelete(item: any, parent: any = null): void {
    const isReply = item.type === 'reply';
    this.alert.popupWarning('', isReply ? 'Delete this reply?' : 'Delete this comment and its replies?').then((result: any) => {
      if (result?.value) { this.delete(item, parent); }
    });
  }

  delete(item: any, parent: any = null): void {
    if (item.busy) { return; }
    const isReply = item.type === 'reply';
    item.busy = true;

    this.commentService.remove(isReply ? item.id : item.comment_uuid, isReply ? 'com_replies' : 'com_headers').subscribe({
      next: (res: any) => {
        if (!res?.success) { item.busy = false; this.alert.toastrError(res?.message || 'It could not be deleted.'); return; }
        if (isReply && parent) {
          parent.replies = parent.replies.filter((r: any) => r.id !== item.id);
          parent.replies_count = parent.replies.length;
          this.total = Math.max(0, this.total - 1);
        } else {
          this.total = Math.max(0, this.total - 1 - (item.replies?.length || 0));
          this.revoke(item.replyImage);
          this.comments = this.comments.filter(c => c.comment_uuid !== item.comment_uuid);
        }
        this.emitCount();
        this.alert.toastrSuccess(isReply ? 'Reply deleted.' : 'Comment deleted.');
      },
      error: (err) => {
        item.busy = false;
        this.alert.toastrError(this.errorText(err, 'It could not be deleted. Please try again.'));
      }
    });
  }

  // ------------------------------------------------------------------ reactions on comments / replies

  onReact(item: any, label: string): void { this.setReaction(item, label); }
  onUnreact(item: any): void { this.setReaction(item, null); }

  private setReaction(item: any, next: string | null): void {
    if (item.reactBusy) { return; }                                     // one request at a time per comment
    const previous = item.reactions;
    item.reactions = applyMyReaction(previous, next);                   // instant
    item.reactBusy = true;

    const type = item.type === 'reply' ? 'reply' : 'comment';
    const ref = type === 'reply' ? item.id : item.comment_uuid;
    const call$ = next ? this.commentService.reactToComment(type, ref, next) : this.commentService.removeCommentReaction(type, ref);

    call$.subscribe({
      next: (res: any) => {
        item.reactBusy = false;
        if (res?.success && res.reactions) { item.reactions = res.reactions; }      // the database's own numbers
      },
      error: (err) => {
        item.reactBusy = false;
        item.reactions = previous;                                      // roll back
        this.alert.toastrError(this.errorText(err, 'Your reaction could not be saved.'));
      }
    });
  }

  openReactors(item: any): void {
    const type = item.type === 'reply' ? 'reply' : 'comment';
    this.dialog.open(ReactionPostComponent, {
      width: '600px',
      maxWidth: '96vw',
      data: { type, ref: type === 'reply' ? item.id : item.comment_uuid }
    });
  }

  // ------------------------------------------------------------------ helpers

  trackComment = (_: number, c: any) => c.comment_uuid;
  trackReply = (_: number, r: any) => r.id;

  /** Validate a chosen file; on success returns a preview built from URL.createObjectURL. */
  private pick(event: Event, onError: (message: string) => void): PickedImage | null {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) { return null; }

    if (!this.allowedTypes.includes(file.type)) { onError(`"${file.name}" is not supported. Use JPG, PNG, GIF or WEBP.`); return null; }
    if (file.size > this.maxImageMB * 1024 * 1024) { onError(`"${file.name}" is larger than ${this.maxImageMB} MB.`); return null; }

    const url = URL.createObjectURL(file);
    return { file, url, safe: this.sanitizer.bypassSecurityTrustUrl(url) };   // blob: URLs are rewritten to "unsafe:" otherwise
  }

  private revoke(image: PickedImage | null | undefined): void {
    if (image) { URL.revokeObjectURL(image.url); }
  }

  private errorText(err: any, fallback: string): string {
    if (err?.status === 0) { return 'You appear to be offline. Please check your connection and try again.'; }
    const fieldErrors = err?.error?.errors ? (Object.values(err.error.errors)[0] as string[])?.[0] : '';
    return err?.error?.message || fieldErrors || fallback;
  }
}
