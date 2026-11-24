import { NexsuzTestingModule } from 'src/testing/nexsuz-testing.module';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SideBarPanelComponent } from './side-bar-panel.component';

describe('SideBarPanelComponent', () => {
  let component: SideBarPanelComponent;
  let fixture: ComponentFixture<SideBarPanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NexsuzTestingModule],
      schemas: [NO_ERRORS_SCHEMA],
      declarations: [ SideBarPanelComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SideBarPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
  describe('mobile: the drawer footer can be tapped', () => {
    const el = () => fixture.nativeElement as HTMLElement;
    const tabBar = () => el().querySelector('[data-testid="tab-bar"]') as HTMLElement | null;
    const phone = (drawerOpen: boolean) => { component.isMobile = true; component.sidebarOpen = drawerOpen; fixture.detectChanges(); };

    it('the account card (the footer) is in the drawer', () => {
      phone(true);
      const footer = el().querySelector('.sidebar-footer');
      expect(footer).not.toBeNull();
      expect(footer!.querySelector('button.profile-footer-btn')).not.toBeNull();
    });

    it('the bottom tab bar steps out of the way while the drawer is open, so it cannot cover the footer', () => {
      phone(false);
      expect(tabBar()).not.toBeNull();
      expect(tabBar()!.classList.contains('behind-drawer')).toBeFalse();
      expect(tabBar()!.getAttribute('aria-hidden')).toBeNull();

      phone(true);
      expect(tabBar()!.classList.contains('behind-drawer')).toBeTrue();
      expect(tabBar()!.getAttribute('aria-hidden')).toBe('true');

      phone(false);                                                   // closing the drawer brings it back
      expect(tabBar()!.classList.contains('behind-drawer')).toBeFalse();
    });

    it('there is no tab bar at all on a desktop', () => {
      component.isMobile = false; component.sidebarOpen = true; fixture.detectChanges();
      expect(tabBar()).toBeNull();
    });

    it('ships the mobile rules: hidden tab bar, visible-height layout, thumb-sized footer, landscape and narrow phones', () => {
      const css = ((SideBarPanelComponent as any).ɵcmp.styles as string[]).join('\n');
      expect(css).toContain('.tab-bar.behind-drawer');
      expect(css).toContain('pointer-events: none');
      expect(css).toContain('height: 100dvh');
      expect(css).toContain('env(safe-area-inset-bottom');
      expect(css).toContain('min-height: 52px');
      expect(css).toContain('touch-action: manipulation');
      expect(css).toContain('@media (max-width: 960px) and (max-height: 480px)');
      expect(css).toContain('@media (max-width: 359.98px)');
      expect(css).toContain('max-width: 92vw');
    });
  });
});