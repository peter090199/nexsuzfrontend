// import { Component, Inject, OnInit, OnDestroy, Optional, ViewChild } from '@angular/core';
// import { FormGroup, Validators, FormBuilder, FormControl } from '@angular/forms';
// import { MAT_DIALOG_DATA } from '@angular/material/dialog';
// import { MatStepper } from '@angular/material/stepper';
// import { Router, ActivatedRoute } from '@angular/router';
// import { Observable, Subject } from 'rxjs';
// import { map, startWith } from 'rxjs/operators';

// import { CountryCodesService } from 'src/app/services/country-codes.service';
// import { NotificationsService } from 'src/app/services/Global/notifications.service';
// import { JobPostingService } from 'src/app/services/Jobs/job-posting.service';
// import { ProfileService } from 'src/app/services/Profile/profile.service';
// import { AppliedQuestionsService } from 'src/app/services/Jobs/applied-questions.service';

// @Component({
//   selector: 'app-apply-job',
//   templateUrl: './apply-job.component.html',
//   styleUrls: ['./apply-job.component.css']
// })
// export class ApplyJobComponent implements OnInit, OnDestroy {
//   @ViewChild('stepper') stepper!: MatStepper;

//   profiles: any;
//   imageForm!: FormGroup;
//   personalForm!: FormGroup;
//   companyForm!: FormGroup; // ⚠️ Not used in HTML, you may remove if not needed

//   btnSave = "Save All";
//   loading = false;
//   fileError: string | null = null;

//   selectedFile: File | null = null;
//   resumeName: string | null = null;

//   progressValue: number = 0;

//   countryCodes: { label: string; value: string }[] = [];
//   countryControl: FormControl = new FormControl('');
//   filteredCountryCodes!: Observable<{ label: string; value: string }[]>;

//   private _onDestroy = new Subject<void>();

//   job: any = null;
//   questions: any[] = [];
//   transNo: any;
//   responseMessage: string = "";
//   isPhoneValid: boolean = false;

//   constructor(
//     private fb: FormBuilder,
//     @Inject(MAT_DIALOG_DATA) @Optional() public data: any,
//     private notificationService: NotificationsService,
//     private jobServices: JobPostingService,
//     private router: Router,
//     private profileService: ProfileService,
//     private appliedService: AppliedQuestionsService,
//     private countrycodeServices: CountryCodesService,
//     private route: ActivatedRoute
//   ) {

//   }

//   ngOnInit(): void {
//     this.transNo = this.route.snapshot.paramMap.get('transNo');
//     if (this.transNo) {
//       this.fetchJobPosting(this.transNo);
//     }

//     this.imageForm = this.fb.group({
//       resume: [null, Validators.required]
//     });

//     this.personalForm = this.fb.group({
//       email: ['', [Validators.required, Validators.email]],
//       country_code: ['', Validators.required],
//       phone_number: [''],
//       answers: this.fb.array(this.questions.map(() => this.fb.control('', Validators.required)))
//     });
//     this.loadCountryCodes();
//     this.loadProfile();

//     this.progressValue = this.getProgressValue(0);

//     if (this.data?.id) {
//       this.btnSave = "Update";
//       this.fillFormData();
//     }

//     this.filteredCountryCodes = this.countryControl.valueChanges.pipe(
//       startWith(''),
//       map(value => this._filter(value || ''))
//     );
//   }

//   fetchJobPosting(transNo: string): void {
//     this.loading = true;
//     this.appliedService.getJobPostingByTransNo(transNo).subscribe({
//       next: (res) => {
//         if (res.success) {
//           this.job = res.job;
//           this.questions = (res.questions || []).map((q: any) => ({ ...q, answer: '' }));
//         }
//         this.loading = false;
//       },
//       error: () => {
//         this.loading = false;
//       }
//     });
//   }


//   areAllQuestionsAnswered(): boolean {
//     return this.questions.every((q: any) => {
//       return q.answer !== null && q.answer !== undefined && q.answer !== '';
//     });
//   }

//   loadProfile(): void {
//     this.profileService.getProfileByUserOnly().subscribe({
//       next: (res) => {
//         if (res?.success) {
//           const profile = res.message;
//           this.profiles = profile;
//           this.personalForm.patchValue({
//             email: profile.email || '',
//             phone_number: profile.contact_no || ''
//           });
//         }
//       }
//     });
//   }

