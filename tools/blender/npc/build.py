"""Chùa Tâm An · dựng mô hình NPC 3D từ tệp .glb gốc (thẻ T-213).

Tệp gốc (Tripo, Sketchfab…) thường là một khối lưới tĩnh rất nặng, đứng chữ T hoặc chữ A, không có xương.
Script này: nhập tệp gốc → gộp lưới → giảm số mặt → đặt cao đúng, chân chạm đất, mặt nhìn về -Y (= +Z của glTF)
→ dò khớp (vai, khuỷu, cổ tay, hông, gối) từ hình dáng → dựng bộ xương chung → gán trọng số tự động
→ hạ hai tay xuống làm tư thế gốc → gắn đạo cụ (chổi, đao…) vào xương tay → xuất .glb gọn.
Mã trình duyệt (public/js/world3d/npc-glb.mjs) xoay các xương này khi đi, thở, vái, nói.

Chạy không giao diện (Blender 5.x):
    blender -b --factory-startup -P tools/blender/npc/build.py -- <tên NPC> [thư mục ảnh xem thử]
Tệp gốc nằm NGOÀI repo; khai đường dẫn trong biến môi trường hoặc sửa bảng SOURCES bên dưới:
    NPC_SRC=<thư mục chứa tệp gốc> (mặc định ~/Downloads)
Đầu ra (KHÔNG sửa tay, sửa script rồi chạy lại): public/models/npc/<tên>.glb

Bộ xương (tên dùng trong mã, .L là bên trái nhân vật = +X):
    hips → spine → chest → neck → head
    chest → shoulder_L → arm_L → forearm_L → hand_L (bên phải tương tự _R)
    hips → thigh_L → shin_L → foot_L (bên phải tương tự _R)
"""
import bpy, math, os, re, sys
import numpy as np
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
SRC_DIR = os.environ.get('NPC_SRC') or os.path.join(os.path.expanduser('~'), 'Downloads')
OUT_DIR = os.path.join(REPO, 'public', 'models', 'npc')

