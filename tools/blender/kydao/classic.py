"""Kỳ Đài · T-208: tài nguyên bàn và quân MẶC ĐỊNH dựng từ mô hình, texture CC0 của Poly Haven.

Chạy không giao diện:
    blender -b --factory-startup -P tools/blender/kydao/classic.py -- <repo> [preview]

Nguồn (tải bằng `node tools/blender/kydao/fetch-assets.js classic textures`, không commit):
    assets-src/polyhaven/chess_set/chess_set.gltf           bộ cờ vua cẩm thạch
    assets-src/polyhaven-tex/<id>/<id>_{diff,nor_gl,rough}.jpg   vân gỗ
Đầu ra (KHÔNG sửa tay, sửa script rồi chạy lại):
    public/models/kydao/pieces/classic.glb     nút K Q R B N P disc, vật liệu `body`, không nhúng ảnh
    public/img/kydao/pieces2d/classic.webp     atlas 896x256 theo quy ước pieces2d.py (hàng 0 bên a, hàng 1 bên b)
    public/img/kydao/boards/chess.webp         1024x1024, đúng 8x8 ô, ô trên-trái là ô sáng
    public/img/kydao/boards/xiangqi.webp       1152x1280, chỉ là mặt gỗ (lưới và sông do game vẽ)
    docs/ky-dai/anh/classic-xem-nhanh.jpg      ảnh ghép xem nhanh
Thêm `preview` sau đường dẫn repo: ít mẫu, ghi mọi thứ vào thư mục tạm, không đụng public/.

Toạ độ Blender (Z lên). Quân chuẩn hoá: đáy ở Z=0, tâm ở X=Y=0, Vua cao 1,58, bề ngang tối đa 0,88.
Quân trắng của bộ nguồn nhìn về -Y, xuất glTF thành +Z. Trong atlas, Mã quay mặt sang trái như pieces2d.py.
"""
import bpy, bmesh, json, math, os, random, sys, tempfile
import numpy as np
from mathutils import Matrix, Vector

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
if not ARGS:
    raise SystemExit('Cần truyền đường dẫn repo sau --')
REPO = os.path.abspath(ARGS[0])
PREVIEW = 'preview' in ARGS[1:]
TMP = os.path.join(tempfile.gettempdir(), 'kydao-classic')
os.makedirs(TMP, exist_ok=True)

KINDS = ['K', 'Q', 'R', 'B', 'N', 'P', 'disc']
SOURCE = {'K': 'piece_king_white', 'Q': 'piece_queen_white', 'R': 'piece_rook_white_01', 'B': 'piece_bishop_white_01',
          'N': 'piece_knight_white_01', 'P': 'piece_pawn_white_01'}
TRIS = {'K': 1500, 'Q': 1400, 'R': 1200, 'B': 1300, 'N': 1700, 'P': 900}
KING_H, MAX_W = 1.58, 0.88
DISC_R, DISC_H = 0.44, 0.18
TILE, SS, PPU, DISC_D, BOTTOM_Y = 128, 2, 67.0, 108.0, 118
ELEV = math.radians(22.0)
SEED = 'classic'
ATLAS_ZOOM = 1.15


def out_path(*parts):
    p = os.path.join(TMP, 'out', *parts) if PREVIEW else os.path.join(REPO, *parts)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    return p


def src_tex(tid, kind):
    p = os.path.join(REPO, 'assets-src', 'polyhaven-tex', tid, '%s_%s.jpg' % (tid, kind))
    if not os.path.exists(p):
        raise SystemExit('Thiếu nguồn: chạy node tools/blender/kydao/fetch-assets.js classic textures')
    return p


# ───────────────────────── ảnh: đọc, ghi, đo (numpy, hàng trên cùng trước) ─────────────────────────
def load_px(path):
    im = bpy.data.images.load(path)
    w, h = im.size
    a = np.empty(w * h * 4, dtype=np.float32)
    im.pixels.foreach_get(a)
    bpy.data.images.remove(im)
    return a.reshape(h, w, 4)[::-1].copy()


