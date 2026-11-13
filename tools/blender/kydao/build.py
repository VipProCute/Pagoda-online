"""Kỳ Đài · dựng tài nguyên skin sân và skin quân cờ bằng Blender.

Chạy trong Blender (5.x):
    import runpy; runpy.run_path(r'<repo>/tools/blender/kydao/build.py', init_globals={'REPO': r'<repo>'})
hoặc từ dòng lệnh:
    blender -b -P tools/blender/kydao/build.py -- <repo> [id ...]

Đầu vào: danh mục public/js/kydao-skins.js (đọc qua node).
Đầu ra (KHÔNG sửa tay, sửa script rồi chạy lại):
    public/img/kydao/fields/<id>.webp        ảnh nửa sân nhìn từ trên xuống, 1024x512, mép dưới là mép người chơi
    public/img/kydao/thumbs/field-<id>.webp  ảnh xem trước sân
    public/img/kydao/thumbs/pieces-<id>.webp ảnh xem trước bộ quân
    public/models/kydao/fields/<id>.glb      đồ trang trí quanh mép nửa bàn
    public/models/kydao/pieces/<id>.glb      bộ quân: K Q R B N P disc

Quy ước toạ độ trong Blender (Z lên): bàn rộng 8, nửa sân chiếm x∈[-4,4], y∈[0,4]; tâm bàn ở y=0,
mép người chơi ở y=+4. Xuất glTF (Y lên) thành: mép người chơi về -Z.
"""
import bpy, bmesh, json, math, os, random, subprocess, sys
from mathutils import Matrix, Vector

REPO = globals().get('REPO')
ONLY = globals().get('ONLY')          # danh sách id muốn dựng lại, None = tất cả
if REPO is None and '--' in sys.argv:
    rest = sys.argv[sys.argv.index('--') + 1:]
    REPO, ONLY = rest[0], (rest[1:] or None)
if not REPO:
    raise SystemExit('Thiếu đường dẫn repo')

OUT_IMG = os.path.join(REPO, 'public', 'img', 'kydao')
OUT_GLB = os.path.join(REPO, 'public', 'models', 'kydao')
SCENE = 'KyDai'


def catalog():
    js = os.path.join(REPO, 'public', 'js', 'kydao-skins.js').replace('\\', '/')
    out = subprocess.check_output(['node', '-e',
        "const s=require(process.argv[1]);process.stdout.write(JSON.stringify({FIELDS:s.FIELDS,PIECES:s.PIECES}))", js])
    return json.loads(out.decode('utf-8'))


def rgb(hexs, a=1.0):
    h = hexs.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple((v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4) for v in c) + (a,)   # sRGB → tuyến tính


def mix(a, b, t):
    return tuple(a[i] * (1 - t) + b[i] * t for i in range(3)) + (1.0,)


