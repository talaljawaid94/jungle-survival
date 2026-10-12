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
    el((0, -0.30, 0.56), (0.28, 0.40, 0.42)); el((0, 0.0, 0.54), (0.23, 0.52, 0.30)); el((0, 0.32, 0.56), (0.25, 0.36, 0.30)); mirror((0.10, -0.30, 0.66), (0.12, 0.26, 0.20), (0.1, 0, 0))
    mirror((0.11, 0.42, 0.50), (0.14, 0.30, 0.30), (0.15, 0, 0)); mirror((0.11, -0.30, 0.52), (0.13, 0.30, 0.34), (-0.15, 0, 0)); el((0, -0.04, 0.44), (0.19, 0.55, 0.14))
    # neck and head: broad skull, short strong muzzle
    el((0, -0.55, 0.60), (0.28, 0.30, 0.34), (-0.3, 0, 0)); el((0, -0.76, 0.615), (0.20, 0.26, 0.19), (0.08, 0, 0))
    el((0, -0.935, 0.565), (0.115, 0.23, 0.095), (0.16, 0, 0)); el((0, -0.90, 0.512), (0.10, 0.23, 0.06), (0.1, 0, 0)); mirror((0.085, -0.79, 0.545), (0.09, 0.20, 0.13)); mirror((0.075, -0.83, 0.655), (0.075, 0.12, 0.045), (0.2, 0, 0)); el((0, -1.0, 0.58), (0.095, 0.05, 0.06)); mirror((0.05, -0.955, 0.545), (0.065, 0.13, 0.08))
    # muscle definition: shoulder blade ridge, brisket, elbow, thigh, hock
    mirror((0.115, -0.27, 0.71), (0.07, 0.22, 0.11), (0.25, 0, 0)); el((0, -0.40, 0.42), (0.17, 0.30, 0.20)); mirror((0.10, -0.30, 0.33), (0.085, 0.10, 0.09)); mirror((0.135, 0.40, 0.46), (0.11, 0.27, 0.28), (-0.15, 0, 0)); mirror((0.115, 0.47, 0.30), (0.07, 0.09, 0.09))
    # limbs: heavy forearms, big paws
    mirror((0.12, -0.34, 0.40), (0.125, 0.16, 0.30)); mirror((0.105, -0.34, 0.22), (0.085, 0.10, 0.22)); mirror((0.10, -0.36, 0.09), (0.085, 0.12, 0.09)); mirror((0.10, -0.385, 0.05), (0.11, 0.16, 0.085))
    for s_ in (-1, 1):
        for tx in (-0.04, 0.0, 0.04): el((s_ * 0.11 + tx, -0.44, 0.034 + (0.006 if tx == 0 else 0)), (0.036, 0.075, 0.045), (0, 0, 0), 2.4)
    mirror((0.125, 0.40, 0.38), (0.15, 0.24, 0.32), (-0.2, 0, 0)); mirror((0.11, 0.46, 0.22), (0.085, 0.10, 0.22), (0.3, 0, 0)); mirror((0.11, 0.45, 0.09), (0.085, 0.12, 0.09)); mirror((0.11, 0.43, 0.05), (0.11, 0.16, 0.085))
    for s_ in (-1, 1):
        for tx in (-0.04, 0.0, 0.04): el((s_ * 0.12 + tx, 0.375, 0.034 + (0.006 if tx == 0 else 0)), (0.036, 0.075, 0.045), (0, 0, 0), 2.4)
    return ob

