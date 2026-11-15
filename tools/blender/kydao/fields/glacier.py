"""Sân Băng Sơn: đá quét thật, rừng thông đóng tuyết và khe băng xanh.

File được field2.py chạy trong cùng không gian tên; chỉ dựng lại dải cảnh.
"""


def build_glacier_kit(ctx):
    sc, rng = ctx.sc, ctx.rng
    kit = Kit(ctx)
    snow = B('glacier_snow', basalt_material('glacier_snow', '#e8f5ff', 0.65, bump=0.7))
    ice = B('glacier_ice', basalt_material('glacier_ice', '#39b8ed', 0.22, bump=0.18))

    # Ba vật chủ: khối băng bên trái, vách núi bên phải, sống đá giữa dải dưới.
    kit.put('boulder_01', 'boulder_01', -5.16, 5.12, 1.05, rot=0.4, sink=0.06)
    kit.put('rock_face_02', 'rock_face_02', 5.22, 5.12, 1.12, rot=0.15, sink=0.04)
    kit.put('rock_face_01', 'rock_face_01', 0.15, 5.17, 1.25, rot=0.05, sink=0.06)
    kit.put('boulder_01', 'boulder_01', 4.95, 5.55, 0.72, rot=2.2, sink=0.06)

    # Dải trái chỉ dùng đá thấp, chừa dòng nước lam chạy sát mép ảnh.
    for u, v, size, rot in ((-5.05, 0.45, 0.65, 0.3), (-5.08, 1.45, 0.72, 1.3),
                            (-5.18, 2.45, 0.8, 2.4), (-5.12, 3.5, 0.75, 0.8),
                            (-5.2, 4.25, 0.65, 2.7)):
        kit.put('boulder_01', 'boulder_01', u, v, size, rot=rot, sink=0.06)

    # Thông cao bên phải; nền đá nối các cụm để không thành các món rời rạc.
    for part, u, v, size, rot in (('_a', 5.25, 0.65, 0.78, 0.3),
                                 ('_c', 5.23, 2.0, 0.7, 2.0),
                                 ('_b', 5.25, 3.5, 0.85, 4.0)):
        kit.put('fir_sapling', part, u, v, size, rot=rot, sink=0.03)
    # Hai tán thông thấp cạnh vũng băng làm nhịp chuyển giữa các vật chủ.
    kit.put('pine_sapling_small', '_c', -3.25, 5.18, 0.74, rot=0.7, sink=0.025)
    kit.put('pine_sapling_small', '_b', 3.65, 5.18, 0.8, rot=2.4, sink=0.025)
    for u, v, size in ((5.0, 0.1, 0.52), (5.12, 1.35, 0.64), (5.18, 2.7, 0.7),
                        (5.12, 4.2, 0.62), (-3.7, 5.2, 0.65), (-2.65, 5.3, 0.7),
                        (1.5, 5.3, 0.62), (3.3, 5.25, 0.78), (4.15, 5.3, 0.6)):
        kit.put('moon_rock_02', 'moon_rock_02_LOD0', u, v, size, rot=rng.uniform(0, 6.28), sink=0.03)

    # Thảm đá vụn bốn cỡ: tránh lòng khe, chân vật chủ và gờ bàn.
    def moraine(u, v):
        if not ctx.free(u, v, 0.28) or ctx.tz(u, v) < -0.08:
            return False
        return all((u - x) ** 2 + (v - y) ** 2 > r ** 2
                   for x, y, r in ((-5.25, 5.22, 0.65), (5.38, 5.2, 0.7), (0.15, 5.38, 0.65)))

    kit.scatter('rock_07', 20, (0.24, 0.42), moraine, margin=0.28, sink=0.025)
    kit.scatter('rock_09', 20, (0.18, 0.32), moraine, margin=0.28, sink=0.015)
    kit.scatter('stone_01', 22, (0.14, 0.26), moraine, margin=0.28, sink=0.02)
    kit.scatter('moon_rock_05', 16, (0.14, 0.24), moraine, margin=0.28, sink=0.025)
    tune_materials(kit.mats, 0.45, 1.4)

    # Chặn cả hộp bao sau khi quay: mô hình quét không được vươn vào gờ đá.
    # Chỉ đẩy ra ngoài theo trục ngắn nhất, giữ nguyên kích cỡ và cao độ.
    bpy.context.view_layer.update()
    for ob in sc.collection.objects:
        if not ob.name.startswith('kit_'):
            continue
        corners = [ob.matrix_world @ Vector(p) for p in ob.bound_box]
        xmin, xmax = min(p.x for p in corners), max(p.x for p in corners)
        ymin = min(p.y for p in corners)
        if xmin < 4.64 and xmax > -4.64 and ymin < 4.64:
            dx = 4.64 - xmin if ob.location.x > 0 else -4.64 - xmax
            dy = 4.64 - ymin
            if abs(dx) < dy:
                ob.location.x += dx
            else:
                ob.location.y += dy

    # Tuyết đọng trên các mặt hướng lên; vẫn giữ màu, vân và pháp tuyến của ảnh quét.
    # Cả lá thông cũng đóng sương, không để màu xanh rừng lấn át Băng Sơn.
    for mat in kit.mats:
        nt = mat.node_tree
        if not nt:
            continue
        bsdf = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if bsdf is None or not bsdf.inputs['Base Color'].is_linked:
            continue
        src = bsdf.inputs['Base Color'].links[0].from_socket
        geo = nt.nodes.new('ShaderNodeNewGeometry')
        sep = nt.nodes.new('ShaderNodeSeparateXYZ')
        nt.links.new(geo.outputs['Normal'], sep.inputs[0])
        noise_tex = nt.nodes.new('ShaderNodeTexNoise')
        noise_tex.inputs['Scale'].default_value = 14.0
        nt.links.new(geo.outputs['Position'], noise_tex.inputs['Vector'])
        mul = nt.nodes.new('ShaderNodeMath')
        mul.operation = 'MULTIPLY'
        mul.inputs[1].default_value = 0.6
        nt.links.new(noise_tex.outputs['Fac'], mul.inputs[0])
        add = nt.nodes.new('ShaderNodeMath')
        add.operation = 'ADD'
        nt.links.new(sep.outputs['Z'], add.inputs[0])
        nt.links.new(mul.outputs[0], add.inputs[1])
        ramp = nt.nodes.new('ShaderNodeMapRange')
        ramp.inputs['From Min'].default_value = 0.6
        ramp.inputs['From Max'].default_value = 1.15
        ramp.inputs['To Max'].default_value = 0.42
        nt.links.new(add.outputs[0], ramp.inputs['Value'])
        tint = nt.nodes.new('ShaderNodeMixRGB')
        tint.blend_type = 'MULTIPLY'
        tint.inputs[0].default_value = 0.7
        tint.inputs[2].default_value = rgb('#648aa8')
        nt.links.new(src, tint.inputs[1])
        mix = nt.nodes.new('ShaderNodeMixRGB')
        mix.inputs[2].default_value = rgb('#deefff')
        nt.links.new(ramp.outputs[0], mix.inputs[0])
        nt.links.new(tint.outputs[0], mix.inputs[1])
        nt.links.new(mix.outputs[0], bsdf.inputs['Base Color'])

    # Băng không có mô hình nguồn: giữ cách tạo tinh thể của sân cũ.
    for u, v, scale in ((-5.08, 5.03, 1.1), (5.1, 5.02, 0.7), (0.2, 5.1, 0.65)):
        x, y, _ = W(u, v)
        z = max(ctx.tz(u, v), 0.02)
        for dx, dy, radius, height, tx, ty in (
                (0, 0, 0.17, 1.25, 0, 0), (0.24, 0.09, 0.13, 0.95, 0.3, 0.15),
                (-0.22, 0.15, 0.12, 0.82, -0.25, 0.2), (0.04, -0.23, 0.1, 0.65, 0.2, -0.3),
                (-0.22, -0.17, 0.08, 0.5, -0.25, -0.2)):
            crystal(ice, x + dx * scale, y + dy * scale, z, radius * scale, height * scale, tx, ty)
        ctx.light(u, v, 0.7, '#82d5ff', 12.0, 0.25)

    # Tuyết thấp nối chân đá, không phủ lòng nước hay chạm gờ đá.
    for u, v, radius in ((-5.08, 0.6, 0.28), (-5.16, 1.65, 0.28), (-5.25, 2.6, 0.3),
                          (-5.14, 3.7, 0.29), (5.12, 0.8, 0.28), (5.16, 2.12, 0.28),
                          (5.22, 3.6, 0.3), (-3.8, 5.22, 0.28), (-2.7, 5.32, 0.26),
                          (1.25, 5.25, 0.25), (3.5, 5.24, 0.3), (4.15, 5.3, 0.25)):
        x, y, _ = W(u, v)
        snow.ico((x, y, max(ctx.tz(u, v), -0.06)), radius, 3, (1.1, 1, 0.36),
                 0.2, rng, rot=rzm(rng.uniform(0, 6)), seedv=u * 1.9, smooth=True)
    for u, v in ((-5.1, 0.2), (-5.18, 2.0), (-5.15, 3.85), (5.1, 1.4), (5.2, 2.8),
                 (-3.15, 5.25), (-1.95, 5.25), (2.7, 5.2), (3.95, 5.25)):
        x, y, _ = W(u, v)
        for k in range(3):
            crystal(ice, x + rng.uniform(-0.1, 0.1), y + rng.uniform(-0.1, 0.1),
                    max(ctx.tz(u, v), -0.12), rng.uniform(0.045, 0.075),
                    rng.uniform(0.18, 0.36), rng.uniform(-0.25, 0.25), rng.uniform(-0.25, 0.25), 5)
    # Phiến băng trôi giữ khoảng nước tối ở dưới, tạo nét lam nối ba cụm chính.
    floes = B('glacier_floes', basalt_material('glacier_floe', '#a5dcf5', 0.36, bump=0.4))
    for u, v, radius in ((-2.12, 5.05, 0.21), (-1.5, 5.28, 0.28), (-0.92, 5.17, 0.15),
                          (1.57, 5.04, 0.17), (2.12, 5.33, 0.26), (2.5, 5.12, 0.13)):
        x, y, _ = W(u, v)
        floes.ico((x, y, -0.13), radius, 1, (1.2, 0.8, 0.13),
                  0.18, rng, rot=rzm(rng.uniform(0, 6.28)))
    floes.finish(sc)
    snow.finish(sc)
    ice.finish(sc)
    ctx.motes('#e8f8ff', 15.0, 38, 0.15, 0.65, 0.01, 0.021, 'glacier_snowflakes')


FIELDS['glacier']['build'] = build_glacier_kit
