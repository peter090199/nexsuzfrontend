import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { NexsuzTestingModule } from 'src/testing/nexsuz-testing.module';

import { ProfileImageService } from './profile-image.service';

describe('ProfileImageService', () => {
  let service: ProfileImageService;
  let http: HttpTestingController;
  let photos: any[];
  let covers: any[];

  beforeEach(() => {
    sessionStorage.setItem('token', 'tok-123');
    TestBed.configureTestingModule({ imports: [NexsuzTestingModule] });
    service = TestBed.inject(ProfileImageService);
    http = TestBed.inject(HttpTestingController);
    photos = []; covers = [];
    service.photo$.subscribe(v => photos.push(v));
    service.cover$.subscribe(v => covers.push(v));
  });
  afterEach(() => { http.verify(); sessionStorage.removeItem('token'); });

  const file = (name = 'p.jpg') => new File(['x'], name, { type: 'image/jpeg' });

  it('starts with "nothing changed" so screens keep what the API gave them', () => {
    expect(photos).toEqual([undefined]);
    expect(covers).toEqual([undefined]);
  });

  it('uploads the profile photo as multipart/form-data with the token, and announces the new URL', () => {
    service.uploadPhoto(file('me.jpg')).subscribe();

    const req = http.expectOne(r => r.url.endsWith('/uploadProfilePhoto'));
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Authorization')).toBe('Bearer tok-123');
    expect(req.request.headers.has('Content-Type')).toBeFalse();          // the browser sets the multipart boundary
    expect(req.request.body instanceof FormData).toBeTrue();
    expect((req.request.body as FormData).get('photo') instanceof File).toBeTrue();
    req.flush({ success: true, photo_pic: 'http://localhost:8000/storage/uploads/1/cvphoto/u/1.jpg' });

    expect(photos[photos.length - 1]).toBe('http://localhost:8000/storage/uploads/1/cvphoto/u/1.jpg');
  });

  it('removing the photo announces null (screens show the default avatar)', () => {
    service.removePhoto().subscribe();
    const req = http.expectOne(r => r.url.endsWith('/removeProfilePhoto'));
    expect(req.request.method).toBe('POST');
    req.flush({ success: true, photo_pic: null });
    expect(photos[photos.length - 1]).toBeNull();
  });

  it('uploads and removes the cover through the cover endpoints', () => {
    service.uploadCover(file('c.jpg')).subscribe();
    const up = http.expectOne(r => r.url.endsWith('/uploadCoverPhoto'));
    expect((up.request.body as FormData).get('coverphoto') instanceof File).toBeTrue();
    up.flush({ success: true, coverphoto: 'http://x/storage/uploads/1/coverphoto/u/1.jpg' });
    expect(covers[covers.length - 1]).toBe('http://x/storage/uploads/1/coverphoto/u/1.jpg');

    service.removeCover().subscribe();
    http.expectOne(r => r.url.endsWith('/removeCoverPhoto')).flush({ success: true, coverphoto: null });
    expect(covers[covers.length - 1]).toBeNull();
  });

  it('does not announce anything when the server refuses (validation / auth errors reach the caller)', () => {
    let error: any;
    service.uploadPhoto(file()).subscribe({ error: e => error = e });
    http.expectOne(r => r.url.endsWith('/uploadProfilePhoto'))
      .flush({ success: false, message: 'The photo must be 5 MB or smaller.' }, { status: 422, statusText: 'Unprocessable' });

    expect(error.status).toBe(422);
    expect(error.error.message).toContain('5 MB');
    expect(photos).toEqual([undefined]);                                  // unchanged

    service.removeCover().subscribe({ error: () => { } });
    http.expectOne(r => r.url.endsWith('/removeCoverPhoto')).flush({ message: 'no' }, { status: 401, statusText: 'Unauthorized' });
    expect(covers).toEqual([undefined]);
  });

  it('a late subscriber still gets the latest picture', () => {
    service.uploadPhoto(file()).subscribe();
    http.expectOne(r => r.url.endsWith('/uploadProfilePhoto')).flush({ success: true, photo_pic: 'http://x/new.jpg' });
    let late: any;
    service.photo$.subscribe(v => late = v);
    expect(late).toBe('http://x/new.jpg');
  });
});
