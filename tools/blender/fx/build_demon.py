"""Chùa Tâm An · Ma Vương thấp đa giác, phần A của thẻ T-142.

Chạy bằng Blender 4.x/5.x, không giao diện:
    blender -b --python-expr "import runpy; runpy.run_path(
        r'<repo>/tools/blender/fx/build_demon.py', init_globals={
        'REPO': r'<repo>', 'OUT': ['glb', 'views', 'check'], 'PREVIEW': True})"
Biến điều khiển đọc từ globals():
    REPO: bắt buộc; LEVEL: chỉ nhận 4; OUT: mặc định ['check'].
    PREVIEW: mặc định True, ảnh vào TMP; False: docs/phap-tuong/anh/.
    TMP: mặc định <thư mục tạm>/phap_tuong.
Đầu ra: public/models/fx/demon-4.glb; ma-vuong-4-goc.jpg và
ma-vuong-tu-the.jpg. Chế độ check xuất GLB tạm để kiểm cả COLOR_0/1,
không ghi mô hình vào repo. Một dòng RESULT chứa số liệu và cảnh báo.

Đơn vị mét, Z lên, mặt nhìn -Y (= +Z khi xuất glTF), bên trái là +X.
Gốc ở thắt lưng; đuôi z=-0,95, đỉnh sừng z=1,82. Cảnh riêng
PhapTuongDemon, không lưu .blend, không dùng tài nguyên bên ngoài.
Mọi phần hình học, màu, trọng số và chuyển động đều sinh từ kịch bản.
"""

import json
import math
import os
import random
import struct
import tempfile

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector
from mathutils.bvhtree import BVHTree


REPO = globals().get('REPO')
if not REPO:
    raise SystemExit('Thiếu REPO')
LEVEL = int(globals().get('LEVEL', 4))
if LEVEL != 4:
    raise SystemExit('Cấp này làm ở T-145')
OUT = set(globals().get('OUT', ['check']))
if OUT - {'glb', 'views', 'check'}:
    raise SystemExit('OUT chỉ nhận glb, views, check')
PREVIEW = bool(globals().get('PREVIEW', True))
TMP = globals().get('TMP', os.path.join(tempfile.gettempdir(), 'phap_tuong'))
random.seed(14204)
SCENE, FPS = 'PhapTuongDemon', 25
OWNER = 'phap_tuong_owner'
GLB_PATH = os.path.join(REPO, 'public', 'models', 'fx', 'demon-4.glb')
IMG_DIR = TMP if PREVIEW else os.path.join(REPO, 'docs', 'phap-tuong', 'anh')
RES = {'level': LEVEL, 'warnings': [], 'over_budget': []}

# Mọi số đo hình học tập trung ở đây để T-145 thêm cấp mới.
SPEC = {4: {
    'tri_limit': 4000, 'kb_limit': 300,
    'colors': {'skin': '#5a1418', 'horn': '#2a1a14', 'claw': '#1a1010',
               'fang': '#f5f0e6', 'armor': '#3a2a22', 'smoke': '#3a0e10',
               'mouth': '#2a0606', 'eye': '#ffc23a'},
    'vein_width': .030, 'vein_lift': .002, 'vein_steps': 6,
    'torso': {
        'seg': 20, 'limit': 560,
        'front_power': .75, 'chest_lift': .02, 'cleft_depth': .025,
        'back_lift': .025, 'back_hump': .025,
        'rings': [(0, 0, .23, .23), (.15, -.005, .245, .23),
                  (.30, -.025, .29, .235), (.38, -.05, .35, .25),
                  (.45, -.075, .43, .275), (.50, -.095, .49, .29),
                  (.55, -.10, .54, .30), (.70, -.12, .575, .30),
                  (.75, -.12, .575, .30),
                  (.82, -.10, .55, .28), (.89, -.035, .36, .23),
                  (.95, 0, .20, .18)],
    },
    'back_spikes': {'limit': 30, 'levels': (.30, .4375, .575, .7125, .85),
                    'radius': .025, 'height': .06},
    'head': {
        'limit': 680, 'center': (0, -.04, 1.18), 'radius': (.308, .297, .33),
        'seg': 16, 'rings': 14,
        'neck': [((0, 0, .91), .15, .14), ((0, -.01, 1.06), .14, .14)],
        'jaw': [((0, -.128, 1.136), .176, .143),
                ((0, -.216, 1.004), .154, .099), ((0, -.161, .96), .099, .077)],
        'brow': ((.11, -.363, 1.298), (.105, .04, .035), 8, 3),
        'brow_angle': 18,
        'socket_radius': (.087, .018, .047),
        'nose': ((0, -.337, 1.197), (.042, .061, .039), 6, 3),
        'ear': [((.22, -.002, 1.224), .077), ((.319, .021, 1.235), .055),
                ((.429, .048, 1.356), .002)],
    },
    'mouth': {'limit': 84, 'seg': 12, 'center': (0, -.39, 1.092),
              'radius': (.143, .099), 'depth': .07, 'lip_width': .035},
    'horn': {
        'limit': 130, 'seg': 8,
        'path': [((.18, 0, 1.43), .08), ((.265, .006, 1.47), .086),
                 ((.375, .018, 1.51), .075), ((.415, .032, 1.57), .060),
                 ((.43, .045, 1.65), .045), ((.40, .056, 1.72), .030),
                 ((.365, .065, 1.79), .015), ((.351, .07, 1.82), 0)],
    },
    'small_horn': {'limit': 14, 'seg': 4,
                   'path': [((.187, -.183, 1.40), .052),
                            ((.198, -.216, 1.494), .033),
                            ((.198, -.251, 1.586), 0)]},
    'eyes': {'limit': 60, 'seg': 8,
             'pairs': [((.11, -.35, 1.257), (.072, .023, .032)),
                       ((-.11, -.35, 1.257), (.072, .023, .032)),
                       ((0, -.337, 1.389), (.036, .020, .082))]},
    'fangs': {'limit': 40, 'seg': 4,
              'upper': [((.10, -.395, 1.17), .025),
                        ((.083, -.414, 1.10), 0)],
              'lower': [((.112, -.395, 1.022), .023),
                        ((.099, -.414, 1.092), 0)]},
    'shoulder': {'limit': 180, 'center': (.55, 0, .85),
                 'radius': (.22, .24, .14), 'seg': 10, 'rings': 6,
                 'skirt': [((.57, -.02, .84), .205),
                           ((.65, -.14, .77), .195), ((.68, -.21, .72), .175)],
                 'spikes': [((.43, .015, .95), (.34, .025, 1.07), .047),
                            ((.57, .015, .97), (.67, .025, 1.10), .050),
                            ((.70, .025, .91), (.81, .04, 1.04), .046)]},
    'arm': {'limit': 200, 'seg': 8,
            'path': [((.55, 0, .82), .16), ((.675, -.20, .74), .17),
                     ((.80, -.40, .66), .12), ((.75, -.60, .62), .13),
                     ((.70, -.80, .58), .09)],
            'cuff_t': (.77, .80, .93, .96), 'cuff_radius': (.111, .121, .115, .101)},
    'hand': {'limit': 430, 'center': (.61, -.92, .58),
             'radius': (.11, .075, .12), 'seg': 10, 'rings': 5,
             'axis': (-.20, -.98, 0), 'finger_seg': 6,
             'finger_offsets': (-.09, -.045, 0, .045, .09),
             'finger_lengths': (.11, .155, .17, .155, .135),
             'finger_radius': (.0225, .024, .025, .024, .0225),
             'claw_length': .09, 'curl_degrees': 35, 'spread': .008,
             'wrist_overlap': .065},
    'tail': {'limit': 320, 'seg': 20, 'twist': 150, 'fin_scale': 1.15,
             'rings': [((0, 0, 0), .23, .23),
                       ((.015, .015, -.12), .215, .205),
                       ((.085, .04, -.26), .18, .16),
                       ((.13, .075, -.41), .145, .12),
                       ((.07, .09, -.56), .11, .085),
                       ((.04, .065, -.71), .07, .05),
                       ((.16, .035, -.85), .035, .025),
                       ((.246, .03, -.95), 0, 0)],
             'waist_fin_width': .10, 'waist_fin_steps': 32,
             'wisp_seg': 5,
             'wisps': [[((.13, .20, -.30), .040), ((.16, .25, -.46), .033),
                        ((.10, .25, -.63), .025), ((.04, .20, -.81), .014),
                        ((.15, .08, -.92), 0)],
                       [((-.13, .20, -.30), .036), ((-.16, .24, -.46), .030),
                        ((-.15, .23, -.63), .022), ((-.10, .18, -.80), .012),
                        ((.13, .10, -.90), 0)]]},
    'smoke_wisps': {'limit': 208}, 'tail_embers': {'limit': 6},
    'bones': [
        ('root', None, (0, 0, -.05), (0, 0, .10)),
        ('spine', 'root', (0, 0, 0), (0, 0, .45)),
        ('chest', 'spine', (0, 0, .45), (0, 0, .90)),
        ('neck', 'chest', (0, 0, .90), (0, 0, 1.05)),
        ('head', 'neck', (0, 0, 1.05), (0, 0, 1.45)),
        ('jaw', 'head', (0, -.05, 1.12), (0, -.24, 1.02)),
        ('tail1', 'root', (0, 0, 0), (0, 0, -.40)),
        ('tail2', 'tail1', (0, 0, -.40), (0, 0, -.75)),
        ('tail3', 'tail2', (0, 0, -.75), (0, 0, -1.15))],
    'sided_bones': [
        ('shoulder', 'chest', (.10, 0, .82), (.55, 0, .82)),
        ('upper_arm', 'shoulder', (.55, 0, .82), (.80, -.40, .66)),
        ('forearm', 'upper_arm', (.80, -.40, .66), (.70, -.80, .58)),
        ('hand', 'forearm', (.70, -.80, .58), (.61, -.92, .58))],
    'clips': {'emerge': (.9, False), 'idle': (4, True), 'drift': (1.6, True),
              'scoff': (2, True), 'peek': (2, True), 'taunt1': (2, False),
              'taunt2': (2, False), 'vanish': (.6, False)},
    'motion': {'breath_chest': 3, 'breath_spine': 1.5, 'arm_sway': 5,
               'head_sway': 4, 'tail_sway': 8, 'tail_phase': .25,
               'drift_spine': 5, 'drift_chest': 7, 'drift_arms': 25,
               'drift_tail': (15, 20, 25), 'drift_sway': 6,
               'scoff_chest': -30, 'scoff_head': -30, 'scoff_chin': -10,
               'fold_elbows': ((.72, -.66, .88), (-.72, -.62, .56)),
               'fold_wrists': ((.18, -.74, .88), (-.24, -.70, .50)),
               'quiet_breath': .6,
               'peek_side': 15, 'peek_forward': 20, 'peek_head': 20,
               'peek_tilt': 12, 'peek_upper': (.22, -.20, -.40),
               'peek_forearm': (-.08, -.36, -.22), 'peek_hand': (-.15, -.85, -.35),
               'roar_jaw': 25, 'roar_head': -20,
               'roar_upper': (.27, -.27, .36), 'roar_forearm': (.04, .03, .42),
               'roar_hand': (.05, -.12, 1),
               'taunt_tilt': 25, 'taunt_reach': -35, 'taunt_reach_yaw': 20, 'hand_flex': 30,
               'close_arms': 60, 'emerge_head': -15, 'vanish_head': 25,
               'small_scale': .05, 'overshoot': 1.08, 'overshoot_frame': 18,
               'sink': -1.1, 'roar_frames': (15, 35, 50), 'key_step': 5},
    'preview': {'owner_base': (0, -.55, -1.2), 'owner_height': 1.6,
                'owner_radius': .12, 'owner_head_radius': .105,
                'target_z': .30, 'distance': 6.8, 'lens': 40,
                'background': '#1b1a20', 'owner_color': '#9a9088'},
}}
S = SPEC[LEVEL]
BONES = list(S['bones'])
for side, sign in (('L', 1), ('R', -1)):
    for name, parent, head, tail in S['sided_bones']:
        BONES.append((name + '_' + side,
                      parent if parent == 'chest' else parent + '_' + side,
                      (head[0] * sign, head[1], head[2]),
                      (tail[0] * sign, tail[1], tail[2])))
