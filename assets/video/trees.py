"""Jungle vegetation for the launch film: a few tree/palm/fern variants plus geometry-nodes scattering over the island."""
import bpy, bmesh, math, random
from mathutils import Vector, Matrix, noise as mn


def vc_material(name, rough=0.6, coat=0.0):
    """flat shader driven by the 'Col' vertex colour (the colour variation is baked into the mesh: cheap to render, unlike procedural leaf shaders)"""
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; b = nt.nodes['Principled BSDF']; b.inputs['Roughness'].default_value = rough
    n = nt.nodes.new('ShaderNodeVertexColor'); n.layer_name = 'Col'; nt.links.new(n.outputs['Color'], b.inputs['Base Color'])
    try: b.inputs['Specular IOR Level'].default_value = 0.2
    except Exception: pass
    return m


def paint(o, fn):
    me = o.data
    if 'Col' in me.color_attributes: me.color_attributes.remove(me.color_attributes['Col'])
    col = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
    for v in me.vertices:
        c = fn(v.co); col.data[v.index].color = (c[0], c[1], c[2], 1.0)


def leaf_color(co, base=(0.02, 0.07, 0.015), light=(0.12, 0.26, 0.04), seed=0):
    n = 0.5 + 0.5 * mn.noise(Vector((co.x * 0.9 + seed, co.y * 0.9, co.z * 0.9)))
    h = max(0.0, min(1.0, (co.z) / 3.5 + 0.5)); k = max(0.0, min(1.0, 0.25 + 0.55 * h + 0.45 * n - 0.2))
    return tuple(base[i] + (light[i] - base[i]) * k for i in range(3))


def bark_color(co):
    n = 0.5 + 0.5 * mn.noise(Vector((co.x * 6, co.y * 6, co.z * 1.2)))
    return (0.035 + 0.09 * n, 0.022 + 0.055 * n, 0.012 + 0.03 * n)


def bark_material():
    return vc_material('Bark', 0.9)


def tube(name, pts, r0, r1, seg=8):
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = 1.0; cu.bevel_resolution = 2; cu.use_fill_caps = True; cu.resolution_u = 6
    sp = cu.splines.new('BEZIER'); sp.bezier_points.add(len(pts) - 1)
    for i, (bp, p) in enumerate(zip(sp.bezier_points, pts)):
        bp.co = p; bp.handle_left_type = bp.handle_right_type = 'AUTO'; bp.radius = r0 + (r1 - r0) * i / (len(pts) - 1)
    o = bpy.data.objects.new(name, cu); bpy.context.scene.collection.objects.link(o)
    me = bpy.data.meshes.new_from_object(o.evaluated_get(bpy.context.evaluated_depsgraph_get())); mo = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(mo)
    bpy.data.objects.remove(o, do_unlink=True)
    for p in me.polygons: p.use_smooth = True
    return mo


def blob(name, c, r, sq=0.7, seed=0, sub=2):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub, radius=1, location=(0, 0, 0)); o = bpy.context.active_object; o.name = name
    me = o.data
    for v in me.vertices:
        n = mn.noise(Vector((v.co.x * 1.7 + seed, v.co.y * 1.7, v.co.z * 1.7))) + 0.35 * mn.noise(Vector((v.co.x * 5 + seed, v.co.y * 5, v.co.z * 5)))
        v.co = v.co * (1 + 0.5 * n)
        v.co.z *= sq
    o.scale = (r, r, r); o.location = c; bpy.ops.object.transform_apply(location=True, scale=True)
    for p in me.polygons: p.use_smooth = True
    paint(o, lambda co: leaf_color(Vector((co.x * r, co.y * r, co.z * r * sq + c.z - 0.0)) * 0.0 + Vector((co.x, co.y, co.z + 0.2)) * 3.5, seed=seed))
    return o


def join(objs, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]; bpy.ops.object.join(); o = bpy.context.active_object; o.name = name; return o


