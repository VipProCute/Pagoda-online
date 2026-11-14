"""Chùa Tâm An · bản mẫu nhân vật 3D (thẻ T-120) dựng bằng Blender.

Chạy trong Blender (5.x), mỗi lần dựng + xuất MỘT nhân vật:
    import runpy
    runpy.run_path(r'<repo>/tools/blender/avatar/build.py',
                   init_globals={'REPO': r'<repo>', 'GENDER': 'nam', 'OUT': ['glb', 'views', 'poses'], 'PREVIEW': True})
Biến điều khiển:
    REPO    đường dẫn repo (bắt buộc)
    GENDER  'nam' | 'nu'
    OUT     tập con của {'glb', 'views', 'poses', 'hair', 'halo', 'check'}
    HAIR    kiểu tóc hiện trong ảnh views/poses (0 dài, 1 búi, 2 ngắn, 3 khăn quấn; mặc định 2)
    PREVIEW True: ảnh nháp nhỏ vào thư mục tạm (không đè ảnh trong docs/); False: ghi ảnh thật vào docs/ky-dai/anh
    TMP     thư mục ảnh nháp (mặc định thư mục tạm của hệ thống)
Đầu ra (KHÔNG sửa tay, sửa script rồi chạy lại):
    public/models/avatar/nam.glb | nu.glb | hao-quang.glb
    docs/ky-dai/anh/nhan-vat-nam.jpg | nhan-vat-nu.jpg | nhan-vat-tu-the.jpg (bốn ô dọc 320x720 ghép thành 1280x720)
    docs/ky-dai/anh/nhan-vat-toc.jpg (4 kiểu tóc x 2 giới, cần chạy 'hair' cho cả nam lẫn nu)
Vật liệu xuất ra: body (màu theo đỉnh COLOR_0: da, mắt, má, dép, quần, viền), robe (áo, mã đổi màu), hair, hairwrap (khăn quấn đầu).
Tóc: bốn mesh con hair0..hair3 cùng gắn xương đầu, mã bật một cái và ẩn ba cái.

Quy ước toạ độ Blender (Z lên): gốc ở giữa hai bàn chân, cao ~1,6, mặt nhìn về -Y (= +Z của glTF).
Nhân vật bên trái (của nhân vật) là +X. Làm trong cảnh riêng 'AvatarProto', không đụng cảnh khác, không lưu .blend.
Hạt giống cố định, kết quả lặp lại được.
"""
import bpy, bmesh, math, os, random, tempfile
from mathutils import Matrix, Vector, Euler

REPO = globals().get('REPO')
GENDER = globals().get('GENDER', 'nam')
OUT = set(globals().get('OUT', ['check']))
PREVIEW = globals().get('PREVIEW', True)
HAIR = int(globals().get('HAIR', 2))
TMP = globals().get('TMP', os.path.join(tempfile.gettempdir(), 'avatar_proto'))
if not REPO:
    raise SystemExit('Thiếu REPO')
random.seed(1207)
SCENE, FPS = 'AvatarProto', 25
GLB_DIR = os.path.join(REPO, 'public', 'models', 'avatar')
IMG_DIR = os.path.join(REPO, 'docs', 'ky-dai', 'anh')
FEMALE = GENDER == 'nu'

COLORS = {'robe': '#6f8fa8', 'pants': '#e9e2d2', 'skin': '#f1c9a5', 'hair': '#2b2321', 'accent': '#e2b65c',
          'shoe': '#6b5946', 'eye': '#241a16', 'cheek': '#ef9a94', 'glow': '#ffd27a',
          'brow': '#2b2321', 'hairwrap': '#2c2a30'}
# khoá lưới -> vật liệu xuất ra; khoá không có ở đây gộp vào 'body' (màu theo đỉnh)
OWN_MAT = {'robe': 'robe', 'hair': 'hair', 'hairwrap': 'hairwrap', 'glow': 'glow'}


def rgb(hexs, a=1.0):
    h = hexs.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple((v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4) for v in c) + (a,)


