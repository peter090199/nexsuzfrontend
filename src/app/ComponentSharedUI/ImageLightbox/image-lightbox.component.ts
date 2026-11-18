import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';

export interface LightboxItem {
  src: string;
  alt?: string;
  type?: 'image' | 'video';
}

/**
 * Facebook-style picture viewer.
 *
 * Fixed to the viewport (it is mounted in the CDK overlay layer, see ImageLightboxService), dark backdrop,
 * the picture centred and never larger than 90vw x 85vh (object-fit: contain), so it can never spill over
 * the navbar, the composer or the feed, however big the original is.
 *
 * Close: the X button, Esc, or a click anywhere outside the picture. A click ON the picture does nothing.
 * Several pictures: arrows / buttons / swipe, with a counter.
 */
@Component({
  selector: 'app-image-lightbox',
  templateUrl: './image-lightbox.component.html',
  styleUrls: ['./image-lightbox.component.css']
})
export class ImageLightboxComponent implements OnInit, AfterViewInit {
  @Input() items: LightboxItem[] = [];
  @Input() index = 0;
  @Input() returnFocusTo: HTMLElement | null = null;
  @Output() closed = new EventEmitter<void>();

  @ViewChild('closeBtn') closeBtn?: ElementRef<HTMLButtonElement>;

  loading = true;
  failed = false;

  private previouslyFocused: HTMLElement | null = null;
  private touchStartX: number | null = null;

  get current(): LightboxItem | undefined { return this.items[this.index]; }
  get isVideo(): boolean { return this.current?.type === 'video'; }
  get many(): boolean { return this.items.length > 1; }

  ngOnInit(): void {
    // the opener captured at open() time (first change detection can come later, after focus moved)
    this.previouslyFocused = this.returnFocusTo ?? (document.activeElement as HTMLElement | null);
    this.index = Math.min(Math.max(0, this.index || 0), Math.max(0, this.items.length - 1));
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.closeBtn?.nativeElement.focus(), 0);     // keyboard users land on the close button
  }

  /** Keys, forwarded by ImageLightboxService (Esc closes only this viewer, not a dialog underneath it). */
  onKey(event: KeyboardEvent): void {
    switch (event.key) {
      case 'Escape': event.stopPropagation(); this.close(); break;
      case 'ArrowRight': this.next(); break;
      case 'ArrowLeft': this.prev(); break;
    }
  }

  close(): void {
    this.closed.emit();
    this.previouslyFocused?.focus?.();                              // give focus back to what opened the viewer
  }

  next(): void { this.go(1); }
  prev(): void { this.go(-1); }

  private go(step: number): void {
    if (!this.many) { return; }
    const n = this.items.length;
    this.index = (this.index + step + n) % n;
    this.loading = true;
    this.failed = false;
    this.preload();
  }

  /** Warm the neighbours so stepping through pictures feels instant. */
  private preload(): void {
    if (!this.many) { return; }
    const n = this.items.length;
    [(this.index + 1) % n, (this.index - 1 + n) % n].forEach(i => {
      if (this.items[i]?.type !== 'video') { new Image().src = this.items[i].src; }
    });
  }

  onLoaded(): void { this.loading = false; this.preload(); }
  onError(): void { this.loading = false; this.failed = true; }

  // ---- swipe (touch screens) ----
  onTouchStart(e: TouchEvent): void { this.touchStartX = e.changedTouches[0]?.clientX ?? null; }

  onTouchEnd(e: TouchEvent): void {
    if (this.touchStartX === null) { return; }
    const dx = (e.changedTouches[0]?.clientX ?? this.touchStartX) - this.touchStartX;
    this.touchStartX = null;
    if (Math.abs(dx) > 50) { dx < 0 ? this.next() : this.prev(); }
  }
}
