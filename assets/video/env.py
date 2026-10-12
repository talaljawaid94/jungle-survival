"""Jungle Survival launch film: environment (sky, ocean, island, jungle).  Units are metres, +Z up, island centred on the crash clearing at the origin."""
import bpy, bmesh, math, random
from mathutils import Vector, Matrix, noise as mn

RND = random.Random(11)


def clear_scene():
    for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.curves, bpy.data.images, bpy.data.worlds, bpy.data.node_groups, bpy.data.cameras, bpy.data.lights, bpy.data.collections):
        for b in list(coll):
            try: coll.remove(b)
            except Exception: pass


def setup_render(w=1920, h=1080, samples=64):
    s = bpy.context.scene; s.render.engine = 'BLENDER_EEVEE'; s.render.resolution_x = w; s.render.resolution_y = h; s.render.resolution_percentage = 100
    s.render.fps = 24; s.frame_start = 1; s.frame_end = 720
    e = s.eevee
    e.taa_render_samples = samples; e.use_raytracing = True; e.use_shadows = True
    try: e.ray_tracing_method = 'SCREEN'; e.ray_tracing_options.resolution_scale = '2'
    except Exception: pass
    try: e.use_volumetric_shadows = True; e.volumetric_tile_size = '2'; e.volumetric_samples = 64; e.volumetric_start = 0.5; e.volumetric_end = 1200
    except Exception: pass
    try: e.shadow_ray_count = 2; e.shadow_step_count = 8; e.fast_gi_method = 'AMBIENT_OCCLUSION_ONLY'
    except Exception: pass
    s.render.use_motion_blur = True
    try: s.render.motion_blur_shutter = 0.5
    except Exception: pass
    s.view_settings.view_transform = 'AgX'; s.view_settings.look = 'AgX - Medium High Contrast'
    try: s.eevee.use_gtao = True
    except Exception: pass


def make_sky(sun_elev=7.0, sun_rot=215.0, strength=1.0, air=1.2, dust=1.8):
    w = bpy.data.worlds.new('Sky'); bpy.context.scene.world = w; w.use_nodes = True; nt = w.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputWorld'); bg = nt.nodes.new('ShaderNodeBackground'); sky = nt.nodes.new('ShaderNodeTexSky')
    sky.sky_type = 'MULTIPLE_SCATTERING'; sky.sun_elevation = math.radians(sun_elev); sky.sun_rotation = math.radians(sun_rot); sky.air_density = air; sky.aerosol_density = dust; sky.ozone_density = 1.0; sky.sun_size = math.radians(0.6); sky.sun_intensity = 1.0
    bg.inputs['Strength'].default_value = strength
    nt.links.new(sky.outputs['Color'], bg.inputs['Color']); nt.links.new(bg.outputs['Background'], out.inputs['Surface'])
    return w, sky, bg


def add_fog(density=0.0035, anis=0.35, color=(0.75, 0.82, 0.9)):
    w = bpy.context.scene.world; nt = w.node_tree; out = [n for n in nt.nodes if n.type == 'OUTPUT_WORLD'][0]
    v = nt.nodes.new('ShaderNodeVolumeScatter'); v.inputs['Density'].default_value = density; v.inputs['Anisotropy'].default_value = anis; v.inputs['Color'].default_value = (*color, 1)
    nt.links.new(v.outputs['Volume'], out.inputs['Volume']); return v


def principled(name, color, rough=0.5, metal=0.0, **kw):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    for k, v in kw.items():
        if k in b.inputs: b.inputs[k].default_value = v
    return m


