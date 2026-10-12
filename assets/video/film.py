"""Jungle Survival launch film (30 s, 24 fps, 1920x1080).  Built shot by shot; each shot lives in its own collection, shown only on its frame range.
Shots: 1 ocean fly-by (f1-120) | 2 engine trouble, canopy skim (121-240) | 3 the fall (241-330) | 4 wreck at dusk (331-480) | 5 night, jaguar (481-600) | 6 title (601-720)."""
import bpy, bmesh, math, random, os
from mathutils import Vector, Matrix, Euler

V_SKY = "/Users/talaljawaid/Documents/Talal's Folder/Claude/Experiment 2026/Experiment 3/AI Game/assets/video/sky/"
BL = "/Users/talaljawaid/Documents/Talal's Folder/Claude/Experiment 2026/Experiment 3/AI Game/assets/blender/"
RND = random.Random(5)
FPS = 24
SHOTS = {1: (1, 120), 2: (121, 240), 3: (241, 330), 4: (331, 480), 5: (481, 600), 6: (601, 720)}


def keyframe_visibility(coll, f0, f1):
    """objects of a shot render only on [f0, f1]: collections cannot be animated, so key every object's hide_render (constant)"""
    for o in list(coll.all_objects):
        for f, val in ((max(1, f0 - 1), True), (f0, False), (f1 + 1, True)):
            if f0 <= 1 and f < 1: continue
            o.hide_render = val; o.keyframe_insert('hide_render', frame=f)
            o.hide_viewport = val; o.keyframe_insert('hide_viewport', frame=f)
        for fc in fcurves_of(o):
            if fc.data_path in ('hide_render', 'hide_viewport'):
                for k in fc.keyframe_points: k.interpolation = 'CONSTANT'


def new_coll(name):
    c = bpy.data.collections.new(name); bpy.context.scene.collection.children.link(c); return c


def move_to(o, coll):
    for c in list(o.users_collection): c.objects.unlink(o)
    coll.objects.link(o)


def append_objects(blend, names=None, prefix=''):
    with bpy.data.libraries.load(blend, link=False) as (src, dst):
        dst.objects = [n for n in src.objects if (names is None or n in names)]
    out = []
    for o in dst.objects:
        if o is None: continue
        bpy.context.scene.collection.objects.link(o); out.append(o)
    return out


def pbr_from_tints(objs, keep_vertex_colour=True):
    """the game models store colour (with baked AO) in the 'Col' vertex colour: keep it, but give each material real PBR response and make glass/lights proper"""
    done = {}
    for o in objs:
        if o.type != 'MESH': continue
        for i, m in enumerate(o.data.materials):
            if m is None: continue
            if m.name in done: o.data.materials[i] = done[m.name]; continue
            n = m.copy(); n.name = m.name + '_pbr'; done[m.name] = n; o.data.materials[i] = n
            nt = n.node_tree; b = nt.nodes['Principled BSDF']; base = m.name; t = tuple(n.get('tint', (0.5, 0.5, 0.5)))
            special = any(k in base for k in ('Glass', 'Screen', 'Nav', 'LandLight', 'Strobe', 'Amber'))
            if special or not keep_vertex_colour:
                for l in list(nt.links):
                    if l.to_socket == b.inputs['Base Color']: nt.links.remove(l)
                b.inputs['Base Color'].default_value = (*t, 1)
            if 'Paint' in base: b.inputs['Roughness'].default_value = 0.22; b.inputs['Metallic'].default_value = 0.25; b.inputs['Coat Weight'].default_value = 0.6; b.inputs['Coat Roughness'].default_value = 0.08
            if 'Glass' in base:
                b.inputs['Alpha'].default_value = 0.22; b.inputs['Roughness'].default_value = 0.02; b.inputs['Metallic'].default_value = 0.0; b.inputs['IOR'].default_value = 1.5
                try: n.surface_render_method = 'BLENDED'
                except Exception: pass
            if 'Metal' in base: b.inputs['Metallic'].default_value = 1.0; b.inputs['Roughness'].default_value = 0.25
            if 'Screen' in base: b.inputs['Emission Strength'].default_value = 3.0
            if base in ('NavL', 'NavR', 'LandLight', 'Strobe', 'HeliAmber'): b.inputs['Emission Color'].default_value = (*t, 1); b.inputs['Emission Strength'].default_value = 6.0
    return done


def spin_rotor(rotor, f0, f1, rps=9.0, axis=2, sign=-1):
    """rotor spins 'rps' revolutions per second; keyframed linear (lower the per-frame step if motion blur aliasing shows)"""
    rotor.rotation_mode = 'XYZ'; rotor.rotation_euler[axis] = 0; rotor.keyframe_insert('rotation_euler', index=axis, frame=f0)
    rotor.rotation_euler[axis] = sign * math.tau * rps * (f1 - f0) / FPS; rotor.keyframe_insert('rotation_euler', index=axis, frame=f1)
    set_interp(rotor, 'LINEAR')


def blur_disc(parent, radius, z, strength=0.5, name='RotorBlur'):
    bpy.ops.mesh.primitive_circle_add(vertices=64, radius=radius, fill_type='TRIFAN', location=(0, 0, z)); o = bpy.context.active_object; o.name = name
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear(); out = nt.nodes.new('ShaderNodeOutputMaterial')
    tr = nt.nodes.new('ShaderNodeBsdfTransparent'); bs = nt.nodes.new('ShaderNodeBsdfDiffuse'); bs.inputs['Color'].default_value = (0.05, 0.05, 0.05, 1)
    mix = nt.nodes.new('ShaderNodeMixShader'); mix.inputs['Fac'].default_value = strength
    tc = nt.nodes.new('ShaderNodeTexCoord'); vm = nt.nodes.new('ShaderNodeVectorMath'); vm.operation = 'LENGTH'; nt.links.new(tc.outputs['Object'], vm.inputs[0])
    mr = nt.nodes.new('ShaderNodeMapRange'); mr.inputs['From Min'].default_value = radius * 0.12; mr.inputs['From Max'].default_value = radius; mr.inputs['To Min'].default_value = 0.0; mr.inputs['To Max'].default_value = 0.0
    # radial fade: nothing near the hub, soft ring over the blade span
    rr = nt.nodes.new('ShaderNodeValToRGB'); rr.color_ramp.elements[0].position = 0.12; rr.color_ramp.elements[0].color = (0, 0, 0, 1); rr.color_ramp.elements[1].position = 0.55; rr.color_ramp.elements[1].color = (strength, strength, strength, 1)
    e = rr.color_ramp.elements.new(0.97); e.color = (strength, strength, strength, 1); rr.color_ramp.elements.new(1.0).color = (0, 0, 0, 1)
    dv = nt.nodes.new('ShaderNodeMath'); dv.operation = 'DIVIDE'; dv.inputs[1].default_value = radius; nt.links.new(vm.outputs['Value'], dv.inputs[0]); nt.links.new(dv.outputs[0], rr.inputs['Fac'])
    nt.links.new(rr.outputs['Color'], mix.inputs['Fac']); nt.links.new(tr.outputs['BSDF'], mix.inputs[1]); nt.links.new(bs.outputs['BSDF'], mix.inputs[2]); nt.links.new(mix.outputs['Shader'], out.inputs['Surface'])
    try: m.surface_render_method = 'BLENDED'
    except Exception: pass
    o.data.materials.append(m); o.parent = parent; o.location = (0, 0, z); o.visible_shadow = False; return o


def build_heli_asset(coll):
    objs = append_objects(BL + "helicopter_v2.blend")
    pbr_from_tints(objs)
    base = lambda o: o.name.split('.')[0]
    root = [o for o in objs if base(o) == 'Heli'][0]
    for o in objs: move_to(o, coll)
    rotor = [o for o in objs if base(o) == 'Rotor'][0]; tail = [o for o in objs if base(o) == 'TailRotor'][0]; body = [o for o in objs if base(o) == 'Body'][0]
    return root, body, rotor, tail


def setup_compositor(glare=0.6, glare_threshold=1.0, vignette=0.5, gain=(1.04, 1.0, 0.94), lift=(1.0, 1.0, 1.0), gamma=(1.0, 1.0, 1.0), ca=0.003, grain=0.035):
    """filmic finish: bloom, fringing, grade, vignette, grain (Blender 5 socket-based compositor)"""
    s = bpy.context.scene
    ng = bpy.data.node_groups.new('FilmComp', 'CompositorNodeTree'); s.compositing_node_group = ng
    ng.interface.new_socket('Image', in_out='OUTPUT', socket_type='NodeSocketColor')
    N = ng.nodes; L = ng.links
    rl = N.new('CompositorNodeRLayers'); out = N.new('NodeGroupOutput')
    gl = N.new('CompositorNodeGlare')
    for k, v in (('Type', 'Bloom'), ('Quality', 'High'), ('Threshold', glare_threshold), ('Strength', glare), ('Size', 0.7), ('Smoothness', 0.5)):
        try: gl.inputs[k].default_value = v
        except Exception as e: print('glare', k, e)
    cb = N.new('ShaderNodeMix'); cb.data_type = 'RGBA'; cb.blend_type = 'MULTIPLY'; cb.inputs['Factor'].default_value = 1.0; cb.inputs['B'].default_value = (*gain, 1.0)
    dn = N.new('CompositorNodeDenoise')
    L.new(rl.outputs['Image'], dn.inputs['Image']); L.new(dn.outputs['Image'], gl.inputs['Image']); L.new(gl.outputs['Image'], cb.inputs['A'])
    # vignette
    em = N.new('CompositorNodeEllipseMask')
    try: em.inputs['Position'].default_value = (0.5, 0.5); em.inputs['Size'].default_value = (0.9, 0.85)
    except Exception as e: print('em', e)
    bl = N.new('CompositorNodeBlur')
    try: bl.inputs['Size'].default_value = (220.0, 220.0) if bl.inputs['Size'].type == 'VECTOR' else 220.0; bl.inputs['Type'].default_value = 'Gaussian'
    except Exception as e: print('bl', e)
    L.new(em.outputs['Mask'], bl.inputs['Image'])
    mx = N.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'MIX'
    mx.inputs['A'].default_value = (0.3, 0.3, 0.3, 1); mx.inputs['B'].default_value = (1, 1, 1, 1)
    L.new(bl.outputs['Image'], mx.inputs['Factor'])
    mv = N.new('ShaderNodeMix'); mv.data_type = 'RGBA'; mv.blend_type = 'MULTIPLY'; mv.inputs['Factor'].default_value = vignette
    L.new(cb.outputs['Result'], mv.inputs['A']); L.new(mx.outputs['Result'], mv.inputs['B'])
    L.new(mv.outputs['Result'], out.inputs['Image'])
    return ng


