/**
 * mosh.js - datamosh an image by damaging real JPEG scan data.
 *
 * Nothing in here draws an effect. The torn rows, the blocks displaced
 * sideways and the colour smeared off to the right edge are all what a JPEG
 * decoder does when the bit stream stops saying what it thinks it says. The
 * whole library is: encode the picture, break a few bytes of it, and ask the
 * browser to decode the result.
 *
 * Two properties of the format do all of the work, and neither can be
 * imitated by drawing blocks by hand:
 *
 *   - **The entropy-coded data is a bit stream, not an array of blocks.**
 *     Damage a byte and the Huffman decoder loses its place. Every later
 *     block is read at the wrong bit offset, so the rest of the row - often
 *     the rest of the image - arrives shifted, torn, or as noise.
 *   - **DC coefficients are stored as differences.** Each block's brightness
 *     is a difference from the block before it, so one wrong DC value passes
 *     to every block downstream. That inheritance is the long horizontal
 *     smear, and it is why the damage runs to the edge instead of staying
 *     where it started.
 *
 * This is a classic script rather than a module on purpose: a module cannot
 * be loaded over `file://`, and being able to open the demo by
 * double-clicking it is worth more than the syntax.
 *
 * No dependencies. Browser only - it needs the platform's own JPEG encoder
 * and decoder, which is rather the point.
 */
