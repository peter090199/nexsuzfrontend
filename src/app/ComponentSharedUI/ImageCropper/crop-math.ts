/**
 * Geometry for the photo cropper. Pure functions: no DOM, so they are easy to test.
 *
 *  box   = the visible crop window in CSS pixels
 *  state = where the picture sits inside it:
 *          scale = displayed pixels per image pixel
 *          x, y  = position of the picture's top-left corner relative to the window
 *
 * The picture must always COVER the window (no empty edges), which is what clamp() enforces.
 */
export interface CropBox { width: number; height: number; }
export interface CropState { scale: number; x: number; y: number; }
export interface SourceRect { sx: number; sy: number; sw: number; sh: number; }

/** The smallest scale at which the picture still covers the whole window. */
export function coverScale(imgW: number, imgH: number, box: CropBox): number {
  return Math.max(box.width / imgW, box.height / imgH);
}

/** Keep the picture covering the window. */
export function clamp(state: CropState, imgW: number, imgH: number, box: CropBox): CropState {
  const w = imgW * state.scale;
  const h = imgH * state.scale;
  return {
    scale: state.scale,
    x: Math.min(0, Math.max(box.width - w, state.x)),
    y: Math.min(0, Math.max(box.height - h, state.y)),
  };
}

/** Start state: covering the window, centred. */
export function initialState(imgW: number, imgH: number, box: CropBox): CropState {
  const scale = coverScale(imgW, imgH, box);
  return clamp({ scale, x: (box.width - imgW * scale) / 2, y: (box.height - imgH * scale) / 2 }, imgW, imgH, box);
}

/** Change the scale while the point under `focus` (window coordinates; default: the centre) stays where it is. */
export function zoomTo(
  state: CropState, newScale: number, imgW: number, imgH: number, box: CropBox,
  minScale: number, maxScale: number, focus: { x: number; y: number } = { x: box.width / 2, y: box.height / 2 }
): CropState {
  const scale = Math.min(maxScale, Math.max(minScale, newScale));
  const px = (focus.x - state.x) / state.scale;      // the picture point under the focus
  const py = (focus.y - state.y) / state.scale;
  return clamp({ scale, x: focus.x - px * scale, y: focus.y - py * scale }, imgW, imgH, box);
}

/** Move the picture by a drag / key press. */
export function moveBy(state: CropState, dx: number, dy: number, imgW: number, imgH: number, box: CropBox): CropState {
  return clamp({ ...state, x: state.x + dx, y: state.y + dy }, imgW, imgH, box);
}

/** The part of the ORIGINAL picture (in its own pixels) that the window currently shows. */
export function sourceRect(state: CropState, imgW: number, imgH: number, box: CropBox): SourceRect {
  const sw = box.width / state.scale;
  const sh = box.height / state.scale;
  return {
    sx: Math.min(Math.max(0, -state.x / state.scale), Math.max(0, imgW - sw)),
    sy: Math.min(Math.max(0, -state.y / state.scale), Math.max(0, imgH - sh)),
    sw: Math.min(sw, imgW),
    sh: Math.min(sh, imgH),
  };
}

/** Slider position 0..100 <-> scale between min and max (exponential, so zooming feels even). */
export function scaleFromSlider(value: number, minScale: number, maxScale: number): number {
  return minScale * Math.pow(maxScale / minScale, Math.min(100, Math.max(0, value)) / 100);
}

export function sliderFromScale(scale: number, minScale: number, maxScale: number): number {
  if (maxScale <= minScale) { return 0; }
  return (Math.log(scale / minScale) / Math.log(maxScale / minScale)) * 100;
}
