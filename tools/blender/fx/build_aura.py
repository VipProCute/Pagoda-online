"""Dựng vỏ khí bằng Blender: blender -b --python-expr "import runpy; runpy.run_path(r'<repo>/tools/blender/fx/build_aura.py', init_globals={'REPO': r'<repo>', 'OUT': ['glb','views','check']})".

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
BUDGET = 400
SIZE_BUDGET = 90
TEXCOORDS = True
PARTS = ['shell']
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
    for name, energy, size in (('Key', 900, 5), ('Fill', 500, 5), ('Rim', 1100, 4)):
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


# Ranh giới phần dùng chung của hai kịch bản độc lập.
def build_shell():
    """Dựng 12 vòng, hai cực và đường nối UV tách đỉnh."""
    profile = [(-0.05, 0.0), (0.05, 0.24), (0.22, 0.39), (0.42, 0.49),
               (0.62, 0.53), (0.85, 0.55), (1.05, 0.52), (1.27, 0.46),
               (1.48, 0.39), (1.70, 0.30), (1.90, 0.18), (2.05, 0.0)]
    vertices = []
    for height, radius in profile:
        for index in range(17):
            angle = 2 * math.pi * index / 16
            vertices.append((radius * math.cos(angle), radius * math.sin(angle), height))
    faces, uvs = [], []
    for row in range(11):
        for index in range(16):
            lower, upper = row * 17 + index, (row + 1) * 17 + index
            bottom_v = (profile[row][0] + 0.05) / 2.1
            top_v = (profile[row + 1][0] + 0.05) / 2.1
            left, right = index / 16, (index + 1) / 16
            if row == 0:
                faces.append((lower, upper + 1, upper))
                uvs.extend([((left + right) / 2, bottom_v), (right, top_v), (left, top_v)])
            elif row == 10:
                faces.append((lower, lower + 1, upper))
                uvs.extend([(left, bottom_v), (right, bottom_v), ((left + right) / 2, top_v)])
            else:
                faces.extend(((lower, lower + 1, upper + 1), (lower, upper + 1, upper)))
                uvs.extend([(left, bottom_v), (right, bottom_v), (right, top_v), (left, bottom_v), (right, top_v), (left, top_v)])
    obj = make_mesh('shell', vertices, faces, uvs=uvs)
    obj.data.materials.append(material('shell', '#8fd3ff', alpha=0.35, emission=True))
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
    objects = [build_shell()]
    if 'views' in OUT:
        preview_person()
        camera, lights = stage(scene)
        directory = TMP if PREVIEW else os.path.join(REPO, 'docs', 'phap-tuong', 'anh')
        os.makedirs(directory, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix='phap_tuong_views_') as temp:
            paths = []
            for angle in (0, 45, 90, 180):
                path = os.path.join(temp, str(angle) + '.png')
                shoot(scene, camera, lights, path, angle, 1.0, 4.0, 0.18, 320, 720, 2.5)
                paths.append(path)
            montage(paths, os.path.join(directory, IMAGE), 1280, 720)
    finish(objects)


main()