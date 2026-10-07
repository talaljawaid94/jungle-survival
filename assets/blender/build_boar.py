import bpy, bmesh, math
from mathutils import Vector, Euler
from mathutils import noise as mnoise

exec(open("/Users/talaljawaid/Documents/Talal's Folder/Claude/Experiment 2026/Experiment 3/AI Game/assets/blender/animal_parts.py").read())

def boar_metaball(res=0.012):
    for m in list(bpy.data.metaballs): bpy.data.metaballs.remove(m)
    mb = bpy.data.metaballs.new('Boar'); mb.resolution = res; mb.render_resolution = res; mb.threshold = 0.6
    ob = bpy.data.objects.new('BoarMB', mb); bpy.context.scene.collection.objects.link(ob)
    def el(c, dims, tilt=(0, 0, 0), stiff=2.0):
        e = mb.elements.new(type='ELLIPSOID'); e.co = Vector(c); e.radius = 1.0; e.stiffness = stiff
        e.size_x, e.size_y, e.size_z = (dims[0] / K, dims[1] / K, dims[2] / K); e.rotation = Euler(tilt).to_quaternion(); return e
    def mirror(c, dims, tilt=(0, 0, 0), stiff=2.0):
        for s in (-1, 1): el((s * c[0], c[1], c[2]), dims, (tilt[0], tilt[1] * s, tilt[2] * s), stiff)
    # torso: heavy front with a raised shoulder hump, sloping to a smaller rump
    el((0, -0.02, 0.52), (0.40, 0.62, 0.44)); el((0, -0.30, 0.60), (0.40, 0.42, 0.50)); el((0, 0.36, 0.50), (0.32, 0.38, 0.36)); el((0, -0.04, 0.40), (0.32, 0.54, 0.26))
    mirror((0.15, -0.28, 0.50), (0.20, 0.32, 0.40), (-0.15, 0, 0)); mirror((0.13, 0.40, 0.45), (0.17, 0.30, 0.34), (0.15, 0, 0))
    # neck, head, snout
    el((0, -0.55, 0.58), (0.34, 0.32, 0.36), (-0.15, 0, 0)); el((0, -0.77, 0.53), (0.26, 0.30, 0.28), (0.1, 0, 0))
    el((0, -0.96, 0.455), (0.16, 0.30, 0.16), (0.25, 0, 0)); el((0, -1.09, 0.42), (0.135, 0.07, 0.115)); mirror((0.07, -0.99, 0.40), (0.07, 0.16, 0.07), (0.2, 0, 0)); mirror((0.095, -0.82, 0.455), (0.13, 0.22, 0.17))
    # legs: short and strong
    mirror((0.12, -0.30, 0.34), (0.11, 0.14, 0.26)); mirror((0.11, -0.30, 0.18), (0.075, 0.085, 0.2)); mirror((0.115, -0.31, 0.275), (0.085, 0.09, 0.07)); mirror((0.11, -0.30, 0.085), (0.07, 0.08, 0.07))
    mirror((0.13, 0.40, 0.34), (0.13, 0.19, 0.26)); mirror((0.12, 0.44, 0.19), (0.075, 0.09, 0.2)); mirror((0.12, 0.44, 0.085), (0.07, 0.08, 0.07))
    el((0, 0.58, 0.54), (0.06, 0.10, 0.10), (-0.4, 0, 0))
    return ob

