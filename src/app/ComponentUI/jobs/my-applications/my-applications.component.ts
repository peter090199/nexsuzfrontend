import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { _url } from 'src/global-variables';

export type AppStatus = 'applied_active' | 'review' | 'interview' | 'approved' | 'reject';

export interface MyApplication {
  id: number; reference: string; job_title: string; company: string | null; location: string | null;
  trans_no: string; job_available: boolean; status: AppStatus; applied_at: string; updated_at: string;
}

/** label, colour and icon of each status the recruitment pipeline uses */
export const STATUS_META: Record<AppStatus, { label: string; tone: string; icon: string }> = {
  applied_active: { label: 'Pending', tone: 'pending', icon: 'hourglass_top' },
  review: { label: 'Under Review', tone: 'review', icon: 'manage_search' },
  interview: { label: 'Interview', tone: 'interview', icon: 'event' },
  approved: { label: 'Hired', tone: 'hired', icon: 'check_circle' },
  reject: { label: 'Rejected', tone: 'rejected', icon: 'cancel' },
};

/** DEF-USERS: the person's own job applications, read only. The API only ever returns their own. */
@Component({
  selector: 'app-my-applications',
  templateUrl: './my-applications.component.html',
  styleUrls: ['./my-applications.component.css']
})
export class MyApplicationsComponent implements OnInit {
  @ViewChild('details') detailsTpl!: TemplateRef<any>;

  readonly statuses = Object.keys(STATUS_META) as AppStatus[];
  readonly meta = STATUS_META;

  items: MyApplication[] = [];
  counts: Record<string, number> = {};
  loading = true;
  failed = false;
  search = '';
  filter: AppStatus | '' = '';

  detail: any = null;
  detailFailed = false;

  constructor(private http: HttpClient, private dialog: MatDialog) { }

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.failed = false;
    this.http.get<any>(`${_url}my-applications`, { headers: this.headers() }).subscribe({
      next: res => { this.items = res.data || []; this.counts = res.counts || {}; this.loading = false; },
      error: () => { this.failed = true; this.loading = false; }
    });
  }

  get visible(): MyApplication[] {
    const q = this.search.trim().toLowerCase();
    return this.items.filter(a => (!this.filter || a.status === this.filter)
      && (!q || `${a.job_title} ${a.company || ''} ${a.reference} ${a.location || ''}`.toLowerCase().includes(q)));
  }

  setFilter(s: AppStatus | ''): void { this.filter = this.filter === s ? '' : s; }

  clear(): void { this.search = ''; this.filter = ''; }

  open(a: MyApplication): void {
    this.detail = null;
    this.detailFailed = false;
    this.dialog.open(this.detailsTpl, { width: '640px', maxWidth: '96vw', autoFocus: false });
    this.http.get<any>(`${_url}my-applications/${a.id}`, { headers: this.headers() }).subscribe({
      next: res => this.detail = res.data,
      error: () => this.detailFailed = true
    });
  }

  /**
   * The path an application takes, with the date each step was reached. A rejection ends it; the steps after the
   * last one reached are shown as still to come.
   */
  steps(d: any): { status: AppStatus; at: string | null; state: 'done' | 'current' | 'todo' }[] {
    const reached = new Map<string, string>();
    (d.timeline || []).forEach((t: any) => reached.set(t.status, t.at));
    const end: AppStatus = d.status === 'reject' ? 'reject' : 'approved';
    const path: AppStatus[] = ['applied_active', 'review', 'interview', end];
    const shown = d.status === 'reject' ? path.filter(s => s === 'reject' || reached.has(s)) : path;

    return shown.map(s => ({
      status: s, at: reached.get(s) || null,
      state: s === d.status ? 'current' : reached.has(s) ? 'done' : 'todo'
    }));
  }

  trackId(_: number, a: MyApplication): number { return a.id; }

  private headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${sessionStorage.getItem('token') || ''}` });
  }
}
