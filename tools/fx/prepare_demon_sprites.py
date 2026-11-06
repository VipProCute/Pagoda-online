#!/usr/bin/env python3
"""
Tách nền 4 con quỷ đi theo người công đức âm (vẽ trên Canva, nền xám trơn) thành ảnh trong suốt.

  python3 -I tools/fx/prepare_demon_sprites.py <quy1.png> <quy2.png> <quy3.png> <quy4.png>

  Ảnh vào : PNG xuất từ thiết kế Canva "Hiệu ứng Chùa Tâm An — hào quang & quỷ", trang 4–7
            (Tiểu Quỷ, Ác Quỷ, Quỷ Vương, Ma Vương), nền xám đồng màu.
  Ảnh ra  : public/img/fx/demon-1.webp … demon-4.webp (nền trong suốt, cắt sát, cạnh dài nhất 512 px)
            và in ra tỉ lệ khung cùng vị trí mắt (0..1 theo khung đã cắt) để chép vào DEMON_ART trong public/js/hall.js.

Cách tách: màu nền lấy ở viền ảnh; vùng gần màu nền nối liền với mép ảnh là nền (loang từ mép vào,
nên chỗ sáng màu bên trong con quỷ không bị khoét); viền mềm theo khoảng cách màu tới nền, rồi bỏ
pha trộn màu nền khỏi viền (unpremultiply) để không còn quầng xám.
Cần Pillow (có WebP) và numpy. Chỉ là công cụ phát triển, không phải dependency của dự án.
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
MAX_SIDE = 512
# Vị trí mắt ước chừng (x, y theo ảnh gốc 0..1, bán kính vùng dò), công cụ tự tinh chỉnh theo điểm sáng nhất gần đó.
# Mắt thứ ba nằm sát hai mắt chính nên dò trong vùng nhỏ hơn kẻo bị kéo về phía mắt chính.
EYES_GUESS = {
    1: [(0.408, 0.358, 0.035), (0.587, 0.358, 0.035)],
    2: [(0.452, 0.442, 0.03), (0.547, 0.442, 0.03)],
    3: [(0.468, 0.362, 0.015), (0.532, 0.362, 0.015), (0.500, 0.335, 0.01)],
    4: [(0.444, 0.405, 0.03), (0.549, 0.405, 0.03), (0.498, 0.360, 0.015)],
}


def key_out(rgb):
    h, w, _ = rgb.shape
    band = np.concatenate([rgb[:3].reshape(-1, 3), rgb[-3:].reshape(-1, 3), rgb[:, :3].reshape(-1, 3), rgb[:, -3:].reshape(-1, 3)])
    bg = np.median(band, axis=0)
    d = np.sqrt(((rgb - bg) ** 2).sum(axis=2))
    # vùng gần màu nền nối liền mép ảnh (loang 4 hướng từ một viền đệm bao quanh)
    near = np.pad(np.where(d < 24, 255, 0).astype(np.uint8), 1, constant_values=255)
    im = Image.fromarray(near, 'L').copy()                   # .copy(): ảnh tạo từ mảng numpy là chỉ-đọc, floodfill sẽ không ghi được
    ImageDraw.floodfill(im, (0, 0), 128)
    region = (np.asarray(im)[1:-1, 1:-1] == 128)
    # lõi: cách vùng nền hơn 2 px thì đục hẳn; viền: mềm theo khoảng cách màu
    grown = np.asarray(Image.fromarray(np.where(region, 255, 0).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))) > 0
    soft = np.clip((d - 10.0) / 45.0, 0, 1)
    a = np.where(grown, soft, 1.0).astype(np.float32)
    fg = np.clip((rgb - (1 - a[..., None]) * bg) / np.maximum(a[..., None], 1e-3), 0, 255)
    return np.dstack([fg, a * 255]), bg


def refine_eye(rgb, gx, gy, r):
    h, w, _ = rgb.shape
    x0, x1 = max(0, int((gx - r) * w)), min(w, int((gx + r) * w))
    y0, y1 = max(0, int((gy - r) * h)), min(h, int((gy + r) * h))
    win = rgb[y0:y1, x0:x1]
    glow = np.clip(win[..., 0] * 0.5 + win[..., 1] * 0.8 - win[..., 2] * 0.9 - 150, 0, None) ** 2   # vàng cam sáng
    s = glow.sum()
    if s <= 0:
        return gx, gy
    ys, xs = np.mgrid[y0:y1, x0:x1]
    return float((xs * glow).sum() / s / w), float((ys * glow).sum() / s / h)


def process(n, src, dst):
    rgb = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
    h, w, _ = rgb.shape
    rgba, _ = key_out(rgb)
    eyes = [refine_eye(rgb, gx, gy, r) for gx, gy, r in EYES_GUESS[n]]
    alpha = rgba[..., 3]
    ys, xs = np.where(alpha > 8)
    pad = 6
    x0, x1 = max(0, xs.min() - pad), min(w, xs.max() + pad + 1)
    y0, y1 = max(0, ys.min() - pad), min(h, ys.max() + pad + 1)
    crop = Image.fromarray(rgba[y0:y1, x0:x1].round().astype(np.uint8), 'RGBA')
    k = MAX_SIDE / max(crop.size)
    if k < 1:
        crop = crop.resize((round(crop.width * k), round(crop.height * k)), Image.LANCZOS)
    crop.save(dst, 'WEBP', quality=82, method=6, alpha_quality=85)
    cw, ch = x1 - x0, y1 - y0
    eyes_c = [[round(float((ex * w - x0) / cw), 3), round(float((ey * h - y0) / ch), 3)] for ex, ey in eyes]
    return crop.size, round(float(cw / ch), 3), eyes_c


def main():
    if len(sys.argv) != 5:
        print(__doc__)
        sys.exit(2)
    out = os.path.join(ROOT, 'public', 'img', 'fx')
    os.makedirs(out, exist_ok=True)
    for n, src in enumerate(sys.argv[1:], 1):
        dst = os.path.join(out, 'demon-%d.webp' % n)
        size, ar, eyes = process(n, src, dst)
        print('%s %s %d KB  ar: %s  eyes: %s' % (os.path.relpath(dst, ROOT), size, os.path.getsize(dst) // 1024, ar, eyes))


if __name__ == '__main__':
    main()
