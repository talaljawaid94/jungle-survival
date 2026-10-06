import bpy
A = "/Users/talaljawaid/Documents/Talal's Folder/Claude/Experiment 2026/Experiment 3/AI Game/assets/blender/"
for f in ('build_hero_base.py', 'survivor_materials.py', 'studio.py', 'build_props.py'): exec(open(A + f).read())
exec(open(A + 'export_hero.py').read())
def build_all(export_path=None):
    bm, rig = build(); apply_survivor_look(); fix_eyes(); build_props(rig, simple_mat); studio()
    bpy.ops.wm.save_as_mainfile(filepath=A + 'survivor_mpfb_v2.blend', copy=True)
    if export_path: return export_hero(export_path)
