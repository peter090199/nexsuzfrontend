import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import {
  ATTACH_EXT, ATTACH_MAX_BYTES, ATTACH_MAX_FILES, AttachmentInfo, ContactInquiriesService, InquiryDetail, InquiryRow, ThreadMessage
} from './contact-inquiries.service';

type Filter = 'all' | 'unread' | 'new' | 'read' | 'replied' | 'closed';
type Busy = '' | 'list' | 'open' | 'act' | 'send';

/** Contact Inquiries: visitor messages from the website Contact Us form, replies by email, and the whole conversation. */
@Component({
  selector: 'app-contact-inquiries',
  templateUrl: './contact-inquiries.component.html',
  styleUrls: ['./contact-inquiries.component.scss']
})
export class ContactInquiriesComponent implements OnInit, OnDestroy {
  @ViewChild('editor') editor?: ElementRef<HTMLDivElement>;
  @ViewChild('thread') threadEl?: ElementRef<HTMLElement>;

  readonly filters: { id: Filter; label: string }[] = [
    { id: 'all', label: 'All' }, { id: 'unread', label: 'Unread' }, { id: 'new', label: 'New' }, { id: 'read', label: 'Read' }, { id: 'replied', label: 'Replied' }, { id: 'closed', label: 'Closed' }];
  readonly acceptAttr = ATTACH_EXT.map(e => '.' + e).join(',');
  readonly maxFiles = ATTACH_MAX_FILES;

  rows: InquiryRow[] = [];
  counts: { [status: string]: number } = {};
  total = 0; page = 1; lastPage = 1;
  filter: Filter = 'all'; search = ''; archived = false; mine = false;
  busy: Busy = 'list';
  listError = '';

  selected?: InquiryDetail;
  detailError = '';
  /** Mobile shows either the list or the open inquiry. */
  showDetail = false;

  composing = false;
  replySubject = '';
  files: File[] = [];
  attachError = '';
  sendError = '';
  confirm: '' | 'archive' | 'delete' = '';
  /** Who is signed in decides whether permanent delete is offered (the server enforces it too). */
  isMaster = sessionStorage.getItem('role') === 'DEF-MASTERADMIN';

  private search$ = new Subject<string>();
  private sub = new Subscription();

  constructor(private api: ContactInquiriesService, private snack: MatSnackBar) { }

  ngOnInit(): void {
    this.sub.add(this.search$.pipe(debounceTime(300), distinctUntilChanged()).subscribe(() => this.reload()));
    this.reload();
  }
  ngOnDestroy(): void { this.sub.unsubscribe(); }

  get unread(): number { return this.api.unread$.value; }
  onSearch(v: string): void { this.search = v; this.search$.next(v.trim()); }
  setFilter(f: Filter): void { this.filter = f; this.reload(); }
  toggleArchived(): void { this.archived = !this.archived; this.reload(); }
  toggleMine(): void { this.mine = !this.mine; this.reload(); }
  count(f: Filter): number { return f === 'all' ? Object.values(this.counts).reduce((a, b) => a + b, 0) : f === 'unread' ? this.unread : (this.counts[f] || 0); }

  reload(): void { this.page = 1; this.fetch(false); }
  more(): void { if (this.page < this.lastPage) { this.page++; this.fetch(true); } }

  private fetch(append: boolean): void {
    this.busy = 'list'; this.listError = '';
    this.api.list({ q: this.search.trim(), status: this.filter, archived: this.archived, mine: this.mine, page: this.page }).subscribe({
      next: r => { this.rows = append ? [...this.rows, ...r.data] : r.data; this.counts = r.counts; this.total = r.meta.total; this.lastPage = r.meta.last_page; this.busy = ''; },
      error: e => { this.busy = ''; this.listError = ContactInquiriesService.errorMessage(e, 'Could not load the inquiries.'); }
    });
  }

  open(row: InquiryRow): void {
    this.busy = 'open'; this.detailError = ''; this.composing = false; this.confirm = ''; this.showDetail = true;
    this.api.get(row.id).subscribe({
      next: r => { this.selected = r.data; this.syncRow(r.data); this.busy = ''; this.scrollThread(); },
      error: e => { this.busy = ''; this.detailError = ContactInquiriesService.errorMessage(e, 'Could not open this inquiry.'); }
    });
  }
  back(): void { this.showDetail = false; }

  private syncRow(d: InquiryDetail): void {
    const i = this.rows.findIndex(r => r.id === d.id);
    if (i >= 0) { this.rows[i] = { ...this.rows[i], ...d }; }
    this.api.list({ q: this.search.trim(), status: this.filter, archived: this.archived, mine: this.mine, page: 1 }).subscribe({ next: r => this.counts = r.counts, error: () => { /* counts refresh next time */ } });
  }
  private scrollThread(): void { setTimeout(() => { const el = this.threadEl?.nativeElement; if (el) { el.scrollTop = el.scrollHeight; } }, 0); }
  private say(text: string, ok = true): void { this.snack.open(text, 'OK', { duration: ok ? 3500 : 7000 }); }

