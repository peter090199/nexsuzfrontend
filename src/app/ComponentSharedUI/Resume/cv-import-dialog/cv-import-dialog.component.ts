import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import {
  CvCertificate, CvEducation, CvExtraction, CvFailureCode, CvImportPayload, CvImportReport, CvJob, CvLanguage,
  CvProfileFields, CvSeminar, CvSkill, CvTraining, UserResume, UserResumeService
} from 'src/app/services/user-resume.service';

type Stage = 'extracting' | 'error' | 'preview' | 'saving' | 'done';

/** one extracted item in the preview: ticked or not, and whether it is already on the profile */
interface Row<T> { id: number; sel: boolean; exists: boolean; d: T; }

interface FieldDef { key: keyof CvProfileFields; label: string; icon: string; type: 'text' | 'date' | 'email' | 'tel' | 'area'; hint?: string; }

export interface CvImportDialogData { resume: UserResume; /** opened straight after an upload */ afterUpload?: boolean; }

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * The import preview. The API reads the uploaded CV (Laravel does the extraction and the validation); this dialog only
 * shows what it found, lets the person edit it and choose what to import, and sends the approved result back.
 * Nothing is saved until "Import selected". Closes with the import report, or null when nothing was imported.
 */
@Component({
  selector: 'app-cv-import-dialog',
  templateUrl: './cv-import-dialog.component.html',
  styleUrls: ['./cv-import-dialog.component.css']
})
export class CvImportDialogComponent implements OnInit, OnDestroy {
  stage: Stage = 'extracting';
  readonly steps = ['Reading your file…', 'Finding your details…', 'Preparing your preview…'];
  stepIndex = 0;
  private stepTimer?: any;

  failure: { code: CvFailureCode | 'network'; message: string } | null = null;
  warnings: string[] = [];
  report: CvImportReport | null = null;
  saveError = '';

  readonly months = MONTHS;
  readonly statuses = [{ v: 'graduate', l: 'Graduate' }, { v: 'undergraduate', l: 'Undergraduate' }, { v: 'ongoing', l: 'Ongoing' }];

  readonly fields: FieldDef[] = [
    { key: 'fname', label: 'First name', icon: 'badge', type: 'text' },
    { key: 'lname', label: 'Last name', icon: 'badge', type: 'text' },
    { key: 'email', label: 'Contact email', icon: 'email', type: 'email', hint: 'Saved as the contact email on your profile. Your sign-in email does not change.' },
    { key: 'contact_no', label: 'Contact number', icon: 'phone', type: 'tel' },
    { key: 'profession', label: 'Profession / job title', icon: 'work_outline', type: 'text' },
    { key: 'date_birth', label: 'Date of birth', icon: 'cake', type: 'date' },
    { key: 'home_country', label: 'Country', icon: 'public', type: 'text' },
    { key: 'current_location', label: 'Current location', icon: 'location_on', type: 'text' },
    { key: 'current_state', label: 'Current state / province', icon: 'map', type: 'text' },
    { key: 'home_state', label: 'Home state / province', icon: 'home', type: 'text' },
    { key: 'summary', label: 'Professional summary', icon: 'notes', type: 'area' },
  ];

  /** per profile field: tick, the (editable) value, and what the profile has now */
  profile: Record<string, { sel: boolean; value: string; current: string; same: boolean }> = {};
  education: Row<CvEducation>[] = [];
  jobs: Row<CvJob>[] = [];
  skills: Row<CvSkill>[] = [];
  languages: Row<CvLanguage>[] = [];
  training: Row<CvTraining>[] = [];
  seminars: Row<CvSeminar>[] = [];
  certificates: Row<CvCertificate>[] = [];

  setDefault = false;
  newSkill = '';
  newLanguage = '';
  private nextId = 1;

  constructor(
    private svc: UserResumeService,
    private ref: MatDialogRef<CvImportDialogComponent, CvImportReport | null>,
    @Inject(MAT_DIALOG_DATA) public data: CvImportDialogData
  ) { }