def make_sky_gradient(sun_dir, stops, glow=(1.0, 0.5, 0.2), glow_power=6.0, glow_strength=1.2, disc_power=1500.0, disc_strength=60.0, cloud_amount=0.55, cloud_dark=(0.12, 0.08, 0.14), cloud_lit=(1.0, 0.5, 0.22), strength=1.0, cloud_scale=2.2):
    """art-directed sky: colour ramp by elevation + sun glow + sun disc + streaky clouds that catch the light.  stops: [(z, (r,g,b))...]"""
    w = bpy.data.worlds.new('SkyGrad'); bpy.context.scene.world = w; w.use_nodes = True; nt = w.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputWorld'); bg = nt.nodes.new('ShaderNodeBackground'); bg.inputs['Strength'].default_value = strength
    tc = nt.nodes.new('ShaderNodeTexCoord'); sep = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(tc.outputs['Generated'], sep.inputs['Vector'])
    # world 'Generated' is in 0..1; use normalised view direction from Geometry-like vector math instead
    nrm = nt.nodes.new('ShaderNodeVectorMath'); nrm.operation = 'NORMALIZE'
    vsub = nt.nodes.new('ShaderNodeVectorMath'); vsub.operation = 'SUBTRACT'; vsub.inputs[1].default_value = (0.0, 0.0, 0.0); nt.links.new(tc.outputs['Generated'], vsub.inputs[0])
    vmul = nt.nodes.new('ShaderNodeVectorMath'); vmul.operation = 'MULTIPLY'; vmul.inputs[1].default_value = (1, 1, 1); nt.links.new(vsub.outputs[0], vmul.inputs[0]); nt.links.new(vmul.outputs[0], nrm.inputs[0])
    d = nrm.outputs[0]
    sep2 = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(d, sep2.inputs[0])
    ramp = nt.nodes.new('ShaderNodeValToRGB'); ramp.color_ramp.interpolation = 'EASE'
    els = ramp.color_ramp.elements
    els[0].position = stops[0][0]; els[0].color = (*stops[0][1], 1); els[1].position = stops[-1][0]; els[1].color = (*stops[-1][1], 1)
    for z, c in stops[1:-1]: e = els.new(z); e.color = (*c, 1)
    nt.links.new(sep2.outputs['Z'], ramp.inputs['Fac'])
    # sun glow
    sd = nt.nodes.new('ShaderNodeVectorMath'); sd.operation = 'DOT_PRODUCT'; sd.inputs[1].default_value = tuple(sun_dir); nt.links.new(d, sd.inputs[0])
    cl = nt.nodes.new('ShaderNodeMath'); cl.operation = 'MAXIMUM'; cl.inputs[1].default_value = 0.0; nt.links.new(sd.outputs['Value'], cl.inputs[0])
    gp = nt.nodes.new('ShaderNodeMath'); gp.operation = 'POWER'; gp.inputs[1].default_value = glow_power; nt.links.new(cl.outputs[0], gp.inputs[0])
    dp = nt.nodes.new('ShaderNodeMath'); dp.operation = 'POWER'; dp.inputs[1].default_value = disc_power; nt.links.new(cl.outputs[0], dp.inputs[0])
    gm = nt.nodes.new('ShaderNodeMath'); gm.operation = 'MULTIPLY'; gm.inputs[1].default_value = glow_strength; nt.links.new(gp.outputs[0], gm.inputs[0])
    dm = nt.nodes.new('ShaderNodeMath'); dm.operation = 'MULTIPLY'; dm.inputs[1].default_value = disc_strength; nt.links.new(dp.outputs[0], dm.inputs[0])
    # clouds: project the direction onto a plane so they stretch toward the horizon
    zc = nt.nodes.new('ShaderNodeMath'); zc.operation = 'MAXIMUM'; zc.inputs[1].default_value = 0.06; nt.links.new(sep2.outputs['Z'], zc.inputs[0])
    px = nt.nodes.new('ShaderNodeMath'); px.operation = 'DIVIDE'; nt.links.new(sep2.outputs['X'], px.inputs[0]); nt.links.new(zc.outputs[0], px.inputs[1])
    py = nt.nodes.new('ShaderNodeMath'); py.operation = 'DIVIDE'; nt.links.new(sep2.outputs['Y'], py.inputs[0]); nt.links.new(zc.outputs[0], py.inputs[1])
    cmb = nt.nodes.new('ShaderNodeCombineXYZ'); nt.links.new(px.outputs[0], cmb.inputs['X']); nt.links.new(py.outputs[0], cmb.inputs['Y'])
    msk = nt.nodes.new('ShaderNodeMapping'); msk.inputs['Scale'].default_value = (cloud_scale, cloud_scale * 3.2, 1); nt.links.new(cmb.outputs[0], msk.inputs['Vector'])
    nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 1.0; nz.inputs['Detail'].default_value = 7; nz.inputs['Roughness'].default_value = 0.6; nt.links.new(msk.outputs[0], nz.inputs['Vector'])
    cr = nt.nodes.new('ShaderNodeValToRGB'); cr.color_ramp.elements[0].position = 1 - cloud_amount - 0.12; cr.color_ramp.elements[1].position = 1 - cloud_amount + 0.12
    nt.links.new(nz.outputs['Fac'], cr.inputs['Fac'])
    hz = nt.nodes.new('ShaderNodeMapRange'); hz.inputs['From Min'].default_value = 0.02; hz.inputs['From Max'].default_value = 0.22; hz.clamp = True; nt.links.new(sep2.outputs['Z'], hz.inputs['Value'])
    cm = nt.nodes.new('ShaderNodeMath'); cm.operation = 'MULTIPLY'; nt.links.new(cr.outputs['Color'] if False else cr.outputs[0], cm.inputs[0]); nt.links.new(hz.outputs[0], cm.inputs[1])
    # cloud colour: dark body, lit by the sun glow
    lit = nt.nodes.new('ShaderNodeMath'); lit.operation = 'MULTIPLY'; lit.inputs[1].default_value = 4.0; nt.links.new(gp.outputs[0], lit.inputs[0]); lit.use_clamp = True
    ccol = nt.nodes.new('ShaderNodeMix'); ccol.data_type = 'RGBA'; ccol.inputs['A'].default_value = (*cloud_dark, 1); ccol.inputs['B'].default_value = (*cloud_lit, 1); nt.links.new(lit.outputs[0], ccol.inputs['Factor'])
    gcol = nt.nodes.new('ShaderNodeMix'); gcol.data_type = 'RGBA'; gcol.blend_type = 'ADD'; gcol.inputs['B'].default_value = (*glow, 1); nt.links.new(gm.outputs[0], gcol.inputs['Factor']); nt.links.new(ramp.outputs['Color'], gcol.inputs['A'])
    mixc = nt.nodes.new('ShaderNodeMix'); mixc.data_type = 'RGBA'; nt.links.new(cm.outputs[0], mixc.inputs['Factor']); nt.links.new(gcol.outputs['Result'], mixc.inputs['A']); nt.links.new(ccol.outputs['Result'], mixc.inputs['B'])
    disc = nt.nodes.new('ShaderNodeMix'); disc.data_type = 'RGBA'; disc.blend_type = 'ADD'; disc.inputs['B'].default_value = (1.0, 0.85, 0.6, 1); nt.links.new(dm.outputs[0], disc.inputs['Factor']); nt.links.new(mixc.outputs['Result'], disc.inputs['A'])
    nt.links.new(disc.outputs['Result'], bg.inputs['Color']); nt.links.new(bg.outputs['Background'], out.inputs['Surface'])
    return w


def sun_vec(az_deg, el_deg):
    az = math.radians(az_deg); el = math.radians(el_deg); return Vector((-math.sin(az) * math.cos(el), math.cos(az) * math.cos(el), math.sin(el)))


