import { Component, EventEmitter, Input, Output } from '@angular/core';
import { BlockService } from 'src/app/services/block.service';

/**
 * <app-block-button [code]="person.code" [name]="person.fullname" (blocked)="..."></app-block-button>
 *
 * The same Block action everywhere (profiles, search results, suggestions). It asks for confirmation, calls the API
 * through BlockService, shows the notification, then emits (blocked) so the screen can update at once.
 * It renders nothing for your own account.
 */
@Component({
  selector: 'app-block-button',
  templateUrl: './block-button.component.html',
  styleUrls: ['./block-button.component.css']
})
export class BlockButtonComponent {
  @Input() code!: number | string;
  @Input() name = 'this account';
  /** the other account's type (role_code), when the screen knows it: lets the button hide itself where blocking isn't allowed */
  @Input() role?: string | null;
  /** icon = small icon button (lists), button = labelled button (profile pages) */
  @Input() variant: 'icon' | 'button' = 'icon';
  @Output() blocked = new EventEmitter<number | string>();

  busy = false;

  constructor(private blocks: BlockService) { }

  get visible(): boolean {
    return this.code != null && this.code !== '' && !this.blocks.isSelf(this.code) && this.blocks.canBlock(this.role);
  }

  async onClick(event: Event): Promise<void> {
    event.stopPropagation();
    if (this.busy) { return; }

    this.busy = true;
    try {
      if (await this.blocks.confirmBlock(this.code, this.name || 'this account')) {
        this.blocked.emit(this.code);
      }
    } finally {
      this.busy = false;
    }
  }
}