# ───────────────────────── xương ─────────────────────────
# (tên, cha, đầu, đuôi); bên L = +X (bên trái của nhân vật), R lấy đối xứng.
_BASE = [
    ('hips', None, (0, 0, .62), (0, 0, .72)),
    ('spine', 'hips', (0, 0, .72), (0, 0, .88)),
    ('chest', 'spine', (0, 0, .88), (0, 0, 1.04)),
    ('neck', 'chest', (0, 0, 1.04), (0, 0, 1.12)),
    ('head', 'neck', (0, 0, 1.12), (0, 0, 1.58)),
]
_SIDED = [
    ('shoulder', 'chest', (.05, 0, 1.0), (.19, 0, 1.0)),
    ('upper_arm', 'shoulder', (.19, 0, 1.0), (.27, 0, .81)),
    ('lower_arm', 'upper_arm', (.27, 0, .81), (.31, 0, .61)),
    ('thigh', 'hips', (.10, 0, .66), (.10, 0, .40)),
    ('shin', 'thigh', (.10, 0, .40), (.10, 0, .07)),
]
BONES = list(_BASE)
for _n, _p, _h, _t in _SIDED:
    for _s, _k in (('L', 1), ('R', -1)):
        BONES.append((f'{_n}_{_s}', (_p if _p in ('chest', 'hips') else f'{_p}_{_s}'),
                      (_h[0] * _k, _h[1], _h[2]), (_t[0] * _k, _t[1], _t[2])))
assert len(BONES) <= 16
BONE_NAMES = [b[0] for b in BONES]


# ───────────────────────── lưới ─────────────────────────
class Mesher:
    def __init__(self):
        self.bm = bmesh.new()
        self.dl = self.bm.verts.layers.deform.new()
        self.mats = []
        self.gi = {n: i for i, n in enumerate(BONE_NAMES)}

    def mi(self, key):
        if key not in self.mats:
            self.mats.append(key)
        return self.mats.index(key)

    def setw(self, v, w):
        for k, val in w.items():
            v[self.dl][self.gi[k]] = val

    def sphere(self, mat, c, r, w, seg=10, rings=6, keep=None):
        res = bmesh.ops.create_uvsphere(self.bm, u_segments=seg, v_segments=rings, radius=1.0)
        verts = res['verts']
        faces = {f for v in verts for f in v.link_faces}
        drop = [f for f in faces if keep is not None and not keep(f.calc_center_median())]
        for v in verts:
            v.co = Vector((c[0] + v.co.x * r[0], c[1] + v.co.y * r[1], c[2] + v.co.z * r[2]))
            self.setw(v, w)
        m = self.mi(mat)
        for f in faces:
            f.material_index = m
        if drop:
            bmesh.ops.delete(self.bm, geom=drop, context='FACES')

    def loft(self, mat, rings, seg=10, cap_top=False, cap_bot=False, rot=0.0):
        """rings: [(tâm, rx, ry, trọng số)] liệt kê từ trên xuống dưới."""
        rows = []
        for c, rx, ry, w in rings:
            row = []
            for i in range(seg):
                a = 2 * math.pi * i / seg + rot
                v = self.bm.verts.new((c[0] + rx * math.cos(a), c[1] + ry * math.sin(a), c[2]))
                self.setw(v, w)
                row.append(v)
            rows.append(row)
        m = self.mi(mat)
        for r in range(len(rows) - 1):
            for i in range(seg):
                j = (i + 1) % seg
                f = self.bm.faces.new((rows[r][i], rows[r + 1][i], rows[r + 1][j], rows[r][j]))
                f.material_index = m
        if cap_top:
            self.bm.faces.new(rows[0]).material_index = m
        if cap_bot:
            self.bm.faces.new(rows[-1][::-1]).material_index = m


def mirror_w(w):
    return {(k[:-1] + 'R' if k.endswith('_L') else k): v for k, v in w.items()}


