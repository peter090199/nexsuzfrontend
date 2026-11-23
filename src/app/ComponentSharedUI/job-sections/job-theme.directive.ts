import { Directive, ElementRef, Input, OnChanges } from '@angular/core';
import { JobTemplate, JobTemplateService } from 'src/app/services/Jobs/job-template.service';

/**
 * Applies a job template's theme to an element: CSS variables (colours, font, radius) plus classes for the
 * button / header / background style and the layout. With no template nothing is applied, so jobs posted
 * without one look exactly as they always did.
 *
 *   <article [nxJobTheme]="template"> ... uses var(--jt-primary) etc.
 */
@Directive({ selector: '[nxJobTheme]' })
export class JobThemeDirective implements OnChanges {
  @Input('nxJobTheme') template: JobTemplate | null | undefined;

  private applied: string[] = [];
  private vars: string[] = [];

  constructor(private el: ElementRef<HTMLElement>, private svc: JobTemplateService) { }

  ngOnChanges(): void {
    const host = this.el.nativeElement;
    this.applied.forEach(c => host.classList.remove(c));
    this.vars.forEach(v => host.style.removeProperty(v));
    this.applied = [];
    this.vars = [];

    const t = this.template?.theme;
    if (!t) { return; }

    const set = (name: string, value: string | number) => { host.style.setProperty(name, String(value)); this.vars.push(name); };
    set('--jt-primary', t.primary);
    set('--jt-accent', t.accent);
    set('--jt-bg', t.background);
    set('--jt-surface', t.surface);
    set('--jt-text', t.text);
    set('--jt-font', this.svc.fontStack(t.font));
    set('--jt-radius', t.radius + 'px');
    set('--jt-btn-radius', t.buttonShape === 'pill' ? '999px' : t.buttonShape === 'rounded' ? '10px' : '2px');

    this.applied = ['jt', 'jt-btn-' + t.buttonStyle, 'jt-hdr-' + t.headerStyle, 'jt-bgs-' + t.backgroundStyle, 'jt-layout-' + t.layout];
    this.applied.forEach(c => host.classList.add(c));
  }
}
