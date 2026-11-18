import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ViewChild,
  ViewChildren,
  ElementRef,
  QueryList,
  Input,
  ChangeDetectorRef
} from '@angular/core';

import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { ActivatedRoute } from '@angular/router';

import { Subject, Subscription, forkJoin } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';

import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

import { ProfileService } from 'src/app/services/Profile/profile.service';
import { CurriculumVitaeService } from 'src/app/services/CV/curriculum-vitae.service';
import { PostUploadImagesService } from 'src/app/services/post-upload-images.service';
import { CommentService } from 'src/app/services/comment/comment.service';
import { ReactionEmojiService } from 'src/app/services/Reaction/reaction-emoji.service';
import { PostReactionByIdService } from 'src/app/services/Reaction/post-reaction-by-id.service';
import { ClientsService } from 'src/app/services/Networking/clients.service';
import { EchoService } from 'src/app/services/echo.service';
import { NotificationsService } from 'src/app/services/Global/notifications.service';

import { ImageLightboxService } from 'src/app/ComponentSharedUI/ImageLightbox/image-lightbox.service';
import { CommentModalUIComponent } from '../../Modal/comment-modal-ui/comment-modal-ui.component';
import { ReactionPostComponent } from 'src/app/ComponentSharedUI/ReactionEmoji/reaction-post/reaction-post.component';
import { PostUIComponent } from 'src/app/ComponentSharedUI/Public/post-ui/post-ui.component';
import { SharedRoutinesService } from 'src/app/services/Function/shared-routines.service';
import { _url } from 'src/global-variables';
import { ProfileImageService } from 'src/app/services/Profile/profile-image.service';
import { applyMyReaction, emptySummary } from 'src/app/ComponentSharedUI/Reactions/reaction-meta';

interface Reaction {
  emoji: string;
  label: string;
}

@Component({
  selector: 'app-public-post',
  templateUrl: './public-post.component.html',
  styleUrls: ['./public-post.component.css']
})
export class PublicPostComponent implements OnInit, AfterViewInit, OnDestroy {
  showPopup(arg0: any) {
    throw new Error('Method not implemented.');
  }
  hidePopup(arg0: any) {
    throw new Error('Method not implemented.');
  }

  @Input() posts: any[] = [];

  postReactions: any = {};
  userReactions: any = {};
  isPopupVisible: any = {};

  newPostsQueue: any[] = [];
  newPostsAvailable = false;

  private destroy$ = new Subject<void>();
  private realtimeSub?: Subscription;
  private observer?: IntersectionObserver;
  public sharedRoutinesService: SharedRoutinesService;
  reaction = [
    { emoji: '👍', label: 'Like' },
    { emoji: '❤️', label: 'Love' },
    { emoji: '😂', label: 'Haha' },
    { emoji: '😮', label: 'Wow' },
    { emoji: '😢', label: 'Sad' },
    { emoji: '😡', label: 'Angry' }
  ];

  hovered: any;

  constructor(
    private postService: PostUploadImagesService,
    private reactionService: ReactionEmojiService,
    private reactionByIdService: PostReactionByIdService,
    private commentService: CommentService,
    private echoService: EchoService,
    private dialog: MatDialog,
    private sanitizer: DomSanitizer,
    private postDataservices: PostUploadImagesService,
    private alert: NotificationsService,
    private profileImages: ProfileImageService,
    private lightbox: ImageLightboxService
  ) { }

  hoverVisible = false;
  hoveredPostId: number | null = null;
  hoveredReactions2: any[] = [];
  hoverPosition = { x: 0, y: 0 };


  ngOnInit(): void {
    // the user's own posts show a new / removed profile photo at once
    this.profileImages.photo$.pipe(takeUntil(this.destroy$)).subscribe(url => {
      if (url === undefined) { return; }
      this.posts = this.posts.map(p => p.is_owner ? { ...p, photo_pic: url } : p);
    });
    this.loadPosts();
    this.listenRealtime();
  }

  ngAfterViewInit(): void {
    this.setupVideoObserver();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.realtimeSub?.unsubscribe();
    this.observer?.disconnect();
  }

  // ================= LOAD POSTS =================
  isLoadingPosts = false;
  loadingMore = false;
  loadError = '';
  hasMore = false;
  private page = 1;
  private readonly perPage = 10;