def aim(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()


# ---------------------------------------------------------------------------------------------------------------- helpers
def fcurves_of(idb):
    """Blender 5 slotted actions: fcurves live in action.layers[].strips[].channelbag(slot)"""
    ad = getattr(idb, 'animation_data', None)
    if not ad or not ad.action: return []
    out = []; slot = ad.action_slot
    for layer in ad.action.layers:
        for strip in layer.strips:
            cb = strip.channelbag(slot) if slot else None
            if cb: out += list(cb.fcurves)
    return out


def unwrap_rotation(idb):
    """remove 2*pi jumps from rotation_euler curves so keyframe interpolation never spins the long way round"""
    for fc in fcurves_of(idb):
        if fc.data_path != 'rotation_euler': continue
        prev = None; off = 0.0
        for k in fc.keyframe_points:
            v = k.co[1] + off
            if prev is not None:
                while v - prev > math.pi: off -= math.tau; v -= math.tau
                while v - prev < -math.pi: off += math.tau; v += math.tau
            k.co[1] = v; k.handle_left[1] += off; k.handle_right[1] += off; prev = v
        fc.update()


def set_interp(idb, interp, paths=None):
    for fc in fcurves_of(idb):
        if paths and not any(fc.data_path.startswith(p) or fc.data_path.endswith(p) for p in paths): continue
        for k in fc.keyframe_points: k.interpolation = interp


def ease_all(obj, interp='BEZIER'):
    set_interp(obj, interp)


def key(obj, frame, **kw):
    for p, v in kw.items():
        setattr(obj, p, v); obj.keyframe_insert(p, frame=frame)


def make_camera(name, lens, f0, f1, focus_obj=None, fstop=2.8, focus_dist=None, sensor=36):
    c = bpy.data.cameras.new(name); c.lens = lens; c.clip_end = 30000; c.clip_start = 0.3; c.sensor_width = sensor
    c.dof.use_dof = True; c.dof.aperture_fstop = fstop
    if focus_obj is not None: c.dof.focus_object = focus_obj
    elif focus_dist: c.dof.focus_distance = focus_dist
    o = bpy.data.objects.new(name, c); bpy.context.scene.collection.objects.link(o)
    m = bpy.context.scene.timeline_markers.new('cam_' + name, frame=f0); m.camera = o
    return o


def handheld(cam, f0, f1, amp=0.03, rot=0.002, seed=1):
    """subtle noise on the camera for a documentary feel"""
    fc_loc = cam.keyframe_insert  # ensure animation data exists
    r = random.Random(seed); unwrap_rotation(cam)
    # (applied through a noise modifier on the fcurves after keyframes exist)
    for fc in fcurves_of(cam):
        if fc.data_path in ('location', 'rotation_euler'):
            a = amp if fc.data_path == 'location' else rot
            md = fc.modifiers.new('NOISE'); md.scale = 28 + r.random() * 12; md.strength = a; md.phase = r.random() * 100; md.depth = 1


def sunset_world(az=-32.0, el=4.0, strength=0.8):
    sv = sun_vec(az, el)
    make_sky_gradient(sv, [(0.0, (1.0, 0.66, 0.26)), (0.04, (1.0, 0.45, 0.14)), (0.14, (0.85, 0.32, 0.28)), (0.3, (0.45, 0.25, 0.45)), (0.55, (0.16, 0.2, 0.42)), (1.0, (0.04, 0.07, 0.2))],
                      glow=(1.0, 0.55, 0.2), glow_power=18.0, glow_strength=0.9, disc_power=12000.0, disc_strength=60.0, cloud_amount=0.42, strength=strength, cloud_dark=(0.3, 0.17, 0.27), cloud_lit=(1.0, 0.62, 0.3))
    return sv


def add_sun_lamp(sv, energy=2.2, color=(1.0, 0.55, 0.25), angle=0.7, name='Sun'):
    d = bpy.data.lights.new(name, 'SUN'); d.energy = energy; d.color = color; d.angle = math.radians(angle)
    o = bpy.data.objects.new(name, d); bpy.context.scene.collection.objects.link(o); o.rotation_euler = (-sv).to_track_quat('-Z', 'Y').to_euler(); return o


def add_fill(direction, energy=0.7, color=(0.55, 0.7, 1.0), name='Fill'):
    d = bpy.data.lights.new(name, 'SUN'); d.energy = energy; d.color = color
    o = bpy.data.objects.new(name, d); bpy.context.scene.collection.objects.link(o); o.rotation_euler = Vector(direction).to_track_quat('-Z', 'Y').to_euler(); return o


# ---------------------------------------------------------------------------------------------------------------- smoke / fire
def smoke_material(name='Smoke', color=(0.03, 0.03, 0.035), density=0.9, soft=1.6):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear(); out = nt.nodes.new('ShaderNodeOutputMaterial'); b = nt.nodes.new('ShaderNodeBsdfPrincipled')
    b.inputs['Base Color'].default_value = (*color, 1); b.inputs['Roughness'].default_value = 1.0
    try: b.inputs['Specular IOR Level'].default_value = 0.0
    except Exception: pass
    lw = nt.nodes.new('ShaderNodeLayerWeight'); lw.inputs['Blend'].default_value = 0.5
    pw = nt.nodes.new('ShaderNodeMath'); pw.operation = 'POWER'; pw.inputs[1].default_value = soft; nt.links.new(lw.outputs['Facing'], pw.inputs[0])
    iv = nt.nodes.new('ShaderNodeMath'); iv.operation = 'SUBTRACT'; iv.inputs[0].default_value = 1.0; nt.links.new(pw.outputs[0], iv.inputs[1])
    geo = nt.nodes.new('ShaderNodeNewGeometry'); nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 2.2; nz.inputs['Detail'].default_value = 6; nt.links.new(geo.outputs['Position'], nz.inputs['Vector'])
    ob = nt.nodes.new('ShaderNodeObjectInfo'); mp = nt.nodes.new('ShaderNodeMapping'); nt.links.new(geo.outputs['Position'], mp.inputs['Vector'])
    nt.links.new(ob.outputs['Random'], mp.inputs['Location'].links[0].from_socket) if False else None
    nt.links.new(mp.outputs['Vector'], nz.inputs['Vector'])
    mu = nt.nodes.new('ShaderNodeMath'); mu.operation = 'MULTIPLY'; nt.links.new(iv.outputs[0], mu.inputs[0]); nt.links.new(nz.outputs['Fac'], mu.inputs[1])
    ms = nt.nodes.new('ShaderNodeMath'); ms.operation = 'MULTIPLY'; ms.inputs[1].default_value = density * 1.8; ms.use_clamp = True; nt.links.new(mu.outputs[0], ms.inputs[0])
    # per-puff fade: object colour alpha is keyed from outside via the 'Alpha' of the material's object colour
    oc = nt.nodes.new('ShaderNodeObjectInfo'); fm = nt.nodes.new('ShaderNodeMath'); fm.operation = 'MULTIPLY'; nt.links.new(ms.outputs[0], fm.inputs[0]); nt.links.new(oc.outputs['Alpha'], fm.inputs[1])
    nt.links.new(fm.outputs[0], b.inputs['Alpha']); nt.links.new(b.outputs['BSDF'], out.inputs['Surface'])
    try: m.surface_render_method = 'BLENDED'
    except Exception: pass
    return m


def puff(name, loc, r0, r1, f0, f1, mat, rise=2.0, drift=(0.0, 0.0), peak=0.85, seed=0):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=1, location=loc); o = bpy.context.active_object; o.name = name
    rnd = random.Random(seed)
    for v in o.data.vertices:
        from mathutils import noise as mn
        v.co *= 1 + 0.28 * mn.noise(v.co * 1.7 + Vector((seed, 0, 0)))
    for p in o.data.polygons: p.use_smooth = True
    o.data.materials.append(mat); o.visible_shadow = False
    o.scale = (r0, r0, r0); o.keyframe_insert('scale', frame=f0)
    o.scale = (r1, r1, r1); o.keyframe_insert('scale', frame=f1)
    o.location = loc; o.keyframe_insert('location', frame=f0)
    o.location = (loc[0] + drift[0], loc[1] + drift[1], loc[2] + rise); o.keyframe_insert('location', frame=f1)
    o.rotation_euler = (rnd.random() * 6, rnd.random() * 6, rnd.random() * 6); o.keyframe_insert('rotation_euler', frame=f0)
    o.rotation_euler = (o.rotation_euler[0] + 0.8, o.rotation_euler[1], o.rotation_euler[2] + 0.6); o.keyframe_insert('rotation_euler', frame=f1)
    # fade: object colour alpha 0 -> peak -> 0
    for f, a in ((f0 - 1, 0.0), (f0 + 4, peak), (f0 + (f1 - f0) * 0.55, peak * 0.7), (f1, 0.0)):
        o.color = (1, 1, 1, a); o.keyframe_insert('color', frame=max(1, int(f)))
    return o