# ───────────────────────── cảnh ─────────────────────────
def scene():
    sc = bpy.data.scenes.get(SCENE) or bpy.data.scenes.new(SCENE)
    bpy.context.window.scene = sc
    for ob in list(sc.collection.all_objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    sc.render.engine = 'BLENDER_EEVEE'
    sc.render.film_transparent = False
    sc.view_settings.view_transform = 'Standard'
    if sc.world is None:
        sc.world = bpy.data.worlds.new('KyDaiWorld')
    sc.world.use_nodes = True
    bg = sc.world.node_tree.nodes.get('Background')
    if bg:
        bg.inputs[0].default_value = (0.75, 0.78, 0.85, 1)
        bg.inputs[1].default_value = 0.9
    return sc


def add_obj(sc, name, data):
    ob = bpy.data.objects.new(name, data)
    sc.collection.objects.link(ob)
    return ob


def camera(sc, loc, look=None, ortho=None, rot=None):
    cam = bpy.data.cameras.new('cam')
    ob = add_obj(sc, 'cam', cam)
    ob.location = loc
    if ortho:
        cam.type = 'ORTHO'
        cam.ortho_scale = ortho
    if rot is not None:
        ob.rotation_euler = rot
    elif look is not None:
        ob.rotation_euler = (Vector(look) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    sc.camera = ob
    return ob


def sun(sc, rot=(0.7, 0.2, 0.6), energy=3.0):
    li = bpy.data.lights.new('sun', 'SUN')
    li.energy = energy
    ob = add_obj(sc, 'sun', li)
    ob.rotation_euler = rot
    return ob


def render(sc, path, w, h, quality=82):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    r = sc.render
    r.resolution_x, r.resolution_y, r.resolution_percentage = w, h, 100
    try:
        r.image_settings.media_type = 'IMAGE'
    except Exception:
        pass
    r.image_settings.file_format = 'WEBP'
    r.image_settings.color_mode = 'RGB'
    r.image_settings.quality = quality
    r.filepath = path
    bpy.ops.render.render(write_still=True)


def export_glb(sc, objs, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    for ob in sc.collection.all_objects:
        ob.select_set(False)
    for ob in objs:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=True,
                              export_yup=True, export_cameras=False, export_lights=False,
                              export_texcoords=False, export_animations=False)


# ───────────────────────── dựng lưới ─────────────────────────
class Builder:
    """Gom mọi khối vào một lưới, mỗi vật liệu một chỉ số."""

    def __init__(self, name):
        self.name, self.bm, self.mats, self.keys = name, bmesh.new(), [], {}

    def mat(self, key, color, emit=None, strength=0.0, rough=0.85, metal=0.0):
        if key in self.keys:
            return self.keys[key]
        m = bpy.data.materials.new(key)
        m.use_nodes = True
        p = m.node_tree.nodes.get('Principled BSDF')
        p.inputs['Base Color'].default_value = color
        p.inputs['Roughness'].default_value = rough
        p.inputs['Metallic'].default_value = metal
        if emit:
            p.inputs['Emission Color'].default_value = emit
            p.inputs['Emission Strength'].default_value = strength
        self.mats.append(m)
        self.keys[key] = len(self.mats) - 1
        return self.keys[key]

    def _paint(self, verts, mi, smooth=False):
        faces = {f for v in verts for f in v.link_faces}
        for f in faces:
            f.material_index = mi
            f.smooth = smooth

    def cone(self, mi, loc, r1, r2, h, seg=6, rot=None, smooth=False):
        m = Matrix.Translation(loc) @ (rot or Matrix.Identity(4)) @ Matrix.Translation((0, 0, h / 2))
        r = bmesh.ops.create_cone(self.bm, cap_ends=True, cap_tris=False, segments=seg,
                                  radius1=r1, radius2=max(r2, 0.0001), depth=h, matrix=m)
        self._paint(r['verts'], mi, smooth)

    def ico(self, mi, loc, r, sub=1, scale=(1, 1, 1), jitter=0.0, rng=None, smooth=False):
        m = Matrix.Translation(loc) @ Matrix.Diagonal((scale[0], scale[1], scale[2], 1))
        res = bmesh.ops.create_icosphere(self.bm, subdivisions=sub, radius=r, matrix=m)
        if jitter and rng:
            for v in res['verts']:
                v.co += Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1))) * jitter * r
        self._paint(res['verts'], mi, smooth)

    def box(self, mi, lo, hi):
        size = [hi[i] - lo[i] for i in range(3)]
        cen = [(hi[i] + lo[i]) / 2 for i in range(3)]
        m = Matrix.Translation(cen) @ Matrix.Diagonal((size[0], size[1], size[2], 1))
        res = bmesh.ops.create_cube(self.bm, size=1.0, matrix=m)
        self._paint(res['verts'], mi)

    def lathe(self, mi, profile, seg=12, twist=0.0, smooth=False, loc=(0, 0, 0)):
        """Tiện tròn: profile = [(bán kính, cao)...] từ đáy lên đỉnh."""
        rings = []
        for k, (r, z) in enumerate(profile):
            a0 = twist * k
            rings.append([self.bm.verts.new((loc[0] + r * math.cos(a0 + 2 * math.pi * i / seg),
                                             loc[1] + r * math.sin(a0 + 2 * math.pi * i / seg), loc[2] + z))
                          for i in range(seg)])
        faces = []
        for k in range(len(rings) - 1):
            a, b = rings[k], rings[k + 1]
            for i in range(seg):
                j = (i + 1) % seg
                faces.append(self.bm.faces.new((a[i], a[j], b[j], b[i])))
        faces.append(self.bm.faces.new(list(reversed(rings[0]))))
        faces.append(self.bm.faces.new(rings[-1]))
        for f in faces:
            f.material_index = mi
            f.smooth = smooth

    def prism(self, mi, pts, y0, y1):
        """Đùn một đa giác trong mặt phẳng XZ theo trục Y (đầu ngựa, tia sét)."""
        a = [self.bm.verts.new((x, y0, z)) for x, z in pts]
        b = [self.bm.verts.new((x, y1, z)) for x, z in pts]
        fs = [self.bm.faces.new(a), self.bm.faces.new(list(reversed(b)))]
        n = len(pts)
        for i in range(n):
            j = (i + 1) % n
            fs.append(self.bm.faces.new((a[j], a[i], b[i], b[j])))
        for f in fs:
            f.material_index = mi

    def finish(self, sc):
        bmesh.ops.recalc_face_normals(self.bm, faces=self.bm.faces[:])
        me = bpy.data.meshes.new(self.name)
        self.bm.to_mesh(me)
        self.bm.free()
        for m in self.mats:
            me.materials.append(m)
        return add_obj(sc, self.name, me)


def tris(ob):
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)


