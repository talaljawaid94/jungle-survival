import bpy, os
def export_hero(path, tex_max=1024, skin_max=2048):
    O = bpy.data.objects
    rig = O['Human.rig']
    for pb in rig.pose.bones: pb.rotation_mode = 'XYZ'; pb.rotation_euler = (0, 0, 0); pb.location = (0, 0, 0); pb.scale = (1, 1, 1)
    meshes = [o for o in O if o.type == 'MESH']
    for o in meshes:
        if o.data.shape_keys:
            bpy.context.view_layer.objects.active = o
            try: bpy.ops.object.shape_key_remove(all=True, apply_mix=True)
            except Exception as e: print('shape keys', o.name, e)
        for m in o.modifiers:
            if m.type == 'SUBSURF': m.levels = 0; m.render_levels = 0
    for im in bpy.data.images:
        if im.size[0] > 0 and im.filepath and 'assets/blender/tex' in im.filepath or im.name in ('skin_surv.png',):
            lim = skin_max if im.name == 'skin_surv.png' else tex_max
            if max(im.size) > lim: im.scale(lim, lim)
    for o in O: o.select_set(False)
    for o in meshes + [rig]: o.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=True, export_animations=False, export_skins=True, export_yup=True,
                              export_image_format='JPEG', export_jpeg_quality=88, export_texcoords=True, export_normals=True, export_materials='EXPORT', export_cameras=False, export_lights=False)
    return os.path.getsize(path)
