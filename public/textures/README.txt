Optional albedo / env maps (app uses solid colors + generated sky if missing).

To enable a file in production:
1. Drop it in this folder (e.g. wall_plaster.jpg)
2. Add the filename to SHIPPED_OPTIONAL_TEXTURES in
   src/roofPreview/babylon/materials.ts

Shipped today: site-aerial-plan.jpg (used via /assets path for ground if linked)

Catalog (optional):
wall_plaster.jpg roof_membrane.jpg roof_tile.jpg concrete.jpg grass.jpg bark.jpg leaves.jpg env.env panel_cell.jpg
