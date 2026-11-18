"""Chùa Tâm An · chụp ảnh 2D (sprite) cho NPC từ chính mô hình 3D đã dựng.

Bản 2D và bản 3D cùng một hình: không vẽ tay. Mô hình đầu vào là tệp do build.py xuất ra
(public/models/npc/<tên>.glb); ảnh ra nền trong suốt, nhìn chính diện, hơi từ trên xuống.

Chạy không giao diện (Blender 5.x, cần OpenGL; máy không có GPU thì cài Mesa và đặt EGL_PLATFORM=surfaceless):
    blender -b --factory-startup -P tools/blender/npc/sprite.py -- <tên NPC> [cao px]
Đầu ra (KHÔNG sửa tay, sửa script rồi chạy lại): public/img/npc/<tên>.webp
hall.js vẽ ảnh này vào khung 68 × 104 đơn vị (chân ở gốc toạ độ), giống sprite Obito.
"""
import bpy, math, os, sys
import numpy as np
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
SRC_DIR = os.path.join(REPO, 'public', 'models', 'npc')
OUT_DIR = os.path.join(REPO, 'public', 'img', 'npc')
ASPECT = 68 / 104          # khung vẽ trong hall.js (rộng / cao)


def main(name, height_px=416):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(SRC_DIR, name + '.glb'))
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    lo = Vector((1e9, 1e9, 1e9)); hi = Vector((-1e9, -1e9, -1e9))
    for o in meshes:
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            lo = Vector(map(min, lo, w)); hi = Vector(map(max, hi, w))
    h = hi.z - lo.z
    sc = bpy.context.scene
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    sc.collection.objects.link(cam); sc.camera = cam
    cam.data.type = 'ORTHO'
    cam.data.sensor_fit = 'VERTICAL'
    cam.data.ortho_scale = h * 1.6                           # chừa rộng, cắt sát theo hình ở dưới
    tilt = math.radians(8)                                   # nhìn hơi từ trên xuống như sàn 2D
    mid = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z + h / 2))
    cam.rotation_euler = (math.pi / 2 - tilt, 0, 0)
    cam.location = mid + Vector((0, -math.cos(tilt), math.sin(tilt))) * 10
    sc.render.engine = 'BLENDER_WORKBENCH'
    sh = sc.display.shading
    sh.light = 'STUDIO'; sh.color_type = 'TEXTURE'
    sh.show_cavity = True; sh.cavity_type = 'BOTH'; sh.curvature_ridge_factor = 0.6; sh.curvature_valley_factor = 0.8
    sh.show_object_outline = True; sh.object_outline_color = (0.08, 0.06, 0.05)
    sc.render.film_transparent = True
    raw = height_px * 2
    sc.render.resolution_x = sc.render.resolution_y = raw
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    tmp = os.path.join(bpy.app.tempdir or '/tmp', name + '-sprite-raw.png')
    sc.render.filepath = tmp
    bpy.ops.render.render(write_still=True)

    # Cắt sát theo kênh alpha, đặt vào khung tỉ lệ 68:104, chân chạm đáy, cách đỉnh 2%.
    src = bpy.data.images.load(tmp)
    W, H = src.size
    px = np.array(src.pixels[:], dtype=np.float32).reshape(H, W, 4)   # hàng 0 là đáy ảnh
    ys, xs = np.nonzero(px[:, :, 3] > 0.02)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    crop = px[y0:y1, x0:x1]
    ch, cw = crop.shape[:2]
    out_h = height_px; out_w = round(height_px * ASPECT)
    k = min((out_h * 0.98) / ch, out_w / cw)
    nh, nw = max(1, round(ch * k)), max(1, round(cw * k))
    # thu nhỏ bằng lấy mẫu trung bình theo khối (đủ mịn cho ảnh 2D nhỏ)
    yi = (np.arange(nh + 1) * ch / nh).astype(int); xi = (np.arange(nw + 1) * cw / nw).astype(int)
    small = np.zeros((nh, nw, 4), dtype=np.float32)
    pre = crop.copy(); pre[:, :, :3] *= pre[:, :, 3:4]                 # trộn theo alpha nhân sẵn để viền không bị quầng
    for r in range(nh):
        band = pre[yi[r]:max(yi[r + 1], yi[r] + 1)]
        for c in range(nw):
            small[r, c] = band[:, xi[c]:max(xi[c + 1], xi[c] + 1)].reshape(-1, 4).mean(axis=0)
    a = small[:, :, 3:4]
    small[:, :, :3] = np.where(a > 1e-4, small[:, :, :3] / np.maximum(a, 1e-4), 0)
    canvas = np.zeros((out_h, out_w, 4), dtype=np.float32)
    ox = (out_w - nw) // 2
    canvas[0:nh, ox:ox + nw] = small                                  # hàng 0 là đáy: chân chạm đáy khung
    img = bpy.data.images.new(name + '-sprite', out_w, out_h, alpha=True)
    img.pixels[:] = canvas.ravel().tolist()
    os.makedirs(OUT_DIR, exist_ok=True)
    out = os.path.join(OUT_DIR, name + '.webp')
    img.filepath_raw = out
    img.file_format = 'WEBP'
    img.save()
    print('SPRITE_DONE', name, out, os.path.getsize(out))


if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    if not argv:
        raise SystemExit('sprite: cần tên NPC (tệp public/models/npc/<tên>.glb)')
    main(argv[0], int(argv[1]) if len(argv) > 1 else 416)
