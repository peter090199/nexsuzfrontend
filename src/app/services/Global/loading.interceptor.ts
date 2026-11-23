import { Injectable } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { LoadingService } from './loading.service';

/** counts every API call (except background refreshes) so the top loading bar shows in ALL components */
@Injectable()
export class LoadingInterceptor implements HttpInterceptor {
  constructor(private loading: LoadingService) { }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (!this.loading.tracks(req.method, req.url)) { return next.handle(req); }
    this.loading.begin();
    return next.handle(req).pipe(finalize(() => this.loading.end()));
  }
}
