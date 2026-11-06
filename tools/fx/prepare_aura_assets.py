#!/usr/bin/env python3
"""
Chuyển ba hình hào quang cúng dường thiết kế trên Canva thành hình web (nền trong suốt) cho 9 cảnh giới.

  python3 -I tools/fx/prepare_aura_assets.py <lotus.png> <halo.png> <mandorla.png>

  lotus.png    : đài sen vàng trên nền đen (Canva, trang "Hào quang cúng dường — đài sen", 1600x800)
  halo.png     : vầng sáng viền cánh sen trên nền đen (trang "… — vầng sáng", 1264x1264)
  mandorla.png : quang bối hình lá đề tím đầy sao trên nền đen (trang "… — quang bối", 1088x1632)

Ra public/img/fx/aura/:
  lotus-gold.webp     đài sen vàng (Trúc Cơ → Hợp Thể)
  lotus-pink.webp     sen hồng nhạt, mép ánh vàng (Đại Thừa)
  lotus-rainbow.webp  sen pha lê trắng bạc ánh ngũ sắc (Độ Kiếp)
  halo-gold.webp      vầng sáng sau đầu (Kim Đan trở lên)
  mandorla-violet.webp  quang bối hư không (Luyện Hư, Hợp Thể)
  mandorla-gold.webp    quang bối kim quang (Đại Thừa, Độ Kiếp)

Nền đen thành trong suốt: độ đục = kênh sáng nhất, rồi bỏ nhân trước để màu giữ nguyên
(vẽ lên nền tối thì y như ảnh gốc). Cần Pillow (có WebP) và numpy; chỉ là công cụ phát triển.
"""
import os
import sys

import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'public', 'img', 'fx', 'aura')


def load(path):
    return np.asarray(Image.open(path).convert('RGB')).astype(np.float32) / 255.0


def crop(rgb, pad=6, thr=0.06):
    """Cắt sát phần có hình (bỏ nền đen thừa), chừa lề `pad` điểm ảnh."""
    m = rgb.max(axis=2) > thr
    ys, xs = np.where(m)
    y0, y1 = max(0, ys.min() - pad), min(rgb.shape[0], ys.max() + pad + 1)
    x0, x1 = max(0, xs.min() - pad), min(rgb.shape[1], xs.max() + pad + 1)
    return rgb[y0:y1, x0:x1]


def resize(rgb, width):
    h = round(rgb.shape[0] * width / rgb.shape[1])
    im = Image.fromarray((np.clip(rgb, 0, 1) * 255 + 0.5).astype(np.uint8), 'RGB').resize((width, h), Image.LANCZOS)
    return np.asarray(im).astype(np.float32) / 255.0


