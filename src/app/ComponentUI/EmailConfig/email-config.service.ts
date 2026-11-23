import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { _url } from 'src/global-variables';

export type Encryption = 'ssl' | 'tls' | 'none';
export interface Provider { label: string; host: string; port: number; encryption: Encryption; note: string; }
export interface SmtpSettings {
  provider: string; host: string; port: number; encryption: Encryption; username: string; from_address: string; from_name: string;
  has_password: boolean;
}
export interface EmailConfigView {
  mailer: string;
  providers: { [id: string]: Provider };
  saved: boolean;
  source: 'database' | 'env';
  settings: SmtpSettings;
  env_fallback: { host: string; port: number; encryption: string; username: string; from_address: string; from_name: string };
  status: { enabled: boolean; connection: 'connected' | 'failed' | 'not_tested'; last_test_at: string | null; last_success_at: string | null; last_error: string | null };
}
/** What the form sends. The password is only included when the administrator typed one. */
export interface SmtpForm {
  provider: string; host: string; port: number; encryption: Encryption; username: string; password?: string; from_address: string; from_name: string;
}
export interface ApiReply { success: boolean; message: string | null; data: EmailConfigView; }

/** Laravel client for the master-admin email configuration page. Nothing here is hard-coded: providers come from the API. */
@Injectable({ providedIn: 'root' })
export class EmailConfigService {
  private base = `${_url}email-config`;

  constructor(private http: HttpClient) { }

  private get opts() {
    return { headers: new HttpHeaders({ Authorization: `Bearer ${sessionStorage.getItem('token') || ''}` }) };
  }

  static errorMessage(err: any, fallback = 'Something went wrong. Please try again.'): string {
    const e = err?.error;
    if (e?.errors) { const first = Object.values(e.errors)[0] as string[]; if (first?.length) { return first[0]; } }
    if (err?.name === 'TimeoutError') { return 'The server took too long to answer. It may be busy or unreachable. Please try again.'; }
    if (err?.status === 0) { return 'Cannot reach the server. Check that the backend is running and your network connection.'; }
    if (err?.status === 429) { return 'Too many requests. Please wait a minute and try again.'; }
    return e?.message || fallback;
  }

  /** Reading is quick, so give up (with a clear message) rather than leave the page loading forever. */
  static readonly READ_TIMEOUT = 20000;
  /** SMTP actions talk to a remote mail server, which can legitimately take a while to answer or to refuse a login. */
  static readonly SMTP_TIMEOUT = 45000;

  get(): Observable<{ success: boolean; data: EmailConfigView }> { return this.http.get<any>(this.base, this.opts).pipe(timeout(EmailConfigService.READ_TIMEOUT)); }
  save(body: SmtpForm): Observable<ApiReply> { return this.http.post<ApiReply>(this.base, body, this.opts).pipe(timeout(EmailConfigService.SMTP_TIMEOUT)); }
  update(body: SmtpForm): Observable<ApiReply> { return this.http.put<ApiReply>(this.base, body, this.opts).pipe(timeout(EmailConfigService.SMTP_TIMEOUT)); }
  testConnection(body: SmtpForm | {}): Observable<ApiReply> { return this.http.post<ApiReply>(`${this.base}/test-connection`, body, this.opts).pipe(timeout(EmailConfigService.SMTP_TIMEOUT)); }
  testEmail(to: string, settings?: SmtpForm): Observable<ApiReply> {
    return this.http.post<ApiReply>(`${this.base}/test-email`, settings ? { to, settings } : { to }, this.opts).pipe(timeout(EmailConfigService.SMTP_TIMEOUT));
  }
  toggle(enabled: boolean): Observable<ApiReply> { return this.http.post<ApiReply>(`${this.base}/toggle`, { enabled }, this.opts).pipe(timeout(EmailConfigService.SMTP_TIMEOUT)); }
  reset(): Observable<ApiReply> { return this.http.delete<ApiReply>(this.base, this.opts); }
}
