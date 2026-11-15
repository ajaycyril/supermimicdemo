# SuperMimic vs Physics

A browser experiment by Ajay Cyril: compare a learned robot world model with MuJoCo under the same initial state and motor commands. Change the inputs, inspect prediction drift, and export GIFs plus their evidence.

**Status:** locally implemented and tested, with six recorded experiments and GIFs. GitHub Pages deployment is configured in the included workflow. See `docs/VALIDATION.md` for verification scope.

- Intended demo: https://ajaycyril.github.io/supermimicdemo/
- Article draft: [article/substack-draft.md](article/substack-draft.md)
- [Method and limitations](docs/METHOD.md)
- [Project plan](docs/PLAN.md)

## Run locally

Node 22+ and Python 3.12+. In a normal network-enabled environment:

```sh
npm install --ignore-scripts
python3 scripts/export_model.py --download
npm test
npm run build
npm run serve
```

Open http://127.0.0.1:8765. Load the engines, run a comparison, replay it, then export a GIF and JSON. No API keys, server, CUDA or Three.js are required. Python is used only to prepare the static model and robot files, not by visitors.

## Publish with GitHub Pages

The source is hosted in `ajaycyril/supermimicdemo`. In **Settings → Pages → Build and deployment**, select **GitHub Actions**. The included workflow prepares assets, validates the model, uploads the static `dist/` site and deploys Pages. The article lives at `/article.html`. Commit further changes to `main` to redeploy.

The model is downloaded from a pinned release and verified by SHA-256 during preparation. Large checkpoints, npm packages and generated ONNX files are excluded from source control. The static deployment includes the exported dynamics model.

## What this is

Real MuJoCo 3.16 WASM + a real released community dynamics checkpoint + ONNX Runtime Web. Six experiment presets, seven article GIFs, deterministic command noise, root/joint error plots, replay, GIF export, JSON and CSV. Schematic rendering uses the robot's actual forward kinematics.

It is an independent comparison project, **not an official SuperMimic fork or a reproduction of the paper’s benchmark**. It uses simple scripted commands rather than the released tracking policy. See the method before interpreting a fall or extrapolating a speed result.

## Credits

[SuperMimic authors](https://supermimic.github.io/), [CuboiLeo’s reproduction](https://github.com/CuboiLeo/SuperMimic-Reproduced), [mjlab](https://github.com/mujocolab/mjlab), [MuJoCo](https://github.com/google-deepmind/mujoco), [ONNX Runtime](https://github.com/microsoft/onnxruntime), and [gifenc](https://github.com/mattdesl/gifenc). Third-party notices are retained in `docs/licenses/`.
