"""Kỳ Đài · sân v2 (T-118): dựng cảnh 3D thật cho sân Hỏa Diệm Sơn (`volcano`) bằng Blender.

Chạy trong Blender (5.x) đang mở:
    import runpy
    runpy.run_path(r'<repo>/tools/blender/kydao/field2.py',
                   init_globals={'REPO': r'<repo>', 'VARIANT': 'chess', 'PREVIEW': True})
Tham số (đặt qua init_globals):
    REPO     đường dẫn gốc repo
    VARIANT  'chess' | 'xiangqi' | 'both'
    PREVIEW  True: ảnh nhỏ 704x352, ít mẫu, ghi vào docs/ky-dai/anh/ (chỉ để lặp nhanh)
             False: bản cuối 1408x704, ghi vào public/img/kydao/fields2/*.webp
    ROUND    số vòng (đặt tên ảnh docs/ky-dai/anh/volcano-v2-vongN.jpg), tuỳ chọn
    SAMPLES  ghi đè số mẫu, tuỳ chọn

Hệ toạ độ (Z lên, 1 đơn vị = 1 ô cờ): vùng bàn x∈[-4,4], y∈[0,4], đường giữa ở y=0, mép người chơi y=4.
Toàn cảnh x∈[-5,5; 5,5], y∈[0; 5,5]. Máy quay trực giao nhìn xuống tại (0; 2,75; 20), ortho_scale 11,
xoay (0,0,π): mép trên ảnh là y=0, mép dưới ảnh là y=5,5 (phía người chơi). 128 px mỗi đơn vị ở bản cuối.

Mọi số ngẫu nhiên đi qua random.Random('field2:volcano') và mathutils.noise với độ lệch cố định.
Làm việc trong cảnh riêng 'KyDaiV2', không đụng cảnh khác, không lưu .blend.
"""
import bpy, bmesh, json, math, os, random, time
import numpy as np
from mathutils import Matrix, Vector, noise

REPO = globals().get('REPO')
VARIANT = globals().get('VARIANT', 'chess')
PREVIEW = globals().get('PREVIEW', True)
ROUND = globals().get('ROUND', 0)
SAMPLES = globals().get('SAMPLES')
CHECK_MARKERS = globals().get('CHECK_MARKERS', False)     # 4 khối đỏ kiểm toạ độ (chỉ để thử)
if not REPO:
    raise SystemExit('Thiếu REPO')

SCENE = 'KyDaiV2'
GLARE = globals().get('GLARE', (1.2, 0.3, 0.4))        # ngưỡng, cường độ, cỡ quầng sáng
SEED = 'field2:volcano'
LIGHT_PARITY = 1          # ô SÁNG khi (cột từ trái ảnh + hàng từ đường giữa) % 2 == LIGHT_PARITY (theo đặc tả: lẻ)
FIELD_X, FIELD_Y0, FIELD_Y1 = 5.5, 0.0, 5.5


def rgb(hexs, a=1.0):
    h = hexs.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple((v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4) for v in c) + (a,)


def sstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3 - 2 * t)


# ───────────────────────── dựng vật liệu bằng node ─────────────────────────
class Mat:
    """Trợ giúp dựng node cho một vật liệu."""

    def __init__(self, name):
        self.m = bpy.data.materials.new(name)
        self.m.use_nodes = True
        self.nt = self.m.node_tree
        self.nt.nodes.clear()
        self.out = self.n('ShaderNodeOutputMaterial')

    def n(self, kind, **kw):
        node = self.nt.nodes.new(kind)
        for k, v in kw.items():
            setattr(node, k, v)
        return node

    def link(self, a, b):
        self.nt.links.new(a, b)

    def coord(self, kind='Object', scale=1.0, loc=(0, 0, 0)):
        tc = self.n('ShaderNodeTexCoord')
        mp = self.n('ShaderNodeMapping')
        mp.inputs['Scale'].default_value = (scale,) * 3
        mp.inputs['Location'].default_value = loc
        self.link(tc.outputs[kind], mp.inputs['Vector'])
        return mp.outputs[0]

    def noise(self, vec, scale, detail=4.0, rough=0.55, dist=0.0):
        t = self.n('ShaderNodeTexNoise')
        t.inputs['Scale'].default_value = scale
        t.inputs['Detail'].default_value = detail
        t.inputs['Roughness'].default_value = rough
        t.inputs['Distortion'].default_value = dist
        self.link(vec, t.inputs['Vector'])
        return t.outputs['Fac']

    def voronoi(self, vec, scale, feature='F1', out='Distance', rand=1.0):
        t = self.n('ShaderNodeTexVoronoi')
        t.feature = feature
        t.inputs['Scale'].default_value = scale
        t.inputs['Randomness'].default_value = rand
        self.link(vec, t.inputs['Vector'])
        return t.outputs[out]

    def ramp(self, fac, stops):
        r = self.n('ShaderNodeValToRGB')
        el = r.color_ramp.elements
        el[0].position, el[0].color = stops[0]
        el[1].position, el[1].color = stops[-1]
        for pos, col in stops[1:-1]:
            e = el.new(pos)
            e.color = col
        self.link(fac, r.inputs[0])
        return r.outputs[0]

    def math(self, op, a, b=None, clamp=False):
        m = self.n('ShaderNodeMath')
        m.operation = op
        m.use_clamp = clamp
        for i, v in enumerate((a, b)):
            if v is None:
                continue
            if isinstance(v, (int, float)):
                m.inputs[i].default_value = v
            else:
                self.link(v, m.inputs[i])
        return m.outputs[0]

    def mixc(self, a, b, fac, blend='MIX'):
        x = self.n('ShaderNodeMix', data_type='RGBA', blend_type=blend)
        if isinstance(fac, (int, float)):
            x.inputs[0].default_value = fac
        else:
            self.link(fac, x.inputs[0])
        for idx, v in ((6, a), (7, b)):
            if isinstance(v, tuple):
                x.inputs[idx].default_value = v
            else:
                self.link(v, x.inputs[idx])
        return x.outputs[2]

    def warp(self, vec, amt=0.4, scale=2.0):
        n = self.n('ShaderNodeTexNoise')
        n.inputs['Scale'].default_value = scale
        n.inputs['Detail'].default_value = 3.0
        self.link(vec, n.inputs['Vector'])
        m = self.n('ShaderNodeMix', data_type='VECTOR')
        m.inputs[0].default_value = amt
        self.link(vec, m.inputs[4])
        self.link(n.outputs['Color'], m.inputs[5])
        return m.outputs[1]

    def ao(self, color, dist=0.35, only_local=False):
        """Che khuất môi trường (Cycles): tối ở khe, chân vật thể."""
        a = self.n('ShaderNodeAmbientOcclusion')
        a.inputs['Distance'].default_value = dist
        a.only_local = only_local
        if isinstance(color, tuple):
            a.inputs['Color'].default_value = color
        else:
            self.link(color, a.inputs['Color'])
        return a.outputs['Color']

    def sepc(self, color):
        s = self.n('ShaderNodeSeparateColor')
        self.link(color, s.inputs[0])
        return s.outputs[0]

    def ramp_f(self, fac, a, b):
        """Chuyển một giá trị từ [a,b] về [0,1] (Map Range, có kẹp)."""
        m = self.n('ShaderNodeMapRange')
        m.inputs['From Min'].default_value = a
        m.inputs['From Max'].default_value = b
        m.clamp = True
        self.link(fac, m.inputs['Value'])
        return m.outputs['Result']

    def sepz(self, vec):
        s = self.n('ShaderNodeSeparateXYZ')
        self.link(vec, s.inputs[0])
        return s.outputs

    def bump(self, height, strength, dist=0.1):
        b = self.n('ShaderNodeBump')
        b.inputs['Strength'].default_value = strength
        b.inputs['Distance'].default_value = dist
        self.link(height, b.inputs['Height'])
        return b.outputs[0]

    def principled(self, color, rough=0.8, normal=None, emit=None, emit_strength=0.0, metal=0.0, spec=0.5):
        p = self.n('ShaderNodeBsdfPrincipled')
        if isinstance(color, tuple):
            p.inputs['Base Color'].default_value = color
        else:
            self.link(color, p.inputs['Base Color'])
        if isinstance(rough, (int, float)):
            p.inputs['Roughness'].default_value = rough
        else:
            self.link(rough, p.inputs['Roughness'])
        p.inputs['Metallic'].default_value = metal
        if 'Specular IOR Level' in p.inputs:
            p.inputs['Specular IOR Level'].default_value = spec
        if normal is not None:
            self.link(normal, p.inputs['Normal'])
        if emit is not None:
            if isinstance(emit, tuple):
                p.inputs['Emission Color'].default_value = emit
            else:
                self.link(emit, p.inputs['Emission Color'])
            if isinstance(emit_strength, (int, float)):
                p.inputs['Emission Strength'].default_value = emit_strength
            else:
                self.link(emit_strength, p.inputs['Emission Strength'])
        return p.outputs[0]

    def emission(self, color, strength):
        e = self.n('ShaderNodeEmission')
        if isinstance(color, tuple):
            e.inputs['Color'].default_value = color
        else:
            self.link(color, e.inputs['Color'])
        e.inputs['Strength'].default_value = strength
        return e.outputs[0]

    def finish(self, shader):
        self.link(shader, self.out.inputs['Surface'])
        return self.m


