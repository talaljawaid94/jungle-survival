import bpy, bmesh, math, random
from mathutils import Vector, Euler
from mathutils import noise as mnoise
exec(open("/Users/talaljawaid/Documents/Talal's Folder/Claude/Experiment 2026/Experiment 3/AI Game/assets/blender/animal_parts.py").read())

def jaguar_metaball(res=0.011):
    for m in list(bpy.data.metaballs): bpy.data.metaballs.remove(m)
    mb = bpy.data.metaballs.new('Jaguar'); mb.resolution = res; mb.render_resolution = res; mb.threshold = 0.6
    ob = bpy.data.objects.new('JaguarMB', mb); bpy.context.scene.collection.objects.link(ob)
    def el(c, dims, tilt=(0, 0, 0), stiff=2.0):
        e = mb.elements.new(type='ELLIPSOID'); e.co = Vector(c); e.radius = 1.0; e.stiffness = stiff
        e.size_x, e.size_y, e.size_z = (dims[0] / K, dims[1] / K, dims[2] / K); e.rotation = Euler(tilt).to_quaternion(); return e
    def mirror(c, dims, tilt=(0, 0, 0), stiff=2.0):
        for s in (-1, 1): el((s * c[0], c[1], c[2]), dims, (tilt[0], tilt[1] * s, tilt[2] * s), stiff)
    # long, deep-chested torso with a tucked waist
    el((0, -0.32, 0.56), (0.32, 0.36, 0.40)); el((0, 0.0, 0.55), (0.30, 0.50, 0.34)); el((0, 0.30, 0.56), (0.26, 0.36, 0.30))
    mirror((0.13, 0.42, 0.50), (0.16, 0.30, 0.32), (0.15, 0, 0)); mirror((0.13, -0.30, 0.52), (0.17, 0.30, 0.34), (-0.15, 0, 0)); el((0, -0.04, 0.44), (0.24, 0.55, 0.17))
    # neck and head: broad skull, short strong muzzle
    el((0, -0.55, 0.60), (0.31, 0.28, 0.33), (-0.3, 0, 0)); el((0, -0.74, 0.62), (0.23, 0.23, 0.20), (0.1, 0, 0))
    el((0, -0.90, 0.575), (0.13, 0.19, 0.105), (0.22, 0, 0)); el((0, -0.88, 0.525), (0.105, 0.22, 0.065), (0.15, 0, 0)); mirror((0.095, -0.77, 0.57), (0.12, 0.17, 0.15)); mirror((0.075, -0.80, 0.665), (0.07, 0.10, 0.05)); el((0, -0.985, 0.585), (0.075, 0.05, 0.058)); mirror((0.04, -0.93, 0.56), (0.05, 0.10, 0.07))
    # limbs: heavy forearms, big paws
    mirror((0.12, -0.34, 0.40), (0.12, 0.15, 0.28)); mirror((0.11, -0.34, 0.22), (0.085, 0.095, 0.2)); mirror((0.11, -0.36, 0.09), (0.085, 0.12, 0.085)); mirror((0.11, -0.385, 0.05), (0.105, 0.15, 0.08))
    for s_ in (-1, 1):
        for tx in (-0.034, 0.0, 0.034): el((s_ * 0.11 + tx, -0.44, 0.034 + (0.006 if tx == 0 else 0)), (0.036, 0.075, 0.045), (0, 0, 0), 2.4)
    mirror((0.13, 0.40, 0.38), (0.14, 0.22, 0.30), (-0.2, 0, 0)); mirror((0.12, 0.46, 0.22), (0.08, 0.095, 0.2), (0.3, 0, 0)); mirror((0.12, 0.45, 0.09), (0.085, 0.12, 0.085)); mirror((0.12, 0.43, 0.05), (0.105, 0.15, 0.08))
    for s_ in (-1, 1):
        for tx in (-0.034, 0.0, 0.034): el((s_ * 0.12 + tx, 0.375, 0.034 + (0.006 if tx == 0 else 0)), (0.036, 0.075, 0.045), (0, 0, 0), 2.4)
    return ob