# Mỗi NPC: tệp gốc (trong NPC_SRC), cao (m), số tam giác đích, góc tay so với phương ngang sau khi hạ (độ;
# None: giữ dáng tay gốc), turn (độ, xoay cho mặt nhìn -Y), img (định dạng ảnh khi xuất), recolor (xem process_images),
# prop (đạo cụ, xem add_prop).
SF = 'sketchfab-npc/'   # mô hình tải từ Sketchfab (CC BY), xem public/img/NOTICE.txt mục 3e–3f
SOURCES = {
    'te-cong': dict(src='Te_Cong.glb', height=1.6, tris=11000, arm=74),
    # Ngọa Long Kỳ Sư (NPC đánh cờ): "Zhuge Liang_ Armoured" của kitkeat, CC BY (NOTICE mục 3f). Tải bản glTF/GLB
    # trên Sketchfab, đặt tên zhuge-liang.glb trong NPC_SRC/sketchfab-npc/. Góc tay 74° là phỏng đoán: xem ảnh thử rồi chỉnh.
    'ngoa-long': dict(src=SF + 'zhuge-liang.glb', height=1.74, tris=14000, arm=74, img='WEBP'),
    'van-ly': dict(src='Van_Ly_Doc_Hanh.glb', height=1.66, tris=11000, arm=74, img='JPEG',
                   prop=dict(src=SF + 'dao.glb', length=0.9, grip=0.175, point='max', roll=90, tilt=14, splay=-6, bone='hand_R')),
    'tao-dia': dict(src='Tao_Dia_Tang.glb', height=1.56, tris=11000, arm=72, img='JPEG',
                    prop=dict(src=SF + 'broom.glb', length=1.2, grip=0.82, point='min', tilt=30, splay=-4, tris=9000, bone='hand_R')),
    # Bốn cô nương: arm=None là giữ dáng tay gốc (tay áo rộng, cầm dù), mã chỉ đánh tay rất nhẹ.
    # height tính cả dù (cô áo đỏ) và tóc búi; arm_line đo trên ảnh 'measure' (tỉ lệ chiều cao).
    'co-nuong-do': dict(src=SF + 'lady-red.glb', height=1.68, tris=14000, arm=None, turn=-90, img='WEBP'),
    'co-nuong-lam': dict(src=SF + 'lady-blue.glb', height=1.56, tris=14000, arm=None, img='WEBP'),
    'co-nuong-hong': dict(src=SF + 'lady-qipao.glb', height=1.56, tris=14000, arm=76, img='WEBP',
                          arm_line=((0.088, 0.815), (0.277, 0.5)),
                          # sườn xám xanh đậm → hồng sen
                          recolor=[dict(hue=(185, 265), sat=(0.2, 1), to_hue=332, sat_mul=0.85, val_mul=1.9)]),
    'co-nuong-cam': dict(src=SF + 'lady-white.glb', height=1.54, tris=14000, arm=None, img='WEBP',
                         # áo trắng xám → cam đào; da, tóc, viền vàng giữ nguyên
                         recolor=[dict(sat=(0, 0.13), val=(0.42, 1), to_hue=20, sat_min=0.42)]),
    # Thầy bói Tarot ở Sân chùa: tượng "Crimson Empress" ngồi ngai, cắt bỏ bệ, ngai, hoa, bình và nến;
    # váy đỏ → tím Huế (da hồng nhạt, tóc cam đồng giữ nguyên). Ngồi yên nên không gắn xương.
    # Toạ độ cắt đo trên ảnh có lưới của tệp gốc (mặt nhìn -Y, mặt ghế ở z ≈ -0.13).
    'thay-boi-tarot': dict(src=SF + 'lady-empress.glb', height=1.2, tris=18000, rig=False, img='WEBP', center=(0.0, 0.2),
                           # chỉ nhuộm dưới cằm, trước đuôi tóc (tóc giữ nguyên), thêm phần váy sau mông
                           recolor_within=[(None, 0.24, 0.56), (None, 0.36, 0.06)],
                           cut=[dict(max=(None, None, -0.785)),                            # bệ
                                dict(min=(None, -0.18, None), max=(None, None, -0.13)),    # ngai và hoa trước ngai
                                dict(min=(0.235, 0.05, -0.15)),                            # bình hoa, nến bên phải
                                dict(min=(0.2, None, None), max=(None, None, -0.08)),      # mặt ghế thừa hai bên hông
                                dict(max=(-0.2, None, -0.08)),
                                dict(min=(None, 0.35, None), max=(None, None, -0.08)),     # mặt ghế thừa sau lưng
                                dict(min=(0.09, None, None), max=(None, None, -0.5)),      # hoa sót cạnh chân
                                dict(max=(-0.15, None, -0.5))],
                           recolor=[dict(hue=(332, 15), sat=(0.42, 1), val=(0.1, 1), to_hue=282, val_mul=0.9)]),
}


def clean_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_glb(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.data.objects if o not in before]


def bake_skins(meshes):
    """Mô hình gốc đã có xương (Sketchfab): nướng tư thế hiện tại vào lưới, bỏ khóa hình và nhóm đỉnh cũ."""
    for o in meshes:
        bpy.context.view_layer.objects.active = o
        if o.data.shape_keys:
            o.shape_key_add(name='mix', from_mix=True)
            for key in list(o.data.shape_keys.key_blocks)[:-1]:
                o.shape_key_remove(key)
            o.shape_key_remove(o.data.shape_keys.key_blocks[0])
        for m in list(o.modifiers):
            if m.type == 'ARMATURE' and m.object:
                bpy.ops.object.modifier_apply(modifier=m.name)
            else:
                o.modifiers.remove(m)
        o.vertex_groups.clear()


