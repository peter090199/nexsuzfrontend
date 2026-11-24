import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AdminDashboardService, DashboardRange } from 'src/app/services/MasterAdmin/admin-dashboard.service';
import { SharedRoutinesService } from 'src/app/services/Function/shared-routines.service';
import { ChartSeries, ChartSlice } from 'src/app/ComponentSharedUI/mini-chart/mini-chart.component';

type Preset = '30d' | '90d' | '12m' | 'all' | 'custom';

interface StatCard {
  key: string;
  label: string;
  icon: string;
  value: number;
  sub: string;
  route: string | null;     // module the card opens (only where this role has one)
  warn?: boolean;
}

interface QuickAction { label: string; icon: string; route: string; query?: any; }

/**
 * One dashboard for DEF-ADMIN and DEF-MASTERADMIN. The sections you see depend on the role AND on what the API
 * returns: the Laravel endpoint only sends master-admin data to a master admin, so an admin never receives it.
 */
@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css']
})
export class AdminDashboardComponent implements OnInit, OnDestroy {

  role = '';
  isMaster = false;

  loading = true;          // first load: skeletons
  refreshing = false;      // later loads keep the old data visible
  error = false;
  data: any = null;
  lastUpdated: Date | null = null;

  preset: Preset = '12m';
  from = '';
  to = '';
  rangeError = '';

  cards: StatCard[] = [];
  registrationSeries: ChartSeries[] = [];
  activitySeries: ChartSeries[] = [];
  statusSlices: ChartSlice[] = [];
  applicationSlices: ChartSlice[] = [];
  quickActions: QuickAction[] = [];

  readonly presets: { key: Preset; label: string }[] = [
    { key: '30d', label: '30 days' }, { key: '90d', label: '90 days' }, { key: '12m', label: '12 months' }, { key: 'all', label: 'All time' }
  ];

  private sub?: Subscription;

  constructor(
    private dashboard: AdminDashboardService,
    private router: Router,
    private shared: SharedRoutinesService
  ) { }

