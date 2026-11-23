import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { _url } from 'src/global-variables';
import { NotificationsService } from './Global/notifications.service';

export interface BlockedUser {
  code: number;
  fullname: string;
  role_code: string;
  company?: string | null;
  photo_pic?: string | null;
  blocked_at: string;
}

/**
 * The one place the app talks about blocking. Every Block / Unblock button and the Blocked Users screen use it,
 * for every account type. The Laravel API enforces the rules; this only calls it and shows the confirmations.
 */
@Injectable({ providedIn: 'root' })
export class BlockService {

  /** fires with the account code after a successful block / unblock, so any open screen can refresh */
  readonly blocked$ = new Subject<number>();
  readonly unblocked$ = new Subject<number>();

  constructor(private http: HttpClient, private notify: NotificationsService) { }

  private headers(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${sessionStorage.getItem('token') || ''}`,
      'Content-Type': 'application/json'
    });
  }

  // ---------------------------------------------------------------- API
  list(search = ''): Observable<any> {
    const q = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
    return this.http.get(`${_url}blocks${q}`, { headers: this.headers() });
  }

  block(code: number | string): Observable<any> {
    return this.http.post(`${_url}blocks`, { code }, { headers: this.headers() });
  }

  unblock(code: number | string): Observable<any> {
    return this.http.delete(`${_url}blocks/${code}`, { headers: this.headers() });
  }

  status(code: number | string): Observable<any> {
    return this.http.get(`${_url}blocks/status/${code}`, { headers: this.headers() });
  }

  /** Mirrors the API rule (BlockService::CANNOT_BLOCK): a regular user cannot block an admin. */
  private readonly cannotBlock: Record<string, string[]> = { 'DEF-USERS': ['DEF-ADMIN', 'DEF-MASTERADMIN'] };

  /** false when my account type is not allowed to block that account type */
  canBlock(targetRole?: string | null): boolean {
    const mine = sessionStorage.getItem('role') || '';
    return !(targetRole && (this.cannotBlock[mine] || []).includes(targetRole));
  }

  isSelf(code: number | string | null | undefined): boolean {
    return code != null && String(code) === String(sessionStorage.getItem('code'));
  }

  // ---------------------------------------------------------------- flows with confirmation
  /** Confirm, block, notify. Resolves true when the account was blocked. */
  async confirmBlock(code: number | string, name: string): Promise<boolean> {
    if (this.isSelf(code)) { return false; }

    const result = await this.notify.popupWarning(
      `Block ${name}?`,
      `${name} won't be able to message you, connect with you or see your profile and posts, and you won't be able to ` +
      `do those things with them either. Your connection with them will be removed. ` +
      `Messages and posts are not deleted. You can unblock them later in Settings.`
    );
    if (!result.isConfirmed) { return false; }

    return new Promise<boolean>(resolve => {
      this.block(code).subscribe({
        next: (res: any) => {
          if (res?.success) {
            this.notify.toastrSuccess(res.message || `You blocked ${name}.`);
            this.blocked$.next(Number(code));
            resolve(true);
          } else {
            this.notify.toastrError(res?.message || 'Could not block this account.');
            resolve(false);
          }
        },
        error: (err) => {
          this.notify.toastrError(err?.error?.message || 'Could not block this account.');
          resolve(false);
        }
      });
    });
  }

  /** Confirm, unblock, notify. Resolves true when the account was unblocked. */
  async confirmUnblock(code: number | string, name: string): Promise<boolean> {
    const result = await this.notify.popupWarning(
      `Unblock ${name}?`,
      `${name} will be able to find you, see your profile and posts, and message or connect with you again. ` +
      `You will need to send a new connection request.`
    );
    if (!result.isConfirmed) { return false; }

    return new Promise<boolean>(resolve => {
      this.unblock(code).subscribe({
        next: (res: any) => {
          if (res?.success) {
            this.notify.toastrSuccess(res.message || `You unblocked ${name}.`);
            this.unblocked$.next(Number(code));
            resolve(true);
          } else {
            this.notify.toastrError(res?.message || 'Could not unblock this account.');
            resolve(false);
          }
        },
        error: (err) => {
          this.notify.toastrError(err?.error?.message || 'Could not unblock this account.');
          resolve(false);
        }
      });
    });
  }
}