# ───────────────────────── nền nửa sân (ảnh 2D) ─────────────────────────
def ground_material(fid, f):
    """Vật liệu phát sáng thuần (không cần đèn) để ảnh ra đúng màu danh mục."""
    P = f['palette']
    light, dark, line, glow = rgb(P['light']), rgb(P['dark']), rgb(P['line']), rgb(P['glow'])
    m = bpy.data.materials.new('ground_' + fid)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    N = nt.nodes.new
    out, em = N('ShaderNodeOutputMaterial'), N('ShaderNodeEmission')
    tc, mp = N('ShaderNodeTexCoord'), N('ShaderNodeMapping')
    nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])
    nt.links.new(em.outputs[0], out.inputs['Surface'])

    def ramp(stops):
        r = N('ShaderNodeValToRGB')
        el = r.color_ramp.elements
        el[0].position, el[0].color = stops[0]
        el[1].position, el[1].color = stops[-1]
        for pos, col in stops[1:-1]:
            e = el.new(pos)
            e.color = col
        return r

    def noise(scale, detail=4.0, distortion=0.0):
        n = N('ShaderNodeTexNoise')
        n.inputs['Scale'].default_value = scale
        n.inputs['Detail'].default_value = detail
        n.inputs['Distortion'].default_value = distortion
        nt.links.new(mp.outputs[0], n.inputs['Vector'])
        return n

    def voronoi(scale, feature='DISTANCE_TO_EDGE', warp=None):
        v = N('ShaderNodeTexVoronoi')
        v.feature = feature
        v.inputs['Scale'].default_value = scale
        nt.links.new((warp or mp).outputs[0], v.inputs['Vector'])
        return v

    def wave(scale, distortion, kind='BANDS', direction='Y'):
        w = N('ShaderNodeTexWave')
        w.wave_type = kind
        if kind == 'BANDS':
            w.bands_direction = direction
        w.inputs['Scale'].default_value = scale
        w.inputs['Distortion'].default_value = distortion
        w.inputs['Detail'].default_value = 3.0
        w.inputs['Detail Scale'].default_value = 1.6
        nt.links.new(mp.outputs[0], w.inputs['Vector'])
        return w

    def blend(a, b, fac, mode='MIX'):
        x = N('ShaderNodeMix')
        x.data_type = 'RGBA'
        x.blend_type = mode
        if isinstance(fac, float):
            x.inputs[0].default_value = fac
        else:
            nt.links.new(fac, x.inputs[0])
        nt.links.new(a, x.inputs[6])
        nt.links.new(b, x.inputs[7])
        return x.outputs[2]

    fx = f['fx']
    base = ramp([(0.25, mix(dark, light, 0.15)), (0.75, mix(dark, light, 0.75))])
    nt.links.new(noise(1.6, 6.0, 0.4).outputs['Fac'], base.inputs[0])
    col = base.outputs[0]

    if fx == 'ember':        # đá nứt, khe dung nham
        cr = ramp([(0.0, mix(glow, line, 0.6)), (0.018, glow), (0.05, mix(dark, glow, 0.25)), (0.11, mix(dark, light, 0.06)), (1.0, mix(dark, light, 0.3))])
        nt.links.new(voronoi(1.25, 'DISTANCE_TO_EDGE', noise(2.4, 3.0, 0.6)).outputs['Distance'], cr.inputs[0])
        col = blend(col, cr.outputs[0], 0.88)
    elif fx == 'ripple':     # sóng nước chảy ngang
        wr = ramp([(0.0, mix(dark, light, 0.1)), (0.55, mix(dark, light, 0.6)), (0.9, light), (1.0, line)])
        nt.links.new(wave(1.3, 5.0).outputs['Fac'], wr.inputs[0])
        col = blend(col, wr.outputs[0], 0.8)
    elif fx == 'leaf':       # thảm rêu, tán lá
        cr = ramp([(0.0, mix(dark, light, 0.05)), (0.45, mix(dark, light, 0.5)), (1.0, mix(light, line, 0.3))])
        nt.links.new(voronoi(3.2, 'F1').outputs['Distance'], cr.inputs[0])
        col = blend(col, cr.outputs[0], 0.6)
    elif fx == 'snow':       # băng rạn
        cr = ramp([(0.0, line), (0.03, mix(light, glow, 0.5)), (0.12, mix(dark, light, 0.55)), (1.0, mix(dark, light, 0.9))])
        nt.links.new(voronoi(1.1).outputs['Distance'], cr.inputs[0])
        col = blend(col, cr.outputs[0], 0.8)
    elif fx == 'bubble':     # vệt nắng đáy biển
        cr = ramp([(0.0, mix(glow, line, 0.5)), (0.06, mix(dark, light, 0.8)), (0.3, mix(dark, light, 0.3)), (1.0, dark)])
        nt.links.new(voronoi(1.9, 'DISTANCE_TO_EDGE', noise(1.2, 2.0, 1.5)).outputs['Distance'], cr.inputs[0])
        col = blend(col, cr.outputs[0], 0.85)
    elif fx == 'petal':      # mặt hồ sen, vòng gợn
        wr = ramp([(0.0, mix(dark, light, 0.35)), (0.7, light), (1.0, line)])
        nt.links.new(wave(1.1, 1.5, 'RINGS').outputs['Fac'], wr.inputs[0])
        col = blend(col, wr.outputs[0], 0.7)
    elif fx == 'spark':      # mây giông, vệt sét
        cr = ramp([(0.0, line), (0.012, glow), (0.03, mix(dark, light, 0.2)), (1.0, mix(dark, light, 0.5))])
        nt.links.new(voronoi(0.9, 'DISTANCE_TO_EDGE', noise(0.9, 3.0, 2.0)).outputs['Distance'], cr.inputs[0])
        col = blend(col, cr.outputs[0], 0.8)
    elif fx == 'sand':       # cồn cát gợn
        wr = ramp([(0.0, mix(dark, light, 0.25)), (0.6, mix(dark, light, 0.85)), (1.0, line)])
        nt.links.new(wave(2.2, 3.5).outputs['Fac'], wr.inputs[0])
        col = blend(col, wr.outputs[0], 0.75)

    grain = ramp([(0.3, (0.62, 0.62, 0.62, 1)), (0.7, (1, 1, 1, 1))])           # hạt mịn cho đỡ phẳng
    nt.links.new(noise(9.0, 8.0, 0.2).outputs['Fac'], grain.inputs[0])
    col = blend(col, grain.outputs[0], 0.55, 'MULTIPLY')
    nt.links.new(col, em.inputs['Color'])
    return m


