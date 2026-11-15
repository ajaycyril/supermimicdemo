# Validation, 15 November 2026

## Passed

- Six math tests: feature layout, heading invariance, body-frame quaternion integration, semi-implicit integration order, quaternion sign equivalence, deterministic command noise.
- Export from the exact 223,470,223-byte released checkpoint, checked against the SHA-256 pinned in this project's exporter.
- Three ONNX Runtime WASM output comparisons against independent scalar evaluation of the original float32 layer weights. Maximum absolute difference: **0.0000052452**. This is not a claim of running the original PyTorch training code.
- MuJoCo WASM 3.16: expected state dimensions 36 / 35 and 29 position actuators; finite simulated states.
- Six four-second desktop Chrome experiments, each 200 transitions plus its initial frame, with real MuJoCo and ONNX inference. All completed without an early stop or non-finite state.
- All browser results match the independent Node/WASM verification runs to displayed precision. Summaries: `article/results.json` and `docs/validation-results.json`.
- Six GIFs created by the actual demo’s export code; matching full run records are in `article/runs/*.json.gz`.
- Playback timing bug found during browser testing and corrected by clamping the first replay frame index to zero.

## Scope

No trained policy is run, no model is trained, and no physical robot is tested. Scripted movement can fall. The neural checkpoint is a community reproduction. The comparison uses native MuJoCo WASM, whereas its training used MuJoCo Warp. Results measure this specific experiment, not a general benchmark of SuperMimic.

## Publishing

Repository: `ajaycyril/supermimicdemo`. The first GitHub Actions build and Pages deployment succeeded on 15 November 2026. The published site loaded both engines and completed the four-second comparison in Chrome. The article and demo were checked at desktop and 390-pixel mobile widths. A mobile review caught a slider-label update selecting the label instead of its output; the selector was corrected to preserve each control's name.
