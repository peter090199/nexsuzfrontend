import { ImgFallbackDirective } from 'src/app/directives/img-fallback.directive';
import { throwError } from 'rxjs';
import { Subject } from 'rxjs';
import { of } from 'rxjs';
import { NexsuzTestingModule } from 'src/testing/nexsuz-testing.module';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProfileUIComponent } from './profile-ui.component';

describe('ProfileUIComponent', () => {
  let component: ProfileUIComponent;
  let fixture: ComponentFixture<ProfileUIComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NexsuzTestingModule],
      schemas: [NO_ERRORS_SCHEMA],
      declarations: [ProfileUIComponent, ImgFallbackDirective]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ProfileUIComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('profile and cover photos', () => {
    const picture = (name = 'me.png', type = 'image/png', size = 2048) => {
      const f = new File(['x'], name, { type });
      Object.defineProperty(f, 'size', { value: size });
      return f;
    };
    const pick = (f: File) => ({ target: { files: [f], value: 'x' } } as unknown as Event);
    const croppedFile = () => new File(['jpegdata'], 'me.jpg', { type: 'image/jpeg' });
    let images: any;
    let alert: any;
    let dialog: any;

    function ownProfile(code = '702', me = '702') {
      component.code = code;
      component.currentUserCode = me;
      component.isloading = false;
      component.profiles = { fname: 'Pedro', lname: 'Tester', photo_pic: 'http://x/storage/uploads/702/cvphoto/u/1.jpg' };
      component.coverphoto = { coverphoto: 'http://x/storage/uploads/702/coverphoto/u/1.jpg' };
      fixture.detectChanges();
    }

    beforeEach(() => {
      images = (component as any).profileImages;
      alert = (component as any).alert;
      dialog = component.dialog;
    });

    it('shows the camera controls on your own profile only', () => {
      ownProfile('702', '702');
      const el: HTMLElement = fixture.nativeElement;
      expect(component.isOwner).toBeTrue();
      expect(el.querySelector('.cover-edit')).not.toBeNull();
      expect(el.querySelector('.avatar-edit')).not.toBeNull();

      ownProfile('703', '702');                                              // somebody else's profile
      expect(component.isOwner).toBeFalse();
      expect(el.querySelector('.cover-edit')).toBeNull();
      expect(el.querySelector('.avatar-edit')).toBeNull();
    });

    it('refuses a file that is not a JPG, PNG, GIF or WEBP, without opening the editor', () => {
      ownProfile();
      const open = spyOn(dialog, 'open');
      const warn = spyOn(alert, 'toastrWarning');
      component.onPickPhoto(pick(picture('cv.pdf', 'application/pdf')));
      component.onPickCover(pick(picture('x.svg', 'image/svg+xml')));
      expect(open).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledTimes(2);
      expect(warn.calls.first().args[0]).toContain('JPG, PNG, GIF or WEBP');
    });

    it('refuses a huge file', () => {
      ownProfile();
      const open = spyOn(dialog, 'open');
      const warn = spyOn(alert, 'toastrWarning');
      component.onPickPhoto(pick(picture('big.png', 'image/png', 16 * 1024 * 1024)));
      expect(open).not.toHaveBeenCalled();
      expect(warn.calls.first().args[0]).toContain('15 MB');
    });

    it('profile photo: opens a round cropper, uploads the CROPPED file and shows the new photo at once', () => {
      ownProfile();
      const open = spyOn(dialog, 'open').and.returnValue({ afterClosed: () => of(croppedFile()) } as any);
      const upload = spyOn(images, 'uploadPhoto').and.returnValue(of({ success: true, message: 'ok', photo_pic: 'http://x/new.jpg' }));
      const ok = spyOn(alert, 'toastrSuccess');

      component.onPickPhoto(pick(picture()));

      expect((open.calls.mostRecent().args as any[])[1].data.shape).toBe('circle');
      expect(upload).toHaveBeenCalledTimes(1);
      expect((upload.calls.mostRecent().args[0] as File).name).toBe('me.jpg');   // the cropped picture, not the original
      expect(component.profiles.photo_pic).toBe('http://x/new.jpg');
      expect(component.profiles.fname).toBe('Pedro');                            // the rest of the profile is untouched
      expect(component.busyPhoto).toBeFalse();
      expect(ok).toHaveBeenCalled();
    });

    it('cancelling the cropper uploads nothing', () => {
      ownProfile();
      spyOn(dialog, 'open').and.returnValue({ afterClosed: () => of(undefined) } as any);
      const upload = spyOn(images, 'uploadPhoto');
      component.onPickPhoto(pick(picture()));
      expect(upload).not.toHaveBeenCalled();
      expect(component.profiles.photo_pic).toContain('1.jpg');
    });

    it('cover photo: opens a banner cropper and uploads the cropped file', () => {
      ownProfile();
      const open = spyOn(dialog, 'open').and.returnValue({ afterClosed: () => of(croppedFile()) } as any);
      const upload = spyOn(images, 'uploadCover').and.returnValue(of({ success: true, message: 'ok', coverphoto: 'http://x/cover-new.jpg' }));

      component.coverFailed = true;
      component.onPickCover(pick(picture('cover.png')));

      expect((open.calls.mostRecent().args as any[])[1].data.shape).toBe('banner');
      expect(upload).toHaveBeenCalled();
      expect(component.coverphoto.coverphoto).toBe('http://x/cover-new.jpg');
      expect(component.coverFailed).toBeFalse();                                 // a new picture gets a fresh chance
    });

    it('shows the server\'s reason when an upload is refused, and keeps the current photo', () => {
      ownProfile();
      spyOn(dialog, 'open').and.returnValue({ afterClosed: () => of(croppedFile()) } as any);
      spyOn(images, 'uploadPhoto').and.returnValue(throwError(() => ({ status: 422, error: { message: 'The photo must be 5 MB or smaller.' } })));
      const err = spyOn(alert, 'toastrError');

      component.onPickPhoto(pick(picture()));

      expect(err).toHaveBeenCalledWith('The photo must be 5 MB or smaller.');
      expect(component.profiles.photo_pic).toContain('1.jpg');
      expect(component.busyPhoto).toBeFalse();
    });

    it('blocks a second upload while one is running', () => {
      ownProfile();
      spyOn(dialog, 'open').and.returnValue({ afterClosed: () => of(croppedFile()) } as any);
      const upload = spyOn(images, 'uploadPhoto').and.returnValue(new Subject<any>() as any);
      component.onPickPhoto(pick(picture()));
      component.onPickPhoto(pick(picture('again.png')));
      expect(upload).toHaveBeenCalledTimes(1);
      expect(component.busyPhoto).toBeTrue();
    });

    it('removing the photo asks first, then shows the default avatar', async () => {
      ownProfile();
      spyOn(alert, 'popupWarning').and.returnValue(Promise.resolve({ value: true }) as any);
      const remove = spyOn(images, 'removePhoto').and.returnValue(of({ success: true }));

      component.removePhoto();
      await Promise.resolve(); await Promise.resolve();

      expect(remove).toHaveBeenCalled();
      expect(component.profiles.photo_pic).toBeNull();
      expect(component.hasPhoto).toBeFalse();
    });

    it('does not remove anything when the confirmation is declined', async () => {
      ownProfile();
      spyOn(alert, 'popupWarning').and.returnValue(Promise.resolve({ value: false }) as any);
      const remove = spyOn(images, 'removePhoto');
      const removeCover = spyOn(images, 'removeCover');
      component.removePhoto();
      component.removeCover();
      await Promise.resolve(); await Promise.resolve();
      expect(remove).not.toHaveBeenCalled();
      expect(removeCover).not.toHaveBeenCalled();
    });

    it('removing the cover clears it', async () => {
      ownProfile();
      spyOn(alert, 'popupWarning').and.returnValue(Promise.resolve({ value: true }) as any);
      spyOn(images, 'removeCover').and.returnValue(of({ success: true }));
      component.removeCover();
      await Promise.resolve(); await Promise.resolve();
      expect(component.hasCover).toBeFalse();
    });

    it('a cover that fails to load falls back to the gradient instead of a broken image', () => {
      ownProfile();
      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('.cover-photo-img')).not.toBeNull();
      el.querySelector('.cover-photo-img')!.dispatchEvent(new Event('error'));
      fixture.detectChanges();
      expect(el.querySelector('.cover-photo-img')).toBeNull();
      expect(el.querySelector('.cover-photo')).not.toBeNull();               // the gradient box stays
    });

    it('a profile with no photo shows the default avatar, and a broken photo falls back to it', () => {
      ownProfile();
      component.profiles = { ...component.profiles, photo_pic: null };
      fixture.detectChanges();
      const img = fixture.nativeElement.querySelector('.profile-img') as HTMLImageElement;
      expect(img.getAttribute('src')).toContain('assets/images/default.png');

      component.profiles = { ...component.profiles, photo_pic: 'http://localhost:9/missing.jpg' };
      fixture.detectChanges();
      img.dispatchEvent(new Event('error'));
      expect(img.src).toContain('assets/images/default.png');
    });
  });

});
