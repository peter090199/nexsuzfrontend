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
    this.loadDefaultResume();

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
    }
  }

  // =========================
  // FILE UPLOAD
  // =========================
  // ---- the resume saved in Settings > Resume / CV (the default one is used unless a different file is chosen) ----
  defaultResume: UserResume | null = null;
  useDefaultResume = false;
  /** the default resume is a Word file: it cannot go with an application, so a PDF is asked for */
  defaultResumeIsWord = false;

  private loadDefaultResume(): void {
    // saved resumes are a plan feature: without it there is nothing to load (and the API would refuse), so the applicant uploads a PDF
    if (!this.planFeatures.allows(FEATURE.CREATE_RESUME)) { return; }
    this.resumeSvc.list().subscribe({
      next: (res) => {
        const d = (res?.data || []).find(r => r.is_default) || null;
        // only a PDF can be sent to a recruiter: a Word default is not used (the server refuses it too)
        this.defaultResumeIsWord = !!d && d.type !== 'pdf';
        this.defaultResume = d && d.type === 'pdf' ? d : null;
        if (this.defaultResume && !this.selectedFile) { this.applyDefaultResume(); }
      },
      error: () => { /* no saved resume (or offline): the applicant simply uploads one */ }
    });
  }

  private applyDefaultResume(): void {
    if (!this.defaultResume) { return; }
    this.useDefaultResume = true;
    this.selectedFile = null;
    this.resumeName = this.defaultResume.name;
    this.fileError = null;
    const c = this.imageForm.get('resume');
    c?.clearValidators();
    c?.setValue(null);
    c?.updateValueAndValidity();
  }

  /** go back to the saved default after choosing a different file */
  switchToDefaultResume(): void { this.applyDefaultResume(); }

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
    this.useDefaultResume = false;
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

    if (this.allowCv && !this.selectedFile && !this.useDefaultResume) {
      this.notificationService.toastrError('Please upload your resume.');
      return;
    }
    if (!this.areAllQuestionsAnswered()) {
      this.notificationService.toastrError('Please answer all questions.');
      return;
    }
    this.loading = true;
    const formData = new FormData();
    if (this.selectedFile) { formData.append('resume_pdf', this.selectedFile); }
    else if (this.useDefaultResume && this.allowCv) { formData.append('use_default_resume', '1'); }
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