def paint_jaguar(body):
    """vertex colour (multiplied by the spot texture): golden back, orange face, white bib, belly, chin, inner and lower legs, paws"""
    me = body.data; col = me.color_attributes.new('Col', 'BYTE_COLOR', 'POINT')
    gold = Vector((0.76, 0.58, 0.30)); amber = Vector((0.80, 0.54, 0.26)); white = Vector((0.93, 0.84, 0.66))
    for i, v in enumerate(me.vertices):
        x, y, z = v.co; n = v.normal; up = n.z
        c = gold * (0.86 + 0.22 * smoothstep(-0.2, 0.9, up))
        c = c.lerp(Vector((0.74, 0.50, 0.20)), smoothstep(0.35, 0.95, up) * smoothstep(-0.7, 0.0, y) * 0.35)           # darker saddle along the spine
        belly = smoothstep(0.05, -0.55, up); c = c.lerp(white, belly)
        bib = smoothstep(-0.18, -0.34, y) * smoothstep(0.78, 0.60, z) * smoothstep(0.17, 0.08, abs(x)) * smoothstep(-0.7, -0.2, up * 0 - 0.2 + 0.7 * (1 - abs(n.x)))
        if y < -0.30 and y > -0.62 and z < 0.66: c = c.lerp(white, max(bib, smoothstep(0.30, 0.0, up) * 0.0))
        c = c.lerp(white, smoothstep(0.34, 0.14, z) * 0.9)                                                             # white lower legs and paws
        inner = smoothstep(0.10, 0.02, abs(x)) * smoothstep(0.50, 0.30, z); c = c.lerp(white, inner)
        if y < -0.66 and z > 0.50:                                                                                     # face
            f = smoothstep(-0.66, -0.78, y) * smoothstep(0.50, 0.58, z); c = c.lerp(amber, f * 0.85)
        if y < -0.93 and z < 0.60: c = c.lerp(white, 0.9 * smoothstep(-0.93, -0.97, y))                                # whisker pad and chin
        if y < -0.80 and z < 0.49: c = c.lerp(white, 0.95)
        if y < -0.9 and z > 0.57 and abs(x) < 0.035: c = c.lerp(Vector((0.14, 0.08, 0.07)), 0.85)                      # nose bridge tip
        for ex in (-0.07, 0.07):                                                                                       # tear lines under the eyes
            dd = math.hypot(x - ex * 1.0, (y + 0.80) * 0.9, (z - 0.58) * 1.3)
            if dd < 0.045 and z < 0.625: c = c.lerp(Vector((0.10, 0.07, 0.05)), 0.6 * (1 - dd / 0.045))
        if z < 0.06 and ((y < -0.40 and y > -0.55) or (0.35 < y < 0.50)) and abs(math.sin((abs(x) - 0.11) * 95)) > 0.93 and (y < -0.43 or y > 0.38): c = c * 0.55
        for (wy, wz) in ((-0.935, 0.575), (-0.95, 0.553), (-0.915, 0.553), (-0.93, 0.532), (-0.905, 0.585), (-0.96, 0.575)):          # whisker dots
            if math.hypot(y - wy, (z - wz) * 1.0) < 0.0072 and abs(x) > 0.02: c = c.lerp(Vector((0.08, 0.05, 0.04)), 0.9)
        c = c * (1 + mnoise.noise(Vector((x * 8, y * 8, z * 8))) * 0.06)
        for k in range(3): c[k] = max(0.0, min(1.0, c[k]))
        col.data[i].color = (c[0] ** 2.2, c[1] ** 2.2, c[2] ** 2.2, 1.0)

