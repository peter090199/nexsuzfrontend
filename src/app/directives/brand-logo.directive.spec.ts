import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { BrandingService } from 'src/app/services/Branding/branding.service';
import { BrandLogoDirective } from './brand-logo.directive';

@Component({ template: `<img id="a" src="assets/images/logo.png" appBrandLogo><img id="b" src="assets/images/logo2.png" appBrandLogo>` })
class HostComponent { }

describe('BrandLogoDirective + BrandingService (one logo for the whole app)', () => {
  let http: HttpTestingController;
  let branding: BrandingService;

  beforeEach(() => {
    localStorage.removeItem('nx_brand_logo');
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule], declarations: [HostComponent, BrandLogoDirective] });
    http = TestBed.inject(HttpTestingController);
    branding = TestBed.inject(BrandingService);
  });
  afterEach(() => localStorage.removeItem('nx_brand_logo'));

  const make = () => { const f = TestBed.createComponent(HostComponent); f.detectChanges(); return f; };
  const img = (f: any, id: string) => f.nativeElement.querySelector('#' + id) as HTMLImageElement;

  it('keeps each image default until a logo is saved, then every instance shows the saved one', () => {
    const f = make();
    expect(img(f, 'a').getAttribute('src')).toBe('assets/images/logo.png');
    http.expectOne(r => r.url.endsWith('business-info/public')).flush({ success: true, data: { logo_url: 'http://api/storage/uploads/business/logo/u/logo.png' } });
    expect(img(f, 'a').getAttribute('src')).toContain('/storage/uploads/business/logo/');
    expect(img(f, 'b').getAttribute('src')).toContain('/storage/uploads/business/logo/');
    expect(img(f, 'a').classList).toContain('brand-custom');
  });

  it('requests the public API once however many logos are on screen', () => {
    make();
    http.expectOne(r => r.url.endsWith('business-info/public')).flush({ success: true, data: { logo_url: null } });
    http.expectNone(r => r.url.endsWith('business-info/public'));
  });

  it('replacing or removing the logo in Nexsuz Information updates every instance at once and survives a reload via the cache', () => {
    const f = make();
    http.expectOne(r => r.url.endsWith('business-info/public')).flush({ success: true, data: { logo_url: 'http://api/storage/one.png' } });
    branding.setLogo('http://api/storage/two.png');
    f.detectChanges();
    expect(img(f, 'a').getAttribute('src')).toBe('http://api/storage/two.png');
    expect(img(f, 'b').getAttribute('src')).toBe('http://api/storage/two.png');
    expect(localStorage.getItem('nx_brand_logo')).toBe('http://api/storage/two.png');
    branding.setLogo(null);
    expect(img(f, 'a').getAttribute('src')).toBe('assets/images/logo.png');
    expect(img(f, 'b').getAttribute('src')).toBe('assets/images/logo2.png');   // each place keeps its own fallback
    expect(img(f, 'a').classList).not.toContain('brand-custom');
  });

  it('falls back to the default (no broken image) when the saved logo fails to load', () => {
    const f = make();
    http.expectOne(r => r.url.endsWith('business-info/public')).flush({ success: true, data: { logo_url: 'http://api/storage/gone.png' } });
    img(f, 'a').dispatchEvent(new Event('error'));
    expect(img(f, 'a').getAttribute('src')).toBe('assets/images/logo.png');
    expect(img(f, 'b').getAttribute('src')).toBe('http://api/storage/gone.png');   // only the failing element falls back
  });

  it('keeps the default logo and does not throw when the API is unreachable', () => {
    const f = make();
    http.expectOne(r => r.url.endsWith('business-info/public')).flush({}, { status: 500, statusText: 'x' });
    expect(img(f, 'a').getAttribute('src')).toBe('assets/images/logo.png');
  });
});

describe('Logo container style (shared by every logo)', () => {
  let http: HttpTestingController;
  let branding: BrandingService;

  beforeEach(() => {
    localStorage.removeItem('nx_brand_logo'); localStorage.removeItem('nx_brand_logo_style');
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule], declarations: [HostComponent, BrandLogoDirective] });
    http = TestBed.inject(HttpTestingController);
    branding = TestBed.inject(BrandingService);
  });
  afterEach(() => { localStorage.removeItem('nx_brand_logo'); localStorage.removeItem('nx_brand_logo_style'); });

  it('applies the saved background, padding, radius, size cap and alignment to every logo, and updates them together', () => {
    const f = TestBed.createComponent(HostComponent); f.detectChanges();
    const a = f.nativeElement.querySelector('#a') as HTMLImageElement, b = f.nativeElement.querySelector('#b') as HTMLImageElement;
    http.expectOne(r => r.url.endsWith('business-info/public')).flush({ success: true, data: { logo_url: 'http://api/storage/l.png',
      logo_style: { bg_mode: 'navy', padding: 10, radius: 20, width: 120, height: null, align: 'center' } } });
    for (const el of [a, b]) {
      expect(el.style.padding).toBe('10px');
      expect(el.style.borderRadius).toBe('20px');
      expect(el.style.maxWidth).toBe('120px');
      expect(el.style.marginLeft).toBe('auto');
      expect(el.style.background).toContain('rgb(0, 42, 87)');
    }
    branding.setStyle({ ...branding.style, bg_mode: 'transparent', padding: 0 });
    expect(a.style.background).toContain('transparent');
    expect(b.style.padding).toBe('0px');
  });

  it('builds colour and gradient backgrounds and leaves the default logo unstyled', () => {
    const f = TestBed.createComponent(HostComponent); f.detectChanges();
    const a = f.nativeElement.querySelector('#a') as HTMLImageElement;
    http.expectOne(r => r.url.endsWith('business-info/public')).flush({ success: true, data: { logo_url: 'http://api/storage/l.png' } });
    branding.setStyle({ ...branding.style, bg_mode: 'color', bg_color: '#112233' });
    expect(a.style.background).toContain('rgb(17, 34, 51)');
    branding.setStyle({ ...branding.style, bg_mode: 'gradient', gradient_from: '#ff0000', gradient_to: '#0000ff', gradient_angle: 90 });
    expect(a.style.background).toContain('linear-gradient(90deg');
    branding.setLogo(null);
    expect(a.style.padding).toBe('');
    expect(a.style.background).toBe('');
  });
});
