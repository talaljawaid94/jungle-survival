"""Headless render of the Jungle Survival launch film.
   /Applications/Blender.app/Contents/MacOS/Blender -b -P assets/video/render_film.py -- [first_frame last_frame]
   Resumable: frames that already exist on disk are skipped."""
import bpy, sys, os
V = os.path.dirname(os.path.abspath(__file__)) + "/"
exec(open(V + "env.py").read()); exec(open(V + "trees.py").read()); exec(open(V + "film.py").read())
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
D = build_film(final=True)
s = D['scene']
s.render.engine = 'BLENDER_EEVEE'
s.eevee.taa_render_samples = 28
s.render.image_settings.file_format = 'PNG'; s.render.image_settings.color_mode = 'RGB'; s.render.image_settings.color_depth = '8'
os.makedirs(V + "frames", exist_ok=True); s.render.filepath = V + "frames/f_"
s.render.use_overwrite = False; s.render.use_placeholder = True
s.frame_start = int(argv[0]) if len(argv) > 1 else 1; s.frame_end = int(argv[1]) if len(argv) > 1 else 720
s.camera = D['cams'][0]
bpy.ops.wm.save_as_mainfile(filepath=V + "film_final.blend")
bpy.ops.render.render(animation=True)
print("RENDER_DONE")
