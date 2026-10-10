"""Helicopter v2: hard-surface light utility helicopter (EC130-class), built for the game.
Pipeline (after Blender hard-surface / game-asset practice): clean lofted hull -> hollow shell -> boolean-cut window openings (crisp edges,
no jagged face selections) -> separate recessed glass -> real panel grooves, frames, hardware -> full interior -> vertex-AO baked by ray casts.
Front is -Y, tail +Y, up +Z (exported Y-up by the glTF exporter).  Hierarchy matches v1: Body / Rotor / TailRotor."""
import bpy, bmesh, math, random
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

D = "/Users/talaljawaid/Documents/Talal's Folder/Claude/Experiment 2026/Experiment 3/AI Game/assets/blender/"
exec(open(D + "animal_parts.py").read(), globals())
exec(open(D + "build_props.py").read(), globals())

ST = [  # y, half width, z bottom, z top
    (-2.78, 0.12, 0.62, 0.95), (-2.58, 0.40, 0.46, 1.25), (-2.2, 0.68, 0.32, 1.68), (-1.6, 0.93, 0.26, 2.03), (-0.8, 1.06, 0.22, 2.22),
    (0.2, 1.07, 0.24, 2.24), (1.0, 0.99, 0.34, 2.12), (1.7, 0.78, 0.55, 1.90), (2.35, 0.40, 0.98, 1.62)]


def mat(name, color, rough=0.5, metal=0.0, alpha=None, emit=None):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    if alpha is not None: b.inputs['Alpha'].default_value = alpha; m.surface_render_method = 'BLENDED'
    if emit: b.inputs['Emission Color'].default_value = (*emit, 1); b.inputs['Emission Strength'].default_value = 1.0
    m['tint'] = list(color); return m


def make_mats(wreck=False):
    return {
        'paint': mat('HeliPaint', (0.80, 0.82, 0.84), 0.28, 0.35), 'red': mat('HeliRed', (0.58, 0.07, 0.06), 0.3, 0.3),
        'glass': mat('HeliGlass', (0.35, 0.5, 0.58), 0.03, 0.2, alpha=0.34), 'dark': mat('HeliDark', (0.045, 0.048, 0.052), 0.6, 0.25),
        'rubber': mat('HeliRubber', (0.02, 0.02, 0.022), 0.85, 0.0), 'metal': mat('HeliMetal', (0.55, 0.57, 0.6), 0.28, 0.9),
        'fabric': mat('HeliSeat', (0.24, 0.25, 0.28), 0.9, 0.0), 'trim': mat('HeliTrim', (0.5, 0.52, 0.55), 0.55, 0.15),
        'screen': mat('HeliScreen', (0.05, 0.16, 0.22), 0.15, 0.0, emit=(0.1, 0.5, 0.7)), 'amber': mat('HeliAmber', (0.5, 0.3, 0.05), 0.3, 0.0, emit=(0.8, 0.4, 0.05)),
        'floor': mat('HeliFloor', (0.2, 0.205, 0.21), 0.8, 0.1)}


def tube(name, pts, r, segs=10, smooth=True):
    """constant-radius smooth tube along points (bezier with auto handles) - no twisting like a frame-based sweep"""
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = r; cu.bevel_resolution = max(2, segs // 3); cu.use_fill_caps = True; cu.resolution_u = 8
    sp = cu.splines.new('BEZIER'); sp.bezier_points.add(len(pts) - 1)
    for bp, p in zip(sp.bezier_points, pts): bp.co = p; bp.handle_left_type = bp.handle_right_type = 'AUTO' if smooth else 'VECTOR'
    o = bpy.data.objects.new(name, cu); bpy.context.scene.collection.objects.link(o)
    me = bpy.data.meshes.new_from_object(o.evaluated_get(bpy.context.evaluated_depsgraph_get())); mo = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(mo)
    bpy.data.objects.remove(o, do_unlink=True); shade_smooth(mo); return mo


def smooth_by_angle(o, deg=35):
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
    try: bpy.ops.object.shade_smooth_by_angle(angle=math.radians(deg))
    except Exception as e: print('smooth_by_angle failed', e)


def shade_smooth(o):
    for p in o.data.polygons: p.use_smooth = True


def link(o):
    if o.name not in bpy.context.scene.collection.objects: bpy.context.scene.collection.objects.link(o)
    return o


def obj_from_bm(bm, name):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o); return o


def apply_mods(o):
    bpy.context.view_layer.objects.active = o
    for m in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=m.name)


