import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { FeatureService } from 'src/app/services/AccountPlan/feature.service';
import { AppFeatureDirective } from './app-feature.directive';

@Component({
  template: `
    <button id="one" *appFeature="'MESSAGING_ACCESS'">Message</button>
    <button id="two" *appFeature="['JOB_POSTING', 'MESSAGING_ACCESS']">Post</button>
    <button id="three" *appFeature="'JOB_POSTING'; else upgrade">Post a job</button>
    <ng-template #upgrade><span id="upgrade">Upgrade to post jobs</span></ng-template>
  `
})
class HostComponent { }

describe('AppFeatureDirective', () => {
  let fixture: ComponentFixture<HostComponent>;
  let changes$: BehaviorSubject<number>;
  let denied: Set<string>;

  const el = (id: string) => fixture.nativeElement.querySelector('#' + id);
  const tick = () => { changes$.next(changes$.value + 1); fixture.detectChanges(); };

  beforeEach(() => {
    denied = new Set<string>();
    changes$ = new BehaviorSubject<number>(0);
    TestBed.configureTestingModule({
      declarations: [HostComponent, AppFeatureDirective],
      providers: [{ provide: FeatureService, useValue: { changes$, allows: (c: string) => !denied.has(c) } }],
    });
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it('shows content whose feature the plan includes', () => {
    expect(el('one')).toBeTruthy();
    expect(el('two')).toBeTruthy();
    expect(el('three')).toBeTruthy();
    expect(el('upgrade')).toBeNull();
  });

  it('hides content whose feature is missing', () => {
    denied.add('MESSAGING_ACCESS');

    tick();

    expect(el('one')).toBeNull();
  });

  it('with several features, hides the content unless every one is included', () => {
    denied.add('JOB_POSTING');

    tick();

    expect(el('two')).toBeNull();
    expect(el('one')).toBeTruthy();
  });

  it('shows the else template in its place', () => {
    denied.add('JOB_POSTING');

    tick();

    expect(el('three')).toBeNull();
    expect(el('upgrade').textContent).toContain('Upgrade to post jobs');
  });

  it('follows the plan live: it comes back when the feature is included again', () => {
    denied.add('MESSAGING_ACCESS');
    tick();
    expect(el('one')).toBeNull();

    denied.delete('MESSAGING_ACCESS');
    tick();

    expect(el('one')).toBeTruthy();
  });
});
