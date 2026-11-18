import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { NexsuzTestingModule } from 'src/testing/nexsuz-testing.module';

import { CropperData, ImageCropperDialogComponent } from './image-cropper-dialog.component';

/** A real decodable image: left half red, right half blue. */
function twoColourFile(w = 400, h = 200, name = 'two.png'): Promise<File> {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ff0000'; ctx.fillRect(0, 0, w / 2, h);
  ctx.fillStyle = '#0000ff'; ctx.fillRect(w / 2, 0, w / 2, h);
  return new Promise(res => c.toBlob(b => res(new File([b!], name, { type: 'image/png' })), 'image/png'));
}

/** The colour of the pixel at (x, y) of an image File. */
async function pixelOf(file: File, x: number, y: number): Promise<number[]> {
  const bmp = await createImageBitmap(file);
  const c = document.createElement('canvas');
  c.width = bmp.width; c.height = bmp.height;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(bmp, 0, 0);
  return Array.from(ctx.getImageData(x, y, 1, 1).data);
}
async function sizeOf(file: File): Promise<[number, number]> {
  const b = await createImageBitmap(file);
  return [b.width, b.height];
}
const until = async (cond: () => boolean, ms = 3000) => {
  const end = Date.now() + ms;
  while (!cond() && Date.now() < end) { await new Promise(r => setTimeout(r, 20)); }
};
const pointer = (id: number, x: number, y: number) =>
  ({ pointerId: id, clientX: x, clientY: y, currentTarget: { setPointerCapture: () => { } } } as unknown as PointerEvent);