def hull_surface():
    bm = bmesh.new(); N = 36; rows = []
    for (y, w, zb, zt) in ST:
        c = (zb + zt) / 2; hh = (zt - zb) / 2; ring = []
        for k in range(N):
            a = k / N * math.tau; ca, sa = math.cos(a), math.sin(a); p = 2.6
            ex = abs(ca) ** (2 / p) * (1 if ca >= 0 else -1); ez = abs(sa) ** (2 / p) * (1 if sa >= 0 else -1)
            ring.append(bm.verts.new((w * ex, y, c + hh * ez * (1.0 if sa >= 0 else 0.85))))
        rows.append(ring)
    for i in range(len(rows) - 1):
        for k in range(N): bm.faces.new((rows[i][k], rows[i][(k + 1) % N], rows[i + 1][(k + 1) % N], rows[i + 1][k]))
    bm.faces.new(rows[0][::-1]); bm.faces.new(rows[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = obj_from_bm(bm, 'HullSrc'); sd = o.modifiers.new('S', 'SUBSURF'); sd.levels = 3; sd.render_levels = 3; apply_mods(o); shade_smooth(o); return o


def prism(name, y0, y1, z0, z1, x0, x1, r=0.16):
    """rounded-rectangle cutter running along X, from x0 to x1."""
    o = box(name, (abs(x1 - x0), y1 - y0, z1 - z0), ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), bevel=r, subdiv=0, segs=5)
    o.hide_render = True; return o


def boolean(target, cutter, op='DIFFERENCE'):
    md = target.modifiers.new('Bool', 'BOOLEAN'); md.operation = op; md.object = cutter; md.solver = 'EXACT'
    bpy.context.view_layer.objects.active = target; bpy.ops.object.modifier_apply(modifier='Bool')


def skin_faces(solid, bvh_src, keep_inside=None, tol=0.004):
    """from a boolean result keep only the faces lying on the original hull skin (drops the cutter's own walls); optional: drop faces inside another closed mesh"""
    bm = bmesh.new(); bm.from_mesh(solid.data); bm.faces.ensure_lookup_table()
    drop = []
    for f in bm.faces:
        c = f.calc_center_median()
        if bvh_src.find_nearest(c)[3] > tol: drop.append(f); continue
        if keep_inside is not None and keep_inside(c): drop.append(f)
    bmesh.ops.delete(bm, geom=drop, context='FACES'); bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(solid.data); bm.free(); return solid


def inside_test(cutter):
    tree = BVHTree.FromObject(cutter, bpy.context.evaluated_depsgraph_get()); mw = cutter.matrix_world
    def f(p):
        hits = 0; o = Vector(p); d = Vector((0.3, 1.0, 0.2)).normalized()
        for _ in range(12):
            r = tree.ray_cast(o, d)
            if r[0] is None: break
            hits += 1; o = r[0] + d * 1e-4
        return hits % 2 == 1
    return f


def offset_normals(o, d):
    me = o.data; bm = bmesh.new(); bm.from_mesh(me)
    for v in bm.verts: v.co += v.normal * d
    bm.to_mesh(me); bm.free()


def copy_obj(o, name):
    c = o.copy(); c.data = o.data.copy(); c.name = name; bpy.context.scene.collection.objects.link(c); return c


def build_hull_and_glass(mats, stripes=True):
    src = hull_surface(); src.name = 'HullSrc'
    cuts = []   # (cutter, expanded cutter, y0..)
    for s in (-1, 1):
        x0, x1 = (0.05, 2.0) if s > 0 else (-2.0, -0.05)
        cuts.append((prism('CutFront', -2.72, -0.86, 1.32, 2.02, x0, x1, 0.2), prism('CutFrontB', -2.78, -0.80, 1.26, 2.08, x0 - 0.1 * s, x1 + 0.1 * s, 0.24)))
        cuts.append((prism('CutDoor', -0.55, 0.49, 1.38, 1.95, s * 0.7, s * 1.6, 0.12), prism('CutDoorB', -0.61, 0.55, 1.32, 2.01, s * 0.6, s * 1.7, 0.16)))
    shell = copy_obj(src, 'Fuselage')
    sol = shell.modifiers.new('Sol', 'SOLIDIFY'); sol.thickness = 0.05; sol.offset = -1; apply_mods(shell)
    bvh_src = BVHTree.FromObject(src, bpy.context.evaluated_depsgraph_get())
    glass_parts = []; frame_parts = []
    for c, cb in cuts:
        g = copy_obj(src, 'g'); boolean(g, c, 'INTERSECT'); skin_faces(g, bvh_src); offset_normals(g, -0.022); glass_parts.append(g)
        r = copy_obj(src, 'r'); boolean(r, cb, 'INTERSECT'); boolean(r, c, 'DIFFERENCE'); skin_faces(r, bvh_src); offset_normals(r, 0.004); frame_parts.append(r)
    for c, cb in cuts: boolean(shell, c, 'DIFFERENCE')
    stripe_parts = []
    if stripes:
        for (y0, y1) in ((-2.3, 1.75),):
            band = box('Band', (4.0, y1 - y0, 0.26), (0, (y0 + y1) / 2, 1.14), bevel=0.002, subdiv=0, segs=1); band.hide_render = True
            st = copy_obj(src, 's'); boolean(st, band, 'INTERSECT'); skin_faces(st, bvh_src); offset_normals(st, 0.004); stripe_parts.append(st); bpy.data.objects.remove(band, do_unlink=True)
    for c, cb in cuts: bpy.data.objects.remove(c, do_unlink=True); bpy.data.objects.remove(cb, do_unlink=True)
    def joined(parts, name):
        bpy.ops.object.select_all(action='DESELECT')
        for p in parts: p.select_set(True)
        bpy.context.view_layer.objects.active = parts[0]; bpy.ops.object.join(); o = bpy.context.active_object; o.name = name; shade_smooth(o); return o
    glass = joined(glass_parts, 'Canopy'); frames = joined(frame_parts, 'WindowSeal'); extras = [frames]
    if stripe_parts: extras.append(joined(stripe_parts, 'LiveryStripe'))
    shade_smooth(shell); smooth_by_angle(shell, 38)
    put(shell, mats['paint']); put(glass, mats['glass']); mats['glass']['glass'] = True; put(frames, mats['rubber'])
    if stripe_parts: put(extras[1], mats['red'])
    bpy.data.objects.remove(src, do_unlink=True)
    return shell, glass, extras


# ----------------------------------------------------------------------------------------------------------------------- parts
def _mat(name, color, rough=0.5, metal=0.0):
    return mat(name, color, rough, metal)


def put(o, m, smooth=True):
    o.data.materials.clear(); o.data.materials.append(m)
    if smooth: shade_smooth(o)
    return o


def prism_solid(name, pts_yz, thick, x=0.0, bevel=0.012):
    """extrude a side-view (y,z) polygon across X by `thick`"""
    bm = bmesh.new(); vs = [bm.verts.new((x, y, z)) for (y, z) in pts_yz]; bm.faces.new(vs)
    o = obj_from_bm(bm, name); sol = o.modifiers.new('S', 'SOLIDIFY'); sol.thickness = thick; sol.offset = 0
    bv = o.modifiers.new('B', 'BEVEL'); bv.width = bevel; bv.segments = 2; apply_mods(o); shade_smooth(o); return o


def boom_and_tail(M):
    out = []
    boom = tapered_tube('Boom', [(0, 2.2, 1.40), (0, 3.6, 1.50), (0, 5.2, 1.62), (0, 6.5, 1.70)], [0.42, 0.30, 0.19, 0.12], segs=20, subdiv_each=10)
    put(boom, M['paint']); out.append(boom)
    fin = prism_solid('Fin', [(5.55, 1.62), (6.95, 1.74), (7.1, 2.9), (6.62, 3.0), (6.15, 2.15), (5.8, 1.95)], 0.16, 0.0, 0.02); put(fin, M['paint']); out.append(fin)
    # fenestron duct: bore the fin, line it with a lip, add fan, hub and stator
    cut = cyl('FenCut', 0.44, 0.6, (0, 6.62, 2.02), (0, math.pi / 2, 0), 48); boolean(fin, cut, 'DIFFERENCE'); bpy.data.objects.remove(cut, do_unlink=True)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.44, minor_radius=0.045, major_segments=48, minor_segments=10, location=(0.08, 6.62, 2.02), rotation=(0, math.pi / 2, 0))
    lip = put(bpy.context.active_object, M['red']); lip.name = 'DuctLipA'; out.append(lip)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.44, minor_radius=0.045, major_segments=48, minor_segments=10, location=(-0.08, 6.62, 2.02), rotation=(0, math.pi / 2, 0))
    lip2 = put(bpy.context.active_object, M['red']); lip2.name = 'DuctLipB'; out.append(lip2)
    for k in range(5):  # stator vanes
        a = k / 5 * math.tau + 0.3
        v = box('Stator', (0.04, 0.012, 0.42), (-0.07, 6.62 + math.cos(a) * 0.22, 2.02 + math.sin(a) * 0.22), bevel=0.004, subdiv=0, segs=1, rot=(a - math.pi / 2, 0, 0)); put(v, M['dark']); out.append(v)
    gb = cyl('FanHousing', 0.095, 0.2, (-0.07, 6.62, 2.02), (0, math.pi / 2, 0), 20); put(gb, M['dark']); out.append(gb)
    # tail rotor (fan) group content
    fan = []
    hub = cyl('FanHub', 0.07, 0.1, (0, 0, 0), (0, math.pi / 2, 0), 16); put(hub, M['metal']); fan.append(hub)
    for k in range(10):
        a = k / 10 * math.tau
        bl = box('FanBlade', (0.012, 0.13, 0.36), (0, 0, 0.22), bevel=0.004, subdiv=0, segs=1)
        bl.rotation_mode = 'XYZ'; bl.rotation_euler = (0, 0.5, 0)  # pitch
        bpy.context.view_layer.update(); bm = bmesh.new(); bm.from_mesh(bl.data); bm.transform(Matrix.Rotation(a, 4, 'X') @ Matrix.Rotation(0.45, 4, 'Z')); bm.to_mesh(bl.data); bm.free(); bl.rotation_euler = (0, 0, 0)
        put(bl, M['dark']); fan.append(bl)
    # horizontal stabiliser with end plates
    for s in (-1, 1):
        st = prism_solid('Stab', [(5.95, 0.0), (6.38, 0.0), (6.62, 0.0), (6.55, 0.0)], 0.0)  # placeholder removed below
        bpy.data.objects.remove(st, do_unlink=True)
        bm = bmesh.new(); pts = [(0.1 * s, 6.0, 1.70), (s * 1.0, 6.38, 1.74), (s * 1.0, 6.64, 1.74), (0.1 * s, 6.6, 1.70)]; vs = [bm.verts.new(p) for p in pts]; bm.faces.new(vs if s > 0 else vs[::-1])
        o = obj_from_bm(bm, 'Stab'); sol = o.modifiers.new('S', 'SOLIDIFY'); sol.thickness = 0.05; bv = o.modifiers.new('B', 'BEVEL'); bv.width = 0.012; bv.segments = 2; apply_mods(o); put(o, M['paint']); out.append(o)
        ep = prism_solid('EndPlate', [(6.3, 1.45), (6.72, 1.46), (6.7, 2.0), (6.36, 1.98)], 0.035, s * 1.02, 0.01); put(ep, M['red']); out.append(ep)
    return out, fan


