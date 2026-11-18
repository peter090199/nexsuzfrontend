import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { _url } from 'src/global-variables';

/**
 * Profile photo and cover photo of the signed-in user.
 *
 * Talks to the Laravel endpoints (multipart/form-data, the image is already cropped in the browser)
 * and announces every change through photo$ / cover$, so every screen that shows the user's own
 * picture (top bar, home, composer, comments, feed...) updates at once, without a refresh.
 *
 *   undefined = nothing has changed in this session   (components keep what the API gave them)
 *   null      = the picture was removed               (components show the default avatar)
 *   string    = the new picture's URL
 */
@Injectable({ providedIn: 'root' })
export class ProfileImageService {
  static readonly DEFAULT_AVATAR = 'assets/images/default.png';

  private photoSubject = new BehaviorSubject<string | null | undefined>(undefined);
  private coverSubject = new BehaviorSubject<string | null | undefined>(undefined);

  readonly photo$ = this.photoSubject.asObservable();
  readonly cover$ = this.coverSubject.asObservable();

  constructor(private http: HttpClient) { }

  /** No Content-Type: the browser sets the multipart boundary. */
  private headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${sessionStorage.getItem('token') || ''}` });
  }

  uploadPhoto(file: File): Observable<any> {
    const fd = new FormData();
    fd.append('photo', file, file.name);
    return this.http.post<any>(`${_url}uploadProfilePhoto`, fd, { headers: this.headers() }).pipe(
      tap(res => { if (res?.success) { this.photoSubject.next(res.photo_pic ?? null); } })
    );
  }

  removePhoto(): Observable<any> {
    return this.http.post<any>(`${_url}removeProfilePhoto`, {}, { headers: this.headers() }).pipe(
      tap(res => { if (res?.success) { this.photoSubject.next(null); } })
    );
  }

  uploadCover(file: File): Observable<any> {
    const fd = new FormData();
    fd.append('coverphoto', file, file.name);
    return this.http.post<any>(`${_url}uploadCoverPhoto`, fd, { headers: this.headers() }).pipe(
      tap(res => { if (res?.success) { this.coverSubject.next(res.coverphoto ?? null); } })
    );
  }

  removeCover(): Observable<any> {
    return this.http.post<any>(`${_url}removeCoverPhoto`, {}, { headers: this.headers() }).pipe(
      tap(res => { if (res?.success) { this.coverSubject.next(null); } })
    );
  }
}