  loadPosts(silent = false): void {
    this.page = 1;
    this.loadError = '';
    if (!silent) { this.isLoadingPosts = true; }

    this.postService.getFeed(1, this.perPage).subscribe({
      next: (res: any) => {
        this.isLoadingPosts = false;
        if (!res?.success) {
          this.loadError = res?.message || 'We could not load your feed.';
          return;
        }
        this.posts = this.mapPosts(res.data);
        this.hasMore = (res.data || []).length >= this.perPage;
      },
      error: (err) => {
        this.isLoadingPosts = false;
        this.loadError = err?.error?.message || 'We could not load your feed. Please check your connection.';
      }
    });
  }

  loadMore(): void {
    if (this.loadingMore) { return; }
    this.loadingMore = true;

    this.postService.getFeed(this.page + 1, this.perPage).subscribe({
      next: (res: any) => {
        this.loadingMore = false;
        if (!res?.success) { return; }
        this.page++;
        this.posts = [...this.posts, ...this.mapPosts(res.data)];
        this.hasMore = (res.data || []).length >= this.perPage;
      },
      error: () => {
        this.loadingMore = false;
        this.alert.toastrError('Could not load more posts.');
      }
    });
  }

  private mapPosts(rows: any[]): any[] {
    const mapped = (rows || []).map((p: any) => this.formatPost(p));
    return mapped;   // reaction_summary, my_reaction and comments_count come with each post
  }

  formatPost(post: any) {
    return {
      ...post,
      photo_pic: post.profile_pic || post.photo_pic,
      expanded: false,
      showComments: false,
      my_reaction: post.my_reaction ?? null,
      reaction_summary: post.reaction_summary || emptySummary(),
      comments_count: post.comments_count ?? 0,
      reactBusy: false,
      images: (post.images || []).map((i: any) => ({
        ...i,
        path_url: this.normalize(i.path_url)
      })),
      videos: (post.videos || []).map((v: any) => ({
        ...v,
        path_url: this.normalize(v.path_url)
      }))
    };
  }