def join_meshes(objs, name, drop=None):
    """Gộp mọi lưới về một đối tượng, áp dụng biến đổi, bỏ các nút rỗng (và các lưới khớp `drop`)."""
    meshes = [o for o in objs if o.type == 'MESH']
    if drop:
        for o in [o for o in meshes if re.search(drop, o.name, re.I)]:
            meshes.remove(o)
            objs.remove(o)
            bpy.data.objects.remove(o)
    bake_skins(meshes)
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:
        mw = o.matrix_world.copy()
        o.parent = None
        o.matrix_world = mw
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for o in list(bpy.data.objects):
        if o is not ob and o.type != 'MESH' and o in objs:
            bpy.data.objects.remove(o)
    for o in list(bpy.data.objects):
        if o is not ob and o in objs:
            bpy.data.objects.remove(o)
    ob.name = name
    ob.data.name = name
    return ob


def bounds(ob):
    vs = [ob.matrix_world @ v.co for v in ob.data.vertices]
    mn = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
    mx = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
    return mn, mx


def cut(ob, boxes):
    """Xoá các đỉnh nằm trong hộp (toạ độ tệp gốc sau khi xoay): tách người khỏi ngai, bệ, bình hoa…
    Mỗi hộp: dict(min=(x, y, z), max=(x, y, z)), None là không giới hạn ở phía đó."""
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    inf = float('inf')
    gone = []
    for v in bm.verts:
        for box in boxes:
            lo = [(-inf if a is None else a) for a in box.get('min', (None,) * 3)]
            hi = [(inf if a is None else a) for a in box.get('max', (None,) * 3)]
            if all(lo[i] <= v.co[i] <= hi[i] for i in range(3)):
                gone.append(v)
                break
    bmesh.ops.delete(bm, geom=gone, context='VERTS')
    bm.to_mesh(ob.data)
    bm.free()
    ob.data.update()
    print('NPC: cắt bỏ', len(gone), 'đỉnh, còn', len(ob.data.vertices))


def normalize(ob, height, center=None):
    """Cao đúng `height`, chân chạm z=0, tâm ngang ở gốc toạ độ (hoặc ở điểm `center` (x, y) của tệp gốc)."""
    mn, mx = bounds(ob)
    k = height / (mx.z - mn.z)
    c = (mn + mx) / 2
    if center:
        c.x, c.y = center
    ob.data.transform(Matrix.Scale(k, 4) @ Matrix.Translation((-c.x, -c.y, -mn.z)))
    ob.data.update()


def decimate(ob, tris):
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.remove_doubles(threshold=0.0005)
    bpy.ops.object.mode_set(mode='OBJECT')
    faces = sum(len(p.vertices) - 2 for p in ob.data.polygons)
    if faces > tris:
        mod = ob.modifiers.new('decimate', 'DECIMATE')
        mod.ratio = tris / faces
        mod.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)


def joints(ob, height, arm_line=None):
    """Dò khớp: trả toạ độ các khớp (Blender, Z lên, mặt nhìn -Y).
    Tư thế chữ T: tự dò đường tay từ các đỉnh xa tâm nhất. Tư thế chữ A hoặc tay áo rộng: khai `arm_line`
    = ((vai x, vai z), (đầu ngón x, đầu ngón z)) theo tỉ lệ chiều cao, đo trên ảnh xem thử."""
    vs = [v.co.copy() for v in ob.data.vertices]
    half = max(abs(v.x) for v in vs)
    if arm_line:
        (sx, sz), (hx, hz) = arm_line
        shoulder, tip = Vector((sx * height, 0, sz * height)), Vector((hx * height, 0, hz * height))
    else:
        # Tay dang ngang: các đỉnh xa tâm nhất cho độ cao vai và đầu ngón tay.
        far = [v for v in vs if abs(v.x) > half * 0.8]
        arm_z = sum(v.z for v in far) / len(far)
        # Vai theo tỉ lệ người: tay áo rộng rủ xuống dưới nách nên đo bề ngang thân ở đó không tin được.
        shoulder, tip = Vector((height * 0.115, 0, arm_z)), Vector((half, 0, arm_z))
    along = tip - shoulder
    hand_len = min(height * 0.1, along.length * 0.22)
    wrist = tip - along.normalized() * hand_len
    elbow = (shoulder + wrist) / 2
    arm_z = shoulder.z
    # Chân: bề ngang bàn chân sát đất.
    feet = [abs(v.x) for v in vs if v.z < height * 0.06]
    leg_x = (sum(feet) / len(feet)) if feet else height * 0.06
    leg_x = max(height * 0.045, min(leg_x, height * 0.08))
    hip_z = height * 0.5
    y0 = 0.0
    return dict(
        hips=Vector((0, y0, hip_z)), spine=Vector((0, y0, hip_z + height * 0.08)),
        chest=Vector((0, y0, arm_z - height * 0.12)), neck=Vector((0, y0, arm_z + height * 0.02)),
        head=Vector((0, y0, arm_z + height * 0.08)), top=Vector((0, y0, height)),
        arm_z=arm_z, shoulder=shoulder, elbow=elbow, wrist=wrist, tip=tip,
        arm_down=math.degrees(math.atan2(shoulder.z - tip.z, tip.x - shoulder.x)),
        leg_x=leg_x, knee_z=height * 0.27, ankle_z=height * 0.06,
    )


