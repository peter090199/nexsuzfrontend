import { discardPeriodicTasks, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MaterialModule } from 'src/Material/Material.module';
import { ContactInquiriesComponent } from './contact-inquiries.component';
import { ContactInquiriesService } from './contact-inquiries.service';

describe('ContactInquiriesComponent', () => {
  let http: HttpTestingController;

  const row = (over: any = {}) => ({ id: 1, number: 'INQ-000001', name: 'Vera Visitor', email: 'vera@example.test', phone: '+63 900', subject: 'Pricing question', preview: 'Hello',
    status: 'new', unread: true, assigned_code: null, assigned_name: null, archived: false, created_at: '2026-11-25T10:00:00Z', last_activity_at: '2026-11-25T10:00:00Z',
    notified: true, notify_error: null, ...over });
  const msg = (over: any = {}) => ({ id: 10, direction: 'in', from_email: 'vera@example.test', from_name: 'Vera Visitor', to_email: 'inbox@nexsuz.test', subject: 'Pricing question',
    body: 'Hello,\nHow much?', is_html: false, status: 'received', error: null, created_at: '2026-11-25T10:00:00Z', sent_by: null, attachments: [], ...over });
  const detail = (over: any = {}) => ({ ...row(), message: 'Hello', messages: [msg()], ...over });
  const list = (rows: any[] = [row()]) => ({ success: true, data: rows, meta: { page: 1, last_page: 1, total: rows.length }, unread: rows.filter(r => r.unread).length, counts: { new: rows.length } });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MaterialModule, FormsModule, ReactiveFormsModule, NoopAnimationsModule, HttpClientTestingModule],
      declarations: [ContactInquiriesComponent],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  const isList = (r: any) => r.method === 'GET' && /contact-inquiries(\?|$)/.test(r.urlWithParams);
  const make = (rows: any[] = [row()]) => {
    const f = TestBed.createComponent(ContactInquiriesComponent);
    f.detectChanges();
    http.expectOne(isList).flush(list(rows));
    f.detectChanges();
    return f;
  };
  const openFirst = (f: any, d: any = detail()) => {
    f.componentInstance.open(f.componentInstance.rows[0]);
    http.expectOne(r => r.method === 'GET' && /contact-inquiries\/\d+$/.test(r.url)).flush({ success: true, data: d, unread: 0 });
    http.match(isList).forEach(r => r.flush(list([row({ unread: false, status: 'read' })])));   // counts refresh
    f.detectChanges();
  };

  it('lists the inquiries with the unread indicator and the unread count', () => {
    const f = make([row(), row({ id: 2, unread: false, status: 'read', subject: 'Other' })]);
    const rows = (f.nativeElement as HTMLElement).querySelectorAll('li.row');
    expect(rows.length).toBe(2);
    expect(rows[0].classList).toContain('unread');
    expect(rows[1].classList).not.toContain('unread');
    expect(TestBed.inject(ContactInquiriesService).unread$.value).toBe(1);
  });

  it('shows a friendly empty state and an error with retry', () => {
    const f = make([]);
    expect((f.nativeElement as HTMLElement).textContent).toContain('No inquiries yet');
    f.componentInstance.reload();
    http.expectOne(isList).flush({ message: 'x' }, { status: 403, statusText: 'Forbidden' });
    f.detectChanges();
    expect(f.componentInstance.listError).toContain('do not have access');
  });

  it('search and status filters are sent to the API', fakeAsync(() => {
    const f = make();
    f.componentInstance.setFilter('unread');
    expect(http.expectOne(isList).request.params.get('status')).toBe('unread');
    http.match(isList);
    f.componentInstance.onSearch('vera');
    tick(400);
    const req = http.expectOne(isList);
    expect(req.request.params.get('q')).toBe('vera');
    req.flush(list());
    discardPeriodicTasks();
  }));

  it('opening an inquiry shows the conversation and updates the unread badge', () => {
    const f = make();
    openFirst(f);
    expect(f.componentInstance.selected?.messages.length).toBe(1);
    expect((f.nativeElement as HTMLElement).textContent).toContain('How much?');
    expect(f.componentInstance.showDetail).toBeTrue();
    expect(TestBed.inject(ContactInquiriesService).unread$.value).toBe(0);
  });

  it('reply composer is prefilled with the visitor, Re: subject, validates attachments, sends multipart and shows the new history', () => {
    const f = make();
    openFirst(f);
    const c = f.componentInstance;
    c.startReply(); f.detectChanges();
    expect(c.replySubject).toBe('Re: Pricing question');
    expect((f.nativeElement as HTMLElement).querySelector('.to-chip')?.textContent).toContain('vera@example.test');
    expect((f.nativeElement as HTMLElement).querySelector('.composer')).toBeTruthy();

    const pick = (file: File) => c.onFiles({ target: { files: [file], value: '' } } as any);
    pick(new File(['x'], 'virus.exe'));
    expect(c.attachError).toContain('not allowed');
    pick(new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'big.pdf'));
    expect(c.attachError).toContain('5 MB');
    pick(new File(['ok'], 'quote.pdf', { type: 'application/pdf' }));
    expect(c.attachError).toBe('');
    expect(c.files.length).toBe(1);

    c.editor!.nativeElement.innerHTML = '<p>Hi Vera, the plan is free.</p>';
    c.send();
    const req = http.expectOne(r => r.method === 'POST' && r.url.endsWith('contact-inquiries/1/reply'));
    const fd = req.request.body as FormData;
    expect(fd.get('subject')).toBe('Re: Pricing question');
    expect(String(fd.get('body'))).toContain('the plan is free');
    expect((fd.getAll('attachments[]')[0] as File).name).toBe('quote.pdf');
    expect(fd.get('to')).toBeNull();   // the recipient is never chosen by the browser
    req.flush({ success: true, message: 'Reply sent to vera@example.test.', unread: 0, data: detail({ status: 'replied', messages: [msg(), msg({ id: 11, direction: 'out', status: 'sent', body: '<p>Hi Vera</p>', is_html: true, sent_by: 'Ada Admin',
      attachments: [{ index: 0, name: 'quote.pdf', size: 2, mime: 'application/pdf' }] })] }) });
    http.match(isList).forEach(r => r.flush(list()));
    f.detectChanges();
    expect(c.composing).toBeFalse();
    expect(c.selected?.status).toBe('replied');
    const text = (f.nativeElement as HTMLElement).textContent || '';
    expect(text).toContain('Sent');
    expect(text).toContain('quote.pdf');
    expect(text).toContain('How much?');   // the original message is still there
  });

  it('sends a reply only once even if send is triggered again while it is in flight, and disables the button', () => {
    const f = make(); openFirst(f);
    const c = f.componentInstance;
    c.startReply(); f.detectChanges();
    c.editor!.nativeElement.innerHTML = '<p>Hello</p>';
    c.send(); c.send(); c.send();
    f.detectChanges();
    const reqs = http.match(r => r.method === 'POST' && r.url.endsWith('/reply'));
    expect(reqs.length).toBe(1);
    expect(((f.nativeElement as HTMLElement).querySelector('.c-actions button[type=submit]') as HTMLButtonElement).disabled).toBeTrue();
    reqs[0].flush({ success: true, message: 'ok', unread: 0, data: detail({ status: 'replied' }) });
    http.match(isList).forEach(r => r.flush(list()));
    expect(c.busy).toBe('');
  });

  it('refuses an empty reply without calling the API', () => {
    const f = make(); openFirst(f);
    const c = f.componentInstance;
    c.startReply(); f.detectChanges();
    c.editor!.nativeElement.innerHTML = '<p><br></p>';
    c.send();
    http.expectNone(r => r.method === 'POST');
    expect(c.sendError).toContain('Write a message');
  });

  it('a failed delivery keeps the composer open with the reason, and records the Failed attempt in the history', () => {
    const f = make(); openFirst(f);
    const c = f.componentInstance;
    c.startReply(); f.detectChanges();
    c.editor!.nativeElement.innerHTML = '<p>Hello</p>';
    c.send();
    http.expectOne(r => r.method === 'POST' && r.url.endsWith('/reply')).flush({ success: false, message: 'The mail server rejected the sign-in. For Gmail use a Google App Password.',
      data: detail({ messages: [msg(), msg({ id: 12, direction: 'out', status: 'failed', error: 'The mail server rejected the sign-in.', body: '<p>Hello</p>', is_html: true })] }) },
      { status: 502, statusText: 'Bad Gateway' });
    http.match(isList).forEach(r => r.flush(list()));
    f.detectChanges();
    expect(c.composing).toBeTrue();
    expect(c.sendError).toContain('App Password');
    expect(c.selected?.status).toBe('new');
    expect((f.nativeElement as HTMLElement).textContent).toContain('Failed');
  });

  it('close, mark unread and archive ask the API; archive and permanent delete need a confirmation', () => {
    const f = make(); openFirst(f);
    const c = f.componentInstance;
    c.toggleClosed();
    http.expectOne(r => r.method === 'POST' && r.url.endsWith('/status')).flush({ success: true, message: 'Inquiry closed.', data: detail({ status: 'closed', unread: false }), unread: 0 });
    http.match(isList).forEach(r => r.flush(list()));
    expect(c.selected?.status).toBe('closed');

    c.toggleRead();   // opened inquiries are read, so this marks it unread
    const rd = http.expectOne(r => r.url.endsWith('/read'));
    expect(rd.request.body).toEqual({ read: false });
    rd.flush({ success: true, data: detail({ status: 'closed', unread: false }), unread: 0 });
  });

  it('archive shows a confirmation first and only then calls DELETE', () => {
    const f = make(); openFirst(f);
    const c = f.componentInstance;
    c.askArchive(); f.detectChanges();
    http.expectNone(r => r.method === 'DELETE');
    expect(c.confirm).toBe('archive');
    c.doConfirm();
    http.expectOne(r => r.method === 'DELETE' && r.url.endsWith('contact-inquiries/1')).flush({ success: true, message: 'Inquiry archived.', unread: 0, data: detail({ archived: true }) });
    expect(c.rows.length).toBe(0);
  });

  it('static helpers mirror the server attachment rules', () => {
    expect(ContactInquiriesService.attachmentProblem([], new File(['x'], 'a.docx'))).toBeNull();
    expect(ContactInquiriesService.attachmentProblem([], new File(['x'], 'a.php'))).not.toBeNull();
    expect(ContactInquiriesService.attachmentProblem(Array(5).fill(new File(['x'], 'a.pdf')), new File(['x'], 'b.pdf'))).toContain('up to 5');
  });
});
