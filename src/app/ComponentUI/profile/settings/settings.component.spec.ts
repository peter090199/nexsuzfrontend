import { NexsuzTestingModule } from 'src/testing/nexsuz-testing.module';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { SettingsComponent } from './settings.component';

describe('SettingsComponent', () => {
  let component: SettingsComponent;
  let fixture: ComponentFixture<SettingsComponent>;

  async function create(role?: string) {
    if (role) { sessionStorage.setItem('role', role); } else { sessionStorage.removeItem('role'); }
    await TestBed.configureTestingModule({
      imports: [NexsuzTestingModule],
      schemas: [NO_ERRORS_SCHEMA],
      declarations: [ SettingsComponent ]
    })
    .compileComponents();
    fixture = TestBed.createComponent(SettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }
  afterEach(() => sessionStorage.removeItem('role'));

  it('should create', async () => {
    await create();
    expect(component).toBeTruthy();
  });

  describe('Subscription Plan section', () => {
    const plan = () => component.sections.find(s => s.id === 'plan');

    it('job seekers have it', async () => {
      await create('DEF-USERS');
      expect(plan()).toBeTruthy();
      expect(plan()!.available).toBeTrue();
      expect(plan()!.description).toContain('upgrade');
    });

    it('recruiters have it too', async () => {
      await create('DEF-CLIENT');
      expect(plan()).toBeTruthy();
      expect(plan()!.available).toBeTrue();
      expect(plan()!.description).toContain('recruiter plan');
    });

    it('the master admin keeps it, with the management description', async () => {
      await create('DEF-MASTERADMIN');
      expect(plan()!.description).toContain('Manage plans');
    });

    it('admins, who cannot hold a plan, do not get it', async () => {
      await create('DEF-ADMIN');
      expect(plan()).toBeUndefined();
    });
  });

  describe('CV items in Profile & Privacy', () => {
    it('are for job seekers (DEF-USERS) only', async () => {
      await create('DEF-USERS');
      expect(component.isJobSeeker).toBeTrue();
    });

    for (const role of ['DEF-ADMIN', 'DEF-CLIENT', 'DEF-MASTERADMIN']) {
      it(`${role} gets no CV toggles, CV links or CV wording`, async () => {
        await create(role);
        expect(component.isJobSeeker).toBeFalse();
        component.select('privacy');
        component.isLoading = false; component.loadError = false;
        fixture.detectChanges();
        const text = (fixture.nativeElement as HTMLElement).textContent || '';
        expect(text).not.toContain('What appears on my CV');
        expect(text).not.toContain('CV page');
        expect(text).not.toContain('Edit profile photo');
        expect(text).not.toContain('No CV needed');
      });
    }
  });

  describe('photo uploads in Profile & Privacy', () => {
    const fixtureEl = () => fixture.nativeElement as HTMLElement;
    async function open(role: string) {
      await create(role);
      component.select('privacy');
      component.isLoading = false; component.loadError = false;
      fixture.detectChanges();
    }

    for (const role of ['DEF-ADMIN', 'DEF-MASTERADMIN', 'DEF-CLIENT']) {
      it(`${role} has working cover and profile photo pickers`, async () => {
        await open(role);
        expect(fixtureEl().querySelector('[data-testid="cover-input"]')).not.toBeNull();
        expect(fixtureEl().querySelector('[data-testid="photo-input"]')).not.toBeNull();
        expect(fixtureEl().querySelector('[data-testid="photo-btn"]')).not.toBeNull();
        expect(fixtureEl().querySelector('[data-testid="cover-btn"]')).not.toBeNull();
        const clicked = spyOn(fixtureEl().querySelector('[data-testid="cover-input"]') as HTMLInputElement, 'click');
        (fixtureEl().querySelector('[data-testid="cover-btn"]') as HTMLButtonElement).click();
        expect(clicked).toHaveBeenCalled();
      });
    }

    it('rejects a wrong type or an oversized photo before calling the API', async () => {
      await open('DEF-ADMIN');
      const post = spyOn((component as any).http, 'post');
      const toast = spyOn((component as any).alert, 'toastrError');
      await component.uploadProfilePhotoFile({ target: { files: [new File(['x'], 'a.pdf', { type: 'application/pdf' })], value: 'x' } });
      await component.uploadProfilePhotoFile({ target: { files: [new File([new ArrayBuffer(6 * 1024 * 1024)], 'a.png', { type: 'image/png' })], value: 'x' } });
      expect(post).not.toHaveBeenCalled();
      expect(toast).toHaveBeenCalledTimes(2);
    });

    it('posts the profile photo as "photo" to uploadProfilePhoto and refreshes the profile', async () => {
      await open('DEF-ADMIN');
      const post = spyOn((component as any).http, 'post').and.returnValue(of({ success: true, message: 'Profile photo updated successfully.' }));
      spyOn((component as any).authService, 'getProfilecode').and.returnValue(of({ message: { photo_pic: 'x.png' } }));
      const ok = spyOn((component as any).alert, 'toastrSuccess');
      await component.uploadProfilePhotoFile({ target: { files: [new File(['x'], 'a.png', { type: 'image/png' })], value: 'x' } });
      const [url, body] = post.calls.mostRecent().args as any[];
      expect(String(url)).toContain('uploadProfilePhoto');
      expect((body as FormData).get('photo')).toBeTruthy();
      expect(ok).toHaveBeenCalled();
      expect(component.photoUploading).toBeFalse();
    });
  });
});
