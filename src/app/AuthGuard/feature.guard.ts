import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, UrlTree } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { FeatureService } from 'src/app/services/AccountPlan/feature.service';

/**
 * Route guard for subscription features. A route that carries  data: { feature: FEATURE.X }  (or an array of features)
 * only opens when the account's plan includes it. It sits next to RoleGuard: access needs BOTH the role and the plan.
 *
 * Only job seekers and recruiters are ever limited, so for anyone else this lets everything through. When the plan does
 * not include the feature the person is told why (with a "View plans" action) and sent to their home page.
 * The API enforces the same features on its own, so this guard is the courtesy and the server is the lock.
 */
@Injectable({ providedIn: 'root' })
export class FeatureGuard implements CanActivate {

  constructor(private features: FeatureService, private router: Router) { }

  canActivate(route: ActivatedRouteSnapshot): Observable<boolean | UrlTree> | boolean {
    const wanted = route.data['feature'];
    const codes: string[] = Array.isArray(wanted) ? wanted : (wanted ? [wanted] : []);
    if (!codes.length || !this.features.planApplies) { return true; }

    // wait for the first answer from the API so a deep link is judged on real data, not on "not loaded yet"
    return this.features.whenLoaded().pipe(map(() => {
      const missing = codes.find(c => !this.features.allows(c));
      if (!missing) { return true; }
      this.features.notifyLocked(missing);
      const role = sessionStorage.getItem('role');
      return this.router.createUrlTree([role ? '/' + role + '/home' : '/']);
    }));
  }
}
