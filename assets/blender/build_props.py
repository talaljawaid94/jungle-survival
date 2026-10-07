import bpy, bmesh, math, mathutils
from mathutils import Vector
from mathutils.bvhtree import BVHTree
TEXD = "/Users/talaljawaid/Documents/Talal's Folder/Claude/Experiment 2026/Experiment 3/AI Game/assets/blender/tex/"
MP = "/Users/talaljawaid/Library/Application Support/Blender/5.2/extensions/.user/user_default/mpfb/data/"

def flat_mat(name, color, rough=0.5, metal=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    return m

def bind(obj, bone, rig):
    vg = obj.vertex_groups.new(name=bone); vg.add(range(len(obj.data.vertices)), 1.0, 'REPLACE')
    md = obj.modifiers.new('Armature', 'ARMATURE'); md.object = rig; obj.parent = rig

def finish(obj, mat, bone, rig, smooth=True, uv=True):
    me = obj.data
    if smooth:
        for p in me.polygons: p.use_smooth = True
    if uv:
        bpy.context.view_layer.objects.active = obj
        for o in bpy.context.selected_objects: o.select_set(False)
        obj.select_set(True); bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.uv.smart_project(angle_limit=1.0, island_margin=0.01, scale_to_bounds=False); bpy.ops.object.mode_set(mode='OBJECT')
        for l in me.uv_layers[0].data: l.uv = (l.uv[0] * 3.0, l.uv[1] * 3.0)         # canvas weave scale
    me.materials.clear(); me.materials.append(mat); bind(obj, bone, rig)

def box(name, size, loc, bevel=0.02, rot=(0, 0, 0), subdiv=1, segs=3):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot); o = bpy.context.active_object; o.name = name
    o.scale = size; bpy.ops.object.transform_apply(scale=True, rotation=True)
    bv = o.modifiers.new('B', 'BEVEL'); bv.width = bevel; bv.segments = segs; bv.limit_method = 'ANGLE'
    if subdiv: sd = o.modifiers.new('S', 'SUBSURF'); sd.levels = subdiv
    for m in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=m.name)
    return o

def cyl(name, r, h, loc, rot=(0, 0, 0), verts=24):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=h, vertices=verts, location=loc, rotation=rot); o = bpy.context.active_object; o.name = name
    bv = o.modifiers.new('B', 'BEVEL'); bv.width = min(r, h) * 0.12; bv.segments = 3; bpy.ops.object.modifier_apply(modifier='B'); return o

def surface_bvh(names):
    dg = bpy.context.evaluated_depsgraph_get(); bm = bmesh.new()
    for n in names:
        ob = bpy.data.objects[n]; ev = ob.evaluated_get(dg); me = ev.to_mesh(); me.transform(ob.matrix_world); bm.from_mesh(me); ev.to_mesh_clear()
    return BVHTree.FromBMesh(bm)

def project_path(pts, bvh, offset, sub=10):
    out = []
    for a, b in zip(pts[:-1], pts[1:]):
        for i in range(sub):
            p = Vector(a).lerp(Vector(b), i / sub); loc, n, _, _ = bvh.find_nearest(p)
            out.append((loc + n * offset, n))
    loc, n, _, _ = bvh.find_nearest(Vector(pts[-1])); out.append((loc + n * offset, n)); return out

def ribbon(name, path, width, thick, closed=False):
    bm = bmesh.new(); rows = []
    for i, (p, n) in enumerate(path):
        nxt = path[(i + 1) % len(path)][0] if (closed or i < len(path) - 1) else p; prv = path[i - 1][0] if (closed or i > 0) else p
        t = (nxt - prv).normalized(); side = n.cross(t).normalized()
        A = p + side * width / 2; B = p - side * width / 2
        rows.append([bm.verts.new(A + n * thick), bm.verts.new(B + n * thick), bm.verts.new(B), bm.verts.new(A)])
    N = len(rows)
    for i in range(N if closed else N - 1):
        r0 = rows[i]; r1 = rows[(i + 1) % N]
        for k in range(4):
            try: bm.faces.new((r0[k], r0[(k + 1) % 4], r1[(k + 1) % 4], r1[k]))
            except ValueError: pass
    if not closed:
        for r in (rows[0], rows[-1]):
            try: bm.faces.new(r)
            except ValueError: pass
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o); return o

