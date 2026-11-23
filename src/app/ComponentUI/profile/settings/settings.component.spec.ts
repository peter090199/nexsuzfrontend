import { NexsuzTestingModule } from 'src/testing/nexsuz-testing.module';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SettingsComponent } from './settings.component';

describe('SettingsComponent', () => {
  let component: SettingsComponent;
  let fixture: ComponentFixture<SettingsComponent>;

  async function create(role?: string) {
    if (role) { sessionStorage.setItem('role', role); } else { sessionStorage.removeItem('role'); }
    await TestBed.configureTestingModule({
      imports: [NexsuzTestingModule],
      schemas: [NO_ERRORS_SCHEMA],
      declarations: [ SettingsComponent ]
    })
    .compileComponents();
    fixture = TestBed.createComponent(SettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }
  afterEach(() => sessionStorage.removeItem('role'));

  it('should create', async () => {
    await create();
    expect(component).toBeTruthy();
  });

  describe('Subscription Plan section', () => {
    const plan = () => component.sections.find(s => s.id === 'plan');

    it('job seekers have it', async () => {
      await create('DEF-USERS');
      expect(plan()).toBeTruthy();
      expect(plan()!.available).toBeTrue();
      expect(plan()!.description).toContain('upgrade');
    });

    it('recruiters have it too', async () => {
      await create('DEF-CLIENT');
      expect(plan()).toBeTruthy();
      expect(plan()!.available).toBeTrue();
      expect(plan()!.description).toContain('recruiter plan');
    });

    it('the master admin keeps it, with the management description', async () => {
      await create('DEF-MASTERADMIN');
      expect(plan()!.description).toContain('Manage plans');
    });

    it('admins, who cannot hold a plan, do not get it', async () => {
      await create('DEF-ADMIN');
      expect(plan()).toBeUndefined();
    });
  });
});
