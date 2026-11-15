"""Sân Trường Giang (`river`): dải cảnh ghép từ mô hình nguồn (xem docs/ky-dai/HUONG-DAN-SAN-MOI.md).

File này được field2.py chạy trong chính không gian tên của nó: dùng thẳng Kit, B, W, rzm, tune_materials, FIELDS…
"""

def build_river_kit(ctx):
    """Bến Trường Giang: gỗ dạt, bãi đá rêu và thuyền nhỏ bên dòng nước xanh."""
    sc, rng = ctx.sc, ctx.rng
    kit = Kit(ctx)

    # Chừa cả gờ đá: kiểm tra hình bao sau khi quay, không chỉ kiểm tra tâm vật.
    def shore(aid, part, u, v, size, rot=0.0, sink=0.0, z=None):
        ob = kit.put(aid, part, u, v, size, rot=rot, sink=sink, z=z)
        bpy.context.view_layer.update()
        corners = [ob.matrix_world @ Vector(p) for p in ob.bound_box]
        inner = min(abs(p.x) for p in corners)
        front = min(p.y for p in corners)
        if inner < 4.66 and front < 4.68:
            if v >= 4.68 and 4.68 - front <= 4.66 - inner:
                ob.location.y += 4.68 - front
            else:
                ob.location.x += (-1 if u > 0 else 1) * (4.66 - inner)
            if z is None:
                ob.location.z += (max(ctx.tz(-ob.location.x, ob.location.y), -0.1)
                                  - max(ctx.tz(u, v), -0.1))
        return ob

    # Gỗ bạc bên trái, đá rêu bên phải; chừa giữa dải dưới cho cầu và thúng.
    shore('tree_stump_02', 'tree_stump_02', -5.08, 5.02, 0.88, 0.8, 0.01)
    shore('dead_tree_trunk_02', 'dead_tree_trunk_02', -3.02, 5.09, 2.25, 0.02, z=-0.07)
    shore('pine_roots', '_b', -4.22, 5.18, 1.0, 0.1, 0.02)
    shore('rock_moss_set_02', 'rock11', 5.12, 5.02, 0.92, 2.0, 0.02)
    shore('rock_moss_set_02', 'rock09', 4.4, 5.12, 1.0, 0.08, 0.02)
    shore('dry_branches_medium_01', '_a', 1.3, 5.08, 0.85, 1.55, 0.01)
    shore('rock_moss_set_02', 'rock08', -1.25, 5.11, 0.62, 0.1, 0.02)
    shore('fern_02', '_b', -4.43, 5.09, 0.54, 0.7)
    shore('fern_02', '_c', 4.4, 5.08, 0.55, 2.1)
    shore('grass_medium_02', '_d', 1.65, 5.11, 0.48, 1.0)
    # Cụm lá ôm cành dạt tạo nhịp giữa cầu và thuyền, không lấp hết mặt nước.
    shore('fern_02', '_d', 1.05, 5.18, 0.42, 0.4)
    shore('fern_02', '_a', 1.94, 5.21, 0.4, 2.3)
    shore('shrub_sorrel_01', '_b', 1.65, 4.91, 0.26, 1.2)

    # Đá quét thấp ở bờ trái; bờ phải có đá và bụi cỏ cao hơn một chút.
    for i, (u, v, size) in enumerate((
            (-5.03, 0.32, 0.63), (-5.02, 1.3, 0.57), (-5.12, 2.38, 0.72),
            (-5.02, 3.42, 0.57), (-5.24, 4.28, 0.72),
            (5.05, 0.35, 0.65), (5.1, 1.48, 0.7), (5.08, 2.65, 0.78),
            (5.2, 3.65, 0.65), (5.25, 4.32, 0.7))):
        shore('rock_moss_set_02', ('rock07', 'rock08', 'rock10', 'rock12')[i % 4],
              u, v, size, rng.uniform(0, 6.28), 0.035)
    for u, v in ((-5.03, 0.8), (-5.06, 1.9), (-5.05, 3.0), (-5.15, 3.95),
                 (5.1, 0.95), (5.08, 2.05), (5.15, 3.2), (5.2, 4.0)):
        shore('grass_medium_02', '_d' if u > 0 else '_b', u, v,
              0.55 if u > 0 else 0.38, rng.uniform(0, 6.28), z=-0.1)

    # Thảm bờ sông có khoảng ngắt để vẫn thấy nước; tránh cầu, thuyền và vật chủ.
    def bank(u, v):
        if abs(u) > 5.43 or v > 5.43:
            return False
        if v > 4.6 and (abs(u) < 0.62 or 2.3 < u < 3.65 or -3.8 < u < -1.75):
            return False
        return ctx.tz(u, v) > -0.11

    # Rải bằng cùng cổng kiểm tra hình bao như vật chủ; không để lá quay chéo đè gờ.
    def scatter_bank(aid, count, sizes, sink=0.0):
        names = kit.names(aid)
        placed = 0
        for _ in range(count * 160):
            u, v = rng.uniform(-5.43, 5.43), rng.uniform(0.05, 5.43)
            if not ctx.free(u, v, 0.18) or not bank(u, v):
                continue
            shore(aid, rng.choice(names), u, v, rng.uniform(*sizes), rng.uniform(0, 6.283), sink)
            placed += 1
            if placed == count:
                break

    scatter_bank('fern_02', 18, (0.36, 0.52), sink=0.01)
    scatter_bank('grass_medium_02', 22, (0.25, 0.4))
    scatter_bank('shrub_sorrel_01', 22, (0.18, 0.28))
    scatter_bank('periwinkle_plant', 12, (0.18, 0.25))
    scatter_bank('dandelion_01', 10, (0.18, 0.25))
    scatter_bank('stone_01', 18, (0.13, 0.25), sink=0.02)
    tune_materials(kit.mats, 1.2, 1.8)

    # Cầu và thuyền không có trong nguồn: giữ cách dựng bằng mã, lùi khỏi gờ.
    bridge = B('river_bridge', basalt_material('river_bridge', '#9a9c92', 0.7, bump=1.5))
    path = [(0.0, 4.76 + 0.86 * t / 16, 0.05 + 0.26 * math.sin(math.pi * t / 16) ** 0.8)
            for t in range(17)]
    sweep(bridge, path, 0.72, 0.13)
    for sx in (-0.34, 0.34):
        sweep(bridge, [(sx, y, z + 0.12) for _, y, z in path], 0.075, 0.1)
    lamps = B('river_bridge_lamps', glow_material('river_lamp', '#ffd890', 3.0))
    for x in (-0.34, 0.34):
        for y in (4.8, 5.48):
            bridge.box((x - 0.055, y - 0.055, -0.22), (x + 0.055, y + 0.055, 0.38),
                       bevel=0.018, seg=1, flat_big=False)
            lamps.ico((x, y, 0.43), 0.045, 2)
    bridge.finish(sc)
    lamps.finish(sc)

    boat = B('river_boat', basalt_material('river_basket', '#b58c52', 0.8, bump=2.2))
    bx, by, _ = W(2.95, 5.07)
    boat.lathe([(0, 0), (0.3, 0.02), (0.42, 0.1), (0.46, 0.2), (0.43, 0.22),
                (0.39, 0.13), (0, 0.08)], 28, (bx, by, -0.19), True, cap=False)
    boat.lathe([(0.46, 0.2), (0.48, 0.22), (0.44, 0.25), (0.42, 0.22)],
               28, (bx, by, -0.19), True, cap=False)
    boat.box((bx - 0.03, by - 0.42, 0.02), (bx + 0.03, by + 0.42, 0.07),
             flat_big=False, rot=rzm(0.5))
    # Thu thúng để thấy trọn vành, lòng và mái chèo trong dải bờ hẹp.
    for vertex in boat.bm.verts:
        vertex.co.x = bx + (vertex.co.x - bx) * 0.76
        vertex.co.y = by + (vertex.co.y - by) * 0.76
    boat.finish(sc)

    # Lau sậy mảnh nằm ngoài gờ, giữ thật thấp ở phía trái.
    reed = B('river_reeds', basalt_material('river_reed', '#b9b078', 0.9, bump=0.5))
    for u, v in ((-5.32, 0.65), (-5.3, 2.0), (-5.28, 3.8),
                 (5.28, 0.7), (5.3, 2.0), (5.28, 3.8), (1.8, 5.25), (4.2, 5.26)):
        x, y, _ = W(u, v)
        reeds(reed, x, y, rng, 9, 0.18 if u < 0 else 0.35, 0.35 if u < 0 else 0.65, 0.009)
    reed.finish(sc)

    # Lá vàng trôi nhấn sắc ấm trên dòng nước xanh, không rải lên mặt bàn.
    leaves = B('river_leaves', basalt_material('river_leaf', '#c0924a', 0.7))
    for k in range(25):
        u, v = rng.choice((-1, 1)) * rng.uniform(5.12, 5.4), rng.uniform(0.1, 4.2)
        if k % 3 == 0:
            u, v = rng.uniform(-4.3, 4.3), rng.uniform(5.05, 5.45)
        if abs(u) < 0.65 or 2.65 < u < 3.75:
            continue
        x, y, _ = W(u, v)
        leaves.ico((x, y, -0.165), 0.045, 1, (1, 0.55, 0.1), rot=rzm(rng.uniform(0, 6.28)), smooth=True)
    leaves.finish(sc)


FIELDS['river']['build'] = build_river_kit

# Thu nhẹ lòng dẫn để có bờ khô cho ảnh quét, vẫn giữ dòng nước chữ U liên tục.
# San các bãi đá nhỏ; giữ nguyên phiến cờ, mặt cờ tướng, trụ và gờ đá.
_river_terrain = dict(FIELDS['river']['T'])
_river_terrain['carve'] = [
    ('poly', shape[1], 0.34) for shape in FIELDS['river']['T']['carve']
]
_river_terrain['flat'] = [(-5.16, 5.12, 0.46), (5.19, 5.15, 0.44), (-1.25, 5.15, 0.32), (1.65, 5.18, 0.32)]
FIELDS['river'].update(T=_river_terrain)
