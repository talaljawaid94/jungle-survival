"""Blender (background) video sequencer: PNG frames + procedural audio -> H.264/AAC MP4.
   Blender -b -P assets/video/mux_film.py -- out.mp4 [last_frame]"""
import bpy, os, sys, glob
V = os.path.dirname(os.path.abspath(__file__)) + "/"
argv = sys.argv[sys.argv.index('--') + 1:]
out = argv[0]; last = int(argv[1]) if len(argv) > 1 else 720
files = sorted(glob.glob(V + "frames/f_*.png"))[:last]
assert files, "no frames"
bpy.ops.wm.read_factory_settings(use_empty=True)
s = bpy.context.scene; s.render.fps = 24; s.render.resolution_x = 1920; s.render.resolution_y = 1080; s.render.resolution_percentage = 100
s.frame_start = 1; s.frame_end = len(files)
se = s.sequence_editor_create()
coll = se.strips if hasattr(se, 'strips') else se.sequences
st = coll.new_image('film', files[0], 1, 1)
for f in files[1:]: st.elements.append(os.path.basename(f))
snd = coll.new_sound('score', V + "film_audio.wav", 2, 1)
s.render.image_settings.media_type = 'VIDEO'; print('formats', [e.identifier for e in s.render.image_settings.bl_rna.properties['file_format'].enum_items])
s.render.image_settings.file_format = 'FFMPEG'
ff = s.render.ffmpeg; ff.format = 'MPEG4'; ff.codec = 'H264'; ff.constant_rate_factor = 'PERC_LOSSLESS' if 'PERC_LOSSLESS' in [e.identifier for e in ff.bl_rna.properties['constant_rate_factor'].enum_items] else 'HIGH'
ff.ffmpeg_preset = 'GOOD'; ff.gopsize = 24; ff.audio_codec = 'AAC'; ff.audio_bitrate = 256; ff.audio_mixrate = 44100; ff.audio_channels = 'STEREO'
try: s.view_settings.view_transform = 'Standard'
except Exception: pass
s.render.filepath = out
bpy.ops.render.render(animation=True)
print("MUX_DONE", out)
