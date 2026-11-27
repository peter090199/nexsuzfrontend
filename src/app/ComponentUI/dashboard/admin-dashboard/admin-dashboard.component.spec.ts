import { NexsuzTestingModule } from 'src/testing/nexsuz-testing.module';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminDashboardComponent } from './admin-dashboard.component';

describe('AdminDashboardComponent', () => {
  let component: AdminDashboardComponent;
  let fixture: ComponentFixture<AdminDashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NexsuzTestingModule],
      schemas: [NO_ERRORS_SCHEMA],
      declarations: [ AdminDashboardComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AdminDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('shortcut buttons by role', () => {
    const HIDDEN = ['subscriptionplans', 'featuremanagement', 'planfeatureassignment', 'featuresplan'];
    afterEach(() => sessionStorage.removeItem('role'));

    async function shortcuts(role: string): Promise<string[]> {
      TestBed.resetTestingModule();
      sessionStorage.setItem('role', role);
      await TestBed.configureTestingModule({ imports: [NexsuzTestingModule], schemas: [NO_ERRORS_SCHEMA], declarations: [AdminDashboardComponent] }).compileComponents();
      const f = TestBed.createComponent(AdminDashboardComponent);
      f.detectChanges();
      return f.componentInstance.quickActions.map(a => a.route);
    }

    for (const role of ['DEF-ADMIN', 'DEF-CLIENT']) {
      it(`${role} does not get Subscription plans, Feature management, Plan feature assignment or Plan features`, async () => {
        const routes = await shortcuts(role);
        HIDDEN.forEach(r => expect(routes).withContext(`${role} ${r}`).not.toContain(r));
      });
    }

    it('only administrators get Translation plans', async () => {
      expect(await shortcuts('DEF-ADMIN')).toContain('translationplans');
      expect(await shortcuts('DEF-MASTERADMIN')).toContain('translationplans');
      expect(await shortcuts('DEF-CLIENT')).not.toContain('translationplans');
    });

    it('DEF-ADMIN keeps its other shortcuts', async () => {
      const routes = await shortcuts('DEF-ADMIN');
      ['user', 'usersubscriptionmonitoring', 'subscriptionreports', 'message', 'network', 'settings'].forEach(r => expect(routes).toContain(r));
    });

    it('DEF-MASTERADMIN keeps its full list, unchanged', async () => {
      const routes = await shortcuts('DEF-MASTERADMIN');
      ['user', 'userplan', 'subscriptionplans', 'usersubscriptionmonitoring', 'subscriptionreports', 'database', 'emailconfig', 'menu', 'role', 'security'].forEach(r => expect(routes).toContain(r));
      expect(routes.filter(r => r === 'settings').length).toBe(1);   // the "Subscription plans" settings shortcut
    });
  });
});
