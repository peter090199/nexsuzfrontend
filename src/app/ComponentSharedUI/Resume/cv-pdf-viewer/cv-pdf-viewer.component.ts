import { Component, Inject, OnDestroy } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CvPdfService } from 'src/app/services/CV/cv-pdf.service';

/** The embedded PDF viewer (CV Setup: Display = Embedded). Shows a PDF the page already holds; nothing is re-fetched. */
@Component({
  selector: 'app-cv-pdf-viewer',
  template: `
<div class="pv-head">
  <strong>{{ data.filename }}</strong>
  <span class="pv-space"></span>
  <button mat-stroked-button color="primary" type="button" *ngIf="pdf.settings.allow_print" (click)="pdf.print(data.blob)"><mat-icon>print</mat-icon> Print</button>
  <button mat-stroked-button color="primary" type="button" *ngIf="pdf.settings.allow_download" (click)="pdf.download(data.blob, data.filename)"><mat-icon>download</mat-icon> Download</button>
  <button mat-icon-button type="button" mat-dialog-close aria-label="Close"><mat-icon>close</mat-icon></button>
</div>
<iframe class="pv-frame" [src]="url" title="PDF preview"></iframe>
<p class="pv-note">If the preview stays blank, your browser cannot show PDFs inside a page.<ng-container *ngIf="pdf.settings.allow_download"> Use Download instead.</ng-container></p>
`,
  styles: [`
    .pv-head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 8px; }
    .pv-head strong { overflow-wrap: anywhere; } .pv-space { flex: 1; }
    .pv-frame { width: 100%; height: 70vh; border: 1px solid #e3e9f3; border-radius: 8px; }
    .pv-note { margin: 6px 0 0; font-size: 11px; color: #6b7a99; }
  `]
})
export class CvPdfViewerComponent implements OnDestroy {
  readonly url: SafeResourceUrl;
  private readonly objectUrl: string;

  constructor(@Inject(MAT_DIALOG_DATA) public data: { blob: Blob; filename: string }, public pdf: CvPdfService, sanitizer: DomSanitizer) {
    this.objectUrl = URL.createObjectURL(data.blob);
    const hide = pdf.settings.allow_download && pdf.settings.allow_print ? '' : '#toolbar=0';
    // safe: a blob: address this component just made from the bytes it was given
    this.url = sanitizer.bypassSecurityTrustResourceUrl(this.objectUrl + hide);
  }

  ngOnDestroy(): void { URL.revokeObjectURL(this.objectUrl); }
}