def build_body():
    M = Mesher()
    L = lambda *a: a
    HC = (0, 0, 1.31)                                  # tâm đầu
    # đầu + mặt
    M.sphere('skin', HC, (.265, .245, .24), {'head': 1.0}, seg=12, rings=8)
    for s in (1, -1):
        M.sphere('eye', (s * .095, -.222, 1.285), (.032, .02, .043), {'head': 1.0}, seg=6, rings=3)
        M.sphere('cheek', (s * .15, -.2, 1.225), (.036, .014, .022), {'head': 1.0}, seg=6, rings=3)
    M.sphere('eye', (0, -.238, 1.215), (.018, .01, .008), {'head': 1.0}, seg=6, rings=3)
    # cổ
    M.loft('skin', [((0, 0, 1.12), .055, .055, {'neck': 1.0}), ((0, 0, 1.06), .058, .058, {'neck': .5, 'chest': .5})], seg=8)
    # lông mày (tóc là các mesh riêng hair0..hair3, xem build_hair)
    if not FEMALE:
        for sx in (1, -1):
            M.sphere('brow', (sx * .095, -.228, 1.378), (.045, .016, .011), {'head': 1.0}, seg=5, rings=3)
    # áo tràng: cổ tàu + thân
    if FEMALE:
        rx = [.15, .185, .175, .15, .19, .23]; ry = [.1, .12, .115, .105, .135, .165]
    else:
        rx = [.16, .195, .19, .17, .19, .215]; ry = [.105, .125, .125, .115, .13, .15]
    zs = [1.07, 1.0, .88, .76, .62, .45]
    ww = [{'chest': 1.0}, {'chest': 1.0}, {'chest': .7, 'spine': .3}, {'spine': 1.0}, {'hips': .7, 'spine': .3},
          {'hips': .3, 'thigh_L': .35, 'thigh_R': .35}]
    rings = [((0, 0, 1.125), .078, .074, {'neck': .6, 'chest': .4}), ((0, 0, 1.09), .105, .088, {'neck': .3, 'chest': .7})]
    rings += [((0, 0, z), a, b, w) for z, a, b, w in zip(zs, rx, ry, ww)]
    M.loft('robe', rings, seg=10, cap_top=False, cap_bot=True)
    M.loft('accent', [((0, 0, 1.137), .082, .078, {'neck': .6, 'chest': .4}), ((0, 0, 1.118), .084, .08, {'neck': .6, 'chest': .4})], seg=10)
    M.loft('accent', [((0, 0, .47), rx[-1] + .004, ry[-1] + .004, ww[-1]), ((0, 0, .45), rx[-1] + .004, ry[-1] + .004, ww[-1])], seg=10)
    for z in (1.04, .93, .82):
        M.sphere('accent', (0, -.126 if z > .9 else -.125, z), (.016, .008, .016), {'chest': 1.0 if z > .9 else .6, 'spine': 0 if z > .9 else .4}, seg=5, rings=3)
    # tay áo rộng + tay
    for s, S in ((1, 'L'), (-1, 'R')):
        up, lo, sh = f'upper_arm_{S}', f'lower_arm_{S}', f'shoulder_{S}'
        ring = lambda c, r, w: ((c[0] * s, c[1], c[2]), r, r, w)
        sleeve = [ring((.185, 0, 1.03), .08, {'chest': .35, sh: .25, up: .4}),
                  ring((.23, 0, .915), .076, {up: 1.0}),
                  ring((.27, 0, .81), .082, {up: .5, lo: .5}),
                  ring((.29, 0, .71), .095, {lo: 1.0}),
                  ring((.31, 0, .61), .105, {lo: 1.0})]
        M.loft('robe', sleeve, seg=8, cap_bot=True)
        M.loft('accent', [ring((.31, 0, .625), .108, {lo: 1.0}), ring((.311, 0, .603), .108, {lo: 1.0})], seg=8)
        M.sphere('skin', (.312 * s, 0, .555), (.05, .05, .052), {lo: 1.0}, seg=8, rings=4)
        # quần ống rộng + dép
        th, sn = f'thigh_{S}', f'shin_{S}'
        leg = [((.10 * s, 0, .56), .082, .085, {th: 1.0}),
               ((.10 * s, 0, .40), .1, .1, {th: .5, sn: .5}),
               ((.10 * s, 0, .22), .102, .1, {sn: 1.0}),
               ((.10 * s, 0, .09), .108, .104, {sn: 1.0})]
        M.loft('pants', leg, seg=8, cap_bot=True)
        M.sphere('shoe', (.10 * s, -.035, .045), (.075, .125, .05), {sn: 1.0}, seg=8, rings=4)
    return M


HC = (0, .015, 1.335)


def hair_cap(M, keep):
    M.sphere('hair', HC, (.285, .27, .265), {'head': 1.0}, seg=12, rings=8, keep=keep)


