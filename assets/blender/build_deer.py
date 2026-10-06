import bpy, bmesh, math
from mathutils import Vector, Euler, Quaternion

K = 1.15 * 0.93          # metaball full extent = K * size (radius 1, threshold .6)

def deer_metaball(res=0.016):
    for m in list(bpy.data.metaballs): bpy.data.metaballs.remove(m)
    mb = bpy.data.metaballs.new('Deer'); mb.resolution = res; mb.render_resolution = res; mb.threshold = 0.6
    ob = bpy.data.objects.new('DeerMB', mb); bpy.context.scene.collection.objects.link(ob)
    def el(c, dims, tilt=(0, 0, 0), stiff=2.0):
        e = mb.elements.new(type='ELLIPSOID'); e.co = Vector(c); e.radius = 1.0; e.stiffness = stiff
        e.size_x, e.size_y, e.size_z = (dims[0] / K, dims[1] / K, dims[2] / K); e.rotation = Euler(tilt).to_quaternion(); return e
    def mirror(c, dims, tilt=(0, 0, 0), stiff=2.0):
        for s in (-1, 1): el((s * c[0], c[1], c[2]), dims, (tilt[0], tilt[1] * s, tilt[2] * s), stiff)
    # --- torso (deep chest, tucked loin, strong haunch)
    el((0, -0.30, 0.75), (0.30, 0.34, 0.44)); el((0, -0.04, 0.76), (0.31, 0.42, 0.38)); el((0, 0.24, 0.79), (0.28, 0.32, 0.32))
    mirror((0.10, 0.40, 0.72), (0.15, 0.30, 0.34), (0.2, 0, 0)); mirror((0.10, -0.28, 0.70), (0.13, 0.24, 0.34), (-0.2, 0, 0))
    el((0, -0.30, 0.62), (0.2, 0.22, 0.2)); el((0, -0.24, 0.96), (0.10, 0.22, 0.08)); mirror((0.14, -0.06, 0.74), (0.07, 0.30, 0.30))
    # --- neck + head
    el((0, -0.47, 0.90), (0.23, 0.27, 0.31), (-0.6, 0, 0)); el((0, -0.60, 1.03), (0.17, 0.21, 0.27), (-0.6, 0, 0)); el((0, -0.69, 1.14), (0.125, 0.16, 0.2), (-0.55, 0, 0))
    el((0, -0.78, 1.21), (0.165, 0.19, 0.17), (0.25, 0, 0)); mirror((0.06, -0.80, 1.15), (0.07, 0.13, 0.09)); el((0, -0.91, 1.145), (0.095, 0.14, 0.098), (0.42, 0, 0)); el((0, -0.985, 1.10), (0.075, 0.065, 0.068)); el((0, -0.64, 0.99), (0.11, 0.2, 0.2), (-0.5, 0, 0))
    el((0, -0.88, 1.105), (0.07, 0.17, 0.055), (0.3, 0, 0)); mirror((0.042, -0.83, 1.17), (0.055, 0.09, 0.075))
    # --- front legs: sturdy but elegant (no hoof blobs: hooves are separate cloven meshes)
    mirror((0.085, -0.33, 0.55), (0.075, 0.10, 0.26)); mirror((0.082, -0.335, 0.40), (0.058, 0.062, 0.22)); mirror((0.082, -0.338, 0.285), (0.06, 0.066, 0.06)); mirror((0.08, -0.335, 0.30), (0.05, 0.052, 0.055))
    mirror((0.08, -0.335, 0.18), (0.041, 0.043, 0.25)); mirror((0.08, -0.33, 0.085), (0.042, 0.046, 0.05))
    # --- hind legs
    mirror((0.11, 0.40, 0.56), (0.105, 0.17, 0.3), (-0.25, 0, 0)); mirror((0.10, 0.47, 0.42), (0.068, 0.09, 0.22), (0.45, 0, 0)); mirror((0.09, 0.54, 0.31), (0.054, 0.064, 0.075))
    mirror((0.09, 0.53, 0.18), (0.041, 0.047, 0.26)); mirror((0.09, 0.52, 0.085), (0.042, 0.048, 0.05))
    el((0, 0.60, 0.82), (0.06, 0.08, 0.13), (-0.5, 0, 0))
    return ob

