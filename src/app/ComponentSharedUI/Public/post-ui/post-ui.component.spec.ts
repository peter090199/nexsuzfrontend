import { NexsuzTestingModule } from 'src/testing/nexsuz-testing.module';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpEventType } from '@angular/common/http';
import { of, Subject, throwError } from 'rxjs';

import { PostUIComponent } from './post-ui.component';
import { PostUploadImagesService } from 'src/app/services/post-upload-images.service';

function fakeFile(name: string, type: string, sizeBytes = 1024): File {
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: sizeBytes });
  return file;
}

/** A real, decodable PNG so the browser can actually render the preview. */
function realImage(name: string, color = '#0a66c2', w = 400, h = 300): Promise<File> {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
  return new Promise(resolve => canvas.toBlob(b => resolve(new File([b!], name, { type: 'image/png' })), 'image/png'));
}

function selectEvent(files: File[]): Event {
  return { target: { files, value: 'x' } } as unknown as Event;
}

describe('PostUIComponent', () => {
  let component: PostUIComponent;
  let fixture: ComponentFixture<PostUIComponent>;
  let service: PostUploadImagesService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NexsuzTestingModule],
      schemas: [NO_ERRORS_SCHEMA],
      declarations: [ PostUIComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PostUIComponent);
    component = fixture.componentInstance;
    service = TestBed.inject(PostUploadImagesService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('image picker', () => {
    it('accepts JPG, PNG and GIF and builds previews', () => {
      component.onImagesSelected(selectEvent([
        fakeFile('a.jpg', 'image/jpeg'), fakeFile('b.png', 'image/png'), fakeFile('c.gif', 'image/gif')
      ]));
      expect(component.previews.length).toBe(3);
      expect(component.uploadedImages.length).toBe(3);
      expect(component.imageErrors.length).toBe(0);
      expect(component.previews[0].url.startsWith('blob:')).toBeTrue();
    });

    it('accepts WEBP', () => {
      component.onImagesSelected(selectEvent([fakeFile('a.webp', 'image/webp')]));
      expect(component.previews.length).toBe(1);
      expect(component.imageErrors.length).toBe(0);
    });

    it('adds further images without dropping the ones already selected', () => {
      component.onImagesSelected(selectEvent([fakeFile('a.jpg', 'image/jpeg')]));
      component.onImagesSelected(selectEvent([fakeFile('b.png', 'image/png'), fakeFile('c.webp', 'image/webp')]));
      expect(component.previews.map(p => p.file.name)).toEqual(['a.jpg', 'b.png', 'c.webp']);
    });

    it('revokes the object URL of a removed image', () => {
      const revoke = spyOn(URL, 'revokeObjectURL').and.callThrough();
      component.onImagesSelected(selectEvent([fakeFile('a.jpg', 'image/jpeg')]));
      const url = component.previews[0].url;
      component.removeImage(0);
      expect(revoke).toHaveBeenCalledWith(url);
    });

    it('revokes every object URL when the component is destroyed', () => {
      const revoke = spyOn(URL, 'revokeObjectURL').and.callThrough();
      component.onImagesSelected(selectEvent([fakeFile('a.jpg', 'image/jpeg'), fakeFile('b.jpg', 'image/jpeg')]));
      component.ngOnDestroy();
      expect(revoke).toHaveBeenCalledTimes(2);
    });

    it('opens, steps through and closes the enlarged preview', () => {
      component.onImagesSelected(selectEvent([
        fakeFile('a.jpg', 'image/jpeg'), fakeFile('b.jpg', 'image/jpeg'), fakeFile('c.jpg', 'image/jpeg')]));
      component.openPreview(0);
      expect(component.lightboxIndex).toBe(0);
      component.stepPreview(1);
      expect(component.lightboxIndex).toBe(1);
      component.stepPreview(-2);                     // wraps around
      expect(component.lightboxIndex).toBe(2);
      component.closePreview();
      expect(component.lightboxIndex).toBeNull();
    });

    it('closes the enlarged preview with Escape', () => {
      component.onImagesSelected(selectEvent([fakeFile('a.jpg', 'image/jpeg')]));
      component.openPreview(0);
      component.onKey(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(component.lightboxIndex).toBeNull();
    });

    it('clears every selection when the composer is cancelled', () => {
      const close = spyOn(component.dialogRef, 'close');
      component.onImagesSelected(selectEvent([fakeFile('a.jpg', 'image/jpeg')]));
      component.cancel();
      expect(component.previews.length).toBe(0);
      expect(component.uploadedImages.length).toBe(0);
      expect(close).toHaveBeenCalled();
    });

    it('shows the empty state until an image is chosen', () => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.empty-drop')).not.toBeNull();
      component.onImagesSelected(selectEvent([fakeFile('a.jpg', 'image/jpeg')]));
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.empty-drop')).toBeNull();
      expect(fixture.nativeElement.querySelectorAll('.preview img').length).toBe(1);
    });

    it('rejects unsupported formats with a message', () => {
      component.onImagesSelected(selectEvent([fakeFile('cv.pdf', 'application/pdf'), fakeFile('a.bmp', 'image/bmp')]));
      expect(component.previews.length).toBe(0);
      expect(component.imageErrors.length).toBe(2);
      expect(component.imageErrors[0]).toContain('JPG, PNG, GIF or WEBP');
    });

    it('rejects images over the size limit', () => {
      component.onImagesSelected(selectEvent([fakeFile('big.jpg', 'image/jpeg', 4 * 1024 * 1024)]));
      expect(component.previews.length).toBe(0);
      expect(component.imageErrors[0]).toContain('3 MB');
    });

    it('stops at the maximum number of images', () => {
      const files = Array.from({ length: 12 }, (_, i) => fakeFile(`p${i}.jpg`, 'image/jpeg'));
      component.onImagesSelected(selectEvent(files));
      expect(component.previews.length).toBe(component.maxImages);
      expect(component.imageErrors.some(e => e.includes('up to'))).toBeTrue();
    });

    it('removes a single image', () => {
      component.onImagesSelected(selectEvent([fakeFile('a.jpg', 'image/jpeg'), fakeFile('b.jpg', 'image/jpeg')]));
      component.removeImage(0);
      expect(component.previews.length).toBe(1);
      expect(component.uploadedImages[0].name).toBe('b.jpg');
    });
  });

  describe('posting', () => {
    beforeEach(() => {
      component.postForm.patchValue({ caption: 'Hello', status: 1 });
    });

    it('does not submit an invalid form', () => {
      component.postForm.patchValue({ caption: '' });
      const spy = spyOn(service, 'createPost');
      component.postData();
      expect(spy).not.toHaveBeenCalled();
    });

    it('sends caption, status and images, tracks progress and closes on success', () => {
      const events = new Subject<any>();
      const spy = spyOn(service, 'createPost').and.returnValue(events as any);
      const close = spyOn(component.dialogRef, 'close');
      component.onImagesSelected(selectEvent([fakeFile('a.jpg', 'image/jpeg')]));

      component.postData();
      const sent = spy.calls.mostRecent().args[0] as FormData;
      expect(sent.get('caption')).toBe('Hello');
      expect(sent.get('status')).toBe('1');
      expect(sent.getAll('posts[]').length).toBe(1);
      expect(component.isUploading).toBeTrue();

      events.next({ type: HttpEventType.UploadProgress, loaded: 50, total: 100 });
      expect(component.uploadPercent).toBe(50);

      events.next({ type: HttpEventType.Response, body: { success: true, message: 'ok' } });
      expect(component.isUploading).toBeFalse();
      expect(close).toHaveBeenCalledWith(true);
    });

    it('blocks a second submit while one is in flight', () => {
      const spy = spyOn(service, 'createPost').and.returnValue(new Subject<any>() as any);
      component.postData();
      component.postData();
      component.postData();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('shows the server validation message and stays open', () => {
      spyOn(service, 'createPost').and.returnValue(
        throwError(() => ({ status: 422, error: { message: 'Each image must be 3 MB or smaller.' } })));
      const close = spyOn(component.dialogRef, 'close');

      component.postData();

      expect(component.errorMessage).toBe('Each image must be 3 MB or smaller.');
      expect(component.isUploading).toBeFalse();     // can retry
      expect(close).not.toHaveBeenCalled();
    });

    it('shows a friendly message when the server cannot be reached', () => {
      spyOn(service, 'createPost').and.returnValue(throwError(() => ({ status: 0, error: null })));
      component.postData();
      expect(component.errorMessage).toContain('Upload failed');
    });

    it('reports an application-level failure instead of failing silently', () => {
      spyOn(service, 'createPost').and.returnValue(
        of({ type: HttpEventType.Response, body: { success: false, message: 'An error occurred' } } as any));
      component.postData();
      expect(component.errorMessage).toBe('An error occurred');
      expect(component.isUploading).toBeFalse();
    });
  });

  describe('rendering (what the user actually sees)', () => {
    const settle = () => new Promise(r => setTimeout(r, 150));

    async function addImages(count: number, longName = false) {
      const files: File[] = [];
      for (let i = 0; i < count; i++) {
        files.push(await realImage((longName ? 'a-very-long-photo-file-name-from-my-holiday-' : 'p') + i + '.png'));
      }
      component.onImagesSelected(selectEvent(files));
      fixture.detectChanges();
      await settle();
    }

    it('renders previews with a usable blob: src (not "unsafe:blob:") and the image really loads', async () => {
      await addImages(2);
      const imgs: HTMLImageElement[] = Array.from(fixture.nativeElement.querySelectorAll('.preview img'));
      expect(imgs.length).toBe(2);
      for (const img of imgs) {
        expect(img.getAttribute('src')).toMatch(/^blob:/);
        expect(img.complete && img.naturalWidth).toBeGreaterThan(0);
      }
    });

    it('shows the enlarged preview with a loadable image', async () => {
      await addImages(2);
      component.openPreview(1);
      fixture.detectChanges();
      await settle();
      const big: HTMLImageElement = fixture.nativeElement.querySelector('.lightbox img');
      expect(big).not.toBeNull();
      expect(big.getAttribute('src')).toMatch(/^blob:/);
      expect(big.naturalWidth).toBeGreaterThan(0);
    });

    // The composer must never be wider than the space it is given
    [280, 320, 360, 390, 430, 600].forEach(width => {
      it('does not overflow horizontally at ' + width + 'px (images, errors and long names)', async () => {
        const host: HTMLElement = fixture.nativeElement;
        host.style.cssText = 'display:block;width:' + width + 'px;padding:16px;box-sizing:border-box;overflow:visible';
        document.body.appendChild(host);

        await addImages(5, true);
        component.imageErrors = ['"a-really-long-file-name-that-is-not-supported-at-all.bmp" is not supported. Use JPG, PNG, GIF or WEBP.'];
        component.errorMessage = 'Each image must be 3 MB or smaller, and the upload could not be completed right now.';
        fixture.detectChanges();
        await settle();

        const box = host.getBoundingClientRect();
        const offenders = Array.from(host.querySelectorAll('*')).filter(el => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && (r.right > box.right + 1 || r.left < box.left - 1)
            && !(el as HTMLElement).closest('.lightbox');
        }).map(el => el.tagName.toLowerCase() + '.' + (el.getAttribute('class') || '').split(' ')[0]);

        expect(offenders).toEqual([]);
        expect(host.scrollWidth).toBeLessThanOrEqual(host.clientWidth + 1);
        host.remove();
      });
    });

    it('keeps the Post button and tools usable (44px touch targets) at 320px', async () => {
      const host: HTMLElement = fixture.nativeElement;
      host.style.cssText = 'display:block;width:320px;padding:16px;box-sizing:border-box';
      document.body.appendChild(host);
      await addImages(1);

      const targets = host.querySelectorAll('.tool, .post-btn, .remove, .empty-drop');
      targets.forEach(t => {
        const r = t.getBoundingClientRect();
        if (r.width > 0) { expect(Math.min(r.width, r.height)).toBeGreaterThanOrEqual(32); }
      });
      const post = host.querySelector('.post-btn')!.getBoundingClientRect();
      expect(post.height).toBeGreaterThanOrEqual(44);
      host.remove();
    });
  });

  describe('layout: fixed 600px dialog, only the middle scrolls', () => {
    const settle = () => new Promise(r => setTimeout(r, 150));
    const q = (sel: string) => fixture.nativeElement.querySelector(sel) as HTMLElement;

    async function mount(images = 0) {
      const host: HTMLElement = fixture.nativeElement;
      document.body.appendChild(host);                       // a real, laid-out element (the dialog container normally holds it)
      if (images) {
        const files: File[] = [];
        for (let n = 0; n < images; n++) { files.push(await realImage('p' + n + '.png')); }
        component.onImagesSelected(selectEvent(files));
      }
      component.postForm.get('caption')?.setValue('Line\n'.repeat(40));   // plenty of text too
      fixture.detectChanges();
      await settle();
      return host;
    }

    afterEach(() => { fixture.nativeElement.remove(); });

    it('is 600px tall (or the screen height minus a small margin on short screens)', async () => {
      const host = await mount();
      const expected = Math.min(600, window.innerHeight - 32);
      expect(Math.round(host.getBoundingClientRect().height)).toBe(Math.round(expected));
    });

    it('keeps the same height whether the post is empty or full of photos and text', async () => {
      const empty = Math.round((await mount()).getBoundingClientRect().height);
      fixture.nativeElement.remove();
      fixture = TestBed.createComponent(PostUIComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
      const full = Math.round((await mount(6)).getBoundingClientRect().height);
      expect(full).toBe(empty);
    });

    it('scrolls the middle, never the whole dialog', async () => {
      const host = await mount(6);
      const body = q('.composer-body');
      expect(getComputedStyle(body).overflowY).toBe('auto');
      expect(body.scrollHeight).toBeGreaterThan(body.clientHeight);          // there is something to scroll
      expect(host.scrollHeight).toBeLessThanOrEqual(host.clientHeight + 1);  // the dialog itself does not grow
    });

    it('keeps the header and the Post button on screen however much content there is', async () => {
      const host = await mount(6);
      const box = host.getBoundingClientRect();
      const inside = (el: HTMLElement) => { const r = el.getBoundingClientRect(); return r.top >= box.top - 1 && r.bottom <= box.bottom + 1; };
      expect(inside(q('.composer-head'))).toBeTrue();
      expect(inside(q('.composer-foot'))).toBeTrue();
      expect(inside(q('.post-btn'))).toBeTrue();
    });

    it('the body really scrolls when scrolled', async () => {
      await mount(6);
      const body = q('.composer-body');
      body.scrollTop = 200;
      expect(body.scrollTop).toBeGreaterThan(0);
      expect(q('.composer-foot').getBoundingClientRect().bottom).toBeLessThanOrEqual(fixture.nativeElement.getBoundingClientRect().bottom + 1);
    });

    it('offers Public, Friends and Private and shows a character counter', async () => {
      await mount();
      const labels = Array.from(fixture.nativeElement.querySelectorAll('.visibility select option')).map((o: any) => o.textContent.trim());
      expect(labels).toEqual(['Public', 'Friends', 'Private']);
      expect(q('.char-count').textContent).toContain('/ 5000');
    });
  });
});