# ------------------------------------------------------------------------------------------------ ocean
def water_material():
    m = bpy.data.materials.new('Water'); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); b = nt.nodes.new('ShaderNodeBsdfPrincipled')
    b.inputs['Roughness'].default_value = 0.1; b.inputs['IOR'].default_value = 1.33
    geo = nt.nodes.new('ShaderNodeNewGeometry'); sub = nt.nodes.new('ShaderNodeVectorMath'); sub.operation = 'MULTIPLY'; sub.inputs[1].default_value = (1, 1, 0)
    vm = nt.nodes.new('ShaderNodeVectorMath'); vm.operation = 'LENGTH'; nt.links.new(geo.outputs['Position'], sub.inputs[0]); nt.links.new(sub.outputs[0], vm.inputs[0])
    mapr = nt.nodes.new('ShaderNodeMapRange'); mapr.inputs['From Min'].default_value = 250; mapr.inputs['From Max'].default_value = 1100; mapr.clamp = True
    nt.links.new(vm.outputs['Value'], mapr.inputs['Value'])
    ramp = nt.nodes.new('ShaderNodeValToRGB'); ramp.color_ramp.interpolation = 'EASE'
    ramp.color_ramp.elements[0].position = 0.0; ramp.color_ramp.elements[0].color = (0.05, 0.38, 0.34, 1)
    e1 = ramp.color_ramp.elements.new(0.15); e1.color = (0.008, 0.1, 0.14, 1)
    ramp.color_ramp.elements[-1].position = 0.7; ramp.color_ramp.elements[-1].color = (0.002, 0.014, 0.03, 1)
    nt.links.new(mapr.outputs['Result'], ramp.inputs['Fac']); nt.links.new(ramp.outputs['Color'], b.inputs['Base Color'])
    nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 0.9; nz.inputs['Detail'].default_value = 7
    nt.links.new(geo.outputs['Position'], nz.inputs['Vector'])
    bump = nt.nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.18; bump.inputs['Distance'].default_value = 0.5
    nt.links.new(nz.outputs['Fac'], bump.inputs['Height']); nt.links.new(bump.outputs['Normal'], b.inputs['Normal'])
    nt.links.new(b.outputs['BSDF'], out.inputs['Surface']); return m


def make_ocean(rep=6, size=160, res=13):
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, 0)); o = bpy.context.active_object; o.name = 'Ocean'
    md = o.modifiers.new('Ocean', 'OCEAN'); md.geometry_mode = 'GENERATE'; md.repeat_x = rep; md.repeat_y = rep; md.resolution = res; md.spatial_size = size
    md.wave_scale = 1.4; md.choppiness = 0.9; md.wind_velocity = 6.0; md.use_foam = True; md.foam_coverage = 0.3; md.random_seed = 4
    md.time = 0.0; md.keyframe_insert('time', frame=1); md.time = 30.0; md.keyframe_insert('time', frame=720)
    o.location = (-size * rep / 2, -size * rep / 2, 0)
    wm = water_material(); o.data.materials.append(wm)
    bpy.ops.mesh.primitive_plane_add(size=40000, location=(0, 0, -0.4)); f = bpy.context.active_object; f.name = 'FarSea'; f.data.materials.append(wm)
    return o


# ------------------------------------------------------------------------------------------------ island terrain
def island_height(x, y):
    r = math.hypot(x, y); ang = math.atan2(y, x)
    shore = 255 + 38 * mn.noise(Vector((math.cos(ang) * 1.3, math.sin(ang) * 1.3, 3))) + 18 * mn.noise(Vector((math.cos(ang) * 4, math.sin(ang) * 4, 9)))
    t = max(0.0, min(1.0, (shore - r) / 120.0)); t = t * t * (3 - 2 * t)
    hills = 26 * (0.5 + 0.5 * mn.noise(Vector((x * 0.006, y * 0.006, 1)))) + 9 * mn.noise(Vector((x * 0.02, y * 0.02, 2))) + 2.2 * mn.noise(Vector((x * 0.08, y * 0.08, 5)))
    mx, my = -150, 120; peak = 150 * math.exp(-((x - mx) ** 2 + (y - my) ** 2) / (2 * 70 ** 2)) * (0.8 + 0.2 * mn.noise(Vector((x * 0.03, y * 0.03, 8))))
    h = t * (4 + hills) + peak * t - 6.0 * (1 - t)
    c = 1.0 - max(0.0, min(1.0, (r - 34.0) / 50.0)); c = c * c * (3 - 2 * c); h = h * (1 - c) + 3.0 * c        # flat plateau (z = 3) around the crash site, blending into the hills by r = 84
    return h


