import { NexsuzTestingModule } from 'src/testing/nexsuz-testing.module';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ProfileService } from 'src/app/services/Profile/profile.service';

import { CompanyProfileUIComponent } from './company-profile-ui.component';

describe('CompanyProfileUIComponent', () => {
  let component: CompanyProfileUIComponent;
  let fixture: ComponentFixture<CompanyProfileUIComponent>;

  const company = {
    code: '711', fullname: 'Ana Cruz', fname: 'Ana', lname: 'Cruz', company: 'Acme Corp', profession: 'HR Manager',
    industry: 'Software', companysize: '51-200', companywebsite: 'acme.test', about: 'We build things.',
    current_location: 'Manila', email: 'hr@acme.test', contact_no: '0917', followers: 3, following: 1, role_code: 'DEF-CLIENT',
  };

  async function create(role: string, res: any = { success: true, message: company }) {
    sessionStorage.setItem('role', role);
    sessionStorage.setItem('token', 'tok');
    sessionStorage.setItem('code', '800');          // a real session stores the account code at sign-in (it is not 711, the page being viewed)
    await TestBed.configureTestingModule({ imports: [NexsuzTestingModule], schemas: [NO_ERRORS_SCHEMA], declarations: [CompanyProfileUIComponent] }).compileComponents();
    const svc = TestBed.inject(ProfileService);
    spyOn(svc, 'getCompanyProfile').and.returnValue(of(res));
    fixture = TestBed.createComponent(CompanyProfileUIComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }
  afterEach(() => { sessionStorage.removeItem('role'); sessionStorage.removeItem('token'); sessionStorage.removeItem('code'); });
  const el = () => fixture.nativeElement as HTMLElement;

  it('should create', async () => {
    await create('DEF-USERS');
    expect(component).toBeTruthy();
  });

  it('shows the company name, details and about text', async () => {
    await create('DEF-USERS');
    expect(el().querySelector('.cp-name')!.textContent).toContain('Acme Corp');
    expect(el().textContent).toContain('HR Manager');
    expect(el().textContent).toContain('51-200 employees');
    expect(el().textContent).toContain('Manila');
  });

  it('turns the saved website into a safe https link', async () => {
    await create('DEF-USERS');
    expect(component.websiteUrl).toBe('https://acme.test');
    component.profiles = { ...company, companywebsite: 'javascript:alert(1)' };
    expect(component.websiteUrl).toBe('');
    component.profiles = { ...company, companywebsite: '' };
    expect(component.websiteUrl).toBe('');
  });

  it('a job seeker can connect and sees no private contact details', async () => {
    await create('DEF-USERS');
    expect(component.isAdminViewer).toBeFalse();
    expect(el().querySelector('.cp-connect')).toBeTruthy();
    expect(el().textContent).not.toContain('hr@acme.test');
  });

  it('a recruiter can view another company the same way', async () => {
    await create('DEF-CLIENT');
    expect(el().querySelector('.cp-name')!.textContent).toContain('Acme Corp');
    expect(el().querySelector('.cp-connect')).toBeTruthy();
  });

  it('the master admin sees contact details and no Connect button', async () => {
    await create('DEF-MASTERADMIN');
    expect(component.isAdminViewer).toBeTrue();
    expect(el().querySelector('.cp-connect')).toBeNull();
    expect(el().textContent).toContain('hr@acme.test');
    expect(el().textContent).toContain('0917');
    expect(el().querySelector('.cp-chip.role')!.textContent).toContain('#');
  });

  it('says so when the company cannot be found', async () => {
    await create('DEF-MASTERADMIN', { success: false, message: 'User not found' });
    expect(el().querySelector('.cp-empty')).toBeTruthy();
    expect(el().textContent).toContain('isn\'t available');
  });
});