//   loadCountryCodes(): void {
//     this.countrycodeServices.loadCountryCodes().subscribe({
//       next: (res) => {
//         if (res?.phones) {
//           this.countryCodes = Object.entries(res.phones).map(([code, dial]: any) => ({
//             label: `${code} (+${dial})`,
//             value: `+${dial}`
//           }));
//         }
//       },
//       error: () => {
//         this.countryCodes = [];
//       }
//     });
//   }

//   private _filter(value: string): { label: string; value: string }[] {
//     const filterValue = value.toLowerCase().trim();
//     return this.countryCodes.filter(c =>
//       c.label.toLowerCase().includes(filterValue) || c.value.includes(filterValue)
//     );
//   }

//   onUploadResume(event: Event): void {
//     const input = event.target as HTMLInputElement;
//     if (!input.files?.length) return;

//     const file = input.files[0];
//     if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
//       this.fileError = 'Only PDF files are allowed.';
//       this.resumeName = null;
//       this.selectedFile = null;
//       this.imageForm.reset();
//       return;
//     }

//     this.fileError = null;
//     this.resumeName = file.name;
//     this.selectedFile = file;
//     this.imageForm.patchValue({ resume: file });
//   }

//   fillFormData(): void {
//     if (this.data) {
//       this.personalForm.patchValue({
//         email: this.data.email || '',
//         country_code: this.data.country_code || '',
//         phone_number: this.data.phone_number || ''
//       });
//     }
//   }

//   getProgressValue(stepIndex: number): number {
//     const totalSteps = 3;
//     return ((stepIndex + 1) / totalSteps) * 100;
//   }

//   nextStep(stepper?: MatStepper): void { (stepper || this.stepper).next(); }
//   previousStep(stepper?: MatStepper): void { (stepper || this.stepper).previous(); }

//   onStepChange(event: any): void {
//     this.progressValue = this.getProgressValue(event.selectedIndex ?? 0);
//   }

//   onCheckCountryCode(): void {
//     this.responseMessage = '';

//     if (this.personalForm.invalid) {
//       this.responseMessage = '⚠️ Please fill out all fields correctly';
//       this.showPopup(this.responseMessage);
//       return;
//     }

//     const { country_code, phone_number } = this.personalForm.value;
//     console.log('Country Code:', country_code, 'Phone Number:', phone_number);
//     return;

//     this.countrycodeServices.validatePhone(country_code, phone_number).subscribe({
//       next: (res) => {
//         if (res.success) {
//           this.responseMessage = '';
//           this.nextStep(this.stepper);
//         } else {
//           this.responseMessage = res.message;

//           // Optionally map field-specific errors
//           if (res.errors?.phone_number) {
//             this.personalForm.get('phone_number')?.setErrors({ invalidPhone: true });
//           }

//           this.showPopup(this.responseMessage);
//         }
//       },
//       error: (err) => {
//         if (err.status === 404) {
//           this.responseMessage = 'Invalid country code or phone number';
//         } else {
//           this.responseMessage = 'Server error, try again later';
//         }
//         this.showPopup(this.responseMessage);
//       }
//     });
//   }

//   proceedToNext(stepper: any): void {
//     if (this.isPhoneValid) {
//       this.nextStep(stepper);
//     } else {
//       this.showPopup('⚠️ Please validate your phone number first.');
//     }
//   }

//   showPopup(message: string): void {
//     if (message) this.notificationService.toastrWarning(message);
//   }

//   countryPatterns: { [key: string]: RegExp } = {
//     '+63': /^[9]\d{9}$/,            // Philippines (10 digits starting with 9)
//     '+1': /^[2-9]\d{9}$/,           // USA/Canada (10 digits)
//     '+91': /^[6-9]\d{9}$/,          // India (10 digits starting 6–9)
//     '+44': /^\d{10}$/,              // UK (10 digits, simplify for demo)
//   };


//   /** When user selects an autocomplete option, set the form value (bind in template) */
//   onCountrySelected(selectedLabel: string): void {
//     const found = this.countryCodes.find(
//       c => c.label === selectedLabel || c.value === selectedLabel
//     );
//     if (found) {
//       // Remove the + from the value
//       const numericCode = found.value.replace('+', '');
//       this.personalForm.patchValue({ country_code: numericCode });