def paint_boar(body):
    me = body.data; col = me.color_attributes.new('Col', 'BYTE_COLOR', 'POINT')
    for i, v in enumerate(me.vertices):
        x, y, z = v.co; n = v.normal; up = n.z
        base = Vector((0.47, 0.38, 0.29))
        c = base * (0.8 + 0.35 * smoothstep(0.0, 0.9, up)) + Vector((0.36, 0.30, 0.23)) * smoothstep(0.0, -0.8, up)
        if z < 0.2: c = c.lerp(Vector((0.12, 0.10, 0.09)), smoothstep(0.2, 0.08, z) * 0.85)
        if z < 0.055: c = Vector((0.05, 0.045, 0.04))
        if y < -0.9: c = c.lerp(Vector((0.17, 0.13, 0.11)), smoothstep(-0.9, -1.05, y) * 0.85)
        if y < -0.62 and z > 0.5 and abs(x) < 0.08: c = c.lerp(Vector((0.17, 0.13, 0.1)), 0.5)
        if abs(x) < 0.07 and up > 0.5 and -0.6 < y < 0.5: c = c.lerp(Vector((0.12, 0.09, 0.07)), 0.7 * smoothstep(0.07, 0.0, abs(x)))
        if y < -1.115: c = c.lerp(Vector((0.34, 0.24, 0.22)), 0.9)
        if y < -0.8 and abs(x) > 0.1 and 0.3 < z < 0.5: c = c.lerp(Vector((0.55, 0.47, 0.37)), 0.45)
        if y < -0.95 and abs(z - 0.405) < 0.008 and abs(x) > 0.004: c = c.lerp(Vector((0.08, 0.05, 0.045)), 0.9)
        if -1.1 < y < -0.95 and z > 0.47 and abs(math.sin(y * 70)) > 0.85: c = c * 0.78
        n1 = mnoise.noise(Vector((x * 7, y * 7, z * 7))) * 0.12 + mnoise.noise(Vector((x * 26, y * 26, z * 26))) * 0.05
        c = c * (1 + n1)
        for k in range(3): c[k] = max(0.0, min(1.0, c[k]))
        col.data[i].color = (c[0] ** 2.2, c[1] ** 2.2, c[2] ** 2.2, 1.0)

