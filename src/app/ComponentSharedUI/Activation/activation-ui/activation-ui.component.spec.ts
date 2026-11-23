import { NexsuzTestingModule } from 'src/testing/nexsuz-testing.module';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick, discardPeriodicTasks } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ActivationService } from 'src/app/services/Activation/activation.service';
import { NotificationsService } from 'src/app/services/Global/notifications.service';

import { ActivationUIComponent } from './activation-ui.component';

describe('ActivationUIComponent', () => {
  let component: ActivationUIComponent;
  let fixture: ComponentFixture<ActivationUIComponent>;
  let router: Router;
  let svc: ActivationService;
  let notify: jasmine.SpyObj<NotificationsService>;

  async function setup(email = 'ann@example.test', code?: string) {
    notify = jasmine.createSpyObj('NotificationsService', ['toastrSuccess', 'toastrWarning', 'toastrError']);
    await TestBed.configureTestingModule({
      imports: [NexsuzTestingModule],
      schemas: [NO_ERRORS_SCHEMA],
      declarations: [ ActivationUIComponent ],
      providers: [
        { provide: NotificationsService, useValue: notify },
        { provide: ActivatedRoute, useValue: { snapshot: {
          paramMap: convertToParamMap({ email }),
          queryParamMap: convertToParamMap(code ? { code } : {}),
        } } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ActivationUIComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    svc = TestBed.inject(ActivationService);
    spyOn(router, 'navigate').and.returnValue(Promise.resolve(true));
    fixture.detectChanges();
  }

  it('should create', async () => {
    await setup();
    expect(component).toBeTruthy();
  });

  it('opens with the code already filled in when it comes from the email link (?code=)', async () => {
    await setup('ann@example.test', 'Ab3dEf9');
    expect(component.activationForm.value.code).toBe('Ab3dEf9');
    expect(component.activationForm.valid).toBeTrue();
  });

  it('refuses an empty or blank code', async () => {
    await setup();
    expect(component.activationForm.valid).toBeFalse();
    component.activationForm.patchValue({ code: '   ' });
    expect(component.activationForm.valid).toBeFalse();
    const spy = spyOn(svc, 'activate');
    component.onSubmit();
    expect(spy).not.toHaveBeenCalled();
  });

  it('activates with the email from the link and the trimmed code, then goes to the real sign-in page', async () => {
    await setup('ann@example.test', ' Ab3dEf9 ');
    const spy = spyOn(svc, 'activate').and.returnValue(of({ success: true, message: 'Account has been activated successfully.' }));
    component.onSubmit();
    expect(spy).toHaveBeenCalledWith({ email: 'ann@example.test', code: 'Ab3dEf9' });
    expect(router.navigate).toHaveBeenCalledWith(['/signin']);
    expect(router.navigate).not.toHaveBeenCalledWith(['/signInUI']);
    expect(notify.toastrSuccess).toHaveBeenCalled();
  });

  it('a wrong code shows the server message and stays on the page', async () => {
    await setup('ann@example.test', 'nope');
    spyOn(svc, 'activate').and.returnValue(of({ success: false, message: 'Invalid email or code.' }));
    component.onSubmit();
    expect(notify.toastrWarning).toHaveBeenCalledWith('Invalid email or code.');
    expect(router.navigate).not.toHaveBeenCalled();
    expect(component.isLoading).toBeFalse();
  });

  it('a server error shows a readable message, not the raw HTTP error text', async () => {
    await setup('ann@example.test', 'x');
    spyOn(svc, 'activate').and.returnValue(throwError(() => ({ message: 'Http failure response for http://x: 500', status: 500, error: { message: 'Something broke' } })));
    component.onSubmit();
    expect(notify.toastrError).toHaveBeenCalledWith('Something broke');
  });

  it('resend asks the API for a new email, then locks the button for a minute', fakeAsync(() => {
    setup().then(() => { });
    tick();
    const spy = spyOn(svc, 'resend').and.returnValue(of({ success: true, message: 'A new activation email is on its way.' }));
    component.resend();
    expect(spy).toHaveBeenCalledWith('ann@example.test');
    expect(notify.toastrSuccess).toHaveBeenCalledWith('A new activation email is on its way.');
    expect(component.cooldown).toBe(60);

    component.resend();                       // pressed again while locked
    expect(spy).toHaveBeenCalledTimes(1);

    tick(60000);
    expect(component.cooldown).toBe(0);
    component.resend();
    expect(spy).toHaveBeenCalledTimes(2);
    discardPeriodicTasks();
  }));

  it('resend failures are shown, and a rate-limit answer also starts the lock', fakeAsync(() => {
    setup().then(() => { });
    tick();
    spyOn(svc, 'resend').and.returnValue(throwError(() => ({ status: 429, error: {} })));
    component.resend();
    expect(notify.toastrError).toHaveBeenCalledWith('Too many requests. Please wait a few minutes and try again.');
    expect(component.cooldown).toBe(60);
    discardPeriodicTasks();
  }));

  describe('page layout', () => {
    const text = () => (fixture.nativeElement as HTMLElement).textContent || '';
    const q = (sel: string) => (fixture.nativeElement as HTMLElement).querySelector(sel);

    it('shows the email being activated and a code field that the phone keyboard and password managers understand', async () => {
      await setup('ann@example.test', 'Ab3dEf9');
      expect(q('.email-chip')!.textContent).toContain('ann@example.test');
      const input = q('#activation-code') as HTMLInputElement;
      expect(input.value).toBe('Ab3dEf9');
      expect(input.getAttribute('autocomplete')).toBe('one-time-code');
      expect(input.getAttribute('autocapitalize')).toBe('off');     // the code is case sensitive: never auto-capitalise it
      expect(input.getAttribute('spellcheck')).toBe('false');
      expect((q('label.field-label') as HTMLElement).getAttribute('for')).toBe('activation-code');
    });

    it('has one h1 and a labelled landmark for screen readers', async () => {
      await setup();
      expect(fixture.nativeElement.querySelectorAll('h1').length).toBe(1);
      expect(q('section.activate-card')!.getAttribute('aria-labelledby')).toBe('activate-title');
    });

    it('disables Activate until a code is entered, and asks for one after the field is touched', async () => {
      await setup();
      const btn = () => q('.primary-btn') as HTMLButtonElement;
      expect(btn().disabled).toBeTrue();
      component.activationForm.get('code')!.markAsTouched();
      fixture.detectChanges();
      expect(text()).toContain('Activation code is required.');
      component.activationForm.patchValue({ code: 'abc' });
      fixture.detectChanges();
      expect(btn().disabled).toBeFalse();
      expect(text()).not.toContain('Activation code is required.');
    });

    it('shows the resend button and counts down after it is used', fakeAsync(() => {
      setup().then(() => { });
      tick();
      spyOn(svc, 'resend').and.returnValue(of({ success: true, message: 'sent' }));
      expect(text()).toContain('Resend activation email');
      component.resend();
      fixture.detectChanges();
      expect(text()).toContain('Resend available in 60s');
      expect((q('.ghost-btn') as HTMLButtonElement).disabled).toBeTrue();
      discardPeriodicTasks();
    }));

    it('explains a link with no email instead of showing a form that cannot work', async () => {
      await setup('');
      expect(q('form')).toBeNull();
      expect(q('.notice')!.textContent).toContain('missing your email address');
      expect(q('a[href="/signin"]')).toBeTruthy();
    });
  });

  it('does nothing when the link has no email', async () => {
    await setup('');
    const spy = spyOn(svc, 'resend');
    component.resend();
    expect(spy).not.toHaveBeenCalled();
  });
});