def skids(M):
    out = []
    for s in (-1, 1):
        sk = tube('Skid', [(s * 0.95, -1.95, 0.24), (s * 1.0, -1.6, 0.10), (s * 1.0, -1.2, 0.07), (s * 1.0, 1.2, 0.07), (s * 1.0, 1.6, 0.10), (s * 0.96, 2.05, 0.26)], 0.05, 14); put(sk, M['dark']); out.append(sk)
        shoe = box('SkidShoe', (0.1, 2.4, 0.025), (s * 1.0, -0.1, 0.03), bevel=0.012, subdiv=0, segs=2); put(shoe, M['metal']); out.append(shoe)
        step = box('Step', (0.18, 0.26, 0.025), (s * 1.1, -0.1, 0.30), bevel=0.01, subdiv=0, segs=2); put(step, M['rubber']); out.append(step)
        sst = tube('StepStrut', [(s * 1.0, -0.1, 0.07), (s * 1.08, -0.1, 0.29)], 0.02, 8, False); put(sst, M['dark']); out.append(sst)
    for y in (-0.85, 0.75):
        cs = tube('Cross', [(-1.0, y, 0.10), (-0.92, y, 0.34), (-0.55, y, 0.54), (0.0, y, 0.58), (0.55, y, 0.54), (0.92, y, 0.34), (1.0, y, 0.10)], 0.05, 14); put(cs, M['dark']); out.append(cs)
        for s in (-1, 1):
            cuff = cyl('Cuff', 0.07, 0.12, (s * 0.99, y, 0.10), (0, 0, 0), 16); put(cuff, M['metal']); out.append(cuff)
    return out


