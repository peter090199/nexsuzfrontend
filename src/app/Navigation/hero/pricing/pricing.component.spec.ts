import { of } from 'rxjs';
import { PricingComponent } from './pricing.component';

describe('PricingComponent', () => {
  const plans = [
    { planId: 'P1', plan_name: 'Starter', price: '0.00', tagmonthYear: 'Monthly', tag: 'STARTER', sort_number: 1 },
    { planId: 'P2', plan_name: 'Pro', price: '599.00', tagmonthYear: 'Monthly', tag: 'MOST POPULAR', sort_number: 2, is_popular: true },
    { planId: 'P3', plan_name: 'Business', price: '999.00', tagmonthYear: 'Monthly', tag: 'BUSINESS', sort_number: 3 },
  ];
  const feats: any = {
    P1: [{ feature_name: 'Create Profile', feature_code: 'CREATE_PROFILE', feature_value: 'YES', recordStatus: 'active' },
         { feature_name: 'Create Resume', feature_code: 'CREATE_RESUME', feature_value: 'NO', recordStatus: 'active' },
         { feature_name: 'Connections', feature_code: 'CONNECTION_LIMIT', feature_value: '15', recordStatus: 'active' }],
    P2: [{ feature_name: 'Everything in Starter', feature_code: 'EVERYTHING_FREE', feature_value: 'YES', recordStatus: 'active' },
         { feature_name: 'Create Resume', feature_code: 'CREATE_RESUME', feature_value: 'YES', recordStatus: 'active' },
         { feature_name: 'Connections', feature_code: 'CONNECTION_LIMIT', feature_value: '100', recordStatus: 'active' }],
    P3: [{ feature_name: 'Connections', feature_code: 'CONNECTION_LIMIT', feature_value: 'UNLIMITED', recordStatus: 'active' },
         { feature_name: 'Dedicated Account Manager', feature_code: null, feature_value: null, recordStatus: 'active' }],
  };

  let navigated: any[];
  let c: PricingComponent;

  const make = (loggedIn = false): PricingComponent => {
    navigated = [];
    const router: any = { navigate: (...a: any[]) => navigated.push(a), navigateByUrl: (...a: any[]) => navigated.push(a) };
    const shared: any = { goToSubscription: () => navigated.push(['subscription']) };
    const api: any = { getPlan: () => of({ success: true, data: plans }), getAll: () => of({ success: true, data: plans }),
      getFeatures2: (id: string) => of({ success: true, data: feats[id] }) };
    sessionStorage.removeItem('token');
    if (loggedIn) { sessionStorage.setItem('token', 'x'); }
    const comp = new PricingComponent(router, shared, api);
    comp.ngOnInit();
    return comp;
  };
  afterEach(() => sessionStorage.removeItem('token'));

  it('labels CTAs per plan and highlights the recommended one', () => {
    c = make();
    expect(c.ctaLabel(c.plans[0])).toBe('Get Started Free');
    expect(c.ctaLabel(c.plans[1])).toBe('Upgrade to Pro');
    expect(c.ctaLabel(c.plans[2])).toBe('Choose Business');
    expect(c.isFeatured(c.plans[1])).toBeTrue();
    expect(c.isFree(c.plans[0])).toBeTrue();
  });

  it('sends visitors to signup with the right return URL', () => {
    c = make();
    c.goToCheckout(c.plans[1]);
    expect(navigated[0][0]).toEqual(['/signup']);
    expect(navigated[0][1].queryParams.returnUrl).toBe('/DEF-USERS/checkout/P2');
    c.goToCheckout(c.plans[0]);
    expect(navigated[1][1].queryParams.returnUrl).toBe('/DEF-USERS/subscription');
  });

  it('shows the current plan as disabled and does not navigate for it', () => {
    c = make(true);
    c.plans[1].is_current = true;
    c.plans[0].disabled = true; c.plans[0].button_name = 'Downgrade';
    expect(c.ctaLabel(c.plans[1])).toBe('Current Plan');
    expect(c.ctaDisabled(c.plans[1])).toBeTrue();
    expect(c.ctaLabel(c.plans[0])).toBe('Downgrade');
    c.goToCheckout(c.plans[1]);
    expect(navigated.length).toBe(0);
    c.goToCheckout(c.plans[2]);
    expect(navigated[0][0]).toBe('/DEF-USERS/checkout/P3');
  });

  it('hides the billing toggle until annual pricing is configured, then switches prices and savings', () => {
    c = make();
    c.yearlyPricing = {};
    expect(c.yearlyAvailable).toBeFalse();
    c.yearlyPricing = { P2: { price: 5990 } };
    expect(c.yearlyAvailable).toBeTrue();
    expect(c.displayPrice(c.plans[1])).toBe(599);
    expect(c.savings(c.plans[1])).toBe(0);
    c.setBilling('yearly');
    expect(c.displayPrice(c.plans[1])).toBe(5990);
    expect(c.period(c.plans[1])).toBe('year');
    expect(c.savings(c.plans[1])).toBe(599 * 12 - 5990);
    expect(c.displayPrice(c.plans[2])).toBe(999);   // no annual price configured: stays monthly
    expect(c.period(c.plans[2])).toBe('month');
  });

  it('builds a cumulative comparison with limits and differences', () => {
    c = make();
    const row = (k: string) => c.rows.find(r => r.key === k)!;
    expect(c.rows.some(r => r.key.startsWith('EVERYTHING'))).toBeFalse();
    expect(row('CREATE_RESUME').cells['P1'].included).toBeFalse();
    expect(row('CREATE_RESUME').cells['P2'].included).toBeTrue();
    expect(row('CREATE_RESUME').cells['P3'].included).toBeTrue();   // inherited from Pro
    expect(row('CREATE_RESUME').differs).toBeTrue();
    expect(row('CONNECTION_LIMIT').cells['P1'].detail).toBe('15');
    expect(row('CONNECTION_LIMIT').cells['P2'].detail).toBe('100');
    expect(row('CONNECTION_LIMIT').cells['P3'].detail).toBe('Unlimited');
    expect(row('DEDICATED ACCOUNT MANAGER').cells['P2'].included).toBeFalse();
    expect(row('DEDICATED ACCOUNT MANAGER').cells['P3'].included).toBeTrue();
    expect(row('CREATE_PROFILE').differs).toBeFalse();
    expect(c.unavailable['P1']).toContain('Create Resume');
  });
});