def boar_extras(mats, body=None):
    out = []
    def surf(co, inward=0.0):
        ok, loc, nrm, idx = body.closest_point_on_mesh(Vector(co)); return loc - nrm * inward, nrm
    ivory = lambda t: tuple((0.62, 0.55, 0.38)[k] * (1 - t) + (0.93, 0.90, 0.80)[k] * t for k in range(3))
    for s in (-1, 1):
        pe, ne = surf((s * 0.13, -0.862, 0.572), 0.006); e = eyeball('BoarEye', pe, 0.0165, ne, iris=(0.22, 0.14, 0.07), sclera=(0.08, 0.06, 0.05)); e.data.materials.append(mats['eyevc']); out.append(e)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.022, segments=16, ring_count=10, location=surf((s * 0.13, -0.862, 0.575), 0.013)[0]); l = bpy.context.active_object; l.name = 'BoarLid'; l.scale = (0.7, 1.0, 0.85)
        bpy.ops.object.transform_apply(scale=True); _vcol_solid(l, (0.30, 0.24, 0.18)); l.data.materials.append(mats['coat']); [setattr(p, 'use_smooth', True) for p in l.data.polygons]; out.append(l)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.03, segments=16, ring_count=10, location=surf((s * 0.12, -0.855, 0.612), 0.012)[0]); br = bpy.context.active_object; br.name = 'BoarBrow'; br.scale = (0.8, 1.3, 0.45)
        bpy.ops.object.transform_apply(scale=True); _vcol_solid(br, (0.22, 0.17, 0.13)); br.data.materials.append(mats['coat']); [setattr(p, 'use_smooth', True) for p in br.data.polygons]; out.append(br)
        # ear: rounded leaf, dark pink lining, fur tuft tip
        bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=20, v_segments=14, radius=1.0)
        for v in bm.verts: v.co.z += 1.0; zz = v.co.z / 2.0; v.co.x *= 0.010 + 0.012 * zz; v.co.y *= 0.052 * (1 - 0.6 * zz ** 2) + 0.006; v.co.z *= 0.075
        me = bpy.data.meshes.new('BoarEar'); bm.to_mesh(me); bm.free(); ear = bpy.data.objects.new('BoarEar', me); bpy.context.scene.collection.objects.link(ear)
        ear.location = (s * 0.115, -0.74, 0.655); ear.rotation_euler = (-0.30, s * 0.5, s * 0.1); [setattr(p, 'use_smooth', True) for p in me.polygons]
        col = me.color_attributes.new('Col', 'BYTE_COLOR', 'POINT')
        for i, v in enumerate(me.vertices):
            inner = smoothstep(0.1, 0.8, v.normal.x * -s); c = tuple((0.30, 0.23, 0.17)[k] * (1 - inner) + (0.32, 0.22, 0.19)[k] * inner for k in range(3))
            if v.co.z > 0.12: c = tuple(c[k] * 0.55 for k in range(3))
            col.data[i].color = (c[0] ** 2.2, c[1] ** 2.2, c[2] ** 2.2, 1)
        me.materials.append(mats['coat']); out.append(ear)
        # tusks: curved, tapered, ivory (upper pair large, lower pair short)
        up = tapered_tube('Tusk', [(s * 0.058, -1.03, 0.405), (s * 0.085, -1.07, 0.44), (s * 0.10, -1.085, 0.50), (s * 0.095, -1.07, 0.57)], [0.017, 0.015, 0.010, 0.003], segs=10, subdiv_each=5, color_fn=ivory)
        up.data.materials.append(mats['eyevc']); out.append(up)
        lo = tapered_tube('Tusk', [(s * 0.075, -1.06, 0.38), (s * 0.088, -1.075, 0.40), (s * 0.09, -1.08, 0.435)], [0.011, 0.008, 0.002], segs=8, subdiv_each=4, color_fn=ivory); lo.data.materials.append(mats['eyevc']); out.append(lo)
        # nostrils
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.012, segments=12, ring_count=8, location=surf((s * 0.03, -1.13, 0.42), 0.004)[0]); n = bpy.context.active_object; n.name = 'Nostril'; n.scale = (0.9, 0.5, 1.2)
        bpy.ops.object.transform_apply(scale=True); n.data.materials.append(mats['eye']); [setattr(p, 'use_smooth', True) for p in n.data.polygons]; out.append(n)
    # bristle mane along the spine: many tapered strands with a little randomness
    import random; rnd = random.Random(5)
    for i in range(52):
        t = i / 51; y = -0.56 + t * 0.95; z = 0.795 - 0.24 * t + 0.0; h = (0.10 - 0.04 * t) * (0.8 + 0.4 * rnd.random()); lean = 0.5 + 0.25 * rnd.random()
        x = rnd.uniform(-0.012, 0.012)
        dark = lambda tt: tuple((0.07, 0.055, 0.045)[k] * (1 - tt) + (0.20, 0.15, 0.11)[k] * tt for k in range(3))
        b = tapered_tube('Bristle', [(x, y, z - 0.01), (x, y + h * 0.5 * lean * 0.6, z + h * 0.55), (x, y + h * lean, z + h)], [0.019, 0.012, 0.002], segs=6, subdiv_each=2, color_fn=dark)
        b.data.materials.append(mats['mane']); out.append(b)
    # tail with tuft
    cu = bpy.data.curves.new('Tail', 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = 0.012; cu.bevel_resolution = 4; cu.use_fill_caps = True
    sp = cu.splines.new('BEZIER'); pts = [(0, 0.60, 0.56), (0, 0.68, 0.55), (0, 0.72, 0.46), (0, 0.72, 0.38)]; sp.bezier_points.add(3)
    for i, (bp, p) in enumerate(zip(sp.bezier_points, pts)): bp.co = Vector(p); bp.radius = 1.0 - 0.5 * i / 3; bp.handle_left_type = bp.handle_right_type = 'AUTO'
    to = bpy.data.objects.new('TailC', cu); bpy.context.scene.collection.objects.link(to)
    tm = bpy.data.meshes.new_from_object(to.evaluated_get(bpy.context.evaluated_depsgraph_get())); tail = bpy.data.objects.new('BoarTail', tm); bpy.context.scene.collection.objects.link(tail)
    [setattr(p, 'use_smooth', True) for p in tm.polygons]; _vcol_solid(tail, (0.2, 0.15, 0.12)); tm.materials.append(mats['coat']); out.append(tail); bpy.data.objects.remove(to, do_unlink=True)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.026, segments=12, ring_count=8, location=(0, 0.725, 0.36)); tu = bpy.context.active_object; tu.name = 'TailTuft'; tu.scale = (1, 1, 2.2)
    bpy.ops.object.transform_apply(scale=True); _vcol_solid(tu, (0.1, 0.08, 0.07)); tu.data.materials.append(mats['coat']); out.append(tu)
    # cloven hooves + dewclaws
    for s in (-1, 1):
        for front in (True, False):
            base = Vector((s * (0.11 if front else 0.12), -0.30 if front else 0.44, 0.0))
            for t in (-1, 1):
                bpy.ops.mesh.primitive_cone_add(radius1=0.034, radius2=0.022, depth=0.075, vertices=14, location=(base.x + t * 0.017, base.y - 0.006, 0.035))
                h = bpy.context.active_object; h.scale = (0.7, 1.0, 0.9); h.rotation_euler = (-0.1, 0, t * 0.08); bpy.ops.object.transform_apply(scale=True, rotation=True)
                [setattr(p, 'use_smooth', True) for p in h.data.polygons]; h.data.materials.append(mats['hoof']); h.name = 'Hoof_%s_%s' % ('f' if front else 'h', 'l' if s > 0 else 'r'); out.append(h)
    return out