def rotor_and_fairing(M):
    parts = []; spin = []
    fair = box('TransFairing', (0.95, 1.9, 0.36), (0, 0.55, 2.3), bevel=0.14, subdiv=1, segs=4); put(fair, M['paint']); parts.append(fair)
    mastf = tapered_tube('MastFairing', [(0, -0.15, 2.2), (0, -0.15, 2.5)], [0.2, 0.12], segs=18, subdiv_each=3); put(mastf, M['paint']); parts.append(mastf)
    intake = box('Intake', (0.8, 0.07, 0.2), (0, -0.46, 2.4), bevel=0.02, subdiv=0, segs=2); put(intake, M['dark']); parts.append(intake)
    for i in range(7):
        for sx in (-1, 1):
            g = box('Louver', (0.012, 0.05, 0.2), (sx * 0.48, 0.2 + i * 0.1, 2.34), bevel=0.003, subdiv=0, segs=1); put(g, M['dark']); parts.append(g)
    ex = tapered_tube('Exhaust', [(0.0, 1.45, 2.34), (0.0, 1.7, 2.42), (0.0, 1.92, 2.46)], [0.13, 0.12, 0.11], segs=18, subdiv_each=3); put(ex, M['dark']); parts.append(ex)
    ant = tube('Antenna', [(0.2, 1.0, 2.46), (0.2, 1.06, 2.7), (0.2, 1.1, 2.95)], 0.008, 6); put(ant, M['dark']); parts.append(ant)
    # hub, swashplate, pitch links, blades -- all rotate
    mast = cyl('Mast', 0.075, 0.45, (0, 0, -0.1), (0, 0, 0), 20); put(mast, M['metal']); spin.append(mast)
    for z, r, nm in ((-0.18, 0.2, 'SwashLow'), (-0.1, 0.17, 'SwashUp')):
        sw = cyl(nm, r, 0.035, (0, 0, z), (0, 0, 0), 32); put(sw, M['trim'] if 'Low' in nm else M['metal']); spin.append(sw)
    hub = cyl('Hub', 0.17, 0.12, (0, 0, 0.04), (0, 0, 0), 24); put(hub, M['dark']); spin.append(hub)
    cap = cyl('HubCap', 0.1, 0.06, (0, 0, 0.12), (0, 0, 0), 20); put(cap, M['metal']); spin.append(cap)
    L = 4.9
    for k in range(3):
        a = k / 3 * math.tau
        rot = Matrix.Rotation(a, 4, 'Z')
        def place(o):
            bm = bmesh.new(); bm.from_mesh(o.data); bm.transform(rot); bm.to_mesh(o.data); bm.free(); return o
        # sleeve + cuff
        sl = box('Sleeve', (0.55, 0.19, 0.1), (0.42, 0, 0.04), bevel=0.04, subdiv=1, segs=3); put(sl, M['dark']); place(sl); spin.append(sl)
        for tx in (0.9,):
            dm = box('Damper', (0.12, 0.13, 0.14), (tx, 0, 0.04), bevel=0.03, subdiv=0, segs=2); put(dm, M['metal']); place(dm); spin.append(dm)
        # pitch link
        pl = tube('PitchLink', [(0.3, 0.12, -0.08), (0.34, 0.12, 0.02)], 0.012, 8, False); put(pl, M['metal']); place(pl); spin.append(pl)
        # blade: tapered, cambered, twisted a little; gentle bevel
        bm = bmesh.new(); xs = [0.9, 1.6, 2.6, 3.6, 4.5, L]; ws = [0.3, 0.3, 0.29, 0.28, 0.26, 0.2]; rows = []
        for x, w in zip(xs, ws):
            tw = 0.12 * (1 - x / L); c, s = math.cos(tw), math.sin(tw)
            pts = [(-w * 0.5, 0.0), (-w * 0.2, 0.022), (w * 0.15, 0.024), (w * 0.5, 0.004), (w * 0.15, -0.012), (-w * 0.3, -0.012)]
            rows.append([bm.verts.new((x, px * c - pz * s, 0.04 + px * s + pz * c)) for (px, pz) in pts])
        for i in range(len(rows) - 1):
            for j in range(6): bm.faces.new((rows[i][j], rows[i][(j + 1) % 6], rows[i + 1][(j + 1) % 6], rows[i + 1][j]))
        bm.faces.new(rows[0][::-1]); bm.faces.new(rows[-1]); bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bl = obj_from_bm(bm, 'Blade%d' % k); put(bl, M['dark']); place(bl); spin.append(bl)
        tip = box('Tip', (0.28, 0.21, 0.05), (L - 0.12, 0, 0.04), bevel=0.02, subdiv=0, segs=2); put(tip, M['red']); place(tip); spin.append(tip)
    return parts, spin


