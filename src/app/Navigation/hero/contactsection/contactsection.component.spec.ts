import { NexsuzTestingModule } from 'src/testing/nexsuz-testing.module';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ContactsectionComponent } from './contactsection.component';

describe('ContactsectionComponent', () => {
  let component: ContactsectionComponent;
  let fixture: ComponentFixture<ContactsectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NexsuzTestingModule],
      schemas: [NO_ERRORS_SCHEMA],
      declarations: [ ContactsectionComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ContactsectionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

import { HttpTestingController } from '@angular/common/http/testing';

describe('ContactsectionComponent (dynamic business information)', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<ContactsectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [NexsuzTestingModule], schemas: [NO_ERRORS_SCHEMA], declarations: [ContactsectionComponent] }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ContactsectionComponent);
    fixture.detectChanges();
  });

  const text = () => (fixture.nativeElement as HTMLElement).textContent || '';

  it('shows the saved name, address, phone and social links from the API, and no made-up placeholder', () => {
    http.expectOne(r => r.url.endsWith('business-info/public')).flush({ success: true, data: {
      business_name: 'Nexsuz Inc.', tagline: '', logo_url: 'http://x/storage/uploads/business/logo/u/l.png', contact_heading: 'Talk to us', contact_description: 'We reply fast.',
      address: '1 Ayala Ave, Makati', maps_url: null, phone_primary: '+63 900', phone_alt: null, email: 'hi@nexsuz.test', website_url: null, operating_hours: 'Mon-Fri',
      social: { facebook: 'https://facebook.com/nexsuz' }, other_links: [] } });
    fixture.detectChanges();
    expect(text()).toContain('Talk to us');
    expect(text()).toContain('1 Ayala Ave, Makati');
    expect(text()).toContain('hi@nexsuz.test');
    expect(text()).not.toContain('123 Business Avenue');
    expect(fixture.nativeElement.querySelector('#contact-section img')).toBeNull();   // no logo in the Contact section
    expect(fixture.nativeElement.querySelectorAll('.contact-socials a').length).toBe(1);
  });

  it('hides the info card when nothing is shown and still submits the form to the API', () => {
    http.expectOne(r => r.url.endsWith('business-info/public')).flush({ success: true, data: {
      business_name: 'Nexsuz', tagline: '', logo_url: null, contact_heading: 'Get In Touch', contact_description: '', address: null, maps_url: null,
      phone_primary: null, phone_alt: null, email: null, website_url: null, operating_hours: null, social: {}, other_links: [] } });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.contact-info-card')).toBeNull();

    const c = fixture.componentInstance;
    c.contactModel = { fullName: 'Ann', email: 'ann@example.test', phone: '', subject: 'Hi', message: 'Hello' };
    c.onContactSubmit();
    const req = http.expectOne(r => r.method === 'POST' && r.url.endsWith('contact-message'));
    expect(req.request.body.fullName).toBe('Ann');
    req.flush({ success: true, message: 'ok' });
    expect(c.submitSuccess).toBeTrue();
    expect(c.contactModel.message).toBe('');
  });

  it('keeps the page usable and shows the server error when sending fails', () => {
    http.expectOne(r => r.url.endsWith('business-info/public')).flush({}, { status: 500, statusText: 'x' });
    const c = fixture.componentInstance;
    c.onContactSubmit();
    http.expectOne(r => r.url.endsWith('contact-message')).flush({ message: 'Your message could not be sent. Please try again later.' }, { status: 502, statusText: 'x' });
    expect(c.submitError).toContain('could not be sent');
    expect(c.submitSuccess).toBeFalse();
  });
});
