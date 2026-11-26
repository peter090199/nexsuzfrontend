import { Component, ElementRef, OnDestroy, OnInit, Optional, ViewChild } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom, Subscription } from 'rxjs';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { CurriculumVitaeService } from 'src/app/services/CV/curriculum-vitae.service';
import { NotificationsService } from 'src/app/services/Global/notifications.service';
import { SharedRoutinesService } from 'src/app/services/Function/shared-routines.service';
import { _url } from 'src/global-variables';
import { ProfileImageService } from 'src/app/services/Profile/profile-image.service';

const DEFAULT_PHOTO = 'assets/images/default.png';
const SETTINGS_KEY = 'nx-cv-settings';
const DEFAULT_HEADER = '#004182';
const DEFAULT_FONT = 'Verdana';
const DEFAULT_SIZE = 13;           // body text size in px; every other size scales from it
/** Word-style font list: name shown -> CSS stack (installed fonts are used, otherwise the generic fallback) */
const CV_FONTS: { name: string; stack: string }[] = [
  { name: 'Verdana', stack: "Verdana, Geneva, Tahoma, sans-serif" },
  { name: 'Arial', stack: "Arial, Helvetica, sans-serif" },
  { name: 'Calibri', stack: "Calibri, Carlito, 'Segoe UI', sans-serif" },
  { name: 'Cambria', stack: "Cambria, Caladea, Georgia, serif" },
  { name: 'Century Gothic', stack: "'Century Gothic', 'Apple Gothic', Futura, sans-serif" },
  { name: 'Courier New', stack: "'Courier New', Courier, monospace" },
  { name: 'Garamond', stack: "Garamond, 'EB Garamond', Georgia, serif" },
  { name: 'Georgia', stack: "Georgia, 'Times New Roman', serif" },
  { name: 'Segoe UI', stack: "'Segoe UI', Roboto, Arial, sans-serif" },
  { name: 'Tahoma', stack: "Tahoma, Geneva, Verdana, sans-serif" },
  { name: 'Times New Roman', stack: "'Times New Roman', Times, serif" },
  { name: 'Trebuchet MS', stack: "'Trebuchet MS', Helvetica, sans-serif" },
];
const CV_SIZES = [9, 10, 11, 12, 13, 14, 15, 16, 18];
const A4_WIDTH_PX = 794; // 210mm @ 96dpi: width used when rendering the PDF/print copy

@Component({
  selector: 'app-print-cv',
  templateUrl: './print-cv.component.html',
  styleUrls: ['./print-cv.component.css']
})
export class PrintCVComponent implements OnInit, OnDestroy {
  /** getProfileCV returns an array (one entry per userprofiles row) */
  cvData: any[] = [];
  error: string | null = null;
  isLoading = true;
  busy: '' | 'pdf' | 'print' = '';
  finishing = false;

  // ---------- CV settings (header colour) ----------
  showSettings = false;
  headerColor = DEFAULT_HEADER;
  /** print the header band in colour (off = clean white header to save ink) */
  printInColor = false;
  fontFamily = DEFAULT_FONT;
  fontSize = DEFAULT_SIZE;
  readonly fonts = CV_FONTS;
  readonly sizes = CV_SIZES;
  readonly presets = ['#004182', '#0a66c2', '#1b8a4b', '#6a1b9a', '#c62828', '#e08a00', '#37474f', '#111111', '#ffffff'];
  /** Required CV fields that are still empty (shown in a banner, blocks Finish) */
  missing: string[] = [];
  @ViewChild('printContent') printContent!: ElementRef<HTMLElement>;

  code: any;
  defaultPhoto = DEFAULT_PHOTO;

  constructor(
    private cvService: CurriculumVitaeService,
    private router: Router,
    private alert: NotificationsService,
    private sharedRoutines: SharedRoutinesService,
    private profileImages: ProfileImageService,
    /** Present when opened as a dialog from the CV editor; absent on the /print-cv route */
    @Optional() private dialogRef: MatDialogRef<PrintCVComponent>,
    private route: ActivatedRoute
  ) { }

