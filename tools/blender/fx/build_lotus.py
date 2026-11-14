"""Dựng đài sen bằng Blender: blender -b --python-expr "import runpy; runpy.run_path(r'<repo>/tools/blender/fx/build_lotus.py', init_globals={'REPO': r'<repo>', 'OUT': ['glb','views','check']})".

REPO bắt buộc; OUT mặc định chỉ kiểm, PREVIEW mặc định bật, TMP là thư mục ảnh tạm.
Đầu ra là lotus.glb và ảnh bốn góc; Z hướng lên, mặt hướng −Y, đơn vị mét.
"""
import json
import math
import os
import random
import struct
import tempfile

import bpy
from mathutils import Vector
from mathutils.geometry import delaunay_2d_cdt

random.seed(142)
REPO = globals().get('REPO')
if not REPO:
    raise SystemExit('Thiếu REPO')
OUT = set(globals().get('OUT', ['check']))
PREVIEW = globals().get('PREVIEW', True)
ZOOM = int(globals().get('ZOOM', 1))
TMP = globals().get('TMP', os.path.join(tempfile.gettempdir(), 'phap_tuong'))
SCENE = 'PhapTuongLotus'
ASSET = 'lotus.glb'
IMAGE = 'ban-mau-dai-sen-4-goc.jpg'
BUDGET = 1200
SIZE_BUDGET = 60
TEXCOORDS = False
POD_TOP = 0.05
PARTS = ['petals0', 'petals1', 'petals2', 'pod']
res = {'warnings': []}


def rgb(value):
    """Đổi màu sRGB sang tuyến tính."""
    channels = [int(value[index:index + 2], 16) / 255 for index in (1, 3, 5)]
    return tuple(channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4 for channel in channels) + (1.0,)


def new_scene():
    """Chỉ dọn cảnh riêng, không xóa đối tượng dùng chung cảnh khác."""
    scene = bpy.data.scenes.get(SCENE) or bpy.data.scenes.new(SCENE)
    bpy.context.window.scene = scene
    for obj in list(scene.objects):
        if len(obj.users_scene) > 1:
            for collection in list(obj.users_collection):
                if collection in list(scene.collection.children_recursive) or collection == scene.collection:
                    collection.objects.unlink(obj)
        else:
            bpy.data.objects.remove(obj, do_unlink=True)
    scene.render.engine = 'BLENDER_EEVEE'
    scene.view_settings.view_transform = 'Standard'
    world = bpy.data.worlds.new(SCENE + 'World')
    scene.world = world
    world.use_nodes = True
    background = world.node_tree.nodes.get('Background')
    background.inputs['Color'].default_value = rgb('#1b1a20')
    background.inputs['Strength'].default_value = 2.2
    return scene


def make_mesh(name, vertices, faces, colors=None, uvs=None, normals=None):
    mesh = bpy.data.meshes.new(SCENE + '_' + name + 'Mesh')
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    if normals is not None:
        # Blender 5.x nhận pháp tuyến theo góc mặt, không còn dùng use_auto_smooth.
        mesh.normals_split_custom_set([normals[loop.vertex_index] for loop in mesh.loops])
    if colors is not None:
        layer = mesh.color_attributes.new(name='Col', type='FLOAT_COLOR', domain='CORNER')
        for loop in mesh.loops:
            layer.data[loop.index].color = colors[loop.vertex_index]
        mesh.color_attributes.active_color = layer
        mesh.color_attributes.render_color_index = mesh.color_attributes.find('Col')
    if uvs is not None:
        layer = mesh.uv_layers.new(name='UVMap')
        for polygon in mesh.polygons:
            for index in polygon.loop_indices:
                layer.data[index].uv = uvs[index]
    return obj


