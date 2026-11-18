import { NexsuzTestingModule } from 'src/testing/nexsuz-testing.module';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { HttpEventType } from '@angular/common/http';
import { of, Subject, throwError } from 'rxjs';

import { PostUIComponent } from './post-ui.component';
import { PostUploadImagesService } from 'src/app/services/post-upload-images.service';

// a real 1x1 PNG so saved images can actually render in these tests
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

function savedPost(extra: any = {}) {
  return {
    id: 7, transNo: 42, posts_uuid: 'uuid-7', caption: 'My original caption', status: 1,
    images: [
      { posts_uuind: 'img-a', path_url: PNG },
      { posts_uuind: 'img-b', path_url: PNG },
      { posts_uuind: 'img-c', path_url: PNG },
    ],
    videos: [],
    ...extra,
  };
}

function file(name: string, type = 'image/png', size = 1024): File {
  const f = new File(['x'], name, { type });
  Object.defineProperty(f, 'size', { value: size });
  return f;
}
const pick = (files: File[]) => ({ target: { files, value: 'x' } } as unknown as Event);
const settle = () => new Promise(r => setTimeout(r, 120));
const ok = (post: any = { id: 7 }) => of({ type: HttpEventType.Response, body: { success: true, message: 'ok', post } } as any);

describe('PostUIComponent (edit mode)', () => {
  let component: PostUIComponent;
  let fixture: ComponentFixture<PostUIComponent>;
  let service: PostUploadImagesService;
  let original: any;

  async function setup(post: any = savedPost()) {
    original = JSON.parse(JSON.stringify(post));
    await TestBed.configureTestingModule({
      imports: [NexsuzTestingModule],
      schemas: [NO_ERRORS_SCHEMA],
      declarations: [PostUIComponent],
      providers: [{ provide: MAT_DIALOG_DATA, useValue: post }],
    }).compileComponents();
    fixture = TestBed.createComponent(PostUIComponent);
    component = fixture.componentInstance;
    service = TestBed.inject(PostUploadImagesService);
    fixture.detectChanges();
  }

  const sentFormData = (spy: jasmine.Spy) => spy.calls.mostRecent().args[0] as FormData;

  it('loads the post text and current images into the editor', async () => {
    await setup();
    expect(component.isEdit).toBeTrue();
    expect(component.btnSave).toBe('Save changes');
    expect(component.postForm.value.caption).toBe('My original caption');
    expect(component.postForm.value.status).toBe(1);
    expect(component.existingImages.length).toBe(3);

    fixture.detectChanges();
    await settle();
    const imgs: HTMLImageElement[] = Array.from(fixture.nativeElement.querySelectorAll('.preview.saved img'));
    expect(imgs.length).toBe(3);
    expect(imgs.every(i => i.naturalWidth > 0)).toBeTrue();
    expect(fixture.nativeElement.querySelector('.empty-drop')).toBeNull();
  });

  it('shows a saved video and lets it be removed', async () => {
    await setup(savedPost({ images: [], videos: [{ posts_uuind: 'vid-1', path_url: 'http://localhost/v.mp4' }] }));
    expect(component.existingVideo?.posts_uuind).toBe('vid-1');
    component.removeExistingVideo();
    expect(component.existingVideo).toBeNull();
    expect(component.removedAttachmentIds).toEqual(['vid-1']);
  });

  it('saving with no changes sends nothing that would alter the images', async () => {
    await setup();
    const spy = spyOn(service, 'updatePost').and.returnValue(ok());
    spyOn(component.dialogRef, 'close');

    component.postData();

    const fd = sentFormData(spy);
    expect(spy.calls.mostRecent().args[1]).toBe(42);                  // addressed by the post's transNo
    expect(fd.get('caption')).toBe('My original caption');
    expect(fd.getAll('posts[]').length).toBe(0);                      // no new files
    expect(fd.getAll('remove_attachments[]').length).toBe(0);         // nothing detached
  });

  it('text-only edit sends the new text', async () => {
    await setup();
    const spy = spyOn(service, 'updatePost').and.returnValue(ok());
    component.postForm.patchValue({ caption: 'Edited text' });
    component.postData();
    expect(sentFormData(spy).get('caption')).toBe('Edited text');
    expect(sentFormData(spy).getAll('remove_attachments[]').length).toBe(0);
  });

  it('removing saved images lists exactly those images for removal', async () => {
    await setup();
    const spy = spyOn(service, 'updatePost').and.returnValue(ok());

    component.removeExistingImage(1);                                 // img-b
    expect(component.existingImages.map(i => i.posts_uuind)).toEqual(['img-a', 'img-c']);
    component.postData();

    expect(sentFormData(spy).getAll('remove_attachments[]')).toEqual(['img-b']);
  });

  it('adds new images next to the saved ones and sends only the new files', async () => {
    await setup();
    const spy = spyOn(service, 'updatePost').and.returnValue(ok());

    component.onImagesSelected(pick([file('fresh.png')]));
    expect(component.totalImages).toBe(4);
    expect(component.gallery.length).toBe(4);
    component.postData();

    const fd = sentFormData(spy);
    expect(fd.getAll('posts[]').length).toBe(1);
    expect(fd.getAll('remove_attachments[]').length).toBe(0);
  });

  it('counts saved images toward the 10 image limit', async () => {
    await setup(savedPost({ images: Array.from({ length: 9 }, (_, i) => ({ posts_uuind: 'i' + i, path_url: PNG })) }));
    component.onImagesSelected(pick([file('a.png'), file('b.png'), file('c.png')]));
    expect(component.previews.length).toBe(1);                        // only one slot was left
    expect(component.totalImages).toBe(10);
    expect(component.imageErrors.some(e => e.includes('up to'))).toBeTrue();
  });

  it('allows an image-only post (no text) but not a completely empty one', async () => {
    await setup();
    component.postForm.patchValue({ caption: '' });
    expect(component.canPost).toBeTrue();                             // images remain
    component.existingImages = [];
    expect(component.canPost).toBeFalse();
    component.onImagesSelected(pick([file('x.png')]));
    expect(component.canPost).toBeTrue();
  });

  it('lets the user enlarge saved and new images together', async () => {
    await setup();
    component.onImagesSelected(pick([file('fresh.png')]));
    component.openPreview(3);                                         // the new one comes after the 3 saved
    expect(component.gallery[component.lightboxIndex!].name).toBe('fresh.png');
    component.openPreview(0);
    component.stepPreview(-1);
    expect(component.lightboxIndex).toBe(3);                          // wraps around the combined list
  });

  it('cancel changes nothing: no request is sent and the original post object is untouched', async () => {
    await setup();
    const update = spyOn(service, 'updatePost');
    const close = spyOn(component.dialogRef, 'close');

    component.postForm.patchValue({ caption: 'half typed edit' });
    component.removeExistingImage(0);
    component.onImagesSelected(pick([file('draft.png')]));
    component.cancel();

    expect(update).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledWith(false);                        // the feed treats false as "no change"
    expect(component.data).toEqual(original);                         // the post data was never mutated
  });

  it('closes with the updated post on success so the feed can swap it in', async () => {
    await setup();
    const updated = { id: 7, caption: 'server version', images: [], videos: [] };
    spyOn(service, 'updatePost').and.returnValue(ok(updated));
    const close = spyOn(component.dialogRef, 'close');

    component.postData();

    expect(close).toHaveBeenCalledWith({ post: updated });
  });

  it('blocks duplicate saves while one is in flight', async () => {
    await setup();
    const spy = spyOn(service, 'updatePost').and.returnValue(new Subject<any>() as any);
    component.postData(); component.postData(); component.postData();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(component.isUploading).toBeTrue();
  });

  it('shows server errors, stays open, and keeps the pending removals for a retry', async () => {
    await setup();
    spyOn(service, 'updatePost').and.returnValue(
      throwError(() => ({ status: 403, error: { message: 'You can only edit your own posts.' } })));
    const close = spyOn(component.dialogRef, 'close');

    component.removeExistingImage(0);
    component.postData();

    expect(component.errorMessage).toBe('You can only edit your own posts.');
    expect(component.isUploading).toBeFalse();
    expect(close).not.toHaveBeenCalled();
    expect(component.removedAttachmentIds).toEqual(['img-a']);        // not lost: the user can retry
  });
});
