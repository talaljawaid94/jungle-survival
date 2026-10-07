import bpy, bmesh, math, random
from mathutils import Vector, Euler
from mathutils import noise as mnoise

# Wild rabbit (European), built the same way as the deer, boar and jaguar: metaball body -> decimated mesh -> painted coat,
# then separate parts (eyes, lids, ears, whiskers, claws, nose, teeth) placed on the surface, a game rig, and a GLB export.
# Start point: the old procedural rabbit (agouti brown-grey coat, cream belly, hopping gait, ~0.4 m long), now with real anatomy:
# short front legs, long hind legs with a long flat foot (tarsus), prominent cheeks, large eyes high on the sides, long upright ears.
# Model faces -Y (exports as +Z, the game's forward). Ground is z = 0.
exec(open("/Users/talaljawaid/Documents/Talal's Folder/Claude/Experiment 2026/Experiment 3/AI Game/assets/blender/build_deer.py").read())
RAB = "/Users/talaljawaid/Documents/Talal's Folder/Claude/Experiment 2026/Experiment 3/AI Game/assets/blender/"

def rabbit_metaball(res=0.0055):
    for m in list(bpy.data.metaballs): bpy.data.metaballs.remove(m)
    mb = bpy.data.metaballs.new('Rabbit'); mb.resolution = res; mb.render_resolution = res; mb.threshold = 0.6
    ob = bpy.data.objects.new('RabbitMB', mb); bpy.context.scene.collection.objects.link(ob)
    def el(c, dims, tilt=(0, 0, 0), stiff=2.0):
        e = mb.elements.new(type='ELLIPSOID'); e.co = Vector(c); e.radius = 1.0; e.stiffness = stiff
        e.size_x, e.size_y, e.size_z = (dims[0] / K, dims[1] / K, dims[2] / K); e.rotation = Euler(tilt).to_quaternion(); return e
    def mirror(c, dims, tilt=(0, 0, 0), stiff=2.0):
        for s in (-1, 1): el((s * c[0], c[1], c[2]), dims, (tilt[0], tilt[1] * s, tilt[2] * s), stiff)
    # torso: low shoulders, deep chest, a high round rump on a short hunched back (the classic rabbit wedge)
    el((0, -0.060, 0.155), (0.14, 0.17, 0.19)); el((0, 0.040, 0.190), (0.15, 0.17, 0.17)); el((0, 0.130, 0.215), (0.16, 0.19, 0.23)); el((0, 0.030, 0.120), (0.11, 0.21, 0.09))
    mirror((0.072, 0.120, 0.150), (0.095, 0.20, 0.21), (0.12, 0, 0.0))                       # big thigh mass
    # neck and head: round skull, short blunt muzzle, full cheeks
    el((0, -0.150, 0.225), (0.10, 0.10, 0.12), (-0.3, 0, 0)); el((0, -0.225, 0.245), (0.100, 0.115, 0.100)); el((0, -0.283, 0.222), (0.064, 0.062, 0.060), (0.2, 0, 0))
    mirror((0.040, -0.255, 0.224), (0.060, 0.080, 0.070)); el((0, -0.316, 0.214), (0.032, 0.026, 0.030))
    # front legs: slim and upright, long paws
    mirror((0.038, -0.092, 0.105), (0.034, 0.075, 0.10), (-0.55, 0, 0)); mirror((0.039, -0.128, 0.058), (0.024, 0.040, 0.085), (0.45, 0, 0)); mirror((0.040, -0.158, 0.0125), (0.030, 0.070, 0.025))
    # hind legs: folded shin, hock, and the long flat foot
    mirror((0.076, 0.115, 0.080), (0.050, 0.10, 0.12), (-0.3, 0, 0)); mirror((0.077, 0.205, 0.048), (0.046, 0.06, 0.07)); mirror((0.077, 0.112, 0.0145), (0.040, 0.17, 0.029))
    el((0, 0.250, 0.222), (0.070, 0.070, 0.080))                                              # cotton tail
    return ob