BONE_NAMES = [b[0] for b in BONES]


def warn(message):
    """Ghi một lần để RESULT không bị lặp cảnh báo ở mỗi khung hình."""
    if message not in RES['warnings']:
        RES['warnings'].append(message)


def own(block):
    block[OWNER] = SCENE
    return block


# chép từ avatar/build.py
def rgb(hexs, a=1.0):
    h = hexs.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4
                 for v in c) + (a,)


def mirrored(point, sign):
    return Vector((point[0] * sign, point[1], point[2]))


def blend_weights(a, b, t):
    return {name: a.get(name, 0) * (1 - t) + b.get(name, 0) * t
            for name in set(a) | set(b)}


def torso_weights(z):
    t = min(1, max(0, (z - .30) / .30))
    return {'spine': 1 - t, 'chest': t}


def tail_weights(z):
    if z > -.20:
        # Trùng tiết diện và trọng số vòng eo, không hở đường nối khi thở.
        return blend_weights({'spine': 1}, {'tail1': 1}, max(0, -z / .20))
    if z > -.60:
        return blend_weights({'tail1': 1}, {'tail2': 1}, (-z - .20) / .40)
    return blend_weights({'tail2': 1}, {'tail3': 1}, min(1, (-z - .60) / .30))


def glow_value(key, co):
    """Chỉ mắt và hốc miệng tự phát sáng; vân/than có lưới riêng."""
    if key == 'eye':
        return 1.0
    if key == 'mouth':
        return .25
    return 0.0


def torso_profile(z):
    rings = S['torso']['rings']
    for a, b in zip(rings, rings[1:]):
        if a[0] <= z <= b[0]:
            t = (z - a[0]) / (b[0] - a[0])
            return tuple(x + (y - x) * t for x, y in zip(a[1:], b[1:]))
    return rings[0][1:] if z < rings[0][0] else rings[-1][1:]


def torso_surface(x, z, front):
    """Ngực rộng, rãnh giữa lõm; hai dải cơ lưng nổi thành chữ V."""
    torso = S['torso']
    y, rx, ry = torso_profile(z)
    sine = math.sqrt(max(0, 1 - (x / rx) ** 2))
    if front:
        chest = min(1, max(0, (z - .45) / .10), max(0, (.89 - z) / .14))
        cleft = torso['cleft_depth'] * max(0, 1 - abs(x) / .12) * chest
        power = 1 + (torso['front_power'] - 1) * chest
        return y - ry * sine ** power - torso['chest_lift'] * chest * sine + cleft
    envelope = min(1, max(0, (z - .20) / .15), max(0, (.95 - z) / .12))
    ridge_x = .08 + .52 * max(0, z - .30)
    relief = torso['back_lift'] * math.exp(-((abs(x) - ridge_x) / .095) ** 2) * envelope
    hump = torso['back_hump'] * math.exp(-((z - .79) / .15) ** 2) * sine
    return y + ry * sine + relief * sine + hump


def sculpt_torso(point, ring, index):
    front = math.sin(2 * math.pi * index / S['torso']['seg']) < 0
    return Vector((point.x, torso_surface(point.x, point.z, front), point.z))