def make_broadleaf(seed, mats, h=18.0):
    rnd = random.Random(seed); lean = Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), 0)) * 0.9
    pts = [(0, 0, -0.5), (lean.x * 0.3, lean.y * 0.3, h * 0.35), (lean.x, lean.y, h * 0.7), (lean.x * 1.4, lean.y * 1.4, h)]
    trunk = tube('Trunk', pts, 0.55, 0.16); trunk.data.materials.append(mats['bark']); paint(trunk, bark_color)
    parts = []
    top = Vector((lean.x * 1.4, lean.y * 1.4, h))
    for i in range(12):
        a = rnd.uniform(0, math.tau); d = rnd.uniform(0, 4.8); c = top + Vector((math.cos(a) * d, math.sin(a) * d, rnd.uniform(-3.2, 1.8)))
        b = blob('Canopy', c, rnd.uniform(2.1, 3.6), 0.62, seed + i, 2); b.data.materials.append(mats['leaf']); parts.append(b)
    for k in range(2):                                     # lower branch clumps
        a = rnd.uniform(0, math.tau); c = Vector((lean.x * 0.8 + math.cos(a) * 2.0, lean.y * 0.8 + math.sin(a) * 2.0, h * 0.62))
        b = blob('Canopy', c, rnd.uniform(1.6, 2.4), 0.6, seed + 20 + k, 1); b.data.materials.append(mats['leaf']); parts.append(b)
    return join([trunk] + parts, 'Broadleaf%d' % seed)


def make_palm(seed, mats, h=11.0):
    rnd = random.Random(seed); lean = Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), 0)) * rnd.uniform(1.0, 2.6)
    pts = [(0, 0, -0.3), (lean.x * 0.2, lean.y * 0.2, h * 0.4), (lean.x * 0.65, lean.y * 0.65, h * 0.8), (lean.x, lean.y, h)]
    trunk = tube('PalmTrunk', pts, 0.26, 0.14); trunk.data.materials.append(mats['bark']); paint(trunk, bark_color)
    top = Vector((lean.x, lean.y, h)); fronds = []
    for i in range(11):
        a = i / 11 * math.tau + rnd.uniform(-0.2, 0.2); L = rnd.uniform(3.6, 5.0)
        bm = bmesh.new(); rows = []
        for s in range(9):
            t = s / 8; w = 0.9 * math.sin(t * math.pi * 0.9 + 0.3) * (1 - t * 0.35)
            x = t * L; z = math.sin(t * 1.6) * 1.0 - t * t * 1.9
            rows.append((bm.verts.new((x, -w, z)), bm.verts.new((x, w, z))))
        for s in range(8): bm.faces.new((rows[s][0], rows[s + 1][0], rows[s + 1][1], rows[s][1]))
        me = bpy.data.meshes.new('Frond'); bm.to_mesh(me); bm.free(); o = bpy.data.objects.new('Frond', me); bpy.context.scene.collection.objects.link(o)
        o.rotation_euler = (rnd.uniform(-0.15, 0.15), 0, a); o.location = top; bpy.context.view_layer.update()
        o.data.materials.append(mats['frond']); paint(o, lambda co: leaf_color(Vector((co.x, co.y, co.z)) * 0.0 + Vector((0, 0, 0.6 + 0.4 * math.sin(co.x * 0.7))), (0.025, 0.09, 0.02), (0.15, 0.3, 0.05), seed)); fronds.append(o)
    for o in fronds:
        bpy.context.view_layer.objects.active = o; o.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True)
    return join([trunk] + fronds, 'Palm%d' % seed)


