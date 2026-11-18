import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ReactionSummaryData, reactionOf } from '../reaction-meta';

/** The little stack of reaction faces with the total; clicking it asks the parent to show who reacted. */
@Component({
  selector: 'app-reaction-summary',
  templateUrl: './reaction-summary.component.html',
  styleUrls: ['./reaction-summary.component.css']
})
export class ReactionSummaryComponent {
  @Input() summary: ReactionSummaryData | null | undefined;
  @Input() compact = false;
  @Output() openList = new EventEmitter<void>();

  /** At most three faces, most used first. */
  get faces(): string[] {
    return (this.summary?.breakdown || [])
      .slice(0, 3)
      .map(b => reactionOf(b.reaction)?.emoji || '👍');
  }

  get total(): number {
    return this.summary?.total || 0;
  }

  get tooltip(): string {
    return (this.summary?.breakdown || []).map(b => `${b.reaction}: ${b.count}`).join('\n');
  }
}