def build_hair(style):
    """0 dài, 1 búi, 2 ngắn, 3 khăn quấn: khớp bốn kiểu `h` của avatar.mjs."""
    M = Mesher()
    HW = {'head': 1.0}
    if FEMALE:
        cap = lambda p: (p.z > 0.0 and not (p.y < -.25 and p.z < .40)) or (p.y > .0 and p.z > -.62) or (abs(p.x) > .6 and p.y > -.45 and p.z > -.3)
    else:
        cap = lambda p: (p.z > .08 and not (p.y < -.25 and p.z < .27)) or (p.y > .35 and p.z > -.40) or (abs(p.x) > .62 and p.y > -.45 and p.z > -.25)
    if style == 3:
        M.loft('hairwrap', [((0, 0, 1.41), .294, .279, HW), ((0, 0, 1.49), .298, .283, HW), ((0, 0, 1.57), .255, .24, HW), ((0, 0, 1.63), .14, .13, HW)],
               seg=12, cap_top=True)
        if FEMALE:
            M.sphere('hairwrap', (.27, -.02, 1.52), (.07, .05, .07), HW, seg=6, rings=4)
        return M
    hair_cap(M, cap)
    if style == 0:
        low, wd = (.62, .25) if FEMALE else (.86, .2)
        M.loft('hair', [((0, .17, 1.38), wd * .9, .09, HW), ((0, .2, 1.22), wd, .095, HW),
                        ((0, .19, 1.06), wd * .95, .09, {'neck': .4, 'chest': .6}),
                        ((0, .17, (1.06 + low) / 2), wd * .85, .085, {'chest': .6, 'spine': .4}),
                        ((0, .15, low), wd * .6, .07, {'spine': 1.0})], seg=8, cap_bot=True)
        for sx in (1, -1):
            M.loft('hair', [((sx * .262, -.02, 1.36), .03, .04, HW), ((sx * .268, .0, 1.2), .032, .04, HW),
                            ((sx * .26, .02, 1.06 if FEMALE else 1.12), .026, .034, {'head': .4, 'neck': .3, 'chest': .3})], seg=6, cap_bot=True)
    elif style == 1:
        if FEMALE:
            M.sphere('hair', (0, .13, 1.60), (.115, .105, .1), HW, seg=8, rings=5)
        else:
            M.sphere('hair', (0, .05, 1.64), (.095, .09, .085), HW, seg=8, rings=5)
    elif FEMALE:       # tóc ngang vai (bob): vỏ nửa sau đầu kéo xuống gáy
        M.sphere('hair', (0, .035, 1.27), (.30, .285, .27), HW, seg=12, rings=6, keep=lambda p: p.y > .12 and p.z < .5)
    return M


def make_mesh_object(M, name):
    bm = M.bm
    # robe/hair/hairwrap/glow giữ riêng, còn lại gộp 'body' + màu theo đỉnh
    slots = [OWN_MAT.get(key, 'body') for key in M.mats]
    uniq = list(dict.fromkeys(slots))
    cl = bm.loops.layers.float_color.new('Col') if 'body' in uniq else None
    for f in bm.faces:
        key = M.mats[f.material_index]
        if cl is not None:
            for lp in f.loops:
                lp[cl] = rgb(COLORS[key]) if key not in OWN_MAT else (1, 1, 1, 1)   # robe: trắng để mã nhân màu áo
        f.material_index = uniq.index(OWN_MAT.get(key, 'body'))
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    mesh = bpy.data.meshes.new(name + 'Mesh')
    bm.to_mesh(mesh)
    tris = len(mesh.polygons)
    bm.free()
    for p in mesh.polygons:
        p.use_smooth = True
    for key in uniq:
        mesh.materials.append(material(key))
    if cl is not None:
        mesh.color_attributes.active_color = mesh.color_attributes['Col']
        mesh.color_attributes.render_color_index = mesh.color_attributes.find('Col')
    ob = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(ob)
    for n in BONE_NAMES:
        ob.vertex_groups.new(name=n)
    return ob, tris


def material(key):
    mat = bpy.data.materials.get(key) or bpy.data.materials.new(key)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes.get('Principled BSDF')
    if key == 'body':
        bsdf.inputs['Base Color'].default_value = (1, 1, 1, 1)
        vc = next((n for n in nt.nodes if n.bl_idname == 'ShaderNodeVertexColor'), None) or nt.nodes.new('ShaderNodeVertexColor')
        vc.layer_name = 'Col'
        nt.links.new(vc.outputs['Color'], bsdf.inputs['Base Color'])
    else:
        bsdf.inputs['Base Color'].default_value = rgb(COLORS[key])
    bsdf.inputs['Roughness'].default_value = 0.8
    if key == 'glow':
        bsdf.inputs['Emission Color'].default_value = rgb(COLORS[key])
        bsdf.inputs['Emission Strength'].default_value = 2.5
        mat.use_backface_culling = False
    return mat