  /** Set when opened from a share link (/cv/:code/:signature): read only, no sign in needed */
  shared: { code: string; signature: string } | null = null;
  /** own CV only: fetched up front so Share can open the share sheet straight from the click */
  private shareUrl = '';

  get isDialog(): boolean { return !!this.dialogRef; }
  get cv(): any { return this.cvData[0]; }

  /** The account's own picture (same source as the top bar) */
  private accountPhoto: string | null | undefined;
  private photoSub?: Subscription;

  ngOnInit(): void {
    const params = this.isDialog ? null : this.route.snapshot.paramMap;
    const code = params?.get('code');
    const signature = params?.get('signature');
    if (code && signature) {
      // someone else's CV: nothing of the viewer's (settings, photo, saved copy) is mixed into it
      this.shared = { code, signature };
      this.getCVData();
      return;
    }
    this.loadSettings();
    this.getCVData();
    this.loadAccountPhoto();
    // photo changed/removed during this session: follow it, like the top bar does
    this.photoSub = this.profileImages.photo$.subscribe(url => {
      if (url !== undefined) this.accountPhoto = url;
    });
  }

  ngOnDestroy(): void { this.photoSub?.unsubscribe(); }

  private loadAccountPhoto(): void {
    this.cvService.getDataCV().subscribe({
      next: (res: any) => { if (this.accountPhoto === undefined) this.accountPhoto = res?.message?.photo_pic ?? null; },
      error: () => { /* fall back to the CV payload's photo */ }
    });
  }

  /** One picture for the whole app: account photo, else the CV row's photo, else the default avatar. */
  get photoUrl(): string {
    const pick = this.accountPhoto === undefined ? this.cv?.photo_pic : this.accountPhoto;
    return !pick || String(pick).includes('DEFAULTPROFILE') ? DEFAULT_PHOTO : pick;
  }

  /** @param after runs once fresh data is in (used by Preview/Finish) */
  getCVData(after?: () => void): void {
    this.isLoading = true;
    this.error = null;
    if (this.shared) { this.loadSharedCV(this.shared); return; }
    this.cvService.getProfileCV().subscribe({
      next: (response) => {
        if (response?.success && Array.isArray(response.message) && response.message.length) {
          this.cvData = response.message.map((c: any) => this.normalise(c));
          this.code = this.cvData[0].code;
          this.cache();
          this.loadShareLink();
        } else {
          this.error = response?.success
            ? 'Your CV has no content yet. Complete the CV steps first.'
            : (response?.message || 'Invalid response format.');
          this.loadFromLocalStorage();
        }
        this.isLoading = false;
        after?.();
      },
      error: (err) => {
        console.error('Error fetching CV data:', err);
        this.error = 'Error fetching CV data.';
        this.loadFromLocalStorage();
        this.isLoading = false;
        after?.();
      }
    });
  }

  private loadSharedCV(link: { code: string; signature: string }): void {
    this.cvService.getSharedCV(link.code, link.signature).subscribe({
      next: (response) => {
        this.cvData = response?.success && Array.isArray(response.message) ? response.message.map((c: any) => this.normalise(c)) : [];
        if (!this.cvData.length) this.error = 'This CV could not be loaded.';
        this.isLoading = false;
      },
      error: (err) => {
        this.cvData = [];
        this.error = err?.status === 404 ? 'This CV link is not valid or the CV is no longer available.'
          : err?.status === 429 ? 'Too many requests. Please wait a minute and try again.'
          : 'Could not load this CV. Check your connection and try again.';
        this.isLoading = false;
      }
    });
  }

  private loadShareLink(): void {
    this.cvService.getShareLink().subscribe({
      next: (res: any) => this.shareUrl = res?.url || '',
      error: () => { /* Share asks again and reports the problem then */ }
    });
  }

