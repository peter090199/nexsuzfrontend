import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { _url } from 'src/global-variables';

export type ResumeType = 'pdf' | 'doc' | 'docx';

export interface UserResume {
  id: number;
  name: string;
  size: number;
  is_default: boolean;
  /** only a PDF can be sent along with a job application */
  type: ResumeType;
  created_at: string;
}

export interface UserResumeList {
  success: boolean;
  message?: string;
  data: UserResume[];
  max?: number;
  id?: number;
}

// ---------- what the API reads out of a CV (the import preview) ----------
export interface CvProfileFields {
  fname: string | null; lname: string | null; email: string | null; contact_no: string | null; profession: string | null;
  summary: string | null; date_birth: string | null; home_country: string | null; current_location: string | null;
  home_state: string | null; current_state: string | null;
}
export interface CvEducation { highest_education: string | null; school_name: string | null; start_month: string | null; start_year: number | null; end_month: string | null; end_year: number | null; status: string | null; exists?: boolean; }
export interface CvJob { company_name: string | null; position: string | null; job_description: string | null; date_completed: string | null; exists?: boolean; }
export interface CvLanguage { language: string; exists?: boolean; }
export interface CvSkill { skills: string; exists?: boolean; }
export interface CvTraining { training_title: string | null; training_provider: string | null; date_completed: string | null; exists?: boolean; }
export interface CvSeminar { seminar_title: string | null; seminar_provider: string | null; date_completed: string | null; exists?: boolean; }
export interface CvCertificate { certificate_title: string | null; certificate_provider: string | null; date_completed: string | null; exists?: boolean; }

export interface CvExtraction {
  profile: CvProfileFields;
  /** what is on the profile now, to compare with */
  current: CvProfileFields;
  education: CvEducation[]; employment: CvJob[]; languages: CvLanguage[]; skills: CvSkill[];
  training: CvTraining[]; seminar: CvSeminar[]; certificate: CvCertificate[];
  warnings: string[];
  resume: UserResume;
  characters: number;
}

/** why a file could not be read (the API sends one of these in `code`) */
export type CvFailureCode = 'unsupported' | 'corrupt' | 'scanned' | 'unreadable' | 'empty' | 'missing';

export interface CvImportPayload {
  profile: Partial<CvProfileFields>;
  education: CvEducation[]; employment: CvJob[]; languages: CvLanguage[]; skills: CvSkill[];
  training: CvTraining[]; seminar: CvSeminar[]; certificate: CvCertificate[];
  set_default: boolean;
}

export interface CvImportReport {
  profile_fields: string[];
  added: Record<string, number>;
  duplicates: Record<string, number>;
  skipped: { section: string; item: string; reason: string }[];
  total_added: number;
  resumes: UserResume[];
}

/**
 * The job seeker's own resumes / CVs (Settings > Resume / CV): upload, list, default, delete, and the automatic import of
 * what a CV contains. The Laravel API does all the reading, validating and saving (job seekers only, own files only);
 * this only calls it.
 */
@Injectable({ providedIn: 'root' })
export class UserResumeService {
  constructor(private http: HttpClient) { }

  private headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${sessionStorage.getItem('token') || ''}` });
  }

  list(): Observable<UserResumeList> {
    return this.http.get<UserResumeList>(`${_url}user-resumes`, { headers: this.headers() });
  }

  upload(file: File): Observable<UserResumeList> {
    const body = new FormData();
    body.append('resume', file);
    return this.http.post<UserResumeList>(`${_url}user-resumes`, body, { headers: this.headers() });
  }

  setDefault(id: number): Observable<UserResumeList> {
    return this.http.patch<UserResumeList>(`${_url}user-resumes/${id}/default`, {}, { headers: this.headers() });
  }

  remove(id: number): Observable<UserResumeList> {
    return this.http.delete<UserResumeList>(`${_url}user-resumes/${id}`, { headers: this.headers() });
  }

  /** the file itself (needs the sign-in header, so it is fetched as a blob and then opened or saved) */
  file(id: number): Observable<Blob> {
    return this.http.get(`${_url}user-resumes/${id}/file`, { headers: this.headers(), responseType: 'blob' });
  }

  /** read the CV and get its data for the preview. Saves nothing. */
  extract(id: number): Observable<{ success: boolean; data: CvExtraction }> {
    return this.http.post<{ success: boolean; data: CvExtraction }>(`${_url}user-resumes/${id}/extract`, {}, { headers: this.headers() });
  }

  /** save what the person approved in the preview */
  importData(id: number, payload: CvImportPayload): Observable<{ success: boolean; message: string; data: CvImportReport }> {
    return this.http.post<{ success: boolean; message: string; data: CvImportReport }>(`${_url}user-resumes/${id}/import`, payload, { headers: this.headers() });
  }
}
