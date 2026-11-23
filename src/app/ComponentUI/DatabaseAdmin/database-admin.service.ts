import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { _url } from 'src/global-variables';

export interface ServerInfo {
  database: { name: string; version: string; connection: string; latency_ms: number; uptime_seconds: number; connections: number };
  app: { laravel: string; php: string; environment: string; debug: boolean; timezone: string; cache_driver: string; queue_driver: string; memory_limit: string; max_execution_time: string };
  server: { os: string; server_time: string; extensions: { [name: string]: boolean } };
}
export interface StorageInfo {
  disk: { total: number; free: number; used: number; used_percent: number };
  database_bytes: number;
  folders: { label: string; bytes: number; files: number }[];
}
export interface DbTable {
  name: string; engine: string; rows: number; data_bytes: number; index_bytes: number; free_bytes: number; total_bytes: number; collation: string;
}
export interface Backup { name: string; bytes: number; created_at: string; }
export interface MaintResult { table: string; status: string; message: string; }
export interface ResetStep { group: string; label: string; table: string; rows: number; }
export interface ResetPreview {
  accounts_removed: number; rows_removed: number; steps: ResetStep[]; files: number;
  protected: { code: string; fullname: string; email: string; role_code: string }[];
  kept_tables: { table: string; rows: number }[];
  allowed: boolean; phrase: string; protected_roles: string[];
}
export interface ResetResult { message: string; backup: Backup; data: { rows: number; files: number; deleted: ResetStep[] }; }

/** Laravel client for the master-admin Database page (backup, server, storage, operations). */
@Injectable({ providedIn: 'root' })
export class DatabaseAdminService {
  private base = `${_url}database-admin`;

  constructor(private http: HttpClient) { }

  private get opts() {
    return { headers: new HttpHeaders({ Authorization: `Bearer ${sessionStorage.getItem('token') || ''}` }) };
  }

  static errorMessage(err: any, fallback = 'Something went wrong. Please try again.'): string {
    const e = err?.error;
    if (e?.errors) { const first = Object.values(e.errors)[0] as string[]; if (first?.length) { return first[0]; } }
    if (err?.status === 429) { return 'Too many requests. Please wait a minute and try again.'; }
    return e?.message || fallback;
  }

  server(): Observable<ServerInfo> { return this.http.get<any>(`${this.base}/server`, this.opts).pipe(map(r => r.data)); }
  storage(): Observable<StorageInfo> { return this.http.get<any>(`${this.base}/storage`, this.opts).pipe(map(r => r.data)); }
  tables(): Observable<DbTable[]> { return this.http.get<any>(`${this.base}/tables`, this.opts).pipe(map(r => r.data)); }
  maintain(action: 'optimize' | 'analyze', tables: string[]): Observable<{ message: string; data: MaintResult[] }> {
    return this.http.post<any>(`${this.base}/tables/${action}`, { tables }, this.opts);
  }
  backups(): Observable<Backup[]> { return this.http.get<any>(`${this.base}/backups`, this.opts).pipe(map(r => r.data)); }
  createBackup(): Observable<Backup> { return this.http.post<any>(`${this.base}/backups`, {}, this.opts).pipe(map(r => r.data)); }
  resetPreview(): Observable<ResetPreview> { return this.http.get<any>(`${this.base}/reset/preview`, this.opts).pipe(map(r => r.data)); }
  resetAll(body: { password: string; confirm: string; delete_files: boolean }): Observable<ResetResult> {
    return this.http.post<any>(`${this.base}/reset`, body, this.opts);
  }
  downloadBackup(name: string): Observable<Blob> {
    return this.http.get(`${this.base}/backups/${encodeURIComponent(name)}/download`, { ...this.opts, responseType: 'blob' });
  }
}