def make_fern(seed, mats):
    rnd = random.Random(seed); fronds = []
    for i in range(9):
        a = i / 9 * math.tau + rnd.uniform(-0.2, 0.2); L = rnd.uniform(1.0, 1.7)
        bm = bmesh.new(); rows = []
        for s in range(7):
            t = s / 6; w = 0.28 * math.sin(t * math.pi * 0.95 + 0.2)
            rows.append((bm.verts.new((t * L, -w, 0.1 + math.sin(t * 1.5) * 0.45 - t * t * 0.4)), bm.verts.new((t * L, w, 0.1 + math.sin(t * 1.5) * 0.45 - t * t * 0.4))))
        for s in range(6): bm.faces.new((rows[s][0], rows[s + 1][0], rows[s + 1][1], rows[s][1]))
        me = bpy.data.meshes.new('Fern'); bm.to_mesh(me); bm.free(); o = bpy.data.objects.new('Fern', me); bpy.context.scene.collection.objects.link(o)
        o.rotation_euler = (0, 0, a); o.data.materials.append(mats['frond']); paint(o, lambda co: leaf_color(Vector((0, 0, 0.3 + 0.7 * min(1.0, co.x / 1.5))), (0.012, 0.045, 0.01), (0.07, 0.17, 0.03), seed)); fronds.append(o)
    bpy.context.view_layer.update()
    for o in fronds: bpy.context.view_layer.objects.active = o; o.select_set(True)
    bpy.ops.object.transform_apply(rotation=True)
    return join(fronds, 'Fern%d' % seed)


def make_variants():
    mats = {'bark': bark_material(), 'leaf': vc_material('Canopy', 0.55), 'frond': vc_material('Frond', 0.5)}
    coll = bpy.data.collections.new('Variants'); bpy.context.scene.collection.children.link(coll)
    out = {'tree': [], 'palm': [], 'fern': []}
    for s in range(5): o = make_broadleaf(100 + s, mats, 11 + s * 1.8); out['tree'].append(o)
    for s in range(3): o = make_palm(200 + s, mats, 9 + s * 1.6); out['palm'].append(o)
    for s in range(3): o = make_fern(300 + s, mats); out['fern'].append(o)
    for k, lst in out.items():
        sub = bpy.data.collections.new('V_' + k); coll.children.link(sub)
        for o in lst:
            for c in o.users_collection: c.objects.unlink(o)
            sub.objects.link(o)
    coll.hide_viewport = True; coll.hide_render = True
    return {k: bpy.data.collections['V_' + k] for k in out}, mats


