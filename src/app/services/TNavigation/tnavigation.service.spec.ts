import { NexsuzTestingModule } from 'src/testing/nexsuz-testing.module';
import { TestBed } from '@angular/core/testing';

import { TNavigationService } from './tnavigation.service';

describe('TNavigationService', () => {
  let service: TNavigationService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [NexsuzTestingModule]
    });
    service = TestBed.inject(TNavigationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
