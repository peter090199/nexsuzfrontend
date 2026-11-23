import { NexsuzTestingModule } from 'src/testing/nexsuz-testing.module';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ProfileService } from 'src/app/services/Profile/profile.service';

import { PeopleComponent } from './people.component';
import { PersonCardComponent } from 'src/app/ComponentSharedUI/person-card/person-card.component';

describe('PeopleComponent', () => {
  let component: PeopleComponent;
  let fixture: ComponentFixture<PeopleComponent>;
  let svc: ProfileService;

  const person = (code: number, name: string, extra: any = {}) => ({ code, role_code: 'DEF-USERS', fullname: name, skills: 'PHP', profession: 'Dev', photo_pic: null, coverphoto: null, follow_status: 'not_following', ...extra });
  const result = (online: any[], offline: any[], meta: any = {}) => ({ success: true, online, offline, meta: { current_page: 1, online_has_more: false, offline_has_more: false, ...meta } });

  async function create(res: any, role = 'DEF-USERS') {
    sessionStorage.setItem('role', role);
    sessionStorage.setItem('token', 'tok');
    sessionStorage.setItem('code', '1');
    await TestBed.configureTestingModule({ imports: [NexsuzTestingModule], schemas: [NO_ERRORS_SCHEMA], declarations: [PeopleComponent, PersonCardComponent] }).compileComponents();
    svc = TestBed.inject(ProfileService);
    spyOn(svc, 'getCompanyPeople').and.returnValue(res);
    fixture = TestBed.createComponent(PeopleComponent);
    component = fixture.componentInstance;
    component.code = '711';
    fixture.detectChanges();
  }
  afterEach(() => { ['role', 'token', 'code'].forEach(k => sessionStorage.removeItem(k)); });
  const el = () => fixture.nativeElement as HTMLElement;

  it('should create', async () => {
    await create(of(result([], [])));
    expect(component).toBeTruthy();
  });

  it('asks for the people of this company', async () => {
    await create(of(result([], [])));
    expect(svc.getCompanyPeople).toHaveBeenCalledWith('711', '', 1, 10);
  });

  it('groups people into Online and Offline with the shared person card', async () => {
    await create(of(result([person(2, 'Ann')], [person(3, 'Bob'), person(4, 'Cy')])));
    expect(el().textContent).toContain('Online (1)');
    expect(el().textContent).toContain('Offline (2)');
    expect(el().textContent).toContain('3 people');
    expect(el().querySelectorAll('.people-panel app-person-card').length).toBe(3);
  });

  it('shows an empty state when the company has no connections', async () => {
    await create(of(result([], [])));
    expect(el().querySelector('.state-box')!.textContent).toContain('No connections yet');
  });

  it('shows an error with Retry when the people cannot be loaded', async () => {
    await create(throwError(() => ({ status: 500 })));
    expect(component.failed).toBeTrue();
    expect(el().querySelector('.state-box.error')).toBeTruthy();
    (svc.getCompanyPeople as jasmine.Spy).and.returnValue(of(result([person(2, 'Ann')], [])));
    component.load(1);
    fixture.detectChanges();
    expect(component.failed).toBeFalse();
    expect(component.total).toBe(1);
  });

  it('searching asks the server again after a short pause', fakeAsync(() => {
    TestBed.configureTestingModule({ imports: [NexsuzTestingModule], schemas: [NO_ERRORS_SCHEMA], declarations: [PeopleComponent, PersonCardComponent] }).compileComponents();
    svc = TestBed.inject(ProfileService);
    const spy = spyOn(svc, 'getCompanyPeople').and.returnValue(of(result([], [])));
    fixture = TestBed.createComponent(PeopleComponent);
    component = fixture.componentInstance;
    component.code = '711';
    fixture.detectChanges();
    spy.calls.reset();
    component.onSearch('an');
    component.onSearch('ann');
    expect(spy).not.toHaveBeenCalled();
    tick(300);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('711', 'ann', 1, 10);
  }));

  it('load more appends the next page', async () => {
    await create(of(result([], [person(3, 'Bob')], { offline_has_more: true })));
    expect(component.hasMore).toBeTrue();
    (svc.getCompanyPeople as jasmine.Spy).and.returnValue(of(result([], [person(4, 'Cy')], { current_page: 2 })));
    component.loadMore();
    expect(component.offline.map(p => p.code)).toEqual([3, 4]);
    expect(component.hasMore).toBeFalse();
  });

  it('blocking someone removes them from the list', async () => {
    await create(of(result([person(2, 'Ann')], [person(3, 'Bob')])));
    component.removeBlocked(3);
    expect(component.total).toBe(1);
  });

  it('job seekers and recruiters get the Connect action, admins do not', async () => {
    await create(of(result([], [])), 'DEF-MASTERADMIN');
    expect(component.canAct).toBeFalse();
  });
});