def flame_material(name='Flame', intensity=14.0, scale=3.0, speed=3.0, f_end=720):
    """camera-facing flame card: animated noise scrolls up a tapering mask; emission ramp from white-yellow core to deep red edge"""
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear(); out = nt.nodes.new('ShaderNodeOutputMaterial')
    tc = nt.nodes.new('ShaderNodeTexCoord'); sep = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(tc.outputs['UV'], sep.inputs['Vector'])
    mp = nt.nodes.new('ShaderNodeMapping'); nt.links.new(tc.outputs['UV'], mp.inputs['Vector'])
    mp.inputs['Scale'].default_value = (scale, scale * 1.6, 1.0)
    mp.inputs['Location'].default_value = (0, 0, 0); mp.inputs['Location'].keyframe_insert('default_value', frame=1, index=1)
    mp.inputs['Location'].default_value = (0, -speed * f_end / 24.0, 0); mp.inputs['Location'].keyframe_insert('default_value', frame=f_end, index=1)
    nz = nt.nodes.new('ShaderNodeTexNoise'); nz.noise_dimensions = '3D'; nz.inputs['Detail'].default_value = 6; nz.inputs['Roughness'].default_value = 0.65; nz.inputs['Scale'].default_value = 1.0
    nt.links.new(mp.outputs['Vector'], nz.inputs['Vector'])
    # tapering mask: |x-0.5| relative to a width that shrinks with height
    cx = nt.nodes.new('ShaderNodeMath'); cx.operation = 'SUBTRACT'; cx.inputs[1].default_value = 0.5; nt.links.new(sep.outputs['X'], cx.inputs[0])
    ax = nt.nodes.new('ShaderNodeMath'); ax.operation = 'ABSOLUTE'; nt.links.new(cx.outputs[0], ax.inputs[0])
    wd = nt.nodes.new('ShaderNodeMath'); wd.operation = 'MULTIPLY_ADD'; wd.inputs[1].default_value = -0.38; wd.inputs[2].default_value = 0.46; nt.links.new(sep.outputs['Y'], wd.inputs[0])
    nzc = nt.nodes.new('ShaderNodeMath'); nzc.operation = 'MULTIPLY_ADD'; nzc.inputs[1].default_value = 0.35; nzc.inputs[2].default_value = 0.0; nt.links.new(nz.outputs['Fac'], nzc.inputs[0])
    wn = nt.nodes.new('ShaderNodeMath'); wn.operation = 'ADD'; nt.links.new(wd.outputs[0], wn.inputs[0]); nt.links.new(nzc.outputs[0], wn.inputs[1])
    ratio = nt.nodes.new('ShaderNodeMath'); ratio.operation = 'DIVIDE'; nt.links.new(ax.outputs[0], ratio.inputs[0]); nt.links.new(wn.outputs[0], ratio.inputs[1])
    inv = nt.nodes.new('ShaderNodeMath'); inv.operation = 'SUBTRACT'; inv.inputs[0].default_value = 1.0; nt.links.new(ratio.outputs[0], inv.inputs[1]); inv.use_clamp = True
    # height falloff + noise carve
    hf = nt.nodes.new('ShaderNodeMath'); hf.operation = 'SUBTRACT'; hf.inputs[0].default_value = 1.0; nt.links.new(sep.outputs['Y'], hf.inputs[1]); hf.use_clamp = True
    hp = nt.nodes.new('ShaderNodeMath'); hp.operation = 'POWER'; hp.inputs[1].default_value = 0.8; nt.links.new(hf.outputs[0], hp.inputs[0])
    nz2 = nt.nodes.new('ShaderNodeMath'); nz2.operation = 'MULTIPLY'; nt.links.new(inv.outputs[0], nz2.inputs[0]); nt.links.new(hp.outputs[0], nz2.inputs[1])
    cm = nt.nodes.new('ShaderNodeMath'); cm.operation = 'SUBTRACT'; nt.links.new(nz2.outputs[0], cm.inputs[0]); nt.links.new(nz.outputs['Fac'], cm.inputs[1]); cm.inputs[1].default_value = 0.0
    nm = nt.nodes.new('ShaderNodeMath'); nm.operation = 'MULTIPLY'; nm.inputs[1].default_value = 0.35; nt.links.new(nz.outputs['Fac'], nm.inputs[0])
    cm2 = nt.nodes.new('ShaderNodeMath'); cm2.operation = 'SUBTRACT'; nt.links.new(nz2.outputs[0], cm2.inputs[0]); nt.links.new(nm.outputs[0], cm2.inputs[1]); cm2.use_clamp = True
    sm = nt.nodes.new('ShaderNodeMath'); sm.operation = 'SMOOTH_MIN' if False else 'MULTIPLY'; sm.inputs[1].default_value = 2.2; sm.use_clamp = True; nt.links.new(cm2.outputs[0], sm.inputs[0])
    ramp = nt.nodes.new('ShaderNodeValToRGB'); ramp.color_ramp.elements[0].position = 0.05; ramp.color_ramp.elements[0].color = (0.25, 0.01, 0.0, 1)
    e = ramp.color_ramp.elements.new(0.45); e.color = (1.0, 0.25, 0.02, 1); e = ramp.color_ramp.elements.new(0.75); e.color = (1.0, 0.7, 0.15, 1); ramp.color_ramp.elements[-1].position = 1.0; ramp.color_ramp.elements[-1].color = (1.0, 0.95, 0.7, 1)
    nt.links.new(sm.outputs[0], ramp.inputs['Fac'])
    em = nt.nodes.new('ShaderNodeEmission'); em.inputs['Strength'].default_value = intensity; nt.links.new(ramp.outputs['Color'], em.inputs['Color'])
    tr = nt.nodes.new('ShaderNodeBsdfTransparent'); mix = nt.nodes.new('ShaderNodeMixShader'); nt.links.new(sm.outputs[0], mix.inputs['Fac']); nt.links.new(tr.outputs[0], mix.inputs[1]); nt.links.new(em.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs['Surface'])
    try: m.surface_render_method = 'BLENDED'
    except Exception: pass
    return m


def flame_card(name, loc, w, h, mat, cam, seed=0):
    bpy.ops.mesh.primitive_plane_add(size=1, location=loc); o = bpy.context.active_object; o.name = name; o.scale = (w, h, 1)
    # pivot at the base: shift the mesh up by half so scaling/tracking happens from the bottom edge
    bm = bmesh.new(); bm.from_mesh(o.data)
    for v in bm.verts: v.co.y += 0.5
    bm.to_mesh(o.data); bm.free()
    # plane lies in XY; stand it up: rotate so its local Y is world Z
    o.data.transform(Matrix.Rotation(math.pi / 2, 4, 'X'))
    o.data.materials.append(mat); o.visible_shadow = False
    c = o.constraints.new('TRACK_TO'); c.target = cam; c.track_axis = 'TRACK_NEGATIVE_Y'; c.up_axis = 'UP_Z'
    c.use_target_z = False
    return o


# ---------------------------------------------------------------------------------------------------------------- shots 1-2
HELI_SPEED = 24.0     # m/s along +X
HELI_X0 = -1050.0     # far out at sea west of the island


def heli_pose(heli, f, x, y, z, yaw=90.0, roll=0.0, pitch=0.0):
    heli.location = (x, y, z); heli.rotation_euler = (math.radians(pitch), math.radians(roll), math.radians(yaw)); heli.keyframe_insert('location', frame=f); heli.keyframe_insert('rotation_euler', frame=f)


def build_shots_1_2(ocean_coll, sv):
    c = new_coll('Shots12')
    root, body, rotor, tail = build_heli_asset(c)
    rb = blur_disc(rotor, 4.9, 0.12, 0.42); tb = blur_disc(tail, 0.46, 0.0, 0.3, 'TailBlur'); tb.rotation_euler = (0, math.pi / 2, 0); move_to(rb, c); move_to(tb, c)
    spin_rotor(rotor, 1, 240, rps=4.2); spin_rotor(tail, 1, 240, rps=11.0, axis=0, sign=1)
    # flight: passes in front of the camera in shot 1, then the camera falls in behind for shot 2
    for f in range(1, 241, 4):
        t = (f - 1) / FPS; x = HELI_X0 + HELI_SPEED * t
        bob = 0.35 * math.sin(t * 1.3); z = 10.5 + bob; y = 0.0
        roll = 2.5 * math.sin(t * 0.9) + (7 if f > 190 else 0) * min(1, (f - 190) / 40.0)       # starts to wobble as the engine fails
        pitch = -2.0 + 1.2 * math.sin(t * 1.7) + (-6 * min(1, max(0, (f - 200) / 40.0)))
        heli_pose(root, f, x, y, z, 90.0 + (-5 * min(1, max(0, (f - 200) / 40.0))), roll, pitch)
    ease_all(root)
    # camera 1: low tripod pan, tracks the aircraft
    cam1 = make_camera('Cam1', 34, 1, 120, focus_obj=body, fstop=3.2); cam1.location = (HELI_X0 + 74.0, -42.0, 2.0)
    for f in range(1, 121, 4):
        t = (f - 1) / FPS; x = HELI_X0 + HELI_SPEED * t; cam1.location = (HELI_X0 + 74.0 + t * 0.35, -42.0 + t * 0.3, 2.0 + t * 0.1); aim(cam1, (x + 2, 0, 10.8)); cam1.keyframe_insert('location', frame=f); cam1.keyframe_insert('rotation_euler', frame=f)
    ease_all(cam1); handheld(cam1, 1, 120, 0.04, 0.0009, 2)
    # camera 2: behind and above, island silhouette ahead
    cam2 = make_camera('Cam2', 40, 121, 240, focus_obj=body, fstop=2.8); cam2.location = (0, 0, 0)
    for f in range(121, 241, 4):
        t = (f - 1) / FPS; x = HELI_X0 + HELI_SPEED * t; sway = 0.6 * math.sin(t * 0.6)
        cam2.location = (x - 26 - (f - 121) * 0.03, -9 + sway, 15.0 + 0.5 * math.sin(t * 0.8)); aim(cam2, (x + 12, 0, 10.2)); cam2.keyframe_insert('location', frame=f); cam2.keyframe_insert('rotation_euler', frame=f)
    ease_all(cam2); handheld(cam2, 121, 240, 0.05, 0.0012, 4)
    # engine smoke trail from the exhaust (starts shot 2)
    sm = smoke_material('SmokeBlack', (0.09, 0.08, 0.08), 1.0)
    n = 0
    for f in range(128, 236, 2):
        t = (f - 1) / FPS; x = HELI_X0 + HELI_SPEED * t; k = min(1.0, (f - 128) / 60.0)
        puff('Puff%d' % n, (x - 2.2, 0.0, 10.9), 0.3, 1.6 + 3.8 * k, f, f + 80, sm, rise=2.0 + 3 * k, drift=(-6.0, 0.7 * math.sin(n)), peak=0.2 + 0.28 * k, seed=n); n += 1
    for o in [o for o in bpy.data.objects if o.name.startswith('Puff')]: move_to(o, c)
    keyframe_visibility(c, 1, 240)
    return root, body, rotor, tail, cam1, cam2



