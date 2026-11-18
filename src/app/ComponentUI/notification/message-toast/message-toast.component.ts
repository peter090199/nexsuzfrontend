import { Component, Inject } from '@angular/core';
import { MAT_SNACK_BAR_DATA, MatSnackBarRef } from '@angular/material/snack-bar';
import { MessageNotice } from '../../../services/notification-delivery.service';

export interface MessageToastData {
  notice: MessageNotice;
  /** the text to show: the message preview, or "Sent you a message" when previews are off */
  body: string;
  open: () => void;
}

/** The in-app popup for a new message: sender photo + name, preview, time. Click to open the conversation. */
@Component({
  selector: 'app-message-toast',
  template: `
    <div class="mt" role="status">
      <button type="button" class="mt-main" (click)="open()" [attr.aria-label]="'Open conversation with ' + data.notice.name">
        <img class="mt-av" [src]="data.notice.photo || 'assets/images/default.png'" nxFallback alt="" />
        <span class="mt-text">
          <span class="mt-top"><strong>{{ data.notice.name }}</strong><time>{{ data.notice.time | date:'shortTime' }}</time></span>
          <span class="mt-body">{{ data.body }}</span>
        </span>
      </button>
      <button type="button" class="mt-x" (click)="close()" aria-label="Dismiss"><mat-icon>close</mat-icon></button>
    </div>
  `,
  styles: [`
    :host { display: block; font-family: Verdana, Geneva, Tahoma, sans-serif; }
    .mt { display: flex; align-items: stretch; gap: 4px; min-width: 260px; max-width: 340px; }
    .mt-main { flex: 1; min-width: 0; display: flex; align-items: center; gap: 12px; padding: 0; border: 0; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
    .mt-av { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; flex: none; background: #eaf3fc; }
    .mt-text { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .mt-top { display: flex; justify-content: space-between; gap: 8px; align-items: baseline; }
    .mt-top strong { font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .mt-top time { font-size: 10px; opacity: .7; flex: none; }
    .mt-body { font-size: 12.5px; opacity: .92; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; }
    .mt-x { flex: none; align-self: flex-start; width: 28px; height: 28px; padding: 0; border: 0; border-radius: 50%; background: transparent; color: inherit; opacity: .7; cursor: pointer; display: flex; align-items: center; justify-content: center; }
    .mt-x:hover { opacity: 1; background: rgba(255, 255, 255, .15); }
    .mt-x mat-icon { font-size: 18px; width: 18px; height: 18px; overflow: hidden; }
  `]
})
export class MessageToastComponent {
  constructor(
    @Inject(MAT_SNACK_BAR_DATA) public data: MessageToastData,
    private ref: MatSnackBarRef<MessageToastComponent>
  ) {}

  open(): void { this.data.open(); this.ref.dismiss(); }
  close(): void { this.ref.dismiss(); }
}
