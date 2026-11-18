import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NexsuzTestingModule } from 'src/testing/nexsuz-testing.module';
import { ReactionButtonComponent } from './reaction-button.component';

describe('ReactionButtonComponent', () => {
  let fixture: ComponentFixture<ReactionButtonComponent>;
  let component: ReactionButtonComponent;
  let reacted: string[];
  let unreacted: number;

  const el = () => fixture.nativeElement as HTMLElement;
  const main = () => el().querySelector('button.main') as HTMLButtonElement;
  const picks = () => Array.from(el().querySelectorAll('.pick')) as HTMLButtonElement[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NexsuzTestingModule],
      declarations: [ReactionButtonComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(ReactionButtonComponent);
    component = fixture.componentInstance;
    reacted = [];
    unreacted = 0;
    component.react.subscribe((r: string) => reacted.push(r));
    component.unreact.subscribe(() => unreacted++);
    fixture.detectChanges();
  });

  it('shows "Like" until the user has reacted', () => {
    expect(main().textContent).toContain('Like');
    expect(main().getAttribute('aria-pressed')).toBe('false');
  });

  it('shows the chosen reaction\'s face and label', () => {
    component.myReaction = 'Love';
    fixture.detectChanges();
    expect(main().textContent).toContain('❤️');
    expect(main().textContent).toContain('Love');
    expect(main().getAttribute('aria-pressed')).toBe('true');
  });

  it('a plain click likes when there is no reaction yet', () => {
    main().click();
    expect(reacted).toEqual(['Like']);
    expect(unreacted).toBe(0);
  });

  it('a plain click takes an existing reaction back', () => {
    component.myReaction = 'Wow';
    fixture.detectChanges();
    main().click();
    expect(unreacted).toBe(1);
    expect(reacted).toEqual([]);
  });

  it('hovering opens the picker with all seven reactions after a short delay', fakeAsync(() => {
    component.onEnter();
    tick(100);
    fixture.detectChanges();
    expect(picks().length).toBe(0);                                   // not yet: avoids flicker
    tick(200);
    fixture.detectChanges();
    expect(picks().map(p => p.getAttribute('aria-label'))).toEqual(['Like', 'Love', 'Care', 'Haha', 'Wow', 'Sad', 'Angry']);
  }));

  it('leaving closes the picker, but moving back in time keeps it open', fakeAsync(() => {
    component.onEnter(); tick(300); fixture.detectChanges();
    expect(component.open).toBeTrue();

    component.onLeave(); tick(100);
    component.onEnter(); tick(400);                                   // came back before it closed
    expect(component.open).toBeTrue();

    component.onLeave(); tick(400);
    expect(component.open).toBeFalse();
  }));

  it('choosing a face sets that reaction and closes the picker', fakeAsync(() => {
    component.onEnter(); tick(300); fixture.detectChanges();
    picks()[2].click();                                               // Care
    expect(reacted).toEqual(['Care']);
    expect(component.open).toBeFalse();
  }));

  it('marks the current reaction in the picker', fakeAsync(() => {
    component.myReaction = 'Haha';
    component.onEnter(); tick(300); fixture.detectChanges();
    expect(picks().filter(p => p.classList.contains('selected')).map(p => p.getAttribute('aria-label'))).toEqual(['Haha']);
  }));

  it('a long press on a touch screen opens the picker and does not also like', fakeAsync(() => {
    component.onTouchStart();
    tick(500);
    expect(component.open).toBeTrue();
    component.onTouchEnd();
    main().click();                                                   // the click that follows the touch
    expect(reacted).toEqual([]);
    expect(unreacted).toBe(0);
  }));

  it('a short tap cancels the long-press timer', fakeAsync(() => {
    component.onTouchStart();
    tick(100);
    component.onTouchEnd();
    tick(600);
    expect(component.open).toBeFalse();
  }));

  it('Escape closes the picker', fakeAsync(() => {
    component.onFocusIn(); fixture.detectChanges();
    expect(component.open).toBeTrue();
    el().querySelector('.rb')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(component.open).toBeFalse();
  }));

  it('does nothing while disabled', () => {
    component.disabled = true;
    fixture.detectChanges();
    main().click();
    component.pick('Love');
    expect(reacted).toEqual([]);
    expect(unreacted).toBe(0);
  });

  it('cancels its timers when destroyed', fakeAsync(() => {
    component.onEnter();
    fixture.destroy();
    tick(1000);                                                       // fakeAsync fails if a timer were left pending
  }));
});
