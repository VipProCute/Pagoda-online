"""Kỳ Đài · T-161: render atlas đá cờ vây / caro (8 bộ x 2 viên) bằng Blender.

Chạy trong Blender (5.x) đang mở:
    import runpy
    runpy.run_path(r'<repo>/tools/blender/kydao/stones.py',
                   init_globals={'REPO': r'<repo>', 'ONLY': ['cosmos'], 'PREVIEW': False})
Tham số (init_globals):
    REPO     đường dẫn gốc repo (bắt buộc)
    ONLY     danh sách mã bộ đá, None = cả 8 bộ
    PREVIEW  True: ít mẫu (24), ghi xem thử (jpg nền gỗ) vào thư mục tạm, KHÔNG đụng public/
             False (mặc định): 64 mẫu, ghi public/img/kydao/stones/<id>.webp
    SAMPLES  ghi đè số mẫu

Quy ước atlas (xem README.md): 256x128, hai ô 128x128, nền trong suốt.
    Ô trái = đá bên a (tối), ô phải = đá bên b (sáng). Nhìn thẳng từ trên xuống, đường kính 112 px, tâm ô (64, 64).
    Màu đọc từ STONES trong public/js/kydao-skins.js (base thân, accent vân/đốm, glow phát sáng).
    Hoa văn mạnh dồn ra rìa; vùng giữa (đường kính ~60 px) phẳng màu để khắc dấu X/O của caro.
Mỗi viên render 256x256 rồi thu về 128 (siêu lấy mẫu 2x) bằng Pillow của Python hệ thống (`python`), bước đóng gói.
Làm việc trong cảnh riêng 'KyDaiStones', không lưu .blend.
"""
import json, math, os, subprocess, sys, tempfile

TILE, SS = 128, 2
DIAM = 112.0          # đường kính viên đá (px)
HALF_T = 0.19         # nửa độ dày viên đá (đơn vị mô hình; đường kính = 1)
WOOD = (0xdc, 0xb3, 0x5c)
IDS = ['cosmos', 'forest', 'ocean', 'magma', 'glacier', 'lotus', 'thunder', 'sand']


def catalog(REPO):
    js = os.path.join(REPO, 'public', 'js', 'kydao-skins.js').replace('\\', '/')
    out = subprocess.check_output(['node', '-e',
        "const s=require(process.argv[1]);process.stdout.write(JSON.stringify(s.STONES))", js])
    return json.loads(out.decode('utf-8'))


def rgb(hexs, a=1.0):
    if not hexs:
        return (0, 0, 0, a)
    h = hexs.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple((v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4) for v in c) + (a,)


def tint(c, k):
    return tuple(min(1.0, c[i] * k) for i in range(3)) + (1.0,)


def lerp(a, b, t):
    return tuple(a[i] * (1 - t) + b[i] * t for i in range(3)) + (1.0,)


# ───────────────────────── bộ dựng node ─────────────────────────
class G:
    def __init__(self, nt):
        self.nt = nt

    def n(self, typ, **kw):
        nd = self.nt.nodes.new(typ)
        for k, v in kw.items():
            setattr(nd, k, v)
        return nd

    def put(self, sock, v):
        """Gán v (socket hoặc số/màu) vào ô nhập sock."""
        if hasattr(v, 'node'):
            self.nt.links.new(v, sock)
        else:
            sock.default_value = v

    def math(self, op, a, b=None, clamp=False):
        m = self.n('ShaderNodeMath', operation=op, use_clamp=clamp)
        self.put(m.inputs[0], a)
        if b is not None:
            self.put(m.inputs[1], b)
        return m.outputs[0]

    def mapr(self, v, a0, a1, b0=0.0, b1=1.0, smooth=True):
        m = self.n('ShaderNodeMapRange', interpolation_type='SMOOTHSTEP' if smooth else 'LINEAR')
        self.put(m.inputs['Value'], v)
        m.inputs['From Min'].default_value = a0
        m.inputs['From Max'].default_value = a1
        m.inputs['To Min'].default_value = b0
        m.inputs['To Max'].default_value = b1
        return m.outputs[0]

    def ramp(self, fac, stops):
        r = self.n('ShaderNodeValToRGB')
        els = r.color_ramp.elements
        while len(els) < len(stops):
            els.new(0.5)
        for e, (p, c) in zip(els, stops):
            e.position = p
            e.color = c
        self.put(r.inputs[0], fac)
        return r.outputs[0]

    def mix(self, fac, a, b):
        m = self.n('ShaderNodeMix', data_type='RGBA')
        self.put(m.inputs[0], fac)
        self.put(m.inputs[6], a)
        self.put(m.inputs[7], b)
        return m.outputs[2]

    def noise(self, vec, scale, detail=4.0, rough=0.55, dist=0.0):
        t = self.n('ShaderNodeTexNoise', noise_dimensions='3D')
        self.put(t.inputs['Vector'], vec)
        t.inputs['Scale'].default_value = scale
        t.inputs['Detail'].default_value = detail
        t.inputs['Roughness'].default_value = rough
        t.inputs['Distortion'].default_value = dist
        return t.outputs['Fac']

    def voro(self, vec, scale, feature='F1', rnd=1.0):
        t = self.n('ShaderNodeTexVoronoi', voronoi_dimensions='3D', feature=feature)
        self.put(t.inputs['Vector'], vec)
        t.inputs['Scale'].default_value = scale
        t.inputs['Randomness'].default_value = rnd
        return t.outputs['Distance']

    def wave(self, vec, kind, scale, dist, detail=2.0, direction='X'):
        t = self.n('ShaderNodeTexWave', wave_type=kind, bands_direction=direction, rings_direction='Z',
                   wave_profile='SIN')
        self.put(t.inputs['Vector'], vec)
        t.inputs['Scale'].default_value = scale
        t.inputs['Distortion'].default_value = dist
        t.inputs['Detail'].default_value = detail
        return t.outputs['Fac']


