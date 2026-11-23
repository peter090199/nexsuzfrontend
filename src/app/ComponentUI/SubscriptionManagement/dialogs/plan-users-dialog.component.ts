import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { PageEvent } from '@angular/material/paginator';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { SubPlan, Subscriber, SubscriptionApiService } from '../shared/subscription-api.service';

/** Active users on one plan, with search and paging. data = { plan: SubPlan } */
@Component({
  selector: 'app-plan-users-dialog',
  template: `
    <button mat-icon-button type="button" class="close-button" aria-label="Close" [mat-dialog-close]="false">
      <mat-icon>close</mat-icon>
    </button>
    <h2 mat-dialog-title>Active users — {{ data.plan.plan_name }}</h2>
    <mat-dialog-content>
      <mat-form-field appearance="outline" class="w-100" floatLabel="never">
        <mat-icon matPrefix>search</mat-icon>
        <input matInput [(ngModel)]="search" (ngModelChange)="search$.next($event)" placeholder="Search name or email">
        <button mat-icon-button matSuffix *ngIf="search" (click)="search = ''; search$.next('')" aria-label="Clear search"><mat-icon>close</mat-icon></button>
      </mat-form-field>

      <mat-progress-bar *ngIf="loading" mode="indeterminate"></mat-progress-bar>
      <p class="err" *ngIf="error" role="alert">{{ error }} <button mat-button (click)="load()">Retry</button></p>

      <ul class="users" *ngIf="!error">
        <li *ngFor="let u of rows">
          <div class="av">{{ initials(u.name) }}</div>
          <div class="who">
            <strong>{{ u.name }}</strong>
            <small>{{ u.email }}</small>
          </div>
          <div class="when">
            <span>Expires {{ u.end | date:'mediumDate' }}</span>
            <small *ngIf="u.days_left !== null" [class.soon]="u.days_left <= 14">{{ u.days_left }} days left</small>
          </div>
        </li>
        <li class="none" *ngIf="!loading && !rows.length">No active users on this plan{{ search ? ' match your search' : '' }}.</li>
      </ul>
    </mat-dialog-content>
    <mat-paginator [length]="total" [pageSize]="pageSize" [pageIndex]="pageIndex" [pageSizeOptions]="[5, 10, 25]"
      (page)="onPage($event)" hidePageSize="false"></mat-paginator>
    <mat-dialog-actions align="end">
      <span class="count">{{ total }} active {{ total === 1 ? 'user' : 'users' }}</span>
      <button mat-stroked-button type="button" [mat-dialog-close]="false">Close</button>
    </mat-dialog-actions>`,
  styles: [`
    .w-100 { width: 100%; }
    .users { list-style: none; margin: 0; padding: 0; }
    .users li { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid #eef2f8; }
    .av { width: 36px; height: 36px; border-radius: 50%; background: #eaf3fc; color: #004182; display: grid; place-items: center; font-weight: 700; font-size: 12px; flex: none; }
    .who { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .who strong, .who small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    small { color: #6b7a99; font-size: 12px; }
    .when { text-align: right; font-size: 12px; display: flex; flex-direction: column; flex: none; }
    .when .soon { color: #e08a00; font-weight: 600; }
    .none { justify-content: center; color: #6b7a99; padding: 24px 0 !important; border: none !important; }
    .err { color: #c62828; font-size: 13px; }
    .count { margin-right: auto; color: #6b7a99; font-size: 12px; }
    @media (max-width: 480px) { .users li { flex-wrap: wrap; } .when { text-align: left; width: 100%; padding-left: 48px; } }
  `]
})
export class PlanUsersDialogComponent implements OnInit, OnDestroy {
  rows: Subscriber[] = [];
  total = 0;
  loading = true;
  error = '';
  search = '';
  pageIndex = 0;
  pageSize = 10;
  search$ = new Subject<string>();
  private sub = new Subscription();

  constructor(private api: SubscriptionApiService, @Inject(MAT_DIALOG_DATA) public data: { plan: SubPlan }) { }

  ngOnInit(): void {
    this.sub.add(this.search$.pipe(debounceTime(300), distinctUntilChanged()).subscribe(() => { this.pageIndex = 0; this.load(); }));
    this.load();
  }
  ngOnDestroy(): void { this.sub.unsubscribe(); }

  load(): void {
    this.loading = true; this.error = '';
    this.api.subscribers({
      plan_id: this.data.plan.planId, status: 'active', search: this.search.trim(),
      page: this.pageIndex + 1, per_page: this.pageSize,
    }).subscribe({
      next: r => { this.rows = r.data; this.total = r.meta.total; this.loading = false; },
      error: err => { this.loading = false; this.error = SubscriptionApiService.errorMessage(err, 'Could not load users.'); },
    });
  }

  onPage(e: PageEvent): void { this.pageIndex = e.pageIndex; this.pageSize = e.pageSize; this.load(); }
  initials(name: string): string { return (name || '?').split(' ').map(x => x[0]).slice(0, 2).join(''); }
}
