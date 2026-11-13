"""Kỳ Đài · T-126a: render atlas quân cờ 2D từ mô hình 3D (build.py) bằng Blender.

Chạy trong Blender (5.x) đang mở:
    import runpy
    runpy.run_path(r'<repo>/tools/blender/kydao/pieces2d.py',
                   init_globals={'REPO': r'<repo>', 'ONLY': ['magma'], 'PREVIEW': False})
Tham số (init_globals):
    REPO     đường dẫn gốc repo (bắt buộc)
    ONLY     danh sách mã bộ quân, None = cả 8 bộ
    PREVIEW  True: ít mẫu (24), ghi atlas xem thử (jpg nền xám) vào thư mục tạm, KHÔNG đụng public/
             False (mặc định): 64 mẫu, ghi public/img/kydao/pieces2d/<id>.webp
    DOCS     danh sách mã được ghi thêm ảnh xem nhanh docs/ky-dai/anh/quan-2d-<id>.jpg (mặc định magma, jade)
    SAMPLES  ghi đè số mẫu

Quy ước atlas (xem README.md): 896x256, lưới 7 cột x 2 hàng, mỗi ô 128x128, nền trong suốt.
    Hàng 0 = bên a (sáng), hàng 1 = bên b (tối). Cột: K Q R B N P disc.
    Quân cờ vua: nhìn từ phía trước chếch xuống 22 độ, trực giao, 67 px/đơn vị mô hình, đáy quân cách mép dưới ô 10 px
    (tức đáy ở y=118), Mã quay mặt sang trái. disc: nhìn thẳng từ trên xuống, đường kính thân 108 px (kể cả gai ~124 px), tâm ô.
Mỗi quân render 256x256 rồi thu về 128 (siêu lấy mẫu) bằng Pillow của Python hệ thống (`python`), bước đóng gói.
Làm việc trong cảnh riêng 'KyDaiPieces2D', không lưu .blend.
"""
import json, math, os, runpy, subprocess, sys, tempfile

ELEV = math.radians(22.0)
PPU = 67.0              # px / đơn vị mô hình ở ô 128 (Vua cao ~108 px kể cả thánh giá)
DISC_D = 108.0          # đường kính thân disc (px); gai trang trí nhô thêm ~8 px mỗi bên nên vẫn nằm trong ô
BOTTOM_Y = 118          # hàng đáy quân trong ô 128 (cách mép dưới 10 px)
KINDS = ['K', 'Q', 'R', 'B', 'N', 'P', 'disc']
TILE, SS = 128, 2       # ô cuối và hệ số siêu lấy mẫu


def render_tiles(REPO, only, samples, tmp):
    import bpy
    from mathutils import Vector
    lib = runpy.run_path(os.path.join(REPO, 'tools', 'blender', 'kydao', 'build.py'),
                         init_globals={'REPO': REPO, 'RUN_MAIN': False})
    cat = lib['catalog']()['PIECES']
    out = {}
    for sid, p in cat.items():
        if only and sid not in only:
            continue
        for side in ('a', 'b'):
            sc = _scene(bpy, samples)
            mats = lib['piece_materials'](sid, p, side)
            objs = {k: lib['piece'](sc, sid, k, mats) for k in KINDS}
            _clean_disc(objs['disc'])
            for kind in KINDS:
                for k, ob in objs.items():
                    ob.hide_render = (k != kind)
                path = os.path.join(tmp, '%s_%s_%s.png' % (sid, side, kind))
                _shoot(bpy, sc, objs[kind], kind, side, path, _expo(lib['rgb'](p[side]['base']), lib['rgb'](p[side]['accent'])))
            out[sid + side] = True
    return out


def _expo(c, a):
    """Hệ số sáng theo độ chói màu thân và màu chi tiết: màu rất sáng (ngọc, băng) giảm đèn để khỏi cháy trắng."""
    lum = lambda x: 0.2126 * x[0] + 0.7152 * x[1] + 0.0722 * x[2]
    return min(1.0, 0.5 / max(lum(c), 0.9 * lum(a), 0.01))


