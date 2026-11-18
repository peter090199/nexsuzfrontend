import { Component, ElementRef, OnDestroy, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Subscription, interval } from 'rxjs';
import { skip } from 'rxjs/operators';
import { ChatService } from '../services/chat.service';
import { EchoService } from '../services/echo.service';
import { AuthService } from '../services/auth.service';
import { NotificationsService } from '../services/Global/notifications.service';
import { SharedRoutinesService } from '../services/Function/shared-routines.service';
import { NotificationPrefsService } from '../services/notification-prefs.service';
import { NotificationDeliveryService } from '../services/notification-delivery.service';

export interface Peer {
  user_id: number;
  code?: string | number;
  fullname: string;
  photo_pic?: string | null;
  is_online?: boolean;
}

export interface LastMessage {
  id: number;
  message: string;
  sender_id: number;
  is_read: boolean;
  created_at: string;
}

export interface Conversation extends Peer {
  unread_count: number;
  last_message: LastMessage | null;
}

export interface ChatMessage {
  id: number | string;
  sender_id: number;
  receiver_id?: number;
  message: string;
  created_at: string;
  is_read?: boolean | number;
  /** client-only: waiting for the server / the server refused it */
  _status?: 'sending' | 'failed';
}

interface MessageView {
  m: ChatMessage;
  mine: boolean;
  firstOfRun: boolean;
  lastOfRun: boolean;
  showTime: boolean;
  state: 'sending' | 'failed' | 'sent' | 'read' | null;
}

interface DayGroup { key: string; label: string; items: MessageView[]; }

export type Tab = 'all' | 'unread' | 'online' | 'archived';

const POLL_MS = 8000;
const MAX_LENGTH = 5000;
const RUN_GAP_MS = 5 * 60 * 1000;

/**
 * Messages page (Messenger-style). Everything on screen comes from the existing Laravel API:
 *   GET conversations · GET receivemessages/{id} · POST send-message · POST messages/read
 *   GET getActiveUsers (people) · GET update_count (unread total) · Pusher count channel + polling for new mail.
 * Reactions, reply, edit, delete, attachments, voice and typing are NOT offered: the backend has no support for them.
 */
@Component({
  selector: 'app-messenger-chat',
  templateUrl: './messenger-chat.component.html',
  styleUrls: ['./messenger-chat.component.css']
})
export class MessengerChatComponent implements OnInit, OnDestroy {
  @ViewChild('scroller') scroller?: ElementRef<HTMLElement>;
  @ViewChild('composerInput') composerInput?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('newDialog') newDialog!: TemplateRef<unknown>;

  readonly maxLength = MAX_LENGTH;
  readonly emojis = ['😀', '😁', '😂', '🤣', '😊', '😍', '😘', '😎', '🤔', '😅', '😉', '🙂', '🙃', '😴', '😢', '😭',
    '😡', '😮', '🤗', '🙏', '👍', '👎', '👏', '🙌', '💪', '🤝', '👋', '✌️', '❤️', '💙', '🔥', '🎉',
    '✨', '💯', '✅', '❌', '⭐', '🌟', '🍀', '☕', '🍕', '🎂', '🌈', '☀️', '📌', '📞', '💼', '🚀'];

  myUserId: number | null = null;

  conversations: Conversation[] = [];
  people: Peer[] = [];
  peopleLoaded = false;
  peopleError = false;

  tab: Tab = 'all';
  query = '';

  loadingList = true;
  listError = false;

  selected: Peer | null = null;
  messages: ChatMessage[] = [];
  groups: DayGroup[] = [];
  loadingChat = false;
  chatError = false;
  chatOpen = false;               // mobile: show the chat full screen instead of the list

  draft = '';
  sending = false;
  emojiOpen = false;

  atBottom = true;
  newBelow = 0;
  newQuery = '';

  private archived = new Set<number>();
  private subs = new Subscription();
  private dialogRef?: MatDialogRef<unknown>;
  private tmpSeq = 0;
  private refreshing = false;

  constructor(
    private chat: ChatService,
    private echo: EchoService,
    private auth: AuthService,
    private notify: NotificationsService,
    private dialog: MatDialog,
    private route: ActivatedRoute,
    public routines: SharedRoutinesService,
    private prefs: NotificationPrefsService,
    private delivery: NotificationDeliveryService
  ) { }

  /** unread counts are shown only when the user wants unread badges (Settings > Notifications) */
  get showBadges(): boolean { return this.prefs.prefs.unread_badge; }

