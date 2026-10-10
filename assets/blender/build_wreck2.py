"""Crashed helicopter v2: the detailed v2 airframe, broken into pieces (body on its side, snapped tail boom, torn blades, hub, door, seat),
crushed nose, no glass, soot and bare metal.  Same node names as before (WreckBody ...) so wreckScene.js keeps working."""
import bpy, bmesh, math, random
from mathutils import Vector, Euler, Matrix
from mathutils import noise as mnoise
D2 = "/Users/talaljawaid/Documents/Talal's Folder/Claude/Experiment 2026/Experiment 3/AI Game/assets/blender/"
exec(open(D2 + "build_heli2.py").read(), globals())
exec(open(D2 + "build_wreck.py").read(), globals())   # make_door, _grp, _drop, bend_object, _sstep


def centroid(o):
    me = o.data; n = max(1, len(me.vertices)); return sum((o.matrix_world @ v.co for v in me.vertices), Vector()) / n


def crush_field(p):
    x, y, z = p; crush = _sstep(-1.5, -2.8, y); d = Vector((0, 0, 0))
    d.x = -x * 0.28 * crush
    d.y = 0.5 * crush + 0.06 * mnoise.noise(Vector((x * 3, y * 3, z * 3))) * (0.3 + crush * 2)
    d.z = -(0.28 * crush * _sstep(0.9, 1.9, z) + 0.05 * crush)
    if -0.3 < y < 1.2 and z > 2.0: d.z -= 0.22 * _sstep(0.3, 1.0, mnoise.noise(Vector((x * 4, y * 4, 5))) + 0.5)       # torn roof behind the mast
    d += Vector((mnoise.noise(Vector((x * 2.2 + 3, y * 2.2, z * 2.2))), mnoise.noise(Vector((x * 2.2, y * 2.2 + 5, z * 2.2))), mnoise.noise(Vector((x * 2.2, y * 2.2, z * 2.2 + 9))))) * 0.045 * (0.4 + 0.8 * _sstep(0.2, 1.0, abs(x)))
    return d


def apply_field(o, fn):
    for v in o.data.vertices: v.co += fn(v.co)
    o.data.update()


def weather(o, seed=1):
    """soot, bare scratched metal and ground dirt written into the vertex colour"""
    me = o.data
    if 'Col' not in me.color_attributes: return
    col = me.color_attributes['Col']
    for i, v in enumerate(me.vertices):
        x, y, z = v.co; c = Vector(col.data[i].color[:3]); c = Vector((c[0] ** (1 / 2.2), c[1] ** (1 / 2.2), c[2] ** (1 / 2.2)))
        n = 0.5 + 0.5 * mnoise.noise(Vector((x * 0.6, y * 0.6, z * 0.6))) + 0.2 * mnoise.noise(Vector((x * 2.4, y * 2.4, z * 2.4)))
        soot = _sm(-0.1, 1.15, n) * (0.35 + 0.65 * _sm(-0.8, 1.6, y)) + 0.25 * _sm(0.7, 0.2, z)
        soot = min(0.55, soot * 0.6); c = c.lerp(Vector((0.06, 0.055, 0.05)), soot)
        scr = max(0.0, mnoise.noise(Vector((x * 6, y * 6, z * 6)))) ** 3 * 1.6; c = c.lerp(Vector((0.4, 0.39, 0.38)), min(0.5, scr) * (1 - soot))
        c = c.lerp(Vector((0.12, 0.08, 0.05)), _sm(0.55, 0.0, z) * 0.5)
        col.data[i].color = (c[0] ** 2.2, c[1] ** 2.2, c[2] ** 2.2, 1)
    me.update()


def shift(o, v):
    bm = bmesh.new(); bm.from_mesh(o.data); bm.transform(Matrix.Translation(v)); bm.to_mesh(o.data); bm.free(); o.data.update()


def blade_k(o):
    c = centroid(o); a = math.atan2(c.y, c.x) % math.tau; return int(round(a / (math.tau / 3))) % 3


