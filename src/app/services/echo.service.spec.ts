import { NexsuzTestingModule } from 'src/testing/nexsuz-testing.module';
import { TestBed } from '@angular/core/testing';

import { EchoService } from './echo.service';

describe('EchoService', () => {
  let service: EchoService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [NexsuzTestingModule]
    });
    service = TestBed.inject(EchoService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