(function (global) {
  'use strict';

  /** JPEG markers that stand alone, carrying no length word after them. */
  const STANDALONE = new Set([0xd8, 0x01, 0xd0, 0xd1, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7]);

  /**
   * Where the entropy-coded scan begins: past every header segment, at the
   * end of the start-of-scan segment.
   *
   * The markers are walked rather than searched for. Hunting for the `FF DA`
   * pair looks equivalent and is not - those two bytes occur inside
   * quantisation tables and Huffman tables by coincidence often enough to
   * matter, and a false hit puts the damage in the tables, where it does not
   * produce a glitched picture but no picture at all. The walk cannot be
   * fooled, because it only ever looks where a marker must be.
   *
   * Returns 0 if the bytes are not a JPEG this understands.
   */
  function scanStart(bytes) {
    if (!bytes || bytes.length < 4) return 0;
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return 0;
    let i = 2;
    while (i < bytes.length - 3) {
      if (bytes[i] !== 0xff) return 0;
      const marker = bytes[i + 1];
      if (STANDALONE.has(marker)) {
        i += 2;
        continue;
      }
      const length = (bytes[i + 2] << 8) | bytes[i + 3];
      if (length < 2) return 0;
      if (marker === 0xda) return i + 2 + length;
      i += 2 + length;
    }
    return 0;
  }

  /**
   * A wound: where in the scan to strike, as a fraction of it, and the byte
   * to leave there.
   *
   * A fraction rather than an index so the same wound can be applied to a
   * later encoding of a *different* picture - which is what lets an animated
   * mosh keep its damage in one place while the image underneath it moves.
   * Re-rolled wounds make the tear leap somewhere new on every frame.
   */
  function makeWound(from, to) {
    let value = Math.floor(Math.random() * 256);
    // Never 0xFF: it starts a marker. See applyWounds.
    if (value === 0xff) value = 0xfe;
    return { at: from + Math.random() * Math.max(0, to - from), value };
  }

  /**
   * Write wounds into a JPEG's scan data, in place.
   *
   * **What must never be damaged**, or there is no picture at all rather than
   * a broken one:
   *
   *   - Anything before the scan. The tables and the frame header say how to
   *     read what follows. Damage there loses the file outright.
   *   - Any `0xFF` byte, and any byte directly after one. `0xFF` begins a
   *     marker, and inside the scan it is followed by a stuffed `0x00`.
   *     Writing over either can invent an end-of-image and truncate the
   *     picture, or destroy a restart marker.
   *   - The replacement may not be `0xFF`, for the same reason.
   *
   * A wound that lands on a byte it may not have walks forward until it finds
   * one it may, rather than being dropped - dropping them quietly means fewer
   * wounds than asked for, which is the sort of thing that has you wondering
   * why the dial does nothing.
   *
   * Returns how many wounds actually landed.
   */
  function applyWounds(bytes, scan, wounds) {
    const end = bytes.length - 2;
    if (!(end > scan)) return 0;
    let landed = 0;
    for (const wound of wounds) {
      let at = scan + Math.floor(wound.at * (end - scan));
      for (let step = 0; step < 32 && at < end; step++, at++) {
        if (bytes[at] === 0xff) continue;
        if (at > 0 && bytes[at - 1] === 0xff) continue;
        bytes[at] = wound.value;
        landed++;
        break;
      }
    }
    return landed;
  }

  /** Encode a canvas as JPEG bytes. */
  function encode(canvas, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('the canvas would not encode'));
            return;
          }
          blob.arrayBuffer().then((buffer) => resolve(new Uint8Array(buffer)), reject);
        },
        'image/jpeg',
        quality
      );
    });
  }

  /** Decode JPEG bytes. Rejects when the decoder gives up, which is normal here. */
  function decode(bytes) {
    return createImageBitmap(new Blob([bytes], { type: 'image/jpeg' }));
  }

  /** Mean brightness, sampled every sixteenth pixel. Coarse on purpose. */
  function brightness(data) {
    let sum = 0;
    let n = 0;
    for (let i = 0; i < data.length; i += 64) {
      sum += data[i];
      n++;
    }
    return n ? sum / n : 0;
  }

  let scratch = null;
  let scratchCtx = null;

  function scratchFor(width, height) {
    if (!scratch) {
      scratch = document.createElement('canvas');
      scratchCtx = scratch.getContext('2d', { willReadFrequently: true });
    }
    if (scratch.width !== width || scratch.height !== height) {
      scratch.width = width;
      scratch.height = height;
    }
    return scratchCtx;
  }

  /**
   * Mosh a canvas: encode it, wound it, decode it, and judge the result.
   *
   * Options, all optional:
   *
   *   quality  0..1     what to re-encode at. Low means coarse quantisation,
   *                     which means big flat blocks, which is what makes a
   *                     displaced block legible as a block. Default 0.4.
   *   wounds   number   how many bytes to damage, or an array of wounds from
   *                     `makeWound` to reuse. Default 2.
   *   from,to  0..1     the stretch of the scan a wound may land in. Not from
   *                     the very beginning: a wound in the first bytes
   *                     desyncs the decoder before it has drawn anything, so
   *                     the whole frame is hash rather than a picture with a
   *                     tear in it. Defaults 0.45 and 0.95.
   *   keep     number   how far the result's mean brightness may stray from
   *                     the source before the throw is rejected, 0..255.
   *                     Whether a wound crushes the frame to black, blows it
   *                     out to white or leaves a readable tear is pure luck of
   *                     which byte it hit, so a bad throw is simply thrown
   *                     again. 0 disables the check. Default 26.
   *   steady   number   how far it may stray from `previous`, for animation.
   *                     This is what makes a mosh safe to animate at speed -
   *                     see the README. 0 disables. Default 0.
   *   previous number   the brightness of the last frame shown, for `steady`.
   *   tries    number   how many throws before giving up. Default 4.
   *
   * Resolves to a report rather than just a picture, because half the point
   * of a demo is being able to see what happened:
   *
   *   { ok, bitmap, bytes, scan, size, landed, tries, brightness, rejected,
   *     wounds }
   */
  async function mosh(canvas, options) {
    const opts = options || {};
    const quality = opts.quality == null ? 0.4 : opts.quality;
    const from = opts.from == null ? 0.45 : opts.from;
    const to = opts.to == null ? 0.95 : opts.to;
    const keep = opts.keep == null ? 26 : opts.keep;
    const steady = opts.steady == null ? 0 : opts.steady;
    const tries = opts.tries == null ? 4 : opts.tries;
    const width = canvas.width;
    const height = canvas.height;

    const clean = await encode(canvas, quality);
    const scan = scanStart(clean);
    const report = {
      ok: false,
      bitmap: null,
      bytes: clean,
      scan,
      size: clean.length,
      landed: 0,
      tries: 0,
      brightness: 0,
      rejected: null,
      wounds: [],
    };
    if (!scan) {
      report.rejected = 'no-scan';
      return report;
    }

    const ctx = scratchFor(width, height);
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(canvas, 0, 0);
    const before = brightness(ctx.getImageData(0, 0, width, height).data);

    const reuse = Array.isArray(opts.wounds) ? opts.wounds : null;
    const count = reuse ? reuse.length : opts.wounds == null ? 2 : opts.wounds;

    for (let attempt = 0; attempt < Math.max(1, tries); attempt++) {
      report.tries = attempt + 1;
      const wounds = reuse
        ? // Reused wounds keep their positions and take fresh values on a
          // retry, so a rejected throw changes the damage without moving it.
          reuse.map((w) => (attempt === 0 ? w : { at: w.at, value: makeWound(0, 0).value }))
        : Array.from({ length: count }, () => makeWound(from, to));

      const bytes = clean.slice();
      report.landed = applyWounds(bytes, scan, wounds);

      let bitmap;
      try {
        bitmap = await decode(bytes);
      } catch (_) {
        report.rejected = 'decode';
        continue;
      }

      // Measured on the scratch rather than anywhere visible, so a rejected
      // throw is never seen.
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(bitmap, 0, 0, width, height);
      const after = brightness(ctx.getImageData(0, 0, width, height).data);

      if (keep && Math.abs(after - before) > keep) {
        bitmap.close();
        report.rejected = 'keep';
        continue;
      }
      if (steady && opts.previous != null && Math.abs(after - opts.previous) > steady) {
        bitmap.close();
        report.rejected = 'steady';
        continue;
      }

      report.ok = true;
      report.bitmap = bitmap;
      report.bytes = bytes;
      report.brightness = after;
      report.rejected = null;
      report.wounds = wounds;
      return report;
    }
    return report;
  }

  global.Mosh = {
    scanStart,
    makeWound,
    applyWounds,
    encode,
    decode,
    brightness,
    mosh,
  };
})(window);
