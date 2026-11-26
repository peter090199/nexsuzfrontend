import { NexsuzTestingModule } from 'src/testing/nexsuz-testing.module';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { JobPostingComponent } from './job-posting.component';

describe('JobPostingComponent', () => {
  let component: JobPostingComponent;
  let fixture: ComponentFixture<JobPostingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NexsuzTestingModule],
      schemas: [NO_ERRORS_SCHEMA],
      declarations: [ JobPostingComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(JobPostingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });
  it('links active vacancies to their job page and gives drafts no link', () => {
    sessionStorage.setItem('role', 'DEF-CLIENT');
    component.jobPosting = [
      { transNo: 'TR-1', job_name: 'Live one', recordstatus: 'active' },
      { transNo: 'TR-2', job_name: 'Not yet', recordstatus: 'draft' },
    ];
    component.isLoading = false;
    component.applyFilter();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelectorAll('.job').length).toBe(2);
    expect(component.jobLink(component.jobPosting[0])).toEqual(['/DEF-CLIENT', 'recommended-jobs', 'TR-1']);
    expect(component.jobLink(component.jobPosting[1])).toBeNull();

    component.setStatus('draft');
    fixture.detectChanges();
    expect(el.querySelectorAll('.job').length).toBe(1);
    sessionStorage.removeItem('role');
  });


  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
