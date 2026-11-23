import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, shareReplay, tap } from 'rxjs/operators';
import { _url } from 'src/global-variables';

export type SectionKey = 'summary' | 'responsibilities' | 'qualifications' | 'education' | 'skills' | 'benefits' | 'questions';

export interface TemplateSection { key: SectionKey; label: string; enabled: boolean; }

export interface TemplateTheme {
  preset?: string;
  primary: string; accent: string; background: string; surface: string; text: string;
  font: string;
  radius: number;
  buttonStyle: 'filled' | 'outline' | 'soft';
  buttonShape: 'square' | 'rounded' | 'pill';
  headerStyle: 'gradient' | 'solid' | 'plain';
  backgroundStyle: 'solid' | 'soft' | 'gradient';
  layout: 'single' | 'two_column' | 'sidebar';
}

export interface JobTemplate {
  id?: number;
  name: string;
  description?: string | null;
  status?: 'draft' | 'published';
  is_default?: boolean;
  jobs_using?: number;
  theme: TemplateTheme;
  sections: TemplateSection[];
  updated_at?: string;
}

export const SECTION_DEFS: { key: SectionKey; label: string; icon: string }[] = [
  { key: 'summary', label: 'About the job', icon: 'short_text' },
  { key: 'responsibilities', label: 'Job description', icon: 'assignment' },
  { key: 'qualifications', label: 'Qualifications', icon: 'fact_check' },
  { key: 'education', label: 'Education', icon: 'school' },
  { key: 'skills', label: 'Required skills', icon: 'psychology' },
  { key: 'benefits', label: 'Benefits and perks', icon: 'redeem' },
  { key: 'questions', label: 'Screening questions', icon: 'quiz' },
];