  ngOnInit(): void {
    this.role = this.shared.getRole();
    this.isMaster = this.role === 'DEF-MASTERADMIN';
    this.quickActions = this.buildQuickActions();
    this.load();
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  // ------------------------------------------------------------------ data
  private rangeParams(): DashboardRange {
    const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const today = new Date();
    const back = (days: number) => { const d = new Date(); d.setDate(d.getDate() - (days - 1)); return d; };

    switch (this.preset) {
      case '30d': return { from: iso(back(30)), to: iso(today) };
      case '90d': return { from: iso(back(90)), to: iso(today) };
      case 'all': return { all: true, to: iso(today) };
      case 'custom': return { from: this.from, to: this.to };
      default: { const d = new Date(); d.setFullYear(d.getFullYear() - 1); d.setDate(d.getDate() + 1); return { from: iso(d), to: iso(today) }; }
    }
  }

  load(): void {
    this.sub?.unsubscribe();
    this.error = false;
    this.data ? (this.refreshing = true) : (this.loading = true);

    this.sub = this.dashboard.getStats(this.rangeParams()).subscribe({
      next: (res: any) => {
        this.loading = false;
        this.refreshing = false;
        if (!res?.success) { this.error = true; return; }
        this.data = res;
        this.lastUpdated = new Date();
        this.from = res.range.from;
        this.to = res.range.to;
        this.build();
      },
      error: () => { this.loading = false; this.refreshing = false; this.error = true; }
    });
  }

  setPreset(p: Preset): void {
    this.preset = p;
    this.rangeError = '';
    this.load();
  }

  applyCustom(): void {
    if (!this.from || !this.to) { this.rangeError = 'Choose both dates.'; return; }
    if (this.from > this.to) { this.rangeError = 'The start date must be before the end date.'; return; }
    this.rangeError = '';
    this.preset = 'custom';
    this.load();
  }

  // ------------------------------------------------------------------ view models
  private build(): void {
    const d = this.data;
    const t = d.totals;
    const r = d.in_range;
    const inRange = (n: number) => `${n >= 0 ? '+' : ''}${n} in range`;

    this.cards = [
      { key: 'users', label: 'Registered users', icon: 'groups', value: t.registered_users, sub: 'User accounts', route: 'user' },
      { key: 'clients', label: 'Clients / recruiters', icon: 'business_center', value: t.clients, sub: 'Client accounts', route: 'user' },
      { key: 'active', label: 'Active accounts', icon: 'verified_user', value: t.active_users, sub: this.isMaster ? 'All account types' : 'Users and clients', route: 'user' },
      { key: 'inactive', label: 'Inactive accounts', icon: 'person_off', value: t.inactive_users, sub: 'Not activated or deactivated', route: 'user', warn: t.inactive_users > 0 },
      { key: 'jobs', label: 'Job listings', icon: 'work_outline', value: t.jobs, sub: `${t.jobs_active} active · ${inRange(r.jobs)}`, route: this.isMaster ? 'vacancies' : null },
      { key: 'applications', label: 'Applications', icon: 'assignment_turned_in', value: t.applications, sub: inRange(r.applications), route: this.isMaster ? 'candidates' : null },
      { key: 'cvs', label: 'CVs created', icon: 'description', value: t.cvs, sub: inRange(r.cvs), route: null },
      { key: 'new', label: 'New registrations', icon: 'person_add_alt', value: t.new_registrations, sub: `${d.range.from} to ${d.range.to}`, route: 'user' },
    ];

    this.registrationSeries = [{ name: 'New accounts', color: '#0a66c2', points: d.series.registrations.map((p: any) => ({ label: p.label, value: p.count })) }];
    this.activitySeries = [
      { name: 'Job listings', color: '#0a66c2', points: d.series.jobs.map((p: any) => ({ label: p.label, value: p.count })) },
      { name: 'Applications', color: '#1b8a4b', points: d.series.applications.map((p: any) => ({ label: p.label, value: p.count })) },
    ];
    this.statusSlices = [
      { label: 'Active', value: t.active_users, color: '#1b8a4b' },
      { label: 'Inactive', value: t.inactive_users, color: '#c4cedd' },
    ];
    const palette = ['#0a66c2', '#6aa7e6', '#9db4d1', '#c4cedd'];
    this.applicationSlices = (d.applications_by_status || []).map((a: any, i: number) => ({
      label: this.statusLabel(a.status), value: a.count, color: palette[i % palette.length]
    }));
  }

  /** Shortcut buttons a DEF-ADMIN and a DEF-CLIENT do not get (the DEF-MASTERADMIN list is not filtered). */
  private readonly HIDDEN_SHORTCUTS = ['subscriptionplans', 'featuremanagement', 'planfeatureassignment', 'featuresplan'];

  private buildQuickActions(): QuickAction[] {
    const all = this.isMaster
      ? [
        { label: 'Manage users', icon: 'manage_accounts', route: 'user' },
        { label: 'Subscription plans', icon: 'workspace_premium', route: 'settings', query: { section: 'plan' } },
        { label: 'User plans', icon: 'price_change', route: 'userplan' },
        { label: 'Subscription plans', icon: 'workspace_premium', route: 'subscriptionplans' },
        { label: 'Subscribers', icon: 'monitoring', route: 'usersubscriptionmonitoring' },
        { label: 'Subscription reports', icon: 'insights', route: 'subscriptionreports' },
        { label: 'Database', icon: 'storage', route: 'database' },
        { label: 'Email settings', icon: 'forward_to_inbox', route: 'emailconfig' },
        { label: 'Menus', icon: 'menu_open', route: 'menu' },
        { label: 'Roles', icon: 'admin_panel_settings', route: 'role' },
        { label: 'Security roles', icon: 'security', route: 'security' },
      ]
      : [
        { label: 'Manage users', icon: 'manage_accounts', route: 'user' },
        // subscription management: DEF-ADMIN has the same five modules as DEF-MASTERADMIN
        { label: 'Subscription plans', icon: 'workspace_premium', route: 'subscriptionplans' },
        { label: 'Feature management', icon: 'extension', route: 'featuremanagement' },
        { label: 'Plan feature assignment', icon: 'checklist', route: 'planfeatureassignment' },
        { label: 'Subscribers', icon: 'monitoring', route: 'usersubscriptionmonitoring' },
        { label: 'Subscription reports', icon: 'insights', route: 'subscriptionreports' },
        { label: 'Plan features', icon: 'checklist', route: 'featuresplan' },
        { label: 'Messages', icon: 'chat_bubble_outline', route: 'message' },
        { label: 'My network', icon: 'hub', route: 'network' },
        { label: 'Settings', icon: 'settings', route: 'settings' },
      ];
    const restricted = this.role === 'DEF-ADMIN' || this.role === 'DEF-CLIENT';
    return restricted ? all.filter(a => !this.HIDDEN_SHORTCUTS.includes(a.route)) : all;
  }

  // ------------------------------------------------------------------ helpers used by the template
  get roleTitle(): string { return this.isMaster ? 'Master Admin' : 'Admin'; }

  go(route: string | null, query?: any): void {
    if (!route) { return; }
    this.router.navigate(['/' + this.role, route], query ? { queryParams: query } : {});
  }

  openProfile(code: any, role: string | null): void {
    if (!code) { return; }
    this.router.navigate(['/' + this.role, role === 'DEF-USERS' ? 'profile' : 'client_profile', code]);
  }

  roleLabel(role: string | null): string {
    const map: Record<string, string> = {
      'DEF-USERS': 'Users', 'DEF-CLIENT': 'Clients / recruiters', 'DEF-ADMIN': 'Admins',
      'DEF-MASTERADMIN': 'Master admins', 'DEF-SUPERADMIN': 'Super admins'
    };
    return (role && map[role]) || 'Other';
  }

  accountType(role: string | null): string {
    const map: Record<string, string> = {
      'DEF-USERS': 'User', 'DEF-CLIENT': 'Recruiter / Client', 'DEF-ADMIN': 'Admin', 'DEF-MASTERADMIN': 'Master Admin'
    };
    return (role && map[role]) || 'Account';
  }

  statusLabel(s: string): string {
    const t = String(s || 'unknown').replace(/[_-]+/g, ' ').trim();
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  initials(name: string): string { return this.shared.getInitials(name || ''); }

  barWidth(value: number, max: number): number { return max ? Math.max(4, Math.round((value / max) * 100)) : 0; }

  maxOf(list: any[], key: string): number { return list.reduce((m, x) => Math.max(m, x[key] || 0), 0); }

  activityIcon(type: string): string {
    return ({ registration: 'person_add', job: 'work_outline', application: 'assignment_turned_in', subscription: 'workspace_premium' } as any)[type] || 'bolt';
  }

  broken: Record<string, boolean> = {};
  trackIdx(i: number): number { return i; }
}
