"""
Wrapper around llama.cpp's convert_hf_to_gguf.py that monkeypatches the
LFM2-VL mmproj tensor filter so it correctly drops the orphan lm_head.weight
tensor that leap-finetune's full-FT merged checkpoints contain.

The base script's MmprojModel.filter_tensors filters out tensors with
"language_model." in the name. After leap-finetune's full fine-tune the
merged checkpoint has lm_head un-tied from embed_tokens and saved at the
top level (no "language_model." prefix), so it slips through the filter
and trips map_tensor_name(). This wrapper fixes that.

Usage (mirrors convert_hf_to_gguf.py):
    python convert_mmproj_lfm2vl.py <hf_dir> --outfile <out.gguf> --outtype f16 --mmproj

Discovery details:
    The orphan tensor is exactly `lm_head.weight`, shape (vocab_size, hidden).
    Inspect any merged HF checkpoint with:
        for k in safetensors.safe_open(...): print(k)

Why this lives in the project, not in the brewed binary:
    brew upgrade reinstalls /opt/homebrew/.../convert_hf_to_gguf.py from
    upstream; an in-place patch wouldn't survive an upgrade. Wrapping with
    a monkeypatch keeps the fix portable + reviewable in the repo.
"""

from __future__ import annotations

# Avoid the "Initializing libomp.dylib, but found libomp.dylib already
# initialized" abort() when both Apple's libomp and PyTorch's bundled
# libomp get loaded into the same process under uv run --with torch.
# Must be set before any torch import.
import os
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")

import importlib.util
import shutil
import sys
from pathlib import Path


def find_brewed_converter() -> Path:
    """Find /opt/homebrew/Cellar/llama.cpp/<ver>/bin/convert_hf_to_gguf.py."""
    cellar = Path("/opt/homebrew/Cellar/llama.cpp")
    if not cellar.is_dir():
        raise RuntimeError(f"{cellar} not found. brew install llama.cpp")
    versions = sorted([p for p in cellar.iterdir() if p.is_dir()])
    if not versions:
        raise RuntimeError(f"No llama.cpp install under {cellar}")
    converter = versions[-1] / "bin" / "convert_hf_to_gguf.py"
    if not converter.is_file():
        raise RuntimeError(f"convert_hf_to_gguf.py not found in {versions[-1]}/bin")
    return converter


def load_converter_module(path: Path):
    """Import the brewed convert_hf_to_gguf.py as a module without running main."""
    # Prevent the script from auto-running main() at import time. The brewed
    # script's main() is gated on `if __name__ == "__main__"`, so loading it
    # under a different name (its own pkg name) is safe.
    spec = importlib.util.spec_from_file_location("convert_hf_to_gguf", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules["convert_hf_to_gguf"] = module
    spec.loader.exec_module(module)
    return module


def patch_lfm2_vl(module) -> None:
    """Extend LFM2VLModel.filter_tensors to also drop top-level lm_head.* tensors."""
    LFM2VLModel = module.LFM2VLModel
    original_filter = LFM2VLModel.filter_tensors

    @classmethod
    def patched_filter(cls, item):
        name, _gen = item
        # Drop the orphan lm_head left at top level by leap-finetune's
        # merged full-FT checkpoint. The base MmprojModel filter only
        # looks for "language_model." prefix, which lm_head doesn't have.
        if name == "lm_head.weight" or name.startswith("lm_head."):
            return None
        return original_filter.__func__(cls, item)

    LFM2VLModel.filter_tensors = patched_filter
    print(
        f"[convert_mmproj_lfm2vl] patched LFM2VLModel.filter_tensors to drop "
        f"top-level lm_head.* tensors before mmproj conversion",
        flush=True,
    )


def main() -> int:
    converter = find_brewed_converter()
    print(f"[convert_mmproj_lfm2vl] using {converter}", flush=True)

    module = load_converter_module(converter)
    patch_lfm2_vl(module)

    # Now invoke the upstream main(). It uses argparse on sys.argv directly.
    return module.main() or 0


if __name__ == "__main__":
    sys.exit(main())
