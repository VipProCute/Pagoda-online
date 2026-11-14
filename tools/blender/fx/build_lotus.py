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

random.seed(142)
REPO = globals().get('REPO')
if not REPO:
    raise SystemExit('Thiếu REPO')
OUT = set(globals().get('OUT', ['check']))
PREVIEW = globals().get('PREVIEW', True)
TMP = globals().get('TMP', os.path.join(tempfile.gettempdir(), 'phap_tuong'))
SCENE = 'PhapTuongLotus'
ASSET = 'lotus.glb'
IMAGE = 'dai-sen-4-goc.jpg'
BUDGET = 900
SIZE_BUDGET = 60
TEXCOORDS = False
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
    background.inputs['Strength'].default_value = 1.0
    return scene


def make_mesh(name, vertices, faces, colors=None, uvs=None):
    mesh = bpy.data.meshes.new(SCENE + '_' + name + 'Mesh')
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    for polygon in mesh.polygons:
        polygon.use_smooth = True
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
                   export_texcoords=TEXCOORDS, export_animations=False, export_skins=False,
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


def build_petals(name, count, radius, length, tilt, phase, base_z=0.0, curl=8.0, cup=0.045, width_cap=0.6):
    """Dựng cánh hình giọt nước, lòng khum như thìa, đầu nhọn mềm; chồng mép ít."""
    vertices, faces, colors = [], [], []
    dark, middle, light = rgb('#c8962e'), rgb('#e8bd55'), rgb('#fff0b8')
    rows = (0.04, 0.28, 0.52, 0.76, 1.0)
    cols = 3
    spacing_mid = 2 * math.pi * (radius + 0.45 * length * math.cos(math.radians(tilt))) / count
    wmax = min(width_cap * length, spacing_mid * 1.5)

    def half_width(u):
        # Biên giọt nước: tròn ở gốc, rộng nhất ~45%, thu về đầu nhọn mềm.
        if u <= 0.45:
            t = (0.45 - u) / 0.45
            return 0.5 * wmax * math.sqrt(max(0.0, 1 - t * t))
        t = (u - 0.45) / 0.55
        return 0.5 * wmax * max(0.0, 1 - t ** 2.4) ** 0.7

    for petal in range(count):
        angle = 2 * math.pi * (petal + phase) / count
        radial = (math.cos(angle), math.sin(angle))
        tangent = (-radial[1], radial[0])
        start = len(vertices)
        dist, height, prev = radius, base_z, 0.0
        for u in rows:
            local = math.radians(tilt - curl * u * u)
            seg = (u - prev) * length
            dist += seg * math.cos(local)
            height += seg * math.sin(local)
            prev = u
            span = max(0.004, half_width(u))
            for column in range(cols):
                across = column - 1
                lift = cup * abs(across) * math.sin(math.pi * min(1.0, u * 0.95 + 0.05)) * (span / (0.5 * wmax))
                d = dist - lift * math.sin(local)
                z = height + lift * math.cos(local)
                if z >= 0.06:
                    d = max(0.285, d)
                vertices.append((radial[0] * d + tangent[0] * span * across,
                                 radial[1] * d + tangent[1] * span * across, z))
                blend = min(1.0, u / 0.6)
                base = tuple(dark[c] * (1 - blend) + middle[c] * blend for c in range(3))
                edge = max(abs(across) * 0.45 * min(1.0, u / 0.5), max(0.0, (u - 0.6) / 0.4) ** 1.5)
                colors.append(tuple(base[c] * (1 - edge) + light[c] * edge for c in range(3)) + (1.0,))
        for row in range(len(rows) - 1):
            for column in range(cols - 1):
                first = start + row * cols + column
                faces.extend(((first, first + cols + 1, first + 1), (first, first + cols, first + cols + 1)))
    return make_mesh(name, vertices, faces, colors=colors)


def build_pod():
    """Gộp đế, gương và hai vòng dấu hạt vào một lưới."""
    vertices, faces, colors = [], [], []
    gold, seed = rgb('#d9a640'), rgb('#7a5214')
    for bottom_radius, top_radius, bottom, top, segments in ((0.51, 0.502, -0.03, 0.0, 16), (0.2828, 0.27, 0.0, 0.06, 24)):
        start = len(vertices)
        for height, radius in ((bottom, bottom_radius), (top, top_radius)):
            for index in range(segments):
                angle = 2 * math.pi * index / segments
                vertices.append((radius * math.cos(angle), radius * math.sin(angle), height))
                colors.append(gold)
        vertices.extend(((0, 0, bottom), (0, 0, top)))
        colors.extend((gold, gold))
        for index in range(segments):
            nxt = (index + 1) % segments
            faces.extend(((start + index, start + nxt, start + segments + nxt),
                          (start + index, start + segments + nxt, start + segments + index),
                          (start + 2 * segments, start + nxt, start + index),
                          (start + 2 * segments + 1, start + segments + index, start + segments + nxt)))
    centers = [(radius * math.cos(2 * math.pi * (index + phase) / count),
                radius * math.sin(2 * math.pi * (index + phase) / count))
               for radius, count, phase in ((0.09, 4, 0), (0.18, 8, 0.5)) for index in range(count)]
    for center_x, center_y in centers:
        start = len(vertices)
        vertices.append((center_x, center_y, 0.0601))
        colors.append(seed)
        for index in range(6):
            angle = 2 * math.pi * index / 6
            vertices.append((center_x + 0.018 * math.cos(angle), center_y + 0.018 * math.sin(angle), 0.0601))
            colors.append(seed)
        for index in range(6):
            faces.append((start, start + 1 + index, start + 1 + (index + 1) % 6))
    obj = make_mesh('pod', vertices, faces, colors=colors)
    for polygon in obj.data.polygons:
        polygon.use_smooth = False
    return obj


def main():
    scene = new_scene()
    petal_material = material('petal', '#ffffff', metallic=0.6, vertex_color=True)
    pod_material = material('pod', '#ffffff', metallic=0.6, vertex_color=True)
    objects = [build_petals('petals0', 16, 0.27, 0.40, 30, 0, 0.0, 6, 0.05, 0.72),
               build_petals('petals1', 12, 0.27, 0.34, 50, 0.5, 0.02, 6, 0.045, 0.72),
               build_petals('petals2', 8, 0.285, 0.27, 65, 0, 0.03, 6, 0.04, 0.72), build_pod()]
    for obj in objects:
        obj.data.materials.append(pod_material if obj.name == 'pod' else petal_material)
    if 'views' in OUT:
        camera, lights = stage(scene)
        directory = TMP if PREVIEW else os.path.join(REPO, 'docs', 'phap-tuong', 'anh')
        os.makedirs(directory, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix='phap_tuong_views_') as temp:
            paths = []
            for angle in (0, 45, 90, 180):
                path = os.path.join(temp, str(angle) + '.png')
                distance = 0.0 if angle == 180 else 3.0
                height = 3.0 if angle == 180 else 3.0 * math.tan(math.radians(30))
                shoot(scene, camera, lights, path, angle, 0.05, distance, height, 320, 360, 1.45)
                paths.append(path)
            montage(paths, os.path.join(directory, IMAGE), 1280, 360)
    finish(objects)


main()