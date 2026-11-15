#!/usr/bin/env python3
"""Export the released SuperMimic reproduction's dynamics MLP without importing Torch.

The upstream checkpoint is a PyTorch ZIP with float32 storages. This exporter
whitelists four pickle globals and never invokes arbitrary checkpoint classes.
It emits a standard ONNX graph (Gemm, Sigmoid, Mul), preserves original weight
bytes, and independently evaluates reference cases with Python scalar math.
This is inference conversion only, not training or an official-author checkpoint.
"""
from __future__ import annotations

import argparse
import array
import collections
import hashlib
import io
import json
import math
from pathlib import Path
import pickle
import random
import struct
import sys
import urllib.request
import zipfile

URL = "https://github.com/CuboiLeo/SuperMimic-Reproduced/releases/download/e8-boneseed-100k/e8_boneseed_ckpt_0100000.pt"
REPO = "https://github.com/CuboiLeo/SuperMimic-Reproduced"
RELEASE = REPO + "/releases/tag/e8-boneseed-100k"
EXPECTED_BYTES = 223470223
# Filled from the SHA-256 of the downloaded release artifact, pinned by maintainer.
EXPECTED_SHA256 = "0527bab674556f48eaa7d3a27d650d1d14986019fc982d8acecbf6da75bc5ea6"


class TensorRef:
    def __init__(self, storage, offset, size, stride, *_):
        self.storage, self.offset = storage, offset
        self.size, self.stride = tuple(size), tuple(stride)


def plain_path(*parts):
    return "/".join(parts)


class RestrictedCheckpoint(pickle.Unpickler):
    def find_class(self, module, name):
        allowed = {
            ("collections", "OrderedDict"): collections.OrderedDict,
            ("torch._utils", "_rebuild_tensor_v2"): TensorRef,
            ("torch", "FloatStorage"): "float32",
            ("pathlib", "PosixPath"): plain_path,
        }
        if (module, name) not in allowed:
            raise pickle.UnpicklingError(f"Unsupported checkpoint global: {module}.{name}")
        return allowed[module, name]

    def persistent_load(self, pid):
        if not isinstance(pid, tuple) or len(pid) != 5 or pid[:2] != ("storage", "float32"):
            raise pickle.UnpicklingError(f"Unsupported storage descriptor: {pid!r}")
        return {"key": str(pid[2]), "count": int(pid[4])}


def varint(value):
    assert value >= 0
    out = bytearray()
    while value > 127:
        out.append((value & 127) | 128)
        value >>= 7
    out.append(value)
    return bytes(out)


def integer(field, value):
    return varint(field << 3) + varint(value)


def data(field, payload):
    if isinstance(payload, str):
        payload = payload.encode()
    return varint((field << 3) | 2) + varint(len(payload)) + payload


def value_info(name, dims):
    shape = b"".join(data(1, integer(1, d)) for d in dims)
    tensor_type = integer(1, 1) + data(2, shape)  # FLOAT
    return data(1, name) + data(2, data(1, tensor_type))


def tensor(name, shape, raw):
    return (data(1, b"".join(varint(d) for d in shape)) + integer(2, 1)
            + data(8, name) + data(9, raw))


def node(op, inputs, output, name, trans_b=False):
    msg = b"".join(data(1, n) for n in inputs) + data(2, output) + data(3, name) + data(4, op)
    if trans_b:
        msg += data(5, data(1, "transB") + integer(3, 1) + integer(20, 2))
    return msg


def f32(x):
    return struct.unpack("<f", struct.pack("<f", x))[0]


def reference_forward(features, layers):
    """Independent scalar implementation, double accumulation / float32 layer values."""
    values = [f32(v) for v in features]
    for layer_index, (weights, biases, rows, cols) in enumerate(layers):
        next_values = []
        for row in range(rows):
            start = row * cols
            total = biases[row]
            for col in range(cols):
                total += weights[start + col] * values[col]
            total = f32(total)
            if layer_index < len(layers) - 1:
                # Stable sigmoid for both large signs.
                sigmoid = (1 / (1 + math.exp(-total))) if total >= 0 else (math.exp(total) / (1 + math.exp(total)))
                total = f32(total * sigmoid)
            next_values.append(total)
        values = next_values
    return values


