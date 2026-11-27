import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { NexsuzTestingModule } from 'src/testing/nexsuz-testing.module';
import { detectCountry, suggestedCountry } from '../ComponentSharedUI/country-picker/country-picker.component';
import { PublicTranslatorService } from './public-translator.service';

describe('Public website translation', () => {
  let service: PublicTranslatorService;
  let translate: TranslateService;
  let box: HTMLElement;
  const settle = () => new Promise(r => setTimeout(r));

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [NexsuzTestingModule] });
    service = TestBed.inject(PublicTranslatorService);
    translate = TestBed.inject(TranslateService);
    translate.setTranslation('en-US', { web_1: 'Sign In', web_2: 'Your email', web_3: '© {0} Nexsuz.', nav_x: 'Home' });
    translate.setTranslation('fil-PH', { web_1: 'Mag-sign In', web_2: 'Iyong email' });
    translate.setDefaultLang('en-US');
    translate.use('en-US');
    service.start();
    box = document.createElement('div');
    box.innerHTML = '<button> Sign In </button><input placeholder="Your email"><p>Home</p><p data-no-translate>Sign In</p><select><option>Sign In</option></select>';
    document.body.appendChild(box);
  });
  afterEach(() => { service.toggle('/DEF-CLIENT/subscription'); box.remove(); });

  const read = () => [box.querySelector('button')!.textContent, box.querySelector('input')!.placeholder,
    box.querySelector('p')!.textContent, box.querySelector('[data-no-translate]')!.textContent, box.querySelector('option')!.textContent];

  it('translates the web_ texts, follows language changes and later content, and leaves the rest alone', async () => {
    service.toggle('/signin');
    translate.use('fil-PH');
    expect(read()).toEqual([' Mag-sign In ', 'Iyong email', 'Home', 'Sign In', 'Sign In']);

    const late = document.createElement('span');
    late.textContent = 'Sign In';
    box.appendChild(late);
    await settle();
    expect(late.textContent).toBe('Mag-sign In');

    translate.use('en-US');
    expect(read()[0]).toBe(' Sign In ');
    expect(late.textContent).toBe('Sign In');
  });

  it('fills the value into phrases that have one', () => {
    translate.setTranslation('fil-PH', { web_3: '© {0} Nexsuz (fil).' }, true);
    service.toggle('/signin');
    translate.use('fil-PH');

    expect(service.lookup('© 2026 Nexsuz.')).toBe('© 2026 Nexsuz (fil).');
    expect(service.lookup('2026 Nexsuz')).toBe('2026 Nexsuz');
  });

  it('also translates the dashboards, filling phrases that have two values', () => {
    translate.setTranslation('en-US', { web_4: '{0} active · {1} inactive' }, true);
    translate.setTranslation('fil-PH', { web_4: '{1} hindi aktibo · {0} aktibo' }, true);
    service.toggle('/DEF-MASTERADMIN/admin-dashboard');
    translate.use('fil-PH');

    expect(service.active).toBeTrue();
    expect(service.lookup('5 active · 2 inactive')).toBe('2 hindi aktibo · 5 aktibo');
  });

  it('does nothing inside the signed-in app, and puts the English back on the way in', () => {
    service.toggle('/signin');
    translate.use('fil-PH');
    service.toggle('/DEF-CLIENT/subscription');

    expect(service.active).toBeFalse();
    expect(read()[0]).toBe(' Sign In ');
    expect(['/', '/signup', '/activation/a', '/DEF-USERS/home', '/cv/1/x'].map(u => service.isPublic(u))).toEqual([true, true, true, false, false]);
  });

  it('suggests a country from the browser region only', () => {
    expect(suggestedCountry(['en-PH', 'en-US'])).toBe('PH');
    expect(suggestedCountry(['zh-Hant-TW'])).toBe('TW');
    expect(suggestedCountry(['fr'])).toBe('');
  });
});

describe('Country from device settings', () => {
  const zones = (code: string) => ({ PH: ['Asia/Manila'], GB: ['Europe/London'], TH: ['Asia/Bangkok'], CX: ['Asia/Bangkok'] } as Record<string, string[]>)[code] || [];

  it('follows the time zone, even when the browser language says another country', () => {
    expect(detectCountry(['en-US'], 'Asia/Manila', zones)).toBe('PH');
  });

  it('uses the language region to choose between countries sharing a zone, or when the zone says nothing', () => {
    expect(detectCountry(['th-TH'], 'Asia/Bangkok', zones)).toBe('TH');
    expect(detectCountry(['en-US'], 'UTC', zones)).toBe('US');
    expect(detectCountry(['fr'], '', zones)).toBe('');
  });

  it('works with the browser own zone list', () => {
    expect(['PH', '']).toContain(detectCountry(['en'], 'Asia/Manila'));
  });
});
