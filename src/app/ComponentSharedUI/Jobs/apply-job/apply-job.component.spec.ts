import { NexsuzTestingModule } from 'src/testing/nexsuz-testing.module';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { UserResume } from 'src/app/services/user-resume.service';
import { buildCountryDials } from './phone-split';

import { ApplyJobComponent } from './apply-job.component';

describe('ApplyJobComponent', () => {
  let component: ApplyJobComponent;
  let fixture: ComponentFixture<ApplyJobComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NexsuzTestingModule],
      schemas: [NO_ERRORS_SCHEMA],
      declarations: [ ApplyJobComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ApplyJobComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
  describe('choosing ONE CV for the application', () => {
    const resume = (id: number, over: Partial<UserResume> = {}): UserResume =>
      ({ id, name: `cv${id}.pdf`, size: 120000, is_default: false, type: 'pdf', created_at: '2026-11-20 10:00:00', ...over });
    let save: jasmine.Spy;
    let toastError: jasmine.Spy;

    /** the Apply form as a signed-in applicant would have it: personal details done, job loaded, plan allows saved CVs */
    function ready(list: UserResume[], plan = true) {
      spyOn((component as any).planFeatures, 'allows').and.returnValue(plan);
      spyOn((component as any).resumeSvc, 'list').and.returnValue(of({ success: true, data: list }));
      save = spyOn((component as any).appliedService, 'saveAppliedJob').and.returnValue(of({ success: true, message: 'ok' }));
      toastError = spyOn((component as any).notificationService, 'toastrError');
      component.job = { job_name: 'ZZ Job', transNo: 'TR-000006' };
      component.questions = [];
      component.allowCv = true;
      component.personalForm.patchValue({ email: 'a@b.test', country_code: '63', phone_number: '9171234567' });
      (component as any).loadSavedResumes();
    }
    const sentBody = () => save.calls.mostRecent().args[0] as FormData;
    const pdf = (name = 'new.pdf') => new File(['x'], name, { type: 'application/pdf' });

    it('starts with the default CV chosen and lists them all', () => {
      ready([resume(1), resume(2, { is_default: true }), resume(3)]);
      expect(component.savedResumes.length).toBe(3);
      expect(component.selectedResumeId).toBe(2);
      expect(component.resumeName).toBe('cv2.pdf');
      expect(component.imageForm.valid).toBeTrue();
    });

    it('a Word default is not chosen: the first PDF is', () => {
      ready([resume(1, { is_default: true, type: 'docx', name: 'cv.docx' }), resume(2)]);
      expect(component.selectedResumeId).toBe(2);
      expect(component.canSend(component.savedResumes[0])).toBeFalse();
    });

    it('lists nothing when the plan has no saved CVs (the applicant uploads a PDF)', () => {
      ready([resume(1)], false);
      expect((component as any).resumeSvc.list).not.toHaveBeenCalled();
      expect(component.savedResumes).toEqual([]);
      expect(component.selectedResumeId).toBeNull();
    });

    it('the applicant can pick any other saved CV, and exactly one is selected at a time', () => {
      ready([resume(1, { is_default: true }), resume(2), resume(3)]);
      component.chooseResume(3);
      expect(component.selectedResumeId).toBe(3);
      expect(component.selectedResume!.name).toBe('cv3.pdf');
      component.chooseResume(2);
      expect(component.selectedResumeId).toBe(2);
    });

    it('a Word CV can not be chosen', () => {
      ready([resume(1, { is_default: true }), resume(2, { type: 'docx', name: 'w.docx' })]);
      component.chooseResume(2);
      expect(component.selectedResumeId).toBe(1);
    });

    it('uploading a new PDF drops the saved CV, and choosing a saved CV drops the upload: one CV per application', () => {
      ready([resume(1, { is_default: true }), resume(2)]);
      component.onUploadResume({ target: { files: [pdf('fresh.pdf')] } } as any);
      expect(component.selectedResumeId).toBeNull();
      expect(component.selectedFile!.name).toBe('fresh.pdf');
      expect(component.reviewCv).toBe('fresh.pdf (new upload)');

      component.chooseResume(2);
      expect(component.selectedFile).toBeNull();
      expect(component.selectedResumeId).toBe(2);
      expect(component.reviewCv).toBe('cv2.pdf (saved CV)');
    });

    it('submits ONLY the id of the chosen CV: no file, no default flag', () => {
      ready([resume(1, { is_default: true }), resume(2)]);
      component.chooseResume(2);
      component.onSubmit();
      const b = sentBody();
      expect(b.get('resume_id')).toBe('2');
      expect(b.has('resume_pdf')).toBeFalse();
      expect(b.has('use_default_resume')).toBeFalse();
      expect(b.get('transNo')).toBe('TR-000006');
    });

    it('a new upload is sent as the file and without a resume id', () => {
      ready([resume(1, { is_default: true })]);
      component.onUploadResume({ target: { files: [pdf('fresh.pdf')] } } as any);
      component.onSubmit();
      const b = sentBody();
      expect((b.get('resume_pdf') as File).name).toBe('fresh.pdf');
      expect(b.has('resume_id')).toBeFalse();
    });

    it('will not submit with no CV chosen when the job needs one', () => {
      ready([]);
      component.onSubmit();
      expect(save).not.toHaveBeenCalled();
      expect(toastError).toHaveBeenCalledWith('Select one of your saved CVs or upload a PDF.');
    });

    it('a job that does not ask for a CV needs none and sends none', () => {
      ready([resume(1, { is_default: true })]);
      component.allowCv = false;
      component.onSubmit();
      expect(save).toHaveBeenCalled();
      expect(sentBody().has('resume_id')).toBeFalse();
      expect(sentBody().has('resume_pdf')).toBeFalse();
    });

    it('Preview opens the PDF in a tab and Download saves it, both through the API of the current environment', () => {
      ready([resume(1, { is_default: true })]);
      const file = spyOn((component as any).resumeSvc, 'file').and.returnValue(of(new Blob(['%PDF'], { type: 'application/pdf' })));
      const open = spyOn(window, 'open');
      const url = spyOn(URL, 'createObjectURL').and.returnValue('blob:x');
      const click = spyOn(HTMLAnchorElement.prototype, 'click');
      const r = component.savedResumes[0];

      component.previewResume(r);
      expect(file).toHaveBeenCalledWith(1);
      expect(open).toHaveBeenCalledWith('blob:x', '_blank', 'noopener');
      expect(component.openingResumeId).toBeNull();

      component.downloadResume(r);
      expect(click).toHaveBeenCalled();
      expect(url).toHaveBeenCalledTimes(2);
    });

    it('a CV that can not be opened shows a message and frees the buttons', () => {
      ready([resume(1, { is_default: true })]);
      spyOn((component as any).resumeSvc, 'file').and.returnValue(throwError(() => ({ status: 404 })));
      component.previewResume(component.savedResumes[0]);
      expect(toastError).toHaveBeenCalledWith('The CV could not be opened. It may have been removed.');
      expect(component.openingResumeId).toBeNull();
    });

    it('shows each CV with its filename, upload date, size, type and Default badge, plus Preview and Download', () => {
      ready([resume(1, { is_default: true, name: 'Ana Admin CV.pdf', size: 2 * 1048576 }), resume(2, { name: 'Old CV.pdf', created_at: '2025-01-05 09:00:00' })]);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      const list = el.querySelector('[data-testid="saved-cvs"]') as HTMLElement;
      expect(list).not.toBeNull();
      const first = list.querySelector('[data-testid="cv-1"]')!.textContent!;
      expect(first).toContain('Ana Admin CV.pdf');
      expect(first).toContain('Default');
      expect(first).toContain('Nov 20, 2026');
      expect(first).toContain('2.0 MB');
      expect(first).toContain('PDF');
      const second = list.querySelector('[data-testid="cv-2"]')!.textContent!;
      expect(second).toContain('Jan 5, 2025');
      expect(second).not.toContain('Default');
      expect(list.querySelectorAll('[data-testid="preview"]').length).toBe(2);
      expect(list.querySelectorAll('[data-testid="download"]').length).toBe(2);
      expect(el.querySelector('[data-testid="upload-new"]')).not.toBeNull();
    });

    it('has layout rules that stack the CV rows and keep the buttons thumb-sized on a phone', () => {
      const css = ((ApplyJobComponent as any).ɵcmp.styles as string[]).join('\n');
      expect(css).toContain('aj-cv-acts');
      expect(css).toContain('flex: 1 1 0');
      expect(css).toContain('min-height: 42px');
      expect(css).toContain('grid-template-columns: minmax(0, 1fr)');
      expect(css).toContain('@media (max-width: 600px)');
    });
  });
  describe('country code and phone number match', () => {
    const phones = { PH: '63', US: '1', GB: '44' };
    const names = { PH: 'Philippines', US: 'United States', GB: 'United Kingdom' };
    const form = () => component.personalForm.value as any;

    function loaded(profile: any) {
      (component as any).profiles = profile;
      component.countryDials = buildCountryDials(phones, names);
      component.personalForm.patchValue({ phone_number: profile.contact_no });
      (component as any).matchProfilePhone();
    }

    it('splits an international profile number: the selector shows the country, the box only the number', () => {
      loaded({ contact_no: '+639171234567' });
      expect(form().country_code).toBe('63');
      expect(form().phone_number).toBe('9171234567');
      expect(component.countryControl.value).toBe('PH (+63)');
    });

    it('a local number takes the code of the country in the profile and loses the trunk 0', () => {
      loaded({ contact_no: '09171234567', home_country: 'Philippines' });
      expect(form().country_code).toBe('63');
      expect(form().phone_number).toBe('9171234567');
    });

    it('a local number with no known country is left for the person to match', () => {
      loaded({ contact_no: '09171234567' });
      expect(form().country_code).toBeFalsy();
      expect(form().phone_number).toBe('09171234567');
    });

    it('splits only once, so what the person then edits is not overwritten', () => {
      loaded({ contact_no: '+639171234567' });
      component.personalForm.patchValue({ phone_number: '9999999999' });
      (component as any).matchProfilePhone();
      expect(form().phone_number).toBe('9999999999');
    });

    it('a number pasted with its code moves the code to the selector', () => {
      component.countryDials = buildCountryDials(phones, names);
      component.personalForm.patchValue({ country_code: '1', phone_number: '+44 7911 123456' });
      component.tidyPhone();
      expect(form().country_code).toBe('44');
      expect(form().phone_number).toBe('7911123456');
      expect(component.countryControl.value).toBe('GB (+44)');
    });

    it('a repeated code and a trunk 0 are dropped when a country is chosen', () => {
      component.countryDials = buildCountryDials(phones, names);
      component.countryCodes = [{ label: 'PH (+63)', value: '+63' }];
      component.personalForm.patchValue({ phone_number: '0917 123 4567' });
      component.onCountrySelected('PH (+63)');
      expect(form().country_code).toBe('63');
      expect(form().phone_number).toBe('9171234567');
    });

    it('is tidied once more when the application is sent', () => {
      const save = spyOn((component as any).appliedService, 'saveAppliedJob').and.returnValue(of({ success: true, message: 'ok' }));
      component.job = { job_name: 'ZZ Job', transNo: 'TR-000006' };
      component.questions = [];
      component.allowCv = false;
      component.countryDials = buildCountryDials(phones, names);
      component.personalForm.patchValue({ email: 'a@b.test', country_code: '63', phone_number: '639171234567' });
      component.onSubmit();
      const b = save.calls.mostRecent().args[0] as FormData;
      expect(b.get('country_code')).toBe('63');
      expect(b.get('phone_number')).toBe('9171234567');
    });
  });
});