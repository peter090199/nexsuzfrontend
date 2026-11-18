import { NexsuzTestingModule } from 'src/testing/nexsuz-testing.module';
import { TestBed } from '@angular/core/testing';

import { AppliedStatusService } from './applied-status.service';

describe('AppliedStatusService', () => {
  let service: AppliedStatusService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [NexsuzTestingModule]
    });
    service = TestBed.inject(AppliedStatusService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
