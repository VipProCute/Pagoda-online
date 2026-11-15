"""Kỳ Đài · liệt kê các phần trong mô hình nguồn (assets-src/) để biết tên và kích thước khi gọi Kit.put.

Chạy: blender -b --factory-startup -P tools/blender/kydao/list_assets.py -- <repo>
Ghi assets-src/index.txt, mỗi dòng: <mã mô hình> | <tên phần> | số mặt | rộng x sâu x cao (mét) | cao độ đáy | vật liệu.
Mã mô hình Poly Haven là tên thư mục; mô hình tự tải có mã `custom:<tên file>`.
"""
import bpy, os, sys
from mathutils import Vector

if '--' not in sys.argv or sys.argv.index('--') + 1 >= len(sys.argv):
    raise SystemExit('Cần truyền đường dẫn repo sau --')
REPO = os.path.abspath(sys.argv[sys.argv.index('--') + 1])
SRC = os.path.join(REPO, 'assets-src')
if not os.path.isdir(SRC):
    raise SystemExit('Chưa có assets-src/: chạy node tools/blender/kydao/fetch-assets.js trước')


def parts(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    ext = os.path.splitext(path)[1].lower()
    if ext == '.fbx':
        bpy.ops.import_scene.fbx(filepath=path)
    elif ext == '.obj':
        bpy.ops.wm.obj_import(filepath=path)
    else:
        bpy.ops.import_scene.gltf(filepath=path)
    bpy.context.view_layer.update()
    rows = []
    for ob in sorted(bpy.data.objects, key=lambda o: o.name):
        if ob.type != 'MESH':
            continue
        bb = [ob.matrix_world @ Vector(c) for c in ob.bound_box]
        size = [max(p[i] for p in bb) - min(p[i] for p in bb) for i in range(3)]
        low = min(p[2] for p in bb)
        rows.append('%s | %d mặt | %.2f x %.2f x %.2f | đáy z=%.2f | %s' % (
            ob.name, len(ob.data.polygons), size[0], size[1], size[2], low, ', '.join(m.name for m in ob.data.materials if m)))
    return rows


lines = []
ph = os.path.join(SRC, 'polyhaven')
for aid in sorted(os.listdir(ph)) if os.path.isdir(ph) else []:
    f = os.path.join(ph, aid, aid + '.gltf')
    if os.path.exists(f):
        lines += ['%s | %s' % (aid, r) for r in parts(f)]
cu = os.path.join(SRC, 'custom')
for name in sorted(os.listdir(cu)) if os.path.isdir(cu) else []:
    if os.path.splitext(name)[1].lower() in ('.glb', '.gltf', '.fbx', '.obj'):
        lines += ['custom:%s | %s' % (name, r) for r in parts(os.path.join(cu, name))]
out = os.path.join(SRC, 'index.txt')
with open(out, 'w', encoding='utf-8') as fh:
    fh.write('\n'.join(lines) + '\n')
print('RESULT %d dòng ở %s' % (len(lines), out))
