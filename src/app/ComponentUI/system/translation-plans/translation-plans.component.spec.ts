import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NexsuzTestingModule } from 'src/testing/nexsuz-testing.module';
import { _url } from 'src/global-variables';
import { TranslationPlansComponent } from './translation-plans.component';

describe('Translation plans', () => {
  let fixture: ComponentFixture<TranslationPlansComponent>;
  let component: TranslationPlansComponent;
  let http: HttpTestingController;

  const data = (config: any = {}, key = false) => ({
    config: {
      plan: 'free', currency: 'USD', pricing_url: 'https://cloud.google.com/translate/pricing', price_per_million: null, free_allowance: 0,
      monthly_budget: null, monthly_char_limit: null, expected_characters: 0, thresholds: [50, 80, 100], test: null, ...config
    },
    key: { saved: key, masked: key ? '••••••••WXYZ' : null },
    current: { period: '2026-11', characters: 0, requests: 0, allowance: 0, allowance_used: 0, paid_characters: 0, estimated_cost: 0, percent: 0, alert_level: 0, blocked: false, budget_percent: null },
    expected_cost: 0, history: []
  });

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [NexsuzTestingModule], declarations: [TranslationPlansComponent] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TranslationPlansComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  const load = (d: any) => {
    http.expectOne(`${_url}translation-billing`).flush({ success: true, data: d });
    http.expectOne(`${_url}i18n/config`).flush({ languages: [{ code: 'en-US', name: 'English' }, { code: 'ja', name: 'Japanese' }] });
    fixture.detectChanges();
  };

  it('starts on Free with paid locked until it is set up', () => {
    load(data());

    expect(component.paid).toBeFalse();
    expect(component.canEnable).toBeFalse();
    expect(component.languages.map(l => l.code)).toEqual(['ja']);
    expect(fixture.nativeElement.textContent).toContain('₱0 API cost');
    component.enablePaid();
    http.expectNone(`${_url}translation-billing/plan`);
  });

  it('enables paid only after the approval box is ticked', () => {
    load(data({ price_per_million: 20, monthly_budget: 10, test: { ok: true } }, true));
    expect(component.canEnable).toBeTrue();
    component.enablePaid();
    http.expectNone(`${_url}translation-billing/plan`);

    component.approve = true;
    component.enablePaid();

    expect(http.expectOne(`${_url}translation-billing/plan`).request.body).toEqual({ plan: 'paid', confirm: true });
  });

  it('sends blank amounts as empty and the thresholds as numbers, and never shows a key', () => {
    load(data({}, true));
    component.form.price_per_million = '';
    component.thresholds = '50, 90';
    component.saveSettings();

    const body = http.expectOne(`${_url}translation-billing/settings`).request.body;
    expect([body.price_per_million, body.thresholds]).toEqual([null, [50, 90]]);
    expect(fixture.nativeElement.textContent).toContain('••••••••WXYZ');
  });
});
