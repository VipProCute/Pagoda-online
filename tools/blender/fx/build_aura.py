"""Dựng lửa hộ thân bằng Blender: blender -b --python-expr "import runpy; runpy.run_path(r'<repo>/tools/blender/fx/build_aura.py', init_globals={'REPO': r'<repo>', 'OUT': ['glb','views','check']})".

REPO bắt buộc; OUT mặc định chỉ kiểm, PREVIEW mặc định bật, TMP là thư mục ảnh tạm.
Đầu ra là aura-kit.glb và ảnh bốn góc; Z hướng lên, mặt hướng −Y, đơn vị mét.
"""
import json
import math
import os
import random
import struct
import tempfile

import bpy
from mathutils import Vector

random.seed(142)
REPO = globals().get('REPO')
if not REPO:
    raise SystemExit('Thiếu REPO')
OUT = set(globals().get('OUT', ['check']))
PREVIEW = globals().get('PREVIEW', True)
TMP = globals().get('TMP', os.path.join(tempfile.gettempdir(), 'phap_tuong'))
SCENE = 'PhapTuongAura'
ASSET = 'aura-kit.glb'
IMAGE = 'vo-khi-4-goc.jpg'
BUDGET = 1500
SIZE_BUDGET = 90
TEXCOORDS = True
PARTS = ['flames']
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
    background.inputs['Strength'].default_value = 1.0
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
        # Đường nối UV tách đỉnh vẫn dùng chung pháp tuyến để không lộ vệt dọc.
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


def material(name, color, metallic=0.0, roughness=0.35, vertex_color=False, alpha=1.0, emission=False):
    # Dùng lại tên vật liệu khi chạy kịch bản lần nữa trong cùng phiên Blender.
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
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
            shader.inputs['Emission Strength'].default_value = 0.65
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
    for name, energy, size in (('Key', 280, 5), ('Fill', 180, 5), ('Rim', 380, 4)):
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


def finish(objects):
    counts = {obj.name: sum(len(poly.vertices) - 2 for poly in obj.data.polygons) for obj in objects}
    res.update({'triangles': counts, 'total_triangles': sum(counts.values()), 'bones': [], 'clips': [],
                'nodes': [obj.name for obj in objects],
                'materials': sorted({mat.name for obj in objects for mat in obj.data.materials if mat}),
                'glb_kb': None, 'attributes': {}, 'over_budget': []})
    if res['total_triangles'] > BUDGET:
        res['over_budget'].append('Tam giác vượt ' + str(BUDGET))
    if counts.get('flames', 0) > 1200:
        res['over_budget'].append('Lửa hộ thân vượt 1.200 tam giác')
    points = [vertex.co for obj in objects for vertex in obj.data.vertices]
    res['max_z'] = round(max(point.z for point in points), 5)
    res['max_radius'] = round(max(math.hypot(point.x, point.y) for point in points), 5)
    if res['max_z'] > 1.22:
        res['warnings'].append('Lửa hộ thân cao quá 1,22 m, có thể che vai và đầu')
    if 'glb' in OUT or 'check' in OUT:
        if 'glb' in OUT:
            path = os.path.join(REPO, 'public', 'models', 'fx', ASSET)
            export(path, objects)
            res['glb_kb'] = round(os.path.getsize(path) / 1024, 2)
            res['attributes'] = glb_attributes(path)
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


