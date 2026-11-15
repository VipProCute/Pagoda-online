"""Sân Long Cung (`ocean`): dải cảnh ghép từ mô hình nguồn (xem docs/ky-dai/HUONG-DAN-SAN-MOI.md).

File này được field2.py chạy trong chính không gian tên của nó: dùng thẳng Kit, B, W, rzm, tune_materials, FIELDS…
"""

def build_ocean_kit(ctx):
    """Rạn Long Cung: đá bờ biển, vỏ ốc quét thật và những cụm san hô ôm lấy bàn."""
    sc, rng = ctx.sc, ctx.rng
    kit = Kit(ctx)

    # Ba vật chủ: rạn san hô trái, chuông chìm giữa, vỏ ốc lớn phải.
    # Đá thấp bên trái; mọi bụi rong cao đều nằm bên phải hoặc dưới bàn.
    kit.put('coast_rocks_05', 'coast_rocks_05', -4.55, 5.30, 1.20, rot=0.05, sink=0.04)
    kit.put('coast_rocks_05', 'coast_rocks_05', 5.38, 4.75, 1.10, rot=1.6, sink=0.02)
    kit.put('lambis_shell', 'lambis_shell', 4.35, 5.10, 1.55, rot=0.02, z=0.10)
    kit.put('sand_rocks_small_01', '_LOD0', 0.05, 5.30, 1.15, rot=0.1, sink=0.02)

    # Các mỏm đá nối hai dải bên, chừa một khoảng cát giữa những cụm.
    for u, v, size, angle in ((-5.23, 0.35, 0.78, 0.2), (-5.30, 1.48, 0.87, 1.4),
                              (-5.20, 2.70, 0.73, 0.4), (-5.30, 3.85, 0.88, 2.0),
                              (5.30, 0.40, 0.88, 0.5), (5.25, 1.60, 0.90, 2.1),
                              (5.30, 2.80, 0.97, 1.0), (5.40, 3.90, 0.95, 2.4)):
        kit.put('coast_rocks_05', 'coast_rocks_05', u, v, size, rot=angle, sink=0.035)
    for u, v, size, angle in ((-3.65, 5.30, 1.12, 0.1), (-2.15, 5.32, 0.90, 0.2),
                              (1.60, 5.32, 0.96, 0.1), (3.05, 5.35, 1.05, 0.15)):
        kit.put('sand_rocks_small_01', '_LOD0', u, v, size, rot=angle, sink=0.01)

    # Thảm đá vụn và vỏ ốc: giới hạn cả bề rộng, không chỉ tâm vật, ngoài gờ.
    strip = lambda u, v: abs(u) > 4.98 or v > 5.00
    shell_strip = lambda u, v: strip(u, v) and not (v > 4.7 and (u < -4.4 or u > 3.8 or abs(u) < 0.7))
    for u, v, size, angle in ((-5.12, 0.30, 0.65, 1.5), (-5.14, 2.60, 0.67, 1.6),
                              (5.14, 1.35, 0.65, 1.5), (-1.95, 5.10, 0.85, 0.05)):
        kit.put('lambis_shell', 'lambis_shell', u, v, size, rot=angle, sink=0.005)
    kit.scatter('lambis_shell', 12, (0.32, 0.50), shell_strip, margin=0.48, sink=0.005)
    kit.scatter('namaqualand_stones_01', 28, (0.13, 0.24), strip, margin=0.42, sink=0.015)
    kit.scatter('stone_01', 14, (0.17, 0.28), strip, margin=0.42, sink=0.015)
    kit.scatter('rock_09', 16, (0.24, 0.40), strip, margin=0.48, sink=0.015)
    kit.scatter('rock_07', 12, (0.25, 0.43), strip, margin=0.48, sink=0.025)
    tune_materials(kit.mats, 1.12, 1.65)
    # Lọc sắc xanh của nước lên đá, giữ nguyên vân ảnh và màu ngà của vỏ ốc.
    stone_mats = {m for aid, parts in kit.parts.items() if aid != 'lambis_shell'
                  for me, lo, hi in parts.values() for m in me.materials if m}
    for mat in stone_mats:
        nt = mat.node_tree
        bsdf = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if bsdf is None or not bsdf.inputs['Base Color'].is_linked:
            continue
        src = bsdf.inputs['Base Color'].links[0].from_socket
        tint = nt.nodes.new('ShaderNodeMixRGB')
        tint.blend_type = 'COLOR'
        tint.inputs[0].default_value = 0.48
        tint.inputs[2].default_value = rgb('#68b1b9')
        nt.links.new(src, tint.inputs[1])
        nt.links.new(tint.outputs[0], bsdf.inputs['Base Color'])

    # Nguồn chưa có san hô: giữ nhánh đệ quy của bản cũ, gom thành rạn rõ màu.
    reef = [B('ocean_coral_%d' % i, basalt_material('ocean_coral_%d' % i, hx, 0.58, bump=0.65))
            for i, hx in enumerate(('#f87891', '#f3aa52', '#b77ce3'))]
    colonies = ((-5.05, 4.90, 0.29, 3), (-4.08, 5.20, 0.33, 3), (-4.65, 5.38, 0.34, 3),
                (-5.25, 0.95, 0.17, 2), (-5.18, 2.15, 0.18, 2), (-5.17, 3.45, 0.18, 2),
                (5.23, 0.95, 0.24, 3), (5.22, 2.15, 0.25, 3), (5.25, 3.45, 0.28, 3),
                (-3.12, 5.20, 0.24, 3), (-1.52, 5.20, 0.25, 3),
                (1.20, 5.22, 0.28, 3), (2.70, 5.20, 0.26, 3))
    for i, (u, v, length, depth) in enumerate(colonies):
        x, y, _ = W(u, v)
        for j in range(3):
            p = Vector((x + (j - 1) * 0.12, y + rng.uniform(-0.09, 0.09), max(ctx.tz(u, v), 0.0) + 0.07))
            d = Vector((rng.uniform(-0.3, 0.3), rng.uniform(-0.25, 0.25), 1.0)).normalized()
            coral(reef[(i + j // 2) % 3], p, d, length * 0.18, length, depth, rng)
    for b in reef:
        b.finish(sc)

    # Phiến san hô xếp tầng tạo mảng lớn, đọc rõ từ trên cao thay vì chỉ có cành nhỏ.
    plates = [B('ocean_plate_%d' % i, basalt_material('ocean_plate_%d' % i, hx, 0.65, bump=0.6))
              for i, hx in enumerate(('#db729f', '#a98bd0', '#d99c58'))]
    for i, (u, v, radius) in enumerate(((-4.60, 5.12, 0.32), (-5.08, 1.65, 0.24),
                                       (-5.15, 3.85, 0.26), (5.12, 0.70, 0.28),
                                       (5.15, 2.65, 0.30), (5.18, 4.25, 0.29),
                                       (-2.90, 5.10, 0.29), (1.70, 5.12, 0.30))):
        x, y, _ = W(u, v)
        for j in range(3):
            r = radius * (1 - j * 0.21)
            plates[i % 3].lathe([(0, 0), (r * 0.6, 0.025), (r, 0.07),
                                  (r, 0.09), (r * 0.5, 0.055), (0, 0.04)],
                                 28, (x + j * 0.035, y, max(ctx.tz(u, v), 0.0) + 0.10 + j * 0.12),
                                 True, cap=False, jitter=0.16, seedv=i * 1.7 + j,
                                 rot=rot_xyz(0.10, -0.12, i))
    for b in plates:
        b.finish(sc)

    # Quạt san hô xoè gần mặt cát: nét nhánh hồng nổi trên các khối đá xanh.
    fan = B('ocean_fans', basalt_material('ocean_fan', '#ef85b2', 0.62, bump=0.45))
    for i, (u, v) in enumerate(((-5.15, 0.82), (-5.12, 2.35), (5.13, 1.92),
                                (5.16, 3.72), (-1.10, 5.15), (2.75, 5.12))):
        x, y, _ = W(u, v)
        z = max(ctx.tz(u, v), 0.0) + 0.14
        angle = (i * 1.3) % 6.28
        for k in range(9):
            a = angle - 1.15 + k * 2.30 / 8
            radius = 0.29 + 0.04 * math.sin(k * math.pi / 8)
            root = Vector((x, y, z))
            direction = Vector((math.cos(a), math.sin(a), 0.35))
            tip = root + direction * radius
            limb(fan, root, tip, 0.019, 0.007, 5)
            for t in (0.50, 0.73):
                p = root + direction * radius * t
                for sign in (-1, 1):
                    branch = Vector((math.cos(a + sign * 0.65), math.sin(a + sign * 0.65), 0.3))
                    limb(fan, p, p + branch * 0.085, 0.011, 0.005, 4)
    fan.finish(sc)

    # San hô não vàng nhỏ ở chân rạn, tránh để cả dải chỉ toàn nhánh mảnh.
    brain = B('ocean_brain', basalt_material('ocean_brain', '#dfbb65', 0.63, bump=2.3))
    for u, v, radius in ((-4.82, 5.32, 0.22), (-5.23, 4.28, 0.19), (5.12, 2.90, 0.19),
                         (-2.45, 5.25, 0.17), (2.08, 5.26, 0.22), (5.24, 0.18, 0.17)):
        x, y, _ = W(u, v)
        brain.ico((x, y, max(ctx.tz(u, v), 0.0) + radius * 0.4), radius, 3,
                  (1.0, 0.8, 0.65), 0.10, rng, seedv=u * 3.7, smooth=True)
    brain.finish(sc)

    # Chuông đồng chìm phủ hà: giữ nét nhận diện Long Cung của sân cũ.
    x, y, _ = W(0.0, 5.13)
    bell = B('ocean_bell', basalt_material('ocean_bell', '#477e70', 0.42, bump=1.2))
    bell.lathe([(0.42, -0.05), (0.43, 0.03), (0.34, 0.28), (0.27, 0.46),
                (0.18, 0.56), (0.0, 0.58)], 28, (x, y, 0.10), True, cap=False, jitter=0.02, seedv=6.0)
    bell.lathe([(0.10, 0.55), (0.10, 0.68), (0.15, 0.74)], 12, (x, y, 0.10), True, cap=False)
    bell.finish(sc)
    barn = B('ocean_barnacles', basalt_material('ocean_barnacle', '#dce9d1', 0.8, bump=0.8))
    for k in range(24):
        angle, z = rng.uniform(0, 6.28), rng.uniform(0.06, 0.43)
        radius = 0.44 - z * 0.42
        barn.cone((x + radius * math.cos(angle), y + radius * math.sin(angle), z + 0.10),
                  0.025, 0.012, 0.04, 6)
    barn.finish(sc)

    # Rong biển dựng bằng mã; trái thấp để bóng không đi vào vùng ô cờ.
    seaweed = B('ocean_kelp', basalt_material('ocean_kelp', '#23796c', 0.62, bump=0.5))
    for u, v, height in ((-5.40, 0.55, 0.38), (-5.40, 1.85, 0.42), (-5.40, 3.10, 0.38),
                          (5.40, 0.62, 0.90), (5.40, 1.85, 1.05), (5.40, 3.10, 0.95),
                          (-3.90, 5.30, 0.75), (-2.70, 5.35, 0.65), (-0.90, 5.40, 0.75),
                          (1.85, 5.40, 0.90), (3.35, 5.38, 0.80)):
        x, y, _ = W(u, v)
        kelp(seaweed, x, y, rng, 5, height)
    seaweed.finish(sc)

    stars = B('ocean_starfish', basalt_material('ocean_starfish', '#ef914e', 0.62, bump=1.1))
    for u, v, radius in ((-4.94, 0.48, 0.19), (-5.05, 2.90, 0.20), (5.03, 1.38, 0.21),
                         (5.02, 4.06, 0.18), (-3.58, 5.05, 0.23), (2.28, 5.10, 0.22)):
        x, y, _ = W(u, v)
        z, angle = max(ctx.tz(u, v), 0.0) + 0.06, rng.uniform(0, 6.28)
        for k in range(5):
            a = angle + k * 2 * math.pi / 5
            limb(stars, (x, y, z), (x + radius * math.cos(a), y + radius * math.sin(a), z - 0.01),
                 radius * 0.24, 0.012, 6)
    stars.finish(sc)

    # Ngọc nhỏ thay quả cầu cháy trắng; bọt thưa để không che hình quét.
    pearl = B('ocean_pearl', gem_material('ocean_pearl', '#defaff', 0.7, 0.22))
    px, py, _ = W(4.37, 5.10)
    pearl.ico((px, py, 0.36), 0.105, 3, smooth=True)
    pearl.finish(sc)
    ctx.light(-5.1, 5.15, 0.95, '#ffb49b', 6.0, 0.35)
    ctx.light(4.7, 5.2, 0.85, '#9feaff', 5.0, 0.30)
    ctx.motes('#a4e8ff', 2.5, 26, 0.18, 0.85, 0.012, 0.026, 'ocean_bubbles', 2)


FIELDS['ocean']['build'] = build_ocean_kit
FIELDS['ocean'].update(
    ground=lambda: ground_material('terrain', 'fine', '#366a79', '#78a3a6', '#a4c7c3', bump=0.25),
    T=dict(FIELDS['ocean']['T'], off=0.10, amp=0.18, wave=0.015,
           flat=[(-5.20, 5.15, 1.05), (4.65, 5.15, 1.05), (0.0, 5.15, 0.65)], flat_h=0.07))
