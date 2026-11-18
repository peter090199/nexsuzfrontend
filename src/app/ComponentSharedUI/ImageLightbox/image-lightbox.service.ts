import { Injectable } from '@angular/core';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { Observable, Subject } from 'rxjs';

import { ImageLightboxComponent, LightboxItem } from './image-lightbox.component';

export interface LightboxHandle {
  close(): void;
  afterClosed: Observable<void>;
}

/**
 * Opens the picture viewer in the CDK overlay layer: attached to <body>, so it is fixed to the viewport and
 * above the navbar, sidebar and feed no matter where in the page the picture was clicked, and unaffected by any
 * ancestor's overflow / transform.
 *
 * Keys go through the overlay keyboard dispatcher: with the viewer open on top of a dialog, Esc closes
 * the viewer only.
 */
@Injectable({ providedIn: 'root' })
export class ImageLightboxService {
  private current?: OverlayRef;

  constructor(private overlay: Overlay) { }

  open(items: LightboxItem[], startIndex = 0): LightboxHandle {
    this.current?.dispose();                                  // never two viewers at once

    const ref = this.overlay.create({
      positionStrategy: this.overlay.position().global(),
      scrollStrategy: this.overlay.scrollStrategies.block(),
      hasBackdrop: false,                                     // the component draws its own dark backdrop
      panelClass: 'nx-lightbox-pane',
    });
    this.current = ref;

    const opener = document.activeElement as HTMLElement | null;   // focus goes back here when the viewer closes
    const cmp = ref.attach(new ComponentPortal(ImageLightboxComponent));
    cmp.instance.returnFocusTo = opener;
    cmp.instance.items = items;
    cmp.instance.index = startIndex;

    const closed = new Subject<void>();
    let done = false;
    const finish = () => {
      if (done) { return; }                                   // closing triggers detachments(): run once only
      done = true;
      if (this.current === ref) { this.current = undefined; }
      ref.dispose();
      closed.next();
      closed.complete();
    };

    cmp.instance.closed.subscribe(finish);
    ref.keydownEvents().subscribe(event => cmp.instance.onKey(event));
    ref.detachments().subscribe(finish);

    return { close: finish, afterClosed: closed.asObservable() };
  }
}
