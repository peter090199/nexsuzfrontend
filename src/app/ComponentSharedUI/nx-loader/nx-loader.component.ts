import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { LoadingService } from 'src/app/services/Global/loading.service';

/**
 * The NEXSUZ loading indicator, one look everywhere.
 *
 *   <app-nx-loader></app-nx-loader>                           a page / section that is loading (centered)
 *   <app-nx-loader mode="inline" text="Saving…"></app-nx-loader>   small, sits in a row or a button area
 *   <app-nx-loader mode="overlay" text="Signing you in…"></app-nx-loader>   full screen
 *
 * The logo is a pale outline, so it always sits on a navy badge and reads on light or dark pages.
 */
@Component({
  selector: 'app-nx-loader',
  templateUrl: './nx-loader.component.html',
  styleUrls: ['./nx-loader.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NxLoaderComponent {
  @Input() mode: 'page' | 'inline' | 'overlay' = 'page';
  @Input() text = '';
  @Input() hint = '';
}

/** the slim bar at the very top of the screen, lit by any request or page change (mounted once in AppComponent) */
@Component({
  selector: 'app-nx-top-loader',
  template: `<div class="nx-top" *ngIf="loading.busy$ | async" role="progressbar" aria-label="Loading" aria-busy="true"><i></i></div>`,
  styles: [`
    .nx-top { position: fixed; top: 0; left: 0; right: 0; height: 3px; z-index: 2147483000; overflow: hidden; background: rgba(10, 102, 194, .12); pointer-events: none; }
    .nx-top i { display: block; width: 35%; height: 100%; border-radius: 0 3px 3px 0; background: linear-gradient(90deg, #0a66c2, #7a5af8, #70b5f9); animation: nx-top-slide 1.1s ease-in-out infinite; }
    @keyframes nx-top-slide { 0% { transform: translateX(-110%); } 100% { transform: translateX(300%); } }
    @media (prefers-reduced-motion: reduce) { .nx-top i { animation: none; width: 100%; opacity: .7; } }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NxTopLoaderComponent {
  constructor(public loading: LoadingService) { }
}
