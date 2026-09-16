# Furniture models

The following models are by Poly Haven contributors and distributed under
[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
See [Poly Haven's asset license](https://polyhaven.com/license).

| Local file | Original |
| --- | --- |
| sofa-three.glb | [Sofa 03](https://polyhaven.com/a/sofa_03) |
| armchair.glb | [Modern Arm Chair 01](https://polyhaven.com/a/modern_arm_chair_01) |
| coffee-table.glb | [Coffee Table Round 01](https://polyhaven.com/a/coffee_table_round_01) |
| side-table.glb | [Side Table 01](https://polyhaven.com/a/side_table_01) |
| dining-table.glb | [Dining Table](https://polyhaven.com/a/dining_table) |
| dining-chair.glb | [Dining Chair 02](https://polyhaven.com/a/dining_chair_02) |

Regenerate with `node scripts/get-furniture-models.mjs` from the repository root.
The download manifest pins source URLs and checksums. The script embeds the 1K
textures in GLB, orients seating toward local -Z, turns the dining table's long
axis along Z, omits the tablecloth, and names editable materials `body`.
No runtime connection to Poly Haven is required. Geometry, UVs and normals are
preserved. Existing catalog dimensions, footprints and 2D symbols are unchanged.

The pre-existing `bathtub.glb` comes from the
[Kenney Furniture Kit](https://kenney.nl/assets/furniture-kit), also CC0,
and is rebuilt separately with `node scripts/get-models.mjs`.
The pre-existing `wardrobe.glb` is not changed by this import.