# chép từ avatar/build.py; thêm màu hai lớp, nhãn bộ phận và tiết diện theo đường cong.
class Mesher:
    def __init__(self):
        self.bm = bmesh.new()
        self.dl = self.bm.verts.layers.deform.new()
        self.part_layer = self.bm.faces.layers.int.new('DemonPart')
        self.parts = []
        self.part = 0
        self.gi = {name: i for i, name in enumerate(BONE_NAMES)}
        self.vertex_colors = {}
        self.vertex_keys = {}

    def section(self, name):
        if name not in self.parts:
            self.parts.append(name)
        self.part = self.parts.index(name)

    def setw(self, vert, weights):
        total = sum(weights.values())
        if total <= 0:
            raise ValueError('Đỉnh không có trọng số')
        for name, weight in weights.items():
            if weight > 0:
                vert[self.dl][self.gi[name]] = weight / total

    def vertex(self, co, key, weights):
        vert = self.bm.verts.new(co)
        self.setw(vert, weights)
        self.vertex_colors[vert] = (rgb(S['colors'][key]), glow_value(key, co))
        self.vertex_keys[vert] = key
        return vert

    def face(self, vertices):
        face = self.bm.faces.new(vertices)
        face[self.part_layer] = self.part
        return face

    def sphere(self, key, center, radius, weights, seg=10, rings=6,
               transform=None, keep=None):
        # Tự tạo hai cực: số tam giác luôn bằng 2 * seg * (rings - 1).
        def point(local):
            v = Vector((local[0] * radius[0], local[1] * radius[1], local[2] * radius[2]))
            return Vector(center) + (transform @ v if transform is not None else v)

        top = self.vertex(point((0, 0, 1)), key, weights)
        bottom = self.vertex(point((0, 0, -1)), key, weights)
        rows = []
        for j in range(1, rings):
            phi = math.pi * j / rings
            rows.append([self.vertex(point((math.sin(phi) * math.cos(2 * math.pi * i / seg),
                                             math.sin(phi) * math.sin(2 * math.pi * i / seg),
                                             math.cos(phi))), key, weights) for i in range(seg)])
        faces = []
        for i in range(seg):
            k = (i + 1) % seg
            faces.append((top, rows[0][i], rows[0][k]))
            for j in range(len(rows) - 1):
                faces.append((rows[j][i], rows[j + 1][i], rows[j + 1][k], rows[j][k]))
            faces.append((rows[-1][i], bottom, rows[-1][k]))
        for vertices in faces:
            center_face = sum((v.co for v in vertices), Vector()) / len(vertices)
            if keep is None or keep(center_face):
                self.face(vertices)

    def almond(self, center, radius, weights):
        # Hạnh nhân 8 cạnh, hai cực theo Y: 16 tam giác/mắt, cả ba = 48.
        seg = S['eyes']['seg']
        row = [self.vertex((center[0] + radius[0] * math.cos(2 * math.pi * i / seg),
                            center[1], center[2] + radius[2] * math.sin(2 * math.pi * i / seg)),
                           'eye', weights) for i in range(seg)]
        front = self.vertex((center[0], center[1] - radius[1], center[2]), 'eye', weights)
        back = self.vertex((center[0], center[1] + radius[1], center[2]), 'eye', weights)
        for i in range(seg):
            j = (i + 1) % seg
            self.face((front, row[i], row[j]))
            self.face((back, row[j], row[i]))

    def loft(self, key, rings, seg=10, cap_top=True, cap_bot=True,
             along_path=False, twist=0, sculpt=None, fins=False):
        """Vòng (tâm, rx, ry, trọng số); bán kính 0 tạo một đỉnh nhọn thật."""
        rows = []
        for j, (center, rx, ry, weights) in enumerate(rings):
            if max(rx, ry) == 0:
                rows.append([self.vertex(center, key, weights)])
                continue
            if along_path:
                prev = Vector(rings[max(0, j - 1)][0])
                after = Vector(rings[min(len(rings) - 1, j + 1)][0])
                tangent = (after - prev).normalized()
                basis = Vector((0, 0, 1)).rotation_difference(tangent).to_matrix()
            else:
                basis = Matrix.Identity(3)
            angle = math.radians(twist) * j / max(1, len(rings) - 1)
            row = []
            for i in range(seg):
                a = 2 * math.pi * i / seg + angle
                # Ba gờ chạy liền theo vòng xoắn, không tạo nhánh như chân.
                scale = S['tail']['fin_scale'] if fins and j > 2 and i in (0, seg // 3, 2 * seg // 3) else 1
                point = Vector(center) + basis @ Vector((rx * math.cos(a) * scale,
                                                         ry * math.sin(a) * scale, 0))
                row.append(self.vertex(sculpt(point, j, i) if sculpt else point, key, weights))
            rows.append(row)
        for a, b in zip(rows, rows[1:]):
            for i in range(seg):
                k = (i + 1) % seg
                if len(a) == 1:
                    self.face((a[0], b[i], b[k]))
                elif len(b) == 1:
                    self.face((a[i], b[0], a[k]))
                else:
                    self.face((a[i], b[i], b[k], a[k]))
        if cap_top and len(rows[0]) > 1:
            self.face(rows[0][::-1])
        if cap_bot and len(rows[-1]) > 1:
            self.face(rows[-1])


def build_body():
    mesh = Mesher()
    mesh.section('torso')
    torso = S['torso']
    mesh.loft('skin', [((0, y, z), rx, ry, torso_weights(z))
                       for z, y, rx, ry in torso['rings']], seg=torso['seg'],
              sculpt=sculpt_torso, cap_top=False)

    mesh.section('back_spikes')
    for z in S['back_spikes']['levels']:
        y = torso_surface(0, z, False)
        r = S['back_spikes']['radius']
        mesh.loft('horn', [((0, y - .008, z), r, r, torso_weights(z)),
                           ((0, y + S['back_spikes']['height'], z), 0, 0, torso_weights(z))],
                  seg=4, along_path=True)

    mesh.section('head')
    h = S['head']
    # Bỏ mặt trong hốc miệng; khoang tối và hàm kín che lỗ ở cả góc ngang.
    mesh.sphere('skin', h['center'], h['radius'], {'head': 1}, h['seg'], h['rings'],
                keep=lambda p: not (p.y < -.19 and
                                    (p.x / .165) ** 2 + ((p.z - 1.092) / .112) ** 2 < 1))
    mesh.loft('skin', [(c, rx, ry, {'neck': 1}) for c, rx, ry in h['neck']], seg=10)
    jaw_rings = [(c, rx, ry, {'jaw': 1}) for c, rx, ry in h['jaw']]
    mesh.loft('skin', jaw_rings, seg=8)
    c, r, seg, rings = h['nose']
    mesh.sphere('skin', c, r, {'head': 1}, seg, rings)
    for sign in (1, -1):
        mesh.sphere('claw', (.11 * sign, -.338, 1.257), h['socket_radius'],
                    {'head': 1}, 8, 3)
        c, r, seg, rings = h['brow']
        # Đầu trong thấp hơn đầu ngoài: mày xếch 18°, nhô trước mắt 4 cm.
        tilt = Matrix.Rotation(math.radians(-sign * h['brow_angle']), 3, 'Y')
        mesh.sphere('horn', mirrored(c, sign), r, {'head': 1}, seg, rings, transform=tilt)
        mesh.loft('skin', [(mirrored(c, sign), r, r, {'head': 1})
                           for c, r in h['ear']], seg=4, along_path=True)

    mesh.section('mouth')
    build_mouth(mesh)

    for side, sign in (('L', 1), ('R', -1)):
        mesh.section('horn_' + side)
        mesh.loft('horn', [(mirrored(c, sign), r, r, {'head': 1})
                           for c, r in S['horn']['path']], seg=S['horn']['seg'], along_path=True)
        mesh.section('small_horn_' + side)
        mesh.loft('horn', [(mirrored(c, sign), r, r, {'head': 1})
                           for c, r in S['small_horn']['path']],
                  seg=S['small_horn']['seg'], along_path=True)

    mesh.section('eyes')
    for center, radius in S['eyes']['pairs']:
        mesh.almond(center, radius, {'head': 1})

    mesh.section('fangs')
    for sign in (1, -1):
        for key, bone in (('upper', 'head'), ('lower', 'jaw')):
            mesh.loft('fang', [(mirrored(c, sign), r, r, {bone: 1})
                               for c, r in S['fangs'][key]],
                      seg=S['fangs']['seg'], along_path=True)

    for side, sign in (('L', 1), ('R', -1)):
        shoulder, upper, forearm, hand = [name + '_' + side for name in
                                         ('shoulder', 'upper_arm', 'forearm', 'hand')]
        mesh.section('shoulder_' + side)
        sh = S['shoulder']
        mesh.sphere('armor', mirrored(sh['center'], sign), sh['radius'],
                    {shoulder: .5, upper: .5}, sh['seg'], sh['rings'])
        mesh.loft('armor', [(mirrored(c, sign), r, r * .80, {upper: 1})
                            for c, r in sh['skirt']], seg=8, along_path=True,
                  cap_top=False, cap_bot=False)
        for start, end, radius in sh['spikes']:
            mesh.loft('horn', [(mirrored(start, sign), radius, radius, {shoulder: .5, upper: .5}),
                               (mirrored(end, sign), 0, 0, {shoulder: .5, upper: .5})],
                      seg=4, along_path=True)

        mesh.section('arm_' + side)
        arm = S['arm']
        weights = [{shoulder: .5, upper: .5}, {upper: 1}, {upper: .5, forearm: .5},
                   {forearm: 1}, {forearm: .5, hand: .5}]
        mesh.loft('skin', [(mirrored(c, sign), r, r, w)
                           for (c, r), w in zip(arm['path'], weights)],
                  seg=arm['seg'], along_path=True)
        elbow, wrist = Vector(arm['path'][2][0]), Vector(arm['path'][-1][0])
        mesh.loft('armor', [(mirrored(elbow.lerp(wrist, t), sign), r, r,
                             blend_weights({forearm: 1}, {forearm: .5, hand: .5},
                                           max(0, (t - .80) / .16)))
                            for t, r in zip(arm['cuff_t'], arm['cuff_radius'])],
                  seg=arm['seg'], along_path=True)

        mesh.section('hand_' + side)
        build_hand(mesh, side, sign)

    mesh.section('tail')
    tail = S['tail']
    mesh.loft('smoke', [(c, rx, ry, tail_weights(c[2])) for c, rx, ry in tail['rings']],
              seg=tail['seg'], twist=tail['twist'], fins=True, cap_top=False)
    mesh.section('smoke_wisps')
    for path in tail['wisps']:
        mesh.loft('smoke', [(c, r, r, tail_weights(c[2])) for c, r in path],
                  seg=tail['wisp_seg'], along_path=True)
    build_waist_fins(mesh)
    return mesh


def build_waist_fins(mesh):
    """Hai dải khói mỏng rộng 10 cm cuốn eo; vật liệu nhìn được cả hai mặt."""
    tail = S['tail']
    for phase in (0, math.pi):
        rows = []
        for i in range(tail['waist_fin_steps'] + 1):
            t = i / tail['waist_fin_steps']
            z = -.48 * t
            for a, b in zip(tail['rings'], tail['rings'][1:]):
                if b[0][2] <= z <= a[0][2]:
                    k = (z - a[0][2]) / (b[0][2] - a[0][2])
                    center = Vector(a[0]).lerp(Vector(b[0]), k)
                    rx, ry = (a[j] + (b[j] - a[j]) * k for j in (1, 2))
                    break
            angle = phase + math.radians(220) * t
            radial = Vector((math.cos(angle), math.sin(angle), 0))
            base = center + Vector((rx * radial.x, ry * radial.y, 0))
            width = tail['waist_fin_width'] * math.sin(math.pi * t)
            # Mép trong chìm 3 mm vào da để không có khe quanh eo.
            rows.append([mesh.vertex(base - radial * .003, 'smoke', tail_weights(z)),
                         mesh.vertex(base + radial * width + Vector((0, 0, .035 * math.sin(math.pi * t))),
                                     'smoke', tail_weights(z))])
        for a, b in zip(rows, rows[1:]):
            mesh.face((a[0], a[1], b[1], b[0]))


def build_mouth(mesh):
    """Môi sẫm bao quanh hốc lõm 7 cm, vòm họng tối có COLOR_1=0,25."""
    mouth = S['mouth']
    center = Vector(mouth['center'])
    rx, rz = mouth['radius']
    seg = mouth['seg']
    rows = []
    for key, y, scale in (('skin', .045, 1 + mouth['lip_width'] / rx),
                           ('skin', 0, 1), ('mouth', 0, 1),
                           ('mouth', mouth['depth'], .72)):
        row = []
        for i in range(seg):
            a = 2 * math.pi * i / seg
            z = center.z + rz * math.sin(a) * scale
            x = rx * math.cos(a) * scale
            lip_y = center.y + y
            if not rows:
                # Vòng môi ngoài bám vỏ sọ; mặt nghiêng không thấy môi nổi rời.
                h = S['head']
                ellipsoid = max(0, 1 - (x / h['radius'][0]) ** 2
                                - ((z - h['center'][2]) / h['radius'][2]) ** 2)
                lip_y = h['center'][1] - h['radius'][1] * math.sqrt(ellipsoid) - .003
            # Mép dưới đi cùng hàm, mép trên đi cùng đầu.
            jaw = max(0, min(1, (center.z + .035 - z) / .07))
            row.append(mesh.vertex((x, lip_y, z),
                                   key, {'head': 1 - jaw, 'jaw': jaw}))
        rows.append(row)
    for a, b in ((rows[0], rows[1]), (rows[2], rows[3])):
        for i in range(seg):
            j = (i + 1) % seg
            mesh.face((a[i], a[j], b[j], b[i]))
    back = mesh.vertex(center + Vector((0, mouth['depth'], 0)), 'mouth', {'head': .5, 'jaw': .5})
    for i in range(seg):
        mesh.face((rows[3][i], rows[3][(i + 1) % seg], back))


def build_hand(mesh, side, sign):
    """Năm ngón hai đốt, móng cong, cùng trọng số hand; không thêm xương ngón."""
    h = S['hand']
    long_axis = mirrored(h['axis'], sign).normalized()
    normal = Vector((-sign, 0, 0))
    width_axis = normal.cross(long_axis).normalized()
    normal = long_axis.cross(width_axis).normalized()
    basis = Matrix((width_axis, normal, long_axis)).transposed()
    center = mirrored(h['center'], sign)
    weight = {'hand_' + side: 1}

    def world(point):
        return center + basis @ Vector(point)

    # Cổ bàn tay đi lùi vào cẳng tay 6,5 cm. Toàn bộ phần này và lòng/ngón
    # đều theo hand 100%; vòng cuối cẳng tay vẫn chia forearm/hand 50/50.
    wrist = mirrored(S['arm']['path'][-1][0], sign)
    fore_axis = (wrist - mirrored(S['arm']['path'][-2][0], sign)).normalized()
    mesh.loft('skin', [(wrist - fore_axis * h['wrist_overlap'], .095, .09, weight),
                       (wrist, .10, .09, weight),
                       (center - long_axis * .04, .08, .06, weight)],
              seg=8, along_path=True)
    mesh.sphere('skin', center, h['radius'], weight, h['seg'], h['rings'], transform=basis)
    for i, (offset, length, radius) in enumerate(zip(h['finger_offsets'], h['finger_lengths'], h['finger_radius'])):
        spread = (i - 2) * h['spread']
        start = Vector((offset, 0, h['radius'][2] * (.25 if i == 0 else .55)))
        angle = math.radians(h['curl_degrees'])
        middle = start + Vector((spread * .5, length * (1 - math.cos(angle / 2)) / angle,
                                 length * math.sin(angle / 2) / angle))
        end = start + Vector((spread, length * (1 - math.cos(angle)) / angle,
                              length * math.sin(angle) / angle))
        knuckle = middle.lerp(end, .18)
        mesh.loft('skin', [(world(start), radius, radius, weight),
                           (world(middle), radius * 1.04, radius * 1.04, weight),
                           (world(knuckle), radius * .90, radius * .90, weight),
                           (world(end), radius * .72, radius * .72, weight)],
                  seg=h['finger_seg'], cap_top=False, along_path=True)
        # Chỉ đốt móng cuối nhọn; ngón dày cong về phía trụ chủ ở giữa hai tay.
        claw_angle = math.radians(h['curl_degrees'] + 20)
        tip = end + Vector((-spread * .20, h['claw_length'] * math.sin(claw_angle),
                             h['claw_length'] * math.cos(claw_angle)))
        bend = end.lerp(tip, .5) + Vector((0, -.006, .006))
        mesh.loft('claw', [(world(end), radius * .66, radius * .66, weight),
                           (world(bend), radius * .38, radius * .38, weight),
                           (world(tip), 0, 0, weight)],
                  seg=h['finger_seg'], cap_top=False, along_path=True)


def part_limits():
    limits = {name: S[name]['limit'] for name in
              ('torso', 'head', 'mouth', 'eyes', 'fangs', 'tail',
               'back_spikes', 'smoke_wisps', 'tail_embers')}
    for side in ('L', 'R'):
        for name in ('horn', 'small_horn', 'shoulder', 'arm', 'hand'):
            limits[name + '_' + side] = S[name]['limit']
    return limits


def add_lava_veins(source):
    """Mười dải cong: bốn ngực/bụng, hai lưng, hai bắp tay, hai cẳng tay.

    Chiếu từng mép dải lên chính tam giác da, nội suy cả trọng số để dải
    bám da khi thở/gập tay. Không tạo đường đồng mức nhiễu khép vòng.
    """
    bm = source.bm
    bm.normal_update()
    reverse_groups = {i: name for name, i in source.gi.items()}

    def weights_at(face, point):
        a, b, c = face.verts
        u, v, p = b.co - a.co, c.co - a.co, point - a.co
        uu, uv, vv = u.dot(u), u.dot(v), v.dot(v)
        divisor = uu * vv - uv * uv
        t = (vv * p.dot(u) - uv * p.dot(v)) / divisor
        s = (uu * p.dot(v) - uv * p.dot(u)) / divisor
        values = [max(0, min(1, w)) for w in (1 - t - s, t, s)]
        weights = {}
        for vert, factor in zip((a, b, c), values):
            for group, weight in vert[source.dl].items():
                name = reverse_groups[group]
                weights[name] = weights.get(name, 0) + factor * weight
        return weights

    # Chụp lưới da trước khi thêm dải, tránh chiếu lên dải vừa tạo.
    surfaces = {}
    for part in ('torso', 'arm_L', 'arm_R'):
        faces = [f for f in bm.faces if source.parts[f[source.part_layer]] == part
                 and all(source.vertex_keys[v] == 'skin' for v in f.verts)]
        coordinates = [v.co.copy() for face in faces for v in face.verts]
        polygons = [tuple(range(i, i + 3)) for i in range(0, len(coordinates), 3)]
        surfaces[part] = (BVHTree.FromPolygons(coordinates, polygons, all_triangles=True), faces)

    strips = []
    for side, sign in (('L', 1), ('R', -1)):
        # Các nhánh V dài 0,25–0,50 m, đầu dưới hướng về rốn/sống lưng.
        strips.extend([
            ('torso', Vector((sign * .41, -.65, .80)), Vector((sign * .15, -.65, .45)),
             Vector((sign * .26, -.65, .68)), Vector((0, -1, 0))),
            ('torso', Vector((sign * .15, -.65, .45)), Vector((sign * .025, -.65, .22)),
             Vector((sign * .11, -.65, .30)), Vector((0, -1, 0))),
            ('torso', Vector((sign * .35, .50, .76)), Vector((sign * .045, .50, .49)),
             Vector((sign * .19, .50, .67)), Vector((0, 1, 0))),
        ])
        start = mirrored(S['arm']['path'][0][0], sign)
        elbow = mirrored(S['arm']['path'][2][0], sign)
        tangent = (elbow - start).normalized()
        outward = Vector((0, -1, 0))
        outward = (outward - tangent * outward.dot(tangent)).normalized()
        a, b = start.lerp(elbow, .12), start.lerp(elbow, .95)
        strips.append(('arm_' + side, a, b, a.lerp(b, .5) + Vector((sign * .025, 0, .02)), outward))
        wrist = mirrored(S['arm']['path'][-1][0], sign)
        tangent = (wrist - elbow).normalized()
        outward = Vector((sign, 0, 0))
        outward = (outward - tangent * outward.dot(tangent)).normalized()
        # Dừng trước vòng giáp cổ tay, không chiếu xuyên sang mặt sau cẳng tay.
        a, b = elbow.lerp(wrist, .16), elbow.lerp(wrist, .71)
        strips.append(('arm_' + side, a, b, a.lerp(b, .5) + Vector((0, 0, .02)), outward))

    lengths = []
    for part, start, end, control, outward in strips:
        tree, faces = surfaces[part]
        source.section(part)
        rows, centers = [], []
        for i in range(S['vein_steps'] + 1):
            t = i / S['vein_steps']
            center = (1 - t) ** 2 * start + 2 * (1 - t) * t * control + t ** 2 * end
            tangent = 2 * (1 - t) * (control - start) + 2 * t * (end - control)
            across = tangent.cross(outward).normalized() * (S['vein_width'] / 2)
            row, positions = [], []
            for offset in (-across, across):
                origin = center + offset + outward
                point, normal, index, distance = tree.ray_cast(origin, -outward, 3)
                if point is None:
                    raise RuntimeError('Dải dung nham không chạm da: ' + part)
                weights = weights_at(faces[index], point)
                vert = source.vertex(point + outward * S['vein_lift'], 'skin', weights)
                source.vertex_colors[vert] = (rgb(S['colors']['skin']), .85)
                row.append(vert)
                positions.append(point)
            rows.append(row)
            centers.append((positions[0] + positions[1]) / 2)
        for a, b in zip(rows, rows[1:]):
            source.face((a[0], a[1], b[1], b[0]))
        lengths.append(round(sum((b - a).length for a, b in zip(centers, centers[1:])), 4))
    RES['lava_vein_strips'] = len(strips)
    RES['lava_vein_segments'] = len(strips) * S['vein_steps']
    RES['lava_vein_lengths'] = lengths
    RES['lava_vein_width'] = S['vein_width']

    # Sáu tam giác than li ti 4–7 mm, không tô sáng cả mặt/đỉnh của đuôi.
    tail_faces = [f for f in bm.faces if source.parts[f[source.part_layer]] == 'tail']
    source.section('tail_embers')
    used = set()
    for i, z in enumerate((-.33, -.44, -.55, -.66, -.78, -.90)):
        face = min((f for f in tail_faces if f not in used),
                   key=lambda f: abs(f.calc_center_median().z - z)
                   + .15 * abs(f.calc_center_median().x - (.06 if i % 2 else -.06))
                   + .10 * f.calc_center_median().y)
        used.add(face)
        center = face.calc_center_median()
        scale = min(.12, .007 / max((v.co - center).length for v in face.verts))
        vertices = []
        for v in face.verts:
            point = center.lerp(v.co, scale)
            vert = source.vertex(point + face.normal * S['vein_lift'], 'smoke', weights_at(face, point))
            source.vertex_colors[vert] = (rgb(S['colors']['smoke']), .4)
            vertices.append(vert)
        source.face(vertices)
    RES['tail_ember_points'] = len(used)


# chép từ avatar/build.py; dùng cùng giá trị ở các góc chung để tránh nhân đỉnh khi xuất.
def make_mesh_object(source, name):
    bm = source.bm
    # Loại các đỉnh cô lập còn sót sau khi khoét miệng.
    isolated = [v for v in bm.verts if not v.link_faces]
    if isolated:
        bmesh.ops.delete(bm, geom=isolated, context='VERTS')
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    add_lava_veins(source)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    # Chặn cứng COLOR_1 ở gáy và bả vai sau, kể cả đỉnh dải chiếu sát biên.
    for vert in bm.verts:
        x, y, z = vert.co
        rear_parts = {source.parts[f[source.part_layer]] for f in vert.link_faces}
        if ((y > -.02 and z > .92)
                or (y > 0 and z > .77 and abs(x) > .30)
                or (y >= 0 and any(p.startswith('shoulder_') for p in rear_parts))):
            color, glow = source.vertex_colors[vert]
            source.vertex_colors[vert] = (color, 0.0)
    counts = {name: 0 for name in source.parts}
    for face in bm.faces:
        counts[source.parts[face[source.part_layer]]] += 1
    eye_vertices = [v for v in bm.verts if source.vertex_keys[v] == 'eye']
    RES['eye_y_bounds'] = [round(min(v.co.y for v in eye_vertices), 4),
                           round(max(v.co.y for v in eye_vertices), 4)]
    if RES['eye_y_bounds'][1] >= -.20:
        RES['over_budget'].append('đỉnh mắt chưa nằm hẳn trước vỏ sọ')
    for side in ('L', 'R'):
        index = source.gi['hand_' + side]
        palm_vertices = {v for f in bm.faces if source.parts[f[source.part_layer]] == 'hand_' + side
                         for v in f.verts}
        if any(abs(v[source.dl].get(index, 0) - 1) > 1e-6 for v in palm_vertices):
            RES['over_budget'].append('bàn tay ' + side + ' chưa theo hand 100%')
    bm.verts.index_update()
    vertex_colors = [source.vertex_colors[vert] for vert in bm.verts]
    # Nhãn phục vụ đếm không được đưa vào GLB.
    bm.faces.layers.int.remove(source.part_layer)
    data = own(bpy.data.meshes.new(SCENE + 'Mesh'))
    bm.to_mesh(data)
    bm.free()
    data.update()
    # POINT giúp dùng chung đỉnh; BYTE_COLOR đủ chính xác cho bảng màu, tiết kiệm GLB.
    col_layer = data.color_attributes.new(name='Col', type='BYTE_COLOR', domain='POINT')
    glow_layer = data.color_attributes.new(name='Glow', type='BYTE_COLOR', domain='POINT')
    for i, (color, glow) in enumerate(vertex_colors):
        col_layer.data[i].color = color
        glow_layer.data[i].color = (glow, glow, glow, 1)
    for polygon in data.polygons:
        polygon.use_smooth = True
    try:
        data.color_attributes.active_color = data.color_attributes['Col']
        data.color_attributes.render_color_index = data.color_attributes.find('Col')
    except Exception as exc:
        warn('Không đặt được màu kích hoạt/render: ' + str(exc))
    data.materials.append(material())
    obj = own(bpy.data.objects.new(name, data))
    bpy.context.scene.collection.objects.link(obj)
    for name in BONE_NAMES:
        obj.vertex_groups.new(name=name)
    return obj, counts


# chép từ avatar/build.py; một vật liệu xem thử, trình duyệt thay bằng spiritMaterial.
def material():
    mat = own(bpy.data.materials.new('spirit'))
    if mat.name != 'spirit':
        warn('Tên spirit đã được cảnh khác dùng; vật liệu mới là ' + mat.name)
    mat.use_nodes = True
    mat.diffuse_color = rgb(S['colors']['skin'], .9)
    tree = mat.node_tree
    bsdf = tree.nodes.get('Principled BSDF')
    color = tree.nodes.new('ShaderNodeVertexColor')
    color.layer_name = 'Col'
    glow = tree.nodes.new('ShaderNodeVertexColor')
    glow.layer_name = 'Glow'
    multiply = tree.nodes.new('ShaderNodeMixRGB')
    multiply.blend_type = 'MULTIPLY'
    multiply.inputs[0].default_value = 1
    # Mắt/vân giữ màu lửa; mask 0,25 của họng dùng màu #2a0606 nên vẫn tối.
    # Không nhân màu cam cố định vào hốc miệng như vòng trước.
    bright = tree.nodes.new('ShaderNodeMath')
    bright.operation = 'GREATER_THAN'
    bright.inputs[1].default_value = .5
    tint = tree.nodes.new('ShaderNodeMixRGB')
    tint.blend_type = 'MIX'
    tint.inputs[2].default_value = rgb('#ff7a1a')
    tree.links.new(glow.outputs['Color'], bright.inputs[0])
    tree.links.new(bright.outputs[0], tint.inputs[0])
    tree.links.new(color.outputs['Color'], tint.inputs[1])
    tree.links.new(tint.outputs[0], multiply.inputs[2])
    tree.links.new(color.outputs['Color'], bsdf.inputs['Base Color'])
    tree.links.new(glow.outputs['Color'], multiply.inputs[1])
    emission = bsdf.inputs.get('Emission Color')
    if emission is None:
        emission = bsdf.inputs.get('Emission')
        warn('Principled dùng tên Emission cũ thay cho Emission Color')
    if emission is not None:
        tree.links.new(multiply.outputs[0], emission)
    else:
        warn('Không có cổng màu phát sáng của Principled')
    strength = bsdf.inputs.get('Emission Strength')
    if strength is not None:
        strength.default_value = 3
    else:
        warn('Không có cổng Emission Strength')
    bsdf.inputs['Alpha'].default_value = .9
    bsdf.inputs['Roughness'].default_value = .75
    mat.use_backface_culling = False
    try:
        mat.surface_render_method = 'DITHERED'
    except Exception as exc:
        warn('surface_render_method không dùng được; thử blend_method: ' + str(exc))
        try:
            mat.blend_method = 'HASHED'
        except Exception as fallback_exc:
            warn('Không bật được vật liệu trong suốt: ' + str(fallback_exc))
    return mat


# chép từ avatar/build.py
def make_rig():
    arm = own(bpy.data.armatures.new(SCENE + 'Arm'))
    rig = own(bpy.data.objects.new('MaVuongRig', arm))
    bpy.context.scene.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    try:
        for name, parent, head, tail in BONES:
            bone = arm.edit_bones.new(name)
            bone.head, bone.tail = Vector(head), Vector(tail)
        # Tạo hết xương trước khi nối cha, không phụ thuộc thứ tự bảng SPEC.
        for name, parent, head, tail in BONES:
            if parent:
                arm.edit_bones[name].parent = arm.edit_bones[parent]
    finally:
        bpy.ops.object.mode_set(mode='OBJECT')
    return rig


# chép từ avatar/build.py
def bind(mesh_ob, rig):
    mesh_ob.parent = rig
    modifier = mesh_ob.modifiers.new('Armature', 'ARMATURE')
    modifier.object = rig


# chép từ avatar/build.py; thêm reset vị trí và scale của mọi xương.
def apply_pose(rig, pose):
    for name in BONE_NAMES:
        bone = rig.pose.bones[name]
        rest = rig.data.bones[name].matrix_local.to_3x3()
        bone.rotation_mode = 'QUATERNION'
        world_rotation = Euler(tuple(math.radians(v) for v in pose.get(name, (0, 0, 0))), 'XYZ').to_matrix()
        bone.rotation_quaternion = (rest.inverted() @ world_rotation @ rest).to_quaternion()
        bone.location = (0, 0, 0)
        bone.scale = (1, 1, 1)
        if name == 'root':
            bone.location = rest.inverted() @ Vector((0, 0, pose.get('dz', 0)))
            bone.scale = (pose.get('scale', 1),) * 3


# chép từ avatar/build.py; root có cả location và scale, dùng khung lẻ được.
def key_pose(rig, pose, frame):
    apply_pose(rig, pose)
    for name in BONE_NAMES:
        bone = rig.pose.bones[name]
        bone.keyframe_insert(data_path='rotation_quaternion', frame=frame, group=name)
        if name == 'root':
            bone.keyframe_insert(data_path='location', frame=frame, group=name)
            bone.keyframe_insert(data_path='scale', frame=frame, group=name)


def pose_idle(t):
    a = 2 * math.pi * t
    m = S['motion']
    pose = {'chest': (m['breath_chest'] * math.sin(a), 0, 0),
            'spine': (m['breath_spine'] * math.sin(a), 0, 0),
            'head': (0, 0, m['head_sway'] * math.sin(a))}
    for side, phase in (('L', 0), ('R', math.pi)):
        pose['upper_arm_' + side] = (m['arm_sway'] * math.sin(a + phase), 0, 0)
    for i in range(3):
        pose['tail' + str(i + 1)] = (0, m['tail_sway'] * math.sin(a + i * 2 * math.pi * m['tail_phase']), 0)
    return pose


def mix_pose(a, b, factor):
    """Nội suy cả kênh ngầm định; tránh rơi về tư thế nghỉ ở cuối clip."""
    pose = {}
    for key in set(a) | set(b):
        default = (0, 0, 0) if key in BONE_NAMES else (1 if key == 'scale' else 0)
        start, end = a.get(key, default), b.get(key, default)
        pose[key] = tuple(x + (y - x) * factor for x, y in zip(start, end)) if isinstance(start, tuple) else start + (end - start) * factor
    return pose


def aim_arm(pose, side, upper_direction, fore_direction, hand_direction):
    """Đổi hướng tay trong không gian ngực thành góc tương đối từng xương.

    Bù góc cha khi nhắm cẳng/bàn tay, tránh cộng lặp góc gập lên chuỗi mới.
    Không đổi xương, chiều dài hay cách ghi/xuất clip.
    """
    sign = 1 if side == 'L' else -1
    path = S['arm']['path']
    upper_rest = mirrored(path[2][0], sign) - mirrored(path[0][0], sign)
    fore_rest = mirrored(path[-1][0], sign) - mirrored(path[2][0], sign)
    hand_rest = mirrored(S['hand']['axis'], sign)
    upper = upper_rest.normalized().rotation_difference(Vector(upper_direction).normalized())
    fore = fore_rest.normalized().rotation_difference(Vector(fore_direction).normalized())
    hand = hand_rest.normalized().rotation_difference(Vector(hand_direction).normalized())
    for name, rotation in (('upper_arm', upper), ('forearm', upper.inverted() @ fore),
                            ('hand', fore.inverted() @ hand)):
        pose[name + '_' + side] = tuple(math.degrees(v) for v in rotation.to_euler('XYZ'))


def fold_arm(pose, side, wrist, pole):
    """Giải hai đoạn tay theo cổ tay đích, khuỷu luôn ở trước mặt ngực.

    Hai cổ tay lệch cao 38 cm, cách mặt ngực ít nhất khoảng 25 cm.
    Chiều dài lấy đúng lưới/xương nghỉ, không kéo giãn cánh tay.
    """
    sign = 1 if side == 'L' else -1
    path = S['arm']['path']
    shoulder, elbow_rest, wrist_rest = [mirrored(path[i][0], sign) for i in (0, 2, -1)]
    upper_length, fore_length = (elbow_rest - shoulder).length, (wrist_rest - elbow_rest).length
    reach = Vector(wrist) - shoulder
    distance = min(reach.length, upper_length + fore_length - .001)
    axis = reach.normalized()
    along = (upper_length ** 2 - fore_length ** 2 + distance ** 2) / (2 * distance)
    bend = Vector(pole) - shoulder
    bend = (bend - axis * bend.dot(axis)).normalized()
    elbow = shoulder + axis * along + bend * math.sqrt(max(0, upper_length ** 2 - along ** 2))
    wrist = shoulder + axis * distance
    aim_arm(pose, side, elbow - shoulder, wrist - elbow, (-sign, -.10, .10))


def pose_of(name, t):
    """Các góc theo trục armature, đối xứng tay phải được ghi rõ."""
    m = S['motion']
    idle = pose_idle(0)
    if name == 'idle':
        return pose_idle(t)
    if name == 'emerge':
        end = S['clips'][name][0] * FPS
        frame = t * end
        k = min(1, frame / m['overshoot_frame'])
        start = dict(idle, dz=m['sink'], scale=m['small_scale'], head=(m['emerge_head'], 0, 0))
        for side, sign in (('L', 1), ('R', -1)):
            start['upper_arm_' + side] = (0, sign * m['close_arms'], 0)
        pose = mix_pose(start, idle, k)
        if frame <= m['overshoot_frame']:
            pose['scale'] = m['small_scale'] + (m['overshoot'] - m['small_scale']) * k
        else:
            q = (frame - m['overshoot_frame']) / (end - m['overshoot_frame'])
            pose['scale'] = m['overshoot'] + (1 - m['overshoot']) * q
        return idle if t >= 1 else pose
    if name == 'vanish':
        target = dict(idle, dz=m['sink'], scale=m['small_scale'], head=(m['vanish_head'], 0, 0))
        for side, sign in (('L', 1), ('R', -1)):
            target['upper_arm_' + side] = (0, sign * m['close_arms'], 0)
        return mix_pose(idle, target, t)
    if name == 'drift':
        pose = pose_idle(t)
        pose['spine'] = (m['drift_spine'], 0, 0)
        pose['chest'] = (m['drift_chest'], 0, 0)
        for side in ('L', 'R'):
            pose['upper_arm_' + side] = (m['drift_arms'], 0, 0)
        for i, angle in enumerate(m['drift_tail']):
            pose['tail' + str(i + 1)] = (angle, m['drift_sway'] * math.sin(2 * math.pi * (t + i * .25)), 0)
        return pose
    if name == 'scoff':
        breath = m['quiet_breath'] * math.sin(2 * math.pi * t)
        pose = dict(idle, chest=(breath, 0, m['scoff_chest']),
                    head=(m['scoff_chin'], 0, m['scoff_head']))
        for i, side in enumerate(('L', 'R')):
            fold_arm(pose, side, m['fold_wrists'][i], m['fold_elbows'][i])
        return pose
    if name == 'peek':
        breath = m['quiet_breath'] * math.sin(2 * math.pi * t)
        pose = dict(idle, spine=(m['peek_forward'] + breath, m['peek_side'], 0),
                    head=(m['peek_head'], m['peek_tilt'], 0))
        aim_arm(pose, 'L', m['peek_upper'], m['peek_forearm'], m['peek_hand'])
        return pose
    if name == 'taunt1':
        f = t * S['clips'][name][0] * FPS
        start, hold, end = m['roar_frames']
        factor = f / start if f < start else (1 if f <= hold else (end - f) / (end - hold))
        target = dict(idle, jaw=(m['roar_jaw'], 0, 0), head=(m['roar_head'], 0, 0))
        for side, sign in (('L', 1), ('R', -1)):
            # Hai khuỷu mở ngoài đầu; cẳng và cả vuốt đều hướng lên.
            aim_arm(target, side, mirrored(m['roar_upper'], sign),
                    mirrored(m['roar_forearm'], sign), mirrored(m['roar_hand'], sign))
        return mix_pose(idle, target, max(0, min(1, factor)))
    if name == 'taunt2':
        factor = math.sin(math.pi * t) ** 2
        target = dict(idle, head=(0, m['taunt_tilt'], 0),
                      upper_arm_R=(m['taunt_reach'], 0, m['taunt_reach_yaw']))
        pose = mix_pose(idle, target, factor)
        pose['hand_R'] = (m['hand_flex'] * math.sin(6 * math.pi * t), 0, 0)
        return idle if t in (0, 1) else pose
    raise ValueError('Clip không có trong đặc tả: ' + name)


def action_curves(action):
    """Đọc F-curve cũ hoặc action phân lớp của Blender 4.4/5.x."""
    try:
        return list(action.fcurves)
    except Exception:
        try:
            curves = []
            for layer in action.layers:
                for strip in layer.strips:
                    for slot in action.slots:
                        bag = strip.channelbag(slot)
                        if bag is not None:
                            curves.extend(bag.fcurves)
            return curves
        except Exception as exc:
            warn('Không đọc được F-curve phân lớp; giữ nội suy mặc định: ' + str(exc))
            return []


# chép từ avatar/build.py; tắt NLA trong lúc ghi, giữ chính xác 22,5 khung của emerge.
def make_clips(rig):
    animation = rig.animation_data_create()
    animation.use_nla = False
    for name, (duration, loop) in S['clips'].items():
        action = own(bpy.data.actions.new(SCENE + '_' + name))
        animation.action = action
        end = duration * FPS
        frames = {0.0, end}
        frames.update(float(f) for f in range(0, int(end) + 1, S['motion']['key_step']))
        if name == 'emerge':
            frames.add(float(S['motion']['overshoot_frame']))
        if name == 'taunt2':
            # Sáu đỉnh xoay tay, đúng ba lần co/duỗi.
            frames.update(end * (2 * i + 1) / 12 for i in range(6))
        for frame in sorted(frames):
            t = frame / end
            pose = pose_of(name, 0 if loop and frame == end else t)
            key_pose(rig, pose, frame)
        for curve in action_curves(action):
            for key in curve.keyframe_points:
                key.interpolation = 'LINEAR'
        action.use_fake_user = True
        # Bỏ action đang hoạt động trước khi tạo strip để không áp hai lần.
        animation.action = None
        track = animation.nla_tracks.new()
        track.name = name
        try:
            strip = track.strips.new(name, 0, action)
            strip.name = name
            strip.action_frame_start = 0
            strip.action_frame_end = end
            strip.frame_start = 0
            strip.frame_end = end
            strip.blend_type = 'REPLACE'
            strip.extrapolation = 'NOTHING'
            # Action slot mới: thường được gán tự động; gán rõ nếu cần.
            if hasattr(strip, 'action_slot') and strip.action_slot is None and len(action.slots):
                strip.action_slot = action.slots[0]
        except Exception as exc:
            warn('Không tạo được NLA cho ' + name + ': ' + str(exc))
    animation.action = None
    animation.use_nla = True
    apply_pose(rig, {})


# chép từ avatar/build.py; không xoá datablock của cảnh khác dù trùng tên.
def new_scene():
    scene = bpy.data.scenes.get(SCENE) or own(bpy.data.scenes.new(SCENE))
    bpy.context.window.scene = scene
    if bpy.context.object and bpy.context.object.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')
    old_objects = list(scene.collection.all_objects)
    for collection in list(scene.collection.children):
        scene.collection.children.unlink(collection)
    for obj in list(scene.collection.objects):
        scene.collection.objects.unlink(obj)
    for obj in old_objects:
        if not obj.users_scene and obj.users == 0:
            bpy.data.objects.remove(obj)
    mine = {SCENE + suffix for suffix in ('Mesh', 'Arm', 'World', 'FloorMesh',
                                         'FloorMat', 'OwnerMesh', 'OwnerMat', 'Cam',
                                         'Key', 'Fill', 'Rim', 'Montage')}
    mine.add('spirit')
    mine.update(SCENE + '_' + name for name in S['clips'])
    for blocks in (bpy.data.collections, bpy.data.meshes, bpy.data.armatures,
                   bpy.data.actions, bpy.data.lights, bpy.data.cameras,
                   bpy.data.materials, bpy.data.images):
        for block in list(blocks):
            if block.get(OWNER) == SCENE and (block.name.split('.')[0] in mine or block.name.startswith(SCENE)):
                if block.users <= int(getattr(block, 'use_fake_user', False)):
                    block.use_fake_user = False
                    blocks.remove(block)
    for engine in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT', 'CYCLES'):
        try:
            scene.render.engine = engine
            if engine == 'CYCLES':
                scene.cycles.device = 'CPU'
                scene.cycles.samples = 32
            break
        except Exception as exc:
            warn('Không dùng được bộ dựng ' + engine + ': ' + str(exc))
    else:
        raise RuntimeError('Không có bộ dựng ảnh tương thích')
    scene.render.fps = FPS
    scene.render.fps_base = 1
    scene.frame_start, scene.frame_end = 0, 100
    scene.view_settings.view_transform = 'Standard'
    world = bpy.data.worlds.get(SCENE + 'World')
    if world is None or world.get(OWNER) != SCENE:
        world = own(bpy.data.worlds.new(SCENE + 'World'))
    scene.world = world
    world.use_nodes = True
    background = world.node_tree.nodes.get('Background')
    background.inputs[0].default_value = rgb(S['preview']['background'])
    background.inputs[1].default_value = .45
    scene.render.film_transparent = False
    return scene


# chép từ avatar/build.py
def stage(scene):
    floor_data = own(bpy.data.meshes.new(SCENE + 'FloorMesh'))
    z = S['preview']['owner_base'][2] - .015
    floor_data.from_pydata([(-60, -60, z), (60, -60, z), (60, 60, z), (-60, 60, z)], [], [(0, 1, 2, 3)])
    floor = own(bpy.data.objects.new(SCENE + 'Floor', floor_data))
    scene.collection.objects.link(floor)
    mat = own(bpy.data.materials.new(SCENE + 'FloorMat'))
    mat.use_nodes = True
    mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = rgb(S['preview']['background'])
    mat.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 1
    floor_data.materials.append(mat)
    camera = own(bpy.data.objects.new(SCENE + 'Cam', own(bpy.data.cameras.new(SCENE + 'Cam'))))
    scene.collection.objects.link(camera)
    camera.data.lens = S['preview']['lens']
    camera.data.sensor_fit = 'VERTICAL'
    camera.data.sensor_height = 36
    scene.camera = camera
    lights = []
    for name, energy, color in (('Key', 3.2, '#fff0dc'), ('Fill', 1.1, '#cfdcff'), ('Rim', 2.2, '#ffffff')):
        data = own(bpy.data.lights.new(SCENE + name, 'SUN'))
        data.energy, data.color = energy, rgb(color)[:3]
        data.angle = math.radians(18)
        obj = own(bpy.data.objects.new(SCENE + name, data))
        scene.collection.objects.link(obj)
        lights.append(obj)
    build_owner(scene)
    return camera, lights


def build_owner(scene):
    """Người đứng tạm cao đúng 1,6 m, chỉ có trong ảnh, không xuất GLB."""
    p = S['preview']
    base = Vector(p['owner_base'])
    head_radius = p['owner_head_radius']
    height = p['owner_height']
    bm = bmesh.new()
    body_height = height - 2 * head_radius
    result = bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=12,
                                   radius1=p['owner_radius'], radius2=p['owner_radius'], depth=body_height)
    bmesh.ops.translate(bm, verts=result['verts'], vec=base + Vector((0, 0, body_height / 2)))
    result = bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=8, radius=head_radius)
    bmesh.ops.translate(bm, verts=result['verts'], vec=base + Vector((0, 0, height - head_radius)))
    data = own(bpy.data.meshes.new(SCENE + 'OwnerMesh'))
    bm.to_mesh(data)
    bm.free()
    obj = own(bpy.data.objects.new(SCENE + 'Owner', data))
    scene.collection.objects.link(obj)
    mat = own(bpy.data.materials.new(SCENE + 'OwnerMat'))
    mat.use_nodes = True
    mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = rgb(p['owner_color'])
    mat.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = .85
    data.materials.append(mat)
    for polygon in data.polygons:
        polygon.use_smooth = True