def make_rig():
    arm = bpy.data.armatures.new('AvatarArm')
    rig = bpy.data.objects.new('AvatarRig', arm)
    bpy.context.scene.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='EDIT')
    for n, p, h, t in BONES:
        eb = arm.edit_bones.new(n)
        eb.head, eb.tail = Vector(h), Vector(t)
        if p:
            eb.parent = arm.edit_bones[p]
    bpy.ops.object.mode_set(mode='OBJECT')
    return rig


def bind(mesh_ob, rig):
    mesh_ob.parent = rig
    mod = mesh_ob.modifiers.new('Armature', 'ARMATURE')
    mod.object = rig


# ───────────────────────── hoạt ảnh ─────────────────────────
def rest_rot(rig, bone):
    return rig.data.bones[bone].matrix_local.to_3x3()


def apply_pose(rig, pose):
    """pose: {xương: (rx, ry, rz) độ theo trục armature}; 'dz','dy' dời hông. Bên R lấy đối xứng từ L nếu không ghi."""
    full = dict(pose)
    for k, v in pose.items():
        if k.endswith('_L') and k[:-1] + 'R' not in pose:
            full[k[:-1] + 'R'] = (v[0], -v[1], -v[2])
    for n in BONE_NAMES:
        pb = rig.pose.bones[n]
        pb.rotation_mode = 'QUATERNION'
        rx, ry, rz = full.get(n, (0, 0, 0))
        W = Euler((math.radians(rx), math.radians(ry), math.radians(rz)), 'XYZ').to_matrix()
        R = rest_rot(rig, n)
        pb.rotation_quaternion = (R.inverted() @ W @ R).to_quaternion()
        if n == 'hips':
            d = Vector((0, full.get('dy', 0), full.get('dz', 0)))
            pb.location = R.inverted() @ d


def key_pose(rig, pose, frame):
    apply_pose(rig, pose)
    for n in BONE_NAMES:
        pb = rig.pose.bones[n]
        pb.keyframe_insert('rotation_quaternion', frame=frame)
        if n == 'hips':
            pb.keyframe_insert('location', frame=frame)


SIT_DZ, SIT_DY = 0.44, 0.0
JOIN = {'upper_arm_L': (-42, 46, 0), 'lower_arm_L': (-88, 0, -74), 'shoulder_L': (0, 0, 0)}


def joined(**extra):
    p = dict(JOIN)
    p.update(extra)
    return p


def pose_idle(t):
    s = math.sin(2 * math.pi * t)
    return {'upper_arm_L': (-3 + 1.5 * s, 22, 0), 'lower_arm_L': (-10, 0, 0),
            'chest': (-1.8 * s, 0, 0), 'spine': (1.0 * s, 0, 0), 'head': (1.5 * s, 0, 0),
            'shoulder_L': (0, 0, -1.5 * s), 'dz': -0.004 * (1 - math.cos(2 * math.pi * t))}


def pose_walk(t):
    f = 2 * math.pi * t
    s, c = math.sin(f), math.cos(f)
    flexL, flexR = 34 * max(0, c), 34 * max(0, -c)
    p = {'thigh_L': (-28 * s, 0, 0), 'thigh_R': (28 * s, 0, 0),
         'shin_L': (flexL + 4, 0, 0), 'shin_R': (flexR + 4, 0, 0),
         'upper_arm_L': (24 * s, 20, 0), 'upper_arm_R': (-24 * s, -20, 0),
         'lower_arm_L': (-12 - 10 * max(0, -s), 0, 0), 'lower_arm_R': (-12 - 10 * max(0, s), 0, 0),
         'chest': (0, 0, 5 * s), 'spine': (0, 0, -3 * s), 'head': (0, 0, -3 * s),
         'dz': -0.06 + 0.04 * abs(c), 'dy': 0.0}
    return p


def pose_sit(t):
    """Quỳ ngồi gọn (seiza): đùi chúc xuống phía trước, ống chân gập ra sau dưới mông, tay chắp ngực."""
    s = math.sin(2 * math.pi * t)
    p = joined(**{'thigh_L': (-62, 0, 9), 'shin_L': (150, 0, 0),
                  'upper_arm_L': (-36, 46, 0), 'lower_arm_L': (-84, 0, -74)})
    p.update({'dz': -SIT_DZ - 0.002 * s, 'dy': SIT_DY, 'chest': (2 * s + 2, 0, 0), 'spine': (1.0 * s, 0, 0), 'head': (3 + 1.5 * s, 0, 0)})
    return p


