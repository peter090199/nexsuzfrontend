import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { _url } from 'src/global-variables';

export interface DashboardRange { from?: string; to?: string; all?: boolean; }

/** Statistics for the DEF-ADMIN and DEF-MASTERADMIN dashboards (one endpoint, scoped by role on the server). */
@Injectable({ providedIn: 'root' })
export class AdminDashboardService {
  constructor(private http: HttpClient) { }

  getStats(range: DashboardRange = {}): Observable<any> {
    let params = new HttpParams();
    if (range.all) { params = params.set('all', '1'); }
    if (range.from) { params = params.set('from', range.from); }
    if (range.to) { params = params.set('to', range.to); }

    return this.http.get(`${_url}admin/dashboard-stats`, {
      params,
      headers: new HttpHeaders({ Authorization: `Bearer ${sessionStorage.getItem('token') || ''}` })
    });
  }
}