def make_material(bpy, sid, side, c):
    """Chất liệu viên đá. c = STONES[sid][side]. Trả về vật liệu."""
    name = 'stone_%s_%s' % (sid, side)
    mat = bpy.data.materials.get(name)
    if mat:
        bpy.data.materials.remove(mat)
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    for nd in list(nt.nodes):
        nt.nodes.remove(nd)
    g = G(nt)
    out = g.n('ShaderNodeOutputMaterial')
    bs = g.n('ShaderNodeBsdfPrincipled')
    nt.links.new(bs.outputs[0], out.inputs[0])
    base, acc, glow = rgb(c['base']), rgb(c['accent']), rgb(c['glow']) if c.get('glow') else None

    co = g.n('ShaderNodeTexCoord').outputs['Object']
    sep = g.n('ShaderNodeSeparateXYZ')
    nt.links.new(co, sep.inputs[0])
    x, y, z = sep.outputs[0], sep.outputs[1], sep.outputs[2]
    flat = g.n('ShaderNodeCombineXYZ')
    nt.links.new(x, flat.inputs[0])
    nt.links.new(y, flat.inputs[1])
    r = g.n('ShaderNodeVectorMath', operation='LENGTH')
    nt.links.new(flat.outputs[0], r.inputs[0])
    r = r.outputs['Value']
    rim = g.mapr(r, 0.26, 0.46)               # 0 ở giữa (phẳng màu), 1 ở rìa: hoa văn dồn ra rìa
    rim2 = g.mapr(r, 0.14, 0.40)              # rìa lỏng hơn, cho đốm nhỏ

    def prin(**kw):
        for k, v in kw.items():
            bs.inputs[k].default_value = v

    prin(**{'Roughness': 0.12, 'IOR': 1.5, 'Coat Weight': 1.0, 'Coat Roughness': 0.03})
    color = base
    emit = None
    estr = 0.0

    # ---------------- bên a (tối) ----------------
    if (sid, side) == ('cosmos', 'a'):
        neb = g.ramp(g.noise(co, 2.2, 8.0, 0.6, 1.2), [(0.38, (0, 0, 0, 1)), (0.7, (1, 1, 1, 1))])
        color = g.mix(g.math('MULTIPLY', neb, g.math('ADD', 0.1, g.math('MULTIPLY', rim, 0.9))), base, tint(acc, 0.5))
        st = g.voro(co, 70, 'F1')
        stars = g.ramp(st, [(0.0, (1, 1, 1, 1)), (0.1, (0, 0, 0, 1))])
        st2 = g.voro(co, 28, 'F1')
        stars2 = g.ramp(st2, [(0.0, (1, 1, 1, 1)), (0.05, (0, 0, 0, 1))])
        sw = g.math('ADD', 0.3, g.math('MULTIPLY', rim2, 0.7))
        emit = g.mix(g.math('MULTIPLY', g.math('ADD', stars, stars2), sw), (0, 0, 0, 1), glow)
        estr = 9.0
        prin(**{'Roughness': 0.04})
    elif (sid, side) == ('forest', 'a'):
        grain = g.wave(co, 'RINGS', 5.0, 8.0, 3.0)
        gr = g.ramp(grain, [(0.45, (0, 0, 0, 1)), (0.8, (1, 1, 1, 1))])
        dots = g.ramp(g.voro(g.n('ShaderNodeTexCoord').outputs['Object'], 38, 'F1'),
                      [(0.0, (1, 1, 1, 1)), (0.17, (0, 0, 0, 1))])
        mask = g.ramp(g.noise(co, 6.0, 3.0), [(0.5, (0, 0, 0, 1)), (0.62, (1, 1, 1, 1))])
        col = g.mix(g.math('MULTIPLY', gr, g.math('MULTIPLY', rim, 0.22)), base, lerp(base, acc, 0.5))
        color = g.mix(g.math('MULTIPLY', g.math('MULTIPLY', dots, mask), g.math('MULTIPLY', rim2, 1.0)), col, acc)
        prin(**{'Roughness': 0.28, 'Coat Weight': 0.7, 'Coat Roughness': 0.1})
    elif (sid, side) == ('ocean', 'a'):
        bands = g.ramp(g.wave(co, 'BANDS', 2.4, 10.0, 3.0, 'Y'), [(0.72, (0, 0, 0, 1)), (0.93, (1, 1, 1, 1))])
        w = g.math('MULTIPLY', bands, g.math('MULTIPLY', rim, 0.8))
        deep = g.mix(g.math('MULTIPLY', rim, 0.45), base, lerp(base, acc, 0.22))
        color = g.mix(w, deep, tint(acc, 0.8))
        emit = g.mix(w, (0, 0, 0, 1), glow)
        estr = 1.0
        prin(**{'Roughness': 0.05, 'Subsurface Weight': 0.4, 'Subsurface Radius': (0.3, 0.8, 1.0)})
        prin(**{'Subsurface Scale': 0.5})
    elif (sid, side) == ('magma', 'a'):
        # nứt: dùng voronoi trên toạ độ đã méo bằng nhiễu
        vv = g.n('ShaderNodeVectorMath', operation='ADD')
        nz = g.n('ShaderNodeTexNoise', noise_dimensions='3D')
        nz.inputs['Scale'].default_value = 4.5
        nz.inputs['Distortion'].default_value = 0.0
        nt.links.new(co, nz.inputs['Vector'])
        sm = g.n('ShaderNodeVectorMath', operation='SCALE')
        sm.inputs['Scale'].default_value = 0.16
        nt.links.new(nz.outputs['Color'], sm.inputs[0])
        nt.links.new(co, vv.inputs[0])
        nt.links.new(sm.outputs[0], vv.inputs[1])
        vor = g.n('ShaderNodeTexVoronoi', voronoi_dimensions='3D', feature='DISTANCE_TO_EDGE')
        vor.inputs['Scale'].default_value = 5.0
        nt.links.new(vv.outputs[0], vor.inputs['Vector'])
        crack = g.ramp(vor.outputs['Distance'], [(0.0, (1, 1, 1, 1)), (0.02, (1, 1, 1, 1)), (0.05, (0, 0, 0, 1))])
        cm = g.math('MULTIPLY', crack, g.mapr(r, 0.3, 0.43))
        color = g.mix(g.math('MULTIPLY', cm, 0.25), base, acc)
        emit = g.mix(cm, (0, 0, 0, 1), glow)
        estr = 3.2
        prin(**{'Roughness': 0.06})
    elif (sid, side) == ('glacier', 'a'):
        vor = g.n('ShaderNodeTexVoronoi', voronoi_dimensions='3D', feature='DISTANCE_TO_EDGE')
        vor.inputs['Scale'].default_value = 4.0
        sm = g.n('ShaderNodeVectorMath', operation='SCALE')
        sm.inputs['Scale'].default_value = 0.22
        nz = g.n('ShaderNodeTexNoise', noise_dimensions='3D')
        nz.inputs['Scale'].default_value = 3.5
        nt.links.new(co, nz.inputs['Vector'])
        nt.links.new(nz.outputs['Color'], sm.inputs[0])
        vv = g.n('ShaderNodeVectorMath', operation='ADD')
        nt.links.new(co, vv.inputs[0])
        nt.links.new(sm.outputs[0], vv.inputs[1])
        nt.links.new(vv.outputs[0], vor.inputs['Vector'])
        crack = g.ramp(vor.outputs['Distance'], [(0.0, (1, 1, 1, 1)), (0.02, (1, 1, 1, 1)), (0.05, (0, 0, 0, 1))])
        cm = g.math('MULTIPLY', crack, g.mapr(r, 0.28, 0.44))
        haze = g.ramp(g.noise(co, 2.5, 5.0), [(0.4, (0, 0, 0, 1)), (0.75, (1, 1, 1, 1))])
        col = g.mix(g.math('MULTIPLY', haze, g.math('MULTIPLY', rim, 0.5)), base, tint(acc, 0.45))
        color = g.mix(g.math('MULTIPLY', cm, 0.85), col, acc)
        emit = g.mix(cm, (0, 0, 0, 1), glow)
        estr = 1.6
        prin(**{'Roughness': 0.03, 'Subsurface Weight': 0.3, 'Subsurface Radius': (0.6, 0.8, 1.0), 'Subsurface Scale': 0.4})
    elif (sid, side) == ('lotus', 'a'):
        spk = g.ramp(g.noise(co, 22.0, 2.0), [(0.42, (0, 0, 0, 1)), (0.7, (1, 1, 1, 1))])
        gl = g.ramp(g.noise(co, 2.0, 3.0), [(0.3, (0, 0, 0, 1)), (0.8, (1, 1, 1, 1))])
        w = g.math('ADD', g.math('MULTIPLY', spk, 0.05), g.math('MULTIPLY', gl, 0.22))
        color = g.mix(g.math('MULTIPLY', w, g.math('ADD', 0.35, rim)), base, acc)
        prin(**{'Roughness': 0.1, 'Coat Weight': 1.0})
    elif (sid, side) == ('thunder', 'a'):
        vor = g.n('ShaderNodeTexVoronoi', voronoi_dimensions='3D', feature='DISTANCE_TO_EDGE')
        vor.inputs['Scale'].default_value = 3.0
        sm = g.n('ShaderNodeVectorMath', operation='SCALE')
        sm.inputs['Scale'].default_value = 0.4
        nz = g.n('ShaderNodeTexNoise', noise_dimensions='3D')
        nz.inputs['Scale'].default_value = 5.0
        nz.inputs['Detail'].default_value = 6.0
        nt.links.new(co, nz.inputs['Vector'])
        nt.links.new(nz.outputs['Color'], sm.inputs[0])
        vv = g.n('ShaderNodeVectorMath', operation='ADD')
        nt.links.new(co, vv.inputs[0])
        nt.links.new(sm.outputs[0], vv.inputs[1])
        nt.links.new(vv.outputs[0], vor.inputs['Vector'])
        bolt = g.ramp(vor.outputs['Distance'], [(0.0, (1, 1, 1, 1)), (0.012, (1, 1, 1, 1)), (0.03, (0, 0, 0, 1))])
        bm = g.math('MULTIPLY', bolt, g.mapr(r, 0.24, 0.4))
        cloud = g.ramp(g.noise(co, 2.6, 6.0), [(0.4, (0, 0, 0, 1)), (0.8, (1, 1, 1, 1))])
        col = g.mix(g.math('MULTIPLY', cloud, g.math('MULTIPLY', rim, 0.35)), base, lerp(base, (0.3, 0.25, 0.75, 1), 0.5))
        color = g.mix(bm, col, acc)
        emit = g.mix(bm, (0, 0, 0, 1), glow)
        estr = 5.0
        prin(**{'Roughness': 0.06})
    elif (sid, side) == ('sand', 'a'):
        gr = g.ramp(g.voro(co, 95, 'F1'), [(0.0, (1, 1, 1, 1)), (0.1, (0, 0, 0, 1))])
        pat = g.ramp(g.noise(co, 3.0, 5.0, 0.6, 0.8), [(0.4, (0, 0, 0, 1)), (0.7, (1, 1, 1, 1))])
        col = g.mix(g.math('MULTIPLY', pat, g.math('MULTIPLY', rim, 0.45)), base, lerp(base, acc, 0.6))
        color = g.mix(g.math('MULTIPLY', gr, g.math('ADD', 0.4, g.math('MULTIPLY', rim2, 0.6))), col, acc)
        prin(**{'Metallic': 0.55, 'Roughness': 0.32, 'Coat Weight': 0.35, 'Coat Roughness': 0.12})
    # ---------------- bên b (sáng) ----------------
    elif (sid, side) == ('cosmos', 'b'):
        neb = g.ramp(g.noise(co, 2.0, 6.0, 0.55, 1.0), [(0.35, (0, 0, 0, 1)), (0.75, (1, 1, 1, 1))])
        color = g.mix(g.math('MULTIPLY', neb, g.math('ADD', 0.12, g.math('MULTIPLY', rim, 0.8))), base, acc)
        sp = g.ramp(g.voro(co, 60, 'F1'), [(0.0, (1, 1, 1, 1)), (0.06, (0, 0, 0, 1))])
        emit = g.mix(g.math('MULTIPLY', sp, rim2), (0, 0, 0, 1), glow)
        estr = 0.8
        prin(**{'Roughness': 0.15, 'Subsurface Weight': 0.35, 'Subsurface Scale': 0.35,
                'Subsurface Radius': (1.0, 0.5, 0.7)})
    elif (sid, side) == ('forest', 'b'):
        grain = g.wave(co, 'BANDS', 9.0, 7.0, 3.0, 'Y')
        gr = g.ramp(grain, [(0.55, (0, 0, 0, 1)), (0.85, (1, 1, 1, 1))])
        patch = g.ramp(g.noise(co, 4.0, 4.0), [(0.45, (0, 0, 0, 1)), (0.7, (1, 1, 1, 1))])
        color = g.mix(g.math('MULTIPLY', g.math('MULTIPLY', gr, g.math('ADD', 0.1, rim)), 0.4),
                      base, lerp(base, acc, 0.75))
        color = g.mix(g.math('MULTIPLY', patch, g.math('MULTIPLY', rim, 0.3)), color, lerp(base, acc, 0.5))
        prin(**{'Roughness': 0.28, 'Coat Weight': 0.6, 'Coat Roughness': 0.1})
    elif (sid, side) == ('ocean', 'b'):
        hue = g.noise(co, 1.6, 4.0, 0.5, 0.8)
        nac = g.ramp(hue, [(0.3, lerp(base, acc, 0.9)), (0.55, (0.98, 0.72, 0.86, 1)), (0.8, (0.62, 0.82, 1.0, 1))])
        color = g.mix(g.math('ADD', 0.12, g.math('MULTIPLY', rim, 0.9)), base, nac)
        prin(**{'Roughness': 0.1, 'Subsurface Weight': 0.3, 'Subsurface Scale': 0.3,
                'Subsurface Radius': (0.8, 0.9, 1.0)})
    elif (sid, side) == ('magma', 'b'):
        swirl = g.ramp(g.noise(co, 2.4, 6.0, 0.55, 1.3), [(0.35, (0, 0, 0, 1)), (0.7, (1, 1, 1, 1))])
        color = g.mix(g.math('MULTIPLY', swirl, g.math('ADD', 0.05, g.math('MULTIPLY', rim, 0.95))),
                      base, acc)
        core = g.math('SUBTRACT', 1.0, g.mapr(r, 0.0, 0.38))
        emit = g.mix(core, (0, 0, 0, 1), glow)
        estr = 0.22
        prin(**{'Roughness': 0.08, 'Subsurface Weight': 0.6, 'Subsurface Scale': 0.3,
                'Subsurface Radius': (1.0, 0.45, 0.2)})
    elif (sid, side) == ('glacier', 'b'):
        vor = g.n('ShaderNodeTexVoronoi', voronoi_dimensions='3D', feature='DISTANCE_TO_EDGE')
        vor.inputs['Scale'].default_value = 3.2
        sm = g.n('ShaderNodeVectorMath', operation='SCALE')
        sm.inputs['Scale'].default_value = 0.2
        nz = g.n('ShaderNodeTexNoise', noise_dimensions='3D')
        nz.inputs['Scale'].default_value = 3.0
        nt.links.new(co, nz.inputs['Vector'])
        nt.links.new(nz.outputs['Color'], sm.inputs[0])
        vv = g.n('ShaderNodeVectorMath', operation='ADD')
        nt.links.new(co, vv.inputs[0])
        nt.links.new(sm.outputs[0], vv.inputs[1])
        nt.links.new(vv.outputs[0], vor.inputs['Vector'])
        crack = g.ramp(vor.outputs['Distance'], [(0.0, (1, 1, 1, 1)), (0.025, (1, 1, 1, 1)), (0.07, (0, 0, 0, 1))])
        cm = g.math('MULTIPLY', crack, g.mapr(r, 0.2, 0.4))
        haze = g.ramp(g.noise(co, 2.4, 5.0), [(0.4, (0, 0, 0, 1)), (0.8, (1, 1, 1, 1))])
        col = g.mix(g.math('MULTIPLY', haze, g.math('MULTIPLY', rim, 0.55)), base, acc)
        color = g.mix(g.math('MULTIPLY', cm, 0.85), col, tint(acc, 0.8))
        prin(**{'Roughness': 0.04, 'Subsurface Weight': 0.35, 'Subsurface Scale': 0.35,
                'Subsurface Radius': (0.7, 0.85, 1.0)})
    elif (sid, side) == ('lotus', 'b'):
        ang = g.math('ARCTAN2', y, x)
        vein = g.math('ABSOLUTE', g.math('SINE', g.math('MULTIPLY', ang, 8.0)))
        vl = g.ramp(g.math('SUBTRACT', 1.0, vein), [(0.0, (1, 1, 1, 1)), (0.1, (0, 0, 0, 1))])
        vn = g.noise(co, 8.0, 2.0)
        vm = g.math('MULTIPLY', g.math('MULTIPLY', vl, g.mapr(r, 0.2, 0.42)), g.math('ADD', 0.6, g.math('MULTIPLY', vn, 0.4)))
        centre = g.math('SUBTRACT', 1.0, g.mapr(r, 0.1, 0.36))
        col = g.mix(g.math('MULTIPLY', centre, 0.35), base, acc)
        color = g.mix(g.math('MULTIPLY', vm, 0.38), col, (0.85, 0.35, 0.5, 1))
        prin(**{'Roughness': 0.22, 'Coat Weight': 0.6, 'Coat Roughness': 0.08, 'Subsurface Weight': 0.35,
                'Subsurface Scale': 0.3, 'Subsurface Radius': (1.0, 0.4, 0.5)})
    elif (sid, side) == ('thunder', 'b'):
        fac = g.ramp(g.wave(co, 'BANDS', 3.0, 14.0, 4.0, 'DIAGONAL'), [(0.6, (0, 0, 0, 1)), (0.95, (1, 1, 1, 1))])
        cl = g.ramp(g.noise(co, 2.2, 6.0, 0.6, 1.1), [(0.4, (0, 0, 0, 1)), (0.8, (1, 1, 1, 1))])
        w = g.math('ADD', g.math('MULTIPLY', fac, 0.35), g.math('MULTIPLY', cl, 0.55))
        color = g.mix(g.math('MULTIPLY', w, g.math('ADD', 0.04, g.math('MULTIPLY', rim, 0.8))), base, acc)
        prin(**{'Roughness': 0.06, 'Subsurface Weight': 0.3, 'Subsurface Scale': 0.3,
                'Subsurface Radius': (0.8, 0.6, 1.0)})
    elif (sid, side) == ('sand', 'b'):
        rip = g.ramp(g.wave(co, 'BANDS', 6.5, 5.0, 3.0, 'Y'), [(0.5, (0, 0, 0, 1)), (0.9, (1, 1, 1, 1))])
        gr = g.ramp(g.noise(co, 60.0, 2.0), [(0.4, (0, 0, 0, 1)), (0.8, (1, 1, 1, 1))])
        col = g.mix(g.math('MULTIPLY', rip, g.math('ADD', 0.08, g.math('MULTIPLY', rim, 0.55))), base, acc)
        color = g.mix(g.math('MULTIPLY', gr, 0.1), col, tint(acc, 0.8))
        prin(**{'Roughness': 0.4, 'Coat Weight': 0.35, 'Coat Roughness': 0.15})
    else:
        color = base

    g.put(bs.inputs['Base Color'], color)
    if emit is not None:
        g.put(bs.inputs['Emission Color'], emit)
        bs.inputs['Emission Strength'].default_value = estr
    return mat