def paint_rabbit(body):
    me = body.data; col = me.color_attributes.new('Col', 'BYTE_COLOR', 'POINT')
    eyeL = Vector((0.052, -0.236, 0.262)); eyeR = Vector((-0.052, -0.236, 0.262))
    for i, v in enumerate(me.vertices):
        x, y, z = v.co; n = v.normal; up = n.z
        back = Vector((0.40, 0.31, 0.22)); flank = Vector((0.52, 0.43, 0.33)); belly = Vector((0.90, 0.85, 0.76))
        c = flank.lerp(back, smoothstep(0.1, 0.8, up))
        if abs(x) < 0.05 and up > 0.45 and -0.15 < y < 0.22: c = c.lerp(Vector((0.24, 0.18, 0.13)), 0.65 * smoothstep(0.05, 0.0, abs(x)))   # darker saddle down the spine
        if -0.20 < y < -0.135 and up > 0.35: c = c.lerp(Vector((0.58, 0.38, 0.22)), 0.5 * smoothstep(0.10, 0.4, up))                         # rufous nape patch
        c = c.lerp(belly, smoothstep(0.05, -0.5, up) * 0.95)                                                                                    # white belly and underside
        if z < 0.075 and y > -0.1: c = c.lerp(Vector((0.60, 0.47, 0.34)), 0.5)
        if y < -0.09 and z < 0.11: c = Vector((0.60, 0.47, 0.34)).lerp(Vector((0.74, 0.62, 0.48)), smoothstep(0.05, 0.0, z))                  # tan legs, paler paws
        if y < -0.27: c = c.lerp(Vector((0.78, 0.70, 0.60)), smoothstep(-0.27, -0.32, y) * 0.8)                                                  # pale muzzle
        if y < -0.255 and up < -0.1: c = c.lerp(Vector((0.95, 0.92, 0.86)), 0.9)                                                                 # white chin
        for ec in (eyeL, eyeR):                                                                                                                   # pale ring of fur round each eye
            d = (v.co - ec).length
            if d < 0.040: c = c.lerp(Vector((0.80, 0.73, 0.62)), smoothstep(0.040, 0.020, d) * 0.9)
        if y > 0.215: c = c.lerp(Vector((0.95, 0.93, 0.88)), smoothstep(0.215, 0.275, y) * (0.5 + 0.5 * smoothstep(0.5, -0.2, up)))              # cotton tail
        if y > 0.235 and up > 0.7: c = c.lerp(Vector((0.30, 0.23, 0.16)), 0.45)                                                                   # dark stripe on the tail top
        if y > 0.05 and z < 0.14 and abs(x) > 0.05: c = c.lerp(Vector((0.62, 0.50, 0.38)), 0.4)                                                  # hind foot and hock
        n1 = mnoise.noise(Vector((x * 40, y * 40, z * 40))) * 0.12 + mnoise.noise(Vector((x * 130, y * 130, z * 130))) * 0.06
        c = c * (1 + n1)
        for k in range(3): c[k] = max(0.0, min(1.0, c[k]))
        col.data[i].color = (c[0] ** 2.2, c[1] ** 2.2, c[2] ** 2.2, 1.0)

def _smooth(o):
    for p in o.data.polygons: p.use_smooth = True

