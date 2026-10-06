import bpy, bmesh, math
from mathutils import Vector
exec(open("/Users/talaljawaid/Documents/Talal's Folder/Claude/Experiment 2026/Experiment 3/AI Game/assets/blender/build_props.py").read())

def _rounded_rect(y0, y1, z0, z1, x, r=0.12, n=5):
    pts = []
    def arc(cy, cz, a0):
        for i in range(n + 1):
            a = a0 + i / n * math.pi / 2; pts.append((x, cy + math.cos(a) * r, cz + math.sin(a) * r))
    arc(y1 - r, z1 - r, 0); arc(y0 + r, z1 - r, math.pi / 2); arc(y0 + r, z0 + r, math.pi); arc(y1 - r, z0 + r, 1.5 * math.pi)
    pts.append(pts[0]); return pts

def loop_on_surface(bvh, pts, offset, width, thick, mat, name):
    path = project_path(pts, bvh, offset, 4)
    o = ribbon(name, path, width, thick, closed=False); o.data.materials.append(mat)
    for p in o.data.polygons: p.use_smooth = True
    return o

def add_details(mats, intact=True):
    out = []; bvh = surface_bvh(['Fuselage'])
    rubber = mats['dark']; chrome = mats['metal']; red = mats['red']
    white = _mat('HeliWhite', (0.78, 0.8, 0.82), 0.35, 0.3); out_mats = {'white': white}
    for s in (-1, 1):
        x = s * 1.25
        out.append(loop_on_surface(bvh, _rounded_rect(-0.7, 0.55, 0.52, 1.96, x, 0.12), 0.003, 0.016, 0.008, rubber, 'DoorOutline'))
        out.append(loop_on_surface(bvh, _rounded_rect(-1.96, -0.84, 1.36, 1.94, x, 0.1), 0.004, 0.03, 0.012, rubber, 'WinFrameF'))
        out.append(loop_on_surface(bvh, _rounded_rect(-0.56, 0.5, 1.36, 1.94, x, 0.1), 0.004, 0.03, 0.012, rubber, 'WinFrameR'))
        # door handles, hinges, step
        for (y, z, L) in ((-0.62, 1.12, 0.14), (0.45, 1.12, 0.14)):
            loc, n = bvh.find_nearest(Vector((x * 1.1, y, z)))[:2]
            bpy.ops.mesh.primitive_cube_add(size=1, location=loc + n * 0.012); h = bpy.context.active_object; h.scale = (0.02, L / 2, 0.022); h.name = 'Handle'
            h.rotation_euler = (0, 0, 0); bpy.ops.object.transform_apply(scale=True); h.data.materials.append(chrome); out.append(h)
        # nav light on the sponson (red left / green right)
        loc, n = bvh.find_nearest(Vector((s * 1.3, -2.2, 0.9)))[:2]
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.055, segments=14, ring_count=8, location=loc + n * 0.01); nl = bpy.context.active_object; nl.name = 'NavLight'
        nl.data.materials.append(_mat('NavL' if s < 0 else 'NavR', (0.9, 0.05, 0.05) if s < 0 else (0.05, 0.8, 0.1), 0.2)); out.append(nl)
        # intake vent grille on the cowl side
        for i in range(6):
            bpy.ops.mesh.primitive_cube_add(size=1, location=(s * 0.505, 0.35 + i * 0.09, 2.3)); g = bpy.context.active_object; g.scale = (0.01, 0.025, 0.14); g.rotation_euler = (0, 0, s * 0.0)
            bpy.ops.object.transform_apply(scale=True); g.data.materials.append(rubber); out.append(g)
        # pitch links + blade grips on the rotor head are added with the rotor; skid toe caps
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.07, segments=12, ring_count=8, location=(s * 0.95, -1.9, 0.18)); t = bpy.context.active_object; t.scale = (1, 1.4, 1); bpy.ops.object.transform_apply(scale=True); t.data.materials.append(rubber); out.append(t)
        # skid step
        bpy.ops.mesh.primitive_cube_add(size=1, location=(s * 1.12, -0.1, 0.32)); st = bpy.context.active_object; st.scale = (0.12, 0.18, 0.02); bpy.ops.object.transform_apply(scale=True); st.data.materials.append(rubber); out.append(st)
    # windscreen centre post + roof frame
    out.append(loop_on_surface(bvh, [(0, -2.62, 1.0), (0, -2.55, 1.28), (0, -2.15, 1.72), (0, -1.5, 2.06), (0, -0.55, 2.2)], 0.004, 0.035, 0.012, rubber, 'WindscreenPost'))
    out.append(loop_on_surface(bvh, [(-0.95, -0.55, 2.06), (-0.6, -0.55, 2.19), (0.6, -0.55, 2.19), (0.95, -0.55, 2.06)], 0.004, 0.05, 0.012, rubber, 'RoofBeam'))
    # exhaust stack, antenna, pitot, landing light, belly beacon
    out += [tapered_tube('Exhaust', [(0.0, 1.45, 2.22), (0.0, 1.62, 2.3), (0.0, 1.78, 2.34)], [0.11, 0.1, 0.095], segs=14, subdiv_each=3, color_fn=lambda t: (0.07, 0.065, 0.06)),
            tapered_tube('Antenna', [(0.0, 1.0, 2.2), (0.0, 1.06, 2.5), (0.0, 1.12, 2.78)], [0.012, 0.008, 0.003], segs=8, subdiv_each=3, color_fn=lambda t: (0.15, 0.15, 0.16)),
            tapered_tube('Pitot', [(0.0, -2.5, 1.5), (0.0, -2.9, 1.5)], [0.012, 0.007], segs=8, subdiv_each=2, color_fn=lambda t: (0.6, 0.6, 0.62))]
    for o in out[-3:]: o.data.materials.append(mats['dark'] if 'Exhaust' not in o.name else mats['dark'])
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.09, segments=14, ring_count=8, location=(0, -2.62, 0.78)); ll = bpy.context.active_object; ll.name = 'LandingLight'; ll.data.materials.append(_mat('LandLight', (1, 0.96, 0.8), 0.1)); out.append(ll)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.07, segments=12, ring_count=8, location=(0, 0.2, 0.2)); bb = bpy.context.active_object; bb.name = 'BellyBeacon'; bb.data.materials.append(mats['red']); out.append(bb)
    # registration text on the boom (both sides) and tail fin stripe
    for s in (-1, 1):
        cu = bpy.data.curves.new('Reg', 'FONT'); cu.body = 'N412JS'; cu.size = 0.2; cu.extrude = 0.004; cu.align_x = 'CENTER'; cu.align_y = 'CENTER'
        o = bpy.data.objects.new('RegT', cu); bpy.context.scene.collection.objects.link(o)
        o.rotation_euler = (math.pi / 2, 0, s * math.pi / 2); o.location = (s * 0.268, 4.35, 1.56)
        me = bpy.data.meshes.new_from_object(o.evaluated_get(bpy.context.evaluated_depsgraph_get())); to = bpy.data.objects.new('RegM', me); bpy.context.scene.collection.objects.link(to)
        to.rotation_euler = o.rotation_euler; to.location = o.location; bpy.data.objects.remove(o, do_unlink=True)
        to.data.materials.append(mats['dark']); out.append(to)
    # boom panel rings + tail gearbox
    for y in (3.0, 4.3, 5.6):
        r = 0.42 + (0.11 - 0.42) * (y - 2.2) / 4.3 * 0.9 + 0.012
        bpy.ops.mesh.primitive_torus_add(major_radius=max(r, 0.12), minor_radius=0.006, major_segments=28, minor_segments=6, location=(0, y, 1.4 + (y - 2.2) * 0.07), rotation=(math.pi / 2, 0, 0)); tr = bpy.context.active_object
        tr.data.materials.append(mats['dark']); out.append(tr)
    gb = tapered_tube('TailGearbox', [(0.05, 6.7, 1.76), (0.12, 6.85, 1.8)], [0.075, 0.06], segs=12, subdiv_each=2, color_fn=lambda t: (0.5, 0.52, 0.55)); gb.data.materials.append(mats['metal']); out.append(gb)
    for o in out:
        if o.type == 'MESH':
            for p in o.data.polygons: p.use_smooth = True
    return out