def paint_jaguar(body):
    me = body.data; col = me.color_attributes.new('Col', 'BYTE_COLOR', 'POINT')
    for i, v in enumerate(me.vertices):
        x, y, z = v.co; n = v.normal; up = n.z
        tan = Vector((0.80, 0.56, 0.22)); cream = Vector((0.93, 0.84, 0.66))
        c = tan * (0.82 + 0.25 * smoothstep(0.0, 0.9, up)); belly = smoothstep(0.1, -0.7, up)
        c = c.lerp(cream, belly)
        if z < 0.32: c = c.lerp(cream, smoothstep(0.32, 0.12, z) * 0.25) if abs(x) < 0.0 else c
        if y < -0.88 and z < 0.62: c = c.lerp(cream, 0.85 * smoothstep(-0.88, -0.93, y))                 # pale muzzle and chin
        if y < -0.9 and z > 0.57 and abs(x) < 0.04: c = c.lerp(Vector((0.14, 0.08, 0.07)), 0.9)           # nose bridge tip
        for ex in (-0.07, 0.07):                                                                           # tear lines under the eyes
            dd = math.hypot(x - ex * 1.0, (y + 0.80) * 0.9, (z - 0.58) * 1.3)
            if dd < 0.045 and z < 0.625: c = c.lerp(Vector((0.10, 0.07, 0.05)), 0.6 * (1 - dd / 0.045))
        if z < 0.06 and ((y < -0.40 and y > -0.55) or (0.35 < y < 0.50)) and abs(math.sin((abs(x) - 0.11) * 95)) > 0.93 and (y < -0.43 or y > 0.38): c = c * 0.45
        n1 = mnoise.noise(Vector((x * 8, y * 8, z * 8))) * 0.08
        c = c * (1 + n1)
        for k in range(3): c[k] = max(0.0, min(1.0, c[k]))
        col.data[i].color = (c[0] ** 2.2, c[1] ** 2.2, c[2] ** 2.2, 1.0)

def jaguar_extras(mats, body):
    out = []
    def surf(co, inward=0.0):
        ok, loc, nrm, idx = body.closest_point_on_mesh(Vector(co)); return loc - nrm * inward, nrm
    for s in (-1, 1):
        pe, ne = surf((s * 0.098, -0.805, 0.636), 0.008); e = eyeball('JagEye', pe, 0.0195, ne, iris=(0.78, 0.52, 0.10), rim=(0.06, 0.04, 0.02), sclera=(0.6, 0.5, 0.3)); e.data.materials.append(mats['eyevc']); out.append(e)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.026, segments=16, ring_count=10, location=surf((s * 0.098, -0.805, 0.642), 0.017)[0]); lid = bpy.context.active_object; lid.name = 'JagLid'; lid.scale = (0.7, 1.0, 0.8)
        bpy.ops.object.transform_apply(scale=True); _vcol_solid(lid, (0.55, 0.38, 0.17)); lid.data.materials.append(mats['coat']); [setattr(p, 'use_smooth', True) for p in lid.data.polygons]; out.append(lid)
        # rounded ears: dark back with a pale spot, pale inside
        bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=20, v_segments=14, radius=1.0)
        for v in bm.verts: v.co.z += 0.4; v.co.x *= 0.026 + 0.014 * v.co.z; v.co.y *= 0.07; v.co.z *= 0.068
        me = bpy.data.meshes.new('JagEar'); bm.to_mesh(me); bm.free(); ear = bpy.data.objects.new('JagEar', me); bpy.context.scene.collection.objects.link(ear)
        ear.location = (s * 0.118, -0.69, 0.715); ear.rotation_euler = (-0.15, s * 0.45, s * 0.15); [setattr(p, 'use_smooth', True) for p in me.polygons]
        col = me.color_attributes.new('Col', 'BYTE_COLOR', 'POINT')
        for i, v in enumerate(me.vertices):
            inner = smoothstep(0.1, 0.8, v.normal.x * s) ; spot = smoothstep(0.55, 0.3, math.hypot(v.co.y * 1.0, v.co.z - 0.05) * 22)
            c = tuple((0.10, 0.07, 0.05)[k] * (1 - inner) + (0.80, 0.62, 0.50)[k] * inner for k in range(3))
            if inner < 0.3 and spot > 0.5: c = (0.85, 0.78, 0.65)
            col.data[i].color = (c[0] ** 2.2, c[1] ** 2.2, c[2] ** 2.2, 1)
        me.materials.append(mats['coat']); out.append(ear)
        # whiskers
        for k in range(5):
            a = -0.35 + k * 0.18; base = surf((s * 0.055, -0.90, 0.565), 0.002)[0]
            w = tapered_tube('Whisker', [base, base + Vector((s * 0.06, -0.05 + a * 0.05, a * 0.03)), base + Vector((s * 0.13, -0.07 + a * 0.08, a * 0.07 - 0.02))], [0.0011, 0.0008, 0.0003], segs=4, subdiv_each=3, color_fn=lambda t: (0.95, 0.92, 0.85))
            w.data.materials.append(mats['mane']); out.append(w)
    for s in (-1, 1):
        for front in (True, False):
            px = s * 0.11 if front else s * 0.12; py = -0.44 if front else 0.375
            for t in (-1.0, 0.0, 1.0):
                base = Vector((px + t * 0.034, py - 0.035, 0.03))
                cl = tapered_tube('Toe_%s_%s_claw' % ('f' if front else 'h', 'l' if s > 0 else 'r'), [base, base + Vector((t * 0.002, -0.022, -0.006)), base + Vector((t * 0.004, -0.036, -0.022))], [0.0062, 0.0042, 0.0008], segs=8, subdiv_each=3, color_fn=lambda u: (0.95, 0.9, 0.78))
                cl.data.materials.append(mats['mane']); out.append(cl)
            # pad (dark) under the paw
            bpy.ops.mesh.primitive_uv_sphere_add(radius=0.03, segments=14, ring_count=8, location=(px, py + 0.07, 0.008)); pad = bpy.context.active_object
            pad.name = 'Toe_%s_%s_pad' % ('f' if front else 'h', 'l' if s > 0 else 'r'); pad.scale = (1.2, 1.5, 0.35); bpy.ops.object.transform_apply(scale=True)
            [setattr(p, 'use_smooth', True) for p in pad.data.polygons]; pad.data.materials.append(mats['nose']); out.append(pad)
    # nose
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.026, segments=16, ring_count=10, location=surf((0, -1.03, 0.585), 0.004)[0]); nz = bpy.context.active_object; nz.name = 'JagNose'; nz.scale = (1.2, 0.8, 0.8)
    bpy.ops.object.transform_apply(scale=True); nz.data.materials.append(mats['nose']); [setattr(p, 'use_smooth', True) for p in nz.data.polygons]; out.append(nz)
    # long tail with a dark tip, spotted then ringed
    ring = lambda t: (0.10, 0.07, 0.05) if (t > 0.92 or (t > 0.45 and int(t * 18) % 2 == 0)) else (0.80, 0.56, 0.22)
    tail = tapered_tube('JagTail', [(0, 0.55, 0.57), (0, 0.76, 0.62), (0, 0.98, 0.52), (0, 1.18, 0.38), (0, 1.30, 0.22)], [0.066, 0.060, 0.054, 0.047, 0.036], segs=12, subdiv_each=8, color_fn=ring)
    tail.data.materials.append(mats['mane']); out.append(tail)
    return out

