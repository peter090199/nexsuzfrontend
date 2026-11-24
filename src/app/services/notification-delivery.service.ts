import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { BehaviorSubject, Subject, Subscription } from 'rxjs';
import { skip } from 'rxjs/operators';
import { _url } from 'src/global-variables';
import { ChatService } from './chat.service';
import { EchoService } from './echo.service';
import { NotificationPrefsService } from './notification-prefs.service';
import { SharedRoutinesService } from './Function/shared-routines.service';
import { MessageToastComponent } from '../ComponentUI/notification/message-toast/message-toast.component';

export interface MessageNotice {
  userId: number;
  name: string;
  photo: string | null;
  /** null when the user switched message previews off */
  preview: string | null;
  time: string;
}

export interface ActivityItem {
  id: string;
  type: 'friend_request' | 'friend_accept' | 'reaction' | 'comment' | 'announcement' | 'job_application' | 'job_interview' | 'job_status' | 'job_review';
  text: string;
  excerpt?: string;
  post_uuid?: string;
  created_at: string;
  unread: boolean;
  actor: { code: number; user_id: number; fullname: string; photo_pic: string | null } | null;
}

export type DesktopPermission = NotificationPermission | 'unsupported';

const MESSAGE_POLL_MS = 30000;
const ACTIVITY_POLL_MS = 45000;
const MAX_NOTICES_AT_ONCE = 3;
const SOUND_FILE = 'assets/sounds/notification.mp3';

/**
 * Shows a new message the way the user asked: in-app toast, desktop notification, sound, and the unread badge.
 *
 *  - nothing here runs unless the preference for that channel is ON (read live from NotificationPrefsService, so a
 *    change applies at once, with no refresh)
 *  - "new" means newer than what was already in the inbox when the app opened: logging in never replays old mail
 *  - the browser's permission prompt is only ever shown by requestDesktopPermission(), which the Settings page calls
 *    when the user switches desktop notifications on. It is never asked twice and never asked on its own.
 *  - one sound at a time; a blocked autoplay is ignored quietly
 */
@Injectable({ providedIn: 'root' })
export class NotificationDeliveryService implements OnDestroy {
  /** the Messages page tells us which chat is open, so a message you are looking at does not also pop up */
  activeChatUserId: number | null = null;

  /** the Messages page listens: "open this person's chat" (when it is already the current page) */
  readonly openChat$ = new Subject<number>();

  readonly permission$ = new BehaviorSubject<DesktopPermission>(this.currentPermission());
  /** unread activity (friend requests, reactions, comments...) for the bell */
  readonly activityUnread$ = new BehaviorSubject<number>(0);

  private started = false;
  private baselineSet = false;
  private lastSeenMessageId = 0;
  private subs = new Subscription();
  private msgTimer?: any;
  private actTimer?: any;
  private audio?: HTMLAudioElement;
  private refreshing = false;

  constructor(
    private http: HttpClient,
    private chat: ChatService,
    private echo: EchoService,
    private prefs: NotificationPrefsService,
    private snack: MatSnackBar,
    private router: Router,
    private routines: SharedRoutinesService,
    private zone: NgZone
  ) {}

  // =================================================================== lifecycle
  /** Call once after sign-in (the top bar does) */
  start(): void {
    if (this.started || !sessionStorage.getItem('token')) { return; }
    this.started = true;

    this.refreshMessages();                        // sets the baseline: what is already there is not "new"
    this.refreshActivity();
    this.subs.add(this.echo.notificationCount$.pipe(skip(1)).subscribe(() => this.refreshMessages()));

    this.zone.runOutsideAngular(() => {
      this.msgTimer = setInterval(() => { if (!document.hidden) { this.zone.run(() => this.refreshMessages()); } }, MESSAGE_POLL_MS);
      this.actTimer = setInterval(() => { if (!document.hidden) { this.zone.run(() => this.refreshActivity()); } }, ACTIVITY_POLL_MS);
    });
  }

  stop(): void {
    this.started = false;
    this.baselineSet = false;
    this.lastSeenMessageId = 0;
    this.subs.unsubscribe();
    this.subs = new Subscription();
    clearInterval(this.msgTimer);
    clearInterval(this.actTimer);
  }

  ngOnDestroy(): void { this.stop(); }

