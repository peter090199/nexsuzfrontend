import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Subscription } from 'rxjs';
import { EchoService } from 'src/app/services/echo.service';
import { CommentService } from 'src/app/services/comment/comment.service';
import { NotificationsService } from 'src/app/services/Global/notifications.service';
import { SharedRoutinesService } from 'src/app/services/Function/shared-routines.service';
import { Announcement, AnnouncementService, AnnouncementStatus } from 'src/app/services/Announcements/announcement.service';
import { SettingsConfirmDialogComponent } from 'src/app/ComponentUI/profile/settings/confirm-dialog/confirm-dialog.component';
import { AnnouncementDialogComponent } from './announcement-dialog.component';

interface Thread { open: boolean; loading: boolean; list: any[]; text: string; sending: boolean; }

/** the section starts CLOSED; what the user chose is kept for this browser session, and the newest announcement they have looked at for good */
const OPEN_KEY = 'nx-announcements-open';
const SEEN_KEY = 'nx-announcements-seen';

/**
 * Announcements at the top of the Home feed: every job seeker and recruiter sees the live ones (no connection needed), and an
 * administrator also gets "New announcement" and a management list (publish, archive, restore, edit, delete).
 * What is shown, and who may change what, is decided by the API; this component only asks and displays.
 * It refreshes on the live "published" signal and every minute, so a new announcement appears without reloading the page.
 */
