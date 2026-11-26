#!/usr/bin/env python3
"""
Turn a photo (a hand, an arm, an object on a plain background) into stipple art in
the Meridio style: black dots on an opaque paper-coloured cut-out, transparent outside.

    python3 scripts/stipple-photo.py IN.jpg OUT.webp [--width 900] [--fade left|right|bottom|none]
                                                     [--flip] [--rotate DEG] [--threshold 38]

- Background is removed by colour distance from the photo's border (shoot on a plain wall),
  or taken from the alpha channel if the input already has one.
- --fade dissolves the dots toward one edge, so a cut-off arm melts away instead of
  ending in a hard line.
- Deterministic (fixed seed).
"""
import argparse

import numpy as np
from PIL import Image, ImageFilter, ImageOps
from scipy import ndimage

PAPER = (248, 244, 236)
INK = (23, 21, 31)


def subject_mask(img: Image.Image, threshold: float) -> np.ndarray:
    if img.mode in ("RGBA", "LA") and np.asarray(img.getchannel("A")).min() < 250:
        return np.asarray(img.getchannel("A"), dtype=np.float32) / 255.0 > 0.5
    rgb = np.asarray(img.convert("RGB"), dtype=np.float32)
    border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    bg = np.median(border, axis=0)
    dist = np.sqrt(((rgb - bg) ** 2).sum(axis=2))
    m = dist > threshold
    m = ndimage.binary_opening(m, iterations=2)
    m = ndimage.binary_closing(m, iterations=4)
    m = ndimage.binary_fill_holes(m)
    lab, n = ndimage.label(m)
    if n > 1:  # keep the biggest piece and anything at least a quarter of its size
        sizes = ndimage.sum(m, lab, range(1, n + 1))
        keep = [i + 1 for i, s in enumerate(sizes) if s >= sizes.max() * 0.25]
        m = np.isin(lab, keep)
    return m


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("out")
    ap.add_argument("--width", type=int, default=900, help="output width in px")
    ap.add_argument("--fade", default="none", choices=["none", "left", "right", "bottom", "top"])
    ap.add_argument("--fade-size", type=float, default=0.22, help="fraction of the image the fade covers")
    ap.add_argument("--flip", action="store_true")
    ap.add_argument("--rotate", type=float, default=0.0)
    ap.add_argument("--threshold", type=float, default=38.0)
    ap.add_argument("--dot", type=float, default=1.0, help="dot radius in px")
    ap.add_argument("--density", type=float, default=1.0, help="overall dot density multiplier")
    a = ap.parse_args()

    img = ImageOps.exif_transpose(Image.open(a.src))
    if a.flip:
        img = ImageOps.mirror(img)
    if a.rotate:
        img = img.rotate(a.rotate, expand=True, resample=Image.BICUBIC, fillcolor=None)
    scale = a.width / img.width
    img = img.resize((a.width, round(img.height * scale)), Image.LANCZOS)

    mask = subject_mask(img, a.threshold)
    # trim to the subject, with a small margin
    ys, xs = np.nonzero(mask)
    pad = 6
    y0, y1 = max(ys.min() - pad, 0), min(ys.max() + pad, mask.shape[0] - 1)
    x0, x1 = max(xs.min() - pad, 0), min(xs.max() + pad, mask.shape[1] - 1)
    img = img.crop((x0, y0, x1 + 1, y1 + 1))
    mask = mask[y0 : y1 + 1, x0 : x1 + 1]
    h, w = mask.shape

    # tone: contrast-stretch the subject's own luminance, darker = more dots
    lum = np.asarray(img.convert("L").filter(ImageFilter.GaussianBlur(0.8)), dtype=np.float32) / 255.0
    inside = lum[mask]
    lo, hi = np.percentile(inside, 2), np.percentile(inside, 98)
    tone = np.clip((lum - lo) / max(hi - lo, 1e-3), 0, 1)
    dark = (1.0 - tone) ** 1.35

    # edges read as a fine dark rim, like a cut-out
    edge = mask & ~ndimage.binary_erosion(mask, iterations=2)
    dark = np.where(edge, np.maximum(dark, 0.75), dark)

    # optional dissolve toward one edge (both the dots and the paper base)
    fade = np.ones_like(dark)
    if a.fade != "none":
        size = a.fade_size
        if a.fade in ("left", "right"):
            t = np.linspace(0, 1, w)[None, :].repeat(h, 0)
            if a.fade == "right":
                t = 1 - t
        else:
            t = np.linspace(0, 1, h)[:, None].repeat(w, 1)
            if a.fade == "bottom":
                t = 1 - t
        fade = np.clip(t / size, 0, 1) ** 1.6

    rng = np.random.default_rng(29)
    upscale = 2  # render dots at 2x for crisp edges
    W2, H2 = w * upscale, h * upscale
    out = np.zeros((H2, W2, 4), dtype=np.uint8)

    # paper base under the dots, dissolving with the same fade (dithered so it breaks up)
    base = mask & (rng.uniform(0, 1, mask.shape) < fade * 1.25)
    base2 = np.kron(base, np.ones((upscale, upscale), dtype=bool))
    out[base2] = (*PAPER, 255)

    # dots: one candidate per pixel, kept with probability = darkness
    p = np.clip(dark * 0.55 * a.density, 0, 1) * mask * fade
    keep = rng.uniform(0, 1, p.shape) < p
    yy, xx = np.nonzero(keep)
    jx = rng.uniform(0, 1, yy.size)
    jy = rng.uniform(0, 1, yy.size)
    r = a.dot * upscale
    canvas = Image.fromarray(out, "RGBA")
    from PIL import ImageDraw

    d = ImageDraw.Draw(canvas)
    for y, x, ox, oy in zip(yy, xx, jx, jy):
        cx, cy = (x + ox) * upscale, (y + oy) * upscale
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(*INK, 255))

    canvas.save(a.out, quality=88, method=6) if a.out.endswith(".webp") else canvas.save(a.out)
    print(f"wrote {a.out}: {W2}x{H2}, {yy.size} dots")


if __name__ == "__main__":
    main()