def mesh_from_metaball(ob, name='DeerBody', decimate=0.35, smooth_iter=6):
    dg = bpy.context.evaluated_depsgraph_get(); ev = ob.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(ev); o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o); return o


import random
from mathutils import noise as mnoise

def smoothstep(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a))); return t * t * (3 - 2 * t)

def finalize_body(mb_obj, target_tris=14000):
    body = mesh_from_metaball(mb_obj, 'DeerBody')
    bpy.context.view_layer.objects.active = body; body.select_set(True)
    for p in body.data.polygons: p.use_smooth = True
    sm = body.modifiers.new('Smooth', 'CORRECTIVE_SMOOTH'); sm.iterations = 12; sm.smooth_type = 'SIMPLE'; sm.rest_source = 'BIND'
    bpy.ops.object.modifier_apply(modifier='Smooth') if False else None
    bm = bmesh.new(); bm.from_mesh(body.data); bmesh.ops.triangulate(bm, faces=bm.faces)
    # laplacian-ish smoothing pass
    for _ in range(4):
        bmesh.ops.smooth_vert(bm, verts=bm.verts, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    bm.to_mesh(body.data); bm.free(); body.modifiers.clear()
    tris = len(body.data.polygons)
    dec = body.modifiers.new('Dec', 'DECIMATE'); dec.ratio = min(1.0, target_tris / max(1, tris)); bpy.ops.object.modifier_apply(modifier='Dec')
    for p in body.data.polygons: p.use_smooth = True
    return body

def paint_coat(body):
    me = body.data; col = me.color_attributes.new('Col', 'BYTE_COLOR', 'POINT')
    me.calc_normals_split() if hasattr(me, 'calc_normals_split') else None
    rnd = random.Random(4)
    for i, v in enumerate(me.vertices):
        x, y, z = v.co; n = v.normal
        up = n.z
        base = Vector((0.55, 0.37, 0.21))                                   # warm brown coat
        back = smoothstep(0.1, 0.8, up)
        belly = smoothstep(0.05, -0.75, up)
        c = base * (0.85 + 0.25 * back) + Vector((0.60, 0.52, 0.40)) * belly
        # lower legs darker, hooves dark
        if z < 0.32: c = c.lerp(Vector((0.22, 0.15, 0.09)), smoothstep(0.32, 0.12, z) * 0.7)
        if z < 0.05: c = Vector((0.06, 0.05, 0.045))
        # inner-leg / rump white patch
        if y > 0.50 and z > 0.62: c = c.lerp(Vector((0.88, 0.84, 0.76)), smoothstep(0.50, 0.58, y) * smoothstep(0.62, 0.68, z) * 0.9)
        # face: muzzle dark, chin / throat pale
        if y < -0.9: c = c.lerp(Vector((0.10, 0.08, 0.07)), smoothstep(-0.9, -1.0, y) * 0.9)
        if y < -0.7 and z < 1.12 and n.z < -0.2: c = c.lerp(Vector((0.85, 0.80, 0.70)), 0.8)
        if y < -0.78 and z > 1.05 and n.z > 0.0: c = c.lerp(Vector((0.30, 0.20, 0.12)), 0.45 * smoothstep(-0.78, -0.95, y))
        for ex in (-0.0645, 0.0645):
            dd = math.hypot(x - ex, y + 0.868, (z - 1.19) * 1.2)
            if dd < 0.05: c = c.lerp(Vector((0.82, 0.74, 0.62)), 0.55 * (1 - dd / 0.05))
        if -0.52 < y < -0.30 and z < 0.82 and abs(x) < 0.10 and n.y < 0.2: c = c.lerp(Vector((0.86, 0.80, 0.70)), 0.55)
        if abs(x) < 0.05 and n.z > 0.55 and y > -0.45 and y < 0.5: c = c * 0.82
        if y < -0.88 and abs(z - 1.062) < 0.007 and abs(x) > 0.004: c = c.lerp(Vector((0.12, 0.08, 0.06)), 0.85)           # lip line
        if -0.84 < y < -0.78 and z > 1.215 and abs(x) > 0.03: c = c.lerp(Vector((0.26, 0.17, 0.10)), 0.5)               # brow shade
        if -0.62 < y < -0.5 and z > 0.95 and n.z < 0.3: c = c.lerp(Vector((0.22, 0.15, 0.1)), 0.35)                      # neck mane shading
        # dorsal stripe darker, subtle mottling
        n1 = mnoise.noise(Vector((x * 9, y * 9, z * 9))) * 0.08
        c = c * (1 + n1)
        for k in range(3): c[k] = max(0.0, min(1.0, c[k]))
        col.data[i].color = (c[0] ** 2.2, c[1] ** 2.2, c[2] ** 2.2, 1.0)        # values above are sRGB-perceptual; attribute wants linear

TEXD = "/Users/talaljawaid/Documents/Talal's Folder/Claude/Experiment 2026/Experiment 3/AI Game/assets/blender/tex/"

def _mat_vcol(name, tex=None, rough=0.85, layer='Col'):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; b = nt.nodes['Principled BSDF']
    ca = nt.nodes.new('ShaderNodeVertexColor'); ca.layer_name = layer; src = ca.outputs['Color']
    if tex:
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(tex, check_existing=True)
        mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'; mix.inputs['Factor'].default_value = 1.0
        nt.links.new(src, mix.inputs['A']); nt.links.new(t.outputs['Color'], mix.inputs['B']); src = mix.outputs['Result']
    nt.links.new(src, b.inputs['Base Color']); b.inputs['Roughness'].default_value = rough; b.inputs['Specular IOR Level'].default_value = 0.25
    return m

def _flat(name, color, rough=0.5, metal=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal; return m

def _vcol_solid(obj, rgb_outer, rgb_inner=None, name='Col'):
    me = obj.data; col = me.color_attributes.new(name, 'BYTE_COLOR', 'POINT')
    for i, v in enumerate(me.vertices):
        c = rgb_outer
        if rgb_inner is not None: t = smoothstep(-0.3, 0.3, v.normal.y * (1 if v.co.x > 0 else 1)); c = tuple(rgb_outer[k] * (1 - t) + rgb_inner[k] * t for k in range(3))
        col.data[i].color = (c[0] ** 2.2, c[1] ** 2.2, c[2] ** 2.2, 1)

def make_eye_ears_antlers(mats):
    objs = []
    # eyes
    for s in (-1, 1):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.0175, segments=24, ring_count=16, location=(s * 0.064, -0.868, 1.19)); e = bpy.context.active_object; e.name = 'DeerEye'
        e.scale = (0.8, 1.0, 1.0); bpy.ops.object.transform_apply(scale=True); e.data.materials.append(mats['eye']); [setattr(p, 'use_smooth', True) for p in e.data.polygons]; objs.append(e)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.02, segments=20, ring_count=12, location=(s * 0.060, -0.866, 1.19)); lid = bpy.context.active_object; lid.name = 'DeerLid'; lid.scale = (0.7, 1.0, 1.0)
        bpy.ops.object.transform_apply(scale=True); _vcol_solid(lid, (0.30, 0.19, 0.10)); lid.data.materials.append(mats['coat']); [setattr(p, 'use_smooth', True) for p in lid.data.polygons]; objs.append(lid)
        # ear: flattened teardrop
        bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=20, v_segments=14, radius=1.0)
        for v in bm.verts:
            v.co.z += 1.0; zz = v.co.z / 2.0; v.co.x *= 0.012 + 0.020 * zz; v.co.y *= 0.062 * (1.0 - 0.45 * zz) + 0.012; v.co.z *= 0.082
        me = bpy.data.meshes.new('DeerEar'); bm.to_mesh(me); bm.free(); ear = bpy.data.objects.new('DeerEar', me); bpy.context.scene.collection.objects.link(ear)
        ear.location = (s * 0.072, -0.795, 1.222); ear.rotation_euler = (-0.25, s * 0.62, s * 0.2)
        for p in me.polygons: p.use_smooth = True
        _vcol_solid(ear, (0.36, 0.23, 0.13)); ear.data.materials.append(mats['coat']); objs.append(ear)
    # nose pad + nostrils
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.027, segments=20, ring_count=12, location=(0, -1.01, 1.088)); nz = bpy.context.active_object; nz.name = 'DeerNose'; nz.scale = (1.15, 0.78, 0.76)
    bpy.ops.object.transform_apply(scale=True); nz.data.materials.append(mats['nose']); [setattr(p, 'use_smooth', True) for p in nz.data.polygons]; objs.append(nz)
    # antlers
    for s in (-1, 1):
        def beam(pts, r0, r1, name):
            cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = r0; cu.bevel_resolution = 4; cu.use_fill_caps = True
            sp = cu.splines.new('BEZIER'); sp.bezier_points.add(len(pts) - 1)
            for bp, p in zip(sp.bezier_points, pts): bp.co = Vector((s * p[0], p[1], 1.19 + (p[2] - 1.30) * 0.8)); bp.handle_left_type = bp.handle_right_type = 'AUTO'
            for i, bp in enumerate(sp.bezier_points): bp.radius = r0 + (r1 - r0) * i / max(1, len(pts) - 1)
            o = bpy.data.objects.new(name, cu); bpy.context.scene.collection.objects.link(o); return o
        main = beam([(0.045, -0.76, 1.30), (0.08, -0.74, 1.46), (0.13, -0.80, 1.62), (0.12, -0.94, 1.74), (0.09, -1.04, 1.78)], 1.0, 0.45, 'Beam')
        t1 = beam([(0.075, -0.745, 1.44), (0.075, -0.84, 1.52), (0.07, -0.90, 1.60)], 0.7, 0.3, 'Tine1')
        t2 = beam([(0.12, -0.78, 1.58), (0.18, -0.74, 1.70), (0.20, -0.72, 1.80)], 0.7, 0.3, 'Tine2')
        t3 = beam([(0.125, -0.88, 1.69), (0.17, -0.92, 1.80), (0.17, -0.96, 1.88)], 0.6, 0.25, 'Tine3')
        for o in (main, t1, t2, t3):
            o.data.bevel_depth = 0.021 if o is main else 0.014
            dg = bpy.context.evaluated_depsgraph_get(); me = bpy.data.meshes.new_from_object(o.evaluated_get(dg)); nobj = bpy.data.objects.new('Antler', me); bpy.context.scene.collection.objects.link(nobj)
            for p in me.polygons: p.use_smooth = True
            nobj.data.materials.append(mats['antler']); objs.append(nobj); bpy.data.objects.remove(o, do_unlink=True)
    return objs