# ---------------------------------------------------------------------------------------------------------------- painted equirect sky (numpy)
def _fbm(w, h, seed, octaves=6, base=(4, 2), persistence=0.55, wrap_x=True):
    import numpy as np
    rng = np.random.default_rng(seed); out = np.zeros((h, w), dtype=np.float32); amp = 1.0; tot = 0.0
    for o in range(octaves):
        gx, gy = base[0] * 2 ** o, base[1] * 2 ** o
        g = rng.random((gy + 1, gx + 1)).astype(np.float32)
        if wrap_x: g[:, -1] = g[:, 0]
        xs = np.linspace(0, gx, w, endpoint=False); ys = np.linspace(0, gy, h, endpoint=False)
        x0 = xs.astype(int); y0 = ys.astype(int); fx = (xs - x0)[None, :]; fy = (ys - y0)[:, None]
        fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy)
        a = g[y0][:, x0]; b = g[y0][:, x0 + 1]; c = g[y0 + 1][:, x0]; d = g[y0 + 1][:, x0 + 1]
        out += amp * (a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy); tot += amp; amp *= persistence
    return out / tot


def make_sky_image(name, sun_az, sun_el, stops, glow=(1.0, 0.5, 0.18), glow_power=30.0, glow_strength=1.0, haze=(1.0, 0.55, 0.25), disc_strength=250.0, disc_size=0.012,
                   cloud_cover=0.5, cloud_dark=(0.22, 0.12, 0.2), cloud_lit=(1.0, 0.6, 0.3), cloud_seed=3, stars=0.0, w=2048, h=1024, exposure=1.0):
    """equirectangular sky painted with numpy: elevation gradient, sun glow + disc, stretched clouds that catch the light, optional stars.  Direction convention matches Blender's world: u = -atan2(y,x)/2pi + .5"""
    import numpy as np
    u = (np.arange(w) + 0.5) / w; v = (np.arange(h) + 0.5) / h
    phi = (u - 0.5) * 2 * np.pi; th = (v - 0.5) * np.pi
    X = np.cos(th)[:, None] * np.cos(phi)[None, :]; Y = -np.cos(th)[:, None] * np.sin(phi)[None, :]; Z = np.sin(th)[:, None] * np.ones((1, w))      # Cycles: u = -atan2(y, x)/2pi + .5, centre of the image = +X
    Z = np.broadcast_to(Z, (h, w)).astype(np.float32); X = X.astype(np.float32); Y = Y.astype(np.float32)
    zs = np.array([s[0] for s in stops], dtype=np.float32); cols = np.array([s[1] for s in stops], dtype=np.float32)
    zc = np.clip(Z, zs[0], zs[-1]); img = np.stack([np.interp(zc, zs, cols[:, i]) for i in range(3)], axis=-1).astype(np.float32)
    below = (Z < 0)[..., None]; img = np.where(below, img * np.array([0.5, 0.45, 0.45], dtype=np.float32), img)
    az = math.radians(sun_az); el = math.radians(sun_el); sd = np.array([-math.sin(az) * math.cos(el), math.cos(az) * math.cos(el), math.sin(el)], dtype=np.float32)
    dot = np.clip(X * sd[0] + Y * sd[1] + Z * sd[2], 0, 1)
    img += (dot ** glow_power * glow_strength)[..., None] * np.array(glow, dtype=np.float32)
    img += (dot ** (glow_power * 0.12) * 0.35)[..., None] * np.array(haze, dtype=np.float32) * np.exp(-np.abs(Z) * 6.0)[..., None]
    # clouds: project onto a plane so they stretch toward the horizon
    cz = np.maximum(Z, 0.04); px = X / cz; py = Y / cz
    n = _fbm(w, h, cloud_seed, 7, (3, 3))
    n2 = _fbm(w, h, cloud_seed + 9, 5, (6, 6))
    base = _fbm(512, 256, cloud_seed + 2, 6, (2, 2)); 
    import numpy as np2
    cl = np.clip((n * 0.7 + n2 * 0.3 - (1 - cloud_cover)) * 7.0, 0, 1)
    cl *= np.clip((Z - 0.012) * 12, 0, 1) * np.clip(1.4 - Z * 1.1, 0, 1)
    lit = np.clip(dot ** 30 * 3.0, 0, 1)[..., None]
    ccol = np.array(cloud_dark, dtype=np.float32) * (1 - lit) + np.array(cloud_lit, dtype=np.float32) * lit * (0.6 + 0.8 * (1 - n2)[..., None])
    img = img * (1 - cl[..., None]) + ccol * cl[..., None]
    # sun disc
    disc = np.clip((dot - math.cos(disc_size)) / (1 - math.cos(disc_size)), 0, 1) ** 0.6
    img += disc[..., None] * np.array([1.0, 0.92, 0.75], dtype=np.float32) * disc_strength * (1 - 0.7 * cl[..., None])
    if stars > 0:
        rng = np.random.default_rng(5); st = (rng.random((h, w)) > 1 - stars * 0.002).astype(np.float32) * rng.random((h, w)).astype(np.float32) ** 3
        img += (st * np.clip(Z * 4, 0, 1) * (1 - cl))[..., None] * 3.0
    img *= exposure
    rgba = np.concatenate([img, np.ones((h, w, 1), dtype=np.float32)], axis=-1)    # Blender image row 0 is the bottom = nadir, same order as v here
    tmp = bpy.data.images.new(name + '_gen', w, h, alpha=False, float_buffer=True); tmp.colorspace_settings.name = 'Linear Rec.709'; tmp.pixels.foreach_set(rgba.ravel())
    os.makedirs(V_SKY, exist_ok=True); path = os.path.join(V_SKY, name + '.exr')
    tmp.filepath_raw = path; tmp.file_format = 'OPEN_EXR'; tmp.save(); bpy.data.images.remove(tmp)
    im = bpy.data.images.load(path, check_existing=False); im.name = name; im.colorspace_settings.name = 'Linear Rec.709'
    return im


def world_from_images(imgs, strength=1.0):
    """world with one env texture per image, blended by keyframeable factors (fac[i] selects image i); returns (world, mix_nodes, background)"""
    w = bpy.data.worlds.new('FilmSky'); bpy.context.scene.world = w; w.use_nodes = True; nt = w.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputWorld'); bg = nt.nodes.new('ShaderNodeBackground'); bg.inputs['Strength'].default_value = strength
    tex = []
    for im in imgs:
        t = nt.nodes.new('ShaderNodeTexEnvironment'); t.image = im; tex.append(t)
    cur = tex[0].outputs['Color']; mixes = []
    for t in tex[1:]:
        m = nt.nodes.new('ShaderNodeMix'); m.data_type = 'RGBA'; m.inputs['Factor'].default_value = 0.0
        nt.links.new(cur, m.inputs['A']); nt.links.new(t.outputs['Color'], m.inputs['B']); cur = m.outputs['Result']; mixes.append(m)
    nt.links.new(cur, bg.inputs['Color']); nt.links.new(bg.outputs['Background'], out.inputs['Surface'])
    return w, mixes, bg


# ---------------------------------------------------------------------------------------------------------------- skies for the whole film
def build_skies():
    sunset = make_sky_image('SkySunset', -9.0, 5.0, [(-1.0, (0.06, 0.03, 0.04)), (0.0, (1.0, 0.45, 0.10)), (0.03, (0.95, 0.30, 0.06)), (0.12, (0.62, 0.15, 0.14)), (0.28, (0.28, 0.10, 0.30)), (0.5, (0.07, 0.09, 0.30)), (1.0, (0.015, 0.03, 0.15))],
                            haze=(1.0, 0.45, 0.18), cloud_cover=0.5, exposure=0.9, glow_strength=0.9, glow_power=34, disc_strength=60, disc_size=0.014, cloud_dark=(0.20, 0.07, 0.16), cloud_lit=(1.0, 0.50, 0.16))
    dusk = make_sky_image('SkyDusk', -9.0, -4.0, [(-1.0, (0.02, 0.012, 0.03)), (0.0, (0.50, 0.14, 0.08)), (0.04, (0.36, 0.08, 0.14)), (0.14, (0.17, 0.07, 0.26)), (0.35, (0.05, 0.06, 0.22)), (0.7, (0.015, 0.025, 0.11)), (1.0, (0.008, 0.015, 0.06))],
                          haze=(0.8, 0.3, 0.12), cloud_cover=0.45, exposure=0.8, glow_strength=0.4, glow_power=26, disc_strength=0, cloud_dark=(0.06, 0.03, 0.10), cloud_lit=(0.45, 0.14, 0.18), cloud_seed=7)
    night = make_sky_image('SkyNight', -9.0, -20.0, [(-1.0, (0.003, 0.005, 0.01)), (0.0, (0.02, 0.03, 0.065)), (0.2, (0.012, 0.02, 0.05)), (0.6, (0.005, 0.01, 0.03)), (1.0, (0.002, 0.005, 0.02))],
                           haze=(0.1, 0.1, 0.2), cloud_cover=0.35, exposure=1.0, glow_strength=0.0, disc_strength=0, cloud_dark=(0.01, 0.015, 0.03), cloud_lit=(0.03, 0.04, 0.07), stars=1.0, cloud_seed=11)
    return sunset, dusk, night


