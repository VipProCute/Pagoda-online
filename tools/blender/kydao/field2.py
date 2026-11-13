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
FIELD = globals().get('FIELD', 'volcano')
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
LIGHT_PARITY = 0          # ô SÁNG khi (cột từ trái ảnh + hàng từ đường giữa) % 2 == LIGHT_PARITY; 0: ô góc trái-dưới là ô TỐI (T-118b)
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



# ───────────────────────── vật liệu dùng chung (T-118b) ─────────────────────────
def scaled(c, k):
    return tuple(min(1.0, v * k) for v in c[:3]) + (1.0,)


def coord3(M, s3, loc=(0, 0, 0)):
    tc = M.n('ShaderNodeTexCoord')
    mp = M.n('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = s3
    mp.inputs['Location'].default_value = loc
    M.link(tc.outputs['Object'], mp.inputs['Vector'])
    return mp.outputs[0]


def caustic_add(M, shader):
    """Ocean: cộng vệt nắng xuyên nước lên mọi vật liệu (vật thể đều đặt ở toạ độ thế giới)."""
    w = M.coord('Object', 1.0)
    a = M.voronoi(M.warp(w, 0.5, 1.3), 1.5, 'DISTANCE_TO_EDGE', 'Distance')
    b = M.voronoi(M.warp(M.coord('Object', 1.0, (3.1, 1.7, 0.0)), 0.5, 1.9), 2.6, 'DISTANCE_TO_EDGE', 'Distance')
    pa = M.math('SUBTRACT', 1.0, M.ramp_f(a, 0.0, 0.06))
    pb = M.math('SUBTRACT', 1.0, M.ramp_f(b, 0.0, 0.05))
    xyz = M.sepz(w)
    inside = M.math('MULTIPLY', M.math('SUBTRACT', 1.0, M.ramp_f(M.math('ABSOLUTE', xyz[0]), 4.0, 4.5)),
                    M.math('SUBTRACT', 1.0, M.ramp_f(xyz[1], 4.0, 4.5)))
    c = M.math('MULTIPLY', M.math('ADD', pa, pb), M.math('SUBTRACT', 0.3, M.math('MULTIPLY', inside, 0.22)))
    e = M.n('ShaderNodeEmission')
    e.inputs['Color'].default_value = (0.45, 0.85, 1.0, 1.0)
    M.link(c, e.inputs['Strength'])
    ad = M.n('ShaderNodeAddShader')
    M.link(shader, ad.inputs[0])
    M.link(e.outputs[0], ad.inputs[1])
    return ad.outputs[0]


_ORIG_FINISH = Mat.finish


def _finish(self, shader):
    if globals().get('CAUSTIC_ON') and not getattr(self, 'no_caustic', False):
        shader = caustic_add(self, shader)
    return _ORIG_FINISH(self, shader)


Mat.finish = _finish


def ground_material(name, kind, lo, hi, accent=None, level=-0.18, wet=None, bump=1.0, scale=1.0):
    M = Mat(name)
    w = M.coord('Object', scale)
    z = M.sepz(M.coord('Object', 1.0))[2]
    n1 = M.noise(w, 2.0, 6.0, 0.55, 0.3)
    n2 = M.noise(w, 10.0, 5.0, 0.6)
    col = M.ramp(n1, [(0.3, rgb(lo)), (0.7, rgb(hi))])
    hgt = M.math('MULTIPLY', n2, 0.6)
    rough = 0.85
    acc = rgb(accent or hi)
    if kind == 'pebble':
        pc = M.sepc(M.voronoi(w, 13.0, 'F1', 'Color'))
        pd = M.voronoi(w, 13.0, 'F1', 'Distance')
        col = M.mixc(col, acc, M.math('MULTIPLY', pc, 0.85))
        col = M.mixc(col, (0.01, 0.012, 0.012, 1), M.math('MULTIPLY', M.ramp_f(pd, 0.4, 0.66), 0.75))
        hgt = M.math('ADD', hgt, M.math('MULTIPLY', M.math('SUBTRACT', 1.0, M.ramp_f(pd, 0.0, 0.7)), 1.2))
    elif kind == 'moss':
        fine = M.noise(w, 46.0, 4.0, 0.6)
        patch = M.noise(w, 3.4, 4.0, 0.6, 0.4)
        col = M.mixc(col, acc, M.math('MULTIPLY', M.ramp_f(patch, 0.55, 0.7), 0.8))
        col = M.mixc(col, scaled(rgb(lo), 0.4), M.math('MULTIPLY', M.ramp_f(fine, 0.35, 0.8), 0.55))
        hgt = M.math('ADD', hgt, M.math('MULTIPLY', fine, 0.8))
    elif kind == 'snow':
        ed = M.voronoi(M.warp(w, 0.5, 1.2), 0.9, 'DISTANCE_TO_EDGE', 'Distance')
        crk = M.math('SUBTRACT', 1.0, M.ramp_f(ed, 0.0, 0.045))
        col = M.mixc(col, acc, M.math('MULTIPLY', crk, 0.9))
        hgt = M.math('SUBTRACT', hgt, M.math('MULTIPLY', crk, 0.9))
        rough = 0.5
    elif kind in ('sand', 'dune'):
        wv = M.n('ShaderNodeTexWave')
        wv.wave_type = 'BANDS'
        wv.bands_direction = 'Y' if kind == 'dune' else 'X'
        wv.inputs['Scale'].default_value = 2.6 if kind == 'dune' else 4.2
        wv.inputs['Distortion'].default_value = 5.0
        wv.inputs['Detail'].default_value = 2.0
        wv.inputs['Detail Scale'].default_value = 1.2
        M.link(M.warp(w, 0.5, 1.0), wv.inputs['Vector'])
        rp = wv.outputs['Fac']
        col = M.mixc(col, acc, M.math('MULTIPLY', rp, 0.55))
        hgt = M.math('ADD', hgt, M.math('MULTIPLY', rp, 1.4))
        rough = 0.9
    elif kind == 'slate':
        st = M.noise(coord3(M, (1.0, 1.0, 1.0)), 2.2, 4.0, 0.5, 0.0)
        sv = M.voronoi(M.warp(w, 0.4, 1.0), 2.4, 'DISTANCE_TO_EDGE', 'Distance')
        fa = M.math('SUBTRACT', 1.0, M.ramp_f(sv, 0.0, 0.06))
        col = M.mixc(col, acc, M.math('MULTIPLY', M.ramp_f(st, 0.4, 0.7), 0.5))
        col = M.mixc(col, scaled(rgb(lo), 0.3), M.math('MULTIPLY', fa, 0.8))
        hgt = M.math('ADD', hgt, M.math('MULTIPLY', M.math('SUBTRACT', 1.0, fa), 0.8))
    else:  # mud / đất ẩm
        col = M.mixc(col, acc, M.math('MULTIPLY', M.ramp_f(n2, 0.5, 0.75), 0.5))
        hgt = M.math('ADD', hgt, M.math('MULTIPLY', M.noise(w, 26.0, 3.0), 0.5))
    if wet:
        wm = M.ramp_f(z, level + 0.1, level - 0.12)
        col = M.mixc(col, rgb(wet), M.math('MULTIPLY', wm, 0.8))
        rough = M.math('SUBTRACT', rough, M.math('MULTIPLY', wm, 0.45))
    col = M.ao(col, 0.4)
    nrm = M.bump(hgt, 1.2 * bump, 0.08)
    return M.finish(M.principled(col, rough, nrm))


def water_material(name, shallow, deep, alpha=0.6, ripple=0.5, scale=3.0, rough=0.04, glow=None):
    M = Mat(name)
    w = M.coord('Object', 1.0)
    n = M.noise(w, scale * 3.0, 3.0, 0.5, 0.25)
    v = M.voronoi(M.warp(w, 0.35, 2.0), scale * 2.0, 'F1', 'Distance')
    col = M.mixc(rgb(deep), rgb(shallow), M.ramp_f(n, 0.35, 0.7))
    nrm = M.bump(M.math('ADD', n, M.math('MULTIPLY', v, 0.15)), ripple, 0.05)
    em = rgb(glow) if glow else None
    p = M.principled(col, rough, nrm, em, 0.6 if glow else 0.0, 0.0, 1.0)
    p.node.inputs['Alpha'].default_value = alpha
    try:
        p.node.inputs['IOR'].default_value = 1.33
    except Exception:
        pass
    M.no_caustic = True
    return M.finish(p)


def cloud_material(name, hi, lo):
    M = Mat(name)
    w = M.coord('Object', 1.0)
    n = M.noise(w, 1.6, 6.0, 0.6, 0.5)
    n2 = M.noise(w, 5.5, 5.0, 0.6, 0.3)
    f = M.math('ADD', M.math('MULTIPLY', n, 0.65), M.math('MULTIPLY', n2, 0.35))
    col = M.ramp(f, [(0.3, rgb(lo)), (0.7, rgb(hi))])
    return M.finish(M.principled(col, 0.95, M.bump(f, 1.8, 0.2)))


def gem_material(name, hexc, emit=1.0, rough=0.06, alpha=1.0):
    M = Mat(name)
    w = M.coord('Object', 1.0)
    n = M.noise(w, 5.0, 3.0)
    col = M.ramp(n, [(0.3, scaled(rgb(hexc), 0.7)), (0.7, scaled(rgb(hexc), 1.3))])
    p = M.principled(col, rough, None, rgb(hexc), M.math('MULTIPLY', M.math('ADD', n, 0.4), emit), 0.0, 1.0)
    p.node.inputs['Alpha'].default_value = alpha
    return M.finish(p)


def bank_pattern(M, w, bank):
    lo, hi, kind = bank
    n = M.noise(w, 7.0, 5.0, 0.6)
    col = M.ramp(n, [(0.3, rgb(lo)), (0.7, rgb(hi))])
    if kind == 'pebble':
        pc = M.sepc(M.voronoi(w, 15.0, 'F1', 'Color'))
        pd = M.voronoi(w, 15.0, 'F1', 'Distance')
        col = M.mixc(col, scaled(rgb(hi), 1.25), M.math('MULTIPLY', pc, 0.7))
        col = M.mixc(col, (0.01, 0.01, 0.01, 1), M.math('MULTIPLY', M.ramp_f(pd, 0.38, 0.62), 0.8))
        hgt = M.math('SUBTRACT', 1.0, M.ramp_f(pd, 0.0, 0.7))
    else:
        hgt = M.noise(w, 38.0, 4.0, 0.6)
        col = M.mixc(col, scaled(rgb(hi), 1.2), M.ramp_f(hgt, 0.55, 0.72))
    return col, hgt


def slab_material(name, tone_hex, glow_hex=None, glossy=0.5, big=False, bank=None):
    M = Mat(name)
    w = M.coord('Object', 1.0)
    t = rgb(tone_hex)
    n1 = M.noise(w, 4.5 if not big else 1.8, 6.0, 0.6, 0.4)
    n2 = M.noise(w, 24.0, 4.0, 0.5)
    n3 = M.noise(w, 70.0, 3.0, 0.5)
    var = M.n('ShaderNodeNewGeometry').outputs['Random Per Island']
    col = M.ramp(n1, [(0.2, scaled(t, 0.5)), (0.8, scaled(t, 1.45))])
    col = M.mixc(col, scaled(t, 0.72), M.math('MULTIPLY', var, 0.8))
    col = M.mixc(col, scaled(t, 0.45), M.math('MULTIPLY', M.ramp_f(M.noise(w, 9.0, 5.0, 0.6, 0.3), 0.5, 0.75), 0.7))   # vết ố, mòn
    vn = M.noise(M.warp(w, 0.6, 1.4), 2.6, 2.0, 0.5)
    vein = M.math('SUBTRACT', 1.0, M.ramp_f(M.math('ABSOLUTE', M.math('SUBTRACT', vn, 0.5)), 0.0, 0.03))
    col = M.mixc(col, scaled(t, 1.55), M.math('MULTIPLY', vein, 0.5))
    col = M.mixc(col, scaled(t, 1.5), M.math('MULTIPLY', M.ramp_f(n3, 0.6, 0.8), 0.55))
    ve = M.voronoi(M.warp(w, 0.6), 1.05 if not big else 0.8, 'DISTANCE_TO_EDGE', 'Distance')
    vem = M.math('SUBTRACT', ve, M.math('MULTIPLY', n2, 0.008 if big else 0.03))
    cm = M.math('SUBTRACT', 1.0, M.ramp_f(vem, 0.0, 0.013 if big else 0.035))
    col = M.mixc(col, scaled(t, 0.1), M.math('MULTIPLY', cm, 0.55 if big else 0.9))
    col = M.ao(col, 0.12)
    hgt = M.math('SUBTRACT', M.math('ADD', M.math('MULTIPLY', n2, 0.5), M.math('MULTIPLY', n3, 0.2)), M.math('MULTIPLY', cm, 0.8))
    rough = glossy
    if bank:
        bc, bh = bank_pattern(M, w, bank)
        y = M.sepz(w)[1]
        bm = M.math('SUBTRACT', 1.0, M.ramp_f(y, 0.42, 0.52))
        col = M.mixc(col, bc, bm)
        hgt = M.math('ADD', hgt, M.math('MULTIPLY', M.math('MULTIPLY', bh, bm), 0.9))
        rough = M.math('SUBTRACT', glossy, M.math('MULTIPLY', bm, 0.25))
    bev = M.n('ShaderNodeBevel')
    bev.inputs['Radius'].default_value = 0.025
    nrm = M.bump(hgt, 0.9, 0.04)
    M.link(bev.outputs[0], nrm.node.inputs['Normal'])
    if glow_hex:
        cw = M.math('SUBTRACT', 1.0, M.ramp_f(vem, 0.0, 0.045))
        gate = M.ramp_f(M.noise(M.coord('Object', 0.55, (3.0, 1.0, 0.0)), 1.0, 3.0), 0.55, 0.62)
        g = M.math('MULTIPLY', cw, gate)
        gc = M.ramp(M.noise(w, 4.0, 3.0), [(0.3, rgb(glow_hex)), (0.7, scaled(rgb(glow_hex), 1.4))])
        em = M.mixc((0, 0, 0, 1), gc, g)
        sh = M.principled(col, rough, nrm, em, 0.9)
    else:
        sh = M.principled(col, rough, nrm)
    return M.finish(sh)


def basalt_material(name, tone_hex, rough=0.75, flag=False, bump=1.2):
    M = Mat(name)
    w = M.coord('Object', 1.0)
    n1 = M.noise(w, 7.0, 6.0, 0.6, 0.3)
    n2 = M.noise(w, 30.0, 4.0, 0.5)
    t = rgb(tone_hex)
    col = M.ramp(n1, [(0.3, scaled(t, 0.7)), (0.7, scaled(t, 1.25))])
    hgt = M.math('ADD', M.math('MULTIPLY', n1, 0.5), M.math('MULTIPLY', n2, 0.3))
    if flag:     # phiến lát cỡ lớn, không đều
        vec = M.warp(w, 0.12, 1.2)
        ed = M.voronoi(vec, 0.8, 'DISTANCE_TO_EDGE', 'Distance')
        cc = M.sepc(M.voronoi(vec, 0.8, 'F1', 'Color'))
        col = M.mixc(col, scaled(t, 1.3), M.math('MULTIPLY', cc, 0.8))
        gap = M.math('SUBTRACT', 1.0, M.ramp_f(ed, 0.0, 0.05))
        col = M.mixc(col, (0.006, 0.006, 0.006, 1), M.math('MULTIPLY', gap, 0.9))
        hgt = M.math('ADD', M.math('SUBTRACT', hgt, M.math('MULTIPLY', gap, 1.2)), M.math('MULTIPLY', cc, 0.35))
    nrm = M.bump(hgt, bump, 0.05)
    return M.finish(M.principled(M.ao(col, 0.25), rough, nrm))


def glass_material(name='obsidian', hexc='#0a0a0e'):
    M = Mat(name)
    w = M.coord('Object', 1.0)
    n = M.noise(w, 14.0, 3.0)
    t = rgb(hexc)
    col = M.ramp(n, [(0.3, scaled(t, 0.6)), (0.7, scaled(t, 1.6))])
    return M.finish(M.principled(col, 0.1, None, None, 0.0, 0.0, 0.9))


def glow_material(name, color_hex, strength):
    M = Mat(name)
    M.no_caustic = True
    return M.finish(M.emission(rgb(color_hex), strength))
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



# ───────────────────────── khung chung theo chủ đề ─────────────────────────
FIELDS = {}


def W(u, v, z=0.0):
    """Toạ độ ảnh (u sang phải, v xuống dưới) -> thế giới. Ảnh quay 180° quanh Z nên x = -u."""
    return (-u, v, z)


class Ctx:
    def __init__(self, sc, rng, grid, cfg, variant):
        self.sc, self.rng, self.grid, self.cfg, self.variant = sc, rng, grid, cfg, variant

    def tz(self, u, v):
        return terrain_z(self.grid, -u, v)

    def free(self, u, v, m=0.0):
        return not (abs(u) < 4.5 + m and v < 4.5 + m)

    def light(self, u, v, z, hexc, energy, r=0.12):
        li = bpy.data.lights.new('pl', 'POINT')
        li.energy = energy
        li.color = rgb(hexc)[:3]
        li.shadow_soft_size = r
        ob = bpy.data.objects.new('pl', li)
        ob.location = W(u, v, z)
        self.sc.collection.objects.link(ob)

    def motes(self, hexc, strength, n, zlo, zhi, rlo, rhi, name='motes', seg=1):
        em = B(name, glow_material(name, hexc, strength))
        k = tries = 0
        while k < n and tries < 600:
            tries += 1
            u, v = self.rng.uniform(-5.45, 5.45), self.rng.uniform(0.05, 5.45)
            if not self.free(u, v, -0.05):
                continue
            x, y, _ = W(u, v)
            em.ico((x, y, self.rng.uniform(zlo, zhi)), self.rng.uniform(rlo, rhi), seg, smooth=True)
            k += 1
        return em.finish(self.sc)


def height_grid(X, Y, T):
    flat, fy = X.ravel(), Y.ravel()
    fr = T.get('freq', 0.55)
    ns = np.empty(flat.shape)
    ns2 = np.empty(flat.shape)
    for i, (x, y) in enumerate(zip(flat, fy)):
        ns[i] = noise.fractal(Vector((x * fr + 3.1, y * fr - 1.7, 0.37)), 0.55, 2.0, 5)
        ns2[i] = noise.fractal(Vector((x * 2.6 - 7.0, y * 2.6 + 4.0, 1.9)), 0.6, 2.0, 3)
    ns, ns2 = ns.reshape(X.shape), ns2.reshape(X.shape)
    base = T['off'] + T['amp'] * ns + 0.06 * ns2
    cap = T.get('cap', 0.3)
    base = np.where(base > cap, cap + (base - cap) * 0.5, base)
    base = np.clip(base, T.get('lo', -0.3), T.get('hi', 0.45))
    if T.get('wave'):
        base = base + T['wave'] * np.sin((X * 0.9 + Y * 1.6 + ns * 4.0) * 2.2)
    dx = np.maximum(np.abs(X) - 4.4, 0.0)
    dy = np.maximum(Y - 4.4, 0.0)
    mask = sstep(0.0, 0.75, np.hypot(dx, dy))
    wob = 1.0 + 0.35 * np.sin(X * 2.3 + Y * 1.7) * np.cos(Y * 3.1 - X)
    carve = np.zeros(X.shape)
    for sh in T.get('carve', []):
        if sh[0] == 'poly':
            pts = smooth_poly([(-u, v) for u, v in sh[1]], 10 if len(sh[1]) < 4 else 24)
            d = dist_poly(X, Y, pts)
            wd = sh[2]
            carve = np.maximum(carve, sstep(wd * wob, wd * 0.2, d) * (sh[3] if len(sh) > 3 else 1.0))
        else:
            _, cu, cv, ru, rv = sh
            dl = np.hypot((X + cu) / ru, (Y - cv) / rv)
            carve = np.maximum(carve, sstep(1.45, 0.55, dl))
    for (cu, cv, rr) in T.get('flat', []):
        dl = np.hypot(X + cu, Y - cv)
        s = sstep(rr, rr * 0.45, dl)
        base = base * (1 - s) + T.get('flat_h', 0.05) * s
        carve = carve * (1 - sstep(rr * 0.9, rr * 0.4, dl))
    carve *= mask
    rim = sstep(0.02, 0.22, carve) * (1 - sstep(0.3, 0.7, carve))
    base = base + T.get('rim', 0.16) * rim * mask
    H = base * mask * (1 - carve) + T.get('depth', -0.5) * carve
    return H, carve


def terrain_object(sc, mat, T):
    step = 0.06
    xs = np.arange(-6.6, 6.6 + 1e-6, step)
    ys = np.arange(-1.0, 6.6 + 1e-6, step)
    X, Y = np.meshgrid(xs, ys)
    H, carve = height_grid(X, Y, T)
    nx, ny = len(xs), len(ys)
    verts = np.stack([X, Y, H], axis=-1).reshape(-1, 3)
    faces = [(j * nx + i, j * nx + i + 1, j * nx + i + 1 + nx, j * nx + i + nx) for j in range(ny - 1) for i in range(nx - 1)]
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


def setup_world(sc, cfg):
    w = bpy.data.worlds.new('KyDaiV2World')
    w.use_nodes = True
    bg = w.node_tree.nodes.get('Background')
    bg.inputs[0].default_value = rgb(cfg['world'][0])
    bg.inputs[1].default_value = cfg['world'][1]
    sc.world = w


def setup_sun(sc, cfg):
    hexc, energy, elev = cfg['sun']
    li = bpy.data.lights.new('sun', 'SUN')
    li.energy = energy
    li.color = rgb(hexc)[:3]
    li.angle = math.radians(2.2)
    ob = bpy.data.objects.new('sun', li)
    sc.collection.objects.link(ob)
    el = math.radians(elev)
    frm = Vector((math.cos(el) * 0.7071, -math.cos(el) * 0.7071, math.sin(el)))
    ob.rotation_euler = (-frm).to_track_quat('-Z', 'Y').to_euler()
    ob.location = frm * 20
    return ob


# ───────────────────────── bệ, phiến, gờ, trụ ─────────────────────────
def build_floor(ctx):
    sc, cfg, rng, variant = ctx.sc, ctx.cfg, ctx.rng, ctx.variant
    gl = B('under_glow', glow_material('under_glow', cfg['under'][0], cfg['under'][1]))
    gl.box((-4.1, -0.05, 0.0), (4.1, 4.1, 0.006))
    gl.finish(sc)
    plinth = B('plinth', basalt_material('plinth', cfg['plinth'], 0.7, flag=True))
    plinth.box((-4.62, -0.6, -0.12), (4.62, 4.62, 0.05), bevel=0.05, seg=3)
    plinth.finish(sc)
    if variant == 'chess':
        lt, dk, glow = cfg['slab']
        groups = {t: B('slabs_' + t, slab_material('slab_' + t, lt if t == 'light' else dk, glow, glossy=0.5 if t == 'light' else 0.38))
                  for t in ('light', 'dark')}
        for c in range(8):
            for r in range(4):
                ci = 7 - c      # cột đếm từ trái ảnh
                tone = 'light' if (ci + r) % 2 == LIGHT_PARITY else 'dark'
                rot = rot_xyz(math.radians(rng.uniform(-0.6, 0.6)), math.radians(rng.uniform(-0.6, 0.6)),
                              math.radians(rng.uniform(-0.4, 0.4)))
                groups[tone].box((c - 3.5 - 0.47, r + 0.5 - 0.47, -0.07), (c - 3.5 + 0.47, r + 0.5 + 0.47, 0.07),
                                 bevel=0.035, seg=2, rot=rot)
        for g in groups.values():
            for v in g.bm.verts:
                v.co.z += 0.07
            g.finish(sc)
    else:
        s = B('slab_xq', slab_material('slab_xq', cfg['xq'], cfg['slab'][2], glossy=0.5, big=True, bank=cfg['bank']))
        s.box((-4.05, -0.05, 0.0), (4.05, 4.05, 0.14), bevel=0.04, seg=3)
        s.finish(sc)


def build_ledge_and_pillars(ctx):
    sc, cfg = ctx.sc, ctx.cfg
    L = B('ledge', basalt_material('ledge', cfg['ledge'], 0.55))
    G = B('ledge_groove', glow_material('groove', cfg['groove'][0], cfg['groove'][1]))
    t = 0.06
    for sx in (-1, 1):
        for k, (a, b, hh) in enumerate(((0.0, t, 0.2), (t, 2 * t, 0.15), (2 * t, 3 * t, 0.2))):
            xl = (4.0 + a) if sx > 0 else (-4.0 - b)
            xh = (4.0 + b) if sx > 0 else (-4.0 - a)
            (G if k == 1 else L).box((xl, -0.05, 0.0), (xh, 4.18, hh), bevel=0.012 if k != 1 else 0.0, seg=1, flat_big=False)
    for k, (a, b, hh) in enumerate(((0.0, t, 0.2), (t, 2 * t, 0.15), (2 * t, 3 * t, 0.2))):
        (G if k == 1 else L).box((-4.18, 4.0 + a, 0.0), (4.18, 4.0 + b, hh), bevel=0.012 if k != 1 else 0.0, seg=1, flat_big=False)
    P = B('pillars', basalt_material('pillar', cfg['pillar'], 0.5))
    bowl = B('bowls', basalt_material('bowl', cfg['bowl'], 0.5))
    fire = B('fire', glow_material('fire', cfg['fire'][0], cfg['fire'][1]))
    for sx in (-1, 1):
        for cy in (0.0, 4.18):
            cx = sx * 4.18
            P.box((cx - 0.17, cy - 0.17, 0.0), (cx + 0.17, cy + 0.17, 0.55), bevel=0.03, seg=2, flat_big=False)
            P.box((cx - 0.2, cy - 0.2, 0.5), (cx + 0.2, cy + 0.2, 0.6), bevel=0.02, seg=2, flat_big=False)
            bowl.lathe([(0.01, 0.6), (0.1, 0.62), (0.16, 0.7), (0.17, 0.74), (0.14, 0.73), (0.02, 0.66)], 14, (cx, cy, 0.0), True, cap=False)
            if cfg.get('top', 'flame') == 'flame':
                fire.ico((cx, cy, 0.76), 0.1, 2, (1, 1, 0.9))
                fire.cone((cx, cy, 0.76), 0.07, 0.0, 0.22, 6, smooth=True)
            else:
                fire.ico((cx, cy, 0.78), 0.115, 2)
    for b in (L, G, P, bowl, fire):
        b.finish(sc)


def censer(ctx, u, v, s, stone_hex, ember_hex, name='censer'):
    """Lư hương đá ba chân, tỉ lệ s; quai hai bên; than hồng và nhang ở miệng."""
    sc = ctx.sc
    x, y, _ = W(u, v)
    cen = B(name, basalt_material(name, stone_hex, 0.55))
    ash = B(name + '_ash', glow_material(name + '_ember', ember_hex, 4.0))
    cen.box((x - 0.34 * s, y - 0.34 * s, -0.2), (x + 0.34 * s, y + 0.34 * s, 0.07), bevel=0.04, seg=2, flat_big=False)
    for k in range(3):
        a = 2 * math.pi * k / 3 + math.pi / 2
        cen.cone((x + 0.2 * s * math.cos(a), y + 0.2 * s * math.sin(a), 0.07), 0.07 * s, 0.045 * s, 0.14 * s, 6)
    prof = [(0.0, 0.2), (0.17, 0.2), (0.27, 0.27), (0.29, 0.36), (0.25, 0.42), (0.23, 0.4), (0.0, 0.34)]
    cen.lathe([(r * s, z * s) for r, z in prof], 20, (x, y, 0), True, cap=False)
    for sgn in (-1, 1):
        cen.box((x + sgn * 0.3 * s - 0.03, y - 0.05 * s, 0.31 * s), (x + sgn * 0.3 * s + 0.03 + sgn * 0.1 * s, y + 0.05 * s, 0.38 * s),
                bevel=0.012, seg=1, flat_big=False)
    ash.lathe([(0.0, 0.372 * s), (0.2 * s, 0.372 * s)], 18, (x, y, 0), True, cap=True)
    for k in range(7):
        a = 2 * math.pi * k / 7
        rr = (0.08 + 0.05 * (k % 2)) * s
        ash.cone((x + rr * math.cos(a), y + rr * math.sin(a), 0.36 * s), 0.01, 0.01, 0.16 * s, 4)
    cen.finish(sc)
    ash.finish(sc)


# ───────────────────────── chủ đề: Hỏa Diệm Sơn ─────────────────────────
def magma_material():
    M = Mat('magma')
    M.no_caustic = True
    w = M.coord('Object', 1.0)
    n = M.noise(w, 3.0, 4.0, 0.6, 0.4)
    col = M.ramp(n, [(0.3, rgb('#e83c08')), (0.75, rgb('#ff9a30'))])
    e = M.n('ShaderNodeEmission')
    M.link(col, e.inputs['Color'])
    e.inputs['Strength'].default_value = 1.8
    return M.finish(e.outputs[0])


def build_volcano(ctx):
    sc, rng = ctx.sc, ctx.rng
    rocks = B('boulders', basalt_material('boulder', '#5c3b2e', 0.8))
    anchors = [(-4.6, 0.7), (-5.05, 1.0), (-4.65, 2.1), (-4.95, 2.05), (-4.55, 3.4), (-5.1, 3.7), (-3.4, 4.45), (-3.0, 5.2),
               (4.55, 1.7), (5.1, 3.2), (4.5, 4.4), (5.25, 0.4), (1.0, 5.3), (2.6, 4.7)]
    for k, (au, av) in enumerate(anchors):
        r = rng.uniform(0.2, 0.42)
        u, v = au + rng.uniform(-0.1, 0.1), av + rng.uniform(-0.1, 0.1)
        if not ctx.free(u, v):
            continue
        z = max(ctx.tz(u, v), -0.05) + r * 0.2
        x, y, _ = W(u, v)
        rocks.ico((x, y, z), r, 3, (rng.uniform(0.9, 1.3), rng.uniform(0.8, 1.2), rng.uniform(0.5, 0.85)), 0.35, rng,
                  rot=rot_xyz(rng.uniform(-0.3, 0.3), rng.uniform(-0.3, 0.3), rng.uniform(0, 6.28)), seedv=k * 7.3, smooth=True)
    rocks.finish(sc)
    crater = B('craters', basalt_material('crater_rim', '#34201a', 0.8))
    lava = B('crater_lava', magma_material())
    for k, (cu, cv) in enumerate(((-5.0, 4.9), (5.0, 4.9))):
        x, y, _ = W(cu, cv)
        crater.lathe([(0.78, -0.5), (0.74, 0.1), (0.6, 0.5), (0.46, 0.62), (0.38, 0.46), (0.34, 0.14), (0.0, 0.12)],
                     20, (x, y, 0), True, cap=False, jitter=0.12, seedv=k * 9.7)
        lava.lathe([(0.0, 0.2), (0.35, 0.2), (0.35, 0.19)], 20, (x, y, 0.0), True, cap=True)
        ctx.light(cu, cv, 0.95, '#ff6a20', 30.0, 0.2)
    crater.finish(sc)
    lava.finish(sc)
    ob = B('obsidian', glass_material())
    for (u, v) in ((-4.75, 1.3), (-5.2, 2.7), (4.7, 0.6), (5.2, 2.05), (4.9, 3.5), (-3.2, 5.1), (0.9, 5.25), (-2.2, 4.6)):
        zt = max(ctx.tz(u, v), -0.05)
        x, y, _ = W(u, v)
        for k in range(3):
            ob.cone((x + rng.uniform(-0.11, 0.11), y + rng.uniform(-0.11, 0.11), zt - 0.03), rng.uniform(0.08, 0.14), 0.004,
                    rng.uniform(0.45, 0.8), 5, rot_xyz(rng.uniform(-0.45, 0.45), rng.uniform(-0.45, 0.45), rng.uniform(0, 6.28)))
    ob.finish(sc)
    censer(ctx, 0.0, 4.95, 1.5, '#52352a', '#ff8a3a')
    ctx.light(0.0, 4.95, 0.9, '#ff8a3a', 14.0, 0.15)
    ctx.motes('#ffa24a', 25.0, 52, 0.2, 0.8, 0.012, 0.032, 'embers')


FIELDS['volcano'] = dict(
    world=('#0c0a14', 0.3), sun=('#ffd9b0', 3.0, 60), glare=(1.2, 0.3, 0.4), exposure=0.55,
    ground=lambda: rock_material('terrain'), liquid=lava_material, liquid_z=-0.18,
    T=dict(off=0.26, amp=0.8, freq=0.55, lo=-0.3, hi=0.45, cap=0.3, depth=-0.5, rim=0.16,
           carve=[('poly', [(-5.15, -0.8), (-4.95, 0.5), (-5.2, 1.5), (-4.95, 2.6), (-5.15, 3.6), (-4.75, 4.45), (-3.8, 4.95),
                            (-2.7, 4.75), (-1.5, 4.9)], 0.62),
                  ('poly', [(2.0, 4.8), (3.3, 5.0), (4.2, 4.6), (4.85, 3.7), (5.15, 2.6), (4.95, 1.5)], 0.5, 0.95),
                  ('poly', [(6.2, 0.9), (5.3, 1.1), (4.75, 1.0)], 0.22, 0.9),
                  ('poly', [(6.2, 2.3), (5.4, 2.55), (4.85, 2.4)], 0.22, 0.9),
                  ('poly', [(-6.2, 3.1), (-5.6, 3.3), (-5.0, 3.15)], 0.22, 0.9),
                  ('ell', -1.8, 4.95, 0.95, 0.5), ('ell', 2.6, 4.9, 0.85, 0.45)],
           flat=[(-5.0, 4.9, 1.0), (5.0, 4.9, 1.0)]),
    slab=('#dc8450', '#46241a', '#ff4a10'), under=('#ff5a1a', 1.8), plinth='#6a4333', ledge='#86503a',
    groove=('#b02a08', 0.55), pillar='#7a4834', bowl='#1c110e', fire=('#ff9a30', 6.0), top='flame',
    xq='#6a3a28', bank=('#2a1612', '#4a2a20', 'pebble'), build=build_volcano)
# ───────────────────────── chủ đề: Trường Giang (river) ─────────────────────────
def sweep(b, path, w, th):
    """Quét một mặt cắt chữ nhật (rộng w theo trục x, dày th) dọc đường đi 3D: dùng cho cầu cong, bậc, tay vịn."""
    rings = []
    for (x, y, z) in path:
        rings.append([b.bm.verts.new((x - w / 2, y, z)), b.bm.verts.new((x + w / 2, y, z)),
                      b.bm.verts.new((x + w / 2, y, z - th)), b.bm.verts.new((x - w / 2, y, z - th))])
    for a, c in zip(rings[:-1], rings[1:]):
        for i in range(4):
            j = (i + 1) % 4
            b.bm.faces.new((a[i], a[j], c[j], c[i]))
    b.bm.faces.new(list(reversed(rings[0])))
    b.bm.faces.new(rings[-1])


def reeds(b, x, y, rng, n=9, hmin=0.45, hmax=0.85, r=0.016):
    for k in range(n):
        a = rng.uniform(0, 6.28)
        d = rng.uniform(0.0, 0.16)
        tilt = rng.uniform(0.05, 0.4)
        b.cone((x + d * math.cos(a), y + d * math.sin(a), -0.05), r, 0.002, rng.uniform(hmin, hmax), 3,
               rot_xyz(tilt * math.sin(a), -tilt * math.cos(a), 0))


def build_river(ctx):
    sc, rng = ctx.sc, ctx.rng
    # cầu đá cong bắc qua dòng nước phía sau lưng
    br = B('bridge', basalt_material('bridge', '#9a9c92', 0.7, bump=1.5))
    n = 14
    path = [(0.0, 4.46 + 1.2 * t / n, 0.03 + 0.4 * math.sin(math.pi * t / n) ** 0.8) for t in range(n + 1)]
    sweep(br, path, 0.74, 0.13)
    for sx in (-0.33, 0.33):
        sweep(br, [(sx, y, z + 0.1) for (_, y, z) in path], 0.08, 0.1)
    for (_, y, z) in (path[0], path[-1]):
        br.box((-0.4, y - 0.06, -0.2), (0.4, y + 0.06, z + 0.02), bevel=0.02, seg=1, flat_big=False)
    br.box((-0.42, 4.44, -0.1), (-0.3, 4.56, 0.42), bevel=0.02, seg=1, flat_big=False)
    br.box((0.3, 4.44, -0.1), (0.42, 4.56, 0.42), bevel=0.02, seg=1, flat_big=False)
    br.box((-0.42, 5.58, -0.1), (-0.3, 5.7, 0.42), bevel=0.02, seg=1, flat_big=False)
    br.box((0.3, 5.58, -0.1), (0.42, 5.7, 0.42), bevel=0.02, seg=1, flat_big=False)
    br.finish(sc)
    gl = B('bridge_lamps', glow_material('lamp', '#ffd890', 7.0))
    for (x, y) in ((-0.36, 4.5), (0.36, 4.5), (-0.36, 5.64), (0.36, 5.64)):
        gl.ico((x, y, 0.5), 0.055, 2)
    gl.finish(sc)
    ctx.light(0.0, 5.05, 0.8, '#ffd9a0', 10.0, 0.2)
    # cối xay nước nằm (bánh xe ngang) ở góc sau trái
    wood = B('mill_wood', basalt_material('mill_wood', '#7a5434', 0.65, bump=1.6))
    thatch = B('mill_roof', basalt_material('mill_roof', '#b09a60', 0.9, bump=2.0))
    x, y, _ = W(-5.0, 5.05)
    wood.box((x - 0.4, y - 0.34, -0.25), (x + 0.4, y + 0.34, 0.5), bevel=0.02, seg=1, flat_big=False)
    thatch.cone((x, y, 0.5), 0.52, 0.03, 0.36, 4, rzm(math.pi / 4))
    wx, wy, _ = W(-4.45, 4.55)
    wood.lathe([(0.17, 0.0), (0.46, 0.0), (0.46, 0.1), (0.17, 0.1), (0.17, 0.0)], 18, (wx, wy, -0.12), False, cap=False)
    for k in range(10):
        a = 2 * math.pi * k / 10
        cx_, cy_ = wx + 0.32 * math.cos(a), wy + 0.32 * math.sin(a)
        wood.box((cx_ - 0.17, cy_ - 0.025, -0.14), (cx_ + 0.17, cy_ + 0.025, 0.2), bevel=0.0, seg=1, flat_big=False, rot=rzm(a))
    wood.box((wx - 0.04, wy - 0.04, -0.2), (wx + 0.04, wy + 0.04, 0.3), flat_big=False)
    wood.box((x + 0.3, y - 0.05, 0.05), (wx - 0.1, y + 0.05, 0.12), flat_big=False)   # trục dẫn
    wood.finish(sc)
    thatch.finish(sc)
    ctx.light(-4.8, 4.85, 0.9, '#ffd8a0', 8.0, 0.2)
    # thuyền thúng buộc ở bờ sau phải
    bt = B('boat', basalt_material('basket_boat', '#b58c52', 0.8, bump=2.2))
    bx, by, _ = W(3.5, 5.05)
    bt.lathe([(0.0, 0.0), (0.3, 0.02), (0.42, 0.1), (0.46, 0.2), (0.43, 0.22), (0.39, 0.13), (0.0, 0.08)], 22, (bx, by, -0.2), True, cap=False)
    bt.lathe([(0.46, 0.2), (0.48, 0.22), (0.44, 0.25), (0.42, 0.22)], 22, (bx, by, -0.2), True, cap=False)
    px, py, _ = W(4.35, 4.7)
    bt.cone((px, py, -0.2), 0.05, 0.035, 0.62, 6)
    bt.box((bx - 0.03, by - 0.5, 0.0), (bx + 0.03, by + 0.5, 0.05), flat_big=False, rot=rzm(0.4))   # mái chèo
    bt.finish(sc)
    ctx.light(3.5, 5.05, 0.7, '#fff0d0', 5.0, 0.2)
    # lau sậy dọc bờ
    rd = B('reeds', basalt_material('reed', '#b9b078', 0.9, bump=0.5))
    spots = [(-4.55, 0.5), (-4.6, 1.3), (-4.45, 2.4), (-4.55, 3.5), (-4.0, 4.7), (-2.3, 4.58), (-1.2, 4.62), (1.6, 4.6), (2.6, 4.6),
             (4.1, 4.66), (4.55, 3.7), (4.6, 2.5), (4.5, 1.3), (4.6, 0.4), (5.35, 2.0), (-5.4, 1.8)]
    for (u, v) in spots:
        x, y, _ = W(u + rng.uniform(-0.08, 0.08), v)
        reeds(rd, x, y, rng, 10)
    rd.finish(sc)
    # sỏi to và tảng đá ven bờ
    rk = B('boulders', basalt_material('boulder', '#7b8478', 0.8, bump=1.4))
    for (u, v, r) in ((-4.7, 0.9, 0.3), (-4.65, 2.9, 0.26), (-5.4, 4.4, 0.3), (4.75, 1.0, 0.3), (4.7, 3.2, 0.28), (5.3, 4.7, 0.34),
                      (-3.3, 4.62, 0.2), (2.4, 4.6, 0.18), (-5.45, 0.4, 0.2)):
        x, y, _ = W(u, v)
        rk.ico((x, y, max(ctx.tz(u, v), -0.1) + r * 0.2), r, 3, (1.2, 1.0, 0.65), 0.3, rng, rot=rzm(rng.uniform(0, 6)), seedv=u * 3.1, smooth=True)
    rk.finish(sc)
    # lá trôi trên mặt nước
    lf = B('leaves', basalt_material('leaf', '#c0924a', 0.7))
    lg = B('leaves_g', basalt_material('leaf_g', '#6c8a3c', 0.7))
    for k in range(26):
        t = rng.uniform(0, 1)
        if t < 0.5:
            u, v = -5.05 + rng.uniform(-0.15, 0.15), t * 9.0 - 0.3
        else:
            u, v = (t - 0.5) * 8.0 - 3.8, 5.05 + rng.uniform(-0.2, 0.2)
        if not ctx.free(u, v) or v < 0.0:
            continue
        x, y, _ = W(u, v)
        (lf if k % 2 else lg).ico((x, y, -0.17), 0.07, 1, (1.0, 0.6, 0.12), rot=rzm(rng.uniform(0, 6)), smooth=True)
    lf.finish(sc)
    lg.finish(sc)


FIELDS['river'] = dict(
    world=('#bcd4e4', 0.8), sun=('#fff0d8', 3.2, 60), glare=(1.1, 0.12, 0.3), exposure=0.0,
    ground=lambda: ground_material('terrain', 'pebble', '#59675f', '#9ba89e', '#b4b8a6', wet='#17282a', bump=1.1),
    liquid=lambda: water_material('water', '#8fd0cc', '#1b5c68', alpha=0.45, ripple=0.3, scale=2.0), liquid_z=-0.18,
    T=dict(off=0.2, amp=0.5, freq=0.5, lo=-0.3, hi=0.34, cap=0.24, depth=-0.7, rim=0.05,
           carve=[('poly', [(-5.35, -0.8), (-5.2, 0.6), (-5.3, 1.8), (-5.2, 3.0), (-5.25, 4.0), (-4.4, 5.0), (-3.4, 5.2), (-2.0, 5.1),
                            (-0.8, 5.2), (0.8, 5.2), (2.0, 5.1), (3.4, 5.2), (4.4, 5.0), (5.2, 4.0), (5.15, 3.0), (5.3, 1.8),
                            (5.2, 0.6), (5.35, -0.8)], 0.5)],
           flat=[(-5.0, 5.0, 0.8)], flat_h=0.12),
    slab=('#b3c0bd', '#3f5c4e', None), under=('#6fb0b0', 0.6), plinth='#8a948c', ledge='#98a49c',
    groove=('#3b8f8a', 0.4), pillar='#8a958d', bowl='#2c3a34', fire=('#ffd890', 4.0), top='orb',
    xq='#8c8f82', bank=('#3a4a44', '#8a9c92', 'pebble'), build=build_river)

# ───────────────────────── chủ đề: Cổ Mộc Lâm (forest) ─────────────────────────
def limb(b, p0, p1, r0, r1, seg=6, smooth=True):
    """Một đoạn thân/rễ/lá hình nón cụt đi từ p0 tới p1."""
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    up = 'X' if abs(d.normalized().y) > 0.99 else 'Y'
    m = Matrix.Translation((p0 + p1) / 2) @ d.to_track_quat('Z', up).to_matrix().to_4x4()
    res = bmesh.ops.create_cone(b.bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r0, radius2=max(r1, 0.001),
                                depth=d.length, matrix=m)
    for f in {f for v in res['verts'] for f in v.link_faces}:
        f.smooth = smooth


def fern(b, x, y, z, rng, n=8, ln=0.42, w=0.05):
    for k in range(n):
        a = 2 * math.pi * k / n + rng.uniform(-0.2, 0.2)
        d = Vector((math.cos(a), math.sin(a), 0))
        ll = ln * rng.uniform(0.75, 1.1)
        p0 = Vector((x, y, z + 0.04))
        p1 = p0 + d * ll * 0.55 + Vector((0, 0, 0.2))
        p2 = p0 + d * ll + Vector((0, 0, 0.06))
        limb(b, p0, p1, w, w * 0.8, 4)
        limb(b, p1, p2, w * 0.8, 0.004, 4)


def mushroom(b, cap, x, y, z, r, rng):
    limb(b, (x, y, z), (x, y, z + r * 1.5), r * 0.28, r * 0.22, 6)
    cap.ico((x, y, z + r * 1.5), r, 2, (1, 1, 0.5), 0.0, rng, smooth=True)


def build_forest(ctx):
    sc, rng = ctx.sc, ctx.rng
    # gốc cổ thụ rỗng ở góc sau trái: hốc sáng đom đóm
    bark = B('stump', basalt_material('bark', '#4e3a26', 0.9, bump=2.2))
    glow = B('stump_glow', glow_material('hollow', '#a8d83a', 1.1))
    sx, sy, _ = W(-4.95, 4.95)
    bark.lathe([(0.8, -0.3), (0.66, 0.02), (0.54, 0.22), (0.5, 0.52), (0.47, 0.66), (0.39, 0.64), (0.33, 0.46), (0.0, 0.42)],
               22, (sx, sy, 0), True, cap=False, jitter=0.12, seedv=2.1)
    glow.lathe([(0.0, 0.47), (0.3, 0.47)], 18, (sx, sy, 0), True, cap=True)
    for k in range(7):
        a = 2 * math.pi * k / 7 + 0.3
        d = Vector((math.cos(a), math.sin(a), 0))
        p0 = Vector((sx, sy, 0.2)) + d * 0.42
        p1 = Vector((sx, sy, 0.02)) + d * 0.95
        p2 = Vector((sx, sy, -0.12)) + d * 1.35
        limb(bark, p0, p1, 0.14, 0.09, 6)
        limb(bark, p1, p2, 0.09, 0.015, 6)
    bark.finish(sc)
    glow.finish(sc)
    ctx.light(-4.95, 4.95, 0.9, '#c8ff70', 22.0, 0.2)
    # tảng đá phủ rêu + nấm ở góc sau phải
    moss = B('mossrock', basalt_material('mossrock', '#4c6a34', 0.9, bump=2.0))
    mx, my, _ = W(4.95, 4.9)
    moss.ico((mx, my, 0.05), 0.6, 3, (1.15, 1.0, 0.85), 0.28, rng, rot=rzm(0.7), seedv=4.0, smooth=True)
    moss.ico((mx + 0.5, my - 0.2, 0.0), 0.32, 3, (1.1, 0.9, 0.7), 0.3, rng, seedv=9.0, smooth=True)
    moss.finish(sc)
    cap = B('caps_red', basalt_material('cap_red', '#b8402a', 0.5))
    capg = B('caps_glow', gem_material('cap_glow', '#7fe8d0', 1.4, 0.3))
    stem = B('stems', basalt_material('stem', '#e8e0c8', 0.7))
    for k in range(5):
        a = rng.uniform(0, 6.28)
        rr = rng.uniform(0.0, 0.32)
        mushroom(stem, cap if k % 2 else capg, mx + rr * math.cos(a), my + rr * math.sin(a), 0.5, rng.uniform(0.07, 0.12), rng)
    ctx.light(4.95, 4.9, 0.9, '#7fe8d0', 12.0, 0.2)
    # miếu thổ thần gỗ ở giữa dải sau
    wood = B('shrine_wood', basalt_material('shrine_wood', '#7a3e2a', 0.7, bump=1.6))
    roof = B('shrine_roof', basalt_material('shrine_roof', '#5d6e3e', 0.9, bump=2.2))
    base = B('shrine_base', basalt_material('shrine_base', '#6a6a5a', 0.8))
    x, y, _ = W(0.0, 5.0)
    base.box((x - 0.55, y - 0.45, -0.2), (x + 0.55, y + 0.45, 0.08), bevel=0.03, seg=1, flat_big=False)
    for dx in (-0.36, 0.36):
        for dy in (-0.28, 0.28):
            wood.box((x + dx - 0.04, y + dy - 0.04, 0.08), (x + dx + 0.04, y + dy + 0.04, 0.5), flat_big=False)
    wood.box((x - 0.34, y - 0.26, 0.08), (x + 0.34, y + 0.26, 0.44), bevel=0.01, seg=1, flat_big=False)
    door = B('shrine_door', glow_material('shrine_door', '#ffcf80', 2.5))
    door.box((x - 0.1, y - 0.28, 0.1), (x + 0.1, y - 0.255, 0.36))
    door.finish(sc)
    roof.cone((x, y, 0.5), 0.72, 0.1, 0.3, 4, rzm(math.pi / 4))
    wood.box((x - 0.14, y - 0.04, 0.78), (x + 0.14, y + 0.04, 0.84), flat_big=False)
    wood.finish(sc)
    roof.finish(sc)
    base.finish(sc)
    ctx.light(0.0, 4.8, 0.7, '#ffd9a0', 8.0, 0.15)
    # dương xỉ
    fr = B('ferns', basalt_material('fern', '#3f7a2c', 0.8, bump=0.6))
    for (u, v) in ((-4.6, 0.7), (-5.2, 2.0), (-4.65, 3.3), (-3.6, 5.1), (-2.6, 4.85), (2.4, 4.9), (3.4, 5.15), (4.7, 3.8), (5.25, 2.4),
                   (4.6, 0.9), (-5.3, 0.4), (5.3, 0.4), (-1.5, 5.25), (1.5, 5.25)):
        x, y, _ = W(u, v)
        fern(fr, x, y, max(ctx.tz(u, v), -0.05), rng)
    fr.finish(sc)
    # nấm nhỏ rải
    st2 = B('stems2', basalt_material('stem2', '#e8e0c8', 0.7))
    cp2 = B('caps2', basalt_material('cap2', '#c8782a', 0.5))
    for (u, v) in ((-4.5, 1.6), (-4.55, 3.9), (-3.0, 5.25), (3.0, 4.85), (4.55, 2.0), (4.5, 4.2), (-2.0, 4.8), (1.0, 5.3)):
        x, y, _ = W(u, v)
        for k in range(3):
            mushroom(st2, cp2, x + rng.uniform(-0.15, 0.15), y + rng.uniform(-0.15, 0.15), max(ctx.tz(u, v), -0.05), rng.uniform(0.04, 0.08), rng)
    st2.finish(sc)
    cp2.finish(sc)
    stem.finish(sc)
    cap.finish(sc)
    capg.finish(sc)
    # đá nhỏ phủ rêu + lá rụng
    rk = B('rocks', basalt_material('rock_m', '#5f6e50', 0.85, bump=1.6))
    for (u, v, r) in ((-4.7, 1.2, 0.26), (-5.35, 3.0, 0.3), (-3.3, 5.0, 0.2), (3.0, 5.2, 0.22), (5.3, 1.4, 0.3), (4.65, 3.0, 0.2)):
        x, y, _ = W(u, v)
        rk.ico((x, y, max(ctx.tz(u, v), -0.1) + r * 0.2), r, 3, (1.2, 1.0, 0.65), 0.3, rng, rot=rzm(rng.uniform(0, 6)), seedv=u * 2.7, smooth=True)
    rk.finish(sc)
    lv = [B('leaves%d' % i, basalt_material('leaf%d' % i, hx, 0.7)) for i, hx in enumerate(('#c07a2a', '#d0a038', '#8a4a22'))]
    for k in range(46):
        u, v = rng.uniform(-5.4, 5.4), rng.uniform(0.1, 5.4)
        if not ctx.free(u, v, 0.1):
            continue
        x, y, _ = W(u, v)
        lv[k % 3].ico((x, y, max(ctx.tz(u, v), -0.05) + 0.03), 0.08, 1, (1.0, 0.55, 0.1), rot=rzm(rng.uniform(0, 6)), smooth=True)
    for b in lv:
        b.finish(sc)
    ctx.motes('#d8ff70', 30.0, 38, 0.2, 0.8, 0.016, 0.034, 'fireflies')


FIELDS['forest'] = dict(
    world=('#a8cf92', 0.7), sun=('#ffe9b8', 3.0, 60), glare=(1.0, 0.15, 0.4), exposure=0.1,
    ground=lambda: ground_material('terrain', 'moss', '#1f3a1c', '#4f7a30', '#93b552', bump=1.4),
    liquid=lambda: water_material('pond', '#5a8a62', '#0f2a1e', alpha=0.8, ripple=0.3, scale=2.0), liquid_z=-0.18,
    T=dict(off=0.2, amp=0.6, freq=0.6, lo=-0.25, hi=0.4, cap=0.28, depth=-0.6, rim=0.06,
           carve=[('ell', 3.0, 5.05, 0.9, 0.5)], flat=[(-4.95, 4.95, 0.9), (4.95, 4.9, 0.8)], flat_h=0.05),
    slab=('#a9b890', '#4a3322', None), under=('#3f7a3c', 0.5), plinth='#76805e', ledge='#7a6a50',
    groove=('#9acd50', 0.35), pillar='#7a6448', bowl='#2a2018', fire=('#d8ff70', 5.0), top='orb',
    xq='#80805e', bank=('#26361a', '#5a8a38', 'fine'), build=build_forest)

# ───────────────────────── chủ đề: Băng Hà (glacier) ─────────────────────────
def crystal(b, x, y, z, r, h, tx, ty, seg=6):
    rot = rot_xyz(tx, ty, 0.0)
    b.cone((x, y, z), r, r * 0.95, h * 0.72, seg, rot)
    tip = Vector((x, y, z)) + rot @ Vector((0, 0, h * 0.72))
    b.cone(tuple(tip), r * 0.95, 0.002, h * 0.28, seg, rot)


def build_glacier(ctx):
    sc, rng = ctx.sc, ctx.rng
    # cụm tinh thể băng lớn ở góc sau trái
    cr = B('crystals', gem_material('ice_crystal', '#6cc8ff', 1.3, 0.05, 0.95))
    cx, cy, _ = W(-5.0, 4.95)
    spec = [(0.0, 0.0, 0.2, 1.1, 0.0, 0.0), (0.3, 0.12, 0.15, 0.85, 0.35, 0.2), (-0.28, 0.1, 0.15, 0.8, -0.3, 0.25),
            (0.05, -0.3, 0.14, 0.7, 0.25, -0.35), (-0.15, 0.32, 0.13, 0.65, -0.3, -0.2), (0.4, -0.22, 0.1, 0.5, 0.5, 0.2),
            (-0.4, -0.2, 0.1, 0.5, 0.45, -0.3)]
    for dx, dy, r, h, tx, ty in spec:
        crystal(cr, cx + dx * 1.3, cy + dy * 1.3, -0.1, r * 1.45, h * 1.35, tx, ty)
    cr.finish(sc)
    base = B('crystal_base', basalt_material('ice_base', '#9db6cc', 0.4, bump=2.0))
    base.ico((cx, cy, -0.1), 0.62, 3, (1.1, 1.0, 0.3), 0.2, rng, seedv=5.0, smooth=True)
    base.finish(sc)
    ctx.light(-5.0, 4.95, 0.9, '#7fd0ff', 26.0, 0.2)
    # hang băng nhỏ ở góc sau phải: vòm băng có cửa sáng
    dome = B('cave', basalt_material('ice_dome', '#d4e8f6', 0.3, bump=1.8))
    ex, ey, _ = W(5.0, 4.9)
    dome.lathe([(0.85, -0.25), (0.82, 0.18), (0.66, 0.46), (0.4, 0.64), (0.0, 0.7)], 22, (ex, ey, 0), True, cap=False, jitter=0.1, seedv=1.3)
    dome.finish(sc)
    mouth = B('cave_mouth', glow_material('cave_glow', '#5ec0ff', 2.2))
    mouth.box((ex - 0.2, ey - 0.84, 0.0), (ex + 0.2, ey - 0.6, 0.3))
    mouth.finish(sc)
    dark = B('cave_frame', basalt_material('cave_frame', '#2a3c52', 0.5))
    dark.box((ex - 0.26, ey - 0.78, -0.05), (ex - 0.2, ey - 0.56, 0.33), flat_big=False)
    dark.box((ex + 0.2, ey - 0.78, -0.05), (ex + 0.26, ey - 0.56, 0.33), flat_big=False)
    dark.box((ex - 0.26, ey - 0.78, 0.3), (ex + 0.26, ey - 0.56, 0.36), flat_big=False)
    dark.finish(sc)
    ctx.light(5.0, 4.3, 0.5, '#5ec0ff', 14.0, 0.2)
    # tháp đá nhỏ phủ tuyết ở giữa dải sau
    stone = B('tower', basalt_material('tower_stone', '#76838f', 0.7, bump=1.5))
    snow = B('tower_snow', basalt_material('tower_snow', '#f4faff', 0.6, bump=0.8))
    x, y, _ = W(0.0, 5.0)
    stone.box((x - 0.5, y - 0.5, -0.2), (x + 0.5, y + 0.5, 0.08), bevel=0.03, seg=1, flat_big=False)
    z = 0.08
    for k, (r, hh) in enumerate(((0.36, 0.2), (0.29, 0.18), (0.22, 0.16))):
        stone.lathe([(r, z), (r, z + hh)], 6, (x, y, 0), False, cap=True)
        stone.cone((x, y, z + hh), r * 1.4, r * 0.3, 0.1, 6)
        snow.ico((x, y, z + hh + 0.07), r * 1.2, 2, (1, 1, 0.22), 0.1, rng, smooth=True)
        z += hh + 0.1
    stone.cone((x, y, z), 0.06, 0.0, 0.26, 6)
    stone.finish(sc)
    snow.finish(sc)
    ctx.light(0.0, 4.85, 0.8, '#bfe4ff', 8.0, 0.2)
    # bờ tuyết đùn
    sn = B('drifts', basalt_material('drift', '#f2f8ff', 0.6, bump=0.6))
    for (u, v, r) in ((-4.7, 0.8, 0.34), (-4.6, 2.2, 0.3), (-5.35, 3.4, 0.4), (4.75, 0.9, 0.34), (4.7, 2.3, 0.3), (5.4, 3.5, 0.4),
                      (-3.2, 5.1, 0.34), (-2.0, 5.3, 0.3), (2.9, 5.25, 0.36), (-4.4, 4.7, 0.22), (1.0, 5.35, 0.3), (-0.9, 5.3, 0.26)):
        x, y, _ = W(u, v)
        if not ctx.free(u, v):
            continue
        sn.ico((x, y, max(ctx.tz(u, v), -0.05) - 0.02), r, 3, (1.4, 1.0, 0.4), 0.25, rng, rot=rzm(rng.uniform(0, 6)), seedv=u * 1.9, smooth=True)
    sn.finish(sc)
    # mảnh băng nhọn
    sh = B('shards', gem_material('ice_shard', '#b8ecff', 0.5, 0.05, 0.85))
    for (u, v) in ((-4.55, 1.5), (-5.2, 2.8), (4.6, 1.2), (5.2, 2.6), (4.9, 3.9), (-3.5, 5.2), (3.4, 5.0), (-1.2, 4.7)):
        x, y, _ = W(u, v)
        zt = max(ctx.tz(u, v), -0.05)
        for k in range(3):
            crystal(sh, x + rng.uniform(-0.1, 0.1), y + rng.uniform(-0.1, 0.1), zt - 0.03, rng.uniform(0.04, 0.07),
                    rng.uniform(0.28, 0.5), rng.uniform(-0.4, 0.4), rng.uniform(-0.4, 0.4), 5)
    sh.finish(sc)
    ctx.motes('#e8f8ff', 22.0, 55, 0.15, 0.8, 0.012, 0.026, 'snowflakes')


FIELDS['glacier'] = dict(
    world=('#b8d4f0', 0.6), sun=('#eaf3ff', 2.8, 60), glare=(1.0, 0.15, 0.4), exposure=-0.35,
    ground=lambda: ground_material('terrain', 'snow', '#9fb8d0', '#f4f9ff', '#2a5a8a', wet='#0e2a4a', bump=1.0),
    liquid=lambda: water_material('icewater', '#2a6a9a', '#06182e', alpha=0.92, ripple=0.2, scale=2.0), liquid_z=-0.18,
    T=dict(off=0.24, amp=0.5, freq=0.55, lo=-0.3, hi=0.4, cap=0.28, depth=-0.6, rim=0.05,
           carve=[('poly', [(-5.4, -0.5), (-5.1, 1.2), (-5.4, 2.5), (-5.0, 3.6), (-4.2, 4.5), (-3.6, 5.3)], 0.3),
                  ('poly', [(5.4, 0.3), (5.0, 1.6), (5.3, 3.0), (4.7, 3.8)], 0.28),
                  ('ell', -1.6, 5.1, 0.9, 0.45), ('ell', 2.0, 5.15, 0.8, 0.4)],
           flat=[(-5.0, 4.95, 0.9), (5.0, 4.9, 0.95)], flat_h=0.08),
    slab=('#dcebf7', '#4a7aa0', None), under=('#3a8ad0', 1.0), plinth='#aab8c6', ledge='#b4c4d4',
    groove=('#4aa8e0', 0.5), pillar='#9aa8b8', bowl='#3a4658', fire=('#9fe0ff', 5.0), top='orb',
    xq='#b8cce0', bank=('#6a8aa8', '#e0edf8', 'fine'), build=build_glacier)

# ───────────────────────── chủ đề: Hải Để (ocean) ─────────────────────────
def coral(b, p, d, r, ln, depth, rng):
    p1 = p + d * ln
    limb(b, p, p1, r, r * 0.72, 5)
    if depth <= 0:
        return
    for k in range(rng.choice((2, 3))):
        nd = (d + Vector((rng.uniform(-0.8, 0.8), rng.uniform(-0.8, 0.8), rng.uniform(0.0, 0.5)))).normalized()
        coral(b, p1, nd, r * 0.72, ln * 0.78, depth - 1, rng)


def kelp(b, x, y, rng, n=3, h=0.8):
    for k in range(n):
        a = rng.uniform(0, 6.28)
        p = Vector((x + 0.06 * math.cos(a), y + 0.06 * math.sin(a), -0.2))
        for s in range(5):
            q = p + Vector((rng.uniform(-0.09, 0.09), rng.uniform(-0.09, 0.09), h / 5))
            limb(b, p, q, 0.035 * (1 - s * 0.14), 0.035 * (1 - (s + 1) * 0.14), 4)
            p = q


def build_ocean(ctx):
    sc, rng = ctx.sc, ctx.rng
    # rạn san hô lớn ở góc sau trái
    mats = [B('coral%d' % i, basalt_material('coral%d' % i, hx, 0.55, bump=1.2)) for i, hx in enumerate(('#ff6f8a', '#ff9a3a', '#b86ad8'))]
    cx, cy, _ = W(-5.0, 4.95)
    for k, (dx, dy) in enumerate(((0.0, 0.0), (0.4, 0.2), (-0.35, 0.2), (0.15, -0.4), (-0.2, -0.35), (0.45, -0.3))):
        d = Vector((rng.uniform(-0.2, 0.2), rng.uniform(-0.2, 0.2), 1.0)).normalized()
        coral(mats[k % 3], Vector((cx + dx, cy + dy, -0.12)), d, 0.07, 0.3, 3, rng)
    brain = B('brain', basalt_material('brain', '#e6b84a', 0.5, bump=2.6))
    brain.ico((cx - 0.42, cy - 0.3, -0.05), 0.3, 3, (1, 1, 0.7), 0.1, rng, seedv=3.0, smooth=True)
    base = B('reef_base', basalt_material('reef_base', '#6e8a8a', 0.8, bump=1.6))
    base.ico((cx, cy, -0.18), 0.75, 3, (1.1, 1.0, 0.35), 0.25, rng, seedv=8.0, smooth=True)
    for b in mats + [brain, base]:
        b.finish(sc)
    ctx.light(-5.0, 4.95, 1.0, '#ffb0a0', 14.0, 0.2)
    # vỏ sò khổng lồ có ngọc phát sáng ở góc sau phải
    sx, sy, _ = W(5.0, 4.95)
    shell = B('clam', basalt_material('clam_out', '#d8c8b0', 0.5, bump=1.5))
    inner = B('clam_in', basalt_material('clam_in', '#f4c4d4', 0.35, bump=0.5))
    inner.lathe([(0.0, 0.0), (0.4, 0.05), (0.62, 0.17), (0.66, 0.24), (0.62, 0.22), (0.4, 0.1), (0.0, 0.04)], 24, (sx, sy, -0.12), True, cap=False)
    for k in range(13):                   # gân vỏ toả từ bản lề (phía sau, v lớn)
        a = math.pi * (k + 0.5) / 13
        tip = Vector((sx + 0.7 * math.cos(a), sy - 0.7 * math.sin(a) * 0.9, 0.1))
        limb(shell, Vector((sx, sy + 0.55, 0.08)), tip, 0.045, 0.06, 4)
        shell.ico((sx + 0.66 * math.cos(a), sy - 0.62 * math.sin(a), 0.14), 0.07, 1, (1, 1, 0.8), smooth=True)
    # nắp vỏ dựng lên phía sau
    shell.lathe([(0.0, 0.0), (0.4, 0.05), (0.62, 0.17), (0.66, 0.24)], 20, (sx, sy + 0.62, 0.15), True, cap=False,
                rot=rot_xyz(-1.15, 0, 0))
    pearl = B('pearl', glow_material('pearl', '#fff0f6', 4.0))
    pearl.ico((sx, sy, 0.17), 0.2, 3)
    for b in (shell, inner, pearl):
        b.finish(sc)
    ctx.light(5.0, 4.95, 0.7, '#ffe8f4', 12.0, 0.15)
    # chuông đồng chìm phủ hà ở giữa dải sau
    x, y, _ = W(0.0, 5.0)
    bell = B('bell', basalt_material('bell', '#3d7a62', 0.45, bump=2.0))
    bell.lathe([(0.46, -0.12), (0.44, 0.0), (0.34, 0.26), (0.28, 0.46), (0.18, 0.56), (0.0, 0.58)], 22, (x, y, 0), True, cap=False,
               jitter=0.04, seedv=6.0)
    bell.lathe([(0.1, 0.55), (0.1, 0.68), (0.16, 0.74)], 10, (x, y, 0), True, cap=False)
    bell.finish(sc)
    barn = B('barnacles', basalt_material('barnacle', '#e8efe0', 0.8, bump=1.0))
    for k in range(30):
        a = rng.uniform(0, 6.28)
        z = rng.uniform(0.02, 0.4)
        r = 0.46 - z * 0.45
        barn.cone((x + r * math.cos(a), y + r * math.sin(a), z), 0.035, 0.015, 0.05, 6)
    barn.finish(sc)
    ctx.light(0.0, 4.8, 0.9, '#9fe0ff', 8.0, 0.2)
    # rong biển, san hô nhỏ, sao biển
    kp = B('kelp', basalt_material('kelp', '#2f8a4a', 0.6, bump=0.6))
    for (u, v) in ((-4.6, 0.8), (-4.55, 2.3), (-5.3, 3.4), (4.65, 1.0), (4.6, 2.5), (5.3, 3.3), (-3.2, 5.1), (-1.8, 5.25), (2.0, 5.25),
                   (3.2, 5.0), (-5.3, 0.4), (5.35, 0.4)):
        x, y, _ = W(u, v)
        kelp(kp, x, y, rng, 3, rng.uniform(0.6, 1.0))
    kp.finish(sc)
    fan = B('fans', basalt_material('fan', '#e8508a', 0.5, bump=1.0))
    for (u, v) in ((-4.7, 1.6), (4.7, 1.8), (-4.55, 3.7), (4.6, 3.9), (-2.4, 5.2), (1.2, 5.25)):
        x, y, _ = W(u, v)
        a = rng.uniform(0, 6)
        for k in range(5):
            limb(fan, (x, y, -0.1), (x + 0.3 * math.cos(a + k * 0.28), y + 0.3 * math.sin(a + k * 0.28), 0.32), 0.025, 0.012, 4)
    fan.finish(sc)
    sf = B('starfish', basalt_material('starfish', '#ff7a3a', 0.6, bump=1.5))
    for (u, v) in ((-4.8, 2.9), (4.8, 2.2), (-3.0, 5.0), (2.8, 5.2), (-4.7, 0.5)):
        x, y, _ = W(u, v)
        z = max(ctx.tz(u, v), -0.05)
        a = rng.uniform(0, 6)
        for k in range(5):
            aa = a + k * 2 * math.pi / 5
            limb(sf, (x, y, z + 0.03), (x + 0.2 * math.cos(aa), y + 0.2 * math.sin(aa), z + 0.02), 0.045, 0.01, 5)
    sf.finish(sc)
    rk = B('rocks', basalt_material('rock_o', '#5a7a82', 0.85, bump=1.6))
    for (u, v, r) in ((-4.6, 1.9, 0.28), (-5.35, 2.4, 0.3), (4.7, 0.6, 0.3), (5.35, 2.9, 0.28), (-3.8, 5.15, 0.2), (3.8, 5.2, 0.24)):
        x, y, _ = W(u, v)
        rk.ico((x, y, max(ctx.tz(u, v), -0.1) + r * 0.2), r, 3, (1.2, 1.0, 0.65), 0.3, rng, rot=rzm(rng.uniform(0, 6)), seedv=u * 2.1, smooth=True)
    rk.finish(sc)
    ctx.motes('#cfefff', 14.0, 48, 0.12, 1.0, 0.018, 0.05, 'bubbles', 2)


FIELDS['ocean'] = dict(
    world=('#3a9ac0', 0.8), sun=('#c4ecff', 3.0, 62), glare=(1.0, 0.12, 0.4), exposure=-0.3, caustic=True,
    ground=lambda: ground_material('terrain', 'sand', '#5a8a90', '#cfe0c4', '#f0f4dc', bump=1.0),
    liquid=None,
    T=dict(off=0.18, amp=0.45, freq=0.6, lo=-0.2, hi=0.4, cap=0.28, wave=0.04, rim=0.0,
           flat=[(-5.0, 4.95, 0.9), (5.0, 4.95, 0.9)], flat_h=0.05),
    slab=('#cfdccb', '#2c4c6c', None), under=('#2a9ad0', 1.0), plinth='#7fa0a6', ledge='#8aa6aa',
    groove=('#38c0d8', 0.5), pillar='#7a9aa2', bowl='#24404c', fire=('#9ff0ff', 5.0), top='orb',
    xq='#7e9ca4', bank=('#8a9a7a', '#dce4bc', 'fine'), build=build_ocean)

# ───────────────────────── chủ đề: Liên Trì (lotus) ─────────────────────────
def lotus_flower(pet, core, x, y, z, s, rng, rings=((10, 0.5, 1.0, 0.17), (8, 0.95, 0.8, 0.13), (6, 1.3, 0.55, 0.1))):
    """Hoa sen nở: nhiều vòng cánh (số cánh, độ ngả, tỉ lệ dài, bán kính) và đài sen ở giữa."""
    for k, (n, tilt, ln, r) in enumerate(rings):
        for i in range(n):
            a = 2 * math.pi * i / n + k * 0.3 + rng.uniform(-0.08, 0.08)
            d = 0.1 * s * (1.0 - 0.12 * k)
            pet.ico((x + d * math.cos(a), y + d * math.sin(a), z + 0.06 * s * (1 + k)), r * s, 2, (1.7 * ln, 0.55, 0.3),
                    rot=rot_xyz(0, -tilt, a), smooth=True)
    core.ico((x, y, z + 0.1 * s), 0.07 * s, 2, (1, 1, 0.8))


def lily_pad(b, x, y, z, r, a):
    b.lathe([(0.0, z), (r * 0.9, z + 0.005), (r, z + 0.03), (r * 0.96, z + 0.045), (r * 0.5, z + 0.012), (0.0, z + 0.008)], 18, (x, y, 0), True,
            cap=False, rot=None)


def koi(b, x, y, z, a, s, rng):
    d = Vector((math.cos(a), math.sin(a), 0))
    b.ico((x, y, z), 0.14 * s, 2, (2.0, 0.7, 0.45), 0.0, rng, rot=rzm(a), smooth=True)
    tail = Vector((x, y, z)) - d * 0.3 * s
    limb(b, tail, tail - d * 0.22 * s + Vector((-d.y, d.x, 0)) * 0.1 * s, 0.03 * s, 0.002, 4)
    limb(b, tail, tail - d * 0.22 * s - Vector((-d.y, d.x, 0)) * 0.1 * s, 0.03 * s, 0.002, 4)
    for sg in (-1, 1):
        p = Vector((x, y, z)) + d * 0.08 * s + Vector((-d.y, d.x, 0)) * 0.08 * s * sg
        limb(b, p, p - d * 0.1 * s + Vector((-d.y, d.x, 0)) * 0.1 * s * sg, 0.02 * s, 0.002, 4)


def build_lotus(ctx):
    sc, rng = ctx.sc, ctx.rng
    # cá chép dưới nước
    kk = [B('koi%d' % i, basalt_material('koi%d' % i, hx, 0.4, bump=0.3)) for i, hx in enumerate(('#ff7a2a', '#f4f0e8', '#d83a2a'))]
    for k, (u, v, a) in enumerate(((-5.1, 1.4, 1.2), (-4.95, 3.0, 4.4), (5.15, 2.0, 2.0), (5.0, 3.6, 5.0), (-2.6, 5.1, 0.3),
                                    (2.2, 5.15, 3.4), (1.2, 5.2, 0.1))):
        x, y, _ = W(u, v)
        koi(kk[k % 3], x, y, -0.34, a, rng.uniform(1.0, 1.3), rng)
    for b in kk:
        b.finish(sc)
    # lá sen
    pad = B('pads', basalt_material('pad', '#3a8a46', 0.45, bump=1.2))
    pad2 = B('pads2', basalt_material('pad2', '#2a6a3a', 0.45, bump=1.2))
    for k, (u, v, r) in enumerate(((-5.2, 0.5, 0.34), (-5.0, 2.2, 0.42), (-5.3, 3.5, 0.36), (5.2, 0.7, 0.4), (5.0, 2.7, 0.34),
                                    (5.3, 3.9, 0.4), (-3.4, 5.1, 0.4), (-2.0, 5.25, 0.34), (-1.2, 5.0, 0.3), (1.5, 5.2, 0.36),
                                    (2.9, 5.0, 0.42), (3.7, 5.3, 0.3), (-4.4, 4.6, 0.28), (4.3, 4.6, 0.3), (-5.35, 1.4, 0.26))):
        x, y, _ = W(u, v)
        lily_pad(pad if k % 2 else pad2, x, y, -0.19, r, 0)
    pad.finish(sc)
    pad2.finish(sc)
    # tòa sen lớn nở ở góc sau trái
    pet = B('petals', gem_material('petal', '#ff9fc0', 0.45, 0.35, 1.0))
    core = B('seedpod', glow_material('seedpod', '#ffd060', 2.5))
    big = B('bigpad', basalt_material('bigpad', '#2f7a3e', 0.45, bump=1.2))
    x, y, _ = W(-4.9, 4.9)
    lily_pad(big, x, y, -0.19, 0.78, 0)
    lotus_flower(pet, core, x, y, -0.1, 2.6, rng, rings=((12, 0.45, 1.0, 0.17), (10, 0.85, 0.9, 0.15), (8, 1.2, 0.75, 0.13), (6, 1.5, 0.55, 0.1)))
    ctx.light(-4.9, 4.9, 0.8, '#ffb0c8', 16.0, 0.2)
    # hoa sen nhỏ rải trên hồ
    for (u, v) in ((-5.15, 1.5), (5.1, 1.5), (-3.2, 5.05), (2.6, 5.15), (5.25, 3.5), (-5.3, 3.9)):
        x, y, _ = W(u, v)
        lotus_flower(pet, core, x, y, -0.15, 1.1, rng)
    # đèn hoa đăng thả nước ở góc sau phải
    lant = B('lanterns', glow_material('lantern', '#ffb050', 5.0))
    lp = B('lantern_petals', basalt_material('lantern_petal', '#f6e2c8', 0.5))
    for (u, v) in ((4.7, 4.95), (5.2, 4.6), (4.45, 4.55), (5.3, 5.2), (4.0, 5.1)):
        x, y, _ = W(u, v)
        lotus_flower(lp, lant, x, y, -0.18, 1.05, rng, rings=((9, 0.7, 1.0, 0.16), (7, 1.1, 0.8, 0.13)))
        ctx.light(u, v, 0.35, '#ffb050', 3.0, 0.1)
    lp.finish(sc)
    lant.finish(sc)
    pet.finish(sc)
    core.finish(sc)
    big.finish(sc)
    # đèn đá chùa ở giữa dải sau, trên bệ đá nhỏ
    st = B('stone_lamp', basalt_material('stone_lamp', '#8a8680', 0.7, bump=1.5))
    fl = B('lamp_fire', glow_material('lamp_fire', '#ffb860', 6.0))
    x, y, _ = W(0.0, 5.0)
    st.lathe([(0.5, -0.3), (0.5, 0.1), (0.46, 0.14)], 8, (x, y, 0), False, cap=True)
    st.lathe([(0.3, 0.14), (0.3, 0.2), (0.16, 0.26), (0.12, 0.5), (0.16, 0.56)], 6, (x, y, 0), False, cap=False)
    st.box((x - 0.2, y - 0.2, 0.56), (x + 0.2, y + 0.2, 0.62), bevel=0.01, seg=1, flat_big=False)
    for dx, dy in ((-0.17, -0.17), (0.17, -0.17), (-0.17, 0.17), (0.17, 0.17)):
        st.box((x + dx - 0.03, y + dy - 0.03, 0.62), (x + dx + 0.03, y + dy + 0.03, 0.88), flat_big=False)
    fl.ico((x, y, 0.75), 0.11, 2, (1, 1, 1.3))
    st.cone((x, y, 0.88), 0.38, 0.06, 0.2, 6)
    st.ico((x, y, 1.1), 0.06, 2)
    st.finish(sc)
    fl.finish(sc)
    ctx.light(0.0, 5.0, 0.9, '#ffb860', 14.0, 0.15)
    # cánh sen rơi
    pt = B('fallen', basalt_material('fallen_petal', '#ffc0d4', 0.4))
    for k in range(34):
        u, v = rng.uniform(-5.4, 5.4), rng.uniform(0.1, 5.4)
        if not ctx.free(u, v, 0.05):
            continue
        x, y, _ = W(u, v)
        pt.ico((x, y, -0.17), 0.06, 1, (1.6, 0.6, 0.12), rot=rzm(rng.uniform(0, 6)), smooth=True)
    pt.finish(sc)


FIELDS['lotus'] = dict(
    world=('#c8d4e4', 0.7), sun=('#fff0dc', 3.0, 60), glare=(1.0, 0.15, 0.4), exposure=0.0,
    ground=lambda: ground_material('terrain', 'mud', '#262a1a', '#4a5a34', '#6a7a48', wet='#08140e', bump=1.0),
    liquid=lambda: water_material('pond', '#4a8a72', '#06161a', alpha=0.8, ripple=0.12, scale=2.0, rough=0.02), liquid_z=-0.18,
    T=dict(off=0.18, amp=0.4, freq=0.55, lo=-0.3, hi=0.3, cap=0.24, depth=-0.65, rim=0.04,
           carve=[('poly', [(-5.45, -0.8), (-5.2, 1.0), (-5.35, 2.5), (-5.2, 4.0), (-4.2, 5.1), (-2.0, 5.2), (0.0, 5.3), (2.0, 5.2),
                            (4.2, 5.1), (5.2, 4.0), (5.35, 2.5), (5.2, 1.0), (5.45, -0.8)], 0.85)],
           flat=[(0.0, 5.0, 0.7)], flat_h=0.1),
    slab=('#f2cfd6', '#6a2a2a', None), under=('#e07a9a', 0.7), plinth='#9a8a86', ledge='#a89488',
    groove=('#e07a9a', 0.4), pillar='#9a8680', bowl='#3a2220', fire=('#ffb050', 5.0), top='orb',
    xq='#a8928c', bank=('#2a3a2a', '#6a8a5a', 'fine'), build=build_lotus)

# ───────────────────────── chủ đề: Lôi Phong (thunder) ─────────────────────────
def bolt(b, p0, p1, rng, n=5, r=0.018, jag=0.12):
    """Tia sét gấp khúc từ p0 tới p1."""
    p0, p1 = Vector(p0), Vector(p1)
    prev = p0
    for i in range(1, n + 1):
        t = i / n
        q = p0.lerp(p1, t)
        if i < n:
            q += Vector((rng.uniform(-jag, jag), rng.uniform(-jag, jag), rng.uniform(-jag, jag) * 0.5))
        limb(b, prev, q, r, r, 4, False)
        prev = q


def build_thunder(ctx):
    sc, rng = ctx.sc, ctx.rng
    # gai đá nhọn
    sp = B('spires', glass_material('spire', '#2a2238'))
    for (u, v, h) in ((-4.7, 0.8, 0.8), (-5.2, 2.0, 1.0), (-4.7, 3.0, 0.7), (-5.1, 3.9, 0.9), (4.7, 0.7, 0.8), (5.2, 1.8, 1.0),
                      (4.7, 2.8, 0.7), (5.15, 3.8, 0.9), (-3.2, 5.2, 0.8), (-2.0, 4.8, 0.55), (2.2, 5.2, 0.8), (3.3, 4.8, 0.6),
                      (1.2, 5.3, 0.5), (-1.2, 5.3, 0.6)):
        x, y, _ = W(u, v)
        zt = max(ctx.tz(u, v), -0.1)
        for k in range(3):
            sp.cone((x + rng.uniform(-0.12, 0.12), y + rng.uniform(-0.12, 0.12), zt - 0.04), rng.uniform(0.09, 0.16), 0.004,
                    h * rng.uniform(0.6, 1.1), 5, rot_xyz(rng.uniform(-0.3, 0.3), rng.uniform(-0.3, 0.3), rng.uniform(0, 6.28)))
    sp.finish(sc)
    # cột đá thu lôi ở góc sau trái, tia sét phát sáng
    px, py, _ = W(-4.9, 4.85)
    pil = B('rod_pillar', basalt_material('rod_pillar', '#5a5070', 0.4, bump=2.0))
    pil.lathe([(0.55, -0.3), (0.5, 0.1), (0.34, 0.2), (0.3, 0.9), (0.2, 1.3)], 6, (px, py, 0), False, cap=False)
    pil.lathe([(0.2, 1.3), (0.0, 1.5)], 6, (px, py, 0), False, cap=False)
    pil.finish(sc)
    gl = B('rod_bolts', glow_material('rod_bolt', '#c4a8ff', 9.0))
    top = Vector((px, py, 1.5))
    gl.ico(tuple(top), 0.08, 2)
    for k in range(6):
        a = k * math.pi / 3 + rng.uniform(-0.2, 0.2)
        bolt(gl, (px + 0.3 * math.cos(a), py + 0.3 * math.sin(a), 0.85), (px + 0.9 * math.cos(a), py + 0.9 * math.sin(a), 0.0), rng, 5, 0.022, 0.1)
    bolt(gl, tuple(top), (px, py, 0.9), rng, 4, 0.02, 0.06)
    gl.finish(sc)
    ctx.light(-4.9, 4.85, 1.2, '#b090ff', 45.0, 0.2)
    # chuông đồng treo trên khung đá ở góc sau phải
    bx, by, _ = W(4.9, 4.85)
    fr = B('bell_frame', basalt_material('bell_frame', '#6a6080', 0.6, bump=1.6))
    for sgn in (-1, 1):
        fr.box((bx + sgn * 0.52 - 0.08, by - 0.08, -0.25), (bx + sgn * 0.52 + 0.08, by + 0.08, 0.95), bevel=0.02, seg=1, flat_big=False)
    fr.box((bx - 0.62, by - 0.08, 0.88), (bx + 0.62, by + 0.08, 1.0), bevel=0.02, seg=1, flat_big=False)
    fr.finish(sc)
    bell = B('bell', basalt_material('bell', '#b07a3c', 0.35, bump=1.0))
    bell.lathe([(0.34, 0.2), (0.3, 0.32), (0.22, 0.58), (0.14, 0.78), (0.0, 0.82)], 20, (bx, by, 0), True, cap=False)
    bell.lathe([(0.04, 0.8), (0.04, 0.9)], 6, (bx, by, 0), False, cap=True)
    bell.finish(sc)
    sk = B('bell_sparks', glow_material('bell_spark', '#c8b0ff', 8.0))
    for k in range(10):
        a = rng.uniform(0, 6.28)
        r = rng.uniform(0.3, 0.55)
        sk.ico((bx + r * math.cos(a), by + r * math.sin(a), rng.uniform(0.1, 0.7)), rng.uniform(0.012, 0.025), 1)
    sk.finish(sc)
    ctx.light(4.9, 4.85, 0.9, '#a890ff', 18.0, 0.2)
    # cột kinh lục lăng ở giữa dải sau
    x, y, _ = W(0.0, 5.0)
    kp = B('sutra', basalt_material('sutra', '#8a8098', 0.6, bump=1.4))
    kp.lathe([(0.4, -0.3), (0.4, 0.06), (0.3, 0.12), (0.24, 0.16)], 6, (x, y, 0), False, cap=False)
    kp.lathe([(0.24, 0.16), (0.24, 0.8)], 6, (x, y, 0), False, cap=False)
    kp.lathe([(0.3, 0.8), (0.32, 0.88), (0.24, 0.96), (0.0, 1.14)], 6, (x, y, 0), False, cap=False)
    kp.finish(sc)
    bands = B('sutra_runes', glow_material('rune', '#9a8aff', 3.0))
    for zz in (0.3, 0.46, 0.62):
        bands.lathe([(0.248, zz), (0.248, zz + 0.04)], 6, (x, y, 0), False, cap=False)
    bands.finish(sc)
    ctx.light(0.0, 4.8, 0.7, '#9a8aff', 7.0, 0.15)
    # cụm mây giông cuộn quanh (khối mây nổi trên biển mây)
    cl = B('cloud_puffs', cloud_material('puff', '#ddd2f4', '#6a5a8a'))
    for k in range(34):
        u, v = rng.uniform(-5.45, 5.45), rng.uniform(0.0, 5.45)
        if not ctx.free(u, v, 0.1) or ctx.tz(u, v) > -0.1:
            continue
        x, y, _ = W(u, v)
        r = rng.uniform(0.18, 0.4)
        cl.ico((x, y, -0.2 + r * 0.25), r, 3, (1.3, 1.0, 0.55), 0.35, rng, seedv=k * 2.3, smooth=True)
    cl.finish(sc)
    ctx.motes('#c8b0ff', 28.0, 44, 0.2, 0.9, 0.012, 0.026, 'sparks')


FIELDS['thunder'] = dict(
    world=('#2e2448', 0.55), sun=('#dcd4ff', 2.4, 60), glare=(0.9, 0.3, 0.45), exposure=0.5,
    ground=lambda: ground_material('terrain', 'slate', '#3e3650', '#8a809c', '#a898c8', wet='#1c1630', bump=1.5),
    liquid=lambda: cloud_material('clouds', '#d6caf0', '#5a4a7a'), liquid_z=-0.18,
    T=dict(off=0.28, amp=0.9, freq=0.6, lo=-0.3, hi=0.5, cap=0.32, depth=-0.6, rim=0.1,
           carve=[('poly', [(-5.4, -0.8), (-5.2, 1.0), (-5.35, 2.5), (-5.2, 4.0), (-4.3, 5.1), (-3.2, 5.3)], 0.75),
                  ('poly', [(5.4, -0.8), (5.2, 1.0), (5.35, 2.5), (5.2, 4.0), (4.3, 5.1), (3.2, 5.3)], 0.75),
                  ('ell', -1.0, 5.2, 0.8, 0.45), ('ell', 1.3, 5.25, 0.7, 0.4)],
           flat=[(-4.9, 4.85, 0.9), (4.9, 4.85, 0.9), (0.0, 5.0, 0.6)], flat_h=0.06),
    slab=('#c4bad8', '#2c2640', '#8a5aff'), under=('#8a5aff', 1.4), plinth='#5a526a', ledge='#6a607c',
    groove=('#8a6aff', 0.8), pillar='#625a74', bowl='#1c1828', fire=('#c0a8ff', 7.0), top='orb',
    xq='#6c6486', bank=('#7a6aa0', '#d8d0f0', 'fine'), build=build_thunder)

# ==== HẾT CHỦ ĐỀ ====


# ───────────────────────── chạy ─────────────────────────
def measure(path, w, h):
    im = bpy.data.images.load(path)
    px = np.empty(w * h * 4, dtype=np.float32)
    im.pixels.foreach_get(px)
    bpy.data.images.remove(im)
    px = px.reshape(h, w, 4)
    k = w / 11.0
    reg = px[int(h - 4 * k):h, int(1.5 * k):int(9.5 * k), :3]
    lum = 0.2126 * reg[..., 0] + 0.7152 * reg[..., 1] + 0.0722 * reg[..., 2]
    return round(float(lum.mean()) * 100, 1), round(float((reg.min(axis=2) > 0.97).mean()) * 100, 2)


def render_variant(code, variant):
    t0 = time.time()
    cfg = FIELDS[code]
    globals()['GLARE'] = cfg['glare']
    globals()['CAUSTIC_ON'] = bool(cfg.get('caustic'))
    sc = make_scene()
    rng = random.Random('field2:' + code)
    w, h = (704, 352) if PREVIEW else (1408, 704)
    samples = SAMPLES or (24 if PREVIEW else 96)
    setup_render(sc, w, h, samples)
    sc.view_settings.exposure = cfg.get('exposure', 0.0)
    setup_world(sc, cfg)
    setup_sun(sc, cfg)
    setup_camera(sc)
    comp = setup_compositor(sc)
    if cfg.get('liquid'):
        lv = B('liquid_plane', cfg['liquid']())
        lz = cfg.get('liquid_z', -0.18)
        lv.box((-7, -2, lz - 0.02), (7, 7, lz))
        lv.finish(sc)
    ter, grid = terrain_object(sc, cfg['ground'](), cfg['T'])
    ctx = Ctx(sc, rng, grid, cfg, variant)
    build_floor(ctx)
    build_ledge_and_pillars(ctx)
    cfg['build'](ctx)
    if CHECK_MARKERS:
        markers(sc)
    out_dir = os.path.join(REPO, 'public', 'img', 'kydao', 'fields2')
    os.makedirs(out_dir, exist_ok=True)
    name = '%s-%s' % (code, variant)
    scratch = globals().get('SCRATCH') or os.path.join(REPO, 'docs', 'ky-dai', 'anh')
    if PREVIEW:
        path = os.path.join(scratch, 'prev-%s-%s.png' % (code, variant))
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
    kb = round(os.path.getsize(path) / 1024, 1)
    if not PREVIEW:
        for q in (80, 76):
            if kb <= 255:
                break
            sc.render.image_settings.quality = q
            bpy.data.images['Render Result'].save_render(path, scene=sc)
            kb = round(os.path.getsize(path) / 1024, 1)
    lum, burn = measure(path, w, h)
    if not PREVIEW and variant == 'chess':       # ảnh xem nhanh 704x352 cho điều phối
        jp = os.path.join(REPO, 'docs', 'ky-dai', 'anh', 'v2-%s.jpg' % code)
        im = bpy.data.images.load(path)
        im.scale(704, 352)
        im.file_format = 'JPEG'
        im.filepath_raw = jp
        im.save()
        bpy.data.images.remove(im)
    return {'file': os.path.basename(path), 'samples': samples, 'size': [w, h], 'build_s': round(t1 - t0, 1),
            'render_s': round(t2 - t1, 1), 'kb': kb, 'lum_pct': lum, 'burn_pct': burn}


def main():
    res = {}
    codes = list(FIELDS) if FIELD == 'all' else [FIELD]
    for code in codes:
        for v in (['chess', 'xiangqi'] if VARIANT == 'both' else [VARIANT]):
            res['%s-%s' % (code, v)] = render_variant(code, v)
    return res


result = main()