def build_ground(sc, fid, f):
    me = bpy.data.meshes.new('ground_' + fid)
    bm = bmesh.new()
    vs = [bm.verts.new(p) for p in ((-4, 0, 0), (4, 0, 0), (4, 4, 0), (-4, 4, 0))]
    bm.faces.new(vs)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(ground_material(fid, f))
    return add_obj(sc, 'ground_' + fid, me)


# ───────────────────────── đồ trang trí quanh nửa sân (3D) ─────────────────────────
def band(rng, margin=0.0):
    """Một điểm trên dải chữ U quanh nửa sân (trái, phải, sau lưng người chơi)."""
    k = rng.random()
    d = 0.32 + margin + rng.random() * (0.85 - margin)
    if k < 0.3:
        return (-4 - d, rng.uniform(0.3, 4.6))
    if k < 0.6:
        return (4 + d, rng.uniform(0.3, 4.6))
    return (rng.uniform(-4.9, 4.9), 4 + d)


def rz(a):
    return Matrix.Rotation(a, 4, 'Z')


def tilt(rng, amt=0.25):
    return Matrix.Rotation(rng.uniform(-amt, amt), 4, 'X') @ Matrix.Rotation(rng.uniform(-amt, amt), 4, 'Y')


def build_field(sc, fid, f):
    rng = random.Random('field:' + fid)
    P = f['palette']
    light, dark, line, glow, rim = rgb(P['light']), rgb(P['dark']), rgb(P['line']), rgb(P['glow']), rgb(P['rim'])
    b = Builder('field_' + fid)
    m_rim = b.mat(fid + '_rim', rim, rough=0.9)
    # bệ chữ U quanh nửa sân
    b.box(m_rim, (-5.3, 0, -0.35), (-4, 5.3, 0))
    b.box(m_rim, (4, 0, -0.35), (5.3, 5.3, 0))
    b.box(m_rim, (-4, 4, -0.35), (4, 5.3, 0))
    fx = f['fx']

    def rocks(n, mi, lo=0.1, hi=0.24):
        for _ in range(n):
            x, y = band(rng)
            r = rng.uniform(lo, hi)
            b.ico(mi, (x, y, r * 0.5), r, 1, (1, rng.uniform(0.7, 1.2), rng.uniform(0.6, 1.1)), 0.18, rng)

    if fx == 'ember':
        m_rock = b.mat(fid + '_rock', mix(rim, dark, 0.6))
        m_lava = b.mat(fid + '_lava', glow, glow, 4.0, 0.4)
        for sx in (-1, 1):                                    # hai ngọn núi lửa ở hai góc sau
            c = (sx * 4.65, 4.65, 0)
            b.cone(m_rock, c, 0.62, 0.22, 1.05 + 0.2 * sx, 8)
            b.cone(m_lava, (c[0], c[1], 1.0 + 0.2 * sx), 0.2, 0.16, 0.08, 8)
            b.cone(m_lava, (c[0] - sx * 0.3, c[1] - 0.3, 0.02), 0.09, 0.03, 0.75, 4,
                   Matrix.Rotation(0.5, 4, 'X') @ Matrix.Rotation(sx * 0.5, 4, 'Y'))
        rocks(16, m_rock)
        for _ in range(7):
            x, y = band(rng, 0.1)
            b.cone(m_lava, (x, y, 0.0), rng.uniform(0.1, 0.2), rng.uniform(0.08, 0.16), 0.025, 7)
    elif fx == 'ripple':
        m_stone = b.mat(fid + '_stone', mix(rim, light, 0.35))
        m_reed = b.mat(fid + '_reed', (0.16, 0.42, 0.2, 1))
        m_water = b.mat(fid + '_water', glow, glow, 1.2, 0.15)
        m_wood = b.mat(fid + '_wood', (0.32, 0.18, 0.09, 1))
        rocks(12, m_stone, 0.1, 0.22)
        for _ in range(10):
            x, y = band(rng)
            for k in range(3):
                b.cone(m_reed, (x + rng.uniform(-0.08, 0.08), y + rng.uniform(-0.08, 0.08), 0), 0.025, 0.004,
                       rng.uniform(0.4, 0.75), 4, tilt(rng, 0.15))
        for _ in range(6):
            x, y = band(rng, 0.15)
            b.cone(m_water, (x, y, 0.0), rng.uniform(0.14, 0.24), rng.uniform(0.12, 0.2), 0.02, 9)
        for sx in (-1, 1):                                    # cọc thuyền và mái chèo
            b.cone(m_wood, (sx * 4.7, 2.2, 0), 0.05, 0.045, 0.8, 6)
            b.box(m_wood, (sx * 4.7 - 0.28, 1.2, 0.02), (sx * 4.7 + 0.28, 2.0, 0.14))
    elif fx == 'leaf':
        m_trunk = b.mat(fid + '_trunk', (0.24, 0.14, 0.07, 1))
        m_leaf = b.mat(fid + '_leaf', mix(dark, light, 0.25))
        m_leaf2 = b.mat(fid + '_leaf2', mix(dark, light, 0.7))
        m_cap = b.mat(fid + '_cap', (0.75, 0.16, 0.12, 1))
        for _ in range(13):
            x, y = band(rng, 0.1)
            hgt = rng.uniform(0.7, 1.25)
            b.cone(m_trunk, (x, y, 0), 0.055, 0.04, hgt * 0.4, 5)
            b.cone(m_leaf, (x, y, hgt * 0.28), 0.3, 0.02, hgt * 0.5, 6)
            b.cone(m_leaf2, (x, y, hgt * 0.55), 0.21, 0.0, hgt * 0.45, 6)
        for _ in range(7):
            x, y = band(rng)
            b.ico(m_leaf2, (x, y, 0.1), rng.uniform(0.12, 0.2), 1, (1, 1, 0.7), 0.15, rng)
        for _ in range(6):
            x, y = band(rng)
            b.cone(b.mat(fid + '_stem', (0.9, 0.86, 0.72, 1)), (x, y, 0), 0.02, 0.018, 0.1, 5)
            b.cone(m_cap, (x, y, 0.1), 0.07, 0.01, 0.06, 6)
    elif fx == 'snow':
        m_ice = b.mat(fid + '_ice', mix(dark, light, 0.6), glow, 0.6, 0.1)
        m_snow = b.mat(fid + '_snow', (0.95, 0.97, 1.0, 1), rough=0.95)
        for _ in range(8):                                    # cụm tinh thể băng
            x, y = band(rng, 0.12)
            for k in range(3):
                b.cone(m_ice, (x + rng.uniform(-0.12, 0.12), y + rng.uniform(-0.12, 0.12), 0),
                       rng.uniform(0.06, 0.12), 0.0, rng.uniform(0.45, 1.2), 5, tilt(rng, 0.3))
        for _ in range(9):
            x, y = band(rng)
            b.ico(m_snow, (x, y, 0.03), rng.uniform(0.16, 0.3), 1, (1, 1, 0.4))
        for sx in (-1, 1):
            b.cone(m_snow, (sx * 4.65, 4.65, 0), 0.6, 0.0, 1.3, 6)
            b.cone(m_ice, (sx * 4.65, 4.65, 0.0), 0.63, 0.3, 0.7, 6)
    elif fx == 'bubble':
        m_coral = b.mat(fid + '_coral', (1.0, 0.36, 0.3, 1))
        m_coral2 = b.mat(fid + '_coral2', (0.98, 0.72, 0.25, 1))
        m_weed = b.mat(fid + '_weed', (0.08, 0.5, 0.36, 1))
        m_bub = b.mat(fid + '_bubble', line, glow, 1.5, 0.1)
        m_rock = b.mat(fid + '_rock', mix(rim, dark, 0.7))
        for _ in range(9):
            x, y = band(rng, 0.1)
            mi = m_coral if rng.random() < 0.6 else m_coral2
            for k in range(4):
                b.cone(mi, (x + rng.uniform(-0.1, 0.1), y + rng.uniform(-0.1, 0.1), 0), 0.045, 0.025,
                       rng.uniform(0.25, 0.6), 5, tilt(rng, 0.45))
        for _ in range(8):
            x, y = band(rng)
            b.cone(m_weed, (x, y, 0), 0.05, 0.0, rng.uniform(0.6, 1.1), 4, tilt(rng, 0.2))
        rocks(7, m_rock)
        for _ in range(12):
            x, y = band(rng)
            b.ico(m_bub, (x, y, rng.uniform(0.3, 1.3)), rng.uniform(0.03, 0.07), 1)
    elif fx == 'petal':
        m_pad = b.mat(fid + '_pad', (0.2, 0.5, 0.26, 1))
        m_pet = b.mat(fid + '_petal', mix(light, dark, 0.25))
        m_gold = b.mat(fid + '_gold', glow, glow, 1.5, 0.3, 0.6)
        m_stone = b.mat(fid + '_stone', (0.62, 0.6, 0.56, 1))
        for _ in range(8):                                    # hoa sen: lá, 8 cánh, nhụy vàng
            x, y = band(rng, 0.15)
            s = rng.uniform(0.75, 1.15)
            b.cone(m_pad, (x, y, 0), 0.3 * s, 0.28 * s, 0.02, 10)
            for k in range(8):
                a = 2 * math.pi * k / 8
                b.cone(m_pet, (x + 0.07 * s * math.cos(a), y + 0.07 * s * math.sin(a), 0.03), 0.065 * s, 0.0, 0.3 * s, 4,
                       rz(a) @ Matrix.Rotation(0.65, 4, 'Y'))
            b.ico(m_gold, (x, y, 0.1 * s), 0.055 * s, 1)
        for _ in range(7):
            x, y = band(rng)
            b.cone(m_pad, (x, y, 0), rng.uniform(0.12, 0.22), rng.uniform(0.1, 0.2), 0.015, 9)
        for sx in (-1, 1):                                    # đèn đá
            c = (sx * 4.7, 4.7)
            b.box(m_stone, (c[0] - 0.14, c[1] - 0.14, 0), (c[0] + 0.14, c[1] + 0.14, 0.12))
            b.cone(m_stone, (c[0], c[1], 0.12), 0.06, 0.06, 0.4, 6)
            b.box(m_gold, (c[0] - 0.1, c[1] - 0.1, 0.52), (c[0] + 0.1, c[1] + 0.1, 0.72))
            b.cone(m_stone, (c[0], c[1], 0.72), 0.24, 0.02, 0.18, 4, rz(math.pi / 4))
    elif fx == 'spark':
        m_cloud = b.mat(fid + '_cloud', mix(dark, light, 0.35))
        m_bolt = b.mat(fid + '_bolt', glow, glow, 6.0, 0.2)
        m_rock = b.mat(fid + '_rock', mix(rim, dark, 0.6))
        for _ in range(7):
            x, y = band(rng, 0.15)
            z = rng.uniform(0.9, 1.4)
            for k in range(4):
                b.ico(m_cloud, (x + rng.uniform(-0.22, 0.22), y + rng.uniform(-0.15, 0.15), z + rng.uniform(-0.05, 0.08)),
                      rng.uniform(0.14, 0.24), 1, (1.2, 1, 0.7))
            if rng.random() < 0.75:                           # tia sét gấp khúc
                pts, px, pz = [], 0.0, z - 0.1
                left, right = [], []
                while pz > 0.02:
                    left.append((px - 0.035, pz))
                    right.append((px + 0.035, pz))
                    pz -= rng.uniform(0.18, 0.3)
                    px += rng.uniform(-0.14, 0.14)
                pts = left + [(px, 0.0)] + list(reversed(right))
                bx, by = x, y
                b.prism(m_bolt, [(bx + p[0], p[1]) for p in pts], by - 0.02, by + 0.02)
        for _ in range(8):
            x, y = band(rng)
            b.cone(m_rock, (x, y, 0), rng.uniform(0.08, 0.16), 0.03, rng.uniform(0.35, 0.9), 5, tilt(rng, 0.12))
    elif fx == 'sand':
        m_sand = b.mat(fid + '_sand', mix(dark, light, 0.8))
        m_cactus = b.mat(fid + '_cactus', (0.2, 0.46, 0.24, 1))
        m_stone = b.mat(fid + '_stone', mix(dark, rim, 0.3))
        for _ in range(9):
            x, y = band(rng, 0.1)
            b.ico(m_sand, (x, y, 0.0), rng.uniform(0.28, 0.45), 1, (1.3, 0.9, 0.35))
        for _ in range(7):
            x, y = band(rng, 0.12)
            hgt = rng.uniform(0.45, 0.85)
            b.cone(m_cactus, (x, y, 0), 0.07, 0.06, hgt, 6)
            for sx in (-1, 1):
                if rng.random() < 0.7:
                    az = hgt * rng.uniform(0.35, 0.6)
                    b.box(m_cactus, (min(x, x + sx * 0.17), y - 0.035, az), (max(x, x + sx * 0.17), y + 0.035, az + 0.07))
                    b.cone(m_cactus, (x + sx * 0.15, y, az), 0.04, 0.035, hgt * 0.3, 5)
        for sx in (-1, 1):                                    # tháp đá bậc
            for k in range(4):
                s = 0.5 - k * 0.11
                b.box(m_stone, (sx * 4.65 - s, 4.65 - s, k * 0.2), (sx * 4.65 + s, 4.65 + s, (k + 1) * 0.2))
        rocks(5, m_stone)
    return b.finish(sc)


