import bpy, bmesh, math, random
from mathutils import Vector, Euler, Matrix
from mathutils import noise as mnoise

def _grp(name, objs, pivot=(0, 0, 0)):
    e = bpy.data.objects.new(name, None); bpy.context.scene.collection.objects.link(e); e.location = pivot
    for o in objs:
        mw = o.matrix_world.copy(); o.parent = e; o.matrix_parent_inverse = e.matrix_world.inverted()
    return e

def _drop(e, clearance=0.03):
    bpy.context.view_layer.update(); zmin = 1e9
    dg = bpy.context.evaluated_depsgraph_get()
    for c in e.children_recursive:
        if c.type != 'MESH': continue
        for corner in c.bound_box:
            zmin = min(zmin, (c.matrix_world @ Vector(corner)).z)
    e.location.z -= zmin - clearance; bpy.context.view_layer.update()

def damage_fuselage(body):
    me = body.data; rnd = random.Random(8); col = me.color_attributes['Col']
    for v in me.vertices:
        x, y, z = v.co; n = Vector(v.normal)
        crush = _sm(-1.5, -2.8, y)                                          # nose crumples back and inward
        v.co.y += 0.5 * crush + 0.06 * mnoise.noise(Vector((x * 3, y * 3, z * 3))) * (0.3 + crush * 2)
        v.co.z -= 0.28 * crush * _sm(0.9, 1.9, z) + 0.05 * crush
        v.co.x *= 1 - 0.28 * crush
        dent = mnoise.noise(Vector((x * 2.2 + 3, y * 2.2, z * 2.2))) ; v.co += n * 0.07 * dent * (0.4 + 0.8 * _sm(0.2, 1.0, abs(x)))   # dented, buckled skin
        # torn roof behind the mast
        if y > -0.3 and y < 1.2 and z > 2.0: v.co.z -= 0.22 * _sm(0.3, 1.0, mnoise.noise(Vector((x * 4, y * 4, 5))) + 0.5)
    for i, v in enumerate(me.vertices):
        x, y, z = v.co; c = Vector(col.data[i].color[:3])
        soot = _sm(0.15, 0.75, 0.5 + 0.55 * mnoise.noise(Vector((x * 0.7, y * 0.7, z * 0.7))) + 0.35 * mnoise.noise(Vector((x * 2.2, y * 2.2, z * 2.2)))) * (0.3 + 0.7 * _sm(-0.8, 1.6, y)) + 0.3 * _sm(0.7, 0.2, z)
        soot = min(0.95, soot); c = c.lerp(Vector((0.02, 0.018, 0.016)) ** 1 if False else Vector((0.012, 0.011, 0.01)), soot)
        scr = max(0.0, mnoise.noise(Vector((x * 6, y * 6, z * 6)))) ** 3 * 1.6; c = c.lerp(Vector((0.4, 0.39, 0.38)), min(0.5, scr) * (1 - soot))     # bare scratched metal
        dirt = _sm(0.55, 0.0, z) * 0.5; c = c.lerp(Vector((0.12, 0.08, 0.05)), dirt)
        col.data[i].color = (c[0], c[1], c[2], 1)
    me.update()

def bend_object(o, axis_len, amount, axis='y'):
    me = o.data
    for v in me.vertices:
        t = (v.co.y if axis == 'y' else v.co.x) / axis_len; v.co.z += amount * t * t

