import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { NexsuzTestingModule } from 'src/testing/nexsuz-testing.module';
import { CvSetupComponent } from 'src/app/ComponentUI/system/cv-setup/cv-setup.component';
import { environment } from 'src/environments/environment';
import { environment as production } from 'src/environments/environment.prod';
import { _url } from 'src/global-variables';
import { CV_PDF_DEFAULTS, CvPdfService } from './cv-pdf.service';

describe('CV Setup', () => {
  let pdf: CvPdfService;
  let http: HttpTestingController;
  const blob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
  const use = (over: any) => pdf.settings$.next({ ...CV_PDF_DEFAULTS, ...over });

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [NexsuzTestingModule], declarations: [CvSetupComponent] });
    pdf = TestBed.inject(CvPdfService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => sessionStorage.removeItem('role'));

  it('loads the saved settings, and keeps the defaults when the server cannot be asked', () => {
    pdf.load().subscribe();
    http.expectOne(`${_url}cv/pdf-settings`).flush({ data: { page_size: 'letter' } });
    expect([pdf.settings.page_size, pdf.settings.allow_print]).toEqual(['letter', true]);

    pdf.load().subscribe();
    http.expectOne(`${_url}cv/pdf-settings`).error(new ProgressEvent('offline'));
    expect(pdf.settings.page_size).toBe('letter');
  });

  it('keeps the old file name by default and applies the page size and orientation', () => {
    expect(pdf.fileName('Juan Dela Cruz')).toBe('CV_Juan_Dela_Cruz.pdf');
    use({ filename: 'Resume ({name})', page_size: 'letter', orientation: 'landscape' });
    expect(pdf.fileName('Ana')).toBe('Resume (Ana).pdf');
    expect(pdf.pageMm()).toEqual([279.4, 215.9]);
  });

  it('previews in the page, opens a tab, or downloads, as chosen; disabled actions do nothing', () => {
    const open = spyOn(TestBed.inject(MatDialog), 'open');
    const click = spyOn(HTMLAnchorElement.prototype, 'click');
    const tab = { location: { href: '' }, close: jasmine.createSpy('close'), opener: window } as any;

    pdf.present(blob, 'a.pdf');
    expect(open).toHaveBeenCalledTimes(1);

    use({ display: 'tab' });
    pdf.present(blob, 'a.pdf', tab);
    expect(tab.location.href).toMatch(/^blob:/);

    use({ method: 'download' });
    pdf.present(blob, 'a.pdf');
    expect(click).toHaveBeenCalledTimes(1);

    use({ allow_download: false, allow_print: false });
    pdf.download(blob, 'a.pdf');
    pdf.print(blob);
    expect(click).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll('iframe[src^="blob:"]').length).toBe(0);
  });

  it('shows the setup only to a master admin, and flags a build that does not match the server', () => {
    sessionStorage.setItem('role', 'DEF-ADMIN');
    const other = TestBed.createComponent(CvSetupComponent);
    other.detectChanges();
    http.expectNone(`${_url}cv/pdf-settings`);
    expect(other.nativeElement.textContent.trim()).toBe('');

    sessionStorage.setItem('role', 'DEF-MASTERADMIN');
    const fixture = TestBed.createComponent(CvSetupComponent);
    fixture.detectChanges();
    http.expectOne(`${_url}cv/pdf-settings`).flush({ data: CV_PDF_DEFAULTS });
    http.expectOne(`${_url}cv/pdf-environment`).flush({ data: { environment: 'production', warnings: [], storage_linked: true, storage_writable: true } });
    fixture.detectChanges();
    expect(fixture.componentInstance.mismatch).toBeTrue();        // the test build is a local one

    fixture.componentInstance.form!.method = 'download';
    fixture.componentInstance.form!.allow_download = false;
    fixture.componentInstance.methodChanged();
    fixture.componentInstance.save();
    const request = http.expectOne(`${_url}cv/pdf-settings`);
    expect([request.request.method, request.request.body.allow_download]).toEqual(['PUT', true]);
  });

  it('uses each build own API address: the production one is HTTPS and not the local one', () => {
    expect(production.apiUrl).toMatch(/^https:\/\/.+\/api\/$/);
    expect(production.apiUrl).not.toBe(environment.apiUrl);
    expect(_url).toBe(environment.apiUrl);
  });
});