  // =================================================================== messages
  /** Ask the inbox what changed; notify for messages newer than anything seen so far */
  refreshMessages(): void {
    if (this.refreshing) { return; }
    this.refreshing = true;
    this.chat.getConversations().subscribe({
      next: (res: any) => {
        this.refreshing = false;
        const convs: any[] = Array.isArray(res?.data) ? res.data : [];
        const newest = convs.reduce((m, c) => Math.max(m, c.last_message?.id || 0), 0);

        if (!this.baselineSet) {                    // first look: remember, never notify
          this.baselineSet = true;
          this.lastSeenMessageId = newest;
          return;
        }

        const incoming = convs
          .filter(c => c.unread_count > 0 && c.last_message && c.last_message.sender_id === c.user_id && c.last_message.id > this.lastSeenMessageId)
          .sort((a, b) => a.last_message.id - b.last_message.id);
        this.lastSeenMessageId = Math.max(this.lastSeenMessageId, newest);

        incoming.slice(-MAX_NOTICES_AT_ONCE).forEach(c => this.deliver({
          userId: c.user_id,
          name: c.fullname,
          photo: c.photo_pic || null,
          preview: this.prefs.prefs.message_preview ? String(c.last_message.message || '') : null,
          time: c.last_message.created_at,
        }));
      },
      error: () => { this.refreshing = false; }
    });
  }

  /** One new message: each channel only if its preference is on */
  deliver(n: MessageNotice): void {
    const p = this.prefs.prefs;
    if (!p.messages_enabled) { return; }

    const looking = document.visibilityState === 'visible' && document.hasFocus();
    if (this.activeChatUserId === n.userId && looking) { return; }       // you are reading that chat right now

    if (p.toast) { this.showToast(n); }
    if (p.desktop_notifications && this.permission$.value === 'granted' && !looking) { this.showDesktop(n); }
    if (p.sound) { this.playSound(p.sound_volume); }
  }

  /** What the user sees in a notification; the preview is replaced when previews are off */
  bodyOf(n: MessageNotice): string { return n.preview === null ? 'Sent you a message' : n.preview; }

  private showToast(n: MessageNotice): void {
    this.zone.run(() => {
      this.snack.openFromComponent(MessageToastComponent, {
        data: { notice: n, body: this.bodyOf(n), open: () => this.openConversation(n.userId) },
        duration: 6000, horizontalPosition: 'right', verticalPosition: 'top', panelClass: 'nx-msg-toast',
      });
    });
  }

  private showDesktop(n: MessageNotice): void {
    try {
      const note = new Notification(n.name, {
        body: this.bodyOf(n), icon: n.photo || 'assets/images/default.png', tag: 'nx-msg-' + n.userId,
      });
      note.onclick = () => { window.focus(); this.zone.run(() => this.openConversation(n.userId)); note.close(); };
    } catch { /* some mobile browsers only allow service-worker notifications */ }
  }

  /** Open that person's chat: straight in if the Messages page is open, otherwise navigate there */
  openConversation(userId: number): void {
    const base = `/${this.routines.getRole()}/message`;
    if (this.router.url.split(/[?#]/)[0] === base) { this.openChat$.next(userId); }
    else { this.router.navigate([base], { queryParams: { user: userId } }); }
  }

  // =================================================================== sound
  /** The notification sound at the chosen volume. A new sound replaces a still-playing one (no overlap). */
  playSound(volumePercent: number): void {
    try {
      this.audio = this.audio || new Audio(SOUND_FILE);
      this.audio.pause();
      this.audio.currentTime = 0;
      this.audio.volume = Math.max(0, Math.min(1, volumePercent / 100));
      const started = this.audio.play();
      if (started && typeof started.catch === 'function') { started.catch(() => { /* autoplay not allowed yet: stay quiet */ }); }
    } catch { /* no audio support */ }
  }

  /** The "Test sound" button: a click, so the browser allows it, even when the sound switch is off */
  testSound(): void { this.playSound(this.prefs.prefs.sound_volume); }

  // =================================================================== browser permission
  private currentPermission(): DesktopPermission {
    return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
  }

  /**
   * Ask the browser for permission. Only when the user switches desktop notifications on, and only if the browser
   * has not already been asked: a granted or blocked answer is final, so this never prompts again.
   */
  async requestDesktopPermission(): Promise<DesktopPermission> {
    const now = this.currentPermission();
    if (now !== 'default') { this.permission$.next(now); return now; }
    try {
      const result = await Notification.requestPermission();
      this.permission$.next(result);
      return result;
    } catch {
      this.permission$.next(this.currentPermission());
      return this.permission$.value;
    }
  }

  refreshPermission(): void { this.permission$.next(this.currentPermission()); }

  // =================================================================== social activity (friend requests, reactions...)
  refreshActivity(): void {
    this.http.get<any>(`${_url}activity-notifications?count_only=1`, { headers: this.headers() }).subscribe({
      next: res => { if (res?.success) { this.activityUnread$.next(res.unread_count || 0); } },
      error: () => { /* keep the last count */ }
    });
  }

  fetchActivity() {
    return this.http.get<any>(`${_url}activity-notifications`, { headers: this.headers() });
  }

  markActivityRead() {
    this.activityUnread$.next(0);
    return this.http.post<any>(`${_url}activity-notifications/read`, {}, { headers: this.headers() });
  }

  private headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${sessionStorage.getItem('token') || ''}` });
  }
}
