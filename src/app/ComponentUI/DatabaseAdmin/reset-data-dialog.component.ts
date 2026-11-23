import { Component, OnInit } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { DatabaseAdminService, ResetPreview, ResetResult, ResetStep } from './database-admin.service';

/**
 * "Reset all data". Shows exactly what will be removed and kept, then needs the typed phrase and the admin's password.
 * The server makes a safety backup before it deletes anything and re-checks every condition itself.
 */
@Component({
  selector: 'app-reset-data-dialog',
  template: `
    <button mat-icon-button type="button" class="close-button" aria-label="Close" [mat-dialog-close]="!!result" [disabled]="working">
      <mat-icon>close</mat-icon>
    </button>
    <h2 mat-dialog-title class="danger-title"><mat-icon>warning</mat-icon> {{ result ? 'Reset complete' : 'Reset all data' }}</h2>

    <mat-dialog-content>
      <mat-progress-bar *ngIf="loading || working" mode="indeterminate" color="warn"></mat-progress-bar>
      <p class="err" *ngIf="error" role="alert">{{ error }}</p>

      <!-- DONE -->
      <ng-container *ngIf="result as r">
        <p class="ok-msg"><mat-icon>check_circle</mat-icon> {{ r.message }}</p>
        <ul class="facts">
          <li><b>{{ r.data.rows | number }}</b> rows removed</li>
          <li *ngIf="r.data.files"><b>{{ r.data.files }}</b> upload folders removed</li>
          <li>Safety backup: <code>{{ r.backup.name }}</code></li>
        </ul>
        <p class="hint">Keep the backup somewhere safe. It is the only way to get the removed data back.</p>
        <button mat-stroked-button type="button" (click)="downloadBackup(r.backup.name)"><mat-icon>download</mat-icon> Download backup</button>
      </ng-container>

      <!-- CONFIRM -->
      <ng-container *ngIf="!result && preview as p">
        <div class="state warn" *ngIf="!p.allowed" role="alert">
          <mat-icon>lock</mat-icon>
          Resetting is switched off on this server. To enable it, set <code>DB_ADMIN_ALLOW_RESET=true</code> in the backend settings.
        </div>

        <p class="lead">This permanently deletes <b>{{ p.accounts_removed }}</b> account{{ p.accounts_removed === 1 ? '' : 's' }}
          and <b>{{ p.rows_removed | number }}</b> rows of data they created.</p>

        <section class="box keep">
          <h3><mat-icon>verified_user</mat-icon> Kept: {{ p.protected.length }} admin accounts and all their data</h3>
          <ul class="people">
            <li *ngFor="let u of p.protected"><span>{{ u.fullname }}</span> <small>{{ u.email }}</small>
              <span class="pill info">{{ u.role_code === 'DEF-MASTERADMIN' ? 'Master admin' : 'Admin' }}</span></li>
          </ul>
          <p class="hint">Plans, features, menus, roles, counters and other settings ({{ p.kept_tables.length }} tables) are not touched.</p>
        </section>

        <section class="box gone">
          <h3><mat-icon>delete_forever</mat-icon> Will be deleted</h3>
          <ul class="groups">
            <li *ngFor="let g of groups()"><span>{{ g.name }}</span><b>{{ g.rows | number }}</b></li>
          </ul>
        </section>

        <mat-checkbox [(ngModel)]="deleteFiles" [disabled]="working || !p.files">
          Also delete uploaded files of these accounts ({{ p.files }} folder{{ p.files === 1 ? '' : 's' }}). Files are not in the database backup.
        </mat-checkbox>

        <div class="confirm">
          <p class="hint">A backup of the whole database is created automatically first. If it fails, nothing is deleted.</p>
          <mat-form-field appearance="outline" class="w-100">
            <mat-label>Type {{ p.phrase }} to confirm</mat-label>
            <input matInput [(ngModel)]="phrase" autocomplete="off" spellcheck="false" [disabled]="working || !p.allowed">
          </mat-form-field>
          <mat-form-field appearance="outline" class="w-100">
            <mat-label>Your password</mat-label>
            <input matInput type="password" [(ngModel)]="password" autocomplete="current-password" [disabled]="working || !p.allowed" (keyup.enter)="canReset && reset()">
          </mat-form-field>
        </div>
      </ng-container>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-stroked-button type="button" [mat-dialog-close]="!!result" [disabled]="working">{{ result ? 'Close' : 'Cancel' }}</button>
      <button mat-flat-button color="warn" type="button" *ngIf="!result" (click)="reset()" [disabled]="!canReset">
        <mat-icon>delete_forever</mat-icon> {{ working ? 'Resetting…' : 'Reset all data' }}
      </button>
    </mat-dialog-actions>`,
  styles: [`
    .w-100 { width: 100%; }
    .danger-title { display: flex; align-items: center; gap: 8px; color: #b42318; }
    .lead { font-size: 14px; margin: 12px 0; }
    .box { border-radius: 12px; padding: 12px 14px; margin-bottom: 12px; border: 1px solid #e3e9f3; }
    .box h3 { display: flex; align-items: center; gap: 6px; margin: 0 0 8px; font-size: 13px; }
    .box.keep { background: #f1faf5; border-color: #bfe3cd; } .box.keep h3 { color: #1b6a3d; }
    .box.gone { background: #fff6f5; border-color: #f4c7c3; } .box.gone h3 { color: #b42318; }
    .people, .groups, .facts { list-style: none; margin: 0; padding: 0; font-size: 13px; }
    .people li { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 3px 0; } .people small { color: #6b7a99; }
    .groups li { display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px dashed #f1d4d1; } .groups li:last-child { border: 0; }
    .pill { font-size: 11px; padding: 1px 8px; border-radius: 99px; background: #eaf3fc; color: #004182; }
    .hint { font-size: 12px; color: #6b7a99; margin: 6px 0; }
    .confirm { margin-top: 12px; }
    .err { color: #c62828; font-size: 13px; } .ok-msg { display: flex; align-items: center; gap: 6px; color: #1b6a3d; font-weight: 600; }
    .state.warn { display: flex; gap: 8px; align-items: flex-start; background: #fff4e0; color: #8a5300; border: 1px solid #f4d9a8; border-radius: 10px; padding: 10px 12px; font-size: 13px; }
    code { background: #f1f5fb; padding: 1px 6px; border-radius: 6px; font-size: 12px; word-break: break-all; }
    .facts li { padding: 3px 0; }
    mat-dialog-content { max-height: 70vh; }
  `]
})
export class ResetDataDialogComponent implements OnInit {
  preview?: ResetPreview;
  result?: ResetResult;
  loading = true;
  working = false;
  error = '';
  phrase = '';
  password = '';
  deleteFiles = false;

