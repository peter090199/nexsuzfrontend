// import { Injectable } from '@angular/core';

// @Injectable({
//   providedIn: 'root'
// })
// export class UserServicesService {

//   constructor() { }
// }

import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { catchError, Observable, of, tap } from 'rxjs';
import { _url } from 'src/global-variables';

@Injectable({
  providedIn: 'root'
})
export class UserServicesService   {
  RequiredRefresh: any;
  constructor(private http: HttpClient) { }
  private getAuthToken(): string {
    return sessionStorage.getItem('token') || '';
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
  getUsers(): Observable<any> {
    const headers = this.createHeaders();
    return this.http.get<any>(`${_url}getUsers`, { headers });
  }

  /** Activate ('A') or deactivate ('I') an account. DEF-MASTERADMIN only: the API checks the role. */
  setUserStatus(code: number | string, status: 'A' | 'I'): Observable<any> {
    return this.http.patch<any>(`${_url}users/${code}/status`, { status }, { headers: this.createHeaders() });
  }

  /** What deleting this account would remove (read-only). DEF-MASTERADMIN only. */
  deleteUserPreview(code: number | string): Observable<any> {
    return this.http.get<any>(`${_url}users/${code}/delete-preview`, { headers: this.createHeaders() });
  }

  /**
   * Delete an account and everything it created. DEF-MASTERADMIN only; the API also needs the admin's password and the
   * account's email typed back, and takes a safety backup first.
   */
  deleteUser(code: number | string, body: { password: string; confirm: string; delete_files: boolean }): Observable<any> {
    return this.http.request<any>('DELETE', `${_url}users/${code}`, { body, headers: this.createHeaders() });
  }

  saveSubmenu(data: any): Observable<any> {
    const headers = this.createHeaders();
    return this.http.post<any>(`${_url}saveSubmenus`, data, { headers });
  }
  updateSubmenu(id: number, data: any): Observable<any> {
    const headers = this.createHeaders();
    return this.http.put(`${_url}updatesubmenu/${id}`, data, { headers });
  }
  postData(role: any): Observable<any> {
    const headers = this.createHeaders();
    return this.http.post<any>(`${_url}role`, role, { headers });
  }
  putData(id: string, body: any): Observable<any> {
    const headers = this.createHeaders();
    return this.http.put(`${_url}role/${id}`, body, { headers });
  }
  deleteMenu(transNo: string): Observable<any> {
    const headers = this.createHeaders();
    return this.http.delete(`${_url}menu/delete/${transNo}`, { headers });
  }

 deleteSubmenu(id: number): Observable<any> {
    const headers = this.createHeaders();
    return this.http.delete(`${_url}deleteSubmenu/${id}`, { headers });
  }


  private handleError<T>(operation = 'operation', result?: T) {
    return (error: any): Observable<T> => {
      console.error(error); // Log the error for debugging
      
      // Optionally, you can use toastr to show the error message here:
      // this.toastrService.error(error.message || 'An error occurred');

      // Let the app keep running by returning a safe result.
      return of(result as T);
    };
  }

}
