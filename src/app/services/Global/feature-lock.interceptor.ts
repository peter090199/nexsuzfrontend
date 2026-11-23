import { Injectable } from '@angular/core';
import { HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { FeatureService } from 'src/app/services/AccountPlan/feature.service';

/**
 * The API answers 403 { code: 'feature_locked', feature, message } when the account's plan does not include what was
 * asked (job seekers and recruiters only). This shows that message once in a while ("View plans" action) and looks at
 * the plan again, so a downgrade, an expiry or an administrator's change is picked up the moment it matters.
 * The error still reaches the caller untouched, so each screen keeps its own handling.
 */
@Injectable()
export class FeatureLockInterceptor implements HttpInterceptor {
  constructor(private features: FeatureService) { }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      catchError((err: unknown) => {
        if (err instanceof HttpErrorResponse && err.status === 403 && err.error && err.error.code === 'feature_locked') {
          this.features.lockedByServer(String(err.error.feature || ''), err.error.message);
        }
        return throwError(() => err);
      })
    );
  }
}
