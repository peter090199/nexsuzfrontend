import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
@Injectable({
  providedIn: 'root'
})
export class RoleGuard implements CanActivate {

  constructor(private router: Router) { }

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): boolean | UrlTree {

    const allowedRoles = route.data['roles'] as string[];
    const userRole = sessionStorage.getItem('role');

    // ❌ No role found → force login
    if (!userRole) {
      return this.router.parseUrl('/signin');
    }

    // ✅ Role allowed
    if (allowedRoles && allowedRoles.includes(userRole)) {
      return true;
    }

    // ❌ Role not allowed → redirect by role
    return this.redirectByRole(userRole);
  }

  private redirectByRole(role: string): UrlTree {
    switch (role) {

      case 'DEF-CLIENT':
        return this.router.parseUrl('/DEF-CLIENT/client-dashboard');

      case 'DEF-ADMIN':
        return this.router.parseUrl('/DEF-ADMIN/admin-dashboard');

      case 'DEF-MASTERADMIN':
        return this.router.parseUrl('/DEF-MASTERADMIN/admin-dashboard');

      case 'DEF-SUPERADMIN':
        return this.router.parseUrl('/superadmin/dashboard');

      case 'DEF-USERS':
        return this.router.parseUrl('/DEF-USERS/home');

      default:
        return this.router.parseUrl('/homepage');
    }
  }



}
