import { NexsuzTestingModule } from 'src/testing/nexsuz-testing.module';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { JobsProfileComponent } from './jobs-profile.component';

describe('JobsProfileComponent', () => {
  let component: JobsProfileComponent;
  let fixture: ComponentFixture<JobsProfileComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NexsuzTestingModule],
      schemas: [NO_ERRORS_SCHEMA],
      declarations: [ JobsProfileComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(JobsProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('hides the job list, Apply and Save for a recruiter only', () => {
    const el = fixture.nativeElement as HTMLElement;
    const show = (role: string) => {
      sessionStorage.setItem('role', role);
      component.selectedJob = { transNo: 'TR-1', job_name: 'Developer', created_at: '2026-11-01' };
      fixture.detectChanges();
      return ['.jobs-sidebar', '.apply-btn', '.save-toggle'].map(s => !!el.querySelector(s));
    };

    expect(show('DEF-USERS')).toEqual([true, true, true]);
    expect(show('DEF-CLIENT')).toEqual([false, false, false]);
    expect(el.querySelector('h1')?.textContent).toContain('Developer');
    sessionStorage.removeItem('role');
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
