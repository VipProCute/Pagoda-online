"""Sân Cổ Mộc Lâm / Đại Ngàn (`forest`): file mẫu cho cách ghép sân từ mô hình nguồn.

File này được field2.py chạy trong chính không gian tên của nó (xem load_field_files), nên dùng thẳng được
Kit, B, W, rzm, mushroom, basalt_material, gem_material, glow_material, tune_materials, FIELDS…
Hướng dẫn: docs/ky-dai/HUONG-DAN-SAN-MOI.md.
"""


def build_forest(ctx):
    """Cổ Mộc Lâm (T-207): cây, gốc, đá rêu, dương xỉ, hoa cỏ là mô hình quét thật của Poly Haven ghép quanh bàn.

    Mặt trời chiếu từ góc trái-trên ảnh, nên cây non cao hơn đặt ở mép phải: bóng đổ ra ngoài, không phủ ô cờ."""
    sc, rng = ctx.sc, ctx.rng
    kit = Kit(ctx)
    # ── góc sau trái: gốc cổ thụ phủ rêu, rễ bò ra hai phía, hốc sáng đom đóm
    kit.put('tree_stump_01', 'tree_stump_01', -4.95, 4.95, 1.7, rot=0.6)
    kit.put('pine_roots', 'pine_roots_a', -3.75, 5.2, 1.5, rot=0.15, sink=0.02)
    kit.put('root_cluster_02', '_d', -5.25, 3.95, 0.95, rot=1.45, sink=0.01)
    glow = B('stump_glow', glow_material('hollow', '#a8d83a', 1.3))
    gx, gy, _ = W(-5.0, 5.0)
    glow.ico((gx, gy, 0.36), 0.11, 2, (1, 1, 0.4), smooth=True)
    glow.finish(sc)
    ctx.light(-5.0, 5.0, 0.9, '#c8ff70', 16.0, 0.2)
    # ── góc sau phải: cụm đá rêu
    kit.put('rock_moss_set_02', 'rock11', 4.95, 4.95, 1.05, rot=2.2, sink=0.08)
    kit.put('rock_moss_set_02', 'rock08', 5.35, 4.3, 0.6, rot=0.4, sink=0.03)
    kit.put('rock_moss_set_02', 'rock12', 4.35, 5.3, 0.55, rot=4.0, sink=0.03)
    ctx.light(4.95, 4.9, 0.9, '#7fe8d0', 8.0, 0.2)
    # ── dải sau: thân cây đổ nằm giữa, cành khô, đá quanh vũng nước
    kit.put('dead_tree_trunk', 'dead_tree_trunk', -0.35, 5.12, 3.0, rot=0.1, sink=0.03)
    kit.put('dry_branches_medium_01', '_a', 1.55, 5.25, 0.8, rot=1.2)
    kit.put('dry_branches_medium_01', '_b', -2.3, 4.85, 0.6, rot=2.6)
    kit.put('rock_moss_set_02', 'rock09', 2.2, 5.3, 0.5, rot=1.0, sink=0.04)
    kit.put('rock_moss_set_01', 'rock03', 3.75, 5.38, 0.5, rot=2.0, sink=0.1)
    kit.put('tree_stump_02', 'tree_stump_02', 1.0, 5.4, 0.7, rot=3.3, sink=0.02)
    # ── dải trái: chỉ cây non thấp (bóng ngắn), đá, rễ
    kit.put('fir_sapling', '_c', -5.2, 0.8, 1.05, rot=0.5)
    kit.put('pine_sapling_small', '_c', -5.2, 2.75, 1.0, rot=2.0)
    kit.put('shrub_02', '_b', -5.4, 1.75, 0.7, rot=1.0, sink=0.1)
    kit.put('rock_moss_set_02', 'rock07', -5.2, 3.45, 0.55, rot=5.0, sink=0.03)
    kit.put('rock_moss_set_01', 'rock06', -4.95, 0.2, 0.5, rot=0.7, sink=0.12)
    kit.put('pine_roots', 'pine_roots_b', -5.0, 1.3, 1.0, rot=1.75, sink=0.02)
    # ── dải phải: cây non cao hơn, bụi, đá
    kit.put('pine_sapling_small', '_a', 5.2, 0.85, 1.25, rot=4.0)
    kit.put('fir_sapling', '_a', 5.2, 3.35, 1.3, rot=1.3)
    kit.put('fir_sapling', '_b', 5.35, 2.1, 0.95, rot=3.1)
    kit.put('shrub_02', '_d', 5.45, 1.45, 0.75, rot=2.0, sink=0.1)
    kit.put('rock_moss_set_02', 'rock13', 4.95, 2.6, 0.55, rot=3.4, sink=0.08)
    kit.put('rock_moss_set_01', 'rock01', 5.0, 0.2, 0.5, rot=1.9, sink=0.12)
    kit.put('root_cluster_02', '_f', 4.9, 3.95, 0.8, rot=0.3, sink=0.01)
    # ── thảm thực vật rải quanh: dương xỉ, cây bụi nhỏ, hoa dừa cạn tím, bồ công anh vàng, tầm ma, rễ con
    strip = lambda u, v: not (2.3 < u < 3.7 and v > 4.6)          # chừa vũng nước
    kit.scatter('fern_02', 30, (0.6, 0.95), strip)
    kit.scatter('shrub_03', 22, (0.22, 0.34), strip)
    kit.scatter('periwinkle_plant', 20, (0.3, 0.45), strip)
    kit.scatter('dandelion_01', 18, (0.22, 0.32), strip)
    kit.scatter('nettle_plant', 12, (0.2, 0.3), strip)
    kit.scatter('shrub_04', 8, (0.4, 0.6), strip)
    for part in ('_b', '_c', '_e', '_g', '_h'):
        for _ in range(2):
            u, v = rng.choice(((-1, rng.uniform(0.3, 4.4)), (1, rng.uniform(0.3, 4.4)), (0, 0)))
            if u:
                kit.put('root_cluster_02', part, u * rng.uniform(4.7, 5.3), v, rng.uniform(0.3, 0.5), rng.uniform(0, 6.283))
            else:
                kit.put('root_cluster_02', part, rng.uniform(-4.2, 2.0), rng.uniform(4.75, 5.4), rng.uniform(0.3, 0.5), rng.uniform(0, 6.283))
    tune_materials(kit.mats, 1.2, 1.7)
    # ── nấm nhỏ (dựng bằng mã) cho điểm màu ấm
    st2 = B('stems2', basalt_material('stem2', '#e8e0c8', 0.7))
    cp2 = B('caps2', basalt_material('cap2', '#d8662a', 0.5))
    capg = B('caps_glow', gem_material('cap_glow', '#7fe8d0', 1.4, 0.3))
    for i, (u, v) in enumerate(((-4.6, 1.9), (-4.7, 4.3), (-2.9, 5.35), (3.9, 4.75), (4.65, 1.7), (4.6, 4.35), (-1.4, 4.8), (0.4, 4.78))):
        x, y, _ = W(u, v)
        for k in range(3):
            mushroom(st2, capg if i % 4 == 3 else cp2, x + rng.uniform(-0.13, 0.13), y + rng.uniform(-0.13, 0.13),
                     max(ctx.tz(u, v), -0.05), rng.uniform(0.035, 0.065), rng)
    st2.finish(sc)
    cp2.finish(sc)
    capg.finish(sc)
    # ── lá rụng + đom đóm
    lv = [B('leaves%d' % i, basalt_material('leaf%d' % i, hx, 0.7)) for i, hx in enumerate(('#c07a2a', '#d0a038', '#8a4a22'))]
    for k in range(40):
        u, v = rng.uniform(-5.4, 5.4), rng.uniform(0.1, 5.4)
        if not ctx.free(u, v, 0.1):
            continue
        x, y, _ = W(u, v)
        lv[k % 3].ico((x, y, max(ctx.tz(u, v), -0.05) + 0.03), 0.06, 1, (1.0, 0.55, 0.1), rot=rzm(rng.uniform(0, 6)), smooth=True)
    for b in lv:
        b.finish(sc)
    ctx.motes('#d8ff70', 30.0, 30, 0.2, 0.9, 0.014, 0.03, 'fireflies')


FIELDS['forest']['build'] = build_forest