def build_armature(j, height):
    arm = bpy.data.armatures.new('rig')
    rig = bpy.data.objects.new('rig', arm)
    bpy.context.scene.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm.edit_bones

    def bone(name, head, tail, parent=None, connect=False):
        b = eb.new(name)
        b.head, b.tail = Vector(head), Vector(tail)
        b.roll = 0
        if parent:
            b.parent = eb[parent]
            b.use_connect = connect
        return b

    bone('hips', j['hips'], j['spine'])
    bone('spine', j['spine'], j['chest'], 'hips', True)
    bone('chest', j['chest'], j['neck'], 'spine', True)
    bone('neck', j['neck'], j['head'], 'chest', True)
    bone('head', j['head'], j['top'], 'neck', True)
    az = j['arm_z']
    for side, s in (('L', 1), ('R', -1)):
        flip = lambda p: (s * p.x, 0, p.z)
        bone('shoulder_' + side, (s * height * 0.03, 0, az - height * 0.01), flip(j['shoulder']), 'chest')
        bone('arm_' + side, flip(j['shoulder']), flip(j['elbow']), 'shoulder_' + side, True)
        bone('forearm_' + side, flip(j['elbow']), flip(j['wrist']), 'arm_' + side, True)
        bone('hand_' + side, flip(j['wrist']), flip(j['tip']), 'forearm_' + side, True)
        lx = s * j['leg_x']
        bone('thigh_' + side, (lx, 0, j['hips'].z - height * 0.02), (lx, 0, j['knee_z']), 'hips')
        bone('shin_' + side, (lx, 0, j['knee_z']), (lx, 0, j['ankle_z']), 'thigh_' + side, True)
        bone('foot_' + side, (lx, 0, j['ankle_z']), (lx, -height * 0.08, 0.01), 'shin_' + side, True)
    bpy.ops.object.mode_set(mode='OBJECT')
    return rig


def skin(ob, rig):
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    unweighted = sum(1 for v in ob.data.vertices if not any(g.weight > 0 for g in v.groups))
    if unweighted > len(ob.data.vertices) * 0.02:
        # Tự động thất bại (lưới hở): dùng vỏ bao của xương.
        for g in list(ob.vertex_groups):
            ob.vertex_groups.remove(g)
        for m in list(ob.modifiers):
            ob.modifiers.remove(m)
        ob.parent = None
        bpy.ops.object.select_all(action='DESELECT')
        ob.select_set(True)
        rig.select_set(True)
        bpy.context.view_layer.objects.active = rig
        bpy.ops.object.parent_set(type='ARMATURE_ENVELOPE')
        print('NPC: trọng số tự động hụt', unweighted, 'đỉnh, đổi sang vỏ bao')
    fill_unweighted(ob, rig)
    return unweighted


