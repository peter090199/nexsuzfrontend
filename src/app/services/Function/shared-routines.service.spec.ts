import { NexsuzTestingModule } from 'src/testing/nexsuz-testing.module';
import { TestBed } from '@angular/core/testing';

import { SharedRoutinesService } from './shared-routines.service';

describe('SharedRoutinesService', () => {
  let service: SharedRoutinesService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [NexsuzTestingModule]
    });
    service = TestBed.inject(SharedRoutinesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('canManageSubscriptions is true only for DEF-ADMIN and DEF-MASTERADMIN', () => {
    const was = sessionStorage.getItem('role');
    for (const [role, expected] of [['DEF-ADMIN', true], ['DEF-MASTERADMIN', true], ['DEF-USERS', false], ['DEF-CLIENT', false], ['DEF-SUPERADMIN', false]] as [string, boolean][]) {
      sessionStorage.setItem('role', role);
      expect(service.canManageSubscriptions()).withContext(role).toBe(expected);
    }
    sessionStorage.removeItem('role');
    expect(service.canManageSubscriptions()).toBeFalse();
    if (was) { sessionStorage.setItem('role', was); }
  });
});
