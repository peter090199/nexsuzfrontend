import { NexsuzTestingModule } from 'src/testing/nexsuz-testing.module';
import { TestBed } from '@angular/core/testing';

import { PostReactionByIdService } from './post-reaction-by-id.service';

describe('PostReactionByIdService', () => {
  let service: PostReactionByIdService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [NexsuzTestingModule]
    });
    service = TestBed.inject(PostReactionByIdService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