# chép từ avatar/build.py
def aim(obj, loc, target):
    obj.location = loc
    obj.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()


# chép từ avatar/build.py; ô hẹp cần máy lùi đủ thấy hai bàn tay.
def shoot(scene, camera, lights, path, az):
    p = S['preview']
    angle = math.radians(az)
    target = (0, 0, p['target_z'])
    aim(camera, (p['distance'] * math.sin(angle), -p['distance'] * math.cos(angle),
                 p['target_z'] + .18), target)
    for light, offset, elevation in zip(lights, (-38, 55, 165), (48, 25, 35)):
        a, e = angle + math.radians(offset), math.radians(elevation)
        aim(light, (6 * math.sin(a) * math.cos(e), -6 * math.cos(a) * math.cos(e),
                    p['target_z'] + 6 * math.sin(e)), target)
    render = scene.render
    render.resolution_x, render.resolution_y, render.resolution_percentage = 320, 720, 100
    render.image_settings.file_format = 'PNG'
    render.image_settings.color_mode = 'RGB'
    render.filepath = path
    bpy.ops.render.render(write_still=True)


# chép từ avatar/build.py
def montage(paths, out):
    import numpy as np
    tiles = []
    for path in paths:
        image = bpy.data.images.load(path, check_existing=False)
        width, height = image.size
        pixels = np.empty(width * height * 4, dtype=np.float32)
        image.pixels.foreach_get(pixels)
        tiles.append(pixels.reshape(height, width, 4))
        bpy.data.images.remove(image)
    full = np.concatenate(tiles, axis=1)
    height, width = full.shape[:2]
    image = own(bpy.data.images.new(SCENE + 'Montage', width, height))
    try:
        image.pixels.foreach_set(full.reshape(-1))
        image.file_format = 'JPEG'
        scene = bpy.context.scene
        scene.render.image_settings.file_format = 'JPEG'
        scene.render.image_settings.quality = 90
        image.save_render(out, scene=scene)
    finally:
        bpy.data.images.remove(image)


