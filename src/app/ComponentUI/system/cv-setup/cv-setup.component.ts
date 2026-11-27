import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { NotificationsService } from 'src/app/services/Global/notifications.service';
import { CvPdfService, CvPdfSettings } from 'src/app/services/CV/cv-pdf.service';
import { environment } from 'src/environments/environment';
import { _url } from 'src/global-variables';

/** Settings > CV Setup (DEF-MASTERADMIN). The API enforces the role; this only shows and saves. */
@Component({
  selector: 'app-cv-setup',
  templateUrl: './cv-setup.component.html',
  styleUrls: ['./cv-setup.component.css']
})
export class CvSetupComponent implements OnInit {
  form: CvPdfSettings | null = null;
  server: any = null;
  loadFailed = false;
  serverFailed = false;
  saving = false;
  error = '';

  /** what this copy of the website was built for, and the addresses it uses */
  readonly app = {
    environment: environment.production ? 'production' : 'local',
    url: window.location.origin,
    api: _url
  };

  constructor(private pdf: CvPdfService, private http: HttpClient, private alert: NotificationsService) { }

  get isMaster(): boolean { return sessionStorage.getItem('role') === 'DEF-MASTERADMIN'; }

  ngOnInit(): void {
    if (this.isMaster) { this.load(); }
  }

  load(): void {
    this.loadFailed = this.serverFailed = false;
    this.http.get<any>(`${_url}cv/pdf-settings`).subscribe({
      next: res => this.form = { ...res.data },
      error: () => this.loadFailed = true
    });
    this.http.get<any>(`${_url}cv/pdf-environment`, { headers: this.headers() }).subscribe({
      next: res => this.server = res.data,
      error: () => this.serverFailed = true
    });
  }

  /** a production build talking to a local server (or the other way round) is a deployment mistake */
  get mismatch(): boolean { return !!this.server && this.server.environment !== this.app.environment; }

  get exampleName(): string { return this.form ? this.pdf.fileName('Juan Dela Cruz', this.form) : ''; }

  methodChanged(): void {
    if (this.form?.method === 'download') { this.form.allow_download = true; }
  }

  save(): void {
    if (!this.form || this.saving) { return; }
    this.saving = true;
    this.error = '';
    this.http.put<any>(`${_url}cv/pdf-settings`, this.form, { headers: this.headers() }).subscribe({
      next: res => {
        this.saving = false;
        this.form = { ...res.data };
        this.pdf.settings$.next(res.data);
        this.alert.toastrSuccess(res.message || 'CV setup saved.');
      },
      error: err => {
        this.saving = false;
        const errors = err?.error?.errors;
        this.error = (errors && (Object.values(errors)[0] as string[])[0]) || err?.error?.message || 'Could not save the CV setup.';
      }
    });
  }

  private headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${sessionStorage.getItem('token') || ''}` });
  }
}