# ───────────────────────── các vật liệu ─────────────────────────
def lava_material():
    M = Mat('lava')
    w = M.coord('Object', 1.0)
    # mảng vỏ nguội nổi trên dung nham: Voronoi (khoảng cách tới mép) bẻ cong bằng Noise, khe giữa các mảng là lõi nóng
    warp = M.n('ShaderNodeMix', data_type='VECTOR')
    nzv = M.n('ShaderNodeTexNoise')
    nzv.inputs['Scale'].default_value = 1.4
    nzv.inputs['Detail'].default_value = 3.0
    M.link(w, nzv.inputs['Vector'])
    M.link(w, warp.inputs[4])
    M.link(nzv.outputs['Color'], warp.inputs[5])
    warp.inputs[0].default_value = 0.35
    edge = M.voronoi(warp.outputs[1], 2.6, 'DISTANCE_TO_EDGE', 'Distance')
    big = M.noise(w, 1.1, 4.0, 0.6, 0.6)
    er = M.sepc(M.ramp(edge, [(0.0, (0, 0, 0, 1)), (0.16, (1, 1, 1, 1))]))
    hot = M.math('SUBTRACT', 1.0, er)
    hot = M.math('ADD', hot, M.math('MULTIPLY', M.math('SUBTRACT', big, 0.5), 0.3), True)     # vùng nóng loang
    crust = M.mixc(rgb('#1a0502'), rgb('#6a1308'), M.noise(w, 5.0, 5.0), 'MIX')
    glow = M.ramp(hot, [(0.0, rgb('#c8300c')), (0.5, rgb('#ff5a1f')), (0.8, rgb('#ffa43a')), (1.0, rgb('#ffd27a'))])
    col = M.mixc(crust, glow, M.ramp_f(hot, 0.28, 0.5), 'MIX')
    strength = M.math('ADD', 0.3, M.math('MULTIPLY', M.ramp_f(hot, 0.3, 1.0), 2.8))
    e = M.n('ShaderNodeEmission')
    M.link(col, e.inputs['Color'])
    M.link(strength, e.inputs['Strength'])
    return M.finish(e.outputs[0])


def rock_material(name='rock', warm=True):
    M = Mat(name)
    w = M.coord('Object', 1.0)
    z = M.sepz(w)[2]
    n1 = M.noise(w, 2.2, 6.0, 0.55, 0.3)
    n2 = M.noise(w, 9.0, 5.0, 0.6)
    crack = M.voronoi(M.coord('Object', 3.2), 1.0, 'F1', 'Distance')
    edge = M.voronoi(M.coord('Object', 2.6), 1.0, 'DISTANCE_TO_EDGE', 'Distance')
    base = M.ramp(n1, [(0.3, rgb('#3a261f')), (0.7, rgb('#6a4030'))])
    base = M.mixc(base, (0.02, 0.012, 0.010, 1), M.ramp(edge, [(0.0, (1, 1, 1, 1)), (0.06, (0, 0, 0, 1))]), 'MIX')
    # ám cam gần mép dung nham: càng thấp càng nung
    hf = M.ramp_f(z, -0.02, -0.34)
    col = M.ao(M.mixc(base, rgb('#c2531e'), M.math('MULTIPLY', hf, 0.7), 'MIX'), 0.5)
    bh = M.math('ADD', M.math('MULTIPLY', n2, 0.6), M.math('MULTIPLY', M.ramp(crack, [(0.0, (0, 0, 0, 1)), (0.5, (1, 1, 1, 1))]), 0.4))
    # M.ramp trả màu; lấy kênh đỏ
    nrm = M.bump(bh, 1.4, 0.12)
    em = M.mixc((0, 0, 0, 1), rgb('#ff5a1f'), M.math('MULTIPLY', M.math('MULTIPLY', hf, hf), hf), 'MIX')
    sh = M.principled(col, 0.85, nrm, em, 1.6)
    return M.finish(sh)


