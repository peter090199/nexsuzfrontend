import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NotificationsService } from 'src/app/services/Global/notifications.service';
import { Announcement, AnnouncementPriority, AnnouncementService } from 'src/app/services/Announcements/announcement.service';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const FILE_EXT = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'zip'];
const MAX_IMAGES = 10, MAX_FILES = 5, MAX_IMAGE_BYTES = 3 * 1024 * 1024, MAX_FILE_BYTES = 10 * 1024 * 1024;

/**
 * Write or edit an announcement (DEF-ADMIN / DEF-MASTERADMIN; the API refuses everybody else). A new one is saved as a draft or
 * published at once; an existing one is edited here and published, archived or restored from the list.
 */
@Component({
  selector: 'app-announcement-dialog',
  template: `
    <button mat-icon-button type="button" class="close-button" aria-label="Close" [mat-dialog-close]="false" [disabled]="working"><mat-icon>close</mat-icon></button>
    <h2 mat-dialog-title><mat-icon>campaign</mat-icon> {{ editing ? 'Edit announcement' : 'New announcement' }}</h2>

    <mat-dialog-content>
      <mat-progress-bar *ngIf="working" mode="indeterminate"></mat-progress-bar>
      <p class="err" *ngIf="error" role="alert">{{ error }}</p>

      <mat-form-field appearance="outline" class="w-100">
        <mat-label>Title</mat-label>
        <input matInput name="title" [(ngModel)]="form.title" maxlength="200" [disabled]="working" autocomplete="off" data-testid="title">
        <mat-hint align="end">{{ form.title.length }} / 200</mat-hint>
      </mat-form-field>

      <mat-form-field appearance="outline" class="w-100">
        <mat-label>Content</mat-label>
        <textarea matInput name="content" [(ngModel)]="form.content" rows="6" maxlength="10000" [disabled]="working" data-testid="content"></textarea>
        <mat-hint align="end">{{ form.content.length }} / 10000</mat-hint>
      </mat-form-field>

      <div class="row">
        <mat-form-field appearance="outline">
          <mat-label>Priority</mat-label>
          <mat-select name="priority" [(ngModel)]="form.priority" [disabled]="working">
            <mat-option value="normal">Normal</mat-option>
            <mat-option value="important">Important</mat-option>
            <mat-option value="urgent">Urgent</mat-option>
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Expires (optional)</mat-label>
          <input matInput type="datetime-local" name="expires" [(ngModel)]="form.expires_at" [disabled]="working" data-testid="expires">
        </mat-form-field>
      </div>
      <mat-slide-toggle color="primary" [(ngModel)]="form.is_pinned" [disabled]="working" name="pin" class="pin">Pin to the top of the feed</mat-slide-toggle>

      <!-- images -->
      <section class="files">
        <h4>Images <small>(up to {{ MAX_IMAGES }}, 3 MB each)</small></h4>
        <ul *ngIf="existingImages.length || images.length">
          <li *ngFor="let f of existingImages"><mat-icon>image</mat-icon><span>{{ f.name }}</span><button mat-icon-button type="button" (click)="removeExisting(f.id)" [attr.aria-label]="'Remove ' + f.name" [disabled]="working"><mat-icon>close</mat-icon></button></li>
          <li *ngFor="let f of images; let i = index" class="new"><mat-icon>add_photo_alternate</mat-icon><span>{{ f.name }}</span><button mat-icon-button type="button" (click)="images.splice(i, 1)" [attr.aria-label]="'Remove ' + f.name" [disabled]="working"><mat-icon>close</mat-icon></button></li>
        </ul>
        <button mat-stroked-button type="button" (click)="imageInput.click()" [disabled]="working"><mat-icon>image</mat-icon> Add images</button>
        <input #imageInput type="file" hidden multiple accept="image/jpeg,image/png,image/gif,image/webp" (change)="addImages($event)" data-testid="image-input">
      </section>

      <!-- attachments -->
      <section class="files">
        <h4>Attachments <small>(up to {{ MAX_FILES }}: PDF, Word, Excel, PowerPoint, TXT, CSV, ZIP; 10 MB each)</small></h4>
        <ul *ngIf="existingFiles.length || files.length">
          <li *ngFor="let f of existingFiles"><mat-icon>attach_file</mat-icon><span>{{ f.name }}</span><button mat-icon-button type="button" (click)="removeExisting(f.id)" [attr.aria-label]="'Remove ' + f.name" [disabled]="working"><mat-icon>close</mat-icon></button></li>
          <li *ngFor="let f of files; let i = index" class="new"><mat-icon>note_add</mat-icon><span>{{ f.name }}</span><button mat-icon-button type="button" (click)="files.splice(i, 1)" [attr.aria-label]="'Remove ' + f.name" [disabled]="working"><mat-icon>close</mat-icon></button></li>
        </ul>
        <button mat-stroked-button type="button" (click)="fileInput.click()" [disabled]="working"><mat-icon>attach_file</mat-icon> Add files</button>
        <input #fileInput type="file" hidden multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip" (change)="addFiles($event)" data-testid="file-input">
      </section>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-stroked-button type="button" [mat-dialog-close]="false" [disabled]="working">Cancel</button>
      <ng-container *ngIf="!editing">
        <button mat-stroked-button type="button" (click)="save('draft')" [disabled]="!canSave" data-testid="save-draft"><mat-icon>drafts</mat-icon> Save draft</button>
        <button mat-flat-button color="primary" type="button" (click)="save('published')" [disabled]="!canSave" data-testid="publish"><mat-icon>campaign</mat-icon> {{ working ? 'Publishing…' : 'Publish' }}</button>
      </ng-container>
      <button mat-flat-button color="primary" type="button" *ngIf="editing" (click)="save()" [disabled]="!canSave" data-testid="save"><mat-icon>save</mat-icon> {{ working ? 'Saving…' : 'Save changes' }}</button>
    </mat-dialog-actions>`,
  styles: [`
    .w-100 { width: 100%; } h2 mat-icon { vertical-align: middle; margin-right: 6px; }
    .row { display: flex; gap: 12px; flex-wrap: wrap; } .row mat-form-field { flex: 1 1 200px; }
    .pin { display: block; margin: 0 0 14px; } .err { color: #c62828; font-size: 13px; }
    .files { margin: 8px 0 14px; } .files h4 { margin: 0 0 6px; font-size: 13px; } .files small { color: #6b7a99; font-weight: 400; }
    .files ul { list-style: none; margin: 0 0 8px; padding: 0; } .files li { display: flex; align-items: center; gap: 8px; font-size: 13px; padding: 2px 0; }
    .files li span { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .files li.new span { color: #1b6a3d; }
    .files li mat-icon:first-child { color: #0a4a94; font-size: 18px; width: 18px; height: 18px; }
    mat-dialog-actions { flex-wrap: wrap; gap: 8px; }
    @media (max-width: 600px) {
      .row mat-form-field { flex: 1 1 100%; }                                  /* priority and expiry stack */
      mat-dialog-actions { flex-direction: column-reverse; align-items: stretch; margin: 0; }
      mat-dialog-actions button { width: 100%; min-height: 42px; margin: 0 !important; }   /* thumb-sized, Publish on top */
      .files .mat-stroked-button { width: 100%; }
    }
  `]
})
export class AnnouncementDialogComponent {
  readonly MAX_IMAGES = MAX_IMAGES;
  readonly MAX_FILES = MAX_FILES;