def boar_materials():
    return {'mane': _mat_vcol('Mane', None, 0.9), 'eyevc': _mat_vcol('EyeVC2', None, 0.08), 'coat': _mat_vcol('BoarCoat', TEXD + 'boar_fur.png', 0.95), 'eye': _flat('BoarEye', (0.015, 0.01, 0.008), 0.08), 'tusk': _flat('Tusk', (0.62, 0.58, 0.46), 0.45),
            'snout': _flat('Snout', (0.09, 0.06, 0.055), 0.6), 'bristle': _flat('Bristle', (0.10, 0.08, 0.065), 0.9), 'hoof': _flat('Hoof', (0.018, 0.014, 0.012), 0.65)}

def build_boar_rig(parts):
    arm = bpy.data.armatures.new('BoarRig'); rig = bpy.data.objects.new('BoarRig', arm); bpy.context.scene.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig; rig.select_set(True); bpy.ops.object.mode_set(mode='EDIT'); B = {}
    def bone(name, head, tail, parent=None):
        eb = arm.edit_bones.new(name); eb.head = Vector(head); eb.tail = Vector(tail)
        if parent: eb.parent = B[parent]
        B[name] = eb
    bone('root', (0, 0.1, 0.0), (0, 0.1, 0.15)); bone('pelvis', (0, 0.36, 0.52), (0, 0.15, 0.54), 'root'); bone('spine1', (0, 0.15, 0.54), (0, -0.10, 0.56), 'pelvis'); bone('spine2', (0, -0.10, 0.56), (0, -0.33, 0.58), 'spine1')
    bone('neck', (0, -0.38, 0.58), (0, -0.62, 0.56), 'spine2'); bone('head', (0, -0.62, 0.56), (0, -1.18, 0.41), 'neck'); bone('tail', (0, 0.58, 0.54), (0, 0.72, 0.38), 'pelvis')
    for sfx, s in (('l', 1), ('r', -1)):
        bone('ear_' + sfx, (s * 0.115, -0.74, 0.665), (s * 0.15, -0.72, 0.76), 'head')
        bone('f_upper_' + sfx, (s * 0.12, -0.30, 0.46), (s * 0.11, -0.30, 0.26), 'spine2'); bone('f_lower_' + sfx, (s * 0.11, -0.30, 0.26), (s * 0.11, -0.30, 0.085), 'f_upper_' + sfx); bone('f_hoof_' + sfx, (s * 0.11, -0.30, 0.085), (s * 0.11, -0.30, 0.0), 'f_lower_' + sfx)
        bone('h_thigh_' + sfx, (s * 0.13, 0.40, 0.50), (s * 0.12, 0.42, 0.28), 'pelvis'); bone('h_shin_' + sfx, (s * 0.12, 0.42, 0.28), (s * 0.12, 0.44, 0.085), 'h_thigh_' + sfx); bone('h_hoof_' + sfx, (s * 0.12, 0.44, 0.085), (s * 0.12, 0.44, 0.0), 'h_shin_' + sfx)
    bpy.ops.object.mode_set(mode='OBJECT')
    body = parts[0]; win = bpy.context.window_manager.windows[0]; area = [a for a in win.screen.areas if a.type == 'VIEW_3D'][0]
    for o in bpy.data.objects: o.select_set(False)
    body.select_set(True); rig.select_set(True); bpy.context.view_layer.objects.active = rig
    with bpy.context.temp_override(window=win, area=area, region=[r for r in area.regions if r.type == 'WINDOW'][0], active_object=rig, object=rig, selected_objects=[body, rig], selected_editable_objects=[body, rig]):
        bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    for o in parts[1:]:
        name = 'head'
        if 'Ear' in o.name: name = 'ear_l' if o.location.x > 0 else 'ear_r'
        elif o.name.startswith('Hoof_'): _, k, sd = o.name.split('.')[0].split('_'); name = ('f_hoof_' if k == 'f' else 'h_hoof_') + sd
        elif o.name.startswith('Bristle'): name = 'spine1' if o.data.vertices[0].co.y > 0.0 else 'spine2'
        elif 'Tail' in o.name: name = 'tail'
        vg = o.vertex_groups.new(name=name); vg.add(range(len(o.data.vertices)), 1.0, 'REPLACE'); md = o.modifiers.new('Armature', 'ARMATURE'); md.object = rig; o.parent = rig
    return rig