def deer_materials():
    return {'coat': _mat_vcol('DeerCoat', TEXD + 'deer_fur.png', 0.9), 'eye': _flat('DeerEye', (0.02, 0.012, 0.008), 0.05), 'nose': _flat('DeerNose', (0.02, 0.016, 0.014), 0.7), 'hoof': _flat('Hoof', (0.018, 0.014, 0.012), 0.65),
            'antler': _flat('Antler', (0.22, 0.15, 0.09), 0.7)}


def build_deer_rig(parts):
    """parts: body object + detail objects. Creates the armature and binds everything."""
    arm = bpy.data.armatures.new('DeerRig'); rig = bpy.data.objects.new('DeerRig', arm); bpy.context.scene.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig; rig.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    B = {}
    def bone(name, head, tail, parent=None):
        eb = arm.edit_bones.new(name); eb.head = Vector(head); eb.tail = Vector(tail)
        if parent: eb.parent = B[parent]
        B[name] = eb; return eb
    bone('root', (0, 0.1, 0.0), (0, 0.1, 0.2))
    bone('pelvis', (0, 0.30, 0.76), (0, 0.12, 0.77), 'root'); bone('spine1', (0, 0.12, 0.77), (0, -0.10, 0.76), 'pelvis'); bone('spine2', (0, -0.10, 0.76), (0, -0.34, 0.78), 'spine1')
    bone('neck1', (0, -0.34, 0.80), (0, -0.58, 1.02), 'spine2'); bone('neck2', (0, -0.58, 1.02), (0, -0.70, 1.14), 'neck1'); bone('head', (0, -0.70, 1.14), (0, -1.05, 1.09), 'neck2')
    bone('tail', (0, 0.58, 0.80), (0, 0.70, 0.70), 'pelvis')
    for sfx, s in (('l', 1), ('r', -1)):
        bone('ear_' + sfx, (s * 0.072, -0.795, 1.222), (s * 0.12, -0.76, 1.34), 'head')
        bone('f_upper_' + sfx, (s * 0.09, -0.33, 0.68), (s * 0.085, -0.335, 0.42), 'spine2'); bone('f_lower_' + sfx, (s * 0.085, -0.335, 0.42), (s * 0.08, -0.335, 0.28), 'f_upper_' + sfx)
        bone('f_cannon_' + sfx, (s * 0.08, -0.335, 0.28), (s * 0.08, -0.33, 0.085), 'f_lower_' + sfx); bone('f_hoof_' + sfx, (s * 0.08, -0.33, 0.085), (s * 0.08, -0.32, 0.0), 'f_cannon_' + sfx)
        bone('h_thigh_' + sfx, (s * 0.11, 0.40, 0.70), (s * 0.10, 0.36, 0.46), 'pelvis'); bone('h_shin_' + sfx, (s * 0.10, 0.36, 0.46), (s * 0.09, 0.54, 0.31), 'h_thigh_' + sfx)
        bone('h_cannon_' + sfx, (s * 0.09, 0.54, 0.31), (s * 0.09, 0.52, 0.085), 'h_shin_' + sfx); bone('h_hoof_' + sfx, (s * 0.09, 0.52, 0.085), (s * 0.09, 0.515, 0.0), 'h_cannon_' + sfx)
    bpy.ops.object.mode_set(mode='OBJECT')
    body = parts[0]
    win = bpy.context.window_manager.windows[0]; area = [a for a in win.screen.areas if a.type == 'VIEW_3D'][0]
    for o in bpy.data.objects: o.select_set(False)
    body.select_set(True); rig.select_set(True); bpy.context.view_layer.objects.active = rig
    with bpy.context.temp_override(window=win, area=area, region=[r for r in area.regions if r.type == 'WINDOW'][0], active_object=rig, object=rig, selected_objects=[body, rig], selected_editable_objects=[body, rig]):
        bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    for o in parts[1:]:
        # rigid attachments: nearest bone = head / ear
        name = 'head'
        if 'Ear' in o.name: name = 'ear_l' if o.location.x > 0 else 'ear_r'
        if o.name.startswith('Hoof_'): _, k, sd = o.name.split('.')[0].split('_'); name = ('f_hoof_' if k == 'f' else 'h_hoof_') + sd
        vg = o.vertex_groups.new(name=name); vg.add(range(len(o.data.vertices)), 1.0, 'REPLACE')
        md = o.modifiers.new('Armature', 'ARMATURE'); md.object = rig; o.parent = rig
    return rig