  editing: Announcement | null;
  form: { title: string; content: string; priority: AnnouncementPriority; is_pinned: boolean; expires_at: string } =
    { title: '', content: '', priority: 'normal', is_pinned: false, expires_at: '' };
  images: File[] = [];
  files: File[] = [];
  existingImages: { id: number; name: string }[] = [];
  existingFiles: { id: number; name: string }[] = [];
  private removeIds = new Set<number>();
  working = false;
  error = '';

  constructor(private api: AnnouncementService, private ref: MatDialogRef<AnnouncementDialogComponent>, private notify: NotificationsService,
    @Inject(MAT_DIALOG_DATA) data: { announcement?: Announcement } | null) {
    this.editing = data?.announcement || null;
    if (this.editing) {
      const a = this.editing;
      this.form = { title: a.title, content: a.content, priority: a.priority, is_pinned: a.is_pinned, expires_at: this.toLocalInput(a.expires_at) };
      this.existingImages = a.images.map(f => ({ id: f.id, name: f.name }));
      this.existingFiles = a.attachments.map(f => ({ id: f.id, name: f.name }));
    }
  }

  /** "2026-11-30 09:00:00" -> the value a datetime-local input wants */
  private toLocalInput(v: string | null): string { return v ? v.replace(' ', 'T').slice(0, 16) : ''; }

