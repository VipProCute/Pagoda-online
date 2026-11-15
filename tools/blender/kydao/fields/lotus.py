"""Sân Liên Hoa Đài (`lotus`): dải cảnh ghép từ mô hình nguồn (xem docs/ky-dai/HUONG-DAN-SAN-MOI.md).

File này được field2.py chạy trong chính không gian tên của nó: dùng thẳng Kit, B, W, rzm, tune_materials, FIELDS…
"""


def build_lotus_kit(ctx):
    sc, rng = ctx.sc, ctx.rng
    kit = Kit(ctx)

    # Góc dưới trái: đóa sen lớn; nằm dưới bàn nên bóng đổ xuôi ra ngoài.
    pet = B('petals', gem_material('petal', '#ff9fc0', 0.45, 0.35, 1.0))
    core = B('seedpod', glow_material('seedpod', '#ffd060', 2.5))
    big = B('bigpad', basalt_material('bigpad', '#2f7a3e', 0.45, bump=1.2))
    x, y, _ = W(-4.95, 5.18)
    lily_pad(big, x, y, -0.145, 0.62, 0)
    lotus_flower(pet, core, x, y, -0.1, 1.75, rng,
                 rings=((12, 0.45, 1.0, 0.17), (10, 0.85, 0.9, 0.15), (8, 1.2, 0.75, 0.13)))
    ctx.light(-4.95, 5.18, 0.65, '#ffb0c8', 12.0, 0.22)

    # Góc dưới phải: cụm lá lớn và đá rêu tạo khối, cao đặt về phía bóng an toàn.
    kit.put('pachira_aquatica_01', 'leaves_d', 5.08, 5.22, 0.95, rot=0.6)
    kit.put('rock_moss_set_01', 'rock03', 4.78, 4.93, 0.68, rot=2.0, sink=0.12)
    kit.put('anthurium_botany_01', '_a', 4.78, 5.48, 0.62, rot=2.8)
    ctx.light(5.0, 5.12, 0.75, '#ffc94a', 10.0, 0.2)

    # Giữa dải dưới: sen nở trên lá thay điểm đá nâu gây chú ý.
    x, y, _ = W(0.25, 5.25)
    lily_pad(big, x, y, -0.145, 0.72, 0)
    lotus_flower(pet, core, x, y, -0.1, 1.55, rng,
                 rings=((12, 0.45, 1.0, 0.17), (10, 0.85, 0.9, 0.15), (8, 1.2, 0.75, 0.13)))
    ctx.light(0.25, 5.1, 0.55, '#ffb0c8', 8.0, 0.18)
    kit.put('calathea_orbifolia_01', '_a', -2.55, 5.18, 0.78, rot=0.4)
    kit.put('anthurium_botany_01', '_b', 2.05, 5.2, 0.72, rot=2.4)

    # Bờ trái giữ thấp để bóng nắng không tràn lên ô cờ; bờ phải có lá cao hơn.
    kit.put('calathea_orbifolia_01', '_b', -5.15, 0.82, 0.62, rot=1.1)
    kit.put('anthurium_botany_01', '_c', -5.3, 2.05, 0.5, rot=4.2)
    kit.put('calathea_orbifolia_01', '_c', -5.15, 3.35, 0.58, rot=5.2)
    kit.put('rock_moss_set_01', 'rock06', -5.12, 1.45, 0.56, rot=0.7, sink=0.16)
    kit.put('rock_moss_set_01', 'rock03', -5.25, 2.75, 0.48, rot=3.0, sink=0.14)
    kit.put('pachira_aquatica_01', 'leaves_b', 5.16, 0.9, 0.76, rot=0.2)
    kit.put('anthurium_botany_01', '_a', 5.25, 2.05, 0.68, rot=1.4)
    kit.put('calathea_orbifolia_01', '_a', 5.1, 3.42, 0.74, rot=3.3)
    kit.put('rock_moss_set_01', 'rock04', 5.12, 1.52, 0.62, rot=2.1, sink=0.14)
    kit.put('rock_moss_set_01', 'rock05', 5.28, 2.82, 0.58, rot=5.1, sink=0.16)

    # Hoa lá thật rải thành thảm; chừa các chỗ đặt hoa chủ và đèn.
    strip = lambda u, v: not (abs(u) < 1.15 and v > 4.72) and not (abs(u) > 4.48 and v > 4.58) and not (abs(u - 0.25) < 0.9 and v > 4.7)
    kit.scatter('periwinkle_plant', 26, (0.38, 0.56), strip, margin=0.05, sink=0.01)
    kit.scatter('flower_gazania', 30, (0.38, 0.56), strip, margin=0.05, sink=0.02)
    kit.scatter('calathea_orbifolia_01', 16, (0.36, 0.52), strip, margin=0.04, sink=0.01)
    kit.scatter('rock_moss_set_01', 8, (0.22, 0.32), strip, margin=0.04, sink=0.16)
    tune_materials(kit.mats, 1.25, 1.75)

    # Nước, cá, lá sen và đèn hoa đăng tiếp tục dựng bằng mã như ở sân cũ.
    kk = [B('koi%d' % i, basalt_material('koi%d' % i, hx, 0.4, bump=0.3))
          for i, hx in enumerate(('#ff7a2a', '#f4f0e8', '#d83a2a'))]
    for k, (u, v, a) in enumerate(((-5.1, 1.4, 1.2), (-4.95, 3.0, 4.4), (5.15, 2.0, 2.0),
                                   (5.0, 3.6, 5.0), (-2.6, 5.1, 0.3), (2.2, 5.15, 3.4), (1.2, 5.2, 0.1))):
        x, y, _ = W(u, v)
        koi(kk[k % 3], x, y, -0.34, a, rng.uniform(1.0, 1.3), rng)
    for b in kk:
        b.finish(sc)

    pad = B('pads', basalt_material('pad', '#3a8a46', 0.45, bump=1.2))
    pad2 = B('pads2', basalt_material('pad2', '#2a6a3a', 0.45, bump=1.2))
    for k, (u, v, r) in enumerate(((-5.2, 0.5, 0.52), (-5.0, 2.2, 0.56), (-5.3, 3.5, 0.5),
                                   (5.2, 0.7, 0.4), (5.0, 2.7, 0.34), (5.3, 3.9, 0.4),
                                   (-3.4, 5.1, 0.4), (-2.0, 5.25, 0.34), (-1.2, 5.0, 0.3),
                                   (1.5, 5.2, 0.36), (2.9, 5.0, 0.42), (3.7, 5.3, 0.3),
                                   (-4.4, 4.6, 0.28), (4.3, 4.6, 0.3), (-5.35, 1.4, 0.26))):
        x, y, _ = W(u, v)
        lily_pad(pad if k % 2 else pad2, x, y, -0.145, r, 0)
    pad.finish(sc)
    pad2.finish(sc)

    lant = B('lanterns', glow_material('lantern', '#ffb050', 4.0))
    lp = B('lantern_petals', basalt_material('lantern_petal', '#f6e2c8', 0.5))
    for u, v in ((4.7, 4.95), (5.2, 4.6), (4.45, 4.55), (5.3, 5.2), (4.0, 5.1)):
        x, y, _ = W(u, v)
        lotus_flower(lp, lant, x, y, -0.18, 0.88, rng, rings=((9, 0.7, 1.0, 0.16), (7, 1.1, 0.8, 0.13)))
        ctx.light(u, v, 0.3, '#ffb050', 2.0, 0.12)
    # Cánh sen rơi và hoa nhỏ điểm sắc hồng trên mặt nước.
    for u, v in ((-5.15, 1.5), (5.1, 1.5), (-3.2, 5.05), (2.6, 5.15), (-5.3, 3.9)):
        x, y, _ = W(u, v)
        lotus_flower(pet, core, x, y, -0.15, 0.82, rng)
    # Nụ sen trên lá giữa bờ trái, thấp để không đổ bóng lên bàn.
    bud = B('lotus_bud', gem_material('lotus_bud', '#f28eae', 0.4, 0.3, 0.9))
    calyx = B('lotus_calyx', basalt_material('lotus_calyx', '#3b8546', 0.45, bump=0.8))
    x, y, _ = W(-5.0, 2.2)
    calyx.cone((x, y, 0.03), 0.13, 0.0, 0.18, 5)
    bud.ico((x, y, 0.2), 0.13, 2, (0.8, 0.8, 1.8), smooth=True)
    bud.finish(sc)
    calyx.finish(sc)
    # Một đóa trắng ở bờ phải để cân với cụm hồng bên trái.
    white = B('white_petals', gem_material('white_petals', '#fff0d8', 0.4, 0.3, 0.9))
    white_core = B('white_core', glow_material('white_core', '#ffd36a', 1.8))
    x, y, _ = W(5.18, 3.5)
    lotus_flower(white, white_core, x, y, -0.12, 0.82, rng)
    white.finish(sc)
    white_core.finish(sc)
    lp.finish(sc)
    lant.finish(sc)
    pet.finish(sc)
    core.finish(sc)
    big.finish(sc)
    pt = B('fallen', basalt_material('fallen_petal', '#ffc0d4', 0.4))
    for _ in range(34):
        u, v = rng.uniform(-5.4, 5.4), rng.uniform(0.1, 5.4)
        if not ctx.free(u, v, 0.05):
            continue
        x, y, _ = W(u, v)
        pt.ico((x, y, -0.17), 0.06, 1, (1.6, 0.6, 0.12), rot=rzm(rng.uniform(0, 6)), smooth=True)
    pt.finish(sc)


FIELDS['lotus']['build'] = build_lotus_kit
