import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { _url } from 'src/global-variables';

/** What the API says about a job seeker's CV. `applies` is false for roles that have no CV. */
export interface CvStatus { applies: boolean; complete: boolean; missing: string[]; total: number; }

/**
 * Has this job seeker finished setting up their CV? The answer comes from the API (one place owns the rules). Once it is
 * "complete" for the current sign-in it is remembered in sessionStorage, so the route guard does not call the API again
 * on every page change. The marker is tied to the sign-in token, so a new sign-in checks again.
 */
@Injectable({ providedIn: 'root' })
export class CvSetupService {
  private static readonly DONE_KEY = 'cv_setup_done';

  /** Latest status the API returned (used by the banner on the CV page). */
  latest: CvStatus | null = null;

  constructor(private http: HttpClient) { }

  private get token(): string { return sessionStorage.getItem('token') || ''; }

  /** True when this sign-in has already been seen with a finished CV. */
  isKnownComplete(): boolean {
    return !!this.token && sessionStorage.getItem(CvSetupService.DONE_KEY) === this.token;
  }

  markComplete(): void {
    if (this.token) { sessionStorage.setItem(CvSetupService.DONE_KEY, this.token); }
  }

  forget(): void { sessionStorage.removeItem(CvSetupService.DONE_KEY); }

  /** Ask the API (or answer from the remembered "complete" unless `force`). */
  check(force = false): Observable<CvStatus> {
    if (!force && this.isKnownComplete()) {
      return of({ applies: true, complete: true, missing: [], total: 0 });
    }
    return this.http.get<{ success: boolean; data: CvStatus }>(`${_url}cv/status`,
      { headers: new HttpHeaders({ Authorization: `Bearer ${this.token}` }) }
    ).pipe(
      map(r => r.data),
      tap(status => {
        this.latest = status;
        if (!status.applies || status.complete) { this.markComplete(); } else { this.forget(); }
      })
    );
  }
}