def jaguar_materials():
    return {'coat': _mat_vcol('JagCoat', TEXD + 'jaguar_coat.png', 0.9), 'eyevc': _mat_vcol('EyeVC3', None, 0.06), 'mane': _mat_vcol('JagPlain', None, 0.85),
            'nose': _flat('JagNose', (0.05, 0.022, 0.022), 0.7)}

def build_jaguar_rig(parts):
    arm = bpy.data.armatures.new('JagRig'); rig = bpy.data.objects.new('JagRig', arm); bpy.context.scene.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig; rig.select_set(True); bpy.ops.object.mode_set(mode='EDIT'); B = {}
    def bone(name, head, tail, parent=None):
        eb = arm.edit_bones.new(name); eb.head = Vector(head); eb.tail = Vector(tail)
        if parent: eb.parent = B[parent]
        B[name] = eb
    bone('root', (0, 0.1, 0.0), (0, 0.1, 0.15)); bone('pelvis', (0, 0.40, 0.56), (0, 0.20, 0.56), 'root'); bone('spine1', (0, 0.20, 0.56), (0, -0.05, 0.56), 'pelvis'); bone('spine2', (0, -0.05, 0.56), (0, -0.36, 0.58), 'spine1')
    bone('neck', (0, -0.40, 0.58), (0, -0.62, 0.61), 'spine2'); bone('head', (0, -0.62, 0.61), (0, -0.95, 0.58), 'neck')
    bone('tail1', (0, 0.55, 0.57), (0, 0.80, 0.60), 'pelvis'); bone('tail2', (0, 0.80, 0.60), (0, 1.05, 0.48), 'tail1'); bone('tail3', (0, 1.05, 0.48), (0, 1.30, 0.22), 'tail2')
    for sfx, s in (('l', 1), ('r', -1)):
        bone('ear_' + sfx, (s * 0.115, -0.69, 0.725), (s * 0.15, -0.67, 0.79), 'head')
        bone('f_upper_' + sfx, (s * 0.12, -0.34, 0.50), (s * 0.115, -0.34, 0.30), 'spine2'); bone('f_lower_' + sfx, (s * 0.115, -0.34, 0.30), (s * 0.11, -0.345, 0.10), 'f_upper_' + sfx); bone('f_paw_' + sfx, (s * 0.11, -0.345, 0.10), (s * 0.11, -0.40, 0.0), 'f_lower_' + sfx)
        bone('h_thigh_' + sfx, (s * 0.13, 0.40, 0.50), (s * 0.12, 0.44, 0.29), 'pelvis'); bone('h_shin_' + sfx, (s * 0.12, 0.44, 0.29), (s * 0.12, 0.46, 0.10), 'h_thigh_' + sfx); bone('h_paw_' + sfx, (s * 0.12, 0.46, 0.10), (s * 0.12, 0.40, 0.0), 'h_shin_' + sfx)
    bpy.ops.object.mode_set(mode='OBJECT')
    body = parts[0]; win = bpy.context.window_manager.windows[0]; area = [a for a in win.screen.areas if a.type == 'VIEW_3D'][0]
    for o in bpy.data.objects: o.select_set(False)
    body.select_set(True); rig.select_set(True); bpy.context.view_layer.objects.active = rig
    with bpy.context.temp_override(window=win, area=area, region=[r for r in area.regions if r.type == 'WINDOW'][0], active_object=rig, object=rig, selected_objects=[body, rig], selected_editable_objects=[body, rig]):
        bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    for o in parts[1:]:
        md = o.modifiers.new('Armature', 'ARMATURE'); md.object = rig; o.parent = rig
        if o.name.startswith('JagTail'):                                  # blend the tail between its three bones by distance along it
            g1 = o.vertex_groups.new(name='tail1'); g2 = o.vertex_groups.new(name='tail2'); g3 = o.vertex_groups.new(name='tail3')
            for v in o.data.vertices:
                t = max(0.0, min(1.0, (v.co.y - 0.55) / 0.75)); w2 = 1 - abs(t - 0.5) * 3.0; w2 = max(0.0, w2); w1 = max(0.0, 1 - t * 3.0); w3 = max(0.0, t * 3.0 - 1.0 - 0.0)
                tot = w1 + w2 + w3 + 1e-6
                for g, w in ((g1, w1), (g2, w2), (g3, w3)):
                    if w > 0: g.add([v.index], w / tot, 'REPLACE')
            continue
        name = 'head'
        if 'Ear' in o.name: name = 'ear_l' if o.location.x > 0 else 'ear_r'
        elif o.name.startswith('Toe_'): _, k, sd = o.name.split('.')[0].split('_')[:3]; name = ('f_paw_' if k == 'f' else 'h_paw_') + sd
        vg = o.vertex_groups.new(name=name); vg.add(range(len(o.data.vertices)), 1.0, 'REPLACE')
    return rig

