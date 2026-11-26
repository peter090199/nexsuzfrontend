import { FEATURE } from 'src/app/services/AccountPlan/feature-access.map';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

export type FollowState = 'not_following' | 'pending' | 'accepted' | 'connect_back' | string | null | undefined;

/**
 * ONE person card used everywhere people are listed:
 * Search ("Find people"), Network ("People you may know") and Network ("Based on recent activity").
 * Change the design here and all three change.
 */
@Component({
  selector: 'app-person-card',
  templateUrl: './person-card.component.html',
  styleUrls: ['./person-card.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PersonCardComponent {
  /** feature codes for the template */
  readonly FEATURE = FEATURE;
  /** shimmer placeholder while loading */
  @Input() skeleton = false;

  @Input() name = '';
  @Input() photo: string | null | undefined = null;
  @Input() profession: string | null | undefined = '';
  /** small grey line under the profession (skills, "Based on your profile", ...) */
  @Input() label: string | null | undefined = '';
  @Input() online = false;
  @Input() location: string | null | undefined = null;
  /** users.id to open a chat with; leave empty for no Message button */
  @Input() messageUserId: number | null | undefined = null;
  @Input() messageLink: any[] | null = null;
  /** cover photo shown behind the avatar (the gradient shows when there is none) */
  @Input() cover: string | null | undefined = null;

  /** router commands for the profile; leave empty to just emit (open) */
  @Input() link: any[] | null = null;

  /** Connect / Pending / Connected button + block button */
  @Input() showActions = true;
  @Input() status: FollowState = 'not_following';
  @Input() code: string | number = '';
  @Input() roleCode: string | null | undefined = null;

  @Output() connect = new EventEmitter<void>();
  @Output() blocked = new EventEmitter<string | number>();
  @Output() open = new EventEmitter<void>();

  readonly fallback = 'assets/images/default.png';
  imgFailed = false;
  coverFailed = false;

  get initial(): string { return (this.name || '?').trim().charAt(0).toUpperCase(); }

  get color(): 'accent' | 'warn' | 'primary' {
    return this.status === 'accepted' ? 'accent' : this.status === 'pending' ? 'warn' : 'primary';
  }

  get buttonLabel(): string {
    switch (this.status) {
      case 'not_following': return 'Connect';
      case 'pending': return 'Pending';
      case 'accepted': return 'Connected';
      case 'connect_back': return 'Connect Back';
      case 'invite': return 'Accept';
      default: return '';
    }
  }

  onOpen(): void { if (!this.link) { this.open.emit(); } }
}
