import bpy, bmesh, math
from mathutils import Vector
exec(open("/Users/talaljawaid/Documents/Talal's Folder/Claude/Experiment 2026/Experiment 3/AI Game/assets/blender/animal_parts.py").read())

def _mat(name, color, rough=0.5, metal=0.0, alpha=None, vc=False):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; b = nt.nodes['Principled BSDF']
    if vc:
        ca = nt.nodes.new('ShaderNodeVertexColor'); ca.layer_name = 'Col'; nt.links.new(ca.outputs['Color'], b.inputs['Base Color'])
    else: b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    if alpha is not None: b.inputs['Alpha'].default_value = alpha; m.surface_render_method = 'BLENDED'
    return m

ST = [  # y, half width, z bottom, z top   (front is -Y)
    (-2.75, 0.10, 0.62, 0.92), (-2.55, 0.38, 0.45, 1.22), (-2.2, 0.66, 0.32, 1.65), (-1.6, 0.92, 0.26, 2.02), (-0.8, 1.05, 0.22, 2.22),
    (0.2, 1.06, 0.24, 2.24), (1.0, 0.98, 0.34, 2.12), (1.7, 0.78, 0.55, 1.90), (2.35, 0.40, 0.98, 1.62)]

def _sm(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a))); return t * t * (3 - 2 * t)

def paint(y, z, nz, side):
    base = Vector((0.80, 0.82, 0.84)); glassc = Vector((0.025, 0.04, 0.05))
    if z < 0.62: base = Vector((0.30, 0.32, 0.34))
    stripe = _sm(0.94, 1.0, z) * _sm(1.34, 1.28, z) * _sm(-2.2, -2.1, y) * _sm(1.8, 1.7, y)
    base = base.lerp(Vector((0.62, 0.09, 0.08)), stripe)
    if nz > 0.7 and z > 2.0: base = base * 0.9
    if y > 1.5: base = base.lerp(Vector((0.78, 0.8, 0.82)), 0.5)
    front = _sm(1.18, 1.26, z) * _sm(-0.35, -0.55, y) * _sm(-2.7, -2.6, -y * -1 if False else y) * (1.0 - _sm(0.9, 1.0, abs(side)))
    sidew = _sm(0.5, 0.62, abs(side)) * _sm(1.36, 1.44, z) * _sm(1.94, 1.86, z) * max(_sm(-1.98, -1.9, y) * _sm(-0.84, -0.92, y), _sm(-0.58, -0.5, y) * _sm(0.52, 0.44, y))
    g = max(front, sidew); base = base.lerp(glassc, min(1.0, g * 1.4))
    seam = 1.0 - _sm(0.0, 0.018, min(abs(y + 0.7), abs(y - 0.55))) if z > 0.5 and z < 1.95 and abs(side) > 0.5 else 0.0
    return base.lerp(Vector((0.2, 0.22, 0.24)), seam * 0.8)