def slab_material(name, tone_hex, cracked, glossy=0.55, bank=False, big=False):
    M = Mat(name)
    w = M.coord('Object', 1.0)
    tone = rgb(tone_hex)
    n1 = M.noise(w, 5.0 if not big else 1.8, 6.0, 0.6, 0.4)
    n2 = M.noise(w, 24.0, 4.0, 0.5)
    rnd = M.n('ShaderNodeNewGeometry')
    var = rnd.outputs['Random Per Island']
    t = tone
    lo = tuple(c * 0.6 for c in t[:3]) + (1.0,)
    hi = tuple(min(1.0, c * 1.3) for c in t[:3]) + (1.0,)
    col = M.ramp(n1, [(0.25, lo), (0.75, hi)])
    col = M.mixc(col, tuple(c * 0.82 for c in t[:3]) + (1.0,), M.math('MULTIPLY', var, 1.0), 'MIX')
    # vết nứt: Voronoi khoảng cách tới mép, thưa; tối màu tại vết nứt
    ve = M.voronoi(M.warp(w, 0.6), 1.05 if not big else 0.8, 'DISTANCE_TO_EDGE', 'Distance')
    crack = M.ramp(ve, [(0.0, (1, 1, 1, 1)), (0.03, (0, 0, 0, 1))])
    cs = M.n('ShaderNodeSeparateColor')
    M.link(crack, cs.inputs[0])
    cm = cs.outputs[0]                                        # 1 tại vết nứt
    col = M.mixc(col, (0.012, 0.006, 0.005, 1), M.math('MULTIPLY', cm, 0.85), 'MIX')
    vor2 = M.voronoi(w, 14.0, 'F1', 'Distance')
    bh = M.math('SUBTRACT', M.math('ADD', M.math('MULTIPLY', n2, 0.5), M.math('MULTIPLY', vor2, 0.25)), M.math('MULTIPLY', cm, 0.7))
    nrm = M.bump(bh, 0.4, 0.04)
    rough = glossy
    if bank:
        y = M.sepz(w)[1]
        bmask = M.ramp(y, [(0.45, (1, 1, 1, 1)), (0.55, (0, 0, 0, 1))])
        bs = M.n('ShaderNodeSeparateColor')
        M.link(bmask, bs.inputs[0])
        col = M.mixc(col, (0.02, 0.012, 0.012, 1), M.math('MULTIPLY', bs.outputs[0], 0.6), 'MIX')
        rough = M.math('SUBTRACT', 0.62, M.math('MULTIPLY', bs.outputs[0], 0.34))
    if cracked:
        # vết nứt phát sáng mảnh
        ve2 = M.voronoi(M.coord('Object', 0.9), 1.0, 'DISTANCE_TO_EDGE', 'Distance')   # lưới nứt thưa
        thin = M.ramp(ve2, [(0.0, (1, 1, 1, 1)), (0.012, (0, 0, 0, 1))])
        ts = M.n('ShaderNodeSeparateColor')
        M.link(thin, ts.inputs[0])
        glow = M.ramp(M.noise(w, 4.0, 3.0), [(0.3, rgb('#ff3a08')), (0.7, rgb('#ff8a22'))])
        gate = ts.outputs[0]
        if big:         # tấm liền: chỉ vài vết nứt phát sáng, không phủ kín
            gate = M.math('MULTIPLY', gate, M.ramp_f(M.noise(M.coord('Object', 0.55, (3.0, 1.0, 0.0)), 1.0, 3.0), 0.52, 0.58))
        em = M.mixc((0, 0, 0, 1), glow, gate, 'MIX')
        sh = M.principled(col, rough, nrm, em, 1.8)
    else:
        sh = M.principled(col, rough, nrm)
    return M.finish(sh)


def basalt_material(name, tone_hex, rough=0.75, bricks=False):
    M = Mat(name)
    w = M.coord('Object', 1.0)
    n1 = M.noise(w, 7.0, 6.0, 0.6, 0.3)
    n2 = M.noise(w, 30.0, 4.0, 0.5)
    t = rgb(tone_hex)
    col = M.ramp(n1, [(0.3, tuple(c * 0.7 for c in t[:3]) + (1,)), (0.7, tuple(min(1, c * 1.2) for c in t[:3]) + (1,))])
    hgt = M.math('ADD', M.math('MULTIPLY', n1, 0.5), M.math('MULTIPLY', n2, 0.3))
    if bricks:             # phiến lát với mạch vữa tối
        br = M.n('ShaderNodeTexBrick')
        br.inputs['Scale'].default_value = 1.0
        br.inputs['Mortar Size'].default_value = 0.025
        br.inputs['Mortar Smooth'].default_value = 0.2
        br.inputs['Bias'].default_value = 0.0
        br.inputs['Brick Width'].default_value = 1.0
        br.inputs['Row Height'].default_value = 0.5
        br.offset = 0.5
        M.link(w, br.inputs['Vector'])
        mort = br.outputs['Fac']
        col = M.mixc(col, (0.01, 0.006, 0.005, 1), M.math('MULTIPLY', M.math('SUBTRACT', 1.0, mort), 0.45), 'MIX')
        hgt = M.math('ADD', hgt, M.math('MULTIPLY', mort, 0.8))
    nrm = M.bump(hgt, 1.2, 0.05)
    return M.finish(M.principled(M.ao(col, 0.25), rough, nrm))


def glass_material():
    M = Mat('obsidian')
    w = M.coord('Object', 1.0)
    n = M.noise(w, 14.0, 3.0)
    col = M.ramp(n, [(0.3, (0.004, 0.004, 0.006, 1)), (0.7, (0.02, 0.02, 0.028, 1))])
    return M.finish(M.principled(col, 0.1, None, None, 0.0, 0.0, 0.9))


