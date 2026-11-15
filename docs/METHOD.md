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

New comparisons run at the selected viewing speed, defaulting to one-quarter speed; changing viewing speed does not change the physics timestep. Motion amplitude, frequency, noise, friction and refresh interval can change during a run. Each applied change is stored with its simulation step. Starting velocity, seed and duration are fixed for each run. GIF downloads use the selected viewing speed; JSON retains full state and controls; CSV contains measurements and applied controls.

## Prediction-horizon study

Eight reference MuJoCo trajectories use seeds 1–8, a 0.2-amplitude, 0.5 Hz shoulder script, noise standard deviation 0.05, friction 1.0 and zero initial forward velocity. Each reference is four seconds long. Prediction windows begin every 0.2 seconds from 0 through 3 seconds, giving 16 windows per trajectory and 128 total.

Each window starts from its reference MuJoCo state. The learned model predicts independently for 50 transitions, using the exact saved reference commands. Root-position and joint errors are recorded at 1, 5, 10, 25 and 50 steps (20 ms to 1 second). The model is not refreshed inside the window. Reported percentiles use linear interpolation over sorted observations.

The 56-window higher-root subset selects anchor states with root height above 0.6 m. This is a starting-height filter, not a test of stable standing. Windows overlap and share eight reference trajectories; they are correlated. Falls and ground contacts are included. The figures show the actual measurements in `article/horizon-study.json`; they do not measure policy performance or gradient accuracy.


## Reading a failure

A scripted pose command is not a balance policy. Falling does not establish that SuperMimic’s trained policy fails. Long free rollouts can enter states far from training data. Better prediction on one hand-picked example does not establish general accuracy. MuJoCo is a numerical simulator, not measured physical reality.

## Recorded three-engine study

MuJoCo Warp 3.16.0 with Warp 1.19.0 runs on CPU using the demo's G1 XML, one world, 35 candidate contacts per world and 250 constraint rows. Native MuJoCo WASM also uses this XML. This is a matched demo configuration rather than the checkpoint's full mjlab training environment. CPU execution measures dynamics only. The capture makes no GPU throughput claim.

Four deterministic command seeds (17, 42, 73 and 101) are repeated at foot friction 1.0 and 0.35. Each seed uses 150 commands at 50 Hz, a shoulder amplitude of 0.2, frequency of 0.5 Hz and command noise standard deviation of 0.05. For each seed and friction, native MuJoCo and the learned model initialize from Warp joint/base positions and velocities at steps 0, 25, 50, 75 and 100. Warp continues its recorded trajectory, and native MuJoCo starts without Warp solver warm starts. Warp logged 18 line-search iteration-limit messages and one solver iteration-limit message. There were no reported contact or constraint buffer overflows.

Each of the same 20 windows per friction is measured at all five horizons: 20, 100, 200 and 500 ms, and one second. Statistics are pairwise root-position distances. The range is the minimum and maximum of the four seed medians. Windows from the same trajectory overlap. Friction changes the reference trajectory and its later starting states, so the friction comparison covers the complete scripted protocol.

Reproduce with the standard build and model assets prepared, then run:

```bash
python3 -m pip install mujoco==3.16.0 mujoco-warp==3.16.0 warp-lang==1.19.0 pillow
node tools/warp-study.mjs cpu
python3 tools/render_warp.py
```

The published data include the pairwise measurements for each window, per-seed medians, sampled body positions for the seed 42 example, exact package versions, and checkpoint hash. The static site replays the recorded example. The separate live comparison computes native MuJoCo and learned dynamics in the browser.

## How to attribute a disagreement

Use the reproduction's exact MuJoCo Warp environment and held-out states and actions to measure model error against its teacher. Run native MuJoCo against that same Warp reference separately. Match robot assets, actions, timestep, friction, actuator settings, and solver and integrator options wherever supported. Record remaining configuration differences and stratify the resulting gaps by contact regime and horizon.

A synchronized G1 trace supplies a physical reference for both predictors. Initialize each from measured state, replay actual executed commands with matching timing, and report joint, root and contact errors over repeated held-out trials. A separate policy-update test checks whether a change suggested by the learned gradient actually improves held-out tracking in the teacher simulator. The recorded comparison uses an adapted G1 configuration. A matched run in the full training environment and physical G1 traces remain separate experiments.

## Research links

- [Official SuperMimic project](https://supermimic.github.io/)
- [Official training implementation](https://github.com/HybridRobotics/supermimic)
- [Community reproduction and limitations](https://github.com/CuboiLeo/SuperMimic-Reproduced)
- [MuJoCo WASM](https://github.com/google-deepmind/mujoco/tree/main/wasm)
- [MuJoCo Warp](https://github.com/google-deepmind/mujoco_warp)
- [mjlab](https://github.com/mujocolab/mjlab)
- [ONNX Runtime Web](https://onnxruntime.ai/docs/tutorials/web/)