# ───────────────────────── cảnh ─────────────────────────
def build_scene(bpy, samples):
    name = 'KyDaiStones'
    old = bpy.data.scenes.get(name)
    if old is not None:
        for ob in list(old.collection.all_objects):
            bpy.data.objects.remove(ob, do_unlink=True)
        bpy.data.scenes.remove(old)
    for coll in (bpy.data.meshes, bpy.data.lights, bpy.data.cameras):
        for d in list(coll):
            if d.users == 0:
                coll.remove(d)
    sc = bpy.data.scenes.new(name)
    bpy.context.window.scene = sc
    r = sc.render
    r.engine = 'CYCLES'
    r.film_transparent = True
    r.resolution_x = r.resolution_y = TILE * SS
    r.resolution_percentage = 100
    r.image_settings.file_format = 'PNG'
    r.image_settings.color_mode = 'RGBA'
    r.image_settings.color_depth = '8'
    cy = sc.cycles
    cy.samples = samples
    cy.use_denoising = True
    cy.use_adaptive_sampling = True
    cy.max_bounces = 8
    cy.sample_clamp_indirect = 8.0
    cy.film_transparent_glass = False
    try:
        pr = bpy.context.preferences.addons['cycles'].preferences
        pr.compute_device_type = 'OPTIX'
        pr.refresh_devices()
        for d in pr.devices:
            d.use = (d.type == 'OPTIX')
        cy.device = 'GPU'
    except Exception:
        pass
    sc.view_settings.view_transform = 'Standard'
    sc.view_settings.look = 'None'
    w = bpy.data.worlds.get('KyDaiStonesWorld') or bpy.data.worlds.new('KyDaiStonesWorld')
    w.use_nodes = True
    bg = w.node_tree.nodes.get('Background')
    bg.inputs[0].default_value = (0.72, 0.76, 0.86, 1)
    bg.inputs[1].default_value = 0.3
    sc.world = w
    return sc


