import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { _url } from 'src/global-variables';

export interface SubPlan {
  planId: string; plan_name: string; price: number; tagmonthYear: 'Monthly' | 'Yearly'; tag: string;
  button_name: string; sort_number: number; description: string; recordStatus: 'active' | 'inactive';
  subscribers: number; audience: 'DEF-USERS' | 'DEF-CLIENT'; is_popular?: boolean;
}
export interface SubFeature {
  id: number; key: string; name: string; category: string; icon: string; description: string | null;
  value_type: 'toggle' | 'limit'; active: boolean; plans_count: number | null;
}
export interface Cell { feature_id: number; feature_code: string; enabled: boolean; limit: number | null; unlimited: boolean; }
export type SubStatus = 'active' | 'expired' | 'suspended' | 'pending' | 'none';
export interface Subscriber {
  code: string; name: string; email: string; role: string; plan_id: string | null; plan: string | null;
  status: SubStatus; start: string | null; end: string | null; days_left: number | null; payment_method: string | null;
}
export interface SubscriberDetail extends Subscriber {
  usage: { feature_code: string; name: string; used: number; limit: number | null; unlimited: boolean }[];
  history: { transNo: string; plan_name: string; amount: number; payment_method: string; start_date: string; end_date: string; status: string; remarks: string | null }[];
}
export interface SubscriberPage {
  data: Subscriber[];
  meta: { total: number; per_page: number; current_page: number; last_page: number };
  counts: { all: number; active: number; expired: number; suspended: number; expiring_soon: number };
}
export interface SubReport {
  totals: { subscribers: number; paid: number; free: number; monthly_revenue: number; all_users: number };
  status: { status: string; count: number }[];
  distribution: { plan_id: string; name: string; count: number }[];
  revenue: { plan_id: string; name: string; subscribers: number; monthly: number }[];
  growth: { label: string; value: number }[];
  expiring: { code: string; fullname: string; email: string; plan_name: string; end_date: string; days_left: number }[];
}

/** Laravel API client for the master-admin Subscription Management pages. */
@Injectable({ providedIn: 'root' })
export class SubscriptionApiService {
  private base = `${_url}subscription-admin`;

  constructor(private http: HttpClient) { }

  private get headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${sessionStorage.getItem('token') || ''}` });
  }
  private get opts() { return { headers: this.headers }; }

  /** Best human message from a Laravel error (validation errors, abort() messages, or a fallback). */
  static errorMessage(err: any, fallback = 'Something went wrong. Please try again.'): string {
    const e = err?.error;
    if (e?.errors) { const first = Object.values(e.errors)[0] as string[]; if (first?.length) { return first[0]; } }
    return e?.message || fallback;
  }

  // ----------------------------------------------------------------- plans (existing account-plan API)
  plans(): Observable<SubPlan[]> {
    return this.http.get<any>(`${_url}account-plan/list?all=1`, this.opts).pipe(
      map(r => (r.data as any[]).map(p => ({ ...p, price: +p.price, subscribers: p.subscribers ?? 0 }) as SubPlan)));
  }
  savePlan(p: Partial<SubPlan>): Observable<any> {
    return p.planId
      ? this.http.put(`${_url}account-plan/update/${p.planId}`, p, this.opts)
      : this.http.post(`${_url}account-plan/save`, p, this.opts);
  }
  setPlanActive(planId: string, active: boolean): Observable<any> {
    return this.http.patch(`${_url}account-plan/${active ? 'activate' : 'deactivate'}/${planId}`, {}, this.opts);
  }

  // ----------------------------------------------------------------------------------- features
  features(): Observable<{ data: SubFeature[]; categories: string[] }> {
    return this.http.get<any>(`${this.base}/features`, this.opts);
  }
  createFeature(f: any): Observable<any> { return this.http.post(`${this.base}/features`, f, this.opts); }
  updateFeature(id: number, f: any): Observable<any> { return this.http.put(`${this.base}/features/${id}`, f, this.opts); }
  toggleFeature(id: number): Observable<any> { return this.http.patch(`${this.base}/features/${id}/toggle`, {}, this.opts); }

  // -------------------------------------------------------------------------------- assignments
  assignments(planId: string): Observable<Cell[]> {
    return this.http.get<any>(`${this.base}/assignments/${planId}`, this.opts).pipe(map(r => r.data));
  }
  assignmentsOverview(): Observable<{ [planId: string]: Cell[] }> {
    return this.http.get<any>(`${this.base}/assignments`, this.opts).pipe(map(r => r.data));
  }
  saveAssignments(planId: string, items: Pick<Cell, 'feature_id' | 'enabled' | 'limit' | 'unlimited'>[]): Observable<any> {
    return this.http.put(`${this.base}/assignments/${planId}`, { items }, this.opts);
  }

  // ------------------------------------------------------------------------------- subscribers
  subscribers(q: { search?: string; plan_id?: string; status?: string; page?: number; per_page?: number }): Observable<SubscriberPage> {
    let params = new HttpParams();
    Object.entries(q).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') { params = params.set(k, String(v)); } });
    return this.http.get<any>(`${this.base}/subscribers`, { ...this.opts, params });
  }
  subscriber(code: string): Observable<SubscriberDetail> {
    return this.http.get<any>(`${this.base}/subscribers/${code}`, this.opts).pipe(map(r => r.data));
  }
  changePlan(code: string, planId: string): Observable<any> {
    return this.http.post(`${this.base}/subscribers/${code}/change-plan`, { plan_id: planId }, this.opts);
  }
  extend(code: string, days: number): Observable<any> {
    return this.http.post(`${this.base}/subscribers/${code}/extend`, { days }, this.opts);
  }
  suspend(code: string, reason?: string): Observable<any> {
    return this.http.post(`${this.base}/subscribers/${code}/suspend`, { reason }, this.opts);
  }
  reactivate(code: string): Observable<any> {
    return this.http.post(`${this.base}/subscribers/${code}/reactivate`, {}, this.opts);
  }

  // ---------------------------------------------------------------------------------- reports
  report(expiringDays = 30): Observable<SubReport> {
    return this.http.get<any>(`${this.base}/reports`, { ...this.opts, params: new HttpParams().set('expiring_days', expiringDays) })
      .pipe(map(r => r.data));
  }
}
