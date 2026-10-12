import bpy, sys, os, math
B = "/Users/talaljawaid/Documents/Talal's Folder/Claude/Experiment 2026/Experiment 3/AI Game/assets/blender/"
P = "/Users/talaljawaid/Documents/Talal's Folder/Claude/Experiment 2026/Experiment 3/AI Game/public/models/jaguar.glb"
exec(open(B + "build_deer.py").read(), globals()); exec(open(B + "build_jaguar.py").read(), globals()); exec(open(B + "studio.py").read(), globals())
export = '--export' in sys.argv
rig = build_jaguar_all(export_path=P if export else None)
if export: print('EXPORTED', os.path.getsize(P) / 1e6)
if '--preview' in sys.argv:
    studio(); w = bpy.context.scene.world or bpy.data.worlds.new('W'); bpy.context.scene.world = w; w.color = (0.45, 0.47, 0.5)
    bpy.context.scene.render.engine = 'BLENDER_EEVEE'
    shot('jag_f1', (-0.5, -1.7, 0.95), (0, -0.9, 0.78), 900, 700, 50)
    shot('jag_f2', (1.5, -1.5, 0.9), (0, -0.9, 0.72), 900, 700, 45)
    shot('jag_f3', (2.6, -1.6, 1.0), (0, -0.1, 0.55), 1000, 700, 55)
    print('PREVIEW_DONE')
if export: bpy.ops.wm.save_as_mainfile(filepath=B + "jaguar_v6.blend")