def key_const(obj_or_socket, frame, value, data_path=None, index=-1):
    pass


def key_world_phases(mixes, bg):
    """sunset (f1-330) -> dusk (331-480) -> night (481-720): constant steps at the cuts, plus per-phase world strength"""
    for m in mixes:
        sock = m.inputs['Factor']
    def setk(sock, f, v):
        sock.default_value = v; sock.keyframe_insert('default_value', frame=f)
    setk(mixes[0].inputs['Factor'], 1, 0.0); setk(mixes[0].inputs['Factor'], 330, 0.0); setk(mixes[0].inputs['Factor'], 331, 1.0); setk(mixes[0].inputs['Factor'], 720, 1.0)
    setk(mixes[1].inputs['Factor'], 1, 0.0); setk(mixes[1].inputs['Factor'], 480, 0.0); setk(mixes[1].inputs['Factor'], 481, 1.0); setk(mixes[1].inputs['Factor'], 720, 1.0)
    set_interp(mixes[0].id_data, 'CONSTANT')


# ---------------------------------------------------------------------------------------------------------------- jungle + shot 3 (the fall)
def build_jungle(radius=150.0, tree_density=0.028, fern_density=0.35, fern_radius=60.0):
    """island terrain with scatter limited to `radius` around the crash clearing (everything beyond is fog/darkness so it costs nothing)"""
    c = new_coll('Jungle')
    isl = make_island(); move_to(isl, c)
    colls, mats = make_variants()
    holders = [scatter(isl, colls['tree'], 'trees', tree_density, 3.2, 0.8, 17, radius, (0.85, 1.35), 1),
               scatter(isl, colls['palm'], 'palms', tree_density * 0.22, 2.0, 0.82, 12, radius, (0.8, 1.25), 2),
               scatter(isl, colls['fern'], 'ferns', fern_density, 2.5, 0.75, 5, fern_radius, (0.5, 1.0), 3)]
    for h in holders: move_to(h, c)
    return c, isl, holders


def lerp(a, b, t): return a + (b - a) * t


def smoothstep(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a))); return t * t * (3 - 2 * t)


CRASH_POINT = Vector((-4.0, -3.0, 3.6))


def build_shot3(ocean=None):
    """the fall: chase camera above the canopy; the helicopter slides down the sky in a flat spin-out and ploughs into the clearing"""
    c = new_coll('Shot3')
    root, body, rotor, tail = build_heli_asset(c)
    move_to(blur_disc(rotor, 4.9, 0.12, 0.45), c); spin_rotor(rotor, 241, 330, rps=3.0)
    f0, f1 = 241, 330
    start = Vector((-230.0, -170.0, 82.0)); P = []
    cxy = Vector((CRASH_POINT.x, CRASH_POINT.y, 0.0))
    for f in range(f0, f1 + 1):
        t = (f - f0) / (f1 - f0)
        q = t ** 1.25
        p = start.lerp(cxy, q); p.x += 8 * math.sin(t * 5.0) * (1 - t) ** 2; p.y += 6 * math.sin(t * 4.0 + 1.0) * (1 - t) ** 2
        d = math.hypot(p.x - cxy.x, p.y - cxy.y)
        ground = max(island_height(p.x, p.y), 3.0)
        if d > 60: p.z = ground + 34.0
        elif d > 17: p.z = lerp(ground + 28.0, ground + 34.0, (d - 17.0) / 43.0)
        else: p.z = 3.6 + (31.0 - 3.6) * (d / 17.0) ** 1.7        # inside the clearing: the plunge
        P.append(p)
    prev = None
    for i, f in enumerate(range(f0, f1 + 1)):
        t = (f - f0) / (f1 - f0); p = P[i]; q = P[min(i + 1, len(P) - 1)] if i < len(P) - 1 else p + (p - P[i - 1])
        d = (q - p); d.z = 0; d = d.normalized() if d.length > 1e-4 else Vector((1, 0, 0))
        yaw = math.degrees(math.atan2(d.y, d.x)) + 360.0 * t * t * 1.15 * 0.0 + 70 * math.sin(t * 6.0) * t
        pitch = -6 - 34 * smoothstep(0.55, 1.0, t); roll = 22 * math.sin(t * 7.0) + 40 * smoothstep(0.6, 1.0, t)
        heli_pose(root, f, p.x, p.y, p.z, yaw, roll, pitch)
    unwrap_rotation(root); set_interp(root, 'LINEAR')
    cam = make_camera('Cam3', 30, f0, f1, focus_obj=body, fstop=3.2); cam.location = (0, 0, 0)
    cp = None
    for i, f in enumerate(range(f0, f1 + 1)):
        t = (f - f0) / (f1 - f0); p = P[i]; q = P[min(i + 1, len(P) - 1)]
        d = (q - p); d.z = 0; d = d.normalized() if d.length > 1e-4 else Vector((1, 0, 0)); side = Vector((-d.y, d.x, 0))
        want = p - d * lerp(22.0, 12.0, t) + side * lerp(7.0, -2.5, t) + Vector((0, 0, lerp(9.0, 6.0, t)))
        want.z = max(want.z, max(island_height(want.x, want.y), 3.0) + 30.0)
        want.z = max(want.z, max(island_height(want.x, want.y), 3.0) + 30.0)      # chase camera stays above the treetops
        cp = want if cp is None else cp.lerp(want, 0.18)
        cam.location = cp; aim(cam, p + Vector((0, 0, 0.8))); cam.keyframe_insert('location', frame=f); cam.keyframe_insert('rotation_euler', frame=f)
    set_interp(cam, 'LINEAR'); handheld(cam, f0, f1, 0.08, 0.002, 7)
    sm = smoke_material('SmokeFall', (0.07, 0.065, 0.065), 1.0)
    n = 0
    for i in range(0, len(P), 1):
        f = f0 + i; k = i / (len(P) - 1)
        puff('FallPuff%d' % n, tuple(P[i] + Vector((0, 0, 0.9))), 0.5, 2.6 + 6.5 * k, f, f + 70, sm, rise=3 + 8 * k, drift=(-2, 2 * math.sin(n)), peak=0.22 + 0.3 * k, seed=n + 40); n += 1
    for o in [o for o in bpy.data.objects if o.name.startswith('FallPuff')]: move_to(o, c)
    ld = bpy.data.lights.new('FireGlow', 'POINT'); ld.energy = 9000; ld.color = (1.0, 0.45, 0.12); ld.shadow_soft_size = 0.8
    lo = bpy.data.objects.new('FireGlow', ld); bpy.context.scene.collection.objects.link(lo); lo.parent = root; lo.location = (0, 1.9, 2.5); move_to(lo, c)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.3, location=(0, 1.95, 2.35)); fl = bpy.context.active_object; fl.name = 'EngineFire'; fl.parent = root; fl.scale = (1.0, 2.6, 1.0)
    fm = bpy.data.materials.new('EngineFireM'); fm.use_nodes = True; fb = fm.node_tree.nodes['Principled BSDF']; fb.inputs['Base Color'].default_value = (1, 0.3, 0.05, 1); fb.inputs['Emission Color'].default_value = (1, 0.38, 0.06, 1); fb.inputs['Emission Strength'].default_value = 30.0
    fl.data.materials.append(fm); move_to(fl, c)
    # impact: flash + fireball in the last frames
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1.0, location=tuple(CRASH_POINT + Vector((0, 0, 1.5)))); ib = bpy.context.active_object; ib.name = 'ImpactBall'
    im = bpy.data.materials.new('ImpactM'); im.use_nodes = True; ibb = im.node_tree.nodes['Principled BSDF']; ibb.inputs['Base Color'].default_value = (1, 0.5, 0.1, 1); ibb.inputs['Emission Color'].default_value = (1, 0.55, 0.12, 1); ibb.inputs['Emission Strength'].default_value = 40.0
    ib.data.materials.append(im); ib.visible_shadow = False
    for f, sc in ((f1 - 5, 0.01), (f1 - 1, 4.0), (f1, 9.0)): ib.scale = (sc, sc, sc); ib.keyframe_insert('scale', frame=f)
    move_to(ib, c)
    keyframe_visibility(c, f0, f1)
    return root, body, cam, c


# ---------------------------------------------------------------------------------------------------------------- shots 4-6: the crash site, night, jaguar, title
GROUND_Z = 3.0      # the clearing is flat at this height (island_height)
SITE_F0, SITE_F1 = 331, 720


def append_blend(path, types=('MESH', 'ARMATURE', 'EMPTY')):
    with bpy.data.libraries.load(path, link=False) as (src, dst):
        dst.objects = list(src.objects)
    out = []
    for o in dst.objects:
        if o is None: continue
        if o.type not in types: bpy.data.objects.remove(o, do_unlink=True); continue
        bpy.context.scene.collection.objects.link(o); out.append(o)
    return out


def top_level(objs): return [o for o in objs if o.parent is None or o.parent not in objs]


def place_group(objs, loc, rot_z_deg=0.0, scale=1.0, name='Group'):
    e = bpy.data.objects.new(name, None); bpy.context.scene.collection.objects.link(e)
    for o in top_level(objs): o.parent = e
    e.location = loc; e.rotation_euler = (0, 0, math.radians(rot_z_deg)); e.scale = (scale,) * 3
    return e


