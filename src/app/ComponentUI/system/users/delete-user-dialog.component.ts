import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { UserServicesService } from 'src/app/services/MasterAdmin/user-services.service';

interface Step { group: string; label: string; table: string; rows: number; }
interface Preview {
  user: { code: number; fullname: string; email: string; role_code: string };
  can_delete: boolean; reason: string | null;
  rows_removed?: number; rows_anonymized?: number; steps?: Step[]; others_applications?: number; jobs?: number; files?: number;
}

/**
 * Delete one account and everything it created. Shows exactly what goes, then needs the account's email typed back and the
 * admin's password. The server makes a safety backup first and re-checks every rule itself.
 */
@Component({
  selector: 'app-delete-user-dialog',
  template: `
    <button mat-icon-button type="button" class="close-button" aria-label="Close" [mat-dialog-close]="!!done" [disabled]="working">
      <mat-icon>close</mat-icon>
    </button>
    <h2 mat-dialog-title class="danger-title"><mat-icon>delete_forever</mat-icon> {{ done ? 'Account deleted' : 'Delete this account?' }}</h2>

    <mat-dialog-content>
      <mat-progress-bar *ngIf="loading || working" mode="indeterminate" color="warn"></mat-progress-bar>
      <p class="err" *ngIf="error" role="alert">{{ error }}</p>

      <!-- DONE -->
      <ng-container *ngIf="done as d">
        <p class="ok-msg"><mat-icon>check_circle</mat-icon> {{ d.message }}</p>
        <ul class="facts">
          <li><b>{{ d.data.rows | number }}</b> records removed</li>
          <li>Uploaded files are being removed from storage.</li>
          <li>Safety backup: <code>{{ d.backup.name }}</code> <small *ngIf="d.backup.reused">(made a few minutes ago)</small></li>
        </ul>
        <p class="hint">The backup is the only way to get this data back.</p>
      </ng-container>

      <!-- CONFIRM -->
      <ng-container *ngIf="!done && preview as p">
        <div class="who">
          <strong>{{ p.user.fullname }}</strong>
          <span>{{ p.user.email }}</span>
          <span class="pill">{{ p.user.role_code === 'DEF-CLIENT' ? 'Company / recruiter' : 'Individual' }}</span>
        </div>

        <div class="state warn" *ngIf="!p.can_delete" role="alert"><mat-icon>lock</mat-icon> {{ p.reason }}</div>

        <ng-container *ngIf="p.can_delete">
          <p class="lead">This <b>permanently deletes</b> the account and <b>{{ p.rows_removed | number }}</b> related record{{ p.rows_removed === 1 ? '' : 's' }}. It cannot be undone.</p>

          <section class="box gone">
            <h3>Will be deleted</h3>
            <ul class="groups"><li *ngFor="let g of groups()"><span>{{ g.name }}</span><b>{{ g.rows | number }}</b></li></ul>
          </section>

          <div class="state warn" *ngIf="p.others_applications" role="alert">
            <mat-icon>warning_amber</mat-icon>
            <span>This account posted {{ p.jobs }} job{{ p.jobs === 1 ? '' : 's' }}. <b>{{ p.others_applications }} application{{ p.others_applications === 1 ? '' : 's' }}
              made by other people</b> to those jobs will be deleted too.</span>
          </div>

          <p class="hint">Their uploaded files (CVs, photos, post and comment attachments) are removed from storage too, and cannot be restored from the database backup.
            <ng-container *ngIf="p.rows_anonymized">{{ p.rows_anonymized }} subscription record{{ p.rows_anonymized === 1 ? ' is' : 's are' }} kept for financial records, with the person's identity removed.</ng-container></p>

          <div class="confirm">
            <p class="hint">A backup of the database is made first. If it fails, nothing is deleted.</p>
            <mat-form-field appearance="outline" class="w-100">
              <mat-label>Type DELETE to delete {{ p.user.fullname }} ({{ p.user.email }})</mat-label>
              <input matInput [(ngModel)]="typed" autocomplete="off" spellcheck="false" autocapitalize="off" [disabled]="working">
            </mat-form-field>
            <mat-form-field appearance="outline" class="w-100">
              <mat-label>Your password</mat-label>
              <input matInput type="password" [(ngModel)]="password" autocomplete="current-password" [disabled]="working" (keyup.enter)="canDelete && remove()">
            </mat-form-field>
          </div>
        </ng-container>
      </ng-container>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-stroked-button type="button" [mat-dialog-close]="!!done" [disabled]="working">{{ done ? 'Close' : 'Cancel' }}</button>
      <button mat-flat-button color="warn" type="button" *ngIf="!done && preview?.can_delete" (click)="remove()" [disabled]="!canDelete">
        <mat-icon>delete_forever</mat-icon> {{ working ? 'Deleting…' : 'Delete account and data' }}
      </button>
    </mat-dialog-actions>`,
  styles: [`
    .w-100 { width: 100%; }
    .danger-title { display: flex; align-items: center; gap: 8px; color: #b42318; }
    .who { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; margin: 8px 0 4px; }
    .who span:not(.pill) { color: #6b7a99; font-size: 13px; word-break: break-all; }
    .pill { font-size: 11px; padding: 1px 9px; border-radius: 99px; background: #eaf3fc; color: #004182; }
    .lead { font-size: 14px; margin: 10px 0; }
    .box { border-radius: 12px; padding: 12px 14px; margin-bottom: 12px; border: 1px solid #e3e9f3; }
    .box.gone { background: #fff6f5; border-color: #f4c7c3; } .box h3 { margin: 0 0 8px; font-size: 13px; color: #b42318; }
    .groups, .facts { list-style: none; margin: 0; padding: 0; font-size: 13px; }
    .groups li { display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px dashed #f1d4d1; } .groups li:last-child { border: 0; }
    .facts li { padding: 3px 0; }
    .hint { font-size: 12px; color: #6b7a99; margin: 6px 0; }
    .confirm { margin-top: 12px; }
    .err { color: #c62828; font-size: 13px; }
    .ok-msg { display: flex; align-items: center; gap: 6px; color: #1b6a3d; font-weight: 600; }
    .state.warn { display: flex; gap: 8px; align-items: flex-start; background: #fff4e0; color: #8a5300; border: 1px solid #f4d9a8; border-radius: 10px; padding: 10px 12px; font-size: 13px; margin: 10px 0; }
    code { background: #f1f5fb; padding: 1px 6px; border-radius: 6px; font-size: 12px; word-break: break-all; }
    mat-dialog-content { max-height: 70vh; }
  `]
})
export class DeleteUserDialogComponent implements OnInit {
  preview?: Preview;
  done?: { message: string; backup: { name: string; reused?: boolean }; data: { rows: number; files: number } };
  loading = true;
  working = false;
  error = '';
  typed = '';
  password = '';