def rgb_to_hsv(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx, mn = rgb.max(-1), rgb.min(-1)
    d = mx - mn
    h = np.zeros_like(mx)
    nz = d > 1e-6
    rm, gm = nz & (mx == r), nz & (mx == g) & (mx != r)
    bm = nz & ~rm & ~gm
    h[rm] = ((g - b)[rm] / d[rm]) % 6
    h[gm] = (b - r)[gm] / d[gm] + 2
    h[bm] = (r - g)[bm] / d[bm] + 4
    s = np.where(mx > 1e-6, d / np.maximum(mx, 1e-6), 0)
    return np.stack([h / 6.0, s, mx], -1)


def hsv_to_rgb(hsv):
    h, s, v = hsv[..., 0] % 1.0, np.clip(hsv[..., 1], 0, 1), hsv[..., 2]
    i = np.floor(h * 6).astype(int) % 6
    f = h * 6 - np.floor(h * 6)
    p, q, t = v * (1 - s), v * (1 - s * f), v * (1 - s * (1 - f))
    out = np.zeros(h.shape + (3,), np.float32)
    for k, (a, b, c) in enumerate([(v, t, p), (q, v, p), (p, v, t), (p, q, v), (t, p, v), (v, p, q)]):
        m = i == k
        out[m] = np.stack([a[m], b[m], c[m]], -1)
    return out


def ramp(lum, stops):
    """Tô lại theo độ sáng: stops là [(vị trí 0..1, (r, g, b) 0..255), ...]."""
    xs = np.array([s[0] for s in stops], np.float32)
    cs = np.array([s[1] for s in stops], np.float32) / 255.0
    return np.stack([np.interp(lum, xs, cs[:, k]) for k in range(3)], -1)


def pink(rgb):
    """Sen hồng: xoay sắc vàng sang hồng sen nhạt, chỗ sáng ngả trắng, mép sáng nhất còn ánh vàng."""
    hsv = rgb_to_hsv(rgb)
    keep = np.clip((hsv[..., 2] - 0.86) / 0.14, 0, 1)[..., None]       # mép cánh sáng nhất giữ vàng
    sh = hsv.copy()
    sh[..., 0] = (sh[..., 0] - 0.145) % 1.0                             # ~42° → ~350° (hồng sen)
    sh[..., 1] = sh[..., 1] * (0.78 - 0.35 * np.clip(hsv[..., 2] - 0.5, 0, 0.5) * 2)   # sáng thì nhạt dần sang trắng
    return hsv_to_rgb(sh) * (1 - keep * 0.45) + rgb * keep * 0.45


def rainbow(rgb):
    """Sen pha lê ngũ sắc: thân trắng bạc, ánh năm màu nhẹ đổi dần theo chiều ngang."""
    hsv = rgb_to_hsv(rgb)
    x = np.linspace(0, 1, rgb.shape[1], dtype=np.float32)[None, :]
    hsv[..., 0] = (x * 0.8) % 1.0                                       # đỏ → vàng → lục → lam → tím
    hsv[..., 1] = 0.16 + 0.3 * (1 - hsv[..., 2])                        # chỗ tối đậm màu hơn, chỗ sáng gần trắng
    hsv[..., 2] = np.clip(hsv[..., 2] * 1.08, 0, 1)
    return hsv_to_rgb(hsv)


def gold(rgb):
    """Quang bối kim quang: tô lại theo độ sáng bằng dải màu vàng kim."""
    lum = rgb.max(-1)
    return ramp(lum, [(0, (0, 0, 0)), (0.22, (110, 44, 0)), (0.5, (240, 150, 30)), (0.78, (255, 214, 120)), (1, (255, 250, 228))])


def save(rgb, name, solid=1.0, edge=4):
    """Lưu WebP nền trong suốt. solid > 1 làm hình đặc hơn (đài sen), ánh sáng mờ vẫn mờ."""
    a = np.clip((rgb.max(-1) - 0.02) / 0.98, 0, 1)
    if solid != 1.0:
        a = 1 - (1 - a) ** solid
    h, w = a.shape                                                        # mờ dần ở mép để không lộ cạnh cắt
    yy, xx = np.mgrid[0:h, 0:w]
    a *= np.clip(np.minimum.reduce([xx, yy, w - 1 - xx, h - 1 - yy]) / edge, 0, 1)
    col = np.where(a[..., None] > 1e-4, np.clip(rgb / np.maximum(a[..., None], 1e-4), 0, 1), 0)
    path = os.path.join(OUT, name)
    Image.fromarray((np.dstack([col, a]) * 255 + 0.5).astype(np.uint8), 'RGBA').save(path, 'WEBP', quality=82, method=6, alpha_quality=85)
    with Image.open(path) as im:
        print(os.path.relpath(path, ROOT), im.size, os.path.getsize(path) // 1024, 'KB')


def main():
    if len(sys.argv) != 4:
        print(__doc__)
        sys.exit(2)
    os.makedirs(OUT, exist_ok=True)
    lotus = resize(crop(load(sys.argv[1])), 360)
    save(lotus, 'lotus-gold.webp', solid=1.8)
    save(pink(lotus), 'lotus-pink.webp', solid=1.8)
    save(rainbow(lotus), 'lotus-rainbow.webp', solid=1.8)
    save(resize(crop(load(sys.argv[2]), pad=10), 300), 'halo-gold.webp')
    mand = resize(crop(load(sys.argv[3])), 240)
    save(mand, 'mandorla-violet.webp')
    save(gold(mand), 'mandorla-gold.webp')


if __name__ == '__main__':
    main()
