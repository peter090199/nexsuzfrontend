import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap, timeout } from 'rxjs/operators';
import { _url } from 'src/global-variables';

export type InquiryStatus = 'new' | 'read' | 'replied' | 'closed';

export interface InquiryRow {
  id: number; number: string; name: string; email: string; phone: string | null; subject: string; preview: string; status: InquiryStatus; unread: boolean;
  assigned_code: string | null; assigned_name: string | null; archived: boolean; created_at: string; last_activity_at: string; notified: boolean; notify_error: string | null;
}
export interface AttachmentInfo { index: number; name: string; size: number; mime: string; }
export interface ThreadMessage {
  id: number; direction: 'in' | 'out'; from_email: string; from_name: string | null; to_email: string; subject: string; body: string; is_html: boolean;
  status: 'received' | 'sent' | 'failed'; error: string | null; created_at: string; sent_by: string | null; attachments: AttachmentInfo[];
}
export interface InquiryDetail extends InquiryRow { message: string; messages: ThreadMessage[]; }
export interface ListQuery { q?: string; status?: string; archived?: boolean; mine?: boolean; page?: number; }
export interface ListReply { success: boolean; data: InquiryRow[]; meta: { page: number; last_page: number; total: number }; unread: number; counts: { [status: string]: number }; }

/** Attachment rules, mirrored from the server so a bad file is refused before any upload. */
export const ATTACH_EXT = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'txt', 'csv'];
export const ATTACH_MAX_FILES = 5;
export const ATTACH_MAX_BYTES = 5 * 1024 * 1024;
export const ATTACH_MAX_TOTAL = 15 * 1024 * 1024;

@Injectable({ providedIn: 'root' })
export class ContactInquiriesService {
  private base = `${_url}contact-inquiries`;
  /** Unread inquiries: drives the sidebar badge and is refreshed by every action on the page. */
  readonly unread$ = new BehaviorSubject<number>(0);

  constructor(private http: HttpClient) { }

  private get opts() { return { headers: new HttpHeaders({ Authorization: `Bearer ${sessionStorage.getItem('token') || ''}` }) }; }

  static errorMessage(err: any, fallback = 'Something went wrong. Please try again.'): string {
    const e = err?.error;
    if (e?.errors) { const first = Object.values(e.errors)[0] as string[]; if (first?.length && first[0] !== 'empty') { return first[0]; } }
    if (err?.name === 'TimeoutError') { return 'The server took too long to answer. Please try again.'; }
    if (err?.status === 0) { return 'Cannot reach the server. Check that the backend is running and your network connection.'; }
    if (err?.status === 403) { return 'You do not have access to Contact Inquiries.'; }
    if (err?.status === 429) { return 'Too many requests. Please wait a moment and try again.'; }
    return e?.message || fallback;
  }

  /** The first problem with a chosen file or set of files, or null. */
  static attachmentProblem(existing: File[], add: File): string | null {
    const ext = (add.name.split('.').pop() || '').toLowerCase();
    if (!ATTACH_EXT.includes(ext)) { return `"${add.name}" is not allowed. Use PDF, Word, Excel, PowerPoint, images, TXT or CSV.`; }
    if (add.size > ATTACH_MAX_BYTES) { return `"${add.name}" is larger than 5 MB.`; }
    if (existing.length >= ATTACH_MAX_FILES) { return `You can attach up to ${ATTACH_MAX_FILES} files.`; }
    if (existing.reduce((n, f) => n + f.size, add.size) > ATTACH_MAX_TOTAL) { return 'The attachments together must be 15 MB or smaller.'; }
    return null;
  }

  private track<T extends { unread?: number }>(o: Observable<T>): Observable<T> {
    return o.pipe(tap(r => { if (typeof r?.unread === 'number') { this.unread$.next(r.unread); } }));
  }

  list(q: ListQuery): Observable<ListReply> {
    let p = new HttpParams();
    if (q.q) { p = p.set('q', q.q); }
    if (q.status && q.status !== 'all') { p = p.set('status', q.status); }
    if (q.archived) { p = p.set('archived', '1'); }
    if (q.mine) { p = p.set('mine', '1'); }
    if (q.page) { p = p.set('page', String(q.page)); }
    return this.track(this.http.get<ListReply>(this.base, { ...this.opts, params: p }).pipe(timeout(20000)));
  }
  refreshUnread(): void { this.http.get<any>(`${this.base}/unread-count`, this.opts).subscribe({ next: r => this.unread$.next(r.unread || 0), error: () => { /* keep the last count */ } }); }

  get(id: number): Observable<{ success: boolean; data: InquiryDetail; unread: number }> { return this.track(this.http.get<any>(`${this.base}/${id}`, this.opts).pipe(timeout(20000))); }
  setRead(id: number, read: boolean) { return this.track(this.http.post<any>(`${this.base}/${id}/read`, { read }, this.opts).pipe(timeout(20000))); }
  setStatus(id: number, action: 'close' | 'reopen') { return this.track(this.http.post<any>(`${this.base}/${id}/status`, { action }, this.opts).pipe(timeout(20000))); }
  assign(id: number, mine: boolean) { return this.track(this.http.post<any>(`${this.base}/${id}/assign`, { mine }, this.opts).pipe(timeout(20000))); }
  archive(id: number) { return this.track(this.http.delete<any>(`${this.base}/${id}`, this.opts).pipe(timeout(20000))); }
  restore(id: number) { return this.track(this.http.post<any>(`${this.base}/${id}/restore`, {}, this.opts).pipe(timeout(20000))); }
  deletePermanently(id: number) { return this.track(this.http.delete<any>(`${this.base}/${id}`, { ...this.opts, params: new HttpParams().set('permanent', '1') }).pipe(timeout(20000))); }

  reply(id: number, subject: string, body: string, files: File[]) {
    const fd = new FormData();
    fd.append('subject', subject);
    fd.append('body', body);
    files.forEach(f => fd.append('attachments[]', f, f.name));
    return this.track(this.http.post<any>(`${this.base}/${id}/reply`, fd, this.opts).pipe(timeout(90000)));
  }

  /** Attachments are private: fetched with the admin's token and saved from a blob. */
  downloadAttachment(id: number, messageId: number, a: AttachmentInfo): Observable<Blob> {
    return this.http.get(`${this.base}/${id}/messages/${messageId}/attachments/${a.index}`, { ...this.opts, responseType: 'blob' }).pipe(timeout(60000));
  }
}