@Component({
  selector: 'app-announcements',
  template: `
    <section class="ann" *ngIf="isManager || items.length || error" aria-label="Announcements" data-testid="announcements">

      <!-- the bar: always there, so the section can be opened (it starts closed) -->
      <mat-card class="ann-head" [class.open]="open">
        <div class="head-main">
          <mat-icon class="head-ico">campaign</mat-icon>
          <div class="head-text">
            <h2>Announcements</h2>
            <small data-testid="summary">{{ summaryText }}</small>
          </div>
          <span class="chip new" *ngIf="newCount && !open" data-testid="new-badge">{{ newCount }} new</span>
          <span class="chip urgent" *ngIf="urgentCount && !open" data-testid="urgent-badge">{{ urgentCount }} urgent</span>
        </div>
        <div class="head-actions">
          <ng-container *ngIf="isManager">
            <button mat-flat-button color="primary" type="button" (click)="create()" data-testid="new-announcement"><mat-icon>add</mat-icon><span class="lbl">New announcement</span></button>
            <button mat-stroked-button type="button" (click)="toggleManage()" data-testid="manage-toggle"><mat-icon>tune</mat-icon><span class="lbl">{{ manageMode ? 'Hide management' : 'Manage' }}</span></button>
          </ng-container>
          <button mat-stroked-button color="primary" type="button" class="view-btn" (click)="toggle()" [attr.aria-expanded]="open" aria-controls="announcements-body" data-testid="toggle">
            <mat-icon>{{ open ? 'expand_less' : 'expand_more' }}</mat-icon><span>{{ open ? 'Hide' : 'View' }}</span>
          </button>
        </div>
      </mat-card>

      <!-- the content: only when opened -->
      <div class="ann-body" id="announcements-body" *ngIf="open" data-testid="announcements-body">

        <p class="err" *ngIf="error" role="alert"><mat-icon>error_outline</mat-icon> <span>{{ error }}</span> <button mat-button type="button" (click)="reloadAll()">Retry</button></p>

        <!-- ===================== administrators: manage ===================== -->
        <mat-card class="manage" *ngIf="isManager && manageMode" data-testid="manage-panel">
          <div class="tabs" role="tablist">
            <button type="button" role="tab" *ngFor="let t of tabs" [class.on]="manageTab === t.key" [attr.aria-selected]="manageTab === t.key" (click)="selectTab(t.key)">
              {{ t.label }} <b>{{ counts[t.key] || 0 }}</b>
            </button>
          </div>
          <p class="empty" *ngIf="!manageItems.length">Nothing here yet.</p>
          <ul class="mlist" *ngIf="manageItems.length">
            <li *ngFor="let a of manageItems; trackBy: trackById" [attr.data-testid]="'manage-row-' + a.id">
              <div class="mtext">
                <strong>{{ a.title }}</strong>
                <small>
                  <span class="chip" [class]="'st-' + (a.is_expired ? 'expired' : a.status)">{{ a.is_expired ? 'Expired' : (a.status | titlecase) }}</span>
                  <span class="chip pr" *ngIf="a.priority !== 'normal'">{{ a.priority | titlecase }}</span>
                  <span class="chip pin" *ngIf="a.is_pinned">Pinned</span>
                  <span class="mmeta">by {{ a.author.fullname }} · {{ (a.published_at || a.created_at) | date:'MMM d, y' }}<ng-container *ngIf="a.expires_at"> · expires {{ a.expires_at | date:'MMM d, y' }}</ng-container></span>
                </small>
              </div>
              <div class="macts">
                <button mat-icon-button type="button" *ngIf="a.can_edit" (click)="edit(a)" matTooltip="Edit" [attr.aria-label]="'Edit ' + a.title" data-testid="act-edit"><mat-icon>edit</mat-icon></button>
                <button mat-icon-button type="button" *ngIf="a.can_edit && a.status !== 'published'" (click)="change(a, 'published')" matTooltip="Publish" [attr.aria-label]="'Publish ' + a.title" data-testid="act-publish"><mat-icon>campaign</mat-icon></button>
                <button mat-icon-button type="button" *ngIf="a.can_moderate && a.status === 'published'" (click)="change(a, 'archived')" matTooltip="Archive" [attr.aria-label]="'Archive ' + a.title" data-testid="act-archive"><mat-icon>archive</mat-icon></button>
                <button mat-icon-button type="button" *ngIf="a.can_edit && a.status === 'archived'" (click)="change(a, 'draft')" matTooltip="Move back to drafts" [attr.aria-label]="'Move ' + a.title + ' to drafts'" data-testid="act-draft"><mat-icon>drafts</mat-icon></button>
                <button mat-icon-button type="button" color="warn" *ngIf="a.can_moderate" (click)="remove(a)" matTooltip="Delete" [attr.aria-label]="'Delete ' + a.title" data-testid="act-delete"><mat-icon>delete</mat-icon></button>
              </div>
            </li>
          </ul>
        </mat-card>

        <!-- ===================== the announcements everybody sees ===================== -->
        <p class="empty" *ngIf="isManager && !items.length && !error">No announcement is live right now.</p>

        <mat-card class="card" *ngFor="let a of items; trackBy: trackById" [class.urgent]="a.priority === 'urgent'" [class.important]="a.priority === 'important'" [attr.data-testid]="'card-' + a.id">
          <div class="byline">
            <img class="avatar" [src]="a.author.photo_pic || 'assets/images/default.png'" nxFallback alt="" />
            <div class="who">
              <strong>{{ a.author.fullname }}</strong>
              <small>{{ roleLabel(a.author.role_code) }} · {{ a.published_at | date:'MMM d, y, h:mm a' }}</small>
            </div>
            <div class="tags">
              <span class="chip pin" *ngIf="a.is_pinned"><mat-icon>push_pin</mat-icon> Pinned</span>
              <span class="chip pr" [class.u]="a.priority === 'urgent'" *ngIf="a.priority !== 'normal'">{{ a.priority | titlecase }}</span>
            </div>
          </div>

          <h3>{{ a.title }}</h3>
          <p class="body" [class.clamp]="a.content.length > 420 && !expanded[a.id]">{{ a.content }}</p>
          <button type="button" class="link" *ngIf="a.content.length > 420" (click)="expanded[a.id] = !expanded[a.id]">{{ expanded[a.id] ? 'Show less' : 'Show more' }}</button>

          <div class="images" *ngIf="a.images.length" [class.one]="a.images.length === 1">
            <a *ngFor="let i of a.images" [href]="i.url" target="_blank" rel="noopener"><img [src]="i.url" nxFallback loading="lazy" [alt]="i.name || 'Announcement image'" /></a>
          </div>
          <ul class="attachments" *ngIf="a.attachments.length">
            <li *ngFor="let f of a.attachments"><mat-icon>attach_file</mat-icon><a [href]="f.url" target="_blank" rel="noopener" download>{{ f.name }}</a><small>{{ sizeText(f.size) }}</small></li>
          </ul>
          <small class="expires" *ngIf="a.expires_at">Until {{ a.expires_at | date:'MMM d, y, h:mm a' }}</small>

          <div class="stats" *ngIf="a.reaction_summary.total || a.comments_count">
            <span *ngIf="a.reaction_summary.total" class="rx"><span *ngFor="let b of a.reaction_summary.breakdown">{{ emoji(b.reaction) }}</span> {{ a.reaction_summary.total }}</span>
            <button type="button" class="link" *ngIf="a.comments_count" (click)="toggleComments(a)">{{ a.comments_count }} comment{{ a.comments_count === 1 ? '' : 's' }}</button>
          </div>

          <div class="acts">
            <div class="react">
              <button mat-button type="button" (click)="pickerFor = pickerFor === a.id ? null : a.id" [class.mine]="!!a.my_reaction" data-testid="react-btn">
                <span>{{ a.my_reaction ? emoji(a.my_reaction) : '👍' }}</span> {{ a.my_reaction || 'React' }}
              </button>
              <div class="picker" *ngIf="pickerFor === a.id" role="menu">
                <button type="button" *ngFor="let r of reactions" (click)="react(a, r.key)" [attr.aria-label]="r.key" [class.on]="a.my_reaction === r.key" [attr.data-testid]="'react-' + r.key">{{ r.emoji }}</button>
              </div>
            </div>
            <button mat-button type="button" (click)="toggleComments(a)" data-testid="comment-btn"><mat-icon>chat_bubble_outline</mat-icon> Comment</button>
          </div>

          <div class="thread" *ngIf="threads[a.id]?.open">
            <mat-progress-bar *ngIf="threads[a.id].loading" mode="indeterminate"></mat-progress-bar>
            <ul>
              <li *ngFor="let c of threads[a.id].list">
                <img class="avatar sm" [src]="c.profile_pic || 'assets/images/default.png'" nxFallback alt="" />
                <div class="cbody"><strong>{{ c.fullname }}</strong><span>{{ c.comment }}</span></div>
                <button mat-icon-button type="button" *ngIf="canDeleteComment(a, c)" (click)="deleteComment(a, c)" aria-label="Delete comment"><mat-icon>close</mat-icon></button>
              </li>
            </ul>
            <form class="add" (submit)="$event.preventDefault(); addComment(a)">
              <input type="text" name="c{{ a.id }}" [(ngModel)]="threads[a.id].text" placeholder="Write a comment" maxlength="2000" autocomplete="off" [disabled]="threads[a.id].sending" aria-label="Write a comment" />
              <button mat-flat-button color="primary" type="submit" [disabled]="!threads[a.id].text.trim() || threads[a.id].sending">Send</button>
            </form>
          </div>
        </mat-card>
      </div>
    </section>`,
  styles: [`
    /* ---------- layout: the bar, then (when opened) the content ---------- */
    :host { display: block; }
    .ann { margin-bottom: 18px; display: flex; flex-direction: column; gap: 10px; min-width: 0; }
    .ann-body { display: flex; flex-direction: column; gap: 12px; min-width: 0; }

    mat-card { box-shadow: 0 1px 3px rgba(0, 65, 130, .08); border: 1px solid #e6ecf5; border-radius: 14px; }
    .ann-head { display: flex; flex-direction: row; align-items: center; justify-content: space-between; gap: 10px 16px; padding: 10px 14px; }
    .ann-head.open { border-color: #bcd3ee; }
    .head-main { display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1 1 auto; flex-wrap: wrap; }
    .head-ico { color: #0a66c2; flex: none; }
    .head-text { display: flex; flex-direction: column; min-width: 0; }
    h2 { margin: 0; font-size: 16px; line-height: 1.2; color: #14243f; }
    .head-text small { color: #6b7a99; font-size: 12px; }
    .head-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end; flex: none; }
    .view-btn { min-width: 92px; }

    .err { display: flex; align-items: center; gap: 6px; margin: 0; padding: 8px 12px; border-radius: 10px; background: #fdecea; color: #b42318; font-size: 13px; }
    .err span { flex: 1; min-width: 0; }
    .empty { margin: 4px 0; color: #8a96ab; font-size: 13px; }
    .link { border: 0; background: none; padding: 2px 4px; color: #0a66c2; cursor: pointer; font: inherit; font-size: 12px; }

    /* ---------- chips ---------- */
    .chip { font-size: 10.5px; font-weight: 700; padding: 2px 9px; border-radius: 999px; background: #eef2f8; color: #3b4a68; display: inline-flex; align-items: center; gap: 3px; white-space: nowrap; }
    .chip mat-icon { font-size: 13px; width: 13px; height: 13px; }
    .chip.new { background: #e7f6ee; color: #1b8a4b; } .chip.urgent { background: #fdecea; color: #b42318; }
    .chip.pin { background: #e8f1fb; color: #0a4a94; } .chip.pr { background: #fff4e0; color: #8a5300; } .chip.pr.u { background: #fdecea; color: #b42318; }
    .chip.st-published { background: #e7f6ee; color: #1b8a4b; } .chip.st-draft { background: #eef2f8; color: #3b4a68; } .chip.st-archived, .chip.st-expired { background: #f3f3f3; color: #777; }

    /* ---------- announcement card ---------- */
    .card { padding: 14px 16px; border-left: 4px solid #0a66c2; min-width: 0; }
    .card.important { border-left-color: #e0a100; } .card.urgent { border-left-color: #c62828; background: #fffafa; }
    .byline { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; flex: none; background: #eef2f8; } .avatar.sm { width: 28px; height: 28px; }
    .who { flex: 1 1 160px; min-width: 0; display: flex; flex-direction: column; } .who strong { overflow-wrap: anywhere; } .who small { color: #6b7a99; font-size: 11.5px; }
    .tags { display: flex; gap: 6px; flex-wrap: wrap; }
    h3 { margin: 10px 0 4px; font-size: 16px; color: #14243f; overflow-wrap: anywhere; }
    .body { margin: 0; white-space: pre-wrap; color: #2b3a55; font-size: 14px; line-height: 1.5; overflow-wrap: anywhere; }
    .body.clamp { display: -webkit-box; -webkit-line-clamp: 6; -webkit-box-orient: vertical; overflow: hidden; }
    .images { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 6px; margin-top: 10px; } .images.one { grid-template-columns: 1fr; }
    .images img { width: 100%; max-height: 360px; object-fit: cover; border-radius: 10px; display: block; background: #eef2f8; }
    .attachments { list-style: none; margin: 10px 0 0; padding: 0; } .attachments li { display: flex; align-items: center; gap: 6px; font-size: 13px; padding: 3px 0; min-width: 0; }
    .attachments mat-icon { font-size: 18px; width: 18px; height: 18px; color: #0a4a94; flex: none; }
    .attachments a { color: #0a66c2; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .attachments small { color: #8a96ab; flex: none; }
    .expires { display: block; margin-top: 8px; color: #8a96ab; font-size: 11.5px; }
    .stats { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; font-size: 12.5px; color: #6b7a99; gap: 8px; flex-wrap: wrap; }
    .acts { display: flex; gap: 6px; border-top: 1px solid #eef2f8; margin-top: 10px; padding-top: 6px; }
    .react { position: relative; } .react .mine { color: #0a66c2; font-weight: 600; }
    .picker { position: absolute; bottom: 100%; left: 0; background: #fff; border: 1px solid #d5deec; border-radius: 22px; padding: 4px 8px; display: flex; flex-wrap: wrap; gap: 2px; max-width: 92vw; box-shadow: 0 4px 14px rgba(0, 0, 0, .12); z-index: 5; }
    .picker button { border: 0; background: none; font-size: 20px; cursor: pointer; padding: 2px 4px; border-radius: 50%; transition: transform .1s; } .picker button:hover, .picker button.on { transform: scale(1.25); }
    .thread { margin-top: 8px; border-top: 1px solid #eef2f8; padding-top: 8px; } .thread ul { list-style: none; margin: 0 0 8px; padding: 0; }
    .thread li { display: flex; gap: 8px; align-items: flex-start; padding: 4px 0; } .cbody { flex: 1; min-width: 0; display: flex; flex-direction: column; font-size: 13px; background: #f3f6fb; border-radius: 10px; padding: 6px 10px; overflow-wrap: anywhere; }
    .add { display: flex; gap: 8px; } .add input { flex: 1; min-width: 0; border: 1px solid #d5deec; border-radius: 999px; padding: 8px 14px; font: inherit; font-size: 13px; }

    /* ---------- management ---------- */
    .manage { padding: 12px 14px; }
    .tabs { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }
    .tabs button { border: 1px solid #d5deec; background: #fff; border-radius: 999px; padding: 6px 14px; font: inherit; font-size: 12px; cursor: pointer; color: #3b4a68; min-height: 34px; }
    .tabs button.on { background: #e8f1fb; border-color: #0a66c2; color: #0a4a94; } .tabs b { margin-left: 4px; }
    .mlist { list-style: none; margin: 0; padding: 0; } .mlist li { display: flex; align-items: center; gap: 8px; padding: 8px 0; border-top: 1px solid #eef2f8; }
    .mtext { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; } .mtext strong { overflow-wrap: anywhere; }
    .mtext small { color: #6b7a99; font-size: 11.5px; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 6px; } .macts { display: flex; flex: none; }

    /* ---------- tablet and phone ---------- */
    @media (max-width: 768px) {
      .ann { margin-bottom: 14px; }
      .images { grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); }
      .images img { max-height: 260px; }
    }
    @media (max-width: 600px) {
      .ann-head { flex-direction: column; align-items: stretch; padding: 10px 12px; }
      .head-actions { justify-content: stretch; }
      .head-actions button { flex: 1 1 auto; }
      .head-actions .view-btn { flex: 1 1 100%; min-height: 42px; }       /* a full-width, thumb-sized View / Hide */
      .head-actions .lbl { white-space: nowrap; }
      .card { padding: 12px; }
      h3 { font-size: 15px; }
      .body { font-size: 13.5px; }
      .byline { align-items: flex-start; }
      .who { flex: 1 1 calc(100% - 52px); }
      .tags { flex: 1 1 100%; }
      .images { grid-template-columns: repeat(2, 1fr); } .images.one { grid-template-columns: 1fr; }
      .images img { max-height: 200px; }
      .acts button { flex: 1; min-height: 42px; }                          /* React and Comment share the row evenly */
      .react { flex: 1; } .react > button { width: 100%; }
      .picker { left: 0; right: 0; justify-content: space-around; border-radius: 14px; max-width: none; }
      .picker button { font-size: 24px; padding: 6px; min-width: 40px; min-height: 40px; }
      .add { flex-direction: column; } .add input { padding: 10px 14px; } .add button { width: 100%; min-height: 40px; }
      .mlist li { flex-wrap: wrap; } .macts { flex: 1 1 100%; justify-content: flex-end; border-top: 1px dashed #eef2f8; padding-top: 4px; }
      .tabs { gap: 4px; } .tabs button { flex: 1 1 auto; padding: 6px 8px; }
    }
    @media (max-width: 360px) {
      .head-actions .lbl { white-space: normal; }
      .head-actions button { font-size: 12.5px; }
    }
    @media (prefers-reduced-motion: reduce) { .picker button { transition: none; } }
  `]
})
export class AnnouncementsComponent implements OnInit, OnDestroy {
  items: Announcement[] = [];
  manageItems: Announcement[] = [];
  counts: Record<string, number> = {};
  manageMode = false;
  manageTab: AnnouncementStatus = 'published';
  error = '';
  expanded: Record<number, boolean> = {};
  threads: Record<number, Thread> = {};
  pickerFor: number | null = null;
  /** closed until the user opens it (a bar with a count, "new" and "urgent" is all that shows) */
  open = false;

