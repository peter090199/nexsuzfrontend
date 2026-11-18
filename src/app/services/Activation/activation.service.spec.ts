import { NexsuzTestingModule } from 'src/testing/nexsuz-testing.module';
import { TestBed } from '@angular/core/testing';

import { ActivationService } from './activation.service';

describe('ActivationService', () => {
  let service: ActivationService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [NexsuzTestingModule]
    });
    service = TestBed.inject(ActivationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
