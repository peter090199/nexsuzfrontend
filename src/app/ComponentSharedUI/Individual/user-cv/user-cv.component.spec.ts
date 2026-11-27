import { NexsuzTestingModule } from 'src/testing/nexsuz-testing.module';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { CvSetupService, CvStatus } from 'src/app/services/CV/cv-setup.service';
import { NotificationsService } from 'src/app/services/Global/notifications.service';

import { UserCVComponent } from './user-cv.component';

describe('UserCVComponent', () => {
  let component: UserCVComponent;
  let fixture: ComponentFixture<UserCVComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NexsuzTestingModule],
      schemas: [NO_ERRORS_SCHEMA],
      declarations: [ UserCVComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(UserCVComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('header and steps', () => {
    const el = () => fixture.nativeElement as HTMLElement;

    it('has a hero header with the step title instead of the old flat toolbar', () => {
      expect(el().querySelector('mat-toolbar')).toBeNull();
      expect(el().querySelector('header.cv-hero')).toBeTruthy();
      expect(el().querySelectorAll('h1').length).toBe(1);
      expect(el().querySelector('h1.cv-title')!.textContent).toContain('Build Your Basic Information');
      expect(el().querySelector('.cv-eyebrow')!.textContent).toContain('Step 1 of 4');
    });

    it('keeps the View CV button working', () => {
      const btn = el().querySelector('button.toolbar-btn') as HTMLButtonElement;
      expect(btn.getAttribute('aria-label')).toContain('Preview, print or download my CV');
      const spy = spyOn(component, 'previewAndFinish');
      btn.click();
      expect(spy).toHaveBeenCalled();
    });

    it('the progress bar and counter follow the open step', () => {
      const bar = () => el().querySelector('.cv-progress') as HTMLElement;
      expect(bar().getAttribute('aria-valuenow')).toBe('25');
      component.onStepChange({ selectedIndex: 2 } as any);
      fixture.detectChanges();
      expect(component.progressPct).toBe(75);
      expect(bar().getAttribute('aria-valuenow')).toBe('75');
      expect((bar().firstElementChild as HTMLElement).style.width).toBe('75%');
      expect(el().querySelector('.cv-eyebrow')!.textContent).toContain('Step 3 of 4');
      expect(el().querySelector('h1.cv-title')!.textContent).toContain('Build Your Summary');
      component.onStepChange({ selectedIndex: 3 } as any);
      expect(component.progressPct).toBe(100);
    });

    it('the step headers use short names that fit, not the long page headings', () => {
      expect(component.stepShort).toEqual(['Basic info', 'Location', 'Summary', 'Qualifications']);
      const labels = Array.from(el().querySelectorAll('.mat-step-label')).map(l => l.textContent!.trim());
      expect(labels).toEqual(component.stepShort);
    });

    it('no longer repeats a second progress bar in the footer', () => {
      expect(el().querySelector('.progress-bar-container')).toBeNull();
      expect(el().querySelector('footer.mat-footer')).toBeTruthy();
    });
  });

  describe('set up your CV first', () => {
    const incomplete: CvStatus = { applies: true, complete: false, missing: ['Summary', 'Date of birth'], total: 9 };
    const banner = () => (fixture.nativeElement as HTMLElement).querySelector('[data-testid="cv-setup-banner"]');

    it('shows the banner with what is still missing while the CV is unfinished', () => {
      // the page shows nothing until it knows the CV mode; here: the builder
      component.cvModeLoaded = true;
      component.setup = incomplete;
      fixture.detectChanges();
      const el = banner()!;
      expect(el).toBeTruthy();
      expect(el.textContent).toContain('Set up your CV first');
      expect(el.textContent).toContain('this is the only page you can open');
      const chips = Array.from(el.querySelectorAll('.chip')).map(c => c.textContent!.trim());
      expect(chips).toEqual(['Summary', 'Date of birth']);
    });

    it('does not flash the banner before the CV mode is known, nor show it in upload-only mode', () => {
      component.setup = incomplete;
      fixture.detectChanges();
      expect(banner()).toBeNull();
      component.cvModeLoaded = true;
      component.cvUploadOnly = true;
      fixture.detectChanges();
      expect(banner()).toBeNull();
    });

    it('hides the banner once the CV is finished, or when the account has no CV', () => {
      component.setup = { ...incomplete, complete: true, missing: [] };
      fixture.detectChanges();
      expect(banner()).toBeNull();
      component.setup = { applies: false, complete: true, missing: [], total: 0 };
      fixture.detectChanges();
      expect(banner()).toBeNull();
      component.setup = null;
      fixture.detectChanges();
      expect(banner()).toBeNull();
    });

    it('asks the API for the status when the editor opens', () => {
      const spy = spyOn(TestBed.inject(CvSetupService), 'check').and.returnValue(of(incomplete));
      component.ngOnInit();
      expect(spy).toHaveBeenCalledWith(true);
      expect(component.setup).toEqual(incomplete);
    });

    it('once the CV is finished it opens the app at /DEF-USERS/home', () => {
      spyOn(TestBed.inject(CvSetupService), 'check').and.returnValue(of({ applies: true, complete: true, missing: [], total: 9 }));
      const nav = spyOn(TestBed.inject(Router), 'navigate').and.returnValue(Promise.resolve(true));
      component.previewAndFinish2();
      expect(nav).toHaveBeenCalledWith(['/DEF-USERS/home']);
      expect(component.setup?.complete).toBeTrue();
    });

    it('if the API says it is still unfinished, it stays on the editor and says what is missing', () => {
      spyOn(TestBed.inject(CvSetupService), 'check').and.returnValue(of(incomplete));
      const nav = spyOn(TestBed.inject(Router), 'navigate').and.returnValue(Promise.resolve(true));
      const warn = spyOn(TestBed.inject(NotificationsService), 'toastrWarning');
      component.previewAndFinish2();
      expect(nav).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledWith('Your CV is still missing: Summary, Date of birth.');
    });

    it('a failed status check does not trap the user on the editor after they finished', () => {
      spyOn(TestBed.inject(CvSetupService), 'check').and.returnValue(throwError(() => new Error('offline')));
      const nav = spyOn(TestBed.inject(Router), 'navigate').and.returnValue(Promise.resolve(true));
      component.previewAndFinish2();
      expect(nav).toHaveBeenCalledWith(['/DEF-USERS/home']);
    });
  });
});