  /** Guarantee every list exists so the template never throws on partial CVs */
  private normalise(c: any): any {
    const l = c?.lines || {};
    return {
      ...c,
      lines: {
        education: l.education || [], language: l.language || [], training: l.training || [],
        seminar: l.seminar || [], skills: l.skills || [], employment: l.employment || [],
        certificate: l.certificate || []
      }
    };
  }

  private cache(): void {
    try { localStorage.setItem('Headers', JSON.stringify(this.cvData)); } catch { /* storage unavailable */ }
  }

  private loadFromLocalStorage(): void {
    try {
      const saved = localStorage.getItem('Headers');
      if (!saved) return;
      const parsed = JSON.parse(saved);
      const list = Array.isArray(parsed) ? parsed : [parsed];
      this.cvData = list.filter(Boolean).map((c: any) => this.normalise(c));
      if (this.cvData.length) {
        this.code = this.cvData[0].code;
        this.error = 'Showing a saved copy of your CV (could not reach the server).';
      }
    } catch { /* ignore corrupt cache */ }
  }

  // ---------- settings ----------
  /** Text colour that stays readable on the chosen header colour */
  get headerText(): string {
    const m = /^#([0-9a-f]{6})$/i.exec(this.headerColor);
    if (!m) return '#ffffff';
    const n = parseInt(m[1], 16);
    const lin = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
    return L > 0.5 ? '#111111' : '#ffffff';
  }