def glow_material(name, color_hex, strength):
    M = Mat(name)
    return M.finish(M.emission(rgb(color_hex), strength))


def vein_slab_xiangqi():
    return slab_material('slab_xq', '#6a3a28', True, glossy=0.5, bank=True, big=True)


# ───────────────────────── địa hình ─────────────────────────
def smooth_poly(pts, n=24):
    """Catmull-Rom qua các điểm; trả mảng Nx2."""
    P = [pts[0]] + list(pts) + [pts[-1]]
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = [np.array(p) for p in P[i - 1:i + 3]]
        for k in range(n):
            t = k / n
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(np.array(P[-2]))
    return np.array(out)


def dist_poly(X, Y, poly):
    best = np.full(X.shape, 1e9)
    for a, b in zip(poly[:-1], poly[1:]):
        ab = b - a
        L2 = float(ab @ ab) or 1e-9
        t = np.clip(((X - a[0]) * ab[0] + (Y - a[1]) * ab[1]) / L2, 0, 1)
        d = np.hypot(X - (a[0] + t * ab[0]), Y - (a[1] + t * ab[1]))
        best = np.minimum(best, d)
    return best


RIVER = smooth_poly([(-5.15, -0.8), (-4.95, 0.5), (-5.2, 1.5), (-4.95, 2.6), (-5.15, 3.6), (-4.75, 4.45), (-3.8, 4.95),
                     (-2.7, 4.75), (-1.5, 4.9)])
RIVER2 = smooth_poly([(2.0, 4.8), (3.3, 5.0), (4.2, 4.6), (4.85, 3.7), (5.15, 2.6), (4.95, 1.5)])     # nhánh phải, chảy ra sau lưng
CRACKS = [smooth_poly([(6.2, 0.9), (5.3, 1.1), (4.75, 1.0)], 10), smooth_poly([(6.2, 2.3), (5.4, 2.55), (4.85, 2.4)], 10),
          smooth_poly([(-6.2, 3.1), (-5.6, 3.3), (-5.0, 3.15)], 8)]
LAKES = [((-1.8, 4.95), 0.95, 0.5), ((2.5, 4.9), 0.85, 0.45)]     # tâm, bán kính x, bán kính y
CRATERS = [(-5.0, 5.05), (5.0, 5.05)]


def height_grid(X, Y):
    """Độ cao địa hình; lõm dưới -0,18 thì dung nham lộ ra."""
    H = np.zeros(X.shape)
    flat = X.ravel()
    fy = Y.ravel()
    ns = np.empty(flat.shape)
    ns2 = np.empty(flat.shape)
    for i, (x, y) in enumerate(zip(flat, fy)):
        p = Vector((x * 0.55 + 3.1, y * 0.55 - 1.7, 0.37))
        ns[i] = noise.fractal(p, 0.55, 2.0, 5)
        q = Vector((x * 2.6 - 7.0, y * 2.6 + 4.0, 1.9))
        ns2[i] = noise.fractal(q, 0.6, 2.0, 3)
    ns = ns.reshape(X.shape)
    ns2 = ns2.reshape(X.shape)
    base = 0.26 + 0.8 * ns + 0.06 * ns2
    base = np.where(base > 0.3, 0.3 + (base - 0.3) * 0.5, base)
    base = np.clip(base, -0.3, 0.45)
    # bệ phẳng cho bàn: khu |x|<4,4 và y<4,4 ép về 0, chuyển mềm ra ngoài 0,7
    dx = np.maximum(np.abs(X) - 4.4, 0.0)
    dy = np.maximum(Y - 4.4, 0.0)
    dped = np.hypot(dx, dy)
    mask = sstep(0.0, 0.75, dped)
    wob = 1.0 + 0.35 * np.sin(X * 2.3 + Y * 1.7) * np.cos(Y * 3.1 - X)
    carve = np.zeros(X.shape)
    d = dist_poly(X, Y, RIVER)
    carve = np.maximum(carve, sstep(0.62 * wob, 0.12, d))
    d2 = dist_poly(X, Y, RIVER2)
    carve = np.maximum(carve, sstep(0.5 * wob, 0.1, d2) * 0.95)
    for c in CRACKS:
        dc = dist_poly(X, Y, c)
        carve = np.maximum(carve, sstep(0.22 * wob, 0.04, dc) * 0.9)
    for (cx, cy), rx, ry in LAKES:
        dl = np.hypot((X - cx) / rx, (Y - cy) / ry)
        carve = np.maximum(carve, sstep(1.45, 0.55, dl))
    # lòng miệng núi lửa: ép phẳng để vành đá đứng trên đất vững
    for cx, cy in CRATERS:
        dl = np.hypot(X - cx, Y - cy)
        base = base * (1 - sstep(1.0, 0.45, dl)) + 0.05 * sstep(1.0, 0.45, dl)
        carve = carve * (1 - sstep(0.9, 0.4, dl))
    carve *= mask
    rim = sstep(0.02, 0.22, carve) * (1 - sstep(0.3, 0.7, carve))       # bờ dung nham nhô lên thành gờ vỏ nguội
    base = base + 0.16 * rim * mask
    bank_h = base * mask
    H = bank_h * (1 - carve) + (-0.5) * carve
    # khoảng trống giữa bờ: để đá dốc đứng hơn một chút
    return H, carve


def terrain_object(sc, mat):
    step = 0.06
    xs = np.arange(-6.6, 6.6 + 1e-6, step)
    ys = np.arange(-1.0, 6.6 + 1e-6, step)
    X, Y = np.meshgrid(xs, ys)
    H, carve = height_grid(X, Y)
    nx, ny = len(xs), len(ys)
    verts = np.stack([X, Y, H], axis=-1).reshape(-1, 3)
    faces = []
    for j in range(ny - 1):
        for i in range(nx - 1):
            a = j * nx + i
            faces.append((a, a + 1, a + 1 + nx, a + nx))
    me = bpy.data.meshes.new('terrain')
    me.from_pydata(verts.tolist(), [], faces)
    me.update()
    for p in me.polygons:
        p.use_smooth = True
    me.materials.append(mat)
    ob = bpy.data.objects.new('terrain', me)
    sc.collection.objects.link(ob)
    return ob, (xs, ys, H)