# chép từ avatar/build.py; dò RNA trước khi truyền tuỳ chọn thay đổi giữa các bản.
def export(path, objects):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    for obj in bpy.context.view_layer.objects:
        obj.select_set(False)
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    kwargs = dict(filepath=path, export_format='GLB', use_selection=True,
                  use_active_scene=True, export_yup=True, export_cameras=False,
                  export_lights=False, export_texcoords=False, export_apply=False,
                  export_materials='EXPORT', export_vertex_color='ACTIVE',
                  export_all_vertex_colors=True, export_skins=True,
                  export_animations=True, export_animation_mode='NLA_TRACKS',
                  export_optimize_animation_size=True, export_frame_range=False,
                  export_force_sampling=False)
    try:
        properties = bpy.ops.export_scene.gltf.get_rna_type().properties
        names = {prop.identifier for prop in properties}
        RES['export_color_parameters'] = sorted(name for name in names if 'color' in name.lower())
        for name in list(kwargs):
            if name not in names:
                warn('API glTF không có tham số ' + name + '; đã bỏ khi gọi toán tử')
                del kwargs[name]
        # Ghi enum để Điều phối thấy ngay thay đổi API ở Blender 5.3.
        for name in ('export_vertex_color', 'export_animation_mode'):
            if name in kwargs:
                enum = {item.identifier for item in properties[name].enum_items}
                if kwargs[name] not in enum:
                    warn('API glTF không nhận ' + name + '=' + kwargs[name])
                    del kwargs[name]
    except Exception as exc:
        warn('Không dò được RNA glTF, dùng tham số theo mẫu: ' + str(exc))
    result = bpy.ops.export_scene.gltf(**kwargs)
    if 'FINISHED' not in result:
        raise RuntimeError('Xuất GLB không hoàn tất: ' + str(result))


