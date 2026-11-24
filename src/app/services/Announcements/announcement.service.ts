import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { _url } from 'src/global-variables';

export type AnnouncementStatus = 'draft' | 'published' | 'archived';
export type AnnouncementPriority = 'normal' | 'important' | 'urgent';

export interface AnnouncementFile { id: number; url: string; name: string; mime: string | null; size: number; }

export interface Announcement {
  id: number;
  announcement_uuid: string;
  title: string;
  content: string;
  priority: AnnouncementPriority;
  is_pinned: boolean;
  status: AnnouncementStatus;
  is_expired: boolean;
  published_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  author: { code: number; fullname: string; role_code: string | null; photo_pic: string | null };
  images: AnnouncementFile[];
  attachments: AnnouncementFile[];
  reaction_summary: { total: number; breakdown: { reaction: string; count: number }[]; mine: string | null };
  my_reaction: string | null;
  comments_count: number;
  is_owner: boolean;
  can_edit: boolean;
  can_moderate: boolean;
}

/**
 * Global announcements. Everybody signed in reads the live ones; only DEF-ADMIN and DEF-MASTERADMIN write them, and the API
 * enforces both: nothing here is a permission check, it only calls the endpoints.
 */
@Injectable({ providedIn: 'root' })
export class AnnouncementService {
  constructor(private http: HttpClient) { }

  /** No Content-Type: the browser sets the multipart boundary when a FormData goes out. */
  private headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${sessionStorage.getItem('token') || ''}` });
  }

  /** the live announcements, pinned first, then by priority, then newest */
  feed(): Observable<{ success: boolean; data: Announcement[] }> {
    return this.http.get<any>(`${_url}announcements`, { headers: this.headers() });
  }

  /** administrators: everything they may manage, with the counts per status */
  manage(status?: AnnouncementStatus): Observable<{ success: boolean; data: Announcement[]; counts: Record<AnnouncementStatus, number> }> {
    let params = new HttpParams();
    if (status) { params = params.set('status', status); }
    return this.http.get<any>(`${_url}announcements/manage`, { headers: this.headers(), params });
  }

  create(form: FormData): Observable<any> {
    return this.http.post(`${_url}announcements`, form, { headers: this.headers() });
  }

  update(id: number, form: FormData): Observable<any> {
    return this.http.post(`${_url}announcements/${id}/update`, form, { headers: this.headers() });
  }

  setStatus(id: number, status: AnnouncementStatus): Observable<any> {
    return this.http.post(`${_url}announcements/${id}/status`, { status }, { headers: this.headers() });
  }

  remove(id: number): Observable<any> {
    return this.http.delete(`${_url}announcements/${id}`, { headers: this.headers() });
  }

  react(id: number, reaction: string): Observable<any> {
    return this.http.post(`${_url}announcements/${id}/react`, { reaction }, { headers: this.headers() });
  }

  unreact(id: number): Observable<any> {
    return this.http.delete(`${_url}announcements/${id}/react`, { headers: this.headers() });
  }
}
