import { Directive, ElementRef, OnDestroy, OnInit } from '@angular/core';
import { Subscription, combineLatest } from 'rxjs';
import { BrandingService } from 'src/app/services/Branding/branding.service';

const PROPS = ['background', 'padding', 'border-radius', 'margin-left', 'margin-right', 'max-width', 'max-height'];

/**
 * Put `appBrandLogo` on an existing <img>: the img's own src stays as the fallback logo, and the logo saved in
 * Nexsuz Information replaces it everywhere at once, inside the container style saved there (background, padding,
 * radius, size cap, alignment). A logo that fails to load falls back, so there is never a broken image. The uploaded
 * image keeps its aspect ratio and transparency (object-fit: contain; the background belongs to the container only).
 */
@Directive({ selector: 'img[appBrandLogo]' })
export class BrandLogoDirective implements OnInit, OnDestroy {
  private fallback = '';
  private sub?: Subscription;
  private failed = '';
  private readonly onError = () => {
    const img = this.el.nativeElement;
    if (img.getAttribute('src') !== this.fallback) { this.failed = img.getAttribute('src') || ''; this.show(null, {}); }
  };

  constructor(private el: ElementRef<HTMLImageElement>, private branding: BrandingService) { }

  ngOnInit(): void {
    const img = this.el.nativeElement;
    this.fallback = img.getAttribute('src') || '';
    img.addEventListener('error', this.onError);
    this.sub = combineLatest([this.branding.logo$, this.branding.css$]).subscribe(([url, css]) => this.show(url && url !== this.failed ? url : null, css));
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.el.nativeElement.removeEventListener('error', this.onError);
  }

  private show(url: string | null, css: { [prop: string]: string }): void {
    const img = this.el.nativeElement;
    img.classList.toggle('brand-custom', !!url);
    PROPS.forEach(p => url && css[p] ? img.style.setProperty(p, css[p]) : img.style.removeProperty(p));
    const next = url || this.fallback;
    if (img.getAttribute('src') !== next) { img.setAttribute('src', next); }
  }
}
