"""Chùa Tâm An · Ma Vương điêu khắc bằng mã, phần A của thẻ T-154.

Chạy bằng Blender 5.x, không giao diện:
    blender -b --python-expr "import runpy; runpy.run_path(
        r'<repo>/tools/blender/fx/build_demon.py', init_globals={
        'REPO': r'<repo>', 'OUT': ['glb', 'views', 'check'], 'PREVIEW': True})"
Biến điều khiển đọc từ globals():
    REPO: bắt buộc; LEVEL: chỉ nhận 4; OUT: mặc định ['check'].
    PREVIEW: mặc định True, ảnh vào TMP; False: docs/phap-tuong/anh/.
    TMP: mặc định <thư mục tạm>/phap_tuong.
    STAGE: 'full' (mặc định) | 'hi' (lưới cao) | 'low' (lưới thấp chưa bake).
    CLOSE: True để thêm ảnh cận trong chế độ 'full'.
Đầu ra: public/models/fx/demon-4.glb; ban-mau-ma-vuong-4-goc.jpg và
ban-mau-ma-vuong-tu-the.jpg, kèm ảnh thu 128 px. Chế độ check xuất GLB tạm,
không ghi mô hình vào repo. Một dòng RESULT chứa số liệu và cảnh báo.

Dây chuyền: khối nền (ellipsoid, ống quét) -> hợp bằng voxel remesh -> làm
mượt Taubin -> thêm khối cơ -> remesh lại -> khắc vảy, khe nứt, hốc mắt bằng
nhiễu Voronoi (numpy) -> lưới cao có màu/phát sáng theo đỉnh. Lưới thấp:
decimate thân + dựng thấp các phần phụ (sừng, ngón, móng, giáp) -> UV ->
bake Cycles (pháp tuyến, màu, AO, phát sáng) -> xuất GLB có ảnh nhúng.

Đơn vị mét, Z lên, mặt nhìn -Y (= +Z khi xuất glTF), bên trái là +X.
Gốc ở thắt lưng; đuôi z=-1,12, đỉnh sừng z≈1,85. Cảnh riêng
PhapTuongDemon, không lưu .blend, không dùng tài nguyên bên ngoài.
Mọi phần hình học, màu, trọng số và chuyển động đều sinh từ kịch bản.
"""

import json
import math
import os
import random
import struct
import tempfile
import time

import bmesh
import bpy
import numpy as np
from mathutils import Euler, Matrix, Vector


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
STAGE = globals().get('STAGE', 'full')
TMP = globals().get('TMP', os.path.join(tempfile.gettempdir(), 'phap_tuong'))
random.seed(15404)
SCENE, FPS = 'PhapTuongDemon', 25
OWNER = 'phap_tuong_owner'
T0 = time.time()
GLB_PATH = os.path.join(REPO, 'public', 'models', 'fx', 'demon-4.glb')
IMG_DIR = TMP if PREVIEW else os.path.join(REPO, 'docs', 'phap-tuong', 'anh')
RES = {'level': LEVEL, 'warnings': [], 'over_budget': []}

