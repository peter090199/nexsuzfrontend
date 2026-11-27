import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NexsuzTestingModule } from 'src/testing/nexsuz-testing.module';
import { _url } from 'src/global-variables';
import { SeeTranslationComponent } from './see-translation.component';

describe('See translation', () => {
  let fixture: ComponentFixture<SeeTranslationComponent>;
  let http: HttpTestingController;

  const start = (enabled: boolean) => {
    sessionStorage.setItem('token', 't');
    TestBed.configureTestingModule({ imports: [NexsuzTestingModule], declarations: [SeeTranslationComponent] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(SeeTranslationComponent);
    fixture.componentInstance.text = 'こんにちは';
    fixture.detectChanges();
    http.expectOne(`${_url}translation/status`).flush({ enabled });
    fixture.detectChanges();
  };
  afterEach(() => sessionStorage.removeItem('token'));

  it('shows nothing while paid translation is off', () => {
    start(false);

    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });

  it('sends the text only when clicked, once, and can hide the translation again', () => {
    start(true);
    http.expectNone(`${_url}translation/text`);
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');

    button.click();
    http.expectOne(`${_url}translation/text`).flush({ translated: 'Hello' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Hello');

    button.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Hello');
    button.click();
    http.expectNone(`${_url}translation/text`);
  });
});
