#!/usr/bin/env python3
"""
Generates public/art/hands.svg: two stippled hands passing a share across the
Meridio hero. Original artwork: a small 3D hand (tapered bones, smooth-blended into
a palm) is ray-marched and lit in numpy, then the lit image is stippled into dots.
No photo is traced.

    python3 scripts/make-hands.py            # writes public/art/hands.svg
    python3 scripts/make-hands.py --preview  # also writes /tmp/hands-preview.png and /tmp/hand-tone.png

Deterministic (fixed seed).
"""
import math
import subprocess
import sys
from pathlib import Path

import numpy as np
from skimage import measure

W, H = 1200, 760  # artwork box
EXTRA = 1300  # room either side so sleeves run off wide screens
INK = "#17151f"
SKIN_BASE = "#f8f4ec"
rng = np.random.default_rng(29)

# ------------------------------------------------------------------ the 3D hand
# Units are millimetres. x runs wrist -> fingertips, y is down, z is toward the viewer.
# Pose: a pinch seen from the thumb side, index curling over to meet the thumb,
# the other three fingers loosely curled behind.

PALM = [  # (a, b, r_a, r_b): metacarpals and palm volume
    ((4, -6, 18), (84, -11, 21), 17, 13.5),
    ((4, -3, 4), (88, -3, 3), 17, 14),
    ((4, 1, -10), (82, 5, -14), 16, 13),
    ((4, 5, -20), (73, 12, -28), 15, 12),
    ((12, 8, 4), (66, 12, -2), 22, 20),  # palm pad
    ((10, 10, 18), (50, 24, 26), 21, 15),  # thenar: the fleshy base of the thumb
    ((-60, 2, -2), (2, 0, 0), 30, 26),  # forearm to wrist
]

FINGERS = {
    # joint chains with radii: MCP -> PIP -> DIP -> tip
    "index": ([(84, -11, 21), (118, -22, 24), (138, -14, 26), (146, 2, 26)], [12.5, 11.2, 10, 8.8]),
    "middle": ([(88, -3, 3), (118, 8, 4), (120, 28, 3), (106, 36, 2)], [12.6, 11.4, 10.3, 9.2]),
    "ring": ([(82, 5, -14), (108, 16, -16), (108, 34, -16), (96, 40, -15)], [12, 10.8, 9.8, 8.8]),
    "little": ([(73, 12, -28), (93, 21, -31), (92, 34, -31), (83, 38, -30)], [10.4, 9.4, 8.6, 7.8]),
    # thumb: CMC -> MCP -> IP -> tip
    "thumb": ([(18, 12, 24), (54, 28, 32), (90, 26, 31), (136, 11, 28)], [17, 14, 12, 10.2]),
}


def round_cone(p, a, b, r1, r2):
    """Exact SDF of a cone with rounded ends (Inigo Quilez), vectorised over points p (N,3)."""
    a = np.asarray(a, np.float32)
    b = np.asarray(b, np.float32)
    ba = b - a
    l2 = float(ba @ ba)
    rr = r1 - r2
    a2 = l2 - rr * rr
    il2 = 1.0 / l2
    pa = p - a
    y = pa @ ba
    z = y - l2
    v = pa * l2 - np.outer(y, ba)
    x2 = (v * v).sum(1)
    y2 = y * y * l2
    z2 = z * z * l2
    k = math.copysign(1, rr) * rr * rr * x2
    d_end = np.sqrt(x2 + z2) * il2 - r2
    d_start = np.sqrt(x2 + y2) * il2 - r1
    d_mid = (np.sqrt(np.maximum(x2 * a2 * il2, 0)) + y * rr) * il2 - r1
    return np.where(np.sign(z) * a2 * z2 > k, d_end, np.where(np.sign(y) * a2 * y2 < k, d_start, d_mid))


def smin(a, b, k):
    h = np.maximum(k - np.abs(a - b), 0) / k
    return np.minimum(a, b) - h * h * k * 0.25


def hand_sdf(p):
    p = np.asarray(p, np.float32)
    palm = None
    for a, b, r1, r2 in PALM:
        d = round_cone(p, a, b, r1, r2)
        palm = d if palm is None else smin(palm, d, 12)
    out = None
    for name, (joints, radii) in FINGERS.items():
        f = None
        for i in range(len(joints) - 1):
            d = round_cone(p, joints[i], joints[i + 1], radii[i], radii[i + 1])
            f = d if f is None else smin(f, d, 2.5)
        # each finger blends into the palm, but fingers never melt into each other
        joined = smin(palm, f, 9 if name == "thumb" else 6)
        out = joined if out is None else np.minimum(out, joined)
    return out


