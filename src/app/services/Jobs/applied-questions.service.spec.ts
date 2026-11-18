import { NexsuzTestingModule } from 'src/testing/nexsuz-testing.module';
import { TestBed } from '@angular/core/testing';

import { AppliedQuestionsService } from './applied-questions.service';

describe('AppliedQuestionsService', () => {
  let service: AppliedQuestionsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [NexsuzTestingModule]
    });
    service = TestBed.inject(AppliedQuestionsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
