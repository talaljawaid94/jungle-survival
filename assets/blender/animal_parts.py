import bpy, bmesh, math
from mathutils import Vector

def tapered_tube(name, pts, radii, segs=10, subdiv_each=6, color_fn=None, rough=0.0):
    """Smooth tapered tube through points (Catmull-Rom), optional per-vertex colour fn(t) -> rgb (perceptual)."""
    P = [Vector(p) for p in pts]
    def cr(p0, p1, p2, p3, t):
        return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3)
    path = []; rad = []
    ext = [P[0] * 2 - P[1]] + P + [P[-1] * 2 - P[-2]]
    for i in range(len(P) - 1):
        for k in range(subdiv_each):
            t = k / subdiv_each; path.append(cr(ext[i], ext[i + 1], ext[i + 2], ext[i + 3], t)); rad.append(radii[i] + (radii[i + 1] - radii[i]) * t)
    path.append(P[-1]); rad.append(radii[-1])
    bm = bmesh.new(); rings = []; ts = []
    for i, (c, r) in enumerate(zip(path, rad)):
        tan = (path[min(i + 1, len(path) - 1)] - path[max(i - 1, 0)]).normalized()
        ref = Vector((0, 0, 1)) if abs(tan.z) < 0.9 else Vector((1, 0, 0)); u = tan.cross(ref).normalized(); v = tan.cross(u).normalized()
        ring = []
        for a in range(segs):
            rr = r * (1 + rough * (math.sin(i * 1.9 + a * 2.3) * 0.5 + math.sin(i * 0.7 - a * 1.1) * 0.5)) if rough else r
            ring.append(bm.verts.new(c + (u * math.cos(a * math.tau / segs) + v * math.sin(a * math.tau / segs)) * rr))
        rings.append(ring); ts.append(i / (len(path) - 1))
    for i in range(len(rings) - 1):
        for k in range(segs): bm.faces.new((rings[i][k], rings[i][(k + 1) % segs], rings[i + 1][(k + 1) % segs], rings[i + 1][k]))
    cap = bm.verts.new(path[-1] + (path[-1] - path[-2]).normalized() * rad[-1] * 0.6)
    for k in range(segs): bm.faces.new((rings[-1][k], rings[-1][(k + 1) % segs], cap))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    nrings = len(rings); me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    for p in me.polygons: p.use_smooth = True
    if color_fn:
        col = me.color_attributes.new('Col', 'BYTE_COLOR', 'POINT'); n_r = len(rings)
        for i in range(n_r):
            c = color_fn(ts[i])
            for k in range(segs): col.data[i * segs + k].color = (c[0] ** 2.2, c[1] ** 2.2, c[2] ** 2.2, 1)
        c = color_fn(1.0); col.data[len(me.vertices) - 1].color = (c[0] ** 2.2, c[1] ** 2.2, c[2] ** 2.2, 1)
    return ob

def eyeball(name, center, radius, facing, iris=(0.30, 0.17, 0.06), pupil_scale=1.0, rim=(0.03, 0.02, 0.015), sclera=(0.10, 0.07, 0.05)):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=radius, segments=32, ring_count=20, location=center); o = bpy.context.active_object; o.name = name
    f = Vector(facing).normalized(); me = o.data; col = me.color_attributes.new('Col', 'BYTE_COLOR', 'POINT')
    for p in me.polygons: p.use_smooth = True
    for i, v in enumerate(me.vertices):
        d = v.normal.dot(f)
        if d > 0.90: c = (0.005, 0.004, 0.004)                                   # pupil
        elif d > 0.74: t = (d - 0.74) / 0.16; c = tuple(iris[k] * (0.55 + 0.6 * (1 - t)) for k in range(3))   # iris
        elif d > 0.70: c = rim
        else: c = sclera
        col.data[i].color = (c[0] ** 2.2, c[1] ** 2.2, c[2] ** 2.2, 1)
    return o