def material(name, color, metallic=0.0, roughness=0.35, vertex_color=False, alpha=1.0, emission=False, glow=None):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = rgb(color)[:3] + (alpha,)
    mat.use_backface_culling = False
    tree = mat.node_tree
    shader = tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = rgb(color)
    shader.inputs['Metallic'].default_value = metallic
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Alpha'].default_value = alpha
    if vertex_color:
        node = tree.nodes.new('ShaderNodeVertexColor')
        node.layer_name = 'Col'
        tree.links.new(node.outputs['Color'], shader.inputs['Base Color'])
    if emission:
        try:
            shader.inputs['Emission Color'].default_value = rgb(color)
            shader.inputs['Emission Strength'].default_value = 2.0
        except (KeyError, AttributeError) as error:
            res['warnings'].append('Không đặt được phát sáng: ' + str(error))
    if glow:
        try:
            shader.inputs['Emission Color'].default_value = rgb(glow)
            shader.inputs['Emission Strength'].default_value = 0.38
        except (KeyError, AttributeError) as error:
            res['warnings'].append('Không đặt được phát sáng: ' + str(error))
    if alpha < 1:
        try:
            mat.surface_render_method = 'DITHERED'
        except (AttributeError, TypeError, ValueError) as error:
            try:
                mat.blend_method = 'BLEND'
            except (AttributeError, TypeError, ValueError):
                res['warnings'].append('Không đặt được chế độ trong suốt: ' + str(error))
    return mat


def aim(obj, location, target):
    obj.location = location
    obj.rotation_euler = (Vector(target) - Vector(location)).to_track_quat('-Z', 'Y').to_euler()