def terrain_z(grid, x, y):
    xs, ys, H = grid
    i = int(np.clip(round((x - xs[0]) / (xs[1] - xs[0])), 0, len(xs) - 1))
    j = int(np.clip(round((y - ys[0]) / (ys[1] - ys[0])), 0, len(ys) - 1))
    return float(H[j, i])


# ───────────────────────── bmesh tiện ích ─────────────────────────
class B:
    """Gom hình vào một bmesh cho một object."""

    def __init__(self, name, mat):
        self.name, self.mat, self.bm = name, mat, bmesh.new()

    def box(self, lo, hi, bevel=0.0, seg=2, rot=None, jitter=None, flat_big=True):
        size = [hi[i] - lo[i] for i in range(3)]
        cen = Vector([(hi[i] + lo[i]) / 2 for i in range(3)])
        res = bmesh.ops.create_cube(self.bm, size=1.0)
        verts = res['verts']
        for v in verts:
            v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
        edges = list({e for v in verts for e in v.link_edges})
        faces = list({f for v in verts for f in v.link_faces})
        if bevel > 0:
            r = bmesh.ops.bevel(self.bm, geom=edges, offset=bevel, segments=seg, affect='EDGES', profile=0.6)
            faces = r['faces']
            verts = list({v for f in faces for v in f.verts}) + verts
        mt = Matrix.Translation(cen)
        if rot is not None:
            mt = mt @ rot
        for v in set(verts):
            if v.is_valid:
                v.co = mt @ v.co
        allf = list({f for v in verts if v.is_valid for f in v.link_faces})
        for f in allf:
            f.smooth = f.calc_area() < 0.2 if flat_big else True
        return allf

    def ico(self, loc, r, sub=2, scale=(1, 1, 1), jitter=0.0, rng=None, rot=None, seedv=0.0, smooth=True):
        res = bmesh.ops.create_icosphere(self.bm, subdivisions=sub, radius=r)
        for v in res['verts']:
            p = v.co.copy()
            if jitter:
                n = noise.fractal(Vector((p.x * 3 / r + seedv, p.y * 3 / r, p.z * 3 / r)), 0.6, 2.0, 3)
                p = p * (1 + jitter * n * 2.0)
            p = Vector((p.x * scale[0], p.y * scale[1], p.z * scale[2]))
            if rot is not None:
                p = rot @ p
            v.co = p + Vector(loc)
        for f in {f for v in res['verts'] for f in v.link_faces}:
            f.smooth = smooth

    def cone(self, loc, r1, r2, h, seg=6, rot=None, smooth=False):
        m = Matrix.Translation(loc) @ (rot or Matrix.Identity(4)) @ Matrix.Translation((0, 0, h / 2))
        res = bmesh.ops.create_cone(self.bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r1,
                                    radius2=max(r2, 0.0001), depth=h, matrix=m)
        for f in {f for v in res['verts'] for f in v.link_faces}:
            f.smooth = smooth

    def lathe(self, profile, seg=16, loc=(0, 0, 0), smooth=True, cap=True, jitter=0.0, seedv=0.0, rot=None):
        rings = []
        for r, z in profile:
            ring = []
            for i in range(seg):
                a = 2 * math.pi * i / seg
                rr = r
                if jitter:
                    rr = r * (1 + jitter * noise.noise(Vector((math.cos(a) * 1.7 + seedv, math.sin(a) * 1.7, z * 2))))
                p = Vector((rr * math.cos(a), rr * math.sin(a), z))
                if rot is not None:
                    p = rot @ p
                ring.append(self.bm.verts.new(p + Vector(loc)))
            rings.append(ring)
        fs = []
        for k in range(len(rings) - 1):
            a, b = rings[k], rings[k + 1]
            for i in range(seg):
                j = (i + 1) % seg
                fs.append(self.bm.faces.new((a[i], a[j], b[j], b[i])))
        if cap:
            if profile[0][0] > 0.0005:
                fs.append(self.bm.faces.new(list(reversed(rings[0]))))
            if profile[-1][0] > 0.0005:
                fs.append(self.bm.faces.new(rings[-1]))
        for f in fs:
            f.smooth = smooth

    def finish(self, sc, shade=None):
        bmesh.ops.recalc_face_normals(self.bm, faces=self.bm.faces[:])
        me = bpy.data.meshes.new(self.name)
        self.bm.to_mesh(me)
        self.bm.free()
        me.materials.append(self.mat)
        ob = bpy.data.objects.new(self.name, me)
        sc.collection.objects.link(ob)
        return ob


def rzm(a):
    return Matrix.Rotation(a, 4, 'Z')


def rot_xyz(ax, ay, az):
    return Matrix.Rotation(az, 4, 'Z') @ Matrix.Rotation(ay, 4, 'Y') @ Matrix.Rotation(ax, 4, 'X')


# ───────────────────────── dựng cảnh ─────────────────────────
def make_scene():
    sc = bpy.data.scenes.get(SCENE)
    if sc is not None:
        for ob in list(sc.collection.all_objects):
            bpy.data.objects.remove(ob, do_unlink=True)
        bpy.data.scenes.remove(sc)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.lights, bpy.data.cameras, bpy.data.node_groups):
        for d in list(coll):
            if d.users == 0:               # dữ liệu mồ côi do các lần chạy trước để lại
                coll.remove(d)
    sc = bpy.data.scenes.new(SCENE)
    bpy.context.window.scene = sc
    return sc


def setup_render(sc, w, h, samples):
    r = sc.render
    r.engine = 'CYCLES'
    r.resolution_x, r.resolution_y, r.resolution_percentage = w, h, 100
    cy = sc.cycles
    cy.samples = samples
    cy.use_denoising = True
    try:
        cy.denoiser = 'OPENIMAGEDENOISE'
    except Exception:
        pass
    cy.use_adaptive_sampling = True
    cy.max_bounces = 6
    cy.diffuse_bounces = 3
    cy.glossy_bounces = 3
    cy.transmission_bounces = 2
    cy.caustics_reflective = False
    cy.caustics_refractive = False
    cy.sample_clamp_indirect = 8.0
    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences
        prefs.compute_device_type = 'OPTIX'
        prefs.refresh_devices()
        for d in prefs.devices:
            d.use = (d.type == 'OPTIX')
        cy.device = 'GPU'
    except Exception:
        try:
            cy.device = 'GPU'
        except Exception:
            pass
    vs = sc.view_settings
    for t in ('AgX', 'Filmic', 'Standard'):
        try:
            vs.view_transform = t
            break
        except Exception:
            continue
    for lk in ('AgX - Medium High Contrast', 'Medium High Contrast', 'AgX - High Contrast', 'High Contrast'):
        try:
            vs.look = lk
            break
        except Exception:
            continue
    vs.exposure = 0.0
    sc.render.film_transparent = False
    sc.render.use_compositing = True