def rabbit_extras(mats, body):
    out = []
    def surf(co, inward=0.0):
        ok, loc, nrm, idx = body.closest_point_on_mesh(Vector(co)); return loc - nrm * inward, nrm
    def sph(name, r, loc, scale=(1, 1, 1), color=None, mat='coat', rot=(0, 0, 0)):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=r, segments=16, ring_count=10, location=loc); o = bpy.context.active_object; o.name = name; o.scale = scale; o.rotation_euler = rot
        bpy.ops.object.transform_apply(scale=True, rotation=True); _smooth(o)
        if color: _vcol_solid(o, color)
        o.data.materials.append(mats[mat]); out.append(o); return o
    for s in (-1, 1):
        pe, ne = surf((s * 0.054, -0.236, 0.262), 0.003)
        e = eyeball('RabbitEye', pe, 0.0150, ne, iris=(0.20, 0.10, 0.04), pupil_scale=1.0, sclera=(0.05, 0.035, 0.03)); e.data.materials.append(mats['eyevc']); out.append(e)
        sph('RabbitLid', 0.0168, surf((s * 0.052, -0.236, 0.268), 0.0055)[0], (0.55, 1.0, 0.8), (0.40, 0.31, 0.22))                       # upper lid
        sph('RabbitBrow', 0.013, surf((s * 0.046, -0.236, 0.283), 0.006)[0], (0.9, 1.2, 0.5), (0.40, 0.31, 0.22))
        # ear: long hollow leaf, pink lining, dark rim, fur-brown back
        bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=28, v_segments=20, radius=1.0)
        for v in bm.verts:
            v.co.z += 1.0; t = v.co.z / 2.0                                                     # (mesh is then dropped 3 cm so the base sits inside the head)
            w = 0.029 * (math.sin(min(1.0, t * 1.15) * math.pi * 0.62) ** 0.7 + 0.12)               # width: narrow base, widest at ~40%, rounded tip
            v.co.x *= 0.0045 * (1 + 0.8 * t)
            v.co.y *= w * (1.0 - 0.15 * t)
            v.co.z *= 0.070
            v.co.x += -0.0035 * (t ** 2) * (1 if v.co.x * s < 0 else 1) * 0              # (kept flat: curvature comes from the bone pose)
        for v in bm.verts: v.co.z -= 0.03
        me = bpy.data.meshes.new('RabbitEar'); bm.to_mesh(me); bm.free(); ear = bpy.data.objects.new('RabbitEar', me); bpy.context.scene.collection.objects.link(ear)
        ear.location = (s * 0.038, -0.200, 0.262); ear.rotation_euler = (-0.28, s * 0.20, 0); _smooth(ear)
        col = me.color_attributes.new('Col', 'BYTE_COLOR', 'POINT')
        for i, v in enumerate(me.vertices):
            inner = smoothstep(0.1, 0.9, v.normal.x * -s)                                          # the face turned toward the head is the pink lining
            c = tuple((0.46, 0.36, 0.26)[k] * (1 - inner) + (0.80, 0.52, 0.50)[k] * inner for k in range(3))
            tt = v.co.z / 0.14
            if tt > 0.86: c = tuple(c[k] * (1 - 0.8 * smoothstep(0.86, 0.98, tt)) + 0.04 * smoothstep(0.86, 0.98, tt) for k in range(3))   # black tip
            if abs(v.co.y) > 0.024 * (1 - 0.5 * tt): c = tuple(c[k] * 0.55 for k in range(3))                                         # dark rim
            col.data[i].color = (c[0] ** 2.2, c[1] ** 2.2, c[2] ** 2.2, 1)
        me.materials.append(mats['coat']); out.append(ear)
        # whiskers
        rnd = random.Random(7 + s)
        for k in range(6):
            a = (k - 2.5) * 0.17; L = 0.085 + 0.025 * rnd.random(); base = surf((s * 0.030, -0.296, 0.216 + (k % 3) * 0.005), 0.001)[0]
            tip = Vector((s * (0.030 + math.cos(a) * L * 0.8), -0.296 - L * 0.55, 0.216 + math.sin(a) * L * 0.9 - 0.012))
            mid = (base + tip) * 0.5 + Vector((s * 0.0, -0.004, 0.010))
            w = tapered_tube('Whisker', [base, mid, tip], [0.00055, 0.00040, 0.00008], segs=4, subdiv_each=3, color_fn=lambda t: (0.92, 0.9, 0.85))
            w.data.materials.append(mats['eyevc']); out.append(w)
        # claws
        for front, (cx, cy, nclaw) in ((True, (0.040, -0.188, 4)), (False, (0.077, 0.034, 4))):
            for j in range(nclaw):
                off = (j - (nclaw - 1) / 2) * 0.0072
                bpy.ops.mesh.primitive_cone_add(radius1=0.0025, radius2=0.0004, depth=0.013, vertices=8, location=(s * cx + off * 0.9, cy - 0.0085, 0.0095))
                cl = bpy.context.active_object; cl.rotation_euler = (math.radians(104), 0, s * (j - (nclaw - 1) / 2) * 0.10); bpy.ops.object.transform_apply(rotation=True); _smooth(cl)
                cl.name = 'Claw_%s_%s' % ('f' if front else 'h', 'l' if s > 0 else 'r'); cl.data.materials.append(mats['claw']); out.append(cl)
    # cotton tail: a separate fluffy puff, white with a brown top
    tl = sph('RabbitTail', 0.040, (0, 0.292, 0.216), (1.0, 0.95, 1.0), None)
    col = tl.data.color_attributes.new('Col', 'BYTE_COLOR', 'POINT')
    for i, v in enumerate(tl.data.vertices):
        c = Vector((0.96, 0.94, 0.89)).lerp(Vector((0.42, 0.33, 0.24)), smoothstep(0.55, 0.95, v.normal.z) * 0.55)
        c = c * (1 + mnoise.noise(Vector((v.co.x * 90, v.co.y * 90, v.co.z * 90))) * 0.10)
        for k in range(3): c[k] = max(0.0, min(1.0, c[k]))
        col.data[i].color = (c[0] ** 2.2, c[1] ** 2.2, c[2] ** 2.2, 1)
    # nose, nostrils, teeth, mouth line
    sph('RabbitNose', 0.0110, surf((0, -0.322, 0.2175), 0.003)[0], (1.15, 0.8, 0.85), (0.74, 0.46, 0.44))
    for s in (-1, 1):
        sph('Nostril', 0.0035, surf((s * 0.0048, -0.327, 0.2185), 0.0)[0], (0.7, 0.4, 1.2), (0.12, 0.06, 0.06), mat='eyevc', rot=(0.2, 0, s * 0.35))
        sph('Incisor', 0.0045, (s * 0.0033, -0.3175, 0.1955), (0.7, 0.55, 1.7), (0.93, 0.89, 0.76), mat='eyevc')
    for s in (-1, 1):                                                                                                      # lip line running down and out from the nose
        t = tapered_tube('Lip', [(0, -0.324, 0.2095), (s * 0.003, -0.323, 0.2015), (s * 0.014, -0.314, 0.197), (s * 0.028, -0.296, 0.200)], [0.0010, 0.0011, 0.0010, 0.0006], segs=5, subdiv_each=3, color_fn=lambda t: (0.25, 0.14, 0.13))
        t.data.materials.append(mats['eyevc']); out.append(t)
    return out