def _area(bpy, sc, name, loc, size, energy, color=(1, 1, 1), shadow=True, spec=0.0):
    from mathutils import Vector
    li = bpy.data.lights.new(name, 'AREA')
    li.shape = 'DISK'
    li.size = size
    li.energy = energy
    li.color = color
    li.use_shadow = shadow
    li.specular_factor = spec
    ob = bpy.data.objects.new(name, li)
    sc.collection.objects.link(ob)
    ob.visible_glossy = spec > 0
    ob.location = loc
    ob.rotation_euler = (Vector((0, 0, 0)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    return ob


def shoot(bpy, sc, mat, side, path):
    import bmesh
    from mathutils import Vector
    for o in list(sc.collection.all_objects):
        bpy.data.objects.remove(o, do_unlink=True)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=128, v_segments=64, radius=0.5)
    for v in bm.verts:
        v.co.z *= HALF_T / 0.5
    me = bpy.data.meshes.new('stone')
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    me.materials.append(mat)
    ob = bpy.data.objects.new('stone', me)
    sc.collection.objects.link(ob)
    # sàn bắt bóng
    gm = bpy.data.meshes.new('shadow')
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=2.0)
    bm.to_mesh(gm)
    bm.free()
    gr = bpy.data.objects.new('shadow', gm)
    sc.collection.objects.link(gr)
    gr.location.z = -HALF_T
    gr.is_shadow_catcher = True
    cam = bpy.data.cameras.new('cam')
    cam.type = 'ORTHO'
    cam.ortho_scale = TILE / DIAM
    cam.clip_start, cam.clip_end = 0.1, 20.0
    co = bpy.data.objects.new('cam', cam)
    sc.collection.objects.link(co)
    co.location = (0, 0, 5)
    sc.camera = co
    dark = side == 'a'
    k = 1.0
    # đèn chính trên-trái (đổ bóng, mặt trời cao để bóng ngắn), đèn lấp nhẹ, điểm sáng bóng nhỏ gắt
    _area(bpy, sc, 'key', (-0.9, 0.9, 3.0), 2.2, 34 * k, (1.0, 0.97, 0.92))
    _area(bpy, sc, 'fill', (1.6, -0.8, 2.2), 2.5, 10 * k, (0.8, 0.88, 1.0), shadow=False)
    _area(bpy, sc, 'glint', (-1.6, 1.6, 2.2), 0.4, 60 * k, (1.0, 1.0, 1.0), shadow=False, spec=1.0)
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)