def setup_world(sc):
    w = bpy.data.worlds.new('KyDaiV2World')
    w.use_nodes = True
    nt = w.node_tree
    bg = nt.nodes.get('Background')
    bg.inputs[0].default_value = rgb('#0c0a14')
    bg.inputs[1].default_value = 0.3
    sc.world = w


def setup_sun(sc):
    li = bpy.data.lights.new('sun', 'SUN')
    li.energy = 2.5
    li.color = rgb('#ffd9b0')[:3]
    li.angle = math.radians(2.2)
    ob = bpy.data.objects.new('sun', li)
    sc.collection.objects.link(ob)
    el = math.radians(60)
    # ánh sáng đến từ góc trên-trái của ảnh. Ảnh quay 180° quanh Z nên "trái-trên" ảnh = (+x, -y) trong toạ độ thế giới
    frm = Vector((math.cos(el) * 0.7071, -math.cos(el) * 0.7071, math.sin(el)))
    ob.rotation_euler = (-frm).to_track_quat('-Z', 'Y').to_euler()
    ob.location = frm * 20
    return ob


def setup_camera(sc):
    cam = bpy.data.cameras.new('cam')
    cam.type = 'ORTHO'
    cam.ortho_scale = 11.0
    cam.clip_start, cam.clip_end = 0.1, 60.0
    ob = bpy.data.objects.new('cam', cam)
    sc.collection.objects.link(ob)
    ob.location = (0.0, 2.75, 20.0)
    ob.rotation_euler = (0.0, 0.0, math.pi)
    sc.camera = ob
    return ob


def setup_compositor(sc):
    """Quầng sáng cho dung nham. Trả chuỗi mô tả kết quả."""
    try:
        ng = bpy.data.node_groups.new('KyDaiV2Comp', 'CompositorNodeTree')
        sc.compositing_node_group = ng
        rl = ng.nodes.new('CompositorNodeRLayers')
        gl = ng.nodes.new('CompositorNodeGlare')
        iface = ng.interface
        iface.new_socket('Image', in_out='OUTPUT', socket_type='NodeSocketColor')
        go = ng.nodes.new('NodeGroupOutput')
        info = []
        for name, val in (('Type', 'Bloom'), ('Quality', 'High')):
            try:
                gl.inputs[name].default_value = val
                info.append('in:' + name)
            except Exception as e:
                info.append('lỗi %s: %s' % (name, str(e)[:60]))
        if globals().get('NOGLARE'):
            gl.mute = True
        for name, val in (('Threshold', GLARE[0]), ('Strength', GLARE[1]), ('Size', GLARE[2]), ('Smoothness', 0.5), ('Saturation', 1.0)):
            try:
                gl.inputs[name].default_value = val
                info.append('in:' + name)
            except Exception:
                pass
        ng.links.new(rl.outputs['Image'], gl.inputs['Image'])
        ng.links.new(gl.outputs['Image'], go.inputs[0])
        return 'glare ok ' + ','.join(info)
    except Exception as e:
        return 'glare lỗi: %s' % str(e)[:160]


# ───────────────────────── nội dung ─────────────────────────
def build_floor(sc, variant, rng):
    out = []
    # mặt phẳng phát sáng yếu dưới các phiến: ánh cam lộ qua khe
    gl = B('under_glow', glow_material('under_glow', '#ff5a1a', 1.8))
    gl.box((-4.1, -0.05, 0.0), (4.1, 4.1, 0.006))
    out.append(gl.finish(sc))
    # bệ đá phẳng nâng nhẹ quanh bàn
    plinth = B('plinth', basalt_material('plinth', '#6a4333', 0.7, bricks=True))
    plinth.box((-4.62, -0.6, -0.12), (4.62, 4.62, 0.05), bevel=0.05, seg=3)
    out.append(plinth.finish(sc))
    if variant == 'chess':
        tones = {'light': '#b5643a', 'dark': '#3a1a14'}
        crack_ids = set(rng.sample([(c, r) for c in range(8) for r in range(4)], 6))
        groups = {}
        for tone in ('light', 'dark'):
            for cr in (False, True):
                groups[(tone, cr)] = B('slabs_%s%s' % (tone, '_crack' if cr else ''),
                                        slab_material('slab_%s%s' % (tone, '_crack' if cr else ''), tones[tone], cr,
                                                      glossy=0.5 if tone == 'light' else 0.38))
        for c in range(8):
            for r in range(4):
                ci = 7 - c      # cột đếm từ trái ảnh (ảnh quay 180° nên cột thế giới c=0 nằm bên phải ảnh)
                tone = 'light' if (ci + r) % 2 == LIGHT_PARITY else 'dark'
                cx, cy = c - 3.5, r + 0.5
                zj = rng.uniform(-0.012, 0.012)
                rot = rot_xyz(math.radians(rng.uniform(-0.6, 0.6)), math.radians(rng.uniform(-0.6, 0.6)),
                              math.radians(rng.uniform(-0.4, 0.4)))
                g = groups[(tone, (c, r) in crack_ids)]
                g.box((cx - 0.47, cy - 0.47, -0.07 + 0.0), (cx + 0.47, cy + 0.47, 0.07), bevel=0.035, seg=2, rot=rot)
                # nâng phiến lên: tâm z = 0,07 + zj
                for v in g.bm.verts:
                    pass
        # dịch z cho từng phiến đã làm trong box() bằng cách tịnh tiến cả nhóm vì độ lệch nhỏ: bỏ qua, độ lệch nằm trong rot
        for g in groups.values():
            for v in g.bm.verts:
                v.co.z += 0.07
            out.append(g.finish(sc))
    else:
        s = B('slab_xq', vein_slab_xiangqi())
        s.box((-4.05, -0.05, 0.0), (4.05, 4.05, 0.14), bevel=0.04, seg=3)
        out.append(s.finish(sc))
    return out