def render(x0=-48, x1=170, y0=-52, y1=66, mm_per_px=0.25, tilt_deg=16):
    """Orthographic ray-march along -z. Returns tone image (0 dark..1 light) and mask."""
    xs = np.arange(x0, x1, mm_per_px, dtype=np.float32)
    ys = np.arange(y0, y1, mm_per_px, dtype=np.float32)
    gx, gy = np.meshgrid(xs, ys)
    n = gx.size
    t = math.radians(tilt_deg)  # tilt the hand toward the viewer (about the x axis)
    ct, st = math.cos(t), math.sin(t)

    def to_model(q):  # world -> model
        y, z = q[:, 1], q[:, 2]
        return np.stack([q[:, 0], y * ct + z * st, -y * st + z * ct], 1)

    origin = np.stack([gx.ravel(), gy.ravel(), np.full(n, 90, np.float32)], 1)
    depth = np.zeros(n, np.float32)
    hit = np.zeros(n, bool)
    active = np.arange(n)
    for _ in range(90):
        if active.size == 0:
            break
        q = origin[active].copy()
        q[:, 2] -= depth[active]
        d = hand_sdf(to_model(q))
        depth[active] += d
        done = d < 0.05
        hit[active[done]] = True
        gone = depth[active] > 200
        active = active[~(done | gone)]
    pos = origin.copy()
    pos[:, 2] -= depth
    idx = np.nonzero(hit)[0]
    P = to_model(pos[idx])
    e = np.float32(0.15)
    ex, ey, ez = (np.array(v, np.float32) * e for v in ((1, 0, 0), (0, 1, 0), (0, 0, 1)))
    nrm = np.stack(
        [hand_sdf(P + ex) - hand_sdf(P - ex), hand_sdf(P + ey) - hand_sdf(P - ey), hand_sdf(P + ez) - hand_sdf(P - ez)], 1
    )
    nrm /= np.linalg.norm(nrm, axis=1, keepdims=True) + 1e-9
    # ambient occlusion: enclosed surface (finger creases) goes dark
    ao = np.zeros(idx.size, np.float32)
    for i, h in enumerate([1.5, 3.5, 6.5, 10.0]):
        ao += (h - hand_sdf(P + nrm * h)) / (2**i)
    ao = np.clip(1 - 0.09 * ao, 0, 1)
    nw = np.stack([nrm[:, 0], nrm[:, 1] * ct - nrm[:, 2] * st, nrm[:, 1] * st + nrm[:, 2] * ct], 1)
    L = np.array([-0.45, -0.75, 0.5], np.float32)
    L /= np.linalg.norm(L)
    diffuse = np.clip(nw @ L, 0, 1)
    facing = np.clip(nw[:, 2], 0, 1)  # silhouette rim goes dark
    tone = (0.12 + 0.88 * diffuse) * ao * (0.55 + 0.45 * facing**0.5)
    tone = np.clip(tone * 1.15, 0, 1)
    img = np.ones(n, np.float32)
    img[idx] = tone
    mask = np.zeros(n, bool)
    mask[idx] = True
    return img.reshape(gx.shape), mask.reshape(gx.shape), (x0, y0, mm_per_px)


# ------------------------------------------------------------------ placement
PX_PER_MM = 2.1  # artwork pixels per millimetre
CUFF_MM = -46  # skin stops here; the cuff covers the rest


def xf(points, origin, angle_deg, mirror=False):
    """Local hand frame (artwork px, hand points along +x) to artwork coordinates."""
    a = math.radians(angle_deg)
    ca, sa = math.cos(a), math.sin(a)
    out = []
    for x, y in points:
        if mirror:
            y = -y
        out.append((origin[0] + x * ca - y * sa, origin[1] + x * sa + y * ca))
    return out


def stipple(tone, mask, frame, origin, angle, mirror):
    x0, y0, mm = frame
    s = mm * PX_PER_MM  # artwork px per render px
    from scipy import ndimage

    dark = np.clip((1.0 - tone - 0.06) / 0.8, 0, 1) ** 1.5
    rim = mask & ~ndimage.binary_erosion(mask, iterations=3)  # crisp cut-out outline
    dark = np.where(rim, np.maximum(dark, 0.85), dark)
    p_art = np.clip(0.015 + 0.95 * dark, 0, 1)  # dots per artwork px^2
    p = p_art * s * s * mask
    keep = rng.uniform(0, 1, p.shape) < p
    yy, xx = np.nonzero(keep)
    lx = (x0 + (xx + rng.uniform(0, 1, xx.size)) * mm) * PX_PER_MM
    ly = (y0 + (yy + rng.uniform(0, 1, yy.size)) * mm) * PX_PER_MM
    pts = xf(list(zip(lx, ly)), origin, angle, mirror)
    polys = []  # silhouette for the opaque paper base
    for c in measure.find_contours(mask.astype(np.float32), 0.5):
        if len(c) < 40:
            continue
        loc = [((x0 + cx * mm) * PX_PER_MM, (y0 + cy * mm) * PX_PER_MM) for cy, cx in c[::2]]
        polys.append(xf(loc, origin, angle, mirror))
    return pts, polys