def _clean_disc(ob):
    """Mô hình disc có nắp viền (accent) trùng mặt phẳng với mặt trên thân -> chớp nhoáng. Bỏ nắp viền, giữ mặt thân."""
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bad = [f for f in bm.faces if f.material_index == 1 and abs(f.normal.z) > 0.99 and 0.15 < f.calc_center_median().z < 0.165
           and len(f.verts) > 8]
    bmesh.ops.delete(bm, geom=bad, context='FACES')
    bm.to_mesh(ob.data)
    bm.free()


def _scene(bpy, samples):
    name = 'KyDaiPieces2D'
    old = bpy.data.scenes.get(name)
    if old is not None:
        for ob in list(old.collection.all_objects):
            bpy.data.objects.remove(ob, do_unlink=True)
        bpy.data.scenes.remove(old)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.lights, bpy.data.cameras):
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
    cy.max_bounces = 6
    cy.sample_clamp_indirect = 6.0
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
    sc.view_settings.view_transform = 'Standard'     # giữ đúng màu danh mục
    sc.view_settings.look = 'None'
    w = bpy.data.worlds.get('KyDaiPieces2DWorld') or bpy.data.worlds.new('KyDaiPieces2DWorld')
    w.use_nodes = True
    bg = w.node_tree.nodes.get('Background')
    bg.inputs[0].default_value = (0.62, 0.68, 0.8, 1)      # trời lạnh nhạt: cho kim loại và men có gì để phản chiếu
    bg.inputs[1].default_value = 0.75
    sc.world = w
    return sc


def _area(bpy, sc, name, loc, target, size, energy, color=(1, 1, 1)):
    from mathutils import Vector
    li = bpy.data.lights.new(name, 'AREA')
    li.shape = 'DISK'
    li.size = size
    li.energy = energy
    li.color = color
    ob = bpy.data.objects.new(name, li)
    sc.collection.objects.link(ob)
    ob.location = loc
    ob.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    return ob


def _shoot(bpy, sc, ob, kind, side, path, expo=1.0):
    from mathutils import Vector
    # dọn đèn, máy quay, sàn cũ của lần chụp trước
    for o in list(sc.collection.all_objects):
        if o.type in ('LIGHT', 'CAMERA') or o.name.startswith('shadow'):
            bpy.data.objects.remove(o, do_unlink=True)
    top = kind == 'disc'
    cam = bpy.data.cameras.new('cam')
    cam.type = 'ORTHO'
    cam.clip_start, cam.clip_end = 0.1, 60.0
    co = bpy.data.objects.new('cam', cam)
    sc.collection.objects.link(co)
    sc.camera = co
    if top:
        cam.ortho_scale = TILE / (DISC_D / 0.88)            # 0.88 = đường kính mô hình của disc
        co.location = (0, 0, 8)
        co.rotation_euler = (0, 0, 0)
        key_t = (0, 0, 0.1)
    else:
        cam.ortho_scale = TILE / PPU
        # độ cao thấp nhất trên màn hình của mô hình (điểm gần máy quay, sát mặt đất)
        sy, ce = math.sin(ELEV), math.cos(ELEV)
        lo = min(v.co.z * ce - v.co.y * sy for v in ob.data.vertices)
        c_up = lo + (TILE / 2 - (TILE - BOTTOM_Y)) / PPU    # điểm giữa ô nằm trên đáy quân (BOTTOM_Y-64) px
        target = Vector((0, 0, c_up / ce))
        co.location = target + Vector((0, math.cos(ELEV), math.sin(ELEV))) * 8
        co.rotation_euler = (target - co.location).to_track_quat('-Z', 'Y').to_euler()
        key_t = (0, 0, 0.45)
    dark = side == 'b'
    # ánh sáng 3 điểm: chính trên-trái phía trước, phụ bên phải, ven phía sau
    k = ((0.5 if dark else 0.3) if top else 1.0) * expo      # disc nhìn từ trên: mặt phẳng hứng sáng trực diện nên giảm đèn
    _area(bpy, sc, 'key', (-1.9, 1.7, 4.6), key_t, 2.6, (520 if dark else 250) * k, (1.0, 0.96, 0.9))
    f = _area(bpy, sc, 'fill', (3.2, 2.2, 1.6), key_t, 3.0, (260 if dark else 90) * k, (0.75, 0.85, 1.0))
    r = _area(bpy, sc, 'rim', (1.2, -3.2, 3.0), key_t, 1.6, (900 if dark else 380) * k, (1.0, 1.0, 1.0))
    f.data.use_shadow = r.data.use_shadow = False      # chỉ đèn chính đổ bóng, bóng ngắn nên không bị cắt ở mép ô
    if not top:                                             # bóng đổ mềm nhỏ dưới chân
        me = bpy.data.meshes.new('shadow')
        import bmesh
        bm = bmesh.new()
        bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=2.5)
        bm.to_mesh(me)
        bm.free()
        gr = bpy.data.objects.new('shadow', me)
        sc.collection.objects.link(gr)
        gr.is_shadow_catcher = True
    sc.world.node_tree.nodes['Background'].inputs[1].default_value = 0.75 * expo
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)