def jaguar_extras(mats, body):
    out = []
    def surf(co, inward=0.0):
        ok, loc, nrm, idx = body.closest_point_on_mesh(Vector(co)); return loc - nrm * inward, nrm
    for s in (-1, 1):
        pe, ne = surf((s * 0.098, -0.805, 0.636), 0.008); e = eyeball('JagEye', pe, 0.0235, ne, iris=(0.55, 0.47, 0.07), rim=(0.05, 0.035, 0.015), sclera=(0.62, 0.55, 0.30)); e.data.materials.append(mats['eyevc']); out.append(e)
        liner = bpy.data.objects.new('JagLiner', None)
        bpy.ops.mesh.primitive_torus_add(major_radius=0.0270, minor_radius=0.0052, major_segments=24, minor_segments=8, location=pe + ne * 0.001); ln = bpy.context.active_object; ln.name = 'JagLiner'
        ln.rotation_euler = Vector(ne).to_track_quat('Z', 'Y').to_euler(); ln.scale = (0.78, 1.30, 1.0); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True); [setattr(p, 'use_smooth', True) for p in ln.data.polygons]
        ln.data.materials.append(mats['nose']); out.append(ln); bpy.data.objects.remove(liner)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.03, segments=16, ring_count=10, location=surf((s * 0.098, -0.805, 0.652), 0.019)[0]); lid = bpy.context.active_object; lid.name = 'JagLid'; lid.scale = (0.7, 1.0, 0.8)
        bpy.ops.object.transform_apply(scale=True); _vcol_solid(lid, (0.55, 0.38, 0.17)); lid.data.materials.append(mats['coat']); [setattr(p, 'use_smooth', True) for p in lid.data.polygons]; out.append(lid)
        # rounded ears: dark back with a pale spot, pale inside
        bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=20, v_segments=14, radius=1.0)
        for v in bm.verts: v.co.z += 0.4; v.co.x *= (0.026 + 0.014 * v.co.z) * 0.68; v.co.y *= 0.042; v.co.z *= 0.050
        me = bpy.data.meshes.new('JagEar'); bm.to_mesh(me); bm.free(); ear = bpy.data.objects.new('JagEar', me); bpy.context.scene.collection.objects.link(ear)
        ear.location = (s * 0.115, -0.69, 0.715); ear.rotation_euler = (-0.12, s * 0.38, s * 0.12); [setattr(p, 'use_smooth', True) for p in me.polygons]
        col = me.color_attributes.new('Col', 'BYTE_COLOR', 'POINT')
        for i, v in enumerate(me.vertices):
            inner = smoothstep(0.1, 0.8, -v.normal.x * s) ; spot = smoothstep(0.55, 0.3, math.hypot(v.co.y * 1.0, v.co.z - 0.05) * 22)
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
    # mouth: lip line, parted dark gap, canines, nostrils
    teeth = _flat('JagTeeth', (0.93, 0.89, 0.78), 0.35)
    for s in (-1, 1):
        lip = [surf((s * 0.004, -1.02, 0.553), 0.003)[0], surf((s * 0.024, -1.01, 0.512), 0.003)[0], surf((s * 0.058, -0.955, 0.500), 0.003)[0], surf((s * 0.086, -0.885, 0.503), 0.003)[0], surf((s * 0.094, -0.835, 0.522), 0.003)[0]]
        lt = tapered_tube('JagLip', lip, [0.0034, 0.0036, 0.0036, 0.0032, 0.0024], segs=6, subdiv_each=4, color_fn=lambda t: (0.12, 0.05, 0.05)); lt.data.materials.append(mats['nose']); out.append(lt)
        for (fx, fy, fz, ln_, rr) in ((0.036, -0.995, 0.507, 0.017, 0.0052), (0.047, -0.953, 0.503, 0.0, 0.0)):
            if ln_ <= 0: continue
            base = surf((s * fx, fy, fz), 0.001)[0]
            bpy.ops.mesh.primitive_cone_add(vertices=10, radius1=rr, radius2=0.0007, depth=ln_, location=base + Vector((0, 0, -ln_ * 0.45)), rotation=(math.pi, 0, 0)); fg = bpy.context.active_object; fg.name = 'JagFang'
            [setattr(p, 'use_smooth', True) for p in fg.data.polygons]; fg.data.materials.append(teeth); out.append(fg)
        bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=0.0036, radius2=0.0004, depth=0.010, location=surf((s * 0.030, -1.01, 0.48), 0.001)[0] + Vector((0, 0, 0.004))); lf = bpy.context.active_object; lf.name = 'JagFangLow'
        [setattr(p, 'use_smooth', True) for p in lf.data.polygons]; lf.data.materials.append(teeth); out.append(lf)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.006, segments=10, ring_count=6, location=surf((s * 0.0165, -1.047, 0.585), 0.001)[0]); nt_ = bpy.context.active_object; nt_.name = 'JagNostril'; nt_.scale = (0.6, 0.5, 1.5)
        bpy.ops.object.transform_apply(scale=True); nt_.data.materials.append(mats['nose']); out.append(nt_)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.03, segments=16, ring_count=8, location=surf((0, -0.975, 0.503), 0.0)[0] + Vector((0, 0, 0.001))); gp = bpy.context.active_object; gp.name = 'JagMouthGap'; gp.scale = (1.4, 1.1, 0.12)
    bpy.ops.object.transform_apply(scale=True); [setattr(p, 'use_smooth', True) for p in gp.data.polygons]; gp.data.materials.append(_flat('JagMouthDark', (0.045, 0.008, 0.01), 1.0)); out.append(gp)
    # nose
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.026, segments=16, ring_count=10, location=surf((0, -1.035, 0.58), 0.004)[0]); nz = bpy.context.active_object; nz.name = 'JagNose'; nz.scale = (1.2, 0.8, 0.8)
    bpy.ops.object.transform_apply(scale=True); nz.data.materials.append(mats['nose']); [setattr(p, 'use_smooth', True) for p in nz.data.polygons]; out.append(nz)
    # long tail with a dark tip, spotted then ringed
    ring = lambda t: (0.10, 0.07, 0.05) if (t > 0.94 or (t > 0.55 and int(t * 20) % 2 == 0) or (t < 0.55 and (int(t * 36) * 7919) % 6 == 0)) else (0.80, 0.56, 0.22)
    tail = tapered_tube('JagTail', [(0, 0.55, 0.57), (0, 0.76, 0.62), (0, 0.98, 0.52), (0, 1.18, 0.38), (0, 1.30, 0.22)], [0.036, 0.034, 0.031, 0.028, 0.023], segs=12, subdiv_each=8, color_fn=ring)
    tail.data.materials.append(mats['mane']); out.append(tail)
    return out