  constructor(private users: UserServicesService, private ref: MatDialogRef<DeleteUserDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { user: { code: number | string; fullname: string } }) { }

  ngOnInit(): void {
    this.users.deleteUserPreview(this.data.user.code).subscribe({
      next: r => { this.preview = r.data; this.loading = false; },
      error: e => { this.loading = false; this.error = this.messageOf(e, 'Could not load what would be deleted.'); },
    });
  }

  private messageOf(e: any, fallback: string): string {
    if (e?.status === 429) { return 'Too many attempts. Please wait a few minutes and try again.'; }
    const errs = e?.error?.errors;
    if (errs) { const first = Object.values(errs)[0] as string[]; if (first?.length) { return first[0]; } }
    return e?.error?.message || fallback;
  }

  /** Rows per group (Posts & feed, Jobs & applications ...), empty groups hidden. */
  groups(): { name: string; rows: number }[] {
    const m = new Map<string, number>();
    (this.preview?.steps || []).forEach(s => m.set(s.group, (m.get(s.group) || 0) + s.rows));
    return Array.from(m.entries()).map(([name, rows]) => ({ name, rows })).filter(g => g.rows > 0);
  }

  /** DELETE has to be typed exactly and a password given. */
  get canDelete(): boolean {
    return !!this.preview && this.preview.can_delete && !this.working && !this.done
      && this.typed.trim() === 'DELETE' && this.password.length > 0;
  }

  remove(): void {
    if (!this.canDelete) { return; }
    this.working = true; this.error = '';
    this.users.deleteUser(this.data.user.code, { password: this.password, confirm: this.typed.trim() }).subscribe({
      next: r => { this.working = false; this.done = r; this.password = ''; this.typed = ''; },
      error: e => { this.working = false; this.error = this.messageOf(e, 'The account could not be deleted.'); },
    });
  }
}
