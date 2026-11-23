import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PageEvent } from '@angular/material/paginator';
import { FeatureDialogComponent } from '../dialogs/feature-dialog.component';
import { SubFeature, SubscriptionApiService } from '../shared/subscription-api.service';

@Component({
  selector: 'app-feature-management',
  templateUrl: './feature-management.component.html',
  styleUrls: ['./feature-management.component.scss']
})
export class FeatureManagementComponent implements OnInit {
  all: SubFeature[] = [];
  categories: string[] = [];
  loading = true;
  error = '';
  busyId = 0;
  search = '';
  category = 'all';
  status = 'all';
  pageIndex = 0;
  pageSize = 6;

  constructor(private api: SubscriptionApiService, private dialog: MatDialog, private snack: MatSnackBar) { }

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true; this.error = '';
    this.api.features().subscribe({
      next: r => { this.all = r.data; this.categories = r.categories; this.loading = false; },
      error: err => { this.loading = false; this.error = SubscriptionApiService.errorMessage(err, 'Could not load features.'); },
    });
  }

  get filtered(): SubFeature[] {
    const q = this.search.trim().toLowerCase();
    return this.all.filter(f =>
      (this.category === 'all' || f.category === this.category) &&
      (this.status === 'all' || (this.status === 'active') === f.active) &&
      (!q || f.name.toLowerCase().includes(q) || f.key.toLowerCase().includes(q)));
  }
  get paged(): SubFeature[] {
    const start = this.pageIndex * this.pageSize;
    return this.filtered.slice(start, start + this.pageSize);
  }
  get categoryCount(): number { return new Set(this.all.map(f => f.category)).size; }
  get activeCount(): number { return this.all.filter(f => f.active).length; }

  filterChanged(): void { this.pageIndex = 0; }
  onPage(e: PageEvent): void { this.pageIndex = e.pageIndex; this.pageSize = e.pageSize; }

  open(feature?: SubFeature): void {
    this.dialog.open(FeatureDialogComponent, { width: '480px', maxWidth: '95vw', data: { feature, categories: this.categories } })
      .afterClosed().subscribe(ok => { if (ok) { this.snack.open('Feature saved', 'OK', { duration: 2500 }); this.load(); } });
  }

  toggle(f: SubFeature): void {
    this.busyId = f.id;
    this.api.toggleFeature(f.id).subscribe({
      next: r => { this.busyId = 0; this.snack.open(r.message, 'OK', { duration: 2500 }); this.load(); },
      error: err => { this.busyId = 0; this.snack.open(SubscriptionApiService.errorMessage(err), 'OK', { duration: 4000 }); },
    });
  }
}
