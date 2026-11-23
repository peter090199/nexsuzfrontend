import { Component, Input } from '@angular/core';
import { SharedRoutinesService } from 'src/app/services/Function/shared-routines.service';
import { JobTemplate } from 'src/app/services/Jobs/job-template.service';

export interface JobPreviewModel {
  job_name?: string | null;
  job_position?: string | null;          // department / job category
  location?: string | null;
  work_type?: string | null;             // Onsite | Hybrid | Work From Home
  employment_type?: string | null;
  experience_level?: string | null;
  vacancies?: number | null;
  currency?: string | null;
  min_salary?: number | string | null;
  max_salary?: number | string | null;
  salary_period?: string | null;
  job_about?: string | null;
  job_description?: string | null;
  qualification?: string | null;
  preferred_qualifications?: string | null;
  education?: string | null;
  required_skills?: string[] | null;
  benefits?: string | null;
  application_deadline?: string | null;  // YYYY-MM-DD
  allow_cv?: boolean | null;
}

export interface PreviewQuestion {
  question_text: string;
  question_type: string;                 // yes_no | multiple_choice | short_text | long_text | numeric
  options?: string[];
  is_required?: boolean;
}

/**
 * How a job will look to applicants. Used for the live preview next to the posting form and for the full preview
 * on phones. It only displays what it is given: it never saves anything.
 */
@Component({
  selector: 'app-job-preview',
  templateUrl: './job-preview.component.html',
  styleUrls: ['./job-preview.component.css']
})
export class JobPreviewComponent {
  @Input() job: JobPreviewModel = {};
  @Input() questions: PreviewQuestion[] = [];
  @Input() companyName = '';
  @Input() logoUrl: string | null = null;     // company / account photo
  @Input() imageUrl: string | null = null;    // the job image
  @Input() showQuestions = true;
  /** the job template (theme + sections); none = the classic look */
  @Input() template: JobTemplate | null | undefined = null;

  constructor(private shared: SharedRoutinesService) { }

  get workplace(): string {
    const map: Record<string, string> = { 'Onsite': 'On-site', 'Work From Home': 'Remote', 'Hybrid': 'Hybrid' };
    return (this.job.work_type && map[this.job.work_type]) || this.job.work_type || '';
  }

  get symbol(): string {
    return this.shared.getCurrencyByCode(this.job.currency || '')?.symbol || this.job.currency || '';
  }

  get salary(): string {
    const min = this.job.min_salary, max = this.job.max_salary;
    const n = (v: any) => Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 });
    const has = (v: any) => v !== null && v !== undefined && v !== '' && !isNaN(Number(v));
    if (!has(min) && !has(max)) { return ''; }
    const range = has(min) && has(max) ? `${this.symbol}${n(min)} – ${this.symbol}${n(max)}` : `${this.symbol}${n(has(min) ? min : max)}`;
    const unit: Record<string, string> = { Hourly: 'hour', Monthly: 'month', Yearly: 'year' };
    const per = this.job.salary_period ? ` / ${unit[this.job.salary_period] || this.job.salary_period.toLowerCase()}` : '';
    return range + per;
  }

  get initials(): string { return this.shared.getInitials(this.companyName || this.job.job_name || ''); }

  get skills(): string[] { return (this.job.required_skills || []).filter(s => !!s); }

  get deadline(): Date | null {
    return this.job.application_deadline ? new Date(this.job.application_deadline + 'T00:00:00') : null;
  }

  typeLabel(t: string): string {
    return ({ yes_no: 'Yes / No', multiple_choice: 'Multiple choice', short_text: 'Short answer', long_text: 'Long answer', numeric: 'Number' } as any)[t] || 'Answer';
  }

  trackIdx(i: number): number { return i; }
}
