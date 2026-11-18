import { NexsuzTestingModule } from 'src/testing/nexsuz-testing.module';
import { TestBed } from '@angular/core/testing';

import { AppiedListJobService } from './appied-list-job.service';

describe('AppiedListJobService', () => {
  let service: AppiedListJobService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [NexsuzTestingModule]
    });
    service = TestBed.inject(AppiedListJobService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
