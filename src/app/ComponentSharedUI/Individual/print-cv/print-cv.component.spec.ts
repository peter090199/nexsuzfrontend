import { NexsuzTestingModule } from 'src/testing/nexsuz-testing.module';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';

import { CurriculumVitaeService } from 'src/app/services/CV/curriculum-vitae.service';
import { PrintCVComponent } from './print-cv.component';

describe('PrintCVComponent', () => {
  let component: PrintCVComponent;
  let fixture: ComponentFixture<PrintCVComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NexsuzTestingModule],
      schemas: [NO_ERRORS_SCHEMA],
      declarations: [ PrintCVComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PrintCVComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shares the link the API built, not a signed-in page of this browser', async () => {
    const service = TestBed.inject(CurriculumVitaeService);
    spyOn(service, 'getShareLink').and.returnValue(of({ success: true, url: 'https://www.nexsuz.com/cv/721/sig' }));
    const nativeShare = jasmine.createSpy('share').and.resolveTo();
    Object.defineProperty(navigator, 'share', { value: nativeShare, configurable: true });

    await component.share();
    delete (navigator as any).share;

    expect(nativeShare.calls.mostRecent().args[0].url).toBe('https://www.nexsuz.com/cv/721/sig');
  });
});

describe('PrintCVComponent opened from a share link', () => {
  let service: jasmine.SpyObj<CurriculumVitaeService>;

  function open(response: any): ComponentFixture<PrintCVComponent> {
    service = jasmine.createSpyObj<CurriculumVitaeService>('CurriculumVitaeService',
      ['getSharedCV', 'sharedCvUrl', 'getProfileCV', 'getDataCV', 'getShareLink']);
    service.getSharedCV.and.returnValue(response);
    TestBed.configureTestingModule({
      imports: [NexsuzTestingModule],
      schemas: [NO_ERRORS_SCHEMA],
      declarations: [PrintCVComponent],
      providers: [
        { provide: MatDialogRef, useValue: null }, // a routed page, not a dialog
        { provide: CurriculumVitaeService, useValue: service },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ code: '721', signature: 'sig' }) } } }
      ]
    });
    const fixture = TestBed.createComponent(PrintCVComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('loads that CV only, with none of the viewer\'s own data or owner buttons', () => {
    const fixture = open(of({ success: true, message: [{ code: 721, fname: 'Ann', lname: 'Lee', lines: {} }] }));
    const el: HTMLElement = fixture.nativeElement;

    expect(service.getSharedCV).toHaveBeenCalledWith('721', 'sig');
    expect(service.getProfileCV).not.toHaveBeenCalled();
    expect(service.getDataCV).not.toHaveBeenCalled();
    expect(el.querySelector('h1')?.textContent).toContain('Ann Lee');
    for (const label of ['Edit CV', 'Share CV', 'CV settings', 'Finish and save CV']) {
      expect(el.querySelector(`[aria-label="${label}"]`)).withContext(label).toBeNull();
    }
    expect(el.querySelector('[aria-label="Download CV as PDF"]')).not.toBeNull();
  });

  it('says so when the link is not valid, and never shows a cached CV', () => {
    localStorage.setItem('Headers', JSON.stringify([{ fname: 'Someone', lname: 'Else' }]));
    const fixture = open(throwError(() => ({ status: 404 })));
    const text = fixture.nativeElement.textContent;
    localStorage.removeItem('Headers');

    expect(text).toContain('not valid or the CV is no longer available');
    expect(text).not.toContain('Someone');
    expect(text).not.toContain('Edit CV');
  });
});
