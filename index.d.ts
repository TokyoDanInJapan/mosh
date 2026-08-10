/**
 * Types for `mosh.js`.
 *
 * Hand-written, because the library is a classic script and a script cannot
 * carry its own types. They are checked the only way a hand-written
 * declaration can be: `npm run check:types` compiles them against a use of
 * every export.
 */

/** Anything that can be encoded. The demo passes a canvas. */
export type Source = HTMLCanvasElement | OffscreenCanvas;

/**
 * Where in the scan to strike, as a fraction of it, and the byte to leave
 * there.
 *
 * A fraction rather than an index, so the same wound can be applied to a later
 * encoding of a different picture.
 */
export interface Wound {
  at: number;
  value: number;
}

export interface MoshOptions {
  /**
   * What to re-encode at, 0 to 1. Low means coarse quantisation, which means
   * big flat blocks, which is what makes a displaced block legible as a block.
   * Default 0.4.
   */
  quality?: number;
  /**
   * How many bytes to damage, or an array of wounds to reuse - reused wounds
   * keep their positions and take fresh values on a retry. Default 2.
   */
  wounds?: number | Wound[];
  /**
   * The earliest a wound may land, as a fraction of the scan. Not the very
   * beginning: a wound there desyncs the decoder before it has drawn anything.
   * Default 0.45.
   */
  from?: number;
  /** And the latest. Default 0.95. */
  to?: number;
  /**
   * How far the result's mean brightness may stray from the source before the
   * throw is rejected, 0 to 255. 0 disables the check. Default 26.
   */
  keep?: number;
  /**
   * How far it may stray from `previous`. This is what makes a mosh safe to
   * animate at speed. 0 disables. Default 0.
   */
  steady?: number;
  /** The brightness of the last frame shown, for `steady`. */
  previous?: number | null;
  /** How many throws before giving up. Default 4. */
  tries?: number;
}

export interface MoshReport {
  /** Whether a throw was accepted. `bitmap` is null unless this is true. */
  ok: boolean;
  /** The damaged picture. The caller owns it, and should `close()` it. */
  bitmap: ImageBitmap | null;
  /** The bytes that were decoded, damage and all. */
  bytes: Uint8Array;
  /** Where the entropy-coded scan begins, or 0 if these were not a JPEG. */
  scan: number;
  /** The encoded size in bytes. */
  size: number;
  /** How many wounds actually landed. */
  landed: number;
  /** How many throws it took. */
  tries: number;
  /** The mean brightness of the accepted frame - pass it back as `previous`. */
  brightness: number;
  /** Why the last throw was turned down, or null if one was accepted. */
  rejected: 'decode' | 'keep' | 'steady' | 'no-scan' | null;
  /** The wounds as used, values and all, for reuse on the next frame. */
  wounds: Wound[];
}

/**
 * Where the entropy-coded scan begins: past every header segment, at the end
 * of the start-of-scan segment. 0 if the bytes are not a JPEG this understands.
 */
export declare function scanStart(bytes: Uint8Array): number;

/** A wound somewhere between `from` and `to`, as fractions of the scan. */
export declare function makeWound(from: number, to: number): Wound;

/** Write wounds into a JPEG's scan data, in place. Returns how many landed. */
export declare function applyWounds(bytes: Uint8Array, scan: number, wounds: Wound[]): number;

/** Encode a canvas as JPEG bytes. */
export declare function encode(canvas: Source, quality?: number): Promise<Uint8Array>;

/** Decode JPEG bytes. Rejects when the decoder gives up, which is normal here. */
export declare function decode(bytes: Uint8Array): Promise<ImageBitmap>;

/** Mean brightness, sampled every sixteenth pixel. Coarse on purpose. */
export declare function brightness(data: Uint8ClampedArray): number;

/** Mosh a canvas: encode it, wound it, decode it, and judge the result. */
export declare function mosh(canvas: Source, options?: MoshOptions): Promise<MoshReport>;

/** Everything above, as one object - what `mosh.js` sets on `globalThis`. */
export interface MoshApi {
  scanStart: typeof scanStart;
  makeWound: typeof makeWound;
  applyWounds: typeof applyWounds;
  encode: typeof encode;
  decode: typeof decode;
  brightness: typeof brightness;
  mosh: typeof mosh;
}

export declare const Mosh: MoshApi;
export default Mosh;

declare global {
  var Mosh: MoshApi;
}
