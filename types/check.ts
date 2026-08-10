/**
 * The declarations are hand-written, so something has to compile them or they
 * quietly stop describing the library. This uses every export, with the
 * options a real caller passes, and `tsc --noEmit` is the test.
 *
 * It is never bundled and never runs. If it compiles, the types hold together.
 */
import Mosh, {
  applyWounds,
  brightness,
  decode,
  encode,
  makeWound,
  mosh,
  scanStart,
  type MoshReport,
  type Wound,
} from '../index.js';

declare const canvas: HTMLCanvasElement;

async function once(): Promise<void> {
  const bytes: Uint8Array = await encode(canvas, 0.4);
  const scan: number = scanStart(bytes);
  const wounds: Wound[] = [makeWound(0.45, 0.95)];
  const landed: number = applyWounds(bytes, scan, wounds);
  const bitmap: ImageBitmap = await decode(bytes);
  bitmap.close();

  const ctx = canvas.getContext('2d');
  if (ctx) {
    const mean: number = brightness(ctx.getImageData(0, 0, 1, 1).data);
    void mean;
  }
  void landed;
}

/** The animated case: wounds held across frames, each frame judged against the last. */
async function animated(previous: number | null): Promise<number | null> {
  const report: MoshReport = await mosh(canvas, {
    quality: 0.42,
    wounds: [makeWound(0.45, 0.95)],
    from: 0.45,
    to: 0.95,
    keep: 26,
    steady: 11,
    previous,
    tries: 4,
  });
  if (!report.ok || !report.bitmap) {
    // Narrowing on `ok` alone must not be assumed: `bitmap` is nullable, and a
    // caller that forgets is exactly what these types exist to catch.
    const why: MoshReport['rejected'] = report.rejected;
    void why;
    return previous;
  }
  report.bitmap.close();
  void report.wounds;
  void report.bytes;
  void report.size;
  void report.scan;
  void report.landed;
  void report.tries;
  return report.brightness;
}

/** The default export, and the global the classic script sets, are the same shape. */
async function viaObject(): Promise<void> {
  await Mosh.mosh(canvas, { wounds: 2 });
  await globalThis.Mosh.mosh(canvas);
}

void once;
void animated;
void viaObject;
