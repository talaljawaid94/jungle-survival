import bpy, mathutils
def studio():
    scn = bpy.context.scene
    for o in [o for o in bpy.data.objects if o.type in ('LIGHT', 'CAMERA')]: bpy.data.objects.remove(o, do_unlink=True)
    def light(name, loc, energy, size, color=(1, 1, 1)):
        d = bpy.data.lights.new(name, 'AREA'); d.energy = energy; d.size = size; d.color = color
        ob = bpy.data.objects.new(name, d); scn.collection.objects.link(ob); ob.location = loc
        ob.rotation_euler = (mathutils.Vector((0, 0, 1.1)) - ob.location).to_track_quat('-Z', 'Y').to_euler()
    light('Key', (1.6, -2.8, 2.2), 700, 1.2); light('Fill', (-2.0, -2.4, 1.4), 200, 1.8, (0.8, 0.9, 1.0)); light('Rim', (0.2, 2.0, 2.4), 500, 1.0)
    cam = bpy.data.objects.new('Cam', bpy.data.cameras.new('Cam')); scn.collection.objects.link(cam); scn.camera = cam
    try: scn.render.engine = 'BLENDER_EEVEE'
    except Exception: pass
    return cam
def shot(name, loc, target, w=800, h=1000, lens=85):
    scn = bpy.context.scene; cam = scn.camera
    cam.data.lens = lens; cam.location = loc; cam.rotation_euler = (mathutils.Vector(target) - mathutils.Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    scn.render.resolution_x = w; scn.render.resolution_y = h; scn.render.filepath = f'/tmp/blend_{name}.png'; bpy.ops.render.render(write_still=True)