export const FONTS: { value: string; label: string; stack: string }[] = [
  { value: 'verdana', label: 'Verdana (default)', stack: "Verdana, Geneva, Tahoma, sans-serif" },
  { value: 'system', label: 'System', stack: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
  { value: 'tahoma', label: 'Tahoma', stack: "Tahoma, Geneva, sans-serif" },
  { value: 'trebuchet', label: 'Trebuchet', stack: "'Trebuchet MS', Helvetica, sans-serif" },
  { value: 'georgia', label: 'Georgia (serif)', stack: "Georgia, 'Times New Roman', serif" },
  { value: 'times', label: 'Times (serif)', stack: "'Times New Roman', Times, serif" },
  { value: 'courier', label: 'Courier (mono)', stack: "'Courier New', Courier, monospace" },
];

const base = (o: Partial<TemplateTheme> & { preset: string; primary: string; accent: string }): TemplateTheme => ({
  background: '#f3f2ef', surface: '#ffffff', text: '#1b2a4a', font: 'verdana', radius: 14,
  buttonStyle: 'filled', buttonShape: 'pill', headerStyle: 'gradient', backgroundStyle: 'solid', layout: 'single', ...o,
});

/** predefined themes the master admin can start from */
export const PRESET_THEMES: { id: string; label: string; theme: TemplateTheme }[] = [
  { id: 'classic', label: 'Classic Blue', theme: base({ preset: 'classic', primary: '#0a66c2', accent: '#7a5af8' }) },
  { id: 'emerald', label: 'Emerald', theme: base({ preset: 'emerald', primary: '#047857', accent: '#10b981', background: '#f0fdf4', headerStyle: 'solid', buttonShape: 'rounded' }) },
  { id: 'sunset', label: 'Sunset', theme: base({ preset: 'sunset', primary: '#ea580c', accent: '#db2777', background: '#fff7ed', radius: 18 }) },
  { id: 'royal', label: 'Royal Purple', theme: base({ preset: 'royal', primary: '#6d28d9', accent: '#2563eb', background: '#f5f3ff', layout: 'sidebar' }) },
  { id: 'slate', label: 'Corporate Slate', theme: base({ preset: 'slate', primary: '#334155', accent: '#0ea5e9', background: '#f1f5f9', headerStyle: 'solid', buttonShape: 'square', radius: 6, font: 'system', layout: 'two_column' }) },
  { id: 'midnight', label: 'Midnight (dark)', theme: base({ preset: 'midnight', primary: '#60a5fa', accent: '#a78bfa', background: '#0f172a', surface: '#1e293b', text: '#e2e8f0', buttonStyle: 'filled', backgroundStyle: 'gradient' }) },
  { id: 'mono', label: 'Minimal Mono', theme: base({ preset: 'mono', primary: '#111827', accent: '#6b7280', background: '#ffffff', headerStyle: 'plain', buttonStyle: 'outline', buttonShape: 'square', radius: 4, font: 'courier' }) },
];

export const DEFAULT_SECTIONS = (): TemplateSection[] => SECTION_DEFS.map(s => ({ key: s.key, label: s.label, enabled: true }));

/** Job posting templates & themes: read for everyone signed in, write for DEF-MASTERADMIN (the API enforces it). */
@Injectable({ providedIn: 'root' })
export class JobTemplateService {
  private published$?: Observable<{ data: JobTemplate[]; default_id: number | null }>;
  private one = new Map<number, Observable<JobTemplate | null>>();

  constructor(private http: HttpClient) { }

  private headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${sessionStorage.getItem('token') || ''}` });
  }

  // ------------------------------------------------------------------ read (posters + viewers)

  /** published templates to choose from (cached until a master admin changes something) */
  listPublished(force = false): Observable<{ data: JobTemplate[]; default_id: number | null }> {
    if (force || !this.published$) {
      this.published$ = this.http.get<any>(`${_url}job-templates`, { headers: this.headers() })
        .pipe(map(r => ({ data: r?.data || [], default_id: r?.default_id ?? null })), shareReplay(1));
    }
    return this.published$;
  }

  /** one template, to render a job (cached per id); null when it can't be loaded */
  get(id: number | null | undefined): Observable<JobTemplate | null> {
    if (!id) { return of(null); }
    if (!this.one.has(id)) {
      this.one.set(id, this.http.get<any>(`${_url}job-templates/${id}`, { headers: this.headers() })
        .pipe(map(r => (r?.success ? (r.data as JobTemplate) : null)), shareReplay(1)));
    }
    return this.one.get(id)!;
  }

  // ------------------------------------------------------------------ manage (DEF-MASTERADMIN)

  private bust(): void { this.published$ = undefined; this.one.clear(); }

  adminList(): Observable<JobTemplate[]> {
    return this.http.get<any>(`${_url}admin/job-templates`, { headers: this.headers() }).pipe(map(r => r?.data || []));
  }
  create(t: JobTemplate): Observable<any> {
    return this.http.post<any>(`${_url}admin/job-templates`, this.payload(t), { headers: this.headers() }).pipe(tap(() => this.bust()));
  }
  update(id: number, t: JobTemplate): Observable<any> {
    return this.http.put<any>(`${_url}admin/job-templates/${id}`, this.payload(t), { headers: this.headers() }).pipe(tap(() => this.bust()));
  }
  remove(id: number): Observable<any> {
    return this.http.delete<any>(`${_url}admin/job-templates/${id}`, { headers: this.headers() }).pipe(tap(() => this.bust()));
  }
  duplicate(id: number): Observable<any> { return this.act(id, 'duplicate'); }
  publish(id: number): Observable<any> { return this.act(id, 'publish'); }
  unpublish(id: number): Observable<any> { return this.act(id, 'unpublish'); }
  setDefault(id: number): Observable<any> { return this.act(id, 'default'); }

  private act(id: number, action: string): Observable<any> {
    return this.http.post<any>(`${_url}admin/job-templates/${id}/${action}`, {}, { headers: this.headers() }).pipe(tap(() => this.bust()));
  }

  private payload(t: JobTemplate): any {
    return { name: t.name, description: t.description || null, theme: t.theme, sections: t.sections };
  }

  // ------------------------------------------------------------------ helpers shared by every renderer

  fontStack(font: string | undefined): string {
    return (FONTS.find(f => f.value === font) || FONTS[0]).stack;
  }
}