def build_wreck_all(export_path=None):
    exec(open("/Users/talaljawaid/Documents/Talal's Folder/Claude/Experiment 2026/Experiment 3/AI Game/assets/blender/build_heli.py").read(), globals())
    exec(open("/Users/talaljawaid/Documents/Talal's Folder/Claude/Experiment 2026/Experiment 3/AI Game/assets/blender/heli_details.py").read(), globals())
    for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
    mats = {'paint': _mat('HeliPaint', None, 0.4, 0.3, vc=True), 'glass': _mat('HeliGlass', (0.35, 0.5, 0.58), 0.04, 0.2, alpha=0.38), 'dark': _mat('HeliDark', (0.05, 0.052, 0.055), 0.6, 0.3),
            'red': _mat('HeliRed', (0.35, 0.05, 0.04), 0.5, 0.3), 'metal': _mat('HeliMetal', (0.42, 0.43, 0.45), 0.4, 0.9)}
    body = fuselage(); body.data.materials.append(mats['paint'])
    others = boom_and_tail(mats) + skids(mats); details = add_details(mats)
    mast, cowl, rotorparts, tailparts = rotor_assembly(mats)
    for t in tailparts: t.location = (0.14, 6.78, 1.8)
    for b in rotorparts[:2]: b.location = (0, -0.15, 2.5)
    rotorparts[2].location = (0, -0.15, 2.5)
    allp = [body, mast, cowl] + others + details + tailparts + rotorparts
    for o in allp:
        if o.type == 'MESH' and not o.data.materials: o.data.materials.append(mats['dark'])
    bpy.context.view_layer.update()
    # --- split into groups by position
    def ymean(o): return sum((o.matrix_world @ v.co).y for v in o.data.vertices) / max(1, len(o.data.vertices))
    boom_objs = [o for o in others + details + tailparts if o.type == 'MESH' and ymean(o) > 2.45 and 'Skid' not in o.name and 'Cross' not in o.name]
    skid_objs = [o for o in others if ('Skid' in o.name or 'Cross' in o.name)]
    body_objs = [o for o in [body, cowl] + details if o not in boom_objs]
    damage_fuselage(body)
    for s in skid_objs: bend_object(s, 2.2, 0.35 * (1 if 'Skid' in s.name else 0.5))
    # blades: one long intact, one snapped and bent
    bl = [o for o in rotorparts if o.name.startswith('Blade')]
    for v in bl[1].data.vertices:
        if abs(v.co.x) > 1.6: v.co.x = math.copysign(1.6, v.co.x) + 0.0
        v.co.z += 0.12 * (abs(v.co.x) / 1.6) ** 2
    for o in body_objs + boom_objs + skid_objs + [mast] + bl + [rotorparts[2]]: pass
    # --- groups and poses
    G = {}
    G['Body'] = _grp('WreckBody', body_objs + skid_objs + [mast], (0, 0, 0))
    G['Body'].rotation_euler = Euler((math.radians(-12), math.radians(64), math.radians(0)), 'XYZ'); _drop(G['Body'])
    bz = G['Body'].location.z
    G['Boom'] = _grp('WreckBoom', boom_objs, (0, 2.3, 1.45))
    for c in G['Boom'].children: c.matrix_parent_inverse = G['Boom'].matrix_world.inverted()
    G['Boom'].location = (2.6, 5.4, 0.4); G['Boom'].rotation_euler = Euler((math.radians(10), math.radians(-24), math.radians(38)), 'XYZ'); _drop(G['Boom'])
    G['BladeA'] = _grp('WreckBladeA', [bl[0]], (0, 0, 0)); G['BladeA'].location = (-4.5, -2.0, 0.0); G['BladeA'].rotation_euler = Euler((0.04, 0.18, math.radians(25)), 'XYZ'); _drop(G['BladeA'], 0.02)
    G['BladeB'] = _grp('WreckBladeB', [bl[1]], (0, 0, 0)); G['BladeB'].location = (3.8, -2.6, 0.0); G['BladeB'].rotation_euler = Euler((0.05, -0.1, math.radians(-70)), 'XYZ'); _drop(G['BladeB'], 0.02)
    G['Hub'] = _grp('WreckHub', [rotorparts[2]], (0, 0, 0)); G['Hub'].location = (-1.6, 1.8, 0); _drop(G['Hub'], 0.0)
    # torn-off door, seat and a duffel bag
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0)); door = bpy.context.active_object; door.name = 'WreckDoor'; door.scale = (1.35, 0.03, 1.2); bpy.ops.object.transform_apply(scale=True)
    bm = bmesh.new(); bm.from_mesh(door.data); bmesh.ops.bevel(bm, geom=bm.edges[:], offset=0.02, segments=2); bm.to_mesh(door.data); bm.free(); door.data.materials.append(mats['paint'])
    vc = door.data.color_attributes.new('Col', 'BYTE_COLOR', 'POINT')
    for i, v in enumerate(door.data.vertices): d = 0.62 + 0.3 * mnoise.noise(Vector((v.co.x * 1.5, 0, v.co.z * 1.5))); d = d * (0.25 if v.co.x > 0.2 else 1); vc.data[i].color = ((d * 0.95) ** 2.2, (d * 0.97) ** 2.2, d ** 2.2, 1)
    G['Door'] = _grp('WreckDoor', [door], (0, 0, 0)); G['Door'].location = (-3.2, -5.2, 0); G['Door'].rotation_euler = Euler((0.08, 0.12, math.radians(40)), 'XYZ'); _drop(G['Door'], 0.02)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0)); seat = bpy.context.active_object; seat.name = 'WreckSeat'; seat.scale = (0.5, 0.5, 0.12); bpy.ops.object.transform_apply(scale=True)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0.26, 0.32)); back = bpy.context.active_object; back.scale = (0.5, 0.1, 0.6); bpy.ops.object.transform_apply(scale=True)
    for o in (seat, back): o.data.materials.append(mats['dark'])
    seat.select_set(True); back.select_set(True); bpy.context.view_layer.objects.active = seat; bpy.ops.object.join()
    G['Seat'] = _grp('WreckSeat', [seat], (0, 0, 0)); G['Seat'].location = (4.5, -4.8, 0); G['Seat'].rotation_euler = Euler((math.radians(75), 0.2, math.radians(20)), 'XYZ'); _drop(G['Seat'], 0.0)
    if export_path:
        for o in bpy.data.objects: o.select_set(True)
        bpy.ops.export_scene.gltf(filepath=export_path, export_format='GLB', use_selection=True, export_apply=True, export_animations=False, export_yup=True, export_materials='EXPORT', export_vertex_color='ACTIVE', export_cameras=False, export_lights=False)
    return G

def _sm(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a))); return t * t * (3 - 2 * t)
