import { NexsuzTestingModule } from 'src/testing/nexsuz-testing.module';
import { TestBed } from '@angular/core/testing';

import { JobListService } from './job-list.service';

describe('JobListService', () => {
  let service: JobListService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [NexsuzTestingModule]
    });
    service = TestBed.inject(JobListService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
