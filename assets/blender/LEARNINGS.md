# What Blender Studio's characters teach us (and how we apply it)

Sources: Blender Studio character pages (Snow, Einar, Autumn, Franck), the "Realistic Character Workflow" training chapters,
the Einar layered-sculpting article, Cosmos Laundromat / Charge production logs, 80.lv groom and hair-card articles.

| Studio practice | Where it shows up | What we do in the game |
|---|---|---|
| Topology is locked **before** detail is sculpted; layered sculpt on top of it | Einar, "Retopology & Layering" | Build one clean base mesh per animal, then add detail as separate layers (vertex colour, normal/AO maps, fur) instead of re-modelling |
| Skin/fur colour comes from painted maps and masks (white belly, dark muzzle, mottling) | Einar skin, Gizmo groom (probability masks for hue/white hairs) | Deer coat is painted per vertex from anatomy rules (belly, rump, muzzle, lower legs) + a fur-grain texture |
| Fur is a **groom**, not a texture: guide hairs, clumping, length/density masks | Franck (particle hair), Autumn (hair particles), Gizmo | Real-time stand-in: **fur shells** (10 layers pushed along normals, alpha-tested hair noise, darker roots, slight gravity droop) |
| Every hairy asset has a **proxy/low version** toggle (HAIR_TOGGLE / COAT_TOGGLE) and a resolution knob | Franck, Autumn | Fur LOD: 10 shells within 14 m, 3 shells to 28 m, none beyond |
| Facial detail: eyes, lids, mouth interior, UV'd properly | Franck production log | Next: lids, mouth/tongue, nostrils, lashes on the deer |
| Correctives and layered face/limb controls | Snow, Einar rigs | Next: corrective shape keys on shoulder/haunch bends, ear and jaw bones |
| Anatomy from reference first (proportions of head, torso, limbs) | animal modelling courses | Next pass: deer proportions from reference (shoulder height, neck length, head length) |

Game-ready fur options considered: shells (done), hair cards from curves via geometry nodes (next if shells are too soft), alpha-tested fin cards on the silhouette.