def fill_unweighted(ob, rig):
    """Đỉnh không có trọng số sẽ co về gốc toạ độ trong three.js: gán hết cho xương gần nhất."""
    segs = [(b.name, b.head_local.copy(), b.tail_local.copy()) for b in rig.data.bones]

    def nearest(p):
        best, dist = None, 1e9
        for name, a, b in segs:
            ab = b - a
            t = max(0.0, min(1.0, (p - a).dot(ab) / max(ab.length_squared, 1e-9)))
            d = (a + ab * t - p).length
            if d < dist:
                best, dist = name, d
        return best

    for v in ob.data.vertices:
        if not any(g.weight > 0 for g in v.groups):
            name = nearest(v.co)
            group = ob.vertex_groups.get(name) or ob.vertex_groups.new(name=name)
            group.add([v.index], 1.0, 'REPLACE')


def drop_metal_rough(ob):
    """Mã trình duyệt chỉ dùng ảnh màu và ảnh pháp tuyến: bỏ ảnh kim loại/nhám cho tệp nhẹ hơn."""
    for slot in ob.material_slots:
        mat = slot.material
        if not mat or not mat.use_nodes:
            continue
        bsdf = next((n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if not bsdf:
            continue
        for key in ('Metallic', 'Roughness'):
            for link in list(bsdf.inputs[key].links):
                mat.node_tree.links.remove(link)
        bsdf.inputs['Metallic'].default_value = 0.0
        bsdf.inputs['Roughness'].default_value = 0.9
        for link in list(bsdf.inputs['Emission Color'].links):
            mat.node_tree.links.remove(link)


def lower_arms(ob, rig, degrees):
    """Hạ hai tay từ chữ T xuống, nướng vào lưới, rồi lấy làm tư thế gốc mới."""
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='POSE')
    for side, s in (('L', 1), ('R', -1)):
        pb = rig.pose.bones['arm_' + side]
        head = pb.bone.head_local
        turn = Matrix.Translation(head) @ Matrix.Rotation(math.radians(degrees) * s, 4, 'Y') @ Matrix.Translation(-head)
        pb.matrix = turn @ pb.bone.matrix_local
        bpy.context.view_layer.update()
        fb = rig.pose.bones['forearm_' + side]
        # Khuỷu hơi gập về trước cho tự nhiên.
        fb.rotation_mode = 'XYZ'
        fb.rotation_euler = (0, 0, math.radians(12) * -s)
    bpy.context.view_layer.update()
    bpy.ops.object.mode_set(mode='OBJECT')
    mod = next(m for m in ob.modifiers if m.type == 'ARMATURE')
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='POSE')
    bpy.ops.pose.select_all(action='SELECT')
    bpy.ops.pose.armature_apply(selected=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    mod = ob.modifiers.new('rig', 'ARMATURE')
    mod.object = rig


def add_prop(rig, spec):
    """Gắn đạo cụ vào xương tay.
    spec: src, length (m, theo trục dài nhất), grip (chỗ cầm, tỉ lệ dọc trục dài tính từ đầu nhỏ),
    point ('min' | 'max': đầu nào chĩa theo chiều xương, tức xuống dưới theo cánh tay),
    roll (độ, xoay quanh trục dài), tilt (độ, nghiêng ra trước với tay phải), splay (độ, chếch ra ngoài/vào trong),
    at (tỉ lệ dọc xương bàn tay)."""
    objs = import_glb(os.path.join(SRC_DIR, spec['src']))
    ob = join_meshes(objs, 'prop')
    drop_metal_rough(ob)
    process_images(ob, {'tex': spec.get('tex', 512)})
    mn, mx = bounds(ob)
    size = mx - mn
    axis = max(range(3), key=lambda i: size[i])
    k = spec['length'] / size[axis]
    grip = mn.copy()
    for i in range(3):
        grip[i] = (mn[i] + mx[i]) / 2
    grip[axis] = mn[axis] + size[axis] * spec['grip']
    # Đưa chỗ cầm về gốc, trục dài về +Y, đầu `point` chĩa theo +Y.
    swap = {0: Matrix.Rotation(math.radians(90), 4, 'Z'), 1: Matrix.Identity(4), 2: Matrix.Rotation(math.radians(-90), 4, 'X')}[axis]
    flip = Matrix.Identity(4) if spec['point'] == 'max' else Matrix.Rotation(math.pi, 4, 'X')
    ob.data.transform(flip @ swap @ Matrix.Scale(k, 4) @ Matrix.Translation(-grip))
    decimate(ob, spec.get('tris', 3000))
    bone = rig.data.bones[spec['bone']]
    local = (Matrix.Translation((0, bone.length * spec.get('at', 0.4), 0))
             @ Matrix.Rotation(math.radians(spec.get('tilt', 0)), 4, 'Z')
             @ Matrix.Rotation(math.radians(spec.get('splay', 0)), 4, 'X')
             @ Matrix.Rotation(math.radians(spec.get('roll', 0)), 4, 'Y'))
    world = rig.matrix_world @ bone.matrix_local @ local
    ob.parent = rig
    ob.parent_type = 'BONE'
    ob.parent_bone = spec['bone']
    ob.matrix_world = world
    ob.name = 'prop'
    return ob


def rgb_to_hsv(rgb):
    r, g, b = rgb[:, 0], rgb[:, 1], rgb[:, 2]
    mx, mn = rgb.max(1), rgb.min(1)
    d = mx - mn
    h = np.zeros_like(mx)
    nz = d > 1e-6
    rm = nz & (mx == r)
    gm = nz & (mx == g) & ~rm
    bm = nz & ~rm & ~gm
    h[rm] = ((g[rm] - b[rm]) / d[rm]) % 6
    h[gm] = (b[gm] - r[gm]) / d[gm] + 2
    h[bm] = (r[bm] - g[bm]) / d[bm] + 4
    s = np.where(mx > 1e-6, d / np.maximum(mx, 1e-6), 0)
    return np.stack([h * 60, s, mx], 1)


def hsv_to_rgb(hsv):
    h, s, v = hsv[:, 0] % 360 / 60, hsv[:, 1], hsv[:, 2]
    c = v * s
    x = c * (1 - np.abs(h % 2 - 1))
    m = v - c
    z = np.zeros_like(h)
    i = np.floor(h).astype(int) % 6
    table = [(c, x, z), (x, c, z), (z, c, x), (z, x, c), (x, z, c), (c, z, x)]
    out = np.zeros((len(h), 3))
    for k, (r, g, b) in enumerate(table):
        sel = i == k
        out[sel] = np.stack([r[sel], g[sel], b[sel]], 1)
    return out + m[:, None]


def in_hue(h, lo, hi):
    return (h >= lo) & (h <= hi) if lo <= hi else (h >= lo) | (h <= hi)


def uv_mask(ob, size, boxes):
    """Mặt nạ điểm ảnh (cùng thứ tự img.pixels) phủ các tam giác nằm hẳn trong một trong các hộp `boxes`,
    mỗi hộp là (x, y, z) lớn nhất (None: không giới hạn), toạ độ tệp gốc: nhuộm áo mà không đụng tóc, môi cùng màu."""
    w, h = size
    mask = np.zeros((h, w), bool)
    me = ob.data
    me.calc_loop_triangles()
    uv = me.uv_layers.active.data
    co = np.array([v.co[:] for v in me.vertices])
    limits = [np.array([np.inf if b is None else b for b in box]) for box in boxes]
    for tri in me.loop_triangles:
        pts3 = co[list(tri.vertices)]
        if not any((pts3 < limit).all() for limit in limits):
            continue
        pts = np.array([uv[i].uv[:] for i in tri.loops]) * (w, h)
        x0, y0 = np.floor(pts.min(0)).astype(int)
        x1, y1 = np.ceil(pts.max(0)).astype(int)
        x0, y0, x1, y1 = max(x0, 0), max(y0, 0), min(x1, w - 1), min(y1, h - 1)
        if x1 < x0 or y1 < y0:
            continue
        gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
        (ax, ay), (bx, by), (cx, cy) = pts
        d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
        if abs(d) < 1e-12:
            continue
        l1 = ((by - cy) * (gx - cx) + (cx - bx) * (gy - cy)) / d
        l2 = ((cy - ay) * (gx - cx) + (ax - cx) * (gy - cy)) / d
        inside = (l1 >= -0.02) & (l2 >= -0.02) & (1 - l1 - l2 >= -0.02)
        mask[y0:y1 + 1, x0:x1 + 1] |= inside
    # Nới mặt nạ 3 điểm ảnh để khỏi sót viền đỏ ở mép các mảng UV.
    for _ in range(3):
        grown = mask.copy()
        grown[1:] |= mask[:-1]; grown[:-1] |= mask[1:]; grown[:, 1:] |= mask[:, :-1]; grown[:, :-1] |= mask[:, 1:]
        mask = grown
    print('NPC: mặt nạ nhuộm phủ', int(mask.sum()), 'điểm ảnh')
    return mask.ravel()


def process_images(ob, spec):
    """Thu ảnh màu về tối đa `tex` px và nhuộm lại áo theo các luật `recolor`.
    Mỗi luật: hue=(từ, đến) độ (bỏ trống: mọi màu), sat=(min, max), val=(min, max) chọn điểm ảnh;
    to_hue: màu mới (độ), sat_mul / sat_min: chỉnh độ đậm, val_mul: chỉnh độ sáng."""
    seen = set()
    for slot in ob.material_slots:
        mat = slot.material
        if not mat or not mat.use_nodes:
            continue
        for node in mat.node_tree.nodes:
            img = getattr(node, 'image', None) if node.type == 'TEX_IMAGE' else None
            if not img or img.name in seen:
                continue
            seen.add(img.name)
            w, h = img.size
            limit = spec.get('tex', 1024)
            if max(w, h) > limit:
                k = limit / max(w, h)
                img.scale(max(1, int(w * k)), max(1, int(h * k)))
            rules = spec.get('recolor') or []
            is_color = any(link.to_socket.name == 'Base Color' for out in node.outputs for link in out.links)
            if rules and is_color:
                px = np.array(img.pixels[:], dtype=np.float32).reshape(-1, 4)
                hsv = rgb_to_hsv(px[:, :3].astype(np.float64))
                where = uv_mask(ob, img.size, spec['recolor_within']) if spec.get('recolor_within') else None
                for rule in rules:
                    sel = np.ones(len(hsv), bool) if where is None else where.copy()
                    if rule.get('hue'):
                        sel &= in_hue(hsv[:, 0], *rule['hue'])
                    lo, hi = rule.get('sat', (0, 1))
                    sel &= (hsv[:, 1] >= lo) & (hsv[:, 1] <= hi)
                    lo, hi = rule.get('val', (0, 1))
                    sel &= (hsv[:, 2] >= lo) & (hsv[:, 2] <= hi)
                    if 'to_hue' in rule:
                        hsv[sel, 0] = rule['to_hue']
                    hsv[sel, 1] = np.clip(np.maximum(hsv[sel, 1] * rule.get('sat_mul', 1), rule.get('sat_min', 0)), 0, 1)
                    hsv[sel, 2] = np.clip(hsv[sel, 2] * rule.get('val_mul', 1), 0, 1)
                    print('NPC: nhuộm', img.name, int(sel.sum()), 'điểm ảnh')
                px[:, :3] = hsv_to_rgb(hsv)
                img.pixels.foreach_set(px.ravel())
                img.update()
            if img.is_dirty or img.packed_file is None:
                img.pack()


def render_measure(out, name):
    """Ảnh chính diện của tệp gốc (cao 1) để đo `arm_line`: điểm ảnh (px, py) trên khung 520x520
    ứng với x = (px - 260) / 520 * 1.2, z = 0.5 + (260 - py) / 520 * 1.2."""
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_WORKBENCH'
    sc.display.shading.color_type = 'TEXTURE'
    sc.render.resolution_x = sc.render.resolution_y = 520
    sc.world = sc.world or bpy.data.worlds.new('w')
    sc.world.color = (0.25, 0.28, 0.25)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    sc.collection.objects.link(cam)
    sc.camera = cam
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = 1.2
    cam.location = (0, -10, 0.5)
    cam.rotation_euler = (math.radians(90), 0, 0)
    sc.render.filepath = os.path.join(out, name + '-measure.png')
    bpy.ops.render.render(write_still=True)


def render_views(out, name):
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_WORKBENCH'
    sc.display.shading.light = 'STUDIO'
    sc.display.shading.color_type = 'TEXTURE'
    sc.render.resolution_x, sc.render.resolution_y = 360, 520
    sc.world = sc.world or bpy.data.worlds.new('w')
    sc.world.color = (0.25, 0.28, 0.25)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    sc.collection.objects.link(cam)
    sc.camera = cam
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = 2.0
    for view, ang in (('front', 0), ('side', 90), ('back', 180)):
        a = math.radians(ang)
        cam.location = (math.sin(a) * 10, -math.cos(a) * 10, 0.85)
        cam.rotation_euler = (math.radians(90), 0, a)
        sc.render.filepath = os.path.join(out, name + '-' + view + '.png')
        bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam)