def export(checkpoint: Path, output: Path, allow_unpinned=False):
    raw_checkpoint = checkpoint.read_bytes()
    digest = hashlib.sha256(raw_checkpoint).hexdigest()
    if len(raw_checkpoint) != EXPECTED_BYTES:
        raise ValueError(f"Checkpoint size mismatch: {len(raw_checkpoint)}")
    if digest != EXPECTED_SHA256 and not allow_unpinned:
        raise ValueError(f"Checkpoint SHA-256 mismatch: {digest}")
    archive = zipfile.ZipFile(io.BytesIO(raw_checkpoint))
    pickle_names = [n for n in archive.namelist() if n.endswith("/data.pkl")]
    if len(pickle_names) != 1:
        raise ValueError("Expected exactly one checkpoint pickle")
    prefix = pickle_names[0].removesuffix("data.pkl")
    if archive.read(prefix + "byteorder") != b"little":
        raise ValueError("Only little-endian checkpoint data is supported")
    ck = RestrictedCheckpoint(io.BytesIO(archive.read(pickle_names[0]))).load()
    spec = ck["config"]["world_model"]["state_spec"]
    if ck["config"]["world_model"]["hidden"] != (2048, 2048, 2048):
        raise ValueError("Unexpected hidden-layer configuration")

    def storage(ref):
        expected_stride = []
        stride = 1
        for dim in reversed(ref.size):
            expected_stride.insert(0, stride)
            stride *= dim
        if tuple(expected_stride) != ref.stride:
            raise ValueError("Noncontiguous tensor is not supported")
        b = archive.read(prefix + "data/" + ref.storage["key"])
        if len(b) != ref.storage["count"] * 4:
            raise ValueError("Unexpected storage length")
        b = b[ref.offset * 4:(ref.offset + math.prod(ref.size)) * 4]
        if len(b) != math.prod(ref.size) * 4:
            raise ValueError("Truncated tensor")
        return b

    graph_nodes, initializers, layers, tensor_records = [], [], [], []
    previous = "features"
    shapes = [(2048, 133), (2048, 2048), (2048, 2048), (70, 2048)]
    for layer, expected_shape in enumerate(shapes):
        key = f"dynamics.mlp.net.{2 * layer}"
        wr, br = ck["wm"][key + ".weight"], ck["wm"][key + ".bias"]
        if wr.size != expected_shape or br.size != (expected_shape[0],):
            raise ValueError(f"Unexpected tensor shapes in layer {layer}")
        wb, bb = storage(wr), storage(br)
        wn, bn = f"weight_{layer}", f"bias_{layer}"
        initializers.extend([tensor(wn, wr.size, wb), tensor(bn, br.size, bb)])
        linear_out = "delta" if layer == 3 else f"linear_{layer}"
        graph_nodes.append(node("Gemm", [previous, wn, bn], linear_out, f"linear_{layer}", True))
        if layer < 3:
            graph_nodes.append(node("Sigmoid", [linear_out], f"sigmoid_{layer}", f"sigmoid_{layer}"))
            graph_nodes.append(node("Mul", [linear_out, f"sigmoid_{layer}"], f"silu_{layer}", f"silu_{layer}"))
            previous = f"silu_{layer}"
        wa, ba = array.array("f"), array.array("f")
        wa.frombytes(wb); ba.frombytes(bb)
        if sys.byteorder != "little":
            wa.byteswap(); ba.byteswap()
        layers.append((wa, ba, *expected_shape))
        for name, shape, b in [(key + ".weight", wr.size, wb), (key + ".bias", br.size, bb)]:
            tensor_records.append({"name": name, "shape": list(shape), "sha256": hashlib.sha256(b).hexdigest()})

    graph = (b"".join(data(1, n) for n in graph_nodes) + data(2, "SuperMimicReproducedDynamics")
             + b"".join(data(5, t) for t in initializers)
             + data(11, value_info("features", [1, 133]))
             + data(12, value_info("delta", [1, 70])))
    model = (integer(1, 8) + data(2, "supermimic-stress-lab") + data(3, "1.0")
             + data(7, graph) + data(8, data(1, "") + integer(2, 17)))
    output.mkdir(parents=True, exist_ok=True)
    (output / "world-model.onnx").write_bytes(model)

    rng = random.Random(20261115)
    inputs = [
        ("zero", [0.0] * 133),
        ("canonical-upright", [0.793, 1., 0., 0., 1., 0., 0.] + [0.] * 93 + [(1. - .75) / .45] + [0.] * 32),
        ("seeded-feature-probe", [rng.uniform(-.35, .35) for _ in range(133)]),
    ]
    cases = []
    for name, features in inputs:
        if len(features) != 133:
            raise ValueError(f"Fixture input length: {len(features)}")
        features = [f32(v) for v in features]
        delta = reference_forward(features, layers)
        cases.append({"name": name, "features": features, "delta": delta})
    (output / "parity-fixtures.json").write_text(json.dumps({
        "reference": "Independent Python scalar evaluation of original float32 layer weights; float64 dot accumulation, float32 layer values. Not a PyTorch execution.",
        "checkpoint_sha256": digest,
        "absolute_tolerance": 0.0001,
        "relative_tolerance": 0.0001,
        "cases": cases,
    }, indent=2) + "\n")
    manifest = {
        "name": "SuperMimic-Reproduced E8 learned dynamics",
        "implementation": "Independent reproduction by Yuxi Liu (CuboiLeo), not an official SuperMimic checkpoint",
        "source_repository": REPO,
        "release_url": RELEASE,
        "checkpoint_url": URL,
        "checkpoint_sha256": digest,
        "checkpoint_bytes": len(raw_checkpoint),
        "training_iteration": ck["iteration"],
        "onnx_sha256": hashlib.sha256(model).hexdigest(),
        "onnx_bytes": len(model),
        "input": {"name": "features", "dtype": "float32", "shape": [1, 133], "layout": "canonical state 71, raw executed action 29, normalized context 33"},
        "output": {"name": "delta", "dtype": "float32", "shape": [1, 70], "layout": "Unscaled dv_heading3, dw_body3, d_joint_velocity29, dp_heading3, d_rotation_body3, d_joint_position29"},
        "architecture": [133, 2048, 2048, 2048, 70],
        "activation": "SiLU after each hidden layer",
        "parameters": sum(math.prod(t["shape"]) for t in tensor_records),
        "state_spec": spec,
        "weight_tensors": tensor_records,
        "scope": "Learned dynamics only. No policy, critic, termination head, training code, or motion dataset is included in this ONNX file.",
        "code_license": "MIT, copyright 2026 Yuxi Liu; notice retained in docs/licenses/CuboiLeo-MIT.txt",
        "asset_notice": "This export derives from the separately published E8 BONES-SEED checkpoint. The repository explicitly labels its code MIT; no separate checkpoint-specific license was found in the release description. Raw motion data are not included. Retain provenance and review upstream/dataset terms for your intended redistribution or commercial use.",
    }
    (output / "model-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps({"output": str(output), "checkpoint_sha256": digest, "onnx_bytes": len(model), "onnx_sha256": manifest["onnx_sha256"], "fixture_cases": len(cases)}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--checkpoint", type=Path, default=Path("work/checkpoint.pt"))
    parser.add_argument("--output", type=Path, default=Path("dist/assets"))
    parser.add_argument("--download", action="store_true", help="Download the pinned public upstream release if checkpoint is absent")
    parser.add_argument("--allow-unpinned", action="store_true", help=argparse.SUPPRESS)
    args = parser.parse_args()
    if not args.checkpoint.exists():
        if not args.download:
            parser.error("Checkpoint missing; supply it or use --download")
        args.checkpoint.parent.mkdir(parents=True, exist_ok=True)
        urllib.request.urlretrieve(URL, args.checkpoint)
    export(args.checkpoint, args.output, args.allow_unpinned)