  /** Run one of the small actions on the open inquiry and show the server copy. */
  private act(call: () => any, okText?: string): void {
    if (!this.selected) { return; }
    this.busy = 'act';
    call().subscribe({
      next: (r: any) => { if (r.data) { this.selected = r.data; this.syncRow(r.data); } this.busy = ''; if (okText) { this.say(r.message || okText); } },
      error: (e: any) => { this.busy = ''; this.say(ContactInquiriesService.errorMessage(e), false); }
    });
  }
  toggleRead(): void { const s = this.selected!; this.act(() => this.api.setRead(s.id, s.unread)); }
  toggleClosed(): void { const s = this.selected!; this.act(() => this.api.setStatus(s.id, s.status === 'closed' ? 'reopen' : 'close'), 'Done.'); }
  toggleMineAssign(): void { const s = this.selected!; this.act(() => this.api.assign(s.id, !s.assigned_code)); }
  restore(): void { const s = this.selected!; this.act(() => this.api.restore(s.id), 'Inquiry restored.'); this.removeFromList(s.id, !this.archived); }

  askArchive(): void { this.confirm = 'archive'; }
  askDelete(): void { this.confirm = 'delete'; }
  cancelConfirm(): void { this.confirm = ''; }
  doConfirm(): void {
    const s = this.selected!; const kind = this.confirm; this.confirm = ''; this.busy = 'act';
    (kind === 'delete' ? this.api.deletePermanently(s.id) : this.api.archive(s.id)).subscribe({
      next: (r: any) => {
        this.busy = ''; this.say(r.message);
        this.removeFromList(s.id, true);
        if (kind === 'delete') { this.selected = undefined; this.showDetail = false; } else if (r.data) { this.selected = r.data; this.showDetail = false; this.selected = undefined; }
      },
      error: (e: any) => { this.busy = ''; this.say(ContactInquiriesService.errorMessage(e), false); }
    });
  }
  private removeFromList(id: number, remove: boolean): void { if (remove) { this.rows = this.rows.filter(r => r.id !== id); this.total = Math.max(0, this.total - 1); } }

  /* ---------- reply composer ---------- */
  startReply(): void {
    const s = this.selected!;
    this.composing = true; this.sendError = ''; this.attachError = ''; this.files = [];
    this.replySubject = /^re:/i.test(s.subject) ? s.subject : 'Re: ' + s.subject;
    setTimeout(() => { if (this.editor) { this.editor.nativeElement.innerHTML = `<p>Hi ${this.escape(s.name)},</p><p><br></p>`; this.editor.nativeElement.focus(); } }, 0);
  }
  cancelReply(): void { this.composing = false; this.files = []; }
  fmt(cmd: string, value?: string): void { document.execCommand(cmd, false, value); this.editor?.nativeElement.focus(); }
  addLink(): void {
    const url = (window.prompt('Link address (https://...)') || '').trim();
    if (!url) { return; }
    if (!/^(https?:\/\/|mailto:)/i.test(url)) { this.attachError = 'A link must start with http://, https:// or mailto:'; return; }
    this.attachError = ''; this.fmt('createLink', url);
  }
  get bodyHtml(): string { return this.editor?.nativeElement.innerHTML || ''; }
  get bodyText(): string { return (this.editor?.nativeElement.innerText || '').trim(); }

  onFiles(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const picked = Array.from(input.files || []);
    input.value = '';
    this.attachError = '';
    for (const f of picked) {
      const problem = ContactInquiriesService.attachmentProblem(this.files, f);
      if (problem) { this.attachError = problem; break; }
      this.files.push(f);
    }
  }
  removeFile(i: number): void { this.files.splice(i, 1); this.attachError = ''; }

  send(): void {
    if (this.busy === 'send') { return; }   // a double click or Enter while sending must not send the reply twice
    const s = this.selected!;
    this.sendError = '';
    if (!this.replySubject.trim()) { this.sendError = 'Enter a subject.'; return; }
    if (!this.bodyText) { this.sendError = 'Write a message before sending.'; return; }
    this.busy = 'send';
    this.api.reply(s.id, this.replySubject.trim(), this.bodyHtml, this.files).subscribe({
      next: r => { this.selected = r.data; this.syncRow(r.data); this.busy = ''; this.composing = false; this.files = []; this.say(r.message); this.scrollThread(); },
      error: e => {
        this.busy = '';
        this.sendError = ContactInquiriesService.errorMessage(e, 'The reply could not be sent.');
        if (e?.error?.data) { this.selected = e.error.data; this.syncRow(e.error.data); this.scrollThread(); }   // the failed attempt is kept in the history
      }
    });
  }

  download(m: ThreadMessage, a: AttachmentInfo): void {
    this.api.downloadAttachment(this.selected!.id, m.id, a).subscribe({
      next: blob => { const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = a.name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 2000); },
      error: e => this.say(ContactInquiriesService.errorMessage(e, 'The attachment could not be downloaded.'), false)
    });
  }

  size(n: number): string { return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
  initials(name: string): string { return (name || '?').split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase(); }
  trackById = (_: number, r: { id: number }) => r.id;
  private escape(t: string): string { return t.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as any)[c]); }
  readonly maxFileMb = ATTACH_MAX_BYTES / 1048576;
}
