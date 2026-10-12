"""Hero-prop tools for the game: bearded Viking axe + cloth-wrapped torch (reference: TurboSquid 2563271 / 2136476, modelled from scratch).
Blender frame: grip at the origin, working end along +Z, cutting edge facing -Y (exports to the game's convention: +Y up, edge toward +Z).
Colour (wood grain, leather, steel scratches, rust, soot) lives in the 'Col' vertex colour with ray-cast ambient occlusion baked in; two PBR materials: organic and metal."""
import bpy, bmesh, math, random
from mathutils import Vector, Matrix, noise as mn
from mathutils.bvhtree import BVHTree

OUT = "/Users/talaljawaid/Documents/Talal's Folder/Claude/Experiment 2026/Experiment 3/AI Game/public/models/tools.glb"
RND = random.Random(21)


def sm(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a))); return t * t * (3 - 2 * t)


def make_mats():
    def m(name, rough, metal):
        mm = bpy.data.materials.new(name); mm.use_nodes = True; nt = mm.node_tree; b = nt.nodes['Principled BSDF']; b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
        n = nt.nodes.new('ShaderNodeVertexColor'); n.layer_name = 'Col'; nt.links.new(n.outputs['Color'], b.inputs['Base Color']); return mm
    return {'org': m('ToolOrganic', 0.82, 0.0), 'metal': m('ToolMetal', 0.4, 0.85)}


def smooth(o):
    for p in o.data.polygons: p.use_smooth = True


def new_obj(name, me): o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o); return o


