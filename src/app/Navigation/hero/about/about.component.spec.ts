import { NexsuzTestingModule } from 'src/testing/nexsuz-testing.module';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { AboutComponent } from './about.component';

describe('AboutComponent', () => {
  let component: AboutComponent;
  let fixture: ComponentFixture<AboutComponent>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NexsuzTestingModule],
      schemas: [NO_ERRORS_SCHEMA],
      declarations: [ AboutComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AboutComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    http.expectOne(r => r.url.endsWith('public/stats'));
  });

  it('formats totals: exact under 1,000, shortened above', () => {
    expect(AboutComponent.format(0)).toBe('0');
    expect(AboutComponent.format(2)).toBe('2');
    expect(AboutComponent.format(999)).toBe('999');
    expect(AboutComponent.format(1000)).toBe('1K+');
    expect(AboutComponent.format(25_340)).toBe('25.3K+');
    expect(AboutComponent.format(1_250_000)).toBe('1.2M+');
  });

  it('uses the real totals from the API and singular labels for 1', () => {
    http.expectOne(r => r.url.endsWith('public/stats')).flush({ success: true, data: { professionals: 2, jobs: 2, companies: 1 } });
    expect(component.stats.map(s => s.target)).toEqual([2, 2, 1]);
    expect(component.stats.map(s => component.label(s))).toEqual(['Professionals', 'Jobs Posted', 'Company']);
  });

  it('keeps a dash when the totals cannot be loaded', () => {
    http.expectOne(r => r.url.endsWith('public/stats')).flush({}, { status: 500, statusText: 'x' });
    fixture.detectChanges();
    expect(component.stats.every(s => s.shown === '—')).toBeTrue();
  });
});