  get canSave(): boolean { return !this.working && !!this.form.title.trim() && !!this.form.content.trim(); }

  removeExisting(id: number): void {
    this.removeIds.add(id);
    this.existingImages = this.existingImages.filter(f => f.id !== id);
    this.existingFiles = this.existingFiles.filter(f => f.id !== id);
  }

  addImages(event: any): void {
    const picked: File[] = Array.from(event.target.files || []);
    event.target.value = '';
    for (const f of picked) {
      if (!IMAGE_TYPES.includes(f.type)) { this.error = `${f.name}: images must be JPG, PNG, GIF or WEBP.`; continue; }
      if (f.size > MAX_IMAGE_BYTES) { this.error = `${f.name}: each image must be 3 MB or smaller.`; continue; }
      if (this.existingImages.length + this.images.length >= MAX_IMAGES) { this.error = `You can attach up to ${MAX_IMAGES} images.`; break; }
      this.images.push(f); this.error = '';
    }
  }

  addFiles(event: any): void {
    const picked: File[] = Array.from(event.target.files || []);
    event.target.value = '';
    for (const f of picked) {
      const ext = (f.name.split('.').pop() || '').toLowerCase();
      if (!FILE_EXT.includes(ext)) { this.error = `${f.name}: attachments must be PDF, Word, Excel, PowerPoint, TXT, CSV or ZIP.`; continue; }
      if (f.size > MAX_FILE_BYTES) { this.error = `${f.name}: each attachment must be 10 MB or smaller.`; continue; }
      if (this.existingFiles.length + this.files.length >= MAX_FILES) { this.error = `You can attach up to ${MAX_FILES} files.`; break; }
      this.files.push(f); this.error = '';
    }
  }

  /** new: pass 'draft' or 'published'. Editing: no argument. */
  save(status?: 'draft' | 'published'): void {
    if (!this.canSave) { return; }
    const f = this.form;
    if (status === 'published' && f.expires_at && new Date(f.expires_at).getTime() <= Date.now()) {
      this.error = 'The expiration date must be in the future.'; return;
    }
    const fd = new FormData();
    fd.append('title', f.title.trim());
    fd.append('content', f.content.trim());
    fd.append('priority', f.priority);
    fd.append('is_pinned', f.is_pinned ? '1' : '0');
    if (this.editing) { fd.append('expires_at', f.expires_at || ''); } else if (f.expires_at) { fd.append('expires_at', f.expires_at); }
    if (status) { fd.append('status', status); }
    this.images.forEach(i => fd.append('images[]', i));
    this.files.forEach(a => fd.append('attachments[]', a));
    this.removeIds.forEach(id => fd.append('remove_attachments[]', String(id)));

    this.working = true; this.error = '';
    (this.editing ? this.api.update(this.editing.id, fd) : this.api.create(fd)).subscribe({
      next: (r: any) => { this.working = false; this.notify.toastrSuccess(r?.message || 'Saved.'); this.ref.close(true); },
      error: e => {
        this.working = false;
        const errs = e?.error?.errors;
        this.error = (errs ? (Object.values(errs)[0] as string[])?.[0] : '') || e?.error?.message || 'The announcement could not be saved.';
      },
    });
  }
}