def build_boar_all(export_path=None):
    for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
    mb = boar_metaball(0.011); body = finalize_body(mb, 16000); bpy.data.objects.remove(mb, do_unlink=True)
    paint_boar(body); mats = boar_materials(); body.data.materials.clear(); body.data.materials.append(mats['coat'])
    bpy.context.view_layer.objects.active = body; body.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.uv.smart_project(angle_limit=1.0, island_margin=0.005, scale_to_bounds=False); bpy.ops.object.mode_set(mode='OBJECT')
    for l in body.data.uv_layers[0].data: l.uv = (l.uv[0] * 2.5, l.uv[1] * 2.5)
    extras = boar_extras(mats, body); rig = build_boar_rig([body] + extras)
    if export_path:
        for pb in rig.pose.bones: pb.rotation_mode = 'XYZ'; pb.rotation_euler = (0, 0, 0)
        for im in bpy.data.images:
            if im.name == 'boar_fur.png' and max(im.size) > 512: im.scale(512, 512)
        meshes = [o for o in bpy.data.objects if o.type == 'MESH']
        for o in bpy.data.objects: o.select_set(False)
        for o in meshes + [rig]: o.select_set(True)
        bpy.context.view_layer.objects.active = rig
        bpy.ops.export_scene.gltf(filepath=export_path, export_format='GLB', use_selection=True, export_apply=True, export_animations=False, export_skins=True, export_yup=True, export_image_format='JPEG', export_jpeg_quality=88, export_materials='EXPORT', export_vertex_color='ACTIVE', export_cameras=False, export_lights=False)
    return rig
