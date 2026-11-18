import { NexsuzTestingModule } from 'src/testing/nexsuz-testing.module';
import { TestBed } from '@angular/core/testing';

import { UserPlanService } from './user-plan.service';

describe('UserPlanService', () => {
  let service: UserPlanService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [NexsuzTestingModule]
    });
    service = TestBed.inject(UserPlanService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
