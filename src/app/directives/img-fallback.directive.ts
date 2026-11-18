import { Directive, ElementRef, HostListener, Input } from '@angular/core';

/**
 * Swap a picture that fails to load (404, a file that only exists on another server, a bad URL)
 * for a default image, so users never see a broken-image icon.
 *
 *   <img [src]="user.photo" nxFallback>                       -> the default avatar
 *   <img [src]="shop.logo" nxFallback="assets/images/x.png">  -> your own fallback
 *
 * Each new [src] gets a fresh chance: the fallback is only used when the CURRENT source fails.
 */
@Directive({ selector: 'img[nxFallback]' })
export class ImgFallbackDirective {
  static readonly DEFAULT = 'assets/images/default.png';

  @Input('nxFallback') fallback: string | null | undefined = '';

  constructor(private el: ElementRef<HTMLImageElement>) { }

  @HostListener('error')
  onError(): void {
    const img = this.el.nativeElement;
    const wanted = this.fallback || ImgFallbackDirective.DEFAULT;
    const absolute = new URL(wanted, document.baseURI).href;
    if (img.src === absolute) { return; }          // the fallback itself failed: stop, no loop
    img.src = wanted;
  }
}
