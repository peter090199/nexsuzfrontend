import { Component, OnInit } from '@angular/core';
import { NotificationsService } from 'src/app/services/Global/notifications.service';
import {
  DEFAULT_SECTIONS, FONTS, JobTemplate, JobTemplateService, PRESET_THEMES, SECTION_DEFS, TemplateSection, TemplateTheme
} from 'src/app/services/Jobs/job-template.service';
import { JobPreviewModel, PreviewQuestion } from 'src/app/ComponentSharedUI/job-preview/job-preview.component';

const HEX = /^#[0-9a-fA-F]{6}$/;

/**
 * Settings > Job Posting Templates & Themes (DEF-MASTERADMIN only; the API refuses everyone else).
 * List of templates, an editor (theme + sections) and a live desktop / mobile preview.
 */
@Component({
  selector: 'app-job-templates-settings',
  templateUrl: './job-templates-settings.component.html',
  styleUrls: ['./job-templates-settings.component.css']
})
export class JobTemplatesSettingsComponent implements OnInit {
  readonly presets = PRESET_THEMES;
  readonly fonts = FONTS;
  readonly sectionDefs = SECTION_DEFS;

  templates: JobTemplate[] = [];
  loading = true;
  loadError = false;
  busyId: number | null = null;

  mode: 'list' | 'edit' = 'list';
  editing: JobTemplate | null = null;
  isNew = false;
  saving: '' | 'draft' | 'publish' = '';
  device: 'desktop' | 'mobile' = 'desktop';
  /** a copy of the template for the preview: replaced on every change so the preview refreshes */
  view: JobTemplate | null = null;