def stage(scene):
    camera_data = bpy.data.cameras.new(SCENE + 'Camera')
    camera = bpy.data.objects.new(SCENE + 'Camera', camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    camera_data.type = 'ORTHO'
    lights = []
    for name, energy, size in (('Key', 400, 5), ('Fill', 320, 5), ('Rim', 450, 4)):
        data = bpy.data.lights.new(SCENE + name, 'AREA')
        data.energy, data.shape, data.size = energy, 'DISK', size
        obj = bpy.data.objects.new(SCENE + name, data)
        scene.collection.objects.link(obj)
        lights.append(obj)
    return camera, lights


def shoot(scene, camera, lights, path, angle, target_z, distance, height, width, image_height, scale):
    azimuth = math.radians(angle)
    target = (0, 0, target_z)
    aim(camera, (distance * math.sin(azimuth), -distance * math.cos(azimuth), target_z + height), target)
    camera.data.ortho_scale = scale
    for light, offset, elevation in zip(lights, (-38, 55, 165), (48, 25, 35)):
        direction = azimuth + math.radians(offset)
        elevation = math.radians(elevation)
        aim(light, (6 * math.sin(direction) * math.cos(elevation), -6 * math.cos(direction) * math.cos(elevation), target_z + 6 * math.sin(elevation)), target)
    scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = width, image_height, 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def montage(paths, destination, width, height):
    import numpy as np
    tiles = []
    for path in paths:
        image = bpy.data.images.load(path, check_existing=False)
        pixels = np.empty(image.size[0] * image.size[1] * 4, dtype=np.float32)
        image.pixels.foreach_get(pixels)
        tiles.append(pixels.reshape(image.size[1], image.size[0], 4))
        bpy.data.images.remove(image)
    image = bpy.data.images.new(SCENE + 'Montage', width, height)
    image.pixels.foreach_set(np.concatenate(tiles, axis=1).reshape(-1))
    bpy.context.scene.render.image_settings.file_format = 'JPEG'
    bpy.context.scene.render.image_settings.quality = 90
    image.save_render(destination, scene=bpy.context.scene)
    bpy.data.images.remove(image)


def export(path, objects):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    options = dict(filepath=path, export_format='GLB', use_selection=True, export_yup=True,
                   export_cameras=False, export_lights=False, use_active_scene=True,
                   export_texcoords=TEXCOORDS, export_normals=True, export_animations=False, export_skins=False,
                   export_materials='EXPORT', export_vertex_color='ACTIVE')
    try:
        bpy.ops.export_scene.gltf(**options)
    except TypeError as error:
        res['warnings'].append('Tùy chọn xuất màu đỉnh không được hỗ trợ: ' + str(error))
        options.pop('export_vertex_color')
        bpy.ops.export_scene.gltf(**options)


def glb_attributes(path):
    with open(path, 'rb') as stream:
        magic, version, total = struct.unpack('<4sII', stream.read(12))
        if magic != b'glTF' or version != 2:
            raise ValueError('Tệp không phải glTF 2')
        length, kind = struct.unpack('<I4s', stream.read(8))
        if kind != b'JSON':
            raise ValueError('Không có khúc JSON')
        data = json.loads(stream.read(length).decode('utf-8'))
    return {mesh.get('name', ''): [sorted(primitive.get('attributes', {}).keys()) for primitive in mesh.get('primitives', [])] for mesh in data.get('meshes', [])}


def glb_color_stats(path):
    """Đọc lại COLOR_0 từ glb: trả về trung bình RGB (tuyến tính) và sRGB tương ứng theo từng lưới."""
    with open(path, 'rb') as stream:
        stream.read(12)
        length, _ = struct.unpack('<I4s', stream.read(8))
        data = json.loads(stream.read(length).decode('utf-8'))
        blen, _ = struct.unpack('<I4s', stream.read(8))
        blob = stream.read(blen)
    stats = {}
    for mesh in data['meshes']:
        index = mesh['primitives'][0]['attributes'].get('COLOR_0')
        if index is None:
            continue
        acc = data['accessors'][index]
        view = data['bufferViews'][acc['bufferViewId'] if 'bufferViewId' in acc else acc['bufferView']]
        width = {'VEC3': 3, 'VEC4': 4}[acc['type']]
        kind, size, scale = {5126: ('f', 4, 1.0), 5121: ('B', 1, 255.0), 5123: ('H', 2, 65535.0)}[acc['componentType']]
        stride = view.get('byteStride', size * width)
        offset = view.get('byteOffset', 0) + acc.get('byteOffset', 0)
        rows = [tuple(v / scale for v in struct.unpack_from('<' + kind * width, blob, offset + i * stride)[:3]) for i in range(acc['count'])]
        mean = [sum(row[c] for row in rows) / len(rows) for c in range(3)]
        srgb = [round(255 * (12.92 * v if v <= 0.0031308 else 1.055 * v ** (1 / 2.4) - 0.055)) for v in mean]
        stats[mesh.get('name', '')] = {'component': acc['componentType'], 'linear_mean': [round(v, 3) for v in mean], 'srgb_mean': srgb,
                                       'max': [round(max(row[c] for row in rows), 3) for c in range(3)]}
    return stats


def finish(objects):
    counts = {obj.name: sum(len(poly.vertices) - 2 for poly in obj.data.polygons) for obj in objects}
    res.update({'triangles': counts, 'total_triangles': sum(counts.values()), 'bones': [], 'clips': [],
                'nodes': [obj.name for obj in objects],
                'materials': sorted({mat.name for obj in objects for mat in obj.data.materials if mat}),
                'glb_kb': None, 'attributes': {}, 'over_budget': []})
    if res['total_triangles'] > BUDGET:
        res['over_budget'].append('Tam giác vượt ' + str(BUDGET))
    if 'glb' in OUT or 'check' in OUT:
        if 'glb' in OUT:
            path = os.path.join(REPO, 'public', 'models', 'fx', ASSET)
            export(path, objects)
            res['glb_kb'] = round(os.path.getsize(path) / 1024, 2)
            res['attributes'] = glb_attributes(path)
            res['colors'] = glb_color_stats(path)
        else:
            with tempfile.TemporaryDirectory(prefix='phap_tuong_check_') as directory:
                path = os.path.join(directory, ASSET)
                export(path, objects)
                res['glb_kb'] = round(os.path.getsize(path) / 1024, 2)
                res['attributes'] = glb_attributes(path)
        if res['glb_kb'] > SIZE_BUDGET:
            res['over_budget'].append('GLB vượt ' + str(SIZE_BUDGET) + ' KB')
    if 'check' in OUT:
        print('RESULT ' + json.dumps(res, ensure_ascii=False))


def lerp3(first, second, amount):
    return tuple(first[c] * (1 - amount) + second[c] * amount for c in range(3))


def build_petals(name, count, radius, length, tilt, phase, base_z, curl, cup, overlap, cols, stagger=0.0):
    """Ba hàng cong lòng máng, bụng ở 40% chiều dài, chóp nhọn hơi vểnh ra ngoài.

    Chân rộng 78% bụng để che khe; viền ngọn có nhiều đoạn cong nhưng chỉ một chóp.
    Pháp tuyến lấy từ mặt khum liên tục theo chiều dài/ngang, không theo đường chéo lưới.
    """
    vertices, faces, colors, normals = [], [], [], []
    reference_sum = [0.0, 0.0, 0.0]
    dark, middle, light = rgb('#bb7412'), rgb('#f0a62a'), rgb('#ffdc64')
    rows = (0.0, 0.5, 1.0)
    slope, bend = math.radians(tilt), math.radians(curl)
    spacing = 2 * math.pi * (radius + 0.5 * length * math.cos(slope)) / count
    width = spacing * overlap

    def surface(u, across_width):
        # Mặt khum độc lập với cách chia viền: pháp tuyến không gãy ở đường giữa hay chóp.
        lateral = 0.5 * width * across_width
        local = slope - bend * u
        # Tích phân cung tròn: dáng cánh không đổi khi đổi số cột/hàng.
        if abs(bend) > 1e-8:
            dist = radius + length * (math.sin(slope) - math.sin(local)) / bend
            height = base_z + length * (math.cos(local) - math.cos(slope)) / bend
        else:
            dist = radius + length * u * math.cos(slope)
            height = base_z + length * u * math.sin(slope)
        # Hai mép cuộn lên; sống ngoài chỉ nhô vài mm, hòa dần vào gốc và chóp.
        envelope = math.sin(math.pi * u)
        ridge = 0.004 * math.exp(-12 * across_width ** 2) * envelope
        lift = cup * across_width ** 2 * envelope - ridge
        tip = max(0.0, (u - 0.78) / 0.22)
        reflex = 0.008 * tip ** 2
        return Vector((dist - lift * math.sin(local) + reflex, lateral, height + lift * math.cos(local)))

    for petal in range(count):
        # Tầng trong cao thấp xen kẽ nhẹ, tránh đọc thành một thành vương miện liền.
        slope = math.radians(tilt + (stagger if petal % 2 else -stagger))
        angle = 2 * math.pi * (petal + phase) / count
        radial = Vector((math.cos(angle), math.sin(angle), 0))
        tangent = Vector((-radial.y, radial.x, 0))
        start = len(vertices)
        for row, along in enumerate(rows):
            for column in range(cols):
                across = -1 + 2 * column / (cols - 1)
                # abs tạo góc nhọn thật ở giữa viền; mỗi nửa vẫn cong lồi tới vai rộng u=0,4.
                side = abs(across)
                cap = 1 - 0.6 * side
                u = along * cap
                # Đa thức lẻ có độ cong một dấu trên mỗi nửa: mép lồi, vai tiếp tuyến dọc,
                # chóp có hai tiếp tuyến khác nhau; không bo đỉnh bằng cos như vòng trước.
                outline = across * (1.25 - 0.25 * across ** 4)
                across_width = outline * (0.78 + 0.22 * math.sin(along * math.pi / 2))
                point = surface(u, across_width)
                vertices.append(tuple(radial * point.x + tangent * point.y + Vector((0, 0, point.z))))
                # Sai phân trên mặt khum thật, kể cả ở biên; không cần lưng ảo để giấu mặt phẳng.
                step = 0.0001
                left = surface(u, across_width - step)
                right = surface(u, across_width + step)
                before = surface(u - step, across_width)
                after = surface(u + step, across_width)
                normal = (after - before).cross(right - left).normalized()
                normals.append(tuple(radial * normal.x + tangent * normal.y + Vector((0, 0, normal.z))))
                # Lưu trung bình vòng 3 trước khi dồn sáng sang mép, tối vào lòng gần gốc.
                base = lerp3(dark, middle, min(1.0, u / 0.4) ** 0.65)
                edge = max(0.0, (abs(across_width) - 0.86) / 0.14)
                edge *= min(1.0, u / 0.3) * 0.4
                crown = max(0.0, (u - 0.82) / 0.18) ** 1.6 * 0.7
                rim = 0.32 if row == len(rows) - 1 else 0.0
                reference = lerp3(base, light, min(1.0, max(edge, crown, rim)))
                for channel in range(3):
                    reference_sum[channel] += reference[channel]
                # Dải viền chạy qua 2–3 đỉnh mỗi bên; không tẩy sáng cả hàng chóp.
                edge_span = min(2.5, (cols - 1) / 2)
                edge = max(0.0, 1 - min(column, cols - 1 - column) / edge_span)
                edge *= min(1.0, u / 0.22) * 0.64
                trough = max(0.0, 1 - u / 0.5) * (1 - across_width ** 2) * 0.18
                base = lerp3(base, dark, trough)
                rim = 0.12 if row == len(rows) - 1 else 0.0
                colors.append(lerp3(base, light, max(edge, crown, rim)) + (1.0,))
        for row in range(len(rows) - 1):
            for column in range(cols - 1):
                first = start + row * cols + column
                faces.extend(((first, first + cols, first + cols + 1),
                              (first, first + cols + 1, first + 1)))
    # Giữ đúng trung bình tuyến tính của vòng 3 từng tầng (COLOR_0), vẫn nằm trong [0,1].
    means = [sum(color[c] for color in colors) / len(colors) for c in range(3)]
    targets = [value / len(colors) for value in reference_sum]
    colors = [tuple(color[c] * targets[c] / means[c] if means[c] >= targets[c]
                    else 1 - (1 - color[c]) * (1 - targets[c]) / (1 - means[c])
                    for c in range(3)) + (1.0,) for color in colors]
    return make_mesh(name, vertices, faces, colors=colors, normals=normals)


def build_pod():
    """Đế khuất sau cánh, đĩa phẳng có gờ và 13 hốc hạt lõm thật, không chồng mặt."""
    vertices, faces, colors, normals = [], [], [], []
    base_color, side_color = rgb('#a56510'), rgb('#b87a18')
    top_color, rim_color = rgb('#cb8b1d'), rgb('#e5ac35')
    seed_rim, seed_center = rgb('#b47716'), rgb('#95540c')

    def ring(radius, height, segments, color, outward, upward):
        start = len(vertices)
        for index in range(segments):
            angle = 2 * math.pi * index / segments
            vertices.append((radius * math.cos(angle), radius * math.sin(angle), height))
            colors.append(color)
            normals.append(tuple(Vector((outward * math.cos(angle), outward * math.sin(angle), upward)).normalized()))
        return start

    def connect(lower, upper, segments):
        for index in range(segments):
            nxt = (index + 1) % segments
            faces.extend(((lower + index, lower + nxt, upper + nxt),
                          (lower + index, upper + nxt, upper + index)))

    # Chỉ giữ thành đế; mặt trên bị gương che, mặt đáy không nhìn thấy trong game.
    lower = ring(0.235, -0.012, 12, base_color, 1, 0)
    upper = ring(0.24, 0.004, 12, base_color, 1, 0)
    connect(lower, upper, 12)
    segments = 18
    # Thành gương cao 28 mm, mặt chỉ cao hơn chân cánh trong 26 mm; gờ rộng 6 mm, cao 2 mm.
    lower = ring(0.282, 0.024, segments, side_color, 1, 0)
    outer = ring(0.285, POD_TOP + 0.002, segments, rim_color, 0.5, 1)
    inner = ring(0.279, POD_TOP, segments, top_color, 0, 1)
    connect(lower, outer, segments)
    connect(outer, inner, segments)

    # Chia đĩa có ràng buộc quanh hốc: nền vẫn đồng phẳng, tâm hạt thấp hơn 2,5 mm.
    # CDT của mathutils có sẵn trong Blender 5.x; không cần thư viện ngoài hoặc toán tử sửa lưới.
    points = [(0.279 * math.cos(2 * math.pi * index / segments),
               0.279 * math.sin(2 * math.pi * index / segments)) for index in range(segments)]
    heights, shades = [POD_TOP] * segments, [top_color] * segments
    edges = [(index, (index + 1) % segments) for index in range(segments)]
    centers = [(0, 0)] + [(radius * math.cos(2 * math.pi * (index + phase) / count),
                           radius * math.sin(2 * math.pi * (index + phase) / count))
                          for radius, count, phase in ((0.085, 4, 0), (0.175, 8, 0.5)) for index in range(count)]
    for center_x, center_y in centers:
        start = len(points)
        for index in range(5):
            angle = 2 * math.pi * index / 5
            points.append((center_x + 0.016 * math.cos(angle), center_y + 0.016 * math.sin(angle)))
            heights.append(POD_TOP)
            shades.append(seed_rim)
            edges.append((start + index, start + (index + 1) % 5))
            edges.append((start + index, start + 5))
        points.append((center_x, center_y))
        heights.append(POD_TOP - 0.0025)
        shades.append(seed_center)
    coords, _, triangles, origins, _, _ = delaunay_2d_cdt([Vector(point) for point in points], edges, [], 0, 1e-8, True)
    start = len(vertices)
    for coord, source in zip(coords, origins):
        # Các cạnh không giao nhau: mỗi đỉnh kết quả phải ứng đúng một đỉnh đầu vào.
        if len(source) != 1:
            raise ValueError('Chia gương sen sinh đỉnh ngoài dự kiến')
        index = source[0]
        vertices.append((coord.x, coord.y, heights[index]))
        colors.append(shades[index])
        normals.append((0, 0, 1))
    for triangle in triangles:
        first, second, third = triangle
        a, b, c = coords[first], coords[second], coords[third]
        if (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x) < 0:
            second, third = third, second
        faces.append((start + first, start + second, start + third))
    return make_mesh('pod', vertices, faces, colors=colors, normals=normals)


def main():
    scene = new_scene()
    # Vật liệu gần với vật liệu trong game: vàng kim loại 0,45, nhám 0,32, phát sáng hổ phách nhẹ.
    petal_material = material('petal', '#ffffff', metallic=0.45, roughness=0.32, vertex_color=True, glow='#9a6414')
    pod_material = material('pod', '#ffffff', metallic=0.45, roughness=0.32, vertex_color=True, glow='#9a6414')
    # Cánh: 512 + 288 + 128 tam giác; gương và đế dự kiến 268, tổng 1.196.
    # Tầng trong lệch tầng giữa 15° (nửa bước 12 cánh), nghiêng ±3°, khum chóp thêm 7°.
    objects = [build_petals('petals0', 16, 0.246, 0.4, 20, 0, 0.0, -6, 0.050, 1.7, 9),
               build_petals('petals1', 12, 0.268, 0.30, 46, 0.5, 0.012, -12, 0.060, 1.5, 7),
               build_petals('petals2', 8, 0.294, 0.32, 70, 2 / 3, 0.024, -47, 0.064, 1.12, 5, stagger=3), build_pod()]
    for obj in objects:
        obj.data.materials.append(pod_material if obj.name == 'pod' else petal_material)
    if 'views' in OUT:
        camera, lights = stage(scene)
        directory = TMP if PREVIEW else os.path.join(REPO, 'docs', 'phap-tuong', 'anh')
        os.makedirs(directory, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix='phap_tuong_views_') as temp:
            paths = []
            # Hai góc nghiêng 30° (lệch nhẹ để thấy khác tầng), một góc ngang thấp 8°, một góc từ trên.
            for index, (angle, elevation) in enumerate(((0, 30), (11, 30), (0, 8), (180, 90))):
                path = os.path.join(temp, str(index) + '.png')
                distance = 0.0 if elevation >= 90 else 3.0
                height = 3.0 if elevation >= 90 else 3.0 * math.tan(math.radians(elevation))
                shoot(scene, camera, lights, path, angle, 0.05, distance, height, 320 * ZOOM, 360 * ZOOM, 1.45)
                paths.append(path)
            montage(paths, os.path.join(directory, IMAGE), 1280 * ZOOM, 360 * ZOOM)
    finish(objects)


main()