def save_px(arr, path, fmt, quality, alpha=False):
    h, w = arr.shape[:2]
    if arr.shape[2] == 3:
        arr = np.concatenate([arr, np.ones((h, w, 1), dtype=np.float32)], axis=2)
    im = bpy.data.images.new('kd_out', w, h, alpha=alpha)
    im.pixels.foreach_set(np.clip(arr[::-1], 0, 1).astype(np.float32).ravel())
    sc = bpy.context.scene
    st = sc.render.image_settings
    try:
        st.media_type = 'IMAGE'
    except Exception:
        pass
    st.file_format = fmt
    st.color_mode = 'RGBA' if alpha else 'RGB'
    st.quality = quality
    keep = (sc.view_settings.view_transform, sc.view_settings.look)
    sc.view_settings.view_transform, sc.view_settings.look = 'Standard', 'None'
    im.save_render(path, scene=sc)
    sc.view_settings.view_transform, sc.view_settings.look = keep
    bpy.data.images.remove(im)
    return round(os.path.getsize(path) / 1024, 1)


def save_budget(arr, path, limit_kb, alpha=False, q0=88, qmin=72):
    q = q0
    while True:
        kb = save_px(arr, path, 'WEBP', q, alpha)
        if kb <= limit_kb or q <= qmin:
            return kb
        q -= 4


def hexc(rgb):
    return '#%02x%02x%02x' % tuple(int(round(float(np.clip(v, 0, 1)) * 255)) for v in rgb[:3])


def lum(rgb):
    lin = [v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in rgb[:3]]
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]


def half(arr):
    """Thu nhỏ 2 lần (trung bình 2x2), nhân trước alpha để mép không viền tối."""
    a = arr[..., 3:4]
    pm = np.concatenate([arr[..., :3] * a, a], axis=2)
    h, w = pm.shape[0] // 2, pm.shape[1] // 2
    pm = pm[:h * 2, :w * 2].reshape(h, 2, w, 2, 4).mean(axis=(1, 3))
    al = pm[..., 3:4]
    return np.concatenate([np.where(al > 1e-5, pm[..., :3] / np.maximum(al, 1e-5), 0), al], axis=2)


def resize(arr, w, h):
    """Thu nhỏ theo trung bình vùng (đủ dùng cho ảnh xem nhanh và mảnh vân gỗ)."""
    H, W = arr.shape[:2]
    ys = (np.arange(h + 1) * H / h).astype(int)
    xs = (np.arange(w + 1) * W / w).astype(int)
    out = np.add.reduceat(np.add.reduceat(arr, ys[:-1], axis=0), xs[:-1], axis=1)
    cnt = (np.diff(ys)[:, None] * np.diff(xs)[None, :])[..., None]
    return (out / np.maximum(cnt, 1)).astype(np.float32)


# ───────────────────────── quân: chuẩn hoá lưới nguồn ─────────────────────────
def import_set():
    path = os.path.join(REPO, 'assets-src', 'polyhaven', 'chess_set', 'chess_set.gltf')
    if not os.path.exists(path):
        raise SystemExit('Thiếu nguồn: chạy node tools/blender/kydao/fetch-assets.js classic textures')
    bpy.ops.import_scene.gltf(filepath=path)
    bpy.context.view_layer.update()


def bounds(me):
    co = np.empty(len(me.vertices) * 3, dtype=np.float32)
    me.vertices.foreach_get('co', co)
    co = co.reshape(-1, 3)
    return co.min(axis=0), co.max(axis=0)


