import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { CvPdfViewerComponent } from 'src/app/ComponentSharedUI/Resume/cv-pdf-viewer/cv-pdf-viewer.component';
import { _url } from 'src/global-variables';

export interface CvPdfSettings {
  preview_enabled: boolean;
  method: 'preview' | 'download';
  display: 'tab' | 'embedded';
  filename: string;
  page_size: 'a4' | 'letter' | 'legal';
  orientation: 'portrait' | 'landscape';
  allow_print: boolean;
  allow_download: boolean;
}

/** Must match CvPdfSettingsController::DEFAULTS: how the app behaves until a master admin changes it. */
export const CV_PDF_DEFAULTS: CvPdfSettings = {
  preview_enabled: true, method: 'preview', display: 'embedded', filename: 'CV_{name}',
  page_size: 'a4', orientation: 'portrait', allow_print: true, allow_download: true
};

/** portrait width and height in millimetres */
const PAPER: Record<CvPdfSettings['page_size'], [number, number]> = { a4: [210, 297], letter: [215.9, 279.4], legal: [215.9, 355.6] };

/**
 * CV Setup applied: the options, the file name and page size, and what "preview", "print" and "download" do with a
 * PDF that already exists (the CV page builds its PDF; resumes are the uploaded files).
 */
@Injectable({ providedIn: 'root' })
export class CvPdfService {
  readonly settings$ = new BehaviorSubject<CvPdfSettings>(CV_PDF_DEFAULTS);

  constructor(private http: HttpClient, private dialog: MatDialog) { }

  get settings(): CvPdfSettings { return this.settings$.value; }

  /** asked each time a CV or resume screen opens, so a change applies without signing in again */
  load(): Observable<CvPdfSettings> {
    return this.http.get<any>(`${_url}cv/pdf-settings`).pipe(
      map(r => ({ ...CV_PDF_DEFAULTS, ...(r?.data || {}) }) as CvPdfSettings),
      catchError(() => of(this.settings)),
      tap(s => this.settings$.next(s)));
  }

  /** page width and height in millimetres for the chosen size and orientation */
  pageMm(settings = this.settings): [number, number] {
    const [w, h] = PAPER[settings.page_size] || PAPER.a4;

    return settings.orientation === 'landscape' ? [h, w] : [w, h];
  }

  fileName(person: string, settings = this.settings): string {
    const name = (person || '').replace(/[^\w\-]+/g, '_') || 'CV';
    const base = (settings.filename || CV_PDF_DEFAULTS.filename).split('{name}').join(name).replace(/[\\/:*?"<>|]+/g, '_').trim();

    return `${base || name}.pdf`;
  }

  /**
   * A tab has to be opened while the click is still being handled, or the browser blocks it. Call this first, before
   * building or fetching the PDF; null when no tab is needed (or it was blocked).
   */
  openTabIfNeeded(settings = this.settings): Window | null {
    if (settings.method !== 'preview' || settings.display !== 'tab') { return null; }
    const tab = window.open('', '_blank');
    if (tab) { tab.opener = null; }

    return tab;
  }

  /** what the "PDF preview" button does, as CV Setup says: new tab, the viewer inside the page, or a download */
  present(blob: Blob, filename: string, tab: Window | null = null): void {
    const settings = this.settings;
    if (settings.method === 'download') {
      tab?.close();
      this.download(blob, filename);
      return;
    }
    if (settings.display === 'tab' && tab) {
      const url = URL.createObjectURL(blob);
      // hides the viewer's own buttons where the browser allows it; it is not a lock
      tab.location.href = url + (settings.allow_download && settings.allow_print ? '' : '#toolbar=0');
      setTimeout(() => URL.revokeObjectURL(url), 5 * 60000);
      return;
    }
    // embedded, or the new tab was blocked
    this.dialog.open(CvPdfViewerComponent, { data: { blob, filename }, width: '900px', maxWidth: '96vw', autoFocus: false });
  }

  download(blob: Blob, filename: string): void {
    if (!this.settings.allow_download) { return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  print(blob: Blob): void {
    if (!this.settings.allow_print) { return; }
    const url = URL.createObjectURL(blob);
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    frame.onload = () => { frame.contentWindow?.focus(); frame.contentWindow?.print(); };
    frame.src = url;
    document.body.appendChild(frame);
    setTimeout(() => { frame.remove(); URL.revokeObjectURL(url); }, 5 * 60000);
  }
}