def render_set(REPO, only, samples, tmp):
    import bpy
    cat = catalog(REPO)
    for sid in IDS:
        if only and sid not in only:
            continue
        sc = build_scene(bpy, samples)
        for side in ('a', 'b'):
            mat = make_material(bpy, sid, side, cat[sid][side])
            shoot(bpy, sc, mat, side, os.path.join(tmp, '%s_%s.png' % (sid, side)))


# ───────────────────────── đóng gói (Pillow, Python hệ thống) ─────────────────────────
def _lum_center(im, cx, cy, rad):
    px = im.load()
    s = n = 0.0
    for yy in range(cy - rad, cy + rad + 1):
        for xx in range(cx - rad, cx + rad + 1):
            if (xx - cx) ** 2 + (yy - cy) ** 2 <= rad * rad:
                r, g, b, a = px[xx, yy]
                if a > 200:
                    s += (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
                    n += 1
    return s / max(n, 1)


def pack(tmp, sid, out_webp, out_jpg=None, quality=88):
    from PIL import Image, ImageDraw
    atlas = Image.new('RGBA', (TILE * 2, TILE), (0, 0, 0, 0))
    for c, side in enumerate(('a', 'b')):
        im = Image.open(os.path.join(tmp, '%s_%s.png' % (sid, side))).convert('RGBA')
        im = im.convert('RGBa').resize((TILE, TILE), Image.LANCZOS).convert('RGBA')
        # làm mờ dần alpha sát mép ô để bóng không bị cắt cụt
        px = im.load()
        for yy in range(TILE):
            for xx in range(TILE):
                d = max(abs(xx - 63.5), abs(yy - 63.5))
                if d > 58:
                    f = max(0.0, 1 - (d - 58) / 5.5)
                    r, g, b, a = px[xx, yy]
                    px[xx, yy] = (r, g, b, int(a * f))
        atlas.paste(im, (c * TILE, 0))
    size = 0
    q = quality
    if out_webp:
        os.makedirs(os.path.dirname(out_webp), exist_ok=True)
        q = quality
        while True:
            atlas.save(out_webp, 'WEBP', quality=q, method=6)
            size = os.path.getsize(out_webp)
            if size <= 38 * 1024 or q <= 50:
                break
            q -= 3
    if out_jpg:
        os.makedirs(os.path.dirname(out_jpg), exist_ok=True)
        bg = Image.new('RGBA', atlas.size, WOOD + (255,))
        bg.alpha_composite(atlas)
        bg.convert('RGB').save(out_jpg, 'JPEG', quality=90)
    la = _lum_center(atlas.crop((0, 0, 128, 128)), 64, 64, 30)
    lb = _lum_center(atlas.crop((128, 0, 256, 128)), 64, 64, 30)
    return {'size': size, 'q': q, 'La': round(la, 3), 'Lb': round(lb, 3)}


def sheet(REPO, out_jpg):
    """Ảnh tổng hợp: 8 bộ x 2 viên trên nền gỗ + hàng thu nhỏ 28 px."""
    from PIL import Image
    cols = IDS
    big = Image.new('RGB', (len(cols) * 128, 2 * 128 + 70), WOOD)
    for i, sid in enumerate(cols):
        p = os.path.join(REPO, 'public', 'img', 'kydao', 'stones', sid + '.webp')
        if not os.path.exists(p):
            continue
        at = Image.open(p).convert('RGBA')
        a, b = at.crop((0, 0, 128, 128)), at.crop((128, 0, 256, 128))
        big.paste(a, (i * 128, 0), a)
        big.paste(b, (i * 128, 128), b)
        for j, t in enumerate((a, b)):
            s = t.crop((8, 8, 120, 120)).resize((28, 28), Image.LANCZOS)
            big.paste(s, (i * 128 + 20 + j * 44, 128 * 2 + 21), s)
    os.makedirs(os.path.dirname(out_jpg), exist_ok=True)
    big.save(out_jpg, 'JPEG', quality=92)


if __name__ == '__main__' and len(sys.argv) > 1 and sys.argv[1] in ('pack', 'sheet'):
    if sys.argv[1] == 'pack':
        _, _, tmp, sid, webp, jpg = (sys.argv + [None] * 6)[:6]
        print(json.dumps(pack(tmp, sid, None if webp == '-' else webp, jpg or None)))
    else:
        sheet(sys.argv[2], sys.argv[3])
        print('ok')
    raise SystemExit(0)

# ───────────────────────── chạy trong Blender ─────────────────────────
if globals().get('REPO'):
    _only = globals().get('ONLY')
    _prev = globals().get('PREVIEW', False)
    _tmp = os.path.join(tempfile.gettempdir(), 'kydao_stones')
    os.makedirs(_tmp, exist_ok=True)
    render_set(REPO, _only, globals().get('SAMPLES') or (24 if _prev else 64), _tmp)
    _res = {}
    _me = globals().get('__file__') or os.path.join(REPO, 'tools', 'blender', 'kydao', 'stones.py')
    for _sid in (_only or IDS):
        _webp = '-' if _prev else os.path.join(REPO, 'public', 'img', 'kydao', 'stones', _sid + '.webp')
        _jpg = os.path.join(_tmp, 'preview-' + _sid + '.jpg')
        _r = subprocess.run(['python', _me, 'pack', _tmp, _sid, _webp, _jpg], capture_output=True, text=True)
        _res[_sid] = (_r.stdout.strip() or _r.stderr.strip())[-160:]
    result = _res
