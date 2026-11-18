import { Component, ElementRef, HostListener, Inject, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

import {
  CropBox, CropState, clamp, initialState, moveBy, scaleFromSlider, sliderFromScale, sourceRect, zoomTo
} from './crop-math';

export interface CropperData {
  file: File;
  shape: 'circle' | 'banner';
  title: string;
}

/**
 * Facebook-style photo editor: drag to reposition, slider / wheel / pinch to zoom, then Save.
 * Closes with the cropped picture as a File (JPEG), or with nothing when cancelled.
 *
 * circle -> a square crop shown through a round window (exported 512x512)
 * banner -> a 3:1 crop for the cover (exported 1500x500)
 */
@Component({
  selector: 'app-image-cropper-dialog',
  templateUrl: './image-cropper-dialog.component.html',
  styleUrls: ['./image-cropper-dialog.component.css']
})
export class ImageCropperDialogComponent implements OnInit, OnDestroy {
  @ViewChild('stage') stageRef?: ElementRef<HTMLElement>;

  box: CropBox = { width: 280, height: 280 };
  private readonly output = { circle: { w: 512, h: 512 }, banner: { w: 1500, h: 500 } };
  private readonly maxZoom = 4;                       // up to 4x the "fits exactly" size

  objectUrl = '';
  safeUrl: SafeUrl | null = null;
  imgW = 0;
  imgH = 0;
  ready = false;
  failed = false;
  small = false;                                      // the picture is smaller than the output: may look soft
  saving = false;

  state: CropState = { scale: 1, x: 0, y: 0 };
  minScale = 1;
  maxScale = 4;
  slider = 0;

  private image?: HTMLImageElement;
  private dragging = false;
  private last = { x: 0, y: 0 };
  private pointers = new Map<number, { x: number; y: number }>();
  private pinchStart = 0;

  constructor(
    public dialogRef: MatDialogRef<ImageCropperDialogComponent, File | undefined>,
    @Inject(MAT_DIALOG_DATA) public data: CropperData,
    private sanitizer: DomSanitizer,
    private zone: NgZone
  ) { }

  get isCircle(): boolean { return this.data.shape === 'circle'; }

  ngOnInit(): void {
    this.box = this.isCircle
      ? { width: 280, height: 280 }
      : { width: Math.max(240, Math.min(540, window.innerWidth - 72)), height: 0 };
    if (!this.isCircle) { this.box.height = Math.round(this.box.width / 3); }

    this.objectUrl = URL.createObjectURL(this.data.file);
    this.safeUrl = this.sanitizer.bypassSecurityTrustUrl(this.objectUrl);   // blob: URL we just created from the chosen file

    const img = new Image();
    img.onload = () => {
      this.image = img;
      this.imgW = img.naturalWidth;
      this.imgH = img.naturalHeight;
      const target = this.output[this.data.shape];
      this.small = this.imgW < target.w / 2 || this.imgH < target.h / 2;

      const start = initialState(this.imgW, this.imgH, this.box);
      this.minScale = start.scale;
      this.maxScale = start.scale * this.maxZoom;
      this.state = start;
      this.slider = 0;
      this.ready = true;
    };
    img.onerror = () => { this.failed = true; };
    img.src = this.objectUrl;
  }

  ngOnDestroy(): void {
    URL.revokeObjectURL(this.objectUrl);
  }

  // ------------------------------------------------------------------ transform for the template
  get transform(): string {
    return `translate(${this.state.x}px, ${this.state.y}px) scale(${this.state.scale})`;
  }

  // ------------------------------------------------------------------ drag, pinch, wheel, keys
  onPointerDown(e: PointerEvent): void {
    if (!this.ready) { return; }
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.dragging = this.pointers.size === 1;
    this.last = { x: e.clientX, y: e.clientY };
    if (this.pointers.size === 2) { this.pinchStart = this.pinchDistance(); }
  }

  onPointerMove(e: PointerEvent): void {
    if (!this.pointers.has(e.pointerId)) { return; }
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this.pointers.size === 2) {                                   // two fingers: pinch to zoom
      const d = this.pinchDistance();
      if (this.pinchStart > 0) { this.zoomBy(d / this.pinchStart); }
      this.pinchStart = d;
      return;
    }
    if (this.dragging) {
      this.state = moveBy(this.state, e.clientX - this.last.x, e.clientY - this.last.y, this.imgW, this.imgH, this.box);
      this.last = { x: e.clientX, y: e.clientY };
    }
  }

  onPointerUp(e: PointerEvent): void {
    this.pointers.delete(e.pointerId);
    this.dragging = this.pointers.size === 1;
    if (this.pointers.size === 1) {
      const rest = Array.from(this.pointers.values())[0];
      this.last = { ...rest };
    }
  }

  onWheel(e: WheelEvent): void {
    if (!this.ready) { return; }
    e.preventDefault();
    this.zoomBy(e.deltaY < 0 ? 1.08 : 1 / 1.08, this.focusPoint(e));
  }

  @HostListener('keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    if (!this.ready) { return; }
    const step = 10;
    const moves: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    if (moves[e.key]) {
      e.preventDefault();
      this.state = moveBy(this.state, moves[e.key][0], moves[e.key][1], this.imgW, this.imgH, this.box);
    } else if (e.key === '+' || e.key === '=') { this.zoomBy(1.1); }
    else if (e.key === '-') { this.zoomBy(1 / 1.1); }
  }

  private pinchDistance(): number {
    const [a, b] = Array.from(this.pointers.values());
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  private focusPoint(e: WheelEvent): { x: number; y: number } | undefined {
    const rect = this.stageRef?.nativeElement.getBoundingClientRect();
    return rect ? { x: e.clientX - rect.left, y: e.clientY - rect.top } : undefined;
  }

  // ------------------------------------------------------------------ zoom
  zoomBy(factor: number, focus?: { x: number; y: number }): void {
    this.state = zoomTo(this.state, this.state.scale * factor, this.imgW, this.imgH, this.box, this.minScale, this.maxScale, focus);
    this.slider = sliderFromScale(this.state.scale, this.minScale, this.maxScale);
  }

  onSlider(value: number | string): void {
    const scale = scaleFromSlider(Number(value), this.minScale, this.maxScale);
    this.state = zoomTo(this.state, scale, this.imgW, this.imgH, this.box, this.minScale, this.maxScale);
    this.slider = Number(value);
  }

  reset(): void {
    this.state = initialState(this.imgW, this.imgH, this.box);
    this.slider = 0;
  }

  // ------------------------------------------------------------------ save / cancel
  save(): void {
    if (!this.ready || this.saving || !this.image) { return; }
    this.saving = true;

    const target = this.output[this.data.shape];
    const rect = sourceRect(clamp(this.state, this.imgW, this.imgH, this.box), this.imgW, this.imgH, this.box);

    const canvas = document.createElement('canvas');
    canvas.width = target.w;
    canvas.height = target.h;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';                                        // transparent PNGs become white, not black
    ctx.fillRect(0, 0, target.w, target.h);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(this.image, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, target.w, target.h);

    // toBlob calls back asynchronously, possibly outside Angular's zone. Finish inside it, otherwise the
    // dialog's close animation is never flushed and the dialog (and the upload that follows) hangs.
    canvas.toBlob(blob => this.zone.run(() => {
      if (!blob) { this.saving = false; this.failed = true; return; }
      const base = (this.data.file.name || 'photo').replace(/\.[^.]+$/, '');
      this.dialogRef.close(new File([blob], `${base}.jpg`, { type: 'image/jpeg' }));
    }), 'image/jpeg', 0.9);
  }

  cancel(): void {
    this.dialogRef.close(undefined);
  }
}
