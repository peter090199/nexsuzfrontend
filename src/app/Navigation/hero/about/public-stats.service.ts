import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { _url } from 'src/global-variables';

/** Real platform totals for the public website (GET public/stats, no sign-in). */
export interface PublicStats { professionals: number; jobs: number; companies: number; }

@Injectable({ providedIn: 'root' })
export class PublicStatsService {
  constructor(private http: HttpClient) { }

  get(): Observable<{ success: boolean; data: PublicStats }> {
    return this.http.get<{ success: boolean; data: PublicStats }>(`${_url}public/stats`).pipe(timeout(15000));
  }
}
