import { NexsuzTestingModule } from 'src/testing/nexsuz-testing.module';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick, discardPeriodicTasks } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { HomeUIComponent } from './home-ui.component';

describe('HomeUIComponent', () => {
  let component: HomeUIComponent;
  let fixture: ComponentFixture<HomeUIComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NexsuzTestingModule],
      schemas: [NO_ERRORS_SCHEMA],
      declarations: [ HomeUIComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(HomeUIComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('live feed refresh', () => {
    let api: jasmine.Spy;
    const card = (id: number, over: any = {}) => ({ id, caption: 'post ' + id, images: [], videos: [], comments: [], ...over });

    beforeEach(() => {
      const svc: any = (component as any).postDataservices;
      api = spyOn(svc, 'getDataPostAddFollow');
      spyOn(component, 'loadReaction');
      (component as any).isLoading = false;
      component.posts = [{ ...card(2), showComments: true }, card(1)];
    });

    it('puts a newly published post on top without a reload, keeping the cards already on screen', () => {
      api.and.returnValue(of({ success: true, data: [card(3, { caption: 'from the admin', images: [{ path_url: 'uploads/a.jpg' }] }), card(2), card(1)] }));
      const open = component.posts[0];
      component.refreshFeedSilently();
      expect(component.posts.map(p => p.id)).toEqual([3, 2, 1]);
      expect(component.posts[1]).toBe(open);                  // same object: its open comments are kept
      expect(component.posts[1].showComments).toBeTrue();
      expect(component.posts[0].images[0].path_url).toContain('uploads/a.jpg');
      expect(component.posts[0].images[0].path_url.startsWith('http')).toBeTrue();
      expect(component.loadReaction).toHaveBeenCalledWith(3);
      expect((component as any).isLoading).toBeFalse();       // no skeleton flash
    });

    it('drops a post the viewer can no longer see (deleted, or made private)', () => {
      api.and.returnValue(of({ success: true, data: [card(2)] }));
      component.refreshFeedSilently();
      expect(component.posts.map(p => p.id)).toEqual([2]);
    });

    it('leaves the feed alone when the server answers with an error or a bad shape', () => {
      api.and.returnValue(of({ success: false }));
      component.refreshFeedSilently();
      expect(component.posts.map(p => p.id)).toEqual([2, 1]);
      api.and.returnValue(throwError(() => new Error('offline')));
      component.refreshFeedSilently();
      expect(component.posts.map(p => p.id)).toEqual([2, 1]);
      api.and.returnValue(of({ success: true, data: [card(2), card(1)] }));
      component.refreshFeedSilently();                          // and it can run again afterwards
      expect(api).toHaveBeenCalledTimes(3);
    });

    it('does not start a second refresh while one is running or the feed is loading', () => {
      (component as any).isLoading = true;
      component.refreshFeedSilently();
      expect(api).not.toHaveBeenCalled();
    });

    it('a burst of live events triggers a single refresh, and the event content is never used', fakeAsync(() => {
      api.and.returnValue(of({ success: true, data: [card(9), card(2), card(1)] }));
      const echo: any = (component as any).echoService;
      const event = { transNo: 9, code: '1', status: 1, created_at: 'now', caption: 'SHOULD NOT BE SHOWN' };
      (component as any).scheduleFeedRefresh(); (component as any).scheduleFeedRefresh(); (component as any).scheduleFeedRefresh();
      tick(900);
      expect(api).toHaveBeenCalledTimes(1);
      expect(component.posts.map(p => p.id)).toEqual([9, 2, 1]);
      expect(JSON.stringify(component.posts)).not.toContain(event.caption);
      expect(echo).toBeTruthy();
      discardPeriodicTasks();
    }));
  });
});