def pose_bow(t):
    """t từ 0 đến 1: chắp tay, cúi xuống, giữ một nhịp rồi đứng dậy."""
    if t < 0.45:
        k = (1 - math.cos(math.pi * t / 0.45)) / 2
    elif t < 0.62:
        k = 1.0
    else:
        k = (1 + math.cos(math.pi * (t - 0.62) / 0.38)) / 2
    p = joined(**{'upper_arm_L': (-40, 46, 0), 'lower_arm_L': (-86, 0, -74)})
    p.update({'spine': (30 * k, 0, 0), 'chest': (22 * k, 0, 0), 'neck': (10 * k, 0, 0), 'head': (8 * k, 0, 0),
              'dy': 0.06 * k, 'dz': -0.03 * k, 'thigh_L': (-6 * k, 0, 0), 'thigh_R': (-6 * k, 0, 0),
              'shin_L': (5 * k, 0, 0), 'shin_R': (5 * k, 0, 0)})
    return p


CLIPS = {'idle': (pose_idle, 50, 5, True), 'walk': (pose_walk, 25, 5, True),
         'sit': (pose_sit, 50, 5, True), 'bow': (pose_bow, 40, 4, False)}


def make_clips(rig):
    ad = rig.animation_data_create()
    for name, (fn, n, step, loop) in CLIPS.items():
        act = bpy.data.actions.new(name)
        ad.action = act
        for f in range(0, n + 1, step):
            key_pose(rig, fn(f / n if loop else f / n), f)
        act.use_fake_user = True
        track = ad.nla_tracks.new()
        track.name = name
        strip = track.strips.new(name, 0, act)
        strip.name = name
        ad.action = None
    for pb in rig.pose.bones:
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.location = (0, 0, 0)


def show_pose(rig, name, t):
    """Đặt nhân vật vào tư thế clip `name` tại thời điểm t (0..1) cho ảnh xem thử."""
    apply_pose(rig, CLIPS[name][0](t))
    bpy.context.view_layer.update()


# ───────────────────────── hào quang ─────────────────────────
def build_halo():
    M = Mesher()
    bm = M.bm
    m = M.mi('glow')
    seg, R, r, th = 16, .27, .232, .0075
    def V(x, y, z):
        return bm.verts.new((x, y, z))
    ring = []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        ring.append([V(R * math.cos(a), -th, R * math.sin(a)), V(r * math.cos(a), -th, r * math.sin(a)),
                     V(R * math.cos(a), th, R * math.sin(a)), V(r * math.cos(a), th, r * math.sin(a))])
    for i in range(seg):
        j = (i + 1) % seg
        a, b = ring[i], ring[j]
        for q in ((a[0], a[1], b[1], b[0]),      # mặt trước (hướng -Y)
                  (a[2], b[2], b[3], a[3]),      # mặt sau
                  (a[0], b[0], b[2], a[2]),      # vành ngoài
                  (a[1], a[3], b[3], b[1])):     # vành trong
            bm.faces.new(q).material_index = m
    for k in range(12):
        a = 2 * math.pi * k / 12 + math.pi / 12
        ln = .47 if k % 2 == 0 else .40
        ca, sa = math.cos(a), math.sin(a)
        pa, pb = a - .12, a + .12
        b1f = V(.292 * math.cos(pa), -th, .292 * math.sin(pa)); b2f = V(.292 * math.cos(pb), -th, .292 * math.sin(pb))
        b1b = V(.292 * math.cos(pa), th, .292 * math.sin(pa)); b2b = V(.292 * math.cos(pb), th, .292 * math.sin(pb))
        tip = V(ln * ca, 0, ln * sa)
        bm.faces.new((b1f, b2f, tip)).material_index = m
        bm.faces.new((b2b, b1b, tip)).material_index = m
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    ob, tris = make_mesh_object(M, 'HaoQuang')
    for vg in list(ob.vertex_groups):
        ob.vertex_groups.remove(vg)
    return ob, tris