# ───────────────────────── bộ quân ─────────────────────────
STYLE = {   # seg = số cạnh tiện (ít = góc cạnh), twist = xoắn, orn = kiểu trang trí ở cổ quân
    'magma':     dict(seg=7,  twist=0.0,  smooth=False, orn='rock',  n=5),
    'jade':      dict(seg=16, twist=0.0,  smooth=True,  orn='ring',  n=0),
    'wood':      dict(seg=8,  twist=0.0,  smooth=False, orn='leaf',  n=3),
    'ice':       dict(seg=6,  twist=0.0,  smooth=False, orn='spike', n=4),
    'coral':     dict(seg=10, twist=0.0,  smooth=True,  orn='branch', n=4),
    'bronze':    dict(seg=14, twist=0.0,  smooth=True,  orn='band',  n=0),
    'storm':     dict(seg=5,  twist=0.16, smooth=False, orn='bolt',  n=3),
    'sandstone': dict(seg=4,  twist=0.0,  smooth=False, orn='step',  n=0),
}

# Thân chung: (bán kính, cao) theo tỉ lệ; h = chiều cao tới cổ.
def body(h, base=0.36, neck=0.13):
    return [(base, 0.0), (base, 0.05), (base * 0.86, 0.1), (base * 0.9, 0.15), (base * 0.6, 0.22),
            (neck * 1.25, h * 0.55), (neck, h * 0.85), (neck * 1.7, h * 0.9), (neck * 1.75, h * 0.96), (neck * 0.9, h)]