  // =================================================================== lifecycle
  ngOnInit(): void {
    this.auth.getData().subscribe({
      next: (me: any) => {
        this.myUserId = me?.id ?? null;
        this.loadArchived();
        this.loadConversations(true);
      },
      error: () => { this.loadingList = false; this.listError = true; }
    });

    // new mail: Pusher count updates when reachable, plus a light poll that pauses in background tabs
    this.subs.add(this.echo.notificationCount$.pipe(skip(1)).subscribe(() => this.refresh()));

    // a clicked notification (toast / desktop) opens that person's chat right here
    this.subs.add(this.delivery.openChat$.subscribe(id => this.openById(id)));
    this.subs.add(interval(POLL_MS).subscribe(() => { if (!document.hidden) { this.refresh(); } }));
  }

  ngOnDestroy(): void {
    this.delivery.activeChatUserId = null;
    this.subs.unsubscribe();
    this.dialogRef?.close();
  }

  // =================================================================== conversation list
  loadConversations(initial = false): void {
    if (initial) { this.loadingList = true; this.listError = false; }
    this.chat.getConversations().subscribe({
      next: (res: any) => {
        this.conversations = Array.isArray(res?.data) ? res.data : [];
        this.unarchiveIfNewMail();
        this.syncSelectedFromList();
        this.loadingList = false;
        this.listError = false;
        if (initial) { this.openFromQuery(); }
      },
      error: () => {
        this.loadingList = false;
        if (!this.conversations.length) { this.listError = true; }     // keep what we have on a failed background refresh
      }
    });
  }

  /** Background refresh: list, and the open chat (new messages / read receipts) */
  refresh(): void {
    if (this.refreshing || this.myUserId === null) { return; }
    this.refreshing = true;
    this.loadConversations();
    if (this.selected) { this.loadMessages(false); }
    setTimeout(() => (this.refreshing = false), 1500);
  }

  retryList(): void { this.loadConversations(true); }

  get unreadTotal(): number { return this.conversations.reduce((n, c) => n + (this.isArchived(c) ? 0 : c.unread_count), 0); }
  get unreadCount(): number { return this.conversations.filter(c => c.unread_count > 0 && !this.isArchived(c)).length; }
  get onlineCount(): number { return this.conversations.filter(c => c.is_online && !this.isArchived(c)).length; }
  get archivedCount(): number { return this.conversations.filter(c => this.isArchived(c)).length; }

  setTab(t: Tab): void { this.tab = t; }

  /** The tab's conversations, narrowed by the search box (name or last message) */
  get visible(): Conversation[] {
    const q = this.query.trim().toLowerCase();
    return this.conversations.filter(c => {
      const archived = this.isArchived(c);
      if (this.tab === 'archived') { if (!archived) { return false; } }
      else if (archived) { return false; }
      if (this.tab === 'unread' && c.unread_count < 1) { return false; }
      if (this.tab === 'online' && !c.is_online) { return false; }
      return !q || (c.fullname || '').toLowerCase().includes(q) || (c.last_message?.message || '').toLowerCase().includes(q);
    });
  }

  /** People matching the search who I have not talked to yet (start a new chat) */
  get matchingPeople(): Peer[] {
    const q = this.query.trim().toLowerCase();
    if (!q || this.tab === 'archived') { return []; }
    const known = new Set(this.conversations.map(c => c.user_id));
    return this.people.filter(p => !known.has(p.user_id) && (p.fullname || '').toLowerCase().includes(q)).slice(0, 8);
  }

  onSearchInput(): void { if (this.query.trim() && !this.peopleLoaded) { this.loadPeople(); } }
  clearSearch(): void { this.query = ''; }

  // =================================================================== archive (kept in this browser: the server has no archive)
  private archiveKey(): string { return 'nx-chat-archived-' + (this.myUserId ?? 'x'); }

  private loadArchived(): void {
    try { this.archived = new Set<number>(JSON.parse(localStorage.getItem(this.archiveKey()) || '[]')); } catch { this.archived = new Set(); }
  }

  private saveArchived(): void {
    try { localStorage.setItem(this.archiveKey(), JSON.stringify(Array.from(this.archived))); } catch { /* not persisted */ }
  }

  isArchived(p: Peer): boolean { return this.archived.has(p.user_id); }