def build_ledge_and_pillars(sc):
    out = []
    stone = basalt_material('ledge', '#86503a', 0.55)
    groove = glow_material('groove', '#b02a08', 0.55)
    # gờ đá ba phía; mỗi phía chia ba dải: dải ngoài cao, rãnh thấp (phát sáng yếu), dải trong cao
    L = B('ledge', stone)
    G = B('ledge_groove', groove)
    t = 0.06
    for sx in (-1, 1):
        x0 = 4.0 if sx > 0 else -4.18
        # trong, rãnh, ngoài đi từ bàn ra ngoài
        for k, (a, b, hh) in enumerate(((0.0, t, 0.2), (t, 2 * t, 0.15), (2 * t, 3 * t, 0.2))):
            xl = (4.0 + a) if sx > 0 else (-4.0 - b)
            xh = (4.0 + b) if sx > 0 else (-4.0 - a)
            (G if k == 1 else L).box((xl, -0.05, 0.0), (xh, 4.18, hh), bevel=0.012 if k != 1 else 0.0, seg=1, flat_big=False)
    for k, (a, b, hh) in enumerate(((0.0, t, 0.2), (t, 2 * t, 0.15), (2 * t, 3 * t, 0.2))):
        (G if k == 1 else L).box((-4.18, 4.0 + a, 0.0), (4.18, 4.0 + b, hh), bevel=0.012 if k != 1 else 0.0, seg=1,
                                 flat_big=False)
    # trụ đá vuông ở bốn góc gờ, trên mỗi trụ một bát lửa
    P = B('pillars', basalt_material('pillar', '#7a4834', 0.5))
    bowl = B('bowls', basalt_material('bowl', '#1c110e', 0.5))
    fire = B('fire', glow_material('fire', '#ff9a30', 6.0))
    for sx in (-1, 1):
        for cy in (0.0, 4.18):
            cx = sx * 4.18
            P.box((cx - 0.17, cy - 0.17, 0.0), (cx + 0.17, cy + 0.17, 0.55), bevel=0.03, seg=2, flat_big=False)
            P.box((cx - 0.2, cy - 0.2, 0.5), (cx + 0.2, cy + 0.2, 0.6), bevel=0.02, seg=2, flat_big=False)
            bowl.lathe([(0.01, 0.6), (0.1, 0.62), (0.16, 0.7), (0.17, 0.74), (0.14, 0.73), (0.02, 0.66)], 14, (cx, cy, 0.0), True, cap=False)
            fire.ico((cx, cy, 0.76), 0.1, 2, (1, 1, 0.9))
            fire.cone((cx, cy, 0.76), 0.07, 0.0, 0.22, 6, smooth=True)
    for b in (L, G, P, bowl, fire):
        out.append(b.finish(sc))
    return out


def build_scenery(sc, grid, rng):
    out = []
    rock_mat = basalt_material('boulder', '#5c3b2e', 0.8)
    rocks = B('boulders', rock_mat)
    # 12 tảng đá, tụ ở bờ sông dung nham
    anchors = [(-4.55, 0.7), (-5.0, 0.95), (-4.6, 2.1), (-4.9, 2.05), (-4.5, 3.4), (-5.1, 3.7), (-3.4, 4.35),
               (-0.3, 4.6), (4.55, 1.7), (5.1, 3.2), (4.5, 4.1), (5.25, 0.4), (-2.8, 5.25), (1.0, 5.3)]
    for k, (ax, ay) in enumerate(anchors):
        r = rng.uniform(0.17, 0.4)
        x, y = ax + rng.uniform(-0.1, 0.1), ay + rng.uniform(-0.1, 0.1)
        if abs(x) < 4.5 and y < 4.5:
            continue
        z = max(terrain_z(grid, x, y), -0.05) + r * 0.2
        rocks.ico((x, y, z), r, 3, (rng.uniform(0.9, 1.3), rng.uniform(0.8, 1.2), rng.uniform(0.5, 0.85)), 0.35, rng,
                  rot=rot_xyz(rng.uniform(-0.3, 0.3), rng.uniform(-0.3, 0.3), rng.uniform(0, 6.28)), seedv=k * 7.3, smooth=True)
    for k in range(18):          # đá cuội nhỏ rải
        x, y = rng.uniform(-5.4, 5.4), rng.uniform(0.1, 5.4)
        if abs(x) < 4.55 and y < 4.55:
            continue
        zt = terrain_z(grid, x, y)
        if zt < -0.12:
            continue
        r = rng.uniform(0.05, 0.1)
        rocks.ico((x, y, zt + r * 0.3), r, 1, (1, rng.uniform(0.7, 1.2), 0.6), 0.25, rng, seedv=k * 3.1)
    out.append(rocks.finish(sc))
    # vành miệng núi lửa
    crater = B('craters', basalt_material('crater_rim', '#2c1a15', 0.8))
    lava = B('crater_lava', lava_material())
    for k, (cx, cy) in enumerate(CRATERS):
        z0 = -0.5
        crater.lathe([(0.66, z0), (0.62, 0.1), (0.5, 0.42), (0.4, 0.5), (0.33, 0.38), (0.3, 0.12), (0.0, 0.1)],
                     18, (cx, cy, 0), True, cap=False, jitter=0.12, seedv=k * 9.7)
        lava.lathe([(0.0, 0.15), (0.3, 0.15), (0.3, 0.14)], 18, (cx, cy, 0.0), True, cap=True)
    out += [crater.finish(sc), lava.finish(sc)]
    # mảnh đá vỏ chai
    ob = B('obsidian', glass_material())
    for (x, y) in ((-4.75, 1.3), (-5.2, 2.7), (4.7, 0.6), (5.2, 2.05), (4.9, 3.5), (-3.2, 5.1), (0.4, 5.25), (-2.9, 4.55)):
        zt = max(terrain_z(grid, x, y), -0.05)
        for k in range(3):
            ob.cone((x + rng.uniform(-0.11, 0.11), y + rng.uniform(-0.11, 0.11), zt - 0.03), rng.uniform(0.07, 0.13), 0.004,
                    rng.uniform(0.4, 0.75), 5, rot_xyz(rng.uniform(-0.45, 0.45), rng.uniform(-0.45, 0.45), rng.uniform(0, 6.28)))
    out.append(ob.finish(sc))
    # lư hương đá ở dải sau lưng
    stone = basalt_material('censer', '#52352a', 0.55)
    cen = B('censer', stone)
    ash = B('censer_ash', glow_material('censer_ember', '#ff8a3a', 4.0))
    cx, cy = 0.0, 4.95
    zt = 0.0
    cen.box((cx - 0.34, cy - 0.34, -0.2), (cx + 0.34, cy + 0.34, 0.07), bevel=0.04, seg=2, flat_big=False)
    for k in range(3):
        a = 2 * math.pi * k / 3 + math.pi / 2
        cen.cone((cx + 0.2 * math.cos(a), cy + 0.2 * math.sin(a), 0.07), 0.07, 0.045, 0.14, 6)
    cen.lathe([(0.0, 0.2), (0.17, 0.2), (0.27, 0.27), (0.29, 0.36), (0.25, 0.42), (0.23, 0.4), (0.0, 0.34)], 20, (cx, cy, 0), True, cap=False)
    for sgn in (-1, 1):                  # hai quai
        cen.box((cx + sgn * 0.3 - 0.03, cy - 0.05, 0.31), (cx + sgn * 0.3 + 0.03 + sgn * 0.1, cy + 0.05, 0.38), bevel=0.012, seg=1,
                flat_big=False)
    ash.lathe([(0.0, 0.372), (0.2, 0.372)], 18, (cx, cy, 0), True, cap=True)
    for k in range(7):                   # chân nhang cắm trong lư
        a = 2 * math.pi * k / 7
        rr = 0.08 + 0.05 * (k % 2)
        ash.cone((cx + rr * math.cos(a), cy + rr * math.sin(a), 0.36), 0.01, 0.01, 0.16, 4)
    out += [cen.finish(sc), ash.finish(sc)]
    # cột kinh đá lục lăng ở góc sau trái-giữa
    pil = B('sutra_pillar', basalt_material('sutra', '#8a5640', 0.6))
    px, py = -3.05, 5.15
    pil.lathe([(0.34, -0.3), (0.34, 0.05), (0.25, 0.1), (0.2, 0.14)], 6, (px, py, 0), False, cap=False)
    pil.lathe([(0.2, 0.14), (0.2, 0.7)], 6, (px, py, 0), False, cap=False)
    pil.lathe([(0.26, 0.7), (0.28, 0.76), (0.2, 0.84), (0.0, 0.98)], 6, (px, py, 0), False, cap=False)
    out.append(pil.finish(sc))
    # tàn lửa lơ lửng
    em = B('embers', glow_material('ember', '#ffa24a', 25.0))
    n = 0
    tries = 0
    while n < 52 and tries < 400:
        tries += 1
        x, y = rng.uniform(-5.45, 5.45), rng.uniform(0.05, 5.45)
        if abs(x) < 4.45 and y < 4.45:
            continue
        em.ico((x, y, rng.uniform(0.2, 0.8)), rng.uniform(0.012, 0.032), 1, smooth=True)
        n += 1
    out.append(em.finish(sc))
    return out


