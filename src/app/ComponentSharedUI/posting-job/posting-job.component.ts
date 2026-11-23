import { Component, OnDestroy, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { AbstractControl, FormArray, FormBuilder, FormControl, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { MatChipInputEvent } from '@angular/material/chips';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { NotificationsService } from 'src/app/services/Global/notifications.service';
import { JobPostingService } from 'src/app/services/Jobs/job-posting.service';
import { AppliedQuestionsService } from 'src/app/services/Jobs/applied-questions.service';
import { ProfileService } from 'src/app/services/Profile/profile.service';
import { SharedRoutinesService, Currency } from 'src/app/services/Function/shared-routines.service';
import { JobPreviewModel, PreviewQuestion } from 'src/app/ComponentSharedUI/job-preview/job-preview.component';
import { JobTemplate, JobTemplateService } from 'src/app/services/Jobs/job-template.service';

/** Same limits the Laravel API enforces (JobPostingController::saveOrUpdateJobPosting). */
const IMAGE_TYPES = ['image/jpeg', 'image/png'];
const IMAGE_MAX_BYTES = 2 * 1024 * 1024;

type SaveMode = 'draft' | 'publish';

function salaryRange(group: AbstractControl): ValidationErrors | null {
  const min = group.get('min_salary')?.value, max = group.get('max_salary')?.value;
  return min !== null && min !== '' && max !== null && max !== '' && Number(max) < Number(min) ? { salaryRange: true } : null;
}

/** a multiple choice question needs two different options, and its correct answer must be one of them */
function questionRules(q: AbstractControl): ValidationErrors | null {
  const type = q.get('question_type')?.value;
  const correct = String(q.get('correct_answer')?.value ?? '').trim();
  const opts = ((q.get('options') as FormArray)?.value as string[] || []).map(o => (o || '').trim()).filter(o => o);

  if (type === 'multiple_choice') {
    if (new Set(opts).size < 2) { return { options: true }; }
    if (correct && !opts.includes(correct)) { return { correct: true }; }
  }
  if (type === 'numeric' && correct && isNaN(Number(correct))) { return { correct: true }; }
  return null;
}

/**
 * Post or edit a job (recruiter, DEF-CLIENT).
 *
 *  - sections: basics, description, requirements, application settings, screening questions
 *  - a live preview of the job as applicants will see it
 *  - Save as draft / Preview / Publish / Cancel; drafts can be reopened (?job=TR-000005) and edited
 *  - drafts are saved with only a title; publishing needs everything the API requires
 *
 * The Laravel API owns the rules (ownership, roles, validation); this page mirrors them for fast feedback.
 */
@Component({
  selector: 'app-posting-job',
  templateUrl: './posting-job.component.html',
  styleUrls: ['./posting-job.component.css']
})
export class PostingJobComponent implements OnInit, OnDestroy {
  @ViewChild('previewTpl') previewTpl!: TemplateRef<any>;

  readonly separatorKeys = [ENTER, COMMA];
  readonly today = new Date();
  readonly worktypes = [
    { value: 'Onsite', label: 'On-site' }, { value: 'Hybrid', label: 'Hybrid' }, { value: 'Work From Home', label: 'Remote' }
  ];
  readonly employmentTypes = ['Full-time', 'Part-time', 'Contract', 'Internship', 'Freelance'];
  readonly experienceLevels = ['Internship', 'Entry level', 'Associate', 'Mid-Senior level', 'Director', 'Executive'];
  readonly salaryPeriods = ['Hourly', 'Monthly', 'Yearly'];
  readonly questionTypes = [
    { value: 'yes_no', label: 'Yes / No', icon: 'toggle_on' },
    { value: 'multiple_choice', label: 'Multiple choice', icon: 'checklist' },
    { value: 'short_text', label: 'Short answer', icon: 'short_text' },
    { value: 'long_text', label: 'Long answer', icon: 'notes' },
    { value: 'numeric', label: 'Number', icon: 'pin' },
  ];

  currencies: Currency[] = [];
  form!: FormGroup;
  skills: string[] = [];

  /** null = a new job; otherwise the job being edited */
  transNo: string | null = null;
  status: 'new' | 'draft' | 'active' = 'new';
  questionsLocked = false;      // the job already has applicants: its questions can't change
  applications = 0;

  loadingJob = false;
  saving: SaveMode | null = null;
  drafts: any[] = [];

  selectedFile: File | null = null;
  imageUrl: string | null = null;        // preview of the new file or the job's saved image
  fileError: string | null = null;

  companyName = '';
  logoUrl: string | null = null;

  preview: JobPreviewModel = {};

  // job templates (published ones the poster may pick; the job's own template is added if it is no longer offered)
  templates: JobTemplate[] = [];
  defaultTemplateId: number | null = null;
  previewQuestions: PreviewQuestion[] = [];

  private subs = new Subscription();
  private previewDialog?: MatDialogRef<any>;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private dialog: MatDialog,
    private notify: NotificationsService,
    private jobServices: JobPostingService,
    private appliedService: AppliedQuestionsService,
    private profileService: ProfileService,
    private shared: SharedRoutinesService,
    private templateSvc: JobTemplateService
  ) { }

  // ------------------------------------------------------------------ lifecycle
  ngOnInit(): void {
    this.currencies = this.shared.getCurrencies();
    this.buildForm();
    this.loadAccount();
    this.loadDrafts();
    this.loadTemplates();

    this.subs.add(this.form.valueChanges.pipe(debounceTime(120)).subscribe(() => this.refreshPreview()));
    this.subs.add(this.route.queryParamMap.subscribe(p => {
      const job = p.get('job');
      if (job && job !== this.transNo) { this.loadJob(job); }
      if (!job && this.transNo) { this.resetToNew(); }
    }));
    this.refreshPreview();
  }

  ngOnDestroy(): void { this.subs.unsubscribe(); }

  private buildForm(): void {
    this.form = this.fb.group({
      // basics
      job_name: ['', [Validators.required, Validators.maxLength(255)]],
      job_position: ['', [Validators.required, Validators.maxLength(255)]],         // department / job category
      vacancies: [1, [Validators.required, Validators.min(1), Validators.max(10000)]],
      employment_type: ['', Validators.required],
      work_type: ['', Validators.required],                                         // workplace type
      location: ['', [Validators.required, Validators.maxLength(255)]],
      experience_level: [''],
      template_id: [null as number | null],
      salary: this.fb.group({
        currency: [this.shared.getDefaultCurrency()?.code || 'PHP', Validators.required],
        min_salary: ['', [Validators.required, Validators.min(0)]],
        max_salary: ['', [Validators.required, Validators.min(0)]],
        salary_period: ['Monthly'],
      }, { validators: salaryRange }),
      // description
      job_about: ['', Validators.required],
      job_description: ['', Validators.required],
      // requirements
      education: ['', Validators.maxLength(255)],
      qualification: ['', Validators.required],
      preferred_qualifications: ['', Validators.maxLength(5000)],
      benefits: ['', Validators.maxLength(2000)],
      // application settings
      application_deadline: [null as Date | null],
      allow_cv: [true],
      application_limit: [null as number | null, [Validators.min(1), Validators.max(100000)]],
      auto_screen: [false],
      min_pass_score: [null as number | null, [Validators.min(0), Validators.max(100)]],
      // screening questions
      questions: this.fb.array([]),
    });
    this.addQuestion();
  }

  // ------------------------------------------------------------------ small getters for the template
  get questions(): FormArray { return this.form.get('questions') as FormArray; }
  get salary(): FormGroup { return this.form.get('salary') as FormGroup; }
  get isEdit(): boolean { return !!this.transNo; }
  get isPublished(): boolean { return this.status === 'active'; }
  get busy(): boolean { return this.saving !== null || this.loadingJob; }
  get hasObjective(): boolean {
    return this.questions.controls.some(q => this.hasCorrect(q));
  }
  get symbol(): string { return this.shared.getCurrencyByCode(this.salary.get('currency')?.value)?.symbol || ''; }
  get benefitsLength(): number { return (this.form.get('benefits')?.value || '').length; }

  hasCorrect(q: AbstractControl): boolean {
    return ['yes_no', 'multiple_choice', 'numeric'].includes(q.get('question_type')?.value) && String(q.get('correct_answer')?.value ?? '').trim() !== '';
  }

  isInvalid(path: string): boolean {
    const c = this.form.get(path);
    return !!c && c.invalid && (c.touched || c.dirty);
  }

  // ------------------------------------------------------------------ account (company name + logo for the preview)
  private loadAccount(): void {
    this.profileService.getProfileByUserOnly().subscribe({
      next: (res: any) => {
        const m = res?.message;
        const row = Array.isArray(m) ? m[0] : m;
        this.companyName = row?.company || row?.fullname || '';
        this.refreshPreview();
      },
      error: () => { /* the preview just shows a placeholder name */ }
    });
    this.profileService.getProfileByBasicInfo().subscribe({
      next: (res: any) => { this.logoUrl = res?.data?.photo_pic || null; },
      error: () => { /* initials are shown instead */ }
    });
  }

  // ------------------------------------------------------------------ drafts
  loadDrafts(): void {
    this.jobServices.getJobPosting().subscribe({
      next: (res: any) => {
        this.drafts = (res?.jobs || []).filter((j: any) => j.recordstatus === 'draft')
          .sort((a: any, b: any) => String(b.updated_at || b.created_at).localeCompare(String(a.updated_at || a.created_at)));
      },
      error: () => { this.drafts = []; }
    });
  }

  openDraft(d: any): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { job: d.transNo } });
  }

  deleteDraft(d: any, ev: Event): void {
    ev.stopPropagation();
    this.notify.popupWarning(`Delete draft "${d.job_name}"?`, 'This cannot be undone.').then(r => {
      if (!r.isConfirmed) { return; }
      this.jobServices.deleteJobPosting(d.transNo).subscribe({
        next: (res: any) => {
          res?.success ? this.notify.toastrSuccess('Draft deleted.') : this.notify.toastrError(res?.message || 'Could not delete the draft.');
          if (d.transNo === this.transNo) { this.router.navigate([], { relativeTo: this.route, queryParams: {} }); }
          this.loadDrafts();
        },
        error: (err) => this.notify.toastrError(err?.error?.message || 'Could not delete the draft.')
      });
    });
  }

  // ------------------------------------------------------------------ load an existing job (draft or published) for editing
  private loadJob(transNo: string): void {
    this.loadingJob = true;
    this.appliedService.getJobPostingByTransNo(transNo).subscribe({
      next: (res: any) => {
        this.loadingJob = false;
        const meta = res?.meta;
        if (!res?.success || !meta?.is_owner) {
          this.notify.toastrError(res?.message || 'You can only edit your own jobs.');
          this.router.navigate([], { relativeTo: this.route, queryParams: {} });
          return;
        }
        this.fillForm(res.job, res.questions || [], meta);
      },
      error: (err) => {
        this.loadingJob = false;
        this.notify.toastrError(err?.error?.message || 'Could not open that job.');
        this.router.navigate([], { relativeTo: this.route, queryParams: {} });
      }
    });
  }

  private fillForm(job: any, qs: any[], meta: any): void {
    this.transNo = job.transNo;
    this.status = job.recordstatus === 'draft' ? 'draft' : 'active';
    this.questionsLocked = !!meta.questions_locked;
    this.applications = meta.applications || 0;
    this.selectedFile = null;
    this.fileError = null;
    this.imageUrl = job.job_image || null;
    this.skills = Array.isArray(job.required_skills) ? [...job.required_skills] : [];

    this.form.patchValue({
      job_name: job.job_name || '', job_position: job.job_position || '', vacancies: job.vacancies || 1,
      employment_type: job.employment_type || '', work_type: job.work_type || '', location: job.location || '',
      experience_level: job.experience_level || '',
      template_id: job.template_id ?? null,
      salary: {
        currency: job.currency || this.shared.getDefaultCurrency()?.code || 'PHP',
        min_salary: job.min_salary ?? '', max_salary: job.max_salary ?? '', salary_period: job.salary_period || 'Monthly'
      },
      job_about: job.job_about || '', job_description: job.job_description || '',
      education: job.education || '', qualification: job.qualification || '',
      preferred_qualifications: job.preferred_qualifications || '', benefits: job.benefits || '',
      application_deadline: job.application_deadline ? new Date(job.application_deadline + 'T00:00:00') : null,
      allow_cv: job.allow_cv === null || job.allow_cv === undefined ? true : !!Number(job.allow_cv),
      application_limit: job.application_limit ?? null,
      auto_screen: !!Number(job.auto_screen),
      min_pass_score: job.min_pass_score ?? null,
    }, { emitEvent: false });

    this.questions.clear();
    qs.forEach(q => this.questions.push(this.questionGroup(q)));
    if (!this.questions.length) { this.addQuestion(); }

    this.questionsLocked ? this.questions.disable({ emitEvent: false }) : this.questions.enable({ emitEvent: false });
    this.form.markAsPristine();
    this.ensureTemplateListed(job.template_id);
    this.refreshPreview();
  }

  private resetToNew(): void {
    this.transNo = null;
    this.status = 'new';
    this.questionsLocked = false;
    this.applications = 0;
    this.selectedFile = null;
    this.imageUrl = null;
    this.skills = [];
    this.form.reset({
      vacancies: 1, work_type: '', employment_type: '', allow_cv: true, auto_screen: false, template_id: this.defaultTemplateId,
      salary: { currency: this.shared.getDefaultCurrency()?.code || 'PHP', min_salary: '', max_salary: '', salary_period: 'Monthly' }
    });
    this.questions.clear();
    this.questions.enable({ emitEvent: false });
    this.addQuestion();
    this.refreshPreview();
  }

  // ------------------------------------------------------------------ image
  onUploadPhoto(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) { return; }

    if (!IMAGE_TYPES.includes(file.type)) { this.fileError = 'Use a JPG or PNG image.'; return; }
    if (file.size > IMAGE_MAX_BYTES) { this.fileError = 'The image must be 2 MB or smaller.'; return; }

    this.fileError = null;
    this.selectedFile = file;
    this.form.markAsDirty();
    const reader = new FileReader();
    reader.onload = () => { this.imageUrl = reader.result as string; this.refreshPreview(); };
    reader.readAsDataURL(file);
  }

  removeImage(): void {
    this.selectedFile = null;
    this.imageUrl = null;
    this.fileError = null;
    this.form.markAsDirty();
    this.refreshPreview();
  }

  // ------------------------------------------------------------------ skills (chips)
  addSkill(event: MatChipInputEvent): void {
    const value = (event.value || '').trim();
    if (value && value.length <= 60 && this.skills.length < 30 && !this.skills.some(s => s.toLowerCase() === value.toLowerCase())) {
      this.skills.push(value);
      this.form.markAsDirty();
      this.refreshPreview();
    }
    event.chipInput?.clear();
  }

  removeSkill(skill: string): void {
    this.skills = this.skills.filter(s => s !== skill);
    this.form.markAsDirty();
    this.refreshPreview();
  }

  // ------------------------------------------------------------------ screening questions
  private questionGroup(q?: any): FormGroup {
    const options = this.fb.array((Array.isArray(q?.options) ? q.options : []).map((o: string) => new FormControl(o)));
    const type = q?.question_type || this.legacyType(q);
    if (type === 'multiple_choice') { while (options.length < 2) { options.push(new FormControl('')); } }

    return this.fb.group({
      question_text: [q?.question_text || '', [Validators.required, Validators.maxLength(255)]],
      question_type: [type],
      options,
      is_required: [q?.is_required === undefined ? true : !!Number(q.is_required)],
      correct_answer: [q?.correct_answer || ''],
    }, { validators: questionRules });
  }

  /** questions created before the new types existed: Yes/No select or free text */
  private legacyType(q: any): string {
    return q && (q.answer_type === 'yes' || q.answer_type === 'no') ? 'yes_no' : (q ? 'long_text' : 'yes_no');
  }

  addQuestion(): void {
    if (this.questionsLocked) { return; }
    this.questions.push(this.questionGroup());
    this.form.markAsDirty();
  }

  removeQuestion(i: number): void {
    if (this.questionsLocked || this.questions.length <= 1) { return; }
    this.questions.removeAt(i);
    this.form.markAsDirty();
    this.refreshPreview();
  }

  move(i: number, delta: number): void {
    const j = i + delta;
    if (this.questionsLocked || j < 0 || j >= this.questions.length) { return; }
    moveItemInArray(this.questions.controls, i, j);
    this.questions.updateValueAndValidity();
    this.form.markAsDirty();
    this.refreshPreview();
  }

  drop(event: CdkDragDrop<any>): void {
    if (this.questionsLocked) { return; }
    moveItemInArray(this.questions.controls, event.previousIndex, event.currentIndex);
    this.questions.updateValueAndValidity();
    this.form.markAsDirty();
    this.refreshPreview();
  }

  optionsOf(q: AbstractControl): FormArray { return q.get('options') as FormArray; }

  onTypeChange(q: AbstractControl): void {
    const type = q.get('question_type')?.value;
    const options = this.optionsOf(q);
    q.get('correct_answer')?.setValue('');
    if (type === 'multiple_choice') {
      while (options.length < 2) { options.push(new FormControl('')); }
    } else {
      options.clear();
    }
  }

  addOption(q: AbstractControl): void {
    const opts = this.optionsOf(q);
    if (opts.length < 10) { opts.push(new FormControl('')); }
  }

  removeOption(q: AbstractControl, i: number): void {
    const opts = this.optionsOf(q);
    if (opts.length <= 2) { return; }
    const removed = String(opts.at(i).value || '').trim();
    opts.removeAt(i);
    if (removed && q.get('correct_answer')?.value === removed) { q.get('correct_answer')?.setValue(''); }
  }

  /** the options that can be marked correct (non-empty ones) */
  filledOptions(q: AbstractControl): string[] {
    return (this.optionsOf(q).value as string[]).map(o => (o || '').trim()).filter(o => o);
  }

  typeIcon(t: string): string { return this.questionTypes.find(x => x.value === t)?.icon || 'help_outline'; }

  // ------------------------------------------------------------------ templates
  private loadTemplates(): void {
    this.templateSvc.listPublished(true).subscribe({
      next: r => {
        this.templates = r.data;
        this.defaultTemplateId = r.default_id;
        // a new job starts on the default template; an edited job keeps the one it has
        const ctl = this.form.get('template_id');
        if (ctl && !ctl.value && !this.transNo && this.defaultTemplateId) { ctl.setValue(this.defaultTemplateId, { emitEvent: false }); }
        this.ensureTemplateListed(ctl?.value);
        this.refreshPreview();
      },
      error: () => { /* templates are optional: the job just uses the classic look */ }
    });
  }

  /** the job's current template may have been unpublished or deleted: still show it so it is not lost */
  private ensureTemplateListed(id: number | null | undefined): void {
    if (!id || this.templates.some(t => t.id === id)) { return; }
    this.templateSvc.get(id).subscribe(t => {
      if (t && !this.templates.some(x => x.id === t.id)) {
        this.templates = [...this.templates, { ...t, name: t.name + (t.status === 'published' ? '' : ' (no longer offered)') }];
        this.refreshPreview();
      }
    });
  }

  /** the template chosen in the form (drives the live preview) */
  get currentTemplate(): JobTemplate | null {
    const id = this.form?.get('template_id')?.value;
    return id ? (this.templates.find(t => t.id === id) || null) : null;
  }

  // ------------------------------------------------------------------ preview
  refreshPreview(): void {
    const v = this.form.getRawValue();
    this.preview = {
      job_name: v.job_name, job_position: v.job_position, location: v.location, work_type: v.work_type,
      employment_type: v.employment_type, experience_level: v.experience_level, vacancies: v.vacancies,
      currency: v.salary.currency, min_salary: v.salary.min_salary, max_salary: v.salary.max_salary, salary_period: v.salary.salary_period,
      job_about: v.job_about, job_description: v.job_description, qualification: v.qualification,
      preferred_qualifications: v.preferred_qualifications, education: v.education, required_skills: [...this.skills],
      benefits: v.benefits, application_deadline: v.application_deadline ? this.iso(v.application_deadline) : null, allow_cv: v.allow_cv,
    };
    this.previewQuestions = (v.questions || []).filter((q: any) => q.question_text || q.question_type).map((q: any) => ({
      question_text: q.question_text, question_type: q.question_type,
      options: (q.options || []).map((o: string) => (o || '').trim()).filter((o: string) => o), is_required: q.is_required
    }));
  }

  openPreview(): void {
    this.refreshPreview();
    this.previewDialog = this.dialog.open(this.previewTpl, { width: '760px', maxWidth: '96vw', maxHeight: '92vh', autoFocus: false });
  }

  closePreview(): void { this.previewDialog?.close(); }

  // ------------------------------------------------------------------ save / publish / cancel
  saveDraft(): void {
    if (this.busy || this.isPublished) { return; }
    const title = this.form.get('job_name')!;
    if (title.invalid) {
      title.markAsTouched();
      this.notify.toastrWarning('Give the draft a job title first.');
      return;
    }
    this.send('draft');
  }

  publish(): void {
    if (this.busy) { return; }

    this.form.markAllAsTouched();
    const problem = this.firstProblem();
    if (problem) { this.notify.toastrWarning(problem); this.scrollToFirstError(); return; }

    const editing = this.isPublished;
    this.notify.popupWarning(
      editing ? 'Save changes to this job?' : 'Publish this job?',
      editing
        ? 'Applicants will see the changes right away.'
        : 'It becomes visible to applicants right away. You can still edit it afterwards.'
    ).then(r => { if (r.isConfirmed) { this.send('publish'); } });
  }

  cancel(): void {
    const leave = () => this.router.navigate(['/' + this.shared.getRole(), 'vacancies']);
    if (!this.form.dirty) { leave(); return; }
    this.notify.popupWarning('Discard your changes?', 'Anything you have not saved will be lost.').then(r => { if (r.isConfirmed) { this.form.markAsPristine(); leave(); } });
  }

  /** what is still missing for a publish (the API checks the same things) */
  private firstProblem(): string | null {
    const f = this.form;
    if (f.get('job_name')!.invalid) { return 'Enter the job title.'; }
    for (const [k, label] of [['job_position', 'department or job category'], ['employment_type', 'employment type'], ['work_type', 'workplace type'], ['location', 'work location']]) {
      if (f.get(k)!.invalid) { return `Choose or enter the ${label}.`; }
    }
    if (f.get('vacancies')!.invalid) { return 'Enter the number of vacancies (at least 1).'; }
    if (this.salary.get('min_salary')!.invalid || this.salary.get('max_salary')!.invalid) { return 'Enter the minimum and maximum salary.'; }
    if (this.salary.hasError('salaryRange')) { return 'The maximum salary can\'t be lower than the minimum.'; }
    if (f.get('job_about')!.invalid) { return 'Write a short summary of the job.'; }
    if (f.get('job_description')!.invalid) { return 'Write the job description.'; }
    if (f.get('qualification')!.invalid) { return 'Describe the qualifications.'; }
    if (f.get('benefits')!.invalid || f.get('education')!.invalid || f.get('preferred_qualifications')!.invalid) { return 'A requirements field is too long.'; }
    if (f.get('application_limit')!.invalid) { return 'The application limit must be at least 1.'; }
    if (f.get('auto_screen')!.value) {
      if (f.get('min_pass_score')!.value === null || f.get('min_pass_score')!.invalid) { return 'Set a passing score (0-100) for automatic screening.'; }
      if (!this.questionsLocked && !this.hasObjective) { return 'Automatic screening needs at least one question with a correct answer.'; }
    }
    if (!this.questionsLocked) {
      if (!this.questions.length) { return 'Add at least one screening question.'; }
      const bad = this.questions.controls.findIndex(q => q.invalid);
      if (bad >= 0) {
        const q = this.questions.at(bad);
        if (q.hasError('options')) { return `Question ${bad + 1}: a multiple choice question needs at least two different options.`; }
        if (q.hasError('correct')) { return `Question ${bad + 1}: the correct answer must be one of the options (or a number).`; }
        return `Question ${bad + 1}: write the question.`;
      }
    }
    return null;
  }

  private scrollToFirstError(): void {
    setTimeout(() => (document.querySelector('.pj .ng-invalid.mat-form-field-invalid, .pj .mat-form-field-invalid') as HTMLElement | null)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  }

  private send(mode: SaveMode): void {
    this.saving = mode;
    const fd = this.payload(mode);

    const call = this.transNo ? this.jobServices.updateJobPosting(fd, this.transNo) : this.jobServices.saveJobPosting(fd);
    call.subscribe({
      next: (res: any) => {
        this.saving = null;
        if (!res?.success) { this.notify.toastrError(this.firstError(res)); return; }

        if (mode === 'publish') {
          this.notify.toastrSuccess(res.message || 'Job saved successfully');
          this.form.markAsPristine();
          this.router.navigate(['/' + this.shared.getRole(), 'vacancies']);
          return;
        }

        // draft saved: stay here, and keep editing THIS draft (so saving again never creates a second one)
        this.notify.toastrSuccess('Draft saved.');
        this.transNo = res.transNo;
        this.status = 'draft';
        this.selectedFile = null;
        this.form.markAsPristine();
        this.router.navigate([], { relativeTo: this.route, queryParams: { job: res.transNo }, replaceUrl: true });
        this.loadDrafts();
      },
      error: (err) => {
        this.saving = null;     // never leave the buttons stuck
        this.notify.toastrError(this.firstError(err?.error));
      }
    });
  }

  private payload(mode: SaveMode): FormData {
    const v = this.form.getRawValue();
    const fd = new FormData();
    const put = (k: string, val: any) => fd.append(k, val === null || val === undefined ? '' : String(val).trim());

    fd.append('status', mode);
    ['job_name', 'job_position', 'vacancies', 'employment_type', 'work_type', 'location', 'experience_level', 'job_about', 'job_description',
      'education', 'qualification', 'preferred_qualifications', 'benefits'].forEach(k => put(k, v[k]));
    put('currency', v.salary.currency);
    put('min_salary', v.salary.min_salary);
    put('max_salary', v.salary.max_salary);
    put('salary_period', v.salary.salary_period);
    if (v.template_id) { put('template_id', v.template_id); }

    put('application_deadline', v.application_deadline ? this.iso(v.application_deadline) : '');
    put('application_limit', v.application_limit);
    fd.append('allow_cv', v.allow_cv ? '1' : '0');
    fd.append('auto_screen', v.auto_screen ? '1' : '0');
    put('min_pass_score', v.auto_screen ? v.min_pass_score : '');

    this.skills.forEach((s, i) => fd.append(`required_skills[${i}]`, s));
    if (this.selectedFile) { fd.append('job_image', this.selectedFile); }

    if (!this.questionsLocked) {
      (v.questions as any[]).forEach((q, i) => {
        if (!q.question_text || !String(q.question_text).trim()) { return; }     // an empty row is simply not saved
        fd.append(`question_text[${i}]`, String(q.question_text).trim());
        fd.append(`question_type[${i}]`, q.question_type);
        fd.append(`is_required[${i}]`, q.is_required ? '1' : '0');
        fd.append(`correct_answer[${i}]`, String(q.correct_answer ?? '').trim());
        (q.options || []).map((o: string) => (o || '').trim()).filter((o: string) => o).forEach((o: string, j: number) => fd.append(`options[${i}][${j}]`, o));
      });
    }
    return fd;
  }

  private iso(d: Date): string {
    const x = new Date(d);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  }

  /** the first validation message the API returned, else its general message */
  private firstError(body: any): string {
    const errors = body?.errors;
    if (errors) {
      const first = Object.values(errors)[0] as string[] | string;
      return Array.isArray(first) ? first[0] : String(first);
    }
    return body?.message || 'Could not save the job. Please try again.';
  }

  trackIdx(i: number): number { return i; }
}