def read_glb(path):
    """Đọc header 12 byte và các khúc của GLB 2.0, không cần thư viện ngoài."""
    with open(path, 'rb') as source:
        content = source.read()
    if len(content) < 20:
        raise ValueError('GLB quá ngắn')
    magic, version, length = struct.unpack_from('<4sII', content, 0)
    if magic != b'glTF' or version != 2 or length != len(content):
        raise ValueError('Header GLB không hợp lệ')
    cursor, document, binary = 12, None, bytearray()
    while cursor < length:
        size, kind = struct.unpack_from('<II', content, cursor)
        cursor += 8
        chunk = content[cursor:cursor + size]
        if len(chunk) != size:
            raise ValueError('Khúc GLB bị cắt')
        if kind == 0x4E4F534A:
            document = json.loads(chunk.decode('utf-8').rstrip(' \x00'))
        elif kind == 0x004E4942:
            binary = bytearray(chunk)
        cursor += size
    if document is None:
        raise ValueError('GLB thiếu khúc JSON')
    return document, binary


def exact_clip_times(path):
    """Chuẩn hoá mốc thời gian nếu bộ xuất làm tròn khung 22,5 thành 22/23.

    Không thay đổi dữ liệu pose. GLB dùng giây nên emerge vẫn dài đúng 0,9 s
    ở FPS=25. Chỉ ghi lại khi phát hiện chênh lệch, đồng thời báo trong RESULT.
    """
    document, binary = read_glb(path)
    changed, seen, originals = False, {}, {}
    for animation in document.get('animations', []):
        for index in {sampler['input'] for sampler in animation['samplers']}:
            if index in originals:
                continue
            accessor = document['accessors'][index]
            if accessor.get('type') != 'SCALAR' or accessor.get('componentType') != 5126 or 'sparse' in accessor:
                warn('Không đọc được trục thời gian GLB số ' + str(index))
                continue
            view = document['bufferViews'][accessor['bufferView']]
            offset = view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
            stride = view.get('byteStride', 4)
            values = [struct.unpack_from('<f', binary, offset + i * stride)[0]
                      for i in range(accessor['count'])]
            originals[index] = (offset, stride, values)
    for animation in document.get('animations', []):
        name = animation.get('name', '')
        if name not in S['clips']:
            continue
        duration = S['clips'][name][0]
        inputs = {sampler['input'] for sampler in animation['samplers']}
        if not inputs or any(index not in originals for index in inputs):
            continue
        times = [value for index in inputs for value in originals[index][2]]
        if not times:
            continue
        start, end = min(times), max(times)
        if end <= start or (abs((end - start) - duration) < 1e-5 and abs(start) < 1e-5):
            continue
        for index in inputs:
            accessor = document['accessors'][index]
            if index in seen:
                if seen[index] != (start, end, duration):
                    warn('Hai clip khác thời lượng dùng chung trục thời gian')
                continue
            seen[index] = (start, end, duration)
            offset, stride, values = originals[index]
            converted = [(value - start) * duration / (end - start) for value in values]
            for i, value in enumerate(converted):
                struct.pack_into('<f', binary, offset + i * stride, value)
            accessor['min'], accessor['max'] = [min(converted)], [max(converted)]
            changed = True
            warn('Đã chuẩn hoá thời lượng ' + name + ' sau khi bộ xuất làm tròn khung hình')
    if changed:
        text = json.dumps(document, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
        text += b' ' * (-len(text) % 4)
        binary += b'\x00' * (-len(binary) % 4)
        length = 12 + 8 + len(text) + 8 + len(binary)
        with open(path, 'wb') as target:
            target.write(struct.pack('<4sII', b'glTF', 2, length))
            target.write(struct.pack('<II', len(text), 0x4E4F534A))
            target.write(text)
            target.write(struct.pack('<II', len(binary), 0x004E4942))
            target.write(binary)


def inspect_glb(path):
    document, binary = read_glb(path)
    RES['glb_kb'] = round(os.path.getsize(path) / 1024, 2)
    RES['nodes'] = [node.get('name', '') for node in document.get('nodes', [])]
    RES['materials'] = [mat.get('name', '') for mat in document.get('materials', [])]
    attributes = []
    exported_tris = 0
    for mesh in document.get('meshes', []):
        for i, primitive in enumerate(mesh.get('primitives', [])):
            attributes.append({'mesh': mesh.get('name', ''), 'primitive': i,
                               'attributes': sorted(primitive['attributes'])})
            if 'indices' in primitive:
                exported_tris += document['accessors'][primitive['indices']]['count'] // 3
            else:
                exported_tris += document['accessors'][primitive['attributes']['POSITION']]['count'] // 3
    RES['glb_attributes'] = attributes
    RES['glb_triangles'] = exported_tris
    for color in ('COLOR_0', 'COLOR_1'):
        if not attributes or any(color not in part['attributes'] for part in attributes):
            RES['over_budget'].append('thiếu ' + color)
    if not attributes or any('JOINTS_0' not in part['attributes'] or 'WEIGHTS_0' not in part['attributes'] for part in attributes):
        RES['over_budget'].append('thiếu trọng số skin trong GLB')
    RES['glb_bones'] = [document['nodes'][index].get('name', '')
                        for skin in document.get('skins', []) for index in skin.get('joints', [])]
    if set(RES['glb_bones']) != set(BONE_NAMES):
        RES['over_budget'].append('bộ xương GLB không khớp A3')
    clips = []
    for animation in document.get('animations', []):
        starts, ends = [], []
        for sampler in animation.get('samplers', []):
            accessor = document['accessors'][sampler['input']]
            starts.extend(accessor.get('min', [0]))
            ends.extend(accessor.get('max', [0]))
        name = animation.get('name', '')
        duration = round(max(ends, default=0) - min(starts, default=0), 6)
        clips.append({'name': name, 'seconds': duration,
                      'loop': S['clips'].get(name, (0, False))[1]})
        if name in S['clips'] and abs(duration - S['clips'][name][0]) > .001:
            RES['over_budget'].append('sai thời lượng clip ' + name)
    RES['glb_clips'] = clips
    if {clip['name'] for clip in clips} != set(S['clips']):
        RES['over_budget'].append('tên clip GLB không khớp A4')
    if RES['materials'] != ['spirit']:
        RES['over_budget'].append('vật liệu GLB không phải spirit duy nhất')
    if exported_tris > S['tri_limit']:
        RES['over_budget'].append('tam giác GLB vượt 4.000')
    if RES['glb_kb'] > S['kb_limit']:
        RES['over_budget'].append('GLB vượt 300 KB')


def make_views(scene, rig):
    os.makedirs(TMP, exist_ok=True)
    os.makedirs(IMG_DIR, exist_ok=True)
    rig.animation_data.use_nla = False
    rig.animation_data.action = None
    camera, lights = stage(scene)
    try:
        apply_pose(rig, pose_of('idle', .5))
        bpy.context.view_layer.update()
        with tempfile.TemporaryDirectory(prefix='demon_views_', dir=TMP) as folder:
            paths = []
            for angle in (0, 45, 90, 180):
                path = os.path.join(folder, 'view_' + str(angle) + '.png')
                shoot(scene, camera, lights, path, angle)
                paths.append(path)
            path = os.path.join(IMG_DIR, 'ma-vuong-4-goc.jpg')
            montage(paths, path)
            RES['views'] = path
            paths = []
            for name in ('idle', 'drift', 'scoff', 'taunt1'):
                apply_pose(rig, pose_of(name, .5))
                bpy.context.view_layer.update()
                path = os.path.join(folder, 'pose_' + name + '.png')
                shoot(scene, camera, lights, path, 30)
                paths.append(path)
            path = os.path.join(IMG_DIR, 'ma-vuong-tu-the.jpg')
            montage(paths, path)
            RES['poses'] = path
    finally:
        rig.animation_data.use_nla = True
        apply_pose(rig, {})


def main():
    scene = new_scene()
    mesh, counts = make_mesh_object(build_body(), 'MaVuong')
    rig = make_rig()
    bind(mesh, rig)
    make_clips(rig)
    RES['triangles'] = {'MaVuong': sum(counts.values())}
    RES['parts'] = counts
    RES['total_triangles'] = sum(counts.values())
    RES['bones'] = BONE_NAMES
    RES['clips'] = [{'name': name, 'seconds': duration, 'loop': loop}
                    for name, (duration, loop) in S['clips'].items()]
    RES['blender_version'] = bpy.app.version_string
    RES['glb_kb'] = None
    limits = part_limits()
    RES['part_limits'] = limits
    RES['part_limit_total'] = sum(limits.values())
    for name, count in counts.items():
        if count > limits[name]:
            RES['over_budget'].append(name + ': ' + str(count) + ' > ' + str(limits[name]))
    if RES['total_triangles'] > S['tri_limit']:
        RES['over_budget'].append('tổng tam giác vượt 4.000')
    if {'glb', 'check'} & OUT:
        if 'glb' in OUT:
            path = GLB_PATH
            export(path, [mesh, rig])
            try:
                exact_clip_times(path)
            except Exception as exc:
                warn('Không chuẩn hoá được thời gian GLB: ' + str(exc))
            inspect_glb(path)
            RES['glb'] = path
        else:
            os.makedirs(TMP, exist_ok=True)
            with tempfile.TemporaryDirectory(prefix='demon_check_', dir=TMP) as folder:
                path = os.path.join(folder, 'demon-4.glb')
                export(path, [mesh, rig])
                try:
                    exact_clip_times(path)
                except Exception as exc:
                    warn('Không chuẩn hoá được thời gian GLB: ' + str(exc))
                inspect_glb(path)
            RES['checked_temporary_glb'] = True
    if 'views' in OUT:
        make_views(scene, rig)
    return RES


try:
    result = main()
except Exception as error:
    RES['error'] = type(error).__name__ + ': ' + str(error)
    print('RESULT ' + json.dumps(RES, ensure_ascii=False), flush=True)
    raise
else:
    print('RESULT ' + json.dumps(result, ensure_ascii=False), flush=True)