def flicker(light, base, amp=0.35, speed=2.0, f0=1, f1=720):
    light.data.energy = base; light.data.keyframe_insert('energy', frame=f0); light.data.keyframe_insert('energy', frame=f1)
    for fc in fcurves_of(light.data):
        if fc.data_path == 'energy':
            m = fc.modifiers.new('NOISE'); m.scale = max(2.0, 24.0 / speed); m.strength = base * amp * 2; m.depth = 2; m.phase = random.random() * 50
            m2 = fc.modifiers.new('NOISE'); m2.scale = 3.0; m2.strength = base * amp * 0.8; m2.phase = random.random() * 50


def fire(name, loc, size, cam, f0, f1, coll, seed=0, light_energy=12000, smoke=True):
    """a flame cluster: camera-facing flame cards + a flickering light + embers + (optionally) a smoke column"""
    rnd = random.Random(seed); out = []
    fm = flame_material(name + 'M', 16.0, 3.0 + rnd.random(), 3.0 + rnd.random() * 2)
    for i in range(4):
        ox, oy = rnd.uniform(-1, 1) * size * 0.35, rnd.uniform(-1, 1) * size * 0.35
        c = flame_card('%sCard%d' % (name, i), (loc[0] + ox, loc[1] + oy, loc[2]), size * rnd.uniform(0.7, 1.05), size * rnd.uniform(1.2, 1.8), fm, cam, seed + i); out.append(c)
    ld = bpy.data.lights.new(name + 'Light', 'POINT'); ld.color = (1.0, 0.5, 0.16); ld.shadow_soft_size = size * 0.4
    lo = bpy.data.objects.new(name + 'Light', ld); bpy.context.scene.collection.objects.link(lo); lo.location = (loc[0], loc[1], loc[2] + size * 0.7); out.append(lo)
    flicker(lo, light_energy, 0.3, 2.0, f0, f1)
    # embers: small glowing sparks drifting up and away, re-launched in cycles
    em = bpy.data.materials.new(name + 'Ember'); em.use_nodes = True; eb = em.node_tree.nodes['Principled BSDF']; eb.inputs['Base Color'].default_value = (1, 0.4, 0.05, 1); eb.inputs['Emission Color'].default_value = (1, 0.45, 0.08, 1); eb.inputs['Emission Strength'].default_value = 25.0
    for k in range(34):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.025 * size, location=loc); e = bpy.context.active_object; e.name = '%sEmber%d' % (name, k); e.data.materials.append(em); e.visible_shadow = False
        t0 = f0 + rnd.randint(0, 60); life = rnd.randint(36, 80); wind = Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), 0)) * size * 0.8
        ph = t0
        while ph < f1:
            start = Vector(loc) + Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), 0.2)) * size * 0.3
            end = start + wind + Vector((0, 0, rnd.uniform(3, 7) * size * 0.6))
            e.location = start; e.keyframe_insert('location', frame=ph); e.scale = (0.01, 0.01, 0.01); e.keyframe_insert('scale', frame=ph)
            e.scale = (1, 1, 1); e.keyframe_insert('scale', frame=ph + 3)
            e.location = end; e.keyframe_insert('location', frame=ph + life); e.scale = (0.01, 0.01, 0.01); e.keyframe_insert('scale', frame=ph + life)
            ph += life + rnd.randint(2, 20)
        set_interp(e, 'LINEAR'); out.append(e)
    if smoke:
        sm = smoke_material(name + 'Smoke', (0.06, 0.05, 0.045), 1.0)
        n = 0
        for f in range(f0, f1, 4):
            p = puff('%sPuff%d' % (name, n), (loc[0] + rnd.uniform(-1, 1) * size * 0.2, loc[1] + rnd.uniform(-1, 1) * size * 0.2, loc[2] + size * 1.5), size * 0.35, size * 1.9, f, f + 120, sm, rise=size * 8, drift=(size * 3.0, size * 3.6), peak=0.2, seed=seed * 7 + n); out.append(p); n += 1
    for o in out: move_to(o, coll)
    return out


def build_site(cam4, cam5, cam6):
    c = new_coll('Site')
    # wreck (vertex-colour shading carries the soot) -------------------------------------------------------------------
    objs = append_blend(BL + "helicopter_wreck_v4.blend"); pbr_from_tints(objs)
    wreck = place_group(objs, (0, 0, GROUND_Z), 0, 1.0, 'WreckRoot')
    for o in objs + [wreck]: move_to(o, c)
    body_empty = [o for o in objs if o.name == 'WreckBody'][0]
    # survivor, standing at the edge of the firelight, back to camera ----------------------------------------------------
    sv = append_blend(BL + "survivor_mpfb_v2.blend")
    for o in sv:
        if o.type == 'MESH' and o.name.startswith(('Human.high', 'Cam')): o.hide_render = True; o.hide_viewport = True
    surv = place_group(sv, (-5.8, -7.2, GROUND_Z), 139.0, 1.0, 'SurvivorRoot')
    for o in sv + [surv]: move_to(o, c)
    # jaguar, crouched in the ferns across the fire ---------------------------------------------------------------------
    jg = append_blend(BL + "jaguar_v2.blend")
    jag = place_group(jg, (7.5, 9.0, GROUND_Z), -40.0, 1.15, 'JaguarRoot')      # the animal models face local -Y (three.js +Z): turned to look at the fire
    for o in jg + [jag]: move_to(o, c)
    return c, wreck, surv, jag, body_empty


# ---------------------------------------------------------------------------------------------------------------- cameras + title for shots 4-6
def unit(v): v = Vector(v); return v.normalized()


def key_cam(cam, f, loc, target, lens=None):
    cam.location = loc; aim(cam, target); cam.keyframe_insert('location', frame=f); cam.keyframe_insert('rotation_euler', frame=f)
    if lens is not None: cam.data.lens = lens; cam.data.keyframe_insert('lens', frame=f)


def emission_material(name, color, strength, image=None, alpha=1.0):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear(); out = nt.nodes.new('ShaderNodeOutputMaterial')
    em = nt.nodes.new('ShaderNodeEmission'); em.inputs['Strength'].default_value = strength; tr = nt.nodes.new('ShaderNodeBsdfTransparent'); mix = nt.nodes.new('ShaderNodeMixShader')
    if image is not None:
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = image; t.extension = 'CLIP'
        tc = nt.nodes.new('ShaderNodeTexCoord'); nt.links.new(tc.outputs['UV'], t.inputs['Vector'])
        nt.links.new(t.outputs['Color'], em.inputs['Color'])
        mul = nt.nodes.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'; mul.inputs[1].default_value = alpha; nt.links.new(t.outputs['Alpha'], mul.inputs[0])
        nt.links.new(mul.outputs[0], mix.inputs['Fac'])
    else:
        em.inputs['Color'].default_value = (*color, 1); mix.inputs['Fac'].default_value = alpha
    nt.links.new(tr.outputs[0], mix.inputs[1]); nt.links.new(em.outputs[0], mix.inputs[2]); nt.links.new(mix.outputs[0], out.inputs['Surface'])
    try: m.surface_render_method = 'BLENDED'
    except Exception: pass
    return m, mix


def title_card(cam, f_in, f_out, coll, logo_path):
    """logo plane + tagline parented to the camera (no depth of field), fading in over [f_in, f_in + 30]"""
    img = bpy.data.images.load(logo_path); img.alpha_mode = 'STRAIGHT'
    objs = []
    dm = bpy.data.materials.new('TitleDim'); dm.use_nodes = True; nt = dm.node_tree; nt.nodes.clear(); o_ = nt.nodes.new('ShaderNodeOutputMaterial'); tr = nt.nodes.new('ShaderNodeBsdfTransparent'); bk = nt.nodes.new('ShaderNodeBsdfDiffuse'); bk.inputs['Color'].default_value = (0, 0, 0, 1); mxx = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(tr.outputs[0], mxx.inputs[1]); nt.links.new(bk.outputs[0], mxx.inputs[2]); nt.links.new(mxx.outputs[0], o_.inputs['Surface'])
    try: dm.surface_render_method = 'BLENDED'
    except Exception: pass
    mxx.inputs['Fac'].default_value = 0.0; mxx.inputs['Fac'].keyframe_insert('default_value', frame=f_in - 6); mxx.inputs['Fac'].default_value = 0.78; mxx.inputs['Fac'].keyframe_insert('default_value', frame=f_in + 30)
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, 0)); dp = bpy.context.active_object; dp.name = 'TitleDimPlane'; dp.data.materials.append(dm); dp.parent = cam; dp.location = (0, 0, -4.0); dp.scale = (12, 7, 1); dp.visible_shadow = False; objs.append(dp)
    lm, lmix = emission_material('LogoM', None, 3.0, img)
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, 0)); lg = bpy.context.active_object; lg.name = 'Logo'; lg.data.materials.append(lm); lg.parent = cam; lg.location = (0, 0.45, -5.0); lg.scale = (2.7, 2.7, 2.7); lg.visible_shadow = False; objs.append(lg)
    def text(body, size, y, z=-5.0, color=(1.0, 0.82, 0.38), strength=4.0, name='Text', align='CENTER'):
        cu = bpy.data.curves.new(name, 'FONT'); cu.body = body; cu.size = size; cu.align_x = align; cu.align_y = 'CENTER'; cu.extrude = 0.0
        o = bpy.data.objects.new(name, cu); bpy.context.scene.collection.objects.link(o); o.parent = cam; o.location = (0, y, z); o.visible_shadow = False
        tm, tmix = emission_material(name + 'M', color, strength); o.data.materials.append(tm); objs.append(o); return o, tmix
    t1, m1 = text('FIND WATER.  BUILD FIRE.  SURVIVE THE NIGHT.', 0.15, -1.1, color=(1.0, 0.84, 0.42), strength=3.5, name='Tag')
    t2, m2 = text('A BROWSER SURVIVAL GAME  ·  THREE.JS + BLENDER', 0.11, -2.2, color=(0.82, 0.88, 0.92), strength=1.6, name='Sub')
    for mx, a, b in ((lmix, f_in, f_in + 30), (m1, f_in + 18, f_in + 48), (m2, f_in + 34, f_in + 64)):
        pass
    # fades: animate the mix 'Fac' of the text materials; the logo image alpha factor sits in a math node, so key the emission strength instead
    for (m, f0_, f1_) in ((m1, f_in + 18, f_in + 48), (m2, f_in + 34, f_in + 64)):
        m.inputs['Fac'].default_value = 0.0; m.inputs['Fac'].keyframe_insert('default_value', frame=f0_ - 1)
        m.inputs['Fac'].default_value = 1.0; m.inputs['Fac'].keyframe_insert('default_value', frame=f1_)
    em = [n for n in lm.node_tree.nodes if n.bl_idname == 'ShaderNodeEmission'][0]
    am = [n for n in lm.node_tree.nodes if n.bl_idname == 'ShaderNodeMath'][0]            # image alpha * keyed fade
    for sock, v0, v1 in ((em.inputs['Strength'], 0.0, 3.0), (am.inputs[1], 0.0, 1.0)):
        sock.default_value = v0; sock.keyframe_insert('default_value', frame=f_in - 1)
        sock.default_value = v1; sock.keyframe_insert('default_value', frame=f_in + 36)
    for o in objs: move_to(o, coll)
    return objs