  readonly tabs: { key: AnnouncementStatus; label: string }[] = [{ key: 'published', label: 'Published' }, { key: 'draft', label: 'Drafts' }, { key: 'archived', label: 'Archived' }];
  readonly reactions = [
    { key: 'Like', emoji: '👍' }, { key: 'Love', emoji: '❤️' }, { key: 'Care', emoji: '🤗' }, { key: 'Haha', emoji: '😂' },
    { key: 'Wow', emoji: '😮' }, { key: 'Sad', emoji: '😢' }, { key: 'Angry', emoji: '😡' },
  ];

  private sub?: Subscription;
  private poll: any;
  private refreshTimer: any;
  private loading = false;
  private lastSeen = 0;

  constructor(
    private api: AnnouncementService, private comments: CommentService, private dialog: MatDialog, private echo: EchoService,
    private notify: NotificationsService, private routines: SharedRoutinesService
  ) { }

  /** UI only: the API refuses every management call from anybody else */
  get isManager(): boolean {
    const r = this.routines.getRole();
    return r === 'DEF-ADMIN' || r === 'DEF-MASTERADMIN';
  }

  ngOnInit(): void {
    try {
      this.open = sessionStorage.getItem(OPEN_KEY) === '1';
      this.lastSeen = Number(localStorage.getItem(SEEN_KEY) || 0) || 0;
    } catch { /* storage blocked: it simply starts closed */ }
    this.load();
    this.echo.listenToPosts();
    this.sub = this.echo.announcement$.subscribe(() => this.scheduleReload());
    // fallback when the live connection is down: look again every minute while the tab is visible
    this.poll = setInterval(() => { if (typeof document === 'undefined' || document.visibilityState === 'visible') { this.load(); } }, 60000);
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    clearInterval(this.poll);
    clearTimeout(this.refreshTimer);
  }