def interior(M):
    out = []
    def B(name, size, loc, m, bevel=0.02, rot=(0, 0, 0), sub=0):
        o = box(name, size, loc, bevel=bevel, rot=rot, subdiv=sub, segs=3); put(o, m); out.append(o); return o
    B('Floor', (1.3, 3.4, 0.04), (0, -0.2, 0.42), M['floor'], 0.01)
    B('SillL', (0.08, 2.4, 0.06), (-0.66, -0.1, 0.46), M['trim'], 0.02); B('SillR', (0.08, 2.4, 0.06), (0.66, -0.1, 0.46), M['trim'], 0.02)
    # seats: pilots up front, bench behind
    for sx in (-0.45, 0.45):
        B('SeatBase', (0.52, 0.52, 0.14), (sx, -0.95, 0.58), M['fabric'], 0.05, sub=1)
        B('SeatBack', (0.52, 0.12, 0.68), (sx, -0.66, 0.98), M['fabric'], 0.05, (-0.12, 0, 0), sub=1)
        B('Headrest', (0.3, 0.1, 0.2), (sx, -0.6, 1.38), M['fabric'], 0.04, (-0.12, 0, 0), sub=1)
        B('SeatFrame', (0.5, 0.5, 0.1), (sx, -0.95, 0.47), M['dark'], 0.02)
        B('Belt', (0.05, 0.015, 0.7), (sx - 0.1, -0.7, 1.0), M['amber'], 0.004, (-0.12, 0, 0.45))
    B('BenchBase', (1.7, 0.52, 0.14), (0, 0.55, 0.58), M['fabric'], 0.05, sub=1)
    for sx in (-0.58, 0, 0.58): B('BenchBack', (0.54, 0.14, 0.7), (sx, 0.86, 1.0), M['fabric'], 0.05, (0.1, 0, 0), sub=1)
    B('BenchFrame', (1.7, 0.5, 0.1), (0, 0.55, 0.47), M['dark'], 0.02)
    # dash binnacle with screens, glare shield and switch panel
    B('DashBase', (1.15, 0.5, 0.5), (0, -1.9, 0.95), M['dark'], 0.08, sub=1)
    B('GlareShield', (1.3, 0.55, 0.06), (0, -1.8, 1.28), M['dark'], 0.03, (-0.1, 0, 0), sub=0)
    B('Binnacle', (0.62, 0.3, 0.34), (0, -1.74, 1.2), M['dark'], 0.05, (0.12, 0, 0), sub=1)
    for sx in (-0.2, 0.2):
        B('Screen', (0.24, 0.012, 0.2), (sx, -1.585, 1.2), M['screen'], 0.006, (0.12, 0, 0))
        B('ScreenBezel', (0.27, 0.01, 0.23), (sx, -1.578, 1.2), M['rubber'], 0.01, (0.12, 0, 0))
    for i in range(6):
        B('Dial', (0.06, 0.012, 0.06), (-0.16 + i * 0.065, -1.58, 1.4), M['trim'], 0.01)
    for i in range(5):
        B('Switch', (0.03, 0.03, 0.03), (-0.6 + i * 0.07, -1.6, 1.02), M['amber'] if i % 2 else M['metal'], 0.006)
        B('Switch', (0.03, 0.03, 0.03), (0.28 + i * 0.07, -1.6, 1.02), M['metal'] if i % 2 else M['amber'], 0.006)
    # console, controls
    B('Console', (0.34, 1.2, 0.2), (0, -0.55, 0.56), M['dark'], 0.04, sub=1)
    B('ConsolePanel', (0.3, 0.3, 0.02), (0, -0.55, 0.67), M['screen'], 0.005)
    for sx in (-0.45, 0.45):
        st = tube('Cyclic', [(sx, -1.42, 0.47), (sx, -1.44, 0.8), (sx, -1.44, 0.95)], 0.02, 10); put(st, M['dark']); out.append(st)
        B('CyclicGrip', (0.06, 0.07, 0.12), (sx, -1.44, 1.0), M['rubber'], 0.02, sub=1)
        B('Pedal', (0.12, 0.05, 0.14), (sx - 0.12, -1.7, 0.58), M['metal'], 0.01, (0.5, 0, 0)); B('Pedal', (0.12, 0.05, 0.14), (sx + 0.12, -1.7, 0.58), M['metal'], 0.01, (0.5, 0, 0))
    col = tube('Collective', [(-0.83, -1.2, 0.52), (-0.83, -1.35, 0.74), (-0.83, -1.5, 0.8)], 0.018, 10); put(col, M['dark']); out.append(col)
    # door cards and rear bulkhead with parcel shelf
    for s in (-1, 1):
        B('DoorCard', (0.05, 1.0, 0.7), (s * 0.86, 0.0, 0.9), M['fabric'], 0.04, sub=1)
        B('Armrest', (0.07, 0.6, 0.06), (s * 0.82, 0.0, 0.92), M['trim'], 0.02)
        B('DoorCardF', (0.05, 0.7, 0.4), (s * 0.7, -1.2, 0.85), M['fabric'], 0.04, (0, 0, 0))
    B('Bulkhead', (1.5, 0.08, 1.2), (0, 1.12, 1.1), M['fabric'], 0.04, sub=0)
    B('Shelf', (1.3, 0.4, 0.05), (0, 1.35, 1.3), M['dark'], 0.02)
    B('Headliner', (1.5, 1.2, 0.04), (0, 0.1, 2.0), M['fabric'], 0.04)
    B('OverheadPanel', (0.5, 0.5, 0.04), (0, -0.9, 2.08), M['dark'], 0.015)
    return out