//       // dynamically update phone_number validator based on selected country
//       const pattern = this.countryPatterns[found.value] || /^[0-9]{7,15}$/;
//       this.personalForm.get('phone_number')?.setValidators([
//         Validators.required,
//         Validators.pattern(pattern)
//       ]);
//       this.personalForm.get('phone_number')?.updateValueAndValidity();
//     }
//   }

//   onSubmit(): void {
//     if (this.personalForm.invalid) {
//       this.notificationService.toastrError("Please complete all required personal fields.");
//       return;
//     }
//     if (!this.selectedFile) {
//       this.notificationService.toastrError("Please upload your resume (PDF).");
//       return;
//     }
//     if (!this.areAllQuestionsAnswered()) {
//       this.notificationService.toastrError("Please answer all questions.");
//       return;
//     }

//     this.loading = true;

//     const formData = new FormData();
//     formData.append('resume_pdf', this.selectedFile as File);
//     formData.append('job_name', this.job?.job_name || '');
//     formData.append('email', this.personalForm.value.email);
//     formData.append('country_code', this.personalForm.value.country_code);
//     formData.append('phone_number', this.personalForm.value.phone_number);
//     formData.append('transNo', this.job?.transNo || `TR-${Date.now()}`);

//     // ✅ Append answers properly
//     this.questions.forEach((q, index) => {
//       formData.append(`answers[${index}][question_id]`, String(q.question_id));
//       formData.append(`answers[${index}][answer_text]`, q.answer || '');
//     });


//     // Debug check
//     for (let pair of (formData as any).entries()) {
//       console.log(pair[0], pair[1]);
//     }

//     this.appliedService.saveAppliedJob(formData).subscribe({
//       next: (res: any) => {
//         this.notificationService.toastrSuccess(res.message || "Application submitted");
//         this.loading = false;
//         this.router.navigate(['/recommended-jobs', res.transNo]);
//       },
//       error: (err: any) => {
//         this.notificationService.toastrError(err.error?.message || "Error saving application");
//         this.loading = false;
//       }
//     });
//   }

//   ngOnDestroy(): void {
//     this._onDestroy.next();
//     this._onDestroy.complete();
//   }
// }


import {
  Component,
  Inject,
  OnInit,
  OnDestroy,
  Optional,
  ViewChild,
  HostListener
} from '@angular/core';

import {
  FormGroup,
  Validators,
  FormBuilder,
  FormControl
} from '@angular/forms';

import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatStepper } from '@angular/material/stepper';
import { Router, ActivatedRoute } from '@angular/router';

import { Observable, Subject } from 'rxjs';
import { finalize, map, startWith } from 'rxjs/operators';

import { CountryCodesService } from 'src/app/services/country-codes.service';
import { NotificationsService } from 'src/app/services/Global/notifications.service';
import { JobPostingService } from 'src/app/services/Jobs/job-posting.service';
import { ProfileService } from 'src/app/services/Profile/profile.service';
import { AppliedQuestionsService } from 'src/app/services/Jobs/applied-questions.service';
import { SharedRoutinesService } from 'src/app/services/Function/shared-routines.service';
import { UserResumeService, UserResume } from 'src/app/services/user-resume.service';
import { FeatureService } from 'src/app/services/AccountPlan/feature.service';
import { FEATURE } from 'src/app/services/AccountPlan/feature-access.map';
import { CountryDial, PhoneSplit, buildCountryDials, cleanPhone, countryLabel, dialDigits, splitPhone, tidyNational, withoutRepeatedDial } from './phone-split';

@Component({
  selector: 'app-apply-job',
  templateUrl: './apply-job.component.html',
  styleUrls: ['./apply-job.component.css']
})
export class ApplyJobComponent implements OnInit, OnDestroy {
  @ViewChild('stepper') stepper!: MatStepper;

  profiles: any;

  imageForm!: FormGroup;
  personalForm!: FormGroup;

  btnSave = "Submit Application";
  loading = false;
  fileError: string | null = null;

  selectedFile: File | null = null;
  resumeName: string | null = null;

  progressValue: number = 0;

  countryCodes: { label: string; value: string }[] = [];
  countryControl: FormControl = new FormControl('');
  filteredCountryCodes!: Observable<{ label: string; value: string }[]>;
  /** the country list with ISO, dial code and name: what the profile's phone number is matched against */
  countryDials: CountryDial[] = [];
  private phoneMatched = false;

