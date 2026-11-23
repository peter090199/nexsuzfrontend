import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateChild, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { CvSetupService } from 'src/app/services/CV/cv-setup.service';
import { NotificationsService } from 'src/app/services/Global/notifications.service';

/**
 * Job seekers (DEF-USERS) must finish their CV first. Until they have, every page under /DEF-USERS sends them to the CV
 * editor; only the editor itself (/DEF-USERS/user-cv) is reachable. Other roles are not affected.
 *
 * If the status cannot be fetched (network or server error) the guard lets the navigation through rather than locking
 * people out of the app; the CV editor and the API enforce nothing else, so this only ever affects navigation.
 */
@Injectable({ providedIn: 'root' })
export class CvSetupGuard implements CanActivateChild {
  static readonly CV_URL = '/DEF-USERS/user-cv';

  constructor(private router: Router, private cv: CvSetupService, private notify: NotificationsService) { }

  canActivateChild(_route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean | UrlTree> | boolean {
    if (sessionStorage.getItem('role') !== 'DEF-USERS' || !sessionStorage.getItem('token')) { return true; }
    if (this.cv.isKnownComplete()) { return true; }

    const path = state.url.split(/[?#]/)[0];
    const onCv = path === CvSetupGuard.CV_URL || path.startsWith(CvSetupGuard.CV_URL + '/');

    // the CV editor is always reachable, so there is nothing to ask the API (this also keeps the redirect to it from
    // triggering a second status call)
    if (onCv) { return true; }

    return this.cv.check().pipe(
      map(status => {
        if (!status.applies || status.complete) { return true; }
        this.notify.toastrInfo('Please finish setting up your CV first. The rest of Nexsuz opens as soon as it is complete.');
        return this.router.createUrlTree([CvSetupGuard.CV_URL]);
      }),
      catchError(() => of(true))
    );
  }
}