# Ranh giới phần dùng chung của hai kịch bản độc lập.
def build_flames():
    """Chín lưỡi chính và năm lưỡi phụ dẹt, cong chữ S, cuộn cùng chiều."""
    segments = 6
    heights = (1.20, 0.80, 1.05, 0.70, 1.15, 0.85, 1.00, 0.65, 0.95)
    secondary_heights = (0.45, 0.35, 0.55, 0.40, 0.50)
    secondary_gaps = (0, 2, 4, 5, 7)
    main_levels = (0.0, 0.23, 0.35, 0.58, 0.70, 0.86, 0.95)
    secondary_levels = (0.0, 0.25, 0.35, 0.70, 0.92)
    rng = random.Random(142)
    vertices, normals, faces, uvs = [], [], [], []
    tongue_triangles = []
    stride = segments + 1
    main_angles = [-math.pi / 2 + math.radians(40 * tongue + rng.uniform(-0.5, 0.5))
                   for tongue in range(len(heights))]
    tongues = [(angle, top_z, False) for angle, top_z in zip(main_angles, heights)]
    for gap, top_z in zip(secondary_gaps, secondary_heights):
        angle = (main_angles[gap] + main_angles[gap + 1]) / 2
        tongues.append((angle, top_z, True))

    def profile(t, knots):
        # Nội suy mềm, không gãy trục tại hai bụng chữ S và đoạn ngọn móc.
        for (left_t, left_value), (right_t, right_value) in zip(knots, knots[1:]):
            if t <= right_t:
                blend = max(0.0, min(1.0, (t - left_t) / (right_t - left_t)))
                blend = blend * blend * (3 - 2 * blend)
                return left_value + (right_value - left_value) * blend
        return knots[-1][1]

    for tongue, (angle, top_z, secondary) in enumerate(tongues):
        levels = secondary_levels if secondary else main_levels
        rings = len(levels)
        # Gốc chính gần chung một vòng, chồng mép dù tiết diện chỉ có sáu cạnh.
        # Cùng cao độ giúp chân lửa không hở sàn giữa các lưỡi cao thấp khác nhau.
        base_radius = (0.300, 0.302, 0.301)[tongue % 3]
        base_z = 0.02
        thickness = (0.100, 0.105, 0.110)[tongue % 3] if secondary else (0.130, 0.128, 0.130)[tongue % 3]
        tip_radius = (0.20, 0.24, 0.22)[tongue % 3]
        twist = math.radians(rng.uniform(25, 40))
        sway = rng.uniform(0.060, 0.075) if secondary else rng.uniform(0.065, 0.095)

        def center(t):
            # Hai bụng lệch tiếp tuyến trái dấu, lần lượt ở 35% và 70% chiều dài.
            # Đoạn cuối trở về trục xoắn theo chiều dương, tạo ngọn móc mềm.
            eased = t * t * (3 - 2 * t)
            hook = max(0.0, (t - 0.72) / 0.28) ** 2
            radius = base_radius + (tip_radius - 0.035 - base_radius) * eased + 0.035 * hook
            direction = angle + twist * eased
            offset = profile(t, ((0.0, 0.0), (0.35, sway), (0.70, -sway), (1.0, 0.0)))
            return Vector((radius * math.cos(direction) - offset * math.sin(direction),
                           radius * math.sin(direction) + offset * math.cos(direction),
                           base_z + (top_z - base_z) * t))

        def surface(t, around):
            # Bản rộng nhất ở 23%; 40% cuối rất mảnh, không còn dáng nón băng.
            width = thickness * profile(t, ((0.0, 1.0), (0.23, 1.16), (0.35, 0.85),
                                             (0.58, 0.26), (0.70, 0.13), (0.86, 0.045),
                                             (0.95, 0.012), (1.0, 0.0)))
            direction = angle + twist * t * t * (3 - 2 * t)
            tangent = Vector((-math.sin(direction), math.cos(direction), 0))
            inward = Vector((-math.cos(direction), -math.sin(direction), 0))
            # Elip 1 : 0,55; bản dài theo tiếp tuyến, chiều quấn mặt hướng ra ngoài.
            # Tiết diện ngang giữ mọi đỉnh dưới đúng cao độ chóp 1,20 m.
            return center(t) + width * (math.cos(around) * tangent + 0.55 * math.sin(around) * inward)

        start = len(vertices)
        for t in levels:
            for column in range(stride):
                # Tách cột nối U nhưng dùng cùng vị trí và pháp tuyến ở hai mép ống.
                around = 2 * math.pi * (column % segments) / segments
                point = surface(t, around)
                step = 0.0001
                along = surface(min(1.0, t + step), around) - surface(max(0.0, t - step), around)
                across = surface(t, around + step) - surface(t, around - step)
                vertices.append(tuple(point))
                normals.append(tuple(across.cross(along).normalized()))
        for row in range(rings - 1):
            for column in range(segments):
                lower = start + row * stride + column
                upper = lower + stride
                faces.extend(((lower, lower + 1, upper + 1), (lower, upper + 1, upper)))
                u0, u1 = column / segments, (column + 1) / segments
                v0, v1 = 1 - levels[row], 1 - levels[row + 1]
                # Blender lật V khi xuất: glTF v = 0 ở gốc, 1 ở ngọn.
                uvs.extend(((u0, v0), (u1, v0), (u1, v1), (u0, v0), (u1, v1), (u0, v1)))
        tip = len(vertices)
        vertices.append(tuple(center(1.0)))
        # Dùng hướng đoạn chóp thật, tránh pháp tuyến ngoặt quá mạnh theo đầu móc.
        normals.append(tuple((center(1.0) - center(levels[-1])).normalized()))
        last = start + (rings - 1) * stride
        for column in range(segments):
            faces.append((last + column, last + column + 1, tip))
            uvs.extend(((column / segments, 1 - levels[-1]),
                        ((column + 1) / segments, 1 - levels[-1]), ((column + 0.5) / segments, 0.0)))
        # Đáy có vòng đỉnh riêng để pháp tuyến hướng xuống, không làm gãy thân lửa.
        cap = len(vertices)
        for column in range(segments):
            vertices.append(vertices[start + column])
            normals.append((0, 0, -1))
        cap_center = len(vertices)
        vertices.append(tuple(center(0.0)))
        normals.append((0, 0, -1))
        for column in range(segments):
            faces.append((cap_center, cap + (column + 1) % segments, cap + column))
            uvs.extend(((0.5, 1.0), ((column + 1) / segments, 1.0), (column / segments, 1.0)))
        tongue_triangles.append(2 * segments * rings)
    # Chính: 9 × 84 = 756; phụ: 5 × 60 = 300; tổng 1.056, kể cả chóp và đáy.
    res['tongue_heights'] = list(heights + secondary_heights)
    res['tongue_triangles'] = tongue_triangles
    obj = make_mesh('flames', vertices, faces, uvs=uvs, normals=normals)
    obj.data.materials.append(material('flames', '#399de8', alpha=0.45, emission=True))
    obj.data.materials[0].use_backface_culling = True
    return obj


def preview_person():
    grey = material(SCENE + 'Person', '#9a9088', roughness=0.8)
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.19, depth=1.28, location=(0, 0, 0.64))
    body = bpy.context.object
    body.data.materials.append(grey)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=0.16, location=(0, 0, 1.44))
    bpy.context.object.data.materials.append(grey)


def main():
    scene = new_scene()
    objects = [build_flames()]
    if 'views' in OUT:
        preview_person()
        camera, lights = stage(scene)
        directory = TMP if PREVIEW else os.path.join(REPO, 'docs', 'phap-tuong', 'anh')
        os.makedirs(directory, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix='phap_tuong_views_') as temp:
            paths = []
            for angle in (0, 45, 90, 180):
                path = os.path.join(temp, str(angle) + '.png')
                shoot(scene, camera, lights, path, angle, 0.80, 4.0, 0.18, 320, 720, 2.5)
                paths.append(path)
            montage(paths, os.path.join(directory, IMAGE), 1280, 720)
    finish(objects)


main()
