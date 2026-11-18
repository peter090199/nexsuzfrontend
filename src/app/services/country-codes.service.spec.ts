import { NexsuzTestingModule } from 'src/testing/nexsuz-testing.module';
import { TestBed } from '@angular/core/testing';

import { CountryCodesService } from './country-codes.service';

describe('CountryCodesService', () => {
  let service: CountryCodesService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [NexsuzTestingModule]
    });
    service = TestBed.inject(CountryCodesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