describe('ImageCropperDialogComponent', () => {
  let fixture: ComponentFixture<ImageCropperDialogComponent>;
  let component: ImageCropperDialogComponent;

  async function setup(data: Partial<CropperData> & { file: File }) {
    await TestBed.configureTestingModule({
      imports: [NexsuzTestingModule],
      declarations: [ImageCropperDialogComponent],
      providers: [{ provide: MAT_DIALOG_DATA, useValue: { shape: 'circle', title: 'Update profile photo', ...data } }],
    }).compileComponents();
    fixture = TestBed.createComponent(ImageCropperDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await until(() => component.ready || component.failed);
    fixture.detectChanges();
  }
  const el = () => fixture.nativeElement as HTMLElement;

  it('loads the picture and starts covering the round window, centred', async () => {
    await setup({ file: await twoColourFile(800, 400) });
    expect(component.ready).toBeTrue();
    expect(component.isCircle).toBeTrue();
    expect(component.box).toEqual({ width: 280, height: 280 });
    expect(component.state.scale).toBeCloseTo(0.7);
    expect(component.state.x).toBeCloseTo(-140);
    expect(el().querySelector('.stage.circle')).not.toBeNull();
    expect(el().querySelector('.stage img')!.getAttribute('src')).toMatch(/^blob:/);     // not "unsafe:blob:"
    expect(el().querySelector('h2')!.textContent).toContain('Update profile photo');
  });

  it('uses a 3:1 window for the cover', async () => {
    await setup({ file: await twoColourFile(1200, 800), shape: 'banner', title: 'Update cover photo' });
    expect(component.isCircle).toBeFalse();
    expect(component.box.width / component.box.height).toBeCloseTo(3, 1);
    expect(el().querySelector('.stage.circle')).toBeNull();
  });

  it('dragging repositions the picture and cannot pull an edge into the window', async () => {
    await setup({ file: await twoColourFile(800, 400) });
    component.onPointerDown(pointer(1, 100, 100));
    component.onPointerMove(pointer(1, 130, 100));              // +30
    expect(component.state.x).toBeCloseTo(-110);
    component.onPointerMove(pointer(1, 5000, 100));             // way too far
    expect(component.state.x).toBe(0);
    component.onPointerUp(pointer(1, 5000, 100));
    component.onPointerMove(pointer(1, 0, 0));                  // not dragging any more
    expect(component.state.x).toBe(0);
  });

  it('the slider and the buttons zoom within limits; Reset goes back', async () => {
    await setup({ file: await twoColourFile(800, 400) });
    const min = component.minScale;
    component.onSlider(100);
    expect(component.state.scale).toBeCloseTo(min * 4);
    component.zoomBy(10);
    expect(component.state.scale).toBeCloseTo(min * 4);         // capped
    component.zoomBy(0.0001);
    expect(component.state.scale).toBeCloseTo(min);             // never smaller than "covers the window"
    component.onSlider(60);
    component.reset();
    expect(component.state.scale).toBeCloseTo(min);
    expect(component.slider).toBe(0);
  });

  it('arrow keys move the picture and + / - zoom', async () => {
    await setup({ file: await twoColourFile(800, 400) });
    const x = component.state.x;
    component.onKey(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(component.state.x).toBeCloseTo(x + 10);
    component.onKey(new KeyboardEvent('keydown', { key: '+' }));
    expect(component.state.scale).toBeGreaterThan(component.minScale);
  });

  it('saves exactly what the window shows: the profile photo is a 512x512 JPEG of the visible part', async () => {
    await setup({ file: await twoColourFile(400, 200) });
    // centred: the window shows pixels 100..300 of the picture -> red on the left, blue on the right
    let saved: File | undefined;
    spyOn(component.dialogRef, 'close').and.callFake((r?: any) => { saved = r; });
    component.save();
    await until(() => !!saved);

    expect(saved!.type).toBe('image/jpeg');
    expect(saved!.name).toBe('two.jpg');
    expect(await sizeOf(saved!)).toEqual([512, 512]);
    const left = await pixelOf(saved!, 60, 256);
    const right = await pixelOf(saved!, 450, 256);
    expect(left[0]).toBeGreaterThan(200); expect(left[2]).toBeLessThan(60);     // red
    expect(right[2]).toBeGreaterThan(200); expect(right[0]).toBeLessThan(60);   // blue
  });

  it('repositioning changes what is saved (drag to the far left: all red)', async () => {
    await setup({ file: await twoColourFile(400, 200) });
    component.onPointerDown(pointer(1, 0, 0));
    component.onPointerMove(pointer(1, 5000, 0));               // picture pulled right: window shows the left of the picture
    component.onPointerUp(pointer(1, 5000, 0));
    let saved: File | undefined;
    spyOn(component.dialogRef, 'close').and.callFake((r?: any) => { saved = r; });
    component.save();
    await until(() => !!saved);
    for (const x of [30, 256, 480]) {
      const p = await pixelOf(saved!, x, 256);
      expect(p[0]).toBeGreaterThan(200); expect(p[2]).toBeLessThan(60);
    }
  });

  it('zooming in saves a closer crop (centre stays at the red/blue border)', async () => {
    await setup({ file: await twoColourFile(400, 200) });
    component.onSlider(100);                                    // maximum zoom, around the centre
    let saved: File | undefined;
    spyOn(component.dialogRef, 'close').and.callFake((r?: any) => { saved = r; });
    component.save();
    await until(() => !!saved);
    const left = await pixelOf(saved!, 200, 256);
    const right = await pixelOf(saved!, 312, 256);
    expect(left[0]).toBeGreaterThan(200);                       // still red left of the middle ...
    expect(right[2]).toBeGreaterThan(200);                      // ... and blue right of it
  });

  it('the cover is saved as a 1500x500 JPEG', async () => {
    await setup({ file: await twoColourFile(1200, 800), shape: 'banner', title: 'Update cover photo' });
    let saved: File | undefined;
    spyOn(component.dialogRef, 'close').and.callFake((r?: any) => { saved = r; });
    component.save();
    await until(() => !!saved);
    expect(await sizeOf(saved!)).toEqual([1500, 500]);
  });

  it('warns when the picture is small', async () => {
    await setup({ file: await twoColourFile(120, 120) });
    expect(component.small).toBeTrue();
    expect(el().querySelector('.hint.warn')).not.toBeNull();
  });

  it('cancel closes without a picture', async () => {
    await setup({ file: await twoColourFile() });
    const close = spyOn(component.dialogRef, 'close');
    component.cancel();
    expect(close).toHaveBeenCalledWith(undefined);
  });

  it('a file that is not a picture shows a clear error and cannot be saved', async () => {
    const bad = new File(['this is not an image'], 'fake.png', { type: 'image/png' });
    await setup({ file: bad });
    expect(component.failed).toBeTrue();
    expect(el().querySelector('.error')!.textContent).toContain('could not be read');
    const save = Array.from(el().querySelectorAll('.actions button')).pop() as HTMLButtonElement;
    expect(save.disabled).toBeTrue();
  });

  it('releases the temporary picture URL when it closes', async () => {
    await setup({ file: await twoColourFile() });
    const revoke = spyOn(URL, 'revokeObjectURL').and.callThrough();
    const url = component.objectUrl;
    component.ngOnDestroy();
    expect(revoke).toHaveBeenCalledWith(url);
  });
});
