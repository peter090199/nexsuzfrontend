import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { JobTemplate, SectionKey } from 'src/app/services/Jobs/job-template.service';

export interface SectionQuestion {
  question_text: string;
  question_type: string;        // yes_no | multiple_choice | short_text | long_text | numeric
  options?: string[];
  is_required?: boolean;
}

interface Shown { key: SectionKey; label: string; }

/** the sections a job without a template has always shown, in their old order and wording */
const LEGACY: Shown[] = [
  { key: 'summary', label: 'About the job' },
  { key: 'responsibilities', label: 'Job description' },
  { key: 'qualifications', label: 'Qualifications' },
  { key: 'skills', label: 'Required skills' },
  { key: 'benefits', label: 'Benefits and perks' },
  { key: 'questions', label: 'Application questions' },
];

const SIDE: SectionKey[] = ['education', 'skills', 'benefits'];

/**
 * The body of a job (about, description, qualifications, education, skills, benefits, screening questions),
 * drawn in the order, wording and layout of the job's template. With no template it draws the classic layout,
 * so every job posted before templates existed is unchanged.
 */
@Component({
  selector: 'app-job-sections',
  templateUrl: './job-sections.component.html',
  styleUrls: ['./job-sections.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class JobSectionsComponent {
  @Input() job: any = {};
  @Input() template: JobTemplate | null | undefined = null;
  @Input() questions: SectionQuestion[] = [];
  @Input() showQuestions = true;

  get legacy(): boolean { return !this.template; }

  get layout(): string { return this.template?.theme?.layout || 'single'; }

  get skills(): string[] {
    const raw = this.job?.required_skills;
    if (Array.isArray(raw)) { return raw.filter((s: any) => !!s); }
    if (typeof raw === 'string' && raw) {
      try { const a = JSON.parse(raw); return Array.isArray(a) ? a.filter((s: any) => !!s) : []; } catch { return []; }
    }
    return [];
  }

  private has(key: SectionKey): boolean {
    const j = this.job || {};
    switch (key) {
      case 'summary': return !!j.job_about;
      case 'responsibilities': return !!j.job_description;
      case 'qualifications': return this.legacy
        ? !!(j.qualification || j.education || j.preferred_qualifications)
        : !!(j.qualification || j.preferred_qualifications);
      case 'education': return !this.legacy && !!j.education;
      case 'skills': return this.skills.length > 0;
      case 'benefits': return !!j.benefits;
      case 'questions': return this.showQuestions && this.questions.length > 0;
    }
    return false;
  }

  /** enabled sections that have something to show, in template order */
  get shown(): Shown[] {
    const list: Shown[] = this.legacy
      ? LEGACY
      : (this.template!.sections || []).filter(s => s.enabled).map(s => ({ key: s.key, label: s.label }));
    return list.filter(s => this.has(s.key));
  }

  get main(): Shown[] { return this.layout === 'sidebar' ? this.shown.filter(s => !SIDE.includes(s.key)) : this.shown; }
  get side(): Shown[] { return this.layout === 'sidebar' ? this.shown.filter(s => SIDE.includes(s.key)) : []; }

  trackKey(_: number, s: Shown): string { return s.key; }
  trackIdx(i: number): number { return i; }
}
