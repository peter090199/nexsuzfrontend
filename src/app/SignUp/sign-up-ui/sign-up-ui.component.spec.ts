import { NexsuzTestingModule } from 'src/testing/nexsuz-testing.module';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatTabGroup } from '@angular/material/tabs';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { SignUpService } from 'src/app/services/SignUp/sign-up.service';

import { SignUpUIComponent } from './sign-up-ui.component';

describe('SignUpUIComponent', () => {
  let component: SignUpUIComponent;
  let fixture: ComponentFixture<SignUpUIComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NexsuzTestingModule],
      schemas: [NO_ERRORS_SCHEMA],
      declarations: [ SignUpUIComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SignUpUIComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('labels the individual sign-up as a DEF-USERS account and the company sign-up as DEF-CLIENT', () => {
    expect(component.accountTypes.individual.role).toBe('DEF-USERS');
    expect(component.accountTypes.individual.title).toBe('Individual account');
    expect(component.accountTypes.company.role).toBe('DEF-CLIENT');
    expect(component.accountTypes.company.title).toBe('Company account');
  });

  /** Tab content is rendered lazily, so open each tab and look at what is on screen. */
  async function banner(tabIndex: number, id: string): Promise<HTMLElement | null> {
    const tabs = fixture.debugElement.query(By.directive(MatTabGroup)).componentInstance as MatTabGroup;
    tabs.selectedIndex = tabIndex;
    fixture.detectChanges();
    await fixture.whenStable();                 // the tab body is attached once the tab change has settled
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(`[data-testid="${id}"]`);
  }

  it('shows the account-type label at the top of the Individual tab', async () => {
    const el = (await banner(0, 'role-individual'))!;
    expect(el).toBeTruthy();
    expect(el.textContent).toContain('Individual account');
    expect(el.textContent).toContain('DEF-USERS');
    expect(el.textContent).not.toContain('DEF-CLIENT');
  });

  it('shows the account-type label at the top of the Company tab', async () => {
    const el = (await banner(1, 'role-company'))!;
    expect(el).toBeTruthy();
    expect(el.textContent).toContain('Company account');
    expect(el.textContent).toContain('DEF-CLIENT');
  });

  it('each tab really submits the status code behind its label (0 = DEF-USERS, 1 = DEF-CLIENT)', () => {
    expect(component.userForm.getRawValue().statuscode).toBe(0);
    expect(component.companyForm.getRawValue().statuscode).toBe(1);
  });
});

describe('SignUpUIComponent layout', () => {
  let fixture: ComponentFixture<SignUpUIComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [NexsuzTestingModule], schemas: [NO_ERRORS_SCHEMA], declarations: [SignUpUIComponent] }).compileComponents();
    fixture = TestBed.createComponent(SignUpUIComponent);
    fixture.detectChanges();
  });

  it('does not use a mat-card any more', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('mat-card')).toBeNull();
    expect(el.querySelector('mat-card-content')).toBeNull();
    expect(el.querySelector('.register-card')).toBeTruthy();
  });

  it('stacks form fields on phones: every column is full width below the md breakpoint', () => {
    const cols = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.register-card [class*="col-"]'));
    expect(cols.length).toBeGreaterThan(0);
    cols.forEach(c => {
      expect(c.classList.contains('col-12')).toBeTrue();
      expect(c.classList.contains('col-6')).toBeFalse();
    });
  });
});

describe('SignUpUIComponent phone number row', () => {
  it('keeps the country code and the phone number together in one group on the Individual tab', async () => {
    await TestBed.configureTestingModule({ imports: [NexsuzTestingModule], schemas: [NO_ERRORS_SCHEMA], declarations: [SignUpUIComponent] }).compileComponents();
    const fixture = TestBed.createComponent(SignUpUIComponent);
    fixture.detectChanges();
    const group = (fixture.nativeElement as HTMLElement).querySelector('.contact-group')!;
    expect(group).toBeTruthy();
    expect(group.querySelector('.country-field')).toBeTruthy();
    expect(group.querySelector('.phone-field')).toBeTruthy();
    expect(group.classList.contains('col-12')).toBeTrue();
  });
});

describe('SignUpUIComponent after a successful sign-up', () => {
  let component: SignUpUIComponent;
  let router: Router;
  let signup: jasmine.Spy;

  const individual = {
    profession: 'Engineer', email: 'a@b.test', countryCode: '+63', contactno: '9171234567', fname: 'A', lname: 'B',
    password: 'Aa1!aaaa', password_confirmation: 'Aa1!aaaa', agreementTerms: true, agreementPrivacy: true,
  };
  const company = {
    company: 'ACME', email: 'c@d.test', countryCode: '+63', contactno: '9171234567', fname: 'C', lname: 'D',
    password: 'Aa1!aaaa', password_confirmation: 'Aa1!aaaa', agreementTerms: true, agreementPrivacy: true,
    industry: 'IT', companywebsite: 'acme.com', designation: 'HR',
  };

  async function setup(returnUrl?: string) {
    await TestBed.configureTestingModule({
      imports: [NexsuzTestingModule], schemas: [NO_ERRORS_SCHEMA], declarations: [SignUpUIComponent],
      providers: returnUrl ? [{ provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({ returnUrl }) } } }] : [],
    }).compileComponents();
    const fixture = TestBed.createComponent(SignUpUIComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.returnValue(Promise.resolve(true));
    spyOn(router, 'navigateByUrl').and.returnValue(Promise.resolve(true));
    signup = spyOn(TestBed.inject(SignUpService), 'signup').and.returnValue(of({ success: true, message: 'Registered' }));
  }

  it('an individual goes to the landing page Home section (/#home-section), not the removed /homepage route', async () => {
    await setup();
    component.selectedOption = 'I am over 18 years old';
    component.userForm.patchValue(individual);
    component.onSubmitIndividual();
    expect(signup).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/'], { fragment: 'home-section' });
    expect(router.navigateByUrl).not.toHaveBeenCalledWith('/homepage');
  });

  it('a company goes to the same place', async () => {
    await setup();
    component.companyForm.patchValue(company);
    component.onSubmitCompany();
    expect(signup).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/'], { fragment: 'home-section' });
    expect(router.navigateByUrl).not.toHaveBeenCalledWith('/homepage');
  });

  it('an individual who came from the pricing page still continues to sign-in with that return URL', async () => {
    await setup('/DEF-USERS/checkout/PLN000002');
    component.selectedOption = 'I am over 18 years old';
    component.userForm.patchValue(individual);
    component.onSubmitIndividual();
    expect(router.navigate).toHaveBeenCalledWith(['/signin'], { queryParams: { returnUrl: '/DEF-USERS/checkout/PLN000002' } });
    expect(router.navigate).not.toHaveBeenCalledWith(['/'], { fragment: 'home-section' });
  });

  it('a failed sign-up stays on the page', async () => {
    await setup();
    signup.and.returnValue(of({ success: false, message: 'Email already used' }));
    component.selectedOption = 'I am over 18 years old';
    component.userForm.patchValue(individual);
    component.onSubmitIndividual();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });
});
