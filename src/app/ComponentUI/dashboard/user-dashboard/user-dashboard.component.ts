import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { ChartSlice } from 'src/app/ComponentSharedUI/mini-chart/mini-chart.component';
import { AppStatus, MyApplication, STATUS_META } from 'src/app/ComponentUI/jobs/my-applications/my-applications.component';
import { _url } from 'src/global-variables';

/** chart colours, the same family as the status badges */
const STATUS_COLOR: Record<AppStatus, string> = {
  applied_active: '#e08a00', review: '#0a66c2', interview: '#7b3fb5', approved: '#1b8a4b', reject: '#c62828'
};

/**
 * DEF-USERS home after sign-in: their own applications at a glance. Uses the My Job Applications API (DEF-USERS only,
 * the person's own rows only); nothing here can change an application.
 */
@Component({
  selector: 'app-user-dashboard',
  templateUrl: './user-dashboard.component.html',
  styleUrls: ['./user-dashboard.component.css']
})
export class UserDashboardComponent implements OnInit {
  readonly meta = STATUS_META;
  readonly statuses = Object.keys(STATUS_META) as AppStatus[];

  loading = true;
  failed = false;
  total = 0;
  counts: Record<string, number> = {};
  recent: MyApplication[] = [];
  updates: { id: number; job_title: string | null; status: AppStatus; at: string }[] = [];
  slices: ChartSlice[] = [];

  constructor(private http: HttpClient) { }

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.failed = false;
    this.http.get<any>(`${_url}my-applications`, { headers: this.headers() }).subscribe({
      next: res => {
        this.total = res.total || 0;
        this.counts = res.counts || {};
        this.recent = (res.data || []).slice(0, 5);
        this.updates = res.updates || [];
        this.slices = this.statuses.map(s => ({ label: STATUS_META[s].label, value: this.counts[s] || 0, color: STATUS_COLOR[s] }))
          .filter(s => s.value > 0);
        this.loading = false;
      },
      error: () => { this.failed = true; this.loading = false; }
    });
  }

  private headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${sessionStorage.getItem('token') || ''}` });
  }
}