def normalized_meshes():
    """Lưới gốc (chưa giảm) của 6 quân, đã đưa về đáy Z=0, tâm XY, Vua cao KING_H."""
    raw = {}
    for kind, name in SOURCE.items():
        ob = bpy.data.objects[name]
        me = ob.data.copy()
        me.transform(ob.matrix_world)
        raw[kind] = me
    lo, hi = bounds(raw['K'])
    scale = KING_H / float(hi[2] - lo[2])
    for kind, me in raw.items():
        lo, hi = bounds(me)
        me.transform(Matrix.Diagonal((scale, scale, scale, 1)) @ Matrix.Translation((-(lo[0] + hi[0]) / 2, -(lo[1] + hi[1]) / 2, -lo[2])))
        lo, hi = bounds(me)
        wide = float(max(hi[0] - lo[0], hi[1] - lo[1]))
        if wide > MAX_W:
            k = MAX_W / wide
            me.transform(Matrix.Diagonal((k, k, k, 1)))
        me.name = 'src_' + kind
    return raw


def disc_mesh():
    """Đĩa gỗ tiện: mặt trên phẳng ở Z=DISC_H, một rãnh tròn nông gần mép, mép bo."""
    prof = [(0.40, 0.0), (DISC_R, 0.03), (DISC_R, 0.15), (0.415, DISC_H), (0.365, DISC_H), (0.355, 0.168), (0.335, 0.168), (0.325, DISC_H)]
    seg = 28
    bm = bmesh.new()
    rings = [[bm.verts.new((r * math.cos(2 * math.pi * i / seg), r * math.sin(2 * math.pi * i / seg), z)) for i in range(seg)] for r, z in prof]
    for a, b in zip(rings, rings[1:]):
        for i in range(seg):
            j = (i + 1) % seg
            bm.faces.new((a[i], a[j], b[j], b[i]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    for f in bm.faces:
        f.smooth = len(f.verts) == 4
    me = bpy.data.meshes.new('src_disc')
    bm.to_mesh(me)
    bm.free()
    return me


def tri_count(me):
    return sum(len(p.vertices) - 2 for p in me.polygons)


def decimated(me, limit, name):
    ob = bpy.data.objects.new('tmp_' + name, me)
    bpy.context.scene.collection.objects.link(ob)
    n = tri_count(me)
    if n > limit:
        mod = ob.modifiers.new('dec', 'DECIMATE')
        mod.ratio = (limit - 20) / n
    dg = bpy.context.evaluated_depsgraph_get()
    out = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    bpy.data.objects.remove(ob, do_unlink=True)
    for p in out.polygons:
        p.use_smooth = True
    out.name = name
    return out


def export_pieces(meshes):
    body = bpy.data.materials.new('body')
    objs, tris = [], {}
    for kind in KINDS:
        me = meshes[kind].copy() if kind == 'disc' else decimated(meshes[kind], TRIS[kind], kind)
        me.name = kind
        me.materials.clear()
        me.materials.append(body)
        for layer in list(me.uv_layers):
            me.uv_layers.remove(layer)
        ob = bpy.data.objects.new(kind, me)
        bpy.context.scene.collection.objects.link(ob)
        objs.append(ob)
        tris[kind] = tri_count(me)
    tris['total'] = sum(tris.values())
    path = out_path('public', 'models', 'kydao', 'pieces', 'classic.glb')
    for ob in bpy.context.scene.collection.all_objects:
        ob.select_set(False)
    for ob in objs:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=True,
                              export_yup=True, export_cameras=False, export_lights=False,
                              export_texcoords=False, export_animations=False)
    kb = round(os.path.getsize(path) / 1024, 1)
    for ob in objs:
        bpy.data.objects.remove(ob, do_unlink=True)
    if tris['total'] > 9000 or kb > 300:
        raise SystemExit('classic.glb vượt ngân sách: %s tam giác, %s KB' % (tris['total'], kb))
    return {'tris': tris, 'kb': kb}


# ───────────────────────── atlas quân 2D (Cycles) ─────────────────────────
def setup_cycles(samples):
    sc = bpy.context.scene
    r = sc.render
    r.engine = 'CYCLES'
    r.film_transparent = True
    r.resolution_x = r.resolution_y = TILE * SS
    r.resolution_percentage = 100
    cy = sc.cycles
    cy.samples = samples
    cy.use_denoising = True
    cy.use_adaptive_sampling = True
    cy.max_bounces = 6
    cy.sample_clamp_indirect = 6.0
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
    w = bpy.data.worlds.new('KyDaiClassicWorld')
    w.use_nodes = True
    bg = w.node_tree.nodes.get('Background')
    bg.inputs[0].default_value = (0.66, 0.7, 0.78, 1)
    bg.inputs[1].default_value = 0.75
    sc.world = w
    return sc


def area(sc, name, loc, target, size, energy, color=(1, 1, 1), shadow=True):
    li = bpy.data.lights.new(name, 'AREA')
    li.shape, li.size, li.energy, li.color, li.use_shadow = 'DISK', size, energy, color, shadow
    ob = bpy.data.objects.new(name, li)
    sc.collection.objects.link(ob)
    ob.location = loc
    ob.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    return ob


def tuned(mat, name, value=1.0, tint=(1, 1, 1)):
    """Bản sao vật liệu nguồn, nhân màu gốc với value*tint (bên tối cần nâng sáng để còn thấy khối)."""
    m = mat.copy()
    m.name = name
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    sock = bsdf.inputs['Base Color']
    mix = nt.nodes.new('ShaderNodeMix')
    mix.data_type, mix.blend_type = 'RGBA', 'MULTIPLY'
    mix.inputs['Factor'].default_value = 1.0
    mix.inputs['B'].default_value = (tint[0] * value, tint[1] * value, tint[2] * value, 1)
    if sock.is_linked:
        nt.links.new(sock.links[0].from_socket, mix.inputs['A'])
    else:
        mix.inputs['A'].default_value = sock.default_value
    nt.links.new(mix.outputs['Result'], sock)
    return m


def wood_material(name, tid, scale, value=1.0, tint=(1, 1, 1), rough=0.42):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    tc = nt.nodes.new('ShaderNodeTexCoord')
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (scale, scale, scale)
    mp.inputs['Location'].default_value = (0.37, 0.21, 0)
    nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = bpy.data.images.load(src_tex(tid, 'diff'))
    nt.links.new(mp.outputs['Vector'], tex.inputs['Vector'])
    mix = nt.nodes.new('ShaderNodeMix')
    mix.data_type, mix.blend_type = 'RGBA', 'MULTIPLY'
    mix.inputs['Factor'].default_value = 1.0
    mix.inputs['B'].default_value = (tint[0] * value, tint[1] * value, tint[2] * value, 1)
    nt.links.new(tex.outputs['Color'], mix.inputs['A'])
    nt.links.new(mix.outputs['Result'], bsdf.inputs['Base Color'])
    nor = nt.nodes.new('ShaderNodeTexImage')
    nor.image = bpy.data.images.load(src_tex(tid, 'nor_gl'))
    nor.image.colorspace_settings.name = 'Non-Color'
    nt.links.new(mp.outputs['Vector'], nor.inputs['Vector'])
    nm = nt.nodes.new('ShaderNodeNormalMap')
    nm.inputs['Strength'].default_value = 0.6
    nt.links.new(nor.outputs['Color'], nm.inputs['Color'])
    nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
    bsdf.inputs['Roughness'].default_value = rough
    return m


def shoot(sc, me, mat, kind, side, path):
    for o in list(sc.collection.all_objects):
        bpy.data.objects.remove(o, do_unlink=True)
    top = kind == 'disc'
    me = me.copy()
    me.materials.clear()
    me.materials.append(mat)
    ob = bpy.data.objects.new('shot', me)
    sc.collection.objects.link(ob)
    if not top:
        ob.scale = (ATLAS_ZOOM, ATLAS_ZOOM, ATLAS_ZOOM)   # quân Staunton mảnh hơn bộ dựng bằng mã: phóng cho đầy ô (chỉ trong atlas 2D)
    if kind == 'N':
        ob.rotation_euler = (0, 0, math.pi / 2)        # nguồn nhìn về -Y; xoay để Mã quay mặt sang trái ảnh (+X)
    bpy.context.view_layer.update()
    cam = bpy.data.cameras.new('cam')
    cam.type = 'ORTHO'
    cam.clip_start, cam.clip_end = 0.1, 60.0
    co = bpy.data.objects.new('cam', cam)
    sc.collection.objects.link(co)
    sc.camera = co
    if top:
        cam.ortho_scale = TILE / (DISC_D / (DISC_R * 2))
        co.location, co.rotation_euler = (0, 0, 8), (0, 0, 0)
        key_t = (0, 0, 0.1)
    else:
        cam.ortho_scale = TILE / PPU
        sy, ce = math.sin(ELEV), math.cos(ELEV)
        mw = ob.matrix_world
        lo = min((mw @ v.co).z * ce - (mw @ v.co).y * sy for v in me.vertices)
        c_up = lo + (TILE / 2 - (TILE - BOTTOM_Y)) / PPU
        target = Vector((0, 0, c_up / ce))
        co.location = target + Vector((0, math.cos(ELEV), math.sin(ELEV))) * 8
        co.rotation_euler = (target - co.location).to_track_quat('-Z', 'Y').to_euler()
        key_t = (0, 0, 0.45)
    # quân trắng cẩm thạch rất dễ cháy sáng nên đèn yếu hơn hẳn bên tối; đĩa gỗ dùng chung một mức cho cả hai bên
    ke, fe, re = (150, 70, 260) if top else (430, 240, 800) if side == 'b' else (120, 50, 190)
    area(sc, 'key', (-1.9, 1.7, 4.6), key_t, 2.6, ke, (1.0, 0.96, 0.9))
    area(sc, 'fill', (3.2, 2.2, 1.6), key_t, 3.0, fe, (0.78, 0.86, 1.0), False)
    area(sc, 'rim', (1.2, -3.2, 3.0), key_t, 1.6, re, (1, 1, 1), False)
    sc.world.node_tree.nodes['Background'].inputs[1].default_value = 0.75 if side == 'b' or top else 0.5
    if not top:
        gm = bpy.data.meshes.new('shadow')
        bm = bmesh.new()
        bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=2.5)
        bm.to_mesh(gm)
        bm.free()
        gr = bpy.data.objects.new('shadow', gm)
        sc.collection.objects.link(gr)
        gr.is_shadow_catcher = True
    st = sc.render.image_settings
    try:
        st.media_type = 'IMAGE'
    except Exception:
        pass
    st.file_format, st.color_mode, st.color_depth = 'PNG', 'RGBA', '8'
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(ob, do_unlink=True)