# ───────────────────────── đóng gói (Pillow, Python hệ thống) ─────────────────────────
def pack(tmp, sid, out_webp, out_jpg=None, quality=88):
    from PIL import Image
    atlas = Image.new('RGBA', (TILE * 7, TILE * 2), (0, 0, 0, 0))
    for r, side in enumerate(('a', 'b')):
        for c, k in enumerate(KINDS):
            im = Image.open(os.path.join(tmp, '%s_%s_%s.png' % (sid, side, k))).convert('RGBA')
            im = im.convert('RGBa').resize((TILE, TILE), Image.LANCZOS).convert('RGBA')
            atlas.paste(im, (c * TILE, r * TILE))
    size = 0
    if out_webp:
        os.makedirs(os.path.dirname(out_webp), exist_ok=True)
        q = quality
        while True:
            atlas.save(out_webp, 'WEBP', quality=q, method=6)
            size = os.path.getsize(out_webp)
            if size <= 120 * 1024 or q <= 80:
                break
            q -= 2
    if out_jpg:
        os.makedirs(os.path.dirname(out_jpg), exist_ok=True)
        bg = Image.new('RGBA', atlas.size, (128, 128, 128, 255))
        bg.alpha_composite(atlas)
        bg.convert('RGB').save(out_jpg, 'JPEG', quality=90)
    return size, quality


if __name__ == '__main__' and len(sys.argv) > 1 and sys.argv[1] == 'pack':
    _, _, tmp, sid, webp, jpg = (sys.argv + [None] * 6)[:6]
    print(json.dumps(pack(tmp, sid, None if webp == '-' else webp, jpg)))
    raise SystemExit(0)

# ───────────────────────── chạy trong Blender ─────────────────────────
if globals().get('REPO'):
    _only = globals().get('ONLY')
    _prev = globals().get('PREVIEW', False)
    _docs = globals().get('DOCS', ['magma', 'jade'])
    _tmp = os.path.join(tempfile.gettempdir(), 'kydao2d')
    os.makedirs(_tmp, exist_ok=True)
    render_tiles(REPO, _only, globals().get('SAMPLES') or (24 if _prev else 64), _tmp)
    _res = {}
    _me = globals().get('__file__') or os.path.join(REPO, 'tools', 'blender', 'kydao', 'pieces2d.py')
    for _sid in (_only or ['magma', 'jade', 'wood', 'ice', 'coral', 'bronze', 'storm', 'sandstone']):
        _webp = '-' if _prev else os.path.join(REPO, 'public', 'img', 'kydao', 'pieces2d', _sid + '.webp')
        _jpg = (os.path.join(_tmp, 'preview-' + _sid + '.jpg') if _prev else
                (os.path.join(REPO, 'docs', 'ky-dai', 'anh', 'quan-2d-' + _sid + '.jpg') if _sid in _docs else '-'))
        _r = subprocess.run(['python', _me, 'pack', _tmp, _sid, _webp, _jpg if _jpg != '-' else ''],
                            capture_output=True, text=True)
        _res[_sid] = (_r.stdout.strip() or _r.stderr.strip())[-120:]
    result = _res
