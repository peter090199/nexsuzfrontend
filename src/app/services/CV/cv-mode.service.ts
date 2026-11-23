import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { _url } from 'src/global-variables';

export interface CvMode { upload_only: boolean; mode: 'upload' | 'builder'; }

/**
 * How job seekers provide their CV, as set by the master admin in Settings:
 *   builder (default): they fill up the CV form;  upload only: the CV page shows only "upload your CV / resume".
 * The API enforces who may change it (master admin only); this only calls it.
 */
@Injectable({ providedIn: 'root' })
export class CvModeService {
  constructor(private http: HttpClient) { }

  private headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${sessionStorage.getItem('token') || ''}` });
  }

  get(): Observable<CvMode> {
    return this.http.get<{ data: CvMode }>(`${_url}cv/mode`, { headers: this.headers() }).pipe(map(r => r.data));
  }

  set(uploadOnly: boolean): Observable<CvMode> {
    return this.http.put<{ data: CvMode }>(`${_url}cv/mode`, { upload_only: uploadOnly }, { headers: this.headers() }).pipe(map(r => r.data));
  }
}
