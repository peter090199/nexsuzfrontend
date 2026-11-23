import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PageEvent } from '@angular/material/paginator';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { SubscriberDialogComponent, SubscriberMode } from '../dialogs/subscriber-dialog.component';
import { SubPlan, Subscriber, SubscriberPage, SubscriptionApiService } from '../shared/subscription-api.service';

@Component({
  selector: 'app-user-subscription-monitoring',
  templateUrl: './user-subscription-monitoring.component.html',
  styleUrls: ['./user-subscription-monitoring.component.scss']
})
export class UserSubscriptionMonitoringComponent implements OnInit, OnDestroy {
  rows: Subscriber[] = [];
  plans: SubPlan[] = [];
  counts = { all: 0, active: 0, expired: 0, suspended: 0, expiring_soon: 0 };
  total = 0;
  loading = true;
  error = '';

  search = '';
  planFilter = '';
  statusFilter = '';
  pageIndex = 0;
  pageSize = 8;

  private search$ = new Subject<string>();
  private sub = new Subscription();

  constructor(private api: SubscriptionApiService, private dialog: MatDialog, private snack: MatSnackBar) { }

  ngOnInit(): void {
    this.api.plans().subscribe(p => this.plans = p);
    this.sub.add(this.search$.pipe(debounceTime(300), distinctUntilChanged()).subscribe(() => { this.pageIndex = 0; this.load(); }));
    this.load();
  }
  ngOnDestroy(): void { this.sub.unsubscribe(); }

  load(): void {
    this.loading = true; this.error = '';
    this.api.subscribers({
      search: this.search.trim(), plan_id: this.planFilter, status: this.statusFilter,
      page: this.pageIndex + 1, per_page: this.pageSize,
    }).subscribe({
      next: (r: SubscriberPage) => { this.rows = r.data; this.total = r.meta.total; this.counts = r.counts; this.loading = false; },
      error: err => { this.loading = false; this.error = SubscriptionApiService.errorMessage(err, 'Could not load subscribers.'); },
    });
  }

  onSearch(): void { this.search$.next(this.search.trim()); }
  filterChanged(): void { this.pageIndex = 0; this.load(); }
  onPage(e: PageEvent): void { this.pageIndex = e.pageIndex; this.pageSize = e.pageSize; this.load(); }
  clear(): void { this.search = ''; this.planFilter = ''; this.statusFilter = ''; this.pageIndex = 0; this.load(); }

  initials(name: string): string { return (name || '?').split(' ').map(x => x[0]).slice(0, 2).join(''); }
  pillClass(s: Subscriber): string {
    return s.status === 'active' ? 'ok' : s.status === 'suspended' || s.status === 'pending' ? 'warn' : s.status === 'none' ? 'muted' : 'bad';
  }

  act(s: Subscriber, mode: SubscriberMode): void {
    this.dialog.open(SubscriberDialogComponent, {
      width: '460px', maxWidth: '95vw',
      data: { code: s.code, name: s.name, mode, plans: this.plans, planId: s.plan_id },
    }).afterClosed().subscribe(res => {
      if (res) {
        if (typeof res === 'string') { this.snack.open(res, 'OK', { duration: 2500 }); }
        this.load();
      }
    });
  }
}
