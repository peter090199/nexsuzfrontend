import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  icon?: string;
  danger?: boolean;
}

/** Reusable Material confirmation dialog. Closes with `true` when confirmed. */
@Component({
  selector: 'app-settings-confirm-dialog',
  template: `
    <div class="cd-head" [class.danger]="data.danger">
      <mat-icon>{{ data.icon || 'help_outline' }}</mat-icon>
      <h2 mat-dialog-title>{{ data.title }}</h2>
    </div>
    <mat-dialog-content><p>{{ data.message }}</p></mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-stroked-button [mat-dialog-close]="false">{{ data.cancelText || 'Cancel' }}</button>
      <button mat-flat-button [color]="data.danger ? 'warn' : 'primary'" [mat-dialog-close]="true" cdkFocusInitial>
        {{ data.confirmText || 'Confirm' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    :host { font-family: Verdana, Geneva, Tahoma, sans-serif; display:block; }
    .cd-head { display:flex; align-items:center; gap:10px; color:#004182; }
    .cd-head.danger { color:#c62828; }
    .cd-head h2 { margin:0; font-size:17px; font-family:inherit; }
    p { margin:0; text-align:left; font-size:13px; color:#413f3f; line-height:1.6; }
  `]
})
export class SettingsConfirmDialogComponent {
  constructor(@Inject(MAT_DIALOG_DATA) public data: ConfirmDialogData) {}
}