def build_deer_all(export_path=None):
    for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
    mb = deer_metaball(0.012); body = finalize_body(mb, 16000); bpy.data.objects.remove(mb, do_unlink=True)
    paint_coat(body); mats = deer_materials2(); body.data.materials.clear(); body.data.materials.append(mats['coat'])
    bpy.context.view_layer.objects.active = body; body.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.uv.smart_project(angle_limit=1.0, island_margin=0.005, scale_to_bounds=False); bpy.ops.object.mode_set(mode='OBJECT')
    for l in body.data.uv_layers[0].data: l.uv = (l.uv[0] * 2.5, l.uv[1] * 2.5)
    objs = deer_head_parts(mats) + make_burrs(mats); hoofs = make_hooves(mats); rig = build_deer_rig([body] + objs + hoofs)
    if export_path:
        for pb in rig.pose.bones: pb.rotation_mode = 'XYZ'; pb.rotation_euler = (0, 0, 0)
        for im in bpy.data.images:
            if im.name == 'deer_fur.png' and max(im.size) > 512: im.scale(512, 512)
        meshes = [o for o in bpy.data.objects if o.type == 'MESH']
        for o in bpy.data.objects: o.select_set(False)
        for o in meshes + [rig]: o.select_set(True)
        bpy.context.view_layer.objects.active = rig
        bpy.ops.export_scene.gltf(filepath=export_path, export_format='GLB', use_selection=True, export_apply=True, export_animations=False, export_skins=True, export_yup=True, export_image_format='JPEG', export_jpeg_quality=88, export_materials='EXPORT', export_vertex_color='ACTIVE', export_cameras=False, export_lights=False)
    return rig


