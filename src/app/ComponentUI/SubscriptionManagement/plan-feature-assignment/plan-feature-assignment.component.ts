import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatSelect } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { forkJoin } from 'rxjs';
import { Cell, SubFeature, SubPlan, SubscriptionApiService } from '../shared/subscription-api.service';

type CellMap = { [featureId: number]: Cell };

@Component({
  selector: 'app-plan-feature-assignment',
  templateUrl: './plan-feature-assignment.component.html',
  styleUrls: ['./plan-feature-assignment.component.scss']
})
export class PlanFeatureAssignmentComponent implements OnInit {
  plans: SubPlan[] = [];
  features: SubFeature[] = [];
  overview: { [planId: string]: Cell[] } = {};
  planId = '';
  saved: CellMap = {};
  draft: CellMap = {};
  loading = true;
  saving = false;
  error = '';
  search = '';

  constructor(private api: SubscriptionApiService, private snack: MatSnackBar, private route: ActivatedRoute) { }

  ngOnInit(): void {
    forkJoin({ plans: this.api.plans(), feats: this.api.features(), overview: this.api.assignmentsOverview() }).subscribe({
      next: r => {
        this.plans = r.plans; this.features = r.feats.data; this.overview = r.overview;
        // ?plan=PLN000002 (from the Settings plan page) opens that plan directly
        const wanted = this.route.snapshot.queryParamMap.get('plan');
        this.planId = this.plans.find(p => p.planId === wanted)?.planId || this.plans[0]?.planId || '';
        this.loadPlan();
      },
      error: err => { this.loading = false; this.error = SubscriptionApiService.errorMessage(err, 'Could not load assignments.'); },
    });
  }

  get plan(): SubPlan | undefined { return this.plans.find(p => p.planId === this.planId); }
  get visible(): SubFeature[] {
    const q = this.search.trim().toLowerCase();
    return this.features.filter(f => !q || f.name.toLowerCase().includes(q) || f.category.toLowerCase().includes(q));
  }

  private toMap(cells: Cell[]): CellMap {
    const m: CellMap = {};
    cells.forEach(c => m[c.feature_id] = { ...c });
    return m;
  }

  loadPlan(): void {
    if (!this.planId) { this.loading = false; return; }
    this.loading = true; this.error = '';
    this.api.assignments(this.planId).subscribe({
      next: cells => { this.saved = this.toMap(cells); this.draft = this.toMap(cells); this.loading = false; },
      error: err => { this.loading = false; this.error = SubscriptionApiService.errorMessage(err, 'Could not load this plan.'); },
    });
  }

  /** A feature created after the page loaded may have no cell yet. */
  row(f: SubFeature): Cell {
    return this.draft[f.id] || (this.draft[f.id] = { feature_id: f.id, feature_code: f.key, enabled: false, limit: null, unlimited: false });
  }

  get dirty(): boolean {
    return this.features.some(f => {
      const a = this.saved[f.id] || { enabled: false, limit: null, unlimited: false };
      const b = this.draft[f.id] || { enabled: false, limit: null, unlimited: false };
      return a.enabled !== b.enabled || a.unlimited !== b.unlimited || (a.limit ?? null) !== (b.limit ?? null);
    });
  }
  get enabledDraft(): number { return this.features.filter(f => this.draft[f.id]?.enabled).length; }

  /** mat-select handler: asks before discarding edits and reverts the select if the user declines. */
  onSelect(id: string, select: MatSelect): void {
    if (id === this.planId) { return; }
    if (this.dirty && !confirm('Discard unsaved changes to this plan?')) {
      select.value = this.planId;
      return;
    }
    this.planId = id;
    this.loadPlan();
  }

  setEnabled(f: SubFeature, on: boolean): void {
    const r = this.row(f); r.enabled = on;
    if (!on) { r.unlimited = false; }
  }
  setUnlimited(f: SubFeature, on: boolean): void {
    const r = this.row(f); r.unlimited = on;
    if (on) { r.limit = null; }
  }
  setLimit(f: SubFeature, v: string): void {
    this.row(f).limit = v === '' ? null : Math.max(0, Math.floor(+v));
  }
  enableAll(on: boolean): void { this.visible.filter(f => f.active).forEach(f => this.setEnabled(f, on)); }

  save(): void {
    this.saving = true;
    const items = this.features.map(f => {
      const r = this.row(f);
      return { feature_id: f.id, enabled: r.enabled, limit: r.limit, unlimited: r.unlimited };
    });
    this.api.saveAssignments(this.planId, items).subscribe({
      next: r => {
        this.saving = false;
        this.snack.open(r.message || 'Saved', 'OK', { duration: 2500 });
        this.loadPlan();
        this.api.assignmentsOverview().subscribe(o => this.overview = o);
      },
      error: err => { this.saving = false; this.snack.open(SubscriptionApiService.errorMessage(err), 'OK', { duration: 4000 }); },
    });
  }
  cancel(): void { this.draft = this.toMap(Object.values(this.saved)); }

  isEnabled(planId: string, f: SubFeature): boolean {
    return !!(this.overview[planId] || []).find(c => c.feature_id === f.id)?.enabled;
  }
}