def ornament(b, st, m_acc, h, rng):
    """Trang trí theo chủ đề ở cổ quân (cao h*0.9), nhỏ để không che dáng nhận diện."""
    z, r, n, orn = h * 0.9, 0.2, st['n'], st['orn']
    for k in range(n):
        a = 2 * math.pi * k / n + 0.3
        p = (r * math.cos(a), r * math.sin(a), z)
        out = rz(a) @ Matrix.Rotation(1.0, 4, 'Y')
        if orn == 'rock':
            b.ico(m_acc, (p[0] * 1.6, p[1] * 1.6, 0.09), 0.085, 1, (1, 1, 0.9), 0.25, rng)
        elif orn == 'leaf':
            b.cone(m_acc, p, 0.05, 0.0, 0.16, 4, out)
        elif orn == 'spike':
            b.cone(m_acc, p, 0.035, 0.0, 0.2, 4, rz(a) @ Matrix.Rotation(0.55, 4, 'Y'))
        elif orn == 'branch':
            b.cone(m_acc, p, 0.022, 0.012, 0.13, 4, rz(a) @ Matrix.Rotation(0.8, 4, 'Y'))
            b.ico(m_acc, (p[0] * 1.55, p[1] * 1.55, z + 0.08), 0.03, 1)
        elif orn == 'bolt':
            b.cone(m_acc, p, 0.03, 0.0, 0.18, 3, rz(a) @ Matrix.Rotation(1.25, 4, 'Y'))
    if orn in ('ring', 'band'):
        b.lathe(m_acc, [(0.345, 0.165), (0.36, 0.185), (0.345, 0.205)], st['seg'], 0, True)
    if orn == 'band':
        b.lathe(m_acc, [(0.25, z - 0.02), (0.26, z), (0.25, z + 0.02)], st['seg'], 0, True)
    if orn == 'step':
        b.box(m_acc, (-0.38, -0.38, 0.0), (0.38, 0.38, 0.045))