def jaguar_materials():
    return {'coat': _mat_vcol('JagCoat', TEXD + 'jaguar_coat.png', 0.9), 'eyevc': _mat_vcol('EyeVC3', None, 0.06), 'mane': _mat_vcol('JagPlain', None, 0.85),
            'nose': _flat('JagNose', (0.05, 0.022, 0.022), 1.0)}

def build_jaguar_rig(parts):
    arm = bpy.data.armatures.new('JagRig'); rig = bpy.data.objects.new('JagRig', arm); bpy.context.scene.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig; rig.select_set(True); bpy.ops.object.mode_set(mode='EDIT'); B = {}
    def bone(name, head, tail, parent=None):
        eb = arm.edit_bones.new(name); eb.head = Vector((head[0], head[1], hwarp(head[2]))); eb.tail = Vector((tail[0], tail[1], hwarp(tail[2])))
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
    body = parts[0]; wins = bpy.context.window_manager.windows; win = wins[0] if len(wins) else None; area = [a for a in win.screen.areas if a.type == 'VIEW_3D'][0] if win else None
    for o in bpy.data.objects: o.select_set(False)
    body.select_set(True); rig.select_set(True); bpy.context.view_layer.objects.active = rig
    if win:
        with bpy.context.temp_override(window=win, area=area, region=[r for r in area.regions if r.type == 'WINDOW'][0], active_object=rig, object=rig, selected_objects=[body, rig], selected_editable_objects=[body, rig]):
            bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    else:
        with bpy.context.temp_override(active_object=rig, object=rig, selected_objects=[body, rig], selected_editable_objects=[body, rig]):
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

# height warp: legs get taller and the body rises with them. The same function moves mesh vertices and rig bones, so animation stays valid.
Z0, Z1, STRETCH = 0.05, 0.50, 1.30
def hwarp(z):
    if z <= Z0: return z
    if z <= Z1: return Z0 + (z - Z0) * STRETCH
    return z + (Z1 - Z0) * (STRETCH - 1.0)

def warp_meshes():
    bpy.context.view_layer.update()
    for o in [o for o in bpy.data.objects if o.type == 'MESH']:
        for p in o.users_collection: pass
        me = o.data; mw = o.matrix_world.copy(); inv = mw.inverted()
        for v in me.vertices:
            w = mw @ v.co; w.z = hwarp(w.z); v.co = inv @ w
        me.update()

def build_jaguar_all(export_path=None):
    for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
    mb = jaguar_metaball(0.010); body = finalize_body(mb, 22000); bpy.data.objects.remove(mb, do_unlink=True)
    paint_jaguar(body); mats = jaguar_materials(); body.data.materials.clear(); body.data.materials.append(mats['coat'])
    bpy.context.view_layer.objects.active = body; body.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.uv.cube_project(cube_size=1.0, correct_aspect=True, clip_to_bounds=False, scale_to_bounds=False); bpy.ops.object.mode_set(mode='OBJECT')
    for l in body.data.uv_layers[0].data: l.uv = (l.uv[0] * 1.4, l.uv[1] * 1.4)
    extras = jaguar_extras(mats, body); warp_meshes(); rig = build_jaguar_rig([body] + extras)
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