# ----------------------------------------------------------------------------------------------------------------------- finish: vertex colour + baked ambient occlusion
def vc_nodes(m):
    nt = m.node_tree; b = nt.nodes['Principled BSDF']; n = nt.nodes.new('ShaderNodeVertexColor'); n.layer_name = 'Col'; nt.links.new(n.outputs['Color'], b.inputs['Base Color'])


def bake_ao_to_vertex_colors(objs, rays=28, dist=1.1, strength=0.7, seed=3):
    """cheap, texture-free AO: cosine-weighted rays from every vertex against the whole model, written into the vertex colour with the material tint."""
    bpy.context.view_layer.update(); dg = bpy.context.evaluated_depsgraph_get(); rnd = random.Random(seed)
    solid = [o for o in objs if o.type == 'MESH' and not (o.data.materials and o.data.materials[0] and o.data.materials[0].get('glass'))]
    bm = bmesh.new()
    for o in solid:
        tmp = bmesh.new(); tmp.from_mesh(o.data); tmp.transform(o.matrix_world); off = len(bm.verts)
        for v in tmp.verts: bm.verts.new(v.co)
        bm.verts.ensure_lookup_table()
        for f in tmp.faces: bm.faces.new([bm.verts[off + v.index] for v in f.verts])
        tmp.free()
    bm.faces.ensure_lookup_table(); tree = BVHTree.FromBMesh(bm); bm.free()
    hemi = []
    for _ in range(rays):
        u1, u2 = rnd.random(), rnd.random(); r = math.sqrt(u1); a = math.tau * u2; hemi.append(Vector((r * math.cos(a), r * math.sin(a), math.sqrt(max(0.0, 1 - u1)))))
    for o in objs:
        if o.type != 'MESH': continue
        if not any(k in o.name for k in ('Stripe', 'Groove', 'Panel', 'Post', 'Beam', 'Canopy', 'Seal', 'Livery')):
            fb = bmesh.new(); fb.from_mesh(o.data); bmesh.ops.recalc_face_normals(fb, faces=fb.faces)
            cen = sum((v.co for v in fb.verts), Vector()) / max(1, len(fb.verts)); sc = sum(f.normal.dot(f.calc_center_median() - cen) * f.calc_area() for f in fb.faces)
            if sc < 0: bmesh.ops.reverse_faces(fb, faces=fb.faces)
            fb.to_mesh(o.data); fb.free()
        me = o.data; mw = o.matrix_world; nm = mw.to_3x3().inverted().transposed()
        if 'Col' in me.color_attributes: me.color_attributes.remove(me.color_attributes['Col'])
        col = me.color_attributes.new('Col', 'BYTE_COLOR', 'POINT')
        vt = {}   # vertex -> tint of first material using it
        for p in me.polygons:
            m = me.materials[p.material_index] if p.material_index < len(me.materials) else None
            t = tuple(m['tint']) if (m is not None and 'tint' in m) else (0.5, 0.5, 0.5)
            for vi in p.vertices: vt.setdefault(vi, t)
        for v in me.vertices:
            p0 = mw @ v.co; n = (nm @ v.normal).normalized(); tx = n.cross(Vector((0, 0, 1)) if abs(n.z) < 0.9 else Vector((1, 0, 0))).normalized(); ty = n.cross(tx)
            hit = 0.0
            for h in hemi:
                d = (tx * h.x + ty * h.y + n * h.z); res = tree.ray_cast(p0 + n * 0.012, d, dist)
                if res[0] is not None: hit += 1.0 - res[3] / dist * 0.6
            ao = 1.0 - strength * hit / rays; ao = max(0.12, ao)
            t = vt.get(v.index, (0.5, 0.5, 0.5)); col.data[v.index].color = ((t[0] * ao) ** 2.2 * 1.0, (t[1] * ao) ** 2.2, (t[2] * ao) ** 2.2, 1)
    for o in objs:
        if o.type == 'MESH':
            for m in o.data.materials:
                if m and not any(n.type == 'VERTEX_COLOR' for n in m.node_tree.nodes): vc_nodes(m)