def build_props(rig, simple_mat):
    O = bpy.data.objects
    canvas = simple_mat('PackCanvas', TEXD + 'pack_canvas.png', 0.95, sheen=0.2)
    leather = simple_mat('Leather', TEXD + 'leather.png', 0.6)
    brass = flat_mat('Brass', (0.30, 0.24, 0.11), 0.45, 0.8)
    bottle = flat_mat('Bottle', (0.16, 0.19, 0.21), 0.35, 0.7)
    roll = flat_mat('Bedroll', (0.12, 0.16, 0.05), 0.95)
    rope = flat_mat('Rope', (0.55, 0.47, 0.30), 0.95)
    bvh = surface_bvh(['Human.male_casualsuit06'])
    bone = 'spine_03'
    # ---- backpack
    parts = [box('PackMain', (0.34, 0.2, 0.46), (0, 0.235, 1.27), 0.05), box('PackFlap', (0.35, 0.225, 0.07), (0, 0.235, 1.51), 0.02),
             box('PackFront', (0.26, 0.07, 0.22), (0, 0.35, 1.19), 0.025), box('PackSideR', (0.075, 0.11, 0.2), (0.215, 0.24, 1.15), 0.02), box('PackSideL', (0.075, 0.11, 0.2), (-0.215, 0.24, 1.15), 0.02),
             box('PackLid', (0.2, 0.05, 0.1), (0, 0.36, 1.42), 0.02)]
    for o in parts: finish(o, canvas, bone, rig)
    br = cyl('Bedroll', 0.065, 0.4, (0, 0.24, 1.6), (0, math.pi / 2, 0)); finish(br, roll, bone, rig)
    for x in (-0.12, 0.12):
        rg = cyl('BedrollStrap', 0.069, 0.03, (x, 0.24, 1.6), (0, math.pi / 2, 0)); finish(rg, leather, bone, rig)
    bt = cyl('Bottle', 0.038, 0.22, (0.215, 0.31, 1.13), (0, 0, 0)); finish(bt, bottle, bone, rig, uv=False)
    cap = cyl('BottleCap', 0.02, 0.03, (0.215, 0.31, 1.25)); finish(cap, brass, bone, rig, uv=False)
    # ---- shoulder straps + chest strap (projected onto the t-shirt so they sit on the body)
    for s in (1, -1):
        pts = [(s * 0.11, 0.17, 1.47), (s * 0.12, 0.06, 1.51), (s * 0.13, -0.03, 1.49), (s * 0.135, -0.11, 1.40), (s * 0.14, -0.13, 1.29), (s * 0.18, -0.06, 1.16), (s * 0.16, 0.07, 1.08), (s * 0.15, 0.13, 1.06)]
        path = project_path(pts, bvh, 0.006, 8); path = [(p, n) for (p, n) in path if p.y < 0.115 or p.z > 1.3]
        # keep the segment that leaves the shoulder toward the pack unprojected so it meets the pack top
        rb = ribbon('Strap', path, 0.05, 0.012); finish(rb, leather, bone, rig)
    cs = project_path([(-0.14, -0.13, 1.29), (0.0, -0.15, 1.29), (0.14, -0.13, 1.29)], bvh, 0.008, 10); finish(ribbon('ChestStrap', cs, 0.025, 0.008), leather, bone, rig)
    finish(box('ChestBuckle', (0.03, 0.01, 0.035), (0, cs[len(cs) // 2][0].y - 0.002, 1.29), 0.003), brass, bone, rig, uv=False)
    # ---- belt, buckle, pouches
    ring = [(0.185 * math.sin(a), -0.03 + -0.15 * math.cos(a), 0.945) for a in [i / 36 * math.tau for i in range(36)]]
    path = project_path(ring + [ring[0]], bvh, 0.007, 2); belt = ribbon('Belt', path, 0.04, 0.01, closed=False); finish(belt, leather, 'pelvis', rig)
    finish(box('BeltBuckle', (0.05, 0.012, 0.04), (0, -0.168, 0.945), 0.004), brass, 'pelvis', rig, uv=False)
    for s in (1, -1):
        finish(box('Pouch', (0.075, 0.07, 0.1), (s * 0.175, -0.035, 0.885), 0.015), leather, 'pelvis', rig)
        finish(box('PouchFlap', (0.08, 0.075, 0.035), (s * 0.175, -0.035, 0.94), 0.01), leather, 'pelvis', rig)
    # ---- bandage on the left forearm
    b = rig.data.bones['lowerarm_l']; h = rig.matrix_world @ b.head_local; t = rig.matrix_world @ b.tail_local
    ax = (t - h).normalized(); c = h.lerp(t, 0.42); L = (t - h).length * 0.32
    bpy.ops.mesh.primitive_cylinder_add(radius=0.047, depth=L, vertices=28, location=c); bd = bpy.context.active_object; bd.name = 'Bandage'
    bd.rotation_euler = Vector((0, 0, 1)).rotation_difference(ax).to_euler(); bpy.ops.object.transform_apply(rotation=True)
    bm_ = bmesh.new(); bm_.from_mesh(bd.data); bmesh.ops.delete(bm_, geom=[f for f in bm_.faces if abs(f.normal.dot(ax)) > 0.9], context='FACES_ONLY'); bm_.to_mesh(bd.data); bm_.free()
    bd.modifiers.new('Solid', 'SOLIDIFY').thickness = 0.004; bpy.ops.object.modifier_apply(modifier='Solid')
    finish(bd, simple_mat('Bandage', TEXD + 'bandage.png', 0.9), 'lowerarm_l', rig)

def add_hat(simple_mat):
    from bl_ext.user_default.mpfb.services.humanservice import HumanService
    bm = bpy.data.objects['Human']
    o = HumanService.add_mhclo_asset(MP + 'clothes/fedora01/fedora01.mhclo', bm, asset_type='Clothes', material_type='MAKESKIN')
    o.data.materials.clear(); o.data.materials.append(simple_mat('SurvHat', TEXD + 'hat_surv.png', 0.85, MP + 'clothes/fedora01/fedora_normal.png', 0.8, spec=0.2))
    return o

def add_wide_hat(rig, simple_mat, center=(0.0, -0.043, 1.682)):
    prof = [(0.0, 0.118), (0.05, 0.121), (0.085, 0.113), (0.099, 0.092), (0.103, 0.05), (0.105, 0.012), (0.15, 0.004), (0.2, -0.004), (0.236, 0.004), (0.24, 0.012),
            (0.236, 0.008), (0.2, -0.012), (0.15, -0.012), (0.1, -0.004), (0.094, 0.0), (0.092, 0.05), (0.088, 0.09), (0.06, 0.108), (0.0, 0.11)]
    bm = bmesh.new(); vs = [bm.verts.new((r, 0, z)) for r, z in prof]
    for a, b in zip(vs[:-1], vs[1:]): bm.edges.new((a, b))
    bmesh.ops.spin(bm, geom=bm.verts[:] + bm.edges[:], cent=(0, 0, 0), axis=(0, 0, 1), angle=math.tau, steps=48, use_merge=True)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0005)
    for v in bm.verts:                                                  # felt hat shaping: crown dent along the front-back axis, brim droops front/back and lifts at the sides
        r = math.hypot(v.co.x, v.co.y)
        if r > 0.108: v.co.z += 0.045 * (v.co.x / 0.24) ** 2 - 0.03 * (v.co.y / 0.24) ** 2
        if v.co.z > 0.085 and r < 0.075: v.co.z -= 0.006 * math.exp(-(v.co.x / 0.03) ** 2) * min(1, (v.co.z - 0.085) / 0.03)
    me = bpy.data.meshes.new('Hat'); bm.to_mesh(me); bm.free(); o = bpy.data.objects.new('Hat', me); bpy.context.scene.collection.objects.link(o)
    o.location = center; o.rotation_euler = (-0.05, 0, 0)
    sd = o.modifiers.new('S', 'SUBSURF'); sd.levels = 1
    bpy.context.view_layer.objects.active = o; o.select_set(True); bpy.ops.object.transform_apply(location=True, rotation=True)
    for m in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=m.name)
    o.data.polygons.foreach_set('use_smooth', [True] * len(o.data.polygons))
    MPd = MP
    finish(o, simple_mat('SurvHat', TEXD + 'hat_surv.png', 0.9, spec=0.15, sheen=0.3), 'head', rig)
    band = cyl('HatBand', 0.1, 0.03, (center[0], center[1], center[2] + 0.02), verts=40)
    bm2 = bmesh.new(); bm2.from_mesh(band.data); bmesh.ops.delete(bm2, geom=[f for f in bm2.faces if abs(f.normal.z) > 0.9], context='FACES_ONLY'); bm2.to_mesh(band.data); bm2.free()
    band.modifiers.new('Solid', 'SOLIDIFY').thickness = 0.006; bpy.ops.object.modifier_apply(modifier='Solid')
    finish(band, simple_mat('HatBand', TEXD + 'leather.png', 0.6), 'head', rig, uv=True)
    return o

def add_boots(rig, simple_mat):
    """Tall lace-up boot shafts over the MPFB shoe (jeans tuck in), skinned between calf and foot bones."""
    boot_mat = simple_mat('BootShaft', TEXD + 'boots_shaft.png', 0.65, spec=0.35)
    lace_mat = flat_mat('Laces', (0.50, 0.42, 0.28), 0.9)
    cuff_mat = simple_mat('BootCuff', TEXD + 'leather.png', 0.6)
    made = []
    for side in ('l', 'r'):
        calf = rig.data.bones['calf_' + side]; foot = rig.data.bones['foot_' + side]
        ankle = rig.matrix_world @ foot.head_local; knee = rig.matrix_world @ calf.head_local
        axis = (knee - ankle).normalized(); fwd = Vector((0, -1, 0)); u = axis.cross(fwd).normalized(); v = u.cross(axis).normalized()   # v ~ forward
        H = 0.345; rings = 10; M = 30; z0 = -0.05
        bm = bmesh.new(); grid = []
        for i in range(rings):
            t = i / (rings - 1); c = ankle + axis * (z0 + H * t); r = 0.066 + 0.016 * t + 0.010 * math.exp(-((t - 0.1) / 0.14) ** 2)
            row = []
            for k in range(M):
                a = k / M * math.tau; bulge = 1 + 0.07 * max(0, math.cos(a - math.pi / 2)) * (1 - t) * 0   # circle
                row.append(bm.verts.new(c - v * 0.012 + u * math.cos(a) * r * 0.96 + v * math.sin(a) * r * 1.22))
            grid.append(row)
        for i in range(rings - 1):
            for k in range(M): bm.faces.new((grid[i][k], grid[i][(k + 1) % M], grid[i + 1][(k + 1) % M], grid[i + 1][k]))
        me = bpy.data.meshes.new('BootShaft_' + side); bm.to_mesh(me); bm.free(); o = bpy.data.objects.new('BootShaft_' + side, me); bpy.context.scene.collection.objects.link(o)
        bpy.context.view_layer.objects.active = o; o.select_set(True)
        sol = o.modifiers.new('Solid', 'SOLIDIFY'); sol.thickness = 0.007; sol.offset = 1; bpy.ops.object.modifier_apply(modifier='Solid')
        sd = o.modifiers.new('S', 'SUBSURF'); sd.levels = 1; bpy.ops.object.modifier_apply(modifier='S')
        for p in o.data.polygons: p.use_smooth = True
        # skin weights: lower part follows the foot, upper part follows the calf
        gz = o.vertex_groups.new(name='calf_' + side); gf = o.vertex_groups.new(name='foot_' + side)
        top = (ankle + axis * (z0 + H)).z; low = (ankle + axis * z0).z
        for vert in o.data.vertices:
            h = max(0.0, min(1.0, (vert.co.z - low) / max(1e-4, top - low))); w = h * h * (3 - 2 * h); w = min(1.0, w * 1.25)
            gz.add([vert.index], w, 'REPLACE'); gf.add([vert.index], 1 - w, 'REPLACE')
        md = o.modifiers.new('Armature', 'ARMATURE'); md.object = rig; o.parent = rig
        bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.uv.smart_project(angle_limit=1.0, island_margin=0.01); bpy.ops.object.mode_set(mode='OBJECT')
        o.data.materials.clear(); o.data.materials.append(boot_mat); made.append(o)
        # cuff ring + laces
        cc = ankle + axis * (z0 + H - 0.012) - v * 0.012
        bpy.ops.mesh.primitive_torus_add(major_radius=0.087, minor_radius=0.009, major_segments=36, minor_segments=8, location=cc)
        tor = bpy.context.active_object; tor.name = 'BootCuff_' + side; tor.rotation_euler = Vector((0, 0, 1)).rotation_difference(axis).to_euler(); bpy.ops.object.transform_apply(rotation=True)
        tor.data.materials.append(cuff_mat); tw = tor.vertex_groups.new(name='calf_' + side); tw.add(range(len(tor.data.vertices)), 1.0, 'REPLACE')
        mdt = tor.modifiers.new('Armature', 'ARMATURE'); mdt.object = rig; tor.parent = rig
        for i in range(6):
            t = 0.06 + i * 0.04; c = ankle + axis * (z0 + H * (0.28 + i * 0.1)) + v * (0.072 + 0.016 * (0.28 + i * 0.1) - 0.010)
            bpy.ops.mesh.primitive_cylinder_add(radius=0.004, depth=0.07, vertices=8, location=c); lc = bpy.context.active_object; lc.name = 'Lace'
            lc.rotation_euler = (0, math.pi / 2, (0.25 if i % 2 else -0.25)); bpy.ops.object.transform_apply(rotation=True)
            lc.data.materials.append(lace_mat); lw = lc.vertex_groups.new(name='calf_' + side); lw.add(range(len(lc.data.vertices)), 1.0, 'REPLACE')
            mdl = lc.modifiers.new('Armature', 'ARMATURE'); mdl.object = rig; lc.parent = rig
    return made
