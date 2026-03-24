# Reference images — room `cosol3`

**Current files:** `cosol3_ref1.png`, `cosol3_ref2.png` (wide-angle office views of cosol3).

Add more **JPEG/PNG/WebP** photos of the same room if you want stronger similarity matching. The background validation service compares each captured attendance image (after masking the central face region) against these references using histogram + ORB similarity.

**Tips**

- Use 3–6 clear photos of the same room (chairs, tables, monitors visible).
- Match lighting and angle roughly to what students will capture from their webcam.
- Filenames are ignored; all `*.jpg`, `*.jpeg`, `*.png`, `*.webp` in this folder are loaded.

If this folder is empty, similarity score stays **0** (attendance still works; only the similarity bonus is not applied).