def piece(sc, sid, kind, mats):
    st = STYLE[sid]
    rng = random.Random('piece:%s:%s' % (sid, kind))
    b = Builder(kind)
    b.mats, b.keys = list(mats), {'body': 0, 'accent': 1}
    BODY, ACC = 0, 1
    seg, tw, sm = st['seg'], st['twist'], st['smooth']
    H = {'P': 0.5, 'R': 0.62, 'N': 0.42, 'B': 0.74, 'Q': 0.92, 'K': 1.0}

    if kind == 'disc':        # quân cờ tướng / cờ úp: đĩa có viền nổi, mặt trên phẳng để mã khắc chữ
        b.lathe(BODY, [(0.4, 0.0), (0.44, 0.03), (0.44, 0.13), (0.4, 0.16), (0.33, 0.16)], max(seg * 2, 12), 0, sm)
        b.lathe(ACC, [(0.33, 0.158), (0.33, 0.175), (0.4, 0.175), (0.42, 0.16), (0.0, 0.158)][:4], max(seg * 2, 12), 0, sm)
        if st['orn'] in ('rock', 'spike', 'bolt', 'leaf', 'branch'):
            for k in range(8):
                a = 2 * math.pi * k / 8
                b.cone(ACC, (0.44 * math.cos(a), 0.44 * math.sin(a), 0.08), 0.03, 0.0, 0.07, 4, rz(a) @ Matrix.Rotation(1.57, 4, 'Y'))
        return b.finish(sc)

    h = H[kind]
    b.lathe(BODY, body(h), seg, tw, sm)
    ornament(b, st, ACC, h, rng)
    if kind == 'P':
        b.ico(BODY, (0, 0, h + 0.13), 0.17, 2 if sm else 1, smooth=sm)
    elif kind == 'R':
        b.lathe(BODY, [(0.2, h - 0.02), (0.27, h + 0.04), (0.27, h + 0.2), (0.19, h + 0.2), (0.19, h + 0.12)], seg, tw, sm)
        for k in range(4):
            a = math.pi / 4 + k * math.pi / 2
            b.box(ACC, (0.23 * math.cos(a) - 0.06, 0.23 * math.sin(a) - 0.06, h + 0.2), (0.23 * math.cos(a) + 0.06, 0.23 * math.sin(a) + 0.06, h + 0.3))
    elif kind == 'B':
        b.lathe(BODY, [(0.12, h - 0.02), (0.2, h + 0.1), (0.17, h + 0.24), (0.07, h + 0.36), (0.0, h + 0.4)][:4] + [(0.02, h + 0.4)], seg, tw, sm)
        b.ico(ACC, (0, 0, h + 0.45), 0.06, 1)
    elif kind == 'Q':
        b.lathe(BODY, [(0.12, h - 0.02), (0.18, h + 0.08), (0.27, h + 0.22), (0.2, h + 0.24), (0.1, h + 0.3)], seg, tw, sm)
        for k in range(8):
            a = 2 * math.pi * k / 8
            b.cone(ACC, (0.25 * math.cos(a), 0.25 * math.sin(a), h + 0.2), 0.045, 0.0, 0.15, 4)
        b.ico(ACC, (0, 0, h + 0.36), 0.085, 1)
    elif kind == 'K':
        b.lathe(BODY, [(0.12, h - 0.02), (0.2, h + 0.1), (0.25, h + 0.24), (0.16, h + 0.28), (0.08, h + 0.3)], seg, tw, sm)
        b.box(ACC, (-0.045, -0.045, h + 0.28), (0.045, 0.045, h + 0.58))
        b.box(ACC, (-0.14, -0.045, h + 0.4), (0.14, 0.045, h + 0.48))
    elif kind == 'N':         # đầu ngựa: đùn hình cắt bóng, có bờm
        z0 = h - 0.02
        head = [(-0.2, 0.0), (0.2, 0.0), (0.22, 0.16), (0.12, 0.3), (0.3, 0.36), (0.34, 0.5), (0.2, 0.52), (0.14, 0.62),
                (0.02, 0.7), (-0.02, 0.8), (-0.1, 0.68), (-0.2, 0.52), (-0.24, 0.3)]
        b.prism(BODY, [(x, z0 + z) for x, z in head], -0.11, 0.11)
        mane = [(-0.24, 0.3), (-0.2, 0.52), (-0.1, 0.68), (-0.02, 0.8), (-0.12, 0.78), (-0.24, 0.6), (-0.3, 0.36)]
        b.prism(ACC, [(x, z0 + z) for x, z in mane], -0.045, 0.045)
        b.ico(ACC, (0.14, 0.115, z0 + 0.5), 0.03, 1)
        b.ico(ACC, (0.14, -0.115, z0 + 0.5), 0.03, 1)
    return b.finish(sc)