def haloed(tile, color, strength):
    """Viền tương phản mảnh quanh quân (tối cho quân sáng, sáng cho quân tối) để quân nổi trên cả ô sáng lẫn ô tối."""
    a = tile[..., 3]
    solid = (a > 0.6).astype(np.float32)           # bỏ qua vùng bóng đổ mờ dưới chân
    grow = solid.copy()
    for _ in range(2):
        p = np.pad(grow, 1)
        grow = np.maximum.reduce([p[1:-1, 1:-1], p[:-2, 1:-1], p[2:, 1:-1], p[1:-1, :-2], p[1:-1, 2:],
                                  0.7 * p[:-2, :-2], 0.7 * p[:-2, 2:], 0.7 * p[2:, :-2], 0.7 * p[2:, 2:]])
    ha = np.clip(grow * strength, 0, 1) * (1 - a)   # chỉ thêm ở chỗ quân chưa phủ
    out_a = a + ha
    rgb = (tile[..., :3] * a[..., None] + np.array(color, dtype=np.float32) * ha[..., None]) / np.maximum(out_a, 1e-5)[..., None]
    return np.concatenate([rgb, out_a[..., None]], axis=2).astype(np.float32)


def build_atlas(meshes):
    sc = setup_cycles(24 if PREVIEW else 96)
    white = bpy.data.materials['chess_set_pieces_white']
    black = bpy.data.materials['chess_set_pieces_black']
    mats = {
        'a': {'piece': tuned(white, 'kd_white', 1.0), 'disc': wood_material('kd_disc_a', 'ash_veneer', 0.9, 1.0, (1.0, 0.95, 0.84))},
        'b': {'piece': tuned(black, 'kd_black', 1.35, (1.0, 0.97, 0.94)), 'disc': wood_material('kd_disc_b', 'ash_veneer', 0.9, 0.88, (1.0, 0.9, 0.74))},
    }
    atlas = np.zeros((TILE * 2, TILE * 7, 4), dtype=np.float32)
    for r, side in enumerate(('a', 'b')):
        for c, kind in enumerate(KINDS):
            path = os.path.join(TMP, 'tile_%s_%s.png' % (side, kind))
            shoot(sc, meshes[kind], mats[side]['disc' if kind == 'disc' else 'piece'], kind, side, path)
            tile = load_px(path)
            for _ in range(SS // 2):
                tile = half(tile)
            if kind != 'disc':
                tile = haloed(tile, (0.16, 0.1, 0.06) if side == 'a' else (0.98, 0.92, 0.8), 0.6 if side == 'a' else 0.5)
            atlas[r * TILE:(r + 1) * TILE, c * TILE:(c + 1) * TILE] = tile
    kb = save_budget(atlas, out_path('public', 'img', 'kydao', 'pieces2d', 'classic.webp'), 120, alpha=True)
    if kb > 120:
        raise SystemExit('Atlas quân vượt 120 KB: %s' % kb)
    disc = {}
    for r, side in enumerate(('a', 'b')):
        t = atlas[r * TILE + 40:r * TILE + 88, 6 * TILE + 40:6 * TILE + 88, :3].reshape(-1, 3).mean(axis=0)
        disc[side] = hexc(t)
    return atlas, {'kb': kb, 'disc': disc}


# ───────────────────────── mặt bàn (ghép từ ảnh vân gỗ thật, bằng numpy) ─────────────────────────
def toned(tex, target, gain=1.0):
    """Đưa màu trung bình của ảnh vân về gần `target` (sRGB 0..1) mà vẫn giữ vân; gain > 1 tăng tương phản vân."""
    mean = tex.reshape(-1, 3).mean(axis=0)
    return np.clip((tex - mean) * gain + np.array(target, dtype=np.float32), 0, 1)


def build_chess_board():
    rng = random.Random(SEED + ':chess')
    oak = load_px(src_tex('oak_veneer_01', 'diff'))[..., :3]
    wal = load_px(src_tex('american_walnut_veneer', 'diff'))[..., :3]
    light = toned(oak, (0.86, 0.74, 0.54), 1.15)
    dark = toned(wal, (0.42, 0.27, 0.16), 1.1)
    C, N = 128, 8
    img = np.zeros((C * N, C * N, 3), dtype=np.float32)
    for r in range(N):
        for c in range(N):
            src = light if (r + c) % 2 == 0 else dark           # ô trên-trái là ô sáng
            S = 384
            y, x = rng.randrange(0, src.shape[0] - S), rng.randrange(0, src.shape[1] - S)
            cell = resize(src[y:y + S, x:x + S], C, C)
            turn = rng.randrange(4)
            cell = np.rot90(cell, 2 * (turn % 2)).copy()        # chỉ quay 180 độ: vân mọi ô cùng chiều như bàn gỗ ghép
            if turn >= 2:
                cell = cell[:, ::-1]
            cell *= rng.uniform(0.96, 1.04)
            edge = np.ones((C, C, 1), dtype=np.float32)          # khe ghép mảnh và cạnh ô hơi tối
            edge[0, :], edge[-1, :], edge[:, 0], edge[:, -1] = 0.62, 0.62, 0.62, 0.62
            edge[1, 1:-1], edge[-2, 1:-1], edge[1:-1, 1], edge[1:-1, -2] = 0.9, 0.9, 0.9, 0.9
            img[r * C:(r + 1) * C, c * C:(c + 1) * C] = cell * edge
    kb = save_budget(img, out_path('public', 'img', 'kydao', 'boards', 'chess.webp'), 180)
    m = lambda par: img.reshape(N, C, N, C, 3).transpose(0, 2, 1, 3, 4)[[r for r in range(N) for c in range(N) if (r + c) % 2 == par],
                                                                       [c for r in range(N) for c in range(N) if (r + c) % 2 == par]].reshape(-1, 3).mean(axis=0)
    li, da = m(0), m(1)
    info = {'kb': kb, 'light': hexc(li), 'dark': hexc(da), 'ratio': round(float(lum(li) / lum(da)), 2)}
    if kb > 180 or info['ratio'] < 2.2 or lum(img[:C, :C].reshape(-1, 3).mean(axis=0)) < lum(img[:C, C:2 * C].reshape(-1, 3).mean(axis=0)):
        raise SystemExit('Mặt bàn cờ vua không đạt: %s' % json.dumps(info))
    return img, info


def build_xiangqi_board():
    W, H = 1152, 1280
    tex = load_px(src_tex('cherry_veneer', 'diff'))[..., :3]
    if tex[:, ::8].std(axis=0).mean() > tex[::8, :].std(axis=1).mean():
        tex = np.rot90(tex).copy()                               # cho vân chạy dọc (ít biến thiên theo chiều dọc)
    img = toned(tex[200:200 + H, 300:300 + W], (0.885, 0.74, 0.51), 1.1)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    d = np.maximum(np.abs(xx / (W - 1) - 0.5), np.abs(yy / (H - 1) - 0.5)) * 2
    img = img * (1 - 0.08 * np.clip((d - 0.82) / 0.18, 0, 1) ** 2)[..., None]
    kb = save_budget(img, out_path('public', 'img', 'kydao', 'boards', 'xiangqi.webp'), 160)
    mean = img.reshape(-1, 3).mean(axis=0)
    info = {'kb': kb, 'mean': hexc(mean)}
    if kb > 160 or lum(mean) < lum((0.788, 0.627, 0.4)):
        raise SystemExit('Mặt bàn cờ tướng không đạt: %s' % json.dumps(info))
    return img, info


def quick_look(atlas, chess, xq):
    Wd = 1400
    bg = np.full((atlas.shape[0], atlas.shape[1], 3), 0.5, dtype=np.float32)
    a = atlas[..., 3:4]
    top = bg * (1 - a) + atlas[..., :3] * a
    k = Wd / top.shape[1]
    reps = int(math.ceil(k))
    top = resize(np.repeat(np.repeat(top, reps, axis=0), reps, axis=1), Wd, int(top.shape[0] * k))
    h2 = 640
    c2 = resize(chess, h2, h2)
    x2 = resize(xq, int(h2 * 0.9), h2)
    row = np.full((h2, Wd, 3), 0.16, dtype=np.float32)
    row[:, 40:40 + h2] = c2
    row[:, 760:760 + x2.shape[1]] = x2
    path = os.path.join(TMP, 'out', 'classic-xem-nhanh.jpg') if PREVIEW else os.path.join(REPO, 'docs', 'ky-dai', 'anh', 'classic-xem-nhanh.jpg')
    os.makedirs(os.path.dirname(path), exist_ok=True)
    save_px(np.concatenate([top, row], axis=0), path, 'JPEG', 90)
    return path


def main():
    import_set()
    meshes = normalized_meshes()
    meshes['disc'] = disc_mesh()
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    res = {'glb': export_pieces(meshes)}
    atlas, res['atlas'] = build_atlas(meshes)
    chess, res['chess'] = build_chess_board()
    xq, res['xiangqi'] = build_xiangqi_board()
    res['look'] = quick_look(atlas, chess, xq)
    print('RESULT ' + json.dumps(res))


main()