  private _onDestroy = new Subject<void>();

  job: any = null;
  questions: any[] = [];
  transNo: any;
  loadError: string | null = null;      // the job could not be opened at all
  closedReason: string | null = null;   // set when the job no longer accepts applications
  allowCv = true;

  isMobile = false;

  constructor(
    private fb: FormBuilder,
    @Inject(MAT_DIALOG_DATA) @Optional() public data: any,
    private notificationService: NotificationsService,
    private jobServices: JobPostingService,
    private router: Router,
    private profileService: ProfileService,
    private appliedService: AppliedQuestionsService,
    private countrycodeServices: CountryCodesService,
    private route: ActivatedRoute, public sharedRoutines: SharedRoutinesService,
    private resumeSvc: UserResumeService,
    private planFeatures: FeatureService
  ) { }

  // =========================
  // INIT
  // =========================
  ngOnInit(): void {
    this.checkScreen();

    this.transNo = this.route.snapshot.paramMap.get('transNo');

    this.initForms();

    this.loadCountryCodes();
    this.loadProfile();
    this.loadSavedResumes();

    if (this.transNo) {
      this.fetchJobPosting(this.transNo);
    }

    this.progressValue = this.getProgressValue(0);

    this.filteredCountryCodes = this.countryControl.valueChanges.pipe(
      startWith(''),
      map(value => this._filter(value || ''))
    );
  }

