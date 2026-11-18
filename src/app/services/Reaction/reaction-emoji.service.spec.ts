import { NexsuzTestingModule } from 'src/testing/nexsuz-testing.module';
import { TestBed } from '@angular/core/testing';

import { ReactionEmojiService } from './reaction-emoji.service';

describe('ReactionEmojiService', () => {
  let service: ReactionEmojiService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [NexsuzTestingModule]
    });
    service = TestBed.inject(ReactionEmojiService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