def fuselage():
    bm = bmesh.new(); N = 28; rows = []
    for (y, w, zb, zt) in ST:
        c = (zb + zt) / 2; hh = (zt - zb) / 2; ring = []
        for k in range(N):
            a = k / N * math.tau; ca, sa = math.cos(a), math.sin(a); p = 2.6                         # superellipse: boxier sides, rounded top
            ex = abs(ca) ** (2 / p) * (1 if ca >= 0 else -1); ez = abs(sa) ** (2 / p) * (1 if sa >= 0 else -1)
            ring.append(bm.verts.new((w * ex, y, c + hh * ez * (1.0 if sa >= 0 else 0.85))))
        rows.append(ring)
    for i in range(len(rows) - 1):
        for k in range(N): bm.faces.new((rows[i][k], rows[i][(k + 1) % N], rows[i + 1][(k + 1) % N], rows[i + 1][k]))
    bm.faces.new(rows[0][::-1]); bm.faces.new(rows[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new('Fuselage'); bm.to_mesh(me); bm.free(); o = bpy.data.objects.new('Fuselage', me); bpy.context.scene.collection.objects.link(o)
    sd = o.modifiers.new('S', 'SUBSURF'); sd.levels = 3; bpy.context.view_layer.objects.active = o; bpy.ops.object.modifier_apply(modifier='S')
    for p in me.polygons: p.use_smooth = True
    col = me.color_attributes.new('Col', 'BYTE_COLOR', 'POINT')
    for v in me.vertices:
        c = paint(v.co.y, v.co.z, v.normal.z, v.co.x); col.data[v.index].color = (c[0] ** 2.2, c[1] ** 2.2, c[2] ** 2.2, 1)
    return o

def glass_from(body):
    bm = bmesh.new(); bm.from_mesh(body.data); bm.faces.ensure_lookup_table()
    keep = [f for f in bm.faces if (f.calc_center_median().y < -0.35 and f.calc_center_median().z > 1.18 and f.calc_center_median().y > -2.62) or (f.calc_center_median().z > 0.5 and f.calc_center_median().z < 1.9 and abs(f.calc_center_median().x) > 0.9 and -1.7 < f.calc_center_median().y < -0.7 and False)]
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f not in keep], context='FACES')
    for v in bm.verts: v.co += v.normal * 0.012
    me = bpy.data.meshes.new('Canopy'); bm.to_mesh(me); bm.free(); o = bpy.data.objects.new('Canopy', me); bpy.context.scene.collection.objects.link(o)
    for p in me.polygons: p.use_smooth = True
    return o