def build_jaguar_all(export_path=None):
    for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
    mb = jaguar_metaball(0.010); body = finalize_body(mb, 22000); bpy.data.objects.remove(mb, do_unlink=True)
    paint_jaguar(body); mats = jaguar_materials(); body.data.materials.clear(); body.data.materials.append(mats['coat'])
    bpy.context.view_layer.objects.active = body; body.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.uv.smart_project(angle_limit=1.0, island_margin=0.005, scale_to_bounds=False); bpy.ops.object.mode_set(mode='OBJECT')
    for l in body.data.uv_layers[0].data: l.uv = (l.uv[0] * 2.3, l.uv[1] * 2.3)
    extras = jaguar_extras(mats, body); rig = build_jaguar_rig([body] + extras)
    if export_path:
        for pb in rig.pose.bones: pb.rotation_mode = 'XYZ'; pb.rotation_euler = (0, 0, 0)
        for im in bpy.data.images:
            if im.name == 'jaguar_coat.png' and max(im.size) > 1024: im.scale(1024, 1024)
        meshes = [o for o in bpy.data.objects if o.type == 'MESH']
        for o in bpy.data.objects: o.select_set(False)
        for o in meshes + [rig]: o.select_set(True)
        bpy.context.view_layer.objects.active = rig
        bpy.ops.export_scene.gltf(filepath=export_path, export_format='GLB', use_selection=True, export_apply=True, export_animations=False, export_skins=True, export_yup=True, export_image_format='JPEG', export_jpeg_quality=90, export_materials='EXPORT', export_vertex_color='ACTIVE', export_cameras=False, export_lights=False)
    return rig
