import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ImgFallbackDirective } from './img-fallback.directive';

@Component({
  template: `
    <img id="plain" nxFallback [src]="src" alt="">
    <img id="custom" [nxFallback]="'assets/images/default2.png'" [src]="src" alt="">
    <img id="other" [src]="src" alt="">
  `
})
class HostComponent { src = 'http://localhost:9/does-not-exist.png'; }

describe('ImgFallbackDirective', () => {
  let fixture: ComponentFixture<HostComponent>;
  const img = (id: string) => fixture.nativeElement.querySelector('#' + id) as HTMLImageElement;
  const abs = (p: string) => new URL(p, document.baseURI).href;

  beforeEach(() => {
    TestBed.configureTestingModule({ declarations: [HostComponent, ImgFallbackDirective] });
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it('replaces a picture that fails to load with the default avatar', () => {
    img('plain').dispatchEvent(new Event('error'));
    expect(img('plain').src).toBe(abs('assets/images/default.png'));
  });

  it('uses the fallback you give it', () => {
    img('custom').dispatchEvent(new Event('error'));
    expect(img('custom').src).toBe(abs('assets/images/default2.png'));
  });

  it('does not loop when the fallback itself fails', () => {
    const el = img('plain');
    el.dispatchEvent(new Event('error'));
    const after = el.src;
    el.dispatchEvent(new Event('error'));
    el.dispatchEvent(new Event('error'));
    expect(el.src).toBe(after);
  });

  it('leaves images without the directive alone', () => {
    img('other').dispatchEvent(new Event('error'));
    expect(img('other').src).toBe('http://localhost:9/does-not-exist.png');
  });

  it('a new source gets a fresh chance (live photo updates)', () => {
    const el = img('plain');
    el.dispatchEvent(new Event('error'));                        // now showing the default
    fixture.componentInstance.src = 'http://localhost:9/another-missing.png';
    fixture.detectChanges();
    expect(el.src).toBe('http://localhost:9/another-missing.png');
    el.dispatchEvent(new Event('error'));
    expect(el.src).toBe(abs('assets/images/default.png'));
  });
});
