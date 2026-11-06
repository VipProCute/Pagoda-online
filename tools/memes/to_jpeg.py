"""Đọc PNG từ stdin, ghi JPEG ra stdout (dùng bởi render.mjs).

Cách dùng:  python3 to_jpeg.py [chất_lượng]    (mặc định 82)
Nén tối ưu (optimize) + progressive, chroma 4:2:0, nền đã phẳng nên không cần alpha.
"""
import io
import sys

from PIL import Image

quality = int(sys.argv[1]) if len(sys.argv) > 1 else 82
img = Image.open(io.BytesIO(sys.stdin.buffer.read())).convert("RGB")
out = io.BytesIO()
img.save(out, "JPEG", quality=quality, optimize=True, progressive=True, subsampling=2)
sys.stdout.buffer.write(out.getvalue())