def tube_var(name, pts, radii, res=10, caps=True, ru=8):
    """smooth tube through points with per-point radius"""
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = 1.0; cu.bevel_resolution = max(2, res // 3); cu.use_fill_caps = caps; cu.resolution_u = ru
    sp = cu.splines.new('BEZIER'); sp.bezier_points.add(len(pts) - 1)
    for bp, p, r in zip(sp.bezier_points, pts, radii): bp.co = p; bp.handle_left_type = bp.handle_right_type = 'AUTO'; bp.radius = r
    o = bpy.data.objects.new(name, cu); bpy.context.scene.collection.objects.link(o)
    me = bpy.data.meshes.new_from_object(o.evaluated_get(bpy.context.evaluated_depsgraph_get())); mo = new_obj(name, me)
    bpy.data.objects.remove(o, do_unlink=True); smooth(mo); return mo


def helix(name, z0, z1, r, turns, thick, phase=0.0, handed=1, pts_per_turn=14, radius_fn=None):
    n = int(turns * pts_per_turn); pts = []; rad = []
    for i in range(n + 1):
        t = i / n; a = phase + handed * t * turns * math.tau; z = z0 + (z1 - z0) * t; rr = (radius_fn(z) if radius_fn else r)
        pts.append((math.cos(a) * rr, math.sin(a) * rr, z)); rad.append(thick)
    return tube_var(name, pts, rad, 3, True, 2)


def paint(o, fn):
    me = o.data
    if 'Col' in me.color_attributes: me.color_attributes.remove(me.color_attributes['Col'])
    col = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
    for v in me.vertices:
        c = fn(v.co, v.normal); col.data[v.index].color = (c[0] ** 2.2, c[1] ** 2.2, c[2] ** 2.2, 1.0)


def lerp3(a, b, t): return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


def noise3(co, s, off=0.0): return 0.5 + 0.5 * mn.noise(Vector((co.x * s + off, co.y * s, co.z * s)))


def join(objs, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1: bpy.ops.object.join()
    o = bpy.context.active_object; o.name = name; return o


def bake_ao(objs, rays=40, dist=0.12, strength=0.65, seed=3):
    """cheap AO into the vertex colour: cosine-weighted rays from each vertex against the whole tool"""
    bpy.context.view_layer.update(); rnd = random.Random(seed); bm = bmesh.new()
    for o in objs:
        t = bmesh.new(); t.from_mesh(o.data); t.transform(o.matrix_world); off = len(bm.verts)
        for v in t.verts: bm.verts.new(v.co)
        bm.verts.ensure_lookup_table()
        for f in t.faces: bm.faces.new([bm.verts[off + v.index] for v in f.verts])
        t.free()
    tree = BVHTree.FromBMesh(bm); bm.free()
    hemi = []
    for _ in range(rays):
        u1, u2 = rnd.random(), rnd.random(); r = math.sqrt(u1); a = math.tau * u2; hemi.append(Vector((r * math.cos(a), r * math.sin(a), math.sqrt(max(0.0, 1 - u1)))))
    for o in objs:
        me = o.data; mw = o.matrix_world; nm = mw.to_3x3().inverted().transposed(); col = me.color_attributes['Col']
        for v in me.vertices:
            p0 = mw @ v.co; n = (nm @ v.normal).normalized(); tx = n.cross(Vector((0, 0, 1)) if abs(n.z) < 0.9 else Vector((1, 0, 0))).normalized(); ty = n.cross(tx); hit = 0.0
            for h in hemi:
                d = tx * h.x + ty * h.y + n * h.z; res = tree.ray_cast(p0 + n * 0.002, d, dist)
                if res[0] is not None: hit += 1.0 - res[3] / dist * 0.6
            ao = max(0.25, 1.0 - strength * hit / rays); c = col.data[v.index].color; col.data[v.index].color = (c[0] * ao, c[1] * ao, c[2] * ao, 1.0)


# ------------------------------------------------------------------------------------------------------------- axe
def head_profile():
    """side view of the bearded head: (forward f, height h) outline, eye block at the back, curved edge, hooked beard"""
    return [(-0.040, 0.462), (0.040, 0.462), (0.120, 0.478), (0.188, 0.500), (0.213, 0.470), (0.226, 0.425), (0.229, 0.375), (0.222, 0.325), (0.206, 0.280),
            (0.180, 0.235), (0.148, 0.196), (0.118, 0.168), (0.100, 0.176), (0.092, 0.205), (0.078, 0.250), (0.058, 0.300), (0.042, 0.340), (0.040, 0.360), (-0.040, 0.360)]


def thick_at(f, h):
    """half-thickness of the head: heavy at the eye, tapering to a wedge at the cutting edge, slightly fuller along the spine"""
    spine = 1.0 - sm(0.0, 0.17, f - 0.04)
    edge = sm(0.12, 0.225, f)
    return 0.0011 + 0.026 * spine ** 1.15 + 0.010 * (1 - edge) * (1 - spine) + (0.0035 * (1 - edge)) * (1.0 - abs(h - 0.34) * 2.2).clip(0.0, 1.0) if False else 0.0011 + 0.026 * spine ** 1.15 + 0.009 * (1 - edge) * (1 - spine)


def make_head(mats):
    prof = head_profile(); bm = bmesh.new(); vs = [bm.verts.new((0.0, -f, h)) for f, h in prof]
    face = bm.faces.new(vs); bmesh.ops.triangulate(bm, faces=[face])
    for _ in range(2): bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=1, use_grid_fill=True)
    me = bpy.data.meshes.new('HeadFlat'); bm.to_mesh(me); bm.free(); o = new_obj('Head', me)
    sol = o.modifiers.new('S', 'SOLIDIFY'); sol.thickness = 0.002; sol.offset = 0; bpy.context.view_layer.objects.active = o; bpy.ops.object.modifier_apply(modifier='S')
    for v in o.data.vertices:
        f = -v.co.y; sgn = 1.0 if v.co.x >= 0 else -1.0
        hh = thick_at(f, v.co.z) * (1.0 + 0.04 * mn.noise(Vector((f * 40, v.co.z * 40, 3))))
        v.co.x = sgn * hh
    o.data.update()
    bv = o.modifiers.new('B', 'BEVEL'); bv.width = 0.0012; bv.segments = 2; bv.limit_method = 'ANGLE'; bpy.ops.object.modifier_apply(modifier='B')
    smooth(o); o.data.materials.append(mats['metal'])

    def col(co, n):
        f = -co.y; h = co.z; base = (0.40, 0.41, 0.42)
        edge = sm(0.17, 0.225, f); c = lerp3(base, (0.78, 0.80, 0.82), edge * 0.8)                      # honed bright edge
        sc = mn.noise(Vector((f * 90, h * 24, co.x * 40))) * 0.5 + 0.5; sc2 = abs(mn.noise(Vector((f * 14, h * 70, 5))))
        c = lerp3(c, (0.30, 0.31, 0.32), sm(0.55, 0.9, sc) * 0.55); c = lerp3(c, (0.72, 0.74, 0.76), sm(0.82, 0.97, sc2) * 0.5)    # scratches
        rust = sm(0.62, 0.85, noise3(co, 22, 9)) * (1 - edge) * 0.8; c = lerp3(c, (0.36, 0.17, 0.08), rust)
        c = lerp3(c, (0.14, 0.13, 0.13), sm(0.3, 0.0, f - 0.04) * 0.55)                                    # forge-dark eye
        return c
    paint(o, col); return o


def make_axe(mats):
    parts_org = []; parts_metal = []
    z0, z1 = -0.21, 0.49
    pts = [(0.0, 0.0035 * math.sin(i * 0.9), z0 + (z1 - z0) * i / 8) for i in range(9)]
    rad = [0.0205, 0.0185, 0.0165, 0.0158, 0.0158, 0.0168, 0.0185, 0.0205, 0.0215]
    handle = tube_var('Handle', pts, rad, 12); handle.data.materials.append(mats['org'])
    paint(handle, lambda co, n: lerp3(lerp3((0.27, 0.14, 0.065), (0.16, 0.08, 0.04), noise3(co, 5, 2) * 0.8), (0.09, 0.045, 0.025), sm(0.55, 0.9, noise3(Vector((co.x * 3, co.y * 3, co.z * 38)), 1, 7)) * 0.7)); parts_org.append(handle)
    rad_at = lambda z: 0.0158 + (0.0215 - 0.0158) * (abs(z - 0.12) / 0.4) ** 2 + 0.0004
    sleeve = tube_var('GripSleeve', [(0, 0, z) for z in (-0.19, -0.10, 0.0, 0.10, 0.19)], [rad_at(z) + 0.0016 for z in (-0.19, -0.10, 0.0, 0.10, 0.19)], 12); sleeve.data.materials.append(mats['org'])
    paint(sleeve, lambda co, n: lerp3((0.22, 0.115, 0.055), (0.13, 0.065, 0.032), noise3(co, 14, 4))); parts_org.append(sleeve)
    for k, (za, zb, turns, ph, hd, th) in enumerate(((-0.195, 0.19, 26, 0.0, 1, 0.0050), (0.215, 0.345, 7, 0.5, 1, 0.0034), (0.215, 0.345, 7, 0.5, -1, 0.0034))):
        hx = helix('Wrap%d' % k, za, zb, 0.0, turns, th, ph, hd, 14, lambda z: rad_at(z) + (0.0046 if k == 0 else 0.0034)); hx.data.materials.append(mats['org'])
        paint(hx, lambda co, n, k=k: lerp3((0.34, 0.185, 0.09), (0.21, 0.11, 0.055), noise3(co, 30, 11) * (1.0 if k == 0 else 0.8))); parts_org.append(hx)
    # pommel: leather-capped end
    pom = tube_var('Pommel', [(0, 0, z0 - 0.012), (0, 0, z0 + 0.012)], [0.0225, 0.0225], 14); pom.data.materials.append(mats['org']); paint(pom, lambda co, n: (0.12, 0.06, 0.035)); parts_org.append(pom)
    head = make_head(mats); parts_metal.append(head)
    # steel fittings: ferrules under and over the head, peen cap, side rivets on the eye block
    def ring(name, z, r, minor):
        bpy.ops.mesh.primitive_torus_add(major_radius=r, minor_radius=minor, major_segments=28, minor_segments=8, location=(0, 0, z)); o = bpy.context.active_object; o.name = name; smooth(o); o.data.materials.append(mats['metal'])
        paint(o, lambda co, n: lerp3((0.30, 0.31, 0.33), (0.18, 0.17, 0.17), noise3(co, 40, 2))); return o
    parts_metal += [ring('FerruleLow', 0.352, 0.0215, 0.0048), ring('FerruleMid', 0.364, 0.0222, 0.0030), ring('FerruleHigh', 0.468, 0.0225, 0.004)]
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.026, segments=20, ring_count=10, location=(0, 0, 0.470)); cap = bpy.context.active_object; cap.name = 'Peen'; cap.scale = (1, 1, 0.5); bpy.ops.object.transform_apply(scale=True); smooth(cap); cap.data.materials.append(mats['metal'])
    paint(cap, lambda co, n: lerp3((0.34, 0.35, 0.37), (0.16, 0.15, 0.15), noise3(co, 30, 6))); parts_metal.append(cap)
    for sx in (-1, 1):
        for zr in (0.385, 0.435):
            bpy.ops.mesh.primitive_uv_sphere_add(radius=0.0065, segments=10, ring_count=6, location=(sx * 0.0282, -0.0, zr)); rv = bpy.context.active_object; rv.name = 'Rivet'; rv.scale = (0.5, 1, 1); bpy.ops.object.transform_apply(scale=True); smooth(rv); rv.data.materials.append(mats['metal'])
            paint(rv, lambda co, n: (0.42, 0.43, 0.45)); parts_metal.append(rv)
    bake_ao(parts_org + parts_metal, 40, 0.1, 0.7)
    org = join(parts_org, 'AxeOrganic'); met = join(parts_metal, 'AxeMetal')
    root = bpy.data.objects.new('stone_axe', None); bpy.context.scene.collection.objects.link(root); org.parent = root; met.parent = root
    return root


