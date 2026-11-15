"""Sân Sa Mạc Lưu Sa (`desert`): bãi đá hoang mạc, cây quiver, ốc đảo; ghép từ mô hình nguồn Poly Haven (bộ Namaqualand).

File này được field2.py chạy trong chính không gian tên của nó: dùng thẳng Kit, B, W, palm, cactus, tune_materials, FIELDS…
Hướng dẫn: docs/ky-dai/HUONG-DAN-SAN-MOI.md.
"""


def build_desert_kit(ctx):
    sc, rng = ctx.sc, ctx.rng
    kit = Kit(ctx)
    oasis = lambda u, v: u > 4.25 and v > 4.3            # vũng nước và cọ ở góc dưới phải

    # ── vật chủ: cụm đá lớn góc dưới trái, phiến đá dài giữa dải dưới, cành quiver khô
    kit.put('namaqualand_boulder_03', 'boulder_03_LOD0', -5.05, 5.0, 1.55, rot=0.6, sink=0.18)
    kit.put('namaqualand_boulder_05', 'namaqualand_boulder_05', -3.85, 5.25, 1.0, rot=2.9, sink=0.05)
    kit.put('namaqualand_boulder_02', 'boulder_02', 0.9, 5.22, 2.3, rot=0.12, sink=0.12)
    kit.put('namaqualand_boulder_06', 'namaqualand_boulder_06', 2.75, 5.3, 0.75, rot=1.1, sink=0.06)
    kit.put('dead_quiver_branch_02', 'dead_quiver_branch_02', -1.45, 5.3, 0.5, rot=2.0)

    # ── dải trái: chỉ đá thấp (bóng ngắn)
    kit.put('namaqualand_boulder_06', 'namaqualand_boulder_06', -5.2, 1.2, 0.85, rot=0.7, sink=0.08)
    kit.put('namaqualand_boulder_05', 'namaqualand_boulder_05', -5.15, 3.05, 1.05, rot=1.5, sink=0.05)
    kit.put('namaqualand_boulders_01', 'namaqualand_rocks_01_b', -4.9, 0.25, 0.6, rot=0.3, sink=0.03)
    kit.put('namaqualand_boulders_01', 'namaqualand_rocks_01_a', -5.3, 2.1, 0.55, rot=2.2, sink=0.03)
    kit.put('namaqualand_boulders_01', 'namaqualand_rocks_01_a', -4.85, 4.0, 0.6, rot=4.0, sink=0.03)

    # ── dải phải: cây quiver cao, đá, cành khô
    kit.put('quiver_tree_02', 'quiver_tree_02', 5.25, 2.95, 1.35, rot=0.45)
    kit.put('quiver_tree_02', 'quiver_tree_02', 5.35, 0.85, 1.0, rot=2.6)
    kit.put('namaqualand_boulder_05', 'namaqualand_boulder_05', 5.15, 1.9, 0.95, rot=1.0, sink=0.05)
    kit.put('namaqualand_boulders_01', 'namaqualand_rocks_01_b', 4.9, 3.85, 0.6, rot=0.9, sink=0.03)
    kit.put('namaqualand_boulders_01', 'namaqualand_rocks_01_a', 4.95, 0.2, 0.55, rot=1.7, sink=0.03)
    kit.put('dead_quiver_branch_01', 'dead_quiver_branch_01', 4.85, 2.4, 0.5, rot=1.2)

    # ── ốc đảo góc dưới phải: cọ dựng bằng mã (nguồn không có cọ), viền đá
    trunk = B('palm_trunk', basalt_material('palm_trunk', '#80552e', 0.8, bump=2.0))
    leaves = B('palm_leaf', basalt_material('palm_leaf', '#57933e', 0.6, bump=0.6))
    for u, v, scale in ((5.5, 4.75, 0.6), (4.6, 5.45, 0.5), (5.45, 5.4, 0.42)):
        px, py, _ = W(u, v)
        palm(trunk, leaves, px, py, rng, scale, 0.27)
    trunk.finish(sc)
    leaves.finish(sc)
    kit.put('namaqualand_boulders_01', 'namaqualand_rocks_01_a', 4.3, 4.75, 0.5, rot=0.4, sink=0.04)
    ctx.light(4.9, 4.9, 0.7, '#a5efcf', 8.0, 0.2)

    # ── thảm thực vật và đá vụn rải khắp dải cảnh
    dry = lambda u, v: not oasis(u, v)
    kit.scatter('cheiridopsis_succulent', 34, (0.34, 0.55), dry)
    kit.scatter('crystalline_iceplant', 22, (0.32, 0.5), dry)
    kit.scatter('flower_gazania', 30, (0.3, 0.46), dry)
    kit.scatter('flower_ursinia', 20, (0.3, 0.44), dry)
    kit.scatter('flower_empodium', 14, (0.24, 0.34), dry)
    kit.scatter('wild_rooibos_bush', 9, (0.45, 0.65), dry)
    kit.scatter('namaqualand_rocks_01', 30, (0.2, 0.36), dry, sink=0.02)
    kit.scatter('namaqualand_stones_01', 34, (0.1, 0.18), dry)
    tune_materials(kit.mats, 1.35, 1.7)

    # ── xương rồng (dựng bằng mã) ở dải trái và bụi cát bay
    cc = B('cacti', basalt_material('cactus', '#71984d', 0.6, bump=0.8))
    for u, v in ((-4.75, 0.75), (-5.35, 3.75), (3.6, 5.05)):
        cx, cy, _ = W(u, v)
        cactus(cc, cx, cy, rng)
    cc.finish(sc)
    ctx.motes('#ffd898', 5.0, 28, 0.1, 0.55, 0.01, 0.025, 'dust')


FIELDS['desert']['build'] = build_desert_kit