def make_hooves(mats):
    """Cloven hooves, one pair of toes per foot."""
    objs = []
    for s in (-1, 1):
        for front in (True, False):
            base = Vector((s * (0.08 if front else 0.09), -0.325 if front else 0.516, 0.0))
            for t in (-1, 1):
                bpy.ops.mesh.primitive_cone_add(radius1=0.021, radius2=0.012, depth=0.095, vertices=14, location=(base.x + t * 0.0105, base.y - 0.004, 0.04))
                h = bpy.context.active_object; h.scale = (0.62, 0.95, 0.9); h.rotation_euler = (-0.12, 0, t * 0.08)
                bpy.ops.object.transform_apply(scale=True, rotation=True)
                bm = bmesh.new(); bm.from_mesh(h.data); bmesh.ops.bevel(bm, geom=bm.edges[:], offset=0.003, segments=2); bm.to_mesh(h.data); bm.free()
                for p in h.data.polygons: p.use_smooth = True
                h.data.materials.append(mats['hoof']); h.name = 'Hoof_%s_%s' % ('f' if front else 'h', 'l' if s > 0 else 'r'); objs.append(h)
    return objs

def make_burrs(mats):
    out = []
    for s in (-1, 1):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.03, segments=16, ring_count=10, location=(s * 0.05, -0.775, 1.255)); b = bpy.context.active_object; b.name = 'Burr'; b.scale = (1.0, 1.0, 0.7)
        bpy.ops.object.transform_apply(scale=True); [setattr(p, 'use_smooth', True) for p in b.data.polygons]; b.data.materials.append(mats['antler']); out.append(b)
    return out


