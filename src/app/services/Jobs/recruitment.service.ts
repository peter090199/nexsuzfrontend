import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { _url } from 'src/global-variables';

export type PipelineStatus = 'applied_active' | 'review' | 'interview' | 'approved' | 'reject';
export type Recommendation = 'excellent' | 'strong' | 'good' | 'moderate' | 'low';

export const STATUS_META: { key: PipelineStatus; label: string; icon: string }[] = [
  { key: 'applied_active', label: 'Applied', icon: 'inbox' },
  { key: 'review', label: 'Under review', icon: 'hourglass_top' },
  { key: 'interview', label: 'Interview', icon: 'record_voice_over' },
  { key: 'approved', label: 'Approved', icon: 'check_circle' },
  { key: 'reject', label: 'Rejected', icon: 'cancel' },
];

export const RECOMMENDATION_LABEL: Record<Recommendation, string> = {  excellent: 'Excellent match',  strong: 'Strong match',  good: 'Good match',  moderate: 'Moderate match',  low: 'Low match – manual review required',};

export interface CandidateRow {
  applied_id: number; transNo: string; code: string; fullname: string; email: string;
  country_code: string; phone_number: string; job_name: string; applied_status: PipelineStatus;
  applied_at: string; updated_at: string;
  ai_score: number | null; ai_recommendation: Recommendation | null; ai_reviewed: boolean;
  next_interview: string | null; notes_count: number;
}

export interface CandidateList {
  success: boolean;
  job: { transNo: string; job_name: string; recordstatus: string };
  counts: Record<PipelineStatus, number>; total: number;
  transitions: Record<string, PipelineStatus[]>;
  passing_score: number; thresholds: { excellent: number; strong: number; good: number; moderate: number };
  ai_provider: 'anthropic' | 'local';
  data: CandidateRow[];
}

export interface EvalCategory { score: number | null; evidence: string; }
export interface AnswerEval {
  question_id: number; question: string; type: string; answer: string; score: number; final_score: number | null;
  overridden: boolean; status: 'complete' | 'incomplete' | 'unclear' | 'not_answered'; explanation: string; follow_up: string;
}
export interface Evaluation {
  id: number; applied_id: number; overall_score: number; final_score: number | null; score: number;
  recommendation: Recommendation; recommendation_label: string; incomplete?: string[];
  categories: Record<string, EvalCategory>; strengths: string[]; weaknesses: string[]; matched: string[]; missing: string[];
  answers: AnswerEval[]; explanation: string; interview_questions: string[];
  provider: string; model: string; version: string; weights: Record<string, number>; criteria: any; thresholds: any;
  status: 'ai' | 'reviewed'; created_at: string; reviewed_at: string | null; human_review_required: boolean;
}

export interface EvalSettings {
  scope: 'global' | 'job'; transNo?: string | null;
  weights: Record<string, number>; thresholds: { excellent: number; strong: number; good: number; moderate: number };
  passing_score: number; competencies: string[];
}

/** Recruiter's candidate review API (every call is checked on the server: job owner or master admin only). */
@Injectable({ providedIn: 'root' })
export class RecruitmentService {
  private base = `${_url}recruitment`;
  constructor(private http: HttpClient) { }

  private h(): HttpHeaders { return new HttpHeaders({ Authorization: `Bearer ${sessionStorage.getItem('token') || ''}` }); }

  /** recruiting analytics for the recruiter's own vacancies */
  reports(params: { from?: string; to?: string; transNo?: string }): Observable<any> {
    const q = Object.entries(params).filter(([, v]) => !!v).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
    return this.http.get<any>(`${this.base}/reports${q ? '?' + q : ''}`, { headers: this.h() });
  }
  /** every candidate of every vacancy the signed-in recruiter owns */
  allCandidates(): Observable<CandidateList> { return this.http.get<CandidateList>(`${this.base}/candidates`, { headers: this.h() }); }
  candidates(transNo: string): Observable<CandidateList> { return this.http.get<CandidateList>(`${this.base}/jobs/${transNo}/candidates`, { headers: this.h() }); }
  application(id: number): Observable<any> { return this.http.get<any>(`${this.base}/applications/${id}`, { headers: this.h() }); }

  /** the CV: fetched with the sign-in token, never from a public address */
  resume(id: number, resumeId?: number, download = false): Observable<Blob> {
    const q = [resumeId ? `resume=${resumeId}` : '', download ? 'download=1' : ''].filter(Boolean).join('&');
    return this.http.get(`${this.base}/applications/${id}/resume${q ? '?' + q : ''}`, { headers: this.h(), responseType: 'blob' });
  }

  changeStatus(id: number, body: { status: PipelineStatus; reason?: string; notify?: boolean; message?: string }): Observable<any> {
    return this.http.post<any>(`${this.base}/applications/${id}/status`, body, { headers: this.h() });
  }
  previewNotification(id: number, status: PipelineStatus): Observable<any> {
    return this.http.post<any>(`${this.base}/applications/${id}/notification-preview`, { status }, { headers: this.h() });
  }
  /** permanently removes the application and everything tied to it (job owner / master admin only) */
  deleteApplication(id: number): Observable<any> { return this.http.delete<any>(`${this.base}/applications/${id}`, { headers: this.h() }); }
  addNote(id: number, note: string): Observable<any> { return this.http.post<any>(`${this.base}/applications/${id}/notes`, { note }, { headers: this.h() }); }

  schedule(id: number, body: any): Observable<any> { return this.http.post<any>(`${this.base}/applications/${id}/interviews`, body, { headers: this.h() }); }
  updateInterview(interviewId: number, body: any): Observable<any> { return this.http.put<any>(`${this.base}/interviews/${interviewId}`, body, { headers: this.h() }); }

  evaluate(id: number): Observable<any> { return this.http.post<any>(`${this.base}/applications/${id}/evaluate`, {}, { headers: this.h() }); }
  evaluations(id: number): Observable<any> { return this.http.get<any>(`${this.base}/applications/${id}/evaluations`, { headers: this.h() }); }
  override(evaluationId: number, changes: { question_id: number | null; score: number; reason: string }[]): Observable<any> {
    return this.http.post<any>(`${this.base}/evaluations/${evaluationId}/overrides`, { changes }, { headers: this.h() });
  }

  settings(transNo?: string | null): Observable<any> {
    return this.http.get<any>(`${this.base}/evaluation-settings${transNo ? '?transNo=' + encodeURIComponent(transNo) : ''}`, { headers: this.h() });
  }
  saveSettings(body: any): Observable<any> { return this.http.put<any>(`${this.base}/evaluation-settings`, body, { headers: this.h() }); }

  errorText(err: any, fallback: string): string {
    const first = err?.error?.errors ? (Object.values(err.error.errors) as string[][])[0]?.[0] : null;
    return first || err?.error?.message || fallback;
  }
}
