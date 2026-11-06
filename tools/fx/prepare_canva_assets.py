#!/usr/bin/env python3
"""
Chuyển hai ảnh PNG xuất từ Canva thành ảnh dùng trên web cho hiệu ứng mốc công đức.

  python3 -I tools/fx/prepare_canva_assets.py <halo.png> <devil.png>

  halo.png  : vòng hào quang vàng trên nền đen (Canva, trang "Hào quang công đức", 1264x1264)
              -> public/img/fx/halo.webp  (768x768, nền trong suốt: độ sáng thành độ đục)
  devil.png : mặt quỷ (Canva, trang "Quỷ 666", 1088x1456)
              -> public/img/devil.webp    (900x1204)

Cần Pillow (có WebP) và numpy. Chỉ là công cụ phát triển, không phải dependency của dự án.
"""
import os
import sys

import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))


def halo(src, dst, size=768):
    im = Image.open(src).convert('RGB').resize((size, size), Image.LANCZOS)
    rgb = np.asarray(im).astype(np.float32) / 255.0
    # Nền đen -> trong suốt: độ đục = kênh sáng nhất, rồi bỏ nhân trước (unpremultiply) để màu vàng giữ nguyên
    a = rgb.max(axis=2)
    a = np.clip((a - 0.02) / 0.98, 0, 1)                       # cắt nhiễu đen gần 0
    # Mờ dần về mép để tia sáng không bị cắt vuông khi xoay
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    r = np.hypot(xx - (size - 1) / 2, yy - (size - 1) / 2) / (size / 2)
    a *= np.clip((1.0 - r) / 0.12, 0, 1)
    col = np.where(a[..., None] > 1e-4, np.clip(rgb / np.maximum(a[..., None], 1e-4), 0, 1), 0)
    out = np.dstack([col, a])
    Image.fromarray((out * 255 + 0.5).astype(np.uint8), 'RGBA').save(dst, 'WEBP', quality=70, method=6, alpha_quality=70)


def devil(src, dst, width=900):
    im = Image.open(src).convert('RGB')
    h = round(im.height * width / im.width)
    im.resize((width, h), Image.LANCZOS).save(dst, 'WEBP', quality=80, method=6)


def main():
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(2)
    os.makedirs(os.path.join(ROOT, 'public', 'img', 'fx'), exist_ok=True)
    out_halo = os.path.join(ROOT, 'public', 'img', 'fx', 'halo.webp')
    out_devil = os.path.join(ROOT, 'public', 'img', 'devil.webp')
    halo(sys.argv[1], out_halo)
    devil(sys.argv[2], out_devil)
    for p in (out_halo, out_devil):
        with Image.open(p) as im:
            print(os.path.relpath(p, ROOT), im.size, im.mode, os.path.getsize(p) // 1024, 'KB')


if __name__ == '__main__':
    main()