def scatter(target, coll, name, density, min_z, max_slope_z, r_min, r_max, scale=(0.8, 1.25), seed=1, ground_dist=None):
    """geometry-nodes scatter of a collection over `target` (field filters: height, slope, distance ring from the origin)"""
    ng = bpy.data.node_groups.new('Scatter_' + name, 'GeometryNodeTree')
    ng.interface.new_socket('Geometry', in_out='INPUT', socket_type='NodeSocketGeometry'); ng.interface.new_socket('Geometry', in_out='OUTPUT', socket_type='NodeSocketGeometry')
    N = ng.nodes; L = ng.links; gi = N.new('NodeGroupInput'); go = N.new('NodeGroupOutput')
    dist = N.new('GeometryNodeDistributePointsOnFaces'); dist.distribute_method = 'RANDOM'; dist.inputs['Density'].default_value = density; dist.inputs['Seed'].default_value = seed
    pos = N.new('GeometryNodeInputPosition'); sep = N.new('ShaderNodeSeparateXYZ'); L.new(pos.outputs[0], sep.inputs[0])
    nrm = N.new('GeometryNodeInputNormal'); nsep = N.new('ShaderNodeSeparateXYZ'); L.new(nrm.outputs[0], nsep.inputs[0])
    c1 = N.new('FunctionNodeCompare'); c1.data_type = 'FLOAT'; c1.operation = 'GREATER_THAN'; c1.inputs[1].default_value = min_z; L.new(sep.outputs['Z'], c1.inputs[0])
    c2 = N.new('FunctionNodeCompare'); c2.data_type = 'FLOAT'; c2.operation = 'GREATER_THAN'; c2.inputs[1].default_value = max_slope_z; L.new(nsep.outputs['Z'], c2.inputs[0])
    vl = N.new('ShaderNodeVectorMath'); vl.operation = 'LENGTH'; vm = N.new('ShaderNodeVectorMath'); vm.operation = 'MULTIPLY'; vm.inputs[1].default_value = (1, 1, 0); L.new(pos.outputs[0], vm.inputs[0]); L.new(vm.outputs[0], vl.inputs[0])
    c3 = N.new('FunctionNodeCompare'); c3.data_type = 'FLOAT'; c3.operation = 'GREATER_THAN'; c3.inputs[1].default_value = r_min; L.new(vl.outputs['Value'], c3.inputs[0])
    c4 = N.new('FunctionNodeCompare'); c4.data_type = 'FLOAT'; c4.operation = 'LESS_THAN'; c4.inputs[1].default_value = r_max; L.new(vl.outputs['Value'], c4.inputs[0])
    a1 = N.new('FunctionNodeBooleanMath'); a1.operation = 'AND'; L.new(c1.outputs[0], a1.inputs[0]); L.new(c2.outputs[0], a1.inputs[1])
    a2 = N.new('FunctionNodeBooleanMath'); a2.operation = 'AND'; L.new(a1.outputs[0], a2.inputs[0]); L.new(c3.outputs[0], a2.inputs[1])
    a3 = N.new('FunctionNodeBooleanMath'); a3.operation = 'AND'; L.new(a2.outputs[0], a3.inputs[0]); L.new(c4.outputs[0], a3.inputs[1])
    L.new(a3.outputs[0], dist.inputs['Selection'])
    ci = N.new('GeometryNodeCollectionInfo'); ci.inputs['Collection'].default_value = coll; ci.transform_space = 'RELATIVE'
    try: ci.inputs['Separate Children'].default_value = True; ci.inputs['Reset Children'].default_value = True
    except Exception: pass
    ion = N.new('GeometryNodeInstanceOnPoints'); ion.inputs['Pick Instance'].default_value = True
    rnd_i = N.new('FunctionNodeRandomValue'); rnd_i.data_type = 'INT'; rnd_i.inputs['Max'].default_value = 99; rnd_i.inputs['Seed'].default_value = seed + 3
    rnd_r = N.new('FunctionNodeRandomValue'); rnd_r.data_type = 'FLOAT_VECTOR'; rnd_r.inputs['Min'].default_value = (0, 0, 0); rnd_r.inputs['Max'].default_value = (0.08, 0.08, 6.28); rnd_r.inputs['Seed'].default_value = seed + 5
    rnd_s = N.new('FunctionNodeRandomValue'); rnd_s.data_type = 'FLOAT'; rnd_s.inputs['Min'].default_value = scale[0]; rnd_s.inputs['Max'].default_value = scale[1]; rnd_s.inputs['Seed'].default_value = seed + 7
    L.new(gi.outputs[0], dist.inputs['Mesh']); L.new(dist.outputs['Points'], ion.inputs['Points']); L.new(ci.outputs['Instances'], ion.inputs['Instance'])
    L.new(rnd_i.outputs[2] if len(rnd_i.outputs) > 2 else rnd_i.outputs[0], ion.inputs['Instance Index'])
    L.new(rnd_r.outputs[0], ion.inputs['Rotation']); L.new(rnd_s.outputs[1] if len(rnd_s.outputs) > 1 else rnd_s.outputs[0], ion.inputs['Scale'])
    L.new(ion.outputs['Instances'], go.inputs[0])
    holder = bpy.data.objects.new('Scatter_' + name, bpy.data.meshes.new('Scatter_' + name)); bpy.context.scene.collection.objects.link(holder)
    md = holder.modifiers.new('GN', 'NODES'); md.node_group = ng
    # feed the island surface in through an object-info node
    oi = N.new('GeometryNodeObjectInfo'); oi.inputs['Object'].default_value = target; oi.transform_space = 'RELATIVE'
    L.new(oi.outputs['Geometry'], dist.inputs['Mesh'])
    return holder