def side_windows_and_doors(mats):
    out = []
    for s in (-1, 1):
        for (y0, y1, name) in ((-1.9, -0.85, 'WinF'), (-0.55, 0.45, 'WinR')):
            bpy.ops.mesh.primitive_plane_add(size=1, location=(s * 1.07, (y0 + y1) / 2, 1.62), rotation=(math.pi / 2, 0, math.pi / 2 * s)); w = bpy.context.active_object; w.name = name; w.scale = ((y1 - y0), 0.55, 1)
            bpy.ops.object.transform_apply(scale=True, rotation=True); w.data.materials.append(mats['glass']); out.append(w)
        # door seams
        for y in (-0.7, 0.55):
            cu = bpy.data.curves.new('Seam', 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = 0.006; sp = cu.splines.new('POLY'); sp.points.add(1)
            sp.points[0].co = (s * 1.065, y, 0.55, 1); sp.points[1].co = (s * 1.065, y, 1.95, 1)
            o = bpy.data.objects.new('Seam', cu); bpy.context.scene.collection.objects.link(o)
            me = bpy.data.meshes.new_from_object(o.evaluated_get(bpy.context.evaluated_depsgraph_get())); so = bpy.data.objects.new('SeamM', me); bpy.context.scene.collection.objects.link(so)
            so.data.materials.append(mats['dark']); out.append(so); bpy.data.objects.remove(o, do_unlink=True)
        bpy.ops.mesh.primitive_cylinder_add(radius=0.025, depth=0.12, location=(s * 1.085, -0.72, 1.15), rotation=(0, math.pi / 2, 0)); h = bpy.context.active_object; h.data.materials.append(mats['metal']); out.append(h)
    return out

def boom_and_tail(mats):
    boom = tapered_tube('Boom', [(0, 2.2, 1.40), (0, 3.6, 1.50), (0, 5.2, 1.62), (0, 6.5, 1.70)], [0.42, 0.30, 0.19, 0.11], segs=16, subdiv_each=8,
                        color_fn=lambda t: (0.78, 0.80, 0.82)); boom.data.materials.append(mats['paint'])
    fin = bmesh.new(); pts = [(0, 6.05, 1.64), (0, 6.75, 1.72), (0, 6.95, 2.55), (0, 6.55, 2.62), (0, 6.15, 1.9)]; vs = [fin.verts.new(p) for p in pts]; fin.faces.new(vs)
    me = bpy.data.meshes.new('Fin'); fin.to_mesh(me); fin.free(); fo = bpy.data.objects.new('Fin', me); bpy.context.scene.collection.objects.link(fo)
    sol = fo.modifiers.new('S', 'SOLIDIFY'); sol.thickness = 0.07; bpy.context.view_layer.objects.active = fo; bpy.ops.object.modifier_apply(modifier='S')
    bv = fo.modifiers.new('B', 'BEVEL'); bv.width = 0.02; bv.segments = 2; bpy.ops.object.modifier_apply(modifier='B'); [setattr(p, 'use_smooth', True) for p in fo.data.polygons]
    fo.data.materials.append(mats['red'])
    stab = []
    for s in (-1, 1):
        sb = bmesh.new(); pts = [(0, 6.0, 1.70), (s * 0.95, 6.35, 1.72), (s * 0.95, 6.62, 1.72), (0, 6.6, 1.70)]; vs = [sb.verts.new(p) for p in pts]; sb.faces.new(vs if s > 0 else vs[::-1])
        m2 = bpy.data.meshes.new('Stab'); sb.to_mesh(m2); sb.free(); so = bpy.data.objects.new('Stab', m2); bpy.context.scene.collection.objects.link(so)
        sol = so.modifiers.new('S', 'SOLIDIFY'); sol.thickness = 0.05; bpy.context.view_layer.objects.active = so; bpy.ops.object.modifier_apply(modifier='S'); so.data.materials.append(mats['red']); stab.append(so)
    return [boom, fo] + stab

def skids(mats):
    out = []
    for s in (-1, 1):
        sk = tapered_tube('Skid', [(s * 0.95, -1.9, 0.18), (s * 1.0, -1.5, 0.08), (s * 1.0, 0.8, 0.08), (s * 1.0, 1.6, 0.10), (s * 0.97, 2.0, 0.22)], [0.045] * 5, segs=10, subdiv_each=6, color_fn=lambda t: (0.12, 0.13, 0.14)); sk.data.materials.append(mats['dark']); out.append(sk)
    for y in (-0.85, 0.75):
        cs = tapered_tube('Cross', [(-0.98, y, 0.10), (-0.7, y, 0.55), (0.0, y, 0.58), (0.7, y, 0.55), (0.98, y, 0.10)], [0.04] * 5, segs=10, subdiv_each=6, color_fn=lambda t: (0.12, 0.13, 0.14)); cs.data.materials.append(mats['dark']); out.append(cs)
    return out

def rotor_assembly(mats):
    mast = tapered_tube('Mast', [(0, -0.15, 2.18), (0, -0.15, 2.5)], [0.11, 0.09], segs=14, subdiv_each=2, color_fn=lambda t: (0.2, 0.2, 0.22)); mast.data.materials.append(mats['dark'])
    cowl = tapered_tube('Cowl', [(0, 0.2, 2.18), (0, 0.9, 2.3), (0, 1.5, 2.2)], [0.5, 0.5, 0.35], segs=18, subdiv_each=6, color_fn=lambda t: (0.74, 0.76, 0.78)); cowl.data.materials.append(mats['paint'])
    blades = []
    for s in (-1, 1):
        bm = bmesh.new(); L = 4.9; pts = [(0, 0.0), (s * 0.35, 0.0), (s * L, 0.0), (s * L, 0.0)]
        w = [0.30, 0.30, 0.20]; xs = [0.25, 2.0, L]
        vs = []
        for x, ww in zip(xs, w): vs += [bm.verts.new((s * x, -ww / 2, 0)), bm.verts.new((s * x, ww / 2, 0))]
        for i in range(2): bm.faces.new((vs[2 * i], vs[2 * i + 1], vs[2 * i + 3], vs[2 * i + 2]) if s > 0 else (vs[2 * i + 1], vs[2 * i], vs[2 * i + 2], vs[2 * i + 3]))
        me = bpy.data.meshes.new('Blade'); bm.to_mesh(me); bm.free(); b = bpy.data.objects.new('Blade', me); bpy.context.scene.collection.objects.link(b)
        sol = b.modifiers.new('S', 'SOLIDIFY'); sol.thickness = 0.03; bpy.context.view_layer.objects.active = b; bpy.ops.object.modifier_apply(modifier='S'); [setattr(p, 'use_smooth', True) for p in b.data.polygons]
        b.data.materials.append(mats['dark']); blades.append(b)
    hubm = tapered_tube('HubM', [(0, 0, -0.04), (0, 0, 0.1)], [0.15, 0.12], segs=14, subdiv_each=2, color_fn=lambda t: (0.16, 0.16, 0.18)); hubm.data.materials.append(mats['dark'])
    tr = []
    for k in range(2):
        bm = bmesh.new(); vs = [bm.verts.new(p) for p in [(0, -0.05 * (1 if k == 0 else -1), 0.1), (0, 0.05, 0.1), (0, 0.05, 0.62), (0, -0.05, 0.62)]]; bm.faces.new(vs)
        me = bpy.data.meshes.new('TB'); bm.to_mesh(me); bm.free(); t = bpy.data.objects.new('TBlade', me); bpy.context.scene.collection.objects.link(t)
        t.rotation_euler = (k * math.pi / 2 * 0 + 0, 0, 0); sol = t.modifiers.new('S', 'SOLIDIFY'); sol.thickness = 0.015; bpy.context.view_layer.objects.active = t; bpy.ops.object.modifier_apply(modifier='S')
        t.data.materials.append(mats['dark']); tr.append(t)
    return mast, cowl, blades + [hubm], tr

def build_heli_all(export_path=None):
    for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
    mats = {'paint': _mat('HeliPaint', None, 0.32, 0.35, vc=True), 'glass': _mat('HeliGlass', (0.35, 0.5, 0.58), 0.04, 0.2, alpha=0.38), 'dark': _mat('HeliDark', (0.06, 0.065, 0.07), 0.55, 0.3),
            'red': _mat('HeliRed', (0.52, 0.07, 0.06), 0.35, 0.3), 'metal': _mat('HeliMetal', (0.5, 0.52, 0.55), 0.3, 0.9)}
    body = fuselage(); body.data.materials.append(mats['paint']); canopy = glass_from(body); canopy.data.materials.append(mats['glass'])
    bpy.data.objects.remove(canopy, do_unlink=True)
    parts = [body] + boom_and_tail(mats) + skids(mats)
    exec(open("/Users/talaljawaid/Documents/Talal's Folder/Claude/Experiment 2026/Experiment 3/AI Game/assets/blender/heli_details.py").read(), globals())
    parts += add_details(mats)
    mast, cowl, rotorparts, tailparts = rotor_assembly(mats)
    # hierarchy: Body (static), Rotor (spins about Z), TailRotor (spins about X)
    root = bpy.data.objects.new('Heli', None); bpy.context.scene.collection.objects.link(root)
    bodyN = bpy.data.objects.new('Body', None); bpy.context.scene.collection.objects.link(bodyN); bodyN.parent = root
    for o in parts + [mast, cowl]: o.parent = bodyN
    rotor = bpy.data.objects.new('Rotor', None); bpy.context.scene.collection.objects.link(rotor); rotor.parent = bodyN; rotor.location = (0, -0.15, 2.5)
    for o in rotorparts: o.parent = rotor
    for o in rotorparts[:2]: o.rotation_euler = (0, 0, 0)
    tail = bpy.data.objects.new('TailRotor', None); bpy.context.scene.collection.objects.link(tail); tail.parent = bodyN; tail.location = (0.14, 6.78, 1.8)
    for k, o in enumerate(tailparts): o.parent = tail; o.rotation_euler = (0, 0, 0) if k == 0 else (0, 0, 0)
    tailparts[1].rotation_euler = (math.pi, 0, 0)
    if export_path:
        meshes = [o for o in bpy.data.objects if o.type == 'MESH']
        for o in bpy.data.objects: o.select_set(False)
        for o in bpy.data.objects: o.select_set(True)
        bpy.context.view_layer.objects.active = root
        bpy.ops.export_scene.gltf(filepath=export_path, export_format='GLB', use_selection=True, export_apply=True, export_animations=False, export_yup=True, export_materials='EXPORT', export_vertex_color='ACTIVE', export_cameras=False, export_lights=False)
    return root
