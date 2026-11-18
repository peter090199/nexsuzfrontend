import { NexsuzTestingModule } from 'src/testing/nexsuz-testing.module';
import { TestBed } from '@angular/core/testing';

import { JobPostingService } from './job-posting.service';

describe('JobPostingService', () => {
  let service: JobPostingService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [NexsuzTestingModule]
    });
    service = TestBed.inject(JobPostingService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