def key_light(light_obj, frames_values, prop='energy', color=None):
    for f, v in frames_values:
        light_obj.data.energy = v; light_obj.data.keyframe_insert('energy', frame=f)
    set_interp(light_obj.data, 'CONSTANT')


def build_film(final=False, keep_tail=True):
    """assemble the whole film in the open scene; returns a dict of the main objects"""
    import time
    t0 = time.time()
    clear_scene(); w, h = (1920, 1080) if final else (960, 540)
    setup_render(w, h, 64 if final else 16); s = bpy.context.scene; s.eevee.use_raytracing = False
    vs = s.view_settings; vs.view_transform = 'Khronos PBR Neutral'; vs.exposure = -0.2; vs.look = 'None'
    for im in list(bpy.data.images):
        if im.name.startswith('Sky'): bpy.data.images.remove(im)
    imgs = build_skies(); world, mixes, bg = world_from_images(list(imgs), 1.0); key_world_phases(mixes, bg)
    sv = sun_vec(-9.0, 5.0)
    sun = add_sun_lamp(sv, 3.2, (1.0, 0.62, 0.3), 0.7)
    sun.rotation_euler = (-sv).to_track_quat('-Z', 'Y').to_euler()
    key_light(sun, [(1, 3.2), (330, 3.2), (331, 0.35), (480, 0.35), (481, 0.0), (720, 0.0)])
    fill = add_fill((0.25, 0.8, -0.5), 1.0, (0.6, 0.72, 1.0))
    key_light(fill, [(1, 1.0), (330, 1.0), (331, 0.5), (480, 0.5), (481, 0.5), (600, 0.5), (601, 0.25), (720, 0.25)])
    oc = make_ocean(rep=14, size=160, res=13); set_interp(oc, 'LINEAR', ['modifiers'])
    for n in ('Ocean', 'FarSea'): bpy.data.objects[n].visible_shadow = False
    jc, isl, hold = build_jungle(170.0, 0.012, 0.12, 30.0)
    root12, body12, rotor12, tail12, cam1, cam2 = build_shots_1_2(None, sv)
    root3, body3, cam3, c3 = build_shot3()
    cam4 = make_camera('Cam4', 28, 331, 480, fstop=2.2); cam5 = make_camera('Cam5', 30, 481, 540, fstop=2.4); cam5b = make_camera('Cam5b', 85, 541, 600, fstop=2.0); cam6 = make_camera('Cam6', 30, 601, 720, fstop=2.8)
    cam6.data.dof.use_dof = False
    site, wreck, surv, jag, body_e = build_site(cam4, cam5, cam6)
    cam4.data.dof.focus_object = body_e; cam5.data.dof.focus_object = jag; cam5b.data.dof.focus_object = jag
    G = GROUND_Z; W = Vector((0, 0, G + 1.6))
    # shot 4: low dolly in the ferns behind the survivor, wreck burning ahead
    for f in range(331, 481, 3):
        t = (f - 331) / 149.0; e = t * t * (3 - 2 * t)
        d = unit((-5.8, -7.2, 0)); back = lerp(6.0, 2.9, e); off = Vector((-d.y, d.x, 0)) * lerp(0.9, 1.1, e)
        loc = Vector((-5.8, -7.2, G + lerp(1.2, 1.65, e))) + d * back + off
        key_cam(cam4, f, loc, W + Vector((0, 0, lerp(0.2, 0.8, e))))
    set_interp(cam4, 'BEZIER'); handheld(cam4, 331, 480, 0.03, 0.0014, 11)
    # shot 5a: low, between the fire and the treeline, jaguar eyes catching the light; 5b: close-up
    J = Vector((7.5, 9.0, G))
    for f in range(481, 541, 3):
        t = (f - 481) / 59.0; key_cam(cam5, f, Vector((3.4 + t * 0.7, 1.6 + t * 0.9, G + 1.25)), J + Vector((0, 0, 0.6 + 0.1 * t)))
    handheld(cam5, 481, 540, 0.02, 0.001, 12)
    for f in range(541, 601, 3):
        t = (f - 541) / 59.0; key_cam(cam5b, f, J + Vector((-2.6 + t * 0.5, -3.3 + t * 0.6, 0.55 - 0.05 * t)), J + Vector((-0.1, -0.15, 0.78)))
    handheld(cam5b, 541, 600, 0.01, 0.0006, 13)
    # shot 6: slow pull-back and rise, title over the burning wreck
    for f in range(601, 721, 4):
        t = (f - 601) / 119.0; e = t * t * (3 - 2 * t)
        key_cam(cam6, f, Vector((lerp(-6.5, -17.0, e), lerp(-8.5, -22.0, e), G + lerp(1.7, 5.5, e))), W + Vector((0, 0, lerp(0.4, 2.4, e))))
    handheld(cam6, 601, 720, 0.02, 0.001, 14)
    fires = []
    fires += fire('WF', (0.3, 0.1, G + 1.0), 2.4, cam4, SITE_F0, SITE_F1, site, 1, 6500)
    fires += fire('WB', (2.6, 5.4, G + 0.3), 1.6, cam4, SITE_F0, SITE_F1, site, 2, 7000, smoke=False)
    title_card(cam6, 650, 720, site, '/Users/talaljawaid/Documents/Talal\'s Folder/Claude/Experiment 2026/Experiment 3/AI Game/src/assets/logo.png')
    keyframe_visibility(site, SITE_F0, SITE_F1)
    # flame cards must face whichever camera is live: retarget their constraints per shot with a driver-free trick (one Track-To per camera, influence keyed)
    cams = [(cam4, 331, 480), (cam5, 481, 540), (cam5b, 541, 600), (cam6, 601, 720)]
    for o in site.objects:
        if 'Card' in o.name and o.constraints:
            base = o.constraints[0]; base.target = cam4
            for cm, a, b in cams[1:]:
                c2 = o.constraints.new('TRACK_TO'); c2.target = cm; c2.track_axis = base.track_axis; c2.up_axis = base.up_axis; c2.use_target_z = False
            for i, (cm, a, b) in enumerate(cams):
                for j, cc in enumerate(o.constraints):
                    cc.influence = 1.0 if i == j else 0.0; cc.keyframe_insert('influence', frame=a)
            set_interp(o, 'CONSTANT', ['constraints'])
    setup_compositor(glare=0.55, glare_threshold=2.5, vignette=0.55)
    add_fades(0, 720)
    s.frame_start, s.frame_end = 1, 720
    print('film built in', round(time.time() - t0, 1), 's')
    return dict(scene=s, cams=[cam1, cam2, cam3, cam4, cam5, cam5b, cam6], jag=jag, surv=surv, wreck=wreck, sun=sun)


def add_fades(f0, f1):
    """fade from black over the first 12 frames and to black over the last 18, in the compositor (a final Mix multiply with a keyed grey)"""
    s = bpy.context.scene; ng = s.compositing_node_group; N = ng.nodes; L = ng.links
    out = [n for n in N if n.bl_idname == 'NodeGroupOutput'][0]; src = [l.from_socket for l in L if l.to_node == out][0]
    mx = N.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'; mx.inputs['Factor'].default_value = 1.0
    L.new(src, mx.inputs['A']); L.new(mx.outputs['Result'], out.inputs['Image'])
    sock = mx.inputs['B']
    for f, v in ((1, 0.0), (13, 1.0), (702, 1.0), (720, 0.0)):
        sock.default_value = (v, v, v, 1.0); sock.keyframe_insert('default_value', frame=f)
