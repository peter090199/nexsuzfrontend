import { DatePipe } from '@angular/common';
import { NgModule } from '@angular/core';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { TranslateModule } from '@ngx-translate/core';
import { ToastrModule } from 'ngx-toastr';
import { of } from 'rxjs';

import { MaterialModule } from 'src/Material/Material.module';

/**
 * Shared TestBed imports for component and service specs.
 *
 * Mirrors the infrastructure the real AppModule provides (HTTP, router,
 * forms, Material, animations, toastr and dialog tokens) so specs only need
 * to declare the unit under test:
 *
 *   TestBed.configureTestingModule({
 *     imports: [NexsuzTestingModule],
 *     declarations: [MyComponent],
 *   });
 */
@NgModule({
  imports: [
    HttpClientTestingModule,
    RouterTestingModule,
    NoopAnimationsModule,
    FormsModule,
    ReactiveFormsModule,
    MaterialModule,
    ToastrModule.forRoot(),
    TranslateModule.forRoot(),
  ],
  exports: [
    HttpClientTestingModule,
    RouterTestingModule,
    NoopAnimationsModule,
    FormsModule,
    ReactiveFormsModule,
    MaterialModule,
    ToastrModule,
    TranslateModule,
  ],
  providers: [
    DatePipe,
    // components that are opened as dialogs inject these
    { provide: MatDialogRef, useValue: { close: () => { }, afterClosed: () => of(undefined), backdropClick: () => of() } },
    { provide: MAT_DIALOG_DATA, useValue: {} },
  ],
})
export class NexsuzTestingModule { }
