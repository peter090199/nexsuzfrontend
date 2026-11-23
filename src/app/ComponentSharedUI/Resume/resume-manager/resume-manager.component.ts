import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { NotificationsService } from 'src/app/services/Global/notifications.service';
import { UserResume, UserResumeService } from 'src/app/services/user-resume.service';
import { CvImportDialogComponent } from '../cv-import-dialog/cv-import-dialog.component';
import { CvModeService } from 'src/app/services/CV/cv-mode.service';
import { SettingsConfirmDialogComponent } from 'src/app/ComponentUI/profile/settings/confirm-dialog/confirm-dialog.component';

/**
 * A job seeker's own resumes (PDF, DOC or DOCX): upload, view, choose the default, delete, and import what a CV contains into the profile. One component, used in Settings > Resume / CV
 * and on the CV page (when the master admin has chosen "upload a CV / resume only"), so both always look and behave the same.
 * The API enforces everything (job seekers only, own files only, PDF/DOC/DOCX up to 5 MB, at most 5).
 */
@Component({
  selector: 'app-resume-manager',
  templateUrl: './resume-manager.component.html',
  styleUrls: ['./resume-manager.component.css']
})
export class ResumeManagerComponent implements OnInit {
  /** fires after every upload / delete / default change, so a page can refresh what depends on it */
  @Output() changed = new EventEmitter<UserResume[]>();
  /** fires after data from a CV was imported into the profile (the profile may have changed) */
  @Output() imported = new EventEmitter<void>();

  resumes: UserResume[] = [];
  max = 5;
  loading = false;
  uploading = false;
  busyId: number | null = null;
  dragOver = false;
  /** the master admin chose "upload only": the CV builder is not offered */
  uploadOnly = false;

  constructor(
    private svc: UserResumeService,
    private mode: CvModeService,
    private alert: NotificationsService,
    private dialog: MatDialog,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.mode.get().subscribe({ next: m => (this.uploadOnly = !!m.upload_only), error: () => { /* builder stays offered */ } });
    this.load();
  }

  get limitReached(): boolean { return this.resumes.length >= this.max; }

  private setList(list: UserResume[] | undefined): void {
    this.resumes = list || [];
    this.changed.emit(this.resumes);
  }

  load(): void {
    this.loading = true;
    this.svc.list().subscribe({
      next: res => { this.resumes = res?.data || []; this.max = res?.max || 5; this.loading = false; this.changed.emit(this.resumes); },
      error: () => { this.loading = false; this.alert.toastrError('Could not load your resumes.'); }
    });
  }

  onDrop(ev: DragEvent): void {
    ev.preventDefault();
    this.dragOver = false;
    const file = ev.dataTransfer?.files?.[0];
    if (file) { this.upload(file); }
  }

  onPicked(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';                       // the same file can be picked again later
    if (file) { this.upload(file); }
  }

  /** the server checks everything again; these checks only save a round trip */
  private upload(file: File): void {
    if (this.uploading) { return; }
    if (this.limitReached) { this.alert.toastrWarning(`You can keep up to ${this.max} resumes. Delete one to upload another.`); return; }
    if (!/\.(pdf|docx?)$/i.test(file.name)) { this.alert.toastrWarning('Please choose a PDF, DOC or DOCX file.'); return; }
    if (file.size > 5 * 1024 * 1024) { this.alert.toastrWarning('The resume must be 5 MB or smaller.'); return; }

    this.uploading = true;
    this.svc.upload(file).subscribe({
      next: res => {
        this.uploading = false;
        this.setList(res?.data);
        this.alert.toastrSuccess(res?.message || 'Resume uploaded.');
        // read it straight away and offer to fill the profile from it (the person reviews everything before it is saved)
        const added = (res?.data || []).find(r => r.id === res?.id);
        if (added) { this.importFrom(added, true); }
      },
      error: err => {
        this.uploading = false;
        const errors = err?.error?.errors || {};
        this.alert.toastrError(this.first(errors.resume) || this.first(err?.error?.message) || 'Could not upload the resume.');
      }
    });
  }

  makeDefault(r: UserResume): void {
    if (r.is_default || this.busyId !== null) { return; }
    this.busyId = r.id;
    this.svc.setDefault(r.id).subscribe({
      next: res => { this.busyId = null; this.setList(res?.data); this.alert.toastrSuccess(res?.message || 'Default resume updated.'); },
      error: err => { this.busyId = null; this.alert.toastrError(this.first(err?.error?.message) || 'Could not change the default.'); }
    });
  }

  confirmDelete(r: UserResume): void {
    this.dialog.open(SettingsConfirmDialogComponent, {
      width: '420px',
      data: {
        title: 'Delete this resume?',
        message: r.is_default && this.resumes.length > 1
          ? `"${r.name}" is your default. The newest of your other resumes becomes the default. Applications you already sent keep their own copy.`
          : `"${r.name}" will be removed from your account. Applications you already sent keep their own copy.`,
        confirmText: 'Delete', icon: 'delete_outline', danger: true
      }
    }).afterClosed().subscribe(ok => { if (ok) { this.remove(r); } });
  }

  private remove(r: UserResume): void {
    this.busyId = r.id;
    this.svc.remove(r.id).subscribe({
      next: res => { this.busyId = null; this.setList(res?.data); this.alert.toastrSuccess(res?.message || 'Resume deleted.'); },
      error: err => { this.busyId = null; this.alert.toastrError(this.first(err?.error?.message) || 'Could not delete the resume.'); }
    });
  }

  view(r: UserResume): void {
    this.svc.file(r.id).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        if (r.type === 'pdf') {
          window.open(url, '_blank', 'noopener');
        } else {
          const a = document.createElement('a');
          a.href = url; a.download = r.name; a.rel = 'noopener';
          document.body.appendChild(a); a.click(); a.remove();
        }
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      },
      error: () => this.alert.toastrError('Could not open the resume.')
    });
  }

  /** read this resume and open the preview: the person edits, chooses and confirms; only then is the profile changed */
  importFrom(r: UserResume, afterUpload = false): void {
    this.dialog.open(CvImportDialogComponent, {
      data: { resume: r, afterUpload },
      width: '920px', maxWidth: '96vw', maxHeight: '94vh', autoFocus: false, disableClose: true, panelClass: 'cvi-panel'
    }).afterClosed().subscribe(report => {
      if (report) {
        this.setList(report.resumes);            // the default may have moved
        this.imported.emit();
      }
    });
  }

  typeLabel(r: UserResume): string { return r.type.toUpperCase(); }

  formatSize(bytes: number): string {
    return bytes >= 1048576 ? (bytes / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(bytes / 1024)) + ' KB';
  }

  /** "Fill up your CV": the CV builder (only offered when the master admin has not chosen upload-only) */
  openCvBuilder(): void { this.router.navigate(['/DEF-USERS', 'user-cv']); }

  private first(m: any): string {
    if (!m) { return ''; }
    return Array.isArray(m) ? m.join(' ') : String(m);
  }
}
