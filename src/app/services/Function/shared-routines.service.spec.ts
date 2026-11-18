import { NexsuzTestingModule } from 'src/testing/nexsuz-testing.module';
import { TestBed } from '@angular/core/testing';

import { SharedRoutinesService } from './shared-routines.service';

describe('SharedRoutinesService', () => {
  let service: SharedRoutinesService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [NexsuzTestingModule]
    });
    service = TestBed.inject(SharedRoutinesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