def piece_materials(sid, p, side='a'):
    c = p[side]
    out = []
    for key, col in (('body', c['base']), ('accent', c['accent'])):
        m = bpy.data.materials.new(key)
        m.use_nodes = True
        bs = m.node_tree.nodes.get('Principled BSDF')
        bs.inputs['Base Color'].default_value = rgb(col)
        bs.inputs['Roughness'].default_value = p['rough']
        bs.inputs['Metallic'].default_value = p['metal']
        if key == 'accent' and c.get('glow'):
            bs.inputs['Emission Color'].default_value = rgb(c['glow'])
            bs.inputs['Emission Strength'].default_value = 1.5
        out.append(m)
    return out


# ───────────────────────── chạy ─────────────────────────
def main():
    cat = catalog()
    report = {'fields': {}, 'pieces': {}}
    for fid, f in cat['FIELDS'].items():
        if ONLY and fid not in ONLY:
            continue
        sc = scene()
        g = build_ground(sc, fid, f)
        camera(sc, (0, 2, 10), ortho=8.0, rot=(0, 0, math.pi))          # nhìn thẳng xuống, mép người chơi ở dưới ảnh
        render(sc, os.path.join(OUT_IMG, 'fields', fid + '.webp'), 1024, 512, 80)
        ob = build_field(sc, fid, f)
        sun(sc)
        camera(sc, (0, 14.5, 7.0), look=(0, 3.3, 0.2))
        sc.camera.data.lens = 46
        render(sc, os.path.join(OUT_IMG, 'thumbs', 'field-' + fid + '.webp'), 256, 160, 78)
        path = os.path.join(OUT_GLB, 'fields', fid + '.glb')
        export_glb(sc, [ob], path)
        report['fields'][fid] = {'tris': tris(ob), 'glb_kb': round(os.path.getsize(path) / 1024, 1),
                                 'img_kb': round(os.path.getsize(os.path.join(OUT_IMG, 'fields', fid + '.webp')) / 1024, 1)}
    for sid, p in cat['PIECES'].items():
        if ONLY and sid not in ONLY:
            continue
        sc = scene()
        mats = piece_materials(sid, p, 'a')
        objs = [piece(sc, sid, k, mats) for k in ('K', 'Q', 'R', 'B', 'N', 'P', 'disc')]
        path = os.path.join(OUT_GLB, 'pieces', sid + '.glb')
        export_glb(sc, objs, path)                                       # mọi quân ở gốc toạ độ, mã tự đặt chỗ
        # ảnh xem trước: hàng trước bên a, hàng sau bên b
        mats_b = piece_materials(sid, p, 'b')
        for i, ob in enumerate(objs):
            ob.location = ((i - 3) * 0.95, 0.5, 0)
            dup = ob.copy()
            dup.data = ob.data.copy()
            dup.data.materials.clear()
            for m in mats_b:
                dup.data.materials.append(m)
            dup.location = ((i - 3) * 0.95, -0.7, 0)
            sc.collection.objects.link(dup)
        fl = bpy.data.meshes.new('floor')
        bm = bmesh.new()
        bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=12)
        bm.to_mesh(fl)
        bm.free()
        fm = bpy.data.materials.new('floor')
        fm.use_nodes = True
        fm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.2, 0.17, 0.15, 1)
        fl.materials.append(fm)
        add_obj(sc, 'floor', fl)
        sun(sc, (0.9, 0.1, 2.6), 3.5)
        camera(sc, (0, 8.6, 4.4), look=(0, -0.1, 0.5))
        sc.camera.data.lens = 50
        render(sc, os.path.join(OUT_IMG, 'thumbs', 'pieces-' + sid + '.webp'), 256, 160, 78)
        report['pieces'][sid] = {'tris': sum(tris(o) for o in objs), 'glb_kb': round(os.path.getsize(path) / 1024, 1)}
    return report


result = main()
print(json.dumps(result, indent=1))