  constructor(private api: DatabaseAdminService, private ref: MatDialogRef<ResetDataDialogComponent>) { }

  ngOnInit(): void {
    this.api.resetPreview().subscribe({
      next: p => { this.preview = p; this.loading = false; },
      error: e => { this.loading = false; this.error = DatabaseAdminService.errorMessage(e, 'Could not load what would be reset.'); },
    });
  }

  /** Rows per group (Posts & feed, Jobs & applications ...), empty groups hidden. */
  groups(): { name: string; rows: number }[] {
    const m = new Map<string, number>();
    (this.preview?.steps || []).forEach((s: ResetStep) => m.set(s.group, (m.get(s.group) || 0) + s.rows));
    return Array.from(m.entries()).map(([name, rows]) => ({ name, rows })).filter(g => g.rows > 0);
  }

  get canReset(): boolean {
    return !!this.preview && this.preview.allowed && !this.working && !this.result
      && this.phrase.trim() === this.preview.phrase && this.password.length > 0;
  }

  reset(): void {
    if (!this.canReset) { return; }
    this.working = true; this.error = '';
    this.api.resetAll({ password: this.password, confirm: this.phrase.trim(), delete_files: this.deleteFiles }).subscribe({
      next: r => { this.working = false; this.result = r; this.password = ''; this.phrase = ''; },
      error: e => { this.working = false; this.error = DatabaseAdminService.errorMessage(e, 'The reset failed.'); },
    });
  }

  downloadBackup(name: string): void {
    this.api.downloadBackup(name).subscribe(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = name; a.click();
      URL.revokeObjectURL(url);
    });
  }
}