  initForms(): void {
    this.imageForm = this.fb.group({
      resume: [null, Validators.required]
    });

    this.personalForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      country_code: ['', Validators.required],
      phone_number: ['', Validators.required]
    });
  }

  // =========================
  // RESPONSIVE
  // =========================
  @HostListener('window:resize')
  checkScreen() {
    this.isMobile = window.innerWidth < 768;
  }

  // =========================
  // FETCH JOB + QUESTIONS
  // =========================
  fetchJobPosting(transNo: string): void {
    this.loading = true;
    this.loadError = null;
    this.appliedService.getJobPostingByTransNo(transNo).subscribe({
      next: (res: any) => {
        this.loading = false;
        if (!res) {
          this.notificationService.toastrError('No response from server.');
          return;
        }
        if (res.success) {
          this.job = res.job ?? {};
          this.closedReason = res.meta?.is_owner
            ? "This is your own job, so you can't apply to it."
            : (res.meta?.closed ? (res.meta.closed_reason || 'This job is no longer accepting applications.') : null);
          this.allowCv = this.job.allow_cv === null || this.job.allow_cv === undefined ? true : !!Number(this.job.allow_cv);
          if (!this.allowCv) { this.imageForm.get('resume')?.clearValidators(); this.imageForm.get('resume')?.updateValueAndValidity(); }
          this.questions = (res.questions ?? []).map((q: any) => ({
            ...q,
            answer: '',
            question_type: q.question_type || (q.answer_type === 'yes' || q.answer_type === 'no' ? 'yes_no' : 'long_text'),
            is_required: q.is_required === undefined ? true : !!Number(q.is_required),
            answer_type: q.answer_type ?? 'general'
          }));
        } else {
          this.loadError = res.message || 'Job not found.';
        }
      },

      error: (err: any) => {
        this.loading = false;
        this.loadError = err?.error?.message || err?.message || 'Unable to load this job.';

      }
    });
  }

  // =========================
  // VALIDATION
  // =========================
  retryLoad(): void { if (this.transNo) { this.fetchJobPosting(this.transNo); } }

  areAllQuestionsAnswered(): boolean {
    return this.questions.every(q => !q.is_required || (q.answer !== null && q.answer !== undefined && String(q.answer).trim() !== ''));
  }

  // =========================
  // PROFILE
  // =========================
  loadProfile(): void {
    this.profileService.getProfileByUserOnly().subscribe({
      next: (res: any) => {
        if (!res) {
          return;
        }
        if (res.success) {
          const profile = res.message ?? {};
          this.profiles = profile;
          this.personalForm.patchValue({
            email: profile.email ?? '',
            phone_number: profile.contact_no ?? ''
          });
          this.matchProfilePhone();          // splits it into country code + number as soon as the country list is also here
        }
      },
      error: (err: any) => {
        console.error(err);
      }

    });

  }

  // =========================
  // COUNTRY CODES
  // =========================
  loadCountryCodes(): void {
    this.countrycodeServices.loadCountryCodes().subscribe({
      next: (res: any) => {
        if (!res || !res.phones) {
          this.countryCodes = [];
          return;
        }
        this.countryCodes = Object.entries(res.phones).map(([code, dial]: any) => ({
          label: `${code} (+${dial})`,
          value: `+${dial}`
        }));
        this.countryDials = buildCountryDials(res.phones, res.names);
        this.matchProfilePhone();
      },
      error: (err: any) => {
        this.countryCodes = [];
      }

    });

  }
  private _filter(value: string) {
    const filterValue = value.toLowerCase();
    return this.countryCodes.filter(c =>
      c.label.toLowerCase().includes(filterValue) ||
      c.value.includes(filterValue)
    );
  }

  onCountrySelected(selectedLabel: string): void {
    const found = this.countryCodes.find(
      c => c.label === selectedLabel || c.value === selectedLabel
    );

    if (found) {
      this.personalForm.patchValue({
        country_code: found.value.replace('+', '')
      });
      this.tidyPhone();           // the number may repeat the code or start with a trunk 0
    }
  }

  // =========================
  // COUNTRY CODE + PHONE NUMBER THAT MATCH
  // =========================
  /**
   * The profile keeps one string ("+639171234567", "09171234567"). Split it once, when both the profile and the country list have loaded:
   * the country shows in the code selector and the number box holds only the national number, so the two always agree.
   */
  private matchProfilePhone(): void {
    if (this.phoneMatched || !this.profiles || !this.countryDials.length) { return; }
    this.phoneMatched = true;
    const raw = this.profiles.contact_no;
    if (!raw) { return; }
    this.applyPhone(splitPhone(String(raw), this.countryDials, this.profiles.home_country || this.profiles.current_location));
  }

  private applyPhone(s: PhoneSplit): void {
    if (s.country) {
      this.personalForm.patchValue({ country_code: s.country.dial });
      this.countryControl.setValue(countryLabel(s.country), { emitEvent: false });
    }
    this.personalForm.patchValue({ phone_number: s.national });
  }

  /**
   * Make the two fields agree. An international number typed or pasted in the phone box ("+63 917 123 4567") moves its code to the
   * selector; a repeated country code and a trunk "0" are dropped. Runs when the box loses focus, when a country is chosen, and
   * once more just before the application is sent.
   */
  tidyPhone(): void {
    const raw = String(this.personalForm.get('phone_number')?.value ?? '');
    if (!raw.trim()) { return; }
    const cc = String(this.personalForm.get('country_code')?.value ?? '');
    const cleaned = cleanPhone(raw);

    if (cleaned.startsWith('+') && this.countryDials.length) {
      const s = splitPhone(cleaned, this.countryDials, this.profiles?.home_country || this.profiles?.current_location);
      if (s.country) { this.applyPhone(s); return; }
    }
    const digits = tidyNational(withoutRepeatedDial(cleaned.replace(/\D/g, ''), cc), cc);
    if (digits !== raw) { this.personalForm.patchValue({ phone_number: digits }); }
  }
  // =========================
  // FILE UPLOAD
  // =========================
  // ---- the CVs saved in Settings > Resume / CV: exactly ONE is chosen for this application (or a new PDF is uploaded instead) ----
  /** every saved CV, the default first (the API's order) */
  savedResumes: UserResume[] = [];
  /** the saved CV chosen for this application; null when a new PDF was picked (or nothing yet) */
  selectedResumeId: number | null = null;
  resumesLoading = false;
  /** the CV being opened right now (its buttons wait) */
  openingResumeId: number | null = null;

  get selectedResume(): UserResume | null { return this.savedResumes.find(r => r.id === this.selectedResumeId) || null; }

  /** only a PDF can be sent with an application (the API refuses a Word file too) */
  canSend(r: UserResume): boolean { return r.type === 'pdf'; }

  /** what the Review step shows for the CV */
  get reviewCv(): string {
    if (this.selectedResume) { return `${this.selectedResume.name} (saved CV)`; }
    if (this.selectedFile) { return `${this.selectedFile.name} (new upload)`; }
    return 'No CV selected';
  }

  sizeText(bytes: number): string {
    if (!bytes) { return ''; }
    return bytes >= 1048576 ? (bytes / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(bytes / 1024)) + ' KB';
  }

  private loadSavedResumes(): void {
    // saved CVs are a plan feature: without it there is nothing to load (and the API would refuse), so the applicant uploads a PDF
    if (!this.planFeatures.allows(FEATURE.CREATE_RESUME)) { return; }
    this.resumesLoading = true;
    this.resumeSvc.list().subscribe({
      next: (res) => {
        this.resumesLoading = false;
        this.savedResumes = res?.data || [];
        // the default is chosen to start with (a Word default can't be sent, so the first PDF is); the applicant can pick any other
        const start = this.savedResumes.find(r => r.is_default && this.canSend(r)) || this.savedResumes.find(r => this.canSend(r)) || null;
        if (start && !this.selectedFile && this.selectedResumeId === null) { this.chooseResume(start.id); }
      },
      error: () => { this.resumesLoading = false; /* no saved CV (or offline): the applicant simply uploads one */ }
    });
  }

  /** choose ONE saved CV: a file picked for upload is dropped, so only one CV goes with the application */
  chooseResume(id: number): void {
    const r = this.savedResumes.find(x => x.id === id);
    if (!r || !this.canSend(r)) { return; }
    this.selectedResumeId = id;
    this.selectedFile = null;
    this.resumeName = r.name;
    this.fileError = null;
    const c = this.imageForm.get('resume');
    c?.clearValidators();
    c?.setValue(null);
    c?.updateValueAndValidity();
  }

  /** open a saved CV in a new tab. It is fetched with the sign-in header from the API of the current environment (local or production). */
  previewResume(r: UserResume): void { this.openResume(r, false); }

  downloadResume(r: UserResume): void { this.openResume(r, true); }

  private openResume(r: UserResume, download: boolean): void {
    if (this.openingResumeId !== null) { return; }
    this.openingResumeId = r.id;
    this.resumeSvc.file(r.id).subscribe({
      next: blob => {
        this.openingResumeId = null;
        const url = URL.createObjectURL(blob);
        if (!download && r.type === 'pdf') {
          window.open(url, '_blank', 'noopener');
        } else {
          const a = document.createElement('a');
          a.href = url; a.download = r.name; a.rel = 'noopener';
          document.body.appendChild(a); a.click(); a.remove();
        }
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      },
      error: () => {
        this.openingResumeId = null;
        this.notificationService.toastrError('The CV could not be opened. It may have been removed.');
      }
    });
  }

  onUploadResume(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      this.fileError = 'Only PDF files allowed';
      return;
    }

    this.fileError = null;
    this.selectedFile = file;
    this.resumeName = file.name;
    this.selectedResumeId = null;                 // a new PDF replaces the saved CV chosen before: one CV per application
    if (this.allowCv) { this.imageForm.get('resume')?.setValidators(Validators.required); }

    this.imageForm.patchValue({ resume: file });
    this.imageForm.get('resume')?.updateValueAndValidity();
  }

  // =========================
  // STEPPER
  // =========================
  getProgressValue(stepIndex: number): number {
    return ((stepIndex + 1) / 4) * 100;
  }

  nextStep(stepper?: MatStepper) {
    (stepper || this.stepper).next();
  }

  previousStep(stepper?: MatStepper) {
    (stepper || this.stepper).previous();
  }

  onStepChange(event: any) {
    this.progressValue = this.getProgressValue(event.selectedIndex ?? 0);
  }

  // =========================
  // SUBMIT
  // =========================


  // onSubmit(): void {

  //   if (this.personalForm.invalid) {
  //     this.notificationService.toastrError("Complete personal information.");
  //     return;
  //   }

  //   if (!this.selectedFile) {
  //     this.notificationService.toastrError("Please upload your resume.");
  //     return;
  //   }

  //   if (!this.areAllQuestionsAnswered()) {
  //     this.notificationService.toastrError("Please answer all questions.");
  //     return;
  //   }
  //   this.loading = true;
  //   const formData = new FormData();
  //   formData.append('resume_pdf', this.selectedFile);
  //   formData.append('job_name', this.job?.job_name ?? '');
  //   formData.append('email', this.personalForm.value.email ?? '');
  //   formData.append('country_code', this.personalForm.value.country_code ?? '');
  //   formData.append('phone_number', this.personalForm.value.phone_number ?? '');
  //   formData.append('transNo', this.job?.transNo ?? '');

  //   this.questions.forEach((q: any, index: number) => {

  //     formData.append(
  //       `answers[${index}][question_id]`,
  //       String(q.question_id ?? '')
  //     );

  //     formData.append(
  //       `answers[${index}][answer_text]`,
  //       q.answer ?? ''
  //     );

  //     formData.append(
  //       `answers[${index}][answer_type]`,
  //       q.answer_type ?? 'general'
  //     );

  //   });
  //   this.appliedService.saveAppliedJob(formData).subscribe({
  //     next: (res: any) => {
  //       this.loading = false;
  //       if (res.success == false) {
  //         this.notificationService.toastrError(res.message);
  //         return;
  //       }
  //       if (res.success == true) {
  //         this.notificationService.toastrSuccess(res.message);
  //         if (res.transNo) {
  //           this.router.navigate(['/recommended-jobs',res.transNo]);
  //         }
  //       } else {
  //         this.notificationService.toastrError(
  //           res.message ?? 'Application failed.'
  //         );
  //       }
  //     },
  //     error: (err: any) => {
  //       this.loading = false;
  //     }
  //   });
  // }

  onSubmit(): void {

    if (this.loading) {
      return;
    }

    if (this.personalForm.invalid) {
      this.notificationService.toastrError('Complete personal information.');
      return;
    }

    if (this.closedReason) {
      this.notificationService.toastrWarning(this.closedReason);
      return;
    }

    if (this.allowCv && !this.selectedFile && this.selectedResumeId === null) {
      this.notificationService.toastrError('Select one of your saved CVs or upload a PDF.');
      return;
    }
    if (!this.areAllQuestionsAnswered()) {
      this.notificationService.toastrError('Please answer all questions.');
      return;
    }
    this.tidyPhone();
    this.loading = true;
    const formData = new FormData();
    // exactly ONE CV: the new PDF, or the id of one saved CV (the API uses that CV's own file and checks it is yours)
    if (this.selectedFile) { formData.append('resume_pdf', this.selectedFile); }
    else if (this.selectedResumeId !== null && this.allowCv) { formData.append('resume_id', String(this.selectedResumeId)); }
    formData.append('job_name', this.job?.job_name || '');
    formData.append('email', this.personalForm.get('email')?.value || '');
    formData.append('country_code', this.personalForm.get('country_code')?.value || '');
    formData.append('phone_number', this.personalForm.get('phone_number')?.value || '');
    formData.append('transNo', this.job?.transNo || '');
    this.questions.forEach((question: any, index: number) => {
      formData.append(
        `answers[${index}][question_id]`,
        String(question.question_id)
      );
      formData.append(
        `answers[${index}][answer_text]`,
        question.answer === null || question.answer === undefined ? '' : String(question.answer)
      );
      formData.append(
        `answers[${index}][answer_type]`,
        question.answer_type ?? 'general'
      );
    });

    this.appliedService
      .saveAppliedJob(formData)
      .pipe(
        finalize(() => {
          this.loading = false;
        })
      )
      .subscribe({
        next: (res: any) => {
          if (!res.success) {
            this.notificationService.toastrWarning(
              res.message
            );
            return;
          }
          this.notificationService.toastrSuccess(res.message);
          if (res.transNo) {
            this.router.navigate(['/recommended-jobs', res.transNo]);
          }
        },

        error: (err) => {
          console.error(err);
          if (err.status === 422) {
            const errors = err.error.errors;
            if (errors) {
              Object.keys(errors).forEach(key => {
                this.notificationService.toastrWarning(errors[key][0]);
              });
            } else {
              this.notificationService.toastrWarning(err.error.message);
            }
            return;
          }
          if (err.status === 409) {
            this.notificationService.toastrWarning(err.error.message);
            return;
          }
          if (err.status === 403) {
            this.notificationService.toastrWarning(err.error.message);
            return;
          }
          this.notificationService.toastrError(
            err.error?.message || 'Something went wrong. Please try again.'
          );

        }

      });

  }

  ngOnDestroy(): void {
    this._onDestroy.next();
    this._onDestroy.complete();
  }
}