def rabbit_materials():
    return {'coat': _mat_vcol('RabbitCoat', TEXD + 'deer_fur.png', 0.95), 'eyevc': _mat_vcol('RabbitVC', None, 0.12), 'claw': _flat('Claw', (0.36, 0.29, 0.21), 0.45)}

def build_rabbit_rig(parts):
    arm = bpy.data.armatures.new('RabbitRig'); rig = bpy.data.objects.new('RabbitRig', arm); bpy.context.scene.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig; rig.select_set(True); bpy.ops.object.mode_set(mode='EDIT'); B = {}
    def bone(name, head, tail, parent=None):
        eb = arm.edit_bones.new(name); eb.head = Vector(head); eb.tail = Vector(tail)
        if parent: eb.parent = B[parent]
        B[name] = eb
    bone('root', (0, 0.05, 0.0), (0, 0.05, 0.05)); bone('pelvis', (0, 0.17, 0.18), (0, 0.07, 0.18), 'root'); bone('spine1', (0, 0.07, 0.18), (0, -0.03, 0.18), 'pelvis'); bone('spine2', (0, -0.03, 0.18), (0, -0.11, 0.19), 'spine1')
    bone('neck', (0, -0.11, 0.20), (0, -0.19, 0.23), 'spine2'); bone('head', (0, -0.19, 0.23), (0, -0.33, 0.215), 'neck'); bone('tail', (0, 0.23, 0.22), (0, 0.31, 0.23), 'pelvis')
    for sfx, s in (('l', 1), ('r', -1)):
        bone('ear_' + sfx, (s * 0.036, -0.203, 0.300), (s * 0.058, -0.24, 0.43), 'head')
        bone('f_upper_' + sfx, (s * 0.038, -0.075, 0.15), (s * 0.038, -0.108, 0.075), 'spine2'); bone('f_lower_' + sfx, (s * 0.038, -0.108, 0.075), (s * 0.040, -0.145, 0.02), 'f_upper_' + sfx); bone('f_paw_' + sfx, (s * 0.040, -0.145, 0.02), (s * 0.040, -0.192, 0.01), 'f_lower_' + sfx)
        bone('h_thigh_' + sfx, (s * 0.076, 0.14, 0.21), (s * 0.076, 0.17, 0.10), 'pelvis'); bone('h_shin_' + sfx, (s * 0.076, 0.17, 0.10), (s * 0.077, 0.205, 0.048), 'h_thigh_' + sfx)
        bone('h_foot_' + sfx, (s * 0.077, 0.205, 0.048), (s * 0.077, 0.03, 0.012), 'h_shin_' + sfx)
    bpy.ops.object.mode_set(mode='OBJECT')
    body = parts[0]; win = bpy.context.window_manager.windows[0]; area = [a for a in win.screen.areas if a.type == 'VIEW_3D'][0]
    for o in bpy.data.objects: o.select_set(False)
    body.select_set(True); rig.select_set(True); bpy.context.view_layer.objects.active = rig
    with bpy.context.temp_override(window=win, area=area, region=[r for r in area.regions if r.type == 'WINDOW'][0], active_object=rig, object=rig, selected_objects=[body, rig], selected_editable_objects=[body, rig]):
        bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    for o in parts[1:]:
        name = 'head'
        if 'Ear' in o.name: name = 'ear_l' if o.location.x > 0 else 'ear_r'
        elif o.name.startswith('RabbitTail'): name = 'tail'
        elif o.name.startswith('Claw_'):
            _, k, sd = o.name.split('.')[0].split('_'); name = ('f_paw_' if k == 'f' else 'h_foot_') + sd
        vg = o.vertex_groups.new(name=name); vg.add(range(len(o.data.vertices)), 1.0, 'REPLACE'); md = o.modifiers.new('Armature', 'ARMATURE'); md.object = rig; o.parent = rig
    return rig

