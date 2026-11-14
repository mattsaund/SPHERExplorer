# Test fixtures

Small byte ranges copied from one public SPHEREx Level 2 file, so the tests run offline.

- Source file: `dr1/level2/2025W19_1B/l2b-v27-2026-197/6/level2_2025W19_1B_0116_1D6_spx_l2b-v27-2026-197.fits` in the AWS bucket `nasa-irsa-spherex`.
- `d6_head.bin`: the primary header and the IMAGE header (first 25,920 bytes).
- `d6_wave.bin`: the WCS-WAVE header and table (last 5,760 bytes).

SPHEREx data are public. Credit: NASA SPHEREx, served by NASA/IPAC IRSA. DOI 10.26131/IRSA678.