def make_island(extent=700.0, n=300):
    bm = bmesh.new(); step = extent / n; verts = {}
    for i in range(n + 1):
        for j in range(n + 1):
            x = (i / n - 0.5) * extent; y = (j / n - 0.5) * extent; verts[i, j] = bm.verts.new((x, y, island_height(x, y)))
    for i in range(n):
        for j in range(n): bm.faces.new((verts[i, j], verts[i + 1, j], verts[i + 1, j + 1], verts[i, j + 1]))
    me = bpy.data.meshes.new('Island'); bm.to_mesh(me); bm.free(); o = bpy.data.objects.new('Island', me); bpy.context.scene.collection.objects.link(o)
    for p in me.polygons: p.use_smooth = True
    # material: sand -> grass -> dark jungle floor -> rock on steep, driven by world height and slope
    m = bpy.data.materials.new('Terrain'); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); b = nt.nodes.new('ShaderNodeBsdfPrincipled'); b.inputs['Roughness'].default_value = 0.95
    geo = nt.nodes.new('ShaderNodeNewGeometry'); sep = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(geo.outputs['Position'], sep.inputs['Vector'])
    ramp = nt.nodes.new('ShaderNodeValToRGB'); cr = ramp.color_ramp
    cr.elements[0].position = 0.0; cr.elements[0].color = (0.3, 0.26, 0.17, 1)
    e1 = cr.elements.new(0.045); e1.color = (0.5, 0.42, 0.28, 1); e2 = cr.elements.new(0.08); e2.color = (0.03, 0.07, 0.02, 1); e3 = cr.elements.new(0.25); e3.color = (0.02, 0.05, 0.015, 1); cr.elements[-1].color = (0.28, 0.27, 0.24, 1); cr.elements[-1].position = 1.0
    mr = nt.nodes.new('ShaderNodeMapRange'); mr.inputs['From Min'].default_value = -1; mr.inputs['From Max'].default_value = 160; mr.inputs['To Min'].default_value = 0; mr.inputs['To Max'].default_value = 1
    nt.links.new(sep.outputs['Z'], mr.inputs['Value'])
    nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 0.35; nz.inputs['Detail'].default_value = 8
    nt.links.new(geo.outputs['Position'], nz.inputs['Vector'])
    mix = nt.nodes.new('ShaderNodeMath'); mix.operation = 'ADD'; mix.use_clamp = True; mix.inputs[1].default_value = 0.0
    sc = nt.nodes.new('ShaderNodeMath'); sc.operation = 'MULTIPLY_ADD'; sc.inputs[1].default_value = 0.05; sc.inputs[2].default_value = -0.025
    nt.links.new(nz.outputs['Fac'], sc.inputs[0]); nt.links.new(mr.outputs['Result'], mix.inputs[0]); nt.links.new(sc.outputs[0], mix.inputs[1]); nt.links.new(mix.outputs[0], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], b.inputs['Base Color'])
    nt.links.new(b.outputs['BSDF'], out.inputs['Surface']); o.data.materials.append(m)
    return o


def add_sun(elev=6.0, rot=215.0, strength=4.0, color=(1.0, 0.72, 0.45), angle=0.6):
    d = bpy.data.lights.new('Sun', 'SUN'); d.energy = strength; d.color = color; d.angle = math.radians(angle)
    o = bpy.data.objects.new('Sun', d); bpy.context.scene.collection.objects.link(o)
    # same direction as the sky's sun: elevation above horizon, azimuth `rot` (Blender sky: rotation measured from +Y toward -X)
    az = math.radians(rot); el = math.radians(elev); dirv = Vector((-math.sin(az) * math.cos(el), math.cos(az) * math.cos(el), math.sin(el)))   # direction TO the sun
    o.rotation_euler = (-dirv).to_track_quat('-Z', 'Y').to_euler(); return o


def add_mist(size=(1400, 1400, 70), z=18, density=0.02, falloff=0.06, color=(0.85, 0.8, 0.75)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, z)); o = bpy.context.active_object; o.name = 'Mist'; o.scale = size; o.display_type = 'WIRE'
    m = bpy.data.materials.new('Mist'); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear(); out = nt.nodes.new('ShaderNodeOutputMaterial'); v = nt.nodes.new('ShaderNodeVolumeScatter')
    v.inputs['Color'].default_value = (*color, 1); v.inputs['Anisotropy'].default_value = 0.45
    geo = nt.nodes.new('ShaderNodeNewGeometry'); sep = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(geo.outputs['Position'], sep.inputs['Vector'])
    ex = nt.nodes.new('ShaderNodeMath'); ex.operation = 'MULTIPLY'; ex.inputs[1].default_value = -falloff; nt.links.new(sep.outputs['Z'], ex.inputs[0])
    pw = nt.nodes.new('ShaderNodeMath'); pw.operation = 'EXPONENT'; pw.inputs[0].default_value = 2.718; nt.links.new(ex.outputs[0], pw.inputs[1])
    nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 0.012; nz.inputs['Detail'].default_value = 3; nt.links.new(geo.outputs['Position'], nz.inputs['Vector'])
    mu = nt.nodes.new('ShaderNodeMath'); mu.operation = 'MULTIPLY'; nt.links.new(pw.outputs[0], mu.inputs[0]); nt.links.new(nz.outputs['Fac'], mu.inputs[1])
    md = nt.nodes.new('ShaderNodeMath'); md.operation = 'MULTIPLY'; md.inputs[1].default_value = density * 2.2; nt.links.new(mu.outputs[0], md.inputs[0]); nt.links.new(md.outputs[0], v.inputs['Density'])
    nt.links.new(v.outputs['Volume'], out.inputs['Volume']); o.data.materials.append(m); return o
