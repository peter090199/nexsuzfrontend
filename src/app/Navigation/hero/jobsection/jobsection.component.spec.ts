import { NexsuzTestingModule } from 'src/testing/nexsuz-testing.module';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { JobsectionComponent } from './jobsection.component';

describe('JobsectionComponent', () => {
  let component: JobsectionComponent;
  let fixture: ComponentFixture<JobsectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NexsuzTestingModule],
      schemas: [NO_ERRORS_SCHEMA],
      declarations: [ JobsectionComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(JobsectionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('People filter needs sign in', () => {
    it('a guest who taps People is sent to sign in, then back to the people view', () => {
      const auth = TestBed.inject(AuthService);
      spyOn(auth, 'isLoggedIn').and.returnValue(false);
      const nav = spyOn(TestBed.inject(Router), 'navigate');

      component.setSearchType('people');

      expect(nav).toHaveBeenCalledWith(['/signin'], { queryParams: { view: 'people' } });
      expect(component.searchType).toBe('jobs');           // stays on jobs: no people shown to a guest
    });

    it('a signed-in user gets the people view', () => {
      spyOn(TestBed.inject(AuthService), 'isLoggedIn').and.returnValue(true);
      const nav = spyOn(TestBed.inject(Router), 'navigate');
      spyOn(component, 'getActivePeopleByCode').and.returnValue(Promise.resolve());

      component.setSearchType('people');

      expect(component.searchType).toBe('people');
      expect(nav).not.toHaveBeenCalled();
      expect(component.getActivePeopleByCode).toHaveBeenCalled();
    });
  });
});
