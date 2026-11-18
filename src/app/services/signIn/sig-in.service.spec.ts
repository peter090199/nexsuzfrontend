import { NexsuzTestingModule } from 'src/testing/nexsuz-testing.module';
import { TestBed } from '@angular/core/testing';

import { SigInService } from './sig-in.service';

describe('SigInService', () => {
  let service: SigInService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [NexsuzTestingModule]
    });
    service = TestBed.inject(SigInService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