# ----------------------------------------------------------------------------------------------------------------------- surface hardware
exec(open(D + "heli_details.py").read(), globals())   # gives _rounded_rect + loop_on_surface (add_details itself is not used)


def details2(M):
    out = []; bvh = surface_bvh(['Fuselage']); rubber = M['rubber']; chrome = M['metal']; dark = M['dark']
    def onsurf(p, off=0.0):
        loc, n = bvh.find_nearest(Vector(p))[:2]; return loc + n * off, n
    def rect(y0, y1, z0, z1, x, r, w, th, m, name, off=0.003):
        o = loop_on_surface(bvh, _rounded_rect(y0, y1, z0, z1, x, r), off, w, th, m, name); out.append(o); return o
    for s in (-1, 1):
        x = s * 1.25
        rect(-0.7, 0.55, 0.5, 1.99, x, 0.12, 0.014, 0.008, dark, 'DoorGroove')               # door shut line
        rect(0.62, 1.35, 0.62, 1.38, x, 0.08, 0.012, 0.006, dark, 'PanelAft')                # cargo/baggage hatch
        rect(-2.1, -1.35, 0.5, 1.0, x, 0.08, 0.012, 0.006, dark, 'PanelNose')                # avionics bay
        for (y, z) in ((-0.62, 1.12), (0.46, 1.12)):
            p, n = onsurf((x * 1.1, y, z), 0.014); h = box('Handle', (0.03, 0.2, 0.034), tuple(p), bevel=0.012, subdiv=0, segs=2); put(h, chrome); out.append(h)
        for (y, z) in ((-0.7, 0.62), (-0.7, 1.82), (0.55, 0.62), (0.55, 1.82)):              # hinges
            p, n = onsurf((x * 1.1, y, z), 0.01); h = box('Hinge', (0.022, 0.05, 0.1), tuple(p), bevel=0.008, subdiv=0, segs=1); put(h, chrome); out.append(h)
        p, n = onsurf((s * 1.3, 0.2, 1.62), 0.01); fc = cyl('FuelCap', 0.07, 0.02, tuple(p), (0, math.pi / 2, 0), 20); put(fc, chrome); out.append(fc)
        p, n = onsurf((s * 1.3, -2.1, 0.92), 0.012); nl = bpy.ops.mesh.primitive_uv_sphere_add(radius=0.055, segments=14, ring_count=8, location=tuple(p)); nl = bpy.context.active_object
        put(nl, mat('NavL' if s < 0 else 'NavR', (0.9, 0.05, 0.05) if s < 0 else (0.05, 0.8, 0.1), 0.2, emit=(0.9, 0.05, 0.05) if s < 0 else (0.05, 0.8, 0.1))); out.append(nl)
        for i in range(5):                                                                    # side intake louvres
            p, n = onsurf((s * 1.1, -1.55 + i * 0.07, 0.62), 0.008); l = box('Louvre', (0.012, 0.03, 0.14), tuple(p), bevel=0.004, subdiv=0, segs=1, rot=(0, 0, 0)); put(l, dark); out.append(l)
        for i in range(8):                                                                    # rivet row along the door groove
            p, n = onsurf((x * 1.1, -0.62 + i * 0.16, 0.56), 0.004); rv = cyl('Rivet', 0.008, 0.008, tuple(p), (0, math.pi / 2, 0), 8); put(rv, chrome); out.append(rv)
        # grab handle on roof edge / foot step cut
        gh = tube('Grab', [(s * 1.03, -0.55, 1.88), (s * 1.1, -0.55, 1.97), (s * 1.1, 0.5, 1.97), (s * 1.03, 0.5, 1.88)], 0.014, 8); put(gh, chrome); out.append(gh)
    # centre post, roof beam, windscreen wipers, pitot, landing light, beacon, belly details
    out.append(loop_on_surface(bvh, [(0, -2.74, 1.0), (0, -2.65, 1.3), (0, -2.2, 1.74), (0, -1.5, 2.08), (0, -0.84, 2.2)], 0.004, 0.05, 0.016, dark, 'WindscreenPost'))
    out.append(loop_on_surface(bvh, [(-0.95, -0.86, 2.06), (-0.6, -0.86, 2.19), (0.6, -0.86, 2.19), (0.95, -0.86, 2.06)], 0.004, 0.05, 0.014, dark, 'RoofBeam'))
    for sx in (-0.5, 0.2):
        w = tube('Wiper', [(sx, -2.5, 1.45), (sx + 0.3, -2.45, 1.7)], 0.008, 6, False); put(w, dark); out.append(w)
    pt = tube('Pitot', [(0.75, -2.3, 0.95), (0.85, -2.85, 0.95)], 0.012, 8, False); put(pt, chrome); out.append(pt)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.09, segments=16, ring_count=10, location=(0, -2.6, 0.78)); ll = put(bpy.context.active_object, mat('LandLight', (1, 0.96, 0.8), 0.1, emit=(1, 0.9, 0.7))); ll.name = 'LandingLight'; out.append(ll)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.07, segments=12, ring_count=8, location=(0, 0.2, 0.2)); bb = put(bpy.context.active_object, M['red']); bb.name = 'BellyBeacon'; out.append(bb)
    for y in (3.0, 4.3, 5.6):                                                                 # boom panel rings
        r = 0.42 + (0.11 - 0.42) * (y - 2.2) / 4.3 * 0.9 + 0.012
        bpy.ops.mesh.primitive_torus_add(major_radius=max(r, 0.12), minor_radius=0.006, major_segments=32, minor_segments=6, location=(0, y, 1.4 + (y - 2.2) * 0.07), rotation=(math.pi / 2, 0, 0)); tr = put(bpy.context.active_object, dark); out.append(tr)
    for s in (-1, 1):                                                                         # registration on the boom
        cu = bpy.data.curves.new('Reg', 'FONT'); cu.body = 'N412JS'; cu.size = 0.2; cu.extrude = 0.004; cu.align_x = 'CENTER'; cu.align_y = 'CENTER'
        o = bpy.data.objects.new('RegT', cu); bpy.context.scene.collection.objects.link(o); o.rotation_euler = (math.pi / 2, 0, s * math.pi / 2); o.location = (s * 0.268, 4.35, 1.56)
        me = bpy.data.meshes.new_from_object(o.evaluated_get(bpy.context.evaluated_depsgraph_get())); to = bpy.data.objects.new('RegM', me); bpy.context.scene.collection.objects.link(to)
        to.rotation_euler = o.rotation_euler; to.location = o.location; bpy.data.objects.remove(o, do_unlink=True); put(to, dark, False); out.append(to)
    strobe = bpy.ops.mesh.primitive_uv_sphere_add(radius=0.05, segments=10, ring_count=6, location=(0, 7.0, 2.95)); sb = put(bpy.context.active_object, mat('Strobe', (0.9, 0.1, 0.08), 0.2, emit=(1, 0.1, 0.05))); sb.name = 'Strobe'; out.append(sb)
    return out


