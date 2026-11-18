import { Component, EventEmitter, Input, OnDestroy, Output } from '@angular/core';
import { REACTIONS, ReactionDef, reactionOf } from '../reaction-meta';

/**
 * Facebook-style Like button with a reaction picker.
 *
 *  - hover (mouse) or keyboard focus opens the picker, a long press opens it on touch screens
 *  - clicking the button itself likes, or takes an existing reaction back
 *  - choosing a face in the picker sets / changes the reaction
 *
 * The component only reports what the user chose; the parent talks to the API.
 */
@Component({
  selector: 'app-reaction-button',
  templateUrl: './reaction-button.component.html',
  styleUrls: ['./reaction-button.component.css']
})
export class ReactionButtonComponent implements OnDestroy {
  @Input() myReaction: string | null = null;
  @Input() disabled = false;
  @Input() compact = false;
  @Output() react = new EventEmitter<string>();
  @Output() unreact = new EventEmitter<void>();

  readonly reactions = REACTIONS;
  open = false;

  private openTimer?: any;
  private closeTimer?: any;
  private pressTimer?: any;
  private longPressed = false;

  static readonly HOVER_OPEN_MS = 250;
  static readonly HOVER_CLOSE_MS = 350;
  static readonly LONG_PRESS_MS = 450;

  get current(): ReactionDef | undefined {
    return reactionOf(this.myReaction);
  }

  // ---------- mouse ----------
  onEnter(): void {
    clearTimeout(this.closeTimer);
    clearTimeout(this.openTimer);
    this.openTimer = setTimeout(() => (this.open = true), ReactionButtonComponent.HOVER_OPEN_MS);
  }

  onLeave(): void {
    clearTimeout(this.openTimer);
    clearTimeout(this.closeTimer);
    this.closeTimer = setTimeout(() => (this.open = false), ReactionButtonComponent.HOVER_CLOSE_MS);
  }

  // ---------- keyboard ----------
  onFocusIn(): void {
    clearTimeout(this.closeTimer);
    this.open = true;
  }

  onFocusOut(event: FocusEvent, host: HTMLElement): void {
    const next = event.relatedTarget as Node | null;
    if (!next || !host.contains(next)) {
      this.open = false;
    }
  }

  // ---------- touch (long press opens the picker) ----------
  onTouchStart(): void {
    this.longPressed = false;
    clearTimeout(this.pressTimer);
    this.pressTimer = setTimeout(() => {
      this.longPressed = true;
      this.open = true;
    }, ReactionButtonComponent.LONG_PRESS_MS);
  }

  onTouchEnd(): void {
    clearTimeout(this.pressTimer);
  }

  // ---------- choices ----------
  onMainClick(): void {
    if (this.disabled) { return; }
    if (this.longPressed) {            // the long press already opened the picker; do not also "like"
      this.longPressed = false;
      return;
    }
    this.open = false;
    this.myReaction ? this.unreact.emit() : this.react.emit('Like');
  }

  pick(label: string): void {
    if (this.disabled) { return; }
    this.open = false;
    this.react.emit(label);
  }

  ngOnDestroy(): void {
    clearTimeout(this.openTimer);
    clearTimeout(this.closeTimer);
    clearTimeout(this.pressTimer);
  }
}