  readonly sampleJob: JobPreviewModel = {
    job_name: 'Senior Frontend Developer', job_position: 'Engineering', location: 'Manila, Philippines',
    work_type: 'Hybrid', employment_type: 'Full-time', experience_level: 'Senior', vacancies: 2,
    currency: 'PHP', min_salary: 80000, max_salary: 120000, salary_period: 'Monthly',
    job_about: 'Build fast, accessible interfaces for a product used by thousands of job seekers.',
    job_description: 'Design and ship features end to end.\nWork with designers and backend engineers.\nKeep the UI fast, accessible and tested.',
    qualification: '5+ years building web applications.\nStrong TypeScript and Angular skills.',
    preferred_qualifications: 'Experience with design systems.',
    education: "Bachelor's degree in Computer Science or equivalent experience",
    required_skills: ['Angular', 'TypeScript', 'RxJS', 'CSS', 'Testing'],
    benefits: 'Health insurance\nFlexible hours\nAnnual learning budget',
    application_deadline: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10), allow_cv: true,
  };
  readonly sampleQuestions: PreviewQuestion[] = [
    { question_text: 'Are you willing to relocate?', question_type: 'yes_no', is_required: true },
    { question_text: 'How many years of Angular experience do you have?', question_type: 'numeric', is_required: true },
    { question_text: 'Preferred work setup', question_type: 'multiple_choice', options: ['On-site', 'Hybrid', 'Remote'], is_required: false },
  ];

  constructor(private svc: JobTemplateService, private notify: NotificationsService) { }

  ngOnInit(): void { this.load(); }

  // ------------------------------------------------------------------ list

  load(): void {
    this.loading = true;
    this.loadError = false;
    this.svc.adminList().subscribe({
      next: rows => { this.templates = rows; this.loading = false; },
      error: err => {
        this.loading = false;
        this.loadError = true;
        if (err?.status === 403) { this.notify.toastrError('Only a master administrator can manage job posting templates.'); }
      }
    });
  }

  trackId(_: number, t: JobTemplate): any { return t.id; }

  private fail(err: any, fallback: string): void {
    const first = err?.error?.errors ? (Object.values(err.error.errors) as string[][])[0]?.[0] : null;
    this.notify.toastrError(first || err?.error?.message || fallback);
  }

  private run(t: JobTemplate, call: any, ok: string, fallback: string): void {
    if (!t.id) { return; }
    this.busyId = t.id;
    call.subscribe({
      next: (r: any) => { this.busyId = null; this.notify.toastrSuccess(r?.message || ok); this.load(); },
      error: (e: any) => { this.busyId = null; this.fail(e, fallback); }
    });
  }

  duplicate(t: JobTemplate): void { this.run(t, this.svc.duplicate(t.id!), 'Template duplicated.', 'Could not duplicate the template.'); }
  publish(t: JobTemplate): void { this.run(t, this.svc.publish(t.id!), 'Template published.', 'Could not publish the template.'); }
  unpublish(t: JobTemplate): void { this.run(t, this.svc.unpublish(t.id!), 'Template unpublished.', 'Could not unpublish the template.'); }
  makeDefault(t: JobTemplate): void { this.run(t, this.svc.setDefault(t.id!), 'Default template updated.', 'Could not set the default.'); }

  remove(t: JobTemplate): void {
    const used = t.jobs_using ? `${t.jobs_using} job${t.jobs_using === 1 ? '' : 's'} already use it and will keep its look. ` : '';
    this.notify.popupWarning(`Delete "${t.name}"?`, used + 'It will no longer be offered when posting a job.').then(r => {
      if (r.value) { this.run(t, this.svc.remove(t.id!), 'Template deleted.', 'Could not delete the template.'); }
    });
  }

  // ------------------------------------------------------------------ editor

  newTemplate(): void {
    this.isNew = true;
    this.open({ name: '', description: '', theme: { ...PRESET_THEMES[0].theme }, sections: DEFAULT_SECTIONS() });
  }

  edit(t: JobTemplate): void {
    this.isNew = false;
    this.open(JSON.parse(JSON.stringify(t)));
  }

  private open(t: JobTemplate): void {
    this.editing = t;
    this.device = 'desktop';
    this.mode = 'edit';
    this.refresh();
    window.scrollTo({ top: 0 });
  }

  cancel(): void { this.mode = 'list'; this.editing = null; this.view = null; }

  /** the preview takes a fresh object so the themed components re-render */
  refresh(): void {
    this.view = this.editing ? JSON.parse(JSON.stringify(this.editing)) : null;
  }

  applyPreset(id: string): void {
    const p = PRESET_THEMES.find(x => x.id === id);
    if (!p || !this.editing) { return; }
    this.editing.theme = { ...p.theme };
    this.refresh();
  }

  setTheme<K extends keyof TemplateTheme>(key: K, value: TemplateTheme[K]): void {
    if (!this.editing) { return; }
    this.editing.theme = { ...this.editing.theme, [key]: value, preset: 'custom' };
    this.refresh();
  }

  /** hex typed by hand: only a complete, valid colour is applied */
  setColor(key: 'primary' | 'accent' | 'background' | 'surface' | 'text', value: string): void {
    const v = (value || '').trim();
    if (HEX.test(v)) { this.setTheme(key, v.toLowerCase()); }
  }

  isHex(v: string): boolean { return HEX.test(v || ''); }

  move(i: number, dir: -1 | 1): void {
    const s = this.editing?.sections;
    if (!s) { return; }
    const j = i + dir;
    if (j < 0 || j >= s.length) { return; }
    [s[i], s[j]] = [s[j], s[i]];
    this.refresh();
  }

  iconOf(s: TemplateSection): string { return SECTION_DEFS.find(d => d.key === s.key)?.icon || 'article'; }
  defaultLabel(s: TemplateSection): string { return SECTION_DEFS.find(d => d.key === s.key)?.label || s.key; }

  get valid(): boolean {
    const t = this.editing;
    if (!t || !t.name.trim()) { return false; }
    const th = t.theme;
    return [th.primary, th.accent, th.background, th.surface, th.text].every(c => HEX.test(c));
  }

  save(publish: boolean): void {
    const t = this.editing;
    if (!t || !this.valid || this.saving) { return; }

    this.saving = publish ? 'publish' : 'draft';
    const req = this.isNew ? this.svc.create(t) : this.svc.update(t.id!, t);
    req.subscribe({
      next: (r: any) => {
        const saved: JobTemplate = r?.data;
        const done = () => { this.saving = ''; this.notify.toastrSuccess(publish ? 'Template saved and published.' : 'Template saved.'); this.cancel(); this.load(); };
        if (publish && saved?.id && saved.status !== 'published') {
          this.svc.publish(saved.id).subscribe({ next: done, error: e => { this.saving = ''; this.fail(e, 'Saved, but it could not be published.'); this.cancel(); this.load(); } });
        } else {
          done();
        }
      },
      error: e => { this.saving = ''; this.fail(e, 'Could not save the template.'); }
    });
  }

  fontStack(f: string): string { return this.svc.fontStack(f); }
}