def build_wreck2_all(export_path=None, rays=24):
    P = heli2_parts(); M = P['M']
    bpy.data.objects.remove(P['glass'], do_unlink=True)
    for k in ('paint', 'red', 'metal', 'dark'):
        b = M[k].node_tree.nodes['Principled BSDF']; b.inputs['Roughness'].default_value = max(b.inputs['Roughness'].default_value, 0.62); b.inputs['Metallic'].default_value = min(b.inputs['Metallic'].default_value, 0.2)
    shell, extras, tail, fan, sk, fair, spin, inter, det = [P[k] for k in ('shell', 'extras', 'tail', 'fan', 'skids', 'fair', 'spin', 'inter', 'det')]
    _st = [o for o in det if o.name == 'Strobe']; det = [o for o in det if o.name != 'Strobe']
    for o in _st: bpy.data.objects.remove(o, do_unlink=True)
    for o in fan: shift(o, (0.0, 6.62, 2.02))                 # the fan is modelled at the origin (it spins in the Rotor/TailRotor group in the intact model)
    boom_det = [o for o in det if centroid(o).y > 2.45 and 'Skid' not in o.name]
    body_det = [o for o in det if o not in boom_det]
    # pilot seat on the right is thrown clear
    seat = [o for o in inter if o.name.startswith(('SeatBase', 'SeatBack', 'Headrest', 'SeatFrame')) and centroid(o).x > 0.3]
    _drop_names = ('Floor', 'SillL', 'SillR')                # flat floor plates stick out of the crushed shell once it is rolled onto its side
    _dead = [o for o in inter if o.name.startswith(_drop_names)]; inter = [o for o in inter if o not in _dead]
    for o in _dead: bpy.data.objects.remove(o, do_unlink=True)
    inter_body = [o for o in inter if o not in seat]
    body_objs = [shell] + extras + body_det + inter_body + fair
    # blades / hub by angle
    blades = {k: [] for k in range(3)}; hub_objs = []
    for o in spin:
        nm = o.name
        if nm.startswith(('Blade', 'Tip', 'Sleeve', 'Damper', 'PitchLink')): blades[blade_k(o)].append(o)
        else: hub_objs.append(o)
    for o in hub_objs:
        if o.name.startswith('Mast'): shift(o, (0.0, -0.15, 2.52))        # mast stump stays on the roof
    # damage: crush the airframe (one displacement field so parts stay aligned), bend the skids, snap and bend blade 1, shorten blade 2
    for o in body_objs: apply_field(o, crush_field)
    for s in sk: bend_object(s, 2.2, 0.35 * (1 if 'Skid' in s.name else 0.5))
    ax1 = Vector((math.cos(math.tau / 3), math.sin(math.tau / 3), 0))
    for o in blades[1]:
        if not o.name.startswith(('Blade', 'Tip')): continue
        for v in o.data.vertices:
            t = v.co.dot(ax1)
            if t > 1.7: v.co -= ax1 * (t - 1.7)
            v.co.z += 0.12 * (min(t, 1.7) / 1.7) ** 2
    for o in list(blades[1]):
        if o.name.startswith('Tip'): bpy.data.objects.remove(o, do_unlink=True); blades[1].remove(o)
    ax2 = Vector((math.cos(2 * math.tau / 3), math.sin(2 * math.tau / 3), 0))
    for o in list(blades[2]):
        if o.name.startswith('Tip'): bpy.data.objects.remove(o, do_unlink=True); blades[2].remove(o); continue
        if o.name.startswith('Blade'):
            for v in o.data.vertices:
                t = v.co.dot(ax2)
                if t > 1.0: v.co -= ax2 * (t - 1.0)
    allm = [o for o in bpy.data.objects if o.type == 'MESH']
    bake_ao_to_vertex_colors(allm, rays=rays)
    for o in allm: weather(o)
    door = make_door(M)
    bpy.context.view_layer.update()
    boom_objs = tail + fan + boom_det
    G = {}
    def group(name, objs, pivot, prefix):
        merged = merge_by_material(objs, prefix)
        e = bpy.data.objects.new(name, None); bpy.context.scene.collection.objects.link(e); e.location = pivot
        for o in merged: o.parent = e; o.matrix_parent_inverse = e.matrix_world.inverted()
        return e
    hub_rest = [o for o in hub_objs if not o.name.startswith('Mast')] + blades[2] + [o for o in blades[0] + blades[1] if o.name.startswith(('Sleeve', 'Damper', 'PitchLink'))]
    bladeA = [o for o in blades[0] if o.name.startswith(('Blade', 'Tip'))]; bladeB = [o for o in blades[1] if o.name.startswith('Blade')]
    G['Body'] = group('WreckBody', body_objs + sk + [o for o in hub_objs if o.name.startswith('Mast')], (0, 0, 0), 'WB')
    G['Body'].rotation_euler = Euler((math.radians(-12), math.radians(64), 0), 'XYZ'); _drop(G['Body'])
    G['Boom'] = group('WreckBoom', boom_objs, (0, 2.3, 1.45), 'WT')
    G['Boom'].location = (2.6, 5.4, 0.4); G['Boom'].rotation_euler = Euler((math.radians(10), math.radians(-24), math.radians(38)), 'XYZ'); _drop(G['Boom'])
    G['BladeA'] = group('WreckBladeA', bladeA, (0, 0, 0), 'WA'); G['BladeA'].location = (-4.5, -2.0, 0.0); G['BladeA'].rotation_euler = Euler((0.04, 0.18, math.radians(25)), 'XYZ'); _drop(G['BladeA'], 0.02)
    G['BladeB'] = group('WreckBladeB', bladeB, (0, 0, 0), 'WC'); G['BladeB'].location = (3.8, -2.6, 0.0); G['BladeB'].rotation_euler = Euler((0.05, -0.1, math.radians(-70)), 'XYZ'); _drop(G['BladeB'], 0.02)
    G['Hub'] = group('WreckHub', hub_rest, (0, 0, 0), 'WH'); G['Hub'].location = (-1.6, 1.8, 0); _drop(G['Hub'], 0.0)
    G['Door'] = group('WreckDoor', [door], (0, 0, 0), 'WD'); G['Door'].location = (-3.2, -5.2, 0); G['Door'].rotation_euler = Euler((math.radians(-87), 0.025, math.radians(40)), 'XYZ'); _drop(G['Door'], 0.02)
    G['Seat'] = group('WreckSeat', seat, (0.0, 0.0, 0.0), 'WS'); G['Seat'].location = (4.5, -4.8, 0); G['Seat'].rotation_euler = Euler((math.radians(75), 0.2, math.radians(20)), 'XYZ'); _drop(G['Seat'], 0.0)
    if export_path:
        import logging; logging.disable(logging.CRITICAL)
        for o in bpy.data.objects: o.select_set(True)
        bpy.ops.export_scene.gltf(filepath=export_path, export_format='GLB', use_selection=True, export_apply=True, export_animations=False, export_yup=True, export_materials='EXPORT', export_vertex_color='ACTIVE', export_cameras=False, export_lights=False)
    return G