  toggleArchive(p: Peer, event?: Event): void {
    event?.stopPropagation();
    if (this.archived.has(p.user_id)) { this.archived.delete(p.user_id); } else { this.archived.add(p.user_id); }
    this.saveArchived();
    if (this.selected?.user_id === p.user_id && this.isArchived(p)) { this.closeChat(); }
    this.notify.toastrInfo(this.isArchived(p) ? 'Conversation archived on this device.' : 'Conversation moved back to your inbox.');
  }

  /** A new message brings an archived conversation back, so nothing is missed */
  private unarchiveIfNewMail(): void {
    let changed = false;
    for (const c of this.conversations) {
      if (c.unread_count > 0 && this.archived.has(c.user_id)) { this.archived.delete(c.user_id); changed = true; }
    }
    if (changed) { this.saveArchived(); }
  }

  // =================================================================== people / new message
  loadPeople(done?: () => void): void {
    this.chat.getActiveMessages().subscribe({
      next: (res: any) => {
        const list: any[] = Array.isArray(res) ? res : (res?.data || []);
        this.people = list
          .filter(u => u && u.id !== this.myUserId)
          .map(u => ({ user_id: u.id, code: u.code, fullname: u.fullname, photo_pic: u.photo_pic, is_online: !!u.is_online }));
        this.peopleLoaded = true;
        this.peopleError = false;
        done?.();
      },
      error: () => { this.peopleError = true; done?.(); }
    });
  }

  openNew(): void {
    this.newQuery = '';
    if (!this.peopleLoaded) { this.loadPeople(); }
    this.dialogRef = this.dialog.open(this.newDialog, { width: '440px', maxWidth: '96vw', autoFocus: false, panelClass: 'msgr-dialog' });
  }

  get newMatches(): Peer[] {
    const q = this.newQuery.trim().toLowerCase();
    return this.people.filter(p => !q || (p.fullname || '').toLowerCase().includes(q)).slice(0, 50);
  }

  startChatClose(): void { this.dialogRef?.close(); }

  startChat(p: Peer): void {
    this.dialogRef?.close();
    this.query = '';
    const existing = this.conversations.find(c => c.user_id === p.user_id);
    this.open(existing || p);
  }

  /** /message?user=<users.id> opens that person straight away (e.g. a "Message" button on a profile) */
  private openFromQuery(): void {
    const id = Number(this.route.snapshot.queryParamMap.get('user'));
    if (!id || id === this.myUserId) { return; }
    const known = this.conversations.find(c => c.user_id === id);
    if (known) { this.open(known); return; }
    this.loadPeople(() => { const p = this.people.find(x => x.user_id === id); if (p) { this.open(p); } });
  }

  // =================================================================== open a chat
  open(p: Peer): void {
    if (this.selected?.user_id !== p.user_id) {
      this.messages = [];
      this.groups = [];
      this.newBelow = 0;
    }
    this.selected = { user_id: p.user_id, code: p.code, fullname: p.fullname, photo_pic: p.photo_pic, is_online: p.is_online };
    this.delivery.activeChatUserId = p.user_id;       // a message from this person is already on screen: no popup for it
    this.chatOpen = true;
    this.emojiOpen = false;
    this.draft = '';
    this.chatError = false;
    this.loadMessages(true);
    setTimeout(() => this.composerInput?.nativeElement.focus(), 150);
  }

  /** open a chat by user id (from a notification click) */
  private openById(id: number): void {
    const known = this.conversations.find(c => c.user_id === id);
    if (known) { this.open(known); return; }
    this.loadConversations();
    this.loadPeople(() => { const p = this.people.find(x => x.user_id === id); if (p) { this.open(p); } });
  }

  closeChat(): void { this.delivery.activeChatUserId = null; this.chatOpen = false; this.selected = null; this.messages = []; this.groups = []; this.emojiOpen = false; }

