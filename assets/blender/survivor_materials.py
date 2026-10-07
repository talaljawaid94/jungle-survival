import bpy, os
TEX = "/Users/talaljawaid/Documents/Talal's Folder/Claude/Experiment 2026/Experiment 3/AI Game/assets/blender/tex/"
MP = "/Users/talaljawaid/Library/Application Support/Blender/5.2/extensions/.user/user_default/mpfb/data/"

def simple_mat(name, base_path, rough=0.7, normal_path=None, normal_strength=1.0, sss=0.0, tint=None, alpha=False, spec=0.4, sheen=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); b = nt.nodes.new('ShaderNodeBsdfPrincipled'); nt.links.new(b.outputs['BSDF'], out.inputs['Surface'])
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(base_path, check_existing=True); t.image.colorspace_settings.name = 'sRGB'
    src = t.outputs['Color']
    if tint:
        mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'; mix.inputs['Factor'].default_value = 1.0
        nt.links.new(src, mix.inputs['A']); mix.inputs['B'].default_value = tint; src = mix.outputs['Result']
    nt.links.new(src, b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = rough; b.inputs['Specular IOR Level'].default_value = spec
    if sss:
        b.inputs['Subsurface Weight'].default_value = sss; b.inputs['Subsurface Radius'].default_value = (0.9, 0.35, 0.2); b.inputs['Subsurface Scale'].default_value = 0.02
    if sheen: b.inputs['Sheen Weight'].default_value = sheen; b.inputs['Sheen Roughness'].default_value = 0.5
    if normal_path and os.path.exists(normal_path):
        n = nt.nodes.new('ShaderNodeTexImage'); n.image = bpy.data.images.load(normal_path, check_existing=True); n.image.colorspace_settings.name = 'Non-Color'
        nm = nt.nodes.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = normal_strength
        nt.links.new(n.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], b.inputs['Normal'])
    if alpha:
        nt.links.new(t.outputs['Alpha'], b.inputs['Alpha']); m.surface_render_method = 'DITHERED'; m.use_backface_culling = False
    return m

def assign(obj, mat):
    obj.data.materials.clear(); obj.data.materials.append(mat)

def apply_survivor_look():
    O = bpy.data.objects
    assign(O['Human'], simple_mat('SurvSkin', TEX + 'skin_surv.png', 0.55, sss=0.12, spec=0.45))
    for n in list(O.keys()):
        if 'casualsuit06' in n: assign(O[n], simple_mat('SurvSuit', TEX + 'suit_surv.png', 0.9, MP + 'clothes/male_casualsuit06/male_casualsuit06_normal.png', 0.8, spec=0.2, sheen=0.3))
        if 'shoes04' in n: assign(O[n], simple_mat('SurvBoots', TEX + 'boots_surv.png', 0.7, MP + 'clothes/shoes04/shoes04_normal.png', 0.8, spec=0.3))
        if 'short' in n:
            assign(O[n], simple_mat('SurvHair', MP + 'hair/short02/short02_diffuse.png', 0.6, alpha=True, tint=(0.30, 0.22, 0.16, 1), spec=0.15, sheen=0.0))

def fix_eyes(iris_path="/Users/talaljawaid/Documents/Talal's Folder/Claude/Experiment 2026/Experiment 3/AI Game/assets/blender/eye_iris.png"):
    o = [x for x in bpy.data.objects if 'high-poly' in x.name][0]; me = o.data
    if 'EyeFront' not in me.uv_layers:
        uvl = me.uv_layers.new(name='EyeFront')
        for side in (1, -1):
            verts = [v for v in me.vertices if v.co.x * side > 0]
            xs = [v.co.x for v in verts]; zs = [v.co.z for v in verts]
            cx = (min(xs) + max(xs)) / 2; cz = (min(zs) + max(zs)) / 2; R = (max(xs) - min(xs)) / 2; vs = set(v.index for v in verts)
            for p in me.polygons:
                if all(v in vs for v in p.vertices):
                    for li, vi in zip(p.loop_indices, p.vertices):
                        c = me.vertices[vi].co; uvl.data[li].uv = (0.5 + (c.x - cx) / (2 * R), 0.5 + (c.z - cz) / (2 * R))
    m = bpy.data.materials.new('SurvEyes'); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); b = nt.nodes.new('ShaderNodeBsdfPrincipled'); t = nt.nodes.new('ShaderNodeTexImage'); u = nt.nodes.new('ShaderNodeUVMap')
    t.image = bpy.data.images.load(iris_path, check_existing=True); t.extension = 'EXTEND'; u.uv_map = 'EyeFront'
    nt.links.new(u.outputs['UV'], t.inputs['Vector']); nt.links.new(t.outputs['Color'], b.inputs['Base Color']); nt.links.new(b.outputs['BSDF'], out.inputs['Surface'])
    b.inputs['Roughness'].default_value = 0.2; b.inputs['Coat Weight'].default_value = 0.3; b.inputs['Coat Roughness'].default_value = 0.02
    o.data.materials.clear(); o.data.materials.append(m)
