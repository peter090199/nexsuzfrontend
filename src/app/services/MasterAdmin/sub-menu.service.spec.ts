import { NexsuzTestingModule } from 'src/testing/nexsuz-testing.module';
import { TestBed } from '@angular/core/testing';

import { SubMenuService } from './sub-menu.service';

describe('SubMenuService', () => {
  let service: SubMenuService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [NexsuzTestingModule]
    });
    service = TestBed.inject(SubMenuService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