def markers(sc):
    m = B('markers', glow_material('red', '#ff0000', 30.0))
    for x, y in ((4, 0), (-4, 0), (4, 4), (-4, 4)):
        m.box((x - 0.1, y - 0.1, 1.0), (x + 0.1, y + 0.1, 1.3))
    return m.finish(sc)


# ───────────────────────── chạy ─────────────────────────
def render_variant(variant):
    t0 = time.time()
    sc = make_scene()
    rng = random.Random(SEED)
    w, h = (704, 352) if PREVIEW else (1408, 704)
    samples = SAMPLES or (24 if PREVIEW else 96)
    setup_render(sc, w, h, samples)
    setup_world(sc)
    setup_sun(sc)
    setup_camera(sc)
    comp = setup_compositor(sc)
    # lớp dung nham phủ kín toàn cảnh ở z=-0,18
    lv = B('lava_plane', lava_material())
    lv.box((-7, -2, -0.2), (7, 7, -0.18))
    lv.finish(sc)
    ter, grid = terrain_object(sc, rock_material('terrain'))
    build_floor(sc, variant, rng)
    build_ledge_and_pillars(sc)
    build_scenery(sc, grid, rng)
    if CHECK_MARKERS:
        markers(sc)
    out_dir = os.path.join(REPO, 'public', 'img', 'kydao', 'fields2')
    os.makedirs(out_dir, exist_ok=True)
    doc_dir = os.path.join(REPO, 'docs', 'ky-dai', 'anh')
    os.makedirs(doc_dir, exist_ok=True)
    name = 'volcano-' + variant
    if PREVIEW:
        path = os.path.join(doc_dir, 'volcano-v2-prev-%s.png' % variant)
        sc.render.image_settings.file_format = 'PNG'
        sc.render.image_settings.color_mode = 'RGB'
    else:
        path = os.path.join(out_dir, name + '.webp')
        try:
            sc.render.image_settings.media_type = 'IMAGE'
        except Exception:
            pass
        sc.render.image_settings.file_format = 'WEBP'
        sc.render.image_settings.color_mode = 'RGB'
        sc.render.image_settings.quality = 84
    sc.render.filepath = path
    t1 = time.time()
    bpy.ops.render.render(write_still=True)
    t2 = time.time()
    if PREVIEW and ROUND:                       # bản JPG nhỏ 704x352 cho điều phối soát
        jp = os.path.join(doc_dir, 'volcano-v2-vong%d%s.jpg' % (ROUND, '' if variant == 'chess' else '-' + variant))
        im = bpy.data.images.load(path)
        im.scale(704, 352)
        im.file_format = 'JPEG'
        im.filepath_raw = jp
        im.save()
        bpy.data.images.remove(im)
    info = {'file': path, 'samples': samples, 'size': [w, h], 'build_s': round(t1 - t0, 1), 'render_s': round(t2 - t1, 1),
            'comp': comp, 'kb': round(os.path.getsize(path) / 1024, 1) if os.path.exists(path) else None}
    return info


def main():
    res = {}
    for v in (['chess', 'xiangqi'] if VARIANT == 'both' else [VARIANT]):
        res[v] = render_variant(v)
    return res


result = main()
