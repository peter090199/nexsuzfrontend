import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class GoogleAuthService {

constructor(private http: HttpClient) {}

  loginWithGoogle() {
    // apiUrl ends with "/api/"; the Google redirect lives at the server root.
    window.location.href = environment.apiUrl.replace(/api\/?$/, '') + 'auth/google/redirect';
  }
}
