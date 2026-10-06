# Builds the survivor base in Blender using MPFB2 (CC0 assets). Run inside Blender via the MCP execute_blender_code.
import bpy, os, mathutils
from bl_ext.user_default.mpfb.services.humanservice import HumanService
R = "/Users/talaljawaid/Library/Application Support/Blender/5.2/extensions/.user/user_default/mpfb/data/"

def build(macro=None, hair="short02", eyebrows="eyebrow003", eyelashes="eyelashes02", clothes=("male_casualsuit06", "shoes04"), skin="young_caucasian_male"):
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    ph = {"gender": 1.0, "age": 0.56, "muscle": 0.58, "weight": 0.45, "proportions": 0.6, "height": 0.5, "cupsize": 0.5, "firmness": 0.5,
          "race": {"african": 0.05, "asian": 0.1, "caucasian": 0.85}}
    if macro: ph.update(macro)
    info = {"phenotype": ph, "skin_mhmat": R + f"skins/{skin}/{skin}.mhmat", "skin_material_type": "ENHANCED_SSS", "skin_material_settings": {},
            "eyes": "", "eyes_material_type": "MAKESKIN", "eyes_material_settings": {}, "eyebrows": "", "eyelashes": "", "hair": "", "teeth": "", "tongue": "",
            "clothes": [], "rig": "", "proxy": "", "targets": [], "expressions": [], "makeup": [], "color_adjustments": {}}
    s = HumanService.get_default_deserialization_settings()
    s.update(mask_helpers=True, detailed_helpers=True, extra_vertex_groups=True, subdiv_levels=1)
    bm = HumanService.deserialize_from_dict(info, s)
    parts = [("Eyes", "eyes/high-poly/high-poly.mhclo", "PROCEDURAL_EYES"), ("Eyebrows", f"eyebrows/{eyebrows}/{eyebrows}.mhclo", "MAKESKIN"),
             ("Eyelashes", f"eyelashes/{eyelashes}/{eyelashes}.mhclo", "MAKESKIN"), ("Hair", f"hair/{hair}/{hair}.mhclo", "MAKESKIN"),
             ("Teeth", "teeth/teeth_base/teeth_base.mhclo", "MAKESKIN")] + [("Clothes", f"clothes/{c}/{c}.mhclo", "MAKESKIN") for c in clothes]
    rig = HumanService.add_builtin_rig(bm, 'game_engine')
    for kind, fp, mat in parts:
        HumanService.add_mhclo_asset(R + fp, bm, asset_type=kind, material_type=mat)
    for name in [o.name for o in bpy.data.objects if o.type == 'MESH' and o.name != bm.name]:
        o = bpy.data.objects[name]
        if any(k in name for k in ('eyebrow', 'eyelash', 'short', 'bob', 'braid', 'long', 'pony', 'afro')):
            for m in o.data.materials:
                nt = m.node_tree
                b = [n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'][0]; t = [n for n in nt.nodes if n.type == 'TEX_IMAGE'][0]
                nt.links.new(t.outputs['Alpha'], b.inputs['Alpha']); m.use_backface_culling = False
    return bm, rig