def make_face_details(mats):
    out = []
    for s in (-1, 1):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.0085, segments=12, ring_count=8, location=(s * 0.0125, -1.03, 1.092)); n = bpy.context.active_object; n.name = 'Nostril'; n.scale = (0.9, 0.6, 1.2)
        bpy.ops.object.transform_apply(scale=True); [setattr(p, 'use_smooth', True) for p in n.data.polygons]; n.data.materials.append(mats['eye']); out.append(n)
    return out

exec(open("/Users/talaljawaid/Documents/Talal's Folder/Claude/Experiment 2026/Experiment 3/AI Game/assets/blender/animal_parts.py").read())

def deer_head_parts(mats):
    out = []
    eye_mat = mats['eyevc']
    for s in (-1, 1):
        # eyes with a proper iris and pupil
        e = eyeball('DeerEye', (s * 0.0645, -0.868, 1.19), 0.021, (s, -0.45, 0.05), iris=(0.32, 0.18, 0.07)); e.data.materials.append(eye_mat); out.append(e)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.021, segments=20, ring_count=12, location=(s * 0.0605, -0.866, 1.192)); lid = bpy.context.active_object; lid.name = 'DeerLid'; lid.scale = (0.7, 1.0, 1.0)
        bpy.ops.object.transform_apply(scale=True); _vcol_solid(lid, (0.34, 0.22, 0.12)); lid.data.materials.append(mats['coat']); [setattr(p, 'use_smooth', True) for p in lid.data.polygons]; out.append(lid)
        # ear: broad leaf with a pale lining
        bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=16, radius=1.0)
        for v in bm.verts:
            v.co.z += 1.0; zz = v.co.z / 2.0; w = (0.07 * (1.0 - 0.55 * zz ** 2)) * (1 + 0.15 * math.sin(zz * 3.1)); v.co.x *= 0.012 + 0.014 * zz; v.co.y *= w + 0.006; v.co.z *= 0.092
        me = bpy.data.meshes.new('DeerEar'); bm.to_mesh(me); bm.free(); ear = bpy.data.objects.new('DeerEar', me); bpy.context.scene.collection.objects.link(ear)
        ear.location = (s * 0.07, -0.795, 1.222); ear.rotation_euler = (-0.25, s * 0.62, s * 0.2); [setattr(p, 'use_smooth', True) for p in me.polygons]
        col = me.color_attributes.new('Col', 'BYTE_COLOR', 'POINT')
        for i, v in enumerate(me.vertices):
            inner = smoothstep(0.1, 0.8, v.normal.x * -s); c = tuple((0.42, 0.28, 0.17)[k] * (1 - inner) + (0.80, 0.62, 0.55)[k] * inner for k in range(3))
            if v.co.z > 0.17: c = tuple(c[k] * 0.45 for k in range(3))                 # dark ear tip
            col.data[i].color = (c[0] ** 2.2, c[1] ** 2.2, c[2] ** 2.2, 1)
        me.materials.append(mats['coat']); out.append(ear)
        # antlers: tapered beams with tines, dark at the base and pale at the tips
        grad = lambda t: tuple((0.20, 0.13, 0.08)[k] * (1 - t ** 1.4) + (0.66, 0.56, 0.42)[k] * t ** 1.4 for k in range(3))
        def beam(pts, rad, nm, rough=0.0):
            o = tapered_tube(nm, [(s * p[0], p[1], p[2]) for p in pts], rad, segs=10, subdiv_each=5, color_fn=grad, rough=rough); o.data.materials.append(mats['antlervc']); return o
        out += [beam([(0.045, -0.775, 1.235), (0.072, -0.765, 1.33), (0.11, -0.79, 1.44), (0.14, -0.85, 1.54), (0.15, -0.93, 1.62), (0.13, -1.0, 1.68), (0.105, -1.05, 1.70)], [0.026, 0.022, 0.019, 0.016, 0.013, 0.009, 0.003], 'Beam', 0.18),
                beam([(0.07, -0.80, 1.31), (0.085, -0.88, 1.36), (0.09, -0.95, 1.40)], [0.013, 0.010, 0.003], 'BrowTine', 0.12),
                beam([(0.11, -0.79, 1.44), (0.125, -0.775, 1.52), (0.135, -0.76, 1.60), (0.14, -0.75, 1.68)], [0.014, 0.011, 0.008, 0.003], 'Tine2', 0.14),
                beam([(0.14, -0.85, 1.54), (0.17, -0.84, 1.62), (0.19, -0.83, 1.71), (0.195, -0.825, 1.77)], [0.012, 0.009, 0.006, 0.002], 'Tine3', 0.14),
                beam([(0.15, -0.93, 1.62), (0.175, -0.94, 1.70), (0.185, -0.945, 1.76)], [0.011, 0.008, 0.002], 'Tine4', 0.14),
                beam([(0.13, -1.0, 1.68), (0.12, -1.04, 1.76), (0.115, -1.06, 1.80)], [0.009, 0.006, 0.002], 'Tine5', 0.12)]
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.027, segments=20, ring_count=12, location=(0, -1.034, 1.086)); nz = bpy.context.active_object; nz.name = 'DeerNose'; nz.scale = (1.15, 0.78, 0.76)
    bpy.ops.object.transform_apply(scale=True); nz.data.materials.append(mats['nose']); [setattr(p, 'use_smooth', True) for p in nz.data.polygons]; out.append(nz)
    for s in (-1, 1):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.0085, segments=12, ring_count=8, location=(s * 0.0125, -1.052, 1.092)); n = bpy.context.active_object; n.name = 'Nostril'; n.scale = (0.9, 0.6, 1.2)
        bpy.ops.object.transform_apply(scale=True); [setattr(p, 'use_smooth', True) for p in n.data.polygons]; n.data.materials.append(mats['eye']); out.append(n)
    return out

def _matte(m, spec=0.05):
    b = m.node_tree.nodes['Principled BSDF']; b.inputs['Specular IOR Level'].default_value = spec; return m

def deer_materials2():
    m = deer_materials(); _matte(m['nose'], 0.08); _matte(m['hoof'], 0.12); m['eyevc'] = _mat_vcol('EyeVC', None, 0.06); m['antlervc'] = _mat_vcol('AntlerVC', None, 0.6); return m