  ngOnInit(): void {
    this.setDefault = !!this.data.afterUpload && !this.data.resume.is_default;
    this.stepTimer = setInterval(() => { if (this.stepIndex < this.steps.length - 1) { this.stepIndex++; } }, 1400);
    this.svc.extract(this.data.resume.id).subscribe({
      next: res => { this.stopSteps(); this.load(res.data); this.stage = 'preview'; },
      error: err => {
        this.stopSteps();
        const e = err?.error;
        this.failure = e?.message
          ? { code: e.code || 'corrupt', message: e.message }
          : { code: 'network', message: 'We could not reach the server. Check your connection and try again.' };
        this.stage = 'error';
      }
    });
  }

  ngOnDestroy(): void { this.stopSteps(); }
  private stopSteps(): void { if (this.stepTimer) { clearInterval(this.stepTimer); this.stepTimer = undefined; } }

  // ------------------------------------------------------------------ build the preview

  private row<T extends { exists?: boolean }>(d: T, complete: boolean): Row<T> {
    const exists = !!d.exists;
    return { id: this.nextId++, sel: !exists && complete, exists, d: { ...d } };
  }

  private load(x: CvExtraction): void {
    this.warnings = x.warnings || [];
    for (const f of this.fields) {
      const v = (x.profile?.[f.key] ?? '') as string;
      const c = (x.current?.[f.key] ?? '') as string;
      const same = v !== '' && this.norm(v) === this.norm(c);
      // fill what is empty; never pre-tick something that would replace what the profile already has
      this.profile[f.key] = { sel: v !== '' && c === '', value: v, current: c, same };
    }
    this.education = (x.education || []).map(d => this.row(d, !!(d.highest_education && d.school_name && d.status)));
    this.jobs = (x.employment || []).map(d => this.row(d, !!(d.company_name && d.position)));
    this.skills = (x.skills || []).map(d => this.row(d, !!d.skills));
    this.languages = (x.languages || []).map(d => this.row(d, !!d.language));
    this.training = (x.training || []).map(d => this.row(d, !!d.training_title));
    this.seminars = (x.seminar || []).map(d => this.row(d, !!d.seminar_title));
    this.certificates = (x.certificate || []).map(d => this.row(d, !!d.certificate_title));
  }

