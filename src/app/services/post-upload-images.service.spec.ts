import { NexsuzTestingModule } from 'src/testing/nexsuz-testing.module';
import { TestBed } from '@angular/core/testing';

import { PostUploadImagesService } from './post-upload-images.service';

describe('PostUploadImagesService', () => {
  let service: PostUploadImagesService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [NexsuzTestingModule]
    });
    service = TestBed.inject(PostUploadImagesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