# Mọi số đo giữ ở đây; phần hình học điêu khắc nằm trong các hàm dựng bên dưới.
SPEC = {4: {
    'tri_limit': 4000, 'kb_limit': 600, 'body_tris': 1730, 'img': 512,
    'colors': {'skin': '#922326', 'horn': '#3a241a', 'claw': '#1c1011',
               'fang': '#ece0c4', 'armor': '#68291b', 'gold': '#995721',
               'mouth': '#3a0806', 'eye': '#ffc23a', 'crack': '#ff7a1a'},
    # đường tay: vai, khuỷu, cổ tay (bên trái +X); trục bàn tay
    'arm': {'path': [((.55, 0, .82), .16), ((.675, -.20, .74), .17),
                     ((.84, -.38, .66), .12), ((.82, -.58, .63), .13),
                     ((.80, -.78, .60), .09)]},
    'hand': {'axis': (-.15, -.99, 0)},
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
        ('upper_arm', 'shoulder', (.55, 0, .82), (.84, -.38, .66)),
        ('forearm', 'upper_arm', (.84, -.38, .66), (.80, -.78, .60)),
        ('hand', 'forearm', (.80, -.78, .60), (.74, -.91, .60))],
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


def log(message):
    print('[%.0fs] %s' % (time.time() - T0, message), flush=True)


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


def lin(hexs):
    return np.array(rgb(hexs)[:3])


def mirrored(point, sign):
    return Vector((point[0] * sign, point[1], point[2]))


# ---------------------------------------------------------------------------
# Hình học bằng numpy: mỗi "phần" là dict {v: (N,3), f: [mặt], ...}
# ---------------------------------------------------------------------------
def euler_matrix(rot):
    return np.array(Euler([math.radians(a) for a in rot], 'XYZ').to_matrix())


def sphere_unit(seg, rings):
    verts = [(0., 0., 1.)]
    for i in range(1, rings):
        phi = math.pi * i / rings
        for j in range(seg):
            th = 2 * math.pi * j / seg
            verts.append((math.sin(phi) * math.cos(th), math.sin(phi) * math.sin(th), math.cos(phi)))
    verts.append((0., 0., -1.))
    faces = [(0, 1 + j, 1 + (j + 1) % seg) for j in range(seg)]
    for i in range(1, rings - 1):
        a, b = 1 + (i - 1) * seg, 1 + i * seg
        for j in range(seg):
            k = (j + 1) % seg
            faces.append((a + j, b + j, b + k, a + k))
    last, a = len(verts) - 1, 1 + (rings - 2) * seg
    faces += [(last, a + (j + 1) % seg, a + j) for j in range(seg)]
    return np.array(verts), faces


def sphere_uv(seg, rings):
    """UV theo từng góc mặt của sphere_unit: kinh độ ngang, vĩ độ dọc, mép nối ở j=seg."""
    uv = [[((j + .5) / seg, 0.), (j / seg, 1 / rings), ((j + 1) / seg, 1 / rings)] for j in range(seg)]
    for i in range(1, rings - 1):
        for j in range(seg):
            uv.append([(j / seg, i / rings), (j / seg, (i + 1) / rings),
                       ((j + 1) / seg, (i + 1) / rings), ((j + 1) / seg, i / rings)])
    uv += [[((j + .5) / seg, 1.), ((j + 1) / seg, (rings - 1) / rings), (j / seg, (rings - 1) / rings)]
           for j in range(seg)]
    return uv


def ellipsoid(center, radii, rot=(0, 0, 0), seg=24, rings=14, kind='skin', **extra):
    u, faces = sphere_unit(seg, rings)
    v = (u * np.array(radii)) @ euler_matrix(rot).T + np.array(center)
    return dict(v=v, f=faces, kind=kind, uvl=sphere_uv(seg, rings),
                uvsize=(2 * math.pi * float(np.mean(radii[:2])), math.pi * float(radii[2])), **extra)


def along_matrix(direction):
    q = Vector(direction).to_track_quat('Z', 'Y')
    return np.array(q.to_matrix())


def blob_axis(p0, p1, rx, ry, extend=1.0, seg=20, rings=12, kind='skin', **extra):
    """Ellipsoid kéo dài dọc đoạn p0-p1 (khối cơ bắp tay, cẳng tay)."""
    p0, p1 = np.array(p0, float), np.array(p1, float)
    d = p1 - p0
    u, faces = sphere_unit(seg, rings)
    v = (u * np.array([rx, ry, np.linalg.norm(d) / 2 * extend])) @ along_matrix(d).T + (p0 + p1) / 2
    return dict(v=v, f=faces, kind=kind, **extra)


def catmull(points, n):
    p = np.asarray(points, float)
    if p.ndim == 1:
        p = p[:, None]
    k = len(p)
    if k == 1:
        return np.repeat(p, n, axis=0)
    ext = np.vstack([2 * p[0] - p[1], p, 2 * p[-1] - p[-2]])
    out = []
    for u in np.linspace(0, k - 1, n):
        i = min(int(u), k - 2)
        t = u - i
        p0, p1, p2, p3 = ext[i], ext[i + 1], ext[i + 2], ext[i + 3]
        out.append(.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t
                         + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    return np.array(out)


def tube(points, radii, seg=10, rings=24, flat=1.0, twist=0.0, ridge=None,
         cap0=True, cap1=True, pointed=False, ref=(0, 0, 1), kind='skin', **extra):
    """Ống quét Catmull-Rom, có ridge/twist; pointed gộp vòng cuối thành một chóp."""
    pts = catmull(points, rings)
    rad = catmull(np.asarray(radii, float)[:, None], rings)[:, 0]
    rad = np.maximum(rad, .0015)
    t = np.linspace(0, 1, rings)
    if ridge is not None:
        rad = rad * ridge(t)
    tan = np.gradient(pts, axis=0)
    tan /= np.linalg.norm(tan, axis=1)[:, None] + 1e-12
    refv = np.array(ref, float)
    n = refv - tan[0] * np.dot(refv, tan[0])
    if np.linalg.norm(n) < 1e-6:
        n = np.array([1., 0, 0]) - tan[0] * tan[0][0]
    n /= np.linalg.norm(n)
    verts, tt, ang = [], [], []
    for i in range(rings):
        if pointed and i == rings - 1:
            # Chóp nanh dùng một đỉnh thật, không tốn một vòng và nắp tí hon.
            verts.append(pts[i]); tt.append(t[i]); ang.append(0.)
            continue
        if i:
            n = n - tan[i] * np.dot(n, tan[i])
            n /= np.linalg.norm(n) + 1e-12
        b = np.cross(tan[i], n)
        for j in range(seg):
            a = 2 * math.pi * j / seg + twist * t[i]
            verts.append(pts[i] + rad[i] * (math.cos(a) * n + math.sin(a) * b * flat))
            tt.append(t[i])
            ang.append(a)
    faces = []
    side_rings = rings - 2 if pointed else rings - 1
    for i in range(side_rings):
        for j in range(seg):
            k = (j + 1) % seg
            faces.append((i * seg + j, i * seg + k, (i + 1) * seg + k, (i + 1) * seg + j))
    if pointed:
        base, tip = (rings - 2) * seg, (rings - 1) * seg
        faces += [(base + j, base + (j + 1) % seg, tip) for j in range(seg)]
    if cap0:
        verts.append(pts[0]); tt.append(0.); ang.append(0.)
        c = len(verts) - 1
        faces += [(c, (j + 1) % seg, j) for j in range(seg)]
    if cap1 and not pointed:
        verts.append(pts[-1]); tt.append(1.); ang.append(0.)
        c = len(verts) - 1
        base = (rings - 1) * seg
        faces += [(c, base + j, base + (j + 1) % seg) for j in range(seg)]
    uvl = []
    for i in range(side_rings):
        for j in range(seg):
            uvl.append([(j / seg, i / (rings - 1)), ((j + 1) / seg, i / (rings - 1)),
                        ((j + 1) / seg, (i + 1) / (rings - 1)), (j / seg, (i + 1) / (rings - 1))])
    if pointed:
        uvl += [[(j / seg, (rings - 2) / (rings - 1)),
                 ((j + 1) / seg, (rings - 2) / (rings - 1)), ((j + .5) / seg, 1.)]
                for j in range(seg)]
    if cap0:
        uvl += [[(.5, 0.), ((j + 1) / seg, 0.), (j / seg, 0.)] for j in range(seg)]
    if cap1 and not pointed:
        uvl += [[(.5, 1.), (j / seg, 1.), ((j + 1) / seg, 1.)] for j in range(seg)]
    length = float(np.sum(np.linalg.norm(np.diff(pts, axis=0), axis=1)))
    return dict(v=np.array(verts), f=faces, tt=np.array(tt), ang=np.array(ang), kind=kind, uvl=uvl,
                uvsize=(2 * math.pi * float(np.mean(rad)), length), **extra)


def mirror_piece(p):
    q = dict(p)
    q['v'] = p['v'] * np.array([-1., 1., 1.])
    q['f'] = [tuple(reversed(f)) for f in p['f']]
    if 'uvl' in p:
        q['uvl'] = [list(reversed(u)) for u in p['uvl']]
    if 'side' in p:
        q['side'] = 'R' if p['side'] == 'L' else 'L'
    return q


def both(piece):
    """Bản trái (+X) và bản đối xứng phải."""
    piece['side'] = 'L'
    return [piece, mirror_piece(piece)]


def merge(pieces):
    verts, faces, off = [], [], 0
    for p in pieces:
        verts.append(p['v'])
        faces += [tuple(i + off for i in f) for f in p['f']]
        off += len(p['v'])
    return np.vstack(verts), faces


def tri_array(faces):
    out = []
    for f in faces:
        for k in range(1, len(f) - 1):
            out.append((f[0], f[k], f[k + 1]))
    return np.array(out, dtype=np.int64)


def vertex_normals(v, tris):
    fn = np.cross(v[tris[:, 1]] - v[tris[:, 0]], v[tris[:, 2]] - v[tris[:, 0]])
    n = np.zeros_like(v)
    for k in range(3):
        np.add.at(n, tris[:, k], fn)
    return n / (np.linalg.norm(n, axis=1)[:, None] + 1e-12)


def taubin(v, tris, iters, lam=.5, mu=-.53, mask=None):
    """Làm mượt Taubin: giữ thể tích, xóa chỗ giao khối sắc sau remesh."""
    e = np.vstack([tris[:, [0, 1]], tris[:, [1, 2]], tris[:, [2, 0]]])
    e = np.unique(np.sort(e, axis=1), axis=0)
    a = np.concatenate([e[:, 0], e[:, 1]])
    b = np.concatenate([e[:, 1], e[:, 0]])
    deg = np.bincount(a, minlength=len(v)).astype(float)[:, None] + 1e-9
    v = v.copy()
    for i in range(iters):
        for f in (lam, mu):
            acc = np.zeros_like(v)
            np.add.at(acc, a, v[b])
            delta = f * (acc / deg - v)
            v += delta if mask is None else delta * mask[:, None]
    return v


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def _hash(ix, iy, iz, salt):
    h = (ix * 374761393 + iy * 668265263 + iz * 1274126177 + salt * 144665) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    h = h ^ (h >> 16)
    return (h & 0xFFFF) / 65536.0


def voronoi(p, cell, salt=0):
    """F1, F2 (theo đơn vị ô) và mã ngẫu nhiên của ô gần nhất."""
    q = p / cell
    ci = np.floor(q).astype(np.int64)
    f1 = np.full(len(p), 9.0)
    f2 = f1.copy()
    ident = np.zeros(len(p))
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            for dz in (-1, 0, 1):
                nx, ny, nz = ci[:, 0] + dx, ci[:, 1] + dy, ci[:, 2] + dz
                px = nx + _hash(nx, ny, nz, salt * 3)
                py = ny + _hash(nx, ny, nz, salt * 3 + 1)
                pz = nz + _hash(nx, ny, nz, salt * 3 + 2)
                d = np.sqrt((q[:, 0] - px) ** 2 + (q[:, 1] - py) ** 2 + (q[:, 2] - pz) ** 2)
                closer = d < f1
                f2 = np.where(closer, f1, np.minimum(f2, d))
                ident = np.where(closer, _hash(nx, ny, nz, salt * 3 + 7), ident)
                f1 = np.minimum(f1, d)
    return f1, f2, ident


def valnoise(p, cell, salt=1):
    q = p / cell
    i = np.floor(q).astype(np.int64)
    f = q - i
    f = f * f * (3 - 2 * f)
    acc = 0
    for dx in (0, 1):
        for dy in (0, 1):
            for dz in (0, 1):
                h = _hash(i[:, 0] + dx, i[:, 1] + dy, i[:, 2] + dz, salt)
                w = ((f[:, 0] if dx else 1 - f[:, 0]) * (f[:, 1] if dy else 1 - f[:, 1])
                     * (f[:, 2] if dz else 1 - f[:, 2]))
                acc = acc + h * w
    return acc


# ---------------------------------------------------------------------------
# Dựng khối: thân (hợp bằng voxel), phần phụ (ống quét), giáp
# ---------------------------------------------------------------------------
ARM_S = np.array((.55, 0., .82))
ARM_E = np.array((.84, -.38, .66))
ARM_W = np.array((.80, -.78, .60))
HAND_A = np.array(S['hand']['axis'], float)
HAND_A /= np.linalg.norm(HAND_A)
HAND_L = np.array((-HAND_A[1], HAND_A[0], 0.))      # hướng ngang, ra ngoài với tay trái
HAND_P = ARM_W + HAND_A * .075                          # tâm lòng bàn tay


def body_base():
    """Khối nền để hợp: thân, cổ, hộp sọ, tay, lòng bàn tay, vai."""
    P = [ellipsoid((0, .01, .04), (.18, .16, .15)),
         ellipsoid((0, -.005, .28), (.225, .185, .22)),
         ellipsoid((0, -.02, .58), (.34, .24, .25)),
         ellipsoid((0, -.03, .78), (.43, .225, .15)),
         ellipsoid((0, .075, .65), (.36, .12, .27)),
         tube([(0, .0, .78), (0, -.03, 1.02)], [.19, .165], seg=20, rings=6),
         ellipsoid((0, .005, 1.22), (.285, .245, .285), seg=32, rings=20)]
    up_dir = ARM_E - ARM_S
    fo_dir = ARM_W - ARM_E
    arm = [tube([ARM_S, (.70, -.18, .745), ARM_E], [.16, .177, .108], seg=20, rings=14),
           tube([ARM_E, (.83, -.49, .65), (.82, -.63, .62), ARM_W],
                [.11, .148, .113, .076], seg=20, rings=14),
           ellipsoid((.58, -.015, .855), (.185, .17, .18)),
           blob_axis(ARM_S + up_dir * .15 + (0, -.03, .045), ARM_S + up_dir * .88 + (0, -.03, .045),
                     .12, .135, extend=1.15),
           blob_axis(ARM_S + up_dir * .15 + (0, .05, -.02), ARM_S + up_dir * .80 + (0, .05, -.02),
                     .09, .10, extend=1.10),
           blob_axis(ARM_E + fo_dir * .05 + (0, 0, .03), ARM_E + fo_dir * .68 + (0, 0, .025),
                     .12, .13, extend=1.12),
           ellipsoid(tuple(HAND_P), (.10, .09, .042), (0, 0, math.degrees(math.atan2(-HAND_A[0], HAND_A[1]))))]
    for piece in arm:
        P += both(piece)
    # hàm dưới: tách khỏi hộp sọ bằng khe miệng mở
    P.append(ellipsoid((0, -.25, .80), (.125, .125, .062)))                    # cằm
    P.append(ellipsoid((0, -.17, .84), (.095, .10, .028)))                     # sàn miệng/lưỡi
    P += both(ellipsoid((.21, -.13, .90), (.075, .14, .105)))                 # má dưới/góc hàm
    return P


def body_detail():
    """Khối cơ và nét mặt thêm sau lần hợp đầu."""
    P = []
    side = [ellipsoid((.165, -.165, .715), (.19, .11, .13), (0, 10, 0), seg=24, rings=14),       # ngực
            ellipsoid((.235, .075, .59), (.145, .105, .29), (0, 22, 0)),                         # cơ lưng dài, trên rộng dưới thuôn
            ellipsoid((.235, .145, .775), (.155, .060, .15), (0, -18, 0)),                       # bả vai dẹt, liền vào lưng
            blob_axis((.07, .075, 1.095), (.46, .07, .845), .105, .065, extend=1.18),             # cơ thang dốc, không thành bầu gáy
            ellipsoid((.075, -.185, .50), (.073, .063, .055)),                                    # bụng sáu múi
            ellipsoid((.075, -.185, .385), (.073, .06, .055)),
            ellipsoid((.07, -.18, .27), (.067, .055, .052)),
            ellipsoid((.11, -.14, .17), (.085, .045, .055), (0, 25, 0)),                           # đường chữ V hông
            ellipsoid((.065, .145, .51), (.052, .035, .255)),                                    # cơ dựng sống lưng dẹt
            ellipsoid((.125, -.255, 1.285), (.15, .075, .055), (0, -24, 0), seg=24, rings=14),     # gờ mày
            ellipsoid((.20, -.17, 1.12), (.10, .10, .065), (0, 0, -15)),                           # gò má
            ellipsoid((.12, -.29, 1.045), (.075, .105, .042), (0, -16, 0)),                         # môi trên nhe nanh
            ellipsoid((.105, -.345, 1.082), (.055, .033, .022), (0, -22, 0)),                       # nếp nhăn mõm
            ellipsoid((.17, -.30, 1.068), (.052, .028, .022), (0, -32, 0)),
            ellipsoid((0, -.12, 1.30), (.23, .14, .12)),                                           # trán
            ellipsoid((.20, -.07, .955), (.045, .12, .085), (0, 0, -10))]                          # góc hàm vuông
    for piece in side:
        P += both(piece)
    P += [ellipsoid((0, -.30, 1.16), (.036, .08, .085)),
          ellipsoid((.04, -.325, 1.095), (.032, .032, .03)), ellipsoid((-.04, -.325, 1.095), (.032, .032, .03)),                                       # sống mũi
          ellipsoid((0, -.275, 1.07), (.145, .125, .06)),                                        # mõm trên
          ellipsoid((0, -.27, .865), (.135, .105, .04)),                                         # bờ môi dưới ôm đáy hốc
          ellipsoid((0, -.04, 1.43), (.20, .17, .075)),                                           # đỉnh sọ nổi
          ellipsoid((0, .0, .93), (.20, .16, .09))]
    return P


def make_fingers(hi):
    """Năm ngón có vuốt đen dài cong, bàn tay xòe ngửa ra trước."""
    out = []
    z = np.array((0., 0., 1.))
    seg, rings = (10, 20) if hi else (5, 3)
    # (lệch ngang, góc xòe, hệ số dài, bán kính) từ ngón cái ra ngón út
    table = [(.088, 58, .86, .029), (.052, 14, 1.0, .026), (.012, 2, 1.1, .026),
             (-.028, -11, 1.0, .0245), (-.066, -24, .82, .022)]
    for idx, (off, fan, scale, rad) in enumerate(table):
        thumb = idx == 0
        base = HAND_P + HAND_L * off + HAND_A * (-.01 if thumb else .075)
        th = math.radians(fan)
        flat_dir = HAND_A * math.cos(th) + HAND_L * math.sin(th)
        lengths = [.06 * scale, .055 * scale] + ([] if thumb else [.045 * scale])
        pitch = [18, 46] if thumb else [8, 30, 52]
        pts, cur = [base], base.copy()
        for length, pit in zip(lengths, pitch):
            p = math.radians(pit)
            cur = cur + length * (math.cos(p) * flat_dir + math.sin(p) * z)
            pts.append(cur.copy())
        radii = [rad, rad * .95, rad * .82, rad * .7][:len(pts)]
        finger = tube(pts, radii, seg=seg, rings=rings, kind='skin', ref=(0, 0, 1), bone='hand', part='finger')
        # vuốt: tiếp từ đầu ngón, cong lên dần
        c_len = [.05, .045, .04]
        c_pit = [(64, 82, 100) if not thumb else (62, 82, 98)][0]
        cpts, cur = [pts[-1]], pts[-1].copy()
        for length, pit in zip(c_len, c_pit):
            p = math.radians(pit)
            cur = cur + length * (math.cos(p) * flat_dir + math.sin(p) * z)
            cpts.append(cur.copy())
        claw = tube(cpts, [radii[-1] * .95, radii[-1] * .6, radii[-1] * .3, .0015],
                    seg=seg, rings=max(3, rings // 2) if hi else 3, kind='claw', bone='hand', part='claw')
        out += both(finger) + both(claw)
    return out


def horn_ridge(t):
    return 1 + .12 * np.sin(2 * math.pi * t * 11) * (1 - .65 * t)


def make_parts(hi):
    """Phần phụ ngoài thân: sừng, tai, nanh, ngón, giáp, gai, đuôi."""
    out = []
    # sừng lớn cong xoắn, có vòng gờ
    horn = tube([(.24, .0, 1.27), (.45, .065, 1.34), (.63, .12, 1.48), (.68, .10, 1.65),
                 (.62, .015, 1.78), (.53, -.06, 1.835), (.45, -.09, 1.85)],
                [.132, .122, .097, .073, .045, .022, .0], seg=20 if hi else 8, rings=72 if hi else 11,
                ridge=horn_ridge if hi else None, twist=1.8, flat=.88,
                kind='horn', bone='head', part='horn_big')
    out += both(horn)
    # Bảy gai xếp thành mào từ đỉnh tới gáy; gốc chìm trong sọ, ngọn vuốt ra sau (+Y).
    small = [([(0, -.025, 1.43), (0, .045, 1.595), (0, .17, 1.68)], .052),
             ([(.09, -.015, 1.425), (.11, .075, 1.545), (.135, .21, 1.61)], .045),
             ([(.17, .0, 1.40), (.20, .11, 1.49), (.215, .26, 1.52)], .043),
             ([(0, .15, 1.42), (0, .27, 1.525), (0, .395, 1.49)], .049),
             ([(0, .235, 1.28), (0, .345, 1.355), (0, .44, 1.31)], .046)]
    for pts, r in small:
        # Bốn vòng thấp diễn tả độ cong, cả mào chỉ tăng tám tam giác so với vòng 2.
        piece = tube(pts, [r, r * .55, .0], seg=8 if hi else 4, rings=14 if hi else 4,
                     kind='horn', bone='head', part='horn_small', twist=.0)
        out += [piece] if pts[0][0] == 0 else both(piece)
    # tai nhọn
    ear = tube([(.26, .0, 1.22), (.37, .025, 1.31), (.47, .05, 1.44)], [.06, .045, .0],
               seg=10 if hi else 5, rings=14 if hi else 3, flat=.45, kind='skin', bone='head', part='ear')
    out += both(ear)
    # nanh trên và dưới
    for pts, radii, bone, seg, rings in (
            ([(.105, -.36, 1.04), (.106, -.405, .997), (.095, -.421, .94), (.078, -.40, .904)],
             [.029, .025, .014, .0], 'head', 5, 4),
            ([(.108, -.31, .869), (.120, -.37, .906), (.117, -.404, .945), (.108, -.397, .967)],
             [.024, .019, .010, .0], 'jaw', 4, 3)):
        fang = tube(pts, radii, seg=10 if hi else seg, rings=22 if hi else rings,
                    pointed=True, kind='fang', bone=bone, part='fang')
        out += both(fang)
    # Hai răng cửa trên và bốn răng dưới, chừa giữa miệng để thấy chiều sâu.
    for x, z, direction, bone in ((.038, 1.065, -1, 'head'), (.036, .844, 1, 'jaw'), (.075, .854, 1, 'jaw')):
        tooth = tube([(x, -.37 if bone == 'head' else -.35, z), (x, -.39, z + direction * .024),
                      (x * .9, -.385, z + direction * .047)], [.013, .009, .0],
                     seg=8 if hi else 3, rings=12 if hi else 2, pointed=True,
                     kind='fang', bone=bone, part='fang')
        out += both(tooth)
    out.append(ellipsoid((0, -.245, .867), (.080, .135, .033), seg=24 if hi else 4,
                         rings=12 if hi else 3, kind='tongue', bone='jaw', part='tongue'))
    out += make_fingers(hi)
    # giáp vai đồng có gai
    for layer, (center, radii, tilt) in enumerate((
            ((.615, .025, .965), (.225, .225, .075), 22),
            ((.68, -.008, .895), (.205, .21, .061), 31),
            ((.725, -.04, .825), (.175, .185, .052), 39))):
        shell = ellipsoid(center, radii, (0, tilt, 0), seg=28 if hi else (7 if layer == 0 else 6),
                          rings=14 if hi else (4 if layer == 0 else 3), kind='armor',
                          bone='upper_arm', part='pauldron', shell_center=center, shell_radii=radii, tilt=tilt)
        out += both(shell)
    for base, mid, tip, r in (
            ((.53, .07, 1.025), (.53, .14, 1.16), (.57, .24, 1.20), .05),
            ((.665, .08, 1.01), (.73, .18, 1.13), (.82, .28, 1.15), .047),
            ((.77, .07, .935), (.87, .16, 1.025), (.98, .25, 1.035), .043)):
        spike = tube([base, mid, tip], [r, r * .65, .0],
                     seg=10 if hi else 4, rings=10 if hi else 3, kind='armor', bone='upper_arm', part='spike')
        out += both(spike)
    # vòng giáp cổ tay
    fo = ARM_W - ARM_E
    for a, b in ((.62, .84),):
        cuff = tube([ARM_E + fo * a, ARM_E + fo * b], [.118, .112], seg=20 if hi else 8, rings=4 if hi else 2,
                    ridge=(lambda t: 1 + .04 * np.sin(math.pi * 2 * t * 2)) if hi else None,
                    kind='armor', bone='forearm', part='cuff')
        out += both(cuff)
    # Ngực để trần: khe cơ và nứt dọc thay cho chuỗi đốt kim loại.
    # Gai lưng lớn dần về vai, cong ra sau thay vì dính sát cột sống.
    for z, y, size in ((.30, .155, .75), (.46, .19, .95), (.62, .21, 1.15),
                       (.78, .225, 1.25), (.93, .15, 1.15), (1.075, .155, .85)):
        out.append(tube([(0, y, z), (0, y + .10 * size, z + .055 * size),
                         (0, y + .21 * size, z + .11 * size)],
                        [.043 * size, .027 * size, .0], seg=10 if hi else 3, rings=12 if hi else 3,
                        kind='armor', bone='chest' if z > .45 else 'spine', part='spine'))
    # đuôi khói xoắn và dải khói
    s = np.linspace(0, 1, 13)
    tail_pts = [(.115 * math.sin(2 * math.pi * 1.25 * u) * math.sin(math.pi * u),
                 .10 * (math.cos(2 * math.pi * 1.25 * u) - 1) * math.sin(math.pi * u),
                 .075 - 1.195 * u) for u in s]
    out.append(tube(tail_pts, [.195 * (1 - u) ** .85 + .003 for u in s], seg=28 if hi else 6,
                    rings=84 if hi else 10, flat=.83, twist=2 * math.pi * 1.25,
                    kind='smoke', bone='tail', part='tail'))
    wisps = [[(.10, .02, -.10), (.245, .06, -.19), (.265, .10, -.29), (.19, .13, -.35)],
             [(-.10, .03, -.38), (-.225, .06, -.44), (-.23, .12, -.55), (-.15, .15, -.61)]]
    for pts in wisps:
        out.append(tube(pts, [.072, .067, .040, .003], seg=12 if hi else 5, rings=26 if hi else 3,
                        twist=2.0, kind='smoke', bone='tail', part='tail'))
    return out


# ---------------------------------------------------------------------------
# Cầu nối numpy <-> Blender
# ---------------------------------------------------------------------------
def link(obj):
    bpy.context.scene.collection.objects.link(obj)


def np_mesh(name, v, faces, smooth=True):
    me = own(bpy.data.meshes.new(name))
    me.from_pydata(v.tolist(), [], [tuple(int(i) for i in f) for f in faces])
    me.update()
    if smooth:
        me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
    return me


def mesh_np(me):
    n = len(me.vertices)
    v = np.empty(n * 3, dtype=np.float32)
    me.vertices.foreach_get('co', v)
    me.calc_loop_triangles()
    t = np.empty(len(me.loop_triangles) * 3, dtype=np.int32)
    me.loop_triangles.foreach_get('vertices', t)
    return v.reshape(-1, 3).astype(np.float64), t.reshape(-1, 3).astype(np.int64)


def evaluate_np(v, faces, modifier_setup):
    """Dựng lưới tạm, áp một modifier, đọc kết quả về numpy rồi dọn sạch."""
    me = np_mesh('t154_tmp', v, faces, smooth=False)
    ob = own(bpy.data.objects.new('t154_tmp', me))
    link(ob)
    modifier_setup(ob)
    bpy.context.view_layer.update()
    ev = bpy.data.meshes.new_from_object(ob.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    out = mesh_np(ev)
    bpy.data.objects.remove(ob)
    bpy.data.meshes.remove(me)
    bpy.data.meshes.remove(ev)
    return out


def remesh_np(v, faces, voxel):
    def setup(ob):
        m = ob.modifiers.new('Remesh', 'REMESH')
        m.mode = 'VOXEL'
        m.voxel_size = voxel
        m.adaptivity = 0.0
    return evaluate_np(v, faces, setup)


DEC_FACTOR = float(globals().get('DEC_FACTOR', 1.0))
DEC_HEAD = float(globals().get('DEC_HEAD', .010))


def decimate_np(v, tris, target):
    def setup(ob):
        m = ob.modifiers.new('Dec', 'DECIMATE')
        m.decimate_type = 'COLLAPSE'
        m.ratio = min(1.0, target / len(tris))
        m.use_symmetry = True
        m.symmetry_axis = 'X'
        m.use_collapse_triangulate = True
        group = ob.vertex_groups.new(name='keep')
        for i, vert in enumerate(ob.data.vertices):
            x, y, z = vert.co
            # Trọng số thấp giữ cạnh lâu hơn: ưu tiên mặt, rồi đến bàn tay và cánh tay.
            face = (z > .90 and abs(x) < .39) or (z > .77 and abs(x) < .27 and y < -.18)
            # Mặt trước được giữ hơn gáy; phần tăng 180 tam giác dành chủ yếu cho trán/má/mõm.
            importance = (DEC_HEAD if y < .02 else DEC_HEAD * 4) if face else (
                .08 if y < -.78 else (.40 if abs(x) > .45 else 1.0))
            group.add([i], importance, 'REPLACE')
        m.vertex_group = 'keep'
        m.vertex_group_factor = DEC_FACTOR
    return evaluate_np(v, tris, setup)


def refine_head(v, tris, hi_v, hi_t, budget):
    """Chia tối đa 36 mặt lớn ở trán/má; chỉ chiếu đỉnh mới lên khối đầu đã đạt."""
    from mathutils.bvhtree import BVHTree
    c = v[tris].mean(axis=1)
    face = (c[:, 2] > 1.08) & (c[:, 1] < -.10) & (np.abs(c[:, 0]) < .28)
    area = np.linalg.norm(np.cross(v[tris[:, 1]] - v[tris[:, 0]], v[tris[:, 2]] - v[tris[:, 0]]), axis=1)
    candidates = np.flatnonzero(face)
    count = min(36, max(0, budget // 2), len(candidates))
    if not count:
        return v, tris
    chosen = set(candidates[np.argsort(area[candidates])[-count:]].tolist())
    bvh = BVHTree.FromPolygons(hi_v.tolist(), hi_t.tolist())
    extra, faces = [], []
    for i, (a, b, d) in enumerate(tris):
        if i not in chosen:
            faces.append((a, b, d))
            continue
        center = c[i]
        hit = bvh.find_nearest(Vector(center))
        if hit[0] is not None:
            delta = np.array(hit[0]) - center
            center = center + delta * min(1., .02 / (np.linalg.norm(delta) + 1e-12))
        k = len(v) + len(extra)
        extra.append(center)
        faces.extend(((a, b, k), (b, d, k), (d, a, k)))
    return np.vstack([v, extra]), np.array(faces, dtype=np.int64)


# ---------------------------------------------------------------------------
# Lưới cao: hợp, làm mượt, khắc, tô màu theo đỉnh
# ---------------------------------------------------------------------------
def carve_mouth(v, tris):
    """Khoét hốc elip thật vào sọ/hàm; thành cong và đáy kín ở sâu phía sau môi.

    Chỉ một phép trừ trước remesh cuối, tránh miệng là mặt phẳng tô đỏ trên sọ.
    """
    cutter = ellipsoid((0, -.325, .955), (.153, .265, .112), seg=40, rings=28)
    data = np_mesh('T154_mouth_cut', cutter['v'], cutter['f'], smooth=False)
    obj = own(bpy.data.objects.new('T154_mouth_cut', data))
    link(obj)

    def setup(body):
        mod = body.modifiers.new('Mouth', 'BOOLEAN')
        mod.operation = 'DIFFERENCE'
        mod.solver = 'EXACT'
        mod.object = obj

    try:
        return evaluate_np(v, tris, setup)
    finally:
        bpy.data.objects.remove(obj, do_unlink=True)
        bpy.data.meshes.remove(data)


def build_body_smooth():
    v, f = merge(body_base())
    v, t = remesh_np(v, f, .016)
    v = taubin(v, t, 14)
    v2, f2 = merge(body_detail())
    V = np.vstack([v, v2])
    F = [tuple(x) for x in t] + [tuple(i + len(v) for i in fc) for fc in f2]
    v, t = remesh_np(V, F, .011)
    v = taubin(v, t, 6)
    # Chỉ hòa mạnh phía sau: giữ nguyên ngực, mặt, bàn tay và các nếp đã đạt vòng 2.
    back_mask = (smoothstep(.02, .14, v[:, 1]) * smoothstep(.52, .38, np.abs(v[:, 0]))
                 * smoothstep(.16, .30, v[:, 2]) * smoothstep(1.46, 1.22, v[:, 2]))
    v = taubin(v, t, 18, mu=-.48, mask=back_mask)
    v, t = carve_mouth(v, t)
    v, t = remesh_np(v, t, .0072)
    v = taubin(v, t, 3)
    log('thân mượt %d đỉnh %d tam giác' % (len(v), len(t)))
    return v, t


def eye_mask(ax, z, cx, cz, a, b, slant):
    """Elip mắt xoay theo góc xếp (đuôi mắt hướng lên với ax=|x|); trả e>0 trong mắt."""
    dx, dz = ax - cx, z - cz
    c, s = math.cos(math.radians(slant)), math.sin(math.radians(slant))
    u, w = dx * c + dz * s, -dx * s + dz * c
    return 1 - (u / a) ** 2 - (w / b) ** 2, dx



def poly_dist2(a, b, pts):
    """Khoảng cách 2D từ (a,b) tới đường gấp khúc pts (danh sách (u,v))."""
    best = np.full(len(a), 9.0)
    for (u0, v0), (u1, v1) in zip(pts, pts[1:]):
        du, dv = u1 - u0, v1 - v0
        t = np.clip(((a - u0) * du + (b - v0) * dv) / (du * du + dv * dv), 0, 1)
        d = np.hypot(a - (u0 + t * du), b - (v0 + t * dv))
        best = np.minimum(best, d)
    return best


FRONT_CREASES = [  # (đường trong mặt phẳng X-Z với x>=0, bề rộng, độ sâu)
    ([(0, .85), (0, .67), (0, .50), (0, .08)], .013, .024),
    ([(.02, .585), (.10, .572), (.20, .568), (.30, .595), (.37, .65)], .010, .013),
    ([(.03, .80), (.14, .82), (.27, .80), (.38, .765)], .009, .009),
    ([(.385, .74), (.41, .66), (.43, .58)], .010, .011),
    ([(0, .50), (.15, .495)], .007, .007), ([(0, .385), (.15, .38)], .007, .007), ([(0, .27), (.14, .265)], .007, .007),
    ([(.12, .17), (.22, .10), (.25, .03)], .008, .008),
    ([(.24, .52), (.33, .46), (.36, .36)], .008, .007),
    ([(.07, 1.145), (.115, 1.075), (.16, 1.02)], .008, .008),    # rãnh mũi-miệng
    ([(.045, 1.115), (.07, 1.09), (.12, 1.075)], .005, .007),   # nếp môi nhe nanh
    ([(.11, 1.12), (.15, 1.105), (.19, 1.08)], .005, .006),
    ([(.0, 1.335), (.03, 1.305)], .007, .007),
]
BACK_CREASES = [
    ([(0, 1.12), (0, .80), (0, .48), (0, .18)], .026, .018),
    ([(.10, .91), (.22, .86), (.32, .77), (.29, .68)], .014, .007),
    ([(.13, .32), (.23, .49), (.30, .65)], .016, .006),
]


def crease_field(V, N):
    """Độ sâu rãnh giữa các khối cơ (>0 là lõm vào) và độ sáng ở rãnh."""
    ax = np.abs(V[:, 0])
    z, y = V[:, 2], V[:, 1]
    depth = np.zeros(len(V))
    front = smoothstep(.15, .6, -N[:, 1])
    back = smoothstep(.15, .6, N[:, 1])
    for pts, w, d in FRONT_CREASES:
        depth = np.maximum(depth, d * np.exp(-(poly_dist2(ax, z, pts) / w) ** 2) * front)
    for pts, w, d in BACK_CREASES:
        depth = np.maximum(depth, d * np.exp(-(poly_dist2(ax, z, pts) / w) ** 2) * back)
    # vòng rãnh quanh cánh tay: gốc bắp tay, khuỷu, gốc cẳng tay, cổ tay
    for side in (1, -1):
        for a, b, ts in ((ARM_S, ARM_E, (.16, .90)), (ARM_E, ARM_W, (.12, .88))):
            d = b - a
            t = ((V - a * np.array((side, 1, 1))) @ (d * np.array((side, 1, 1)))) / (d @ d)
            rad = np.linalg.norm(V - (a * np.array((side, 1, 1)) + t[:, None] * (d * np.array((side, 1, 1)))), axis=1)
            for t0 in ts:
                depth = np.maximum(depth, .0065 * np.exp(-((t - t0) / .035) ** 2) * (rad < .25) * (t > -.1) * (t < 1.1))
    return depth


def apply_face(V, col, emit):
    """Ba mắt phát sáng, hốc mắt, lòng miệng và mày tối. Chỉ phụ thuộc vị trí nên đặt thẳng
    lên điểm ảnh của lưới thấp cũng khớp lưới cao."""
    x, y, z = V[:, 0], V[:, 1], V[:, 2]
    ax = np.abs(x)
    face = (y < -.10)
    e, dx = eye_mask(ax, z, .108, 1.232, .071, .032, 26)
    lid = smoothstep(.003, -.003, (z - 1.232) - (.010 + .55 * (ax - .108)))
    e = e - (1 - lid) * 1.2
    eyes = smoothstep(0, .30, e) * face
    socket = smoothstep(-.35, .2, e) * face
    pupil = smoothstep(.0085, .0035, np.abs(dx)) * (e > .0) * face
    e3, _ = eye_mask(ax, z, 0, 1.385, .032, .058, 0)
    eyes = np.maximum(eyes, smoothstep(0, .30, e3) * face)
    socket = np.maximum(socket, smoothstep(-.35, .2, e3) * face)
    eye_col = lin(S['colors']['eye'])
    col = col * (1 - eyes[:, None]) + eye_col[None, :] * (.18 * eyes)[:, None]
    emit = emit * (1 - eyes[:, None]) + eye_col[None, :] * (eyes * (1 - .7 * pupil))[:, None]
    # Hốc elip: thành trước đỏ sẫm, đáy đỏ đen. Họng chỉ có một quầng sáng nhỏ.
    oval = 1 - (x / .154) ** 2 - ((z - .955) / .113) ** 2
    mouth = smoothstep(-.10, .12, oval) * smoothstep(-.39, -.245, y) * smoothstep(.015, -.035, y)
    deep = smoothstep(-.28, -.065, y)
    m_col = lin('#29080c')[None, :] * (1 - deep[:, None]) + lin('#080204')[None, :] * deep[:, None]
    col = col * (1 - mouth[:, None]) + m_col * mouth[:, None]
    throat = np.exp(-((x / .067) ** 2 + ((z - .946) / .055) ** 2)) * smoothstep(-.22, -.075, y)
    m_emit = lin('#ff5318')[None, :] * (mouth * throat * .075)[:, None]
    emit = emit * (1 - mouth[:, None]) + m_emit
    brow = smoothstep(1.34, 1.30, z) * smoothstep(1.22, 1.27, z) * face * smoothstep(.2, .1, ax - .06)
    col = col * (1 - .35 * brow[:, None])
    return col, emit, socket


def skin_fields(V, head=True, strength=1.0, N=None):
    """Khắc vảy/khe nứt và tô màu da. Trả về độ dời, màu nền, phát sáng (tuyến tính)."""
    x, y, z = V[:, 0], V[:, 1], V[:, 2]
    ax = np.abs(x)
    f1, f2, cid = voronoi(V, .017, 11)
    plate = smoothstep(0, .45, f2 - f1)
    f1b, _, cid2 = voronoi(V, .0075, 23)
    disp = (plate - .45) * .0034 + (.5 - np.minimum(f1b, 1)) * .0007
    # Vi vảy ở mặt nhẹ hơn thân để không che độ cong trán/má trên ảnh pháp tuyến 512.
    face_relief = smoothstep(.90, 1.08, z) * smoothstep(.05, -.15, y) * smoothstep(.35, .25, ax)
    disp *= 1 - .40 * face_relief
    # Ô lớn kéo dài theo chiều đứng, chỉ giữ vài nhánh nền; tránh mạng nứt đất khô.
    warp = .045 * np.stack([np.sin(y * 15 + z * 11), np.sin(z * 14 + x * 13), np.sin(x * 16 + y * 12)], 1)
    stretched = (V + warp) * np.array((1., 1., .58))
    c1, c2, _ = voronoi(stretched, .19, 5)
    crack = smoothstep(.075, .012, c2 - c1)
    patch = smoothstep(.58, .78, valnoise(V, .29, 3))
    front = (smoothstep(-.03, -.14, y) * smoothstep(.10, .24, z) * smoothstep(.92, .76, z)
             * smoothstep(.47, .30, ax))
    arms = smoothstep(.45, .60, ax) * smoothstep(.20, .45, z) * smoothstep(1.0, .90, z)
    back = (smoothstep(.04, .16, y) * smoothstep(.12, .26, z) * smoothstep(.97, .80, z)
            * smoothstep(.52, .34, ax))
    region = np.clip(front + arms + back, 0, 1) * strength
    cm = crack * patch * region * .45
    # Nứt chính giữa ngực chạy lệch trái/phải, nhánh phụ dài theo bầu ngực và bụng.
    chest_path = [(0, .865), (.020, .79), (-.012, .725), (.018, .65), (-.008, .58),
                  (.020, .50), (-.015, .43), (.012, .35), (-.006, .24), (.018, .13)]
    center = np.exp(-(poly_dist2(x, z, chest_path) / .009) ** 2)
    branches = np.zeros(len(V))
    for pts in ([(.012, .66), (.10, .70), (.145, .67), (.23, .73), (.31, .72)],
                [(.015, .49), (.09, .45), (.11, .40), (.175, .37), (.18, .29)]):
        branches = np.maximum(branches, np.exp(-(poly_dist2(ax, z, pts) / .0055) ** 2))
    forearm_path = [(-.79, .58), (-.71, .62), (-.64, .605), (-.57, .68), (-.50, .655), (-.39, .74)]
    arm_line = np.exp(-(poly_dist2(y, z, forearm_path) / .007) ** 2)
    arm_line *= arms * (.65 + .35 * np.sin(x * 27 + y * 15) ** 2)
    cm = np.maximum(cm, np.maximum(np.maximum(center, branches * .85) * front, arm_line) * strength)
    # Hai nhánh dung nham thưa phía lưng; không phủ kín thành mạng ô.
    back_line = np.zeros(len(V))
    for pts in ([(-.29, .79), (-.23, .75), (-.245, .69), (-.16, .63), (-.18, .56)],
                [(.08, .42), (.13, .48), (.115, .54), (.20, .59), (.24, .67)]):
        back_line = np.maximum(back_line, np.exp(-(poly_dist2(x, z, pts) / .007) ** 2))
    cm = np.maximum(cm, back_line * back * .55 * strength)
    disp = disp - cm * .0030
    glow_crease = np.zeros(len(V))
    cavity = np.zeros(len(V))
    if N is not None:
        # Gờ bả vai/cơ thang cao tối đa 8 mm, chỉ nằm trong chi tiết bake.
        back_facing = smoothstep(.15, .60, N[:, 1]) * smoothstep(.04, .14, y)
        shoulder_ridge = np.exp(-(poly_dist2(ax, z, [(.11, .91), (.21, .86), (.29, .78), (.27, .70)]) / .026) ** 2)
        trap_ridge = np.exp(-(poly_dist2(ax, z, [(.07, 1.07), (.16, .98), (.30, .90), (.38, .87)]) / .032) ** 2)
        disp += np.maximum(shoulder_ridge * .008, trap_ridge * .006) * back_facing
        cr = crease_field(V, N)
        disp = disp - cr
        cavity = np.clip(cr / .018, 0, 1)
        glow_crease = np.clip(cr / .009, 0, 1) * smoothstep(.56, .74, valnoise(V, .22, 6)) * region * .3
        cm = np.maximum(cm, glow_crease)
    base = lin(S['colors']['skin'])
    shade = (.80 + .75 * plate) * (.88 + .26 * cid) * (.9 + .2 * valnoise(V, .09, 8))
    col = base[None, :] * shade[:, None]
    col[:, 1] *= .55 + .45 * cid2
    col[:, 2] *= .8 + .4 * cid2
    # Giảm bão hòa 18% trong sRGB, rồi trả về màu tuyến tính để bake.
    srgb = np.where(col <= .0031308, col * 12.92, 1.055 * np.maximum(col, 0) ** (1 / 2.4) - .055)
    grey = srgb @ np.array((.2126, .7152, .0722))
    srgb = grey[:, None] + .82 * (srgb - grey[:, None])
    col = np.where(srgb <= .04045, srgb / 12.92, ((srgb + .055) / 1.055) ** 2.4)
    ridge = .18 * plate * (1 - cavity)
    col = col * (1 - ridge[:, None]) + lin('#6b3928')[None, :] * (ridge * shade)[:, None]
    col *= (1 - .32 * cavity[:, None])
    col = col * (1 - .75 * cm[:, None])
    core = smoothstep(.55, 1.0, cm)
    hot = lin(S['colors']['crack'])[None, :] * (1 - core[:, None]) + lin(S['colors']['eye'])[None, :] * core[:, None]
    emit = hot * (np.sqrt(cm) * 1.05)[:, None]
    if head:
        col, emit, socket = apply_face(V, col, emit)
        disp = disp - socket * .017
    return disp, col, emit


def paint_piece(p, V):
    """Độ dời, màu nền, phát sáng cho một phần phụ theo loại."""
    kind, tt = p['kind'], p.get('tt', np.zeros(len(V)))
    z = V[:, 2]
    emit = np.zeros((len(V), 3))
    if kind == 'skin':
        disp, col, emit = skin_fields(V, head=False, strength=.55)
        return disp * (.5 if p.get('part') in ('finger', 'ear') else .8), col, emit
    if kind == 'smoke':
        # Khói không mang vảy/đốt da; màu và rãnh dài đi theo vòng xoắn.
        ang = p['ang']
        strand = .5 + .5 * np.sin(3 * ang - tt * 2 * math.pi * 1.25)
        col = lin('#3a0e0c')[None, :] * (1 - strand[:, None]) + lin('#5a1814')[None, :] * strand[:, None]
        # Đốm than mờ, rời nhau theo góc quanh ống và chiều dài; không thành sọc sáng.
        ember = np.zeros(len(V))
        for t0, a0 in ((.14, .7), (.29, 3.8), (.46, 1.7), (.61, 5.2), (.75, 3.1), (.88, .3)):
            da = np.arctan2(np.sin(ang - a0), np.cos(ang - a0))
            ember = np.maximum(ember, np.exp(-((tt - t0) / .032) ** 2 - (da / .42) ** 2))
        emit = lin('#ff5a1a')[None, :] * (ember * .11)[:, None]
        return np.zeros(len(V)), col, emit
    if kind == 'tongue':
        crease = np.exp(-(V[:, 0] / .008) ** 2)
        col = lin('#701723')[None, :] * (.7 + .3 * valnoise(V, .035, 12))[:, None]
        col *= 1 - .35 * crease[:, None]
        emit = np.repeat((lin('#d03b1b') * .012)[None, :], len(V), axis=0)
        return np.zeros(len(V)), col, emit
    if kind == 'horn':
        ring = .5 + .5 * np.sin(2 * math.pi * tt * 11)
        base = lin(S['colors']['horn'])
        col = base[None, :] * ((.55 + .9 * ring) * (.8 + .5 * valnoise(V, .02, 4)))[:, None]
        col = col + lin('#5a3a28')[None, :] * (smoothstep(.55, 1.0, tt) * .35)[:, None]
        emit = lin('#ff6a1a')[None, :] * (smoothstep(.25, .0, tt) * .35 * valnoise(V, .03, 9))[:, None]
        if p.get('part') == 'horn_small':
            # Gốc màu da chìm vào sọ, chuyển dần sang sừng sẫm.
            root = smoothstep(.30, .0, tt)
            col = col * (1 - root[:, None]) + lin(S['colors']['skin'])[None, :] * root[:, None]
        return (valnoise(V, .012, 6) - .5) * .004, col, emit
    if kind == 'claw':
        base = lin(S['colors']['claw'])
        col = base[None, :] * (.7 + .9 * valnoise(V, .02, 5))[:, None]
        return np.zeros(len(V)), col, emit
    if kind == 'fang':
        base = lin(S['colors']['fang'])
        col = base[None, :] * (.45 + .6 * smoothstep(0, .6, tt))[:, None]
        return np.zeros(len(V)), col, emit
    # giáp đồng: búa đập, khe khắc, viền vàng sẫm
    f1, f2, cid = voronoi(V, .032, 15)
    groove = smoothstep(.16, .02, f2 - f1)
    base = lin(S['colors']['armor'])
    gold = lin(S['colors']['gold'])
    part = p.get('part')
    if part == 'pauldron':
        # Tọa độ riêng của mỗi phiến: viền theo vành elip, rãnh khắc hình móc ở mặt trước.
        local = V.copy()
        local[:, 0] = np.abs(local[:, 0])
        local = (local - np.array(p['shell_center'])) @ euler_matrix((0, p['tilt'], 0))
        q = local / np.array(p['shell_radii'])
        rim = smoothstep(.83, .97, np.hypot(q[:, 0], q[:, 1])) * .85
        engraving = poly_dist2(q[:, 0], q[:, 1], [(-.60, -.15), (-.32, -.55),
                               (.05, -.66), (.36, -.44), (.16, -.25), (-.02, -.42)])
        carving = np.exp(-(engraving / .065) ** 2) * smoothstep(.15, .50, q[:, 2])
        groove = np.maximum(groove * .30, carving)
    elif part == 'cuff':
        rim = np.maximum(smoothstep(.22, .0, tt), smoothstep(.78, 1.0, tt))
    elif part in ('spike', 'spine'):
        rim = smoothstep(.45, .05, tt) * .55
    else:
        rim = np.zeros(len(V))
    col = base[None, :] * (.7 + .6 * cid)[:, None] * (1 - .6 * groove[:, None])
    col = col * (1 - rim[:, None]) + gold[None, :] * (rim * (.8 + .4 * cid))[:, None]
    return (-groove * .004 + (cid - .5) * .003), col, emit


def sculpt_hi(body_v, body_t, parts_hi):
    """Gom mọi phần thành một lưới cao có màu (Col) và phát sáng (Em) theo đỉnh."""
    verts, faces, cols, emis, off = [], [], [], [], 0

    def add(v, tris, disp, col, emit):
        nonlocal off
        n = vertex_normals(v, tris)
        verts.append(v + n * disp[:, None])
        faces.append(tris + off)
        cols.append(col)
        emis.append(emit)
        off += len(v)
    d, c, e = skin_fields(body_v, head=True, N=vertex_normals(body_v, body_t))
    add(body_v, body_t, d, c, e)
    for p in parts_hi:
        tris = tri_array(p['f'])
        d, c, e = paint_piece(p, p['v'])
        add(p['v'], tris, d, c, e)
    log('lưới cao %d đỉnh' % off)
    return (np.vstack(verts), np.vstack(faces), np.vstack(cols), np.vstack(emis))


def hi_object(v, tris, col, emit):
    me = np_mesh('T154_hi', v, tris.tolist())
    for name, data in (('Col', col), ('Em', emit)):
        att = me.color_attributes.new(name=name, type='FLOAT_COLOR', domain='POINT')
        rgba = np.ones((len(v), 4), dtype=np.float32)
        rgba[:, :3] = np.clip(data, 0, 8)
        att.data.foreach_set('color', rgba.reshape(-1))
    ob = own(bpy.data.objects.new('T154_hi', me))
    link(ob)
    mat = own(bpy.data.materials.new('T154_hi_mat'))
    mat.use_nodes = True
    tree = mat.node_tree
    bsdf = tree.nodes.get('Principled BSDF')
    a1 = tree.nodes.new('ShaderNodeAttribute')
    a1.attribute_name = 'Col'
    a2 = tree.nodes.new('ShaderNodeAttribute')
    a2.attribute_name = 'Em'
    tree.links.new(a1.outputs['Color'], bsdf.inputs['Base Color'])
    tree.links.new(a2.outputs['Color'], bsdf.inputs['Emission Color'])
    bsdf.inputs['Emission Strength'].default_value = 1.0
    bsdf.inputs['Roughness'].default_value = .55
    me.materials.append(mat)
    return ob


# ---------------------------------------------------------------------------
# Lưới thấp và trọng số
# ---------------------------------------------------------------------------
BI = {n: i for i, n in enumerate(BONE_NAMES)}


def seg_dist(p, a, b):
    a, b = np.array(a, float), np.array(b, float)
    ab = b - a
    t = np.clip(((p - a) @ ab) / (ab @ ab), 0, 1)
    return np.linalg.norm(p - (a + t[:, None] * ab), axis=1)


def torso_w(z):
    """Trọng số thân theo độ cao: root, spine, chest, tail1."""
    n = len(z)
    w = np.zeros((n, len(BONE_NAMES)))
    t = np.clip((z - .30) / .30, 0, 1)
    low = np.clip((.10 - z) / .20, 0, 1)
    w[:, BI['chest']] = t
    w[:, BI['spine']] = (1 - t) * (1 - low)
    w[:, BI['root']] = (1 - t) * low * .5
    w[:, BI['tail1']] = (1 - t) * low * .5
    return w


def body_weights(V):
    x, y, z = V[:, 0], V[:, 1], V[:, 2]
    n = len(V)
    W = torso_w(z)
    # cổ và đầu
    neck = smoothstep(.80, .90, z) * (1 - smoothstep(.98, 1.08, z))
    head = smoothstep(.98, 1.08, z)
    chest_part = 1 - np.clip(neck + head, 0, 1)
    W *= chest_part[:, None]
    W[:, BI['neck']] = neck
    jaw = smoothstep(.985, .94, z) * smoothstep(-.09, -.15, y) * (z > .70)
    W[:, BI['head']] = head * (1 - jaw)
    W[:, BI['jaw']] = jaw * np.clip(head + neck * .6, 0, 1)
    W[:, BI['neck']] *= (1 - jaw * .6)
    # tay: theo khoảng cách tới từng đoạn xương
    for side, sign in (('L', 1), ('R', -1)):
        a = smoothstep(.30, .56, x * sign)
        names = ['shoulder_' + side, 'upper_arm_' + side, 'forearm_' + side, 'hand_' + side]
        dist = np.stack([seg_dist(V, *[b[2:4] for b in BONES if b[0] == nm][0]) for nm in names], 1)
        aw = 1.0 / (dist + .02) ** 3
        # vai chỉ nhận ít, trọng số chính ở cánh tay
        aw[:, 0] *= .35
        aw /= aw.sum(1)[:, None]
        # nửa trên của vùng vai còn theo chest để bớt gập
        W *= (1 - a)[:, None]
        for k, nm in enumerate(names):
            W[:, BI[nm]] += a * aw[:, k]
    return W


def tail_w(z):
    W = np.zeros((len(z), len(BONE_NAMES)))
    a = np.clip(-z / .20, 0, 1)
    b = np.clip((-z - .20) / .40, 0, 1)
    c = np.clip((-z - .60) / .30, 0, 1)
    W[:, BI['root']] = .5 * (1 - a)
    W[:, BI['tail1']] = (1 - b) - W[:, BI['root']]
    W[:, BI['tail2']] = b * (1 - c)
    W[:, BI['tail3']] = b * c
    return W


def piece_weights(p, V):
    bone = p['bone']
    side = p.get('side')
    if bone == 'tail':
        return tail_w(V[:, 2])
    W = np.zeros((len(V), len(BONE_NAMES)))
    name = bone + ('_' + side if bone in ('shoulder', 'upper_arm', 'forearm', 'hand') else '')
    if bone == 'chest' and V[:, 2].mean() < .45:
        name = 'spine'
    W[:, BI[name]] = 1
    return W


def poly_closest(c, pts):
    """Điểm gần nhất trên đường gấp khúc pts cho từng điểm c (N,3)."""
    best, bd = np.zeros_like(c), np.full(len(c), 9.0)
    for a, b in zip(pts, pts[1:]):
        a, b = np.array(a, float), np.array(b, float)
        ab = b - a
        t = np.clip(((c - a) @ ab) / (ab @ ab), 0, 1)
        q = a + t[:, None] * ab
        d = np.linalg.norm(c - q, axis=1)
        m = d < bd
        best[m], bd[m] = q[m], d[m]
    return best


def body_labels(v, tris):
    """Nhãn vùng cho từng tam giác thân: đầu, thân, tay trái/phải; mỗi vùng tách mặt trước/sau (hoặc trên/dưới)."""
    c = v[tris].mean(axis=1)
    x, y, z = c[:, 0], c[:, 1], c[:, 2]
    labels = np.zeros(len(tris), dtype=np.int64)
    arm = np.abs(x) > .40
    head = (~arm) & (z > .93)
    torso = (~arm) & (~head)
    labels[head] = np.where(y[head] < .02, 1, 2)
    labels[torso] = np.where(y[torso] < -.02, 3, 4)
    arm_pts = [ARM_S, ARM_E, ARM_W, ARM_W + HAND_A * .16]
    for side, base in ((1, 5), (-1, 7)):
        m = arm & (x * side > 0)
        mine = [np.array((a[0] * side, a[1], a[2])) for a in arm_pts]
        near = poly_closest(c[m], mine)
        labels[m] = base + (c[m][:, 2] >= near[:, 2]).astype(np.int64)
    return labels


def build_low(body_v, body_t, parts_lo):
    # Chặn ngân sách trước bake; phần phụ giữ bóng dáng, thân hấp thụ sai số decimate.
    part_count = sum(len(tri_array(p['f'])) for p in parts_lo)
    flame_count = len(build_flame()[1])
    target = min(S['body_tris'], S['tri_limit'] - part_count - flame_count)
    if target < 1400:
        raise RuntimeError('Phần phụ chiếm quá nhiều tam giác, không còn đủ cho mặt/thân')
    bv, bt = decimate_np(body_v, body_t, target)
    budget = min(72, 3860 - part_count - len(bt), S['tri_limit'] - part_count - flame_count - len(bt))
    before = len(bt)
    bv, bt = refine_head(bv, bt, body_v, body_t, budget)
    RES['head_extra_tris'] = int(len(bt) - before)
    if len(bt) + part_count + flame_count > S['tri_limit']:
        raise RuntimeError('Lưới thấp vượt 4.000 tam giác trước bake')
    c = bv[bt].mean(axis=1)
    face = ((c[:, 2] > .90) & (np.abs(c[:, 0]) < .39)) | ((c[:, 2] > .77) & (np.abs(c[:, 0]) < .27) & (c[:, 1] < -.18))
    RES['head_tris'] = int(face.sum())
    RES['front_head_tris'] = int((face & (c[:, 1] < .02)).sum())
    log('thân thấp %d tam giác, đầu %d' % (len(bt), RES['head_tris']))
    Vs, Ts, Ws, counts, uvs = [bv], [bt], [body_weights(bv)], {'body': len(bt)}, []
    off = len(bv)
    for p in parts_lo:
        tris, uvt = [], []
        for f, uvl in zip(p['f'], p['uvl']):
            for k in range(1, len(f) - 1):
                tris.append((f[0] + off, f[k] + off, f[k + 1] + off))
                uvt.append((uvl[0], uvl[k], uvl[k + 1]))
        tr = np.array(tris, dtype=np.int64)
        su, sv = p['uvsize']
        uvs.append(np.array(uvt, dtype=np.float64).reshape(-1, 2) * np.array((max(su, .01), max(sv, .01))))
        Vs.append(p['v'])
        Ts.append(tr)
        Ws.append(piece_weights(p, p['v']))
        off += len(p['v'])
        counts[p['part']] = counts.get(p['part'], 0) + len(tr)
    V = np.vstack(Vs)
    T = np.vstack(Ts)
    W = np.vstack(Ws)
    return V, T, W, counts, body_labels(bv, bt), len(bt), np.vstack(uvs)


def ribbon(points, widths, rings=12, side=1, phase=0.0):
    """Dải lửa phẳng hướng ra trước/sau; u 0..1 ngang dải. Trong Blender v = 1 ở gốc, 0 ở ngọn;
    bộ xuất glTF đảo v nên file GLB có v = 0 ở gốc, 1 ở ngọn."""
    pts = catmull(points, rings)
    wid = catmull(np.asarray(widths, float)[:, None], rings)[:, 0]
    t = np.linspace(0, 1, rings)
    # Gốc rộng thêm 30%, trở về bề rộng cũ từ giữa dải; giữ nguyên UV và ngọn.
    wid *= 1 + .30 * (1 - smoothstep(0., .55, t))
    envelope = np.sin(math.pi * t)
    pts[:, 0] += side * .05 * np.sin(2 * math.pi * (t * 1.3 + phase)) * envelope
    pts[:, 1] += .065 * np.sin(2 * math.pi * (t * 1.1 + phase)) * envelope
    tan = np.gradient(pts, axis=0)
    tan /= np.linalg.norm(tan, axis=1)[:, None]
    view = np.array((0., 1., 0.))
    sdir = np.cross(tan, view)
    sdir /= np.linalg.norm(sdir, axis=1)[:, None]
    angle = .7 * np.sin(2 * math.pi * (t * .8 + phase)) * envelope
    sdir = sdir * np.cos(angle)[:, None] + np.cross(tan, sdir) * np.sin(angle)[:, None]
    verts, uvs = [], []
    for i in range(rings):
        for u in (0., 1.):
            verts.append(pts[i] + sdir[i] * wid[i] * (u - .5))
            uvs.append((u, 1 - t[i]))          # glTF đảo v: xuất ra v = 0 ở gốc, 1 ở ngọn
    faces = []
    for i in range(rings - 1):
        a = 2 * i
        faces += [(a, a + 1, a + 3), (a, a + 3, a + 2)]
    return np.array(verts), np.array(faces), np.array(uvs)


def build_flame():
    specs = [([(.40, .36, .90), (.52, .39, 1.10), (.60, .42, 1.30), (.76, .37, 1.50), (.80, .40, 1.74)],
              [.15, .19, .16, .10, .0], 13, 0.0),
             ([(.43, .38, .80), (.60, .42, .94), (.84, .43, 1.10), (.97, .38, 1.26), (1.02, .40, 1.46)],
              [.13, .20, .18, .12, .0], 13, .3),
             ([(.52, .36, .72), (.72, .39, .62), (.92, .43, .56), (1.02, .39, .40)],
              [.10, .15, .11, .0], 11, .6)]
    Vs, Ts, UVs, off = [], [], [], 0
    for side in (1, -1):
        for pts, wid, rings, ph in specs:
            p2 = [(side * a, b, c) for a, b, c in pts]
            v, f, uv = ribbon(p2, wid, rings, side, ph)
            if side < 0:
                f = f[:, ::-1]
            Vs.append(v)
            Ts.append(f + off)
            UVs.append(uv)
            off += len(v)
    return np.vstack(Vs), np.vstack(Ts), np.vstack(UVs)


def make_object(name, v, tris, weights, uv=None, mat=None):
    me = np_mesh(name, v, tris.tolist())
    if name == 'demon_body':
        # Pháp tuyến theo diện tích, giống hệt low_n dùng cho tia bake màu.
        # Đặt trước bake và giữ nguyên khi xuất để cơ sở tiếp tuyến không đổi.
        me.normals_split_custom_set_from_vertices(vertex_normals(v, tris).tolist())
    ob = own(bpy.data.objects.new(name, me))
    link(ob)
    for bn in BONE_NAMES:
        ob.vertex_groups.new(name=bn)
    groups = [ob.vertex_groups[bn] for bn in BONE_NAMES]
    top = np.argsort(-weights, axis=1)[:, :4]
    for i in range(len(v)):
        w4 = [(k, weights[i, k]) for k in top[i] if weights[i, k] > 1e-4]
        tot = sum(w for _, w in w4)
        for k, w in w4:
            groups[k].add([i], w / tot, 'REPLACE')
    if uv is not None:
        layer = me.uv_layers.new(name='UVMap')
        loops = np.empty(len(me.loops), dtype=np.int32)
        me.loops.foreach_get('vertex_index', loops)
        layer.data.foreach_set('uv', uv[loops].reshape(-1))
    if mat:
        me.materials.append(mat)
    return ob


def uv_islands(ob):
    """Đếm đảo UV bằng cách gộp các mặt kề nhau có UV trùng ở cạnh chung."""
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    uv = bm.loops.layers.uv.active
    parent = list(range(len(bm.faces)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i
    bm.faces.ensure_lookup_table()
    for edge in bm.edges:
        faces = edge.link_faces
        if len(faces) != 2:
            continue
        pts = []
        for f in faces:
            d = {}
            for loop in f.loops:
                if loop.vert in edge.verts:
                    d[loop.vert.index] = loop[uv].uv.copy()
            pts.append(d)
        if all((pts[0][v] - pts[1][v]).length < 1e-5 for v in pts[0]):
            parent[find(faces[0].index)] = find(faces[1].index)
    count = len({find(i) for i in range(len(bm.faces))})
    bm.free()
    return count


def planar_uv(v, tris, labels):
    """Chiếu phẳng theo trục chính của pháp tuyến đã làm trơn, trong từng vùng cơ thể.

    Đảo UV có co giãn tối đa ~1,7 lần ở mép; mọi đảo cùng tỉ lệ mét nên mật độ ảnh đều.
    """
    n_t = len(tris)
    fn = np.cross(v[tris[:, 1]] - v[tris[:, 0]], v[tris[:, 2]] - v[tris[:, 0]])
    fn /= np.linalg.norm(fn, axis=1)[:, None] + 1e-12
    vn = vertex_normals(v, tris)
    ns = (vn[tris].mean(axis=1) + fn)
    axis = np.argmax(np.abs(ns), axis=1) * 2 + (np.take_along_axis(ns, np.argmax(np.abs(ns), axis=1)[:, None], 1)[:, 0] < 0)
    cluster = labels * 6 + axis
    edges = {}
    for t, tri in enumerate(tris):
        for k in range(3):
            key = tuple(sorted((int(tri[k]), int(tri[(k + 1) % 3]))))
            edges.setdefault(key, []).append(t)
    nbrs = [[] for _ in range(n_t)]
    for ts in edges.values():
        if len(ts) == 2:
            nbrs[ts[0]].append(ts[1])
            nbrs[ts[1]].append(ts[0])
    for _ in range(4):
        new = cluster.copy()
        for t in range(n_t):
            same_region = [cluster[o] for o in nbrs[t] if cluster[o] // 6 == cluster[t] // 6]
            if not same_region:
                continue
            ids, counts = np.unique(same_region, return_counts=True)
            best = ids[np.argmax(counts)]
            if best != cluster[t] and counts.max() >= 2:
                new[t] = best
        cluster = new
    uv = np.zeros((n_t, 3, 2))
    for t in range(n_t):
        a = int(cluster[t] % 6) // 2
        pts = v[tris[t]]
        if a == 0:
            uv[t] = pts[:, [1, 2]]
        elif a == 1:
            uv[t] = pts[:, [0, 2]]
        else:
            uv[t] = pts[:, [0, 1]]
    return uv.reshape(-1, 2)


def unwrap_all(ob, v, tris, labels, n_body, part_uv):
    """Thân: chiếu phẳng theo cụm pháp tuyến. Phần phụ: UV phân tích theo ống/cầu. Rồi xếp chung."""
    me = ob.data
    layer = me.uv_layers.active
    arr = np.zeros((len(me.loops), 2), dtype=np.float32)
    arr[:n_body * 3] = planar_uv(v[:], tris[:n_body], labels)
    arr[n_body * 3:] = part_uv
    layer.data.foreach_set('uv', arr.reshape(-1))
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.select_all(action='SELECT')
    bpy.ops.uv.average_islands_scale()
    bpy.ops.uv.pack_islands(rotate=True, margin_method='FRACTION', margin=.008)
    bpy.ops.object.mode_set(mode='OBJECT')
    RES['uv_islands'] = uv_islands(ob)


# ---------------------------------------------------------------------------
# Bake và vật liệu
# ---------------------------------------------------------------------------
def setup_cycles(scene, samples):
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = samples
    scene.cycles.use_denoising = False
    scene.cycles.device = 'CPU'
    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences
        for kind in ('OPTIX', 'CUDA'):
            prefs.compute_device_type = kind
            prefs.get_devices()
            gpus = [d for d in prefs.devices if d.type == kind]
            if gpus:
                for d in prefs.devices:
                    d.use = d.type == kind
                scene.cycles.device = 'GPU'
                RES['bake_device'] = kind
                return
    except Exception as exc:
        warn('Không bật được GPU cho bake: ' + str(exc))
    RES['bake_device'] = 'CPU'


def srgb_decode(x):
    return np.where(x <= .04045, x / 12.92, ((x + .055) / 1.055) ** 2.4)


def save_jpeg(path, rgb_lin, scene, quality=90):
    """Ghi JPEG từ mảng tuyến tính (H,W,3): view transform Standard mã hóa sRGB."""
    h, w = rgb_lin.shape[:2]
    img = bpy.data.images.new('T154_save', w, h, alpha=False)
    rgba = np.ones((h, w, 4), dtype=np.float32)
    rgba[:, :, :3] = np.clip(rgb_lin, 0, 1)
    img.pixels.foreach_set(rgba.reshape(-1))
    img.pack()
    prev = (scene.render.image_settings.file_format, scene.render.image_settings.quality,
            scene.render.image_settings.color_mode)
    scene.render.image_settings.file_format = 'JPEG'
    scene.render.image_settings.quality = quality
    scene.render.image_settings.color_mode = 'RGB'
    img.save_render(path, scene=scene)
    scene.render.image_settings.file_format, scene.render.image_settings.quality = prev[0], prev[1]
    scene.render.image_settings.color_mode = prev[2]
    bpy.data.images.remove(img)


def read_float(img):
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    return px.reshape(h, w, 4)[:, :, :3].astype(np.float64)


def raster_attributes(low_v, low_t, uv, hi_v, hi_t, hi_attrs, size, n_body, low_n):
    """Lấy màu/phát sáng theo điểm gần nhất trên lưới cao cho từng điểm ảnh UV của lưới thấp.

    Không phụ thuộc hướng tia nên không lệch như bake tia khi lưới thấp lệch lưới cao vài cm.
    """
    from mathutils.bvhtree import BVHTree
    bvh = BVHTree.FromPolygons([tuple(p) for p in hi_v.tolist()], [tuple(t) for t in hi_t.tolist()])
    px, py, pos, nrm, body = [], [], [], [], []
    uvp = uv.reshape(-1, 3, 2) * size
    for ti in range(len(low_t)):
        q = uvp[ti]
        x0, x1 = int(max(0, math.floor(q[:, 0].min()))), int(min(size - 1, math.ceil(q[:, 0].max())))
        y0, y1 = int(max(0, math.floor(q[:, 1].min()))), int(min(size - 1, math.ceil(q[:, 1].max())))
        if x1 < x0 or y1 < y0:
            continue
        xs, ys = np.meshgrid(np.arange(x0, x1 + 1), np.arange(y0, y1 + 1))
        xs, ys = xs.reshape(-1) + .5, ys.reshape(-1) + .5
        d = (q[1, 1] - q[2, 1]) * (q[0, 0] - q[2, 0]) + (q[2, 0] - q[1, 0]) * (q[0, 1] - q[2, 1])
        if abs(d) < 1e-9:
            continue
        w0 = ((q[1, 1] - q[2, 1]) * (xs - q[2, 0]) + (q[2, 0] - q[1, 0]) * (ys - q[2, 1])) / d
        w1 = ((q[2, 1] - q[0, 1]) * (xs - q[2, 0]) + (q[0, 0] - q[2, 0]) * (ys - q[2, 1])) / d
        w2 = 1 - w0 - w1
        m = (w0 >= -1e-4) & (w1 >= -1e-4) & (w2 >= -1e-4)
        if not m.any():
            continue
        tri = low_v[low_t[ti]]
        pts = w0[m, None] * tri[0] + w1[m, None] * tri[1] + w2[m, None] * tri[2]
        px.append(np.floor(xs[m]).astype(np.int64))
        py.append(np.floor(ys[m]).astype(np.int64))
        pos.append(pts)
        nn = w0[m, None] * low_n[low_t[ti][0]] + w1[m, None] * low_n[low_t[ti][1]] + w2[m, None] * low_n[low_t[ti][2]]
        nrm.append(nn / (np.linalg.norm(nn, axis=1)[:, None] + 1e-12))
        body.append(np.full(len(pts), ti < n_body))
    px, py, pos = np.concatenate(px), np.concatenate(py), np.vstack(pos)
    nrm, body = np.vstack(nrm), np.concatenate(body)
    loc = np.empty_like(pos)
    idx = np.empty(len(pos), dtype=np.int64)
    for i in range(len(pos)):
        # tia đi vào theo pháp tuyến lưới thấp, giống bake chọn-sang-hoạt-động; trượt thì lấy điểm gần nhất
        o = Vector(pos[i] + nrm[i] * .05)
        hit = bvh.ray_cast(o, Vector(-nrm[i]), .13)
        if hit[0] is None:
            hit = bvh.find_nearest(Vector(pos[i]))
        loc[i] = hit[0]
        idx[i] = hit[2]
    tv = hi_v[hi_t[idx]]
    a, b, c = tv[:, 0], tv[:, 1], tv[:, 2]
    v0, v1, v2 = b - a, c - a, loc - a
    d00, d01, d11 = (v0 * v0).sum(1), (v0 * v1).sum(1), (v1 * v1).sum(1)
    d20, d21 = (v2 * v0).sum(1), (v2 * v1).sum(1)
    den = d00 * d11 - d01 * d01 + 1e-18
    wb = (d11 * d20 - d01 * d21) / den
    wc = (d00 * d21 - d01 * d20) / den
    wa = 1 - wb - wc
    vals = []
    for attr in hi_attrs:
        t3 = attr[hi_t[idx]]
        vals.append(wa[:, None] * t3[:, 0] + wb[:, None] * t3[:, 1] + wc[:, None] * t3[:, 2])
    # mắt và miệng tính thẳng theo vị trí điểm ảnh trên thân (khớp lưới cao, không lệch do hốc mắt)
    col2, emit2, _ = apply_face(pos[body], vals[0][body], vals[1][body])
    vals[0][body], vals[1][body] = col2, emit2
    out = []
    for val in vals:
        img = np.zeros((size, size, 3))
        img[py, px] = val
        out.append(img)
    mask = np.zeros((size, size), dtype=bool)
    mask[py, px] = True
    # Trong phần phụ, chỉ ba ống khói nằm dưới z=0,20; loại thân khỏi mặt nạ.
    smoke = np.zeros_like(mask)
    smoke[py, px] = (~body) & (pos[:, 2] < .20)
    return out, mask, smoke


def dilate(img, mask, steps=5):
    """Lan màu ra viền đảo UV để mẫu song tuyến không lẫn nền đen."""
    img, mask = img.copy(), mask.copy()
    for _ in range(steps):
        acc = np.zeros_like(img)
        cnt = np.zeros(mask.shape)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
            sh = np.roll(np.roll(img, dy, 0), dx, 1)
            sm = np.roll(np.roll(mask, dy, 0), dx, 1)
            acc += sh * sm[:, :, None]
            cnt += sm
        fill = (~mask) & (cnt > 0)
        img[fill] = acc[fill] / cnt[fill][:, None]
        mask = mask | fill
    return img


def bake_textures(scene, hi, lo, raster):
    """Pháp tuyến và AO bake Cycles từ lưới cao; màu và phát sáng theo điểm gần nhất."""
    size = S['img']
    setup_cycles(scene, 16)
    mat = own(bpy.data.materials.new('T154_bake'))
    mat.use_nodes = True
    node = mat.node_tree.nodes.new('ShaderNodeTexImage')
    lo.data.materials.clear()
    lo.data.materials.append(mat)
    results = {}
    for kind, bake_type, filt, samples in (('normal', 'NORMAL', set(), 12), ('ao', 'AO', set(), 48)):
        img = bpy.data.images.new('T154_' + kind, size, size, alpha=False, float_buffer=True)
        img.colorspace_settings.name = 'Non-Color'
        node.image = img
        mat.node_tree.nodes.active = node
        bpy.ops.object.select_all(action='DESELECT')
        hi.select_set(True)
        lo.select_set(True)
        bpy.context.view_layer.objects.active = lo
        scene.cycles.samples = samples
        kwargs = dict(type=bake_type, use_selected_to_active=True, cage_extrusion=.05, max_ray_distance=.10,
                      margin=4, margin_type='EXTEND', use_clear=True, target='IMAGE_TEXTURES')
        if filt:
            kwargs['pass_filter'] = filt
        if bake_type == 'NORMAL':
            kwargs['normal_space'] = 'TANGENT'
        bpy.ops.object.bake(**kwargs)
        results[kind] = read_float(img)
        bpy.data.images.remove(img)
        log('bake ' + kind)
    bpy.data.materials.remove(mat)
    low_v, low_t, uv, hi_v, hi_t, hi_col, hi_emit, n_body, low_n = raster
    (color, emit), mask, smoke = raster_attributes(low_v, low_t, uv, hi_v, hi_t, (hi_col, hi_emit), size, n_body, low_n)
    results['color'] = dilate(color, mask)
    results['emit'] = dilate(emit, mask)
    results['smoke'] = smoke
    results['mask'] = mask
    log('màu/phát sáng theo điểm gần nhất')
    return results


def finish_textures(scene, maps):
    """Nhân AO vào màu, lưu JPEG; trả về đường dẫn."""
    os.makedirs(TMP, exist_ok=True)
    ao = maps['ao'][:, :, :1]
    color = maps['color'] * (.50 + .50 * np.clip(ao, 0, 1))
    smoke = maps['smoke']
    # Khói vẫn có AO nhẹ, nhưng không chìm xuống đen khiến phản xạ trắng lấn sắc đỏ.
    color[smoke] = np.clip(maps['color'][smoke] * (.88 + .12 * np.clip(ao[smoke], 0, 1)),
                           lin('#3a0e0c'), lin('#5a1814'))
    paths = {}
    paths['color'] = os.path.join(TMP, 'demon_color.jpg')
    save_jpeg(paths['color'], color, scene, 88)
    # Đọc ngược JPEG dạng dữ liệu: phát hiện bộ đệm byte/pack ghi giá trị tuyến tính
    # trực tiếp thành sRGB. Chỉ bù vùng khói, giữ màu thân vòng 3.
    def jpeg_pixels(path):
        img = bpy.data.images.load(path, check_existing=False)
        try:
            img.colorspace_settings.name = 'Non-Color'
            return read_float(img)
        finally:
            bpy.data.images.remove(img)

    def encode_srgb(value):
        return np.where(value <= .0031308, value * 12.92, 1.055 * np.maximum(value, 0) ** (1 / 2.4) - .055)

    observed = jpeg_pixels(paths['color'])[smoke]
    expected = encode_srgb(color[smoke])
    compensate = bool(len(observed) and np.mean(np.abs(observed - color[smoke])) < np.mean(np.abs(observed - expected)))
    emit = maps['emit'].copy()
    if compensate:
        color[smoke] = expected
        emit[smoke] = encode_srgb(emit[smoke])
    # Lan lại viền đảo sau chỉnh màu để tránh đường khói đen khi lọc ảnh trong game.
    color = dilate(color, maps['mask'])
    emit = dilate(emit, maps['mask'])
    save_jpeg(paths['color'], color, scene, 88)
    observed = jpeg_pixels(paths['color'])[smoke]
    RES['smoke_jpeg_compensated'] = compensate
    if len(observed):
        RES['smoke_jpeg_rgb_median'] = np.rint(np.median(observed, axis=0) * 255).astype(int).tolist()
        if np.max(np.abs(np.median(observed, axis=0) - np.median(expected, axis=0))) > .04:
            warn('Màu khói trong JPEG lệch quá 10 mức sRGB; cần xem demon_color.jpg')
    paths['emit'] = os.path.join(TMP, 'demon_emit.jpg')
    save_jpeg(paths['emit'], emit, scene, 90)
    normal = np.clip(maps['normal'], 0, 1)
    paths['normal'] = os.path.join(TMP, 'demon_normal.jpg')
    # normal là dữ liệu: giải mã trước để mã hóa sRGB của save_render trả đúng giá trị
    save_jpeg(paths['normal'], srgb_decode(normal), scene, 92)
    return paths


def body_material(paths):
    mat = own(bpy.data.materials.new('demon_body'))
    mat.use_nodes = True
    tree = mat.node_tree
    bsdf = tree.nodes.get('Principled BSDF')
    imgs = {}
    for kind, space in (('color', 'sRGB'), ('normal', 'Non-Color'), ('emit', 'sRGB')):
        node = tree.nodes.new('ShaderNodeTexImage')
        node.image = bpy.data.images.load(paths[kind], check_existing=False)
        node.image.colorspace_settings.name = space
        node.image.name = 'demon_' + kind
        imgs[kind] = node
    tree.links.new(imgs['color'].outputs['Color'], bsdf.inputs['Base Color'])
    nm = tree.nodes.new('ShaderNodeNormalMap')
    tree.links.new(imgs['normal'].outputs['Color'], nm.inputs['Color'])
    tree.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
    tree.links.new(imgs['emit'].outputs['Color'], bsdf.inputs['Emission Color'])
    bsdf.inputs['Emission Strength'].default_value = 1.0
    bsdf.inputs['Roughness'].default_value = .78
    bsdf.inputs['Metallic'].default_value = 0.0
    mat.use_backface_culling = True
    return mat


def flame_material():
    mat = own(bpy.data.materials.new('demon_flame'))
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = rgb('#ff6a1a')
    bsdf.inputs['Emission Color'].default_value = rgb('#ff6a1a')
    bsdf.inputs['Emission Strength'].default_value = 1.0
    bsdf.inputs['Alpha'].default_value = .38
    mat.use_backface_culling = False
    try:
        mat.surface_render_method = 'BLENDED'
    except Exception as exc:
        warn('flame blend: ' + str(exc))
    return mat


def make_rig_bind(ob, rig):
    ob.parent = rig
    mod = ob.modifiers.new('Armature', 'ARMATURE')
    mod.object = rig


# chép từ avatar/build.py (xương, clip, cảnh, xuất)
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


# chép từ avatar/build.py; thêm cỡ ảnh, khoảng cách, tâm nhìn để chụp cận.
def shoot(scene, camera, lights, path, az, size=(320, 720), dist=None, target_z=None, elev=.18, center=(0, 0)):
    p = S['preview']
    dist = dist or p['distance']
    tz = p['target_z'] if target_z is None else target_z
    angle = math.radians(az)
    target = (center[0], center[1], tz)
    aim(camera, (center[0] + dist * math.sin(angle), center[1] - dist * math.cos(angle), tz + elev), target)
    for light, offset, elevation in zip(lights, (-38, 55, 165), (48, 25, 35)):
        a, e = angle + math.radians(offset), math.radians(elevation)
        aim(light, (center[0] + 6 * math.sin(a) * math.cos(e), center[1] - 6 * math.cos(a) * math.cos(e),
                    tz + 6 * math.sin(e)), target)
    render = scene.render
    render.resolution_x, render.resolution_y, render.resolution_percentage = size[0], size[1], 100
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
                  export_lights=False, export_texcoords=True, export_normals=True, export_apply=False,
                  export_materials='EXPORT', export_vertex_color='NONE',
                  export_image_format='JPEG', export_jpeg_quality=90, export_skins=True,
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




def jpeg_size(data):
    """Đọc rộng x cao từ khối SOF của JPEG; None nếu không phải JPEG."""
    if data[:2] != b'\xff\xd8':
        return None
    i = 2
    while i + 9 < len(data):
        if data[i] != 0xFF:
            i += 1
            continue
        marker = data[i + 1]
        if marker in (0xC0, 0xC1, 0xC2):
            h, w = struct.unpack_from('>HH', data, i + 5)
            return [w, h]
        i += 2 + struct.unpack_from('>H', data, i + 2)[0]
    return None


def inspect_glb(path):
    document, binary = read_glb(path)
    RES['glb_kb'] = round(os.path.getsize(path) / 1024, 2)
    RES['nodes'] = [node.get('name', '') for node in document.get('nodes', [])]
    RES['materials'] = [mat.get('name', '') for mat in document.get('materials', [])]
    attributes, per_mesh = [], {}
    for mesh in document.get('meshes', []):
        for i, primitive in enumerate(mesh.get('primitives', [])):
            attributes.append({'mesh': mesh.get('name', ''), 'primitive': i,
                               'attributes': sorted(primitive['attributes'])})
            if 'indices' in primitive:
                count = document['accessors'][primitive['indices']]['count'] // 3
            else:
                count = document['accessors'][primitive['attributes']['POSITION']]['count'] // 3
            per_mesh[mesh.get('name', '')] = per_mesh.get(mesh.get('name', ''), 0) + count
    RES['glb_attributes'] = attributes
    bounds = {}
    for mesh in document.get('meshes', []):
        acc = document['accessors'][mesh['primitives'][0]['attributes']['POSITION']]
        bounds[mesh.get('name', '')] = {'min': [round(x, 3) for x in acc['min']], 'max': [round(x, 3) for x in acc['max']]}
    RES['glb_bounds'] = bounds
    RES['glb_mesh_triangles'] = per_mesh
    RES['glb_triangles'] = sum(per_mesh.values())
    need = {'POSITION', 'NORMAL', 'TEXCOORD_0', 'JOINTS_0', 'WEIGHTS_0'}
    for part in attributes:
        if not need <= set(part['attributes']):
            RES['over_budget'].append('lưới ' + part['mesh'] + ' thiếu thuộc tính ' + str(sorted(need - set(part['attributes']))))
    if not any(p['mesh'].startswith('demon_body') for p in attributes):
        RES['over_budget'].append('thiếu lưới demon_body')
    RES['glb_bones'] = [document['nodes'][index].get('name', '')
                        for skin in document.get('skins', []) for index in skin.get('joints', [])]
    if set(RES['glb_bones']) != set(BONE_NAMES):
        RES['over_budget'].append('bộ xương GLB không khớp A3')
    # ảnh nhúng: số lượng, kích thước điểm ảnh, số byte
    images = []
    for img in document.get('images', []):
        view = document['bufferViews'][img['bufferView']]
        off = view.get('byteOffset', 0)
        data = bytes(binary[off:off + view['byteLength']])
        images.append({'name': img.get('name', ''), 'mime': img.get('mimeType', ''),
                       'size': jpeg_size(data), 'bytes': view['byteLength']})
        if images[-1]['size'] and max(images[-1]['size']) > S['img']:
            RES['over_budget'].append('ảnh ' + img.get('name', '') + ' vượt ' + str(S['img']) + ' px')
    RES['glb_images'] = images
    if len(images) != 3:
        RES['over_budget'].append('cần đúng ba ảnh bake nhúng trong GLB')
    if any(img['mime'] != 'image/jpeg' or img['size'] is None for img in images):
        RES['over_budget'].append('ảnh bake phải là JPEG nhúng đọc được kích thước')
    for mesh in document.get('meshes', []):
        if mesh.get('name') != 'demon_flame':
            continue
        attrs = mesh['primitives'][0]['attributes']
        def read_accessor(index, comps):
            acc = document['accessors'][index]
            view = document['bufferViews'][acc['bufferView']]
            off = view.get('byteOffset', 0) + acc.get('byteOffset', 0)
            stride = view.get('byteStride', 4 * comps)
            return np.array([struct.unpack_from('<' + 'f' * comps, binary, off + i * stride) for i in range(acc['count'])])
        pos, uvv = read_accessor(attrs['POSITION'], 3), read_accessor(attrs['TEXCOORD_0'], 2)
        RES['flame_uv_mean_y'] = {'v_low': round(float(pos[uvv[:, 1] < .05][:, 1].mean()), 3),
                                  'v_high': round(float(pos[uvv[:, 1] > .95][:, 1].mean()), 3)}
    mats = {m.get('name', ''): m for m in document.get('materials', [])}
    body = mats.get('demon_body', {})
    pbr = body.get('pbrMetallicRoughness', {})
    RES['body_material'] = {'baseColorTexture': 'baseColorTexture' in pbr,
                            'normalTexture': 'normalTexture' in body,
                            'emissiveTexture': 'emissiveTexture' in body,
                            'emissiveFactor': body.get('emissiveFactor')}
    if not all(RES['body_material'][k] for k in ('baseColorTexture', 'normalTexture', 'emissiveTexture')):
        RES['over_budget'].append('demon_body thiếu ảnh màu/pháp tuyến/phát sáng')
    if body.get('emissiveFactor') != [1, 1, 1]:
        RES['over_budget'].append('emissiveFactor của demon_body khác [1,1,1]')
    if 'demon_flame' not in mats:
        RES['over_budget'].append('thiếu vật liệu demon_flame')
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
    if RES['glb_triangles'] > S['tri_limit']:
        RES['over_budget'].append('tam giác GLB vượt 4.000')
    if RES['glb_kb'] > S['kb_limit']:
        RES['over_budget'].append('GLB vượt 600 KB')


def set_preview_engine(scene):
    for engine in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT'):
        try:
            scene.render.engine = engine
            return
        except Exception:
            continue
    setup_cycles(scene, 24)


def thumbnail(scene, camera, lights, out):
    """Ảnh 128 px của mặt trước cạnh ảnh 2D gốc để tự kiểm độ đọc ra hình."""
    import numpy as np
    path = os.path.join(TMP, 't154_thumb_front.png')
    bpy.data.objects[SCENE + 'Owner'].hide_render = True
    shoot(scene, camera, lights, path, 0, size=(128, 128), dist=2.55, target_z=.8, elev=.0)
    ref = bpy.data.images.load(os.path.join(REPO, 'public', 'img', 'fx', 'demon-4.webp'), check_existing=False)
    ref.scale(128, 128)
    w, h = ref.size
    r = np.empty(w * h * 4, dtype=np.float32)
    ref.pixels.foreach_get(r)
    r = r.reshape(h, w, 4)
    alpha = r[:, :, 3:4]
    bg = np.array([.1, .1, .12, 1.])
    r = r * alpha + bg * (1 - alpha)
    bpy.data.images.remove(ref)
    shot = bpy.data.images.load(path, check_existing=False)
    a = np.empty(128 * 128 * 4, dtype=np.float32)
    shot.pixels.foreach_get(a)
    a = a.reshape(128, 128, 4)
    bpy.data.images.remove(shot)
    full = np.concatenate([a, r], axis=1)
    save_jpeg(out, full[:, :, :3], scene, 92)


def make_views(scene, rig):
    os.makedirs(TMP, exist_ok=True)
    os.makedirs(IMG_DIR, exist_ok=True)
    rig.animation_data.use_nla = False
    rig.animation_data.action = None
    set_preview_engine(scene)
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
            path = os.path.join(IMG_DIR, 'ban-mau-ma-vuong-4-goc.jpg')
            montage(paths, path)
            RES['views'] = path
            paths = []
            for name in ('idle', 'drift', 'scoff', 'taunt1'):
                apply_pose(rig, pose_of(name, .5))
                bpy.context.view_layer.update()
                path = os.path.join(folder, 'pose_' + name + '.png')
                shoot(scene, camera, lights, path, 30)
                paths.append(path)
            path = os.path.join(IMG_DIR, 'ban-mau-ma-vuong-tu-the.jpg')
            montage(paths, path)
            RES['poses'] = path
            apply_pose(rig, pose_of('idle', .5))
            bpy.context.view_layer.update()
            RES['thumb'] = os.path.join(TMP, 'ma-vuong-128px.jpg')
            thumbnail(scene, camera, lights, RES['thumb'])
            if STAGE_CLOSE:
                bpy.data.objects[SCENE + 'Owner'].hide_render = True
                for name, az, dist, tz in (('close_front', 0, 2.0, 1.0), ('close_side', 70, 2.0, 1.0),
                                           ('close_hands', 20, 2.2, .55), ('close_back', 180, 2.4, .85)):
                    path = os.path.join(TMP, 't154_' + name + '.png')
                    shoot(scene, camera, lights, path, az, size=(800, 800), dist=dist, target_z=tz, elev=.0)
    finally:
        rig.animation_data.use_nla = True
        apply_pose(rig, {})


def views_hi(scene, hi):
    """Xem nhanh lưới cao (chưa bake) để lặp hình khối."""
    set_preview_engine(scene)
    camera, lights = stage(scene)
    bpy.data.objects[SCENE + 'Owner'].hide_render = True
    for name, az, dist, tz in (('hi_front', 0, 2.6, .55), ('hi_q45', 45, 2.6, .55), ('hi_side', 90, 2.6, .55),
                               ('hi_back', 180, 2.6, .55), ('hi_head', 0, 1.1, 1.2), ('hi_hand', 60, 1.5, .62),
                               ('hi_head45', 40, 1.1, 1.2)):
        path = os.path.join(TMP, 't154_' + name + '.png')
        shoot(scene, camera, lights, path, az, size=(800, 800), dist=dist, target_z=tz, elev=.0)
    shoot(scene, camera, lights, os.path.join(TMP, 't154_hi_hand.png'), 50, size=(800, 800), dist=1.2,
          target_z=.68, elev=.1, center=(.78, -.85))


STAGE_CLOSE = bool(globals().get('CLOSE', False))


def main():
    scene = new_scene()
    bv, bt = build_body_smooth()
    parts_hi = make_parts(True)
    hv, ht, hc, he = sculpt_hi(bv, bt, parts_hi)
    hi = hi_object(hv, ht, hc, he)
    RES['hi_triangles'] = int(len(ht))
    if STAGE == 'hi':
        views_hi(scene, hi)
        return RES
    parts_lo = make_parts(False)
    V, T, W, counts, labels, n_body, part_uv = build_low(bv, bt, parts_lo)
    RES['parts'] = counts
    lo = make_object('demon_body', V, T, W)
    me = lo.data
    if not me.uv_layers:
        me.uv_layers.new(name='UVMap')
    if STAGE == 'low':
        mat = own(bpy.data.materials.new('T154_gray'))
        mat.use_nodes = True
        mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (.5, .22, .2, 1)
        lo.data.materials.append(mat)
        bpy.data.objects.remove(hi)
        for obj in list(bpy.data.objects):
            if obj.name.startswith(SCENE + 'Owner'):
                obj.hide_render = True
        set_preview_engine(scene)
        camera, lights = stage(scene)
        bpy.data.objects[SCENE + 'Owner'].hide_render = True
        for name, az, dist, tz in (('low_front', 0, 2.6, .55), ('low_q45', 45, 2.6, .55), ('low_head', 30, 1.1, 1.2)):
            shoot(scene, camera, lights, os.path.join(TMP, 't154_' + name + '.png'), az, size=(800, 800), dist=dist, target_z=tz, elev=.0)
        RES['low_triangles'] = int(len(T))
        return RES
    unwrap_all(lo, V, T, labels, n_body, part_uv)
    # Chế độ sửa UV có thể làm mất pháp tuyến riêng: đặt lại sau UV, trước mọi bake.
    me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
    me.normals_split_custom_set_from_vertices(vertex_normals(V, T).tolist())
    log('UV xong, %d tam giác thấp' % len(T))
    lay = lo.data.uv_layers.active
    uv_arr = np.empty(len(lo.data.loops) * 2, dtype=np.float32)
    lay.data.foreach_get('uv', uv_arr)
    low_v, low_t = mesh_np(lo.data)
    low_n = vertex_normals(low_v, low_t)
    maps = bake_textures(scene, hi, lo, (low_v, low_t, uv_arr.reshape(-1, 2).astype(np.float64), hv, ht, hc, he, n_body, low_n))
    paths = finish_textures(scene, maps)
    RES['bake_files'] = paths
    lo.data.materials.clear()
    lo.data.materials.append(body_material(paths))
    bpy.data.objects.remove(hi)
    fv, ft, fuv = build_flame()
    fw = np.zeros((len(fv), len(BONE_NAMES)))
    fw[:, BI['chest']] = 1
    flame = make_object('demon_flame', fv, ft, fw, uv=fuv, mat=flame_material())
    rig = make_rig()
    bind(lo, rig)
    bind(flame, rig)
    make_clips(rig)
    RES['triangles'] = {'demon_body': int(len(T)), 'demon_flame': int(len(ft))}
    RES['total_triangles'] = int(len(T) + len(ft))
    RES['bones'] = BONE_NAMES
    RES['clips'] = [{'name': name, 'seconds': duration, 'loop': loop}
                    for name, (duration, loop) in S['clips'].items()]
    RES['blender_version'] = bpy.app.version_string
    RES['glb_kb'] = None
    if len(T) > 3860:
        RES['over_budget'].append('demon_body vượt 3.860 tam giác')
    if len(ft) > 400:
        RES['over_budget'].append('demon_flame vượt 400 tam giác')
    if RES['total_triangles'] > S['tri_limit']:
        RES['over_budget'].append('tổng tam giác vượt 4.000')
    if {'glb', 'check'} & OUT:
        if 'glb' in OUT:
            path = GLB_PATH
            export(path, [lo, flame, rig])
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
                export(path, [lo, flame, rig])
                try:
                    exact_clip_times(path)
                except Exception as exc:
                    warn('Không chuẩn hoá được thời gian GLB: ' + str(exc))
                inspect_glb(path)
            RES['checked_temporary_glb'] = True
    if 'views' in OUT:
        make_views(scene, rig)
    RES['seconds'] = round(time.time() - T0, 1)
    return RES


try:
    result = main()
except Exception as error:
    RES['error'] = type(error).__name__ + ': ' + str(error)
    print('RESULT ' + json.dumps(RES, ensure_ascii=False), flush=True)
    raise
else:
    print('RESULT ' + json.dumps(result, ensure_ascii=False), flush=True)