def export(path, image_format='AUTO'):
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=False,
                              export_skins=True, export_animations=False, export_morph=False,
                              export_yup=True, export_texcoords=True, export_normals=True,
                              export_tangents=False, export_cameras=False, export_lights=False,
                              export_image_format=image_format, export_jpeg_quality=82,
                              export_image_quality=82)


def build(name, preview=None, measure=None):
    spec = SOURCES[name]
    clean_scene()
    objs = import_glb(os.path.join(SRC_DIR, spec['src']))
    ob = join_meshes(objs, 'body', spec.get('drop'))
    if spec.get('turn'):
        ob.data.transform(Matrix.Rotation(math.radians(spec['turn']), 4, 'Z'))
    if measure:
        normalize(ob, 1.0)
        render_measure(measure, name)
        return
    if spec.get('cut'):
        cut(ob, spec['cut'])
    drop_metal_rough(ob)
    process_images(ob, spec)
    normalize(ob, spec['height'], spec.get('center'))
    tris = decimate(ob, spec['tris'])
    if spec.get('rig') is False:
        # Tượng ngồi yên (thầy bói): không xương, mã chỉ đặt vào chỗ ngồi.
        os.makedirs(OUT_DIR, exist_ok=True)
        out = os.path.join(OUT_DIR, name + '.glb')
        if preview:
            os.makedirs(preview, exist_ok=True)
            render_views(preview, name)
        export(out, spec.get('img', 'AUTO'))
        print('NPC_DONE', name, 'tam giác', tris, 'không xương', 'kích thước', os.path.getsize(out))
        return
    j = joints(ob, spec['height'], spec.get('arm_line'))
    rig = build_armature(j, spec['height'])
    missed = skin(ob, rig)
    if spec.get('arm') is not None:
        lower_arms(ob, rig, spec['arm'] - j['arm_down'])
    if spec.get('prop'):
        add_prop(rig, spec['prop'])
    os.makedirs(OUT_DIR, exist_ok=True)
    out = os.path.join(OUT_DIR, name + '.glb')
    if preview:
        os.makedirs(preview, exist_ok=True)
        render_views(preview, name)
    export(out, spec.get('img', 'AUTO'))
    print('NPC_DONE', name, 'tam giác', tris, 'đỉnh hụt trọng số', missed,
          'tay chếch', round(j['arm_down'], 1), 'kích thước', os.path.getsize(out))


if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    if argv and argv[0] != 'all' and argv[0] not in SOURCES:
        raise SystemExit('NPC: không có tên ' + argv[0] + ' trong SOURCES (dùng một tên có sẵn hoặc all)')
    names = [argv[0]] if argv and argv[0] in SOURCES else list(SOURCES)
    preview = argv[1] if len(argv) > 1 else None
    measure = argv[2] if len(argv) > 2 and argv[2] == 'measure' else None
    for n in names:
        if measure:
            build(n, measure=preview)
            continue
        if SOURCES[n].get('prop') and not os.path.exists(os.path.join(SRC_DIR, SOURCES[n]['prop']['src'])):
            print('NPC: thiếu đạo cụ', SOURCES[n]['prop']['src'], '→ dựng không đạo cụ')
            SOURCES[n] = {k: v for k, v in SOURCES[n].items() if k != 'prop'}
        build(n, preview)