  setColor(color: string): void {
    if (!/^#[0-9a-f]{6}$/i.test(color || '')) return;
    this.headerColor = color.toLowerCase();
    this.saveSettings();
  }

  /** CSS font stack for the chosen family */
  get fontStack(): string {
    return (CV_FONTS.find(f => f.name === this.fontFamily) || CV_FONTS[0]).stack;
  }
  stackOf(name: string): string {
    return (CV_FONTS.find(f => f.name === name) || CV_FONTS[0]).stack;
  }
  /** Multiplier applied to every CV font size */
  get fontScale(): number { return this.fontSize / DEFAULT_SIZE; }

  setFontFamily(name: string): void {
    if (!CV_FONTS.some(f => f.name === name)) return;
    this.fontFamily = name;
    this.saveSettings();
  }

  setFontSize(size: number): void {
    const n = Number(size);
    if (!CV_SIZES.includes(n)) return;
    this.fontSize = n;
    this.saveSettings();
  }

  /** Word-style grow / shrink font buttons */
  stepFont(dir: 1 | -1): void {
    const i = CV_SIZES.indexOf(this.fontSize);
    const next = CV_SIZES[Math.min(CV_SIZES.length - 1, Math.max(0, (i < 0 ? CV_SIZES.indexOf(DEFAULT_SIZE) : i) + dir))];
    this.setFontSize(next);
  }

  setPrintInColor(on: boolean): void {
    this.printInColor = !!on;
    this.saveSettings();
  }

  resetSettings(): void {
    this.headerColor = DEFAULT_HEADER;
    this.printInColor = false;
    this.fontFamily = DEFAULT_FONT;
    this.fontSize = DEFAULT_SIZE;
    this.saveSettings();
  }

  private loadSettings(): void {
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
      if (saved && /^#[0-9a-f]{6}$/i.test(saved.headerColor || '')) this.headerColor = saved.headerColor.toLowerCase();
      if (saved) this.printInColor = !!saved.printInColor;
      if (saved && CV_FONTS.some(f => f.name === saved.fontFamily)) this.fontFamily = saved.fontFamily;
      if (saved && CV_SIZES.includes(Number(saved.fontSize))) this.fontSize = Number(saved.fontSize);
    } catch { /* storage unavailable or corrupt: keep defaults */ }
  }

  private saveSettings(): void {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ headerColor: this.headerColor, printInColor: this.printInColor, fontFamily: this.fontFamily, fontSize: this.fontSize }));
    } catch { /* not persisted, still applied for this session */ }
  }

  // ---------- helpers for the template ----------
  fullName(c: any): string {
    return [c?.fname, c?.lname].filter(Boolean).join(' ') || 'Your Name';
  }
  /** "Hide" toggles in the editor: true/1 = hidden */
  hidden(flag: any): boolean { return flag === true || flag === 1 || flag === '1'; }
  location(c: any): string {
    return [c?.current_location, c?.current_state].filter(Boolean).join(', ');
  }
  homePlace(c: any): string {
    return [c?.home_state, c?.home_country].filter(Boolean).join(', ');
  }
  trackByIndex(i: number): number { return i; }

  // ---------- actions ----------
  /**
   * Open the CV editor. As a dialog: close it first, then go to the editor unless that page is
   * already open behind it (the dialog is also opened from Home and Feeds, where it is not).
   */
  editCV(): void {
    const editorUrl = `/${this.sharedRoutines.getRole()}/user-cv`;
    const onEditor = this.router.url.split(/[?#]/)[0].endsWith('/user-cv');
    this.dialogRef?.close();
    if (!onEditor) {
      this.router.navigateByUrl(editorUrl).then(ok => {
        if (!ok) this.alert.toastrError('Could not open the CV editor.');
      });
    }
  }

  close(): void { this.dialogRef?.close(); }

  /** true = showing the CV as a printed A4 page */
  previewMode = false;

  /**
   * Preview CV: reload what is saved, then show the CV as it will print / download
   * (A4 page, your header colour and font). Call again to leave the preview.
   */
  preview(): void {
    if (this.previewMode) { this.previewMode = false; return; }
    this.missing = [];
    this.showSettings = false;
    this.getCVData(() => {
      if (!this.cv) {
        this.alert.toastrWarning('There is no CV information to preview yet.');
        return;
      }
      this.previewMode = true;
      setTimeout(() => this.printContent?.nativeElement?.scrollIntoView?.({ block: 'start', behavior: 'smooth' }), 0);
    });
  }

  /** Same required fields the CV editor steps enforce */
  private findMissing(c: any): string[] {
    if (!c) return ['CV information'];
    const req: [string, any][] = [
      ['First name', c.fname], ['Family name', c.lname], ['Profession', c.profession],
      ['Contact number', c.contact_no], ['Date of birth', c.date_birth],
      ['Home country', c.home_country], ['Home city / state', c.home_state],
      ['Current location', c.current_location], ['Current city / state', c.current_state],
      ['Summary', c.summary],
    ];
    return req.filter(([, v]) => v === null || v === undefined || String(v).trim() === '').map(([k]) => k);
  }

  /** yyyy-MM-dd -> M/d/yyyy (format saveProfile expects) */
  private toUsDate(v: any): string {
    const [y, m, d] = String(v || '').substring(0, 10).split('-').map(Number);
    return y && m && d ? m + '/' + d + '/' + y : '';
  }

  /**
   * Finish: validate -> save through the existing saveProfile API -> refresh the preview.
   * Nothing is finalized (dialog stays open) unless the save succeeds.
   */
  finish(): void {
    if (this.finishing || !this.cv) return;
    const c = this.cv;
    this.missing = this.findMissing(c);
    if (this.missing.length) {
      this.alert.toastrWarning('Please complete the required CV information first.');
      return;
    }

    const fd = new FormData();
    fd.append('contact_no', c.contact_no);
    fd.append('contact_visibility', this.hidden(c.contact_visibility) ? '1' : '0');
    fd.append('email_visibility', this.hidden(c.email_visibility) ? '1' : '0');
    fd.append('date_birth', this.toUsDate(c.date_birth));
    fd.append('home_country', c.home_country);
    fd.append('home_state', c.home_state);
    fd.append('current_location', c.current_location);
    fd.append('current_state', c.current_state);
    fd.append('summary', c.summary);

    this.finishing = true;
    this.cvService.saveProfile(fd).subscribe({
      next: (res: any) => {
        if (res?.success) {
          this.alert.toastrSuccess(res.message || 'Your CV has been saved.');
          this.getCVData(() => {
            this.finishing = false;
            // the editor (opener) continues to /home when closed with true
            if (this.dialogRef) this.dialogRef.close(true);
          });
        } else {
          this.finishing = false;
          const m = res?.message;
          this.alert.toastrError((Array.isArray(m) ? m.join(' ') : m) || 'Could not save your CV.');
        }
      },
      error: (err) => {
        this.finishing = false;
        const m = err?.error?.message;
        this.alert.toastrError((Array.isArray(m) ? m.join(' ') : m) || 'Could not save your CV. Please try again.');
      }
    });
  }

  async share(): Promise<void> {
    let reason = '';
    if (!this.shareUrl) {
      try {
        this.shareUrl = (await firstValueFrom(this.cvService.getShareLink()))?.url || '';
      } catch (e: any) { reason = e?.error?.message || ''; }
    }
    const url = this.shareUrl;
    if (!url) {
      this.alert.toastrError(reason || 'Could not create the share link. Please try again.');
      return;
    }
    const title = `${this.fullName(this.cv)} – Curriculum Vitae`;
    const nav: any = navigator;
    try {
      if (nav.share) {
        await nav.share({ title, text: title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      this.alert.toastrSuccess('CV link copied. Anyone with the link can view your CV.');
    } catch (e: any) {
      if (e?.name === 'AbortError') return; // user closed the share sheet
      this.alert.toastrInfo(`Copy this link: ${url}`);
    }
  }

  /** Clone the CV into an off-screen, fixed-width A4 container so output never depends on the viewport. */
  private makeSheetClone(): { wrap: HTMLElement; sheet: HTMLElement } | null {
    const src = this.printContent?.nativeElement;
    if (!src) return null;
    const wrap = document.createElement('div');
    wrap.style.cssText = `position:fixed;left:-10000px;top:0;width:${A4_WIDTH_PX}px;background:#fff;`;
    const sheet = src.cloneNode(true) as HTMLElement;
    sheet.classList.remove('preview-paper', 'plain-head'); // preview-only looks must not leak into PDF/print
    sheet.classList.add('pdf-mode');
    sheet.style.width = `${A4_WIDTH_PX}px`;
    wrap.appendChild(sheet);
    document.body.appendChild(wrap);
    return { wrap, sheet };
  }

  /**
   * html2canvas can only draw images it is allowed to read. Uploaded photos live under /storage,
   * which the file server returns without CORS headers, so the PDF copy gets the photo through
   * the API (GET media, or the share link's photo endpoint) and embeds it as an inline data URL.
   * Bundled assets are same-origin and only need to finish loading. A picture that cannot be
   * fetched stops the export: a PDF with a hole in it is never saved.
   */
  private async prepareImagesForCanvas(root: HTMLElement): Promise<void> {
    const imgs = Array.from(root.querySelectorAll('img'));
    await Promise.all(imgs.map(async img => {
      const src = img.getAttribute('src') || '';
      if (!/^https?:/i.test(src)) { // inline or same-origin asset
        await this.imageReady(img);
        return;
      }
      const res = this.shared
        ? await fetch(`${this.cvService.sharedCvUrl(this.shared.code, this.shared.signature)}/photo`)
        : await fetch(`${_url}media?path=${encodeURIComponent(src)}`, {
          headers: { Authorization: `Bearer ${sessionStorage.getItem('token') || ''}` }
        });
      if (!res.ok) throw new Error(`Photo could not be loaded (HTTP ${res.status})`);
      const blob = await res.blob();
      const dataUrl: string = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = () => reject(r.error);
        r.readAsDataURL(blob);
      });
      await this.setImgSrc(img, dataUrl);
      if (!img.naturalWidth) throw new Error('Photo could not be read');
    }));
  }

  private imageReady(img: HTMLImageElement): Promise<void> {
    return img.complete ? Promise.resolve() : new Promise<void>(resolve => {
      img.onload = img.onerror = () => resolve();
    });
  }

  private setImgSrc(img: HTMLImageElement, src: string): Promise<void> {
    return new Promise<void>(resolve => {
      img.onload = () => resolve();
      img.onerror = () => resolve();
      img.src = src;
    });
  }

  async downloadPDF(): Promise<void> {
    if (!this.cv || this.busy) return;
    const clone = this.makeSheetClone();
    if (!clone) return;
    this.busy = 'pdf';
    try {
      await this.prepareImagesForCanvas(clone.sheet);
      await (document as any).fonts?.ready; // icons and the chosen font must be in before drawing
      const scale = 2;
      const canvas = await html2canvas(clone.sheet, { scale, useCORS: true, backgroundColor: '#ffffff', logging: false });
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 8;
      const usableH = pageH - margin * 2;
      const pxPerMm = canvas.width / (pageW - margin * 2);
      const pagePx = Math.floor(usableH * pxPerMm);

      // Break only between blocks so text lines are never cut in half
      const sheetTop = clone.sheet.getBoundingClientRect().top;
      const breaks = Array.from(clone.sheet.querySelectorAll('[data-pdf-block]'))
        .map(el => Math.round((el.getBoundingClientRect().bottom - sheetTop) * scale))
        .sort((a, b) => a - b);

      let y = 0, page = 0;
      while (y < canvas.height) {
        let end = Math.min(y + pagePx, canvas.height);
        if (end < canvas.height) {
          const fit = breaks.filter(b => b > y + pagePx * 0.4 && b <= end).pop();
          if (fit) end = fit;
        }
        const slice = document.createElement('canvas');
        slice.width = canvas.width;
        slice.height = end - y;
        slice.getContext('2d')!.drawImage(canvas, 0, y, canvas.width, end - y, 0, 0, canvas.width, end - y);
        if (page > 0) pdf.addPage();
        pdf.addImage(slice.toDataURL('image/jpeg', 0.95), 'JPEG', margin, margin, pageW - margin * 2, (end - y) / pxPerMm);
        y = end;
        page++;
      }
      const safe = this.fullName(this.cv).replace(/[^\w\-]+/g, '_');
      pdf.save(`CV_${safe}.pdf`);
    } catch (err) {
      console.error('PDF export failed:', err);
      this.alert.toastrError('Could not create the complete PDF. Check your connection and try again, or use Print and choose "Save as PDF".');
    } finally {
      document.body.removeChild(clone.wrap);
      this.busy = '';
    }
  }

  printData(): void {
    if (!this.cv || this.busy) return;
    const clone = this.makeSheetClone();
    if (!clone) return;
    this.busy = 'print';

    // Component styles only (they are what style the CV); avoids pulling in app-wide CSS
    const styles = Array.from(document.querySelectorAll('style'))
      .map(s => s.textContent || '')
      .filter(t => t.includes('.cv-sheet'))
      .join('\n');
    const html = clone.sheet.outerHTML;
    document.body.removeChild(clone.wrap);

    // Header: the chosen colour when "print in colour" is on, otherwise a clean white header
    const headPrintCss = this.printInColor
      ? `        .cv-head { padding: 16px 20px !important; margin-bottom: 14px; gap: 18px !important; }
        .cv-photo { width: 96px !important; height: 96px !important; }
        .cv-head h1 { font-size: calc(20pt * var(--cv-scale, 1)) !important; }
        .cv-title { font-size: calc(11.5pt * var(--cv-scale, 1)) !important; }`
      : `        .cv-head { background: #fff !important; color: #111 !important; padding: 0 0 12px !important;
                   border-bottom: 2px solid ${this.headerColor === '#ffffff' ? '#004182' : this.headerColor}; margin-bottom: 14px; gap: 18px !important; }
        .cv-photo { width: 96px !important; height: 96px !important; border: 1px solid #ccc !important; }
        .cv-head h1 { color: #111 !important; font-size: calc(20pt * var(--cv-scale, 1)) !important; }
        .cv-title { color: #333 !important; font-size: calc(11.5pt * var(--cv-scale, 1)) !important; }
        .cv-contact-inline { color: #333 !important; }`;

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    document.body.appendChild(iframe);
    const win = iframe.contentWindow;
    const doc = win?.document;
    if (!win || !doc) { document.body.removeChild(iframe); this.busy = ''; return; }

    const cleanup = () => { if (iframe.parentNode) document.body.removeChild(iframe); this.busy = ''; };
    doc.open();
    doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>CV – ${this.fullName(this.cv)}</title>
      <style>
        @page { size: A4; margin: 10mm; }
        html, body { margin: 0; background: #fff; font-family: Verdana, Geneva, Tahoma, sans-serif; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .cv-sheet { width: auto !important; box-shadow: none !important; border-radius: 0 !important; }
        [data-pdf-block] { break-inside: avoid; page-break-inside: avoid; }
      </style><style>${styles}</style>
      <style>
        /* ---- Clean print layout (wins over the on-screen styles above) ---- */
        @page { size: A4; margin: 14mm 12mm; }
        html, body { color: #111; font-size: 11pt; }
        .cv-sheet *:not(mat-icon) { font-family: var(--cv-font, Verdana, Geneva, Tahoma, sans-serif) !important; }
        /* the icon font is not loaded in the print frame: hide icons instead of printing their names */
        .cv-sheet mat-icon { display: none !important; }
        .cv-sheet { font-size: calc(10pt * var(--cv-scale, 1)) !important; line-height: 1.5; color: #111; }

${headPrintCss}

        .cv-body { grid-template-columns: 52mm minmax(0, 1fr) !important; gap: 0; }
        .cv-side { background: #fff !important; border-right: 1px solid #ccc !important; padding: 0 12px 0 0 !important; }
        .cv-main { padding: 0 0 0 16px !important; }

        .cv-block { margin-bottom: 14px !important; }
        .cv-block h2 { color: #004182 !important; border-bottom: 1px solid #999 !important; font-size: calc(9.5pt * var(--cv-scale, 1)) !important; margin-bottom: 8px !important; }
        .cv-dl dt { color: #555 !important; }
        .cv-chips { display: block !important; }
        .cv-chips li { display: block; background: #fff !important; border: 0 !important; color: #111 !important;
                       padding: 0 !important; border-radius: 0 !important; margin-bottom: 2px; }
        .cv-chips li::before { content: '• '; color: #004182; }

        .cv-item { border-left: 1px solid #bbb !important; padding-left: 10px !important; margin-bottom: 10px !important; }
        .cv-item::before { display: none !important; }
        .cv-item h3 { color: #111 !important; font-size: calc(10.5pt * var(--cv-scale, 1)) !important; }
        .cv-sub { color: #004182 !important; }
        .cv-date { color: #444 !important; }
        .cv-text { color: #222 !important; }

        [data-pdf-block], .cv-item { break-inside: avoid; page-break-inside: avoid; }
        .cv-block > h2 { break-after: avoid; page-break-after: avoid; }
      </style></head><body>${html}</body></html>`);
    doc.close();

    // Wait for images, then print
    const imgs = Array.from(doc.images);
    const ready = Promise.all(imgs.map(i => i.complete ? Promise.resolve() :
      new Promise<void>(r => { i.onload = i.onerror = () => r(); })));
    ready.then(() => {
      win.addEventListener('afterprint', cleanup);
      win.focus();
      win.print();
      setTimeout(cleanup, 60000); // safety net if afterprint never fires
    });
  }
}