  private norm(s: string | null | undefined): string { return String(s ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim(); }

  // ------------------------------------------------------------------ what is ticked

  get profileFound(): number { return this.fields.filter(f => this.profile[f.key]?.value).length; }
  get profileSelected(): number { return this.fields.filter(f => this.profile[f.key]?.sel && this.profile[f.key].value.trim()).length; }

  private count(rows: Row<any>[]): number { return rows.filter(r => r.sel).length; }
  get selectedCount(): number {
    return this.profileSelected + [this.education, this.jobs, this.skills, this.languages, this.training, this.seminars, this.certificates]
      .reduce((n, rows) => n + this.count(rows), 0);
  }
  sel(rows: Row<any>[]): number { return this.count(rows); }

  get foundCount(): number {
    return this.profileFound + this.education.length + this.jobs.length + this.skills.length + this.languages.length
      + this.training.length + this.seminars.length + this.certificates.length;
  }

  /** a ticked item that is missing something the profile needs: the person completes it or unticks it */
  problemEdu(r: Row<CvEducation>): string {
    if (!r.d.highest_education?.trim()) { return 'Add the degree or level.'; }
    if (!r.d.school_name?.trim()) { return 'Add the school.'; }
    if (!r.d.status) { return 'Choose the status.'; }
    if (r.d.start_year && r.d.end_year && r.d.end_year < r.d.start_year) { return 'The end year is before the start year.'; }
    return '';
  }
  problemJob(r: Row<CvJob>): string {
    if (!r.d.position?.trim()) { return 'Add the position.'; }
    if (!r.d.company_name?.trim()) { return 'Add the company.'; }
    return '';
  }
  problemTitle(title: string | null | undefined): string { return title?.trim() ? '' : 'Add a title.'; }

  get invalidSelected(): number {
    return this.education.filter(r => r.sel && this.problemEdu(r)).length
      + this.jobs.filter(r => r.sel && this.problemJob(r)).length
      + this.training.filter(r => r.sel && this.problemTitle(r.d.training_title)).length
      + this.seminars.filter(r => r.sel && this.problemTitle(r.d.seminar_title)).length
      + this.certificates.filter(r => r.sel && this.problemTitle(r.d.certificate_title)).length
      + (this.profile['summary']?.sel && this.profile['summary'].value.length > 255 ? 1 : 0);
  }

  get canImport(): boolean { return this.stage === 'preview' && this.selectedCount > 0 && this.invalidSelected === 0; }

  // ------------------------------------------------------------------ editing helpers

  setAll(rows: Row<any>[], on: boolean): void { rows.forEach(r => { if (!on || !r.exists) { r.sel = on; } }); }
  remove<T>(rows: Row<T>[], row: Row<T>): void { const i = rows.indexOf(row); if (i >= 0) { rows.splice(i, 1); } }

  setAllProfile(on: boolean): void {
    for (const f of this.fields) {
      const p = this.profile[f.key];
      p.sel = on && p.value.trim() !== '' && !p.same;
    }
  }

  /** the person typed in a field: ticking it is the natural next step */
  touched(key: string): void { const p = this.profile[key]; if (p && !p.sel && p.value.trim()) { p.sel = true; } p.same = this.norm(p.value) === this.norm(p.current); }

  addSkill(): void {
    const s = this.newSkill.trim();
    if (!s || s.length > 255) { return; }
    if (!this.skills.some(r => this.norm(r.d.skills) === this.norm(s))) { this.skills.push({ id: this.nextId++, sel: true, exists: false, d: { skills: s } }); }
    this.newSkill = '';
  }
  addLanguage(): void {
    const s = this.newLanguage.trim();
    if (!s || s.length > 100) { return; }
    if (!this.languages.some(r => this.norm(r.d.language) === this.norm(s))) { this.languages.push({ id: this.nextId++, sel: true, exists: false, d: { language: s } }); }
    this.newLanguage = '';
  }

  trackRow(_: number, r: Row<any>): number { return r.id; }
  years(): number[] { const y = new Date().getFullYear(); return Array.from({ length: 70 }, (_, i) => y + 8 - i); }

  // ------------------------------------------------------------------ save

  private picked<T extends { exists?: boolean }>(rows: Row<T>[]): T[] {
    return rows.filter(r => r.sel).map(r => { const { exists, ...rest } = r.d as any; return rest as T; });
  }

  import(): void {
    if (!this.canImport) { return; }
    const profile: Partial<CvProfileFields> = {};
    for (const f of this.fields) {
      const p = this.profile[f.key];
      if (p.sel && p.value.trim()) { (profile as any)[f.key] = p.value.trim(); }
    }
    const payload: CvImportPayload = {
      profile, set_default: this.setDefault,
      education: this.picked(this.education), employment: this.picked(this.jobs), skills: this.picked(this.skills),
      languages: this.picked(this.languages), training: this.picked(this.training), seminar: this.picked(this.seminars),
      certificate: this.picked(this.certificates),
    };
    this.stage = 'saving';
    this.saveError = '';
    this.svc.importData(this.data.resume.id, payload).subscribe({
      next: res => { this.report = res.data; this.stage = 'done'; },
      error: err => {
        this.stage = 'preview';
        this.saveError = err?.error?.message || 'We could not save your import. Nothing was changed. Please try again.';
      }
    });
  }

  close(): void { this.ref.close(this.report); }

  // ------------------------------------------------------------------ done screen

  readonly sectionLabels: Record<string, string> = {
    education: 'education', employment: 'jobs', skills: 'skills', languages: 'languages',
    training: 'trainings', seminar: 'seminars', certificate: 'certificates'
  };
  get addedLines(): { label: string; n: number }[] {
    return Object.entries(this.report?.added || {}).filter(([, n]) => n > 0).map(([k, n]) => ({ label: this.sectionLabels[k] || k, n }));
  }
  get duplicateTotal(): number { return Object.values(this.report?.duplicates || {}).reduce((a, b) => a + b, 0); }
  fieldLabel(key: string): string { return this.fields.find(f => f.key === key)?.label || key; }
}