def build_rabbit_all(export_path=None):
    for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
    mb = rabbit_metaball(0.0055); body = finalize_body(mb, 14000); bpy.data.objects.remove(mb, do_unlink=True); body.name = 'RabbitBody'
    paint_rabbit(body); mats = rabbit_materials(); body.data.materials.clear(); body.data.materials.append(mats['coat'])
    bpy.context.view_layer.objects.active = body; body.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.uv.smart_project(angle_limit=1.0, island_margin=0.005, scale_to_bounds=False); bpy.ops.object.mode_set(mode='OBJECT')
    for l in body.data.uv_layers[0].data: l.uv = (l.uv[0] * 6.0, l.uv[1] * 6.0)      # small animal: tile the fur texture more
    extras = rabbit_extras(mats, body); rig = build_rabbit_rig([body] + extras)
    if export_path:
        for pb in rig.pose.bones: pb.rotation_mode = 'XYZ'; pb.rotation_euler = (0, 0, 0)
        for im in bpy.data.images:
            if im.name == 'deer_fur.png' and max(im.size) > 512: im.scale(512, 512)
        meshes = [o for o in bpy.data.objects if o.type == 'MESH']
        for o in bpy.data.objects: o.select_set(False)
        for o in meshes + [rig]: o.select_set(True)
        bpy.context.view_layer.objects.active = rig
        bpy.ops.export_scene.gltf(filepath=export_path, export_format='GLB', use_selection=True, export_apply=True, export_animations=False, export_skins=True, export_yup=True, export_image_format='JPEG', export_jpeg_quality=85)
    return rig

def rabbit_preview(path, az=35, el=12, dist=1.5, target=(0, -0.03, 0.17), res=(900, 700)):
    """Quick lit render of whatever is in the scene (Eevee) for visual checks."""
    sc = bpy.context.scene
    for o in [o for o in bpy.data.objects if o.type in ('CAMERA', 'LIGHT')]: bpy.data.objects.remove(o, do_unlink=True)
    cam = bpy.data.objects.new('PCam', bpy.data.cameras.new('PCam')); sc.collection.objects.link(cam); sc.camera = cam; cam.data.lens = 70
    a, e = math.radians(az), math.radians(el); tg = Vector(target)
    cam.location = tg + Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e))) * dist
    cam.rotation_euler = (tg - cam.location).to_track_quat('-Z', 'Y').to_euler()
    for nm, en, loc in (('Key', 4.0, (1.2, -1.4, 1.5)), ('Fill', 1.4, (-1.5, -0.6, 0.8)), ('Rim', 2.5, (0.2, 1.6, 1.0))):
        ld = bpy.data.lights.new(nm, 'SUN'); ld.energy = en; lo = bpy.data.objects.new(nm, ld); sc.collection.objects.link(lo); lo.location = loc
        lo.rotation_euler = (tg - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    if sc.world is None: sc.world = bpy.data.worlds.new('W')
    sc.world.use_nodes = True; bg = sc.world.node_tree.nodes['Background']; bg.inputs['Color'].default_value = (0.35, 0.40, 0.42, 1); bg.inputs['Strength'].default_value = 0.8
    gp = bpy.data.objects.get('PGround')
    if gp is None:
        bpy.ops.mesh.primitive_plane_add(size=4, location=(0, 0, -0.001)); gp = bpy.context.active_object; gp.name = 'PGround'
        gm = bpy.data.materials.new('PG'); gm.use_nodes = True; gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.20, 0.30, 0.12, 1); gp.data.materials.append(gm)
    sc.render.engine = 'BLENDER_EEVEE'; sc.render.resolution_x, sc.render.resolution_y = res; sc.render.filepath = path; sc.render.image_settings.file_format = 'PNG'
    bpy.ops.render.render(write_still=True)