  trackById(_: number, a: Announcement): number { return a.id; }

  // ---------------------------------------------------------------- open / closed
  toggle(): void { this.setOpen(!this.open); }

  private setOpen(open: boolean): void {
    this.open = open;
    try { sessionStorage.setItem(OPEN_KEY, open ? '1' : '0'); } catch { /* ignore */ }
    if (open) { this.markSeen(); }
  }

  /** looking at the list counts everything in it as seen */
  private markSeen(): void {
    const newest = Math.max(0, ...this.items.map(a => a.id));
    if (newest > this.lastSeen) {
      this.lastSeen = newest;
      try { localStorage.setItem(SEEN_KEY, String(newest)); } catch { /* ignore */ }
    }
  }

  /** announcements published since the user last opened the list */
  get newCount(): number { return this.items.filter(a => a.id > this.lastSeen).length; }
  get urgentCount(): number { return this.items.filter(a => a.priority === 'urgent').length; }

  get summaryText(): string {
    const n = this.items.length;
    if (!n) { return this.isManager ? 'None live right now' : ''; }
    return `${n} announcement${n === 1 ? '' : 's'}`;
  }

  private scheduleReload(): void {
    clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => this.reloadAll(), 600);
  }

  // ---------------------------------------------------------------- loading
  load(): void {
    if (this.loading) { return; }
    this.loading = true;
    this.api.feed().subscribe({
      next: r => { this.loading = false; this.error = ''; this.items = r?.data || []; if (this.open) { this.markSeen(); } },
      error: () => { this.loading = false; if (!this.items.length) { this.error = 'The announcements could not be loaded.'; } },
    });
  }

  loadManage(): void {
    if (!this.isManager) { return; }
    this.api.manage(this.manageTab).subscribe({
      next: r => { this.manageItems = r?.data || []; this.counts = r?.counts || {}; },
      error: () => { this.manageItems = []; },
    });
  }

  reloadAll(): void { this.load(); if (this.manageMode) { this.loadManage(); } }

  // ---------------------------------------------------------------- administrators
  /** the management list lives inside the opened section, so Manage opens it */
  toggleManage(): void {
    this.manageMode = !this.manageMode;
    if (this.manageMode) { this.setOpen(true); this.loadManage(); }
  }
  selectTab(k: AnnouncementStatus): void { this.manageTab = k; this.loadManage(); }

  create(): void {
    this.dialog.open(AnnouncementDialogComponent, { width: '680px', maxWidth: '96vw', disableClose: true, autoFocus: false, data: null })
      .afterClosed().subscribe(ok => { if (ok) { this.reloadAll(); this.loadManageCounts(); } });
  }

  edit(a: Announcement): void {
    this.dialog.open(AnnouncementDialogComponent, { width: '680px', maxWidth: '96vw', disableClose: true, autoFocus: false, data: { announcement: a } })
      .afterClosed().subscribe(ok => { if (ok) { this.reloadAll(); } });
  }

  change(a: Announcement, status: AnnouncementStatus): void {
    this.api.setStatus(a.id, status).subscribe({
      next: (r: any) => { this.notify.toastrSuccess(r?.message || 'Done.'); this.reloadAll(); this.loadManageCounts(); },
      error: e => this.notify.toastrError(e?.error?.message || 'The announcement could not be changed.'),
    });
  }

  remove(a: Announcement): void {
    this.dialog.open(SettingsConfirmDialogComponent, {
      width: '440px',
      data: { title: `Delete "${a.title}"?`, icon: 'delete_forever', danger: true, confirmText: 'Delete announcement',
        message: 'It disappears for everybody, with its comments and reactions. It cannot be undone. Archive it instead to keep a copy.' }
    }).afterClosed().subscribe(ok => {
      if (!ok) { return; }
      this.api.remove(a.id).subscribe({
        next: (r: any) => { this.notify.toastrSuccess(r?.message || 'Deleted.'); this.reloadAll(); this.loadManageCounts(); },
        error: e => this.notify.toastrError(e?.error?.message || 'The announcement could not be deleted.'),
      });
    });
  }

  /** the tab counts change with every create / publish / archive / delete, whichever tab is open */
  private loadManageCounts(): void { if (this.manageMode) { this.loadManage(); } }

  // ---------------------------------------------------------------- display helpers
  roleLabel(role: string | null): string {
    return ({ 'DEF-ADMIN': 'Administrator', 'DEF-MASTERADMIN': 'Master Administrator' } as Record<string, string>)[role || ''] || 'Administrator';
  }

  emoji(reaction: string): string { return this.reactions.find(r => r.key === reaction)?.emoji || '👍'; }

  sizeText(bytes: number): string {
    if (!bytes) { return ''; }
    return bytes >= 1048576 ? (bytes / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(bytes / 1024)) + ' KB';
  }

  // ---------------------------------------------------------------- reactions
  react(a: Announcement, reaction: string): void {
    this.pickerFor = null;
    const call = a.my_reaction === reaction ? this.api.unreact(a.id) : this.api.react(a.id, reaction);
    call.subscribe({
      next: (r: any) => { if (r?.reaction_summary) { a.reaction_summary = r.reaction_summary; a.my_reaction = r.reaction_summary.mine; } },
      error: e => this.notify.toastrError(e?.error?.message || 'Could not save your reaction.'),
    });
  }

  // ---------------------------------------------------------------- comments (the existing comment endpoints, keyed by the announcement's uuid)
  toggleComments(a: Announcement): void {
    const t = this.threads[a.id] ||= { open: false, loading: false, list: [], text: '', sending: false };
    t.open = !t.open;
    if (t.open) { this.loadComments(a); }
  }

  private loadComments(a: Announcement): void {
    const t = this.threads[a.id];
    t.loading = true;
    this.comments.list(a.announcement_uuid, 50).subscribe({
      next: (res: any) => {
        t.loading = false;
        const rows = Array.isArray(res) ? res : (res?.data || []);
        t.list = [...rows].reverse();                                  // oldest first, like a conversation
      },
      error: () => { t.loading = false; },
    });
  }

  addComment(a: Announcement): void {
    const t = this.threads[a.id];
    const text = t.text.trim();
    if (!text || t.sending) { return; }
    t.sending = true;
    this.comments.create(a.announcement_uuid, text).subscribe({
      next: () => { t.sending = false; t.text = ''; a.comments_count++; this.loadComments(a); },
      error: e => { t.sending = false; this.notify.toastrError(e?.error?.message || 'Your comment could not be posted.'); },
    });
  }

  /** your own comment, or any comment on an announcement you wrote (the API applies the same rule) */
  canDeleteComment(a: Announcement, c: any): boolean {
    return a.is_owner || String(c.code) === String(sessionStorage.getItem('code'));
  }

  deleteComment(a: Announcement, c: any): void {
    this.comments.remove(c.comment_uuid, 'com_headers').subscribe({
      next: () => { a.comments_count = Math.max(0, a.comments_count - 1); this.loadComments(a); },
      error: e => this.notify.toastrError(e?.error?.message || 'The comment could not be deleted.'),
    });
  }
}
