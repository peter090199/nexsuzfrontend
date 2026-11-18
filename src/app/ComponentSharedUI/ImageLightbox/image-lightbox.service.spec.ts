import { ApplicationRef, Component, NgZone } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { OverlayContainer } from '@angular/cdk/overlay';
import { MatDialog } from '@angular/material/dialog';
import { NexsuzTestingModule } from 'src/testing/nexsuz-testing.module';

import { ImageLightboxService } from './image-lightbox.service';
import { ImageLightboxComponent } from './image-lightbox.component';

@Component({ template: '<p id="dlg">dialog under the viewer</p>' })
class UnderneathDialogComponent { }

/** A real picture of the given size (flat colour, so the data URL stays tiny). */
function picture(w: number, h: number, colour = '#0a66c2'): string {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = colour; ctx.fillRect(0, 0, w, h);
  return c.toDataURL('image/png');
}
const settle = (ms = 150) => new Promise(r => setTimeout(r, ms));
const until = async (cond: () => boolean, ms = 3000) => { const end = Date.now() + ms; while (!cond() && Date.now() < end) { await settle(20); } };

describe('ImageLightbox (service + component)', () => {
  let service: ImageLightboxService;
  const root = () => document.querySelector('.nxlb') as HTMLElement | null;
  const media = () => document.querySelector('.nxlb-media') as HTMLImageElement | null;
  const loaded = async () => { await until(() => { tick(); return !!media() && media()!.complete && media()!.naturalWidth > 0; }); tick(); };
  const tick = () => TestBed.inject(ApplicationRef).tick();
  const open = (items: any[], index = 0) => TestBed.inject(NgZone).run(() => service.open(items, index));
  // real key presses carry the legacy numeric keyCode too, and Material's own dialog only reacts to that one
  const keyCodes: Record<string, number> = { Escape: 27, ArrowLeft: 37, ArrowRight: 39 };
  const key = (k: string) => { document.body.dispatchEvent(new KeyboardEvent('keydown', { key: k, keyCode: keyCodes[k], bubbles: true } as KeyboardEventInit)); tick(); };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [NexsuzTestingModule], declarations: [UnderneathDialogComponent, ImageLightboxComponent] });
    service = TestBed.inject(ImageLightboxService);
  });
  afterEach(() => {
    TestBed.inject(MatDialog).closeAll();
    TestBed.inject(OverlayContainer).ngOnDestroy();
  });

  // ------------------------------------------------------------------ position
  it('is fixed to the viewport, covers it with a dark backdrop and sits above everything else', async () => {
    open([{ src: picture(800, 600) }]);
    await loaded();
    const cs = getComputedStyle(root()!);
    const r = root()!.getBoundingClientRect();
    expect(cs.position).toBe('fixed');
    expect(Math.round(r.left)).toBe(0);
    expect(Math.round(r.top)).toBe(0);
    expect(Math.round(r.width)).toBe(window.innerWidth);
    expect(Math.round(r.height)).toBe(window.innerHeight);
    expect(cs.backgroundColor).toMatch(/rgba\(0, 0, 0, 0\.8/);                        // dark, see-through
    const container = document.querySelector('.cdk-overlay-container') as HTMLElement;
    expect(container.parentElement).toBe(document.body);                                // not inside the page layout
    expect(parseInt(getComputedStyle(container).zIndex, 10)).toBeGreaterThan(999);      // above the navbar (z-index 999)
  });

  // ------------------------------------------------------------------ size and centring, whatever the picture
  [
    ['huge landscape 4000x2600', 4000, 2600],
    ['tall portrait 900x4000', 900, 4000],
    ['wide panorama 5000x400', 5000, 400],
    ['square 1500x1500', 1500, 1500],
  ].forEach(([name, w, h]) => {
    it(`keeps a ${name} inside 90vw x 85vh, centred, not distorted`, async () => {
      open([{ src: picture(w as number, h as number) }]);
      await loaded();
      const b = media()!.getBoundingClientRect();
      expect(b.width).toBeLessThanOrEqual(window.innerWidth * 0.9 + 1);
      expect(b.height).toBeLessThanOrEqual(window.innerHeight * 0.85 + 1);
      expect(Math.abs((b.left + b.right) / 2 - window.innerWidth / 2)).toBeLessThan(3);
      expect(Math.abs((b.top + b.bottom) / 2 - window.innerHeight / 2)).toBeLessThan(3);
      expect(getComputedStyle(media()!).objectFit).toBe('contain');
      expect(b.width / b.height).toBeCloseTo((w as number) / (h as number), 1);          // same shape as the original
    });
  });

  it('does not blow a small picture up past its own size', async () => {
    open([{ src: picture(120, 80) }]);
    await loaded();
    const b = media()!.getBoundingClientRect();
    expect(Math.round(b.width)).toBe(120);
    expect(Math.round(b.height)).toBe(80);
  });

  // ------------------------------------------------------------------ clicks and keys
  it('a click on the picture neither closes the viewer nor reaches the page underneath', async () => {
    const pageClick = jasmine.createSpy('page click');
    document.body.addEventListener('click', pageClick);
    open([{ src: picture(400, 300) }]);
    await loaded();

    media()!.click(); tick();
    await settle(50);

    expect(root()).not.toBeNull();
    expect(pageClick).not.toHaveBeenCalled();
    document.body.removeEventListener('click', pageClick);
  });

  it('closes on a click outside the picture', async () => {
    open([{ src: picture(400, 300) }]);
    await loaded();
    root()!.click(); tick();                                                                    // the dark area
    await settle(50);
    expect(root()).toBeNull();
  });

  it('closes with the X button', async () => {
    open([{ src: picture(400, 300) }]);
    await loaded();
    (document.querySelector('.nxlb-close') as HTMLButtonElement).click(); tick();
    await settle(50);
    expect(root()).toBeNull();
  });

  it('closes with Esc', async () => {
    open([{ src: picture(400, 300) }]);
    await loaded();
    key('Escape');
    await settle(50);
    expect(root()).toBeNull();
  });

  it('Esc closes only the viewer when it is open on top of a dialog', async () => {
    const dialog = TestBed.inject(MatDialog);
    TestBed.inject(NgZone).run(() => dialog.open(UnderneathDialogComponent));
    await until(() => { tick(); return dialog.openDialogs.length === 1; });
    open([{ src: picture(400, 300) }]);
    await loaded();

    key('Escape');
    await until(() => { tick(); return root() === null; });
    expect(root()).toBeNull();                                                          // the viewer is gone ...
    expect(dialog.openDialogs.length).toBe(1);                                          // ... the dialog is still there

    key('Escape');
    await until(() => { tick(); return dialog.openDialogs.length === 0; });             // the dialog's own close animation needs ticks
    expect(dialog.openDialogs.length).toBe(0);                                          // the next Esc closes the dialog
  });

  it('reports closing once, and leaves nothing behind', async () => {
    const closed = jasmine.createSpy('closed');
    const handle = open([{ src: picture(400, 300) }]);
    handle.afterClosed.subscribe(closed);
    await loaded();
    handle.close();
    handle.close();
    key('Escape');
    await settle(50);
    expect(closed).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll('.nxlb').length).toBe(0);
    expect(document.querySelector('.cdk-overlay-container')!.children.length).toBe(0);
  });

  it('only ever shows one viewer', async () => {
    open([{ src: picture(300, 200) }]);
    open([{ src: picture(300, 200, '#1b8a4b') }]);
    await loaded();
    expect(document.querySelectorAll('.nxlb').length).toBe(1);
  });

  it('gives focus back to the element that opened it', async () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    const handle = open([{ src: picture(300, 200) }]);
    await loaded();
    handle.close();
    await settle(50);
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  // ------------------------------------------------------------------ several pictures
  it('starts at the clicked picture, shows a counter, and steps with buttons, arrows and wrap-around', async () => {
    open([{ src: picture(300, 200, '#ff0000') }, { src: picture(300, 200, '#00ff00') }, { src: picture(300, 200, '#0000ff') }], 1);
    await loaded();
    const count = () => document.querySelector('.nxlb-count')!.textContent!.trim();
    expect(count()).toBe('2 / 3');

    (document.querySelector('.nxlb-next') as HTMLButtonElement).click(); tick();
    expect(count()).toBe('3 / 3');
    key('ArrowRight');                                                                  // wraps to the first
    expect(count()).toBe('1 / 3');
    key('ArrowLeft');                                                                   // and back to the last
    expect(count()).toBe('3 / 3');
    (document.querySelector('.nxlb-prev') as HTMLButtonElement).click(); tick();
    expect(count()).toBe('2 / 3');
  });

  it('a single picture has no arrows and no counter', async () => {
    open([{ src: picture(300, 200) }]);
    await loaded();
    expect(document.querySelector('.nxlb-nav')).toBeNull();
    expect(document.querySelector('.nxlb-count')).toBeNull();
    key('ArrowRight');                                                                  // harmless
    expect(root()).not.toBeNull();
  });

  it('swiping changes the picture', async () => {
    open([{ src: picture(300, 200) }, { src: picture(300, 200, '#00ff00') }]);
    await loaded();
    const touch = (type: string, x: number) =>
      root()!.dispatchEvent(new TouchEvent(type, { changedTouches: [new Touch({ identifier: 1, target: root()!, clientX: x, clientY: 100 })], bubbles: true }));
    const swipe = (from: number, to: number) => { touch('touchstart', from); touch('touchend', to); tick(); };
    swipe(250, 100);                                   // swipe left -> next
    expect(document.querySelector('.nxlb-count')!.textContent!.trim()).toBe('2 / 2');
    swipe(100, 260);                                   // swipe right -> previous
    expect(document.querySelector('.nxlb-count')!.textContent!.trim()).toBe('1 / 2');
    swipe(100, 120);                                   // a tiny movement is not a swipe
    expect(document.querySelector('.nxlb-count')!.textContent!.trim()).toBe('1 / 2');
  });

  // ------------------------------------------------------------------ problems
  it('shows a message instead of a broken image when the picture cannot be loaded', async () => {
    open([{ src: 'http://localhost:9/missing.png' }]);
    await until(() => { tick(); return !!document.querySelector('.nxlb-error'); });
    expect(document.querySelector('.nxlb-error')!.textContent).toContain('could not be loaded');
    expect(media()).toBeNull();
    key('Escape');                                                                      // still closable
    await settle(50);
    expect(root()).toBeNull();
  });

  it('is announced as a dialog for screen readers and puts keyboard focus on Close', async () => {
    open([{ src: picture(300, 200) }]);
    await loaded();
    await settle(50); tick();
    expect(root()!.getAttribute('role')).toBe('dialog');
    expect(root()!.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(document.querySelector('.nxlb-close'));
  });

  it('plays a video item', async () => {
    open([{ src: 'data:video/mp4;base64,AAAA', type: 'video' }]);
    tick();                                                                             // right after opening, before the (fake) file fails to decode
    expect(document.querySelector('video.nxlb-media')).not.toBeNull();
    expect(document.querySelector('img.nxlb-media')).toBeNull();                        // a video item never renders as an <img>
  });

  it('exposes the component for direct use', () => {
    expect(ImageLightboxComponent).toBeDefined();
  });
});