  /** The API returns absolute media URLs; only a relative path is prefixed with the API origin. */
  normalize(path: string): string {
    const p = (path || '').replace(/\\/g, '');
    if (/^https?:\/\//i.test(p)) { return p; }
    const origin = _url.replace(/\/api\/?$/, '');
    return origin + (p.startsWith('/') ? p : '/' + p);
  }

  // ================= REALTIME =================
  listenRealtime(): void {
    this.realtimeSub = this.echoService.newPost$
      .pipe(takeUntil(this.destroy$))
      .subscribe(post => {
        this.newPostsQueue.unshift(this.formatPost(post));
        this.newPostsAvailable = true;
      });
  }

  prependNewPosts(): void {
    this.posts = [...this.newPostsQueue, ...this.posts];
    this.newPostsQueue = [];
    this.newPostsAvailable = false;
  }

  // ================= REACTIONS =================
  loadReactions(postId: number): void {
    this.reactionService.getReactionByPostId(postId)
      .subscribe((res: any) => {

        const reactions = (res?.react || []).map((r: any) => ({
          ...r,
          emoji: this.getEmoji(r.reaction)
        }));

        const total = reactions.reduce((s: number, r: any) => s + (r.count || 0), 0);

        this.postReactions[postId] = { reactions, totalCount: total };
      });
  }

  // ================= REACTIONS (Facebook style) =================
  onReact(post: any, label: string): void { this.setPostReaction(post, label); }
  onUnreact(post: any): void { this.setPostReaction(post, null); }

  /**
   * One reaction per user per post. The counts move at once; the database's own summary then replaces
   * them, and a failed request puts everything back.
   */
  private setPostReaction(post: any, next: string | null): void {
    if (post.reactBusy) { return; }

    const previousSummary = post.reaction_summary;
    const previousMine = post.my_reaction;

    post.reaction_summary = applyMyReaction({ ...(previousSummary || emptySummary()), mine: previousMine }, next);
    post.my_reaction = next;
    post.reactBusy = true;

    const call$ = next
      ? this.reactionByIdService.setReaction(post.id, next)
      : this.reactionByIdService.removeReaction(post.id);

    call$.subscribe({
      next: (res: any) => {
        post.reactBusy = false;
        if (res?.success && res.reactions) {
          post.reaction_summary = res.reactions;
          post.my_reaction = res.reactions.mine ?? null;
        }
      },
      error: (err) => {
        post.reactBusy = false;
        post.reaction_summary = previousSummary;
        post.my_reaction = previousMine;
        this.alert.toastrError(err?.error?.message || 'Your reaction could not be saved. Please try again.');
      }
    });
  }

  toggleComments(post: any): void {
    post.showComments = !post.showComments;
  }

  getEmoji(label: string): string {
    return {
      Like: '👍',
      Love: '❤️',
      Haha: '😂',
      Wow: '😮',
      Sad: '😢',
      Angry: '😡'
    }[label] || '👍';
  }

  // ================= COMMENTS =================
  addComment(post: any) {
    const text = post.newComment?.trim();
    if (!text) return;

    this.commentService.postComment(post.posts_uuid, { comment: text })
      .subscribe(() => post.newComment = '');
  }

  // ================= MODALS =================
  /** Picture viewer: centred, fixed to the viewport, never larger than the screen (see ImageLightboxComponent). */
  openImages(images: any[], startIndex = 0) {
    const items = (images || [])
      .filter(i => i?.path_url)
      .map(i => ({ src: i.path_url as string, type: (i.posts_type === 'video' ? 'video' : 'image') as 'image' | 'video' }));
    if (items.length) { this.lightbox.open(items, startIndex); }
  }

  openComments(post: any) {
    this.dialog.open(CommentModalUIComponent, {
      width: '800px',
      maxWidth: '96vw',
      data: post
    }).afterClosed().subscribe(() => this.loadPosts(true));
  }

  openReactions(postId: number) {
    this.dialog.open(ReactionPostComponent, {
      width: '600px',
      data: postId
    });
  }

  // ================= VIDEO AUTOPLAY =================
  @ViewChildren('videoEl') videoElements!: QueryList<ElementRef>;

  setupVideoObserver() {
    this.observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const video = entry.target as HTMLVideoElement;

        if (entry.isIntersecting) video.play().catch(() => { });
        else video.pause();
      });
    }, { threshold: 0.6 });

    setTimeout(() => {
      this.videoElements.forEach(v =>
        this.observer?.observe(v.nativeElement)
      );
    }, 300);
  }


  onEditPost(post: any) {
    const dialogConfig = new MatDialogConfig();
    dialogConfig.disableClose = true;
    dialogConfig.autoFocus = false;
    dialogConfig.width = '600px';
    dialogConfig.maxWidth = '96vw';
    dialogConfig.data = post;
    const dialogRef = this.dialog.open(PostUIComponent, dialogConfig);

    // Cancel closes with false: nothing changes and nothing is reloaded.
    // A save closes with the updated post, which replaces the old one in place (no refresh needed).
    dialogRef.afterClosed().subscribe((result: any) => {
      if (result?.post) {
        this.applyEditedPost(result.post);
      }
    });
  }

  /** Swap the edited post's fields into the feed; likes, comments, owner flag and position are kept. */
  private applyEditedPost(updated: any): void {
    const index = this.posts.findIndex(p => p.id === updated.id);
    if (index < 0) { return; }
    const fresh = this.formatPost(updated);
    this.posts[index] = {
      ...this.posts[index],
      caption: fresh.caption,
      status: fresh.status,
      updated_at: fresh.updated_at,
      images: fresh.images,
      videos: fresh.videos,
      expanded: false
    };
    this.posts = [...this.posts];   // new array reference so the list re-renders immediately
  }


  isLoading: boolean = false;
  onDelete(post: any): void {
    this.alert.popupWarning("", "Are you sure you want to delete this post?").then((result: any) => {
      if (result?.value) {
        this.isLoading = true;
        this.postDataservices.deletePost(post.posts_uuid).subscribe({
          next: (res: any) => {
            if (res.success === true) {
              this.alert.toastrSuccess(res.message);
            } else {
              this.alert.toastrError(res.message);
            }
            this.loadPosts();
            this.isLoading = false;
          },
          error: (error: any) => {
            this.alert.toastrError(error.error?.message || "An error occurred while deleting the post.");
            this.isLoading = false;
          }
        });
      }
    });
  }


}