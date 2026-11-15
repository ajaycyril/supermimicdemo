# Method and limits

## Exactly what runs

The browser runs MuJoCo **3.16.0**, single-thread WebAssembly, and ONNX Runtime Web **1.31.1**, single-thread WASM. There is one robot in each engine. Canvas2D projects actual MuJoCo forward-kinematics body positions; it is a schematic view, not a physics implementation.

The neural dynamics weights come from [CuboiLeo/SuperMimic-Reproduced, e8-boneseed-100k](https://github.com/CuboiLeo/SuperMimic-Reproduced/releases/tag/e8-boneseed-100k), a community reproduction. Code at release: `ba6105349069bf040f1fdad60873d13138d505a2`. Original checkpoint SHA-256: `0527bab674556f48eaa7d3a27d650d1d14986019fc982d8acecbf6da75bc5ea6`.

[SuperMimic](https://supermimic.github.io/) is the research being explored. This independent demo does not claim to reproduce the official paper’s policy performance or its GPU throughput results.

## State and commands

- State: 36 generalized positions followed by 35 velocities. Root quaternion is wxyz; root angular velocity is body-local.
- Network input: 71 heading-invariant state features, 29 executed normalized actions, and 33 normalized simulation-context values.
- Network output: 70 residuals, integrated with the source model’s scales and 0.02 s timestep.
- Context: selected foot friction, zero encoder bias, zero torso COM offset.
- Action: default joint position + action scale × normalized command. The script moves both shoulder-pitch joints sinusoidally. Optional Gaussian noise is seeded and the exact same samples go to both engines.
- **Zero command is not motors off.** It targets the default joint positions. No trained policy runs in this release.
- Initial velocity is written into both starting states. No force is applied during later steps.

## MuJoCo model

G1 XML and control constants are adapted from [mjlab commit 8bb2bc9](https://github.com/mujocolab/mjlab/tree/8bb2bc9e187797689ec82c78c35019afd2fd0376). Visual meshes are omitted; explicit body masses, inertias, collision shapes, contact exclusions and kinematic tree are retained. Native position actuators reproduce the source stiffness, damping, armature and force limits. Joint-order actions are mapped directly to joint-order actuators.

The simulation uses implicitfast integration, Newton solver, pyramidal contact cones, 0.005 s physics steps, 4 physics steps per command, 10 solver iterations and 20 line-search iterations. Foot collision friction is changed in both the physical model and learned model context. The source training simulator used MuJoCo Warp; native MuJoCo WASM is a separate backend and may differ numerically. The browser test therefore includes possible backend mismatch, not just learned-model error.

## Comparing the two

**Free prediction:** initialize both states identically, then let each evolve independently under the same commands. **One-step:** give the world model the current MuJoCo state before every prediction. **Periodic correction:** do this at a selected interval. Corrections do not update weights or recreate training.

After each 0.02 s transition, compute root-position Euclidean distance in metres, joint-angle RMSE over all 29 joints in degrees, and shortest quaternion orientation angle. Plot root distance against simulated time. Stop on non-finite state or positions outside the 10 m display boundary; preserve and disclose the stopping reason.

GIFs replay computed frames at half speed. Exported JSON contains every full state, action, error, settings, model provenance and timings. CSV contains errors only. Rendering and GIF encoding are excluded from engine timing. The first five transitions are excluded as warmup. These small single-browser timings cannot substantiate or refute the paper’s large-batch GPU speedup.

## Reading a failure

A scripted pose command is not a balance policy. Falling does not establish that SuperMimic’s trained policy fails. Long free rollouts can enter states far from training data. Better prediction on one hand-picked example does not establish general accuracy. MuJoCo is a numerical simulator, not measured physical reality.

## Research links

- [Official SuperMimic project](https://supermimic.github.io/)
- [Official training implementation](https://github.com/HybridRobotics/supermimic)
- [Community reproduction and limitations](https://github.com/CuboiLeo/SuperMimic-Reproduced)
- [MuJoCo WASM](https://github.com/google-deepmind/mujoco/tree/main/wasm)
- [MuJoCo Warp](https://github.com/google-deepmind/mujoco_warp)
- [mjlab](https://github.com/mujocolab/mjlab)
- [ONNX Runtime Web](https://onnxruntime.ai/docs/tutorials/web/)