tone, mask, frame = render()
x0, y0, mm = frame
cols = x0 + np.arange(mask.shape[1]) * mm
mask[:, cols < CUFF_MM] = False  # skin ends at the cuff line

L_ORIGIN, L_ANGLE = (176, 206), 24
R_ORIGIN, R_ANGLE = (1052, 560), 188
pts_l, base_l = stipple(tone, mask, frame, L_ORIGIN, L_ANGLE, False)
pts_r, base_r = stipple(tone, mask, frame, R_ORIGIN, R_ANGLE, True)

c = CUFF_MM * PX_PER_MM  # cuff line in local px
cuff_l = xf([(c - 110, -76), (c + 4, -70), (c + 4, 70), (c - 110, 76)], L_ORIGIN, L_ANGLE)
sleeve_l = xf([(-1700, -170), (c - 108, -84), (c - 108, 84), (-1700, 190)], L_ORIGIN, L_ANGLE)
sleeve_r = xf([(-1700, -130), (c + 4, -72), (c + 4, 72), (-1700, 150)], R_ORIGIN, R_ANGLE, mirror=True)


def pstr(poly):
    return " ".join(f"{x:.1f},{y:.1f}" for x, y in poly)


def dots(pts):
    return "".join(f"M{x:.1f} {y:.1f}h0" for x, y in pts)


def cuff_dots(poly):
    """Light stipple shading toward the lower edge of the cuff."""
    (ax, ay), (bx, by), (cx, cy), (dx, dy) = poly
    out = []
    for _ in range(900):
        u, v = rng.uniform(0, 1), rng.uniform(0, 1) ** 0.45
        top = (ax + (bx - ax) * u, ay + (by - ay) * u)
        bot = (dx + (cx - dx) * u, dy + (cy - dy) * u)
        out.append((top[0] + (bot[0] - top[0]) * v, top[1] + (bot[1] - top[1]) * v))
    return out


def folds(sleeve, count, seed):
    r = np.random.default_rng(seed)
    (ax, ay), (bx, by), (cx, cy), (dx, dy) = sleeve
    lines = []
    for i in range(count):
        t = (i + 1) / (count + 1)
        s = r.uniform(0.80, 0.93)
        p0 = (bx + (cx - bx) * t, by + (cy - by) * t)
        p1 = (ax + (dx - ax) * t, ay + (dy - ay) * t)
        q = (p0[0] + (p1[0] - p0[0]) * (1 - s), p0[1] + (p1[1] - p0[1]) * (1 - s))
        lines.append(f"M{p0[0]:.1f} {p0[1]:.1f}L{q[0]:.1f} {q[1]:.1f}")
    return " ".join(lines)


svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="{-EXTRA} 0 {W + 2 * EXTRA} {H}" width="{W + 2 * EXTRA}" height="{H}">
  <title>Two stippled hands passing a share</title>
  <defs>
    <pattern id="weave" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="5" height="5" fill="#1c1a26"/>
      <rect width="2" height="5" fill="#2a2836"/>
    </pattern>
  </defs>
  <polygon points="{pstr(sleeve_l)}" fill="url(#weave)"/>
  <polygon points="{pstr(sleeve_r)}" fill="#f7f4ee" stroke="{INK}" stroke-opacity=".28" stroke-width="1.2"/>
  <path d="{folds(sleeve_r, 4, 7)}" stroke="{INK}" stroke-opacity=".2" stroke-width="1.3" fill="none" stroke-linecap="round"/>
  <g fill="{SKIN_BASE}">{"".join(f'<polygon points="{pstr(p)}"/>' for p in base_l + base_r)}</g>
  <path d="{dots(pts_l + pts_r)}" stroke="{INK}" stroke-width="1.45" stroke-linecap="round" fill="none"/>
  <polygon points="{pstr(cuff_l)}" fill="#f7f4ee" stroke="{INK}" stroke-opacity=".35" stroke-width="1.2"/>
  <path d="{dots(cuff_dots(cuff_l))}" stroke="{INK}" stroke-width="1.4" stroke-linecap="round" fill="none" opacity=".6"/>
</svg>
"""

out = Path(__file__).resolve().parent.parent / "public" / "art" / "hands.svg"
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(svg)
print(f"wrote {out} ({out.stat().st_size // 1024} KB, {len(pts_l) + len(pts_r)} dots)")

if "--preview" in sys.argv:
    from PIL import Image

    Image.fromarray((tone * 255).astype(np.uint8)).save("/tmp/hand-tone.png")
    subprocess.run(["rsvg-convert", "-b", "#f5f0e7", "-w", "3800", str(out), "-o", "/tmp/hands-wide.png"], check=True)
    Image.open("/tmp/hands-wide.png").crop((EXTRA, 0, EXTRA + W, H)).save("/tmp/hands-preview.png")
    print("preview at /tmp/hands-preview.png, tone at /tmp/hand-tone.png")
