import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { catchError, Observable, of } from 'rxjs';
import { _url } from 'src/global-variables';

@Injectable({
  providedIn: 'root'
})
export class CommentService {

  constructor(private http: HttpClient) { }

  private getAuthToken(): string {
    return sessionStorage.getItem('token') || ''; // Fetch the token from localStorage or other storage
  }

  private createHeaders(): HttpHeaders {
    const token = this.getAuthToken();
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  private createParams(): HttpParams {
    return new HttpParams().set('desc_code', 'top_navigation');
  }

  //individual
  postCommentIndividual(post_uuidOrUind: any, comment: any): Observable<any> {
    const headers = this.createHeaders();
    const params = new HttpParams().set('post_uuidOrUind', post_uuidOrUind);
    return this.http.post(`${_url}comment`, comment, { headers, params });
  }

  getComment(post_uuidOrUind:any): Observable<any> {
    const headers = this.createHeaders();
    const params = new HttpParams().set('post_uuidOrUind', post_uuidOrUind); 
    return this.http.get(`${_url}comment`, { headers, params });
  }
  
  //per post comment
  postComment(comment_uuid: any, comment: any): Observable<any> {
    const headers = this.createHeaders();
    const params = new HttpParams().set('post_uuid', comment_uuid);
    return this.http.post(`${_url}comment`, comment, { headers, params });
  }

  postCommentByReply(comment_uuid: any, comment: any): Observable<any> {
    const headers = this.createHeaders();
    const params = new HttpParams().set('comment_uuid', comment_uuid);
  
    return this.http.post(`${_url}commentreply`, comment, { headers, params });
  }
  
  // ------------------------------------------------------------------
  //  Facebook-style comments (used by PostCommentsComponent).
  //  These talk to the same Laravel endpoints; errors reach the caller.
  // ------------------------------------------------------------------

  /** No Content-Type here: the browser sets the multipart boundary for FormData. */
  private authHeaders(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${this.getAuthToken()}` });
  }

  /** Newest first, cursor paginated: { success, data[], total, total_with_replies, has_more, next_before }. */
  list(postUuid: string, perPage = 5, before?: number | null): Observable<any> {
    let params = new HttpParams().set('post_uuidOrUind', postUuid).set('per_page', perPage);
    if (before) { params = params.set('before', before); }
    return this.http.get(`${_url}comment`, { headers: this.createHeaders(), params });
  }

  create(postUuid: string, text: string, image?: File | null): Observable<any> {
    const fd = new FormData();
    fd.append('post_uuid', postUuid);
    fd.append('comment', text);
    if (image) { fd.append('image', image); }
    return this.http.post(`${_url}comment`, fd, { headers: this.authHeaders() });
  }

  reply(commentUuid: string, text: string, image?: File | null): Observable<any> {
    const fd = new FormData();
    fd.append('comment_uuid', commentUuid);
    fd.append('comment', text);
    if (image) { fd.append('image', image); }
    return this.http.post(`${_url}commentreply`, fd, { headers: this.authHeaders() });
  }

  /** id = comment_uuid (com_headers) or the reply id (com_replies). Sent as POST + _method=PUT so a file can travel with it. */
  edit(id: string | number, settings: 'com_headers' | 'com_replies', text: string,
       opts: { image?: File | null; removeImage?: boolean } = {}): Observable<any> {
    const fd = new FormData();
    fd.append('_method', 'PUT');
    fd.append('comment_settings', settings);
    fd.append('comment', text);
    if (opts.image) { fd.append('image', opts.image); }
    if (opts.removeImage) { fd.append('remove_image', '1'); }
    return this.http.post(`${_url}comment/${id}`, fd, { headers: this.authHeaders() });
  }

  remove(id: string | number, settings: 'com_headers' | 'com_replies'): Observable<any> {
    const params = new HttpParams().set('comment_settings', settings);
    return this.http.delete(`${_url}comment/${id}`, { headers: this.createHeaders(), params });
  }

  reactToComment(type: 'comment' | 'reply', ref: string | number, reaction: string): Observable<any> {
    return this.http.post(`${_url}reactToComment`, { target_type: type, target_ref: String(ref), reaction }, { headers: this.createHeaders() });
  }

  removeCommentReaction(type: 'comment' | 'reply', ref: string | number): Observable<any> {
    return this.http.post(`${_url}removeCommentReaction`, { target_type: type, target_ref: String(ref) }, { headers: this.createHeaders() });
  }

  /** Who reacted to a comment/reply, grouped by reaction (same shape as the post version). */
  reactors(type: 'comment' | 'reply', ref: string | number): Observable<any> {
    const params = new HttpParams().set('target_type', type).set('target_ref', String(ref));
    return this.http.get(`${_url}commentReactors`, { headers: this.createHeaders(), params });
  }

  // edit comment update
  updateReply(id: any, data: any): Observable<any> {
  const headers = this.createHeaders();
    return this.http.put<any>(`${_url}comment/${id}`, data, {headers});
 }

  private handleAuthError(error: any): Observable<any> {
    if (error.status === 401) {
      console.error('Unauthorized: Please log in.');
      alert('Unauthorized access. Please log in again.');
    } else if (error.status === 403) {
      console.error('Forbidden: You do not have permission to access this resource.');
      alert('Forbidden: You do not have the required permissions.');
    } else {
      console.error('An error occurred:', error.message);
      alert('An unexpected error occurred. Please try again.');
    }
    return of(null); // Return an observable with a fallback value
  }

}