  loadMessages(initial: boolean): void {
    const peer = this.selected;
    if (!peer) { return; }
    if (initial) { this.loadingChat = true; this.chatError = false; }

    this.chat.getMessages(peer.user_id).subscribe({
      next: (res: any) => {
        if (this.selected?.user_id !== peer.user_id) { return; }          // the user already switched chats
        const server: ChatMessage[] = Array.isArray(res) ? res : [];
        const pending = this.messages.filter(m => m._status);              // not on the server (yet)
        const before = this.messages.filter(m => !m._status).length;
        const incomingNew = server.filter(m => m.sender_id !== this.myUserId).length -
          this.messages.filter(m => !m._status && m.sender_id !== this.myUserId).length;

        this.messages = [...server, ...pending];
        this.rebuild();
        this.loadingChat = false;
        this.chatError = false;

        if (initial) { setTimeout(() => this.scrollToBottom(false), 0); }
        else if (server.length > before) {
          if (this.atBottom) { setTimeout(() => this.scrollToBottom(true), 0); }
          else if (incomingNew > 0) { this.newBelow += incomingNew; }
        }
        this.markReadIfNeeded(peer);
      },
      error: () => {
        if (initial) { this.loadingChat = false; this.chatError = true; }
      }
    });
  }

  retryChat(): void { this.loadMessages(true); }

  private markReadIfNeeded(peer: Peer): void {
    const conv = this.conversations.find(c => c.user_id === peer.user_id);
    const hasUnread = (conv?.unread_count || 0) > 0 || this.messages.some(m => !m._status && m.sender_id === peer.user_id && !m.is_read);
    if (!hasUnread) { return; }

    this.chat.markConversationRead(peer.user_id).subscribe({
      next: () => {
        if (conv) { conv.unread_count = 0; if (conv.last_message) { conv.last_message.is_read = true; } }
        this.messages.forEach(m => { if (m.sender_id === peer.user_id) { m.is_read = true; } });
        this.chat.loadNotifications();                                       // refresh the unread badge in the top bar
      },
      error: () => { /* try again on the next refresh */ }
    });
  }

  private syncSelectedFromList(): void {
    if (!this.selected) { return; }
    const c = this.conversations.find(x => x.user_id === this.selected!.user_id);
    if (c) { this.selected = { ...this.selected, is_online: c.is_online, photo_pic: c.photo_pic ?? this.selected.photo_pic, code: c.code ?? this.selected.code }; }
  }

  // =================================================================== sending
  get canSend(): boolean { return !!this.draft.trim() && this.draft.length <= MAX_LENGTH && !!this.selected && this.myUserId !== null; }

  send(): void {
    if (!this.canSend || !this.selected) { return; }
    const text = this.draft.trim();
    const tmp: ChatMessage = {
      id: 'tmp-' + (++this.tmpSeq), sender_id: this.myUserId!, receiver_id: this.selected.user_id,
      message: text, created_at: new Date().toISOString(), _status: 'sending'
    };
    this.messages = [...this.messages, tmp];
    this.draft = '';
    this.emojiOpen = false;
    this.resizeComposer();
    this.rebuild();
    setTimeout(() => this.scrollToBottom(true), 0);
    this.deliver(tmp);
  }

  retry(m: ChatMessage): void {
    if (m._status !== 'failed') { return; }
    m._status = 'sending';
    this.rebuild();
    this.deliver(m);
  }

  private deliver(tmp: ChatMessage): void {
    const peerId = tmp.receiver_id!;
    this.chat.sendMessage(peerId, tmp.message).subscribe({
      next: (res: any) => {
        const saved: ChatMessage | undefined = res?.data;
        const i = this.messages.indexOf(tmp);
        if (i >= 0) {
          this.messages[i] = saved ? { ...saved, is_read: !!saved.is_read } : { ...tmp, _status: undefined };
          this.messages = [...this.messages];
          this.rebuild();
        }
        this.loadConversations();
      },
      error: (err: any) => {
        tmp._status = 'failed';
        this.rebuild();
        const e = err?.error?.errors;
        const first = e ? (Object.values(e)[0] as string[])[0] : err?.error?.message;
        this.notify.toastrError(first || 'Message not sent. Check your connection and try again.');
      }
    });
  }

  onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); this.send(); }
    if (e.key === 'Escape') { this.emojiOpen = false; }
  }

  resizeComposer(): void {
    const el = this.composerInput?.nativeElement;
    if (!el) { return; }
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
  }

  // =================================================================== emoji + copy
  toggleEmoji(): void { this.emojiOpen = !this.emojiOpen; }

  addEmoji(emoji: string): void {
    const el = this.composerInput?.nativeElement;
    if (!el) { this.draft += emoji; return; }
    const start = el.selectionStart ?? this.draft.length;
    const end = el.selectionEnd ?? this.draft.length;
    this.draft = this.draft.slice(0, start) + emoji + this.draft.slice(end);
    setTimeout(() => { el.focus(); const pos = start + emoji.length; el.setSelectionRange(pos, pos); this.resizeComposer(); }, 0);
  }

  async copy(m: ChatMessage): Promise<void> {
    try {
      await navigator.clipboard.writeText(m.message);
      this.notify.toastrSuccess('Message copied.');
    } catch {
      const t = document.createElement('textarea');            // older browsers / insecure origins
      t.value = m.message; t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch { ok = false; }
      document.body.removeChild(t);
      ok ? this.notify.toastrSuccess('Message copied.') : this.notify.toastrError('Could not copy the message.');
    }
  }

  // =================================================================== scrolling
  onScroll(): void {
    const el = this.scroller?.nativeElement;
    if (!el) { return; }
    this.atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (this.atBottom) { this.newBelow = 0; }
  }

  scrollToBottom(smooth: boolean): void {
    const el = this.scroller?.nativeElement;
    if (!el) { return; }
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    this.atBottom = true;
    this.newBelow = 0;
  }

  // =================================================================== grouping for the template
  private rebuild(): void {
    const groups: DayGroup[] = [];
    const flat: MessageView[] = [];

    this.messages.forEach((m, i) => {
      const prev = this.messages[i - 1];
      const next = this.messages[i + 1];
      const mine = m.sender_id === this.myUserId;
      const t = new Date(m.created_at).getTime();
      const sameRunPrev = !!prev && prev.sender_id === m.sender_id && this.sameDay(prev.created_at, m.created_at) && t - new Date(prev.created_at).getTime() < RUN_GAP_MS;
      const sameRunNext = !!next && next.sender_id === m.sender_id && this.sameDay(next.created_at, m.created_at) && new Date(next.created_at).getTime() - t < RUN_GAP_MS;
      flat.push({
        m, mine, firstOfRun: !sameRunPrev, lastOfRun: !sameRunNext, showTime: !sameRunNext, state: null
      });
    });

    // delivery state only on the last of my messages in each run (sent / seen), or while sending / failed
    flat.forEach(v => {
      if (!v.mine) { return; }
      if (v.m._status) { v.state = v.m._status; }
      else if (v.lastOfRun) { v.state = v.m.is_read ? 'read' : 'sent'; }
    });

    flat.forEach((v, i) => {
      const key = this.dayKey(v.m.created_at);
      const prevKey = i > 0 ? this.dayKey(flat[i - 1].m.created_at) : '';
      if (key !== prevKey) { groups.push({ key, label: this.dayLabel(v.m.created_at), items: [] }); }
      groups[groups.length - 1].items.push(v);
    });
    this.groups = groups;
  }

  trackGroup(_: number, g: DayGroup): string { return g.key; }
  trackMsg(_: number, v: MessageView): string | number { return v.m.id; }
  trackConv(_: number, c: Peer): number { return c.user_id; }

  // =================================================================== dates and times
  private sameDay(a: string, b: string): boolean { return this.dayKey(a) === this.dayKey(b); }

  private dayKey(iso: string): string {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '' : d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  dayLabel(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) { return ''; }
    const today = new Date();
    const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
    if (this.sameDay(iso, today.toISOString())) { return 'Today'; }
    if (this.sameDay(iso, yesterday.toISOString())) { return 'Yesterday'; }
    const sameYear = d.getFullYear() === today.getFullYear();
    return d.toLocaleDateString(undefined, sameYear ? { weekday: 'long', month: 'long', day: 'numeric' } : { year: 'numeric', month: 'long', day: 'numeric' });
  }

  clock(iso: string): string {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '' : d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  /** List timestamp: time today, "Yesterday", weekday this week, otherwise the date */
  listTime(iso?: string): string {
    if (!iso) { return ''; }
    const d = new Date(iso);
    if (isNaN(d.getTime())) { return ''; }
    const now = new Date();
    if (this.sameDay(iso, now.toISOString())) { return this.clock(iso); }
    const yesterday = new Date(); yesterday.setDate(now.getDate() - 1);
    if (this.sameDay(iso, yesterday.toISOString())) { return 'Yesterday'; }
    const days = (now.getTime() - d.getTime()) / 86400000;
    if (days < 7) { return d.toLocaleDateString(undefined, { weekday: 'short' }); }
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
  }

  preview(c: Conversation): string {
    const m = c.last_message;
    if (!m) { return 'No messages yet'; }
    return (m.sender_id === this.myUserId ? 'You: ' : '') + m.message.replace(/\s+/g, ' ');
  }
}