def merge_by_material(objs, prefix):
    """one mesh per material: a few draw calls instead of hundreds (vertex colours carry the per-part colour and AO)"""
    groups = {}
    for o in objs:
        if o.type != 'MESH' or not o.data.materials: continue
        groups.setdefault(o.data.materials[0].name, []).append(o)
    out = []
    for name, lst in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in lst:
            o.parent = None; o.select_set(True)
        bpy.context.view_layer.objects.active = lst[0]
        if len(lst) > 1: bpy.ops.object.join()
        j = bpy.context.active_object; j.name = prefix + '_' + name; out.append(j)
        if name != 'HeliGlass': smooth_by_angle(j, 40)
    return out


def bake_transforms(objs):
    """push every object's location/rotation/scale into its mesh so vertex coordinates are real (needed for damage fields, AO, merging)"""
    bpy.context.view_layer.update()
    for o in objs:
        if o.type != 'MESH': continue
        o.data.transform(o.matrix_world); o.matrix_world = Matrix(); o.data.update()


def heli2_parts():
    for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
    for mm in list(bpy.data.materials): bpy.data.materials.remove(mm)
    M = make_mats()
    shell, glass, extras = build_hull_and_glass(M)
    tail, fan = boom_and_tail(M); sk = skids(M); fair, spin = rotor_and_fairing(M); inter = interior(M); det = details2(M)
    bake_transforms([shell, glass] + extras + tail + fan + sk + fair + spin + inter + det)
    return dict(M=M, shell=shell, glass=glass, extras=extras, tail=tail, fan=fan, skids=sk, fair=fair, spin=spin, inter=inter, det=det)


def build_heli2_all(export_path=None, rays=28):
    P = heli2_parts(); M = P['M']; shell, glass, extras, tail, fan, sk, fair, spin, inter, det = [P[k] for k in ('shell', 'glass', 'extras', 'tail', 'fan', 'skids', 'fair', 'spin', 'inter', 'det')]
    _st = [o for o in det if o.name == 'Strobe']; det = [o for o in det if o.name != 'Strobe']
    for o in _st: bpy.data.objects.remove(o, do_unlink=True)
    body_objs = [shell, glass] + extras + tail + sk + fair + inter + det
    allm = [o for o in body_objs + spin + fan if o.type == 'MESH']
    bake_ao_to_vertex_colors(allm, rays=rays)
    body_objs = merge_by_material(body_objs, 'B'); spin = merge_by_material(spin, 'R'); fan = merge_by_material(fan, 'T')
    root = bpy.data.objects.new('Heli', None); bpy.context.scene.collection.objects.link(root)
    bodyN = bpy.data.objects.new('Body', None); bpy.context.scene.collection.objects.link(bodyN); bodyN.parent = root
    for o in body_objs: o.parent = bodyN
    rotor = bpy.data.objects.new('Rotor', None); bpy.context.scene.collection.objects.link(rotor); rotor.parent = bodyN; rotor.location = (0, -0.15, 2.52)
    for o in spin: o.parent = rotor
    trot = bpy.data.objects.new('TailRotor', None); bpy.context.scene.collection.objects.link(trot); trot.parent = bodyN; trot.location = (0.0, 6.62, 2.02)
    for o in fan: o.parent = trot
    if export_path:
        import logging; logging.disable(logging.CRITICAL)
        for o in bpy.data.objects: o.select_set(True)
        bpy.context.view_layer.objects.active = root
        bpy.ops.export_scene.gltf(filepath=export_path, export_format='GLB', use_selection=True, export_apply=True, export_animations=False, export_yup=True, export_materials='EXPORT', export_vertex_color='ACTIVE', export_cameras=False, export_lights=False)
    return root