describe('PricingComponent audience tabs', () => {
  const jobSeeker = { planId: 'U1', plan_name: 'Free', price: '0', tag: 'STARTER', sort_number: 1, audience: 'DEF-USERS' };
  const recruiter = { planId: 'R1', plan_name: 'Hire', price: '1500', tag: 'HIRE', sort_number: 1, audience: 'DEF-CLIENT' };
  let asked: string[]; let navigated: any[];

  const make = (role: string | null) => {
    asked = []; navigated = [];
    sessionStorage.removeItem('token'); sessionStorage.removeItem('role');
    if (role) { sessionStorage.setItem('token', 'x'); sessionStorage.setItem('role', role); }
    const router: any = { navigate: (...a: any[]) => navigated.push(a), navigateByUrl: (u: string) => navigated.push(u) };
    const shared: any = { goToSubscription: () => navigated.push('subscription') };
    const pick = (a?: string) => { asked.push(a || ''); return of({ success: true, data: a === 'DEF-CLIENT' ? [recruiter] : [jobSeeker] }); };
    const api: any = { getPlan: pick, getAll: (_: boolean, a?: string) => pick(a), getFeatures2: () => of({ success: true, data: [] }) };
    const c = new PricingComponent(router, shared, api);
    c.ngOnInit();
    return c;
  };
  afterEach(() => { sessionStorage.removeItem('token'); sessionStorage.removeItem('role'); });

  it('defaults to job seekers, and to recruiters for a signed-in recruiter', () => {
    expect(make(null).audience).toBe('DEF-USERS');
    expect(asked).toEqual(['DEF-USERS']);
    expect(make('DEF-CLIENT').audience).toBe('DEF-CLIENT');
    expect(asked).toEqual(['DEF-CLIENT']);
  });

  it('switching tab reloads that audience\'s plans', () => {
    const c = make(null);
    c.setAudience('DEF-CLIENT');
    expect(asked).toEqual(['DEF-USERS', 'DEF-CLIENT']);
    expect(c.plans[0].planId).toBe('R1');
  });

  it('sends visitors to signup with the recruiter checkout as return URL', () => {
    const c = make(null);
    c.setAudience('DEF-CLIENT');
    c.goToCheckout(c.plans[0]);
    expect(navigated[0][1].queryParams.returnUrl).toBe('/DEF-CLIENT/checkout/R1');
  });

  it('admins and master admins cannot take any plan', () => {
    for (const role of ['DEF-ADMIN', 'DEF-MASTERADMIN']) {
      const c = make(role);
      expect(c.ctaDisabled(c.plans[0])).toBeTrue();
      expect(c.showCta).toBeFalse();                                   // no button (and no label) for admin accounts
      expect(c.ctaLabel(c.plans[0])).not.toBe('Not for admin accounts');
      c.goToCheckout(c.plans[0]);
      c.setAudience('DEF-CLIENT');
      expect(c.ctaDisabled(c.plans[0])).toBeTrue();
      c.goToCheckout(c.plans[0]);
      expect(navigated.length).toBe(0);
    }
  });

  it('blocks buying a plan for the other audience when signed in', () => {
    const seeker = make('DEF-USERS');
    seeker.setAudience('DEF-CLIENT');
    expect(seeker.ctaLabel(seeker.plans[0])).toBe('Recruiter accounts only');
    expect(seeker.ctaDisabled(seeker.plans[0])).toBeTrue();
    seeker.goToCheckout(seeker.plans[0]);
    expect(navigated.length).toBe(0);

    const rec = make('DEF-CLIENT');
    expect(rec.ctaDisabled(rec.plans[0])).toBeFalse();
    rec.goToCheckout(rec.plans[0]);
    expect(navigated[0]).toBe('/DEF-CLIENT/checkout/R1');
    rec.setAudience('DEF-USERS');
    expect(rec.ctaLabel(rec.plans[0])).toBe('Job seeker accounts only');
  });
});