# ------------------------------------------------------------------------------------------------------------- torch
def make_torch(mats):
    org = []; met = []
    z0, z1 = -0.20, 0.36
    pole = tube_var('Pole', [(0.003 * math.sin(i), 0.002 * math.cos(i * 1.3), z0 + (z1 - z0) * i / 7) for i in range(8)], [0.0165, 0.0155, 0.0150, 0.0152, 0.0160, 0.0175, 0.0195, 0.0215], 12); pole.data.materials.append(mats['org'])
    paint(pole, lambda co, n: lerp3(lerp3((0.30, 0.15, 0.08), (0.17, 0.075, 0.04), noise3(co, 6, 1)), (0.08, 0.04, 0.022), sm(0.5, 0.9, noise3(Vector((co.x * 3, co.y * 3, co.z * 30)), 1, 5)) * 0.8)); org.append(pole)
    # cloth-wrapped head: lumpy ovoid with rope bands
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1.0, segments=28, ring_count=16, location=(0, 0, 0.405)); head = bpy.context.active_object; head.name = 'ClothHead'
    for v in head.data.vertices:
        n = mn.noise(Vector((v.co.x * 3.2, v.co.y * 3.2, v.co.z * 3.2 + 4))) * 0.14 + mn.noise(Vector((v.co.x * 9, v.co.y * 9, v.co.z * 9))) * 0.04
        r = 0.0 + 1.0 + n; v.co = Vector((v.co.x * 0.040 * r, v.co.y * 0.040 * r, v.co.z * 0.075 * (1.0 + n * 0.6)))
    smooth(head); head.data.materials.append(mats['org'])
    paint(head, lambda co, n: lerp3(lerp3((0.30, 0.22, 0.13), (0.15, 0.10, 0.06), noise3(co, 55, 3)), (0.035, 0.022, 0.015), sm(0.405, 0.47, co.z) * 0.9 + sm(0.55, 0.9, noise3(co, 20, 8)) * 0.25)); org.append(head)
    for k in range(9):
        z = 0.340 + k * 0.0165; rr = 0.040 * math.sqrt(max(0.05, 1 - ((z - 0.405) / 0.075) ** 2)) + 0.0042
        hx = helix('Band%d' % k, z - 0.007, z + 0.007, 0.0, 1.0, 0.0042, k * 1.7, 1, 18, lambda zz, rr=rr: rr); hx.data.materials.append(mats['org']); paint(hx, lambda co, n: lerp3((0.29, 0.20, 0.10), (0.15, 0.10, 0.05), noise3(co, 60, 2))); org.append(hx)
    neck = helix('NeckRope', 0.325, 0.352, 0.0, 3.0, 0.0042, 0.0, 1, 16, lambda z: 0.0215 + 0.006 * sm(0.325, 0.352, z)); neck.data.materials.append(mats['org']); paint(neck, lambda co, n: lerp3((0.31, 0.22, 0.11), (0.17, 0.11, 0.06), noise3(co, 70, 5))); org.append(neck)
    # frayed cloth strips draped over the top
    for k in range(7):
        a = k / 7 * math.tau + RND.uniform(-0.2, 0.2); L = RND.uniform(0.05, 0.085)
        pts = [(math.cos(a) * (0.012 + 0.020 * t), math.sin(a) * (0.012 + 0.020 * t), 0.468 - L * t * 1.0 - 0.004 * t * t * 20) for t in (0.0, 0.3, 0.6, 1.0)]
        st = tube_var('Strip%d' % k, pts, [0.0085, 0.0072, 0.0055, 0.0030], 6, True); st.scale = (1, 1, 1); st.data.materials.append(mats['org'])
        paint(st, lambda co, n: lerp3((0.17, 0.12, 0.07), (0.04, 0.03, 0.02), sm(0.40, 0.47, co.z) * 0.8 + 0.2 * noise3(co, 40, 2))); org.append(st)
    for o in org: o.parent = None
    ring = lambda name, z, r, minor: None
    bake_ao(org, 36, 0.06, 0.6)
    organic = join(org, 'TorchOrganic')
    root = bpy.data.objects.new('torch', None); bpy.context.scene.collection.objects.link(root); organic.parent = root
    fa = bpy.data.objects.new('FlameAnchor', None); bpy.context.scene.collection.objects.link(fa); fa.parent = root; fa.location = (0, 0, 0.47)
    return root


def build_tools(export=True):
    for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
    for m in list(bpy.data.materials): bpy.data.materials.remove(m)
    mats = make_mats(); axe = make_axe(mats); torch = make_torch(mats)
    torch.location = (1.0, 0.0, 0.0)
    if export:
        import logging; logging.disable(logging.CRITICAL)
        axe.location = (0, 0, 0); torch.location = (0, 0, 0)
        for o in bpy.data.objects: o.select_set(True)
        bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_apply=True, export_animations=False, export_yup=True, export_materials='EXPORT', export_vertex_color='ACTIVE', export_cameras=False, export_lights=False)
    return axe, torch
