import { NexsuzTestingModule } from 'src/testing/nexsuz-testing.module';
import { TestBed } from '@angular/core/testing';

import { ToolBoxService } from './tool-box.service';

describe('ToolBoxService', () => {
  let service: ToolBoxService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [NexsuzTestingModule]
    });
    service = TestBed.inject(ToolBoxService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