# ───────────────────────── cảnh, đèn, ảnh ─────────────────────────
def new_scene():
    sc = bpy.data.scenes.get(SCENE) or bpy.data.scenes.new(SCENE)
    bpy.context.window.scene = sc
    for ob in list(sc.collection.all_objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    mine = {'namMesh', 'nuMesh', 'hair0Mesh', 'hair1Mesh', 'hair2Mesh', 'hair3Mesh', 'HaoQuangMesh', 'FloorMesh', 'AvatarArm', 'LitKey', 'LitFill', 'LitRim', 'CamStage',
            'idle', 'walk', 'sit', 'bow'}
    for coll in (bpy.data.meshes, bpy.data.armatures, bpy.data.actions, bpy.data.lights, bpy.data.cameras):
        for d in list(coll):
            if d.name.split('.')[0] in mine:
                coll.remove(d)
    sc.render.engine = 'BLENDER_EEVEE'
    sc.render.fps = FPS
    sc.view_settings.view_transform = 'Standard'
    if sc.world is None:
        sc.world = bpy.data.worlds.new('AvatarWorld')
    sc.world.use_nodes = True
    bg = sc.world.node_tree.nodes.get('Background')
    bg.inputs[0].default_value = rgb('#8c847a')
    bg.inputs[1].default_value = 0.85
    return sc


def stage(sc):
    mesh = bpy.data.meshes.new('FloorMesh')
    mesh.from_pydata([(-60, -60, 0), (60, -60, 0), (60, 60, 0), (-60, 60, 0)], [], [(0, 1, 2, 3)])
    fl = bpy.data.objects.new('FloorStage', mesh)
    sc.collection.objects.link(fl)
    mat = bpy.data.materials.get('FloorMat') or bpy.data.materials.new('FloorMat')
    mat.use_nodes = True
    mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = rgb('#9b9288')
    mat.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 1.0
    mesh.materials.append(mat)
    cam = bpy.data.objects.new('CamStage', bpy.data.cameras.new('CamStage'))
    sc.collection.objects.link(cam)
    cam.data.lens, cam.data.sensor_fit = 62, 'VERTICAL'
    cam.data.sensor_height = 36
    sc.camera = cam
    lights = []
    for nm, kind, energy, col in (('LitKey', 'SUN', 3.2, '#fff0dc'), ('LitFill', 'SUN', 1.1, '#cfdcff'), ('LitRim', 'SUN', 2.2, '#ffffff')):
        ld = bpy.data.lights.new(nm, kind)
        ld.energy, ld.color = energy, rgb(col)[:3]
        ld.angle = math.radians(18)
        lo = bpy.data.objects.new(nm, ld)
        sc.collection.objects.link(lo)
        lights.append(lo)
    return cam, lights


def aim(obj, loc, target):
    obj.location = loc
    obj.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()


def shoot(sc, cam, lights, path, az, tz=.8, dist=3.35, w=320, h=720, samples=48):
    a = math.radians(az)
    tgt = (0, 0, tz)
    aim(cam, (dist * math.sin(a), -dist * math.cos(a), tz + .18), tgt)
    for lo, off, el in zip(lights, (-38, 55, 165), (48, 25, 35)):
        b = a + math.radians(off)
        e = math.radians(el)
        aim(lo, (6 * math.sin(b) * math.cos(e), -6 * math.cos(b) * math.cos(e), tz + 6 * math.sin(e)), tgt)
    r = sc.render
    r.resolution_x, r.resolution_y, r.resolution_percentage = w, h, 100
    r.image_settings.file_format = 'PNG'
    r.image_settings.color_mode = 'RGB'
    try:
        sc.eevee.taa_render_samples = samples
    except Exception:
        pass
    r.filepath = path
    bpy.ops.render.render(write_still=True)


def montage(paths, out, w=1280, h=720, cols=None):
    import numpy as np
    tiles = []
    for p in paths:
        im = bpy.data.images.load(p)
        tw, th = im.size
        arr = np.empty(tw * th * 4, dtype=np.float32)
        im.pixels.foreach_get(arr)
        tiles.append(arr.reshape(th, tw, 4))
        bpy.data.images.remove(im)
    if cols:
        rows = [np.concatenate(tiles[i:i + cols], axis=1) for i in range(0, len(tiles), cols)]
        full = np.concatenate(rows[::-1], axis=0)       # pixel Blender đếm từ dưới lên
    else:
        full = np.concatenate(tiles, axis=1)
    img = bpy.data.images.new('MontageTmp', w, h)
    img.pixels.foreach_set(full.reshape(-1))
    img.file_format = 'JPEG'
    img.filepath_raw = out
    scn = bpy.context.scene
    scn.render.image_settings.file_format = 'JPEG'
    scn.render.image_settings.quality = 90
    img.save_render(out, scene=scn)
    bpy.data.images.remove(img)


def tri_count(ob):
    return len(ob.data.polygons)


def export(path, objs, anim):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    for o in bpy.context.scene.collection.all_objects:
        o.select_set(False)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    kw = dict(filepath=path, export_format='GLB', use_selection=True, export_yup=True, export_cameras=False,
              export_lights=False, use_active_scene=True, export_texcoords=False, export_apply=False, export_materials='EXPORT',
              export_vertex_color='ACTIVE')
    if anim:
        kw.update(export_animations=True, export_animation_mode='NLA_TRACKS', export_skins=True, export_optimize_animation_size=True,
                  export_frame_range=False)
    else:
        kw.update(export_animations=False, export_skins=False)
    bpy.ops.export_scene.gltf(**kw)


def show_hair(hairs, style):
    for i, ob in enumerate(hairs):
        ob.hide_render = i != style


def main():
    sc = new_scene()
    res = {'gender': GENDER}
    body, tris = make_mesh_object(build_body(), GENDER)
    rig = make_rig()
    bind(body, rig)
    hairs, htris = [], []
    for i in range(4):
        ho, ht = make_mesh_object(build_hair(i), f'hair{i}')
        bind(ho, rig)
        hairs.append(ho)
        htris.append(ht)
    make_clips(rig)
    res.update(body_tris=tris, hair_tris=htris, max_total_tris=tris + max(htris), bones=len(rig.data.bones),
               clips={k: round(v[1] / FPS, 2) for k, v in CLIPS.items()})
    if 'glb' in OUT:
        export(os.path.join(GLB_DIR, GENDER + '.glb'), [rig, body] + hairs, True)
        res['glb_kb'] = round(os.path.getsize(os.path.join(GLB_DIR, GENDER + '.glb')) / 1024, 1)
    if OUT & {'views', 'poses', 'hair'}:
        cam, lights = stage(sc)
        os.makedirs(TMP, exist_ok=True)
        rig.animation_data.use_nla = False
        show_hair(hairs, HAIR)
        if 'views' in OUT:
            show_pose(rig, 'idle', 0.25)
            paths = []
            for i, az in enumerate((0, 38, 90, 180)):
                p = os.path.join(TMP, f'v{i}.png')
                shoot(sc, cam, lights, p, az)
                paths.append(p)
            out = os.path.join(TMP if PREVIEW else IMG_DIR, f'nhan-vat-{GENDER}.jpg')
            montage(paths, out)
            res['views'] = out
        if 'poses' in OUT:
            paths = []
            halo = None
            for i, (name, t) in enumerate((('idle', .25), ('walk', .25), ('sit', .25), ('bow', .45))):
                show_pose(rig, name, t)
                if name == 'sit':
                    hp = rig.pose.bones['head'].matrix @ Vector((0, .19, 0))
                    halo, _ = build_halo()
                    halo.location = (0, .2, hp.z)
                    res['sit_pelvis_z'] = round((rig.pose.bones['hips'].matrix @ Vector((0, 0, 0))).z, 3)
                    res['sit_head_z'] = round(hp.z, 3)
                p = os.path.join(TMP, f'p{i}.png')
                shoot(sc, cam, lights, p, 48, tz=.8 if name != 'sit' else .62, dist=3.35 if name != 'sit' else 3.0)
                if halo:
                    bpy.data.objects.remove(halo, do_unlink=True)
                    halo = None
                paths.append(p)
            out = os.path.join(TMP if PREVIEW else IMG_DIR, 'nhan-vat-tu-the.jpg')
            montage(paths, out)
            res['poses'] = out
        if 'hair' in OUT:
            show_pose(rig, 'idle', 0.25)
            for i in range(4):
                show_hair(hairs, i)
                shoot(sc, cam, lights, os.path.join(TMP, f'hair_{GENDER}_{i}.png'), 115, tz=1.28, dist=1.55, w=320, h=360)
            both = [os.path.join(TMP, f'hair_{g}_{i}.png') for g in ('nam', 'nu') for i in range(4)]
            if all(os.path.exists(x) for x in both):
                out = os.path.join(TMP if PREVIEW else IMG_DIR, 'nhan-vat-toc.jpg')
                montage(both, out, cols=4)
                res['hair'] = out
        rig.animation_data.use_nla = True
    if 'halo' in OUT:
        halo, ht = build_halo()
        export(os.path.join(GLB_DIR, 'hao-quang.glb'), [halo], False)
        res['halo'] = {'tris': ht, 'glb_kb': round(os.path.getsize(os.path.join(GLB_DIR, 'hao-quang.glb')) / 1024, 1)}
    return res


result = main()
